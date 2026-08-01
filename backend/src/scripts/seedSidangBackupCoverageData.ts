import mongoose, { type Types } from "mongoose";

import "../config/env";
import { AcademicGrade } from "../models/AcademicGrade";
import { AttendanceRecord } from "../models/AttendanceRecord";
import { AttendanceSession } from "../models/AttendanceSession";
import { ClassMaterial } from "../models/ClassMaterial";
import { ClassTask } from "../models/ClassTask";
import { Schedule } from "../models/Schedule";
import { Student, type StudentDocument } from "../models/Student";
import { StudentTryoutAttempt } from "../models/StudentTryoutAttempt";
import { Subscription } from "../models/Subscription";
import { TaskGrade } from "../models/TaskGrade";
import { TaskSubmission } from "../models/TaskSubmission";
import { Teacher, type TeacherDocument } from "../models/Teacher";
import { TeacherTryout } from "../models/TeacherTryout";
import { TeacherTryoutQuestion } from "../models/TeacherTryoutQuestion";
import { User } from "../models/User";
import {
  getAcademicGradeScheme,
  getCurrentAcademicPeriod,
} from "../utils/academicGrade";
import { normalizeCanonicalClassName } from "../utils/studentClass";
import { buildStableTeacherClassId } from "../utils/teacherClassIdentity";

type TargetConfig = {
  key: string;
  teacherId: string;
  studentId: string;
  scheduleId: string;
  taskScore: number;
  examScore: number;
};

type ResolvedTarget = TargetConfig & {
  teacher: TeacherDocument;
  student: StudentDocument;
  teacherObjectId: Types.ObjectId;
  studentObjectId: Types.ObjectId;
  subscriptionId: Types.ObjectId;
  classId: string;
  branch: string;
  className: string;
  canonicalClassName: string;
  subject: string;
  room: string;
  teacherName: string;
  teacherEmail: string;
  studentName: string;
  studentEmail: string;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const PREFIX = "SIDANG-BACKUP";
const TARGETS: TargetConfig[] = [
  {
    key: "001",
    teacherId: "TCH-003",
    studentId: "STD-044",
    scheduleId: "SCH-053",
    taskScore: 87,
    examScore: 80,
  },
  {
    key: "002",
    teacherId: "TCH-008",
    studentId: "STD-009",
    scheduleId: "SCH-055",
    taskScore: 90,
    examScore: 85,
  },
];

const QUESTIONS = [
  {
    text: "Hasil dari 12 x 8 adalah ...",
    options: ["84", "92", "96", "108"],
    answer: "C",
  },
  {
    text: "Jika sebuah tugas memiliki nilai 90 dari 100, maka persentasenya adalah ...",
    options: ["70%", "80%", "90%", "100%"],
    answer: "C",
  },
  {
    text: "Bentuk sederhana dari 6a + 4a adalah ...",
    options: ["10a", "24a", "2a", "a10"],
    answer: "A",
  },
  {
    text: "Rata-rata dari 75, 80, dan 85 adalah ...",
    options: ["78", "80", "82", "85"],
    answer: "B",
  },
  {
    text: "Data akademik yang sudah dinilai akan tampil pada menu ...",
    options: ["Profil", "Nilai", "Tagihan", "Cabang"],
    answer: "B",
  },
] as const;

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_IN_MS);
}

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function asObjectId(value: unknown): Types.ObjectId {
  if (value instanceof mongoose.Types.ObjectId) {
    return value;
  }

  return new mongoose.Types.ObjectId(String(value));
}

function getJenjang(className: string): "SD" | "SMP" | "SMA" {
  const normalizedClassName = normalizeText(className).toUpperCase();

  if (normalizedClassName.startsWith("SD")) return "SD";
  if (normalizedClassName.startsWith("SMP")) return "SMP";
  return "SMA";
}

function accountPassword(prefix: "guru" | "siswa", code: string) {
  const digits = code.replace(/\D/g, "");
  return `${prefix}${(digits || "0").padStart(3, "0")}`;
}

function ids(target: TargetConfig) {
  return {
    materialId: `MAT-${PREFIX}-${target.key}`,
    taskId: `TSK-${PREFIX}-${target.key}`,
    submissionId: `SUBM-${PREFIX}-${target.key}`,
    gradeId: `GRD-${PREFIX}-${target.key}`,
    tryoutId: `TO-${PREFIX}-${target.key}`,
    attemptId: `STA-${PREFIX}-${target.key}`,
    academicGradeId: `ACG-${PREFIX}-${target.key}`,
    packageId: `PKG-${PREFIX}-${target.key}`,
    sessionIds: [
      `ATS-${PREFIX}-${target.key}-01`,
      `ATS-${PREFIX}-${target.key}-02`,
    ] as const,
    recordIds: [
      `ATR-${PREFIX}-${target.key}-01`,
      `ATR-${PREFIX}-${target.key}-02`,
    ] as const,
  };
}

async function findActiveSubscriptionId(studentObjectId: Types.ObjectId) {
  const now = new Date();
  const subscription = await Subscription.findOne({
    studentId: studentObjectId,
    paymentStatus: "paid",
    startDate: { $lte: now },
    endDate: { $gt: now },
  })
    .select("_id")
    .sort({ endDate: -1, createdAt: -1, _id: -1 })
    .exec();

  if (!subscription?._id) {
    return null;
  }

  return asObjectId(subscription._id);
}

async function resolveTarget(target: TargetConfig): Promise<ResolvedTarget> {
  const teacher = await Teacher.findOne({
    teacherId: target.teacherId,
    status: "Aktif",
  }).exec();

  if (!teacher) {
    throw new Error(`Guru aktif tidak ditemukan: ${target.teacherId}`);
  }

  const schedule = await Schedule.findOne({
    teacherId: teacher._id,
    scheduleId: target.scheduleId,
    status: { $ne: "Bentrok" },
  }).exec();

  if (!schedule) {
    throw new Error(
      `Jadwal ${target.scheduleId} untuk ${target.teacherId} tidak ditemukan.`,
    );
  }

  const student = await Student.findOne({
    studentId: target.studentId,
    status: "Aktif",
    branch: new RegExp(`^${escapeRegExp(normalizeText(schedule.branch))}$`, "i"),
    className: new RegExp(
      `^${escapeRegExp(normalizeText(schedule.className))}$`,
      "i",
    ),
  }).exec();

  if (!student) {
    throw new Error(
      `Siswa ${target.studentId} tidak aktif di ${schedule.branch} ${schedule.className}.`,
    );
  }

  const subscriptionId = await findActiveSubscriptionId(asObjectId(student._id));

  if (!subscriptionId) {
    throw new Error(`Subscription aktif siswa tidak ditemukan: ${target.studentId}`);
  }

  const [teacherUser, studentUser] = await Promise.all([
    User.findById(teacher.userId).lean().exec(),
    User.findById(student.userId).lean().exec(),
  ]);
  const branch = normalizeText(schedule.branch);
  const className = normalizeText(schedule.className);

  return {
    ...target,
    teacher,
    student,
    teacherObjectId: asObjectId(teacher._id),
    studentObjectId: asObjectId(student._id),
    subscriptionId,
    classId: buildStableTeacherClassId(target.teacherId, branch, className),
    branch,
    className,
    canonicalClassName: normalizeCanonicalClassName(className) ?? className,
    subject: normalizeText(schedule.subject) || "Mapel Sidang",
    room: normalizeText(schedule.room) || "Ruang Sidang",
    teacherName: normalizeText(teacherUser?.nama),
    teacherEmail: normalizeText(teacherUser?.email),
    studentName: normalizeText(studentUser?.nama),
    studentEmail: normalizeText(studentUser?.email),
  };
}

async function resolveTargets() {
  return Promise.all(TARGETS.map(resolveTarget));
}

async function printDryRunSummary(targets: ResolvedTarget[]) {
  const rows = [];

  for (const target of targets) {
    const targetIds = ids(target);
    const [
      materialCount,
      taskCount,
      submissionCount,
      gradeCount,
      tryoutCount,
      questionCount,
      attemptCount,
      academicGradeCount,
      attendanceSessionCount,
      attendanceRecordCount,
    ] = await Promise.all([
      ClassMaterial.countDocuments({ materialId: targetIds.materialId }),
      ClassTask.countDocuments({ taskId: targetIds.taskId }),
      TaskSubmission.countDocuments({ submissionId: targetIds.submissionId }),
      TaskGrade.countDocuments({ gradeId: targetIds.gradeId }),
      TeacherTryout.countDocuments({ tryoutId: targetIds.tryoutId }),
      TeacherTryoutQuestion.countDocuments({
        questionId: {
          $in: QUESTIONS.map(
            (_question, index) =>
              `TQ-${PREFIX}-${target.key}-${String(index + 1).padStart(2, "0")}`,
          ),
        },
      }),
      StudentTryoutAttempt.countDocuments({ attemptId: targetIds.attemptId }),
      AcademicGrade.countDocuments({
        academicGradeId: targetIds.academicGradeId,
      }),
      AttendanceSession.countDocuments({
        sessionId: { $in: targetIds.sessionIds },
      }),
      AttendanceRecord.countDocuments({
        recordId: { $in: targetIds.recordIds },
      }),
    ]);

    rows.push({
      guru: `${target.teacherId} - ${target.teacherName}`,
      akunGuru: `${target.teacherEmail} / ${accountPassword("guru", target.teacherId)}`,
      siswa: `${target.studentId} - ${target.studentName}`,
      akunSiswa: `${target.studentEmail} / ${accountPassword("siswa", target.studentId)}`,
      kelas: `${target.branch} ${target.className}`,
      classId: target.classId,
      materi: `${materialCount}/1`,
      tugas: `${taskCount}/1`,
      submission: `${submissionCount}/1`,
      nilai: `${gradeCount}/1`,
      ujian: `${tryoutCount}/1`,
      soal: `${questionCount}/${QUESTIONS.length}`,
      attempt: `${attemptCount}/1`,
      rekap: `${academicGradeCount}/1`,
      absensi: `${attendanceSessionCount}/2`,
      record: `${attendanceRecordCount}/2`,
    });
  }

  console.log("[seed-sidang-backup] mode=dry-run");
  console.table(rows);
  console.log("Dry-run selesai. Jalankan dengan --apply untuk menyimpan data.");
}

async function upsertMaterial(target: ResolvedTarget) {
  const targetIds = ids(target);
  const period = getCurrentAcademicPeriod();

  await ClassMaterial.findOneAndUpdate(
    { materialId: targetIds.materialId },
    {
      $set: {
        classId: target.classId,
        teacherId: target.teacherObjectId,
        className: target.className,
        canonicalClassName: target.canonicalClassName,
        subject: target.subject,
        branch: target.branch,
        room: target.room,
        meetingNumber: 2,
        date: toDateOnly(addDays(new Date(), -3)),
        title: `Materi ${target.subject} - ${PREFIX} ${target.key}`,
        description:
          "Materi cadangan sidang untuk memastikan siswa dapat melihat bahan belajar dari guru lain.",
        linkUrl: "https://example.com/materi-sidang-backup",
        attachment: null,
        status: "Dipublikasikan",
        academicYear: period.academicYear,
        semester: period.semester,
      },
      $setOnInsert: { materialId: targetIds.materialId },
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  ).exec();
}

async function upsertTask(target: ResolvedTarget) {
  const targetIds = ids(target);
  const period = getCurrentAcademicPeriod();

  await ClassTask.findOneAndUpdate(
    { taskId: targetIds.taskId },
    {
      $set: {
        classId: target.classId,
        teacherId: target.teacherObjectId,
        className: target.className,
        canonicalClassName: target.canonicalClassName,
        subject: target.subject,
        branch: target.branch,
        room: target.room,
        meetingNumber: 2,
        title: `Tugas ${target.subject} - ${PREFIX} ${target.key}`,
        description:
          "Tugas cadangan sidang untuk menunjukkan alur kirim tugas, cek submission, dan penilaian.",
        deadline: toDateOnly(addDays(new Date(), 10)),
        attachment: null,
        submittedCount: 1,
        reviewStatus: "Sudah Dinilai",
        academicYear: period.academicYear,
        semester: period.semester,
      },
      $setOnInsert: { taskId: targetIds.taskId },
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  ).exec();
}

async function upsertSubmissionAndGrade(target: ResolvedTarget) {
  const targetIds = ids(target);

  await TaskSubmission.findOneAndUpdate(
    {
      taskId: targetIds.taskId,
      studentId: target.studentId,
    },
    {
      $set: {
        submissionId: targetIds.submissionId,
        teacherId: target.teacherObjectId,
        classId: target.classId,
        taskId: targetIds.taskId,
        studentId: target.studentId,
        subscriptionId: target.subscriptionId,
        submissionMode: "text",
        answerText:
          "Jawaban cadangan sidang sudah dikirim melalui mode teks dari akun siswa.",
        driveUrl: "",
        attachment: null,
        note: "Submission cadangan untuk demo alur tugas siswa.",
        submittedAt: addDays(new Date(), -1),
      },
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  ).exec();

  await TaskGrade.findOneAndUpdate(
    {
      teacherId: target.teacherObjectId,
      classId: target.classId,
      taskId: targetIds.taskId,
      studentId: target.studentId,
    },
    {
      $set: {
        gradeId: targetIds.gradeId,
        teacherId: target.teacherObjectId,
        classId: target.classId,
        taskId: targetIds.taskId,
        studentId: target.studentId,
        subscriptionId: target.subscriptionId,
        score: target.taskScore,
        note: "Nilai cadangan sidang sudah diberikan guru.",
        status: "Sudah Dinilai",
        gradedAt: new Date(),
      },
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  ).exec();
}

async function upsertTryoutAndQuestions(target: ResolvedTarget) {
  const targetIds = ids(target);
  const period = getCurrentAcademicPeriod();
  const now = new Date();

  await TeacherTryout.findOneAndUpdate(
    { tryoutId: targetIds.tryoutId },
    {
      $set: {
        teacherId: target.teacherObjectId,
        classId: target.classId,
        branch: target.branch,
        canonicalClassName: target.canonicalClassName,
        assessmentType: "Tryout",
        title: `Tryout ${target.subject} - ${PREFIX} ${target.key}`,
        jenjang: getJenjang(target.className),
        kelas: target.className,
        subject: target.subject,
        stage: 1,
        durationMinutes: 45,
        startAt: addDays(now, -2),
        endAt: addDays(now, 30),
        publishStatus: "published",
        reviewStatus: "Disetujui",
        questionSource: "manual",
        questionCount: QUESTIONS.length,
        questionBankId: null,
        questionSetId: null,
        packageId: targetIds.packageId,
        fileName: null,
        academicYear: period.academicYear,
        semester: period.semester,
      },
      $setOnInsert: { tryoutId: targetIds.tryoutId },
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  ).exec();

  await Promise.all(
    QUESTIONS.map((question, index) =>
      TeacherTryoutQuestion.findOneAndUpdate(
        {
          questionId: `TQ-${PREFIX}-${target.key}-${String(index + 1).padStart(
            2,
            "0",
          )}`,
        },
        {
          $set: {
            teacherId: target.teacherObjectId,
            tryoutId: targetIds.tryoutId,
            questionText: question.text,
            optionA: question.options[0],
            optionB: question.options[1],
            optionC: question.options[2],
            optionD: question.options[3],
            correctAnswer: question.answer,
            order: index + 1,
          },
        },
        {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        },
      ).exec(),
    ),
  );
}

async function upsertAttemptAndAcademicGrade(target: ResolvedTarget) {
  const targetIds = ids(target);
  const period = getCurrentAcademicPeriod();
  const answers = QUESTIONS.map((question, index) => {
    const selectedAnswer = index < 4 ? question.answer : "A";

    return {
      questionId: `TQ-${PREFIX}-${target.key}-${String(index + 1).padStart(
        2,
        "0",
      )}`,
      selectedAnswer,
      isCorrect: selectedAnswer === question.answer,
    };
  });
  const correctCount = answers.filter((answer) => answer.isCorrect).length;
  const wrongCount = answers.filter((answer) => answer.selectedAnswer && !answer.isCorrect).length;
  const unansweredCount = answers.filter((answer) => !answer.selectedAnswer).length;

  await StudentTryoutAttempt.findOneAndUpdate(
    {
      tryoutId: targetIds.tryoutId,
      studentId: target.studentId,
    },
    {
      $set: {
        attemptId: targetIds.attemptId,
        tryoutId: targetIds.tryoutId,
        teacherId: target.teacherObjectId,
        classId: target.classId,
        branch: target.branch,
        studentId: target.studentId,
        subscriptionId: target.subscriptionId,
        questionSetId: "",
        packageId: targetIds.packageId,
        stage: 1,
        answers,
        correctCount,
        wrongCount,
        unansweredCount,
        score: target.examScore,
        timeUsedSeconds: 28 * 60,
        startedAt: addDays(new Date(), -1),
        submittedAt: addDays(new Date(), -1),
        status: "submitted",
      },
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  ).exec();

  const scheme = getAcademicGradeScheme(target.className);
  const filter = {
    teacherId: target.teacherObjectId,
    classId: target.classId,
    studentId: target.studentId,
    academicYear: period.academicYear,
    semester: period.semester,
  };
  const existingGrade = await AcademicGrade.findOne(filter).exec();
  const scores =
    scheme === "tryout"
      ? {
          uts: null,
          uas: null,
          uts1: null,
          uts2: null,
          uts3: null,
          tryout1: target.examScore,
          tryout2: null,
          tryout3: null,
        }
      : {
          uts: target.examScore,
          uas: null,
          uts1: null,
          uts2: null,
          uts3: null,
          tryout1: null,
          tryout2: null,
          tryout3: null,
        };

  await AcademicGrade.findOneAndUpdate(
    filter,
    {
      $set: {
        academicGradeId:
          existingGrade?.academicGradeId ?? targetIds.academicGradeId,
        teacherId: target.teacherObjectId,
        classId: target.classId,
        studentId: target.studentId,
        subscriptionId: target.subscriptionId,
        academicYear: period.academicYear,
        semester: period.semester,
        scheme,
        ...scores,
        note: "Rekap nilai cadangan sidang.",
        evaluatedAt: new Date(),
      },
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  ).exec();
}

async function upsertAttendance(target: ResolvedTarget) {
  const targetIds = ids(target);
  const period = getCurrentAcademicPeriod();
  const dates = [toDateOnly(addDays(new Date(), -6)), toDateOnly(addDays(new Date(), -3))];

  for (const [index, sessionId] of targetIds.sessionIds.entries()) {
    await AttendanceSession.findOneAndUpdate(
      { sessionId },
      {
        $set: {
          classId: target.classId,
          teacherId: target.teacherObjectId,
          scheduleId: target.scheduleId,
          className: target.className,
          subject: target.subject,
          branch: target.branch,
          room: target.room,
          date: dates[index],
          startTime: index === 0 ? "15:00" : "16:00",
          academicYear: period.academicYear,
          semester: period.semester,
          status: "closed",
          qrToken: null,
        },
        $setOnInsert: { sessionId },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    ).exec();

    await AttendanceRecord.findOneAndUpdate(
      {
        sessionId,
        studentId: target.studentId,
      },
      {
        $set: {
          recordId: targetIds.recordIds[index],
          sessionId,
          studentId: target.studentId,
          studentObjectId: target.studentObjectId,
          subscriptionId: target.subscriptionId,
          name: target.studentName,
          status: "Hadir",
          note: "Riwayat hadir cadangan sidang.",
          markedBy: "teacher",
          markedAt: addDays(new Date(), index === 0 ? -6 : -3),
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    ).exec();
  }
}

async function applySeed(targets: ResolvedTarget[]) {
  for (const target of targets) {
    await upsertMaterial(target);
    await upsertTask(target);
    await upsertSubmissionAndGrade(target);
    await upsertTryoutAndQuestions(target);
    await upsertAttemptAndAcademicGrade(target);
    await upsertAttendance(target);
  }

  console.log("[seed-sidang-backup] mode=apply");
  console.table(
    targets.map((target) => ({
      guru: `${target.teacherId} - ${target.teacherName}`,
      akunGuru: `${target.teacherEmail} / ${accountPassword("guru", target.teacherId)}`,
      siswa: `${target.studentId} - ${target.studentName}`,
      akunSiswa: `${target.studentEmail} / ${accountPassword("siswa", target.studentId)}`,
      kelas: `${target.branch} ${target.className}`,
      classId: target.classId,
      nilai: `${target.taskScore} / ${target.examScore}`,
    })),
  );
}

async function run() {
  const apply = process.argv.includes("--apply");

  await mongoose.connect(process.env.MONGO_URI as string);

  const targets = await resolveTargets();

  if (!apply) {
    await printDryRunSummary(targets);
    return;
  }

  await applySeed(targets);
}

run()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
