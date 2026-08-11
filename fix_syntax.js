const fs = require('fs');
const file = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-guru\\sections\\DetailKelasGuruSection.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove the floating handleSaveNilai body
const floatingSaveNilaiBody = `      if (!nilaiDraft) {
      return;
    }

    const shouldSaveAcademicGrade = academicScheme !== "tryout";
    const shouldSaveTaskGrade = Boolean(
      selectedTaskForScore && nilaiDraft.tugas !== null,
    );

    if (!shouldSaveTaskGrade && !shouldSaveAcademicGrade) {
      toast.error("Isi nilai latihan terlebih dahulu.");
      return;
    }

    try {
      const [savedGrade, savedAcademicGrade] = await Promise.all([
        shouldSaveTaskGrade && selectedTaskForScore
          ? saveGradeRequest(nilaiDraft, selectedTaskForScore)
          : Promise.resolve(null),
        shouldSaveAcademicGrade
          ? saveAcademicGradeRequest(nilaiDraft)
          : Promise.resolve(null),
      ]);
      const nextGradeEntries = savedGrade
        ? [
            savedGrade,
            ...gradeEntries.filter((grade) => grade.id !== savedGrade.id),
          ]
        : gradeEntries;
      const otherAcademicGrades = academicGradeEntries.filter(
        (grade) =>
          normalizeText(grade.studentId) !== normalizeText(nilaiDraft.studentId),
      );
      const nextAcademicGradeEntries = savedAcademicGrade
        ? [savedAcademicGrade, ...otherAcademicGrades]
        : otherAcademicGrades;
      const nextNilaiRows = buildNilaiRows(
        activeClass.participants,
        nextGradeEntries,
        nextAcademicGradeEntries,
      );

      setGradeEntries(nextGradeEntries);
            setNilaiRows(nextNilaiRows);
                      } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nilai siswa belum bisa disimpan.",
      );
    }
  }`;

content = content.replace(floatingSaveNilaiBody, '');

// 2. Remove the leftover of NilaiFormDialog
const leftoverDialog = `        onChange={handleNilaiDraftChange}
        onOpenChange={handleNilaiDialogOpenChange}
        onStudentChange={handleSelectedStudentChange}
        onTaskChange={handleSelectedTaskChange}
        onSubmit={handleSaveNilai}
        open={isNilaiDialogOpen}
        participants={activeClass.participants}
        selectedStudentId={selectedStudentId}
        selectedTask={selectedTaskForScore}
        tasks={tasksWithGradeStatus}
        scheme={academicScheme}
        includeTaskScore={!isUtbkClass}
      />`;

content = content.replace(leftoverDialog, '');

// 3. Remove these functions too if they still exist
content = content.replace(/function handleNilaiDraftChange\([\s\S]*?\}\r?\n\r?\n/g, '');
content = content.replace(/function handleAcademicScoreChange\([\s\S]*?\}\r?\n\r?\n/g, '');
content = content.replace(/function handleNilaiDialogOpenChange\([\s\S]*?\}\r?\n\r?\n/g, '');
content = content.replace(/function handleSelectedStudentChange\([\s\S]*?\}\r?\n\r?\n/g, '');
content = content.replace(/function handleSelectedTaskChange\([\s\S]*?\}\r?\n\r?\n/g, '');

fs.writeFileSync(file, content, 'utf8');
console.log('Cleaned up DetailKelasGuruSection.tsx');
