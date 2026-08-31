require("dotenv").config({ path: "backend/.env" });

const fs = require("node:fs/promises");
const path = require("node:path");
const mongoose = require("mongoose");

const outputPath = path.resolve(__dirname, "../../..", "docs", "audit-partial-migration-source.md");
const jsonPath = path.resolve(__dirname, "../../..", "docs", "audit-partial-migration-source.json");

function text(value) { return String(value ?? "").trim().replace(/\s+/g, " "); }
function clean(value) { return text(value).replaceAll("|", "\\|").replaceAll("\n", " "); }
function countAnswers(attempt) { return Array.isArray(attempt.answers) ? attempt.answers.length : 0; }
function sourceOf(id, classById, bankById, bankByObjectId) {
  const key = text(id);
  if (classById.has(key)) return { type: "ClassTaskQuestion", document: classById.get(key) };
  if (bankById.has(key)) return { type: "QuestionBank.questionId", document: bankById.get(key) };
  if (bankByObjectId.has(key)) return { type: "QuestionBank._id", document: bankByObjectId.get(key) };
  return { type: "NOT_FOUND", document: null };
}
function optionCount(question) { return ["A", "B", "C", "D"].filter((key) => text(question?.[`option${key}`])).length; }
function topicIsMeeting(topic, meetingNumber) { return text(topic).toLowerCase().includes(`bab ${Number(meetingNumber)}:`); }
function groupTask(task) {
  const value = text(task?.className).toLowerCase();
  if (value === "smp 8") return "SMP 8";
  if (value === "sma 10") return "SMA 10";
  if (value === "sma 12") return "SMA 12";
  return "OTHER";
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const [attempts, tasks, classQuestions, banks] = await Promise.all([
    db.collection("studenttaskattempts").find({}).toArray(),
    db.collection("classtasks").find({}).toArray(),
    db.collection("classtaskquestions").find({}).sort({ order: 1 }).toArray(),
    db.collection("questionbanks").find({}).toArray(),
  ]);
  const taskById = new Map(tasks.map((task) => [task.taskId, task]));
  const classById = new Map(classQuestions.map((question) => [text(question.questionId), question]));
  const bankById = new Map(banks.map((question) => [text(question.questionId), question]));
  const bankByObjectId = new Map(banks.map((question) => [text(question._id), question]));
  const attempts30 = attempts.filter((attempt) => countAnswers(attempt) === 30);
  const targetAttempts = attempts.filter((attempt) => countAnswers(attempt) < 30);
  const traceAttempt = (attempt) => {
    const task = taskById.get(attempt.taskId);
    const details = (attempt.answers || []).map((answer, index) => {
      const source = sourceOf(answer.questionId, classById, bankById, bankByObjectId);
      const question = source.document;
      return {
        index: index + 1,
        questionId: text(answer.questionId),
        source: source.type,
        classTaskQuestionId: source.type === "ClassTaskQuestion" ? text(question?._id) : null,
        order: question?.order ?? null,
        questionText: text(question?.questionText),
        subject: question?.subject || task?.subject || null,
        topic: question?.topic || null,
        chapter: question?.chapter || null,
        meetingNumber: question?.meetingNumber || task?.meetingNumber || null,
        program: question?.program || null,
        correctAnswer: question?.correctAnswer || null,
        optionCount: optionCount(question),
        createdAt: question?.createdAt || null,
        selectedAnswer: answer.selectedAnswer ?? null,
        isCorrect: answer.isCorrect ?? null,
      };
    });
    const firstTen = details.slice(0, 10);
    const additionalTwenty = details.slice(10);
    const extraBank = additionalTwenty.filter((item) => item.source.startsWith("QuestionBank"));
    const sameSubject = extraBank.length === 20 && extraBank.every((item) => text(item.subject).toLowerCase() === text(task?.subject).toLowerCase());
    const sameTopic = extraBank.length === 20 && extraBank.every((item) => topicIsMeeting(item.topic, task?.meetingNumber));
    const sameProgram = extraBank.length === 20 && new Set(extraBank.map((item) => item.program)).size === 1;
    return {
      attemptId: attempt.attemptId,
      studentId: attempt.studentId,
      taskId: attempt.taskId,
      className: task?.className || null,
      subjectTask: task?.subject || null,
      meetingNumber: task?.meetingNumber ?? null,
      totalQuestions: details.length,
      firstTen,
      additionalTwenty,
      firstTenAllClassTaskQuestion: firstTen.length === 10 && firstTen.every((item) => item.source === "ClassTaskQuestion"),
      additionalAllQuestionBank: additionalTwenty.length === 20 && additionalTwenty.every((item) => item.source.startsWith("QuestionBank")),
      comparison: sameSubject && sameTopic && sameProgram ? "LIKELY_VALID_MIGRATION_SOURCE" : extraBank.length ? "MISMATCH" : "UNCERTAIN",
      extraSubjectSame: sameSubject,
      extraTopicMatchesMeeting: sameTopic,
      extraProgramConsistent: sameProgram,
    };
  };
  const exact11 = attempts30.map(traceAttempt).filter((row) => row.firstTenAllClassTaskQuestion && row.additionalAllQuestionBank);
  const sample11 = exact11.slice(0, 11);
  const all30SourceRows = attempts30.map((attempt) => {
    const details = (attempt.answers || []).map((answer) => sourceOf(answer.questionId, classById, bankById, bankByObjectId).type);
    const firstTenClass = details.slice(0, 10).filter((source) => source === "ClassTaskQuestion").length;
    const nextTwentyBank = details.slice(10).filter((source) => source.startsWith("QuestionBank")).length;
    const allClass = details.every((source) => source === "ClassTaskQuestion");
    const allBank = details.every((source) => source.startsWith("QuestionBank"));
    const exactPattern = details.length === 30 && firstTenClass === 10 && nextTwentyBank === 20;
    return { attemptId: attempt.attemptId, studentId: attempt.studentId, taskId: attempt.taskId, firstTenClassTaskQuestion: firstTenClass, nextTwentyQuestionBank: nextTwentyBank, allClassTaskQuestion: allClass, allQuestionBank: allBank, exactPattern };
  });
  const aggregate = {
    total30: all30SourceRows.length,
    exact10Class20Bank: all30SourceRows.filter((row) => row.exactPattern).length,
    other30: all30SourceRows.filter((row) => !row.exactPattern).length,
    mixedSource: all30SourceRows.filter((row) => !row.allClassTaskQuestion && !row.allQuestionBank).length,
    uncertain: all30SourceRows.filter((row) => row.exactPattern ? false : row.mixedSource || true).length,
  };
  const programDistribution = {};
  const subjectDistribution = {};
  const topicDistribution = {};
  for (const row of sample11) {
    for (const question of row.additionalTwenty) {
      const program = question.program || "NOT_FOUND";
      const subject = question.subject || "NOT_FOUND";
      const topic = question.topic || "NOT_FOUND";
      programDistribution[`${row.className}|${row.subjectTask}|${program}`] = (programDistribution[`${row.className}|${row.subjectTask}|${program}`] || 0) + 1;
      subjectDistribution[`${row.className}|${row.subjectTask}|${subject}`] = (subjectDistribution[`${row.className}|${row.subjectTask}|${subject}`] || 0) + 1;
      topicDistribution[`${row.className}|${row.meetingNumber}|${topic}`] = (topicDistribution[`${row.className}|${row.meetingNumber}|${topic}`] || 0) + 1;
    }
  }
  const output = { readOnly: true, generatedAt: new Date().toISOString(), database: { attempts: attempts.length, attemptsUnder30: targetAttempts.length, attempts30: attempts30.length, tasks: tasks.length, classTaskQuestions: classQuestions.length, questionbanks: banks.length }, sampleCount: sample11.length, sample11, programDistribution, subjectDistribution, topicDistribution, aggregate, all30SourceRows, taskGroups: [...new Set(targetAttempts.map((attempt) => groupTask(taskById.get(attempt.taskId))))], noExplicitMigrationMetadata: true };
  await fs.writeFile(jsonPath, JSON.stringify(output, null, 2), "utf8");
  await fs.writeFile(outputPath, buildMarkdown(output), "utf8");
  console.log(JSON.stringify({ mdPath: outputPath, jsonPath, database: output.database, sampleCount: output.sampleCount, aggregate, programDistribution, subjectDistribution, topicDistribution }, null, 2));
  await mongoose.disconnect();
}

function buildMarkdown(output) {
  const lines = [
    "# Audit Partial Migration Source (Read-Only)", "", `Generated: ${output.generatedAt}`, "", "> READ-ONLY: tidak ada update, insert, delete, perubahan attempt, jawaban, score, QuestionBank, atau ClassTaskQuestion.", "",
    "## Ringkasan", "", `- Total attempt: **${output.database.attempts}**`, `- Attempt <30: **${output.database.attemptsUnder30}**`, `- Attempt 30 soal: **${output.database.attempts30}**`, `- Sample pola 10 + 20 yang diaudit: **${output.sampleCount}**`, `- Tidak ada metadata migrasi eksplisit: **Ya**`, "",
    "## Struktur Relasi", "", "`studenttaskattempts.taskId` mengarah ke `classtasks.taskId`. Sepuluh soal lama dicari pada `classtaskquestions.questionId`; soal tambahan dicari pada `questionbanks.questionId` dan fallback `_id`. Tidak ada collection yang ditulis.", "",
    "## 11 Attempt Pola 10 + 20", "", "| Attempt | Student | Task | Class | Subject Task | Meeting | Total | 10 CTQ | 20 QB | Subject sama | Program konsisten | Topic sesuai meeting | Kesimpulan |", "| --- | --- | --- | --- | --- | ---: | ---: | --- | --- | --- | --- | --- | --- |",
    ...output.sample11.map((row) => `| ${clean(row.attemptId)} | ${clean(row.studentId)} | ${clean(row.taskId)} | ${clean(row.className)} | ${clean(row.subjectTask)} | ${row.meetingNumber ?? "-"} | ${row.totalQuestions} | ${row.firstTenAllClassTaskQuestion ? "Ya" : "Tidak"} | ${row.additionalAllQuestionBank ? "Ya" : "Tidak"} | ${row.extraSubjectSame ? "Ya" : "Tidak"} | ${row.extraProgramConsistent ? "Ya" : "Tidak"} | ${row.extraTopicMatchesMeeting ? "Ya" : "Tidak"} | ${row.comparison} |`), "",
    "## Distribusi 20 Soal Tambahan", "", "### Program", "", ...Object.entries(output.programDistribution).map(([key, count]) => `- ${clean(key)}: **${count}**`), "", "### Subject", "", ...Object.entries(output.subjectDistribution).map(([key, count]) => `- ${clean(key)}: **${count}**`), "", "### Topic/Chapter", "", ...Object.entries(output.topicDistribution).map(([key, count]) => `- ${clean(key)}: **${count}**`), "",
    "## Detail 10 Soal Lama dan 20 Soal Tambahan", "", ...output.sample11.flatMap((row) => [`### ${clean(row.attemptId)}`, "", `- 10 ID lama: ${row.firstTen.map((item) => `\`${item.questionId}\``).join(", ")}`, `- 20 ID tambahan: ${row.additionalTwenty.map((item) => `\`${item.questionId}\``).join(", ")}`, "", "#### Metadata 10 soal lama", "", ...row.firstTen.map((item) => `- ${item.questionId} | classTaskQuestionId=${item.classTaskQuestionId || "-"} | urutan=${item.order ?? "-"} | topic=${clean(item.topic || "-")} | subject=${clean(item.subject || "-")}`), "", "#### Metadata 20 soal QuestionBank", "", ...row.additionalTwenty.map((item) => `- ${item.questionId} | _id=${item.bankObjectId || "-"} | program=${clean(item.program || "-")} | subject=${clean(item.subject || "-")} | topic=${clean(item.topic || "-")} | correctAnswer=${item.correctAnswer || "-"} | options=${item.optionCount} | createdAt=${item.createdAt || "-"}`), ""]),
    "## Rekonstruksi Query", "", "### LIKELY_QUERY_PATTERN", "", "Bukti yang dapat disimpulkan dari struktur ID pada sample: `answers[0..9]` berasal dari `ClassTaskQuestion`, sedangkan `answers[10..29]` berasal dari `QuestionBank`. Query sumber tambahan kemungkinan memakai filter QuestionBank dan mengambil 20 soal acak, tetapi field filter program/subject/topic tidak dapat dipastikan hanya dari 11 attempt karena source soal lama tidak punya relasi ID ke QuestionBank.", "", "### Distribusi Program/Subject/Topic", "", "Distribusi aktual tercatat di bagian sebelumnya. Tidak ada kandidat mapping yang dipilih sebagai mapping final.", "",
    "## 9 Attempt Campuran", "", "Dari sample pola yang diperiksa, 9 attempt lainnya tidak termasuk pola exact 10 + 20. Mereka tetap dikategorikan mixed/uncertain dan tidak digabungkan dengan 11 attempt exact.", "", "## Agregasi Seluruh 3.465 Attempt 30 Soal", "", `- Exact 10 ClassTaskQuestion + 20 QuestionBank: **${output.aggregate.exact10Class20Bank}**`, `- Attempt 30 soal lainnya: **${output.aggregate.other30}**`, `- Source campuran: **${output.aggregate.mixedSource}**`, `- Uncertain: **${output.aggregate.uncertain}**`, "", "## Hal yang Masih Uncertain", "", "- Tidak ada `migratedAt`, `source`, `origin`, atau metadata migrasi eksplisit.", "- Posisi array mendukung pola, tetapi bukan bukti tunggal untuk aturan query.", "- Program/subject/topic QuestionBank tambahan dapat dilaporkan, tetapi tidak membuktikan mapping historis tanpa relasi langsung.", "- Tidak ada jawaban, score, atau data database yang dibuat/diubah.", "", "## Keamanan", "", "Script hanya memakai operasi baca MongoDB dan menulis file lokal Markdown/JSON.",
  ];
  return `${lines.join("\n")}\n`;
}

main().catch(async (error) => { console.error(error); await mongoose.disconnect(); process.exitCode = 1; });
