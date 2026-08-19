import mongoose, { Types, type AnyBulkWriteOperation } from "mongoose";

import "../config/env";
import { ClassMaterial } from "../models/ClassMaterial";
import { StudentMaterialProgress } from "../models/StudentMaterialProgress";
import { Student } from "../models/Student";
import { Subscription } from "../models/Subscription";
import { normalizeCanonicalClassName } from "../utils/studentClass";

type Options = {
  apply: boolean;
  meetingCount: number;
  branches: string[];
};

type MaterialDoc = {
  materialId: string;
  classId: string;
  className: string;
  canonicalClassName?: string | null;
  branch: string;
  meetingNumber: number;
  date: string;
};

type StudentDoc = {
  _id: Types.ObjectId;
  studentId: string;
  branch: string;
  className: string;
  program: string;
  utbkTrack?: string | null;
};

type SubscriptionDoc = {
  _id: Types.ObjectId;
  studentId: Types.ObjectId;
  startDate: Date | null;
  endDate: Date | null;
};

type ExistingProgressDoc = {
  _id: Types.ObjectId;
  materialId: string;
  studentId: string;
  subscriptionId?: Types.ObjectId | null;
};

type ProgressWriteCandidate = {
  material: MaterialDoc;
  student: StudentDoc;
  subscription: SubscriptionDoc;
};

const DEFAULT_BRANCHES = ["Slawi", "Adiwerna"];
const DEFAULT_MEETING_COUNT = 9;
const TARGET_DURATION_SECONDS = 15 * 60;
const DAY_START_HOUR = "15:00";

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function normalizeKey(value: string | null | undefined) {
  return normalizeText(value).toLowerCase();
}

function stableHash(seed: string) {
  let hash = 2166136261;

  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36).padStart(7, "0");
}

function stableProgressId(materialId: string, studentId: string) {
  return `MPR-BIMBEL-P1P9-${stableHash(`${materialId}|${studentId}`)}`;
}

function parseOptions(args: string[]): Options {
  const meetingsArgument = args.find((argument) =>
    argument.startsWith("--meetings="),
  );
  const branchesArgument = args.find((argument) =>
    argument.startsWith("--branches="),
  );
  const meetingCount = Number(
    meetingsArgument?.split("=")[1] ?? DEFAULT_MEETING_COUNT,
  );
  const branches = branchesArgument
    ? branchesArgument
        .split("=")[1]
        ?.split(",")
        .map(normalizeText)
        .filter(Boolean) ?? DEFAULT_BRANCHES
    : DEFAULT_BRANCHES;

  if (!Number.isInteger(meetingCount) || meetingCount < 1 || meetingCount > 24) {
    throw new Error("Jumlah pertemuan harus angka 1 sampai 24.");
  }

  return {
    apply: args.includes("--apply"),
    meetingCount,
    branches,
  };
}

function getDateKey(date: Date | null | undefined) {
  if (!date) {
    return "";
  }

  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Jakarta",
    year: "numeric",
  }).format(date);
}

function isSubscriptionCoveringMaterial(
  subscription: SubscriptionDoc,
  material: MaterialDoc,
) {
  const materialDate = normalizeText(material.date);
  const startDate = getDateKey(subscription.startDate);
  const endDate = getDateKey(subscription.endDate);

  if (startDate && materialDate < startDate) {
    return false;
  }

  if (endDate && materialDate >= endDate) {
    return false;
  }

  return true;
}

function isUtbkStudentLike(student: StudentDoc) {
  const program = normalizeText(student.program).toUpperCase();
  const className = normalizeText(student.className).toUpperCase();
  const utbkTrack = normalizeText(student.utbkTrack);

  return program === "UTBK" || className.includes("UTBK") || Boolean(utbkTrack);
}

function getMaterialClassKey(material: MaterialDoc) {
  return normalizeKey(
    material.canonicalClassName ||
      normalizeCanonicalClassName(material.className) ||
      material.className,
  );
}

function getStudentClassKey(student: StudentDoc) {
  return normalizeKey(
    normalizeCanonicalClassName(student.className) || student.className,
  );
}

function getProgressKey(
  materialId: string,
  studentId: string,
  subscriptionId: Types.ObjectId | string | null | undefined,
) {
  return [
    normalizeText(materialId),
    normalizeText(studentId),
    subscriptionId ? subscriptionId.toString() : "legacy",
  ].join("::");
}

function getMaterialStudyTimes(material: MaterialDoc) {
  const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(material.date)
    ? material.date
    : getDateKey(new Date());
  const startedAt = new Date(`${dateKey}T${DAY_START_HOUR}:00.000+07:00`);
  const completedAt = new Date(startedAt.getTime() + TARGET_DURATION_SECONDS * 1000);

  return {
    startedAt,
    completedAt,
  };
}

async function loadActiveSubscriptions(branches: string[]) {
  const now = new Date();
  const activeSubscriptions = (await Subscription.find({
    paymentStatus: "paid",
    startDate: { $lte: now },
    endDate: { $gt: now },
  })
    .select("_id studentId startDate endDate")
    .lean()
    .exec()) as SubscriptionDoc[];
  const subscriptionByStudentObjectId = new Map<string, SubscriptionDoc>();

  for (const subscription of activeSubscriptions) {
    const key = subscription.studentId.toString();

    if (!subscriptionByStudentObjectId.has(key)) {
      subscriptionByStudentObjectId.set(key, subscription);
    }
  }

  const students = (await Student.find({
    _id: { $in: [...subscriptionByStudentObjectId.keys()] },
    branch: { $in: branches },
    status: "Aktif",
  })
    .select("_id studentId branch className program utbkTrack")
    .lean()
    .exec()) as StudentDoc[];

  return {
    students,
    subscriptionByStudentObjectId,
  };
}

async function buildCandidates(options: Options) {
  const { students, subscriptionByStudentObjectId } =
    await loadActiveSubscriptions(options.branches);
  const regularStudents = students.filter((student) => !isUtbkStudentLike(student));
  const studentsByBranchAndClass = new Map<string, StudentDoc[]>();

  for (const student of regularStudents) {
    const key = `${normalizeKey(student.branch)}|${getStudentClassKey(student)}`;
    const current = studentsByBranchAndClass.get(key) ?? [];
    current.push(student);
    studentsByBranchAndClass.set(key, current);
  }

  const materials = (await ClassMaterial.find({
    branch: { $in: options.branches },
    meetingNumber: { $gte: 1, $lte: options.meetingCount },
    status: "Dipublikasikan",
  })
    .select("materialId classId className canonicalClassName branch meetingNumber date")
    .sort({ branch: 1, className: 1, meetingNumber: 1, date: 1 })
    .lean()
    .exec()) as MaterialDoc[];
  const candidates: ProgressWriteCandidate[] = [];

  for (const material of materials) {
    const key = `${normalizeKey(material.branch)}|${getMaterialClassKey(material)}`;
    const studentsForMaterial = studentsByBranchAndClass.get(key) ?? [];

    for (const student of studentsForMaterial) {
      const subscription =
        subscriptionByStudentObjectId.get(student._id.toString()) ?? null;

      if (!subscription || !isSubscriptionCoveringMaterial(subscription, material)) {
        continue;
      }

      candidates.push({
        material,
        student,
        subscription,
      });
    }
  }

  return {
    candidates,
    materials,
    regularStudents,
  };
}

async function buildExistingProgressMap(candidates: ProgressWriteCandidate[]) {
  const materialIds = Array.from(
    new Set(candidates.map((candidate) => candidate.material.materialId)),
  );
  const studentIds = Array.from(
    new Set(candidates.map((candidate) => candidate.student.studentId)),
  );
  const subscriptionIds = Array.from(
    new Set(
      candidates.map((candidate) => candidate.subscription._id.toString()),
    ),
  ).map((subscriptionId) => new Types.ObjectId(subscriptionId));

  if (!materialIds.length || !studentIds.length) {
    return new Map<string, ExistingProgressDoc>();
  }

  const existingProgresses = (await StudentMaterialProgress.find({
    materialId: { $in: materialIds },
    studentId: { $in: studentIds },
    $or: [
      { subscriptionId: { $in: subscriptionIds } },
      { subscriptionId: null },
      { subscriptionId: { $exists: false } },
    ],
  })
    .select("_id materialId studentId subscriptionId")
    .lean()
    .exec()) as ExistingProgressDoc[];
  const progressByKey = new Map<string, ExistingProgressDoc>();

  for (const progress of existingProgresses) {
    progressByKey.set(
      getProgressKey(progress.materialId, progress.studentId, progress.subscriptionId),
      progress,
    );
  }

  return progressByKey;
}

async function applyCandidates(candidates: ProgressWriteCandidate[]) {
  const existingProgressByKey = await buildExistingProgressMap(candidates);
  const operations: AnyBulkWriteOperation[] = [];
  let created = 0;
  let updated = 0;

  for (const candidate of candidates) {
    const { material, student, subscription } = candidate;
    const exactKey = getProgressKey(
      material.materialId,
      student.studentId,
      subscription._id,
    );
    const legacyKey = getProgressKey(material.materialId, student.studentId, null);
    const existingProgress =
      existingProgressByKey.get(exactKey) ?? existingProgressByKey.get(legacyKey);
    const { startedAt, completedAt } = getMaterialStudyTimes(material);
    const updatePayload = {
      materialId: material.materialId,
      classId: material.classId,
      studentId: student.studentId,
      studentObjectId: student._id,
      subscriptionId: subscription._id,
      status: "Selesai" as const,
      startedAt,
      lastOpenedAt: completedAt,
      completedAt,
      durationSeconds: TARGET_DURATION_SECONDS,
    };

    if (existingProgress) {
      operations.push({
        updateOne: {
          filter: { _id: existingProgress._id },
          update: { $set: updatePayload },
        },
      });
      updated += 1;
      continue;
    }

    operations.push({
      updateOne: {
        filter: {
          materialId: material.materialId,
          studentId: student.studentId,
          subscriptionId: subscription._id,
        },
        update: {
          $set: updatePayload,
          $setOnInsert: {
            progressId: stableProgressId(material.materialId, student.studentId),
          },
        },
        upsert: true,
      },
    });
    created += 1;
  }

  for (let index = 0; index < operations.length; index += 500) {
    await StudentMaterialProgress.bulkWrite(
      operations.slice(index, index + 500),
      {
        ordered: false,
      },
    );
  }

  return {
    created,
    updated,
  };
}

async function run() {
  const options = parseOptions(process.argv.slice(2));

  await mongoose.connect(process.env.MONGO_URI as string);

  const { candidates, materials, regularStudents } = await buildCandidates(options);
  const existingProgressByKey = options.apply
    ? new Map<string, ExistingProgressDoc>()
    : await buildExistingProgressMap(candidates);
  const dryRunCreated = options.apply
    ? 0
    : candidates.filter((candidate) => {
        const exactKey = getProgressKey(
          candidate.material.materialId,
          candidate.student.studentId,
          candidate.subscription._id,
        );
        const legacyKey = getProgressKey(
          candidate.material.materialId,
          candidate.student.studentId,
          null,
        );

        return !existingProgressByKey.has(exactKey) && !existingProgressByKey.has(legacyKey);
      }).length;
  const dryRunUpdated = options.apply ? 0 : candidates.length - dryRunCreated;
  const writeStats = options.apply
    ? await applyCandidates(candidates)
    : {
        created: dryRunCreated,
        updated: dryRunUpdated,
      };

  console.log(
    `[backfill-material-progress-p1-p9] action=${options.apply ? "apply" : "dry-run"} meetings=${options.meetingCount} branches=${options.branches.join(", ")}`,
  );
  console.table([
    {
      "Materi P1-P9": materials.length,
      "Siswa Reguler Aktif": regularStudents.length,
      "Progress Dibuat": writeStats.created,
      "Progress Diupdate": writeStats.updated,
      "Total Selesai": candidates.length,
    },
  ]);

  if (!options.apply) {
    console.log("Dry-run selesai. Jalankan ulang dengan --apply untuk menyimpan.");
  }
}

run()
  .catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
