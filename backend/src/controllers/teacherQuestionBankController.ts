import type { Request, Response, NextFunction } from "express";
import "../types/express";
import { QuestionBankItem, QUESTION_BANK_ITEM_ANSWERS, QUESTION_BANK_ITEM_DIFFICULTIES } from "../models/QuestionBankItem";
import asyncHandler from "../utils/asyncHandler";
import { AppError, sendSuccess } from "../utils/apiResponse";
import { uploadQuestionImage } from "../lib/cloudinary";
import * as XLSX from "xlsx";

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const toPublic = (item: any) => ({ ...item.toObject(), id: item._id.toString() });

export const getTeacherQuestionBank = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
  const filter: Record<string, unknown> = { status: { $ne: "archived" }, createdBy: req.user?._id.toString() };
  for (const key of ["program", "className", "subject", "topic", "status", "difficulty"]) {
    const value = text(req.query[key]);
    if (value) filter[key] = new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  }
  const search = text(req.query.search);
  if (search) filter.$or = [{ questionText: new RegExp(search, "i") }, { questionId: new RegExp(search, "i") }];
  if (req.query.format === "csv" || req.query.format === "xlsx") {
    const rows = await QuestionBankItem.find(filter).sort({ updatedAt: -1 }).lean();
    const cell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
    const csv = [
      ["ID", "Pembuat", "Program", "Kelas", "Mapel", "Topik", "Kesulitan", "Status", "Pertanyaan", "Opsi A", "Opsi B", "Opsi C", "Opsi D", "Kunci", "Pembahasan"].map(cell).join(","),
      ...rows.map((item) => [item.questionId, item.createdByName, item.program, item.className, item.subject, item.topic, item.difficulty, item.status, item.questionText, item.options.A, item.options.B, item.options.C, item.options.D, item.correctAnswer, item.explanation].map(cell).join(",")),
    ].join("\r\n");
    if (req.query.format === "xlsx") {
      const worksheet = XLSX.utils.json_to_sheet(rows.map((item) => ({ ID: item.questionId, Pembuat: item.createdByName, Program: item.program, Kelas: item.className, Mapel: item.subject, Topik: item.topic, Kesulitan: item.difficulty, Status: item.status, Pertanyaan: item.questionText, "Opsi A": item.options.A, "Opsi B": item.options.B, "Opsi C": item.options.C, "Opsi D": item.options.D, Kunci: item.correctAnswer, Pembahasan: item.explanation })));
      const xlsx = XLSX.write({ SheetNames: ["Bank Soal"], Sheets: { "Bank Soal": worksheet } }, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", 'attachment; filename="bank-soal-guru.xlsx"');
      res.status(200).send(xlsx);
      return;
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="bank-soal-guru.csv"');
    res.status(200).send(`\ufeff${csv}`);
    return;
  }
  const [items, total] = await Promise.all([
    QuestionBankItem.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    QuestionBankItem.countDocuments(filter),
  ]);
  sendSuccess(res, { data: { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } } });
});

export const getAvailableTeacherQuestionBank = asyncHandler(async (req: Request, res: Response) => {
  const scope = text(req.query.scope) || "mixed";
  const filter: Record<string, unknown> = { status: "approved" };
  if (scope === "mine") filter.createdBy = req.user?._id.toString();
  if (scope === "global") filter.bankScope = "global";
  if (scope === "mixed") filter.$or = [{ bankScope: "global" }, { createdBy: req.user?._id.toString() }];
  for (const key of ["program", "className", "subject", "topic"]) {
    const value = text(req.query[key]);
    if (value) filter[key] = new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  }
  const search = text(req.query.search);
  if (search) filter.questionText = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const items = await QuestionBankItem.find(filter).sort({ topic: 1, difficulty: 1 }).limit(200).lean();
  sendSuccess(res, { data: { items, total: items.length } });
});

export const createTeacherQuestionBankItem = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const body = req.body ?? {};
  const required = ["program", "className", "subject", "topic", "questionText", "explanation"];
  if (required.some((key) => !text(body[key]))) return next(new AppError(400, "Program, kelas, mapel, topik, soal, dan pembahasan wajib diisi."));
  const options = body.options ?? {};
  if (["A", "B", "C", "D"].some((key) => !text(options[key]))) return next(new AppError(400, "Semua opsi jawaban wajib diisi."));
  if (!QUESTION_BANK_ITEM_ANSWERS.includes(body.correctAnswer) || !QUESTION_BANK_ITEM_DIFFICULTIES.includes(body.difficulty)) return next(new AppError(400, "Kunci atau tingkat kesulitan tidak valid."));
  let image: { secure_url?: string; public_id?: string } = {};
  if (text(body.imageDataUri)) image = await uploadQuestionImage(text(body.imageDataUri));
  const item = await QuestionBankItem.create({ ...body, ...(image.secure_url ? { imageUrl: image.secure_url, imagePublicId: image.public_id } : {}), questionId: text(body.questionId) || `QB-${Date.now()}`, status: "draft", createdBy: req.user?._id.toString(), createdByName: req.user?.nama ?? "Guru" });
  sendSuccess(res, { statusCode: 201, message: "Soal berhasil disimpan sebagai draft.", data: { item: toPublic(item) } });
});

export const updateTeacherQuestionBankItem = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const item = await QuestionBankItem.findOne({ _id: req.params.itemId, createdBy: req.user?._id.toString() });
  if (!item) return next(new AppError(404, "Soal bank tidak ditemukan."));
  if (item.status === "archived") return next(new AppError(400, "Soal yang sudah diarsipkan tidak dapat diubah."));
  const updateBody = { ...req.body };
  delete updateBody.imageDataUri;
  if (text(req.body.imageDataUri)) {
    const image = await uploadQuestionImage(text(req.body.imageDataUri));
    Object.assign(updateBody, { imageUrl: image.secure_url, imagePublicId: image.public_id });
  }
  const requestedStatus = text(req.body.status);
  if (requestedStatus && !["draft", "review"].includes(requestedStatus)) return next(new AppError(403, "Guru hanya dapat menyimpan draft atau mengajukan review."));
  Object.assign(item, updateBody, { status: requestedStatus === "review" ? "review" : item.status === "approved" || item.status === "rejected" ? "draft" : item.status, reviewedBy: "", reviewedAt: undefined });
  await item.save();
  sendSuccess(res, { message: "Soal bank berhasil diperbarui.", data: { item: toPublic(item) } });
});

export const archiveTeacherQuestionBankItem = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const item = await QuestionBankItem.findOneAndUpdate({ _id: req.params.itemId, createdBy: req.user?._id.toString() }, { status: "archived" }, { new: true });
  if (!item) return next(new AppError(404, "Soal bank tidak ditemukan."));
  sendSuccess(res, { message: "Soal bank berhasil diarsipkan.", data: { item: toPublic(item) } });
});

export const importTeacherQuestionBank = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const encoded = text(req.body?.fileDataBase64);
  if (!encoded) return next(new AppError(400, "File Excel/CSV wajib diunggah."));
  const buffer = Buffer.from(encoded.includes(",") ? encoded.split(",").pop()! : encoded, "base64");
  if (!buffer.length || buffer.length > 10 * 1024 * 1024) return next(new AppError(400, "File kosong atau melebihi 10 MB."));
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const value = (row: Record<string, unknown>, names: string[]) => text(names.map((name) => row[name] ?? row[Object.keys(row).find((key) => key.toLowerCase() === name.toLowerCase()) ?? ""]).find(Boolean));
  const items = rows.map((row, index) => ({ questionId: `QB-IMP-${Date.now()}-${index + 1}`, program: value(row, ["program", "jenjang"]), className: value(row, ["className", "kelas"]), subject: value(row, ["subject", "mapel", "mata pelajaran"]), topic: value(row, ["topic", "topik"]), indicator: value(row, ["indicator", "indikator"]), cognitiveLevel: value(row, ["cognitiveLevel", "level kognitif"]), questionText: value(row, ["questionText", "question", "soal", "pertanyaan"]), options: { A: value(row, ["A", "optionA", "opsi A"]), B: value(row, ["B", "optionB", "opsi B"]), C: value(row, ["C", "optionC", "opsi C"]), D: value(row, ["D", "optionD", "opsi D"]) }, correctAnswer: value(row, ["correctAnswer", "kunci"]).toUpperCase(), explanation: value(row, ["explanation", "pembahasan"]), difficulty: value(row, ["difficulty", "kesulitan"]) || "Sedang", status: "draft", createdBy: req.user?._id.toString(), createdByName: req.user?.nama ?? "Guru" }));
  const invalid = items.findIndex((item) => !item.program || !item.className || !item.subject || !item.topic || !item.questionText || Object.values(item.options).some((option) => !option) || !["A", "B", "C", "D"].includes(item.correctAnswer) || !item.explanation);
  if (invalid >= 0) return next(new AppError(400, `Baris ${invalid + 2} belum lengkap. Wajib isi metadata, soal, opsi A-D, kunci, dan pembahasan.`));
  const created = await QuestionBankItem.insertMany(items);
  sendSuccess(res, { statusCode: 201, message: `${created.length} soal berhasil diimport dan menunggu review admin.`, data: { count: created.length } });
});
