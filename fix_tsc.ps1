const fs = require('fs');

// Fix studentLearningController.ts
let studentFile = 'D:\\Skripsi\\Next Js\\bimbel-new\\backend\\src\\controllers\\studentLearningController.ts';
let studentContent = fs.readFileSync(studentFile, 'utf8');

studentContent = studentContent.replace(
  /import \{ v4 as uuidv4 \} from "uuid";/,
  `import crypto from "crypto";\nimport { resolveStudentAcademicProfile } from "../utils/studentAcademicStatus";`
);

studentContent = studentContent.replace(/uuidv4\(\)/g, `crypto.randomUUID()`);

studentContent = studentContent.replace(
  /sendSuccess\(res, 200, "Berhasil memulai CBT latihan\.", \{\s*attemptId: attempt\.attemptId,\s*status: attempt\.status,\s*startedAt: attempt\.startedAt,\s*\}\);/g,
  `sendSuccess(res, { statusCode: 200, message: "Berhasil memulai CBT latihan.", data: { attemptId: attempt.attemptId, status: attempt.status, startedAt: attempt.startedAt } });`
);

studentContent = studentContent.replace(
  /sendSuccess\(res, 200, "Data sesi CBT berhasil diambil\.", \{/g,
  `sendSuccess(res, { statusCode: 200, message: "Data sesi CBT berhasil diambil.", data: {`
);

studentContent = studentContent.replace(
  /order: q\.order,\s*\}\)\),\s*\}\);/g,
  `order: q.order,
      })),
    } });`
);

studentContent = studentContent.replace(
  /sendSuccess\(res, 200, "Latihan berhasil dikumpulkan\.", \{\s*score,\s*correctCount,\s*wrongCount,\s*unansweredCount,\s*\}\);/g,
  `sendSuccess(res, { statusCode: 200, message: "Latihan berhasil dikumpulkan.", data: { score, correctCount, wrongCount, unansweredCount } });`
);

fs.writeFileSync(studentFile, studentContent);
console.log("Fixed studentLearningController.ts");

// Fix teacherLearningController.ts
let teacherFile = 'D:\\Skripsi\\Next Js\\bimbel-new\\backend\\src\\controllers\\teacherLearningController.ts';
let teacherContent = fs.readFileSync(teacherFile, 'utf8');

teacherContent = teacherContent.replace(
  /sendSuccess\(res, 200, "Soal latihan berhasil diunggah\.", \{\s*importedCount: newQuestions\.length,\s*totalCount: task\.questionCount,\s*\}\);/g,
  `sendSuccess(res, { statusCode: 200, message: "Soal latihan berhasil diunggah.", data: { importedCount: newQuestions.length, totalCount: task.questionCount } });`
);

teacherContent = teacherContent.replace(
  /sendSuccess\(res, 200, "Soal latihan berhasil diambil\.", \{/g,
  `sendSuccess(res, { statusCode: 200, message: "Soal latihan berhasil diambil.", data: {`
);

teacherContent = teacherContent.replace(
  /totalCount: questions\.length,\s*\}\);/g,
  `totalCount: questions.length,
    } });`
);

fs.writeFileSync(teacherFile, teacherContent);
console.log("Fixed teacherLearningController.ts");

// Fix teacherScheduleRoutes.ts
let routesFile = 'D:\\Skripsi\\Next Js\\bimbel-new\\backend\\src\\routes\\teacherScheduleRoutes.ts';
let routesContent = fs.readFileSync(routesFile, 'utf8');
routesContent = routesContent.replace(/downloadTeacherClassTaskAttachment,\s*downloadTeacherClassTaskAttachment,/, `downloadTeacherClassTaskAttachment,`);
fs.writeFileSync(routesFile, routesContent);
console.log("Fixed teacherScheduleRoutes.ts");

