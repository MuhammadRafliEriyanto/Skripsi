import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";

import { ClassTask } from "../models/ClassTask";
import { Student } from "../models/Student";
import { TaskGrade } from "../models/TaskGrade";
import { TaskSubmission, type TaskSubmissionMode } from "../models/TaskSubmission";
import { User } from "../models/User";
import asyncHandler from "../utils/asyncHandler";
import { AppError, sendSuccess } from "../utils/apiResponse";
import {
  normalizeText,
} from "../utils/classroomLearning";
import { resolveLearningAttachmentPath } from "../utils/learningAttachmentStorage";
import {
  buildAcademicRecordSubscriptionFilter,
  findActiveSubscriptionIdsForAcademicRecords,
} from "../utils/subscription";
import { resolveTeacherClassDetailContext } from "./teacherScheduleController";

type StudentNameLookup = {
  studentId?: string;
  userId?: unknown;
};

type UserNameLookup = {
  _id?: unknown;
  nama?: string | null;
};

type TaskSubmissionGradeLookup = {
  studentId?: string;
  status?: string | null;
  score?: number | null;
};

type PublicTeacherTaskSubmissionAttachment = {
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
};

type PublicTeacherTaskSubmissionListItem = {
  id: string;
  submissionId: string;
  studentId: string;
  studentName: string;
  submissionMode: TaskSubmissionMode;
  submittedAt: string | null;
  hasAttachment: boolean;
  driveUrl: string;
  answerTextPreview: string;
  gradeStatus: "Belum Dinilai" | "Sudah Dinilai";
  score: number | null;
};

type PublicTeacherTaskSubmissionDetail = PublicTeacherTaskSubmissionListItem & {
  classId: string;
  taskId: string;
  answerText: string;
  note: string;
  attachment: PublicTeacherTaskSubmissionAttachment | null;
  createdAt: string | null;
  updatedAt: string | null;
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

function toGradeStatus(value: string | null | undefined) {
  return normalizeText(value).toLowerCase() === "sudah dinilai"
    ? "Sudah Dinilai"
    : "Belum Dinilai";
}

function toSafeScore(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function findTeacherTaskByParam(
  taskId: string,
  classId: string,
  teacherId: string,
) {
  return ClassTask.findOne({
    classId,
    teacherId,
    $or: [
      { taskId },
      ...(Types.ObjectId.isValid(taskId) ? [{ _id: taskId }] : []),
    ],
  }).exec();
}

async function findTeacherSubmissionByParam(
  submissionId: string,
  taskId: string,
  classId: string,
  teacherId: string,
  subscriptionIds?: Awaited<ReturnType<typeof findActiveSubscriptionIdsForAcademicRecords>>,
) {
  return TaskSubmission.findOne({
    $and: [
      {
        teacherId,
        classId,
        taskId,
      },
      subscriptionIds ? buildAcademicRecordSubscriptionFilter(subscriptionIds) : {},
      {
        $or: [
          { submissionId },
          ...(Types.ObjectId.isValid(submissionId) ? [{ _id: submissionId }] : []),
        ],
      },
    ],
  }).exec();
}

async function getStudentNameMap(studentIds: string[]) {
  const normalizedStudentIds = Array.from(
    new Set(studentIds.map((studentId) => normalizeText(studentId)).filter(Boolean)),
  );

  if (normalizedStudentIds.length === 0) {
    return new Map<string, string>();
  }

  const students = (await Student.find({
    studentId: {
      $in: normalizedStudentIds,
    },
  })
    .select("studentId userId")
    .lean()
    .exec()) as StudentNameLookup[];
  const normalizedUserIds = Array.from(
    new Set(
      students
        .map((student) => toRecordId(student.userId))
        .filter(Boolean),
    ),
  );
  const users = normalizedUserIds.length
    ? ((await User.find({
        _id: {
          $in: normalizedUserIds,
        },
      })
        .select("nama")
        .lean()
        .exec()) as UserNameLookup[])
    : [];
  const userNameMap = new Map(
    users.map((user) => [
      toRecordId(user._id),
      normalizeText(user.nama),
    ]),
  );

  return new Map(
    students.map((student) => [
      normalizeText(student.studentId).toLowerCase(),
      userNameMap.get(toRecordId(student.userId)) ?? "",
    ]),
  );
}

function buildParticipantNameMap(
  participants: Array<{ studentId?: string; name?: string }>,
) {
  return new Map(
    participants
      .map((participant) => [
        normalizeText(participant.studentId).toLowerCase(),
        normalizeText(participant.name),
      ] as const)
      .filter(([studentId]) => Boolean(studentId)),
  );
}

function buildGradeMap(grades: TaskSubmissionGradeLookup[]) {
  return new Map(
    grades
      .map((grade) => {
        const studentId = normalizeText(grade.studentId).toLowerCase();

        if (!studentId) {
          return null;
        }

        const gradeStatus = toGradeStatus(grade.status);

        return [
          studentId,
          {
            gradeStatus,
            score:
              gradeStatus === "Sudah Dinilai" ? toSafeScore(grade.score) : null,
          },
        ] as const;
      })
      .filter(Boolean) as Array<
      readonly [
        string,
        {
          gradeStatus: "Belum Dinilai" | "Sudah Dinilai";
          score: number | null;
        },
      ]
    >,
  );
}

function resolveSubmissionStudentName(
  studentId: string,
  studentNameMap: Map<string, string>,
  participantNameMap: Map<string, string>,
) {
  const normalizedStudentId = normalizeText(studentId).toLowerCase();

  if (!normalizedStudentId) {
    return "Nama siswa belum diatur";
  }

  return (
    studentNameMap.get(normalizedStudentId) ||
    participantNameMap.get(normalizedStudentId) ||
    "Nama siswa belum diatur"
  );
}

function toPublicTeacherTaskSubmissionListItem(
  submission: {
    _id?: unknown;
    submissionId?: string;
    studentId?: string;
    submissionMode?: TaskSubmissionMode;
    submittedAt?: Date | null;
    attachment?: { fileName?: string } | null;
    driveUrl?: string;
    answerText?: string;
  },
  studentName: string,
  grade: { gradeStatus: "Belum Dinilai" | "Sudah Dinilai"; score: number | null } | null,
): PublicTeacherTaskSubmissionListItem {
  const recordId = toRecordId(submission._id) || normalizeText(submission.submissionId);

  return {
    id: recordId,
    submissionId: normalizeText(submission.submissionId),
    studentId: normalizeText(submission.studentId),
    studentName,
    submissionMode: submission.submissionMode ?? "text",
    submittedAt: submission.submittedAt?.toISOString() ?? null,
    hasAttachment: Boolean(normalizeText(submission.attachment?.fileName)),
    driveUrl: normalizeText(submission.driveUrl),
    answerTextPreview: buildAnswerTextPreview(normalizeText(submission.answerText)),
    gradeStatus: grade?.gradeStatus ?? "Belum Dinilai",
    score: grade?.score ?? null,
  };
}

function toPublicTeacherTaskSubmissionDetail(
  submission: {
    _id?: unknown;
    submissionId?: string;
    classId?: string;
    taskId?: string;
    studentId?: string;
    submissionMode?: TaskSubmissionMode;
    submittedAt?: Date | null;
    attachment?:
      | {
          fileName?: string;
          originalName?: string;
          mimeType?: string;
          size?: number;
        }
      | null;
    driveUrl?: string;
    answerText?: string;
    note?: string;
    createdAt?: Date | null;
    updatedAt?: Date | null;
  },
  studentName: string,
  grade: { gradeStatus: "Belum Dinilai" | "Sudah Dinilai"; score: number | null } | null,
): PublicTeacherTaskSubmissionDetail {
  const listItem = toPublicTeacherTaskSubmissionListItem(
    submission,
    studentName,
    grade,
  );

  return {
    ...listItem,
    classId: normalizeText(submission.classId),
    taskId: normalizeText(submission.taskId),
    answerText: normalizeText(submission.answerText),
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
    createdAt: submission.createdAt?.toISOString() ?? null,
    updatedAt: submission.updatedAt?.toISOString() ?? null,
  };
}

export const getTeacherTaskSubmissions = asyncHandler(
  async (
    req: Request<{ classId: string; taskId: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const { teacher, classGroup, participants } =
      await resolveTeacherClassDetailContext(
        req.user._id.toString(),
        req.params.classId,
      );
    const taskParam = normalizeText(req.params.taskId);

    if (!taskParam) {
      next(new AppError(404, "Tugas kelas tidak ditemukan."));
      return;
    }

    const task = await findTeacherTaskByParam(
      taskParam,
      classGroup.item.id,
      teacher._id.toString(),
    );

    if (!task) {
      next(new AppError(404, "Tugas kelas tidak ditemukan."));
      return;
    }

    const normalizedTaskId = normalizeText(task.taskId);
    const participantSubscriptionIds =
      await findActiveSubscriptionIdsForAcademicRecords({
        publicStudentIds: participants.map((participant) => participant.studentId),
      });
    const [submissions, grades] = await Promise.all([
      TaskSubmission.find({
        teacherId: teacher._id,
        classId: classGroup.item.id,
        taskId: normalizedTaskId,
        ...buildAcademicRecordSubscriptionFilter(participantSubscriptionIds),
      })
        .sort({ submittedAt: -1, updatedAt: -1, createdAt: -1 })
        .lean()
        .exec(),
      TaskGrade.find({
        teacherId: teacher._id,
        classId: classGroup.item.id,
        taskId: normalizedTaskId,
        ...buildAcademicRecordSubscriptionFilter(participantSubscriptionIds),
      })
        .select("studentId status score")
        .lean()
        .exec() as Promise<TaskSubmissionGradeLookup[]>,
    ]);
    const studentNameMap = await getStudentNameMap(
      submissions.map((submission) => normalizeText(submission.studentId)),
    );
    const participantNameMap = buildParticipantNameMap(participants);
    const gradeMap = buildGradeMap(grades);
    const submissionItems = submissions.map((submission) => {
      const studentId = normalizeText(submission.studentId);

      return toPublicTeacherTaskSubmissionListItem(
        submission,
        resolveSubmissionStudentName(
          studentId,
          studentNameMap,
          participantNameMap,
        ),
        gradeMap.get(studentId.toLowerCase()) ?? null,
      );
    });
    const gradedCount = submissionItems.filter(
      (submission) => submission.gradeStatus === "Sudah Dinilai",
    ).length;

    sendSuccess(res, {
      message: "Daftar submission tugas siswa berhasil diambil.",
      data: {
        taskId: normalizedTaskId,
        submissions: submissionItems,
        summary: {
          submittedCount: submissionItems.length,
          gradedCount,
          pendingGradeCount: Math.max(submissionItems.length - gradedCount, 0),
        },
      },
    });
  },
);

export const getTeacherTaskSubmissionDetail = asyncHandler(
  async (
    req: Request<{ classId: string; taskId: string; submissionId: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const { teacher, classGroup, participants } =
      await resolveTeacherClassDetailContext(
        req.user._id.toString(),
        req.params.classId,
      );
    const taskParam = normalizeText(req.params.taskId);
    const submissionParam = normalizeText(req.params.submissionId);

    if (!taskParam || !submissionParam) {
      next(new AppError(404, "Submission tugas siswa tidak ditemukan."));
      return;
    }

    const task = await findTeacherTaskByParam(
      taskParam,
      classGroup.item.id,
      teacher._id.toString(),
    );

    if (!task) {
      next(new AppError(404, "Tugas kelas tidak ditemukan."));
      return;
    }

    const normalizedTaskId = normalizeText(task.taskId);
    const participantSubscriptionIds =
      await findActiveSubscriptionIdsForAcademicRecords({
        publicStudentIds: participants.map((participant) => participant.studentId),
      });
    const submission = await findTeacherSubmissionByParam(
      submissionParam,
      normalizedTaskId,
      classGroup.item.id,
      teacher._id.toString(),
      participantSubscriptionIds,
    );

    if (!submission) {
      next(new AppError(404, "Submission tugas siswa tidak ditemukan."));
      return;
    }

    const [studentNameMap, grade] = await Promise.all([
      getStudentNameMap([normalizeText(submission.studentId)]),
      TaskGrade.findOne({
        teacherId: teacher._id,
        classId: classGroup.item.id,
        taskId: normalizedTaskId,
        studentId: normalizeText(submission.studentId),
        ...buildAcademicRecordSubscriptionFilter(participantSubscriptionIds),
      })
        .select("studentId status score")
        .lean()
        .exec() as Promise<TaskSubmissionGradeLookup | null>,
    ]);
    const participantNameMap = buildParticipantNameMap(participants);
    const studentId = normalizeText(submission.studentId);

    sendSuccess(res, {
      message: "Detail submission tugas siswa berhasil diambil.",
      data: {
        submission: toPublicTeacherTaskSubmissionDetail(
          submission,
          resolveSubmissionStudentName(
            studentId,
            studentNameMap,
            participantNameMap,
          ),
          grade
            ? {
                gradeStatus: toGradeStatus(grade.status),
                score:
                  toGradeStatus(grade.status) === "Sudah Dinilai"
                    ? toSafeScore(grade.score)
                    : null,
              }
            : null,
        ),
      },
    });
  },
);

export const downloadTeacherTaskSubmissionAttachment = asyncHandler(
  async (
    req: Request<{ classId: string; taskId: string; submissionId: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const { teacher, classGroup, participants } = await resolveTeacherClassDetailContext(
      req.user._id.toString(),
      req.params.classId,
    );
    const taskParam = normalizeText(req.params.taskId);
    const submissionParam = normalizeText(req.params.submissionId);

    if (!taskParam || !submissionParam) {
      next(new AppError(404, "Lampiran submission tidak ditemukan."));
      return;
    }

    const task = await findTeacherTaskByParam(
      taskParam,
      classGroup.item.id,
      teacher._id.toString(),
    );

    if (!task) {
      next(new AppError(404, "Tugas kelas tidak ditemukan."));
      return;
    }

    const participantSubscriptionIds =
      await findActiveSubscriptionIdsForAcademicRecords({
        publicStudentIds: participants.map((participant) => participant.studentId),
      });
    const submission = await findTeacherSubmissionByParam(
      submissionParam,
      normalizeText(task.taskId),
      classGroup.item.id,
      teacher._id.toString(),
      participantSubscriptionIds,
    );

    if (!submission?.attachment) {
      next(new AppError(404, "Lampiran submission tidak ditemukan."));
      return;
    }

    res.attachment(
      normalizeText(submission.attachment.originalName) ||
        normalizeText(submission.attachment.fileName),
    );
    res.type(submission.attachment.mimeType || "application/octet-stream");

    return res.sendFile(
      resolveLearningAttachmentPath(submission.attachment.storagePath),
    );
  },
);
