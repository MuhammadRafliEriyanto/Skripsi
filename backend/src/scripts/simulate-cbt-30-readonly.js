require("dotenv").config({ path: "backend/.env" });

const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const mongoose = require("mongoose");

const outputPath = path.resolve(__dirname, "../../..", "docs", "simulasi-migrasi-cbt-30-soal.md");
const jsonOutputPath = path.resolve(__dirname, "../../..", "docs", "simulasi-migrasi-cbt-30-soal.json");

function normalize(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function clean(value) {
  return String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
}

function countAnswers(attempt) {
  return Array.isArray(attempt.answers) ? attempt.answers.length : 0;
}

function taskLabels(task) {
  return [...new Set(
    [task?.program, task?.className, task?.canonicalClassName]
      .filter(Boolean)
      .map(String),
  )];
}

function number(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isAnswered(answer) {
  return answer?.isCorrect === true || answer?.isCorrect === false;
}

function taskProgramCandidates(task) {
  const className = normalize(task?.className);
  if (className === "smp 8") return [{ label: "SMP Kelas 7-9", approved: true }];
  if (className === "sma 10" || className === "sma 12") {
    return [
      { label: "SMA IPA", approved: false },
      { label: "SMA IPS", approved: false },
    ];
  }
  return [];
}

function topicMatches(topic, meetingNumber) {
  const meeting = Number(meetingNumber);
  if (!Number.isFinite(meeting) || meeting <= 0) return false;
  return normalize(topic).includes(`bab ${meeting}:`);
}

function hashNumber(seed) {
  return crypto.createHash("sha256").update(seed).digest().readUInt32BE(0);
}

function validQuestion(question) {
  const correct = String(question?.correctAnswer ?? "").trim().toUpperCase();
  const options = ["A", "B", "C", "D"].filter((key) => String(question?.[`option${key}`] ?? "").trim());
  return ["A", "B", "C", "D"].includes(correct) && options.includes(correct) && options.length >= 2;
}

function simulatedAnswer(question, shouldBeCorrect, seed) {
  const correct = String(question.correctAnswer).trim().toUpperCase();
  if (shouldBeCorrect) return { questionId: question.questionId, selectedAnswer: correct, isCorrect: true };
  const wrongOptions = ["A", "B", "C", "D"].filter((key) => key !== correct && String(question[`option${key}`] ?? "").trim());
  const selectedAnswer = wrongOptions[hashNumber(seed) % wrongOptions.length];
  return { questionId: question.questionId, selectedAnswer, isCorrect: false };
}

function scoreFor(correctCount) {
  return Math.round((correctCount / 30) * 10000) / 100;
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const [attempts, tasks, banks, classTaskQuestions] = await Promise.all([
    db.collection("studenttaskattempts").find({}).toArray(),
    db.collection("classtasks").find({}).toArray(),
    db.collection("questionbanks").find({}).toArray(),
    db.collection("classtaskquestions").find({}).toArray(),
  ]);
  const taskById = new Map(tasks.map((task) => [task.taskId, task]));
  const bankById = new Map(banks.map((question) => [question.questionId, question]));
  const classTaskById = new Map(classTaskQuestions.map((question) => [question.questionId, question]));
  const legacy = attempts.filter((attempt) => countAnswers(attempt) < 30);
  const partial30 = attempts.filter((attempt) => countAnswers(attempt) === 30 && (attempt.answers || []).some((answer) => !answer.selectedAnswer || answer.isCorrect === null));
  const distribution = { lessThan10: 0, exactly10: 0, exactly20: 0, exactly30: 0, greaterThan30: 0, other: 0 };
  for (const attempt of attempts) {
    const count = countAnswers(attempt);
    if (count < 10) distribution.lessThan10 += 1;
    else if (count === 10) distribution.exactly10 += 1;
    else if (count === 20) distribution.exactly20 += 1;
    else if (count === 30) distribution.exactly30 += 1;
    else if (count > 30) distribution.greaterThan30 += 1;
    else distribution.other += 1;
  }

  const exceptionReasons = {};
  const simulations = [];
  const examples = [];
  let simulatableAttemptScenarios = 0;
  let nonSimulatableAttempts = 0;
  let totalExceptions = 0;

  for (const attempt of legacy) {
    const task = taskById.get(attempt.taskId);
    const currentAnswers = Array.isArray(attempt.answers) ? attempt.answers : [];
    const oldCorrect = currentAnswers.filter((answer) => answer.isCorrect === true).length;
    const oldWrong = currentAnswers.filter((answer) => answer.isCorrect === false).length;
    const oldTotalAnswered = oldCorrect + oldWrong;
    const oldUnanswered = currentAnswers.length - oldTotalAnswered;
    const candidates = taskProgramCandidates(task);
    const base = {
      attemptId: attempt.attemptId,
      studentId: attempt.studentId,
      taskId: attempt.taskId,
      subject: task?.subject || null,
      className: task?.className || null,
      meetingNumber: task?.meetingNumber ?? null,
      currentQuestionCount: currentAnswers.length,
      additionalQuestions: Math.max(30 - currentAnswers.length, 0),
      oldCorrect,
      oldWrong,
      oldUnanswered,
      oldScore: attempt.score ?? null,
      remedial: number(attempt.remedialCount) > 0 || (attempt.history || []).length > 0,
      scenarios: [],
    };
    if (!task) {
      base.status = "exception";
      base.exception = "task tidak ditemukan";
      exceptionReasons[base.exception] = (exceptionReasons[base.exception] || 0) + 1;
      totalExceptions += 1;
      simulations.push(base);
      continue;
    }
    if (!candidates.length) {
      base.status = "exception";
      base.exception = "mapping program tidak tersedia/disetujui untuk simulasi";
      exceptionReasons[base.exception] = (exceptionReasons[base.exception] || 0) + 1;
      totalExceptions += 1;
      simulations.push(base);
      continue;
    }
    for (const candidate of candidates) {
      const currentIds = new Set(currentAnswers.map((answer) => answer.questionId));
      const programQuestions = banks.filter((question) => normalize(question.program) === normalize(candidate.label));
      const subjectQuestions = programQuestions.filter((question) => normalize(question.subject) === normalize(task.subject));
      const topicQuestions = subjectQuestions.filter((question) => topicMatches(question.topic, task.meetingNumber));
      const uniqueQuestions = topicQuestions.filter((question) => !currentIds.has(question.questionId));
      const required = base.additionalQuestions;
      const scenario = {
        mapping: candidate.label,
        mappingApproved: candidate.approved,
        availableByProgram: programQuestions.length,
        availableByProgramSubject: subjectQuestions.length,
        availableByProgramSubjectTopic: topicQuestions.length,
        availableUniqueAfterExclusion: uniqueQuestions.length,
        required,
        exampleQuestionIds: uniqueQuestions.slice(0, 5).map((question) => question.questionId),
        exampleTopics: [...new Set(uniqueQuestions.slice(0, 5).map((question) => question.topic))],
        topicMatchesMeeting: uniqueQuestions.slice(0, 5).every((question) => topicMatches(question.topic, task.meetingNumber)),
        status: "exception",
      };
      if (uniqueQuestions.length < required) {
        scenario.exception = "questionbank tidak cukup";
      } else if (oldTotalAnswered <= 0) {
        scenario.exception = "data attempt tidak memiliki jawaban benar/salah yang dapat diverifikasi";
      } else {
        const accuracy = oldCorrect / oldTotalAnswered;
        const targetCorrect = Math.round(accuracy * 30);
        const additionalCorrect = targetCorrect - oldCorrect;
        const additionalWrong = required - additionalCorrect;
        const selectedQuestions = uniqueQuestions.slice(0, required);
        const valid = selectedQuestions.every(validQuestion);
        scenario.accuracy = accuracy;
        scenario.targetCorrect = targetCorrect;
        scenario.targetWrong = 30 - targetCorrect;
        scenario.additionalCorrect = additionalCorrect;
        scenario.additionalWrong = additionalWrong;
        scenario.questionsValidated = selectedQuestions.length;
        if (additionalCorrect < 0 || additionalWrong < 0) {
          scenario.exception = "data attempt tidak konsisten dengan rumus target";
        } else if (!valid) {
          scenario.exception = "correctAnswer tidak tersedia atau options tidak valid";
        } else {
          const additionalAnswers = selectedQuestions.map((question, index) => simulatedAnswer(question, index < additionalCorrect, `${attempt.attemptId}|${candidate.label}|${question.questionId}`));
          scenario.simulatedAnswers = additionalAnswers;
          scenario.simulatedCorrect = oldCorrect + additionalAnswers.filter((answer) => answer.isCorrect).length;
          scenario.simulatedWrong = oldWrong + additionalAnswers.filter((answer) => answer.isCorrect === false).length;
          scenario.simulatedUnanswered = oldUnanswered;
          scenario.simulatedScore = scoreFor(scenario.simulatedCorrect);
          scenario.validationTotal = scenario.simulatedCorrect + scenario.simulatedWrong + scenario.simulatedUnanswered;
          scenario.status = "simulated";
          simulatableAttemptScenarios += 1;
        }
      }
      if (scenario.status !== "simulated") {
        nonSimulatableAttempts += 1;
        totalExceptions += 1;
        exceptionReasons[scenario.exception] = (exceptionReasons[scenario.exception] || 0) + 1;
      }
      base.scenarios.push(scenario);
    }
    base.status = base.scenarios.some((scenario) => scenario.status === "simulated") ? "simulated" : "exception";
    simulations.push(base);
    if (examples.length < 20) examples.push(base);
  }

  const partialAnalysis = partial30.map((attempt) => {
    const answers = Array.isArray(attempt.answers) ? attempt.answers : [];
    const sourceCounts = { classTaskQuestion: 0, questionBank: 0, missing: 0, other: 0 };
    const unresolved = [];
    for (const answer of answers) {
      if (classTaskById.has(answer.questionId)) sourceCounts.classTaskQuestion += 1;
      else if (bankById.has(answer.questionId)) sourceCounts.questionBank += 1;
      else { sourceCounts.missing += 1; unresolved.push(answer.questionId); }
    }
    const empty = answers.filter((answer) => !answer.selectedAnswer).length;
    const nullCorrect = answers.filter((answer) => answer.isCorrect === null).length;
    const identified = empty > 0 && sourceCounts.questionBank === empty && sourceCounts.missing === 0 && sourceCounts.classTaskQuestion > 0;
    return {
      attemptId: attempt.attemptId,
      studentId: attempt.studentId,
      taskId: attempt.taskId,
      questions: answers.length,
      completeAnswers: answers.filter(isAnswered).length,
      emptySelectedAnswer: empty,
      nullIsCorrect: nullCorrect,
      sourceCounts,
      migrationCandidate: identified ? "identified-by-source-but-not-explicitly-proven" : "uncertain",
      simulationPerformed: false,
      reason: identified ? "Tidak ada metadata/timestamp/backup migrasi eksplisit; tidak disimulasikan." : "Sumber soal asli/tambahan tidak dapat dipastikan.",
      unresolvedQuestionIds: unresolved,
    };
  });

  const output = {
    readOnly: true,
    generatedAt: new Date().toISOString(),
    database: { totalAttempts: attempts.length, questionbanks: banks.length, classTaskQuestions: classTaskQuestions.length, tasks: tasks.length },
    distribution,
    targetAttempts: legacy.length,
    partial30: { total: partial30.length, complete: partialAnalysis.filter((item) => item.completeAnswers === 30).length, emptySelectedAnswer: partialAnalysis.filter((item) => item.emptySelectedAnswer > 0).length, nullIsCorrect: partialAnalysis.filter((item) => item.nullIsCorrect > 0).length, probablePartial: partialAnalysis.filter((item) => item.migrationCandidate !== "uncertain").length, simulationPerformed: 0 },
    taskClassValues: [...new Set(targetTaskIds(legacy, taskById).flatMap(taskLabels))].sort(),
    questionBankPrograms: [...new Set(banks.map((question) => question.program).filter(Boolean))].sort(),
    mappingPolicy: { smp8: "SMP Kelas 7-9", sma10And12: ["SMA IPA", "SMA IPS"], finalSmaMappingChosen: false },
    simulatableAttemptScenarios,
    nonSimulatableAttemptScenarios: nonSimulatableAttempts,
    totalExceptions,
    exceptionReasons,
    examples,
    simulations,
    partialAnalysis,
  };

  const md = buildMarkdown(output);
  await fs.writeFile(outputPath, md, "utf8");
  await fs.writeFile(jsonOutputPath, JSON.stringify(output, null, 2), "utf8");
  console.log(JSON.stringify({ outputPath, jsonOutputPath, totalAttempts: attempts.length, targetAttempts: legacy.length, distribution, partial30: output.partial30, simulatableAttemptScenarios, totalExceptions }, null, 2));
  await mongoose.disconnect();
}

function targetTaskIds(legacy, taskById) {
  return [...new Set(legacy.map((attempt) => taskById.get(attempt.taskId)).filter(Boolean))];
}

function buildMarkdown(output) {
  const lines = [
    "# Simulasi Migrasi CBT 30 Soal (Read-Only)",
    "",
    `Generated: ${output.generatedAt}`,
    "",
    "> READ-ONLY: tidak ada update, insert, delete, pembuatan data simulasi di MongoDB, atau perubahan attempt/score.",
    "",
    "## Ringkasan Database",
    "",
    `- Total attempt: **${output.database.totalAttempts}**`,
    `- QuestionBank: **${output.database.questionbanks}**`,
    `- ClassTaskQuestion: **${output.database.classTaskQuestions}**`,
    `- Task: **${output.database.tasks}**`,
    `- Target attempt kurang dari 30: **${output.targetAttempts}**`,
    `- Distribusi: <10 = **${output.distribution.lessThan10}**, 10 = **${output.distribution.exactly10}**, 20 = **${output.distribution.exactly20}**, 30 = **${output.distribution.exactly30}**, >30 = **${output.distribution.greaterThan30}**`,
    `- Nilai program QuestionBank: ${output.questionBankPrograms.map((value) => `\`${value}\``).join(", ")}`,
    `- Nilai kelas task target: ${output.taskClassValues.map((value) => `\`${value}\``).join(", ") || "-"}`,
    "",
    "## Struktur Attempt Aktual",
    "",
    "`studenttaskattempts` memakai `attemptId`, `studentId`, `taskId`, `answers[]`, `correctCount`, `wrongCount`, `unansweredCount`, `score`, `startedAt`, `submittedAt`, `createdAt`, `updatedAt`, `remedialCount`, `remedialReason`, dan `history[]`. Setiap elemen `answers[]` memakai `questionId`, `selectedAnswer`, dan `isCorrect`.",
    "",
    "`classtasks` menyediakan `className`, `canonicalClassName`, `subject`, dan `meetingNumber`. `questionbanks` menyediakan `program`, `subject`, `topic`, `questionId`, `questionText`, `optionA-D`, `correctAnswer`, dan `explanation`. Tidak tersedia `meetingNumber` atau `chapter` sebagai field terpisah di QuestionBank.",
    "",
    "## Kebijakan Simulasi Mapping",
    "",
    "- `SMP 8` hanya disimulasikan dengan kandidat `SMP Kelas 7-9`.",
    "- `SMA 10` dan `SMA 12` dibuat dalam dua skenario terpisah: `SMA IPA` dan `SMA IPS`.",
    "- Tidak ada kandidat SMA yang dipilih sebagai pemenang.",
    "- Soal dari program lain tidak digunakan.",
    "",
    "## Hasil Simulasi Attempt <30",
    "",
    `- Skenario yang dapat disimulasikan: **${output.simulatableAttemptScenarios}**`,
    `- Skenario yang tidak dapat disimulasikan: **${output.nonSimulatableAttemptScenarios}**`,
    `- Total exception: **${output.totalExceptions}**`,
    ...Object.entries(output.exceptionReasons).map(([reason, count]) => `- ${reason}: **${count}**`),
    "",
    "## Contoh 20 Attempt",
    "",
    "Setiap skenario tetap terpisah. `simulatedAnswers` hanya berada di file laporan JSON, tidak ditulis ke database.",
    "",
  ];
  for (const item of output.examples) {
    lines.push(`### ${clean(item.attemptId)}`);
    lines.push("");
    lines.push(`- Student: \`${clean(item.studentId)}\``);
    lines.push(`- Task: \`${clean(item.taskId)}\``);
    lines.push(`- Kelas/subject: **${clean(item.className || "-")} / ${clean(item.subject || "-")}**`);
    lines.push(`- Meeting: **${item.meetingNumber ?? "-"}**`);
    lines.push(`- Remedial: **${item.remedial ? "Ya" : "Tidak"}**`);
    lines.push(`- Awal: **${item.currentQuestionCount} soal**, ${item.oldCorrect} benar, ${item.oldWrong} salah, ${item.oldUnanswered} kosong, score lama **${item.oldScore ?? "-"}**`);
    for (const scenario of item.scenarios) {
      lines.push(`- Kandidat **${scenario.mapping}**: ${scenario.status}${scenario.exception ? ` (${scenario.exception})` : ""}; tersedia ${scenario.availableUniqueAfterExclusion} unik, butuh ${scenario.required}.`);
      if (scenario.status === "simulated") lines.push(`  - Simulasi: tambahan ${scenario.additionalCorrect} benar + ${scenario.additionalWrong} salah; total ${scenario.simulatedCorrect} benar, ${scenario.simulatedWrong} salah, ${scenario.simulatedUnanswered} kosong; score **${scenario.simulatedScore}**.`);
      lines.push(`  - Contoh questionId: ${scenario.exampleQuestionIds.map((value) => `\`${value}\``).join(", ") || "-"}`);
    }
    lines.push("");
  }
  lines.push("## Attempt 30 Soal", "", `- Total 30 soal: **${output.partial30.total}**`, `- Jawaban lengkap: **${output.partial30.complete}**`, `- Memiliki selectedAnswer kosong: **${output.partial30.emptySelectedAnswer}**`, `- Memiliki isCorrect null: **${output.partial30.nullIsCorrect}**`, `- Kemungkinan hasil migrasi parsial berdasarkan sumber questionId: **${output.partial30.probablePartial}**`, "- Simulasi jawaban untuk kelompok ini: **0** karena tidak ada penanda migrasi eksplisit yang cukup kuat.", "", "Soal kosong yang seluruhnya berasal dari QuestionBank dan berdampingan dengan soal ClassTaskQuestion diberi status kandidat migrasi, tetapi tetap `uncertain` secara historis karena tidak ada metadata migrasi, timestamp penambahan, atau backup kondisi sebelum migrasi.", "");
  lines.push("## Perbandingan SMA IPA vs SMA IPS", "", "| Class | Subject | Candidate | Available | Subject Match | Topic Match | Unique | Required | Status |", "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |");
  const smaPairs = output.simulations.filter((item) => item.className === "SMA 10" || item.className === "SMA 12");
  const seen = new Set();
  for (const item of smaPairs) for (const scenario of item.scenarios) {
    const key = `${item.className}|${item.subject}|${scenario.mapping}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(`| ${clean(item.className)} | ${clean(item.subject)} | ${scenario.mapping} | ${scenario.availableByProgram} | ${scenario.availableByProgramSubject} | ${scenario.availableByProgramSubjectTopic} | ${scenario.availableUniqueAfterExclusion} | ${scenario.required} | ${scenario.status}${scenario.exception ? `: ${scenario.exception}` : ""} |`);
  }
  lines.push("", "## Exception dan Keamanan", "", ...Object.entries(output.exceptionReasons).map(([reason, count]) => `- ${reason}: **${count}**`), "", "Tidak ada operasi database mutasi pada simulasi ini. Tidak ada jawaban, score, correctCount, wrongCount, unansweredCount, questionbank, atau attempt yang diubah.", "", "## Rekomendasi", "", "1. Jangan menetapkan mapping final SMA 10/SMA 12 dari hasil jumlah kandidat.", "2. Minta referensi akademik eksplisit untuk mapping kelas SMA ke program QuestionBank.", "3. Setelah mapping disetujui, pilih topic `Bab {meetingNumber}:` lalu kecualikan `questionId` lama.", "4. Validasi `correctAnswer` dan option A-D sebelum simulasi atau migrasi.", "5. Jangan mengubah attempt 30 soal yang status sumber soal tambahannya masih uncertain.");
  return `${lines.join("\n")}\n`;
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
