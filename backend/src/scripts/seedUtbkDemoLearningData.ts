import mongoose from "mongoose";

import "../config/env";
import { ClassMaterial } from "../models/ClassMaterial";
import { Schedule } from "../models/Schedule";
import { Student, type StudentDocument } from "../models/Student";
import { StudentTryoutAttempt } from "../models/StudentTryoutAttempt";
import { Subscription } from "../models/Subscription";
import { Teacher, type TeacherDocument } from "../models/Teacher";
import { TeacherTryout } from "../models/TeacherTryout";
import { TeacherTryoutQuestion } from "../models/TeacherTryoutQuestion";
import { getCurrentAcademicPeriod } from "../utils/academicGrade";
import { getJakartaDateKey } from "../utils/studentAcademicStatus";
import { getUtbkScheduleClassNames } from "../utils/studentProgram";
import { buildStableTeacherClassId } from "../utils/teacherClassIdentity";

type SeedOptions = {
  apply: boolean;
  studentId: string;
};

type SeedAction = "created" | "updated" | "skipped";

type SeedContext = {
  student: StudentDocument;
  teacher: TeacherDocument;
  branch: string;
  className: string;
  classId: string;
  room: string;
  academicYear: string;
  semester: string;
};

function normalizeText(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function normalizePublicIdPart(value: string) {
  const normalizedValue = normalizeText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalizedValue || "GLOBAL";
}

function parseOptions(argv: string[]): SeedOptions {
  const studentArg = argv.find((item) => item.startsWith("--student="));

  return {
    apply: argv.includes("--apply"),
    studentId: normalizeText(studentArg?.split("=").slice(1).join("=")),
  };
}

async function findTargetStudent(options: SeedOptions) {
  if (options.studentId) {
    return Student.findOne({
      studentId: options.studentId,
      program: /^UTBK$/i,
      status: "Aktif",
    }).exec();
  }

  const preferredStudent = await Student.findOne({
    studentId: "STD-301",
    program: /^UTBK$/i,
    status: "Aktif",
  }).exec();

  if (preferredStudent) {
    return preferredStudent;
  }

  return Student.findOne({
    program: /^UTBK$/i,
    status: "Aktif",
  })
    .sort({ createdAt: -1, studentId: -1 })
    .exec();
}

async function resolveSeedContext(
  student: StudentDocument,
): Promise<SeedContext> {
  const branch = normalizeText(student.branch);
  const eligibleClassNames = getUtbkScheduleClassNames(student);

  if (!branch || eligibleClassNames.length === 0) {
    throw new Error("Profil siswa UTBK belum memiliki cabang atau track kelas.");
  }

  const schedule = await Schedule.findOne({
    branch,
    className: {
      $in: eligibleClassNames,
    },
    subject: "TPS",
  })
    .sort({ className: 1, scheduleId: 1 })
    .exec();
  const teacher =
    (schedule ? await Teacher.findById(schedule.teacherId).exec() : null) ??
    (await Teacher.findOne({
      status: "Aktif",
      $or: [{ branch }, { branches: branch }],
    })
      .sort({ teacherId: 1 })
      .exec());

  if (!teacher) {
    throw new Error(
      `Tidak ada guru existing aktif untuk cabang ${branch}. Jalankan seed jadwal UTBK atau pilih guru di admin lebih dulu.`,
    );
  }

  const className = normalizeText(schedule?.className) || eligibleClassNames[0]!;
  const period = {
    academicYear:
      normalizeText(schedule?.academicYear) || getCurrentAcademicPeriod().academicYear,
    semester:
      normalizeText(schedule?.semester) || getCurrentAcademicPeriod().semester,
  };

  return {
    student,
    teacher,
    branch,
    className,
    classId: buildStableTeacherClassId(teacher.teacherId, branch, className),
    room: normalizeText(schedule?.room) || `Ruang UTBK ${branch}`,
    academicYear: period.academicYear,
    semester: period.semester,
  };
}

async function upsertUtbkMaterial(context: SeedContext, options: SeedOptions) {
  const materialId = `MAT-UTBK-DEMO-${normalizePublicIdPart(context.branch)}-001`;
  const now = new Date();
  const payload = {
    materialId,
    classId: context.classId,
    teacherId: context.teacher._id,
    className: context.className,
    canonicalClassName: context.className,
    subject: "TPS",
    branch: context.branch,
    room: context.room,
    meetingNumber: 1,
    date: getJakartaDateKey(now),
    title: "Strategi TPS: Perbandingan dan Penalaran Kuantitatif",
    description:
      "Modul ringkas UTBK untuk melatih pola perbandingan, eliminasi opsi, dan penalaran kuantitatif dasar SNBT.",
    linkUrl: "",
    attachment: null,
    status: "Dipublikasikan" as const,
    academicYear: context.academicYear,
    semester: context.semester,
  };
  const existingMaterial = await ClassMaterial.findOne({ materialId }).exec();

  if (!options.apply) {
    return {
      action: existingMaterial ? "skipped" : "created",
      materialId,
      title: payload.title,
    };
  }

  if (existingMaterial) {
    existingMaterial.set(payload);
    await existingMaterial.save();

    return {
      action: "updated" as SeedAction,
      materialId,
      title: existingMaterial.title,
    };
  }

  const createdMaterial = await ClassMaterial.create(payload);

  return {
    action: "created" as SeedAction,
    materialId,
    title: createdMaterial.title,
  };
}

async function upsertUtbkTryout(context: SeedContext, options: SeedOptions) {
  const tryoutId = `TO-UTBK-DEMO-${normalizePublicIdPart(context.branch)}-001`;
  const questionId = `TQ-UTBK-DEMO-${normalizePublicIdPart(context.branch)}-001`;
  const now = new Date();
  const startAt = new Date(now.getTime() - 60 * 60 * 1000);
  const endAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const tryoutPayload = {
    teacherId: context.teacher._id,
    tryoutId,
    classId: context.classId,
    branch: context.branch,
    canonicalClassName: context.className,
    assessmentType: "Tryout" as const,
    title: "Tryout UTBK 1 - TPS",
    jenjang: "SMA" as const,
    kelas: "UTBK",
    subject: "TPS",
    stage: 1,
    durationMinutes: 30,
    startAt,
    endAt,
    publishStatus: "published" as const,
    reviewStatus: "Disetujui" as const,
    questionSource: "manual" as const,
    questionCount: 1,
    questionBankId: null,
    questionSetId: null,
    packageId: null,
    fileName: null,
    academicYear: context.academicYear,
    semester: context.semester,
  };
  const questionPayload = {
    questionId,
    teacherId: context.teacher._id,
    tryoutId,
    questionText:
      "Jika 3 siswa menyelesaikan 6 paket soal dalam 4 hari, berapa paket soal yang dapat diselesaikan 6 siswa dalam 4 hari dengan produktivitas yang sama?",
    optionA: "6 paket soal",
    optionB: "9 paket soal",
    optionC: "12 paket soal",
    optionD: "18 paket soal",
    correctAnswer: "C" as const,
    order: 1,
  };
  const existingTryout = await TeacherTryout.findOne({ tryoutId }).exec();
  const existingQuestion = await TeacherTryoutQuestion.findOne({
    questionId,
  }).exec();

  if (!options.apply) {
    return {
      tryout: {
        action: existingTryout ? "skipped" : "created",
        tryoutId,
        title: tryoutPayload.title,
      },
      question: {
        action: existingQuestion ? "skipped" : "created",
        questionId,
      },
    };
  }

  const tryout = existingTryout
    ? await TeacherTryout.findOneAndUpdate(
        { tryoutId },
        { $set: tryoutPayload },
        { new: true, runValidators: true },
      ).exec()
    : await TeacherTryout.create(tryoutPayload);

  const question = existingQuestion
    ? await TeacherTryoutQuestion.findOneAndUpdate(
        { questionId },
        { $set: questionPayload },
        { new: true, runValidators: true },
      ).exec()
    : await TeacherTryoutQuestion.create(questionPayload);

  if (!tryout || !question) {
    throw new Error("Tryout atau soal demo UTBK gagal disimpan.");
  }

  return {
    tryout: {
      action: existingTryout ? "updated" : "created",
      tryoutId,
      title: tryout.title,
    },
    question: {
      action: existingQuestion ? "updated" : "created",
      questionId,
    },
  };
}

async function upsertUtbkSubmittedAttempt(
  context: SeedContext,
  options: SeedOptions,
) {
  const tryoutId = `TO-UTBK-DEMO-${normalizePublicIdPart(context.branch)}-001`;
  const questionId = `TQ-UTBK-DEMO-${normalizePublicIdPart(context.branch)}-001`;
  const attemptId = `STA-UTBK-DEMO-${normalizePublicIdPart(context.student.studentId)}`;
  const existingAttempt = await StudentTryoutAttempt.findOne({
    tryoutId,
    studentId: context.student.studentId,
  }).exec();
  const subscription = await Subscription.findOne({
    studentId: context.student._id,
    paymentStatus: "paid",
    startDate: { $lte: new Date() },
    endDate: { $gt: new Date() },
  })
    .sort({ endDate: -1, createdAt: -1 })
    .exec();
  const payload = {
    attemptId,
    tryoutId,
    teacherId: context.teacher._id,
    classId: context.classId,
    branch: context.branch,
    studentId: context.student.studentId,
    subscriptionId: subscription?._id ?? null,
    questionSetId: "",
    packageId: "",
    stage: 1,
    answers: [
      {
        questionId,
        selectedAnswer: "C" as const,
        isCorrect: true,
      },
    ],
    correctCount: 1,
    wrongCount: 0,
    unansweredCount: 0,
    score: 100,
    timeUsedSeconds: 180,
    startedAt: new Date(Date.now() - 10 * 60 * 1000),
    submittedAt: new Date(),
    status: "submitted" as const,
  };

  if (!options.apply) {
    return {
      action: existingAttempt ? "skipped" : "created",
      attemptId,
      score: payload.score,
      studentId: context.student.studentId,
    };
  }

  if (existingAttempt?.status === "submitted") {
    return {
      action: "skipped" as SeedAction,
      attemptId: existingAttempt.attemptId,
      score: existingAttempt.score,
      studentId: existingAttempt.studentId,
    };
  }

  const attempt = existingAttempt
    ? await StudentTryoutAttempt.findOneAndUpdate(
        { tryoutId, studentId: context.student.studentId },
        { $set: payload },
        { new: true, runValidators: true },
      ).exec()
    : await StudentTryoutAttempt.create(payload);

  if (!attempt) {
    throw new Error("Attempt demo UTBK gagal disimpan.");
  }

  return {
    action: existingAttempt ? "updated" : "created",
    attemptId: attempt.attemptId,
    score: attempt.score,
    studentId: attempt.studentId,
  };
}

async function run() {
  const options = parseOptions(process.argv.slice(2));
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI wajib tersedia di backend/.env");
  }

  await mongoose.connect(mongoUri);

  try {
    const student = await findTargetStudent(options);

    if (!student) {
      console.log(
        JSON.stringify(
          {
            mode: options.apply ? "apply" : "dry-run",
            message: options.studentId
              ? `Siswa UTBK aktif ${options.studentId} tidak ditemukan.`
              : "Tidak ada siswa UTBK aktif untuk data demo.",
          },
          null,
          2,
        ),
      );
      return;
    }

    const context = await resolveSeedContext(student);
    const [material, tryoutResult] = await Promise.all([
      upsertUtbkMaterial(context, options),
      upsertUtbkTryout(context, options),
    ]);
    const attempt = await upsertUtbkSubmittedAttempt(context, options);

    console.log(
      JSON.stringify(
        {
          mode: options.apply ? "apply" : "dry-run",
          targetStudent: {
            studentId: context.student.studentId,
            branch: context.branch,
            program: context.student.program,
            className: context.student.className,
            utbkTrack: context.student.utbkTrack ?? "",
          },
          teacher: {
            teacherId: context.teacher.teacherId,
            subject: context.teacher.subject,
          },
          classScope: {
            className: context.className,
            classId: context.classId,
            room: context.room,
            academicYear: context.academicYear,
            semester: context.semester,
          },
          material,
          tryout: tryoutResult.tryout,
          question: tryoutResult.question,
          attempt,
        },
        null,
        2,
      ),
    );
  } finally {
    await mongoose.disconnect();
  }
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
});
