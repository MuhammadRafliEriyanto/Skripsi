import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";

import { AcademicGrade } from "../models/AcademicGrade";
import { ClassMaterial } from "../models/ClassMaterial";
import { ClassTask } from "../models/ClassTask";
import { Schedule } from "../models/Schedule";
import { TaskGrade } from "../models/TaskGrade";
import {
  TaskSubmission,
  TASK_SUBMISSION_MODES,
  type TaskSubmissionMode,
} from "../models/TaskSubmission";
import { User } from "../models/User";
import asyncHandler from "../utils/asyncHandler";
import { TeacherTryout } from "../models/TeacherTryout";
import { AppError, sendSuccess } from "../utils/apiResponse";
import {
  buildStudentLearningClassFilter,
  normalizeText,
  syncTeacherTaskMetrics,
  toPublicClassMaterial,
  toPublicClassTask,
} from "../utils/classroomLearning";
import {
  decodeAttachmentBase64,
  deleteLearningAttachment,
  getAttachmentSizeLimitLabel,
  isAttachmentSizeAllowed,
  sendLearningAttachmentFile,
  saveLearningAttachment,
} from "../utils/learningAttachmentStorage";
import { getNextPublicId } from "../utils/publicId";
import {
  buildSchedulePresentation,
  type ScheduleWithTeacher,
} from "../utils/scheduleConflicts";
import { buildEligibleTryoutFilter } from "./studentTryoutController";
import { normalizeCanonicalClassName } from "../utils/studentClass";
import {
  getAcademicGradeScheme,
  getAcademicGradeScoreKeys,
  toPublicAcademicGrade,
} from "../utils/academicGrade";
import { TEACHER_VISIBLE_ACADEMIC_YEAR } from "../utils/teacherAcademicPeriod";
import {
  buildAcademicRecordSubscriptionFilter,
  getMembershipSnapshotByUserId,
  type StudentWithUser,
} from "../utils/subscription";
import { resolveStudentAcademicContentAccess } from "../utils/studentAcademicAccess";
import { resolveStudentMembershipContentAccess } from "../utils/studentMembershipAccess";
import {
  buildStudentAcademicTaskFilter,
  buildStudentAcademicTryoutFilter,
  getStudentEffectiveAcademicJoinedAt,
  getJakartaDateKey,
  parseValidDate,
} from "../utils/studentAcademicStatus";
import {
  getUtbkScheduleClassNames,
  isUtbkStudent,
  matchesUtbkScheduleClassName,
} from "../utils/studentProgram";
import {
  resolveScheduleAttendanceWindow,
  type ScheduleAttendanceWindow,
} from "../utils/scheduleAttendanceWindow";

type StudentAcademicLearningContext = {
  student: StudentWithUser;
  academicJoinedAt: Date;
  subscriptionId: Types.ObjectId | null;
  subscriptionStartAt: Date;
  subscriptionEndAt: Date | null;
};

const STUDENT_VISIBLE_LEGACY_ACADEMIC_YEAR = "2025/2026";

function toPublicStudentLearningProfile(
  student: StudentWithUser,
  accessStatus: string,
) {
  return {
    id: student.studentId,
    name: student.userId.nama,
    branch: normalizeText(student.branch),
    program: normalizeText(student.program),
    className: normalizeText(student.className),
    utbkTrack: normalizeText(student.utbkTrack),
    targetKampus: normalizeText(student.targetKampus),
    targetJurusan: normalizeText(student.targetJurusan),
    status: student.status,
    accessStatus,
  };
}

async function getAuthenticatedStudentAcademicLearningContextOrThrow(
  userId: string,
): Promise<StudentAcademicLearningContext> {
  const membershipSnapshot = await getMembershipSnapshotByUserId(userId);
  const student = membershipSnapshot.student;

  if (!student || student.status !== "Aktif") {
    throw new AppError(404, "Profil siswa tidak ditemukan.");
  }

  const membershipAccess = resolveStudentMembershipContentAccess(
    membershipSnapshot.accessStatus,
    {
      subscription: membershipSnapshot.subscription,
      payment: membershipSnapshot.payment,
    },
  );

  if (membershipAccess.isMembershipLocked) {
    throw new AppError(
      403,
      membershipAccess.message ?? "Membership siswa belum aktif.",
      { membershipAccess },
      "MEMBERSHIP_ACCESS_REQUIRED",
    );
  }

  const academicJoinedAt = getStudentEffectiveAcademicJoinedAt(
    student,
    membershipSnapshot.subscription,
  );

  if (!academicJoinedAt) {
    throw new AppError(
      403,
      "Akses akademik siswa belum aktif.",
      { membershipAccess },
      "ACADEMIC_ACCESS_REQUIRED",
    );
  }

  return {
    student,
    academicJoinedAt,
    subscriptionId: membershipSnapshot.subscription?._id ?? null,
    subscriptionStartAt:
      parseValidDate(membershipSnapshot.subscription?.startDate) ?? academicJoinedAt,
    subscriptionEndAt: parseValidDate(membershipSnapshot.subscription?.endDate),
  };
}

const orderedScheduleDays = [
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
  "Minggu",
] as const;

const scheduleDayOrderMap = new Map(
  orderedScheduleDays.map((day, index) => [day.toLowerCase(), index]),
);

type StudentDashboardScheduleItem = {
  id: string;
  day: string;
  time: string;
  className: string;
  subject: string;
  teacher: string;
  room: string;
  branch: string;
  status: string;
  canStartAttendance: boolean;
  attendanceWindow: ScheduleAttendanceWindow;
};

type StudentTaskSubmissionRequestBody = {
  submissionMode?: string;
  answerText?: string;
  driveUrl?: string;
  note?: string;
  attachmentFileName?: string;
  attachmentOriginalName?: string;
  attachmentMimeType?: string;
  attachmentFileDataBase64?: string;
  removeAttachment?: boolean | string;
};

type StudentTaskSubmissionSummary = {
  submitted: boolean;
  submissionId: string | null;
  submissionMode: TaskSubmissionMode | null;
  submittedAt: string | null;
  hasAttachment: boolean;
  driveUrl: string;
  answerTextPreview: string;
};

type StudentTaskGradeStatus = "Belum Dinilai" | "Sudah Dinilai";

type StudentTaskGradeSummary = {
  graded: boolean;
  gradeId: string | null;
  score: number | null;
  note: string;
  status: StudentTaskGradeStatus;
  gradedAt: string | null;
};

type PublicStudentTaskSubmissionAttachment = {
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
};

type PublicStudentTaskSubmission = {
  id: string;
  submissionId: string;
  classId: string;
  taskId: string;
  studentId: string;
  submissionMode: TaskSubmissionMode;
  answerText: string;
  driveUrl: string;
  note: string;
  attachment: PublicStudentTaskSubmissionAttachment | null;
  submittedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

function extractGradeNumber(className: string) {
  const match = normalizeText(className).match(/\b(4|5|6|7|8|9|10|11|12)\b/);

  if (!match?.[1]) {
    return null;
  }

  return Number(match[1]);
}

function inferStudentLevel(program: string, className: string) {
  const normalizedProgram = normalizeText(program).toUpperCase();

  if (
    normalizedProgram === "SD" ||
    normalizedProgram === "SMP" ||
    normalizedProgram === "SMA"
  ) {
    return normalizedProgram;
  }

  const normalizedClassName = normalizeText(className).toUpperCase();

  if (normalizedClassName.startsWith("SD")) {
    return "SD";
  }

  if (normalizedClassName.startsWith("SMP")) {
    return "SMP";
  }

  return "SMA";
}

function getCurrentIndonesianDay() {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    timeZone: "Asia/Jakarta",
  }).format(new Date());
}

function getScheduleDayOrder(day: string) {
  return (
    scheduleDayOrderMap.get(normalizeText(day).toLowerCase()) ??
    Number.MAX_SAFE_INTEGER
  );
}

function getScheduleTimeOrder(time: string) {
  const [startTime] = normalizeText(time).split("-");
  const matchedTime = startTime?.trim().match(/^(\d{1,2})[:.](\d{2})$/);

  if (!matchedTime) {
    return Number.MAX_SAFE_INTEGER;
  }

  const hours = Number(matchedTime[1] ?? "0");
  const minutes = Number(matchedTime[2] ?? "0");

  return hours * 60 + minutes;
}

function matchesStudentScheduleClass(
  scheduleClassName: string,
  studentClassName: string,
  canonicalClassName: string,
) {
  const normalizedScheduleClassName = normalizeText(scheduleClassName);
  const normalizedStudentClassName = normalizeText(studentClassName);

  if (
    normalizedScheduleClassName.toLowerCase() ===
    normalizedStudentClassName.toLowerCase()
  ) {
    return true;
  }

  if (!canonicalClassName) {
    return false;
  }

  return (
    normalizeCanonicalClassName(normalizedScheduleClassName)?.toLowerCase() ===
    canonicalClassName.toLowerCase()
  );
}

type StudentLearningClassMetadata = {
  classId: string;
  className: string;
  subject: string;
};

function slugifyStableClassId(value: string) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildStableLearningClassId(
  teacherPublicId: string,
  branch: string,
  className: string,
) {
  const teacherSlug = slugifyStableClassId(teacherPublicId);
  const classSlug = slugifyStableClassId(className);

  if (!teacherSlug || !classSlug) {
    return "";
  }

  const branchSlug = slugifyStableClassId(branch) || "cabang";

  return `class-${teacherSlug}-${branchSlug}-${classSlug}`;
}

function isScheduleTeacherReference(
  value: ScheduleWithTeacher["teacherId"],
): value is { teacherId?: string | null; branch?: string | null } {
  return Boolean(value) && typeof value === "object";
}

function getScheduleTeacherPublicId(schedule: ScheduleWithTeacher) {
  if (!isScheduleTeacherReference(schedule.teacherId)) {
    return "";
  }

  return normalizeText(schedule.teacherId.teacherId);
}

function getScheduleBranch(schedule: ScheduleWithTeacher) {
  if (normalizeText(schedule.branch)) {
    return normalizeText(schedule.branch);
  }

  if (!isScheduleTeacherReference(schedule.teacherId)) {
    return "";
  }

  return normalizeText(schedule.teacherId.branch);
}

function buildStudentMaterialClassFilter(student: StudentWithUser) {
  if (!isUtbkStudent(student)) {
    return buildStudentLearningClassFilter(student.className, student.branch);
  }

  const utbkClassNames = getUtbkScheduleClassNames(student);
  const normalizedBranch = normalizeText(student.branch);
  const scopedFilters: Record<string, unknown>[] = [
    {
      className: {
        $in: utbkClassNames,
      },
    },
  ];

  if (normalizedBranch) {
    scopedFilters.push({
      branch: normalizedBranch,
    });
  }

  return {
    $and: scopedFilters,
  };
}

function buildSubscriptionDateRangeFilter(
  field: string,
  startAt: Date | null,
  endAt?: Date | null,
) {
  const dateRange: Record<string, string> = {};

  if (startAt) {
    dateRange.$gte = getJakartaDateKey(startAt);
  }

  if (endAt) {
    dateRange.$lt = getJakartaDateKey(endAt);
  }

  return Object.keys(dateRange).length > 0
    ? { [field]: dateRange }
    : {};
}

function buildClassContentPeriodFilter(
  period: { academicYear: string; semester: string },
  legacyFilter: Record<string, unknown> = {},
) {
  const periodCandidates: Array<Record<string, string>> = [
    {
      academicYear: period.academicYear,
      semester: period.semester,
    },
  ];

  if (period.academicYear === TEACHER_VISIBLE_ACADEMIC_YEAR) {
    periodCandidates.push({
      academicYear: STUDENT_VISIBLE_LEGACY_ACADEMIC_YEAR,
    });
  }

  return {
    $or: [
      ...periodCandidates,
      {
        $and: [
          {
            $or: [
              { academicYear: null },
              { academicYear: { $exists: false } },
            ],
          },
          legacyFilter,
        ],
      },
    ],
  };
}

async function getStudentLearningClassMetadata(
  student: StudentWithUser,
  period: { academicYear: string; semester: string },
) {
  const canonicalClassName =
    normalizeCanonicalClassName(student.className)?.toLowerCase() ?? "";
  const normalizedBranch = normalizeText(student.branch).toLowerCase();
  
  const scheduleFilter: any = buildClassContentPeriodFilter(period);
  if (normalizedBranch) {
    const branchOptions = [
      normalizedBranch,
      normalizedBranch.toLowerCase(),
      normalizedBranch.toUpperCase(),
      "Pusat",
      "pusat",
      "",
      "-",
      null
    ];
    scheduleFilter.branch = { $in: branchOptions };
  }

  const scheduleDocuments = (await Schedule.find(scheduleFilter)
    .populate<{
      teacherId: {
        teacherId: string;
        branch: string;
      };
    }>({
      path: "teacherId",
      select: "teacherId branch",
    })
    .sort({ createdAt: -1 })
    .lean()
    .exec()) as unknown as ScheduleWithTeacher[];
  const metadataByClassId = new Map<string, StudentLearningClassMetadata>();

  for (const schedule of scheduleDocuments) {
    const className = normalizeText(schedule.className);
    const branch = getScheduleBranch(schedule);
    const scheduleBranch = normalizeText(branch).toLowerCase();
    const matchesClassName = isUtbkStudent(student)
      ? matchesUtbkScheduleClassName(className, student)
      : matchesStudentScheduleClass(
          className,
          student.className,
          canonicalClassName,
        );
    const matchesBranch = normalizedBranch
      ? scheduleBranch === normalizedBranch || !scheduleBranch || scheduleBranch === "-"
      : true;

    if (!matchesClassName || !matchesBranch) {
      continue;
    }

    const classId = buildStableLearningClassId(
      getScheduleTeacherPublicId(schedule),
      branch,
      className,
    );

    if (!classId || metadataByClassId.has(classId)) {
      continue;
    }

    metadataByClassId.set(classId, {
      classId,
      className,
      subject: normalizeText(schedule.subject) || "Mapel belum diatur",
    });
  }

  return Array.from(metadataByClassId.values());
}

async function getStudentDashboardSchedules(
  student: StudentWithUser,
  period?: { academicYear: string; semester: string },
) {
  const canonicalClassName =
    normalizeCanonicalClassName(student.className)?.toLowerCase() ?? "";
  const normalizedBranch = normalizeText(student.branch).toLowerCase();
  const scheduleFilter: any = period
    ? buildClassContentPeriodFilter(period)
    : {};
    
  if (normalizedBranch) {
    const branchOptions = [
      normalizedBranch,
      normalizedBranch.toLowerCase(),
      normalizedBranch.toUpperCase(),
      "Pusat",
      "pusat",
      "",
      "-",
      null
    ];
    scheduleFilter.branch = { $in: branchOptions };
  }

  const scheduleDocuments = (await Schedule.find(scheduleFilter)
    .populate<{
      teacherId: {
        teacherId: string;
        branch: string;
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
  const schedules = buildSchedulePresentation(scheduleDocuments)
    .filter((schedule) => {
      const matchesClassName = isUtbkStudent(student)
        ? matchesUtbkScheduleClassName(schedule.className, student)
        : matchesStudentScheduleClass(
            schedule.className,
            student.className,
            canonicalClassName,
          );
      const scheduleBranch = normalizeText(schedule.branch).toLowerCase();
      const matchesBranch = normalizedBranch
        ? scheduleBranch === normalizedBranch
        : true;

      return matchesClassName && matchesBranch;
    })
    .sort((leftSchedule, rightSchedule) => {
      const dayOrderDifference =
        getScheduleDayOrder(leftSchedule.day) -
        getScheduleDayOrder(rightSchedule.day);

      if (dayOrderDifference !== 0) {
        return dayOrderDifference;
      }

      return (
        getScheduleTimeOrder(leftSchedule.time) -
        getScheduleTimeOrder(rightSchedule.time)
      );
    });

  return schedules.map<StudentDashboardScheduleItem>((schedule) => {
    const attendanceWindow = resolveScheduleAttendanceWindow(schedule);

    return {
      id: schedule.id,
      day: normalizeText(schedule.day),
      time: normalizeText(schedule.time),
      className: normalizeText(schedule.className),
      subject: normalizeText(schedule.subject) || "Mapel belum diatur",
      teacher: normalizeText(schedule.teacher) || "Guru belum diatur",
      room: normalizeText(schedule.room) || "Ruangan belum diatur",
      branch: normalizeText(schedule.branch),
      status: normalizeText(schedule.status) || "Siap",
      canStartAttendance: attendanceWindow.canStartAttendance,
      attendanceWindow,
    };
  });
}

function normalizeBoolean(value: boolean | string | undefined) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalizedValue = normalizeText(value).toLowerCase();
  return ["true", "1", "yes", "ya"].includes(normalizedValue);
}

function normalizeSubmissionMode(
  value: string | null | undefined,
): TaskSubmissionMode | null {
  const normalizedValue = normalizeText(value).toLowerCase();

  return TASK_SUBMISSION_MODES.includes(
    normalizedValue as TaskSubmissionMode,
  )
    ? (normalizedValue as TaskSubmissionMode)
    : null;
}

function buildAnswerTextPreview(answerText: string) {
  const normalizedAnswerText = normalizeText(answerText);

  if (!normalizedAnswerText) {
    return "";
  }

  if (normalizedAnswerText.length <= 140) {
    return normalizedAnswerText;
  }

  return `${normalizedAnswerText.slice(0, 137)}...`;
}

function normalizeStudentTaskGradeStatus(
  value: string | null | undefined,
): StudentTaskGradeStatus {
  return normalizeText(value).toLowerCase() === "sudah dinilai"
    ? "Sudah Dinilai"
    : "Belum Dinilai";
}

function toPublicStudentTaskSubmissionSummary(
  submission: {
    submissionId?: string;
    submissionMode?: TaskSubmissionMode;
    submittedAt?: Date | null;
    attachment?: { fileName?: string } | null;
    driveUrl?: string;
    answerText?: string;
  } | null,
): StudentTaskSubmissionSummary {
  if (!submission) {
    return {
      submitted: false,
      submissionId: null,
      submissionMode: null,
      submittedAt: null,
      hasAttachment: false,
      driveUrl: "",
      answerTextPreview: "",
    };
  }

  return {
    submitted: true,
    submissionId: normalizeText(submission.submissionId) || null,
    submissionMode: submission.submissionMode ?? null,
    submittedAt: submission.submittedAt?.toISOString() ?? null,
    hasAttachment: Boolean(normalizeText(submission.attachment?.fileName)),
    driveUrl: normalizeText(submission.driveUrl),
    answerTextPreview: buildAnswerTextPreview(
      normalizeText(submission.answerText),
    ),
  };
}

function toPublicStudentTaskGradeSummary(
  grade: {
    gradeId?: string;
    score?: number;
    note?: string;
    status?: string;
    gradedAt?: Date | null;
  } | null,
): StudentTaskGradeSummary {
  if (!grade) {
    return {
      graded: false,
      gradeId: null,
      score: null,
      note: "",
      status: "Belum Dinilai",
      gradedAt: null,
    };
  }

  const status = normalizeStudentTaskGradeStatus(grade.status);

  return {
    graded: status === "Sudah Dinilai",
    gradeId: normalizeText(grade.gradeId) || null,
    score:
      typeof grade.score === "number" && Number.isFinite(grade.score)
        ? grade.score
        : null,
    note: normalizeText(grade.note),
    status,
    gradedAt: grade.gradedAt?.toISOString() ?? null,
  };
}

function toPublicStudentTaskSubmission(
  submission: {
    _id?: unknown;
    submissionId?: string;
    classId?: string;
    taskId?: string;
    studentId?: string;
    submissionMode?: TaskSubmissionMode;
    answerText?: string;
    driveUrl?: string;
    note?: string;
    attachment?:
      | {
          fileName?: string;
          originalName?: string;
          mimeType?: string;
          size?: number;
        }
      | null;
    submittedAt?: Date | null;
    createdAt?: Date | null;
    updatedAt?: Date | null;
  },
): PublicStudentTaskSubmission {
  const recordId =
    typeof submission._id === "string"
      ? submission._id
      : submission._id &&
          typeof submission._id === "object" &&
          "toString" in submission._id &&
          typeof submission._id.toString === "function"
        ? submission._id.toString()
        : normalizeText(submission.submissionId);

  return {
    id: normalizeText(recordId),
    submissionId: normalizeText(submission.submissionId),
    classId: normalizeText(submission.classId),
    taskId: normalizeText(submission.taskId),
    studentId: normalizeText(submission.studentId),
    submissionMode: submission.submissionMode ?? "text",
    answerText: normalizeText(submission.answerText),
    driveUrl: normalizeText(submission.driveUrl),
    note: normalizeText(submission.note),
    attachment: normalizeText(submission.attachment?.fileName)
      ? {
          fileName: normalizeText(submission.attachment?.fileName),
          originalName:
            normalizeText(submission.attachment?.originalName) ||
            normalizeText(submission.attachment?.fileName),
          mimeType:
            normalizeText(submission.attachment?.mimeType) ||
            "application/octet-stream",
          size:
            typeof submission.attachment?.size === "number" &&
            submission.attachment.size >= 0
              ? submission.attachment.size
              : 0,
        }
      : null,
    submittedAt: submission.submittedAt?.toISOString() ?? null,
    createdAt: submission.createdAt?.toISOString() ?? null,
    updatedAt: submission.updatedAt?.toISOString() ?? null,
  };
}

function isValidHttpUrl(value: string) {
  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
}

function parseStudentSubmissionAttachmentPayload(
  body: Pick<
    StudentTaskSubmissionRequestBody,
    | "attachmentFileName"
    | "attachmentOriginalName"
    | "attachmentMimeType"
    | "attachmentFileDataBase64"
    | "removeAttachment"
  >,
) {
  const fileName = normalizeText(body.attachmentFileName);
  const originalName =
    normalizeText(body.attachmentOriginalName) || fileName;
  const mimeType = normalizeText(body.attachmentMimeType);
  const fileDataBase64 = normalizeText(body.attachmentFileDataBase64);
  const removeAttachment = normalizeBoolean(body.removeAttachment);

  if (!fileName && !mimeType && !fileDataBase64) {
    return {
      fileName: "",
      originalName: "",
      mimeType: "",
      fileBuffer: null,
      removeAttachment,
    };
  }

  if (!fileName || !fileDataBase64) {
    return null;
  }

  const fileBuffer = decodeAttachmentBase64(fileDataBase64);

  if (!fileBuffer || !isAttachmentSizeAllowed(fileBuffer.byteLength)) {
    return null;
  }

  return {
    fileName,
    originalName,
    mimeType,
    fileBuffer,
    removeAttachment,
  };
}

async function findStudentTaskSubmission(
  taskId: string,
  studentId: string,
  classId: string,
  teacherId: string,
  subscriptionId?: Types.ObjectId | null,
) {
  return TaskSubmission.findOne({
    taskId,
    studentId,
    classId,
    teacherId,
    ...buildAcademicRecordSubscriptionFilter(subscriptionId),
  }).exec();
}

function validateStudentSubmissionPayload(params: {
  submissionMode: TaskSubmissionMode;
  answerText: string;
  driveUrl: string;
  hasAttachment: boolean;
}) {
  if (params.submissionMode === "text" && !params.answerText) {
    return "Jawaban teks wajib diisi untuk mode pengumpulan teks.";
  }

  if (params.submissionMode === "drive" && !params.driveUrl) {
    return "Link Drive wajib diisi untuk mode pengumpulan drive.";
  }

  if (
    params.submissionMode === "drive" &&
    params.driveUrl &&
    !isValidHttpUrl(params.driveUrl)
  ) {
    return "Link Drive tidak valid. Gunakan URL http atau https yang bisa diakses.";
  }

  if (params.submissionMode === "file" && !params.hasAttachment) {
    return "Lampiran file wajib diunggah untuk mode pengumpulan file.";
  }

  return null;
}

async function findStudentMaterialByParam(
  materialId: string,
  student: StudentWithUser,
  subscriptionStartAt: Date,
  subscriptionEndAt: Date | null,
) {
  const academicAccess = await resolveStudentAcademicContentAccess(student);

  if (academicAccess.isUpcomingClassLocked) {
    return null;
  }

  const classFilter = buildStudentMaterialClassFilter(student);

  return ClassMaterial.findOne({
    $and: [
      classFilter,
      { status: "Dipublikasikan" },
      buildClassContentPeriodFilter(
        academicAccess.period,
        buildSubscriptionDateRangeFilter(
          "date",
          subscriptionStartAt,
          subscriptionEndAt,
        ),
      ),
      {
        $or: [
          { materialId },
          ...(Types.ObjectId.isValid(materialId) ? [{ _id: materialId }] : []),
        ],
      },
    ],
  }).exec();
}

async function findStudentTaskByParam(
  taskId: string,
  student: StudentWithUser,
  academicActiveFrom: Date,
) {
  if (isUtbkStudent(student)) {
    return null;
  }

  const academicAccess = await resolveStudentAcademicContentAccess(student);

  if (academicAccess.isUpcomingClassLocked) {
    return null;
  }

  const classFilter = buildStudentLearningClassFilter(
    student.className,
    student.branch,
  );

  return ClassTask.findOne({
    $and: [
      classFilter,
      buildStudentAcademicTaskFilter(academicActiveFrom),
      buildClassContentPeriodFilter(academicAccess.period),
      {
        $or: [
          { taskId },
          ...(Types.ObjectId.isValid(taskId) ? [{ _id: taskId }] : []),
        ],
      },
    ],
  }).exec();
}

async function sendStudentAttachmentFile(
  res: Response,
  attachment: { fileName: string; mimeType: string; storagePath: string } | null,
) {
  if (!attachment) {
    throw new AppError(404, "Lampiran file tidak ditemukan.");
  }

  await sendLearningAttachmentFile(res, attachment);
}

export const getMyStudentLearningData = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const membershipSnapshot = await getMembershipSnapshotByUserId(
      req.user._id.toString(),
    );
    const student = membershipSnapshot.student;

    if (!student || student.status !== "Aktif") {
      next(new AppError(404, "Profil siswa aktif tidak ditemukan."));
      return;
    }

    const membershipAccess = resolveStudentMembershipContentAccess(
      membershipSnapshot.accessStatus,
      {
        subscription: membershipSnapshot.subscription,
        payment: membershipSnapshot.payment,
      },
    );
    const academicAccess = await resolveStudentAcademicContentAccess(student);

    // Bypass filter akses keanggotaan dan jadwal kelas (untuk tujuan testing)
    // if (
    //   membershipAccess.isMembershipLocked ||
    //   academicAccess.isUpcomingClassLocked
    // ) {
    //   sendSuccess(res, {
    //     message: "Data materi dan tugas siswa berhasil diambil.",
    //     data: {
    //       student: toPublicStudentLearningProfile(
    //         student,
    //         membershipSnapshot.accessStatus,
    //       ),
    //       materials: [],
    //       tasks: [],
    //       academicSummaries: [],
    //       period: academicAccess.period,
    //       academicAccess,
    //       membershipAccess,
    //     },
    //   });
    //   return;
    // }

    const classFilter = buildStudentMaterialClassFilter(student);
    const academicJoinedAt = getStudentEffectiveAcademicJoinedAt(
      student,
      membershipSnapshot.subscription,
    ) || new Date(0); // Bypass: Berikan tanggal 1970 jika belum punya langganan
    const subscriptionId = membershipSnapshot.subscription?._id ?? null;
    const subscriptionStartAt =
      parseValidDate(membershipSnapshot.subscription?.startDate) ?? academicJoinedAt;
    const subscriptionEndAt = parseValidDate(membershipSnapshot.subscription?.endDate);
    const period = academicAccess.period;
    const isUtbkProgram = isUtbkStudent(student);
    const materialPeriodFilter = buildClassContentPeriodFilter(
      period,
      buildSubscriptionDateRangeFilter(
        "date",
        subscriptionStartAt,
        subscriptionEndAt,
      ),
    );
    const taskPeriodFilter = buildClassContentPeriodFilter(period);

    const [materials, tasks, scheduleClassMetadata] = await Promise.all([
      ClassMaterial.find({
        $and: [
          classFilter,
          { status: "Dipublikasikan" },
          materialPeriodFilter,
        ],
      })
        .sort({ meetingNumber: 1, date: 1, updatedAt: -1 })
        .lean()
        .exec(),
      isUtbkProgram
        ? Promise.resolve([])
        : ClassTask.find({
            $and: [
              classFilter,
              buildStudentAcademicTaskFilter(subscriptionStartAt),
              taskPeriodFilter,
            ],
          })
            .sort({ deadline: 1, meetingNumber: 1, updatedAt: -1 })
            .lean()
            .exec(),
      getStudentLearningClassMetadata(student, period),
    ]);
    const classMetadataById = new Map<string, StudentLearningClassMetadata>();
    const upsertClassMetadata = (
      metadata: Partial<StudentLearningClassMetadata> & { classId?: string },
    ) => {
      const classId = normalizeText(metadata.classId);

      if (!classId) {
        return;
      }

      const currentMetadata = classMetadataById.get(classId);
      const className = normalizeText(metadata.className);
      const subject = normalizeText(metadata.subject);
      const hasUsefulSubject = Boolean(subject && subject !== "Mapel belum diatur");

      classMetadataById.set(classId, {
        classId,
        className: className || currentMetadata?.className || "",
        subject: hasUsefulSubject
          ? subject
          : currentMetadata?.subject || subject || "Mapel belum diatur",
      });
    };

    for (const metadata of scheduleClassMetadata) {
      upsertClassMetadata(metadata);
    }

    for (const material of materials) {
      upsertClassMetadata({
        classId: material.classId,
        className: material.className,
        subject: material.subject,
      });
    }

    for (const task of tasks) {
      upsertClassMetadata({
        classId: task.classId,
        className: task.className,
        subject: task.subject,
      });
    }

    const normalizedTaskIds = tasks
      .map((task) => normalizeText(task.taskId))
      .filter(Boolean);
    const normalizedTaskClassIds = Array.from(
      new Set(tasks.map((task) => normalizeText(task.classId)).filter(Boolean)),
    );
    const classIdsForAcademicGrades = Array.from(classMetadataById.keys());
    const submissions = normalizedTaskIds.length
      ? await TaskSubmission.find({
          studentId: normalizeText(student.studentId),
          taskId: {
            $in: normalizedTaskIds,
          },
          ...buildAcademicRecordSubscriptionFilter(subscriptionId),
        })
          .sort({ updatedAt: -1, createdAt: -1 })
          .lean()
          .exec()
      : [];
    const [grades, rawAcademicGrades] = await Promise.all([
      normalizedTaskIds.length && normalizedTaskClassIds.length
        ? TaskGrade.find({
            studentId: normalizeText(student.studentId),
            classId: {
              $in: normalizedTaskClassIds,
            },
            taskId: {
              $in: normalizedTaskIds,
            },
            ...buildAcademicRecordSubscriptionFilter(subscriptionId),
          })
            .sort({ updatedAt: -1, createdAt: -1 })
            .lean()
            .exec()
        : Promise.resolve([]),
      classIdsForAcademicGrades.length
        ? AcademicGrade.find({
            $and: [
              {
                studentId: normalizeText(student.studentId),
                classId: {
                  $in: classIdsForAcademicGrades,
                },
                ...buildAcademicRecordSubscriptionFilter(subscriptionId),
              },
              buildClassContentPeriodFilter(period),
            ],
          })
            .sort({ updatedAt: -1, createdAt: -1 })
            .lean()
            .exec()
        : Promise.resolve([]),
    ]);
    const academicGrades = rawAcademicGrades.filter((grade) => {
      const gradeDate = parseValidDate(
        grade.evaluatedAt ?? grade.updatedAt ?? grade.createdAt,
      );

      return Boolean(
        gradeDate && gradeDate.getTime() >= subscriptionStartAt.getTime(),
      );
    });
    const submissionMap = new Map(
      submissions.map((submission) => [
        normalizeText(submission.taskId),
        toPublicStudentTaskSubmissionSummary(submission),
      ]),
    );
    const gradeMap = new Map(
      grades.map((grade) => [
        normalizeText(grade.taskId),
        toPublicStudentTaskGradeSummary(grade),
      ]),
    );
    const academicGradeByClassId = new Map<string, (typeof academicGrades)[number]>();

    for (const grade of academicGrades) {
      const classId = normalizeText(grade.classId);

      if (classId && !academicGradeByClassId.has(classId)) {
        academicGradeByClassId.set(classId, grade);
      }
    }

    const taskGradesByClassId = new Map<string, number[]>();

    for (const grade of grades) {
      if (normalizeStudentTaskGradeStatus(grade.status) !== "Sudah Dinilai") {
        continue;
      }

      const classId = normalizeText(grade.classId);
      const scores = taskGradesByClassId.get(classId) ?? [];
      scores.push(grade.score);
      taskGradesByClassId.set(classId, scores);
    }

    const summaryClassIds = Array.from(
      new Set([
        ...normalizedTaskClassIds,
        ...academicGrades.map((grade) => normalizeText(grade.classId)),
      ]),
    ).filter(Boolean);
    const academicSummaries = summaryClassIds.map((classId) => {
      const classMetadata = classMetadataById.get(classId);
      const academicGrade = academicGradeByClassId.get(classId) ?? null;
      const scheme =
        academicGrade?.scheme ??
        getAcademicGradeScheme(normalizeText(classMetadata?.className));
      const taskScores = taskGradesByClassId.get(classId) ?? [];
      const taskAverage = taskScores.length
        ? Math.round(
            taskScores.reduce((total, score) => total + score, 0) /
              taskScores.length,
          )
        : null;
      const publicAcademicGrade = academicGrade
        ? toPublicAcademicGrade(academicGrade)
        : null;
      const evaluationScores = getAcademicGradeScoreKeys(scheme)
        .map((scoreKey) => publicAcademicGrade?.scores[scoreKey] ?? null)
        .filter((score): score is number => typeof score === "number");
      const availableScores = [
        ...(taskAverage === null ? [] : [taskAverage]),
        ...evaluationScores,
      ];

      return {
        classId,
        className: normalizeText(classMetadata?.className),
        subject: normalizeText(classMetadata?.subject) || "Mapel belum diatur",
        scheme,
        period,
        taskAverage,
        gradedTaskCount: taskScores.length,
        scores: publicAcademicGrade?.scores ?? {
          uts: null,
          uas: null,
          uts1: null,
          uts2: null,
          uts3: null,
          tryout1: null,
          tryout2: null,
          tryout3: null,
        },
        note: publicAcademicGrade?.note ?? "",
        finalAverage: availableScores.length
          ? Math.round(
              availableScores.reduce((total, score) => total + score, 0) /
                availableScores.length,
            )
          : null,
        evaluatedAt: publicAcademicGrade?.evaluatedAt ?? null,
      };
    });

    sendSuccess(res, {
      message: "Data materi dan tugas siswa berhasil diambil.",
      data: {
        student: toPublicStudentLearningProfile(
          student,
          membershipSnapshot.accessStatus,
        ),
        materials: materials.map(toPublicClassMaterial),
        tasks: tasks.map((task) => ({
          ...toPublicClassTask(task),
          mySubmission:
            submissionMap.get(normalizeText(task.taskId)) ??
            toPublicStudentTaskSubmissionSummary(null),
          myGrade:
            gradeMap.get(normalizeText(task.taskId)) ??
            toPublicStudentTaskGradeSummary(null),
        })),
        academicSummaries,
        period,
        academicAccess,
        membershipAccess,
      },
    });
  },
);

export const getMyStudentDashboardData = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const membershipSnapshot = await getMembershipSnapshotByUserId(
      req.user._id.toString(),
    );
    const student = membershipSnapshot.student;

    if (!student || student.status !== "Aktif") {
      next(new AppError(404, "Profil siswa aktif tidak ditemukan."));
      return;
    }

    const academicAccess = await resolveStudentAcademicContentAccess(student);
    const membershipAccess = resolveStudentMembershipContentAccess(
      membershipSnapshot.accessStatus,
      {
        subscription: membershipSnapshot.subscription,
        payment: membershipSnapshot.payment,
      },
    );
    const classFilter = buildStudentMaterialClassFilter(student);
    const isUtbkProgram = isUtbkStudent(student);
    const isLearningLocked = false; // Bypass filter langganan
    const eligibleTryoutFilter = await buildEligibleTryoutFilter(student);
    const academicJoinedAt = getStudentEffectiveAcademicJoinedAt(student, membershipSnapshot.subscription) || new Date(0);
    const subscriptionStartAt = parseValidDate(membershipSnapshot.subscription?.startDate) ?? academicJoinedAt;
    const subscriptionEndAt = parseValidDate(membershipSnapshot.subscription?.endDate);
    const materialPeriodFilter = buildClassContentPeriodFilter(
      academicAccess.period,
      buildSubscriptionDateRangeFilter("date", subscriptionStartAt, subscriptionEndAt),
    );
    const taskPeriodFilter = buildClassContentPeriodFilter(academicAccess.period);

    const [materialCount, taskCount, schedules, tryoutCount] = await Promise.all([
      isLearningLocked
        ? Promise.resolve(0)
        : ClassMaterial.countDocuments({
            $and: [
              classFilter,
              { status: "Dipublikasikan" },
              materialPeriodFilter,
            ],
          }).exec(),
      isLearningLocked || !academicJoinedAt || isUtbkProgram
        ? Promise.resolve(0)
        : ClassTask.countDocuments({
            $and: [
              classFilter,
              buildStudentAcademicTaskFilter(subscriptionStartAt ?? academicJoinedAt),
              taskPeriodFilter,
            ],
          }).exec(),
      isLearningLocked
        ? Promise.resolve([])
        : getStudentDashboardSchedules(student, academicAccess.period),
      eligibleTryoutFilter && academicJoinedAt ? TeacherTryout.countDocuments({
        ...eligibleTryoutFilter,
        ...(isUtbkProgram ? { assessmentType: "Tryout" } : {}),
        ...buildStudentAcademicTryoutFilter(subscriptionStartAt ?? academicJoinedAt),
      }).exec() : Promise.resolve(0),
    ]);
    const currentDay = normalizeText(getCurrentIndonesianDay()).toLowerCase();
    const todaySchedules = schedules.filter(
      (schedule) => normalizeText(schedule.day).toLowerCase() === currentDay,
    );
    const jenjang = isUtbkProgram
      ? "UTBK"
      : inferStudentLevel(student.program, student.className);
    const kelas = isUtbkProgram ? null : extractGradeNumber(student.className);
    const kelasLabel = isUtbkProgram
      ? normalizeText(student.utbkTrack) || "Program SNBT"
      : kelas
        ? `Kelas ${kelas}`
        : "Kelas belum diatur";

    sendSuccess(res, {
      message: "Ringkasan dashboard siswa berhasil diambil.",
      data: {
        student: toPublicStudentLearningProfile(
          student,
          membershipSnapshot.accessStatus,
        ),
        academicSummary: {
          jenjang,
          kelas,
          kelasLabel,
          materialCount,
          taskCount,
          tryoutCount,
          todayScheduleCount: todaySchedules.length,
          scheduleCount: schedules.length,
        },
        schedules,
        todaySchedules,
        academicAccess,
        membershipAccess,
      },
    });
  },
);

export const getMyStudentTaskSubmission = asyncHandler(
  async (
    req: Request<{ taskId: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const taskId = normalizeText(req.params.taskId);

    if (!taskId) {
      next(new AppError(404, "Tugas siswa tidak ditemukan."));
      return;
    }

    const { student, subscriptionStartAt, subscriptionId } =
      await getAuthenticatedStudentAcademicLearningContextOrThrow(
        req.user._id.toString(),
      );
    const task = await findStudentTaskByParam(taskId, student, subscriptionStartAt);

    if (!task) {
      next(new AppError(404, "Tugas siswa tidak ditemukan."));
      return;
    }

    const submission = await findStudentTaskSubmission(
      normalizeText(task.taskId),
      normalizeText(student.studentId),
      normalizeText(task.classId),
      task.teacherId.toString(),
      subscriptionId,
    );

    sendSuccess(res, {
      message: submission
        ? "Submission tugas siswa berhasil diambil."
        : "Belum ada submission untuk tugas ini.",
      data: {
        submitted: Boolean(submission),
        submission: submission ? toPublicStudentTaskSubmission(submission) : null,
      },
    });
  },
);

export const createMyStudentTaskSubmission = asyncHandler(
  async (
    req: Request<
      { taskId: string },
      Record<string, never>,
      StudentTaskSubmissionRequestBody
    >,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const taskId = normalizeText(req.params.taskId);

    if (!taskId) {
      next(new AppError(404, "Tugas siswa tidak ditemukan."));
      return;
    }

    const { student, subscriptionStartAt, subscriptionId } =
      await getAuthenticatedStudentAcademicLearningContextOrThrow(
        req.user._id.toString(),
      );
    const task = await findStudentTaskByParam(taskId, student, subscriptionStartAt);

    if (!task) {
      next(new AppError(404, "Tugas siswa tidak ditemukan."));
      return;
    }

    const normalizedTaskId = normalizeText(task.taskId);
    const normalizedStudentId = normalizeText(student.studentId);
    const existingSubmission = await findStudentTaskSubmission(
      normalizedTaskId,
      normalizedStudentId,
      normalizeText(task.classId),
      task.teacherId.toString(),
      subscriptionId,
    );

    if (existingSubmission) {
      next(
        new AppError(
          409,
          "Submission tugas untuk siswa ini sudah ada. Gunakan update submission.",
        ),
      );
      return;
    }

    const submissionMode = normalizeSubmissionMode(req.body.submissionMode);
    const answerText = normalizeText(req.body.answerText);
    const driveUrl = normalizeText(req.body.driveUrl);
    const note = normalizeText(req.body.note);
    const attachmentPayload = parseStudentSubmissionAttachmentPayload(req.body);

    if (!submissionMode) {
      next(new AppError(400, "Mode pengumpulan tugas tidak valid."));
      return;
    }

    if (!attachmentPayload) {
      next(
        new AppError(
          400,
          `Lampiran submission tidak valid atau melebihi batas ${getAttachmentSizeLimitLabel()}.`,
        ),
      );
      return;
    }

    const payloadValidationError = validateStudentSubmissionPayload({
      submissionMode,
      answerText,
      driveUrl,
      hasAttachment: Boolean(
        attachmentPayload.fileBuffer && attachmentPayload.fileName,
      ),
    });

    if (payloadValidationError) {
      next(new AppError(400, payloadValidationError));
      return;
    }

    const submissionId = await getNextPublicId(
      TaskSubmission,
      "submissionId",
      "SUB",
    );
    const attachment =
      attachmentPayload.fileBuffer && attachmentPayload.fileName
        ? await saveLearningAttachment({
            kind: "task-submissions",
            recordId: submissionId,
            fileName: attachmentPayload.fileName,
            originalName: attachmentPayload.originalName,
            mimeType: attachmentPayload.mimeType,
            fileBuffer: attachmentPayload.fileBuffer,
          })
        : null;
    const submission = await TaskSubmission.create({
      submissionId,
      teacherId: task.teacherId,
      classId: normalizeText(task.classId),
      taskId: normalizedTaskId,
      studentId: normalizedStudentId,
      subscriptionId,
      submissionMode,
      answerText: submissionMode === "text" ? answerText : "",
      driveUrl: submissionMode === "drive" ? driveUrl : "",
      attachment,
      note,
      submittedAt: new Date(),
    });
    await syncTeacherTaskMetrics(
      task.teacherId.toString(),
      normalizeText(task.classId),
      normalizedTaskId,
    );

    sendSuccess(res, {
      statusCode: 201,
      message: "Submission tugas berhasil dikirim.",
      data: {
        submitted: true,
        submission: toPublicStudentTaskSubmission(submission),
      },
    });
  },
);

export const updateMyStudentTaskSubmission = asyncHandler(
  async (
    req: Request<
      { taskId: string },
      Record<string, never>,
      StudentTaskSubmissionRequestBody
    >,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const taskId = normalizeText(req.params.taskId);

    if (!taskId) {
      next(new AppError(404, "Tugas siswa tidak ditemukan."));
      return;
    }

    const { student, subscriptionStartAt, subscriptionId } =
      await getAuthenticatedStudentAcademicLearningContextOrThrow(
        req.user._id.toString(),
      );
    const task = await findStudentTaskByParam(taskId, student, subscriptionStartAt);

    if (!task) {
      next(new AppError(404, "Tugas siswa tidak ditemukan."));
      return;
    }

    const normalizedTaskId = normalizeText(task.taskId);
    const normalizedStudentId = normalizeText(student.studentId);
    const submission = await findStudentTaskSubmission(
      normalizedTaskId,
      normalizedStudentId,
      normalizeText(task.classId),
      task.teacherId.toString(),
      subscriptionId,
    );

    if (!submission) {
      next(new AppError(404, "Submission tugas belum ditemukan."));
      return;
    }

    const nextSubmissionMode =
      normalizeSubmissionMode(req.body.submissionMode) ?? submission.submissionMode;
    const nextAnswerText =
      req.body.answerText === undefined
        ? normalizeText(submission.answerText)
        : normalizeText(req.body.answerText);
    const nextDriveUrl =
      req.body.driveUrl === undefined
        ? normalizeText(submission.driveUrl)
        : normalizeText(req.body.driveUrl);
    const nextNote =
      req.body.note === undefined
        ? normalizeText(submission.note)
        : normalizeText(req.body.note);
    const attachmentPayload = parseStudentSubmissionAttachmentPayload(req.body);

    if (!attachmentPayload) {
      next(
        new AppError(
          400,
          `Lampiran submission tidak valid atau melebihi batas ${getAttachmentSizeLimitLabel()}.`,
        ),
      );
      return;
    }

    const willKeepCurrentAttachment =
      nextSubmissionMode === "file" &&
      !attachmentPayload.removeAttachment &&
      !attachmentPayload.fileBuffer &&
      Boolean(submission.attachment?.fileName);
    const payloadValidationError = validateStudentSubmissionPayload({
      submissionMode: nextSubmissionMode,
      answerText: nextAnswerText,
      driveUrl: nextDriveUrl,
      hasAttachment: Boolean(
        willKeepCurrentAttachment ||
          (attachmentPayload.fileBuffer && attachmentPayload.fileName),
      ),
    });

    if (payloadValidationError) {
      next(new AppError(400, payloadValidationError));
      return;
    }

    if (
      attachmentPayload.removeAttachment &&
      submission.attachment?.storagePath
    ) {
      await deleteLearningAttachment(submission.attachment.storagePath);
      submission.attachment = null;
    }

    if (nextSubmissionMode !== "file" && submission.attachment?.storagePath) {
      await deleteLearningAttachment(submission.attachment.storagePath);
      submission.attachment = null;
    }

    if (attachmentPayload.fileBuffer && attachmentPayload.fileName) {
      if (submission.attachment?.storagePath) {
        await deleteLearningAttachment(submission.attachment.storagePath);
      }

      submission.attachment = await saveLearningAttachment({
        kind: "task-submissions",
        recordId: normalizeText(submission.submissionId),
        fileName: attachmentPayload.fileName,
        originalName: attachmentPayload.originalName,
        mimeType: attachmentPayload.mimeType,
        fileBuffer: attachmentPayload.fileBuffer,
      });
    }

    submission.submissionMode = nextSubmissionMode;
    submission.answerText = nextSubmissionMode === "text" ? nextAnswerText : "";
    submission.driveUrl = nextSubmissionMode === "drive" ? nextDriveUrl : "";
    submission.note = nextNote;
    submission.submittedAt = new Date();
    await submission.save();
    await syncTeacherTaskMetrics(
      task.teacherId.toString(),
      normalizeText(task.classId),
      normalizedTaskId,
    );

    sendSuccess(res, {
      message: "Submission tugas berhasil diperbarui.",
      data: {
        submitted: true,
        submission: toPublicStudentTaskSubmission(submission),
      },
    });
  },
);

export const deleteMyStudentTaskSubmission = asyncHandler(
  async (
    req: Request<{ taskId: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const taskId = normalizeText(req.params.taskId);

    if (!taskId) {
      next(new AppError(404, "Tugas siswa tidak ditemukan."));
      return;
    }

    const { student, subscriptionStartAt, subscriptionId } =
      await getAuthenticatedStudentAcademicLearningContextOrThrow(
        req.user._id.toString(),
      );
    const task = await findStudentTaskByParam(taskId, student, subscriptionStartAt);

    if (!task) {
      next(new AppError(404, "Tugas siswa tidak ditemukan."));
      return;
    }

    const normalizedTaskId = normalizeText(task.taskId);
    const normalizedStudentId = normalizeText(student.studentId);
    const submission = await findStudentTaskSubmission(
      normalizedTaskId,
      normalizedStudentId,
      normalizeText(task.classId),
      task.teacherId.toString(),
      subscriptionId,
    );

    if (!submission) {
      next(new AppError(404, "Submission tugas belum ditemukan."));
      return;
    }

    if (submission.attachment?.storagePath) {
      await deleteLearningAttachment(submission.attachment.storagePath);
    }

    await submission.deleteOne();
    await syncTeacherTaskMetrics(
      task.teacherId.toString(),
      normalizeText(task.classId),
      normalizedTaskId,
    );

    sendSuccess(res, {
      message: "Submission tugas berhasil dihapus.",
      data: {
        submitted: false,
        submission: null,
      },
    });
  },
);

export const downloadMyStudentTaskSubmissionAttachment = asyncHandler(
  async (
    req: Request<{ taskId: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const taskId = normalizeText(req.params.taskId);

    if (!taskId) {
      next(new AppError(404, "Tugas siswa tidak ditemukan."));
      return;
    }

    const { student, subscriptionStartAt, subscriptionId } =
      await getAuthenticatedStudentAcademicLearningContextOrThrow(
        req.user._id.toString(),
      );
    const task = await findStudentTaskByParam(taskId, student, subscriptionStartAt);

    if (!task) {
      next(new AppError(404, "Tugas siswa tidak ditemukan."));
      return;
    }

    const submission = await findStudentTaskSubmission(
      normalizeText(task.taskId),
      normalizeText(student.studentId),
      normalizeText(task.classId),
      task.teacherId.toString(),
      subscriptionId,
    );

    if (!submission?.attachment) {
      next(new AppError(404, "Lampiran submission tidak ditemukan."));
      return;
    }

    await sendLearningAttachmentFile(res, submission.attachment);
  },
);

export const downloadMyStudentMaterialAttachment = asyncHandler(
  async (
    req: Request<{ materialId: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const materialId = normalizeText(req.params.materialId);

    if (!materialId) {
      next(new AppError(404, "Materi siswa tidak ditemukan."));
      return;
    }

    const { student, subscriptionStartAt, subscriptionEndAt } =
      await getAuthenticatedStudentAcademicLearningContextOrThrow(
        req.user._id.toString(),
      );
    const material = await findStudentMaterialByParam(
      materialId,
      student,
      subscriptionStartAt,
      subscriptionEndAt,
    );

    if (!material || !material.attachment) {
      next(new AppError(404, "Lampiran materi tidak ditemukan."));
      return;
    }

    await sendStudentAttachmentFile(res, material.attachment);
  },
);

export const downloadMyStudentTaskAttachment = asyncHandler(
  async (
    req: Request<{ taskId: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const taskId = normalizeText(req.params.taskId);

    if (!taskId) {
      next(new AppError(404, "Tugas siswa tidak ditemukan."));
      return;
    }

    const { student, subscriptionStartAt } =
      await getAuthenticatedStudentAcademicLearningContextOrThrow(
        req.user._id.toString(),
      );
    const task = await findStudentTaskByParam(taskId, student, subscriptionStartAt);

    if (!task || !task.attachment) {
      next(new AppError(404, "Lampiran tugas tidak ditemukan."));
      return;
    }

    await sendStudentAttachmentFile(res, task.attachment);
  },
);
