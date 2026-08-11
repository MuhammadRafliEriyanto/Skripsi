const fs = require('fs');

// Delete NilaiFormDialog.tsx
const dialogFile = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-guru\\detail-kelas\\NilaiFormDialog.tsx';
if (fs.existsSync(dialogFile)) {
  fs.unlinkSync(dialogFile);
  console.log('Deleted NilaiFormDialog.tsx');
}

// Fix DetailKelasGuruSection.tsx
const file = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-guru\\sections\\DetailKelasGuruSection.tsx';
let content = fs.readFileSync(file, 'utf8');

// Fix 'nextTasks' error
content = content.replace(/buildNilaiRows\(\s*activeClass\.participants,\s*nextGradeEntries,\s*nextTasks\s*\)/g, 'buildNilaiRows(activeClass.participants, nextGradeEntries, tasks)');

// Remove duplicate buildNilaiRows (TS2393) - there are two buildNilaiRows?
// Ah! In my fix_minimal.js I replaced `function buildNilaiRows` but wait, my script was:
// lines.splice(buildNilaiStart, buildNilaiEnd - buildNilaiStart + 1, ...replacement.split('\n'));
// Did it insert it TWICE? Let's remove the first one if there are two.
const matches = content.match(/function buildNilaiRows/g);
if (matches && matches.length > 1) {
    const firstIdx = content.indexOf('function buildNilaiRows');
    const firstEnd = content.indexOf('}', firstIdx);
    // Actually, to be safe, I'll just use a regex to replace ALL function buildNilaiRows with nothing, then append ONE at the top.
    content = content.replace(/function buildNilaiRows\([\s\S]*?\} satisfies NilaiSiswa;\r?\n  \}\);\r?\n\}/g, '');
    
    // Add it back once
    const correctBuildNilaiRows = `
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
    // insert after imports
    content = content.replace(/import \{[\s\S]*?\} from "lucide-react";\r?\n/, match => match + correctBuildNilaiRows);
}

// Fix 'deadline' on TugasPertemuan. In TugasPertemuan it's 'tanggalSelesai'.
content = content.replace(/task\.deadline/g, 'task.tanggalSelesai');

// Fix the 'tugas' and 'note' errors inside handleNilaiDraftChange
// The file has a handleNilaiDraftChange function which updates 'tugas' and 'note'. Since NilaiDraft no longer has them, we should remove the function and the state.
content = content.replace(/const \[nilaiDraft, setNilaiDraft\] = useState<NilaiDraft \| null>\(null\);\r?\n/g, '');
content = content.replace(/const \[isNilaiDialogOpen, setIsNilaiDialogOpen\] = useState\(false\);\r?\n/g, '');
content = content.replace(/const \[selectedTaskForScore, setSelectedTaskForScore\] = useState<TugasPertemuan \| null>\(null\);\r?\n/g, '');

content = content.replace(/function handleNilaiDraftChange\([\s\S]*?\}\r?\n/g, '');
content = content.replace(/function handleAcademicScoreChange\([\s\S]*?\}\r?\n/g, '');

// Also there might be a function `openNilaiDialogForStudent` and `handleSaveNilai`.
content = content.replace(/function openNilaiDialogForStudent\([\s\S]*?setIsNilaiDialogOpen\(true\);\r?\n  \}/g, '');
content = content.replace(/async function handleSaveNilai\(\) \{[\s\S]*?\}\r?\n/g, '');

// Remove NilaiFormDialog import
content = content.replace(/import NilaiFormDialog[\s\S]*?;\r?\n/g, '');

// Remove NilaiFormDialog JSX block entirely just in case
content = content.replace(/<NilaiFormDialog[\s\S]*?\/>\r?\n/g, '');

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed more errors');
