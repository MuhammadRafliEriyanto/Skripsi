const fs = require('fs');
const file = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-guru\\sections\\DetailKelasGuruSection.tsx';
let content = fs.readFileSync(file, 'utf8');

const injectContent = `async function uploadTaskQuestionsRequest(taskId: string, file: File) {
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

  async function saveTaskRequest`;

content = content.replace(/async function saveTaskRequest/g, injectContent);

fs.writeFileSync(file, content);
console.log('Fixed uploadTaskQuestionsRequest in DetailKelasGuruSection.tsx');
