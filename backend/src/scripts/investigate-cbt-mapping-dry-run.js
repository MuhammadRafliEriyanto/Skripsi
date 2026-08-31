require("dotenv").config({ path: "backend/.env" });

const fs = require("node:fs/promises");
const path = require("node:path");
const mongoose = require("mongoose");

const outputPath = path.resolve(
  __dirname,
  "../../..",
  "docs",
  "investigasi-mapping-questionbank-dry-run.md",
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

function countAnswers(attempt) {
  return Array.isArray(attempt.answers) ? attempt.answers.length : 0;
}

function taskLabels(task) {
  return [...new Set([
    task?.program,
    task?.className,
    task?.canonicalClassName,
  ].filter(Boolean).map(String))];
}

function topicMatches(topic, meetingNumber) {
  const value = normalize(topic);
  const meeting = Number(meetingNumber);
  if (!Number.isFinite(meeting) || meeting <= 0) return false;
  return value.startsWith(`bab ${meeting}:`) || value.includes(`bab ${meeting}:`);
}

function fieldValues(documents, field) {
  return [...new Set(documents.map((document) => String(document[field] ?? "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function formatList(values) {
  return values.length ? values.map((value) => `\`${clean(value)}\``).join(", ") : "-";
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const attempts = await db.collection("studenttaskattempts").find({}).toArray();
  const tasks = await db.collection("classtasks").find({}).toArray();
  const banks = await db.collection("questionbanks").find({}).project({
    questionId: 1,
    program: 1,
    subject: 1,
    topic: 1,
  }).toArray();
  const taskById = new Map(tasks.map((task) => [task.taskId, task]));
  const legacy = attempts.filter((attempt) => countAnswers(attempt) < 30);
  const targetTaskIds = new Set(legacy.map((attempt) => attempt.taskId));
  const targetTasks = tasks.filter((task) => targetTaskIds.has(task.taskId));

  const distribution = { lessThan10: 0, exactly10: 0, exactly20: 0, exactly30: 0, greaterThan30: 0 };
  for (const attempt of attempts) {
    const count = countAnswers(attempt);
    if (count < 10) distribution.lessThan10 += 1;
    else if (count === 10) distribution.exactly10 += 1;
    else if (count === 20) distribution.exactly20 += 1;
    else if (count === 30) distribution.exactly30 += 1;
    else if (count > 30) distribution.greaterThan30 += 1;
  }

  const taskClassValues = [...new Set(targetTasks.flatMap(taskLabels))].sort((a, b) => a.localeCompare(b));
  const bankPrograms = fieldValues(banks, "program");
  const taskSubjectPairs = new Map();
  for (const task of targetTasks) {
    const key = `${task.className || ""}|${task.subject || ""}`;
    taskSubjectPairs.set(key, (taskSubjectPairs.get(key) || 0) + 1);
  }

  const rows = [];
  const pairSummaries = new Map();
  for (const attempt of legacy) {
    const task = taskById.get(attempt.taskId);
    const answers = Array.isArray(attempt.answers) ? attempt.answers : [];
    const existingIds = new Set(answers.map((answer) => answer.questionId));
    const meetingNumber = task?.meetingNumber ?? null;
    const topicLabel = Number.isFinite(Number(meetingNumber)) ? `Bab ${meetingNumber}:` : "-";
    const subject = normalize(task?.subject);
    const labels = taskLabels(task);
    const exactProgramLabels = labels.filter((label) => bankPrograms.some((program) => normalize(program) === normalize(label)));
    const candidates = bankPrograms.map((program) => {
      const programNorm = normalize(program);
      const programQuestions = banks.filter((question) => normalize(question.program) === programNorm);
      const programSubject = programQuestions.filter((question) => normalize(question.subject) === subject);
      const programSubjectTopic = programSubject.filter((question) => topicMatches(question.topic, meetingNumber));
      const afterExclusion = programSubjectTopic.filter((question) => !existingIds.has(question.questionId));
      return {
        program,
        programCount: programQuestions.length,
        programSubjectCount: programSubject.length,
        programSubjectTopicCount: programSubjectTopic.length,
        afterExclusion: afterExclusion.length,
      };
    }).filter((candidate) => candidate.programSubjectCount > 0 || candidate.programSubjectTopicCount > 0)
      .sort((left, right) => right.afterExclusion - left.afterExclusion || right.programSubjectTopicCount - left.programSubjectTopicCount || right.programSubjectCount - left.programSubjectCount);
    const best = candidates[0] || null;
    const needed = Math.max(30 - answers.length, 0);
    const pairKey = `${task?.className || "-"}|${task?.subject || "-"}`;
    const pair = pairSummaries.get(pairKey) || {
      className: task?.className || "-",
      canonicalClassName: task?.canonicalClassName || "-",
      subject: task?.subject || "-",
      meetingNumbers: new Set(),
      attempts: 0,
      programs: new Map(),
    };
    pair.meetingNumbers.add(String(meetingNumber ?? "-"));
    pair.attempts += 1;
    for (const candidate of candidates) {
      const current = pair.programs.get(candidate.program) || { attempts: 0, maxAfterExclusion: 0, maxTopic: 0, maxSubject: 0 };
      current.attempts += 1;
      current.maxAfterExclusion = Math.max(current.maxAfterExclusion, candidate.afterExclusion);
      current.maxTopic = Math.max(current.maxTopic, candidate.programSubjectTopicCount);
      current.maxSubject = Math.max(current.maxSubject, candidate.programSubjectCount);
      pair.programs.set(candidate.program, current);
    }
    pairSummaries.set(pairKey, pair);
    rows.push({
      attemptId: attempt.attemptId,
      studentId: attempt.studentId,
      taskId: attempt.taskId,
      current: answers.length,
      needed,
      className: task?.className || "-",
      canonicalClassName: task?.canonicalClassName || "-",
      subject: task?.subject || "-",
      meetingNumber: meetingNumber ?? "-",
      topic: topicLabel,
      exampleIds: answers.slice(0, 3).map((answer) => answer.questionId).join(", "),
      exactProgramLabels,
      candidates,
      remedial: Number(attempt.remedialCount || 0) > 0 || (attempt.history || []).length > 0,
    });
  }

  const complete30 = attempts.filter((attempt) => countAnswers(attempt) === 30 && (attempt.answers || []).every((answer) => Boolean(answer.selectedAnswer) && answer.isCorrect !== null));
  const emptySelected30 = attempts.filter((attempt) => countAnswers(attempt) === 30 && (attempt.answers || []).some((answer) => !answer.selectedAnswer));
  const nullCorrect30 = attempts.filter((attempt) => countAnswers(attempt) === 30 && (attempt.answers || []).some((answer) => answer.isCorrect === null));
  const likelyPartial30 = attempts.filter((attempt) => countAnswers(attempt) === 30 && (attempt.answers || []).some((answer) => !answer.selectedAnswer || answer.isCorrect === null));
  const separateAttemptGroups = new Map();
  for (const attempt of attempts) {
    const key = `${attempt.studentId}|${attempt.taskId}`;
    separateAttemptGroups.set(key, (separateAttemptGroups.get(key) || 0) + 1);
  }
  const multipleAttemptGroups = [...separateAttemptGroups.values()].filter((count) => count > 1).length;
  const pairLines = [...pairSummaries.values()].sort((a, b) => `${a.className}|${a.subject}`.localeCompare(`${b.className}|${b.subject}`));

  const lines = [
    "# Investigasi Mapping QuestionBank (Dry-Run)",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "> READ-ONLY: tidak ada update, insert, delete, pembuatan soal/jawaban, atau perubahan score/attempt.",
    "",
    "## Ringkasan",
    "",
    `- Total attempt: **${attempts.length}**`,
    `- Attempt target (<30): **${legacy.length}**`,
    `- Distribusi: <10 = **${distribution.lessThan10}**, 10 = **${distribution.exactly10}**, 20 = **${distribution.exactly20}**, 30 = **${distribution.exactly30}**, >30 = **${distribution.greaterThan30}**`,
    `- Total dokumen questionbanks: **${banks.length}**`,
    `- Nilai program questionbanks: ${formatList(bankPrograms)}`,
    `- Nilai className/canonicalClassName task target: ${formatList(taskClassValues)}`,
    `- Grup student-task dengan beberapa dokumen attempt: **${multipleAttemptGroups}**`,
    "",
    "## Struktur dan Field Aktual",
    "",
    "- `studenttaskattempts`: relasi `studentId`, `taskId`, `answers[]`, `selectedAnswer`, `isCorrect`, `correctCount`, `wrongCount`, `unansweredCount`, `score`, `remedialCount`, `remedialReason`, `history[]`, `status`.",
    "- `classtasks`: task menyediakan `className`, `canonicalClassName`, `subject`, `meetingNumber`, dan `questionCount`; model tidak memiliki field `program`.",
    "- `questionbanks`: menyediakan `program`, `subject`, `topic`, `questionId`, `questionText`, `optionA-D`, `correctAnswer`, dan `explanation`; tidak tersedia field `meetingNumber` atau field `chapter` terpisah.",
    "",
    "## Mapping Aktual Per Task + Subject",
    "",
    "Kolom `program + subject` dan `program + subject + topic` dihitung untuk setiap label program yang benar-benar ada di `questionbanks`. Tidak ada label yang dipilih berdasarkan kemiripan nama.",
    "",
    "| Kelas task | Canonical task | Subject | Meeting | Attempt | Kandidat program QuestionBank | Program+subject | Program+subject+topic | Maks unik setelah ID lama |",
    "| --- | --- | --- | --- | ---: | --- | ---: | ---: | ---: |",
    ...pairLines.map((pair) => {
      const programs = [...pair.programs.entries()].sort((a, b) => b[1].maxAfterExclusion - a[1].maxAfterExclusion);
      const labels = programs.map(([program, value]) => `${program} (P:${value.maxSubject}, PT:${value.maxTopic}, U:${value.maxAfterExclusion})`).join("; ");
      const maxSubject = programs.length ? Math.max(...programs.map(([, value]) => value.maxSubject)) : 0;
      const maxTopic = programs.length ? Math.max(...programs.map(([, value]) => value.maxTopic)) : 0;
      const maxUnique = programs.length ? Math.max(...programs.map(([, value]) => value.maxAfterExclusion)) : 0;
      return `| ${clean(pair.className)} | ${clean(pair.canonicalClassName)} | ${clean(pair.subject)} | ${clean([...pair.meetingNumbers].join(", "))} | ${pair.attempts} | ${clean(labels || "-")} | ${maxSubject} | ${maxTopic} | ${maxUnique} |`;
    }),
    "",
    "## Minimal 20 Attempt Target",
    "",
    "`P` = program saja, `PS` = program + subject, `PST` = program + subject + topic, `U` = setelah mengecualikan questionId lama.",
    "",
    "| attemptId | studentId | taskId | Kelas task | Subject | Meeting | Saat ini | Butuh | Contoh ID lama | Kandidat mapping (P/PS/PST/U) | Remedial |",
    "| --- | --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |",
    ...rows.slice(0, 20).map((row) => {
      const candidates = row.candidates.slice(0, 5).map((candidate) => `${candidate.program} (P:${candidate.programCount}/PS:${candidate.programSubjectCount}/PST:${candidate.programSubjectTopicCount}/U:${candidate.afterExclusion})`).join("; ");
      return `| ${clean(row.attemptId)} | ${clean(row.studentId)} | ${clean(row.taskId)} | ${clean(row.className)} | ${clean(row.subject)} | ${row.meetingNumber} | ${row.current} | ${row.needed} | ${clean(row.exampleIds)} | ${clean(candidates || "Tidak ada kandidat PS")} | ${row.remedial ? "Ya" : "Tidak"} |`;
    }),
    "",
    "## Attempt di Bawah 30 Soal",
    "",
    `Total **${rows.length}** attempt. Daftar lengkap tersedia di bagian ini agar dapat diaudit; tidak ada perubahan data.`,
    "",
    "| attemptId | studentId | taskId | Kelas | Subject | Meeting | Saat ini | Butuh | Kandidat terbaik | PS | PST | U |",
    "| --- | --- | --- | --- | --- | ---: | ---: | ---: | --- | ---: | ---: | ---: |",
    ...rows.map((row) => {
      const best = row.candidates[0];
      return `| ${clean(row.attemptId)} | ${clean(row.studentId)} | ${clean(row.taskId)} | ${clean(row.className)} | ${clean(row.subject)} | ${row.meetingNumber} | ${row.current} | ${row.needed} | ${clean(best?.program || "-")} | ${best?.programSubjectCount || 0} | ${best?.programSubjectTopicCount || 0} | ${best?.afterExclusion || 0} |`;
    }),
    "",
    "## Analisis Attempt 30 Soal",
    "",
    `- Jawaban lengkap (30 selectedAnswer terisi dan 30 isCorrect tidak null): **${complete30.length}**`,
    `- Memiliki selectedAnswer kosong: **${emptySelected30.length}**`,
    `- Memiliki isCorrect null: **${nullCorrect30.length}**`,
    `- Kemungkinan migrasi parsial berdasarkan soal kosong/null: **${likelyPartial30.length}**`,
    "",
    "Indikator migrasi parsial tidak dapat dipastikan hanya dari dokumen attempt karena tidak ada field `migratedAt` atau penanda sumber soal. Angka tersebut adalah kandidat audit, bukan kepastian sejarah.",
    "",
    "## Kesimpulan Mapping",
    "",
    "- `SMA 10` tidak dapat dipetakan otomatis ke `SMA IPA` atau `SMA IPS` hanya dari kemiripan nama.",
    "- Task tidak memiliki field `program` yang dapat dijadikan relasi langsung; yang tersedia adalah `className` dan `canonicalClassName`.",
    "- QuestionBank memiliki label agregat seperti `SMA IPA` dan `SMA IPS`, sedangkan task memakai kelas individual seperti `SMA 10`.",
    "- Mapping final belum boleh diputuskan sebelum ada tabel referensi bisnis/akademik yang menyatakan kelas individual masuk program QuestionBank tertentu.",
    "",
    "## Rekomendasi Query Read-Only untuk Persetujuan Mapping",
    "",
    "Gunakan query bertingkat setelah mapping resmi disetujui:",
    "",
    "1. `QuestionBank.find({ program: mappedProgram, subject: task.subject })`.",
    "2. Tambahkan filter topic prefix `Bab {meetingNumber}:` hanya jika format topic task memang disepakati.",
    "3. Ambil `questionId` dan kecualikan ID yang sudah ada pada attempt.",
    "4. Nyatakan jumlah kandidat dan fallback pada log/laporan.",
    "5. Jika tidak ada mapping resmi atau kandidat kurang, jangan mengambil soal dan jangan mengubah attempt.",
  ];

  await fs.writeFile(outputPath, `${lines.join("\n")}\n`, "utf8");
  console.log(JSON.stringify({ outputPath, totalAttempts: attempts.length, targetAttempts: legacy.length, distribution, bankPrograms, taskClassValues, pairCount: pairLines.length, complete30: complete30.length, emptySelected30: emptySelected30.length, nullCorrect30: nullCorrect30.length, likelyPartial30: likelyPartial30.length, multipleAttemptGroups }, null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
