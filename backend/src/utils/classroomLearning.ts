import type { FilterQuery, Types } from "mongoose";

import {
  ClassMaterial,
  CLASS_MATERIAL_STATUSES,
  type IClassMaterialAttachment,
  type ClassMaterialStatus,
} from "../models/ClassMaterial";
import {
  ClassTask,
  CLASS_TASK_REVIEW_STATUSES,
  type IClassTaskAttachment,
  type IClassTask,
  type ClassTaskReviewStatus,
} from "../models/ClassTask";
import {
  TaskGrade,
  TASK_GRADE_STATUSES,
  type TaskGradeStatus,
} from "../models/TaskGrade";
import { TaskSubmission } from "../models/TaskSubmission";
import { buildAcademicRecordSubscriptionFilter } from "./subscription";
import { normalizeCanonicalClassName } from "./studentClass";
import { normalizeUtbkScheduleClassName } from "./studentProgram";

type LearningClassScopedDocument = {
  _id?: unknown;
  materialId?: string;
  taskId?: string;
  classId?: string;
  className?: string;
  subject?: string;
  branch?: string;
  room?: string;
  meetingNumber?: number;
  date?: string;
  deadline?: string;
  title?: string;
  description?: string;
  linkUrl?: string;
  status?: string;
  attachment?: IClassMaterialAttachment | IClassTaskAttachment | null;
  submittedCount?: number;
  gradedCount?: number;
  reviewStatus?: ClassTaskReviewStatus;
  gradeId?: string;
  studentId?: string;
  score?: number;
  note?: string;
  gradedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type PublicClassMaterial = {
  id: string;
  materialId: string;
  classId: string;
  className: string;
  subject: string;
  branch: string;
  room: string;
  meetingNumber: number;
  date: string;
  title: string;
  description: string;
  linkUrl: string;
  attachment: PublicClassAttachment | null;
  status: ClassMaterialStatus;
  createdAt: string | null;
  updatedAt: string | null;
};

export type PublicClassAttachment = {
  fileName: string;
  mimeType: string;
  size: number;
};

export type PublicClassTask = {
  id: string;
  taskId: string;
  classId: string;
  className: string;
  subject: string;
  branch: string;
  room: string;
  meetingNumber: number;
  title: string;
  description: string;
  deadline: string;
  attachment: PublicClassAttachment | null;
  submittedCount: number;
  gradedCount: number;
  reviewStatus: ClassTaskReviewStatus;
  createdAt: string | null;
  updatedAt: string | null;
};

type TeacherTaskMetricMaps = {
  submittedCountByTaskId: Map<string, number>;
  gradedCountByTaskId: Map<string, number>;
  reviewStatusByTaskId: Map<string, ClassTaskReviewStatus>;
};

export type PublicTaskGrade = {
  id: string;
  gradeId: string;
  classId: string;
  taskId: string;
  studentId: string;
  score: number;
  note: string;
  status: TaskGradeStatus;
  gradedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export function normalizeText(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function toPublicAttachment(
  attachment: LearningClassScopedDocument["attachment"],
): PublicClassAttachment | null {
  if (!attachment) {
    return null;
  }

  const fileName = normalizeText(attachment.fileName);
  const mimeType = normalizeText(attachment.mimeType);
  const size =
    typeof attachment.size === "number" && attachment.size >= 0
      ? attachment.size
      : 0;

  if (!fileName) {
    return null;
  }

  return {
    fileName,
    mimeType: mimeType || "application/octet-stream",
    size,
  };
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

export function normalizeMaterialStatus(
  value: string | null | undefined,
): ClassMaterialStatus | null {
  const normalizedValue = normalizeText(value).toLowerCase();

  switch (normalizedValue) {
    case "draft":
      return "Draft";
    case "dipublikasikan":
      return "Dipublikasikan";
    default:
      return null;
  }
}

export function normalizeTaskReviewStatus(
  value: string | null | undefined,
): ClassTaskReviewStatus | null {
  const normalizedValue = normalizeText(value).toLowerCase();

  switch (normalizedValue) {
    case "belum ada pengumpulan":
      return "Belum Ada Pengumpulan";
    case "sudah dinilai":
      return "Sudah Dinilai";
    case "belum dinilai":
      return "Belum Dinilai";
    default:
      return null;
  }
}

export function normalizeTaskGradeStatus(
  value: string | null | undefined,
): TaskGradeStatus | null {
  const normalizedValue = normalizeText(value).toLowerCase();

  switch (normalizedValue) {
    case "sudah dinilai":
      return "Sudah Dinilai";
    case "belum dinilai":
      return "Belum Dinilai";
    default:
      return null;
  }
}

export function buildCanonicalClassName(className: string) {
  const normalizedClassName = normalizeText(className);

  return (
    normalizeUtbkScheduleClassName(normalizedClassName) ||
    normalizeCanonicalClassName(normalizedClassName) ||
    ""
  );
}

export function buildStudentLearningClassFilter(
  className: string,
  branch: string,
) {
  const normalizedClassName = normalizeText(className);
  const canonicalClassName = buildCanonicalClassName(normalizedClassName);
  const normalizedBranch = normalizeText(branch);
  const classFilters = [
    { className: normalizedClassName },
    ...(canonicalClassName ? [{ canonicalClassName }] : []),
  ];
  const scopedFilters: Record<string, unknown>[] = [
    {
      $or: classFilters,
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

function buildAcademicPeriodOrLegacyFilter(filters?: {
  academicYear?: string;
  semester?: string;
}) {
  const periodFilter: Record<string, string> = {};

  if (filters?.academicYear) {
    periodFilter.academicYear = filters.academicYear;
  }

  if (filters?.semester) {
    periodFilter.semester = filters.semester;
  }

  if (Object.keys(periodFilter).length === 0) {
    return {};
  }

  return {
    $or: [
      periodFilter,
      { academicYear: null },
      { academicYear: { $exists: false } },
    ],
  };
}

export async function getTeacherClassMaterials(
  teacherId: string,
  classId: string,
  filters?: { academicYear?: string; semester?: string },
) {
  return ClassMaterial.find({
    $and: [
      {
        teacherId,
        classId,
      },
      buildAcademicPeriodOrLegacyFilter(filters),
    ],
  })
    .sort({ meetingNumber: 1, date: 1, createdAt: 1 })
    .lean()
    .exec();
}

export async function getTeacherClassTasks(
  teacherId: string,
  classId: string,
  filters?: { academicYear?: string; semester?: string },
  subscriptionIds?: Array<Types.ObjectId | string>,
) {
  const query: FilterQuery<IClassTask> = {
    $and: [
      {
        teacherId,
        classId,
      },
      buildAcademicPeriodOrLegacyFilter(filters),
    ],
  };

  const tasks = await ClassTask.find(query)
    .sort({ meetingNumber: 1, deadline: 1, createdAt: 1 })
    .lean()
    .exec();

  const taskMetricMaps = await getTeacherTaskMetricMaps(
    teacherId,
    classId,
    tasks.map((task) => normalizeText(task.taskId)),
    subscriptionIds,
  );

  return tasks.map((task) => {
    const normalizedTaskId = normalizeText(task.taskId);

    return {
      ...task,
      submittedCount:
        taskMetricMaps.submittedCountByTaskId.get(normalizedTaskId) ?? 0,
      gradedCount: taskMetricMaps.gradedCountByTaskId.get(normalizedTaskId) ?? 0,
      reviewStatus:
        taskMetricMaps.reviewStatusByTaskId.get(normalizedTaskId) ??
        "Belum Ada Pengumpulan",
    };
  });
}

export async function getTeacherClassTaskGrades(
  teacherId: string,
  classId: string,
  subscriptionIds?: Array<Types.ObjectId | string>,
) {
  return TaskGrade.find({
    teacherId,
    classId,
    ...(subscriptionIds ? buildAcademicRecordSubscriptionFilter(subscriptionIds) : {}),
  })
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean()
    .exec();
}

export function deriveTaskReviewStatus(
  submittedCount: number,
  gradedCount: number,
): ClassTaskReviewStatus {
  if (submittedCount <= 0) {
    return "Belum Ada Pengumpulan";
  }

  if (gradedCount >= submittedCount) {
    return "Sudah Dinilai";
  }

  return "Belum Dinilai";
}

export async function getTeacherTaskMetricMaps(
  teacherId: string,
  classId: string,
  taskIds: string[],
  subscriptionIds?: Array<Types.ObjectId | string>,
): Promise<TeacherTaskMetricMaps> {
  const normalizedTaskIds = Array.from(
    new Set(taskIds.map((taskId) => normalizeText(taskId)).filter(Boolean)),
  );
  const submittedCountByTaskId = new Map<string, number>();
  const gradedCountByTaskId = new Map<string, number>();
  const reviewStatusByTaskId = new Map<string, ClassTaskReviewStatus>();

  if (normalizedTaskIds.length === 0) {
    return {
      submittedCountByTaskId,
      gradedCountByTaskId,
      reviewStatusByTaskId,
    };
  }

  const [submissions, grades] = await Promise.all([
    TaskSubmission.find({
      teacherId,
      classId,
      taskId: {
        $in: normalizedTaskIds,
      },
      ...(subscriptionIds ? buildAcademicRecordSubscriptionFilter(subscriptionIds) : {}),
    })
      .select("taskId studentId")
      .lean()
      .exec(),
    TaskGrade.find({
      teacherId,
      classId,
      taskId: {
        $in: normalizedTaskIds,
      },
      status: "Sudah Dinilai",
      ...(subscriptionIds ? buildAcademicRecordSubscriptionFilter(subscriptionIds) : {}),
    })
      .select("taskId studentId status")
      .lean()
      .exec(),
  ]);
  const submittedStudentsByTaskId = new Map<string, Set<string>>();

  for (const submission of submissions) {
    const taskId = normalizeText(submission.taskId);
    const studentId = normalizeText(submission.studentId).toLowerCase();

    if (!taskId || !studentId) {
      continue;
    }

    const submittedStudents = submittedStudentsByTaskId.get(taskId) ?? new Set<string>();
    submittedStudents.add(studentId);
    submittedStudentsByTaskId.set(taskId, submittedStudents);
  }

  for (const taskId of normalizedTaskIds) {
    submittedCountByTaskId.set(
      taskId,
      submittedStudentsByTaskId.get(taskId)?.size ?? 0,
    );
  }

  const countedGradeKeys = new Set<string>();

  for (const grade of grades) {
    const taskId = normalizeText(grade.taskId);
    const studentId = normalizeText(grade.studentId).toLowerCase();
    const submittedStudents = submittedStudentsByTaskId.get(taskId);

    if (!taskId || !studentId || !submittedStudents?.has(studentId)) {
      continue;
    }

    const countedStudentsKey = `${taskId}::${studentId}`;

    if (countedGradeKeys.has(countedStudentsKey)) {
      continue;
    }

    countedGradeKeys.add(countedStudentsKey);
    const gradedStudents = gradedCountByTaskId.get(taskId) ?? 0;
    gradedCountByTaskId.set(taskId, gradedStudents + 1);
  }

  const dedupedReviewStatusByTaskId = new Map<string, ClassTaskReviewStatus>();

  for (const taskId of normalizedTaskIds) {
    const submittedCount = submittedCountByTaskId.get(taskId) ?? 0;
    const gradedCount = gradedCountByTaskId.get(taskId) ?? 0;

    dedupedReviewStatusByTaskId.set(
      taskId,
      deriveTaskReviewStatus(submittedCount, gradedCount),
    );
  }

  return {
    submittedCountByTaskId,
    gradedCountByTaskId,
    reviewStatusByTaskId: dedupedReviewStatusByTaskId,
  };
}

export async function syncTeacherTaskMetrics(
  teacherId: string,
  classId: string,
  taskId: string,
) {
  const normalizedTaskId = normalizeText(taskId);

  if (!normalizedTaskId) {
    return null;
  }

  const task = await ClassTask.findOne({
    teacherId,
    classId,
    taskId: normalizedTaskId,
  }).exec();

  if (!task) {
    return null;
  }

  const taskMetricMaps = await getTeacherTaskMetricMaps(
    teacherId,
    classId,
    [normalizedTaskId],
  );
  const submittedCount =
    taskMetricMaps.submittedCountByTaskId.get(normalizedTaskId) ?? 0;
  const reviewStatus =
    taskMetricMaps.reviewStatusByTaskId.get(normalizedTaskId) ??
    "Belum Ada Pengumpulan";

  task.submittedCount = submittedCount;
  task.reviewStatus = reviewStatus;
  await task.save();

  return {
    submittedCount,
    gradedCount:
      taskMetricMaps.gradedCountByTaskId.get(normalizedTaskId) ?? 0,
    reviewStatus,
  };
}

export function toPublicClassMaterial(
  material: LearningClassScopedDocument,
): PublicClassMaterial {
  return {
    id: toRecordId(material._id) || normalizeText(material.materialId),
    materialId: normalizeText(material.materialId),
    classId: normalizeText(material.classId),
    className: normalizeText(material.className),
    subject: normalizeText(material.subject) || "Mapel belum diatur",
    branch: normalizeText(material.branch),
    room: normalizeText(material.room) || "Ruangan belum diatur",
    meetingNumber:
      typeof material.meetingNumber === "number" && material.meetingNumber > 0
        ? material.meetingNumber
        : 1,
    date: normalizeText(material.date),
    title: normalizeText(material.title),
    description: normalizeText(material.description),
    linkUrl: normalizeText(material.linkUrl),
    attachment: toPublicAttachment(material.attachment),
    status:
      normalizeMaterialStatus(material.status) ??
      CLASS_MATERIAL_STATUSES[0],
    createdAt: material.createdAt?.toISOString() ?? null,
    updatedAt: material.updatedAt?.toISOString() ?? null,
  };
}

export function toPublicClassTask(
  task: LearningClassScopedDocument,
): PublicClassTask {
  return {
    id: toRecordId(task._id) || normalizeText(task.taskId),
    taskId: normalizeText(task.taskId),
    classId: normalizeText(task.classId),
    className: normalizeText(task.className),
    subject: normalizeText(task.subject) || "Mapel belum diatur",
    branch: normalizeText(task.branch),
    room: normalizeText(task.room) || "Ruangan belum diatur",
    meetingNumber:
      typeof task.meetingNumber === "number" && task.meetingNumber > 0
        ? task.meetingNumber
        : 1,
    title: normalizeText(task.title),
    description: normalizeText(task.description),
    deadline: normalizeText(task.deadline),
    attachment: toPublicAttachment(task.attachment),
    submittedCount:
      typeof task.submittedCount === "number" && task.submittedCount >= 0
        ? task.submittedCount
        : 0,
    gradedCount:
      typeof task.gradedCount === "number" && task.gradedCount >= 0
        ? task.gradedCount
        : 0,
    reviewStatus:
      normalizeTaskReviewStatus(task.reviewStatus) ??
      CLASS_TASK_REVIEW_STATUSES[0],
    createdAt: task.createdAt?.toISOString() ?? null,
    updatedAt: task.updatedAt?.toISOString() ?? null,
  };
}

export function toPublicTaskGrade(
  grade: LearningClassScopedDocument,
): PublicTaskGrade {
  return {
    id: toRecordId(grade._id) || normalizeText(grade.gradeId),
    gradeId: normalizeText(grade.gradeId),
    classId: normalizeText(grade.classId),
    taskId: normalizeText(grade.taskId),
    studentId: normalizeText(grade.studentId),
    score:
      typeof grade.score === "number" && Number.isFinite(grade.score)
        ? grade.score
        : 0,
    note: normalizeText(grade.note),
    status:
      normalizeTaskGradeStatus(grade.status) ??
      TASK_GRADE_STATUSES[0],
    gradedAt: grade.gradedAt?.toISOString() ?? null,
    createdAt: grade.createdAt?.toISOString() ?? null,
    updatedAt: grade.updatedAt?.toISOString() ?? null,
  };
}
