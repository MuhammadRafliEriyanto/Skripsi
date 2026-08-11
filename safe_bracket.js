const fs = require('fs');
const file = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-guru\\sections\\DetailKelasGuruSection.tsx';
let content = fs.readFileSync(file, 'utf8');

function removeFunction(code, funcName, isAsync = false) {
    const regexText = isAsync ? `async function ${funcName}\\(` : `function ${funcName}\\(`;
    const regex = new RegExp(regexText);
    const match = code.match(regex);
    if (!match) return code;
    
    let startIndex = match.index;
    let braceCount = 0;
    let inString = false;
    let inTemplate = false;
    let i = startIndex;
    let foundFirstBrace = false;

    while (i < code.length) {
        const char = code[i];
        const nextChar = code[i+1];
        
        if (char === '"' || char === "'") {
            if (!inTemplate) inString = !inString;
        } else if (char === '`') {
            if (!inString) inTemplate = !inTemplate;
        } else if (!inString && !inTemplate) {
            if (char === '{') {
                braceCount++;
                foundFirstBrace = true;
            } else if (char === '}') {
                braceCount--;
                if (foundFirstBrace && braceCount === 0) {
                    return code.substring(0, startIndex) + code.substring(i + 1);
                }
            }
        }
        i++;
    }
    return code;
}

// 1. Remove all unused functions
const functionsToRemove = [
    "mapTeacherApiAcademicGradeToEntry",
    "createNilaiDraft",
    "mapTeacherDetailToAcademicGrades",
    "handleNilaiDraftChange",
    "handleAcademicScoreChange",
    "handleNilaiDialogOpenChange",
    "handleSelectedStudentChange",
    "handleSelectedTaskChange",
    "openNilaiDialogForStudent",
    "openNilaiDialogForTask"
];
functionsToRemove.forEach(f => {
    content = removeFunction(content, f, false);
});
content = removeFunction(content, "saveAcademicGradeRequest", true);
content = removeFunction(content, "handleSaveNilai", true);

// 2. Remove states
content = content.replace(/const \[academicGradeEntries[\s\S]*?\([\s\S]*?\);\r?\n/g, '');
content = content.replace(/const \[isNilaiDialogOpen[\s\S]*?\([\s\S]*?\);\r?\n/g, '');
content = content.replace(/const \[nilaiDraft[\s\S]*?\([\s\S]*?\);\r?\n/g, '');
content = content.replace(/const \[selectedTaskForScore[\s\S]*?\([\s\S]*?\);\r?\n/g, '');

// 3. Remove TeacherClassDetailResponse fields
content = content.replace(/  scheme\?: AcademicGradeScheme;\r?\n  scores\?: Partial<AcademicScores>;\r?\n/g, '');
content = content.replace(/    scheme\?: AcademicGradeScheme;\r?\n/g, '');

// 4. Update loadClassDetail references
content = content.replace(/const nextAcademicScheme =\r?\n\s*payload\.academicScheme && isKnownScheme\(payload\.academicScheme\)\r?\n\s*\? payload\.academicScheme\r?\n\s*: getAcademicGradeScheme\(`\$\{activeClass\.namaKelas\} \$\{activeClass\.tingkat\}`\);\r?\n/g, '');
content = content.replace(/const nextAcademicGradeEntries = mapTeacherDetailToAcademicGrades\([\s\S]*?\);\r?\n/g, '');
content = content.replace(/setAcademicGradeEntries\(nextAcademicGradeEntries\);\r?\n/g, '');
content = content.replace(/setAcademicGradeEntries\(\[\]\);\r?\n/g, '');

// 5. Replace buildNilaiRows args
content = content.replace(/buildNilaiRows\(\s*nextClassDetail\.participants,\s*nextGradeEntries,\s*nextAcademicGradeEntries,\s*\)/g, 'buildNilaiRows(nextClassDetail.participants, nextGradeEntries, nextTasks)');
content = content.replace(/buildNilaiRows\(\s*activeClass\.participants,\s*nextGradeEntries,\s*academicGradeEntries,\s*\)/g, 'buildNilaiRows(activeClass.participants, nextGradeEntries, tasks)');

// 6. Fix deadline to tanggalSelesai for TugasPertemuan
content = content.replace(/tugasDraft\.deadline/g, 'tugasDraft.tanggalSelesai');
content = content.replace(/task\.deadline/g, 'task.tanggalSelesai');
content = content.replace(/draft\.deadline/g, 'draft.tanggalSelesai');
// But TeacherClassApiTaskItem STILL has deadline
content = content.replace(/deadline: normalizeText\(task\.tanggalSelesai\),/g, 'deadline: normalizeText(task.deadline),');
content = content.replace(/deadline: task\.tanggalSelesai,/g, 'deadline: task.deadline,');

// 7. Update exportToCsv unused fields
content = content.replace(/const tugasScore = nilai\.tugas \?\? "-";\r?\n/g, '');
content = content.replace(/const scoreValues = academicScoreKeys\.map\([\s\S]*?\);\r?\n/g, '');
content = content.replace(/tugasScore,\r?\n\s*\.\.\.scoreValues,/g, '...Array.from({length: 24}, (_, i) => nilai.pertemuanScores[i + 1] ?? "-"),');
content = content.replace(/"Latihan Soal",\r?\n\s*\.\.\.academicScoreKeys\.map\([\s\S]*?\),/g, '...Array.from({length: 24}, (_, i) => `P${i + 1}`),');

// 8. Remove `onGrade` from TugasPertemuanTable
content = content.replace(/onGrade=\{openNilaiDialogForTask\}\r?\n/g, '');

// 9. Remove NilaiFormDialog JSX
const dialogIdx = content.indexOf('<NilaiFormDialog');
if (dialogIdx > -1) {
   const endIdx = content.indexOf('/>', dialogIdx) + 2;
   content = content.substring(0, dialogIdx) + content.substring(endIdx);
}

// 10. Update TabelNilaiTable JSX props
content = content.replace(/onEditNilai=\{openNilaiDialogForStudent\}\r?\n/g, '');
content = content.replace(/scheme=\{academicScheme\}\r?\n/g, '');
content = content.replace(/includeTaskScore=\{!isUtbkClass\}\r?\n/g, '');

// 11. Remove imports
content = content.replace(/import \{[\s\S]*?\} from "@\/lib\/academic-grades";\r?\n/g, '');
content = content.replace(/import NilaiFormDialog[\s\S]*?;\r?\n/g, '');

// 12. Fix saveGradeRequest to not use draft.tugas/draft.note
content = content.replace(/        score: draft\.tugas,\r?\n        note: normalizeText\(draft\.note\),\r?\n/g, '        score: 0,\r?\n        note: "",\r?\n');

// 13. Replace buildNilaiRows completely
content = removeFunction(content, "buildNilaiRows", false);
const newBuildNilaiRows = `
function buildNilaiRows(
  participants: ClassStudent[],
  gradeEntries: TeacherTaskGradeEntry[],
  tasks: TugasPertemuan[],
) {
  return participants.map((student) => {
    const studentGrades = gradeEntries.filter(
      (grade) =>
        normalizeText(grade.studentId) === normalizeText(student.id) &&
        grade.status === "Sudah Dinilai",
    );
    
    const pertemuanScores: Record<number, number | null> = {};
    for (let i = 1; i <= 24; i++) {
      pertemuanScores[i] = null;
    }
    
    studentGrades.forEach(grade => {
      const task = tasks.find(t => normalizeText(t.id) === normalizeText(grade.taskId));
      if (task && task.pertemuanKe) {
         pertemuanScores[task.pertemuanKe] = grade.score;
      }
    });

    return {
      studentId: student.id,
      pertemuanScores,
    } satisfies NilaiSiswa;
  });
}
`;
// insert it somewhere near the top
const importsEnd = content.indexOf('export default function DetailKelasGuruSection(');
content = content.substring(0, importsEnd) + newBuildNilaiRows + content.substring(importsEnd);

// 14. Remove dangling 'academicGradeEntries,' in dependencies arrays (like useMemo)
content = content.replace(/academicGradeEntries,\r?\n/g, '');

// Write file
fs.writeFileSync(file, content, 'utf8');
console.log('Safe bracket refactor complete');
