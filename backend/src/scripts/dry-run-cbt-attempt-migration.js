require("dotenv").config({ path: "backend/.env" });

const fs = require("node:fs/promises");
const path = require("node:path");
const mongoose = require("mongoose");

const outputPath = path.resolve(
  __dirname,
  "../../..",
  "docs",
  "dry-run-laporan-migrasi-attempt-cbt.md",
);

function questionBankProgram(task) {
  const className = String(task.className || "").toLowerCase();
  const subject = String(task.subject || "").toLowerCase();

  if (className.includes("utbk") || className.includes("snbt"))
    return "UTBK / SNBT";
  if (className.includes("smp")) return "SMP Kelas 7-9";
  if (className.includes("sd")) return "SD Kelas 4-6";
  if (
    className.includes("ipa") ||
    ["biologi", "fisika", "kimia"].some((value) => subject.includes(value))
  )
    return "SMA IPA";
  if (className.includes("sma")) return "SMA IPS";
  return null;
}

function number(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function format(value) {
  return String(value ?? "")
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ");
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const attempts = await db
    .collection("studenttaskattempts")
    .find({})
    .toArray();
  const tasks = await db.collection("classtasks").find({}).toArray();
  const questionBank = db.collection("questionbanks");
  const taskById = new Map(tasks.map((task) => [task.taskId, task]));

  const countBuckets = {
    "kurang dari 10": 0,
    10: 0,
    20: 0,
    30: 0,
    "lebih dari 30": 0,
  };
  const underThirty = attempts.filter((attempt) => {
    const count = Array.isArray(attempt.answers) ? attempt.answers.length : 0;
    if (count < 10) countBuckets["kurang dari 10"] += 1;
    else if (count === 10) countBuckets[10] += 1;
    else if (count === 20) countBuckets[20] += 1;
    else if (count === 30) countBuckets[30] += 1;
    else if (count > 30) countBuckets["lebih dari 30"] += 1;
    return count < 30;
  });
  const attemptGroups = new Map();
  for (const attempt of attempts) {
    const key = `${attempt.studentId}|${attempt.taskId}`;
    attemptGroups.set(key, [...(attemptGroups.get(key) || []), attempt]);
  }

  const rows = [];
  let enoughQuestions = 0;
  let notEnoughQuestions = 0;
  let missingTask = 0;

  for (const attempt of underThirty) {
    const answers = Array.isArray(attempt.answers) ? attempt.answers : [];
    const task = taskById.get(attempt.taskId);
    let available = 0;
    let matchBasis = "task tidak ditemukan";
    if (task) {
      const program = questionBankProgram(task);
      const topic = new RegExp(`Bab ${number(task.meetingNumber)}:`, "i");
      const filter = { subject: task.subject, topic };
      if (program) filter.program = program;
      available = await questionBank.countDocuments(filter);
      matchBasis = `${program || "program tidak terpetakan"} / ${task.subject} / Bab ${number(task.meetingNumber)}`;
    }
    const needed = Math.max(30 - answers.length, 0);
    const enough = Boolean(task) && available >= needed;
    if (!task) missingTask += 1;
    else if (enough) enoughQuestions += 1;
    else notEnoughQuestions += 1;
    rows.push({
      attemptId: attempt.attemptId,
      studentId: attempt.studentId,
      taskId: attempt.taskId,
      currentQuestions: answers.length,
      correctCount: number(attempt.correctCount),
      wrongCount: number(attempt.wrongCount),
      unansweredCount: number(attempt.unansweredCount),
      score: number(attempt.score),
      status: attempt.status,
      remedial:
        number(attempt.remedialCount) > 0 || (attempt.history || []).length > 0,
      remedialCount: number(attempt.remedialCount),
      needed,
      available,
      enough,
      matchBasis,
      multipleAttemptsForStudentTask: (
        attemptGroups.get(`${attempt.studentId}|${attempt.taskId}`) || []
      ).length,
    });
  }

  const remedialGroups = [...attemptGroups.values()].filter(
    (group) => group.length > 1,
  );
  const lines = [
    "# Laporan Dry-Run Migrasi Attempt CBT",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "> READ-ONLY: laporan ini tidak melakukan update, insert, delete, atau perubahan database.",
    "",
    "## Ringkasan",
    "",
    `- Total attempt: **${attempts.length}**`,
    `- Attempt kurang dari 30 soal: **${underThirty.length}**`,
    `- Attempt dengan kandidat soal cukup pada filter utama: **${enoughQuestions}**`,
    `- Attempt dengan kandidat tidak cukup: **${notEnoughQuestions}**`,
    `- Attempt dengan task tidak ditemukan: **${missingTask}**`,
    `- Grup siswa-task dengan lebih dari satu attempt: **${remedialGroups.length}**`,
    "",
    "## Distribusi Jumlah Soal",
    "",
    "| Jumlah soal tersimpan | Jumlah attempt |",
    "| --- | ---: |",
    ...Object.entries(countBuckets).map(
      ([key, value]) => `| ${key} | ${value} |`,
    ),
    "",
    "## Struktur Data",
    "",
    "- `studenttaskattempts`: `studentId`, `taskId`, `answers[]`, `selectedAnswer`, `isCorrect`, `correctCount`, `wrongCount`, `unansweredCount`, `score`, `remedialCount`, `remedialReason`, `history[]`, `status`, `startedAt`, `submittedAt`.",
    "- `classtasks`: relasi melalui `taskId`; menyediakan `className`, `subject`, `meetingNumber`, `questionCount`, dan metadata jadwal.",
    "- `questionbanks`: menyediakan `questionId`, `program`, `subject`, `topic`, `questionText`, `optionA-D`, `correctAnswer`, dan `explanation`.",
    "- `history[]` berada di dalam attempt dan tidak digabungkan sebagai attempt terpisah.",
    "",
    "## Attempt Kurang dari 30 Soal",
    "",
    "| attemptId | studentId | taskId | Saat ini | Benar | Salah | Kosong | Nilai | Remedial | Tambahan | Kandidat unik | Cukup | Dasar pencocokan | Grup attempt |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | --- | --- | ---: |",
    ...rows.map(
      (row) =>
        `| ${format(row.attemptId)} | ${format(row.studentId)} | ${format(row.taskId)} | ${row.currentQuestions} | ${row.correctCount} | ${row.wrongCount} | ${row.unansweredCount} | ${row.score} | ${row.remedial ? `Ya (${row.remedialCount})` : "Tidak"} | ${row.needed} | ${row.available} | ${row.enough ? "Ya" : "Tidak"} | ${format(row.matchBasis)} | ${row.multipleAttemptsForStudentTask} |`,
    ),
    "",
    "## Aturan Migrasi yang Belum Dijalankan",
    "",
    "- Tidak ada jawaban tambahan yang dibuat dalam dry-run ini.",
    "- Tidak ada nilai yang dihitung ulang atau diubah.",
    "- Attempt utama dan attempt remedial tetap dipisahkan.",
    "- Soal tambahan hanya boleh berstatus belum dijawab dan tidak boleh dianggap benar.",
    "- Migrasi baru boleh dijalankan setelah laporan ini ditinjau dan disetujui.",
  ];

  await fs.writeFile(outputPath, `${lines.join("\n")}\n`, "utf8");
  console.log(
    JSON.stringify(
      {
        outputPath,
        totalAttempts: attempts.length,
        underThirty: underThirty.length,
        countBuckets,
        enoughQuestions,
        notEnoughQuestions,
        missingTask,
        remedialGroups: remedialGroups.length,
      },
      null,
      2,
    ),
  );
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
