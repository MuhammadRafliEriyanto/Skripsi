const fs = require('fs');
const file = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-guru\\sections\\DetailKelasGuruSection.tsx';
let content = fs.readFileSync(file, 'utf8');

const saveTaskRequestPattern = /async function saveTaskRequest\(\n\s+draft: TugasPertemuan,\n\s+mode: DialogMode,\n\s+\) \{/;

content = content.replace(
  saveTaskRequestPattern,
  `async function uploadTaskQuestionsRequest(taskId: string, file: File) {
    const normalizedClassId = normalizeText(activeClass.kelasId);
    if (!normalizedClassId) throw new Error(DETAIL_CLASS_ERROR_MESSAGE);

    const fileDataBase64 = await readFileAsBase64(file);

    const response = await fetch(
      buildGuruApiUrl(\`/api/teacher/me/classes/\${encodeURIComponent(normalizedClassId)}/tasks/\${encodeURIComponent(taskId)}/questions/xlsx\`, searchParams),
      {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attachmentFileDataBase64: fileDataBase64 }),
      }
    );

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.message || "Gagal mengunggah soal latihan.");
    }
  }

  async function saveTaskRequest(
    draft: TugasPertemuan,
    mode: DialogMode,
  ) {`
);

const handleSavePattern = /const savedTask = await saveTaskRequest\(tugasDraft, tugasMode\);/;

content = content.replace(
  handleSavePattern,
  `const isExcel = tugasAttachmentFile && (tugasAttachmentFile.name.endsWith('.xlsx') || tugasAttachmentFile.name.endsWith('.xls'));
      
      // Prevent attaching the excel file directly to the task model to save space, since it will be parsed
      const fileToAttach = isExcel ? null : tugasAttachmentFile;
      const originalFile = tugasAttachmentFile;
      
      // Temporarily clear state so saveTaskRequest doesn't send the excel as a normal attachment
      if (isExcel) setTugasAttachmentFile(null);
      
      let savedTask = await saveTaskRequest(tugasDraft, tugasMode);
      
      if (isExcel && originalFile) {
        await uploadTaskQuestionsRequest(savedTask.id, originalFile);
        savedTask.jumlahSoal = 10; // Trigger refresh conceptually
      }`
);

// We need to fix the durationMinutes, questionCount and passingGrade to not be hardcoded in saveTaskRequest body
content = content.replace(
  /durationMinutes: draft\.durasiMenit,\n\s+questionCount: 10,\n\s+passingGrade: 70,/,
  `durationMinutes: draft.durasiMenit,
      questionCount: draft.jumlahSoal || 0,
      passingGrade: draft.batasLulus || 70,`
);


fs.writeFileSync(file, content);
console.log('Fixed DetailKelasGuruSection.tsx frontend API calls');
