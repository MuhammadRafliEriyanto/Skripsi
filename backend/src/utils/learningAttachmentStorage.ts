import type { Response } from "express";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import mongoose from "mongoose";
import { GridFSBucket, ObjectId } from "mongodb";

type LearningAttachmentKind = "materials" | "tasks" | "task-submissions";

export type StoredLearningAttachment = {
  fileName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  originalName: string;
};

const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
const GRIDFS_STORAGE_PREFIX = "gridfs:";
const GRIDFS_BUCKET_NAME = "learningAttachments";

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function sanitizeFileName(fileName: string) {
  const normalizedFileName = path.basename(normalizeText(fileName));
  return normalizedFileName.replace(/[^a-zA-Z0-9._-]+/g, "-") || "attachment";
}

function buildStorageRoot() {
  const configuredStorageDirectory = normalizeText(
    process.env.LEARNING_ATTACHMENT_STORAGE_DIR,
  );

  if (configuredStorageDirectory) {
    return path.resolve(configuredStorageDirectory);
  }

  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(os.tmpdir(), "bimbel-learning-attachments");
  }

  return path.resolve(process.cwd(), "storage", "learning-attachments");
}

function buildRecordDirectory(kind: LearningAttachmentKind, recordId: string) {
  return path.join(buildStorageRoot(), kind, recordId);
}

export function decodeAttachmentBase64(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return null;
  }

  try {
    return Buffer.from(normalizedValue, "base64");
  } catch {
    return null;
  }
}

export function isAttachmentSizeAllowed(size: number) {
  return Number.isFinite(size) && size > 0 && size <= MAX_ATTACHMENT_SIZE_BYTES;
}

export function getAttachmentSizeLimitLabel() {
  return "10 MB";
}

function shouldUseGridFsStorage() {
  const configuredDriver = normalizeText(
    process.env.LEARNING_ATTACHMENT_STORAGE_DRIVER,
  ).toLowerCase();

  return configuredDriver !== "filesystem";
}

function getGridFsBucket() {
  const db = mongoose.connection.db;

  if (!db) {
    throw new Error("Database belum siap untuk menyimpan lampiran.");
  }

  return new GridFSBucket(db, {
    bucketName: GRIDFS_BUCKET_NAME,
  });
}

function getGridFsObjectId(storagePath: string) {
  const fileId = normalizeText(storagePath).replace(GRIDFS_STORAGE_PREFIX, "");

  if (!ObjectId.isValid(fileId)) {
    return null;
  }

  return new ObjectId(fileId);
}

function isGridFsStoragePath(storagePath: string | null | undefined) {
  return normalizeText(storagePath).startsWith(GRIDFS_STORAGE_PREFIX);
}

async function saveLearningAttachmentToGridFs(params: {
  kind: LearningAttachmentKind;
  recordId: string;
  fileName: string;
  originalName?: string;
  mimeType: string;
  fileBuffer: Buffer;
}): Promise<StoredLearningAttachment> {
  const bucket = getGridFsBucket();
  const sanitizedFileName = sanitizeFileName(params.fileName);
  const originalName =
    path.basename(normalizeText(params.originalName || params.fileName)) ||
    sanitizedFileName;
  const storedFileName = `${params.kind}/${params.recordId}/${Date.now()}-${sanitizedFileName}`;
  const uploadStream = bucket.openUploadStream(storedFileName, {
    metadata: {
      kind: params.kind,
      recordId: params.recordId,
      originalName,
      mimeType: normalizeText(params.mimeType) || "application/octet-stream",
      size: params.fileBuffer.byteLength,
    },
  });

  await new Promise<void>((resolve, reject) => {
    uploadStream.once("finish", resolve);
    uploadStream.once("error", reject);
    uploadStream.end(params.fileBuffer);
  });

  return {
    fileName: sanitizedFileName,
    mimeType: normalizeText(params.mimeType) || "application/octet-stream",
    size: params.fileBuffer.byteLength,
    storagePath: `${GRIDFS_STORAGE_PREFIX}${uploadStream.id.toString()}`,
    originalName,
  };
}

async function saveLearningAttachmentToFileSystem(params: {
  kind: LearningAttachmentKind;
  recordId: string;
  fileName: string;
  originalName?: string;
  mimeType: string;
  fileBuffer: Buffer;
}): Promise<StoredLearningAttachment> {
  const recordDirectory = buildRecordDirectory(params.kind, params.recordId);
  const sanitizedFileName = sanitizeFileName(params.fileName);
  const storedFileName = `${Date.now()}-${sanitizedFileName}`;
  const absolutePath = path.join(recordDirectory, storedFileName);

  await fs.rm(recordDirectory, { recursive: true, force: true });
  await fs.mkdir(recordDirectory, { recursive: true });
  await fs.writeFile(absolutePath, params.fileBuffer);

  return {
    fileName: sanitizeFileName(params.fileName),
    mimeType: normalizeText(params.mimeType) || "application/octet-stream",
    size: params.fileBuffer.byteLength,
    storagePath: path.relative(process.cwd(), absolutePath),
    originalName:
      path.basename(normalizeText(params.originalName || params.fileName)) ||
      sanitizeFileName(params.fileName),
  };
}

export async function saveLearningAttachment(params: {
  kind: LearningAttachmentKind;
  recordId: string;
  fileName: string;
  originalName?: string;
  mimeType: string;
  fileBuffer: Buffer;
}): Promise<StoredLearningAttachment> {
  return shouldUseGridFsStorage()
    ? saveLearningAttachmentToGridFs(params)
    : saveLearningAttachmentToFileSystem(params);
}

export async function deleteLearningAttachment(
  storagePath: string | null | undefined,
) {
  const normalizedStoragePath = normalizeText(storagePath);

  if (!normalizedStoragePath) {
    return;
  }

  if (isGridFsStoragePath(normalizedStoragePath)) {
    const objectId = getGridFsObjectId(normalizedStoragePath);

    if (objectId) {
      await getGridFsBucket().delete(objectId).catch(() => undefined);
    }

    return;
  }

  const absolutePath = resolveLearningAttachmentPath(normalizedStoragePath);
  const parentDirectory = path.dirname(absolutePath);

  await fs.rm(absolutePath, { force: true }).catch(() => undefined);
  await fs.rm(parentDirectory, { recursive: true, force: true }).catch(
    () => undefined,
  );
}

export function resolveLearningAttachmentPath(storagePath: string) {
  const normalizedStoragePath = normalizeText(storagePath);

  return path.isAbsolute(normalizedStoragePath)
    ? normalizedStoragePath
    : path.resolve(process.cwd(), normalizedStoragePath);
}

async function sendFileSystemAttachment(
  res: Response,
  storagePath: string,
) {
  await new Promise<void>((resolve, reject) => {
    res.sendFile(resolveLearningAttachmentPath(storagePath), (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function sendGridFsAttachment(res: Response, storagePath: string) {
  const objectId = getGridFsObjectId(storagePath);

  if (!objectId) {
    throw new Error("Lampiran GridFS tidak valid.");
  }

  const downloadStream = getGridFsBucket().openDownloadStream(objectId);

  await new Promise<void>((resolve, reject) => {
    downloadStream.once("error", reject);
    res.once("finish", resolve);
    res.once("close", resolve);
    downloadStream.pipe(res);
  });
}

export async function sendLearningAttachmentFile(
  res: Response,
  attachment: {
    fileName: string;
    originalName?: string | null;
    mimeType: string;
    storagePath: string;
  },
) {
  res.attachment(
    normalizeText(attachment.originalName) || normalizeText(attachment.fileName),
  );
  res.type(attachment.mimeType || "application/octet-stream");

  if (isGridFsStoragePath(attachment.storagePath)) {
    await sendGridFsAttachment(res, attachment.storagePath);
    return;
  }

  await sendFileSystemAttachment(res, attachment.storagePath);
}
