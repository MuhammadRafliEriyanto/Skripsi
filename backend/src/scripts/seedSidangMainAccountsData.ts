import mongoose, { type Types } from "mongoose";

import "../config/env";
import { AcademicGrade } from "../models/AcademicGrade";
import { ClassTask } from "../models/ClassTask";
import { Schedule } from "../models/Schedule";
import { Student, type StudentDocument } from "../models/Student";
import { StudentTryoutAttempt } from "../models/StudentTryoutAttempt";
import { Subscription } from "../models/Subscription";
import { TaskGrade } from "../models/TaskGrade";
import { TaskSubmission } from "../models/TaskSubmission";
import { Teacher } from "../models/Teacher";
import { TeacherTryout } from "../models/TeacherTryout";
import { TeacherTryoutQuestion } from "../models/TeacherTryoutQuestion";
import { User } from "../models/User";
import { getCurrentAcademicPeriod } from "../utils/academicGrade";
import { normalizeCanonicalClassName } from "../utils/studentClass";
import { buildStableTeacherClassId } from "../utils/teacherClassIdentity";

type ScriptOptions = {
  apply: boolean;
  teacherId: string;
  studentIds: [string, string];
  branch: string;
  className: string;
};

type ResolvedStudent = {
  student: StudentDocument;
  subscriptionId: Types.ObjectId | null;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TEACHER_ID = "TCH-001";
const DEFAULT_STUDENT_IDS: [string, string] = ["STD-024", "STD-027"];
const DEFAULT_BRANCH = "Slawi";
const DEFAULT_CLASS_NAME = "SMP 9";
const TASK_ID = "TSK-SIDANG-MAIN-001";
const SUBMISSION_IDS = ["SUBM-SIDANG-MAIN-001", "SUBM-SIDANG-MAIN-002"] as const;
const TASK_GRADE_IDS = ["GRD-SIDANG-MAIN-001", "GRD-SIDANG-MAIN-002"] as const;
const TRYOUT_ID = "TO-SIDANG-MAIN-001";
const ATTEMPT_ID = "STA-SIDANG-MAIN-001";
const ACADEMIC_GRADE_ID = "ACG-SIDANG-MAIN-001";
const PACKAGE_ID = "PKG-SIDANG-MAIN-001";
const QUESTIONS = [
  {
    questionId: "TQ-SIDANG-MAIN-001",
    questionText: "Hasil dari 15 + 27 adalah ...",
    options: ["32", "38", "42", "48"],
    correctAnswer: "C",
  },
  {
    questionId: "TQ-SIDANG-MAIN-002",
    questionText: "Jika 4x = 36, nilai x adalah ...",
    options: ["6", "7", "8", "9"],
    correctAnswer: "D",
  },
  {
    questionId: "TQ-SIDANG-MAIN-003",
    questionText: "Keliling persegi dengan sisi 9 cm adalah ...",
    options: ["18 cm", "27 cm", "36 cm", "81 cm"],
    correctAnswer: "C",
  },
  {
    questionId: "TQ-SIDANG-MAIN-004",
    questionText: "Bentuk sederhana dari 7a - 2a adalah ...",
    options: ["5a", "9a", "14a", "a5"],
    correctAnswer: "A",
  },
  {
    questionId: "TQ-SIDANG-MAIN-005",
    questionText: "Rata-rata dari 60, 75, dan 90 adalah ...",
    options: ["70", "75", "80", "85"],
    correctAnswer: "B",
  },
] as const;

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function parseCsvPair(value: string | undefined): [string, string] | null {
  const parts = normalizeText(value)
    .split(",")
    .map((item) => normalizeText(item))
    .filter(Boolean);

  return parts.length >= 2 ? [parts[0], parts[1]] : null;
}

function parseOptions(argv: string[]): ScriptOptions {
  const teacherArg = argv.find((arg) => arg.startsWith("--teacher="));
  const studentsArg = argv.find((arg) => arg.startsWith("--students="));
  const branchArg = argv.find((arg) => arg.startsWith("--branch="));
  const classArg = argv.find((arg) => arg.startsWith("--class="));

  return {
    apply: argv.includes("--apply"),
    teacherId: normalizeText(teacherArg?.split("=")[1]) || DEFAULT_TEACHER_ID,
    studentIds: parseCsvPair(studentsArg?.split("=")[1]) ?? DEFAULT_STUDENT_IDS,
    branch: normalizeText(branchArg?.split("=")[1]) || DEFAULT_BRANCH,
    className: normalizeText(classArg?.split("=")[1]) || DEFAULT_CLASS_NAME,
  };
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

function buildClassId(options: ScriptOptions) {
  return buildStableTeacherClassId(
    options.teacherId,
    options.branch,
    options.className,
  );
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

  return subscription?._id ? asObjectId(subscription._id) : null;
}

async function resolveContext(options: ScriptOptions) {
  const teacher = await Teacher.findOne({
    teacherId: options.teacherId,
    status: "Aktif",
  }).exec();

  if (!teacher) {
    throw new Error(`Guru aktif tidak ditemukan: ${options.teacherId}`);
  }

  const schedule = await Schedule.findOne({
    teacherId: teacher._id,
    branch: new RegExp(`^${options.branch}$`, "i"),
    className: new RegExp(`^${options.className}$`, "i"),
    status: { $ne: "Bentrok" },
  }).exec();

  if (!schedule) {
    throw new Error(
      `Jadwal ${options.teacherId} ${options.branch} ${options.className} tidak ditemukan.`,
    );
  }

  const resolvedStudents: ResolvedStudent[] = [];

  for (const studentId of options.studentIds) {
    const student = await Student.findOne({
      studentId,
      status: "Aktif",
      branch: new RegExp(`^${options.branch}$`, "i"),
      className: new RegExp(`^${options.className}$`, "i"),
    }).exec();

    if (!student) {
      throw new Error(
        `Siswa aktif tidak ditemukan di ${options.branch} ${options.className}: ${studentId}`,
      );
    }

    resolvedStudents.push({
      student,
      subscriptionId: await findActiveSubscriptionId(asObjectId(student._id)),
    });
  }

  return {
    teacher,
    schedule,
    students: resolvedStudents,
    teacherObjectId: asObjectId(teacher._id),
    classId: buildClassId(options),
  };
}

async function printDryRunSummary(options: ScriptOptions) {
  const context = await resolveContext(options);
  const teacherUser = await User.findById(context.teacher.userId).lean().exec();
  const studentUsers = await Promise.all(
    context.students.map(({ student }) =>
      User.findById(student?.userId).lean().exec(),
    ),
  );
  const [
    taskCount,
    submissionCount,
    taskGradeCount,
    tryoutCount,
    questionCount,
    attemptCount,
    academicGradeCount,
  ] = await Promise.all([
    ClassTask.countDocuments({ taskId: TASK_ID }),
    TaskSubmission.countDocuments({ submissionId: { $in: SUBMISSION_IDS } }),
    TaskGrade.countDocuments({ gradeId: { $in: TASK_GRADE_IDS } }),
    TeacherTryout.countDocuments({ tryoutId: TRYOUT_ID }),
    TeacherTryoutQuestion.countDocuments({
      questionId: { $in: QUESTIONS.map((question) => question.questionId) },
    }),
    StudentTryoutAttempt.countDocuments({ attemptId: ATTEMPT_ID }),
    AcademicGrade.countDocuments({
      teacherId: context.teacherObjectId,
      classId: context.classId,
      studentId: options.studentIds[0],
      academicYear: getCurrentAcademicPeriod().academicYear,
    }),
  ]);

  console.log("[seed-sidang-main] mode=dry-run");
  console.table([
    {
      role: "Guru",
      code: options.teacherId,
      name: normalizeText(teacherUser?.nama),
      email: normalizeText(teacherUser?.email),
    },
    ...context.students.map(({ student }, index) => ({
      role: `Siswa ${index + 1}`,
      code: normalizeText(student?.studentId),
      name: normalizeText(studentUsers[index]?.nama),
      email: normalizeText(studentUsers[index]?.email),
    })),
  ]);
  console.table([
    { data: "Tugas", existing: taskCount, target: 1 },
    { data: "Submission tugas", existing: submissionCount, target: 2 },
    { data: "Nilai tugas", existing: taskGradeCount, target: 2 },
    { data: "Ujian tryout", existing: tryoutCount, target: 1 },
    { data: "Soal ujian", existing: questionCount, target: QUESTIONS.length },
    { data: "Attempt submitted", existing: attemptCount, target: 1 },
    { data: "Rekap nilai akademik", existing: academicGradeCount, target: 1 },
  ]);
  console.log(`Class ID: ${context.classId}`);
  console.log("Dry-run selesai. Jalankan dengan --apply untuk menyimpan data.");
}

async function upsertTask(input: {
  options: ScriptOptions;
  classId: string;
  teacherObjectId: Types.ObjectId;
  deadline: Date;
}) {
  const period = getCurrentAcademicPeriod();

  await ClassTask.findOneAndUpdate(
    { taskId: TASK_ID },
    {
      $set: {
        classId: input.classId,
        teacherId: input.teacherObjectId,
        className: input.options.className,
        canonicalClassName:
          normalizeCanonicalClassName(input.options.className) ??
          input.options.className,
        subject: "Matematika",
        branch: input.options.branch,
        room: "Ruang Demo Sidang",
        meetingNumber: 1,
        title: "Latihan Persamaan Linear - Data Sidang",
        description:
          "Kerjakan latihan persamaan linear dan tuliskan langkah penyelesaian secara lengkap.",
        deadline: toDateOnly(input.deadline),
        attachment: null,
        submittedCount: 2,
        reviewStatus: "Belum Dinilai",
        academicYear: period.academicYear,
        semester: period.semester,
      },
      $setOnInsert: { taskId: TASK_ID },
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  ).exec();
}

async function upsertTaskSubmissions(input: {
  classId: string;
  teacherObjectId: Types.ObjectId;
  students: ResolvedStudent[];
}) {
  await Promise.all(
    input.students.map(({ student, subscriptionId }, index) =>
      TaskSubmission.findOneAndUpdate(
        { taskId: TASK_ID, studentId: normalizeText(student?.studentId) },
        {
          $set: {
            submissionId: SUBMISSION_IDS[index],
            teacherId: input.teacherObjectId,
            classId: input.classId,
            taskId: TASK_ID,
            studentId: normalizeText(student?.studentId),
            subscriptionId,
            submissionMode: "text",
            answerText:
              index === 0
                ? "Jawaban: 4x = 36, maka x = 9. Semua langkah penyelesaian ditulis runtut."
                : "Jawaban sudah dikumpulkan, tetapi sengaja belum diselesaikan penilaiannya untuk demo status.",
            driveUrl: "",
            attachment: null,
            note:
              index === 0
                ? "Submission akun utama yang sudah dinilai."
                : "Submission akun utama yang masih menunggu penilaian.",
            submittedAt: addDays(new Date(), index === 0 ? -2 : -1),
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

async function upsertTaskGrades(input: {
  classId: string;
  teacherObjectId: Types.ObjectId;
  students: ResolvedStudent[];
}) {
  await Promise.all(
    input.students.map(({ student, subscriptionId }, index) =>
      TaskGrade.findOneAndUpdate(
        {
          teacherId: input.teacherObjectId,
          classId: input.classId,
          taskId: TASK_ID,
          studentId: normalizeText(student?.studentId),
        },
        {
          $set: {
            gradeId: TASK_GRADE_IDS[index],
            teacherId: input.teacherObjectId,
            classId: input.classId,
            taskId: TASK_ID,
            studentId: normalizeText(student?.studentId),
            subscriptionId,
            score: index === 0 ? 88 : 0,
            note:
              index === 0
                ? "Jawaban runtut dan benar."
                : "Belum dinilai untuk memperlihatkan status pending saat sidang.",
            status: index === 0 ? "Sudah Dinilai" : "Belum Dinilai",
            gradedAt: index === 0 ? new Date() : null,
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

async function upsertTryout(input: {
  options: ScriptOptions;
  classId: string;
  teacherObjectId: Types.ObjectId;
}) {
  const period = getCurrentAcademicPeriod();
  const now = new Date();

  await TeacherTryout.findOneAndUpdate(
    { tryoutId: TRYOUT_ID },
    {
      $set: {
        teacherId: input.teacherObjectId,
        classId: input.classId,
        branch: input.options.branch,
        canonicalClassName:
          normalizeCanonicalClassName(input.options.className) ??
          input.options.className,
        assessmentType: "Tryout",
        title: "Tryout 1 Matematika SMP 9 - Akun Utama",
        jenjang: "SMP",
        kelas: input.options.className,
        subject: "Matematika",
        stage: 1,
        durationMinutes: 45,
        startAt: addDays(now, -3),
        endAt: addDays(now, 30),
        publishStatus: "published",
        reviewStatus: "Disetujui",
        questionSource: "manual",
        questionCount: QUESTIONS.length,
        questionBankId: null,
        questionSetId: null,
        packageId: PACKAGE_ID,
        fileName: null,
        academicYear: period.academicYear,
        semester: period.semester,
      },
      $setOnInsert: { tryoutId: TRYOUT_ID },
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  ).exec();
}

async function upsertQuestions(teacherObjectId: Types.ObjectId) {
  await Promise.all(
    QUESTIONS.map((question, index) =>
      TeacherTryoutQuestion.findOneAndUpdate(
        { questionId: question.questionId },
        {
          $set: {
            teacherId: teacherObjectId,
            tryoutId: TRYOUT_ID,
            questionText: question.questionText,
            optionA: question.options[0],
            optionB: question.options[1],
            optionC: question.options[2],
            optionD: question.options[3],
            correctAnswer: question.correctAnswer,
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

async function upsertAttempt(input: {
  classId: string;
  branch: string;
  teacherObjectId: Types.ObjectId;
  student: ResolvedStudent;
}) {
  const answers = QUESTIONS.map((question, index) => {
    const selectedAnswer = index === QUESTIONS.length - 1 ? "A" : question.correctAnswer;

    return {
      questionId: question.questionId,
      selectedAnswer,
      isCorrect: selectedAnswer === question.correctAnswer,
    };
  });
  const correctCount = answers.filter((answer) => answer.isCorrect).length;
  const wrongCount = answers.filter((answer) => answer.selectedAnswer && !answer.isCorrect).length;
  const unansweredCount = answers.filter((answer) => !answer.selectedAnswer).length;
  const score = Math.round((correctCount / QUESTIONS.length) * 100);

  await StudentTryoutAttempt.findOneAndUpdate(
    {
      tryoutId: TRYOUT_ID,
      studentId: normalizeText(input.student.student?.studentId),
    },
    {
      $set: {
        attemptId: ATTEMPT_ID,
        tryoutId: TRYOUT_ID,
        teacherId: input.teacherObjectId,
        classId: input.classId,
        branch: input.branch,
        studentId: normalizeText(input.student.student?.studentId),
        subscriptionId: input.student.subscriptionId,
        questionSetId: "",
        packageId: PACKAGE_ID,
        stage: 1,
        answers,
        correctCount,
        wrongCount,
        unansweredCount,
        score,
        timeUsedSeconds: 31 * 60,
        startedAt: addDays(new Date(), -1),
        submittedAt: addDays(new Date(), -1),
        status: "submitted",
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  ).exec();

  return score;
}

async function upsertAcademicGrade(input: {
  classId: string;
  teacherObjectId: Types.ObjectId;
  student: ResolvedStudent;
  tryoutScore: number;
}) {
  const period = getCurrentAcademicPeriod();
  const studentId = normalizeText(input.student.student?.studentId);
  const filter = {
    teacherId: input.teacherObjectId,
    classId: input.classId,
    studentId,
    academicYear: period.academicYear,
    semester: period.semester,
  };
  const existingGrade = await AcademicGrade.findOne(filter).exec();

  await AcademicGrade.findOneAndUpdate(
    filter,
    {
      $set: {
        academicGradeId: existingGrade?.academicGradeId ?? ACADEMIC_GRADE_ID,
        teacherId: input.teacherObjectId,
        classId: input.classId,
        studentId,
        subscriptionId: input.student.subscriptionId,
        academicYear: period.academicYear,
        semester: period.semester,
        scheme: "tryout",
        tryout1: input.tryoutScore,
        note: "Nilai Tryout 1 dari data sidang akun utama.",
        evaluatedAt: new Date(),
      },
      $setOnInsert: {
        uts: null,
        uas: null,
        uts1: null,
        uts2: null,
        uts3: null,
        tryout2: null,
        tryout3: null,
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

async function applySeed(options: ScriptOptions) {
  const context = await resolveContext(options);

  await upsertTask({
    options,
    classId: context.classId,
    teacherObjectId: context.teacherObjectId,
    deadline: addDays(new Date(), 7),
  });
  await upsertTaskSubmissions({
    classId: context.classId,
    teacherObjectId: context.teacherObjectId,
    students: context.students,
  });
  await upsertTaskGrades({
    classId: context.classId,
    teacherObjectId: context.teacherObjectId,
    students: context.students,
  });
  await upsertTryout({
    options,
    classId: context.classId,
    teacherObjectId: context.teacherObjectId,
  });
  await upsertQuestions(context.teacherObjectId);
  const tryoutScore = await upsertAttempt({
    classId: context.classId,
    branch: options.branch,
    teacherObjectId: context.teacherObjectId,
    student: context.students[0],
  });
  await upsertAcademicGrade({
    classId: context.classId,
    teacherObjectId: context.teacherObjectId,
    student: context.students[0],
    tryoutScore,
  });

  console.log("[seed-sidang-main] mode=apply");
  console.table([
    {
      data: "Guru",
      value: options.teacherId,
    },
    {
      data: "Siswa sudah dinilai",
      value: options.studentIds[0],
    },
    {
      data: "Siswa belum dinilai",
      value: options.studentIds[1],
    },
    {
      data: "Class ID",
      value: context.classId,
    },
    {
      data: "Nilai tugas / tryout",
      value: "88 / 80",
    },
  ]);
}

async function run() {
  const options = parseOptions(process.argv.slice(2));

  await mongoose.connect(process.env.MONGO_URI as string);

  if (!options.apply) {
    await printDryRunSummary(options);
    return;
  }

  await applySeed(options);
}

run()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
