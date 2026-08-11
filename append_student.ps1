const fs = require('fs');
const file = 'D:\\Skripsi\\Next Js\\bimbel-new\\backend\\src\\controllers\\studentLearningController.ts';
let content = fs.readFileSync(file, 'utf8');

const importRegex = /import \{ ClassTask \} from "\.\.\/models\/ClassTask";/;
if (content.match(importRegex)) {
  content = content.replace(
    /import \{ ClassTask \} from "\.\.\/models\/ClassTask";/,
    `import { ClassTask } from "../models/ClassTask";\nimport { ClassTaskQuestion } from "../models/ClassTaskQuestion";\nimport { StudentTaskAttempt } from "../models/StudentTaskAttempt";\nimport { v4 as uuidv4 } from "uuid";`
  );
}

const appendString = `
export const startMyStudentTaskCbt = asyncHandler(
  async (
    req: Request<{ taskId: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const { student, subscription } = await resolveStudentAcademicProfile(
      req.user._id.toString(),
    );

    const taskId = normalizeText(req.params.taskId);
    if (!taskId) {
      next(new AppError(400, "Task ID tidak valid."));
      return;
    }

    const task = await ClassTask.findOne({ taskId });
    if (!task) {
      next(new AppError(404, "Latihan tidak ditemukan."));
      return;
    }

    if (
      task.classId !== subscription.classId ||
      task.branch !== subscription.branch
    ) {
      next(new AppError(403, "Anda tidak terdaftar di kelas ini."));
      return;
    }

    const now = new Date();
    if (now < task.startAt) {
      next(new AppError(400, "Latihan CBT belum dimulai."));
      return;
    }

    let attempt = await StudentTaskAttempt.findOne({
      taskId: task.taskId,
      studentId: student.studentId,
    });

    if (!attempt) {
      attempt = await StudentTaskAttempt.create({
        attemptId: uuidv4(),
        taskId: task.taskId,
        teacherId: task.teacherId,
        classId: task.classId,
        branch: task.branch,
        studentId: student.studentId,
        subscriptionId: subscription._id,
        status: "in_progress",
        startedAt: now,
      });
    }

    sendSuccess(res, 200, "Berhasil memulai CBT latihan.", {
      attemptId: attempt.attemptId,
      status: attempt.status,
      startedAt: attempt.startedAt,
    });
  },
);

export const getMyStudentTaskCbtData = asyncHandler(
  async (
    req: Request<{ taskId: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const { student } = await resolveStudentAcademicProfile(
      req.user._id.toString(),
    );

    const taskId = normalizeText(req.params.taskId);
    const task = await ClassTask.findOne({ taskId });

    if (!task) {
      next(new AppError(404, "Latihan tidak ditemukan."));
      return;
    }

    const attempt = await StudentTaskAttempt.findOne({
      taskId: task.taskId,
      studentId: student.studentId,
    });

    if (!attempt) {
      next(new AppError(404, "Sesi CBT belum dimulai."));
      return;
    }

    const questions = await ClassTaskQuestion.find({
      taskId: task.taskId,
    }).sort({ order: 1 });

    sendSuccess(res, 200, "Data sesi CBT berhasil diambil.", {
      attempt: {
        attemptId: attempt.attemptId,
        status: attempt.status,
        startedAt: attempt.startedAt,
        answers: attempt.answers,
        score: attempt.score,
      },
      task: {
        durationMinutes: task.durationMinutes,
        endAt: task.endAt,
      },
      questions: questions.map((q) => ({
        id: q.questionId,
        questionText: q.questionText,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        order: q.order,
      })),
    });
  },
);

export const submitMyStudentTaskCbt = asyncHandler(
  async (
    req: Request<
      { taskId: string },
      Record<string, never>,
      {
        answers: { questionId: string; selectedAnswer: string }[];
        timeUsedSeconds?: number;
      }
    >,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const { student } = await resolveStudentAcademicProfile(
      req.user._id.toString(),
    );

    const taskId = normalizeText(req.params.taskId);
    const task = await ClassTask.findOne({ taskId });

    if (!task) {
      next(new AppError(404, "Latihan tidak ditemukan."));
      return;
    }

    const attempt = await StudentTaskAttempt.findOne({
      taskId: task.taskId,
      studentId: student.studentId,
    });

    if (!attempt || attempt.status === "submitted") {
      next(new AppError(400, "Sesi CBT tidak valid atau sudah dikumpulkan."));
      return;
    }

    const questions = await ClassTaskQuestion.find({
      taskId: task.taskId,
    });

    const questionMap = new Map<string, any>(
      questions.map((q) => [q.questionId, q]),
    );

    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;

    const validatedAnswers = questions.map((q) => {
      const studentAnswer = req.body.answers?.find(
        (a) => a.questionId === q.questionId,
      );
      const selectedAnswer = normalizeText(studentAnswer?.selectedAnswer) as any;

      const isCorrect = selectedAnswer === q.correctAnswer;
      if (selectedAnswer === "") {
        unansweredCount++;
      } else if (isCorrect) {
        correctCount++;
      } else {
        wrongCount++;
      }

      return {
        questionId: q.questionId,
        selectedAnswer: selectedAnswer || "",
        isCorrect: selectedAnswer === "" ? null : isCorrect,
      };
    });

    const score = questions.length > 0 ? (correctCount / questions.length) * 100 : 0;

    attempt.answers = validatedAnswers;
    attempt.correctCount = correctCount;
    attempt.wrongCount = wrongCount;
    attempt.unansweredCount = unansweredCount;
    attempt.score = score;
    attempt.timeUsedSeconds = typeof req.body.timeUsedSeconds === "number" ? req.body.timeUsedSeconds : 0;
    attempt.status = "submitted";
    attempt.submittedAt = new Date();

    await attempt.save();

    task.submittedCount += 1;
    await task.save();

    sendSuccess(res, 200, "Latihan berhasil dikumpulkan.", {
      score,
      correctCount,
      wrongCount,
      unansweredCount,
    });
  },
);
`;

fs.writeFileSync(file, content + appendString);
console.log("Appended student CBT Latihan endpoints successfully!");
