const fs = require('fs');
const file = 'D:\\Skripsi\\Next Js\\bimbel-new\\backend\\src\\controllers\\studentTaskCbtController.ts';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('import { TaskSubmission } from "../models/TaskSubmission";')) {
  content = content.replace(
    /import \{ Student \} from "\.\.\/models\/Student";/,
    `import { Student } from "../models/Student";\nimport { TaskSubmission } from "../models/TaskSubmission";\nimport { TaskGrade } from "../models/TaskGrade";`
  );
}

const targetInjection = `await attempt.save();`;
const injectionContent = `
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
        submissionMode: "cbt",
      });
    }

    submission.submittedAt = attempt.submittedAt;
    submission.status = "Terkirim";
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
      });
    }

    grade.score = attempt.score;
    grade.status = "Sudah Dinilai";
    grade.gradedAt = attempt.submittedAt;
    grade.note = \`Dinilai otomatis oleh sistem CBT (\${attempt.correctCount} Benar, \${attempt.wrongCount} Salah).\`;
    await grade.save();

    await attempt.save();
`;

// Only inject if it's not already there
if (!content.includes('TaskSubmission.findOne({')) {
  // Replace the last instance of `await attempt.save();` which is inside submitStudentClassTaskCbt
  const parts = content.split('await attempt.save();');
  if (parts.length >= 3) {
    // attempt.save() is used twice, once in start (index 1 boundary) and once in submit (index 2 boundary)
    // We want to replace the LAST one.
    content = parts.slice(0, parts.length - 1).join('await attempt.save();') + injectionContent + parts[parts.length - 1];
  }
}

fs.writeFileSync(file, content);
console.log('Injected TaskSubmission and TaskGrade logic to submitStudentClassTaskCbt');
