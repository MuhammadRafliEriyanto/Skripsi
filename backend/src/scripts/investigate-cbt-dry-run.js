require("dotenv").config({ path: "backend/.env" });

const fs = require("node:fs/promises");
const path = require("node:path");
const mongoose = require("mongoose");

const outputPath = path.resolve(
  __dirname,
  "../../..",
  "docs",
  "investigasi-dry-run-attempt-cbt.md",
);

function normalize(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function clean(value) {
  return String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
}

function programForTask(task) {
  const className = normalize(task?.className);
  const subject = normalize(task?.subject);
  if (className.includes("utbk") || className.includes("snbt")) return "UTBK / SNBT";
  if (className.includes("smp")) return "SMP Kelas 7-9";
  if (className.includes("sd")) return "SD Kelas 4-6";
  if (className.includes("ipa") || ["biologi", "fisika", "kimia"].some((value) => subject.includes(value))) return "SMA IPA";
  if (className.includes("sma")) return "SMA IPS";
  return null;
}

function fieldNames(document) {
  return Object.keys(document || {}).filter((key) => key !== "_id").sort();
}

function answerCount(attempt) {
  return Array.isArray(attempt.answers) ? attempt.answers.length : 0;
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const attempts = await db.collection("studenttaskattempts").find({}).toArray();
  const tasks = await db.collection("classtasks").find({}).toArray();
  const banks = db.collection("questionbanks");
  const bankDocuments = await banks
    .find({})
    .project({ questionId: 1, program: 1, subject: 1, topic: 1 })
    .toArray();
  const taskById = new Map(tasks.map((task) => [task.taskId, task]));
  const legacy = attempts.filter((attempt) => answerCount(attempt) < 30);
  const groups = new Map();
  for (const attempt of attempts) {
    const key = `${attempt.studentId}|${attempt.taskId}`;
    groups.set(key, [...(groups.get(key) || []), attempt]);
  }

  const bucket = { lessThan10: 0, exactly10: 0, exactly20: 0, exactly30: 0, greaterThan30: 0 };
  for (const attempt of attempts) {
    const count = answerCount(attempt);
    if (count < 10) bucket.lessThan10 += 1;
    else if (count === 10) bucket.exactly10 += 1;
    else if (count === 20) bucket.exactly20 += 1;
    else if (count === 30) bucket.exactly30 += 1;
    else if (count > 30) bucket.greaterThan30 += 1;
  }

  const bankSample = await banks.findOne({});
  const bankFields = fieldNames(bankSample);
  const rows = [];
  const availabilityReasons = {};
  for (const attempt of legacy) {
    const task = taskById.get(attempt.taskId);
    const currentIds = new Set((attempt.answers || []).map((answer) => answer.questionId));
    let program = null;
    let programCount = 0;
    let programSubjectCount = 0;
    let programSubjectTopicCount = 0;
    let availableAfterExclusion = 0;
    let topic = "task tidak ditemukan";
    let reason = "task tidak ditemukan";

    if (task) {
      program = programForTask(task);
      topic = `Bab ${Number(task.meetingNumber) || 0}:`;
      const taskProgram = normalize(program);
      const taskSubject = normalize(task.subject);
      const topicPrefix = normalize(topic);
      const byProgram = bankDocuments.filter((question) => taskProgram && normalize(question.program) === taskProgram);
      const byProgramSubject = byProgram.filter((question) => normalize(question.subject) === taskSubject);
      const byProgramSubjectTopic = byProgramSubject.filter((question) => normalize(question.topic).includes(topicPrefix));
      programCount = byProgram.length;
      programSubjectCount = byProgramSubject.length;
      programSubjectTopicCount = byProgramSubjectTopic.length;
      availableAfterExclusion = byProgramSubjectTopic.filter((question) => !currentIds.has(question.questionId)).length;
      if (availableAfterExclusion >= 30 - answerCount(attempt)) reason = "cukup pada program + subject + topic";
      else if (programSubjectCount >= 30 - answerCount(attempt)) reason = "topic tidak cocok/terlalu ketat";
      else if (programCount >= 30 - answerCount(attempt)) reason = "subject tidak cocok";
      else if (!program) reason = "program task tidak dapat dipetakan";
      else reason = "bank tidak cukup pada filter program";
    }

    availabilityReasons[reason] = (availabilityReasons[reason] || 0) + 1;
    rows.push({
      attemptId: attempt.attemptId,
      studentId: attempt.studentId,
      taskId: attempt.taskId,
      current: answerCount(attempt),
      className: task?.className || "-",
      subject: task?.subject || "-",
      meetingNumber: task?.meetingNumber ?? "-",
      topic,
      exampleIds: (attempt.answers || []).slice(0, 3).map((answer) => answer.questionId).join(", "),
      expectedProgram: program || "-",
      expectedSubject: task?.subject || "-",
      programCount,
      programSubjectCount,
      programSubjectTopicCount,
      afterExclusion: availableAfterExclusion,
      needed: Math.max(30 - answerCount(attempt), 0),
      sufficient: availableAfterExclusion >= Math.max(30 - answerCount(attempt), 0),
      remedial: Number(attempt.remedialCount || 0) > 0 || (attempt.history || []).length > 0,
      historyEntries: (attempt.history || []).length,
      status: attempt.status,
      score: attempt.score,
      correctCount: attempt.correctCount,
      wrongCount: attempt.wrongCount,
      unansweredCount: attempt.unansweredCount,
    });
  }

  const probablePartial = attempts.filter((attempt) => {
    const count = answerCount(attempt);
    const emptyAnswers = (attempt.answers || []).filter((answer) => !answer.selectedAnswer && answer.isCorrect === null).length;
    return count === 30 && emptyAnswers > 0 && Number(attempt.unansweredCount || 0) >= emptyAnswers;
  });
  const separateAttemptGroups = [...groups.values()].filter((group) => group.length > 1);
  const sampleRows = rows.slice(0, 10);
  const lines = [
    "# Investigasi Dry-Run Attempt CBT",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "> READ-ONLY: tidak ada update, insert, delete, pembuatan soal, pembuatan jawaban, atau perubahan nilai.",
    "",
    "## Ringkasan Database Saat Ini",
    "",
    `- Total attempt: **${attempts.length}**`,
    `- Attempt kurang dari 30 soal: **${legacy.length}**`,
    `- Distribusi: <10 = **${bucket.lessThan10}**, 10 = **${bucket.exactly10}**, 20 = **${bucket.exactly20}**, 30 = **${bucket.exactly30}**, >30 = **${bucket.greaterThan30}**`,
    `- Attempt dengan histori embedded (` + "`history[]`" + `): **${attempts.filter((attempt) => (attempt.history || []).length > 0).length}**`,
    `- Grup student-task dengan lebih dari satu dokumen attempt: **${separateAttemptGroups.length}**`,
    `- Attempt 30 soal yang terindikasi hasil migrasi parsial berdasarkan soal kosong: **${probablePartial.length}**`,
    "",
    "## Struktur Collection",
    "",
    "### `studenttaskattempts`",
    "",
    "Relasi attempt menggunakan `studentId` ke student dan `taskId` ke `classtasks`. Jawaban berada di `answers[]` dengan `questionId`, `selectedAnswer`, dan `isCorrect`. Statistik tersimpan di `correctCount`, `wrongCount`, `unansweredCount`, dan `score`. Informasi remedial berada di `remedialCount`, `remedialReason`, dan `history[]`.",
    "",
    "### `classtasks`",
    "",
    "Relasi latihan dibaca melalui `taskId`. Filter yang tersedia pada task: `className`, `subject`, `meetingNumber`, dan `questionCount`.",
    "",
    "### `questionbanks`",
    "",
    `Field aktual pada sample dokumen: ${bankFields.map((field) => "'" + field + "'").join(", ")}. Field soal yang relevan: questionId, program, subject, topic, questionText, optionA, optionB, optionC, optionD, correctAnswer, dan explanation. Tidak ada field meetingNumber pada model QuestionBank yang digunakan aplikasi; pertemuan direpresentasikan melalui teks topic seperti Bab 1:.`,
    "",
    "## Penyebab Nilai 0 Attempt Cukup",
    "",
    ...Object.entries(availabilityReasons).map(([reason, count]) => `- **${reason}**: ${count}`),
    "",
    "Kesimpulan dry-run: angka 0 bukan berarti koleksi bank soal kosong. Query sebelumnya hanya menghitung kecocokan topic yang sangat spesifik dan tidak menunjukkan fallback bertingkat. Perbedaan utama perlu dilihat pada `program`, `subject`, dan format `topic`; `meetingNumber` tidak tersedia di `questionbanks` sebagai field terpisah.",
    "",
    "## Sampel Minimal 10 Attempt Target",
    "",
    "| attemptId | studentId | taskId | Saat ini | Kelas task | Subject task | Meeting | Topic query | Contoh ID attempt | Program bank diharapkan | Subject bank diharapkan | Program saja | Program + subject | Program + subject + topic | Setelah mengecualikan ID lama | Tambahan | Cukup | Remedial |",
    "| --- | --- | --- | ---: | --- | --- | ---: | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |",
    ...sampleRows.map((row) => `| ${clean(row.attemptId)} | ${clean(row.studentId)} | ${clean(row.taskId)} | ${row.current} | ${clean(row.className)} | ${clean(row.subject)} | ${row.meetingNumber} | ${clean(row.topic)} | ${clean(row.exampleIds)} | ${clean(row.expectedProgram)} | ${clean(row.expectedSubject)} | ${row.programCount} | ${row.programSubjectCount} | ${row.programSubjectTopicCount} | ${row.afterExclusion} | ${row.needed} | ${row.sufficient ? "Ya" : "Tidak"} | ${row.remedial ? "Ya" : "Tidak"} |`),
    "",
    "## Attempt 30 Soal yang Diduga Migrasi Parsial",
    "",
    `Ditemukan **${probablePartial.length}** attempt dengan 30 jawaban dan sebagian jawaban kosong. Ini hanya indikator berbasis data, bukan kepastian sejarah migrasi, karena attempt asli 30 soal juga dapat memiliki soal tidak dijawab. Tidak ada data yang diubah.`,
    "",
    "| attemptId | studentId | taskId | Soal | Kosong | Nilai | Benar | Salah | Belum dijawab |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...probablePartial.slice(0, 100).map((attempt) => {
      const empty = (attempt.answers || []).filter((answer) => !answer.selectedAnswer && answer.isCorrect === null).length;
      return `| ${clean(attempt.attemptId)} | ${clean(attempt.studentId)} | ${clean(attempt.taskId)} | ${answerCount(attempt)} | ${empty} | ${attempt.score ?? 0} | ${attempt.correctCount ?? 0} | ${attempt.wrongCount ?? 0} | ${attempt.unansweredCount ?? 0} |`;
    }),
    "",
    "## Rekomendasi Query Aman",
    "",
    "1. Gunakan `program` hasil pemetaan task dan `subject` yang dinormalisasi trim/case-insensitive.",
    "2. Gunakan `topic` berdasarkan prefix bab (`Bab {meetingNumber}:`) hanya jika jumlah kandidat mencukupi.",
    "3. Jika topic tidak mencukupi, fallback bertahap ke `program + subject`, lalu `subject` dengan pencatatan alasan fallback.",
    "4. Kecualikan semua `questionId` yang sudah ada pada attempt.",
    "5. Tolak migrasi jika kandidat unik kurang dari jumlah yang diperlukan; jangan membuat jawaban atau nilai buatan.",
    "6. Jangan menggabungkan `history[]` dengan attempt utama atau membuatnya menjadi attempt baru.",
  ];

  await fs.writeFile(outputPath, `${lines.join("\n")}\n`, "utf8");
  console.log(JSON.stringify({ outputPath, totalAttempts: attempts.length, underThirty: legacy.length, bucket, availabilityReasons, probablePartial: probablePartial.length, separateAttemptGroups: separateAttemptGroups.length }, null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
