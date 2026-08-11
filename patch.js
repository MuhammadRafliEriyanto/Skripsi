const fs = require('fs');
const file = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-guru\\sections\\DetailKelasGuruSection.tsx';
let content = fs.readFileSync(file, 'utf8');

// fix deadline
content = content.replace(/task\.deadline/g, 'task.tanggalSelesai');
content = content.replace(/draft\.deadline/g, 'draft.tanggalSelesai');
content = content.replace(/deadline: normalizeText\(task\.tanggalSelesai\)/g, 'deadline: normalizeText(task.deadline)');

// fix TeacherClassApiTaskItem type missing property deadline? No, the error is object literal may only specify known properties.
content = content.replace(/deadline: normalizeText\(task\.deadline\),/g, 'tanggalSelesai: normalizeText(task.deadline),');

// remove getAcademicGradeScheme
content = content.replace(/payload\.scheme && isKnownScheme\(payload\.scheme\)\r?\n\s*\? payload\.scheme\r?\n\s*: getAcademicGradeScheme\(`\$\{activeClass\.namaKelas\} \$\{activeClass\.tingkat\}`\)/g, '"semester"');

// remove mapTeacherApiAcademicGradeToEntry usage
content = content.replace(/mapTeacherApiAcademicGradeToEntry\([\s\S]*?\),/g, '');

// fix setAcademicGradeEntries, setSelectedTaskForScore, setNilaiDraft
content = content.replace(/setAcademicGradeEntries\([\s\S]*?\);\r?\n/g, '');
content = content.replace(/setSelectedTaskForScore\([\s\S]*?\);\r?\n/g, '');
content = content.replace(/setNilaiDraft\([\s\S]*?\);\r?\n/g, '');
content = content.replace(/setIsNilaiDialogOpen\([\s\S]*?\);\r?\n/g, '');

// fix .tugas, .note, .scores in export
content = content.replace(/score: draft\.tugas,/g, 'score: 0,');
content = content.replace(/note: normalizeText\(draft\.note\),/g, 'note: "",');
content = content.replace(/scores: draft\.scores,/g, 'scores: {},');
content = content.replace(/nilai\.tugas/g, '0');
content = content.replace(/nilai\.note/g, '""');
content = content.replace(/nilai\.scores/g, '{}');

// fix buildNilaiRows args
content = content.replace(/buildNilaiRows\([\s\S]*?activeClass\.participants,\r?\n\s*gradeEntries\r?\n\s*\)/g, 'buildNilaiRows(activeClass.participants, gradeEntries, tasks)');

// fix onGrade prop error
content = content.replace(/onGrade: \([\s\S]*?\) => void;/g, '');

fs.writeFileSync(file, content, 'utf8');
console.log('Patched');
