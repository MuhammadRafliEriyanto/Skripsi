import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";

import { ClassTask } from "../models/ClassTask";
import { ClassTaskQuestion } from "../models/ClassTaskQuestion";
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

    // Auto-generate questions from QuestionBank
    const QuestionBank = (await import("../models/QuestionBank")).QuestionBank;
    
    // Default to 30 if somehow not specified
    const targetCount = task.questionCount && task.questionCount > 0 ? task.questionCount : 30;
    
    // Match by subject and topic (mapping meetingNumber to Bab)
    const topicPattern = new RegExp(`Bab ${task.meetingNumber}:`, "i");

    const availableQuestions = await QuestionBank.aggregate([
      { 
        $match: { 
          subject: task.subject,
          topic: { $regex: topicPattern }
        } 
      },
      { $sample: { size: targetCount } }
    ]);

    if (!availableQuestions || availableQuestions.length === 0) {
      // Fallback: if no questions found for this specific chapter, just pick by subject
      const fallbackQuestions = await QuestionBank.aggregate([
        { $match: { subject: task.subject } },
        { $sample: { size: targetCount } }
      ]);
      
      if (!fallbackQuestions || fallbackQuestions.length === 0) {
        throw new AppError(404, `Belum ada bank soal tersedia untuk mata pelajaran: ${task.subject}`);
      }
      
      availableQuestions.push(...fallbackQuestions);
      availableQuestions.splice(targetCount); // ensure we don't exceed targetCount
    }

    const session = await ClassTaskQuestion.startSession();
    session.startTransaction();

    try {
      await ClassTaskQuestion.deleteMany(
        { taskId: task.taskId, teacherId: teacher._id },
        { session },
      );

      const newQuestions = availableQuestions.map((q, index) => ({
        questionId: `ctq-${new Types.ObjectId().toString()}`,
        teacherId: teacher._id,
        taskId: task.taskId,
        questionText: q.questionText,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        topic: q.topic,
        difficulty: q.difficulty,
        order: index + 1,
      }));

      await ClassTaskQuestion.insertMany(newQuestions, { session });

      task.questionCount = newQuestions.length;
      await task.save({ session });

      await session.commitTransaction();
      session.endSession();

      sendSuccess(res, {
        statusCode: 200,
        message: `${newQuestions.length} Soal Latihan CBT berhasil di-generate secara otomatis berdasarkan topik P${task.meetingNumber}.`,
        data: {
          questionCount: newQuestions.length,
        } as any,
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
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

    const taskIdParam = normalizeText(req.params.taskId);
    
    const questions = await ClassTaskQuestion.find({
      taskId: taskIdParam,
      teacherId: teacher._id,
    }).sort({ order: 1 });

    sendSuccess(res, {
      statusCode: 200,
      message: "Soal Latihan berhasil diambil.",
      data: {
      questions: questions.map((q) => ({
        id: q.questionId,
        questionText: q.questionText,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        topic: q.topic,
        difficulty: q.difficulty,
        order: q.order,
      })),
    } as any,
    });
  }
);
