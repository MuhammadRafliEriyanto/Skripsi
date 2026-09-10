import type { NextFunction, Request, Response } from "express";
import "../types/express";
import { Types } from "mongoose";

import { ClassTask } from "../models/ClassTask";
import { ClassTaskQuestion } from "../models/ClassTaskQuestion";
import { QuestionBankItem } from "../models/QuestionBankItem";
import { StudentTaskAttempt } from "../models/StudentTaskAttempt";
import { TaskSubmission } from "../models/TaskSubmission";
import { Teacher } from "../models/Teacher";
import asyncHandler from "../utils/asyncHandler";
import { AppError, sendSuccess } from "../utils/apiResponse";
import { parseTryoutXlsxBuffer } from "../utils/tryoutXlsxParser";
import { normalizeText } from "../utils/classroomLearning";
import { ensureTeacherAcademicPeriodEditable } from "../utils/teacherAcademicArchive";
import { resolveAcademicPeriodFromQuery } from "../utils/academicGrade";
import { buildTeacherAcademicPeriodOrLegacyFilter } from "../utils/teacherAcademicPeriod";
import { createOriginalOptions } from "../lib/question-option-compat";
import { getNextPublicId } from "../utils/publicId";

function buildTeacherTaskLookupFilter(
  taskId: string,
  classId: string,
  teacherId: Types.ObjectId,
  period: ReturnType<typeof resolveAcademicPeriodFromQuery>,
) {
  return {
    $and: [
      {
        classId,
        teacherId,
      },
      buildTeacherAcademicPeriodOrLegacyFilter(period),
      {
        $or: [
          { taskId },
          ...(Types.ObjectId.isValid(taskId) ? [{ _id: taskId }] : []),
        ],
      },
    ],
  };
}

export const generateTeacherClassTaskQuestionsAuto = asyncHandler(
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

    const teacher = await Teacher.findOne({ userId: req.user._id, isArchived: { $ne: true } });

    if (!teacher) {
      next(new AppError(404, "Profil guru tidak ditemukan."));
      return;
    }

    const classIdParam = normalizeText(req.params.classId);
    const taskIdParam = normalizeText(req.params.taskId);

    if (!classIdParam || !taskIdParam) {
      next(new AppError(400, "Class ID dan Task ID wajib diisi."));
      return;
    }

    const period = resolveAcademicPeriodFromQuery(req.query);
    const task = await ClassTask.findOne(
      buildTeacherTaskLookupFilter(taskIdParam, classIdParam, teacher._id, period),
    );

    if (!task) {
      next(new AppError(404, "Latihan tidak ditemukan."));
      return;
    }

    const [submissionExists, attemptExists] = await Promise.all([
      TaskSubmission.exists({
        taskId: task.taskId,
        classId: task.classId,
        teacherId: teacher._id,
      }),
      StudentTaskAttempt.exists({
        taskId: task.taskId,
        classId: task.classId,
        teacherId: teacher._id,
      }),
    ]);

    if (
      task.submittedCount > 0 ||
      task.reviewStatus !== "Belum Ada Pengumpulan" ||
      submissionExists ||
      attemptExists
    ) {
      throw new AppError(
        400,
        "Tidak bisa men-generate soal: Latihan ini sudah mulai dikerjakan oleh siswa.",
      );
    }

    const targetCount = Math.min(Math.max(Number(req.body?.questionCount) || 30, 1), 100);
    const bankScope = ["global", "mine", "mixed"].includes(req.body?.bankScope)
      ? req.body.bankScope
      : "mixed";
    const ownershipFilter = bankScope === "global"
      ? { bankScope: "global" }
      : bankScope === "mine"
        ? { createdBy: req.user._id.toString() }
        : { $or: [{ bankScope: "global" }, { createdBy: req.user._id.toString() }] };
    
    // Match by subject and topic (mapping meetingNumber to Bab)
    const topicPattern = new RegExp(`Bab ${task.meetingNumber}:`, "i");

    const availableQuestions = await QuestionBankItem.aggregate([
      { 
        $match: { 
          subject: task.subject,
          className: task.className,
          status: "approved",
          ...ownershipFilter,
          topic: { $regex: topicPattern }
        } 
      },
      { $sample: { size: targetCount } }
    ]);

    if (!availableQuestions || availableQuestions.length === 0) {
      // Fallback: if no questions found for this specific chapter, just pick by subject
      const fallbackQuestions = await QuestionBankItem.aggregate([
        { $match: { subject: task.subject, className: task.className, status: "approved", ...ownershipFilter } },
        { $sample: { size: targetCount } }
      ]);
      
      if (!fallbackQuestions || fallbackQuestions.length === 0) {
        throw new AppError(404, `Belum ada bank soal tersedia untuk mata pelajaran: ${task.subject}`);
      }
      
      availableQuestions.push(...fallbackQuestions);
      availableQuestions.splice(targetCount); // ensure we don't exceed targetCount
    }

    try {
      const firstQuestionId = await getNextPublicId(ClassTaskQuestion, "questionId", "TQ");
      const firstNumber = Number(firstQuestionId.replace(/\D/g, "")) || 1;
      await ClassTaskQuestion.deleteMany({ teacherId: teacher._id, taskId: task.taskId });
      await ClassTaskQuestion.create(availableQuestions.map((question, index) => ({
        questionId: `TQ-${String(firstNumber + index).padStart(3, "0")}`,
        teacherId: teacher._id,
        taskId: task.taskId,
        questionText: question.questionText,
        optionA: question.options.A,
        optionB: question.options.B,
        optionC: question.options.C,
        optionD: question.options.D,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        topic: question.topic,
        difficulty: question.difficulty,
        order: index + 1,
      })));
      task.questionCount = availableQuestions.length;
      await task.save();

      res.status(200).json({
        success: true,
        message: `${availableQuestions.length} soal acak berhasil dipasang ke latihan.`,
        data: { questionCount: availableQuestions.length },
      });
    } catch (error) {
      throw error;
    }
  },
);

export const getTeacherClassTaskQuestions = asyncHandler(
  async (
    req: Request<{ classId: string; taskId: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const teacher = await Teacher.findOne({ userId: req.user._id, isArchived: { $ne: true } });
    if (!teacher) {
      next(new AppError(404, "Profil guru tidak ditemukan."));
      return;
    }

    const classIdParam = normalizeText(req.params.classId);
    const taskIdParam = normalizeText(req.params.taskId);
    const period = resolveAcademicPeriodFromQuery(req.query);

    const task = await ClassTask.findOne(
      buildTeacherTaskLookupFilter(taskIdParam, classIdParam, teacher._id, period),
    );

    if (!task) {
      next(new AppError(404, "Latihan tidak ditemukan."));
      return;
    }

    const selectedQuestions = await ClassTaskQuestion.find({
      teacherId: teacher._id,
      taskId: task.taskId,
    }).sort({ order: 1 }).lean();

    if (selectedQuestions.length > 0) {
      sendSuccess(res, {
        statusCode: 200,
        message: "Soal latihan yang sudah dipasang berhasil diambil.",
        data: selectedQuestions as any,
      });
      return;
    }
    
    const targetCount = 30;
    
    // Preview questions by pulling random sample
    const topicPattern = new RegExp(`Bab ${task.meetingNumber}:`, "i");

    let availableQuestions = await QuestionBankItem.aggregate([
      { 
        $match: { 
          subject: task.subject,
          className: task.className,
          status: "approved",
          topic: { $regex: topicPattern }
        } 
      },
      { $sample: { size: targetCount } }
    ]);

    if (!availableQuestions || availableQuestions.length === 0) {
      availableQuestions = await QuestionBankItem.aggregate([
        { $match: { subject: task.subject, className: task.className, status: "approved" } },
        { $sample: { size: targetCount } }
      ]);
    }

    const previewQuestions = availableQuestions.map((q, index) => {
      const originalOptions = createOriginalOptions(q);
      return {
        questionId: q.questionId || q._id.toString(),
        questionText: q.questionText,
        optionA: originalOptions.A,
        optionB: originalOptions.B,
        optionC: originalOptions.C,
        optionD: originalOptions.D,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        topic: q.topic,
        difficulty: q.difficulty,
        order: index + 1,
      };
    });

    sendSuccess(res, {
      statusCode: 200,
      message: "Preview soal berhasil diambil.",
      data: previewQuestions as any,
    });
  }
);

export const selectTeacherClassTaskQuestions = asyncHandler(async (req: Request<{ classId: string; taskId: string }>, res: Response, next: NextFunction) => {
  if (!req.user) return next(new AppError(401, "User belum terautentikasi."));
  const teacher = await Teacher.findOne({ userId: req.user._id, isArchived: { $ne: true } });
  if (!teacher) return next(new AppError(404, "Profil guru tidak ditemukan."));
  const task = await ClassTask.findOne({ classId: req.params.classId, taskId: req.params.taskId, teacherId: teacher._id });
  if (!task) return next(new AppError(404, "Latihan tidak ditemukan."));
  if (task.reviewStatus !== "Belum Ada Pengumpulan") return next(new AppError(400, "Soal tidak dapat diubah setelah ada pengumpulan."));
  const ids = Array.isArray(req.body?.questionIds) ? [...new Set(req.body.questionIds.map(String))].slice(0, 100) : [];
  if (!ids.length) return next(new AppError(400, "Pilih minimal satu soal."));
  const source = await QuestionBankItem.find({ questionId: { $in: ids }, status: "approved" }).lean();
  if (source.length !== ids.length) return next(new AppError(400, "Sebagian soal tidak ditemukan atau belum disetujui admin."));
  const first = await getNextPublicId(ClassTaskQuestion, "questionId", "TQ");
  const start = Number(first.replace(/\D/g, "")) || 1;
  await ClassTaskQuestion.deleteMany({ teacherId: teacher._id, taskId: task.taskId });
  const questions = await ClassTaskQuestion.create(source.map((q, index) => { const options = q.options; return { questionId: `TQ-${String(start + index).padStart(3, "0")}`, teacherId: teacher._id, taskId: task.taskId, questionText: q.questionText, optionA: options.A, optionB: options.B, optionC: options.C, optionD: options.D, correctAnswer: q.correctAnswer, explanation: q.explanation, topic: q.topic, difficulty: q.difficulty, order: index + 1 }; }));
  task.questionCount = questions.length;
  await task.save();
  res.status(200).json({ success: true, message: "Soal berhasil dipasang ke latihan.", data: { questionCount: questions.length, questions } });
});
