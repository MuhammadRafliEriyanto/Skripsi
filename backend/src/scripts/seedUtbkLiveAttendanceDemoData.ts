import mongoose from "mongoose";

import "../config/env";
import { AttendanceRecord } from "../models/AttendanceRecord";
import { AttendanceSession } from "../models/AttendanceSession";
import { Schedule } from "../models/Schedule";
import { Student, type StudentDocument } from "../models/Student";
import { Teacher, type TeacherDocument } from "../models/Teacher";
import { User } from "../models/User";
import { getCurrentAcademicPeriod } from "../utils/academicGrade";
import {
  getStudentEffectiveAcademicJoinedAt,
  getJakartaDateKey,
} from "../utils/studentAcademicStatus";
import { getUtbkScheduleClassNames } from "../utils/studentProgram";
import { findActiveSubscriptionByStudentId } from "../utils/subscription";
import { resolveScheduleAttendanceWindow } from "../utils/scheduleAttendanceWindow";
import { buildStableTeacherClassId } from "../utils/teacherClassIdentity";

type SeedOptions = {
  apply: boolean;
  studentId: string;
  demoDate: string;
  timeRange: string;
  startTime: string;
};

type LiveAttendanceContext = {
  student: StudentDocument;
  studentName: string;
  teacher: TeacherDocument;
  branch: string;
  className: string;
  classId: string;
  room: string;
  scheduleId: string;
  sessionId: string;
  recordId: string;
  qrToken: string;
  date: string;
  day: string;
  time: string;
  startTime: string;
  academicYear: string;
  semester: string;
  subscriptionId: mongoose.Types.ObjectId | null;
};

const DEMO_MARKER = "[utbk-demo-live-attendance]";
const DEFAULT_DEMO_DATE = "2026-08-03";
const DEFAULT_LIVE_TIME_RANGE = "08:00 - 10:00";

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

function normalizeDateKey(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    return "";
  }

  const date = new Date(`${normalizedValue}T00:00:00+07:00`);

  return Number.isNaN(date.getTime()) ? "" : normalizedValue;
}

function getStartTimeFromRange(timeRange: string) {
  const [startTime] = normalizeText(timeRange).split("-");
  const normalizedStartTime = normalizeText(startTime).replace(".", ":");

  return /^\d{1,2}:\d{2}$/.test(normalizedStartTime)
    ? normalizedStartTime.padStart(5, "0")
    : "08:00";
}

function parseOptions(argv: string[]): SeedOptions {
  const studentArg = argv.find((item) => item.startsWith("--student="));
  const dateArg = argv.find((item) => item.startsWith("--date="));
  const timeArg = argv.find((item) => item.startsWith("--time="));
  const timeRange = normalizeText(
    timeArg?.split("=").slice(1).join("="),
  ) || DEFAULT_LIVE_TIME_RANGE;

  return {
    apply: argv.includes("--apply"),
    studentId: normalizeText(studentArg?.split("=").slice(1).join("=")),
    demoDate:
      normalizeDateKey(dateArg?.split("=").slice(1).join("=")) ||
      DEFAULT_DEMO_DATE,
    timeRange,
    startTime: getStartTimeFromRange(timeRange),
  };
}

function getJakartaDayName(dateKey: string) {
  const dayName = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    timeZone: "Asia/Jakarta",
  }).format(new Date(`${dateKey}T00:00:00+07:00`));

  return normalizeText(dayName);
}

function getDemoWindowReferenceDate(context: LiveAttendanceContext) {
  return new Date(`${context.date}T${context.startTime}:00+07:00`);
}

function buildQrPayloadUrl(context: LiveAttendanceContext) {
  return `/dashboard-siswa/scan-absen?sessionId=${encodeURIComponent(
    context.sessionId,
  )}&token=${encodeURIComponent(context.qrToken)}`;
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

async function getStudentName(student: StudentDocument) {
  const user = await User.findById(student.userId).select("nama").lean().exec();

  return normalizeText(user?.nama) || `Siswa ${student.studentId}`;
}

async function findExistingUtbkTeacher(
  branch: string,
  utbkClassNames: string[],
) {
  const sourceSchedule =
    (await Schedule.findOne({
      branch,
      className: {
        $in: utbkClassNames,
      },
      subject: "TPS",
    })
      .sort({ scheduleId: 1 })
      .exec()) ??
    (await Schedule.findOne({
      branch,
      className: {
        $in: utbkClassNames,
      },
    })
      .sort({ scheduleId: 1 })
      .exec());
  const teacher =
    (sourceSchedule ? await Teacher.findById(sourceSchedule.teacherId).exec() : null) ??
    (await Teacher.findOne({
      status: "Aktif",
      $or: [{ branch }, { branches: branch }],
    })
      .sort({ teacherId: 1 })
      .exec());

  if (!teacher) {
    throw new Error(
      `Tidak ada guru existing aktif untuk cabang ${branch}. Buat jadwal UTBK dari admin lebih dulu.`,
    );
  }

  return {
    teacher,
    room: normalizeText(sourceSchedule?.room) || `Ruang UTBK ${branch}`,
    academicYear:
      normalizeText(sourceSchedule?.academicYear) ||
      getCurrentAcademicPeriod().academicYear,
    semester:
      normalizeText(sourceSchedule?.semester) || getCurrentAcademicPeriod().semester,
  };
}

async function buildLiveAttendanceContext(
  student: StudentDocument,
  options: SeedOptions,
): Promise<LiveAttendanceContext> {
  const branch = normalizeText(student.branch);
  const utbkClassNames = getUtbkScheduleClassNames(student);

  if (!branch || utbkClassNames.length === 0) {
    throw new Error("Profil siswa UTBK belum memiliki cabang atau track kelas.");
  }

  const subscription = await findActiveSubscriptionByStudentId(student._id);
  const academicJoinedAt = getStudentEffectiveAcademicJoinedAt(
    student,
    subscription,
  );

  if (!academicJoinedAt) {
    throw new Error("Membership akademik siswa UTBK belum aktif.");
  }

  const className = "UTBK";
  const date = options.demoDate || getJakartaDateKey(new Date());
  const { teacher, room, academicYear, semester } = await findExistingUtbkTeacher(
    branch,
    utbkClassNames,
  );

  return {
    student,
    studentName: await getStudentName(student),
    teacher,
    branch,
    className,
    classId: buildStableTeacherClassId(teacher.teacherId, branch, className),
    room,
    scheduleId: `SCH-UTBK-DEMO-LIVE-${normalizePublicIdPart(branch)}`,
    sessionId: `ATS-UTBK-DEMO-LIVE-${normalizePublicIdPart(branch)}`,
    recordId: `ATR-UTBK-DEMO-LIVE-${normalizePublicIdPart(student.studentId)}`,
    qrToken: `qr_utbk_demo_live_${normalizePublicIdPart(branch).toLowerCase()}`,
    date,
    day: getJakartaDayName(date),
    time: options.timeRange,
    startTime: options.startTime,
    academicYear,
    semester,
    subscriptionId: subscription?._id ?? null,
  };
}

async function upsertLiveSchedule(
  context: LiveAttendanceContext,
  options: SeedOptions,
) {
  const existingSchedule = await Schedule.findOne({
    scheduleId: context.scheduleId,
  }).exec();
  const payload = {
    scheduleId: context.scheduleId,
    day: context.day,
    time: context.time,
    className: context.className,
    branch: context.branch,
    subject: "TPS",
    teacherId: context.teacher._id,
    room: context.room,
    status: "Berjalan" as const,
    academicYear: context.academicYear,
    semester: context.semester,
  };

  if (!options.apply) {
    return {
      action: existingSchedule ? "updated" : "created",
      scheduleId: context.scheduleId,
      day: payload.day,
      time: payload.time,
      windowAtDemoTime: resolveScheduleAttendanceWindow(
        payload,
        getDemoWindowReferenceDate(context),
      ),
      windowNow: resolveScheduleAttendanceWindow(payload),
    };
  }

  const schedule = await Schedule.findOneAndUpdate(
    {
      scheduleId: context.scheduleId,
    },
    {
      $set: payload,
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  ).exec();

  if (!schedule) {
    throw new Error("Jadwal demo live UTBK gagal disimpan.");
  }

  return {
    action: existingSchedule ? "updated" : "created",
    scheduleId: schedule.scheduleId,
    day: schedule.day,
    time: schedule.time,
    windowAtDemoTime: resolveScheduleAttendanceWindow(
      schedule,
      getDemoWindowReferenceDate(context),
    ),
    windowNow: resolveScheduleAttendanceWindow(schedule),
  };
}

async function upsertLiveSession(
  context: LiveAttendanceContext,
  options: SeedOptions,
) {
  const naturalSession = await AttendanceSession.findOne({
    teacherId: context.teacher._id,
    classId: context.classId,
    date: context.date,
  }).exec();
  const existingSession =
    naturalSession ??
    (await AttendanceSession.findOne({ sessionId: context.sessionId }).exec());
  const resolvedSessionId = existingSession?.sessionId ?? context.sessionId;
  const payload = {
    sessionId: resolvedSessionId,
    classId: context.classId,
    teacherId: context.teacher._id,
    scheduleId: context.scheduleId,
    className: context.className,
    subject: "TPS",
    branch: context.branch,
    room: context.room,
    date: context.date,
    startTime: context.startTime,
    academicYear: context.academicYear,
    semester: context.semester,
    status: "open" as const,
    qrToken: context.qrToken,
  };

  if (!options.apply) {
    return {
      action: existingSession ? "updated" : "created",
      sessionId: resolvedSessionId,
      status: payload.status,
      qrToken: payload.qrToken,
    };
  }

  const session = await AttendanceSession.findOneAndUpdate(
    {
      sessionId: resolvedSessionId,
    },
    {
      $set: payload,
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  ).exec();

  if (!session) {
    throw new Error("Sesi absensi demo live UTBK gagal disimpan.");
  }

  return {
    action: existingSession ? "updated" : "created",
    sessionId: session.sessionId,
    status: session.status,
    qrToken: session.qrToken,
  };
}

async function upsertLiveRecord(
  context: LiveAttendanceContext,
  sessionId: string,
  options: SeedOptions,
) {
  const existingRecord = await AttendanceRecord.findOne({
    sessionId,
    studentId: context.student.studentId,
  }).exec();
  const canResetRecord =
    !existingRecord ||
    normalizeText(existingRecord.recordId).startsWith("ATR-UTBK-DEMO-LIVE") ||
    normalizeText(existingRecord.note).includes(DEMO_MARKER) ||
    existingRecord.status === "Belum Absen";

  if (!options.apply) {
    return {
      action: existingRecord ? (canResetRecord ? "updated" : "skipped") : "created",
      recordId: existingRecord?.recordId ?? context.recordId,
      status: canResetRecord ? "Belum Absen" : existingRecord?.status,
    };
  }

  if (!canResetRecord) {
    return {
      action: "skipped",
      recordId: existingRecord.recordId,
      status: existingRecord.status,
    };
  }

  const record = await AttendanceRecord.findOneAndUpdate(
    {
      sessionId,
      studentId: context.student.studentId,
    },
    {
      $set: {
        recordId: existingRecord?.recordId ?? context.recordId,
        sessionId,
        studentId: context.student.studentId,
        studentObjectId: context.student._id,
        subscriptionId: context.subscriptionId,
        name: context.studentName,
        status: "Belum Absen",
        note: `${DEMO_MARKER} Menunggu scan QR demo UTBK.`,
        markedBy: "teacher",
        markedAt: null,
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  ).exec();

  if (!record) {
    throw new Error("Record absensi demo live UTBK gagal disimpan.");
  }

  return {
    action: existingRecord ? "updated" : "created",
    recordId: record.recordId,
    status: record.status,
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
              : "Tidak ada siswa UTBK aktif untuk demo live absensi.",
          },
          null,
          2,
        ),
      );
      return;
    }

    const context = await buildLiveAttendanceContext(student, options);
    const schedule = await upsertLiveSchedule(context, options);
    const session = await upsertLiveSession(context, options);
    const record = await upsertLiveRecord(
      context,
      session.sessionId,
      options,
    );

    console.log(
      JSON.stringify(
        {
          mode: options.apply ? "apply" : "dry-run",
          targetStudent: {
            studentId: context.student.studentId,
            name: context.studentName,
            branch: context.branch,
            program: context.student.program,
            className: context.student.className,
            utbkTrack: context.student.utbkTrack ?? "",
          },
          teacher: {
            teacherId: context.teacher.teacherId,
            subject: context.teacher.subject,
          },
          liveAttendance: {
            schedule,
            session,
            record,
            qrPayload: {
              sessionId: session.sessionId,
              token: context.qrToken,
            },
            qrPayloadText: `${session.sessionId}|${context.qrToken}`,
            qrPayloadUrl: buildQrPayloadUrl({
              ...context,
              sessionId: session.sessionId,
            }),
          },
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
