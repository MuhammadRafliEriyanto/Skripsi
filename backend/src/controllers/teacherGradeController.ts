import type { NextFunction, Request, Response } from "express";
import { Types, type FilterQuery } from "mongoose";

import { AcademicGrade, type IAcademicGrade } from "../models/AcademicGrade";
import { ClassTask } from "../models/ClassTask";
import { TaskGrade } from "../models/TaskGrade";
import asyncHandler from "../utils/asyncHandler";
import { AppError, sendSuccess } from "../utils/apiResponse";
import {
  getTeacherClassTaskGrades,
  normalizeTaskGradeStatus,
  normalizeText,
  syncTeacherTaskMetrics,
  toPublicTaskGrade,
} from "../utils/classroomLearning";
import { getNextPublicId } from "../utils/publicId";
import {
  getAcademicGradeScheme,
  getCurrentAcademicPeriod,
  toPublicAcademicGrade,
} from "../utils/academicGrade";
import { resolveTeacherClassDetailContext } from "./teacherScheduleController";
import {
  isStudentAcademicTaskAvailable,
  parseValidDate,
} from "../utils/studentAcademicStatus";
import {
  buildAcademicRecordSubscriptionFilter,
  findActiveSubscriptionIdForAcademicRecord,
  findActiveSubscriptionIdsForAcademicRecords,
} from "../utils/subscription";

type UpsertTaskGradeBody = {
  taskId?: string;
  studentId?: string;
  score?: number | string;
  note?: string;
  status?: string;
};

function normalizeScore(value: number | string | undefined) {
  const parsedValue =
    typeof value === "number" ? value : Number.parseFloat(normalizeText(value));

  if (!Number.isFinite(parsedValue) || parsedValue < 0 || parsedValue > 100) {
    return null;
  }

  return Math.round(parsedValue);
}

function getParticipantAcademicJoinedAt(
  participants: Array<{ studentId: string; academicJoinedAt?: string | null }>,
  studentId: string,
) {
  const participant = participants.find(
    (item) =>
      normalizeText(item.studentId).toLowerCase() ===
      normalizeText(studentId).toLowerCase(),
  );

  if (!participant) {
    return null;
  }

  return parseValidDate(participant.academicJoinedAt);
}

function isAcademicGradeVisibleForStudent(
  grade: {
    studentId?: string;
    evaluatedAt?: Date | null;
    updatedAt?: Date | null;
    createdAt?: Date | null;
  },
  participants: Array<{ studentId: string; academicJoinedAt?: string | null }>,
) {
  const academicJoinedAt = getParticipantAcademicJoinedAt(
    participants,
    normalizeText(grade.studentId),
  );
  const gradeDate = parseValidDate(
    grade.evaluatedAt ?? grade.updatedAt ?? grade.createdAt,
  );

  if (!academicJoinedAt || !gradeDate) {
    return false;
  }

  return gradeDate.getTime() >= academicJoinedAt.getTime();
}

function isTaskGradeVisibleForStudent(
  grade: { studentId?: string; taskId?: string },
  tasksByTaskId: Map<
    string,
    { publishAt?: Date | string | null; createdAt?: Date | string | null }
  >,
  participants: Array<{ studentId: string; academicJoinedAt?: string | null }>,
) {
  const academicJoinedAt = getParticipantAcademicJoinedAt(
    participants,
    normalizeText(grade.studentId),
  );
  const task = tasksByTaskId.get(normalizeText(grade.taskId));

  if (!academicJoinedAt || !task) {
    return false;
  }

  return isStudentAcademicTaskAvailable(task, academicJoinedAt);
}

function ensureTaskGradeCanBeAssignedToStudent(params: {
  task: { publishAt?: Date | string | null; createdAt?: Date | string | null };
  participants: Array<{ studentId: string; academicJoinedAt?: string | null }>;
  studentId: string;
}) {
  const academicJoinedAt = getParticipantAcademicJoinedAt(
    params.participants,
    params.studentId,
  );

  return Boolean(
    academicJoinedAt &&
      isStudentAcademicTaskAvailable(params.task, academicJoinedAt),
  );
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

async function findTeacherGradeByParam(
  gradeId: string,
  classId: string,
  teacherId: string,
) {
  return TaskGrade.findOne({
    classId,
    teacherId,
    $or: [
      { gradeId },
      ...(Types.ObjectId.isValid(gradeId) ? [{ _id: gradeId }] : []),
    ],
  }).exec();
}

export const getTeacherClassGrades = asyncHandler(
  async (
    req: Request<{ classId: string }>,
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
    const currentPeriod = getCurrentAcademicPeriod();
    const academicYear =
      typeof req.query.academicYear === "string" && req.query.academicYear
        ? req.query.academicYear
        : currentPeriod.academicYear;
    const semester =
      typeof req.query.semester === "string" && req.query.semester
        ? req.query.semester
        : currentPeriod.semester;
    const participantSubscriptionIds =
      await findActiveSubscriptionIdsForAcademicRecords({
        publicStudentIds: participants.map((participant) => participant.studentId),
      });

    const academicGradeQuery: FilterQuery<IAcademicGrade> = {
      teacherId: teacher._id,
      classId: classGroup.item.id,
      academicYear,
      semester,
      ...buildAcademicRecordSubscriptionFilter(participantSubscriptionIds),
    };

    const [grades, academicGrades, tasks] = await Promise.all([
      getTeacherClassTaskGrades(
        teacher._id.toString(),
        classGroup.item.id,
        participantSubscriptionIds,
      ),
      AcademicGrade.find(academicGradeQuery)
        .sort({ updatedAt: -1, createdAt: -1 })
        .lean()
        .exec(),
      ClassTask.find({
        $and: [
          {
            teacherId: teacher._id,
            classId: classGroup.item.id,
          },
          {
            $or: [
              { academicYear, semester },
              { academicYear: null },
              { academicYear: { $exists: false } },
            ],
          },
        ],
      })
        .select("taskId publishAt createdAt")
        .lean()
        .exec(),
    ]);
    const tasksByTaskId = new Map(
      tasks.map((task) => [normalizeText(task.taskId), task] as const),
    );
    const visibleGrades = grades.filter((grade) =>
      isTaskGradeVisibleForStudent(grade, tasksByTaskId, participants),
    );
    const visibleAcademicGrades = academicGrades.filter((grade) =>
      isAcademicGradeVisibleForStudent(grade, participants),
    );

    const period = getCurrentAcademicPeriod();
    sendSuccess(res, {
      message: "Data nilai kelas berhasil diambil.",
      data: {
        grades: visibleGrades.map(toPublicTaskGrade),
        academicGrades: visibleAcademicGrades.map(toPublicAcademicGrade),
        scheme: getAcademicGradeScheme(classGroup.className),
        period,
      },
    });
  },
);

export const createTeacherClassGrade = asyncHandler(
  async (
    req: Request<{ classId: string }, Record<string, never>, UpsertTaskGradeBody>,
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
    const taskParam = normalizeText(req.body.taskId);
    const studentId = normalizeText(req.body.studentId);
    const score = normalizeScore(req.body.score);
    const note = normalizeText(req.body.note);
    const status =
      normalizeTaskGradeStatus(req.body.status) ?? "Sudah Dinilai";

    if (!taskParam) {
      next(new AppError(400, "Task ID wajib dikirim."));
      return;
    }

    if (!studentId) {
      next(new AppError(400, "Student ID wajib dikirim."));
      return;
    }

    if (score === null) {
      next(new AppError(400, "Nilai tugas wajib berupa angka 0 sampai 100."));
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

    const isParticipantInClass = participants.some(
      (participant) =>
        normalizeText(participant.studentId).toLowerCase() ===
        studentId.toLowerCase(),
    );

    if (!isParticipantInClass) {
      next(new AppError(404, "Siswa kelas untuk penilaian tidak ditemukan."));
      return;
    }

    if (
      !ensureTaskGradeCanBeAssignedToStudent({
        task,
        participants,
        studentId,
      })
    ) {
      next(new AppError(404, "Tugas tidak berlaku untuk siswa ini."));
      return;
    }

    const normalizedTaskId = normalizeText(task.taskId);
    const existingGrade = await TaskGrade.findOne({
      teacherId: teacher._id,
      classId: classGroup.item.id,
      taskId: normalizedTaskId,
      studentId,
    }).exec();

    if (existingGrade) {
      next(
        new AppError(
          409,
          "Nilai tugas siswa untuk tugas ini sudah ada. Gunakan update nilai.",
        ),
      );
      return;
    }

    const gradeId = await getNextPublicId(TaskGrade, "gradeId", "GRD");
    const subscriptionId = await findActiveSubscriptionIdForAcademicRecord({
      publicStudentId: studentId,
    });
    const grade = await TaskGrade.create({
      gradeId,
      teacherId: teacher._id,
      classId: classGroup.item.id,
      taskId: normalizedTaskId,
      studentId,
      subscriptionId,
      score,
      note,
      status,
      gradedAt: status === "Sudah Dinilai" ? new Date() : null,
    });

    await syncTeacherTaskMetrics(
      teacher._id.toString(),
      classGroup.item.id,
      normalizedTaskId,
    );

    sendSuccess(res, {
      statusCode: 201,
      message: "Nilai tugas siswa berhasil disimpan.",
      data: {
        grade: toPublicTaskGrade(grade),
      },
    });
  },
);

export const updateTeacherClassGrade = asyncHandler(
  async (
    req: Request<
      { classId: string; gradeId: string },
      Record<string, never>,
      UpsertTaskGradeBody
    >,
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
    const gradeParam = normalizeText(req.params.gradeId);

    if (!gradeParam) {
      next(new AppError(404, "Nilai tugas siswa tidak ditemukan."));
      return;
    }

    const grade = await findTeacherGradeByParam(
      gradeParam,
      classGroup.item.id,
      teacher._id.toString(),
    );

    if (!grade) {
      next(new AppError(404, "Nilai tugas siswa tidak ditemukan."));
      return;
    }

    const nextTaskParam = normalizeText(req.body.taskId) || grade.taskId;
    const nextStudentId = normalizeText(req.body.studentId) || grade.studentId;
    const score =
      req.body.score === undefined ? grade.score : normalizeScore(req.body.score);
    const note =
      req.body.note === undefined ? normalizeText(grade.note) : normalizeText(req.body.note);
    const status =
      req.body.status === undefined
        ? grade.status
        : normalizeTaskGradeStatus(req.body.status);

    if (!nextTaskParam) {
      next(new AppError(400, "Task ID wajib dikirim."));
      return;
    }

    if (!nextStudentId) {
      next(new AppError(400, "Student ID wajib dikirim."));
      return;
    }

    if (score === null) {
      next(new AppError(400, "Nilai tugas wajib berupa angka 0 sampai 100."));
      return;
    }

    if (!status) {
      next(new AppError(400, "Status penilaian tugas tidak valid."));
      return;
    }

    const nextTask = await findTeacherTaskByParam(
      nextTaskParam,
      classGroup.item.id,
      teacher._id.toString(),
    );

    if (!nextTask) {
      next(new AppError(404, "Tugas kelas tidak ditemukan."));
      return;
    }

    const isParticipantInClass = participants.some(
      (participant) =>
        normalizeText(participant.studentId).toLowerCase() ===
        nextStudentId.toLowerCase(),
    );

    if (!isParticipantInClass) {
      next(new AppError(404, "Siswa kelas untuk penilaian tidak ditemukan."));
      return;
    }

    if (
      !ensureTaskGradeCanBeAssignedToStudent({
        task: nextTask,
        participants,
        studentId: nextStudentId,
      })
    ) {
      next(new AppError(404, "Tugas tidak berlaku untuk siswa ini."));
      return;
    }

    const normalizedTaskId = normalizeText(nextTask.taskId);
    const previousTaskId = normalizeText(grade.taskId);

    const duplicateGrade = await TaskGrade.findOne({
      teacherId: teacher._id,
      classId: classGroup.item.id,
      taskId: normalizedTaskId,
      studentId: nextStudentId,
      _id: {
        $ne: grade._id,
      },
    }).exec();

    if (duplicateGrade) {
      next(
        new AppError(
          409,
          "Nilai untuk siswa dan tugas yang dipilih sudah tersimpan.",
        ),
      );
      return;
    }

    grade.taskId = normalizedTaskId;
    grade.studentId = nextStudentId;
    grade.score = score;
    grade.note = note;
    grade.status = status;
    grade.gradedAt = status === "Sudah Dinilai" ? new Date() : null;
    await grade.save();

    await syncTeacherTaskMetrics(
      teacher._id.toString(),
      classGroup.item.id,
      normalizedTaskId,
    );

    if (previousTaskId && previousTaskId !== normalizedTaskId) {
      await syncTeacherTaskMetrics(
        teacher._id.toString(),
        classGroup.item.id,
        previousTaskId,
      );
    }

    sendSuccess(res, {
      message: "Nilai tugas siswa berhasil diperbarui.",
      data: {
        grade: toPublicTaskGrade(grade),
      },
    });
  },
);
