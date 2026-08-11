const fs = require('fs');

// 1. types.ts
const typesFile = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-guru\\detail-kelas\\types.ts';
let types = fs.readFileSync(typesFile, 'utf8');
if (!types.includes('pertemuanScores')) {
    types = types.replace(/  note: string;\r?\n}/, '  note: string;\n  pertemuanScores?: Record<number, number | null>;\n}');
    fs.writeFileSync(typesFile, types, 'utf8');
}

// 2. TabelNilaiTable.tsx
const tableFile = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-guru\\detail-kelas\\TabelNilaiTable.tsx';
let table = fs.readFileSync(tableFile, 'utf8');

const theadOld = `          <TableHead className="w-[120px]">Latihan Soal</TableHead>
          {includeTaskScore &&
            ACADEMIC_SCORE_KEYS.filter((key) => scheme[key]).map((key) => (
              <TableHead key={key} className="w-[120px]">
                {ACADEMIC_SCORE_LABELS[key]}
              </TableHead>
            ))}
          <TableHead className="w-[100px]">Total</TableHead>
          <TableHead className="w-[100px]">Rata-rata</TableHead>`;
const theadNew = `          <TableHead className="w-[120px]">Latihan Soal</TableHead>
          {Array.from({ length: 24 }).map((_, i) => (
            <TableHead key={i} className="w-[80px]">
              P{i + 1}
            </TableHead>
          ))}
          <TableHead className="w-[100px]">Total</TableHead>
          <TableHead className="w-[100px]">Rata-rata</TableHead>`;
if (table.includes(theadOld)) table = table.replace(theadOld, theadNew);

const tbodyOld = `                <TableCell>
                  <div className="flex items-center gap-2">
                    {formatScore(row.tugas)}
                    <button
                      onClick={() => onEditNilai(row.studentId)}
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                </TableCell>
                {includeTaskScore &&
                  ACADEMIC_SCORE_KEYS.filter((key) => scheme[key]).map(
                    (key) => (
                      <TableCell key={key}>
                        {formatScore(row.scores[key])}
                      </TableCell>
                    ),
                  )}
                <TableCell className="font-medium text-primary">
                  {formatScore(calculateTotalScore(row, scheme))}
                </TableCell>
                <TableCell className="font-medium">
                  {formatScore(calculateAverageScore(row, scheme))}
                </TableCell>`;
const tbodyNew = `                <TableCell>
                  {formatScore(row.tugas)}
                </TableCell>
                {Array.from({ length: 24 }).map((_, i) => (
                  <TableCell key={i}>
                    {formatScore(row.pertemuanScores?.[i + 1] ?? null)}
                  </TableCell>
                ))}
                <TableCell className="font-medium text-primary">
                  {formatScore(
                    Object.values(row.pertemuanScores || {}).reduce((acc: number, val) => acc + (val || 0), 0)
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  {formatScore(
                    Object.values(row.pertemuanScores || {}).filter(val => val !== null).length > 0 
                      ? Object.values(row.pertemuanScores || {}).reduce((acc: number, val) => acc + (val || 0), 0) / Object.values(row.pertemuanScores || {}).filter(val => val !== null).length
                      : null
                  )}
                </TableCell>`;
if (table.includes(tbodyOld)) table = table.replace(tbodyOld, tbodyNew);

fs.writeFileSync(tableFile, table, 'utf8');

// 3. DetailKelasGuruSection.tsx
const detailFile = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-guru\\sections\\DetailKelasGuruSection.tsx';
let detail = fs.readFileSync(detailFile, 'utf8');

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

    const tugasScore = studentGrades.length
      ? Math.round(
          studentGrades.reduce((total, grade) => total + grade.score, 0) /
            studentGrades.length,
        )
      : null;

    return {
      studentId: student.id,
      tugas: tugasScore,
      scores: {},
      note: "",
      pertemuanScores,
    } as any;
  });
}`;

if (detail.includes(buildNilaiRowsOld)) {
   detail = detail.replace(buildNilaiRowsOld, buildNilaiRowsNew);
   detail = detail.replace(/buildNilaiRows\([\s\S]*?activeClass\.participants,\r?\n\s*nextGradeEntries,\r?\n\s*academicGradeEntries,\r?\n\s*\)/g, 'buildNilaiRows(activeClass.participants, nextGradeEntries, tasks)');
   detail = detail.replace(/buildNilaiRows\([\s\S]*?nextClassDetail\.participants,\r?\n\s*nextGradeEntries,\r?\n\s*nextAcademicGradeEntries,\r?\n\s*\)/g, 'buildNilaiRows(nextClassDetail.participants, nextGradeEntries, nextTasks)');
   fs.writeFileSync(detailFile, detail, 'utf8');
   console.log('DetailKelasGuruSection.tsx updated');
} else {
   console.log('buildNilaiRowsOld NOT FOUND');
}
