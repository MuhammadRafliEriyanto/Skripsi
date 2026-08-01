import mongoose from "mongoose";

import "../config/env";
import {
  AttendanceRecord,
  type AttendanceRecordStatus,
} from "../models/AttendanceRecord";
import { AttendanceSession } from "../models/AttendanceSession";
import { Schedule, type ScheduleDocument } from "../models/Schedule";
import { Student, type StudentDocument } from "../models/Student";
import "../models/Teacher";
import { User } from "../models/User";
import { getCurrentAcademicPeriod } from "../utils/academicGrade";
import {
  getStudentEffectiveAcademicJoinedAt,
  getJakartaDateKey,
  parseValidDate,
} from "../utils/studentAcademicStatus";
import { getUtbkScheduleClassNames } from "../utils/studentProgram";
import {
  findActiveSubscriptionByStudentId,
  type StudentWithUser,
} from "../utils/subscription";
import { buildStableTeacherClassId } from "../utils/teacherClassIdentity";

type SeedOptions = {
  apply: boolean;
  studentId: string;
  count: number;
};

type PlannedAttendance = {
  index: number;
  schedule: ScheduleDocument;
  classId: string;
  date: string;
  startTime: string;
  status: AttendanceRecordStatus;
  note: string;
};

const attendanceStatusPlan: Array<{
  status: AttendanceRecordStatus;
  note: string;
}> = [
  {
    status: "Hadir",
    note: "[utbk-demo-attendance] Hadir pada sesi latihan TPS UTBK.",
  },
  {
    status: "Hadir",
    note: "[utbk-demo-attendance] Hadir pada sesi literasi UTBK.",
  },
  {
    status: "Izin",
    note: "[utbk-demo-attendance] Izin pada sesi penalaran matematika UTBK.",
  },
];

const indonesianDayIndex = new Map([
  ["minggu", 0],
  ["senin", 1],
  ["selasa", 2],
  ["rabu", 3],
  ["kamis", 4],
  ["jumat", 5],
  ["jum'at", 5],
  ["sabtu", 6],
]);

const scheduleSortDayOrder = new Map(
  ["senin", "selasa", "rabu", "kamis", "jumat", "jum'at", "sabtu", "minggu"].map(
    (day, index) => [day, index],
  ),
);

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
  const countArg = argv.find((item) => item.startsWith("--count="));
  const parsedCount = Number.parseInt(
    normalizeText(countArg?.split("=").slice(1).join("=")),
    10,
  );

  return {
    apply: argv.includes("--apply"),
    studentId: normalizeText(studentArg?.split("=").slice(1).join("=")),
    count: Number.isFinite(parsedCount)
      ? Math.max(1, Math.min(3, parsedCount))
      : 3,
  };
}

function getStartTime(scheduleTime: string) {
  const [startTime] = normalizeText(scheduleTime).split("-");

  return normalizeText(startTime).replace(".", ":") || "13:00";
}

function getDayOrder(day: string) {
  const dayIndex = scheduleSortDayOrder.get(normalizeText(day).toLowerCase());

  return dayIndex ?? Number.MAX_SAFE_INTEGER;
}

function getTimeOrder(scheduleTime: string) {
  const matchedTime = getStartTime(scheduleTime).match(/^(\d{1,2}):(\d{2})$/);

  if (!matchedTime) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Number(matchedTime[1]) * 60 + Number(matchedTime[2]);
}

function toJakartaDateOnly(date: Date) {
  return new Date(`${getJakartaDateKey(date)}T00:00:00+07:00`);
}

function getNextDateForDay(day: string, baseDate: Date, weekOffset: number) {
  const targetDayIndex = indonesianDayIndex.get(
    normalizeText(day).toLowerCase(),
  );
  const normalizedBaseDate = toJakartaDateOnly(baseDate);

  if (targetDayIndex === undefined) {
    const fallbackDate = new Date(normalizedBaseDate);
    fallbackDate.setDate(normalizedBaseDate.getDate() + weekOffset);

    return getJakartaDateKey(fallbackDate);
  }

  const currentDayIndex = normalizedBaseDate.getDay();
  const dayDistance = (targetDayIndex - currentDayIndex + 7) % 7;
  const date = new Date(normalizedBaseDate);
  date.setDate(normalizedBaseDate.getDate() + dayDistance + weekOffset * 7);

  return getJakartaDateKey(date);
}

function buildMarkedAt(date: string, startTime: string, minuteOffset: number) {
  const markedAt = new Date(`${date}T${startTime}:00+07:00`);

  if (Number.isNaN(markedAt.getTime())) {
    return new Date();
  }

  markedAt.setMinutes(markedAt.getMinutes() + minuteOffset);

  return markedAt;
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

async function buildAttendancePlan(
  student: StudentDocument,
  options: SeedOptions,
) {
  const branch = normalizeText(student.branch);
  const utbkClassNames = getUtbkScheduleClassNames(student);

  if (!branch || utbkClassNames.length === 0) {
    throw new Error("Profil siswa UTBK belum memiliki cabang atau track kelas.");
  }

  const schedules = await Schedule.find({
    branch,
    className: {
      $in: utbkClassNames,
    },
  })
    .populate("teacherId")
    .exec();
  schedules.sort((leftSchedule, rightSchedule) => {
    const dayDifference =
      getDayOrder(leftSchedule.day) - getDayOrder(rightSchedule.day);

    if (dayDifference !== 0) {
      return dayDifference;
    }

    const timeDifference =
      getTimeOrder(leftSchedule.time) - getTimeOrder(rightSchedule.time);

    if (timeDifference !== 0) {
      return timeDifference;
    }

    return leftSchedule.scheduleId.localeCompare(
      rightSchedule.scheduleId,
      "id-ID",
    );
  });

  if (schedules.length === 0) {
    throw new Error(
      `Jadwal UTBK cabang ${branch} belum tersedia. Jalankan seed jadwal UTBK atau buat jadwal dari admin lebih dulu.`,
    );
  }

  const subscription = await findActiveSubscriptionByStudentId(student._id);
  const academicJoinedAt = getStudentEffectiveAcademicJoinedAt(
    student,
    subscription,
  );

  if (!academicJoinedAt) {
    throw new Error("Membership akademik siswa UTBK belum aktif.");
  }

  const baseDate = toJakartaDateOnly(
    parseValidDate(subscription?.startDate) ?? academicJoinedAt,
  );
  const selectedSchedules = schedules.slice(0, options.count);
  const usedSessionKeys = new Set<string>();

  const plans = selectedSchedules.map((schedule, index) => {
    const teacher = schedule.teacherId as unknown as { teacherId?: string };
    const className = normalizeText(schedule.className);
    const startTime = getStartTime(schedule.time);
    const classId = buildStableTeacherClassId(
      normalizeText(teacher.teacherId),
      branch,
      className,
    );
    const teacherObjectId = (
      schedule.teacherId as unknown as { _id?: mongoose.Types.ObjectId }
    )._id?.toString();
    let weekOffset = 0;
    let date = getNextDateForDay(schedule.day, baseDate, weekOffset);
    let sessionKey = `${teacherObjectId}|${classId}|${date}`;

    while (usedSessionKeys.has(sessionKey)) {
      weekOffset += 1;
      date = getNextDateForDay(schedule.day, baseDate, weekOffset);
      sessionKey = `${teacherObjectId}|${classId}|${date}`;
    }

    usedSessionKeys.add(sessionKey);

    return {
      index,
      schedule,
      classId,
      date,
      startTime,
      status: attendanceStatusPlan[index]?.status ?? "Hadir",
      note:
        attendanceStatusPlan[index]?.note ??
        "[utbk-demo-attendance] Hadir pada sesi UTBK.",
    } satisfies PlannedAttendance;
  });

  return {
    subscription,
    plans,
  };
}

async function upsertAttendanceRecord(params: {
  plan: PlannedAttendance;
  student: StudentDocument;
  studentName: string;
  subscriptionId: mongoose.Types.ObjectId | null;
  options: SeedOptions;
}) {
  const { plan, student, studentName, subscriptionId, options } = params;
  const sessionId = `ATS-UTBK-DEMO-${normalizePublicIdPart(
    student.branch,
  )}-${String(plan.index + 1).padStart(3, "0")}`;
  const recordId = `ATR-UTBK-DEMO-${normalizePublicIdPart(
    student.studentId,
  )}-${String(plan.index + 1).padStart(3, "0")}`;
  const teacherId =
    (plan.schedule.teacherId as unknown as { _id?: mongoose.Types.ObjectId })
      ._id ?? plan.schedule.teacherId;
  const period = {
    academicYear:
      normalizeText(plan.schedule.academicYear) ||
      getCurrentAcademicPeriod().academicYear,
    semester:
      normalizeText(plan.schedule.semester) ||
      getCurrentAcademicPeriod().semester,
  };
  const existingNaturalSession = await AttendanceSession.findOne({
    teacherId,
    classId: plan.classId,
    date: plan.date,
  }).exec();
  const existingSession =
    existingNaturalSession ??
    (await AttendanceSession.findOne({ sessionId }).exec());
  const resolvedSessionId = existingSession?.sessionId ?? sessionId;
  const existingRecord = await AttendanceRecord.findOne({
    sessionId: resolvedSessionId,
    studentId: student.studentId,
  }).exec();

  if (!options.apply) {
    return {
      session: {
        action: existingSession ? "skipped" : "created",
        sessionId: resolvedSessionId,
        subject: plan.schedule.subject,
        date: plan.date,
        startTime: plan.startTime,
      },
      record: {
        action: existingRecord ? "skipped" : "created",
        recordId: existingRecord?.recordId ?? recordId,
        status: existingRecord?.status ?? plan.status,
      },
    };
  }

  if (existingSession) {
    existingSession.set({
      classId: plan.classId,
      teacherId,
      scheduleId: plan.schedule.scheduleId,
      className: plan.schedule.className,
      subject: plan.schedule.subject,
      branch: plan.schedule.branch,
      room: plan.schedule.room,
      date: plan.date,
      startTime: plan.startTime,
      academicYear: period.academicYear,
      semester: period.semester,
      status: "closed",
      qrToken: null,
    });
    await existingSession.save();
  } else {
    await AttendanceSession.create({
      sessionId,
      classId: plan.classId,
      teacherId,
      scheduleId: plan.schedule.scheduleId,
      className: plan.schedule.className,
      subject: plan.schedule.subject,
      branch: plan.schedule.branch,
      room: plan.schedule.room,
      date: plan.date,
      startTime: plan.startTime,
      academicYear: period.academicYear,
      semester: period.semester,
      status: "closed",
      qrToken: null,
    });
  }

  const canUpdateRecord =
    !existingRecord ||
    existingRecord.note.includes("[utbk-demo-attendance]") ||
    existingRecord.status === "Belum Absen";

  if (canUpdateRecord) {
    await AttendanceRecord.findOneAndUpdate(
      {
        sessionId: resolvedSessionId,
        studentId: student.studentId,
      },
      {
        $set: {
          recordId: existingRecord?.recordId ?? recordId,
          sessionId: resolvedSessionId,
          studentId: student.studentId,
          studentObjectId: student._id,
          subscriptionId,
          name: studentName,
          status: plan.status,
          note: plan.note,
          markedBy: "teacher",
          markedAt: buildMarkedAt(plan.date, plan.startTime, 5 + plan.index * 3),
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

  return {
    session: {
      action: existingSession ? "updated" : "created",
      sessionId: resolvedSessionId,
      subject: plan.schedule.subject,
      date: plan.date,
      startTime: plan.startTime,
    },
    record: {
      action: canUpdateRecord
        ? existingRecord
          ? "updated"
          : "created"
        : "skipped",
      recordId: existingRecord?.recordId ?? recordId,
      status: canUpdateRecord ? plan.status : existingRecord?.status,
    },
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
              : "Tidak ada siswa UTBK aktif untuk data absensi demo.",
          },
          null,
          2,
        ),
      );
      return;
    }

    const studentName = await getStudentName(student);
    const { subscription, plans } = await buildAttendancePlan(student, options);
    const results = [];

    for (const plan of plans) {
      results.push(
        await upsertAttendanceRecord({
          plan,
          student,
          studentName,
          subscriptionId: subscription?._id ?? null,
          options,
        }),
      );
    }

    console.log(
      JSON.stringify(
        {
          mode: options.apply ? "apply" : "dry-run",
          targetStudent: {
            studentId: student.studentId,
            name: studentName,
            branch: student.branch,
            program: student.program,
            className: student.className,
            utbkTrack: student.utbkTrack ?? "",
          },
          attendanceCount: results.length,
          attendance: results,
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
