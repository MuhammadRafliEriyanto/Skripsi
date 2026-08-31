require("dotenv").config({ path: "backend/.env" });

const fs = require("node:fs/promises");
const path = require("node:path");
const mongoose = require("mongoose");

const outputPath = path.resolve(__dirname, "../../..", "docs", "audit-subject-questionbank-cbt.md");

function normalize(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function displayNormalize(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function clean(value) {
  return String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
}

function answerCount(attempt) {
  return Array.isArray(attempt.answers) ? attempt.answers.length : 0;
}

function isAnswered(answer) {
  return answer?.isCorrect === true || answer?.isCorrect === false;
}

function topicMatches(topic, meetingNumber) {
  const meeting = Number(meetingNumber);
  if (!Number.isFinite(meeting) || meeting <= 0) return false;
  const value = displayNormalize(topic).toLowerCase();
  return value.startsWith(`bab ${meeting}:`) || value.startsWith(`bab ${meeting} `) || value === `bab ${meeting}`;
}

function taskLabels(task) {
  return [...new Set([task?.program, task?.className, task?.canonicalClassName].filter(Boolean).map(displayNormalize))];
}

function subjectCandidateReason(taskSubject, bankSubject) {
  const taskValue = displayNormalize(taskSubject);
  const bankValue = displayNormalize(bankSubject);
  const taskNormalized = normalize(taskValue);
  const bankNormalized = normalize(bankValue);
  if (taskNormalized === bankNormalized) return "exact setelah trim/case/punctuation";
  if (taskNormalized.includes(bankNormalized) || bankNormalized.includes(taskNormalized)) return "satu nama menjadi bagian nama lainnya setelah normalisasi";
  const taskTokens = new Set(taskValue.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  const bankTokens = new Set(bankValue.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  const overlap = [...taskTokens].filter((token) => bankTokens.has(token));
  if (overlap.length) return `berbagi token: ${overlap.join(", ")}`;
  return null;
}

function bankSubjectSummary(banks) {
  const map = new Map();
  for (const question of banks) {
    const program = displayNormalize(question.program) || "(kosong)";
    const subject = displayNormalize(question.subject) || "(kosong)";
    const topic = displayNormalize(question.topic) || "(kosong)";
    const key = `${program}|${subject}|${topic}`;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()].map(([key, count]) => {
    const [program, subject, topic] = key.split("|");
    return { program, subject, topic, count };
  }).sort((a, b) => `${a.program}|${a.subject}|${a.topic}`.localeCompare(`${b.program}|${b.subject}|${b.topic}`));
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const [attempts, tasks, banks, classTaskQuestions] = await Promise.all([
    db.collection("studenttaskattempts").find({}).toArray(),
    db.collection("classtasks").find({}).toArray(),
    db.collection("questionbanks").find({}).toArray(),
    db.collection("classtaskquestions").find({}).project({ questionId: 1, taskId: 1 }).toArray(),
  ]);
  const taskById = new Map(tasks.map((task) => [task.taskId, task]));
  const bankById = new Map(banks.map((question) => [question.questionId, question]));
  const classTaskById = new Map(classTaskQuestions.map((question) => [question.questionId, question]));
  const targetAttempts = attempts.filter((attempt) => answerCount(attempt) < 30);
  const attempts30Partial = attempts.filter((attempt) => answerCount(attempt) === 30 && (attempt.answers || []).some((answer) => !answer.selectedAnswer || answer.isCorrect === null));
  const distribution = { lessThan10: 0, exactly10: 0, exactly20: 0, exactly30: 0, greaterThan30: 0, other: 0 };
  for (const attempt of attempts) {
    const count = answerCount(attempt);
    if (count < 10) distribution.lessThan10 += 1;
    else if (count === 10) distribution.exactly10 += 1;
    else if (count === 20) distribution.exactly20 += 1;
    else if (count === 30) distribution.exactly30 += 1;
    else if (count > 30) distribution.greaterThan30 += 1;
    else distribution.other += 1;
  }

  const targetTasks = [...new Set(targetAttempts.map((attempt) => taskById.get(attempt.taskId)).filter(Boolean))];
  const targetTaskCombinations = new Map();
  for (const attempt of targetAttempts) {
    const task = taskById.get(attempt.taskId);
    const key = task ? `${task.taskId}|${task.className}|${task.subject}|${task.meetingNumber}` : `${attempt.taskId}|(task tidak ditemukan)`;
    const current = targetTaskCombinations.get(key) || { taskId: task?.taskId || attempt.taskId, className: task?.className || "-", canonicalClassName: task?.canonicalClassName || "-", subject: task?.subject || "-", meetingNumber: task?.meetingNumber ?? "-", attempts: 0 };
    current.attempts += 1;
    targetTaskCombinations.set(key, current);
  }

  const bankPrograms = [...new Set(banks.map((question) => displayNormalize(question.program)).filter(Boolean))].sort();
  const bankSubjects = [...new Set(banks.map((question) => displayNormalize(question.subject)).filter(Boolean))].sort();
  const bankSummary = bankSubjectSummary(banks);
  const taskSubjects = [...new Set(targetTasks.map((task) => displayNormalize(task.subject)).filter(Boolean))].sort();
  const subjectComparisons = taskSubjects.map((taskSubject) => ({
    taskSubject,
    exact: bankSubjects.filter((bankSubject) => normalize(bankSubject) === normalize(taskSubject)),
    candidates: bankSubjects.map((bankSubject) => ({ subject: bankSubject, reason: subjectCandidateReason(taskSubject, bankSubject) })).filter((item) => item.reason),
  }));

  const classCandidatePolicy = {
    "SMP 8": ["SMP Kelas 7-9"],
    "SMA 10": ["SMA IPA", "SMA IPS"],
    "SMA 12": ["SMA IPA", "SMA IPS"],
  };
  const mappingAnalysis = [];
  for (const [taskClass, candidatePrograms] of Object.entries(classCandidatePolicy)) {
    const classTasks = targetTasks.filter((task) => displayNormalize(task.className) === taskClass);
    const taskSubjectSet = [...new Set(classTasks.map((task) => displayNormalize(task.subject)).filter(Boolean))];
    for (const candidateProgram of candidatePrograms) {
      const programBanks = banks.filter((question) => normalize(question.program) === normalize(candidateProgram));
      const subjectMatches = taskSubjectSet.filter((subject) => programBanks.some((question) => normalize(question.subject) === normalize(subject)));
      const subjectMismatches = taskSubjectSet.filter((subject) => !subjectMatches.includes(subject));
      const taskPairs = classTasks.map((task) => {
        const subjectBanks = programBanks.filter((question) => normalize(question.subject) === normalize(task.subject));
        const topicBanks = subjectBanks.filter((question) => topicMatches(question.topic, task.meetingNumber));
        return { task, subjectBanks, topicBanks };
      });
      mappingAnalysis.push({
        taskClass,
        candidateProgram,
        targetTaskCount: classTasks.length,
        taskSubjects: taskSubjectSet,
        subjectMatchCount: subjectMatches.length,
        subjectMismatchCount: subjectMismatches.length,
        subjectMatches,
        subjectMismatches,
        topicMatchCount: taskPairs.filter((pair) => pair.topicBanks.length > 0).length,
        topicMismatchCount: taskPairs.filter((pair) => pair.topicBanks.length === 0).length,
        availableQuestions: programBanks.length,
        availableSubjectQuestions: taskPairs.reduce((sum, pair) => sum + pair.subjectBanks.length, 0),
        availableTopicQuestions: taskPairs.reduce((sum, pair) => sum + pair.topicBanks.length, 0),
        usableUniqueForTargets: targetAttempts.filter((attempt) => displayNormalize(taskById.get(attempt.taskId)?.className) === taskClass).reduce((sum, attempt) => {
          const task = taskById.get(attempt.taskId);
          if (!task) return sum;
          const existing = new Set((attempt.answers || []).map((answer) => answer.questionId));
          return sum + banks.filter((question) => normalize(question.program) === normalize(candidateProgram) && normalize(question.subject) === normalize(task.subject) && topicMatches(question.topic, task.meetingNumber) && !existing.has(question.questionId)).length;
        }, 0),
      });
    }
  }

  const targetRows = [];
  for (const attempt of targetAttempts) {
    const task = taskById.get(attempt.taskId);
    const currentAnswers = Array.isArray(attempt.answers) ? attempt.answers : [];
    const candidatePrograms = classCandidatePolicy[displayNormalize(task?.className)] || [];
    const candidateResults = candidatePrograms.map((program) => {
      const existing = new Set(currentAnswers.map((answer) => answer.questionId));
      const programSubject = banks.filter((question) => normalize(question.program) === normalize(program) && normalize(question.subject) === normalize(task?.subject));
      const topic = programSubject.filter((question) => topicMatches(question.topic, task?.meetingNumber));
      const unique = topic.filter((question) => !existing.has(question.questionId));
      return { program, available: banks.filter((question) => normalize(question.program) === normalize(program)).length, subjectMatch: programSubject.length, topicMatch: topic.length, uniqueAfterExclude: unique.length, exampleIds: unique.slice(0, 5).map((question) => question.questionId), exampleTopics: [...new Set(unique.slice(0, 5).map((question) => question.topic))] };
    });
    targetRows.push({
      attemptId: attempt.attemptId,
      studentId: attempt.studentId,
      taskId: attempt.taskId,
      className: task?.className || "-",
      subject: task?.subject || "-",
      meetingNumber: task?.meetingNumber ?? "-",
      currentQuestions: currentAnswers.length,
      additionalRequired: Math.max(30 - currentAnswers.length, 0),
      candidateResults,
    });
  }

  const partialPatterns = { original10ClassTaskThen20BankEmpty: 0, allThirtyClassTaskQuestion: 0, allThirtyQuestionBank: 0, mixedOrOther: 0, uncertain: 0 };
  const partialRows = attempts30Partial.map((attempt) => {
    const answers = attempt.answers || [];
    const sources = answers.map((answer) => classTaskById.has(answer.questionId) ? "ClassTaskQuestion" : bankById.has(answer.questionId) ? "QuestionBank" : "unknown");
    const emptyIndexes = answers.map((answer, index) => (!answer.selectedAnswer || answer.isCorrect === null) ? index : -1).filter((index) => index >= 0);
    const firstTenOriginal = sources.slice(0, 10).every((source) => source === "ClassTaskQuestion");
    const lastTwentyBankEmpty = sources.slice(10).every((source) => source === "QuestionBank") && answers.slice(10).every((answer) => !answer.selectedAnswer && answer.isCorrect === null);
    const identifiedPattern = firstTenOriginal && lastTwentyBankEmpty;
    if (identifiedPattern) partialPatterns.original10ClassTaskThen20BankEmpty += 1;
    else if (sources.every((source) => source === "ClassTaskQuestion")) partialPatterns.allThirtyClassTaskQuestion += 1;
    else if (sources.every((source) => source === "QuestionBank")) partialPatterns.allThirtyQuestionBank += 1;
    else if (sources.some((source) => source === "unknown")) partialPatterns.uncertain += 1;
    else partialPatterns.mixedOrOther += 1;
    return { attemptId: attempt.attemptId, studentId: attempt.studentId, taskId: attempt.taskId, sourceFirst10: sources.slice(0, 10).join(","), sourceLast20: sources.slice(10).join(","), emptyAnswerCount: answers.filter((answer) => !answer.selectedAnswer).length, nullIsCorrectCount: answers.filter((answer) => answer.isCorrect === null).length, completeAnswerCount: answers.filter(isAnswered).length, identifiedPattern, status: identifiedPattern ? "identified-by-structure-but-not-explicit-metadata" : "uncertain", emptyIndexes: emptyIndexes.slice(0, 30) };
  });

  const output = { generatedAt: new Date().toISOString(), readOnly: true, database: { attempts: attempts.length, tasks: tasks.length, questionbanks: banks.length, classTaskQuestions: classTaskQuestions.length }, distribution, targetAttempts: targetAttempts.length, targetTaskCombinations: [...targetTaskCombinations.values()], taskClassValues: [...new Set(targetTasks.flatMap(taskLabels))].sort(), bankPrograms, bankSubjects, subjectComparisons, bankSummary, mappingAnalysis, targetRows, partial30: { total: attempts30Partial.length, complete: attempts30Partial.filter((attempt) => (attempt.answers || []).every(isAnswered)).length, emptySelectedAnswer: attempts30Partial.filter((attempt) => (attempt.answers || []).some((answer) => !answer.selectedAnswer)).length, nullIsCorrect: attempts30Partial.filter((attempt) => (attempt.answers || []).some((answer) => answer.isCorrect === null)).length, patterns: partialPatterns, rows: partialRows }, fieldExamples: { task: targetTasks[0] || null, questionbank: banks[0] || null } };
  await fs.writeFile(outputPath, buildMarkdown(output), "utf8");
  console.log(JSON.stringify({ outputPath, database: output.database, distribution, targetAttempts: output.targetAttempts, bankPrograms, bankSubjects, mappingAnalysis, partial30: { total: output.partial30.total, patterns: partialPatterns } }, null, 2));
  await mongoose.disconnect();
}

function buildMarkdown(output) {
  const lines = [
    "# Audit Subject dan QuestionBank CBT (Read-Only)",
    "",
    `Generated: ${output.generatedAt}`,
    "",
    "> READ-ONLY: tidak ada update, insert, delete, perubahan attempt, jawaban, nilai, atau QuestionBank.",
    "",
    "## Ringkasan Database",
    "",
    `- Total attempt: **${output.database.attempts}**`,
    `- Total task: **${output.database.tasks}**`,
    `- Total QuestionBank: **${output.database.questionbanks}**`,
    `- Total ClassTaskQuestion: **${output.database.classTaskQuestions}**`,
    `- Target attempt kurang dari 30: **${output.targetAttempts}**`,
    `- Distribusi: <10 = ${output.distribution.lessThan10}, 10 = ${output.distribution.exactly10}, 20 = ${output.distribution.exactly20}, 30 = ${output.distribution.exactly30}, >30 = ${output.distribution.greaterThan30}, lainnya = ${output.distribution.other}`,
    "",
    "## 1. Seluruh Kombinasi Subject Task Target",
    "",
    "| taskId | className | canonicalClassName | subject | meetingNumber | jumlah attempt |",
    "| --- | --- | --- | --- | ---: | ---: |",
    ...output.targetTaskCombinations.map((row) => `| ${clean(row.taskId)} | ${clean(row.className)} | ${clean(row.canonicalClassName)} | ${clean(row.subject)} | ${row.meetingNumber} | ${row.attempts} |`),
    "",
    "## 2. Seluruh Program, Subject, dan Topic QuestionBank",
    "",
    "| program | subject | topic/bab | jumlah soal |",
    "| --- | --- | --- | ---: |",
    ...output.bankSummary.map((row) => `| ${clean(row.program)} | ${clean(row.subject)} | ${clean(row.topic)} | ${row.count} |`),
    "",
    "## 3. Perbandingan Subject Task dengan QuestionBank",
    "",
    ...output.subjectComparisons.map((comparison) => [
      `### Task Subject: ${comparison.taskSubject}`,
      "",
      `- Exact match: ${comparison.exact.length ? comparison.exact.join(", ") : "tidak ada"}`,
      `- Kandidat nama yang mirip, bukan mapping final: ${comparison.candidates.length ? comparison.candidates.map((candidate) => `${candidate.subject} (${candidate.reason})`).join("; ") : "tidak ada"}`,
      "",
    ]).flat(),
    "## 4. Field Aktual",
    "",
    "### Task",
    "",
    "Field yang digunakan: `taskId`, `className`, `canonicalClassName`, `subject`, `meetingNumber`, `questionCount`.",
    "",
    "### QuestionBank",
    "",
    "Field yang digunakan: `program`, `subject`, `topic`, `questionId`, `questionText`, `optionA`, `optionB`, `optionC`, `optionD`, `correctAnswer`, `explanation`.",
    "",
    `Contoh task aktual: \`${JSON.stringify({ taskId: output.fieldExamples.task?.taskId, className: output.fieldExamples.task?.className, canonicalClassName: output.fieldExamples.task?.canonicalClassName, subject: output.fieldExamples.task?.subject, meetingNumber: output.fieldExamples.task?.meetingNumber })}\``,
    `Contoh QuestionBank aktual: \`${JSON.stringify({ program: output.fieldExamples.questionbank?.program, subject: output.fieldExamples.questionbank?.subject, topic: output.fieldExamples.questionbank?.topic, questionId: output.fieldExamples.questionbank?.questionId, questionText: output.fieldExamples.questionbank?.questionText, optionA: output.fieldExamples.questionbank?.optionA, optionB: output.fieldExamples.questionbank?.optionB, optionC: output.fieldExamples.questionbank?.optionC, optionD: output.fieldExamples.questionbank?.optionD, correctAnswer: output.fieldExamples.questionbank?.correctAnswer })}\``,
    "",
    "## 5. Analisis Kandidat Mapping Program",
    "",
    "Tidak ada mapping final yang ditetapkan.",
    "",
    "| Class task | Kandidat program | Subject match | Subject tidak match | Topic match | Topic tidak match | Semua soal program | Soal program+subject | Soal program+subject+topic |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...output.mappingAnalysis.map((row) => `| ${row.taskClass} | ${row.candidateProgram} | ${row.subjectMatchCount} | ${row.subjectMismatchCount} | ${row.topicMatchCount} | ${row.topicMismatchCount} | ${row.availableQuestions} | ${row.availableSubjectQuestions} | ${row.availableTopicQuestions} |`),
    "",
    "## 6. Audit Meeting dan Topic",
    "",
    "QuestionBank tidak memiliki field `meetingNumber` atau `chapter` terpisah. Meeting task hanya dapat dibandingkan dengan teks pada `topic`.",
    "",
    "Format topic yang dipakai adalah `Bab N: Topik Pembahasan N`. Pemeriksaan `Bab {meetingNumber}:` dilakukan sebagai prioritas, bukan asumsi field terpisah.",
    "",
    "## 7. Simulasi Read-Only Attempt <30",
    "",
    "Tidak ada jawaban yang dibuat. Tabel berikut hanya menunjukkan kandidat soal, jumlah tersedia, dan ID contoh.",
    "",
    "| attemptId | studentId | taskId | class | subject | meeting | saat ini | butuh | kandidat (available/subject/topic/unique) |",
    "| --- | --- | --- | --- | --- | ---: | ---: | ---: | --- |",
    ...output.targetRows.slice(0, 20).map((row) => `| ${clean(row.attemptId)} | ${clean(row.studentId)} | ${clean(row.taskId)} | ${clean(row.className)} | ${clean(row.subject)} | ${row.meetingNumber} | ${row.currentQuestions} | ${row.additionalRequired} | ${row.candidateResults.map((candidate) => `${candidate.program} (${candidate.available}/${candidate.subjectMatch}/${candidate.topicMatch}/${candidate.uniqueAfterExclude}; ID: ${candidate.exampleIds.join(", ") || "-"})`).join("; ") || "tidak ada kandidat"} |`),
    "",
    "## 8. Analisis 3.465 Attempt 30 Soal",
    "",
    `- Total 30 soal: **${output.partial30.total}**`,
    `- Jawaban lengkap: **${output.partial30.complete}**`,
    `- Memiliki selectedAnswer kosong: **${output.partial30.emptySelectedAnswer}**`,
    `- Memiliki isCorrect null: **${output.partial30.nullIsCorrect}**`,
    `- Pola 10 ClassTaskQuestion + 20 QuestionBank kosong/null: **${output.partial30.patterns.original10ClassTaskThen20BankEmpty}**`,
    `- Pola seluruhnya ClassTaskQuestion: **${output.partial30.patterns.allThirtyClassTaskQuestion}**`,
    `- Pola seluruhnya QuestionBank: **${output.partial30.patterns.allThirtyQuestionBank}**`,
    `- Pola campuran/other: **${output.partial30.patterns.mixedOrOther}**`,
    `- Uncertain: **${output.partial30.patterns.mixedOrOther + output.partial30.patterns.uncertain}**`,
    "",
    "Pola `10 ClassTaskQuestion + 20 QuestionBank kosong/null` adalah bukti struktur kuat, tetapi bukan bukti metadata migrasi eksplisit. Tidak ada simulasi jawaban dilakukan untuk attempt 30 soal.",
    "",
    "## 9. Daftar Masalah Data",
    "",
    "- Task memakai kelas individual, sedangkan QuestionBank memakai label program agregat.",
    "- Task tidak memiliki field `program` langsung.",
    "- QuestionBank tidak memiliki field `meetingNumber` atau `chapter` terpisah.",
    "- Sebagian subject task tidak memiliki exact match di QuestionBank kandidatnya.",
    "- Tidak ada metadata eksplisit yang menandai soal hasil migrasi parsial.",
    "",
    "## 10. Rekomendasi Mapping Berbasis Bukti",
    "",
    "- `SMP 8` hanya boleh menggunakan `SMP Kelas 7-9` setelah subject task benar-benar match.",
    "- `SMA 10` dan `SMA 12` tetap memiliki dua kandidat terpisah: `SMA IPA` dan `SMA IPS`; laporan ini tidak memilih salah satunya.",
    "- Gunakan exact `subject` setelah trim/case/punctuation normalization; jangan menggunakan kandidat mirip sebagai mapping final.",
    "- Gunakan `topic` prefix `Bab {meetingNumber}:` hanya jika jumlah dan formatnya cocok.",
    "- Jika kandidat subject/topic tidak ada, masukkan exception dan jangan mengambil soal dari program lain.",
    "- Mapping final SMA membutuhkan referensi akademik atau field program yang eksplisit.",
    "",
    "## Keamanan",
    "",
    "Audit ini hanya melakukan pembacaan collection dan penulisan file laporan lokal. Tidak ada operasi mutasi database dan tidak ada migrasi dijalankan.",
  ];
  return `${lines.join("\n")}\n`;
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
