const fs = require('fs');
const file = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-guru\\sections\\DetailKelasGuruSection.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove academic fields from TeacherClassDetailResponse
content = content.replace(/  scheme\?: AcademicGradeScheme;\r?\n  scores\?: Partial<AcademicScores>;\r?\n/g, '');
content = content.replace(/    scheme\?: AcademicGradeScheme;\r?\n/g, '');

// 2. Remove mapTeacherDetailToAcademicGrades completely
content = content.replace(/function mapTeacherDetailToAcademicGrades\([\s\S]*?\}\r?\n/g, '');

// 3. Remove saveAcademicGradeRequest completely
content = content.replace(/async function saveAcademicGradeRequest\([\s\S]*?\}\r?\n/g, '');

// 4. Update saveGradeRequest to not use draft.tugas/draft.note
content = content.replace(/        score: draft\.tugas,\r?\n        note: normalizeText\(draft\.note\),\r?\n/g, '        score: 0,\r?\n        note: "",\r?\n');

// 5. Fix deadline -> tanggalSelesai in TeacherClassApiTaskItem
// Wait, TeacherClassApiTaskItem actually has `deadline: string`! My previous script changed it to `tanggalSelesai`.
content = content.replace(/deadline: normalizeText\(task\.tanggalSelesai\)/g, 'deadline: normalizeText(task.deadline)');
content = content.replace(/deadline: task\.tanggalSelesai/g, 'deadline: task.deadline');
content = content.replace(/deadline: draft\.tanggalSelesai/g, 'deadline: draft.deadline');

// 6. Fix `getAcademicGradeScheme` inside loadClassDetail
content = content.replace(/const nextAcademicScheme =\r?\n\s*payload\.academicScheme && isKnownScheme\(payload\.academicScheme\)\r?\n\s*\? payload\.academicScheme\r?\n\s*: getAcademicGradeScheme\(`\$\{activeClass\.namaKelas\} \$\{activeClass\.tingkat\}`\);\r?\n/g, '');

// 7. Remove `onGrade={openNilaiDialogForTask}`
content = content.replace(/            onGrade=\{openNilaiDialogForTask\}\r?\n/g, '');

// 8. Find what is on line 2336 (academicGradeEntries)
content = content.replace(/academicGradeEntries,/g, '');

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed more TS errors');
