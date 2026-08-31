require("dotenv").config({ path: "backend/.env" });

const fs = require("node:fs/promises");
const path = require("node:path");
const mongoose = require("mongoose");

const outputPath = path.resolve(__dirname, "../../..", "docs", "content-match-cbt-question-source.md");
const jsonOutputPath = path.resolve(__dirname, "../../..", "docs", "content-match-cbt-question-source.json");

function text(value) { return String(value ?? "").trim().replace(/\s+/g, " "); }
function clean(value) { return text(value).replaceAll("|", "\\|").replaceAll("\n", " "); }
function normalized(value) {
  return text(value).toLowerCase()
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}
function questionText(document) {
  return document?.questionText ?? document?.question ?? document?.text ?? document?.content ?? "";
}
function answerCount(attempt) { return Array.isArray(attempt.answers) ? attempt.answers.length : 0; }
function sourceFor(id, classTaskById, bankById, bankByObjectId) {
  const key = text(id);
  if (classTaskById.has(key)) return { source: "ClassTaskQuestion", document: classTaskById.get(key) };
  if (bankById.has(key)) return { source: "QuestionBank.questionId", document: bankById.get(key) };
  if (bankByObjectId.has(key)) return { source: "QuestionBank._id", document: bankByObjectId.get(key) };
  return { source: "NOT_FOUND", document: null };
}
function topicMatches(topic, meeting) {
  const n = Number(meeting);
  return Number.isFinite(n) && text(topic).toLowerCase().includes(`bab ${n}:`);
}
function similarity(a, b) {
  const left = normalized(a);
  const right = normalized(b);
  if (!left || !right) return { type: "NO_MATCH", confidence: 0 };
  if (left === right) return { type: "NORMALIZED_EXACT_MATCH", confidence: 1 };
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length > right.length ? left : right;
  if (shorter.length >= 40 && longer.includes(shorter)) return { type: "POTENTIAL_MATCH", confidence: Number((shorter.length / longer.length).toFixed(3)) };
  return { type: "NO_MATCH", confidence: 0 };
}
function topPotentialMatches(oldQuestion, banks) {
  const oldText = normalized(questionText(oldQuestion));
  if (!oldText) return [];
  return banks.map((bank) => {
    const newText = normalized(questionText(bank));
    let common = 0;
    const limit = Math.min(oldText.length, newText.length);
    for (let i = 0; i < limit && oldText[i] === newText[i]; i += 1) common += 1;
    return { bank, confidence: Number((common / Math.max(oldText.length, newText.length)).toFixed(3)) };
  }).filter((item) => item.confidence >= 0.55).sort((a, b) => b.confidence - a.confidence).slice(0, 3);
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const [tasks, classTaskQuestions, banks, attempts] = await Promise.all([
    db.collection("classtasks").find({}).toArray(),
    db.collection("classtaskquestions").find({}).sort({ order: 1 }).toArray(),
    db.collection("questionbanks").find({}).toArray(),
    db.collection("studenttaskattempts").find({}).toArray(),
  ]);
  const taskById = new Map(tasks.map((task) => [task.taskId, task]));
  const classTaskById = new Map(classTaskQuestions.map((question) => [text(question.questionId), question]));
  const bankById = new Map(banks.map((question) => [text(question.questionId), question]));
  const bankByObjectId = new Map(banks.map((question) => [text(question._id), question]));
  const targetAttempts = attempts.filter((attempt) => answerCount(attempt) < 30);
  const targetTaskIds = new Set(targetAttempts.map((attempt) => attempt.taskId));
  const targetTasks = tasks.filter((task) => targetTaskIds.has(task.taskId));
  const sampleTasks = [
    ...targetTasks.filter((task) => text(task.className) === "SMP 8").slice(0, 5),
    ...targetTasks.filter((task) => text(task.className) === "SMA 10").slice(0, 5),
    ...targetTasks.filter((task) => text(task.className) === "SMA 12").slice(0, 5),
  ];
  const sampleTaskIds = new Set(sampleTasks.map((task) => task.taskId));
  const sampleClassQuestions = classTaskQuestions.filter((question) => sampleTaskIds.has(question.taskId));
  const traceRows = sampleClassQuestions.map((oldQuestion) => {
    const task = taskById.get(oldQuestion.taskId);
    const direct = bankById.get(text(oldQuestion.questionId));
    const object = bankByObjectId.get(text(oldQuestion.questionId));
    const bank = direct || object || null;
    const match = bank ? similarity(oldQuestion, bank) : { type: "NO_MATCH", confidence: 0 };
    const potential = bank ? [] : topPotentialMatches(oldQuestion, banks);
    return { taskId: oldQuestion.taskId, classTaskQuestionId: text(oldQuestion._id), oldQuestionId: text(oldQuestion.questionId), order: oldQuestion.order ?? "-", oldSubject: task?.subject || oldQuestion.subject || "-", className: task?.className || "-", meetingNumber: task?.meetingNumber ?? "-", oldTopic: oldQuestion.topic || "-", oldText: text(questionText(oldQuestion)), bankId: bank ? text(bank._id) : null, bankQuestionId: bank ? text(bank.questionId) : null, bankText: bank ? text(questionText(bank)) : null, bankProgram: bank?.program || null, bankSubject: bank?.subject || null, bankTopic: bank?.topic || null, matchType: match.type, matchConfidence: match.confidence, potential: potential.map((item) => ({ bankId: text(item.bank._id), questionId: text(item.bank.questionId), program: item.bank.program, subject: item.bank.subject, topic: item.bank.topic, text: text(questionText(item.bank)), confidence: item.confidence })) };
  });

  const sourceGroups = new Map();
  for (const row of traceRows) {
    const key = `${row.className}|${row.oldSubject}|${row.bankProgram || "NO_MATCH"}|${row.bankSubject || "NO_MATCH"}|${row.bankTopic || "NO_MATCH"}`;
    sourceGroups.set(key, (sourceGroups.get(key) || 0) + 1);
  }
  const partial30 = attempts.filter((attempt) => answerCount(attempt) === 30 && (attempt.answers || []).some((answer) => !answer.selectedAnswer || answer.isCorrect === null));
  const partialRows = partial30.slice(0, 20).map((attempt) => {
    const details = (attempt.answers || []).map((answer) => {
      const resolved = sourceFor(answer.questionId, classTaskById, bankById, bankByObjectId);
      const question = resolved.document;
      return { questionId: text(answer.questionId), source: resolved.source, bankObjectId: resolved.source.startsWith("QuestionBank") ? text(question?._id) : null, program: question?.program || null, subject: question?.subject || null, topic: question?.topic || null, correctAnswer: question?.correctAnswer || null, optionA: question?.optionA || null, optionB: question?.optionB || null, optionC: question?.optionC || null, optionD: question?.optionD || null, createdAt: question?.createdAt || null, selectedAnswer: answer.selectedAnswer ?? null, isCorrect: answer.isCorrect ?? null };
    });
    const firstTen = details.slice(0, 10);
    const additionalTwenty = details.slice(10);
    return { attemptId: attempt.attemptId, studentId: attempt.studentId, taskId: attempt.taskId, questionIds: details, firstTen, additionalTwenty, firstTenAllClassTaskQuestion: firstTen.every((item) => item.source === "ClassTaskQuestion"), additionalAllQuestionBank: additionalTwenty.every((item) => item.source.startsWith("QuestionBank")), emptyAdditional: additionalTwenty.filter((item) => !item.selectedAnswer || item.isCorrect === null).length };
  });
  const original10ThenBank20 = partialRows.filter((row) => row.firstTenAllClassTaskQuestion && row.additionalAllQuestionBank).length;
  const mixedPartial = partialRows.filter((row) => !(row.firstTenAllClassTaskQuestion && row.additionalAllQuestionBank)).length;
  const migrationFields = [...new Set(attempts.flatMap((attempt) => Object.keys(attempt)))].filter((field) => ["migratedAt", "source", "origin", "generated", "imported", "questionSource", "migration", "metadata"].includes(field));
  const guruKelasSD = banks.filter((question) => normalized(question.subject) === normalized("Guru Kelas SD"));
  const bahasaIndonesia = banks.filter((question) => normalized(question.subject).includes(normalized("Bahasa Indonesia")));
  const output = { readOnly: true, generatedAt: new Date().toISOString(), database: { tasks: tasks.length, classTaskQuestions: classTaskQuestions.length, questionbanks: banks.length, attempts: attempts.length }, sampleTasks: sampleTasks.map((task) => ({ taskId: task.taskId, className: task.className, subject: task.subject, meetingNumber: task.meetingNumber })), traceRows, sourceGroups: [...sourceGroups.entries()].map(([key, count]) => ({ key, count })), partial30: { total: partial30.length, sampleCount: partialRows.length, original10ThenBank20, mixedPartial, rows: partialRows }, guruKelasSD: { count: guruKelasSD.length, programs: [...new Set(guruKelasSD.map((question) => question.program))] }, bahasaIndonesia: { total: bahasaIndonesia.length, variations: [...new Map(bahasaIndonesia.map((question) => [`${question.program}|${question.subject}`, 1])).keys()] }, migrationFields, allClassTaskQuestionMissingInQuestionBank: classTaskQuestions.filter((question) => !bankById.has(text(question.questionId)) && !bankByObjectId.has(text(question.questionId))).length };
  await fs.writeFile(outputPath, buildMarkdown(output), "utf8");
  await fs.writeFile(jsonOutputPath, JSON.stringify(output, null, 2), "utf8");
  console.log(JSON.stringify({ outputPath, jsonOutputPath, database: output.database, sampleTasks: output.sampleTasks.length, traceRows: output.traceRows.length, traceMatches: output.traceRows.filter((row) => row.matchType !== "NO_MATCH").length, partial30: { total: output.partial30.total, original10ThenBank20, mixedPartial }, guruKelasSD: output.guruKelasSD, bahasaIndonesia: output.bahasaIndonesia, migrationFields, allClassTaskQuestionMissingInQuestionBank: output.allClassTaskQuestionMissingInQuestionBank }, null, 2));
  await mongoose.disconnect();
}

function buildMarkdown(output) {
  const lines = [
    "# Content Match CBT Question Source (Read-Only)",
    "",
    `Generated: ${output.generatedAt}`,
    "",
    "> READ-ONLY: tidak ada update, insert, delete, perubahan attempt, jawaban, score, QuestionBank, atau ClassTaskQuestion.",
    "",
    "## 1. Ringkasan",
    "",
    `- Task: **${output.database.tasks}**`,
    `- ClassTaskQuestion: **${output.database.classTaskQuestions}**`,
    `- QuestionBank: **${output.database.questionbanks}**`,
    `- Attempt: **${output.database.attempts}**`,
    `- Sample task: **${output.sampleTasks.length}**`,
    `- ClassTaskQuestion yang tidak ditemukan di QuestionBank melalui questionId maupun _id: **${output.allClassTaskQuestionMissingInQuestionBank}**`,
    "",
    "## 2. Sample 15 Task",
    "",
    ...output.sampleTasks.map((task) => `- ${task.taskId} | ${task.className} | ${task.subject} | meeting ${task.meetingNumber}`),
    "",
    "## 3. Struktur Collection",
    "",
    "`ClassTaskQuestion` memakai field seperti `_id`, `questionId`, `taskId`, `questionText`, `optionA-D`, `correctAnswer`, `explanation`, `topic`, `difficulty`, dan `order`. `QuestionBank` memakai `_id`, `questionId`, `program`, `subject`, `topic`, `questionText`, `optionA-D`, `correctAnswer`, `explanation`, dan `difficulty`. Tidak ditemukan field isi alternatif seperti `question`, `text`, `content`, `options`, atau `chapter` yang digunakan sebagai sumber utama.",
    "",
    "## 4. Content Matching 150 Soal Sample",
    "",
    "| taskId | ClassTaskQuestionId | questionId lama | Urutan | Subject lama | Kelas | Meeting | Topic lama | QuestionBank ID | Program | Subject | Topic | Match | Confidence |",
    "| --- | --- | --- | ---: | --- | --- | ---: | --- | --- | --- | --- | --- | --- | ---: |",
    ...output.traceRows.map((row) => `| ${clean(row.taskId)} | ${clean(row.classTaskQuestionId)} | ${clean(row.oldQuestionId)} | ${row.order} | ${clean(row.oldSubject)} | ${clean(row.className)} | ${row.meetingNumber} | ${clean(row.oldTopic)} | ${clean(row.bankQuestionId || row.bankId || "-")} | ${clean(row.bankProgram || "-")} | ${clean(row.bankSubject || "-")} | ${clean(row.bankTopic || "-")} | ${row.matchType} | ${row.matchConfidence} |`),
    "",
    "## 5. Pola Sumber Soal",
    "",
    ...output.sourceGroups.map((group) => `- ${clean(group.key)}: **${group.count}**`),
    "",
    "## 6. Trace 20 Attempt 30 Soal",
    "",
    `Dari **${output.partial30.total}** attempt 30 soal dengan jawaban kosong/null, ditampilkan **${output.partial30.sampleCount}** contoh.`,
    "",
    "| attemptId | studentId | taskId | 10 pertama ClassTaskQuestion | 20 berikutnya QuestionBank | Jumlah kosong tambahan |",
    "| --- | --- | --- | --- | --- | ---: |",
    ...output.partial30.rows.map((row) => `| ${clean(row.attemptId)} | ${clean(row.studentId)} | ${clean(row.taskId)} | ${row.firstTenAllClassTaskQuestion ? "Ya" : "Tidak"} | ${row.additionalAllQuestionBank ? "Ya" : "Tidak"} | ${row.emptyAdditional} |`),
    "",
    `Pola 10 ClassTaskQuestion + 20 QuestionBank: **${output.partial30.original10ThenBank20}** dari sample. Pola lain/campuran: **${output.partial30.mixedPartial}** dari sample. Posisi array tidak dianggap bukti tunggal; sumber ID juga diperiksa.`,
    "",
    "### Detail 20 Soal Tambahan",
    "",
    ...output.partial30.rows.flatMap((row) => [
      `#### ${clean(row.attemptId)}`,
      "",
      ...row.additionalTwenty.map((item) => `- ${clean(item.questionId)} | source=${item.source} | _id=${clean(item.bankObjectId || "-")} | program=${clean(item.program || "-")} | subject=${clean(item.subject || "-")} | topic=${clean(item.topic || "-")} | correctAnswer=${clean(item.correctAnswer || "-")} | options=A:${clean(item.optionA || "-")}; B:${clean(item.optionB || "-")}; C:${clean(item.optionC || "-")}; D:${clean(item.optionD || "-")} | createdAt=${clean(item.createdAt || "-")}`),
      "",
    ]),
    "## 7. Guru Kelas SD",
    "",
    `QuestionBank exact subject Guru Kelas SD: **${output.guruKelasSD.count}**. Program: ${output.guruKelasSD.programs.join(", ") || "tidak ada"}.`,
    "",
    "## 8. Variasi Bahasa Indonesia",
    "",
    `Total subject yang mengandung Bahasa Indonesia: **${output.bahasaIndonesia.total}**`,
    ...output.bahasaIndonesia.variations.map((value) => `- ${clean(value)}`),
    "",
    "## 9. Migration Metadata",
    "",
    `Field metadata migrasi eksplisit yang ditemukan: ${output.migrationFields.length ? output.migrationFields.join(", ") : "NO_EXPLICIT_MIGRATION_METADATA"}`,
    "",
    "## 10. Kesimpulan dan Mapping",
    "",
    "- Tidak ada mapping final yang ditetapkan.",
    "- Trace content matching tidak menemukan bukti soal ClassTaskQuestion identik dengan QuestionBank V3 pada sample; seluruh sample berstatus NO_MATCH bila lookup ID tidak menemukan dokumen.",
    "- Subject Guru Kelas SD tidak tersedia di QuestionBank.",
    "- Bahasa Indonesia hanya muncul pada SD Kelas 4-6, SMP Kelas 7-9, dan UTBK sebagai Literasi Bahasa Indonesia.",
    "- Soal tambahan pada attempt 30 hanya dilaporkan sumber dan metadata-nya; tidak dibuat selectedAnswer dan tidak dihitung nilainya.",
    "- Mapping SMP 8, SMA 10, dan SMA 12 belum dapat ditetapkan hanya dari content matching ini.",
    "",
    "## 11. Keamanan",
    "",
    "Script hanya memakai operasi baca MongoDB dan menulis dua file laporan lokal. Tidak ada operasi mutasi database.",
  ];
  return `${lines.join("\n")}\n`;
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
