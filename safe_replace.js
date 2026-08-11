const fs = require('fs');
const file = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-guru\\sections\\DetailKelasGuruSection.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldFuncStart = content.indexOf('function buildNilaiRows(');
if (oldFuncStart > -1) {
  const funcEndStr = `  });\n}`;
  const funcEnd = content.indexOf(funcEndStr, oldFuncStart) + funcEndStr.length;
  
  const newFunc = `function buildNilaiRows(
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

  content = content.substring(0, oldFuncStart) + newFunc + content.substring(funcEnd);
}

// update calls:
content = content.replace('nextAcademicGradeEntries,', 'tasks,');
content = content.replace('academicGradeEntries,', 'tasks,');
content = content.replace('academicGradeEntries,', 'tasks,');

fs.writeFileSync(file, content, 'utf8');
console.log('buildNilaiRows updated safely');
