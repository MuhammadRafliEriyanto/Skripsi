import type { NextFunction, Request, Response } from "express";

import { ClassTask, type ClassTaskDocument } from "../models/ClassTask";
import {
  ClassTaskQuestion,
  type ClassTaskQuestionDocument,
} from "../models/ClassTaskQuestion";
import {
  StudentTaskAttempt,
  type IStudentTaskAttemptAnswer,
  type StudentTaskAttemptDocument,
} from "../models/StudentTaskAttempt";
import { TaskSubmission } from "../models/TaskSubmission";
import { TaskGrade } from "../models/TaskGrade";
import asyncHandler from "../utils/asyncHandler";
import { AppError, sendSuccess } from "../utils/apiResponse";
import {
  buildStudentLearningClassFilter,
  normalizeText,
  syncTeacherTaskMetrics,
} from "../utils/classroomLearning";
import { getNextPublicId } from "../utils/publicId";
import { getMembershipSnapshotByUserId } from "../utils/subscription";
import { getStudentEffectiveAcademicJoinedAt } from "../utils/studentAcademicStatus";
import { resolveStudentMembershipContentAccess } from "../utils/studentMembershipAccess";

async function getAuthenticatedStudentCbtContextOrThrow(userId: string) {
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
      "Membership siswa belum memiliki tanggal mulai belajar.",
      { membershipAccess },
      "MEMBERSHIP_START_REQUIRED",
    );
  }

  return {
    student,
    subscriptionId: membershipSnapshot.subscription?._id ?? null,
  };
}

function getTaskAttemptExpiresAt(
  task: ClassTaskDocument,
  attempt: StudentTaskAttemptDocument,
) {
  const durationMinutes = Math.max(Number(task.durationMinutes) || 1, 1);
  const durationExpiresAt = new Date(
    attempt.startedAt.getTime() + durationMinutes * 60 * 1000,
  );

  if (task.endAt && task.endAt.getTime() < durationExpiresAt.getTime()) {
    return task.endAt;
  }

  return durationExpiresAt;
}

function getTaskAttemptRemainingSeconds(
  task: ClassTaskDocument,
  attempt: StudentTaskAttemptDocument,
) {
  if (attempt.status === "submitted") {
    return 0;
  }

  return Math.max(
    Math.floor(
      (getTaskAttemptExpiresAt(task, attempt).getTime() - Date.now()) / 1000,
    ),
    0,
  );
}

function getTaskPassingGrade(task: ClassTaskDocument) {
  return typeof task.passingGrade === "number" &&
    Number.isFinite(task.passingGrade) &&
    task.passingGrade > 0
    ? Math.min(Math.max(task.passingGrade, 0), 100)
    : null;
}

function isTaskScoreBelowPassingGrade(
  task: ClassTaskDocument,
  score: number,
) {
  const passingGrade = getTaskPassingGrade(task);

  return passingGrade !== null && score < passingGrade;
}

function archiveAttemptForRemedial(
  attempt: StudentTaskAttemptDocument,
  reason: string,
  now: Date,
) {
  const nextRemedialCount = Math.max(Number(attempt.remedialCount) || 0, 0) + 1;

  attempt.history = [
    ...(attempt.history ?? []),
    {
      remedialNumber: nextRemedialCount,
      reason,
      answers: attempt.answers.map((answer) => ({
        questionId: answer.questionId,
        selectedAnswer: answer.selectedAnswer,
        isCorrect: answer.isCorrect,
      })),
      correctCount: attempt.correctCount,
      wrongCount: attempt.wrongCount,
      unansweredCount: attempt.unansweredCount,
      score: attempt.score,
      timeUsedSeconds: attempt.timeUsedSeconds,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      archivedAt: now,
    },
  ];
  attempt.answers = [];
  attempt.correctCount = 0;
  attempt.wrongCount = 0;
  attempt.unansweredCount = 0;
  attempt.score = 0;
  attempt.timeUsedSeconds = 0;
  attempt.startedAt = now;
  attempt.submittedAt = null;
  attempt.status = "in_progress";
  attempt.remedialCount = nextRemedialCount;
  attempt.remedialReason = reason;
}

function toPublicTaskCbtAttempt(
  task: ClassTaskDocument,
  attempt: StudentTaskAttemptDocument,
) {
  const isSubmitted = attempt.status === "submitted";
  const expiresAt = getTaskAttemptExpiresAt(task, attempt);

  return {
    submitted: isSubmitted,
    attemptId: normalizeText(attempt.attemptId) || null,
    status: attempt.status,
    score: isSubmitted ? attempt.score : null,
    correctCount: isSubmitted ? attempt.correctCount : null,
    wrongCount: isSubmitted ? attempt.wrongCount : null,
    unansweredCount: isSubmitted ? attempt.unansweredCount : null,
    timeUsedSeconds: attempt.timeUsedSeconds,
    startedAt: attempt.startedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    remainingSeconds: getTaskAttemptRemainingSeconds(task, attempt),
    submittedAt: attempt.submittedAt?.toISOString() ?? null,
    remedialCount: Math.max(Number(attempt.remedialCount) || 0, 0),
    remedialReason: normalizeText(attempt.remedialReason),
  };
}

function findAttemptAnswer(
  attempt: StudentTaskAttemptDocument,
  questionId: string,
) {
  return attempt.answers.find(
    (answer) => normalizeText(answer.questionId) === questionId,
  );
}

function toPublicTaskCbtQuestion(
  question: ClassTaskQuestionDocument,
  attempt: StudentTaskAttemptDocument,
) {
  const questionId = normalizeText(question.questionId);
  const answer = findAttemptAnswer(attempt, questionId);
  const includeCorrectAnswer = attempt.status === "submitted";

  return {
    id: questionId,
    questionId,
    order: question.order,
    number: question.order,
    section: "Latihan Soal",
    topic: normalizeText(question.topic) || `Soal ${question.order}`,
    prompt: normalizeText(question.questionText),
    options: [
      { id: "A", content: normalizeText(question.optionA) },
      { id: "B", content: normalizeText(question.optionB) },
      { id: "C", content: normalizeText(question.optionC) },
      { id: "D", content: normalizeText(question.optionD) },
    ],
    difficulty: normalizeText(question.difficulty) || "Sedang",
    clue: "",
    selectedOptionId: normalizeText(answer?.selectedAnswer) || null,
    isCorrect: includeCorrectAnswer ? answer?.isCorrect ?? null : null,
    correctOptionId: includeCorrectAnswer ? question.correctAnswer : null,
    explanation: includeCorrectAnswer
      ? normalizeText(question.explanation) ||
        "Pembahasan singkat bisa dilanjutkan bersama guru setelah latihan."
      : "Pembahasan akan tampil setelah jawaban dikirim.",
  };
}

function buildTaskCbtResponsePayload(
  task: ClassTaskDocument,
  questions: ClassTaskQuestionDocument[],
  attempt: StudentTaskAttemptDocument,
) {
  const publicAttempt = toPublicTaskCbtAttempt(task, attempt);
  const publicQuestions = questions.map((question) =>
    toPublicTaskCbtQuestion(question, attempt),
  );
  const result =
    attempt.status === "submitted"
      ? {
          score: attempt.score,
          correctCount: attempt.correctCount,
          wrongCount: attempt.wrongCount,
          unansweredCount: attempt.unansweredCount,
          totalQuestions: questions.length,
        }
      : null;

  return {
    tryout: {
      id: normalizeText(task.taskId),
      tryoutId: normalizeText(task.taskId),
      classId: normalizeText(task.classId),
      branch: normalizeText(task.branch),
      canonicalClassName: normalizeText(task.canonicalClassName),
      assessmentType: "Latihan",
      title: normalizeText(task.title) || "Latihan Soal",
      jenjang: "",
      kelas: normalizeText(task.className),
      subject: normalizeText(task.subject) || "Mapel belum diatur",
      durationMinutes: Math.max(Number(task.durationMinutes) || 1, 1),
      startAt: task.startAt?.toISOString() ?? null,
      endAt: task.endAt?.toISOString() ?? null,
      questionSource: "class-task",
      questionCount: questions.length,
      totalQuestions: questions.length,
      availability: attempt.status === "submitted" ? "Selesai" : "Terbuka",
      availabilityMessage:
        attempt.status === "submitted"
          ? "Latihan sudah dikumpulkan."
          : Math.max(Number(attempt.remedialCount) || 0, 0) > 0
            ? "Sesi remedial siap dikerjakan."
            : "Latihan siap dikerjakan.",
      isOpen: attempt.status !== "submitted",
      myAttempt: publicAttempt,
    },
    task: {
      taskId: normalizeText(task.taskId),
      title: normalizeText(task.title),
      durationMinutes: task.durationMinutes,
      endAt: task.endAt ? task.endAt.toISOString() : null,
    },
    attempt: publicAttempt,
    questions: publicQuestions,
    result,
    expiresAt: publicAttempt.expiresAt,
    remainingSeconds: publicAttempt.remainingSeconds,
  };
}

export const startStudentClassTaskCbt = asyncHandler(
  async (
    req: Request<{ taskId: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const { student, subscriptionId } =
      await getAuthenticatedStudentCbtContextOrThrow(req.user._id.toString());

    const taskIdParam = normalizeText(req.params.taskId);
    if (!taskIdParam) {
      next(new AppError(400, "Task ID wajib diisi."));
      return;
    }

    const task = await ClassTask.findOne({
      $and: [
        { taskId: taskIdParam },
        buildStudentLearningClassFilter(student.className, student.branch),
      ],
    });

    if (!task) {
      next(new AppError(404, "Latihan tidak ditemukan."));
      return;
    }

    const questionCount = await ClassTaskQuestion.countDocuments({
      taskId: task.taskId,
      teacherId: task.teacherId,
    });

    if (questionCount <= 0 || !task.durationMinutes) {
       next(new AppError(400, "Latihan ini belum memiliki soal CBT atau durasi yang valid."));
       return;
    }

    const now = new Date();
    if (task.startAt && now < task.startAt) {
      next(new AppError(400, "Latihan ini belum dimulai."));
      return;
    }

    if (task.endAt && now > task.endAt) {
      next(new AppError(400, "Waktu pengerjaan Latihan ini sudah berakhir."));
      return;
    }

    let attempt = await StudentTaskAttempt.findOne({
      taskId: task.taskId,
      studentId: student.studentId,
    });

    if (!attempt) {
      const attemptId = await getNextPublicId(StudentTaskAttempt as any, "attemptId", "attempt");
      attempt = new StudentTaskAttempt({
        attemptId,
        taskId: task.taskId,
        teacherId: task.teacherId,
        classId: task.classId,
        branch: task.branch,
        studentId: student.studentId,
        subscriptionId,
        startedAt: now,
        status: "in_progress",
      });

      await attempt.save();
    } else if (attempt.status === "submitted") {
      const grade = await TaskGrade.findOne({
        taskId: task.taskId,
        studentId: student.studentId,
      });

      if (grade?.status !== "Perlu Remedial") {
        next(new AppError(400, "Anda sudah mengumpulkan Latihan ini."));
        return;
      }

      const remedialReason =
        normalizeText(grade.note) ||
        `Nilai sebelumnya belum mencapai KKM ${getTaskPassingGrade(task) ?? "-"}.`;

      archiveAttemptForRemedial(attempt, remedialReason, now);
      if (!attempt.subscriptionId && subscriptionId) {
        attempt.subscriptionId = subscriptionId;
      }
      grade.remedialRequestedAt = grade.remedialRequestedAt ?? now;
      await Promise.all([attempt.save(), grade.save()]);
    } else if (!attempt.subscriptionId && subscriptionId) {
      attempt.subscriptionId = subscriptionId;
      await attempt.save();
    }

    sendSuccess(res, {
      statusCode: 201,
      message: "Sesi pengerjaan Latihan berhasil dimulai.",
      data: {
      attemptId: attempt.attemptId,
    } as any,
    });
  }
);

export const getStudentClassTaskCbtSession = asyncHandler(
  async (
    req: Request<{ attemptId: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const { student } =
      await getAuthenticatedStudentCbtContextOrThrow(req.user._id.toString());

    const attemptIdParam = normalizeText(req.params.attemptId);
    const attempt = await StudentTaskAttempt.findOne({
      attemptId: attemptIdParam,
      studentId: student.studentId,
    });

    if (!attempt) {
      next(new AppError(404, "Sesi pengerjaan tidak ditemukan."));
      return;
    }

    const task = await ClassTask.findOne({
      $and: [
        { taskId: attempt.taskId },
        buildStudentLearningClassFilter(student.className, student.branch),
      ],
    });
    if (!task) {
      next(new AppError(404, "Latihan tidak ditemukan."));
      return;
    }

    const questions = await ClassTaskQuestion.find({
      taskId: task.taskId,
      teacherId: task.teacherId,
    }).sort({ order: 1 });

    sendSuccess(res, {
      statusCode: 200,
      message: "Data sesi Latihan berhasil diambil.",
      data: buildTaskCbtResponsePayload(task, questions, attempt) as any,
    });
  }
);

export const submitStudentClassTaskCbt = asyncHandler(
  async (
    req: Request<
      { attemptId: string },
      Record<string, never>,
      { answers: { questionId: string; selectedAnswer: string }[]; timeUsedSeconds: number }
    >,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const { student, subscriptionId } =
      await getAuthenticatedStudentCbtContextOrThrow(req.user._id.toString());

    const attemptIdParam = normalizeText(req.params.attemptId);
    const attempt = await StudentTaskAttempt.findOne({
      attemptId: attemptIdParam,
      studentId: student.studentId,
    });

    if (!attempt) {
      next(new AppError(404, "Sesi pengerjaan tidak ditemukan."));
      return;
    }

    if (attempt.status === "submitted") {
      next(new AppError(400, "Sesi pengerjaan sudah dikumpulkan sebelumnya."));
      return;
    }

    const task = await ClassTask.findOne({
      $and: [
        { taskId: attempt.taskId },
        buildStudentLearningClassFilter(student.className, student.branch),
      ],
    });
    if (!task) {
      next(new AppError(404, "Latihan tidak ditemukan."));
      return;
    }

    const questions = await ClassTaskQuestion.find({
      taskId: task.taskId,
      teacherId: task.teacherId,
    }).sort({ order: 1 });

    const payloadAnswers = req.body.answers || [];
    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;

    const validatedAnswers: IStudentTaskAttemptAnswer[] = questions.map((q) => {
      const submitted = payloadAnswers.find((a) => a.questionId === q.questionId);
      const selectedAnswerInput = normalizeText(submitted?.selectedAnswer).toUpperCase();
      const selectedAnswer = ["A", "B", "C", "D"].includes(selectedAnswerInput)
        ? selectedAnswerInput
        : "";
      let isCorrect = null;

      if (selectedAnswer) {
        if (selectedAnswer === q.correctAnswer) {
          isCorrect = true;
          correctCount++;
        } else {
          isCorrect = false;
          wrongCount++;
        }
      } else {
        unansweredCount++;
      }

      return {
        questionId: q.questionId,
        selectedAnswer: selectedAnswer as any,
        isCorrect,
      };
    });

    const maxScore = 100;
    const score = questions.length > 0 ? (correctCount / questions.length) * maxScore : 0;

    attempt.answers = validatedAnswers;
    attempt.correctCount = correctCount;
    attempt.wrongCount = wrongCount;
    attempt.unansweredCount = unansweredCount;
    attempt.score = Math.round(score * 100) / 100;
    attempt.timeUsedSeconds = typeof req.body.timeUsedSeconds === "number" ? req.body.timeUsedSeconds : 0;
    attempt.status = "submitted";
    attempt.submittedAt = new Date();

    
    // 1. Create or Update TaskSubmission
    let submission = await TaskSubmission.findOne({
      taskId: attempt.taskId,
      studentId: attempt.studentId,
    });

    if (!submission) {
      const submissionId = await getNextPublicId(TaskSubmission as any, "submissionId", "subm");
      submission = new TaskSubmission({
        submissionId,
        taskId: attempt.taskId,
        classId: attempt.classId,
        teacherId: attempt.teacherId,
        studentId: attempt.studentId,
        subscriptionId,
        submissionMode: "cbt",
      });
    }

    submission.subscriptionId = subscriptionId;
    submission.submissionMode = "cbt";
    submission.submittedAt = attempt.submittedAt;
    await submission.save();

    // 2. Create or Update TaskGrade
    let grade = await TaskGrade.findOne({
      taskId: attempt.taskId,
      studentId: attempt.studentId,
    });

    if (!grade) {
      const gradeId = await getNextPublicId(TaskGrade as any, "gradeId", "grade");
      grade = new TaskGrade({
        gradeId,
        taskId: attempt.taskId,
        classId: attempt.classId,
        teacherId: attempt.teacherId,
        studentId: attempt.studentId,
        subscriptionId,
      });
    }

    const passingGrade = getTaskPassingGrade(task);
    const needsRemedial = isTaskScoreBelowPassingGrade(task, attempt.score);
    const remedialCount = Math.max(Number(attempt.remedialCount) || 0, 0);

    grade.subscriptionId = subscriptionId;
    grade.score = attempt.score;
    grade.status = needsRemedial ? "Perlu Remedial" : "Sudah Dinilai";
    grade.gradedAt = attempt.submittedAt;
    grade.remedialCount = remedialCount;
    grade.remedialRequestedAt = needsRemedial
      ? new Date()
      : grade.remedialRequestedAt;
    grade.remedialCompletedAt = !needsRemedial && remedialCount > 0
      ? attempt.submittedAt
      : null;
    grade.note = needsRemedial
      ? `Nilai ${attempt.score} di bawah KKM ${passingGrade}. Siswa perlu remedial latihan ini.`
      : remedialCount > 0
        ? `Remedial ke-${remedialCount} selesai. Nilai akhir ${attempt.score} (${attempt.correctCount} Benar, ${attempt.wrongCount} Salah).`
        : `Dinilai otomatis oleh sistem CBT (${attempt.correctCount} Benar, ${attempt.wrongCount} Salah).`;
    await grade.save();

    attempt.subscriptionId = subscriptionId;
    await attempt.save();
    const syncedTaskMetrics = await syncTeacherTaskMetrics(
      task.teacherId.toString(),
      normalizeText(task.classId),
      normalizeText(task.taskId),
    );

    if (syncedTaskMetrics) {
      task.submittedCount = syncedTaskMetrics.submittedCount;
      task.reviewStatus = syncedTaskMetrics.reviewStatus;
      await task.save();
    }


    sendSuccess(res, {
      statusCode: 200,
      message: "Jawaban Latihan berhasil dikumpulkan.",
      data: buildTaskCbtResponsePayload(task, questions, attempt) as any,
    });
  }
);
