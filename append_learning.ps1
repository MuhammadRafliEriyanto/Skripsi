const fs = require('fs');
const file = 'D:\\Skripsi\\Next Js\\bimbel-new\\backend\\src\\controllers\\teacherLearningController.ts';
let content = fs.readFileSync(file, 'utf8');

const appendString = `
export const uploadTeacherClassTaskQuestionsFromXlsx = asyncHandler(
  async (
    req: Request<
      { classId: string; taskId: string },
      Record<string, never>,
      TaskQuestionXlsxUploadBody
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

    const { classGroup } = await resolveTeacherClassDetailContext(
      req.user._id.toString(),
      req.params.classId,
      req.query,
    );

    if (!classGroup) {
      next(new AppError(404, "Kelas tidak ditemukan untuk guru ini."));
      return;
    }

    const taskId = normalizeText(req.params.taskId);

    if (!taskId) {
      next(new AppError(404, "Task ID wajib diisi."));
      return;
    }

    const task = await ClassTask.findOne({
      taskId,
      classId: classGroup.item.id,
      teacherId: req.user._id,
    });

    if (!task) {
      next(new AppError(404, "Tugas latihan tidak ditemukan."));
      return;
    }

    const upload = decodeTaskXlsxUploadBody(req.body);
    const parsedUpload = parseTryoutXlsxBuffer(upload.buffer);
    const parsedQuestions = parsedUpload.questions;

    const existingQuestionsCount = await ClassTaskQuestion.countDocuments({
      teacherId: req.user._id,
      taskId: task.taskId,
    });

    const newQuestions = parsedQuestions.map((q, index) => {
      const globalOrder = existingQuestionsCount + index + 1;
      return {
        questionId: \`\${task.taskId}-Q\${globalOrder}\`,
        teacherId: req.user!._id,
        taskId: task.taskId,
        questionText: q.questionText,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctAnswer: q.correctAnswer,
        order: globalOrder,
      };
    });

    if (newQuestions.length > 0) {
      await ClassTaskQuestion.insertMany(newQuestions);

      task.questionCount = existingQuestionsCount + newQuestions.length;
      await task.save();
    }

    sendSuccess(res, 200, "Soal latihan berhasil diunggah.", {
      importedCount: newQuestions.length,
      totalCount: task.questionCount,
    });
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

    const { classGroup } = await resolveTeacherClassDetailContext(
      req.user._id.toString(),
      req.params.classId,
      req.query,
    );

    if (!classGroup) {
      next(new AppError(404, "Kelas tidak ditemukan."));
      return;
    }

    const taskId = normalizeText(req.params.taskId);
    if (!taskId) {
      next(new AppError(400, "ID latihan tidak valid."));
      return;
    }

    const task = await ClassTask.findOne({
      taskId,
      teacherId: req.user._id,
    });

    if (!task) {
      next(new AppError(404, "Latihan tidak ditemukan."));
      return;
    }

    const questions = await ClassTaskQuestion.find({
      taskId: task.taskId,
      teacherId: req.user._id,
    }).sort({ order: 1 });

    sendSuccess(res, 200, "Soal latihan berhasil diambil.", {
      questions: questions.map((q) => ({
        id: q.questionId,
        questionText: q.questionText,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctAnswer: q.correctAnswer,
        order: q.order,
      })),
      totalCount: questions.length,
    });
  },
);
`;

fs.writeFileSync(file, content + appendString);
console.log("Appended XLSX upload API to teacherLearningController.ts successfully!");
