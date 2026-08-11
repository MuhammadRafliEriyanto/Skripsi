const fs = require('fs');
const file = 'D:\\Skripsi\\Next Js\\bimbel-new\\backend\\src\\controllers\\teacherLearningController.ts';
let content = fs.readFileSync(file, 'utf8');

// Update UpsertClassTaskBody
content = content.replace(
  /type UpsertClassTaskBody = \{[\s\S]*?removeAttachment\?: boolean \| string;\n\};/,
  `type UpsertClassTaskBody = {
  meetingNumber?: number | string;
  title?: string;
  description?: string;
  deadline?: string;
  startAt?: string;
  endAt?: string;
  durationMinutes?: number | string;
  questionCount?: number | string;
  passingGrade?: number | string;
  attachmentFileName?: string;
  attachmentMimeType?: string;
  attachmentFileDataBase64?: string;
  removeAttachment?: boolean | string;
};`
);

// We need to inject these fields into `createTeacherClassTask` when creating `newTask`
// Let's find the `const newTask = new ClassTask({` part in createTeacherClassTask
const createPattern = /const newTask = new ClassTask\(\{\n\s+taskId,\n\s+classId: classGroup\.item\.kelasId,\n\s+teacherId: teacher\._id,\n\s+className: classGroup\.className,\n\s+canonicalClassName: classGroup\.item\.kelasId,\n\s+subject: teacher\.subject,\n\s+branch: classGroup\.item\.cabang,\n\s+room: classGroup\.item\.ruangan,\n\s+meetingNumber,\n\s+title,\n\s+description,\n\s+deadline,\n\s+attachment,\n\s+academicYear: period\.academicYear,\n\s+semester: period\.semester,\n\s+\}\);/;

content = content.replace(
  createPattern,
  `const newTask = new ClassTask({
        taskId,
        classId: classGroup.item.kelasId,
        teacherId: teacher._id,
        className: classGroup.className,
        canonicalClassName: classGroup.item.kelasId,
        subject: teacher.subject,
        branch: classGroup.item.cabang,
        room: classGroup.item.ruangan,
        meetingNumber,
        title,
        description,
        deadline,
        startAt: req.body.startAt ? new Date(req.body.startAt) : null,
        endAt: req.body.endAt ? new Date(req.body.endAt) : null,
        durationMinutes: normalizePositiveInteger(req.body.durationMinutes) ?? null,
        questionCount: normalizePositiveInteger(req.body.questionCount) ?? 0,
        passingGrade: normalizePositiveInteger(req.body.passingGrade) ?? null,
        attachment,
        academicYear: period.academicYear,
        semester: period.semester,
      });`
);

// Same for updateTeacherClassTask
const updatePattern = /task\.title = title;\n\s+task\.description = description;\n\s+task\.deadline = deadline;/;

content = content.replace(
  updatePattern,
  `task.title = title;
      task.description = description;
      task.deadline = deadline;
      if (req.body.startAt !== undefined) task.startAt = req.body.startAt ? new Date(req.body.startAt) : null;
      if (req.body.endAt !== undefined) task.endAt = req.body.endAt ? new Date(req.body.endAt) : null;
      if (req.body.durationMinutes !== undefined) task.durationMinutes = normalizePositiveInteger(req.body.durationMinutes) ?? null;
      if (req.body.questionCount !== undefined) task.questionCount = normalizePositiveInteger(req.body.questionCount) ?? 0;
      if (req.body.passingGrade !== undefined) task.passingGrade = normalizePositiveInteger(req.body.passingGrade) ?? null;`
);

fs.writeFileSync(file, content);
console.log('Fixed teacherLearningController.ts payload mapping');
