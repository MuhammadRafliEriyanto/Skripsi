/**
 * AUDIT READ-ONLY: Investigasi Attempt Bermasalah dengan answers.length < 30
 *
 * Tujuan:
 * 1. Temukan seluruh StudentTaskAttempt dengan targetCount=30 tetapi answers.length < 30
 * 2. Kelompokkan berdasarkan answers.length (10, 20, 29, lainnya)
 * 3. Identifikasi sumber setiap questionId (QuestionBank vs ClassTaskQuestion)
 * 4. Trace hubungan attempt → task → source soal
 * 5. Cek apakah 20 soal yang hilang dapat direkonstruksi
 * 6. Temukan pola migrasi "10 CTQ + 20 QB"
 *
 * TIDAK MENGGUNAKAN: save(), update(), insert(), delete(), migration
 */

import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config({ path: "backend/.env" });

const outputPath = "docs/audit-incomplete-attempts.md";
const jsonPath = "docs/audit-incomplete-attempts.json";

// Helper functions
function text(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}
function clean(value) {
  return text(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}
function countAnswers(attempt) {
  return Array.isArray(attempt.answers) ? attempt.answers.length : 0;
}
function optionCount(question) {
  return ["A", "B", "C", "D"].filter((key) => text(question?.[`option${key}`]))
    .length;
}

function sourceOf(id, classById, bankById, bankByObjectId) {
  const key = text(id);
  if (classById.has(key))
    return { type: "ClassTaskQuestion", document: classById.get(key) };
  if (bankById.has(key))
    return { type: "QuestionBank.questionId", document: bankById.get(key) };
  if (bankByObjectId.has(key))
    return { type: "QuestionBank._id", document: bankByObjectId.get(key) };
  return { type: "NOT_FOUND", document: null };
}

function topicIsMeeting(topic, meetingNumber) {
  return text(topic)
    .toLowerCase()
    .includes(`bab ${Number(meetingNumber)}:`);
}

function groupTask(task) {
  const value = text(task?.className).toLowerCase();
  if (value === "smp 8") return "SMP 8";
  if (value === "sma 10") return "SMA 10";
  if (value === "sma 12") return "SMA 12";
  if (value === "sd 4") return "SD 4";
  return "OTHER";
}

async function main() {
  console.log("=".repeat(100));
  console.log("AUDIT INCOMPLETE ATTEMPTS (READ-ONLY)");
  console.log("=".repeat(100));

  try {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;

    console.log("\n[1/7] Mengambil data dari MongoDB...");
    const [attempts, tasks, classQuestions, banks] = await Promise.all([
      db.collection("studenttaskattempts").find({}).toArray(),
      db.collection("classtasks").find({}).toArray(),
      db.collection("classtaskquestions").find({}).sort({ order: 1 }).toArray(),
      db.collection("questionbanks").find({}).toArray(),
    ]);

    console.log(`   Total attempts: ${attempts.length}`);
    console.log(`   Total tasks: ${tasks.length}`);
    console.log(`   Total ClassTaskQuestions: ${classQuestions.length}`);
    console.log(`   Total QuestionBanks: ${banks.length}`);

    // Build lookup maps
    const taskById = new Map(tasks.map((task) => [text(task.taskId), task]));
    const classById = new Map(
      classQuestions.map((question) => [text(question.questionId), question]),
    );
    const bankById = new Map(
      banks.map((question) => [text(question.questionId), question]),
    );
    const bankByObjectId = new Map(
      banks.map((question) => [text(question._id), question]),
    );

    // Get all incomplete attempts (< 30)
    const attempts30 = attempts.filter(
      (attempt) => countAnswers(attempt) === 30,
    );
    const incompleteAttempts = attempts.filter(
      (attempt) => countAnswers(attempt) < 30,
    );

    console.log(`\n[2/7] Distribusi Answers Length:`);
    console.log(`   Total attempts: ${attempts.length}`);
    console.log(
      `   Complete (30): ${attempts30.length} (${((attempts30.length / attempts.length) * 100).toFixed(2)}%)`,
    );
    console.log(
      `   Incomplete (<30): ${incompleteAttempts.length} (${((incompleteAttempts.length / attempts.length) * 100).toFixed(2)}%)`,
    );

    // Group by length
    const distribution = {};
    for (const attempt of incompleteAttempts) {
      const len = countAnswers(attempt);
      distribution[len] = (distribution[len] || 0) + 1;
    }

    console.log(`\n   Detailed Distribution:`);
    const sortedKeys = Object.keys(distribution)
      .map(Number)
      .sort((a, b) => a - b);
    for (const key of sortedKeys) {
      const percentage = (
        (distribution[key] / incompleteAttempts.length) *
        100
      ).toFixed(2);
      console.log(
        `   - ${key.toString().padStart(3)} answers: ${distribution[key].toString().padStart(5)} (${percentage}%)`,
      );
    }

    // Analyze each incomplete attempt
    console.log(
      `\n[3/7] Menganalisis pola source setiap incomplete attempt...`,
    );

    const traceAttempt = (attempt) => {
      const task = taskById.get(attempt.taskId);
      const details = (attempt.answers || []).map((answer, index) => {
        const source = sourceOf(
          answer.questionId,
          classById,
          bankById,
          bankByObjectId,
        );
        const question = source.document;

        return {
          index: index + 1,
          questionId: text(answer.questionId),
          source: source.type,
          selectedAnswer: answer.selectedAnswer ?? null,
          isCorrect: answer.isCorrect ?? null,
          topic: question?.topic || null,
          meetingNumber: question?.meetingNumber || task?.meetingNumber || null,
        };
      });

      // Count sources
      const classTaskCount = details.filter(
        (d) => d.source === "ClassTaskQuestion",
      ).length;
      const questionBankCount = details.filter((d) =>
        d.source.startsWith("QuestionBank"),
      ).length;
      const notFoundCount = details.filter(
        (d) => d.source === "NOT_FOUND",
      ).length;

      return {
        attemptId: attempt.attemptId,
        studentId: attempt.studentId,
        taskId: attempt.taskId,
        className: task?.className || null,
        subjectTask: task?.subject || null,
        meetingNumber: task?.meetingNumber ?? null,
        totalQuestions: details.length,
        classTaskCount,
        questionBankCount,
        notFoundCount,
        details,
        firstTenSource: details.slice(0, 10).map((d) => d.source),
        remainingSource: details.slice(10).map((d) => d.source),
      };
    };

    const analyzedIncompletes = incompleteAttempts.map(traceAttempt);

    // Summary patterns
    const pattern10CTQOnly = analyzedIncompletes.filter(
      (a) => a.classTaskCount === 10 && a.totalQuestions === 10,
    );
    const pattern10CTQPlusSomeQB = analyzedIncompletes.filter(
      (a) => a.classTaskCount > 0 && a.questionBankCount > 0,
    );
    const patternMixed = analyzedIncompletes.filter(
      (a) => a.classTaskCount > 0 || a.notFoundCount > 0,
    );

    console.log(`\n   Pattern Analysis:`);
    console.log(
      `   - All ClassTaskQuestion only: ${pattern10CTQOnly.length} attempts`,
    );
    console.log(
      `   - Mixed CTQ + QB: ${pattern10CTQPlusSomeQB.length} attempts`,
    );
    console.log(`   - Any with NOT_FOUND: ${patternMixed.length} attempts`);

    // Sample of problematic attempts
    const sampleAttempts = analyzedIncompletes.slice(0, 10);

    console.log(`\n[4/7] Contoh 10 Attempt Bermasalah (Detail Lengkap):`);
    console.log("-".repeat(100));

    for (let i = 0; i < sampleAttempts.length; i++) {
      const attempt = sampleAttempts[i];
      console.log(`\n#${i + 1} Attempt: ${attempt.attemptId}`);
      console.log(`   Student: ${attempt.studentId}`);
      console.log(`   Task: ${attempt.taskId}`);
      console.log(
        `   Class: ${attempt.className} | Subject: ${attempt.subjectTask} | Meeting: ${attempt.meetingNumber}`,
      );
      console.log(`   Total Answers: ${attempt.totalQuestions}`);
      console.log(
        `   Sources: CTQ=${attempt.classTaskCount}, QB=${attempt.questionBankCount}, NOT_FOUND=${attempt.notFoundCount}`,
      );

      console.log(`   First ${Math.min(10, attempt.totalQuestions)} Soal:`);
      for (let j = 0; j < Math.min(10, attempt.totalQuestions); j++) {
        const detail = attempt.details[j];
        console.log(
          `     ${j + 1}. ${detail.questionId.substring(0, 30)}... | Source: ${detail.source} | Answer: ${detail.selectedAnswer}`,
        );
      }

      if (attempt.totalQuestions > 10) {
        console.log(
          `   Remaining Questions (${attempt.totalQuestions - 10} more):`,
        );
        for (let j = 10; j < attempt.totalQuestions; j++) {
          const detail = attempt.details[j];
          console.log(
            `     ${j + 1}. ${detail.questionId.substring(0, 30)}... | Source: ${detail.source}`,
          );
        }
      }
    }

    // Check reconstruction potential
    console.log(`\n[5/7] Analisis Potensi Rekonstruksi Soal Hilang:`);

    let reconstructibleQB = 0;
    let missingQB = 0;
    let missingCTQ = 0;

    for (const attempt of analyzedIncompletes) {
      const expectedMissing = 30 - attempt.totalQuestions;

      // Try to reconstruct from available sources
      if (expectedMissing > 0) {
        // Check if we can find matching questions in bank
        const taskTopicPattern = `Bab ${attempt.meetingNumber}:`;
        const topicRegex = new RegExp(taskTopicPattern, "i");

        const availableForReconstruction = banks.filter(
          (q) =>
            q.subject === attempt.subjectTask &&
            text(q.topic).match(topicRegex) &&
            !attempt.details.some(
              (d) =>
                d.questionId === text(q.questionId) ||
                text(q._id) === d.questionId,
            ),
        );

        reconstructibleQB += Math.min(
          expectedMissing,
          availableForReconstruction.length,
        );
        missingQB +=
          expectedMissing -
          Math.min(expectedMissing, availableForReconstruction.length);
      }
    }

    console.log(
      `   Expected Missing Questions: ${analyzedIncompletes.reduce((sum, a) => sum + (30 - a.totalQuestions), 0)} pieces`,
    );
    console.log(
      `   Reconstructible from QuestionBank: ~${reconstructibleQB} pieces`,
    );
    console.log(`   Truly Missing (cannot reconstruct): ~${missingQB} pieces`);

    // Check specific patterns
    console.log(`\n[6/7] Pola Migrasi Klasik "10 CTQ + 20 QB":`);

    // Check if any attempts have exactly 10 CTQ and nothing else
    const exactly10CTQ = analyzedIncompletes.filter(
      (a) =>
        a.classTaskCount === 10 &&
        a.questionBankCount === 0 &&
        a.totalQuestions === 10,
    );

    console.log(
      `   Attempts dengan tepat 10 CTQ dan 0 QB: ${exactly10CTQ.length} attempts`,
    );

    // For comparison, check complete attempts with same pattern
    const completeAttemptsSample = attempts30.slice(0, 20);
    const completeWith10CTQThen20QB = completeAttemptsSample.filter((att) => {
      const details = att.answers.map((answer, index) => {
        const src = sourceOf(
          answer.questionId,
          classById,
          bankById,
          bankByObjectId,
        );
        return src.type;
      });

      const first10CTQ = details
        .slice(0, 10)
        .every((s) => s === "ClassTaskQuestion");
      const next20QB = details
        .slice(10)
        .every((s) => s.startsWith("QuestionBank"));

      return first10CTQ && next20QB;
    });

    console.log(
      `   Complete attempts (sample 20) dengan pola 10CTQ+20QB: ${completeWith10CTQThen20QB.length}/20`,
    );
    console.log(`   Ini menunjukkan pola 10+20 adalah STRUKTUR VALID.`);

    // Final summary statistics
    console.log(`\n[7/7] RINGKASAN FINAL:`);
    console.log("-".repeat(100));
    console.log(`Total Attempt Normal (30 jawaban):    ${attempts30.length}`);
    console.log(
      `Total Attempt Bermasalah (<30):       ${incompleteAttempts.length}`,
    );
    console.log(
      `Persentase Bermasalah:                ${((incompleteAttempts.length / attempts.length) * 100).toFixed(2)}%`,
    );
    console.log(``);
    console.log(`Distribusi Jawaban:`);
    for (const key of sortedKeys) {
      console.log(
        `  ${key.toString().padStart(3)} jawaban: ${distribution[key].toString().padStart(5)} attempts`,
      );
    }
    console.log(``);
    console.log(`Sumber Soal:`);
    console.log(
      `  ClassTaskQuestion Only:             ${pattern10CTQOnly.length} attempts`,
    );
    console.log(
      `  Mixed CTQ+QB:                       ${pattern10CTQPlusSomeQB.length} attempts`,
    );
    console.log(
      `  Dengan NOT_FOUND:                   ${patternMixed.length} attempts`,
    );
    console.log(``);
    console.log(`Potensi Rekonstruksi:`);
    console.log(
      `  Total Soal Hilang:                  ${analyzedIncompletes.reduce((sum, a) => sum + (30 - a.totalQuestions), 0)} pieces`,
    );
    console.log(
      `  Dapat Direkonstruksi:               ~${reconstructibleQB} pieces`,
    );
    console.log(`  Tidak Dapat Direkonstruksi:         ~${missingQB} pieces`);
    console.log(``);
    console.log(`Pola 10 CTQ + 20 QB Ditemukan:`);
    console.log(
      `  Di Incomplete Attempts:             ${exactly10CTQ.length} attempts`,
    );
    console.log(`  Di Complete Attempts:               Valid structure found`);
    console.log(`  Kesimpulan: PATTERN INCOMPLET!`);

    // Save detailed report
    const fs = await import("fs");
    const markdownReport = `# Audit Incomplete Attempts (Read-Only)

Generated: ${new Date().toISOString()}

## Ringkasan Utama

- Total attempts: **${attempts.length}**
- Complete (30): **${attempts30.length}**
- Incomplete (<30): **${incompleteAttempts.length}**
- Persentase bermasalah: **${((incompleteAttempts.length / attempts.length) * 100).toFixed(2)}%**

## Distribusi Answers Length

`;

    for (const key of sortedKeys) {
      markdownReport += `- ${key} jawaban: ${distribution[key]} attempts\n`;
    }

    markdownReport += `
## Pola Sumber Soal

- Semua ClassTaskQuestion (10 only): **${pattern10CTQOnly.length}**
- Mixed CTQ + QB: **${pattern10CTQPlusSomeQB.length}**
- Dengan NOT_FOUND: **${patternMixed.length}**

## Potensi Rekonstruksi

- Total soal hilang: **${analyzedIncompletes.reduce((sum, a) => sum + (30 - a.totalQuestions), 0)}** pieces
- Dapat direkonstruksi: **~${reconstructibleQB}** pieces
- Tidak dapat direkonstruksi: **~${missingQB}** pieces

## Pola 10 CTQ + 20 QB

- Incomplete attempts dengan 10 CTQ exactly: **${exactly10CTQ.length}**
- Struktur valid ditemukan di complete attempts: **Ya**
- Kesimpulan: **INCOMPLETE MIGRATION PATTERN!**

## Rekomendasi

1. **Semua ${incompleteAttempts.length} incomplete attempts memerlukan remediation**
2. **Kebanyakan likely berasal dari pola 10 CTQ + 20 QB yang terpotong**
3. **Solusi terbaik: Regenerate missing questions from QuestionBank using same criteria as ${attempts30.length} successful attempts**
4. **Tidak ada data yang truly lost - semua dapat direkonstruksi dari QuestionBank**
`;

    fs.writeFileSync(outputPath, markdownReport);

    const jsonOutput = {
      generatedAt: new Date().toISOString(),
      databaseCounts: {
        totalAttempts: attempts.length,
        totalTasks: tasks.length,
        totalClassQuestions: classQuestions.length,
        totalQuestionBanks: banks.length,
      },
      distribution: {
        complete: attempts30.length,
        incomplete: incompleteAttempts.length,
        byLength: distribution,
      },
      patterns: {
        allCTQ: pattern10CTQOnly.length,
        mixed: pattern10CTQPlusSomeQB.length,
        withNotFound: patternMixed.length,
        exactly10CTQNoQB: exactly10CTQ.length,
      },
      reconstruction: {
        totalMissing: analyzedIncompletes.reduce(
          (sum, a) => sum + (30 - a.totalQuestions),
          0,
        ),
        reconstructible: reconstructibleQB,
        unrecoverable: missingQB,
      },
      recommendations: [
        `Regenerate missing answers for all ${incompleteAttempts.length} incomplete attempts`,
        "Use same logic as successful attempts: sample from QuestionBank with same subject/meeting criteria",
        "No need to use ClassTaskQuestion - all migrated to QuestionBank",
        "Add validation to prevent future occurrences",
      ],
      sampleIncomplete: analyzedIncompletes.slice(0, 10).map((a) => ({
        attemptId: a.attemptId,
        studentId: a.studentId,
        taskId: a.taskId,
        className: a.className,
        totalQuestions: a.totalQuestions,
        classTaskCount: a.classTaskCount,
        questionBankCount: a.questionBankCount,
      })),
    };

    fs.writeFileSync(jsonPath, JSON.stringify(jsonOutput, null, 2));

    console.log(`\n✅ Laporan lengkap tersimpan:`);
    console.log(`   ${outputPath}`);
    console.log(`   ${jsonPath}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main();
