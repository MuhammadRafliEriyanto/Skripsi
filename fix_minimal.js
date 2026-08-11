const fs = require('fs');
const file = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-guru\\sections\\DetailKelasGuruSection.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

// Update buildNilaiRows function signature and body
let buildNilaiStart = -1;
let buildNilaiEnd = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('function buildNilaiRows(')) {
    buildNilaiStart = i;
  }
  if (buildNilaiStart !== -1 && lines[i] === '}') {
    buildNilaiEnd = i;
    break;
  }
}

if (buildNilaiStart !== -1) {
  const replacement = `function buildNilaiRows(
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
  lines.splice(buildNilaiStart, buildNilaiEnd - buildNilaiStart + 1, ...replacement.split('\n'));
}

// Update buildNilaiRows calls
for (let i = 0; i < lines.length; i++) {
  // In loadClassDetail
  if (lines[i].includes('const nextNilaiRows = buildNilaiRows(')) {
    if (lines[i + 3].includes('nextAcademicGradeEntries')) {
      lines[i + 3] = lines[i + 3].replace('nextAcademicGradeEntries', 'nextTasks');
    }
  }
  
  // In handleDeleteTask
  if (lines[i].includes('setNilaiRows(') && lines[i+1] && lines[i+1].includes('buildNilaiRows(')) {
    if (lines[i+4].includes('academicGradeEntries')) {
      lines[i+4] = lines[i+4].replace('academicGradeEntries', 'tasks');
    }
  }

  // In handleSaveNilai
  if (lines[i].includes('const nextNilaiRows = buildNilaiRows(')) {
     // Check if it's the second call
     if (lines[i+3] && lines[i+3].includes('nextAcademicGradeEntries')) {
        lines[i+3] = lines[i+3].replace('nextAcademicGradeEntries', 'tasks');
     }
  }

  // Update createNilaiDraft to not use EMPTY_ACADEMIC_SCORES or scores/note
  if (lines[i].includes('scores: existingAcademicGrade?.scores ?? currentValue.scores,')) {
    lines[i] = '    pertemuanScores: currentValue.pertemuanScores,';
  }
  if (lines[i].includes('note: existingAcademicGrade?.note ?? existingGrade?.note ?? "",')) {
    lines[i] = ''; // remove note
  }
  if (lines[i].includes('tugas: existingGrade?.score ?? null,')) {
    lines[i] = ''; // remove tugas
  }
  
  // Update TabelNilaiTable JSX props
  if (lines[i].includes('<TabelNilaiTable')) {
    // Find the end of this component
    let endIdx = i;
    for (let j = i; j < i + 20; j++) {
      if (lines[j].includes('/>')) {
        endIdx = j;
        break;
      }
    }
    // Remove the extra props
    for (let j = i; j <= endIdx; j++) {
       if (lines[j].includes('onEditNilai={') || lines[j].includes('scheme={') || lines[j].includes('includeTaskScore={')) {
         lines[j] = '';
       }
    }
  }
}

fs.writeFileSync(file, lines.join('\n'), 'utf8');
console.log('Fixed file');
