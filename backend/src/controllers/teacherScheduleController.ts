import type { NextFunction, Request, Response } from "express";
import type { FilterQuery } from "mongoose";

import {
  AttendanceRecord,
  type AttendanceRecordStatus,
} from "../models/AttendanceRecord";
import {
  AttendanceSession,
  type AttendanceSessionStatus,
} from "../models/AttendanceSession";
import { Schedule, type ISchedule } from "../models/Schedule";
import { Student, type IStudent } from "../models/Student";
import { Subscription } from "../models/Subscription";
import { Teacher } from "../models/Teacher";
import { TeacherClassSetting } from "../models/TeacherClassSetting";
import { ClassTask } from "../models/ClassTask";
import { TaskGrade } from "../models/TaskGrade";
import { TaskSubmission } from "../models/TaskSubmission";
import { User } from "../models/User";
import type {
  PublicClassMaterial,
  PublicClassTask,
} from "../utils/classroomLearning";
import asyncHandler from "../utils/asyncHandler";
import { AppError, sendSuccess } from "../utils/apiResponse";
import { resolveAcademicPeriodFromQuery } from "../utils/academicGrade";
import {
  buildTeacherAcademicPeriodOrLegacyFilter,
  type TeacherAcademicPeriodFilters,
} from "../utils/teacherAcademicPeriod";
import {
  getTeacherClassMaterials,
  getTeacherClassTasks,
  toPublicClassMaterial,
  toPublicClassTask,
} from "../utils/classroomLearning";
import {
  buildSchedulePresentation,
  type ScheduleWithTeacher,
} from "../utils/scheduleConflicts";
import { normalizeCanonicalClassName } from "../utils/studentClass";
import {
  getStudentEffectiveAcademicJoinedAt,
  isAttendanceSessionOnOrAfterAcademicJoin,
  parseValidDate,
} from "../utils/studentAcademicStatus";
import {
  buildAcademicRecordSubscriptionFilter,
  findActiveSubscriptionIdsForAcademicRecords,
} from "../utils/subscription";
import {
  getUtbkScheduleClassNames,
  isUtbkScheduleClassName,
  isUtbkStudent,
  matchesUtbkScheduleClassName,
  normalizeUtbkScheduleClassName,
} from "../utils/studentProgram";

type TeacherOwnedSchedule = Pick<
  ISchedule,
  | "scheduleId"
  | "day"
  | "time"
  | "className"
  | "branch"
  | "subject"
  | "room"
  | "status"
>;

type StudentClassLookup = Pick<
  IStudent,
  "branch" | "className" | "program" | "utbkTrack"
> & {
  _id?: unknown;
};

type TeacherClassStatus = "Aktif" | "Berjalan";

type TeacherClassNextSchedule = {
  id: string;
  day: string;
  time: string;
  room: string;
  subject: string;
  status: ISchedule["status"];
};

type TeacherClassItem = {
  id: string;
  className: string;
  level: string;
  subject: string;
  branch: string;
  room: string;
  studentCount: number;
  scheduleCount: number;
  completedMeetingCount?: number;
  targetMeetingCount?: number;
  pendingTaskCount?: number;
  overdueTaskCount?: number;
  nextSchedule: TeacherClassNextSchedule | null;
  status: TeacherClassStatus;
};

type TeacherClassScheduleItem = {
  id: string;
  scheduleId: string;
  day: string;
  time: string;
  room: string;
  subject: string;
  status: ISchedule["status"];
};

type TeacherClassParticipantItem = {
  id: string;
  studentId: string;
  studentObjectId?: string | null;
  name: string;
  email: string;
  phone: string;
  className: string;
  level: string;
  branch: string;
  status: IStudent["status"];
  academicJoinedAt: string | null;
  history: TeacherClassParticipantHistoryItem[];
};

type TeacherClassParticipantHistoryItem = {
  sessionId: string;
  meetingNumber: number;
  meetingLabel: string;
  date: string;
  startTime: string;
  subject: string;
  room: string;
  status: AttendanceRecordStatus;
  note: string;
  markedAt: string | null;
};

type TeacherClassAttendanceSessionSummary = {
  hadir: number;
  sakit: number;
  izin: number;
  alpa: number;
  belumAbsen: number;
};

type TeacherClassAttendanceSessionItem = {
  sessionId: string;
  meetingNumber: number;
  meetingLabel: string;
  date: string;
  startTime: string;
  subject: string;
  room: string;
  status: AttendanceSessionStatus;
  summary: TeacherClassAttendanceSessionSummary;
};

type TeacherClassContext = {
  teacherId: string;
  subject: string;
  branch: string;
};

type TeacherDocumentLike = NonNullable<
  Awaited<ReturnType<typeof getTeacherByUserId>>
>;

type TeacherClassGroup = {
  item: TeacherClassItem;
  className: string;
  branch: string;
  schedules: TeacherOwnedSchedule[];
};

type StudentParticipantLookup = {
  _id?: unknown;
  studentId?: string;
  phone?: string;
  branch?: string;
  className?: string;
  program?: string;
  utbkTrack?: string;
  nama?: string | null;
  name?: string | null;
  fullName?: string | null;
  studentName?: string | null;
  status?: IStudent["status"];
  academicJoinedAt?: Date | string | null;
  userId?: {
    _id?: unknown;
    nama?: string | null;
    email?: string | null;
  } | null;
};

export type TeacherClassDetailContext = {
  teacher: TeacherDocumentLike;
  classGroup: TeacherClassGroup;
  participants: TeacherClassParticipantItem[];
  schedules: TeacherClassScheduleItem[];
  attendanceSessions: TeacherClassAttendanceSessionItem[];
  materials: PublicClassMaterial[];
  tasks: PublicClassTask[];
};

const DAY_ORDER = [
  "senin",
  "selasa",
  "rabu",
  "kamis",
  "jumat",
  "sabtu",
  "minggu",
] as const;
const DEFAULT_MONTHLY_MEETINGS_PER_SCHEDULE = 4;

function normalizeText(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function resolveTeacherAcademicPeriodFilters(query?: {
  academicYear?: unknown;
  semester?: unknown;
}): TeacherAcademicPeriodFilters {
  const period = resolveAcademicPeriodFromQuery(query);

  return {
    academicYear: period.academicYear,
    semester: period.semester,
  };
}

function buildAcademicPeriodOrLegacyFilter(filters?: TeacherAcademicPeriodFilters) {
  return buildTeacherAcademicPeriodOrLegacyFilter(filters);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function slugify(value: string): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildStableClassId(
  teacherPublicId: string,
  branch: string,
  className: string,
): string {
  const teacherSlug = slugify(teacherPublicId) || "guru";
  const branchSlug = slugify(branch) || "cabang";
  const classSlug = slugify(className) || "kelas";

  return `class-${teacherSlug}-${branchSlug}-${classSlug}`;
}

function extractGrade(value: string): string | null {
  const normalizedValue = normalizeText(value).toUpperCase();
  const numericMatch = normalizedValue.match(
    /(^|[^0-9])(4|5|6|7|8|9|10|11|12)(?![0-9])/,
  );

  return numericMatch?.[2] ?? null;
}

function getClassLevel(className: string): string {
  const utbkClassName = normalizeUtbkScheduleClassName(className);

  if (utbkClassName) {
    return utbkClassName === "UTBK"
      ? "Program UTBK"
      : utbkClassName.replace(/^UTBK\s+/i, "");
  }

  const grade = extractGrade(className);
  return grade ? `Kelas ${grade}` : "Kelas belum diatur";
}

function toDayKey(value: string | null | undefined) {
  const normalizedValue = normalizeText(value).toLowerCase();
  const matchedDay = DAY_ORDER.find((dayKey) => dayKey === normalizedValue);

  return matchedDay ?? null;
}

function parseStartMinutes(time: string): number | null {
  const [startTime = ""] = normalizeText(time).split("-");
  const normalizedStartTime = startTime.replace(/\./g, ":");
  const matchedTime = normalizedStartTime.match(/(\d{1,2})\s*:\s*(\d{2})/);

  if (!matchedTime) {
    return null;
  }

  const hours = Number(matchedTime[1] ?? "0");
  const minutes = Number(matchedTime[2] ?? "0");

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

async function filterStudentsWithActiveOrLegacySubscription<
  T extends { _id?: unknown },
>(students: T[]) {
  const studentObjectIds = students
    .map((student) => toRecordId(student._id))
    .filter(Boolean);

  if (studentObjectIds.length === 0) {
    return students;
  }

  const subscriptions = await Subscription.find({
    studentId: {
      $in: studentObjectIds,
    },
    paymentStatus: "paid",
  })
    .select("studentId startDate endDate")
    .lean()
    .exec();
  const now = Date.now();
  const paidStudentIds = new Set<string>();
  const activeStudentIds = new Set<string>();

  for (const subscription of subscriptions) {
    const studentObjectId = toRecordId(subscription.studentId);

    if (!studentObjectId) {
      continue;
    }

    paidStudentIds.add(studentObjectId);

    const startAt = parseValidDate(subscription.startDate);
    const endAt = parseValidDate(subscription.endDate);

    if (
      startAt &&
      endAt &&
      startAt.getTime() <= now &&
      endAt.getTime() > now
    ) {
      activeStudentIds.add(studentObjectId);
    }
  }

  return students.filter((student) => {
    const studentObjectId = toRecordId(student._id);

    if (!studentObjectId) {
      return true;
    }

    return !paidStudentIds.has(studentObjectId) || activeStudentIds.has(studentObjectId);
  });
}

function getCurrentJakartaDayKey() {
  return toDayKey(
    new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      timeZone: "Asia/Jakarta",
    }).format(new Date()),
  );
}

function getCurrentJakartaDateKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Jakarta",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

function getCurrentJakartaMinutes(): number | null {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");

  if (
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return hour * 60 + minute;
}

function getUpcomingRank(schedule: Pick<TeacherOwnedSchedule, "day" | "time">) {
  const dayKey = toDayKey(schedule.day);
  const startMinutes = parseStartMinutes(schedule.time);

  if (!dayKey || startMinutes === null) {
    return {
      dayOffset: Number.MAX_SAFE_INTEGER,
      startMinutes: Number.MAX_SAFE_INTEGER,
    };
  }

  const currentDayKey = getCurrentJakartaDayKey();
  const currentMinutes = getCurrentJakartaMinutes();

  if (!currentDayKey || currentMinutes === null) {
    return {
      dayOffset: DAY_ORDER.indexOf(dayKey),
      startMinutes,
    };
  }

  const currentDayIndex = DAY_ORDER.indexOf(currentDayKey);
  const scheduleDayIndex = DAY_ORDER.indexOf(dayKey);
  let dayOffset = scheduleDayIndex - currentDayIndex;

  if (dayOffset < 0) {
    dayOffset += DAY_ORDER.length;
  }

  if (dayOffset === 0 && startMinutes < currentMinutes) {
    dayOffset = DAY_ORDER.length;
  }

  return {
    dayOffset,
    startMinutes,
  };
}

function sortSchedulesByUpcoming(schedules: TeacherOwnedSchedule[]) {
  return [...schedules].sort((left, right) => {
    const leftRank = getUpcomingRank(left);
    const rightRank = getUpcomingRank(right);

    if (leftRank.dayOffset !== rightRank.dayOffset) {
      return leftRank.dayOffset - rightRank.dayOffset;
    }

    if (leftRank.startMinutes !== rightRank.startMinutes) {
      return leftRank.startMinutes - rightRank.startMinutes;
    }

    return left.scheduleId.localeCompare(right.scheduleId, "id-ID");
  });
}

function buildStudentCountKey(branch: string, className: string): string {
  return `${branch.toLowerCase()}::${className.toLowerCase()}`;
}

function matchesTeacherClassName(
  studentClassName: string,
  className: string,
  canonicalClassName: string | null,
): boolean {
  if (!studentClassName) {
    return false;
  }

  if (studentClassName.toLowerCase() === className.toLowerCase()) {
    return true;
  }

  if (!canonicalClassName) {
    return false;
  }

  const studentCanonical = normalizeCanonicalClassName(studentClassName);
  
  if (!studentCanonical || studentCanonical.toLowerCase() !== canonicalClassName.toLowerCase()) {
    return false;
  }

  // Canonical level matches (e.g., both are "SMP 9").
  // Now verify that their subclass modifiers (e.g., "A", "B") match.
  const extractModifier = (name: string) => {
    const match = name.match(/(?:^|\s)(?:1[0-2]|[2-9])\s*([A-Za-z]+)\b/);
    return match?.[1]?.toUpperCase() ?? "";
  };

  const studentModifier = extractModifier(studentClassName);
  const teacherModifier = extractModifier(className);

  return studentModifier === teacherModifier;
}

function getStudentCountFromMaps(
  className: string,
  branch: string,
  studentCountMaps: ReturnType<typeof buildStudentCountMaps>,
): number | null {
  const exactKey = buildStudentCountKey(branch, className);
  const exactCount = studentCountMaps.exactCountMap.get(exactKey);

  if (typeof exactCount === "number") {
    return exactCount;
  }

  return null;
}

function filterParticipantMatchesByBranch(
  students: StudentParticipantLookup[],
  branch: string,
) {
  const normalizedBranch = normalizeText(branch).toLowerCase();

  if (!normalizedBranch) {
    return [];
  }

  return students.filter(
    (student) =>
      normalizeText(student.branch).toLowerCase() === normalizedBranch,
  );
}

function toRecordId(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (
    value &&
    typeof value === "object" &&
    "toString" in value &&
    typeof value.toString === "function"
  ) {
    return value.toString();
  }

  return "";
}

function resolveParticipantName(student: StudentParticipantLookup) {
  const resolvedName = [
    normalizeText(student.userId?.nama),
    normalizeText(student.nama),
    normalizeText(student.name),
    normalizeText(student.fullName),
    normalizeText(student.studentName),
  ].find(Boolean);

  return resolvedName || "Nama siswa belum diatur";
}

function buildAttendanceSummary(
  records: Array<{ status?: AttendanceRecordStatus | null }>,
): TeacherClassAttendanceSessionSummary {
  return records.reduce<TeacherClassAttendanceSessionSummary>(
    (summary, record) => {
      switch (record.status) {
        case "Hadir":
          summary.hadir += 1;
          break;
        case "Sakit":
          summary.sakit += 1;
          break;
        case "Izin":
          summary.izin += 1;
          break;
        case "Alpa":
          summary.alpa += 1;
          break;
        default:
          summary.belumAbsen += 1;
          break;
      }

      return summary;
    },
    {
      hadir: 0,
      sakit: 0,
      izin: 0,
      alpa: 0,
      belumAbsen: 0,
    },
  );
}

async function getTeacherClassAttendanceData(
  teacherId: string,
  classId: string,
  subscriptionIds: Awaited<ReturnType<typeof findActiveSubscriptionIdsForAcademicRecords>> = [],
  participants: Array<{ studentId: string; academicJoinedAt?: string | null }> = [],
  filters?: TeacherAcademicPeriodFilters,
) {
  const sessions = await AttendanceSession.find({
    $and: [
      {
        teacherId,
        classId,
      },
      buildAcademicPeriodOrLegacyFilter(filters),
    ],
  })
    .select("sessionId date startTime subject room status createdAt")
    .sort({ date: 1, startTime: 1, createdAt: 1 })
    .lean()
    .exec();
  const normalizedSessionIds = sessions
    .map((session) => normalizeText(session.sessionId))
    .filter(Boolean);

  if (normalizedSessionIds.length === 0) {
    return {
      attendanceSessions: [] as TeacherClassAttendanceSessionItem[],
      historyByStudentId: new Map<string, TeacherClassParticipantHistoryItem[]>(),
    };
  }

  const sessionById = new Map(
    sessions.map((session) => [normalizeText(session.sessionId), session] as const),
  );
  const participantAcademicStartByStudentId = new Map(
    participants
      .map((participant) => [
        normalizeText(participant.studentId).toLowerCase(),
        parseValidDate(participant.academicJoinedAt),
      ] as const)
      .filter(([studentId, academicJoinedAt]) => Boolean(studentId && academicJoinedAt)),
  );
  const rawRecords = await AttendanceRecord.find({
    sessionId: {
      $in: normalizedSessionIds,
    },
    ...buildAcademicRecordSubscriptionFilter(subscriptionIds),
  })
    .select("sessionId studentId status note markedAt")
    .sort({ createdAt: 1, name: 1 })
    .lean()
    .exec();
  const records = rawRecords.filter((record) => {
    const normalizedSessionId = normalizeText(record.sessionId);
    const normalizedStudentId = normalizeText(record.studentId).toLowerCase();
    const session = sessionById.get(normalizedSessionId);
    const academicJoinedAt =
      participantAcademicStartByStudentId.get(normalizedStudentId) ?? null;

    return Boolean(
      session &&
        (!academicJoinedAt ||
          isAttendanceSessionOnOrAfterAcademicJoin(session, academicJoinedAt)),
    );
  });
  const recordsBySessionId = new Map<
    string,
    Array<{
      sessionId?: string;
      studentId?: string;
      status?: AttendanceRecordStatus;
      note?: string;
      markedAt?: Date | null;
    }>
  >();

  for (const record of records) {
    const normalizedSessionId = normalizeText(record.sessionId);

    if (!normalizedSessionId) {
      continue;
    }

    const sessionRecords = recordsBySessionId.get(normalizedSessionId) ?? [];
    sessionRecords.push(record);
    recordsBySessionId.set(normalizedSessionId, sessionRecords);
  }

  const historyByStudentId = new Map<string, TeacherClassParticipantHistoryItem[]>();
  const attendanceSessions = sessions.map((session, index) => {
    const normalizedSessionId = normalizeText(session.sessionId);
    const meetingNumber = index + 1;
    const meetingLabel = `Pertemuan ${meetingNumber}`;
    const sessionRecords = recordsBySessionId.get(normalizedSessionId) ?? [];

    for (const record of sessionRecords) {
      const normalizedStudentId = normalizeText(record.studentId).toLowerCase();

      if (!normalizedStudentId) {
        continue;
      }

      const historyEntry: TeacherClassParticipantHistoryItem = {
        sessionId: normalizedSessionId,
        meetingNumber,
        meetingLabel,
        date: normalizeText(session.date),
        startTime: normalizeText(session.startTime),
        subject: normalizeText(session.subject) || "Mapel belum diatur",
        room: normalizeText(session.room) || "Ruangan belum diatur",
        status: record.status ?? "Belum Absen",
        note: normalizeText(record.note),
        markedAt: record.markedAt?.toISOString() ?? null,
      };
      const existingEntries = historyByStudentId.get(normalizedStudentId) ?? [];

      existingEntries.push(historyEntry);
      historyByStudentId.set(normalizedStudentId, existingEntries);
    }

    return {
      sessionId: normalizedSessionId,
      meetingNumber,
      meetingLabel,
      date: normalizeText(session.date),
      startTime: normalizeText(session.startTime),
      subject: normalizeText(session.subject) || "Mapel belum diatur",
      room: normalizeText(session.room) || "Ruangan belum diatur",
      status: session.status ?? "closed",
      summary: buildAttendanceSummary(sessionRecords),
    } satisfies TeacherClassAttendanceSessionItem;
  });

  return {
    attendanceSessions,
    historyByStudentId,
  };
}

async function getCompletedMeetingCountMap(
  teacherId: string,
  classIds: string[],
  filters?: TeacherAcademicPeriodFilters,
) {
  const normalizedClassIds = classIds.map((classId) => normalizeText(classId)).filter(Boolean);

  if (normalizedClassIds.length === 0) {
    return new Map<string, number>();
  }

  const closedSessions = await AttendanceSession.find({
    $and: [
      {
        teacherId,
        classId: {
          $in: normalizedClassIds,
        },
        status: "closed",
      },
      buildAcademicPeriodOrLegacyFilter(filters),
    ],
  })
    .select("classId")
    .lean()
    .exec();
  const completedMeetingCountMap = new Map<string, number>();

  for (const session of closedSessions) {
    const classId = normalizeText(session.classId);

    if (!classId) {
      continue;
    }

    completedMeetingCountMap.set(
      classId,
      (completedMeetingCountMap.get(classId) ?? 0) + 1,
    );
  }

  return completedMeetingCountMap;
}

async function getTargetMeetingCountMap(
  teacherId: string,
  classIds: string[],
) {
  const normalizedClassIds = classIds.map((classId) => normalizeText(classId)).filter(Boolean);

  if (normalizedClassIds.length === 0) {
    return new Map<string, number>();
  }

  const settings = await TeacherClassSetting.find({
    teacherId,
    classId: {
      $in: normalizedClassIds,
    },
  })
    .select("classId targetMeetingCount")
    .lean()
    .exec();
  const targetMeetingCountMap = new Map<string, number>();

  for (const setting of settings) {
    const classId = normalizeText(setting.classId);

    if (!classId) {
      continue;
    }

    targetMeetingCountMap.set(
      classId,
      Math.max(Number(setting.targetMeetingCount) || 0, 0),
    );
  }

  return targetMeetingCountMap;
}

async function getPendingTaskCountMap(
  teacherId: string,
  classIds: string[],
  filters?: TeacherAcademicPeriodFilters,
) {
  const normalizedClassIds = classIds
    .map((classId) => normalizeText(classId))
    .filter(Boolean);

  if (normalizedClassIds.length === 0) {
    return new Map<string, number>();
  }

  const tasks = await ClassTask.find({
    $and: [
      {
        teacherId,
        classId: {
          $in: normalizedClassIds,
        },
      },
      buildAcademicPeriodOrLegacyFilter(filters),
    ],
  })
    .select("taskId classId")
    .lean()
    .exec();
  const pendingTaskCountMap = new Map<string, number>();

  if (tasks.length === 0) {
    return pendingTaskCountMap;
  }

  const taskIds = tasks.map((task) => task.taskId);
  const [submissions, grades] = await Promise.all([
    TaskSubmission.find({
      teacherId,
      taskId: { $in: taskIds },
    })
      .select("taskId studentId")
      .lean()
      .exec(),
    TaskGrade.find({
      teacherId,
      taskId: { $in: taskIds },
      status: "Sudah Dinilai",
    })
      .select("taskId studentId")
      .lean()
      .exec(),
  ]);
  const submittedStudentsByTaskId = new Map<string, Set<string>>();
  const gradedStudentsByTaskId = new Map<string, Set<string>>();

  for (const submission of submissions) {
    const taskId = normalizeText(submission.taskId);
    const studentId = normalizeText(submission.studentId).toLowerCase();

    if (!taskId || !studentId) {
      continue;
    }

    const studentIds = submittedStudentsByTaskId.get(taskId) ?? new Set<string>();
    studentIds.add(studentId);
    submittedStudentsByTaskId.set(taskId, studentIds);
  }

  for (const grade of grades) {
    const taskId = normalizeText(grade.taskId);
    const studentId = normalizeText(grade.studentId).toLowerCase();

    if (!taskId || !studentId) {
      continue;
    }

    const studentIds = gradedStudentsByTaskId.get(taskId) ?? new Set<string>();
    studentIds.add(studentId);
    gradedStudentsByTaskId.set(taskId, studentIds);
  }

  for (const task of tasks) {
    const classId = normalizeText(task.classId);
    const taskId = normalizeText(task.taskId);
    const submittedStudents = submittedStudentsByTaskId.get(taskId) ?? new Set<string>();
    const gradedStudents = gradedStudentsByTaskId.get(taskId) ?? new Set<string>();
    const hasUngradedSubmission = Array.from(submittedStudents).some(
      (studentId) => !gradedStudents.has(studentId),
    );

    if (!classId || !taskId || !hasUngradedSubmission) {
      continue;
    }

    pendingTaskCountMap.set(
      classId,
      (pendingTaskCountMap.get(classId) ?? 0) + 1,
    );
  }

  return pendingTaskCountMap;
}

async function getOverdueTaskCountMap(
  teacherId: string,
  classIds: string[],
  filters?: TeacherAcademicPeriodFilters,
) {
  const normalizedClassIds = classIds
    .map((classId) => normalizeText(classId))
    .filter(Boolean);

  if (normalizedClassIds.length === 0) {
    return new Map<string, number>();
  }

  const overdueTasks = await ClassTask.find({
    $and: [
      {
        teacherId,
        classId: {
          $in: normalizedClassIds,
        },
        reviewStatus: "Belum Ada Pengumpulan",
        deadline: {
          $lt: getCurrentJakartaDateKey(),
        },
      },
      buildAcademicPeriodOrLegacyFilter(filters),
    ],
  })
    .select("classId")
    .lean()
    .exec();
  const overdueTaskCountMap = new Map<string, number>();

  for (const task of overdueTasks) {
    const classId = normalizeText(task.classId);

    if (!classId) {
      continue;
    }

    overdueTaskCountMap.set(
      classId,
      (overdueTaskCountMap.get(classId) ?? 0) + 1,
    );
  }

  return overdueTaskCountMap;
}

function resolveTargetMeetingCount(
  storedTargetMeetingCount: number | undefined,
  scheduleCount: number,
) {
  if (
    typeof storedTargetMeetingCount === "number" &&
    Number.isFinite(storedTargetMeetingCount) &&
    storedTargetMeetingCount > 0
  ) {
    return storedTargetMeetingCount;
  }

  if (scheduleCount <= 0) {
    return 0;
  }

  return scheduleCount * DEFAULT_MONTHLY_MEETINGS_PER_SCHEDULE;
}

function buildStudentCountMaps(students: StudentClassLookup[]) {
  const exactCountMap = new Map<string, number>();
  const canonicalCountMap = new Map<string, number>();

  const extractModifier = (name: string) => {
    const match = name.match(/(?:^|\s)(?:1[0-2]|[2-9])\s*([A-Za-z]+)\b/);
    return match?.[1]?.toUpperCase() ?? "";
  };

  for (const student of students) {
    const branch = normalizeText(student.branch);
    const classNames = isUtbkStudent(student)
      ? getUtbkScheduleClassNames(student)
      : [normalizeText(student.className)].filter(Boolean);

    if (classNames.length === 0) {
      continue;
    }

    for (const className of classNames) {
      const exactKey = buildStudentCountKey(branch, className);
      exactCountMap.set(exactKey, (exactCountMap.get(exactKey) ?? 0) + 1);

      if (isUtbkScheduleClassName(className)) {
        continue;
      }

      const canonicalClassName = normalizeCanonicalClassName(className);

      if (!canonicalClassName) {
        continue;
      }

      const modifier = extractModifier(className);
      const canonicalKey = `${buildStudentCountKey(branch, canonicalClassName)}::${modifier}`;
      canonicalCountMap.set(canonicalKey, (canonicalCountMap.get(canonicalKey) ?? 0) + 1);
    }
  }

  return {
    exactCountMap,
    canonicalCountMap,
  };
}

function resolveStudentCount(
  className: string,
  branch: string,
  studentCountMaps: ReturnType<typeof buildStudentCountMaps>,
): number {
  const normalizedClassName = normalizeText(className);
  const normalizedBranch = normalizeText(branch);
  const exactCount = getStudentCountFromMaps(
    normalizedClassName,
    normalizedBranch,
    studentCountMaps,
  );

  if (typeof exactCount === "number") {
    return exactCount;
  }

  if (isUtbkScheduleClassName(normalizedClassName)) {
    return 0;
  }

  const canonicalClassName = normalizeCanonicalClassName(normalizedClassName);

  if (!canonicalClassName) {
    return 0;
  }

  const extractModifier = (name: string) => {
    const match = name.match(/(?:^|\s)(?:1[0-2]|[2-9])\s*([A-Za-z]+)\b/);
    return match?.[1]?.toUpperCase() ?? "";
  };
  
  const modifier = extractModifier(normalizedClassName);
  const canonicalKey = `${buildStudentCountKey(normalizedBranch, canonicalClassName)}::${modifier}`;
  
  const canonicalCount =
    studentCountMaps.canonicalCountMap.get(canonicalKey) ?? null;

  if (typeof canonicalCount === "number") {
    return canonicalCount;
  }

  return 0;
}

function buildTeacherClassItem(
  teacher: TeacherClassContext,
  branch: string,
  classSchedules: TeacherOwnedSchedule[],
  studentCountMaps: ReturnType<typeof buildStudentCountMaps>,
): TeacherClassItem {
  const [firstSchedule] = classSchedules;
  const className = normalizeText(firstSchedule?.className);
  const normalizedBranch = normalizeText(branch) || normalizeText(teacher.branch);
  const sortedSchedules = sortSchedulesByUpcoming(classSchedules);
  const nextScheduleDocument = sortedSchedules[0] ?? null;
  const nextSchedule = nextScheduleDocument
    ? {
        id: nextScheduleDocument.scheduleId,
        day: normalizeText(nextScheduleDocument.day),
        time: normalizeText(nextScheduleDocument.time),
        room: normalizeText(nextScheduleDocument.room) || "Ruangan belum diatur",
        subject:
          normalizeText(nextScheduleDocument.subject) ||
          normalizeText(teacher.subject) ||
          "Mapel belum diatur",
        status: nextScheduleDocument.status,
      }
    : null;
  const firstSubject =
    sortedSchedules.find((schedule) => normalizeText(schedule.subject))?.subject ??
    teacher.subject;

  return {
    id: buildStableClassId(teacher.teacherId, normalizedBranch, className),
    className,
    level: getClassLevel(className),
    subject: normalizeText(nextSchedule?.subject ?? firstSubject) || "Mapel belum diatur",
    branch: normalizedBranch || "-",
    room:
      normalizeText(nextSchedule?.room) ||
      normalizeText(firstSchedule?.room) ||
      "Ruangan belum diatur",
    studentCount: resolveStudentCount(className, normalizedBranch, studentCountMaps),
    scheduleCount: classSchedules.length,
    nextSchedule,
    status: classSchedules.some((schedule) => schedule.status === "Berjalan")
      ? "Berjalan"
      : "Aktif",
  };
}

function buildTeacherClassGroups(
  teacher: TeacherClassContext,
  ownedSchedules: TeacherOwnedSchedule[],
  studentCountMaps: ReturnType<typeof buildStudentCountMaps>,
) {
  const classesByKey = new Map<string, TeacherOwnedSchedule[]>();
  const fallbackBranch = normalizeText(teacher.branch);

  for (const schedule of ownedSchedules) {
    const className = normalizeText(schedule.className);
    const branch = normalizeText(schedule.branch) || fallbackBranch;

    if (!className) {
      continue;
    }

    const groupingKey = buildStudentCountKey(branch, className);
    classesByKey.set(groupingKey, [
      ...(classesByKey.get(groupingKey) ?? []),
      schedule,
    ]);
  }

  return Array.from(classesByKey.values())
    .map((classSchedules) => {
      const [firstSchedule] = classSchedules;
      const className = normalizeText(firstSchedule?.className);
      const branch = normalizeText(firstSchedule?.branch) || fallbackBranch;
      const sortedSchedules = sortSchedulesByUpcoming(classSchedules);

      return {
        item: buildTeacherClassItem(teacher, branch, classSchedules, studentCountMaps),
        className,
        branch,
        schedules: sortedSchedules,
      } satisfies TeacherClassGroup;
    })
    .sort((left, right) => {
      const leftOffset = left.item.nextSchedule
        ? getUpcomingRank({
            day: left.item.nextSchedule.day,
            time: left.item.nextSchedule.time,
          }).dayOffset
        : Number.MAX_SAFE_INTEGER;
      const rightOffset = right.item.nextSchedule
        ? getUpcomingRank({
            day: right.item.nextSchedule.day,
            time: right.item.nextSchedule.time,
          }).dayOffset
        : Number.MAX_SAFE_INTEGER;

      if (leftOffset !== rightOffset) {
        return leftOffset - rightOffset;
      }

      return left.item.className.localeCompare(right.item.className, "id-ID");
    });
}

function buildTeacherClassScheduleItem(
  schedule: TeacherOwnedSchedule,
  teacher: TeacherClassContext,
): TeacherClassScheduleItem {
  return {
    id: schedule.scheduleId,
    scheduleId: schedule.scheduleId,
    day: normalizeText(schedule.day),
    time: normalizeText(schedule.time),
    room: normalizeText(schedule.room) || "Ruangan belum diatur",
    subject: normalizeText(schedule.subject) || normalizeText(teacher.subject) || "Mapel belum diatur",
    status: schedule.status,
  };
}

async function getTeacherClassParticipants(
  className: string,
  branch: string,
) {
  const normalizedClassName = normalizeText(className);
  const normalizedBranch = normalizeText(branch);
  const canonicalClassName = normalizeCanonicalClassName(normalizedClassName);
  const isUtbkClass = isUtbkScheduleClassName(normalizedClassName);

  if (!normalizedBranch) {
    return [];
  }

  const students = (await Student.find({
    status: "Aktif",
    branch: new RegExp(`^${escapeRegex(normalizedBranch)}$`, "i"),
  })
    .select(
      "studentId phone branch className program utbkTrack status academicJoinedAt userId nama name fullName studentName",
    )
    .populate({
      path: "userId",
      model: User,
      select: "nama email",
    })
    .lean()
    .exec()) as StudentParticipantLookup[];

  const matchedByClassName = students.filter((student) =>
    isUtbkClass
      ? matchesUtbkScheduleClassName(normalizedClassName, student)
      : !isUtbkStudent(student) &&
        matchesTeacherClassName(
          normalizeText(student.className),
          normalizedClassName,
          canonicalClassName,
        ),
  );
  const resolvedStudents = filterParticipantMatchesByBranch(
    matchedByClassName,
    normalizedBranch,
  );
  const studentObjectIds = resolvedStudents
    .map((student) => toRecordId(student._id))
    .filter(Boolean);
  const paidSubscriptions = studentObjectIds.length
    ? await Subscription.find({
        studentId: {
          $in: studentObjectIds,
        },
        paymentStatus: "paid",
        startDate: {
          $ne: null,
        },
      })
        .select("_id studentId startDate endDate paymentStatus")
        .sort({ startDate: 1, createdAt: 1 })
        .lean()
        .exec()
    : [];
  const now = Date.now();
  const fallbackPaidSubscriptionByStudentObjectId = new Map<
    string,
    { startDate?: Date | string | null; paymentStatus?: string | null }
  >();
  const paidSubscriptionByStudentObjectId = new Map<
    string,
    { startDate?: Date | string | null; paymentStatus?: string | null }
  >();

  for (const subscription of paidSubscriptions) {
    const studentObjectId = toRecordId(subscription.studentId);

    if (!studentObjectId) {
      continue;
    }

    if (!fallbackPaidSubscriptionByStudentObjectId.has(studentObjectId)) {
      fallbackPaidSubscriptionByStudentObjectId.set(studentObjectId, subscription);
    }

    const startAt = parseValidDate(subscription.startDate);
    const endAt = parseValidDate(subscription.endDate);

    if (
      startAt &&
      endAt &&
      startAt.getTime() <= now &&
      endAt.getTime() > now &&
      !paidSubscriptionByStudentObjectId.has(studentObjectId)
    ) {
      paidSubscriptionByStudentObjectId.set(studentObjectId, subscription);
    }
  }

  const currentStudents = resolvedStudents.filter((student) => {
    const studentObjectId = toRecordId(student._id);

    if (!studentObjectId) {
      return true;
    }

    return (
      !fallbackPaidSubscriptionByStudentObjectId.has(studentObjectId) ||
      paidSubscriptionByStudentObjectId.has(studentObjectId)
    );
  });

  return currentStudents
    .map((student) => {
      const studentObjectId = toRecordId(student._id);
      const academicJoinedAt = getStudentEffectiveAcademicJoinedAt(
        student,
        paidSubscriptionByStudentObjectId.get(studentObjectId) ??
          fallbackPaidSubscriptionByStudentObjectId.get(studentObjectId),
      );

      return {
        id: studentObjectId || normalizeText(student.studentId),
        studentId: normalizeText(student.studentId) || studentObjectId,
        studentObjectId: studentObjectId || null,
        name: resolveParticipantName(student),
        email: normalizeText(student.userId?.email),
        phone: normalizeText(student.phone),
        className: isUtbkClass
          ? normalizeUtbkScheduleClassName(normalizedClassName) || normalizedClassName
          : normalizeText(student.className) || normalizedClassName,
        level: getClassLevel(
          isUtbkClass
            ? normalizeUtbkScheduleClassName(normalizedClassName) || normalizedClassName
            : normalizeText(student.className) || normalizedClassName,
        ),
        branch: normalizeText(student.branch) || normalizedBranch || "-",
        status: student.status ?? "Aktif",
        academicJoinedAt: academicJoinedAt?.toISOString() ?? null,
        history: [],
      } satisfies TeacherClassParticipantItem;
    })
    .sort((left, right) => left.name.localeCompare(right.name, "id-ID"));
}

async function getTeacherSchedules(filters?: { academicYear?: string; semester?: string }) {
  const query: FilterQuery<ISchedule> = buildAcademicPeriodOrLegacyFilter(filters);

  return (await Schedule.find(query)
    .populate<{
      teacherId: {
        teacherId: string;
        userId: {
          nama: string;
        };
      };
    }>({
      path: "teacherId",
      populate: {
        path: "userId",
        model: User,
      },
    })
    .sort({ createdAt: -1 })
    .lean()
    .exec()) as unknown as ScheduleWithTeacher[];
}

async function getTeacherOwnedSchedules(
  teacherId: string,
  filters?: { academicYear?: string; semester?: string },
) {
  const query: FilterQuery<ISchedule> = {
    $and: [
      { teacherId },
      buildAcademicPeriodOrLegacyFilter(filters),
    ],
  };

  return (await Schedule.find(query)
    .select("scheduleId day time className branch subject room status academicYear semester")
    .sort({ day: 1, time: 1, createdAt: 1 })
    .lean()
    .exec()) as TeacherOwnedSchedule[];
}

async function getTeacherByUserId(userId: string) {
  return Teacher.findOne({ userId, status: "Aktif" }).exec();
}

export async function resolveTeacherClassDetailContext(
  userId: string,
  classIdParam: string | string[] | undefined,
  filters?: { academicYear?: string; semester?: string },
): Promise<TeacherClassDetailContext> {
  const classId = normalizeText(
    Array.isArray(classIdParam) ? classIdParam[0] : classIdParam,
  );

  if (!classId) {
    throw new AppError(404, "Kelas guru tidak ditemukan.");
  }

  const teacher = await getTeacherByUserId(userId);

  if (!teacher) {
    throw new AppError(404, "Profil guru tidak ditemukan.");
  }

  const [ownedSchedules, students] = await Promise.all([
    getTeacherOwnedSchedules(teacher._id.toString(), filters),
    Student.find({ status: "Aktif" })
      .select("_id branch className program utbkTrack")
      .lean()
      .exec() as Promise<StudentClassLookup[]>,
  ]);
  const currentStudents = await filterStudentsWithActiveOrLegacySubscription(students);
  const studentCountMaps = buildStudentCountMaps(currentStudents);
  const classGroup = buildTeacherClassGroups(
    teacher,
    ownedSchedules,
    studentCountMaps,
  ).find((candidate) => candidate.item.id === classId);

  if (!classGroup) {
    throw new AppError(404, "Kelas guru tidak ditemukan.");
  }

  const targetMeetingCountMap = await getTargetMeetingCountMap(
    teacher._id.toString(),
    [classGroup.item.id],
  );
  const resolvedClassGroup = {
    ...classGroup,
    item: {
      ...classGroup.item,
      targetMeetingCount: resolveTargetMeetingCount(
        targetMeetingCountMap.get(classGroup.item.id),
        classGroup.item.scheduleCount,
      ),
    },
  } satisfies TeacherClassGroup;

  const participants = await getTeacherClassParticipants(
    resolvedClassGroup.className,
    resolvedClassGroup.branch,
  );
  const participantSubscriptionIds =
    await findActiveSubscriptionIdsForAcademicRecords({
      publicStudentIds: participants.map((participant) => participant.studentId),
    });
  const { attendanceSessions, historyByStudentId } =
    await getTeacherClassAttendanceData(
      teacher._id.toString(),
      resolvedClassGroup.item.id,
      participantSubscriptionIds,
      participants,
      filters,
    );
  const isUtbkClass = isUtbkScheduleClassName(resolvedClassGroup.className);
  const [materials, tasks] = await Promise.all([
    getTeacherClassMaterials(
      teacher._id.toString(),
      resolvedClassGroup.item.id,
      filters,
    ),
    isUtbkClass
      ? Promise.resolve([])
      : getTeacherClassTasks(
          teacher._id.toString(),
          resolvedClassGroup.item.id,
          filters,
          participantSubscriptionIds,
        ),
  ]);
  const participantsWithHistory = participants.map((participant) => {
    const academicJoinedAt = parseValidDate(participant.academicJoinedAt);
    const history =
      historyByStudentId.get(
        normalizeText(participant.studentId).toLowerCase(),
      ) ?? [];

    return {
      ...participant,
      history: academicJoinedAt
        ? history.filter((entry) =>
            isAttendanceSessionOnOrAfterAcademicJoin(
              { date: entry.date },
              academicJoinedAt,
            ),
          )
        : [],
    };
  });
  const schedules = resolvedClassGroup.schedules.map((schedule) =>
    buildTeacherClassScheduleItem(schedule, teacher),
  );

  return {
    teacher,
    classGroup: resolvedClassGroup,
    participants: participantsWithHistory,
    schedules,
    attendanceSessions,
    materials: materials.map(toPublicClassMaterial),
    tasks: isUtbkClass ? [] : tasks.map(toPublicClassTask),
  };
}

function filterSchedulesForTeacher(
  schedules: ReturnType<typeof buildSchedulePresentation>,
  teacher: NonNullable<Awaited<ReturnType<typeof getTeacherByUserId>>>,
) {
  return schedules.filter(
    (schedule) => schedule.teacherId === teacher.teacherId,
  );
}

export const getMyTeacherSchedules = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const teacher = await getTeacherByUserId(req.user._id.toString());

    if (!teacher) {
      next(new AppError(404, "Profil guru tidak ditemukan."));
      return;
    }

    const filters = resolveTeacherAcademicPeriodFilters(req.query);
    const schedules = await getTeacherSchedules(filters);

    sendSuccess(res, {
      data: {
        schedules: filterSchedulesForTeacher(
          buildSchedulePresentation(schedules),
          teacher,
        ),
      },
    });
  },
);

export const getMyTeacherClasses = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const teacher = await getTeacherByUserId(req.user._id.toString());

    if (!teacher) {
      next(new AppError(404, "Profil guru tidak ditemukan."));
      return;
    }

    const filters = resolveTeacherAcademicPeriodFilters(req.query);

    const [ownedSchedules, students] = await Promise.all([
      getTeacherOwnedSchedules(teacher._id.toString(), filters),
      Student.find({ status: "Aktif" })
        .select("_id branch className program utbkTrack")
        .lean()
        .exec() as Promise<StudentClassLookup[]>,
    ]);
    const currentStudents = await filterStudentsWithActiveOrLegacySubscription(students);
    const studentCountMaps = buildStudentCountMaps(currentStudents);
    const classGroups = buildTeacherClassGroups(
      teacher,
      ownedSchedules,
      studentCountMaps,
    );
    const classIds = classGroups.map((classGroup) => classGroup.item.id);
    const [
      targetMeetingCountMap,
      completedMeetingCountMap,
      pendingTaskCountMap,
      overdueTaskCountMap,
    ] = await Promise.all([
      getTargetMeetingCountMap(teacher._id.toString(), classIds),
      getCompletedMeetingCountMap(teacher._id.toString(), classIds, filters),
      getPendingTaskCountMap(teacher._id.toString(), classIds, filters),
      getOverdueTaskCountMap(teacher._id.toString(), classIds, filters),
    ]);
    const classes = classGroups
      .map((classGroup) => {
        const isUtbkClass = isUtbkScheduleClassName(classGroup.className);

        return {
          ...classGroup.item,
          targetMeetingCount: resolveTargetMeetingCount(
            targetMeetingCountMap.get(classGroup.item.id),
            classGroup.item.scheduleCount,
          ),
          completedMeetingCount:
            completedMeetingCountMap.get(classGroup.item.id) ?? 0,
          pendingTaskCount: isUtbkClass
            ? 0
            : pendingTaskCountMap.get(classGroup.item.id) ?? 0,
          overdueTaskCount: isUtbkClass
            ? 0
            : overdueTaskCountMap.get(classGroup.item.id) ?? 0,
        };
      })
      .sort((left, right) => {
        const branchComparison = normalizeText(left.branch).localeCompare(
          normalizeText(right.branch),
          "id-ID",
        );

        return branchComparison || left.className.localeCompare(right.className, "id-ID");
      });

    sendSuccess(res, {
      message: "Data kelas guru berhasil diambil.",
      data: {
        classes,
      },
    });
  },
);

export const getMyTeacherClassDetail = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }
    const filters = resolveTeacherAcademicPeriodFilters(req.query);
    const { classGroup, participants, schedules, attendanceSessions, materials, tasks } =
      await resolveTeacherClassDetailContext(
        req.user._id.toString(),
        req.params.classId,
        filters,
      );

    sendSuccess(res, {
      message: "Detail kelas guru berhasil diambil.",
      data: {
        class: classGroup.item,
        schedules,
        participants,
        attendanceSessions,
        materials,
        tasks,
      },
    });
  },
);
