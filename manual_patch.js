const fs = require('fs');
const file = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-guru\\sections\\DetailKelasGuruSection.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. buildNilaiRows body replacement
const buildNilaiRowsOld = `function buildNilaiRows(
  participants: ClassStudent[],
  gradeEntries: TeacherTaskGradeEntry[],
  academicGradeEntries: TeacherAcademicGradeEntry[],
) {
  return participants.map((student) => {
    const studentGrades = gradeEntries.filter(
      (grade) =>
        normalizeText(grade.studentId) === normalizeText(student.id) &&
        grade.status === "Sudah Dinilai",
    );
    const tugasScore = studentGrades.length
      ? Math.round(
          studentGrades.reduce((total, grade) => total + grade.score, 0) /
            studentGrades.length,
        )
      : null;
    const academicGrade = academicGradeEntries.find(
      (grade) =>
        normalizeText(grade.studentId) === normalizeText(student.id),
    );

    return {
      studentId: student.id,
      tugas: tugasScore,
      scores: academicGrade?.scores ?? { ...EMPTY_ACADEMIC_SCORES },
      note: academicGrade?.note ?? "",
    } satisfies NilaiSiswa;
  });
}`;

const buildNilaiRowsNew = `function buildNilaiRows(
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
}`;
content = content.replace(buildNilaiRowsOld, buildNilaiRowsNew);

// 2. update buildNilaiRows calls
content = content.replace(/buildNilaiRows\(\s*nextClassDetail\.participants,\s*nextGradeEntries,\s*nextAcademicGradeEntries,\s*\)/g, 'buildNilaiRows(nextClassDetail.participants, nextGradeEntries, nextTasks)');
content = content.replace(/buildNilaiRows\(\s*activeClass\.participants,\s*nextGradeEntries,\s*academicGradeEntries,\s*\)/g, 'buildNilaiRows(activeClass.participants, nextGradeEntries, tasks)');

// 3. remove NilaiFormDialog JSX completely
const dialogStart = content.indexOf('<NilaiFormDialog');
if (dialogStart > -1) {
  const dialogEnd = content.indexOf('/>', dialogStart) + 2;
  content = content.substring(0, dialogStart) + content.substring(dialogEnd);
}

// 4. remove TabelNilaiTable onEditNilai
content = content.replace(/onEditNilai=\{openNilaiDialogForStudent\}\r?\n/g, '');
content = content.replace(/scheme=\{academicScheme\}\r?\n/g, '');
content = content.replace(/includeTaskScore=\{!isUtbkClass\}\r?\n/g, '');

// 5. remove TugasPertemuanTable onGrade
content = content.replace(/onGrade=\{openNilaiDialogForTask\}\r?\n/g, '');

// 6. fix NilaiDraft creating/changing to not use deleted properties
const createNilaiDraftOld = `function createNilaiDraft(
  studentId: string,
  taskId: string,
  nilaiRows: NilaiSiswa[],
  gradeEntries: TeacherTaskGradeEntry[],
  academicGradeEntries: TeacherAcademicGradeEntry[],
): NilaiDraft {
  const currentValue =
    nilaiRows.find((nilai) => nilai.studentId === studentId) ??
    createEmptyNilai(studentId);
  const existingGrade = gradeEntries.find(
    (grade) =>
      normalizeText(grade.studentId) === normalizeText(studentId) &&
      normalizeText(grade.taskId) === normalizeText(taskId),
  );
  const existingAcademicGrade = academicGradeEntries.find(
    (grade) =>
      normalizeText(grade.studentId) === normalizeText(studentId),
  );

  return {
    studentId,
    tugas: existingGrade?.score ?? null,
    scores: existingAcademicGrade?.scores ?? currentValue.scores,
    note: existingAcademicGrade?.note ?? existingGrade?.note ?? "",
  };
}`;
const createNilaiDraftNew = `function createNilaiDraft(
  studentId: string,
  taskId: string,
  nilaiRows: NilaiSiswa[],
  gradeEntries: TeacherTaskGradeEntry[],
  academicGradeEntries: TeacherAcademicGradeEntry[],
): NilaiDraft {
  const currentValue =
    nilaiRows.find((nilai) => nilai.studentId === studentId) ??
    createEmptyNilai(studentId);
  return {
    studentId,
    pertemuanScores: currentValue.pertemuanScores,
  };
}`;
content = content.replace(createNilaiDraftOld, createNilaiDraftNew);

// fix saveGradeRequest
content = content.replace(/score: draft\.tugas,/g, 'score: 0,');
content = content.replace(/note: normalizeText\(draft\.note\),/g, 'note: "",');

// fix print and CSV exports (tugas, scores, note)
content = content.replace(/const tugasScore = nilai\.tugas \?\? "-";\r?\n/g, '');
content = content.replace(/const scoreValues = academicScoreKeys\.map\(\s*\(key\) => formatScore\(nilai\.scores\[key\]\),\s*\);\r?\n/g, 'const scoreValues = Array.from({length: 24}, (_, i) => nilai.pertemuanScores[i + 1] ?? "-");\n');
content = content.replace(/"Latihan Soal",\r?\n\s*\.\.\.academicScoreKeys\.map\(\(key\) => ACADEMIC_SCORE_LABELS\[key\]\),/g, '...Array.from({length: 24}, (_, i) => `P${i + 1}`),');
content = content.replace(/tugasScore,\r?\n\s*\.\.\.scoreValues,/g, '...scoreValues,');

content = content.replace(/tugas: \(\s*nilai\.tugas \?\? 0\r?\n\s*\)\.toString\(\),/g, 'tugas: "0",');
content = content.replace(/note: nilai\.note || "-",/g, 'note: "-",');
content = content.replace(/\.\.\.Object\.fromEntries\(\r?\n\s*academicScoreKeys\.map\(\(key\) => \[\r?\n\s*key,\r?\n\s*\(nilai\.scores\[key\] \?\? 0\)\.toString\(\),\r?\n\s*\]\),\r?\n\s*\),/g, '...Object.fromEntries(Array.from({length: 24}, (_, i) => [`p${i+1}`, (nilai.pertemuanScores[i+1] ?? 0).toString()])),');


fs.writeFileSync(file, content, 'utf8');
console.log('Patch complete');
