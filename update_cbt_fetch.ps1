const fs = require('fs');
const file = 'D:\\Skripsi\\Next Js\\bimbel-new\\backend\\src\\controllers\\studentLearningController.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /const attempt = await StudentTaskAttempt\.findOne\(\{\s*taskId: task\.taskId,\s*studentId: student\.studentId,\s*\}\);\s*if \(\!attempt\) \{\s*next\(new AppError\(404, "Sesi CBT belum dimulai\."\)\);\s*return;\s*\}/,
  `let attempt = await StudentTaskAttempt.findOne({
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
        subscriptionId: student.subscriptionId,
        status: "in_progress",
        startedAt: new Date(),
      });
    }`
);

fs.writeFileSync(file, content);
console.log("Updated getMyStudentTaskCbtData successfully!");
