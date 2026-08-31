require("dotenv").config({ path: "backend/.env" });

const fs = require("node:fs/promises");
const path = require("node:path");
const mongoose = require("mongoose");

const outputPath = path.resolve(__dirname, "../../..", "docs", "final-cbt-mapping-audit.md");
const jsonPath = path.resolve(__dirname, "../../..", "docs", "final-cbt-mapping-audit.json");

function text(value) { return String(value ?? "").trim().replace(/\s+/g, " "); }
function norm(value) { return text(value).toLowerCase(); }
function clean(value) { return text(value).replaceAll("|", "\\|").replaceAll("\n", " "); }
function countAnswers(attempt) { return Array.isArray(attempt.answers) ? attempt.answers.length : 0; }
function source(id, classById, bankById, bankObjectById) {
  const key = text(id);
  if (classById.has(key)) return { type: "ClassTaskQuestion", document: classById.get(key) };
  if (bankById.has(key)) return { type: "QuestionBank.questionId", document: bankById.get(key) };
  if (bankObjectById.has(key)) return { type: "QuestionBank._id", document: bankObjectById.get(key) };
  return { type: "NOT_FOUND", document: null };
}
function groupFor(task) {
  const value = norm(task?.className);
  if (value === "smp 8") return "SMP 8";
  if (value === "sma 10") return "SMA 10";
  if (value === "sma 12") return "SMA 12";
  return "OTHER";
}
function isPLevel(task) {
  return /p[1-9]/i.test(`${task?.taskId || ""} ${task?.title || ""}`);
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const [attempts, tasks, classQuestions, banks, students] = await Promise.all([
    db.collection("studenttaskattempts").find({}).toArray(),
    db.collection("classtasks").find({}).toArray(),
    db.collection("classtaskquestions").find({}).toArray(),
    db.collection("questionbanks").find({}).toArray(),
    db.collection("students").find({}).toArray(),
  ]);
  const taskById = new Map(tasks.map((task) => [task.taskId, task]));
  const classById = new Map(classQuestions.map((question) => [text(question.questionId), question]));
  const bankById = new Map(banks.map((question) => [text(question.questionId), question]));
  const bankObjectById = new Map(banks.map((question) => [text(question._id), question]));
  const studentById = new Map(students.map((student) => [text(student.studentId), student]));
  const attempts30 = attempts.filter((attempt) => countAnswers(attempt) === 30);
  const targetAttempts = attempts.filter((attempt) => countAnswers(attempt) < 30);
  const groups = new Map();
  for (const attempt of attempts30) {
    const task = taskById.get(attempt.taskId);
    const details = (attempt.answers || []).map((answer) => {
      const resolved = source(answer.questionId, classById, bankById, bankObjectById);
      return { ...answer, questionId: text(answer.questionId), source: resolved.type, question: resolved.document };
    });
    const classSources = details.filter((item) => item.source === "ClassTaskQuestion");
    const bankSources = details.filter((item) => item.source.startsWith("QuestionBank"));
    const exactPattern = details.length === 30 && details.slice(0, 10).every((item) => item.source === "ClassTaskQuestion") && details.slice(10).every((item) => item.source.startsWith("QuestionBank"));
    const key = `${task?.className || "-"}|${task?.subject || "-"}|${task?.meetingNumber || "-"}`;
    const group = groups.get(key) || { className: task?.className || "-", subject: task?.subject || "-", meetingNumber: task?.meetingNumber || "-", taskIds: new Set(), attempts: 0, exactPatternAttempts: 0, programs: {}, subjects: {}, topics: {}, examples: [] };
    group.attempts += 1;
    group.taskIds.add(attempt.taskId);
    if (exactPattern) group.exactPatternAttempts += 1;
    for (const item of bankSources) {
      const program = text(item.question?.program) || "NOT_FOUND";
      const subject = text(item.question?.subject) || "NOT_FOUND";
      const topic = text(item.question?.topic) || "NOT_FOUND";
      group.programs[program] = (group.programs[program] || 0) + 1;
      group.subjects[subject] = (group.subjects[subject] || 0) + 1;
      group.topics[topic] = (group.topics[topic] || 0) + 1;
    }
    if (group.examples.length < 3) group.examples.push({ attemptId: attempt.attemptId, studentId: attempt.studentId, bankQuestions: bankSources.slice(0, 3).map((item) => ({ questionId: item.questionId, program: item.question?.program, subject: item.question?.subject, topic: item.question?.topic })) });
    groups.set(key, group);
  }
  const mapping = [];
  for (const [groupKey, group] of groups) {
    const [className, subject, meetingNumber] = groupKey.split("|");
    const candidates = className === "SMP 8" ? ["SMP Kelas 7-9"] : className === "SMA 10" || className === "SMA 12" ? ["SMA IPA", "SMA IPS"] : [];
    for (const candidate of candidates) {
      const matching = banks.filter((bank) => norm(bank.program) === norm(candidate) && norm(bank.subject) === norm(subject));
      const topicMatching = matching.filter((bank) => text(bank.topic).toLowerCase().includes(`bab ${meetingNumber}:`));
      mapping.push({ className, subject, meetingNumber, candidate, attempts: group.attempts, exactPatternAttempts: group.exactPatternAttempts, availableProgram: banks.filter((bank) => norm(bank.program) === norm(candidate)).length, subjectMatch: matching.length, topicMatch: topicMatching.length, status: group.exactPatternAttempts > 0 && matching.length > 0 ? "LIKELY_MAPPING" : group.exactPatternAttempts > 0 ? "NO_QUESTIONBANK_SOURCE" : "MAPPING_NOT_PROVEN", examples: group.examples });
    }
  }
  const sourceRows = attempts30.map((attempt) => {
    const details = (attempt.answers || []).map((answer) => source(answer.questionId, classById, bankById, bankObjectById).type);
    const firstTenClass = details.slice(0, 10).filter((item) => item === "ClassTaskQuestion").length;
    const nextTwentyBank = details.slice(10).filter((item) => item.startsWith("QuestionBank")).length;
    return { attemptId: attempt.attemptId, studentId: attempt.studentId, taskId: attempt.taskId, className: taskById.get(attempt.taskId)?.className || "-", exactPattern: firstTenClass === 10 && nextTwentyBank === 20, firstTenClassTaskQuestion: firstTenClass, nextTwentyQuestionBank: nextTwentyBank, sourceCounts: details.reduce((map, item) => { map[item] = (map[item] || 0) + 1; return map; }, {}) };
  });
  const distribution = { below30: targetAttempts.length, ten: targetAttempts.filter((attempt) => countAnswers(attempt) === 10).length, twenty: targetAttempts.filter((attempt) => countAnswers(attempt) === 20).length, thirty: attempts30.length };
  const pDistribution = {};
  for (const row of sourceRows) {
    const task = taskById.get(row.taskId);
    if (!isPLevel(task)) continue;
    const key = `${groupFor(task)}|${task?.meetingNumber || "-"}`;
    pDistribution[key] = pDistribution[key] || { className: groupFor(task), meetingNumber: task?.meetingNumber || "-", total: 0, exactPattern: 0 };
    pDistribution[key].total += 1;
    if (row.exactPattern) pDistribution[key].exactPattern += 1;
  }
  const output = { readOnly: true, generatedAt: new Date().toISOString(), database: { attempts: attempts.length, attempts30: attempts30.length, targetAttempts: targetAttempts.length, tasks: tasks.length, classTaskQuestions: classQuestions.length, questionbanks: banks.length, students: students.length }, distribution, targetClasses: [...new Set(targetAttempts.map((attempt) => groupFor(taskById.get(attempt.taskId))))], mapping, taskGroups: [...groups.values()].map((group) => ({ ...group, taskIds: [...group.taskIds] })), pDistribution: Object.values(pDistribution), sourceRows, sampleStudentNames: students.length, noFinalMappingSelected: true };
  await fs.writeFile(jsonPath, JSON.stringify(output, null, 2), "utf8");
  await fs.writeFile(outputPath, buildMarkdown(output), "utf8");
  console.log(JSON.stringify({ mdPath: outputPath, jsonPath, database: output.database, distribution, targetClasses: output.targetClasses, mapping: output.mapping, pDistribution: output.pDistribution, exactPatternAll30: sourceRows.filter((row) => row.exactPattern).length, other30: sourceRows.filter((row) => !row.exactPattern).length }, null, 2));
  await mongoose.disconnect();
}

function buildMarkdown(output) {
  const lines = ["# Final CBT Mapping Audit (Read-Only)", "", `Generated: ${output.generatedAt}`, "", "> READ-ONLY: tidak ada update, insert, delete, perubahan attempt, jawaban, score, QuestionBank, atau ClassTaskQuestion.", "", "## Ringkasan", "", `- Total attempt: **${output.database.attempts}**`, `- Attempt <30: **${output.database.targetAttempts}**`, `- Attempt 30 soal: **${output.database.attempts30}**`, `- Attempt 10 soal: **${output.distribution.ten}**`, `- Attempt 20 soal: **${output.distribution.twenty}**`, `- QuestionBank: **${output.database.questionbanks}**`, `- ClassTaskQuestion: **${output.database.classTaskQuestions}**`, "", "## Mapping Per Class/Task", "", "Status tidak memilih mapping final. `LIKELY_MAPPING` hanya berarti ada bukti pola attempt 30 soal dan ada QuestionBank dengan pasangan program+subject.", "", "| Class | Subject | Meeting | Candidate Program | Attempt | Pola 10+20 | Program tersedia | Subject match | Topic match | Status |", "| --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | --- |", ...output.mapping.map((row) => `| ${clean(row.className)} | ${clean(row.subject)} | ${row.meetingNumber} | ${clean(row.candidate)} | ${row.attempts} | ${row.exactPatternAttempts} | ${row.availableProgram} | ${row.subjectMatch} | ${row.topicMatch} | ${row.status} |`), "", "## Bukti Attempt 30 Soal", "", "| attemptId | studentId | taskId | Class | Exact 10 ClassTaskQuestion + 20 QuestionBank | Sumber |", "| --- | --- | --- | --- | --- | --- |", ...output.sourceRows.filter((row) => row.exactPattern).slice(0, 100).map((row) => `| ${clean(row.attemptId)} | ${clean(row.studentId)} | ${clean(row.taskId)} | ${clean(row.className)} | Ya | ${Object.entries(row.sourceCounts).map(([key, value]) => `${key}:${value}`).join(", ")} |`), "", "## Distribusi P1-P9", "", "| Class | Meeting | Total attempt 30 | Exact 10+20 |", "| --- | ---: | ---: | ---: |", ...output.pDistribution.map((row) => `| ${clean(row.className)} | ${row.meetingNumber} | ${row.total} | ${row.exactPattern} |`), "", "## Kesimpulan", "", "- Mapping SMP 8, SMA 10, dan SMA 12 tidak dipilih sebagai mapping final.", "- Mapping hanya berstatus `LIKELY_MAPPING` apabila bukti pola attempt dan pasangan program+subject tersedia.", "- Jika tidak ada bukti attempt 30 soal yang dapat dijadikan sumber, statusnya `MAPPING_NOT_PROVEN` atau `NO_QUESTIONBANK_SOURCE`.", "- Attempt utama dan remedial tidak digabungkan; tidak ada asumsi remedial baru.", "- Tidak ada perubahan database atau pembuatan data simulasi.", "", "## Keamanan", "", "Audit hanya membaca database dan menulis laporan lokal Markdown/JSON."];
  return `${lines.join("\n")}\n`;
}

main().catch(async (error) => { console.error(error); await mongoose.disconnect(); process.exitCode = 1; });
