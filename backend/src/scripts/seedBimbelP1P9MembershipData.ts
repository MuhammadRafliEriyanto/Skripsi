import mongoose, { Types } from "mongoose";
import fs from "node:fs";
import path from "node:path";

import "../config/env";
import { AttendanceRecord } from "../models/AttendanceRecord";
import { AttendanceSession } from "../models/AttendanceSession";
import { ClassMaterial } from "../models/ClassMaterial";
import { ClassTask } from "../models/ClassTask";
import {
  ClassTaskQuestion,
  type ClassTaskQuestionAnswer,
} from "../models/ClassTaskQuestion";
import { Schedule, SCHEDULE_SUBJECTS } from "../models/Schedule";
import { Student } from "../models/Student";
import { StudentTaskAttempt } from "../models/StudentTaskAttempt";
import { Subscription } from "../models/Subscription";
import { TaskGrade } from "../models/TaskGrade";
import { TaskSubmission } from "../models/TaskSubmission";
import { Teacher } from "../models/Teacher";
import { User } from "../models/User";
import { normalizeCanonicalClassName } from "../utils/studentClass";
import {
  isUtbkScheduleClassName,
  isUtbkScheduleSubject,
  isUtbkStudent,
} from "../utils/studentProgram";
import { QuestionBank } from "../models/QuestionBank";

type SeedOptions = {
  apply: boolean;
  replaceExisting: boolean;
  branches: string[];
  meetingCount: number;
};

type SeedTeacher = {
  _id: Types.ObjectId;
  teacherId: string;
  subject?: string;
  branch: string;
  branches?: string[];
};

type SeedSchedule = {
  scheduleId: string;
  teacherId: Types.ObjectId;
  day: string;
  time: string;
  className: string;
  branch: string;
  subject: string;
  room: string;
};

type SeedStudent = {
  _id: Types.ObjectId;
  studentId: string;
  userId: Types.ObjectId;
  branch: string;
  program: string;
  className: string;
  utbkTrack?: string | null;
  status: string;
  academicJoinedAt?: Date | null;
};

type SeedSubscription = {
  _id: Types.ObjectId;
  studentId: Types.ObjectId;
  userId: Types.ObjectId;
  startDate: Date | null;
  endDate: Date | null;
  paymentStatus: string;
  status: string;
  createdAt?: Date;
};

type SeedClassGroup = {
  teacher: SeedTeacher;
  classId: string;
  className: string;
  canonicalClassName: string;
  branch: string;
  subject: string;
  room: string;
  schedules: SeedSchedule[];
  students: SeedStudent[];
  subscriptionByStudentObjectId: Map<string, SeedSubscription>;
};

type AttendanceStatus = "Hadir" | "Sakit" | "Alpa";

type MeetingPlan = {
  meetingNumber: number;
  date: string;
  startTime: string;
  scheduleId: string | null;
  room: string;
  topic: string;
};

type SeedStats = {
  branches: Map<string, BranchStats>;
  skippedStudentsWithoutSchedule: number;
  groups: number;
  students: number;
  schedulesCreated: number;
  schedulesUpdated: number;
  materialsCreated: number;
  materialsUpdated: number;
  tasksCreated: number;
  tasksUpdated: number;
  questionsCreated: number;
  questionsUpdated: number;
  sessionsCreated: number;
  sessionsUpdated: number;
  recordsCreated: number;
  recordsUpdated: number;
  submissionsCreated: number;
  submissionsUpdated: number;
  attemptsCreated: number;
  attemptsUpdated: number;
  gradesCreated: number;
  gradesUpdated: number;
};

type BranchStats = {
  groups: number;
  students: Set<string>;
  presentRecords: number;
  sickRecords: number;
  alphaRecords: number;
  scoreVeryHigh: number;
  scoreHigh: number;
  scoreTuntas: number;
  scoreRemedial: number;
  scoreAbsentZero: number;
};

const DEFAULT_BRANCHES = ["Slawi", "Adiwerna"];
const DEFAULT_MEETING_COUNT = 9;
const PASSING_GRADE = 70;
const DURATION_MINUTES = 45;

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const SEED_LAST_FEBRUARY_DATE = "2026-02-28";
const SEED_MEETING_DATES = [
  "2026-02-02",
  "2026-02-05",
  "2026-02-08",
  "2026-02-11",
  "2026-02-14",
  "2026-02-17",
  "2026-02-20",
  "2026-02-23",
  "2026-02-26",
];
const SCORE_BUCKETS = {
  veryHigh: [90, 95],
  high: [85],
  tuntas: [70, 75, 80],
  remedial: [50, 55, 60],
};
const TOPICS = [
  "Diagnostik konsep dasar",
  "Pemahaman materi inti",
  "Latihan pola soal bertahap",
  "Aplikasi konsep pada soal cerita",
  "Penguatan strategi pengerjaan",
  "Latihan campuran terarah",
  "Evaluasi tengah progres",
  "Remediasi konsep sulit",
  "Pemantapan progres belajar",
];

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function normalizeKey(value: string | null | undefined) {
  return normalizeText(value).toLowerCase();
}

function slugify(value: string) {
  return normalizeKey(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function shortHash(seed: string) {
  let hash = 2166136261;

  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36).padStart(7, "0");
}

function stablePublicId(prefix: string, ...parts: string[]) {
  return `${prefix}-BIMBEL-P1P9-${shortHash(parts.join("|"))}`;
}

function buildStableClassId(
  teacherPublicId: string,
  branch: string,
  className: string,
) {
  const teacherSlug = slugify(teacherPublicId) || "guru";
  const branchSlug = slugify(branch) || "cabang";
  const classSlug = slugify(className) || "kelas";

  return `class-${teacherSlug}-${branchSlug}-${classSlug}`;
}

function isFallbackScheduleId(scheduleId: string) {
  return normalizeText(scheduleId).startsWith("SCH-BIMBEL-P1P9-");
}

function resolveScheduleSubject(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);

  return (SCHEDULE_SUBJECTS as readonly string[]).includes(normalizedValue)
    ? normalizedValue
    : "Matematika";
}

function resolveFallbackTeacher(teachers: SeedTeacher[], branch: string) {
  const normalizedBranch = normalizeKey(branch);

  return (
    teachers.find((teacher) => normalizeKey(teacher.branch) === normalizedBranch) ??
    teachers.find((teacher) =>
      (teacher.branches ?? []).some(
        (teacherBranch) => normalizeKey(teacherBranch) === normalizedBranch,
      ),
    ) ??
    null
  );
}

function parseOptions(args: string[]): SeedOptions {
  const branchesArgument = args.find((argument) =>
    argument.startsWith("--branches="),
  );
  const meetingsArgument = args.find((argument) =>
    argument.startsWith("--meetings="),
  );
  const branches = branchesArgument
    ? branchesArgument
        .split("=")[1]
        ?.split(",")
        .map(normalizeText)
        .filter(Boolean) ?? DEFAULT_BRANCHES
    : DEFAULT_BRANCHES;
  const meetingCount = Number(
    meetingsArgument?.split("=")[1] ?? DEFAULT_MEETING_COUNT,
  );

  if (!Number.isInteger(meetingCount) || meetingCount < 1 || meetingCount > 24) {
    throw new Error("Jumlah pertemuan harus angka 1 sampai 24.");
  }

  const apply = args.includes("--apply");
  const replaceExisting = args.includes("--replace-existing");

  if (apply && !replaceExisting) {
    throw new Error(
      "Apply seed P1-P9 wajib memakai --replace-existing agar tidak sengaja menimpa histori/nilai lama.",
    );
  }

  return {
    apply,
    replaceExisting,
    branches,
    meetingCount,
  };
}

function randomFloat(seed: string) {
  return Number.parseInt(shortHash(seed), 36) / 0xffffffff;
}

function pick<T>(seed: string, values: readonly T[]) {
  const index = Math.min(
    Math.floor(randomFloat(seed) * values.length),
    values.length - 1,
  );

  return values[index];
}

function getAttendanceStatus(seed: string): AttendanceStatus {
  const roll = randomFloat(seed);

  if (roll < 0.74) {
    return "Hadir";
  }

  if (roll < 0.86) {
    return "Sakit";
  }

  return "Alpa";
}

function getAttendanceNote(status: AttendanceStatus) {
  if (status === "Sakit") {
    return "Sakit, tidak mengikuti sesi belajar.";
  }

  if (status === "Alpa") {
    return "Tidak hadir tanpa keterangan.";
  }

  return "";
}

function getScoreForAttendance(status: AttendanceStatus, seed: string) {
  if (status !== "Hadir") {
    return 0;
  }

  const roll = randomFloat(seed);

  if (roll < 0.2) {
    return pick(`${seed}:very-high`, SCORE_BUCKETS.veryHigh);
  }

  if (roll < 0.45) {
    return pick(`${seed}:high`, SCORE_BUCKETS.high);
  }

  if (roll < 0.78) {
    return pick(`${seed}:tuntas`, SCORE_BUCKETS.tuntas);
  }

  return pick(`${seed}:remedial`, SCORE_BUCKETS.remedial);
}

function getScoreBucket(score: number, status: AttendanceStatus) {
  if (status !== "Hadir") {
    return "absentZero" as const;
  }

  if (score >= 90) {
    return "veryHigh" as const;
  }

  if (score >= 82) {
    return "high" as const;
  }

  if (score >= 70) {
    return "tuntas" as const;
  }

  return "remedial" as const;
}

function getJakartaDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Jakarta",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "2026";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000+07:00`);
}

function addDays(dateKey: string, days: number) {
  const date = parseDateKey(dateKey);
  return getJakartaDateKey(new Date(date.getTime() + days * DAY_IN_MS));
}

function addMonths(dateKey: string, months: number) {
  const date = parseDateKey(dateKey);
  date.setMonth(date.getMonth() + months);
  return getJakartaDateKey(date);
}

function getStartTime(timeValue: string) {
  return timeValue.match(/\b\d{2}:\d{2}\b/)?.[0] ?? "15:00";
}

function getFallbackDay(seed: string) {
  return pick(seed, ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]);
}

function getFallbackTime(seed: string) {
  return pick(seed, [
    "14:00 - 15:30",
    "15:30 - 17:00",
    "17:00 - 18:30",
    "18:30 - 20:00",
  ]);
}

function getWrongAnswer(answer: ClassTaskQuestionAnswer): ClassTaskQuestionAnswer {
  return answer === "D" ? "A" : ((String.fromCharCode(answer.charCodeAt(0) + 1)) as ClassTaskQuestionAnswer);
}

function getGradeNumber(className: string) {
  const match = normalizeText(className).match(/\b(1[0-2]|[4-9])\b/);
  return match ? Number(match[1]) : null;
}

function isSupportedLearningBankClass(className: string) {
  const gradeNumber = getGradeNumber(className);

  return Boolean(gradeNumber && gradeNumber >= 4 && gradeNumber <= 12);
}

function isRegularStudentProgramClassMatch(student: SeedStudent, canonicalClassName: string) {
  if (isUtbkStudent(student)) {
    return false;
  }

  const normalizedProgram = normalizeText(student.program).toUpperCase();

  if (
    (normalizedProgram === "SD" ||
      normalizedProgram === "SMP" ||
      normalizedProgram === "SMA") &&
    !canonicalClassName.startsWith(`${normalizedProgram} `)
  ) {
    return false;
  }

  return isSupportedLearningBankClass(canonicalClassName);
}

function resolveBankSubject(subject: string) {
  const normalizedSubject = normalizeText(subject);

  if (normalizedSubject === "Guru Kelas SD") {
    return "Matematika";
  }

  if (normalizedSubject === "Pembahasan Tryout UTBK" || normalizedSubject === "Strategi SNBT") {
    return "TPS";
  }

  return normalizedSubject || "Matematika";
}



function getBranchStats(stats: SeedStats, branch: string) {
  const normalizedBranch = normalizeText(branch) || "-";
  const existing = stats.branches.get(normalizedBranch);

  if (existing) {
    return existing;
  }

  const created: BranchStats = {
    groups: 0,
    students: new Set<string>(),
    presentRecords: 0,
    sickRecords: 0,
    alphaRecords: 0,
    scoreVeryHigh: 0,
    scoreHigh: 0,
    scoreTuntas: 0,
    scoreRemedial: 0,
    scoreAbsentZero: 0,
  };
  stats.branches.set(normalizedBranch, created);

  return created;
}

function createEmptyStats(): SeedStats {
  return {
    branches: new Map<string, BranchStats>(),
    skippedStudentsWithoutSchedule: 0,
    groups: 0,
    students: 0,
    schedulesCreated: 0,
    schedulesUpdated: 0,
    materialsCreated: 0,
    materialsUpdated: 0,
    tasksCreated: 0,
    tasksUpdated: 0,
    questionsCreated: 0,
    questionsUpdated: 0,
    sessionsCreated: 0,
    sessionsUpdated: 0,
    recordsCreated: 0,
    recordsUpdated: 0,
    submissionsCreated: 0,
    submissionsUpdated: 0,
    attemptsCreated: 0,
    attemptsUpdated: 0,
    gradesCreated: 0,
    gradesUpdated: 0,
  };
}

async function runInBatches<T>(
  items: T[],
  batchSize: number,
  worker: (item: T) => Promise<void>,
) {
  for (let index = 0; index < items.length; index += batchSize) {
    await Promise.all(items.slice(index, index + batchSize).map(worker));
  }
}

function resolveScheduleForMeeting(group: SeedClassGroup, meetingIndex: number) {
  return group.schedules[meetingIndex % group.schedules.length] ?? group.schedules[0];
}

function getSeedMeetingDate(meetingNumber: number) {
  return SEED_MEETING_DATES[meetingNumber - 1] ?? SEED_LAST_FEBRUARY_DATE;
}

function getSeedTaskDeadline(dateKey: string) {
  const deadline = addDays(dateKey, 2);

  return deadline > SEED_LAST_FEBRUARY_DATE
    ? SEED_LAST_FEBRUARY_DATE
    : deadline;
}

function buildMeetingPlans(group: SeedClassGroup, meetingCount: number) {
  const plans: MeetingPlan[] = [];

  for (let index = 0; index < meetingCount; index += 1) {
    const schedule = resolveScheduleForMeeting(group, index);
    const meetingNumber = index + 1;
    const date = getSeedMeetingDate(meetingNumber);

    plans.push({
      meetingNumber,
      date,
      startTime: getStartTime(schedule.time),
      scheduleId: normalizeText(schedule.scheduleId) || null,
      room: normalizeText(schedule.room) || normalizeText(group.room),
      topic: TOPICS[index] ?? `Materi pertemuan ${meetingNumber}`,
    });
  }

  return plans;
}

async function getActiveMembershipStudents(branches: string[]) {
  const now = new Date();
  const activeSubscriptions = (await Subscription.find({
    paymentStatus: "paid",
    startDate: { $lte: now },
    endDate: { $gt: now },
  })
    .select("_id studentId userId startDate endDate status paymentStatus createdAt")
    .sort({ endDate: -1, createdAt: -1 })
    .lean()
    .exec()) as SeedSubscription[];
  const subscriptionByStudentObjectId = new Map<string, SeedSubscription>();

  for (const subscription of activeSubscriptions) {
    const key = subscription.studentId.toString();

    if (!subscriptionByStudentObjectId.has(key)) {
      subscriptionByStudentObjectId.set(key, subscription);
    }
  }

  const students = (await Student.find({
    _id: { $in: [...subscriptionByStudentObjectId.keys()] },
    status: "Aktif",
    branch: { $in: branches },
  })
    .select("_id studentId userId branch program className utbkTrack status academicJoinedAt")
    .lean()
    .exec()) as SeedStudent[];

  return {
    students,
    subscriptionByStudentObjectId,
  };
}

async function buildSeedGroups(options: SeedOptions) {
  const { students, subscriptionByStudentObjectId } =
    await getActiveMembershipStudents(options.branches);
  const teachers = (await Teacher.find({
    status: "Aktif",
    $or: [
      { branch: { $in: options.branches } },
      { branches: { $in: options.branches } },
    ],
  })
    .select("_id teacherId subject branch branches")
    .lean()
    .exec()) as SeedTeacher[];
  const teacherById = new Map(
    teachers.map((teacher) => [teacher._id.toString(), teacher]),
  );
  const schedules = (await Schedule.find({
    branch: { $in: options.branches },
    status: { $ne: "Bentrok" },
  })
    .select("scheduleId teacherId day time className branch subject room")
    .sort({ branch: 1, className: 1, teacherId: 1, day: 1 })
    .lean()
    .exec()) as SeedSchedule[];
  const studentsByBranchAndClass = new Map<string, SeedStudent[]>();

  for (const student of students) {
    const canonicalClassName = normalizeCanonicalClassName(student.className);

    if (
      !canonicalClassName ||
      isUtbkScheduleClassName(canonicalClassName) ||
      !isRegularStudentProgramClassMatch(student, canonicalClassName)
    ) {
      continue;
    }

    const key = `${normalizeKey(student.branch)}|${normalizeKey(canonicalClassName)}`;
    const current = studentsByBranchAndClass.get(key) ?? [];
    current.push(student);
    studentsByBranchAndClass.set(key, current);
  }

  const groupsByKey = new Map<string, SeedClassGroup>();

  for (const schedule of schedules) {
    const teacher = teacherById.get(schedule.teacherId.toString());
    const className = normalizeText(schedule.className);
    const canonicalClassName = normalizeCanonicalClassName(className);
    const branch = normalizeText(schedule.branch);

    if (
      !teacher ||
      !canonicalClassName ||
      !branch ||
      isUtbkScheduleClassName(className) ||
      isUtbkScheduleSubject(schedule.subject)
    ) {
      continue;
    }

    const studentsForClass =
      studentsByBranchAndClass.get(
        `${normalizeKey(branch)}|${normalizeKey(canonicalClassName)}`,
      ) ?? [];

    if (studentsForClass.length === 0) {
      continue;
    }

    const key = `${teacher._id}|${normalizeKey(branch)}|${normalizeKey(canonicalClassName)}`;
    const existing = groupsByKey.get(key);

    if (existing) {
      existing.schedules.push(schedule);
      continue;
    }

    groupsByKey.set(key, {
      teacher,
      classId: buildStableClassId(teacher.teacherId, branch, canonicalClassName),
      className: canonicalClassName,
      canonicalClassName,
      branch,
      subject: normalizeText(schedule.subject) || "Matematika",
      room: normalizeText(schedule.room),
      schedules: [schedule],
      students: studentsForClass,
      subscriptionByStudentObjectId,
    });
  }

  const scheduledClassKeys = new Set(
    [...groupsByKey.values()].map(
      (group) =>
        `${normalizeKey(group.branch)}|${normalizeKey(group.canonicalClassName)}`,
    ),
  );

  for (const [studentClassKey, studentsForClass] of studentsByBranchAndClass) {
    if (scheduledClassKeys.has(studentClassKey)) {
      continue;
    }

    const [branchKey = "", canonicalClassKey = ""] = studentClassKey.split("|");
    const sampleStudent = studentsForClass[0];
    const branch = normalizeText(sampleStudent?.branch) || branchKey;
    const canonicalClassName =
      normalizeCanonicalClassName(sampleStudent?.className ?? canonicalClassKey) ||
      normalizeText(sampleStudent?.className) ||
      canonicalClassKey.toUpperCase();
    const teacher = resolveFallbackTeacher(teachers, branch);

    if (!teacher || !canonicalClassName) {
      continue;
    }

    const scheduleId = stablePublicId("SCH", "fallback", branch, canonicalClassName);
    const schedule: SeedSchedule = {
      scheduleId,
      teacherId: teacher._id,
      day: getFallbackDay(`${branch}|${canonicalClassName}|day`),
      time: getFallbackTime(`${branch}|${canonicalClassName}|time`),
      className: canonicalClassName,
      branch,
      subject: resolveScheduleSubject(teacher.subject),
      room: `Ruang ${branch}`,
    };
    const key = `${teacher._id}|${normalizeKey(branch)}|${normalizeKey(canonicalClassName)}`;

    groupsByKey.set(key, {
      teacher,
      classId: buildStableClassId(teacher.teacherId, branch, canonicalClassName),
      className: canonicalClassName,
      canonicalClassName,
      branch,
      subject: schedule.subject,
      room: schedule.room,
      schedules: [schedule],
      students: studentsForClass,
      subscriptionByStudentObjectId,
    });
    scheduledClassKeys.add(studentClassKey);
  }

  const scheduledStudentKeys = new Set<string>();

  for (const group of groupsByKey.values()) {
    for (const student of group.students) {
      scheduledStudentKeys.add(student._id.toString());
    }
  }

  return {
    groups: [...groupsByKey.values()].sort((left, right) =>
      `${left.branch}-${left.className}-${left.teacher.teacherId}`.localeCompare(
        `${right.branch}-${right.className}-${right.teacher.teacherId}`,
      ),
    ),
    totalMembershipStudents: students.length,
    skippedStudentsWithoutSchedule: students.filter(
      (student) => !scheduledStudentKeys.has(student._id.toString()),
    ).length,
  };
}

async function upsertMaterial(
  group: SeedClassGroup,
  plan: MeetingPlan,
  apply: boolean,
) {
  const existing = await ClassMaterial.findOne({
    teacherId: group.teacher._id,
    classId: group.classId,
    meetingNumber: plan.meetingNumber,
  }).exec();
  const payload = {
    materialId:
      existing?.materialId ??
      stablePublicId("MAT", group.teacher.teacherId, group.branch, group.className, `P${plan.meetingNumber}`),
    classId: group.classId,
    teacherId: group.teacher._id,
    className: group.className,
    canonicalClassName: group.canonicalClassName,
    subject: group.subject,
    branch: group.branch,
    room: plan.room,
    meetingNumber: plan.meetingNumber,
    date: plan.date,
    title: `P${plan.meetingNumber} - ${plan.topic}`,
    description: `Materi bimbel pertemuan ${plan.meetingNumber} untuk ${group.className}: ${plan.topic}. Siswa menerima pembahasan konsep, contoh soal, dan arahan latihan.`,
    linkUrl: "",
    attachment: null,
    status: "Dipublikasikan" as const,
    academicYear: null,
    semester: null,
  };

  if (apply) {
    await ClassMaterial.findOneAndUpdate(
      { materialId: payload.materialId },
      { $set: payload },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).exec();
  }

  return existing ? "updated" : "created";
}

async function upsertTask(
  group: SeedClassGroup,
  plan: MeetingPlan,
  questionCount: number,
  apply: boolean,
) {
  const existing = await ClassTask.findOne({
    teacherId: group.teacher._id,
    classId: group.classId,
    meetingNumber: plan.meetingNumber,
  }).exec();
  const payload = {
    taskId:
      existing?.taskId ??
      stablePublicId("TSK", group.teacher.teacherId, group.branch, group.className, `P${plan.meetingNumber}`),
    classId: group.classId,
    teacherId: group.teacher._id,
    className: group.className,
    canonicalClassName: group.canonicalClassName,
    subject: group.subject,
    branch: group.branch,
    room: plan.room,
    meetingNumber: plan.meetingNumber,
    title: `Latihan CBT P${plan.meetingNumber}`,
    description: `Latihan CBT setelah materi P${plan.meetingNumber}: ${plan.topic}. Nilai di bawah KKM ${PASSING_GRADE} akan masuk alur remedial.`,
    deadline: getSeedTaskDeadline(plan.date),
    startAt: null,
    endAt: null,
    durationMinutes: DURATION_MINUTES,
    questionCount,
    passingGrade: PASSING_GRADE,
    attachment: null,
    submittedCount: group.students.length,
    reviewStatus: "Belum Dinilai" as const,
    academicYear: null,
    semester: null,
  };

  if (apply) {
    await ClassTask.findOneAndUpdate(
      { taskId: payload.taskId },
      { $set: payload },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).exec();
  }

  return {
    action: existing ? "updated" : "created",
    taskId: payload.taskId,
  };
}



async function upsertSession(
  group: SeedClassGroup,
  plan: MeetingPlan,
  existingSessionId: string | null,
  apply: boolean,
) {
  const targetSessionId =
    existingSessionId ??
    stablePublicId("ATS", group.teacher.teacherId, group.branch, group.className, `P${plan.meetingNumber}`);
  const existingSession = await AttendanceSession.findOne({
    $or: [
      { sessionId: targetSessionId },
      {
        teacherId: group.teacher._id,
        classId: group.classId,
        date: plan.date,
      },
    ],
  })
    .select("sessionId")
    .lean()
    .exec();
  const sessionId = normalizeText(existingSession?.sessionId) || targetSessionId;
  const exists = Boolean(existingSession);
  const payload = {
    sessionId,
    classId: group.classId,
    teacherId: group.teacher._id,
    scheduleId: plan.scheduleId,
    className: group.className,
    subject: group.subject,
    branch: group.branch,
    room: plan.room,
    date: plan.date,
    startTime: plan.startTime,
    academicYear: null,
    semester: null,
    status: "closed" as const,
    qrToken: null,
  };

  if (apply) {
    await AttendanceSession.findOneAndUpdate(
      { sessionId },
      { $set: payload },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).exec();
  }

  return {
    action: exists ? "updated" : "created",
    sessionId,
  };
}

async function upsertFallbackSchedule(
  group: SeedClassGroup,
  schedule: SeedSchedule,
  apply: boolean,
) {
  const exists = Boolean(await Schedule.exists({ scheduleId: schedule.scheduleId }).exec());
  const payload = {
    scheduleId: schedule.scheduleId,
    day: schedule.day,
    time: schedule.time,
    className: group.className,
    branch: group.branch,
    subject: resolveScheduleSubject(schedule.subject),
    teacherId: group.teacher._id,
    room: schedule.room,
    status: "Siap" as const,
    academicYear: null,
    semester: null,
  };

  if (apply) {
    await Schedule.findOneAndUpdate(
      { scheduleId: schedule.scheduleId },
      { $set: payload },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).exec();
  }

  return exists ? "updated" : "created";
}

function buildAttemptAnswers(
  questions: Array<{
    questionId: string;
    correctAnswer: ClassTaskQuestionAnswer;
  }>,
  score: number,
) {
  const correctTarget = Math.round((score / 100) * questions.length);

  return questions.map((question, index) => {
    const isAnsweredCorrectly = index < correctTarget;

    return {
      questionId: question.questionId,
      selectedAnswer: isAnsweredCorrectly
        ? question.correctAnswer
        : score === 0
          ? ""
          : getWrongAnswer(question.correctAnswer),
      isCorrect: isAnsweredCorrectly,
    };
  });
}

async function upsertStudentMeetingData(params: {
  group: SeedClassGroup;
  plan: MeetingPlan;
  taskId: string;
  sessionId: string;
  student: SeedStudent;
  studentName: string;
  questions: Array<{ questionId: string; correctAnswer: ClassTaskQuestionAnswer }>;
  exists: {
    record: boolean;
    submission: boolean;
    attempt: boolean;
    grade: boolean;
  };
  stats: SeedStats;
  apply: boolean;
}) {
  const { group, plan, taskId, sessionId, student, studentName, questions, exists, stats, apply } =
    params;
  const subscription =
    group.subscriptionByStudentObjectId.get(student._id.toString()) ?? null;
  const attendanceStatus = getAttendanceStatus(
    `${group.classId}|${plan.meetingNumber}|${student.studentId}|attendance`,
  );
  const score = getScoreForAttendance(
    attendanceStatus,
    `${group.classId}|${plan.meetingNumber}|${student.studentId}|score`,
  );
  const isRemedial = score < PASSING_GRADE;
  const markedAt = new Date(`${plan.date}T${plan.startTime}:00.000+07:00`);
  const submittedAt = new Date(markedAt.getTime() + 75 * 60 * 1000);
  const answers = buildAttemptAnswers(questions, score);
  const correctCount = answers.filter((answer) => answer.isCorrect).length;
  const wrongCount = answers.filter((answer) => answer.selectedAnswer && !answer.isCorrect).length;
  const unansweredCount = answers.filter((answer) => !answer.selectedAnswer).length;
  const timeUsedSeconds =
    attendanceStatus === "Hadir"
      ? 60 * Math.round(DURATION_MINUTES * (0.55 + randomFloat(`${taskId}|${student.studentId}|time`) * 0.4))
      : 0;

  const recordPayload = {
    recordId: stablePublicId("ATR", sessionId, student.studentId),
    sessionId,
    studentId: student.studentId,
    studentObjectId: student._id,
    subscriptionId: subscription?._id ?? null,
    name: studentName,
    status: attendanceStatus,
    note: getAttendanceNote(attendanceStatus),
    markedBy: "teacher" as const,
    markedAt,
  };
  const submissionPayload = {
    submissionId: stablePublicId("SUBM", taskId, student.studentId),
    teacherId: group.teacher._id,
    classId: group.classId,
    taskId,
    studentId: student.studentId,
    subscriptionId: subscription?._id ?? null,
    submissionMode: "cbt" as const,
    answerText:
      attendanceStatus === "Hadir"
        ? `Submit otomatis seed P${plan.meetingNumber}.`
        : "Tidak hadir, nilai latihan otomatis 0.",
    driveUrl: "",
    attachment: null,
    note:
      attendanceStatus === "Hadir"
        ? "Latihan CBT seed sesuai simulasi pembelajaran."
        : "Siswa tidak hadir pada sesi ini.",
    submittedAt,
  };
  const attemptPayload = {
    attemptId: stablePublicId("ATTEMPT", taskId, student.studentId),
    taskId,
    teacherId: group.teacher._id,
    classId: group.classId,
    branch: group.branch,
    studentId: student.studentId,
    subscriptionId: subscription?._id ?? null,
    answers,
    correctCount,
    wrongCount,
    unansweredCount,
    score,
    timeUsedSeconds,
    remedialCount: 0,
    remedialReason: isRemedial
      ? attendanceStatus === "Hadir"
        ? `Nilai ${score} masih di bawah KKM ${PASSING_GRADE}.`
        : "Siswa tidak hadir sehingga perlu mengerjakan ulang latihan."
      : "",
    history: [],
    startedAt: markedAt,
    submittedAt,
    status: "submitted" as const,
  };
  const gradePayload = {
    gradeId: stablePublicId("GRADE", taskId, student.studentId),
    teacherId: group.teacher._id,
    classId: group.classId,
    taskId,
    studentId: student.studentId,
    subscriptionId: subscription?._id ?? null,
    score,
    status: isRemedial ? "Perlu Remedial" as const : "Sudah Dinilai" as const,
    note: isRemedial
      ? attendanceStatus === "Hadir"
        ? `Nilai ${score} di bawah KKM ${PASSING_GRADE}. Guru menyarankan remedial agar siswa mencapai hasil maksimal.`
        : "Siswa tidak hadir pada sesi bimbel, nilai CBT 0 dan perlu mengerjakan remedial."
      : `Nilai CBT P${plan.meetingNumber} sudah tuntas.`,
    gradedAt: submittedAt,
    remedialRequestedAt: isRemedial ? submittedAt : null,
    remedialCompletedAt: null,
    remedialCount: 0,
  };

  if (apply) {
    await Promise.all([
      AttendanceRecord.findOneAndUpdate(
        { sessionId: recordPayload.sessionId, studentId: recordPayload.studentId },
        { $set: recordPayload },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
      ).exec(),
      TaskSubmission.findOneAndUpdate(
        { taskId: submissionPayload.taskId, studentId: submissionPayload.studentId },
        { $set: submissionPayload },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
      ).exec(),
      StudentTaskAttempt.findOneAndUpdate(
        { taskId: attemptPayload.taskId, studentId: attemptPayload.studentId },
        { $set: attemptPayload },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
      ).exec(),
      TaskGrade.findOneAndUpdate(
        {
          teacherId: gradePayload.teacherId,
          classId: gradePayload.classId,
          taskId: gradePayload.taskId,
          studentId: gradePayload.studentId,
        },
        { $set: gradePayload },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
      ).exec(),
    ]);
  }

  const branchStats = getBranchStats(stats, group.branch);
  branchStats.students.add(student.studentId);

  if (attendanceStatus === "Hadir") branchStats.presentRecords += 1;
  if (attendanceStatus === "Sakit") branchStats.sickRecords += 1;
  if (attendanceStatus === "Alpa") branchStats.alphaRecords += 1;

  const bucket = getScoreBucket(score, attendanceStatus);
  if (bucket === "veryHigh") branchStats.scoreVeryHigh += 1;
  if (bucket === "high") branchStats.scoreHigh += 1;
  if (bucket === "tuntas") branchStats.scoreTuntas += 1;
  if (bucket === "remedial") branchStats.scoreRemedial += 1;
  if (bucket === "absentZero") branchStats.scoreAbsentZero += 1;

  stats.recordsCreated += exists.record ? 0 : 1;
  stats.recordsUpdated += exists.record ? 1 : 0;
  stats.submissionsCreated += exists.submission ? 0 : 1;
  stats.submissionsUpdated += exists.submission ? 1 : 0;
  stats.attemptsCreated += exists.attempt ? 0 : 1;
  stats.attemptsUpdated += exists.attempt ? 1 : 0;
  stats.gradesCreated += exists.grade ? 0 : 1;
  stats.gradesUpdated += exists.grade ? 1 : 0;
}

async function getExistingValueSet<T extends Record<string, unknown>>(
  documents: Promise<T[]>,
  field: keyof T,
) {
  const rows = await documents;

  return new Set(rows.map((row) => normalizeText(row[field] as string)));
}

function printStats(stats: SeedStats, options: SeedOptions, totalMembershipStudents: number) {
  console.log(
    `[seed-bimbel-p1-p9] action=${options.apply ? "apply" : "dry-run"} replaceExisting=${options.replaceExisting ? "yes" : "no"} meetings=${options.meetingCount} branches=${options.branches.join(", ")}`,
  );
  console.log(
    `Membership aktif ditemukan=${totalMembershipStudents}, masuk jadwal=${stats.students}, tanpa jadwal=${stats.skippedStudentsWithoutSchedule}`,
  );
  console.table(
    [...stats.branches.entries()].map(([branch, branchStats]) => ({
      Cabang: branch,
      Kelas: branchStats.groups,
      Siswa: branchStats.students.size,
      Hadir: branchStats.presentRecords,
      Sakit: branchStats.sickRecords,
      Alpa: branchStats.alphaRecords,
      "Nilai 90-95": branchStats.scoreVeryHigh,
      "Nilai 82-89": branchStats.scoreHigh,
      "Nilai 70-80": branchStats.scoreTuntas,
      "Nilai 50-60": branchStats.scoreRemedial,
      "Tidak hadir = 0": branchStats.scoreAbsentZero,
    })),
  );
  console.table([
    {
      Data: "Jadwal Pendukung",
      Created: stats.schedulesCreated,
      Updated: stats.schedulesUpdated,
    },
    {
      Data: "Materi",
      Created: stats.materialsCreated,
      Updated: stats.materialsUpdated,
    },
    {
      Data: "Latihan CBT",
      Created: stats.tasksCreated,
      Updated: stats.tasksUpdated,
    },
    {
      Data: "Soal CBT",
      Created: stats.questionsCreated,
      Updated: stats.questionsUpdated,
    },
    {
      Data: "Sesi Absensi",
      Created: stats.sessionsCreated,
      Updated: stats.sessionsUpdated,
    },
    {
      Data: "Record Absensi",
      Created: stats.recordsCreated,
      Updated: stats.recordsUpdated,
    },
    {
      Data: "Submission CBT",
      Created: stats.submissionsCreated,
      Updated: stats.submissionsUpdated,
    },
    {
      Data: "Attempt CBT",
      Created: stats.attemptsCreated,
      Updated: stats.attemptsUpdated,
    },
    {
      Data: "Nilai",
      Created: stats.gradesCreated,
      Updated: stats.gradesUpdated,
    },
  ]);

  if (!options.apply) {
    console.log("Dry-run selesai. Jalankan ulang dengan --apply untuk menyimpan.");
  }
}

async function run() {
  const options = parseOptions(process.argv.slice(2));

  await mongoose.connect(process.env.MONGO_URI as string);

  const { groups, totalMembershipStudents, skippedStudentsWithoutSchedule } =
    await buildSeedGroups(options);
  const userIds = Array.from(
    new Set(groups.flatMap((group) => group.students.map((student) => student.userId.toString()))),
  );
  const users = await User.find({ _id: { $in: userIds } })
    .select("_id nama")
    .lean()
    .exec();
  const nameByUserId = new Map(
    users.map((user) => [user._id.toString(), normalizeText(user.nama)]),
  );
  const stats = createEmptyStats();
  stats.skippedStudentsWithoutSchedule = skippedStudentsWithoutSchedule;
  stats.groups = groups.length;
  stats.students = new Set(
    groups.flatMap((group) => group.students.map((student) => student.studentId)),
  ).size;

  for (const group of groups) {
    const branchStats = getBranchStats(stats, group.branch);
    branchStats.groups += 1;
    for (const schedule of group.schedules) {
      if (!isFallbackScheduleId(schedule.scheduleId)) {
        continue;
      }

      const scheduleAction = await upsertFallbackSchedule(
        group,
        schedule,
        options.apply,
      );
      stats.schedulesCreated += scheduleAction === "created" ? 1 : 0;
      stats.schedulesUpdated += scheduleAction === "updated" ? 1 : 0;
    }

    const plans = buildMeetingPlans(group, options.meetingCount);
    const existingSessions = await AttendanceSession.find({
      teacherId: group.teacher._id,
      classId: group.classId,
    })
      .select("sessionId")
      .sort({ date: 1, startTime: 1, createdAt: 1 })
      .limit(options.meetingCount)
      .lean()
      .exec();

    for (const plan of plans) {
      const topicPattern = new RegExp(`Bab ${plan.meetingNumber}:`, "i");
      let bankQuestions = await QuestionBank.aggregate([
        { $match: { subject: group.subject, topic: { $regex: topicPattern } } },
        { $sample: { size: 30 } },
      ]);
      
      if (bankQuestions.length < 30) {
        bankQuestions = await QuestionBank.aggregate([
          { $match: { subject: group.subject } },
          { $sample: { size: 30 } },
        ]);
      }
      
      if (bankQuestions.length < 30) {
        console.warn(`Bank soal kurang untuk mapel ${group.subject}. Ditemukan: ${bankQuestions.length}`);
      }

      const materialAction = await upsertMaterial(group, plan, options.apply);
      stats.materialsCreated += materialAction === "created" ? 1 : 0;
      stats.materialsUpdated += materialAction === "updated" ? 1 : 0;

      const taskResult = await upsertTask(
        group,
        plan,
        bankQuestions.length,
        options.apply,
      );
      stats.tasksCreated += taskResult.action === "created" ? 1 : 0;
      stats.tasksUpdated += taskResult.action === "updated" ? 1 : 0;

      const sessionResult = await upsertSession(
        group,
        plan,
        normalizeText(existingSessions[plan.meetingNumber - 1]?.sessionId) || null,
        options.apply,
      );
      stats.sessionsCreated += sessionResult.action === "created" ? 1 : 0;
      stats.sessionsUpdated += sessionResult.action === "updated" ? 1 : 0;

      const activeQuestions = bankQuestions.map((question, index) => ({
        questionId: question.questionId || question._id.toString(),
        correctAnswer: question.correctAnswer,
        order: index + 1,
      }));
      const studentIds = group.students.map((student) => student.studentId);
      const [
        existingRecordStudentIds,
        existingSubmissionStudentIds,
        existingAttemptStudentIds,
        existingGradeStudentIds,
      ] = await Promise.all([
        getExistingValueSet(
          AttendanceRecord.find({
            sessionId: sessionResult.sessionId,
            studentId: { $in: studentIds },
          })
            .select("studentId")
            .lean()
            .exec() as Promise<Array<{ studentId?: string }>>,
          "studentId",
        ),
        getExistingValueSet(
          TaskSubmission.find({
            taskId: taskResult.taskId,
            studentId: { $in: studentIds },
          })
            .select("studentId")
            .lean()
            .exec() as Promise<Array<{ studentId?: string }>>,
          "studentId",
        ),
        getExistingValueSet(
          StudentTaskAttempt.find({
            taskId: taskResult.taskId,
            studentId: { $in: studentIds },
          })
            .select("studentId")
            .lean()
            .exec() as Promise<Array<{ studentId?: string }>>,
          "studentId",
        ),
        getExistingValueSet(
          TaskGrade.find({
            teacherId: group.teacher._id,
            classId: group.classId,
            taskId: taskResult.taskId,
            studentId: { $in: studentIds },
          })
            .select("studentId")
            .lean()
            .exec() as Promise<Array<{ studentId?: string }>>,
          "studentId",
        ),
      ]);

      await runInBatches(group.students, 24, async (student) => {
        await upsertStudentMeetingData({
          group,
          plan,
          taskId: taskResult.taskId,
          sessionId: sessionResult.sessionId,
          student,
          studentName:
            nameByUserId.get(student.userId.toString()) ||
            `Siswa ${student.studentId}`,
          questions: activeQuestions,
          exists: {
            record: existingRecordStudentIds.has(student.studentId),
            submission: existingSubmissionStudentIds.has(student.studentId),
            attempt: existingAttemptStudentIds.has(student.studentId),
            grade: existingGradeStudentIds.has(student.studentId),
          },
          stats,
          apply: options.apply,
        });
      });

      if (options.apply) {
        const hasRemedial = await TaskGrade.exists({
          teacherId: group.teacher._id,
          classId: group.classId,
          taskId: taskResult.taskId,
          status: "Perlu Remedial",
        }).exec();
        await ClassTask.updateOne(
          { taskId: taskResult.taskId },
          {
            $set: {
              submittedCount: group.students.length,
              reviewStatus: hasRemedial ? "Belum Dinilai" : "Sudah Dinilai",
            },
          },
        ).exec();
      }
    }
  }

  printStats(stats, options, totalMembershipStudents);
}

run()
  .catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
