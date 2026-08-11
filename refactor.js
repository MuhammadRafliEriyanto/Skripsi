const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/components/dashboard-guru/sections/DetailKelasGuruSection.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Remove NilaiFormDialog import
content = content.replace(/import NilaiFormDialog from "@\/components\/dashboard-guru\/detail-kelas\/NilaiFormDialog";\r?\n/, '');

// 2. Remove TeacherAcademicGradeEntry and map function
content = content.replace(/type TeacherAcademicGradeEntry = \{[\s\S]*?\};\r?\n\r?\n/g, '');
content = content.replace(/function mapTeacherApiAcademicGradeToEntry\([\s\S]*?\}\r?\n\r?\n/g, '');

// 3. Update buildNilaiRows
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

// 4. Remove createNilaiDraft
content = content.replace(/function createNilaiDraft\([\s\S]*?\}\r?\n\r?\n/g, '');

// 5. Update state and loadClassDetail
content = content.replace(/const \[academicGradeEntries, setAcademicGradeEntries\] = useState<\r?\n\s*TeacherAcademicGradeEntry\[\]\r?\n\s*>\(\[\]\);\r?\n/, '');
content = content.replace(/const \[isNilaiDialogOpen, setIsNilaiDialogOpen\] = useState\(false\);\r?\n/, '');
content = content.replace(/const \[nilaiDraft, setNilaiDraft\] = useState<NilaiDraft \| null>\(null\);\r?\n/, '');
content = content.replace(/const \[selectedTaskForScore, setSelectedTaskForScore\] = useState<TugasPertemuan \| null>\(null\);\r?\n/, '');

content = content.replace(/const nextAcademicGradeEntries = mapTeacherDetailToAcademicGrades\(\s*payload,\s*nextClassDetail\.kelasId,\s*nextAcademicScheme,\s*\);\r?\n/g, '');
content = content.replace(/const nextNilaiRows = buildNilaiRows\(\s*nextClassDetail\.participants,\s*nextGradeEntries,\s*nextAcademicGradeEntries,\s*\);/g, 'const nextNilaiRows = buildNilaiRows(nextClassDetail.participants, nextGradeEntries, nextTasks);');

content = content.replace(/setAcademicGradeEntries\(nextAcademicGradeEntries\);\r?\n/g, '');
content = content.replace(/setAcademicGradeEntries\(\[\]\);\r?\n/g, '');

content = content.replace(/setSelectedTaskForScore\(null\);\r?\n/g, '');
content = content.replace(/setNilaiDraft\(null\);\r?\n/g, '');
content = content.replace(/setIsNilaiDialogOpen\(false\);\r?\n/g, '');

// 6. Remove handleSaveNilai and openNilaiDialogForStudent
content = content.replace(/async function handleSaveNilai\(\) \{[\s\S]*?\}\r?\n\r?\n/g, '');
content = content.replace(/function openNilaiDialogForStudent\(studentId: string\) \{[\s\S]*?\}\r?\n\r?\n/g, '');

// 7. Remove NilaiFormDialog component from JSX
content = content.replace(/<NilaiFormDialog[\s\S]*?scheme=\{academicScheme\}\r?\n\s*\/>\r?\n/g, '');

// 8. Update buildNilaiRows calls in handleGradeSubmission and others
content = content.replace(/buildNilaiRows\(\s*activeClass\.participants,\s*nextGradeEntries,\s*academicGradeEntries,\s*\)/g, 'buildNilaiRows(activeClass.participants, nextGradeEntries, tasks)');
content = content.replace(/buildNilaiRows\(\s*nextClassDetail\.participants,\s*nextGradeEntries,\s*nextAcademicGradeEntries,\s*\)/g, 'buildNilaiRows(nextClassDetail.participants, nextGradeEntries, nextTasks)');

// 9. Update TabelNilaiTable usage
content = content.replace(/<TabelNilaiTable\s+participants=\{activeClass\.participants\}\s+nilaiRows=\{nilaiRows\}\s+readOnly=\{isAcademicArchive\}\s+readOnlyMessage=\{archiveMessage\}\s+onEditNilai=\{openNilaiDialogForStudent\}\s+scheme=\{academicScheme\}\s+\/>/, '<TabelNilaiTable\n              participants={activeClass.participants}\n              nilaiRows={nilaiRows}\n              readOnly={isAcademicArchive}\n              readOnlyMessage={archiveMessage}\n            />');

// Finally, remove mapTeacherDetailToAcademicGrades and EMPTY_ACADEMIC_SCORES imports if present
content = content.replace(/import \{[\s\S]*?\} from "@\/lib\/academic-grades";\r?\n/g, '');
content = content.replace(/function mapTeacherDetailToAcademicGrades\([\s\S]*?\}\r?\n\r?\n/g, '');

fs.writeFileSync(file, content, 'utf8');
console.log('DetailKelasGuruSection.tsx updated successfully');
