import type { NextFunction, Request, Response } from "express";
import { type FilterQuery, Types } from "mongoose";

import { AcademicGrade, type IAcademicGrade } from "../models/AcademicGrade";
import {
  AttendanceRecord,
  type IAttendanceRecord,
} from "../models/AttendanceRecord";
import {
  AttendanceSession,
  type IAttendanceSession,
} from "../models/AttendanceSession";
import { ClassTask, type IClassTask } from "../models/ClassTask";
import { Schedule } from "../models/Schedule";
import { Student, type StudentDocument } from "../models/Student";
import {
  StudentTryoutAttempt,
  type IStudentTryoutAttempt,
} from "../models/StudentTryoutAttempt";
import { Subscription, type SubscriptionDocument } from "../models/Subscription";
import { TaskGrade, type ITaskGrade } from "../models/TaskGrade";
import {
  TaskSubmission,
  type ITaskSubmission,
} from "../models/TaskSubmission";
import { Teacher, type TeacherDocument } from "../models/Teacher";
import { TeacherTryout, type ITeacherTryout } from "../models/TeacherTryout";
import asyncHandler from "../utils/asyncHandler";
import { AppError, sendSuccess } from "../utils/apiResponse";
import {
  getCurrentAcademicPeriod,
  toPublicAcademicGrade,
} from "../utils/academicGrade";
import {
  normalizeText,
  toPublicClassTask,
  toPublicTaskGrade,
} from "../utils/classroomLearning";
import {
  getJakartaDateKey,
  parseValidDate,
} from "../utils/studentAcademicStatus";
import { normalizeCanonicalClassName } from "../utils/studentClass";

type AcademicHistoryContext = {
  student: StudentDocument;
  subscription: SubscriptionDocument;
  subscriptionId: Types.ObjectId;
  studentPublicId: string;
  program: string;
  className: string;
  branch: string;
  rangeStart: Date | null;
  rangeEnd: Date | null;
  startDateKey: string | null;
  endDateKey: string | null;
  academicPeriods: Array<{
    academicYear: string;
    semester: string;
  }>;
};

type LeanAcademicGrade = Pick<
  IAcademicGrade,
  | "academicGradeId"
  | "classId"
  | "studentId"
  | "subscriptionId"
  | "academicYear"
  | "semester"
  | "scheme"
  | "uts"
  | "uas"
  | "uts1"
  | "uts2"
  | "uts3"
  | "tryout1"
  | "tryout2"
  | "tryout3"
  | "note"
  | "evaluatedAt"
  | "createdAt"
  | "updatedAt"
> & {
  _id?: unknown;
};

type LeanAttendanceRecord = Pick<
  IAttendanceRecord,
  | "recordId"
  | "sessionId"
  | "studentId"
  | "studentObjectId"
  | "subscriptionId"
  | "status"
  | "note"
  | "markedBy"
  | "markedAt"
  | "createdAt"
  | "updatedAt"
> & {
  _id?: unknown;
};

type LeanAttendanceSession = Pick<
  IAttendanceSession,
  | "sessionId"
  | "classId"
  | "teacherId"
  | "scheduleId"
  | "className"
  | "subject"
  | "branch"
  | "room"
  | "date"
  | "startTime"
  | "academicYear"
  | "semester"
  | "status"
  | "createdAt"
  | "updatedAt"
> & {
  _id?: unknown;
};

type LeanClassTask = Pick<
  IClassTask,
  | "taskId"
  | "classId"
  | "teacherId"
  | "className"
  | "canonicalClassName"
  | "subject"
  | "branch"
  | "room"
  | "meetingNumber"
  | "title"
  | "description"
  | "deadline"
  | "attachment"
  | "submittedCount"
  | "reviewStatus"
  | "academicYear"
  | "semester"
  | "createdAt"
  | "updatedAt"
> & {
  _id?: unknown;
  gradedCount?: number;
};

type LeanTaskGrade = Pick<
  ITaskGrade,
  | "gradeId"
  | "teacherId"
  | "classId"
  | "taskId"
  | "studentId"
  | "subscriptionId"
  | "score"
  | "note"
  | "status"
  | "gradedAt"
  | "createdAt"
  | "updatedAt"
> & {
  _id?: unknown;
};

type LeanTaskSubmission = Pick<
  ITaskSubmission,
  | "submissionId"
  | "teacherId"
  | "classId"
  | "taskId"
  | "studentId"
  | "subscriptionId"
  | "submissionMode"
  | "answerText"
  | "driveUrl"
  | "attachment"
  | "note"
  | "submittedAt"
  | "createdAt"
  | "updatedAt"
> & {
  _id?: unknown;
};

type LeanTeacherTryout = Pick<
  ITeacherTryout,
  | "teacherId"
  | "tryoutId"
  | "classId"
  | "branch"
  | "canonicalClassName"
  | "assessmentType"
  | "title"
  | "jenjang"
  | "kelas"
  | "subject"
  | "stage"
  | "durationMinutes"
  | "startAt"
  | "endAt"
  | "publishStatus"
  | "reviewStatus"
  | "questionSource"
  | "questionCount"
  | "questionBankId"
  | "questionSetId"
  | "packageId"
  | "fileName"
  | "academicYear"
  | "semester"
  | "createdAt"
  | "updatedAt"
> & {
  _id?: unknown;
};

type LeanTryoutAttempt = Pick<
  IStudentTryoutAttempt,
  | "attemptId"
  | "tryoutId"
  | "teacherId"
  | "classId"
  | "branch"
  | "studentId"
  | "subscriptionId"
  | "questionSetId"
  | "packageId"
  | "stage"
  | "correctCount"
  | "wrongCount"
  | "unansweredCount"
  | "score"
  | "timeUsedSeconds"
  | "startedAt"
  | "submittedAt"
  | "status"
  | "createdAt"
  | "updatedAt"
> & {
  _id?: unknown;
};

type TeacherScope = {
  teacherId?: Types.ObjectId | string;
};

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

function toIsoString(value: Date | string | null | undefined) {
  return parseValidDate(value)?.toISOString() ?? null;
}

function compareNullableDatesDesc(
  left: Date | string | null | undefined,
  right: Date | string | null | undefined,
) {
  return (
    (parseValidDate(right)?.getTime() ?? 0) -
    (parseValidDate(left)?.getTime() ?? 0)
  );
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getCanonicalClassKey(value: string | null | undefined) {
  return (
    normalizeCanonicalClassName(value) ??
    normalizeText(value)
  ).toLowerCase();
}

function matchesClassName(
  sourceClassName: string | null | undefined,
  targetClassName: string | null | undefined,
) {
  const source = normalizeText(sourceClassName);
  const target = normalizeText(targetClassName);

  if (!source || !target) {
    return false;
  }

  if (source.toLowerCase() === target.toLowerCase()) {
    return true;
  }

  const sourceCanonical = getCanonicalClassKey(source);
  const targetCanonical = getCanonicalClassKey(target);

  return Boolean(sourceCanonical && targetCanonical && sourceCanonical === targetCanonical);
}

function matchesBranch(
  sourceBranch: string | null | undefined,
  targetBranch: string | null | undefined,
) {
  const source = normalizeText(sourceBranch).toLowerCase();
  const target = normalizeText(targetBranch).toLowerCase();

  if (!target) {
    return true;
  }

  return !source || source === target;
}

function inferProgramFromClassName(className: string) {
  const canonicalClassName = normalizeCanonicalClassName(className) ?? "";

  if (canonicalClassName.startsWith("SD ")) {
    return "SD";
  }

  if (canonicalClassName.startsWith("SMP ")) {
    return "SMP";
  }

  if (canonicalClassName.startsWith("SMA ")) {
    return "SMA";
  }

  return "";
}

function getSubscriptionClassName(
  subscription: SubscriptionDocument,
  student: StudentDocument,
) {
  return (
    normalizeText(subscription.targetClassName) ||
    normalizeText(student.className)
  );
}

function getSubscriptionProgram(
  subscription: SubscriptionDocument,
  student: StudentDocument,
) {
  const className = getSubscriptionClassName(subscription, student);

  return (
    normalizeText(subscription.targetProgram) ||
    inferProgramFromClassName(className) ||
    normalizeText(student.program)
  );
}

function getSubscriptionDateRange(subscription: SubscriptionDocument) {
  const rangeStart =
    parseValidDate(subscription.startDate) ??
    parseValidDate(subscription.createdAt);
  const rangeEnd = parseValidDate(subscription.endDate);

  return {
    rangeStart,
    rangeEnd,
    startDateKey: rangeStart ? getJakartaDateKey(rangeStart) : null,
    endDateKey: rangeEnd ? getJakartaDateKey(rangeEnd) : null,
  };
}

function getAcademicPeriodsForSubscription(subscription: SubscriptionDocument) {
  const { rangeStart, rangeEnd } = getSubscriptionDateRange(subscription);
  const start = rangeStart ?? parseValidDate(subscription.createdAt) ?? new Date();
  const end = rangeEnd && rangeEnd.getTime() >= start.getTime() ? rangeEnd : start;
  const periods = new Map<string, { academicYear: string; semester: string }>();
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const lastMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

  for (let index = 0; index < 36 && cursor.getTime() <= lastMonth.getTime(); index += 1) {
    const period = getCurrentAcademicPeriod(cursor);
    periods.set(`${period.academicYear}::${period.semester}`, period);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return Array.from(periods.values());
}

function getPrimaryAcademicPeriod(subscription: SubscriptionDocument) {
  return (
    getAcademicPeriodsForSubscription(subscription)[0] ??
    getCurrentAcademicPeriod(parseValidDate(subscription.createdAt) ?? new Date())
  );
}

function isWithinDateRange(
  value: Date | string | null | undefined,
  context: AcademicHistoryContext,
) {
  const date = parseValidDate(value);

  if (!date) {
    return true;
  }

  if (context.rangeStart && date.getTime() < context.rangeStart.getTime()) {
    return false;
  }

  if (context.rangeEnd && date.getTime() > context.rangeEnd.getTime()) {
    return false;
  }

  return true;
}

function isDateKeyWithinRange(
  dateKey: string | null | undefined,
  context: AcademicHistoryContext,
) {
  const normalizedDateKey = normalizeText(dateKey);

  if (!normalizedDateKey) {
    return true;
  }

  if (context.startDateKey && normalizedDateKey < context.startDateKey) {
    return false;
  }

  if (context.endDateKey && normalizedDateKey > context.endDateKey) {
    return false;
  }

  return true;
}

function matchesAcademicPeriod(
  source: {
    academicYear?: string | null;
    semester?: string | null;
  },
  context: AcademicHistoryContext,
) {
  const academicYear = normalizeText(source.academicYear);
  const semester = normalizeText(source.semester);

  if (!academicYear && !semester) {
    return true;
  }

  return context.academicPeriods.some((period) => {
    const yearMatches = !academicYear || period.academicYear === academicYear;
    const semesterMatches = !semester || period.semester === semester;

    return yearMatches && semesterMatches;
  });
}

function buildAcademicPeriodOrLegacyQuery(context: AcademicHistoryContext) {
  const periodConditions = context.academicPeriods.map((period) => ({
    academicYear: period.academicYear,
    semester: period.semester,
  }));

  return {
    $or: [
      ...periodConditions,
      { academicYear: null },
      { academicYear: { $exists: false } },
    ],
  };
}

function isExactSubscriptionRecord(
  record: { subscriptionId?: unknown },
  context: AcademicHistoryContext,
) {
  return toRecordId(record.subscriptionId) === context.subscriptionId.toString();
}

function isLegacySubscriptionRecord(record: { subscriptionId?: unknown }) {
  return !toRecordId(record.subscriptionId);
}

function buildSubscriptionOrLegacyQuery(context: AcademicHistoryContext) {
  return {
    $or: [
      { subscriptionId: context.subscriptionId },
      { subscriptionId: null },
      { subscriptionId: { $exists: false } },
    ],
  };
}

function buildClassQuery(className: string, branch: string) {
  const canonicalClassName = normalizeCanonicalClassName(className);
  const classFilters: Array<Record<string, unknown>> = [
    { className },
    { kelas: className },
    { canonicalClassName: className },
  ];

  if (canonicalClassName) {
    classFilters.push(
      { className: canonicalClassName },
      { kelas: canonicalClassName },
      { canonicalClassName },
    );
  }

  const filters: Array<Record<string, unknown>> = [
    {
      $or: classFilters,
    },
  ];

  if (branch) {
    filters.push({
      branch: new RegExp(`^${escapeRegex(branch)}$`, "i"),
    });
  }

  return {
    $and: filters,
  };
}

function toPublicAcademicHistorySubscription(
  subscription: SubscriptionDocument,
  student: StudentDocument,
) {
  const primaryPeriod = getPrimaryAcademicPeriod(subscription);
  const academicPeriods = getAcademicPeriodsForSubscription(subscription);

  return {
    subscriptionId: subscription._id.toString(),
    academicYear: primaryPeriod.academicYear,
    semester: primaryPeriod.semester,
    program: getSubscriptionProgram(subscription, student),
    className: getSubscriptionClassName(subscription, student),
    startDate: toIsoString(subscription.startDate),
    endDate: toIsoString(subscription.endDate),
    subscriptionCode: subscription.subscriptionCode,
    packageName: subscription.packageName,
    status: subscription.status,
    paymentStatus: subscription.paymentStatus,
    academicPeriods,
  };
}

function buildAcademicHistoryContext(
  student: StudentDocument,
  subscription: SubscriptionDocument,
): AcademicHistoryContext {
  const dateRange = getSubscriptionDateRange(subscription);

  return {
    student,
    subscription,
    subscriptionId: subscription._id,
    studentPublicId: normalizeText(student.studentId),
    program: getSubscriptionProgram(subscription, student),
    className: getSubscriptionClassName(subscription, student),
    branch: normalizeText(student.branch),
    academicPeriods: getAcademicPeriodsForSubscription(subscription),
    ...dateRange,
  };
}

function toPublicStudentProfile(student: StudentDocument) {
  return {
    id: student._id.toString(),
    studentId: normalizeText(student.studentId),
    program: normalizeText(student.program),
    className: normalizeText(student.className),
    branch: normalizeText(student.branch),
    status: student.status,
  };
}

async function findStudentByUserId(userId: string) {
  return Student.findOne({ userId }).exec();
}

async function findStudentByParam(studentParam: string) {
  const studentId = normalizeText(studentParam);

  if (!studentId) {
    return null;
  }

  const filters: FilterQuery<StudentDocument>[] = [{ studentId }];

  if (Types.ObjectId.isValid(studentId)) {
    filters.push({ _id: studentId });
  }

  return Student.findOne({
    $or: filters,
  }).exec();
}

async function findTeacherByUserId(userId: string) {
  return Teacher.findOne({ userId, status: "Aktif" }).exec();
}

async function getStudentSubscriptions(student: StudentDocument) {
  return Subscription.find({ studentId: student._id })
    .sort({ startDate: -1, createdAt: -1, _id: -1 })
    .exec();
}

async function findStudentSubscriptionById(
  student: StudentDocument,
  subscriptionId: string,
) {
  if (!Types.ObjectId.isValid(subscriptionId)) {
    return null;
  }

  return Subscription.findOne({
    _id: subscriptionId,
    studentId: student._id,
  }).exec();
}

function studentMatchesTeacherSchedule(
  schedule: {
    className?: string | null;
    branch?: string | null;
  },
  student: StudentDocument,
  subscriptions: SubscriptionDocument[],
) {
  const candidateClassNames = [
    normalizeText(student.className),
    ...subscriptions.map((subscription) => getSubscriptionClassName(subscription, student)),
  ].filter(Boolean);
  const studentBranch = normalizeText(student.branch);

  return (
    matchesBranch(schedule.branch, studentBranch) &&
    candidateClassNames.some((className) =>
      matchesClassName(schedule.className, className),
    )
  );
}

async function ensureTeacherCanAccessStudent(
  teacher: TeacherDocument,
  student: StudentDocument,
  subscriptions: SubscriptionDocument[],
) {
  const schedules = await Schedule.find({ teacherId: teacher._id })
    .select("className branch")
    .lean()
    .exec();
  const canAccess = schedules.some((schedule) =>
    studentMatchesTeacherSchedule(schedule, student, subscriptions),
  );

  if (!canAccess) {
    throw new AppError(403, "Guru tidak memiliki akses ke histori siswa ini.");
  }
}

function isAcademicGradeVisible(
  grade: LeanAcademicGrade,
  context: AcademicHistoryContext,
) {
  if (isExactSubscriptionRecord(grade, context)) {
    return true;
  }

  if (!isLegacySubscriptionRecord(grade)) {
    return false;
  }

  return (
    matchesAcademicPeriod(grade, context) &&
    isWithinDateRange(
      grade.evaluatedAt ?? grade.updatedAt ?? grade.createdAt,
      context,
    )
  );
}

async function loadAcademicGrades(
  context: AcademicHistoryContext,
  scope: TeacherScope = {},
) {
  const teacherFilter = scope.teacherId ? { teacherId: scope.teacherId } : {};
  const grades = (await AcademicGrade.find({
    studentId: context.studentPublicId,
    ...teacherFilter,
    ...buildSubscriptionOrLegacyQuery(context),
  })
    .sort({ evaluatedAt: -1, updatedAt: -1, createdAt: -1 })
    .lean()
    .exec()) as unknown as LeanAcademicGrade[];

  return grades
    .filter((grade) => isAcademicGradeVisible(grade, context))
    .map((grade) => ({
      ...toPublicAcademicGrade(grade),
      subscriptionId: toRecordId(grade.subscriptionId) || null,
    }));
}

function isAttendanceRecordVisible(
  record: LeanAttendanceRecord,
  session: LeanAttendanceSession,
  context: AcademicHistoryContext,
) {
  if (isExactSubscriptionRecord(record, context)) {
    return true;
  }

  if (!isLegacySubscriptionRecord(record)) {
    return false;
  }

  return (
    matchesClassName(session.className, context.className) &&
    matchesBranch(session.branch, context.branch) &&
    matchesAcademicPeriod(session, context) &&
    isDateKeyWithinRange(session.date, context)
  );
}

function getAttendanceHistoryOrderKey(date: string, startTime: string) {
  const normalizedDate = normalizeText(date);
  const normalizedStartTime = normalizeText(startTime).replace(".", ":");

  if (!normalizedDate) {
    return "";
  }

  return `${normalizedDate}T${normalizedStartTime || "00:00"}`;
}

async function loadAttendance(
  context: AcademicHistoryContext,
  scope: TeacherScope = {},
) {
  const records = (await AttendanceRecord.find({
    $and: [
      {
        $or: [
          { studentId: context.studentPublicId },
          { studentObjectId: context.student._id },
        ],
      },
      buildSubscriptionOrLegacyQuery(context),
    ],
  })
    .sort({ createdAt: -1 })
    .lean()
    .exec()) as unknown as LeanAttendanceRecord[];
  const sessionIds = Array.from(
    new Set(records.map((record) => normalizeText(record.sessionId)).filter(Boolean)),
  );

  if (sessionIds.length === 0) {
    return [];
  }

  const sessionFilter: FilterQuery<IAttendanceSession> = {
    sessionId: {
      $in: sessionIds,
    },
  };

  if (scope.teacherId) {
    sessionFilter.teacherId = scope.teacherId;
  }

  const sessions = (await AttendanceSession.find(sessionFilter)
    .lean()
    .exec()) as unknown as LeanAttendanceSession[];
  const sessionMap = new Map(
    sessions.map((session) => [normalizeText(session.sessionId), session] as const),
  );

  return records
    .map((record) => {
      const session = sessionMap.get(normalizeText(record.sessionId));

      if (!session || !isAttendanceRecordVisible(record, session, context)) {
        return null;
      }

      return {
        id: normalizeText(record.recordId) || toRecordId(record._id),
        recordId: normalizeText(record.recordId),
        sessionId: normalizeText(session.sessionId),
        subscriptionId: toRecordId(record.subscriptionId) || null,
        date: normalizeText(session.date),
        startTime: normalizeText(session.startTime),
        subject: normalizeText(session.subject) || "-",
        classId: normalizeText(session.classId),
        className: normalizeText(session.className) || "-",
        branch: normalizeText(session.branch),
        room: normalizeText(session.room) || "-",
        status: record.status,
        sessionStatus: session.status,
        markedBy: record.markedBy,
        note: normalizeText(record.note),
        markedAt: toIsoString(record.markedAt),
        createdAt: toIsoString(record.createdAt),
        updatedAt: toIsoString(record.updatedAt),
      };
    })
    .filter((record): record is NonNullable<typeof record> => record !== null)
    .sort((leftRecord, rightRecord) =>
      getAttendanceHistoryOrderKey(
        rightRecord.date,
        rightRecord.startTime,
      ).localeCompare(
        getAttendanceHistoryOrderKey(leftRecord.date, leftRecord.startTime),
      ),
    );
}

function getTaskEffectiveDate(task: LeanClassTask) {
  return parseValidDate(task.deadline) ?? parseValidDate(task.createdAt);
}

function isTaskInSubscriptionScope(
  task: LeanClassTask,
  context: AcademicHistoryContext,
) {
  return (
    matchesClassName(
      normalizeText(task.canonicalClassName) || normalizeText(task.className),
      context.className,
    ) &&
    matchesBranch(task.branch, context.branch) &&
    matchesAcademicPeriod(task, context) &&
    isWithinDateRange(getTaskEffectiveDate(task), context)
  );
}

function taskRecordDate(record: LeanTaskGrade | LeanTaskSubmission) {
  if ("gradedAt" in record) {
    return record.gradedAt ?? record.updatedAt ?? record.createdAt;
  }

  return record.submittedAt ?? record.updatedAt ?? record.createdAt;
}

function isTaskRecordVisible(
  record: LeanTaskGrade | LeanTaskSubmission,
  task: LeanClassTask | undefined,
  context: AcademicHistoryContext,
) {
  if (isExactSubscriptionRecord(record, context)) {
    return true;
  }

  if (!isLegacySubscriptionRecord(record) || !task) {
    return false;
  }

  return (
    isTaskInSubscriptionScope(task, context) &&
    isWithinDateRange(taskRecordDate(record), context)
  );
}

function toPublicTaskSubmission(submission: LeanTaskSubmission) {
  return {
    id: normalizeText(submission.submissionId) || toRecordId(submission._id),
    submissionId: normalizeText(submission.submissionId),
    classId: normalizeText(submission.classId),
    taskId: normalizeText(submission.taskId),
    studentId: normalizeText(submission.studentId),
    subscriptionId: toRecordId(submission.subscriptionId) || null,
    submissionMode: submission.submissionMode,
    answerText: normalizeText(submission.answerText),
    driveUrl: normalizeText(submission.driveUrl),
    note: normalizeText(submission.note),
    attachment: submission.attachment
      ? {
          fileName: normalizeText(submission.attachment.fileName),
          originalName:
            normalizeText(submission.attachment.originalName) ||
            normalizeText(submission.attachment.fileName),
          mimeType:
            normalizeText(submission.attachment.mimeType) ||
            "application/octet-stream",
          size:
            typeof submission.attachment.size === "number" &&
            submission.attachment.size >= 0
              ? submission.attachment.size
              : 0,
        }
      : null,
    submittedAt: toIsoString(submission.submittedAt),
    createdAt: toIsoString(submission.createdAt),
    updatedAt: toIsoString(submission.updatedAt),
  };
}

function preferExactThenLatest<T extends { subscriptionId?: unknown; updatedAt?: Date; createdAt?: Date }>(
  current: T,
  next: T,
  context: AcademicHistoryContext,
) {
  const currentExact = isExactSubscriptionRecord(current, context);
  const nextExact = isExactSubscriptionRecord(next, context);

  if (currentExact !== nextExact) {
    return nextExact ? next : current;
  }

  return compareNullableDatesDesc(current.updatedAt ?? current.createdAt, next.updatedAt ?? next.createdAt) <= 0
    ? current
    : next;
}

async function loadTasks(
  context: AcademicHistoryContext,
  scope: TeacherScope = {},
) {
  const teacherFilter = scope.teacherId ? { teacherId: scope.teacherId } : {};
  const [exactSubmissions, exactGrades] = await Promise.all([
    TaskSubmission.find({
      studentId: context.studentPublicId,
      subscriptionId: context.subscriptionId,
      ...teacherFilter,
    })
      .select("taskId")
      .lean()
      .exec(),
    TaskGrade.find({
      studentId: context.studentPublicId,
      subscriptionId: context.subscriptionId,
      ...teacherFilter,
    })
      .select("taskId")
      .lean()
      .exec(),
  ]);
  const exactTaskIds = new Set(
    [...exactSubmissions, ...exactGrades]
      .map((record) => normalizeText(record.taskId))
      .filter(Boolean),
  );
  const taskOrFilters: Array<Record<string, unknown>> = [
    {
      $and: [
        buildClassQuery(context.className, context.branch),
        buildAcademicPeriodOrLegacyQuery(context),
        teacherFilter,
      ],
    },
  ];

  if (exactTaskIds.size > 0) {
    taskOrFilters.push({
      taskId: {
        $in: Array.from(exactTaskIds),
      },
      ...teacherFilter,
    });
  }

  const rawTasks = (await ClassTask.find({
    $or: taskOrFilters,
  })
    .sort({ deadline: 1, meetingNumber: 1, createdAt: 1 })
    .lean()
    .exec()) as unknown as LeanClassTask[];
  const tasks = rawTasks.filter((task) => {
    const taskId = normalizeText(task.taskId);
    return exactTaskIds.has(taskId) || isTaskInSubscriptionScope(task, context);
  });
  const taskIds = Array.from(
    new Set(tasks.map((task) => normalizeText(task.taskId)).filter(Boolean)),
  );

  if (taskIds.length === 0) {
    return {
      tasks: [],
      taskGrades: [],
      taskSubmissions: [],
    };
  }

  const [submissions, grades] = await Promise.all([
    TaskSubmission.find({
      studentId: context.studentPublicId,
      taskId: {
        $in: taskIds,
      },
      ...teacherFilter,
      ...buildSubscriptionOrLegacyQuery(context),
    })
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean()
      .exec() as Promise<LeanTaskSubmission[]>,
    TaskGrade.find({
      studentId: context.studentPublicId,
      taskId: {
        $in: taskIds,
      },
      ...teacherFilter,
      ...buildSubscriptionOrLegacyQuery(context),
    })
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean()
      .exec() as Promise<LeanTaskGrade[]>,
  ]);
  const taskById = new Map(
    tasks.map((task) => [normalizeText(task.taskId), task] as const),
  );
  const visibleSubmissions = submissions.filter((submission) =>
    isTaskRecordVisible(
      submission,
      taskById.get(normalizeText(submission.taskId)),
      context,
    ),
  );
  const visibleGrades = grades.filter((grade) =>
    isTaskRecordVisible(
      grade,
      taskById.get(normalizeText(grade.taskId)),
      context,
    ),
  );
  const submissionByTaskId = new Map<string, LeanTaskSubmission>();
  const gradeByTaskId = new Map<string, LeanTaskGrade>();

  for (const submission of visibleSubmissions) {
    const taskId = normalizeText(submission.taskId);
    const current = submissionByTaskId.get(taskId);
    submissionByTaskId.set(
      taskId,
      current ? preferExactThenLatest(current, submission, context) : submission,
    );
  }

  for (const grade of visibleGrades) {
    const taskId = normalizeText(grade.taskId);
    const current = gradeByTaskId.get(taskId);
    gradeByTaskId.set(
      taskId,
      current ? preferExactThenLatest(current, grade, context) : grade,
    );
  }

  return {
    tasks: tasks.map((task) => {
      const taskId = normalizeText(task.taskId);

      return {
        ...toPublicClassTask({
          ...task,
          submittedCount: visibleSubmissions.filter(
            (submission) => normalizeText(submission.taskId) === taskId,
          ).length,
          gradedCount: visibleGrades.filter(
            (grade) =>
              normalizeText(grade.taskId) === taskId &&
              normalizeText(grade.status).toLowerCase() === "sudah dinilai",
          ).length,
        }),
        mySubmission: submissionByTaskId.has(taskId)
          ? toPublicTaskSubmission(submissionByTaskId.get(taskId) as LeanTaskSubmission)
          : null,
        myGrade: gradeByTaskId.has(taskId)
          ? {
              ...toPublicTaskGrade(gradeByTaskId.get(taskId) as LeanTaskGrade),
              subscriptionId:
                toRecordId((gradeByTaskId.get(taskId) as LeanTaskGrade).subscriptionId) ||
                null,
            }
          : null,
      };
    }),
    taskGrades: visibleGrades.map((grade) => ({
      ...toPublicTaskGrade(grade),
      subscriptionId: toRecordId(grade.subscriptionId) || null,
    })),
    taskSubmissions: visibleSubmissions.map(toPublicTaskSubmission),
  };
}

function getTryoutEffectiveDate(tryout: LeanTeacherTryout) {
  return parseValidDate(tryout.endAt) ?? parseValidDate(tryout.startAt);
}

function isTryoutInSubscriptionScope(
  tryout: LeanTeacherTryout,
  context: AcademicHistoryContext,
) {
  return (
    matchesClassName(
      normalizeText(tryout.canonicalClassName) || normalizeText(tryout.kelas),
      context.className,
    ) &&
    matchesBranch(tryout.branch, context.branch) &&
    matchesAcademicPeriod(tryout, context) &&
    isWithinDateRange(getTryoutEffectiveDate(tryout), context)
  );
}

function isTryoutAttemptVisible(
  attempt: LeanTryoutAttempt,
  tryout: LeanTeacherTryout | undefined,
  context: AcademicHistoryContext,
) {
  if (isExactSubscriptionRecord(attempt, context)) {
    return true;
  }

  if (!isLegacySubscriptionRecord(attempt) || !tryout) {
    return false;
  }

  return (
    isTryoutInSubscriptionScope(tryout, context) &&
    isWithinDateRange(attempt.submittedAt ?? attempt.startedAt ?? attempt.createdAt, context)
  );
}

function toPublicTryoutAttempt(attempt: LeanTryoutAttempt | null | undefined) {
  if (!attempt) {
    return {
      submitted: false,
      attemptId: null,
      status: null,
      score: null,
      correctCount: null,
      wrongCount: null,
      unansweredCount: null,
      timeUsedSeconds: null,
      startedAt: null,
      submittedAt: null,
    };
  }

  return {
    submitted: attempt.status === "submitted",
    id: normalizeText(attempt.attemptId) || toRecordId(attempt._id),
    attemptId: normalizeText(attempt.attemptId),
    subscriptionId: toRecordId(attempt.subscriptionId) || null,
    status: attempt.status,
    score:
      typeof attempt.score === "number" && Number.isFinite(attempt.score)
        ? attempt.score
        : null,
    correctCount:
      typeof attempt.correctCount === "number" ? attempt.correctCount : null,
    wrongCount:
      typeof attempt.wrongCount === "number" ? attempt.wrongCount : null,
    unansweredCount:
      typeof attempt.unansweredCount === "number"
        ? attempt.unansweredCount
        : null,
    timeUsedSeconds:
      typeof attempt.timeUsedSeconds === "number"
        ? attempt.timeUsedSeconds
        : null,
    startedAt: toIsoString(attempt.startedAt),
    submittedAt: toIsoString(attempt.submittedAt),
  };
}

function toPublicTryout(
  tryout: LeanTeacherTryout,
  attempt: LeanTryoutAttempt | null,
) {
  return {
    id: toRecordId(tryout._id) || normalizeText(tryout.tryoutId),
    tryoutId: normalizeText(tryout.tryoutId),
    classId: normalizeText(tryout.classId),
    branch: normalizeText(tryout.branch),
    canonicalClassName: normalizeText(tryout.canonicalClassName),
    assessmentType: tryout.assessmentType ?? "Tryout",
    title: normalizeText(tryout.title),
    jenjang: tryout.jenjang,
    kelas: normalizeText(tryout.kelas),
    subject: normalizeText(tryout.subject),
    stage:
      typeof tryout.stage === "number" && Number.isFinite(tryout.stage)
        ? tryout.stage
        : null,
    durationMinutes:
      typeof tryout.durationMinutes === "number" &&
      Number.isFinite(tryout.durationMinutes)
        ? tryout.durationMinutes
        : 0,
    startAt: toIsoString(tryout.startAt),
    endAt: toIsoString(tryout.endAt),
    publishStatus: tryout.publishStatus,
    reviewStatus: tryout.reviewStatus,
    questionSource: tryout.questionSource,
    questionCount:
      typeof tryout.questionCount === "number" && Number.isFinite(tryout.questionCount)
        ? tryout.questionCount
        : 0,
    questionBankId: normalizeText(tryout.questionBankId) || null,
    questionSetId: normalizeText(tryout.questionSetId) || null,
    packageId: normalizeText(tryout.packageId) || null,
    fileName: normalizeText(tryout.fileName) || null,
    academicYear: normalizeText(tryout.academicYear) || null,
    semester: normalizeText(tryout.semester) || null,
    myAttempt: toPublicTryoutAttempt(attempt),
    createdAt: toIsoString(tryout.createdAt),
    updatedAt: toIsoString(tryout.updatedAt),
  };
}

async function loadTryouts(
  context: AcademicHistoryContext,
  scope: TeacherScope = {},
) {
  const teacherFilter = scope.teacherId ? { teacherId: scope.teacherId } : {};
  const exactAttempts = (await StudentTryoutAttempt.find({
    studentId: context.studentPublicId,
    subscriptionId: context.subscriptionId,
    ...teacherFilter,
  })
    .select("tryoutId")
    .lean()
    .exec()) as unknown as Array<{ tryoutId?: string }>;
  const exactTryoutIds = new Set(
    exactAttempts.map((attempt) => normalizeText(attempt.tryoutId)).filter(Boolean),
  );
  const tryoutOrFilters: Array<Record<string, unknown>> = [
    {
      $and: [
        buildClassQuery(context.className, context.branch),
        buildAcademicPeriodOrLegacyQuery(context),
        { publishStatus: "published" },
        teacherFilter,
      ],
    },
  ];

  if (exactTryoutIds.size > 0) {
    tryoutOrFilters.push({
      tryoutId: {
        $in: Array.from(exactTryoutIds),
      },
      ...teacherFilter,
    });
  }

  const rawTryouts = (await TeacherTryout.find({
    $or: tryoutOrFilters,
  })
    .sort({ startAt: 1, stage: 1, createdAt: -1 })
    .lean()
    .exec()) as unknown as LeanTeacherTryout[];
  const tryouts = rawTryouts.filter((tryout) => {
    const tryoutId = normalizeText(tryout.tryoutId);
    return exactTryoutIds.has(tryoutId) || isTryoutInSubscriptionScope(tryout, context);
  });
  const tryoutIds = Array.from(
    new Set(tryouts.map((tryout) => normalizeText(tryout.tryoutId)).filter(Boolean)),
  );

  if (tryoutIds.length === 0) {
    return [];
  }

  const attempts = (await StudentTryoutAttempt.find({
    studentId: context.studentPublicId,
    tryoutId: {
      $in: tryoutIds,
    },
    ...teacherFilter,
    ...buildSubscriptionOrLegacyQuery(context),
  })
    .sort({ submittedAt: -1, updatedAt: -1, createdAt: -1 })
    .lean()
    .exec()) as unknown as LeanTryoutAttempt[];
  const tryoutById = new Map(
    tryouts.map((tryout) => [normalizeText(tryout.tryoutId), tryout] as const),
  );
  const attemptByTryoutId = new Map<string, LeanTryoutAttempt>();

  for (const attempt of attempts) {
    const tryoutId = normalizeText(attempt.tryoutId);

    if (
      !isTryoutAttemptVisible(
        attempt,
        tryoutById.get(tryoutId),
        context,
      )
    ) {
      continue;
    }

    const current = attemptByTryoutId.get(tryoutId);
    attemptByTryoutId.set(
      tryoutId,
      current ? preferExactThenLatest(current, attempt, context) : attempt,
    );
  }

  return tryouts.map((tryout) =>
    toPublicTryout(
      tryout,
      attemptByTryoutId.get(normalizeText(tryout.tryoutId)) ?? null,
    ),
  );
}

async function loadAcademicHistoryDetail(
  student: StudentDocument,
  subscription: SubscriptionDocument,
  scope: TeacherScope = {},
) {
  const context = buildAcademicHistoryContext(student, subscription);
  const [academicGrades, attendanceRecords, taskData, tryouts] = await Promise.all([
    loadAcademicGrades(context, scope),
    loadAttendance(context, scope),
    loadTasks(context, scope),
    loadTryouts(context, scope),
  ]);

  return {
    subscription: toPublicAcademicHistorySubscription(subscription, student),
    student: toPublicStudentProfile(student),
    grades: {
      academicGrades,
      taskGrades: taskData.taskGrades,
    },
    attendance: {
      records: attendanceRecords,
    },
    tasks: taskData.tasks,
    taskSubmissions: taskData.taskSubmissions,
    tryouts,
    fallback: {
      legacyRecords:
        "Record lama tanpa subscriptionId dipetakan dengan rentang tanggal subscription, periode akademik, kelas, dan cabang.",
    },
  };
}

export const getMyStudentAcademicHistory = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const student = await findStudentByUserId(req.user._id.toString());

    if (!student) {
      next(new AppError(404, "Profil siswa tidak ditemukan."));
      return;
    }

    const subscriptions = await getStudentSubscriptions(student);

    sendSuccess(res, {
      message: "Histori akademik siswa berhasil diambil.",
      data: {
        student: toPublicStudentProfile(student),
        subscriptions: subscriptions.map((subscription) =>
          toPublicAcademicHistorySubscription(subscription, student),
        ),
      },
    });
  },
);

export const getMyStudentAcademicHistoryDetail = asyncHandler(
  async (
    req: Request<{ subscriptionId: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const student = await findStudentByUserId(req.user._id.toString());

    if (!student) {
      next(new AppError(404, "Profil siswa tidak ditemukan."));
      return;
    }

    const subscription = await findStudentSubscriptionById(
      student,
      req.params.subscriptionId,
    );

    if (!subscription) {
      next(new AppError(404, "Subscription akademik tidak ditemukan."));
      return;
    }

    sendSuccess(res, {
      message: "Detail histori akademik siswa berhasil diambil.",
      data: await loadAcademicHistoryDetail(student, subscription),
    });
  },
);

export const getTeacherStudentAcademicHistory = asyncHandler(
  async (
    req: Request<{ studentId: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const [teacher, student] = await Promise.all([
      findTeacherByUserId(req.user._id.toString()),
      findStudentByParam(req.params.studentId),
    ]);

    if (!teacher) {
      next(new AppError(404, "Profil guru tidak ditemukan."));
      return;
    }

    if (!student) {
      next(new AppError(404, "Profil siswa tidak ditemukan."));
      return;
    }

    const subscriptions = await getStudentSubscriptions(student);
    await ensureTeacherCanAccessStudent(teacher, student, subscriptions);

    sendSuccess(res, {
      message: "Histori akademik siswa berhasil diambil.",
      data: {
        student: toPublicStudentProfile(student),
        subscriptions: subscriptions.map((subscription) =>
          toPublicAcademicHistorySubscription(subscription, student),
        ),
      },
    });
  },
);

export const getTeacherStudentAcademicHistoryDetail = asyncHandler(
  async (
    req: Request<{ studentId: string; subscriptionId: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const [teacher, student] = await Promise.all([
      findTeacherByUserId(req.user._id.toString()),
      findStudentByParam(req.params.studentId),
    ]);

    if (!teacher) {
      next(new AppError(404, "Profil guru tidak ditemukan."));
      return;
    }

    if (!student) {
      next(new AppError(404, "Profil siswa tidak ditemukan."));
      return;
    }

    const subscriptions = await getStudentSubscriptions(student);
    await ensureTeacherCanAccessStudent(teacher, student, subscriptions);

    const subscription =
      subscriptions.find(
        (candidate) => candidate._id.toString() === req.params.subscriptionId,
      ) ??
      (await findStudentSubscriptionById(student, req.params.subscriptionId));

    if (!subscription) {
      next(new AppError(404, "Subscription akademik tidak ditemukan."));
      return;
    }

    sendSuccess(res, {
      message: "Detail histori akademik siswa berhasil diambil.",
      data: await loadAcademicHistoryDetail(student, subscription, {
        teacherId: teacher._id,
      }),
    });
  },
);
