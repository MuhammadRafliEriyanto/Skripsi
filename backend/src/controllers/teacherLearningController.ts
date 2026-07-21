import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";

import { ClassMaterial } from "../models/ClassMaterial";
import { ClassTask } from "../models/ClassTask";
import { TaskGrade } from "../models/TaskGrade";
import { TaskSubmission } from "../models/TaskSubmission";
import asyncHandler from "../utils/asyncHandler";
import { AppError, sendSuccess } from "../utils/apiResponse";
import {
  buildCanonicalClassName,
  normalizeMaterialStatus,
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
  resolveLearningAttachmentPath,
  saveLearningAttachment,
} from "../utils/learningAttachmentStorage";
import { getNextPublicId } from "../utils/publicId";
import { resolveTeacherClassDetailContext } from "./teacherScheduleController";
import { resolveAcademicPeriodFromQuery } from "../utils/academicGrade";
import { ensureTeacherAcademicPeriodEditable } from "../utils/teacherAcademicArchive";

type UpsertClassMaterialBody = {
  meetingNumber?: number | string;
  date?: string;
  title?: string;
  description?: string;
  linkUrl?: string;
  status?: string;
  attachmentFileName?: string;
  attachmentMimeType?: string;
  attachmentFileDataBase64?: string;
  removeAttachment?: boolean | string;
};

type UpsertClassTaskBody = {
  meetingNumber?: number | string;
  title?: string;
  description?: string;
  deadline?: string;
  attachmentFileName?: string;
  attachmentMimeType?: string;
  attachmentFileDataBase64?: string;
  removeAttachment?: boolean | string;
};

function normalizePositiveInteger(value: number | string | undefined) {
  const parsedValue =
    typeof value === "number" ? value : Number.parseInt(normalizeText(value), 10);

  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return null;
  }

  return Math.trunc(parsedValue);
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(normalizeText(value));
}

function normalizeBoolean(value: boolean | string | undefined) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalizedValue = normalizeText(value).toLowerCase();
  return ["true", "1", "yes", "ya"].includes(normalizedValue);
}

function parseAttachmentPayload(
  body: Pick<
    UpsertClassMaterialBody & UpsertClassTaskBody,
    | "attachmentFileName"
    | "attachmentMimeType"
    | "attachmentFileDataBase64"
    | "removeAttachment"
  >,
) {
  const fileName = normalizeText(body.attachmentFileName);
  const mimeType = normalizeText(body.attachmentMimeType);
  const fileDataBase64 = normalizeText(body.attachmentFileDataBase64);
  const removeAttachment = normalizeBoolean(body.removeAttachment);

  if (!fileName && !mimeType && !fileDataBase64) {
    return {
      fileName: "",
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
    mimeType,
    fileBuffer,
    removeAttachment,
  };
}

async function sendTeacherAttachmentFile(
  res: Response,
  attachment: { fileName: string; mimeType: string; storagePath: string } | null,
) {
  if (!attachment) {
    throw new AppError(404, "Lampiran file tidak ditemukan.");
  }

  res.attachment(attachment.fileName);
  res.type(attachment.mimeType || "application/octet-stream");
  return res.sendFile(resolveLearningAttachmentPath(attachment.storagePath));
}

async function findTeacherMaterialByParam(
  materialId: string,
  classId: string,
  teacherId: string,
  filters?: { academicYear?: string; semester?: string },
) {
  const periodFilter: Record<string, string> = {};

  if (filters?.academicYear) periodFilter.academicYear = filters.academicYear;
  if (filters?.semester) periodFilter.semester = filters.semester;

  return ClassMaterial.findOne({
    $and: [
      {
        classId,
        teacherId,
      },
      Object.keys(periodFilter).length > 0
        ? {
            $or: [
              periodFilter,
              { academicYear: null },
              { academicYear: { $exists: false } },
            ],
          }
        : {},
      {
        $or: [
          { materialId },
          ...(Types.ObjectId.isValid(materialId) ? [{ _id: materialId }] : []),
        ],
      },
    ],
  }).exec();
}

async function findTeacherTaskByParam(
  taskId: string,
  classId: string,
  teacherId: string,
  filters?: { academicYear?: string; semester?: string },
) {
  const periodFilter: Record<string, string> = {};

  if (filters?.academicYear) periodFilter.academicYear = filters.academicYear;
  if (filters?.semester) periodFilter.semester = filters.semester;

  return ClassTask.findOne({
    $and: [
      {
        classId,
        teacherId,
      },
      Object.keys(periodFilter).length > 0
        ? {
            $or: [
              periodFilter,
              { academicYear: null },
              { academicYear: { $exists: false } },
            ],
          }
        : {},
      {
        $or: [
          { taskId },
          ...(Types.ObjectId.isValid(taskId) ? [{ _id: taskId }] : []),
        ],
      },
    ],
  }).exec();
}

export const createTeacherClassMaterial = asyncHandler(
  async (
    req: Request<{ classId: string }, Record<string, never>, UpsertClassMaterialBody>,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    if (!ensureTeacherAcademicPeriodEditable(req, next)) {
      return;
    }

    const { teacher, classGroup } = await resolveTeacherClassDetailContext(
      req.user._id.toString(),
      req.params.classId,
    );
    const meetingNumber = normalizePositiveInteger(req.body.meetingNumber);
    const date = normalizeText(req.body.date);
    const title = normalizeText(req.body.title);
    const description = normalizeText(req.body.description);
    const linkUrl = normalizeText(req.body.linkUrl);
    const status = normalizeMaterialStatus(req.body.status);
    const attachmentPayload = parseAttachmentPayload(req.body);

    if (!meetingNumber) {
      next(new AppError(400, "Pertemuan materi wajib berupa angka minimal 1."));
      return;
    }

    if (!isIsoDate(date)) {
      next(new AppError(400, "Tanggal materi wajib menggunakan format YYYY-MM-DD."));
      return;
    }

    if (!title || !description) {
      next(new AppError(400, "Judul dan deskripsi materi wajib diisi."));
      return;
    }

    if (!status) {
      next(new AppError(400, "Status materi tidak valid."));
      return;
    }

    if (!attachmentPayload) {
      next(
        new AppError(
          400,
          `Lampiran materi tidak valid atau melebihi batas ${getAttachmentSizeLimitLabel()}.`,
        ),
      );
      return;
    }

    const materialId = await getNextPublicId(
      ClassMaterial,
      "materialId",
      "MAT",
    );
    const attachment =
      attachmentPayload.fileBuffer && attachmentPayload.fileName
        ? await saveLearningAttachment({
            kind: "materials",
            recordId: materialId,
            fileName: attachmentPayload.fileName,
            mimeType: attachmentPayload.mimeType,
            fileBuffer: attachmentPayload.fileBuffer,
          })
        : null;
    const period = resolveAcademicPeriodFromQuery(req.query);
    const material = await ClassMaterial.create({
      materialId,
      classId: classGroup.item.id,
      teacherId: teacher._id,
      className: classGroup.item.className,
      canonicalClassName: buildCanonicalClassName(classGroup.item.className),
      subject: classGroup.item.subject,
      branch: classGroup.item.branch,
      room: classGroup.item.room,
      meetingNumber,
      date,
      title,
      description,
      linkUrl,
      attachment,
      status,
      academicYear: period.academicYear,
      semester: period.semester,
    });

    sendSuccess(res, {
      statusCode: 201,
      message: "Materi kelas berhasil disimpan.",
      data: {
        material: toPublicClassMaterial(material),
      },
    });
  },
);

export const updateTeacherClassMaterial = asyncHandler(
  async (
    req: Request<
      { classId: string; materialId: string },
      Record<string, never>,
      UpsertClassMaterialBody
    >,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    if (!ensureTeacherAcademicPeriodEditable(req, next)) {
      return;
    }

    const { teacher, classGroup } = await resolveTeacherClassDetailContext(
      req.user._id.toString(),
      req.params.classId,
    );
    const materialId = normalizeText(req.params.materialId);

    if (!materialId) {
      next(new AppError(404, "Materi kelas tidak ditemukan."));
      return;
    }

    const material = await findTeacherMaterialByParam(
      materialId,
      classGroup.item.id,
      teacher._id.toString(),
      resolveAcademicPeriodFromQuery(req.query),
    );

    if (!material) {
      next(new AppError(404, "Materi kelas tidak ditemukan."));
      return;
    }

    const meetingNumber = normalizePositiveInteger(req.body.meetingNumber);
    const date = normalizeText(req.body.date);
    const title = normalizeText(req.body.title);
    const description = normalizeText(req.body.description);
    const linkUrl = normalizeText(req.body.linkUrl);
    const status = normalizeMaterialStatus(req.body.status);
    const attachmentPayload = parseAttachmentPayload(req.body);

    if (!meetingNumber) {
      next(new AppError(400, "Pertemuan materi wajib berupa angka minimal 1."));
      return;
    }

    if (!isIsoDate(date)) {
      next(new AppError(400, "Tanggal materi wajib menggunakan format YYYY-MM-DD."));
      return;
    }

    if (!title || !description) {
      next(new AppError(400, "Judul dan deskripsi materi wajib diisi."));
      return;
    }

    if (!status) {
      next(new AppError(400, "Status materi tidak valid."));
      return;
    }

    if (!attachmentPayload) {
      next(
        new AppError(
          400,
          `Lampiran materi tidak valid atau melebihi batas ${getAttachmentSizeLimitLabel()}.`,
        ),
      );
      return;
    }

    material.className = classGroup.item.className;
    material.canonicalClassName = buildCanonicalClassName(classGroup.item.className);
    material.subject = classGroup.item.subject;
    material.branch = classGroup.item.branch;
    material.room = classGroup.item.room;
    material.meetingNumber = meetingNumber;
    material.date = date;
    material.title = title;
    material.description = description;
    material.linkUrl = linkUrl;
    if (attachmentPayload.removeAttachment && material.attachment?.storagePath) {
      await deleteLearningAttachment(material.attachment.storagePath);
      material.attachment = null;
    }
    if (attachmentPayload.fileBuffer && attachmentPayload.fileName) {
      if (material.attachment?.storagePath) {
        await deleteLearningAttachment(material.attachment.storagePath);
      }
      material.attachment = await saveLearningAttachment({
        kind: "materials",
        recordId: normalizeText(material.materialId),
        fileName: attachmentPayload.fileName,
        mimeType: attachmentPayload.mimeType,
        fileBuffer: attachmentPayload.fileBuffer,
      });
    }
    material.status = status;
    await material.save();

    sendSuccess(res, {
      message: "Materi kelas berhasil diperbarui.",
      data: {
        material: toPublicClassMaterial(material),
      },
    });
  },
);

export const deleteTeacherClassMaterial = asyncHandler(
  async (
    req: Request<{ classId: string; materialId: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    if (!ensureTeacherAcademicPeriodEditable(req, next)) {
      return;
    }

    const { teacher, classGroup } = await resolveTeacherClassDetailContext(
      req.user._id.toString(),
      req.params.classId,
    );
    const materialId = normalizeText(req.params.materialId);

    if (!materialId) {
      next(new AppError(404, "Materi kelas tidak ditemukan."));
      return;
    }

    const material = await findTeacherMaterialByParam(
      materialId,
      classGroup.item.id,
      teacher._id.toString(),
      resolveAcademicPeriodFromQuery(req.query),
    );

    if (!material) {
      next(new AppError(404, "Materi kelas tidak ditemukan."));
      return;
    }

    if (material.attachment?.storagePath) {
      await deleteLearningAttachment(material.attachment.storagePath);
    }
    await material.deleteOne();

    sendSuccess(res, {
      message: "Materi kelas berhasil dihapus.",
      data: {
        materialId: normalizeText(material.materialId),
      },
    });
  },
);

export const createTeacherClassTask = asyncHandler(
  async (
    req: Request<{ classId: string }, Record<string, never>, UpsertClassTaskBody>,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    if (!ensureTeacherAcademicPeriodEditable(req, next)) {
      return;
    }

    const { teacher, classGroup } = await resolveTeacherClassDetailContext(
      req.user._id.toString(),
      req.params.classId,
    );
    const meetingNumber = normalizePositiveInteger(req.body.meetingNumber);
    const title = normalizeText(req.body.title);
    const description = normalizeText(req.body.description);
    const deadline = normalizeText(req.body.deadline);
    const attachmentPayload = parseAttachmentPayload(req.body);

    if (!meetingNumber) {
      next(new AppError(400, "Pertemuan tugas wajib berupa angka minimal 1."));
      return;
    }

    if (!isIsoDate(deadline)) {
      next(new AppError(400, "Deadline tugas wajib menggunakan format YYYY-MM-DD."));
      return;
    }

    if (!title || !description) {
      next(new AppError(400, "Judul dan deskripsi tugas wajib diisi."));
      return;
    }

    if (!attachmentPayload) {
      next(
        new AppError(
          400,
          `Lampiran tugas tidak valid atau melebihi batas ${getAttachmentSizeLimitLabel()}.`,
        ),
      );
      return;
    }

    const taskId = await getNextPublicId(
      ClassTask,
      "taskId",
      "TSK",
    );
    const attachment =
      attachmentPayload.fileBuffer && attachmentPayload.fileName
        ? await saveLearningAttachment({
            kind: "tasks",
            recordId: taskId,
            fileName: attachmentPayload.fileName,
            mimeType: attachmentPayload.mimeType,
            fileBuffer: attachmentPayload.fileBuffer,
          })
        : null;
    const period = resolveAcademicPeriodFromQuery(req.query);
    const task = await ClassTask.create({
      taskId,
      classId: classGroup.item.id,
      teacherId: teacher._id,
      className: classGroup.item.className,
      canonicalClassName: buildCanonicalClassName(classGroup.item.className),
      subject: classGroup.item.subject,
      branch: classGroup.item.branch,
      room: classGroup.item.room,
      meetingNumber,
      title,
      description,
      deadline,
      attachment,
      submittedCount: 0,
      reviewStatus: "Belum Ada Pengumpulan",
      academicYear: period.academicYear,
      semester: period.semester,
    });
    const syncedTaskMetrics = await syncTeacherTaskMetrics(
      teacher._id.toString(),
      classGroup.item.id,
      normalizeText(task.taskId),
    );
    if (syncedTaskMetrics) {
      task.submittedCount = syncedTaskMetrics.submittedCount;
      task.reviewStatus = syncedTaskMetrics.reviewStatus;
    }

    sendSuccess(res, {
      statusCode: 201,
      message: "Tugas kelas berhasil disimpan.",
      data: {
        task: toPublicClassTask(task),
      },
    });
  },
);

export const updateTeacherClassTask = asyncHandler(
  async (
    req: Request<
      { classId: string; taskId: string },
      Record<string, never>,
      UpsertClassTaskBody
    >,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    if (!ensureTeacherAcademicPeriodEditable(req, next)) {
      return;
    }

    const { teacher, classGroup } = await resolveTeacherClassDetailContext(
      req.user._id.toString(),
      req.params.classId,
    );
    const taskId = normalizeText(req.params.taskId);

    if (!taskId) {
      next(new AppError(404, "Tugas kelas tidak ditemukan."));
      return;
    }

    const task = await findTeacherTaskByParam(
      taskId,
      classGroup.item.id,
      teacher._id.toString(),
      resolveAcademicPeriodFromQuery(req.query),
    );

    if (!task) {
      next(new AppError(404, "Tugas kelas tidak ditemukan."));
      return;
    }

    const meetingNumber = normalizePositiveInteger(req.body.meetingNumber);
    const title = normalizeText(req.body.title);
    const description = normalizeText(req.body.description);
    const deadline = normalizeText(req.body.deadline);
    const attachmentPayload = parseAttachmentPayload(req.body);

    if (!meetingNumber) {
      next(new AppError(400, "Pertemuan tugas wajib berupa angka minimal 1."));
      return;
    }

    if (!isIsoDate(deadline)) {
      next(new AppError(400, "Deadline tugas wajib menggunakan format YYYY-MM-DD."));
      return;
    }

    if (!title || !description) {
      next(new AppError(400, "Judul dan deskripsi tugas wajib diisi."));
      return;
    }

    if (!attachmentPayload) {
      next(
        new AppError(
          400,
          `Lampiran tugas tidak valid atau melebihi batas ${getAttachmentSizeLimitLabel()}.`,
        ),
      );
      return;
    }

    task.className = classGroup.item.className;
    task.canonicalClassName = buildCanonicalClassName(classGroup.item.className);
    task.subject = classGroup.item.subject;
    task.branch = classGroup.item.branch;
    task.room = classGroup.item.room;
    task.meetingNumber = meetingNumber;
    task.title = title;
    task.description = description;
    task.deadline = deadline;
    if (attachmentPayload.removeAttachment && task.attachment?.storagePath) {
      await deleteLearningAttachment(task.attachment.storagePath);
      task.attachment = null;
    }
    if (attachmentPayload.fileBuffer && attachmentPayload.fileName) {
      if (task.attachment?.storagePath) {
        await deleteLearningAttachment(task.attachment.storagePath);
      }
      task.attachment = await saveLearningAttachment({
        kind: "tasks",
        recordId: normalizeText(task.taskId),
        fileName: attachmentPayload.fileName,
        mimeType: attachmentPayload.mimeType,
        fileBuffer: attachmentPayload.fileBuffer,
      });
    }
    await task.save();
    const syncedTaskMetrics = await syncTeacherTaskMetrics(
      teacher._id.toString(),
      classGroup.item.id,
      normalizeText(task.taskId),
    );
    if (syncedTaskMetrics) {
      task.submittedCount = syncedTaskMetrics.submittedCount;
      task.reviewStatus = syncedTaskMetrics.reviewStatus;
    }

    sendSuccess(res, {
      message: "Tugas kelas berhasil diperbarui.",
      data: {
        task: toPublicClassTask(task),
      },
    });
  },
);

export const deleteTeacherClassTask = asyncHandler(
  async (
    req: Request<{ classId: string; taskId: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    if (!ensureTeacherAcademicPeriodEditable(req, next)) {
      return;
    }

    const { teacher, classGroup } = await resolveTeacherClassDetailContext(
      req.user._id.toString(),
      req.params.classId,
    );
    const taskId = normalizeText(req.params.taskId);

    if (!taskId) {
      next(new AppError(404, "Tugas kelas tidak ditemukan."));
      return;
    }

    const task = await findTeacherTaskByParam(
      taskId,
      classGroup.item.id,
      teacher._id.toString(),
      resolveAcademicPeriodFromQuery(req.query),
    );

    if (!task) {
      next(new AppError(404, "Tugas kelas tidak ditemukan."));
      return;
    }

    if (task.attachment?.storagePath) {
      await deleteLearningAttachment(task.attachment.storagePath);
    }
    const normalizedTaskId = normalizeText(task.taskId);
    const submissions = await TaskSubmission.find({
      teacherId: teacher._id,
      classId: classGroup.item.id,
      taskId: normalizedTaskId,
    })
      .select("attachment.storagePath")
      .lean()
      .exec();

    await Promise.all(
      submissions.map((submission) =>
        submission.attachment?.storagePath
          ? deleteLearningAttachment(submission.attachment.storagePath)
          : Promise.resolve(),
      ),
    );
    await Promise.all([
      TaskSubmission.deleteMany({
        teacherId: teacher._id,
        classId: classGroup.item.id,
        taskId: normalizedTaskId,
      }).exec(),
      TaskGrade.deleteMany({
        teacherId: teacher._id,
        classId: classGroup.item.id,
        taskId: normalizedTaskId,
      }).exec(),
    ]);
    await task.deleteOne();

    sendSuccess(res, {
      message: "Tugas kelas berhasil dihapus.",
      data: {
        taskId: normalizeText(task.taskId),
      },
    });
  },
);

export const downloadTeacherClassMaterialAttachment = asyncHandler(
  async (
    req: Request<{ classId: string; materialId: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const { teacher, classGroup } = await resolveTeacherClassDetailContext(
      req.user._id.toString(),
      req.params.classId,
    );
    const materialId = normalizeText(req.params.materialId);

    if (!materialId) {
      next(new AppError(404, "Materi kelas tidak ditemukan."));
      return;
    }

    const material = await findTeacherMaterialByParam(
      materialId,
      classGroup.item.id,
      teacher._id.toString(),
    );

    if (!material || !material.attachment) {
      next(new AppError(404, "Lampiran materi tidak ditemukan."));
      return;
    }

    await sendTeacherAttachmentFile(res, material.attachment);
  },
);

export const downloadTeacherClassTaskAttachment = asyncHandler(
  async (
    req: Request<{ classId: string; taskId: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const { teacher, classGroup } = await resolveTeacherClassDetailContext(
      req.user._id.toString(),
      req.params.classId,
    );
    const taskId = normalizeText(req.params.taskId);

    if (!taskId) {
      next(new AppError(404, "Tugas kelas tidak ditemukan."));
      return;
    }

    const task = await findTeacherTaskByParam(
      taskId,
      classGroup.item.id,
      teacher._id.toString(),
    );

    if (!task || !task.attachment) {
      next(new AppError(404, "Lampiran tugas tidak ditemukan."));
      return;
    }

    await sendTeacherAttachmentFile(res, task.attachment);
  },
);
