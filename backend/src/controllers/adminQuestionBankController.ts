import type { Request, Response, NextFunction } from "express";
import { QuestionBankItem } from "../models/QuestionBankItem";
import asyncHandler from "../utils/asyncHandler";
import { AppError, sendSuccess } from "../utils/apiResponse";
import { uploadQuestionImage } from "../lib/cloudinary";
import { createQuestionId } from "../services/question-bank/questionId";
import { normalizeQuestionDraft, questionFingerprint } from "../services/question-bank/questionDraft";
import { createQuestionBankTemplate, parseQuestionWorkbook } from "../services/question-bank/excelImport";
import { prepareQuestionImport, type ImportCommitInput } from "../services/question-bank/importCommit";
import { extractPdfPreview } from "../services/question-bank/pdfExtractor";
import { prepareBulkQuestionBankStatus } from "../services/question-bank/bulkStatus";

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function validationMessage(errors: Array<{ message: string }>): string {
  return errors.map((error) => error.message).join(" ");
}

export const getAdminQuestionBank = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
  const status = typeof req.query.status === "string" ? req.query.status : "all";
  const filter: Record<string, unknown> = status === "all" ? {} : { status };
  for (const key of ["program", "className", "subject", "difficulty", "createdByName"]) {
    if (typeof req.query[key] === "string" && req.query[key]) filter[key] = new RegExp(req.query[key] as string, "i");
  }
  const search = typeof req.query.search === "string" ? req.query.search : "";
  if (search) filter.$or = [{ questionId: new RegExp(search, "i") }, { questionText: new RegExp(search, "i") }];
  const [items, total, stats] = await Promise.all([
    QuestionBankItem.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    QuestionBankItem.countDocuments(filter),
    QuestionBankItem.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);
  const counts = Object.fromEntries(stats.map((row) => [row._id, row.count]));
  sendSuccess(res, { data: { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }, stats: { approved: counts.approved ?? 0, review: counts.review ?? 0, rejected: counts.rejected ?? 0, draft: counts.draft ?? 0 } } });
});

export const updateAdminQuestionBankStatus = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const status = req.body?.status;
  if (!["draft", "review", "approved", "rejected", "archived"].includes(status)) return next(new AppError(400, "Status review tidak valid."));
  const item = await QuestionBankItem.findById(req.params.itemId);
  if (!item) return next(new AppError(404, "Soal bank tidak ditemukan."));
  item.status = status;
  if (status === "approved") { item.reviewedBy = req.user?._id.toString(); item.reviewedAt = new Date(); }
  await item.save();
  sendSuccess(res, { message: status === "approved" ? "Soal disetujui." : "Status soal diperbarui.", data: { item } });
});

export const bulkUpdateAdminQuestionBankStatus = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  let request: ReturnType<typeof prepareBulkQuestionBankStatus>;
  try {
    request = prepareBulkQuestionBankStatus(req.body ?? {});
  } catch (error) {
    return next(new AppError(400, error instanceof Error ? error.message : "Aksi bulk tidak valid."));
  }

  const update: { $set: Record<string, unknown> } = { $set: { status: request.status } };
  if (request.status === "approved") {
    update.$set.reviewedBy = req.user?._id.toString() ?? "";
    update.$set.reviewedAt = new Date();
  }
  const result = await QuestionBankItem.updateMany(
    { _id: { $in: request.itemIds }, status: { $ne: "archived" } },
    update,
  );
  sendSuccess(res, {
    message: `${result.matchedCount} soal berhasil ${request.status === "approved" ? "disetujui" : "ditolak"}.`,
    data: { matched: result.matchedCount, modified: result.modifiedCount, skipped: request.itemIds.length - result.matchedCount },
  });
});

export const createAdminQuestionBankItem = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const result = normalizeQuestionDraft(req.body ?? {}, { requireExplanation: true });
  if (!result.ok) return next(new AppError(400, validationMessage(result.errors)));

  let image: { secure_url?: string; public_id?: string } = {};
  if (text(req.body?.imageDataUri)) image = await uploadQuestionImage(text(req.body.imageDataUri));
  const actorId = req.user?._id.toString() ?? "";
  const item = await QuestionBankItem.create({
    ...result.value,
    ...(image.secure_url ? { imageUrl: image.secure_url, imagePublicId: image.public_id } : {}),
    questionId: createQuestionId("QB-ADM"),
    status: "approved",
    bankScope: "global",
    createdBy: actorId,
    createdByName: req.user?.nama ?? "Admin",
    reviewedBy: actorId,
    reviewedAt: new Date(),
    fingerprint: questionFingerprint(result.value),
    explanationSource: "manual",
    source: { kind: "manual" },
  });
  sendSuccess(res, { statusCode: 201, message: "Soal admin berhasil ditambahkan.", data: { item } });
});

export const updateAdminQuestionBankItem = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const item = await QuestionBankItem.findById(req.params.itemId);
  if (!item || item.status === "archived") return next(new AppError(404, "Soal bank tidak ditemukan."));

  const merged = { ...item.toObject(), ...req.body, options: req.body?.options ?? item.options };
  const result = normalizeQuestionDraft(merged, { requireExplanation: true });
  if (!result.ok) return next(new AppError(400, validationMessage(result.errors)));

  let nextImage: { imageUrl?: string; imagePublicId?: string } = {};
  if (text(req.body?.imageDataUri)) {
    const image = await uploadQuestionImage(text(req.body.imageDataUri));
    nextImage = { imageUrl: image.secure_url, imagePublicId: image.public_id };
  }
  const actorId = req.user?._id.toString() ?? "";
  Object.assign(item, result.value, nextImage, {
    status: "approved",
    bankScope: "global",
    reviewedBy: actorId,
    reviewedAt: new Date(),
    fingerprint: questionFingerprint(result.value),
  });
  await item.save();
  sendSuccess(res, { message: "Soal admin berhasil diperbarui.", data: { item } });
});

export const archiveAdminQuestionBankItem = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const item = await QuestionBankItem.findOneAndUpdate(
    { _id: req.params.itemId, status: { $ne: "archived" } },
    { status: "archived" },
    { new: true },
  );
  if (!item) return next(new AppError(404, "Soal bank tidak ditemukan."));
  sendSuccess(res, { message: "Soal berhasil diarsipkan.", data: { item } });
});

export const downloadAdminQuestionBankTemplate = asyncHandler(async (_req: Request, res: Response) => {
  const buffer = createQuestionBankTemplate();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="template-import-bank-soal.xlsx"');
  res.status(200).send(buffer);
});

export const previewAdminQuestionBankExcel = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const encoded = text(req.body?.fileDataBase64);
  if (!encoded) return next(new AppError(400, "File Excel wajib diunggah."));
  const rawBase64 = encoded.includes(",") ? encoded.slice(encoded.indexOf(",") + 1) : encoded;
  const buffer = Buffer.from(rawBase64, "base64");
  if (!buffer.length || buffer.length > 10 * 1024 * 1024) {
    return next(new AppError(400, "File Excel kosong atau melebihi 10 MB."));
  }

  let items;
  try {
    items = parseQuestionWorkbook(buffer, {
      program: text(req.body?.program).toUpperCase() as "SD" | "SMP" | "SMA",
      className: text(req.body?.className),
      subject: text(req.body?.subject),
      topic: text(req.body?.topic) || "Umum",
    });
  } catch (error) {
    return next(new AppError(400, error instanceof Error ? error.message : "File Excel tidak dapat dibaca."));
  }

  const fingerprints = items.map((item) => item.fingerprint).filter(Boolean);
  const existing = fingerprints.length
    ? await QuestionBankItem.find({ fingerprint: { $in: fingerprints } }).select("fingerprint").lean()
    : [];
  const existingFingerprints = new Set(existing.map((item) => item.fingerprint).filter(Boolean));
  items = items.map((item) => item.fingerprint && existingFingerprints.has(item.fingerprint)
    ? { ...item, duplicate: "database" as const, selected: false }
    : item);
  const duplicates = items.filter((item) => item.duplicate !== "none").length;
  const invalid = items.filter((item) => item.errors.length > 0).length;
  sendSuccess(res, {
    data: {
      source: "excel",
      fileName: text(req.body?.fileName) || "bank-soal.xlsx",
      items,
      summary: { total: items.length, valid: items.length - invalid - duplicates, invalid, duplicates },
    },
  });
});

export const confirmAdminQuestionBankImport = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const source = req.body?.source === "pdf" ? "pdf" : req.body?.source === "excel" ? "excel" : null;
  const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
  if (!source || !rawItems.length) return next(new AppError(400, "Sumber dan daftar soal import wajib diisi."));
  if (rawItems.length > 5_000) return next(new AppError(400, "Maksimal 5.000 soal per import."));
  const fileName = text(req.body?.fileName) || (source === "pdf" ? "bank-soal.pdf" : "bank-soal.xlsx");
  const items: ImportCommitInput[] = rawItems.map((item: Record<string, unknown>, index: number) => ({
    rowNumber: Number(item.rowNumber) || index + 1,
    ...(Number.isFinite(Number(item.pageNumber)) ? { pageNumber: Number(item.pageNumber) } : {}),
    draft: item.draft && typeof item.draft === "object" && !Array.isArray(item.draft)
      ? item.draft as Record<string, unknown>
      : {},
    source,
    fileName,
    ...(text(item.imageDataUri) ? { imageDataUri: text(item.imageDataUri) } : {}),
  }));
  const candidateFingerprints = items.flatMap((item) => {
    const normalized = normalizeQuestionDraft(item.draft, { requireExplanation: true });
    return normalized.ok ? [questionFingerprint(normalized.value)] : [];
  });
  const existing = candidateFingerprints.length
    ? await QuestionBankItem.find({ fingerprint: { $in: candidateFingerprints } }).select("fingerprint").lean()
    : [];
  const preparation = prepareQuestionImport(
    items,
    { id: req.user?._id.toString() ?? "", name: req.user?.nama ?? "Admin" },
    new Set(existing.map((item) => item.fingerprint).filter((value): value is string => Boolean(value))),
  );
  const documents = [];
  for (const prepared of preparation.documents) {
    const { imageDataUri, ...document } = prepared;
    if (imageDataUri) {
      const image = await uploadQuestionImage(imageDataUri);
      documents.push({ ...document, imageUrl: image.secure_url, imagePublicId: image.public_id });
    } else {
      documents.push(document);
    }
  }
  const created = documents.length ? await QuestionBankItem.insertMany(documents) : [];
  sendSuccess(res, {
    statusCode: 201,
    message: `${created.length} soal berhasil diimport dan menunggu review.`,
    data: {
      summary: { created: created.length, skipped: preparation.skipped.length, failed: preparation.failed.length },
      skipped: preparation.skipped,
      failed: preparation.failed,
    },
  });
});

export const previewAdminQuestionBankPdf = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const pdf = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  if (!pdf.length || pdf.length > 120 * 1024 * 1024 || pdf.subarray(0, 4).toString() !== "%PDF") {
    return next(new AppError(400, "File PDF kosong, tidak valid, atau melebihi 120 MB."));
  }
  try {
    const items = await extractPdfPreview({
      fileBuffer: pdf,
      fileName: text(req.query.fileName) || "bank-soal.pdf",
      defaults: {
        program: text(req.query.program).toUpperCase() as "SD" | "SMP" | "SMA",
        className: text(req.query.className),
        subject: text(req.query.subject),
        topic: text(req.query.topic) || "Umum",
      },
    });
    const duplicates = items.filter((item) => item.duplicate !== "none").length;
    const invalid = items.filter((item) => item.errors.length > 0).length;
    sendSuccess(res, {
      data: {
        source: "pdf",
        fileName: text(req.query.fileName) || "bank-soal.pdf",
        items,
        summary: { total: items.length, valid: items.length - invalid - duplicates, invalid, duplicates },
      },
    });
  } catch (error) {
    return next(new AppError(422, error instanceof Error ? error.message : "PDF gagal diekstrak."));
  }
});
