const fs = require('fs');
const file = 'D:\\Skripsi\\Next Js\\bimbel-new\\backend\\src\\controllers\\teacherLearningController.ts';
let content = fs.readFileSync(file, 'utf8');

const importRegex = /import \{[\s\S]*?\} from "\.\.\/utils\/classroomLearning";/;
if (content.match(importRegex)) {
  content = content.replace(
    /import \{([\s\S]*?)\} from "\.\.\/utils\/classroomLearning";/,
    `import {$1} from "../utils/classroomLearning";\nimport { parseTryoutXlsxBuffer } from "../utils/tryoutXlsxParser";`
  );
}

const classTaskImportRegex = /import \{ ClassTask \} from "\.\.\/models\/ClassTask";/;
if (content.match(classTaskImportRegex)) {
  content = content.replace(
    /import \{ ClassTask \} from "\.\.\/models\/ClassTask";/,
    `import { ClassTask } from "../models/ClassTask";\nimport { ClassTaskQuestion } from "../models/ClassTaskQuestion";`
  );
}

const typesRegex = /type UpsertClassTaskBody = \{[\s\S]*?\};/;
if (content.match(typesRegex)) {
  content = content.replace(
    /type UpsertClassTaskBody = \{[\s\S]*?\};/,
    `type UpsertClassTaskBody = {
  meetingNumber?: number | string;
  title?: string;
  description?: string;
  deadline?: string;
  durationMinutes?: number | string;
  startAt?: string;
  endAt?: string;
  passingGrade?: number | string;
  questionCount?: number | string;
  attachmentFileName?: string;
  attachmentMimeType?: string;
  attachmentFileDataBase64?: string;
  removeAttachment?: boolean | string;
};

type TaskQuestionXlsxUploadBody = {
  fileName: string;
  fileDataBase64: string;
};

function decodeTaskXlsxUploadBody(body: TaskQuestionXlsxUploadBody) {
  const fileName = normalizeText(body.fileName);
  const fileDataBase64 = normalizeText(body.fileDataBase64);

  if (!fileName) {
    throw new AppError(400, "Nama file XLSX wajib dikirim.");
  }

  if (!/\\.(xlsx|xls)$/i.test(fileName)) {
    throw new AppError(400, "File soal wajib berformat .xlsx atau .xls.");
  }

  if (!fileDataBase64) {
    throw new AppError(400, "Data file XLSX wajib dikirim.");
  }

  const normalizedBase64 = fileDataBase64.includes(",")
    ? fileDataBase64.slice(fileDataBase64.indexOf(",") + 1)
    : fileDataBase64;
  const buffer = Buffer.from(normalizedBase64, "base64");

  return { fileName, buffer };
}
`
  );
}

const createRegex = /const deadline = normalizeText\(req\.body\.deadline\);[\s\S]*?if \(\!deadline\) \{[\s\S]*?throw new AppError\(400, "Deadline tugas wajib diisi\."\);[\s\S]*?\}/;
if (content.match(createRegex)) {
  content = content.replace(createRegex, `const deadline = normalizeText(req.body.deadline);
    if (!deadline) {
      throw new AppError(400, "Deadline tugas wajib diisi.");
    }
    const durationMinutes = normalizePositiveInteger(req.body.durationMinutes) ?? 60;
    const startAt = req.body.startAt ? new Date(normalizeText(req.body.startAt)) : new Date();
    const endAt = req.body.endAt ? new Date(normalizeText(req.body.endAt)) : new Date(new Date().getTime() + durationMinutes * 60000);
    const passingGrade = normalizePositiveInteger(req.body.passingGrade) ?? 70;
    const questionCount = normalizePositiveInteger(req.body.questionCount) ?? 0;`);
}

const buildClassTaskCreateRegex = /className: classGroup\.className,\n\s*canonicalClassName: buildCanonicalClassName\(classGroup\.className\),\n\s*subject: classGroup\.item\.subject,\n\s*branch: classGroup\.item\.branch,\n\s*room: normalizeText\(classGroup\.item\.room\),\n\s*meetingNumber,\n\s*title,\n\s*description,\n\s*deadline,\n\s*attachment: newAttachment,/;
if (content.match(buildClassTaskCreateRegex)) {
    content = content.replace(buildClassTaskCreateRegex, `className: classGroup.className,
          canonicalClassName: buildCanonicalClassName(classGroup.className),
          subject: classGroup.item.subject,
          branch: classGroup.item.branch,
          room: normalizeText(classGroup.item.room),
          meetingNumber,
          title,
          description,
          deadline,
          durationMinutes,
          startAt,
          endAt,
          passingGrade,
          questionCount,
          attachment: newAttachment,`);
}

const buildClassTaskUpdateRegex = /task\.title = title;\n\s*task\.description = description;\n\s*task\.deadline = deadline;/;
if (content.match(buildClassTaskUpdateRegex)) {
    content = content.replace(buildClassTaskUpdateRegex, `task.title = title;
      task.description = description;
      task.deadline = deadline;
      if (req.body.durationMinutes !== undefined) {
        task.durationMinutes = normalizePositiveInteger(req.body.durationMinutes) ?? task.durationMinutes;
      }
      if (req.body.startAt !== undefined) {
        task.startAt = new Date(normalizeText(req.body.startAt));
      }
      if (req.body.endAt !== undefined) {
        task.endAt = new Date(normalizeText(req.body.endAt));
      }
      if (req.body.passingGrade !== undefined) {
        task.passingGrade = normalizePositiveInteger(req.body.passingGrade) ?? task.passingGrade;
      }
      if (req.body.questionCount !== undefined) {
        task.questionCount = normalizePositiveInteger(req.body.questionCount) ?? task.questionCount;
      }`);
}

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
      classId: classGroup.item.classId,
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
console.log("Patched teacherLearningController.ts successfully!");
