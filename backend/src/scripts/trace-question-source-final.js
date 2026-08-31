require("dotenv").config({ path: "backend/.env" });

const fs = require("node:fs/promises");
const path = require("node:path");
const mongoose = require("mongoose");

const outputPath = path.resolve(__dirname, "../../..", "docs", "trace-question-source-final.md");

function text(value) { return String(value ?? "").trim().replace(/\s+/g, " "); }
function norm(value) { return text(value).toLowerCase(); }
function clean(value) { return text(value).replaceAll("|", "\\|").replaceAll("\n", " "); }
function countAnswers(attempt) { return Array.isArray(attempt.answers) ? attempt.answers.length : 0; }
function sameId(value, id) { return text(value) === text(id); }
function topicHasMeeting(topic, meeting) { return text(topic).toLowerCase().includes(`bab ${Number(meeting)}:`); }

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const [tasks, classTaskQuestions, questionBanks, attempts, students, users] = await Promise.all([
    db.collection("classtasks").find({}).toArray(),
    db.collection("classtaskquestions").find({}).sort({ order: 1 }).toArray(),
    db.collection("questionbanks").find({}).toArray(),
    db.collection("studenttaskattempts").find({}).toArray(),
    db.collection("students").find({}).toArray(),
    db.collection("users").find({}).toArray(),
  ]);
  const taskById = new Map(tasks.map((task) => [task.taskId, task]));
  const bankByQuestionId = new Map(questionBanks.map((question) => [text(question.questionId), question]));
  const bankByObjectId = new Map(questionBanks.map((question) => [text(question._id), question]));
  const classTaskByQuestionId = new Map(classTaskQuestions.map((question) => [text(question.questionId), question]));
  const studentById = new Map(students.map((student) => [text(student.studentId), student]));
  const userById = new Map(users.map((user) => [text(user._id), user]));
  const targetAttempts = attempts.filter((attempt) => countAnswers(attempt) < 30);
  const targetTaskIds = new Set(targetAttempts.map((attempt) => attempt.taskId));
  const targetTasks = tasks.filter((task) => targetTaskIds.has(task.taskId));
  const groups = {
    "SMP 8": targetTasks.filter((task) => text(task.className) === "SMP 8").slice(0, 5),
    "SMA 10": targetTasks.filter((task) => text(task.className) === "SMA 10").slice(0, 5),
    "SMA 12": targetTasks.filter((task) => text(task.className) === "SMA 12").slice(0, 5),
  };
  const sampleTasks = [...groups["SMP 8"], ...groups["SMA 10"], ...groups["SMA 12"]];
  const sampleTaskIds = new Set(sampleTasks.map((task) => task.taskId));
  const sampleQuestions = classTaskQuestions.filter((question) => sampleTaskIds.has(question.taskId));
  const traceRows = sampleQuestions.map((question) => {
    const task = taskById.get(question.taskId);
    const byQuestionId = bankByQuestionId.get(text(question.questionId));
    const byObjectId = bankByObjectId.get(text(question.questionId));
    const source = byQuestionId || byObjectId || null;
    return {
      taskId: question.taskId,
      classTaskQuestionId: text(question._id),
      questionId: text(question.questionId),
      order: question.order ?? "-",
      taskSubject: task?.subject || "-",
      className: task?.className || "-",
      meetingNumber: task?.meetingNumber ?? "-",
      classTaskTopic: question.topic || "-",
      bankProgram: source?.program || "-",
      bankSubject: source?.subject || "-",
      bankTopic: source?.topic || "-",
      found: Boolean(source),
      lookup: byQuestionId ? "questionbanks.questionId" : byObjectId ? "questionbanks._id" : "not found",
    };
  });

  const allTaskQuestionByTask = new Map();
  for (const question of classTaskQuestions) allTaskQuestionByTask.set(question.taskId, [...(allTaskQuestionByTask.get(question.taskId) || []), question]);
  const sourceGroups = new Map();
  for (const row of traceRows) {
    const key = `${row.className}|${row.taskSubject}|${row.bankProgram}|${row.bankSubject}|${row.bankTopic}`;
    sourceGroups.set(key, (sourceGroups.get(key) || 0) + 1);
  }
  const sourceNotFound = traceRows.filter((row) => !row.found);

  const partialAttempts = attempts.filter((attempt) => {
    const answers = attempt.answers || [];
    if (answers.length !== 30) return false;
    const firstTen = answers.slice(0, 10);
    const lastTwenty = answers.slice(10);
    return firstTen.every((answer) => classTaskByQuestionId.has(text(answer.questionId))) && lastTwenty.some((answer) => bankByQuestionId.has(text(answer.questionId)) || bankByObjectId.has(text(answer.questionId)));
  });
  const partialRows = partialAttempts.slice(0, 20).map((attempt) => {
    const answers = attempt.answers || [];
    const traceAnswer = (answer) => {
      const id = text(answer.questionId);
      const classQuestion = classTaskByQuestionId.get(id);
      const bankQuestion = bankByQuestionId.get(id) || bankByObjectId.get(id);
      return { questionId: id, source: classQuestion ? "ClassTaskQuestion" : bankQuestion ? "QuestionBank" : "NOT_FOUND", program: bankQuestion?.program || null, subject: bankQuestion?.subject || null, topic: bankQuestion?.topic || null, correctAnswer: bankQuestion?.correctAnswer || null, optionA: bankQuestion?.optionA || null, optionB: bankQuestion?.optionB || null, optionC: bankQuestion?.optionC || null, optionD: bankQuestion?.optionD || null, createdAt: bankQuestion?.createdAt || null };
    };
    const first = answers.slice(0, 10).map(traceAnswer);
    const extra = answers.slice(10).map(traceAnswer);
    const task = taskById.get(attempt.taskId);
    const firstBank = first.filter((row) => row.source === "QuestionBank");
    const extraBank = extra.filter((row) => row.source === "QuestionBank");
    const sameSubject = extraBank.length > 0 && extraBank.every((row) => norm(row.subject) === norm(task?.subject));
    const sameTopic = extraBank.length > 0 && extraBank.every((row) => topicHasMeeting(row.topic, task?.meetingNumber));
    return {
      attemptId: attempt.attemptId,
      studentId: attempt.studentId,
      taskId: attempt.taskId,
      firstTen: first,
      additionalTwenty: extra,
      firstTenAllClassTaskQuestion: first.every((row) => row.source === "ClassTaskQuestion"),
      additionalAllQuestionBank: extra.every((row) => row.source === "QuestionBank"),
      comparison: extraBank.length === 0 ? "UNCERTAIN" : sameSubject && sameTopic ? "LIKELY_VALID_MIGRATION_SOURCE" : "MISMATCH",
      extraSameSubject: sameSubject,
      extraSameMeetingTopic: sameTopic,
    };
  });

  const subjectGuruKelasSd = questionBanks.filter((question) => norm(question.subject) === norm("Guru Kelas SD"));
  const bahasaIndonesia = questionBanks.filter((question) => norm(question.subject).includes(norm("Bahasa Indonesia")));
  const subjectVariations = new Map();
  for (const question of bahasaIndonesia) subjectVariations.set(`${question.program}|${question.subject}`, (subjectVariations.get(`${question.program}|${question.subject}`) || 0) + 1);
  const sourceMissingAll = classTaskQuestions.filter((question) => !bankByQuestionId.has(text(question.questionId)) && !bankByObjectId.has(text(question.questionId)));
  const output = {
    generatedAt: new Date().toISOString(),
    database: { tasks: tasks.length, classTaskQuestions: classTaskQuestions.length, questionbanks: questionBanks.length, attempts: attempts.length },
    target: { attemptsUnder30: targetAttempts.length, sampledTasks: sampleTasks.length, sampleTaskIds: sampleTasks.map((task) => task.taskId) },
    taskGroups: groups,
    traceRows,
    sourceGroups: [...sourceGroups.entries()].map(([key, count]) => ({ key, count })),
    sourceNotFound,
    partial: { total: partialAttempts.length, rows: partialRows },
    guruKelasSD: { count: subjectGuruKelasSd.length, programs: [...new Set(subjectGuruKelasSd.map((question) => question.program))] },
    bahasaIndonesia: { total: bahasaIndonesia.length, variations: [...subjectVariations.entries()].map(([key, count]) => ({ key, count })) },
    allClassTaskQuestionNotFoundInQuestionBank: sourceMissingAll.length,
    studentNamesAvailable: students.length,
    userDocumentsAvailable: users.length,
  };
  await fs.writeFile(outputPath, buildMarkdown(output), "utf8");
  console.log(JSON.stringify({ outputPath, database: output.database, target: output.target, sampleGroups: Object.fromEntries(Object.entries(groups).map(([key, value]) => [key, value.length])), traceRows: traceRows.length, sourceNotFound: sourceNotFound.length, partial: { total: partialAttempts.length, sample: partialRows.length }, guruKelasSD: output.guruKelasSD, bahasaIndonesia: output.bahasaIndonesia, allClassTaskQuestionNotFoundInQuestionBank: sourceMissingAll.length }, null, 2));
  await mongoose.disconnect();
}

function buildMarkdown(output) {
  const lines = [
    "# Trace Question Source Final (Read-Only)",
    "",
    `Generated: ${output.generatedAt}`,
    "",
    "> READ-ONLY: tidak ada update, insert, delete, perubahan attempt, jawaban, score, QuestionBank, atau ClassTaskQuestion.",
    "",
    "## 1. Ringkasan Database",
    "",
    `- Task: **${output.database.tasks}**`,
    `- ClassTaskQuestion: **${output.database.classTaskQuestions}**`,
    `- QuestionBank: **${output.database.questionbanks}**`,
    `- Attempt: **${output.database.attempts}**`,
    `- Attempt kurang dari 30 soal: **${output.target.attemptsUnder30}**`,
    `- Sample task yang ditrace: **${output.target.sampledTasks}**`,
    `- ClassTaskQuestion sample yang tidak ditemukan di QuestionBank melalui questionId maupun _id: **${output.sourceNotFound.length}**`,
    "",
    "## 2. Sample Task",
    "",
    ...Object.entries(output.taskGroups).flatMap(([group, tasks]) => [
      `### ${group}`,
      "",
      ...tasks.map((task) => `- ${task.taskId} | className: ${task.className} | subject: ${task.subject} | meetingNumber: ${task.meetingNumber}`),
      "",
    ]),
    "## 3. Trace ClassTaskQuestion ke QuestionBank",
    "",
    "| taskId | classTaskQuestionId | questionId | Urutan | Task subject | Kelas | Meeting | Topic ClassTaskQuestion | Program QuestionBank | Subject QuestionBank | Topic QuestionBank | Lookup | Found |",
    "| --- | --- | --- | ---: | --- | --- | ---: | --- | --- | --- | --- | --- | --- |",
    ...output.traceRows.map((row) => `| ${clean(row.taskId)} | ${clean(row.classTaskQuestionId)} | ${clean(row.questionId)} | ${row.order} | ${clean(row.taskSubject)} | ${clean(row.className)} | ${row.meetingNumber} | ${clean(row.classTaskTopic)} | ${clean(row.bankProgram)} | ${clean(row.bankSubject)} | ${clean(row.bankTopic)} | ${clean(row.lookup)} | ${row.found ? "Ya" : "QUESTIONBANK_NOT_FOUND"} |`),
    "",
    "## 4. Pola Sumber Soal",
    "",
    ...output.sourceGroups.map((group) => `- ${clean(group.key)}: **${group.count}**`),
    "",
    `QuestionBank source yang tidak ditemukan pada sample: **${output.sourceNotFound.length}**. Untuk setiap ID yang tidak ditemukan, tidak dibuat soal pengganti.`,
    "",
    "## 5. Trace 20 Attempt Pola 10 ClassTaskQuestion + 20 QuestionBank",
    "",
    `Ditemukan **${output.partial.total}** attempt yang memenuhi pola sumber tersebut; ditampilkan maksimal 20 contoh.`,
    "",
    "| attemptId | studentId | taskId | 10 pertama ClassTaskQuestion | 20 tambahan QuestionBank | Status perbandingan | Subject sama | Topic sesuai meeting |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...output.partial.rows.map((row) => `| ${clean(row.attemptId)} | ${clean(row.studentId)} | ${clean(row.taskId)} | ${row.firstTenAllClassTaskQuestion ? "Ya" : "Tidak"} | ${row.additionalAllQuestionBank ? "Ya" : "Tidak"} | ${row.comparison} | ${row.extraSameSubject ? "Ya" : "Tidak"} | ${row.extraSameMeetingTopic ? "Ya" : "Tidak"} |`),
    "",
    "### Detail Question ID Tambahan",
    "",
    ...output.partial.rows.flatMap((row) => [
      `#### ${clean(row.attemptId)}`,
      "",
      `- 10 ID asli: ${row.firstTen.map((item) => `\`${item.questionId}\` (${item.source})`).join(", ")}`,
      `- 20 ID tambahan: ${row.additionalTwenty.map((item) => `\`${item.questionId}\` (${item.source}, program=${item.program || "-"}, subject=${item.subject || "-"}, topic=${item.topic || "-"}, correctAnswer=${item.correctAnswer || "-"})`).join(", ")}`,
      "",
    ]),
    "## 6. Guru Kelas SD",
    "",
    `QuestionBank dengan subject exact \"Guru Kelas SD\": **${output.guruKelasSD.count}**`,
    `- Program yang ditemukan: ${output.guruKelasSD.programs.join(", ") || "tidak ada"}`,
    "",
    "## 7. Seluruh Variasi Bahasa Indonesia",
    "",
    `Total soal yang subject-nya mengandung \"Bahasa Indonesia\": **${output.bahasaIndonesia.total}**`,
    "",
    "| Program | Subject | Jumlah |",
    "| --- | --- | ---: |",
    ...output.bahasaIndonesia.variations.map((item) => { const [program, subject] = item.key.split("|"); return `| ${clean(program)} | ${clean(subject)} | ${item.count} |`; }),
    "",
    "## 8. Kandidat Mapping Berdasarkan Bukti",
    "",
    "- Mapping tidak ditetapkan final.",
    "- Sumber langsung yang ditemukan harus menjadi dasar mapping; nama kelas saja tidak cukup.",
    "- `ClassTaskQuestion` yang tidak ditemukan di QuestionBank diberi status `QUESTIONBANK_NOT_FOUND`.",
    "- Pola 10 soal ClassTaskQuestion + 20 soal QuestionBank dianggap `LIKELY_VALID_MIGRATION_SOURCE` hanya jika subject dan topic tambahan konsisten; tanpa metadata migrasi tetap bukan bukti absolut.",
    "- Jika pola sumber campuran atau tidak konsisten, statusnya `MISMATCH` atau `UNCERTAIN`.",
    "",
    "## 9. Data Tidak Ditemukan dan Uncertain",
    "",
    `- ClassTaskQuestion tidak ditemukan di QuestionBank pada seluruh collection: **${output.allClassTaskQuestionNotFoundInQuestionBank}**`,
    `- Sample attempt pola parsial yang dianalisis: **${output.partial.rows.length}**`,
    "- Tidak ada jawaban atau mapping baru yang dibuat.",
    "",
    "## 10. Keamanan",
    "",
    "Script hanya memakai operasi baca MongoDB (`find`, `toArray`, dan pemrosesan memory) serta menulis laporan Markdown lokal. Tidak ada operasi mutasi database.",
  ];
  return `${lines.join("\n")}\n`;
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
