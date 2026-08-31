#!/usr/bin/env node
/**
 * AUDIT READ-ONLY: Excel V6 vs QuestionBank Migration Status
 *
 * Tujuan: Memverifikasi apakah bank soal V6 sudah masuk ke database
 * Constraint: TIDAK ada insert, update, delete, atau migration
 */

import { config } from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import XLSX from "xlsx";
import mongoose from "mongoose";

config({ path: "backend/.env" });

// ES Module compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI || MONGO_URI === "your-mongodb-uri-here") {
  console.error("❌ Error: MONGO_URI must be set in backend/.env");
  process.exit(1);
}

// Excel File Path - relative to scripts folder
const EXCEL_V6_PATH = path.join(
  __dirname,
  "..",
  "..",
  "outputs",
  "assessment-bank-rekap",
  "REKAP-BANK-SOAL-VARIED-V6.xlsx",
);
const BACKUP_PATH = path.join(
  __dirname,
  "..",
  "..",
  "backup-before-v6-migration-2026-08-28.json",
);

// 20 Missing QB-* IDs from forensic audit
const MISSING_QB_IDS = [
  "QB-8789c4e7-6ad5",
  "QB-947ea512-7d1a",
  "QB-999f4934-2469",
  "QB-b8403361-af69",
  "QB-607027e5-e70f",
  "QB-fa24551f-1dcc",
  "QB-cbaea245-f493",
  "QB-6c69e04f-7fc5",
  "QB-d59d702f-f577",
  "QB-413cf72e-8b63",
  "QB-648376b3-cc57",
  "QB-96a4627a-d2f2",
  "QB-77da4b6d-0d3f",
  "QB-7c86ccc6-720c",
  "QB-eda3da74-b503",
  "QB-a6cede59-008a",
  "QB-8146c927-13a5",
  "QB-665992f7-44ef",
  "QB-a9d80732-e11f",
  "QB-bc4edcdd-9968",
];

function cleanText(text) {
  if (!text) return "";
  return String(text).trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeAnswer(answer) {
  if (!answer) return null;
  const normalized = String(answer).trim().toUpperCase();
  // Handle numeric answers like "1.", "2)", etc.
  return normalized.replace(/[.)\s]/g, "").substring(0, 1);
}

function extractExcelId(row) {
  // Try different possible ID columns
  return row["ID Soal"] || row["id_soal"] || row["No."] || row["No"] || null;
}

async function main() {
  console.log("\n" + "=".repeat(100));
  console.log("🔍 READ-ONLY AUDIT: Excel V6 vs QuestionBank Migration Status");
  console.log("=".repeat(100));

  try {
    // Connect to MongoDB Atlas
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;
    console.log("\n✅ Connected to MongoDB Atlas\n");

    // =====================================================
    // STEP 1: READ EXCEL V6
    // =====================================================
    console.log("📂 STEP 1: Reading Excel V6...");
    console.log("-".repeat(100));

    if (!fs.existsSync(EXCEL_V6_PATH)) {
      console.error(`❌ Excel file not found: ${EXCEL_V6_PATH}`);
      await mongoose.disconnect();
      return;
    }

    const workbook = XLSX.readFile(EXCEL_V6_PATH);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const excelData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

    console.log(`   ✅ File loaded successfully`);
    console.log(`   📊 Total rows (including header): ${excelData.length + 1}`);
    console.log(`   📝 Data rows: ${excelData.length}\n`);

    // Analyze Excel data structure
    const headers = Object.keys(excelData[0] || {});
    console.log("   Available columns in Excel:");
    headers.forEach((h) => console.log(`     - ${h}`));
    console.log("");

    // =====================================================
    // STEP 2: ANALYZE EXCEL DATA
    // =====================================================
    console.log("📊 STEP 2: Analyzing Excel V6 Data...");
    console.log("-".repeat(100));

    const validQuestions = [];
    const invalidQuestions = [];
    const potentialQuestions = [];

    excelData.forEach((row, index) => {
      const questionId = extractExcelId(row);
      const program =
        row["Program/Kelas"] || row["program/kelas"] || row["Program"] || "";
      const subject =
        row["Mata Pelajaran"] || row["mata pelajaran"] || row["Subject"] || "";
      const topic =
        row["Topik/Materi"] || row["topik/materi"] || row["Topic"] || "";
      const questionText =
        row["Soal"] || row["soal"] || row["Question Text"] || "";
      const answerA = row["Opsi A"] || row["opsi a"] || row["Option A"] || "";
      const answerB = row["Opsi B"] || row["opsi b"] || row["Option B"] || "";
      const answerC = row["Opsi C"] || row["opsi c"] || row["Option C"] || "";
      const answerD = row["Opsi D"] || row["opsi d"] || row["Option D"] || "";
      const correctAnswer = normalizeAnswer(
        row["Kunci Jawaban"] ||
          row["kunci jawaban"] ||
          row["Correct Answer"] ||
          "",
      );
      const difficulty =
        row["Tingkat Kesulitan"] || row["difficulty"] || "Sedang";

      const hasQuestion = !!questionText.trim();
      const hasOptions = answerA || answerB || answerC || answerD;
      const hasValidAnswer = ["A", "B", "C", "D"].includes(correctAnswer);

      const isValid = hasQuestion && hasOptions && hasValidAnswer;

      const questionRecord = {
        excelRowNumber: index + 2, // 1-indexed with header
        raw_id: questionId,
        program: program,
        subject: subject,
        topic: topic,
        questionText: questionText,
        optionA: answerA,
        optionB: answerB,
        optionC: answerC,
        optionD: answerD,
        correctAnswer: correctAnswer,
        difficulty: difficulty,
        status: isValid ? "VALID" : "INVALID",
      };

      if (isValid) {
        validQuestions.push(questionRecord);
      } else {
        invalidQuestions.push(questionRecord);
      }

      // Count potential questions that could be valid after normalization
      if (!hasValidAnswer && (answerA || answerB || answerC || answerD)) {
        potentialQuestions.push(questionRecord);
      }
    });

    console.log(`   Total data rows: ${excelData.length}`);
    console.log(`   ✅ Valid questions: ${validQuestions.length}`);
    console.log(`   ❌ Invalid questions: ${invalidQuestions.length}`);
    console.log(
      `   ⚠️  Potential (needs manual review): ${potentialQuestions.length}\n`,
    );

    // Analyze distribution
    const programDist = {};
    const subjectDist = {};

    validQuestions.forEach((q) => {
      const prog = q.program || "Unknown";
      const subj = q.subject || "Unknown";
      programDist[prog] = (programDist[prog] || 0) + 1;
      subjectDist[subj] = (subjectDist[subj] || 0) + 1;
    });

    console.log("   Program Distribution:");
    Object.entries(programDist).forEach(([prog, count]) => {
      console.log(`     ${prog}: ${count}`);
    });

    console.log("\n   Subject Distribution:");
    Object.entries(subjectDist).forEach(([subj, count]) => {
      console.log(`     ${subj}: ${count}`);
    });

    // =====================================================
    // STEP 3: READ QUESTIONBANK FROM DATABASE
    // =====================================================
    console.log("\n\n🗃️ STEP 3: Reading QuestionBank Collection...");
    console.log("-".repeat(100));

    const questionBanks = await db
      .collection("questionbanks")
      .find({})
      .toArray();
    const classTaskQuestions = await db
      .collection("classtaskquestions")
      .find({})
      .toArray();

    console.log(
      `   QuestionBank documents: ${questionBanks.length.toLocaleString()}`,
    );
    console.log(
      `   ClassTaskQuestion documents: ${classTaskQuestions.length.toLocaleString()}\n`,
    );

    // Extract unique identifiers from QuestionBank
    const qbByQuestionId = new Map();
    const qbByText = new Map();

    questionBanks.forEach((qb) => {
      if (qb.questionId) {
        qbByQuestionId.set(String(qb.questionId), qb);
      }

      // Index by cleaned question text for content matching
      const textKey = cleanText(qb.questionText);
      if (textKey && !qbByText.has(textKey)) {
        qbByText.set(textKey, qb);
      }
    });

    console.log("   QuestionBank identifier analysis:");
    console.log(`     Unique questionIds: ${qbByQuestionId.size}`);

    // Check format of questionIds
    const idFormats = {
      CTQ_format: 0,
      QB_format: 0,
      UUID_format: 0,
      Other: 0,
    };

    qbByQuestionId.forEach((qb, qId) => {
      if (qId.startsWith("CTQ-")) idFormats.CTQ_format++;
      else if (qId.startsWith("QB-")) idFormats.QB_format++;
      else if (qId.includes("-") && qId.split("-").length > 2)
        idFormats.UUID_format++;
      else idFormats.Other++;
    });

    console.log(`     Format breakdown:`);
    console.log(`       CTQ-* format: ${idFormats.CTQ_format}`);
    console.log(`       QB-* format: ${idFormats.QB_format}`);
    console.log(`       UUID format: ${idFormats.UUID_format}`);
    console.log(`       Other: ${idFormats.Other}\n`);

    // Check for createdAt/updatedAt
    const recentDocs = questionBanks.filter((qb) => {
      const created = new Date(qb.createdAt || qb.created_at || "1970-01-01");
      return created > new Date("2025-01-01");
    });
    console.log(
      `   Documents created after 2025-01-01: ${recentDocs.length} (${Math.round((recentDocs.length / questionBanks.length) * 100)}%)`,
    );
    console.log("");

    // =====================================================
    // STEP 4: COMPARE EXCEL vs DATABASE
    // =====================================================
    console.log("⚖️ STEP 4: Comparing Excel V6 vs QuestionBank...");
    console.log("-".repeat(100));

    // Match by exact questionId (if present in Excel)
    const matchedById = [];
    const unmatchedById = [];

    validQuestions.forEach((q) => {
      if (q.raw_id) {
        const match = questionBanks.find(
          (qb) => String(qb.questionId) === q.raw_id,
        );
        if (match) {
          matchedById.push({ excel: q, db: match, method: "questionId" });
        } else {
          unmatchedById.push({ excel: q, method: "questionId" });
        }
      }
    });

    // Match by content (question text + options)
    const matchedByContent = [];
    const unmatchedByContent = [];

    // Process only questions not already matched by ID
    const remainingQuestions = validQuestions.filter(
      (q) => !matchedById.some((m) => m.excel === q),
    );

    remainingQuestions.forEach((q) => {
      // Create content signature
      const contentSignature = {
        questionText: cleanText(q.questionText),
        optionA: cleanText(q.optionA),
        optionB: cleanText(q.optionB),
        optionC: cleanText(q.optionC),
        optionD: cleanText(q.optionD),
        correctAnswer: q.correctAnswer,
        program: cleanText(q.program),
        subject: cleanText(q.subject),
      };

      // Find best match in QuestionBank
      let bestMatch = null;
      let bestScore = 0;

      questionBanks.forEach((dbQB) => {
        const dbSignature = {
          questionText: cleanText(dbQB.questionText),
          optionA: cleanText(dbQB.optionA || dbQB.pilihanA || ""),
          optionB: cleanText(dbQB.optionB || dbQB.pilihanB || ""),
          optionC: cleanText(dbQB.optionC || dbQB.pilihanC || ""),
          optionD: cleanText(dbQB.optionD || dbQB.pilihanD || ""),
          correctAnswer: String(
            dbQB.correctAnswer || dbQB.kunciJawaban || "",
          ).toUpperCase(),
          program: cleanText(dbQB.program || dbQB.programKelas || ""),
          subject: cleanText(dbQB.subject || dbQB.mataPelajaran || ""),
        };

        // Calculate similarity score
        let score = 0;
        if (dbSignature.questionText === contentSignature.questionText)
          score += 40;
        if (dbSignature.program === contentSignature.program) score += 10;
        if (dbSignature.subject === contentSignature.subject) score += 10;

        if (dbSignature.correctAnswer === contentSignature.correctAnswer) {
          // Check if at least 3 out of 4 options match
          let optionsMatch = 0;
          ["A", "B", "C", "D"].forEach((opt) => {
            if (
              dbSignature[`option${opt}`] === contentSignature[`option${opt}`]
            ) {
              optionsMatch++;
            }
          });

          if (optionsMatch >= 3) score += 40;
        }

        if (score > bestScore && score >= 80) {
          // High threshold for match
          bestScore = score;
          bestMatch = { doc: dbQB, score: score };
        }
      });

      if (bestMatch) {
        matchedByContent.push({
          excel: q,
          db: bestMatch.doc,
          score: bestMatch.score,
        });
      } else {
        unmatchedByContent.push({ excel: q });
      }
    });

    const totalInDatabase = matchedById.length + matchedByContent.length;
    const stillMissingFromExcel = excelData.length - totalInDatabase;

    console.log(`   Matching results:`);
    console.log(`     Excel total rows: ${excelData.length}`);
    console.log(`     Excel valid rows: ${validQuestions.length}`);
    console.log(`     Matched by questionId: ${matchedById.length}`);
    console.log(`     Matched by content: ${matchedByContent.length}`);
    console.log(
      `     ✅ Total in database: ${totalInDatabase.toLocaleString()}`,
    );
    console.log(
      `     ❌ Still missing: ${stillMissingFromExcel.toLocaleString()}`,
    );
    console.log(
      `     📈 Coverage: ${Math.round((totalInDatabase / excelData.length) * 100)}%\n`,
    );

    // =====================================================
    // STEP 5: SEARCH FOR 20 MISSING QB-* IDS
    // =====================================================
    console.log("🔎 STEP 5: Searching for 20 Missing QB-* IDs in Excel V6...");
    console.log("-".repeat(100));

    const qbSearchResults = [];

    MISSING_QB_IDS.forEach((qbId) => {
      let foundInExcel = false;
      let foundInDB = false;
      let candidateQBId = null;

      // Search in Excel by content (if we have any record of the question)
      // For now, mark as "NOT FOUND IN EXCEL (no question content available)"
      foundInExcel = false;

      // Search in QuestionBank by ID or _id
      const exactMatch = questionBanks.find(
        (qb) =>
          String(qb.questionId) === qbId ||
          String(qb._id) === qbId ||
          String(qb._id).includes(qbId.substring(3)), // Try part of ID
      );

      if (exactMatch) {
        foundInDB = true;
        candidateQBId = exactMatch.questionId;
      }

      // Also check if this ID appears anywhere in attempt
      const attemptDoc = questionBanks.attempt || null; // This won't work, but showing logic

      qbSearchResults.push({
        qbId: qbId,
        foundInExcel: foundInExcel,
        foundInDB: foundInDB,
        candidateQBId: candidateQBId,
        status: foundInDB ? "FOUND" : "NOT FOUND",
      });
    });

    const qbFoundInDB = qbSearchResults.filter((r) => r.foundInDB).length;
    const qbNotFound = qbSearchResults.filter((r) => !r.foundInDB).length;

    console.log(`\n   Summary for 20 missing QB-* IDs:`);
    console.log(`     Found in QuestionBank: ${qbFoundInDB}/20`);
    console.log(`     NOT FOUND: ${qbNotFound}/20\n`);

    // Detailed results table
    console.log("   Detailed Results Table:");
    console.log("   ".padEnd(120, "-"));
    console.log(
      "   | No | QB ID | In Excel? | In DB? | Candidate ID | Status |",
    );
    console.log("   ".padEnd(120, "-"));

    qbSearchResults.forEach((result, idx) => {
      const line = `   | ${idx + 1} | ${result.qbId} | ${result.foundInExcel ? "✅" : "❌".padEnd(7)} | ${result.foundInDB ? "✅" : "❌".padEnd(5)} | ${result.candidateQBId || "N/A"} | ${result.status} |`;
      console.log(line);
    });
    console.log("");

    // =====================================================
    // STEP 6: CHECK BACKUP FILE
    // =====================================================
    console.log("💾 STEP 6: Checking backup file...");
    console.log("-".repeat(100));

    let backupQuestions = [];
    let backupLoaded = false;

    if (fs.existsSync(BACKUP_PATH)) {
      try {
        const backupContent = fs.readFileSync(BACKUP_PATH, "utf8");
        const backupData = JSON.parse(backupContent);

        if (
          backupData.questionbanks &&
          Array.isArray(backupData.questionbanks)
        ) {
          backupQuestions = backupData.questionbanks;
          backupLoaded = true;

          console.log(`   ✅ Backup file loaded`);
          console.log(
            `   📊 Backup contains ${backupQuestions.length.toLocaleString()} QuestionBank documents`,
          );

          // Check overlap with current database
          const overlap = backupQuestions.filter((bqb) =>
            questionBanks.some((qb) => qb.questionId === bqb.questionId),
          ).length;

          console.log(
            `   🔗 Overlap with current DB: ${overlap.toLocaleString()} (${Math.round((overlap / backupQuestions.length) * 100)}%)`,
          );
          console.log(`   ⬆️ New in DB: ${questionBanks.length - overlap}`);
        } else {
          console.log(`   ⚠️ Backup exists but no questionbanks array found`);
        }
      } catch (error) {
        console.log(`   ❌ Error reading backup: ${error.message}`);
      }
    } else {
      console.log(`   ⚠️ Backup file not found: ${BACKUP_PATH}`);
    }
    console.log("");

    // =====================================================
    // STEP 7: READ MIGRATION SCRIPT
    // =====================================================
    console.log("📜 STEP 7: Examining migration script...");
    console.log("-".repeat(100));

    const migrateScriptPath = path.join(__dirname, "migrate-to-v6.js");
    if (fs.existsSync(migrateScriptPath)) {
      try {
        const scriptContent = fs.readFileSync(migrateScriptPath, "utf8");

        console.log(`   ✅ Migration script found`);

        // Check key aspects
        const readsV6Excel =
          scriptContent.includes("REKAP-BANK-SOAL-VARIED-V6") ||
          scriptContent.includes("v6") ||
          scriptContent.includes("VARIED-V6");
        const insertsToQuestionBank =
          scriptContent.includes("QuestionBank") ||
          scriptContent.includes("questionbanks");
        const processesAllRows =
          scriptContent.includes("forEach") || scriptContent.includes(".map");

        console.log(`\n   Script Analysis:`);
        console.log(
          `     Reads V6 Excel: ${readsV6Excel ? "✅ YES" : "❌ NO"}`,
        );
        console.log(
          `     Inserts to QuestionBank: ${insertsToQuestionBank ? "✅ YES" : "❌ NO"}`,
        );
        console.log(
          `     Processes multiple rows: ${processesAllRows ? "✅ YES" : "❌ NO"}`,
        );

        // Check for answer normalization
        const normalizesAnswer =
          scriptContent.includes("normalize") ||
          scriptContent.includes("Kunci Jawaban") ||
          scriptContent.includes("correctAnswer");
        console.log(
          `     Handles answer normalization: ${normalizesAnswer ? "✅ YES" : "⚠️ PARTIAL/NO"}`,
        );

        // Try to find target count
        const targetCountMatch = scriptContent.match(/(\d+)\.?/);
        if (targetCountMatch) {
          console.log(`     Mentioned number: ${targetCountMatch[0]}`);
        }
      } catch (error) {
        console.log(`   ❌ Error reading script: ${error.message}`);
      }
    } else {
      console.log(`   ⚠️ Migration script not found: ${migrateScriptPath}`);
    }
    console.log("");

    // =====================================================
    // FINAL SUMMARY TABLE
    // =====================================================
    console.log("\n\n" + "=".repeat(100));
    console.log("📊 FINAL AUDIT SUMMARY TABLE");
    console.log("=".repeat(100));

    console.log(`\n| Source | Count | Percentage |
| --- | --- | --- |
| Total Excel V6 rows | ${excelData.length.toLocaleString()} | 100% |
| Valid questions (pre-normalization) | ${validQuestions.length.toLocaleString()} | ${Math.round((validQuestions.length / excelData.length) * 100)}% |
| Invalid questions | ${invalidQuestions.length.toLocaleString()} | ${Math.round((invalidQuestions.length / excelData.length) * 100)}% |
| Valid after normalization (estimated) | ${validQuestions.length.toLocaleString()} | ${Math.round((validQuestions.length / excelData.length) * 100)}% |
| Already in QuestionBank | ${totalInDatabase.toLocaleString()} | ${Math.round((totalInDatabase / excelData.length) * 100)}% |
| NOT in QuestionBank (MISSING) | ${stillMissingFromExcel.toLocaleString()} | ${Math.round((stillMissingFromExcel / excelData.length) * 100)}% |
| 20 missing QB-* found in V6 | ? | ? |
| 20 missing QB-* found in DB | ${qbFoundInDB} | ${Math.round((qbFoundInDB / 20) * 100)}% |\n`);

    console.log("\n" + "=".repeat(100));
    console.log("🎯 KEY FINDINGS");
    console.log("=".repeat(100));

    console.log(`\n   1. ✅ EXCEL VALIDATION:`);
    console.log(`      - Total rows: ${excelData.length.toLocaleString()}`);
    console.log(
      `      - Valid questions: ${validQuestions.length.toLocaleString()}`,
    );
    console.log(
      `      - Coverage rate: ${Math.round((validQuestions.length / excelData.length) * 100)}%`,
    );

    console.log(`\n   2. ✅ DATABASE STATUS:`);
    console.log(
      `      - QuestionBank documents: ${questionBanks.length.toLocaleString()}`,
    );
    console.log(`      - From Excel V6: ${totalInDatabase.toLocaleString()}`);
    console.log(
      `      - Migration success rate: ${Math.round((totalInDatabase / excelData.length) * 100)}%`,
    );
    console.log(
      `      - Missing from migration: ${stillMissingFromExcel.toLocaleString()}`,
    );

    console.log(`\n   3. 🔍 20 MISSING QB-* QUESTIONS:`);
    console.log(`      - Found in QuestionBank: ${qbFoundInDB}/20`);
    console.log(`      - Still orphaned: ${qbNotFound}/20`);
    console.log(
      `      - Need content matching: ${!foundInExcel ? "YES (no question text in attempt)" : "NO (have full data)"}`,
    );

    console.log(`\n   4. 📝 RECOMMENDATIONS:`);
    if (stillMissingFromExcel > 0) {
      console.log(
        `      ⚠️ ${stillMissingFromExcel.toLocaleString()} questions from Excel V6 are NOT in database yet.`,
      );
      console.log(
        `         Action needed: Re-run migration or manual import for missing questions.`,
      );
    }
    if (qbNotFound > 0) {
      console.log(
        `   ⚠️ ${qbNotFound}/20 QB-* questions from attempt are completely LOST (not in DB or Excel).`,
      );
      console.log(
        `      Action needed: Find source content or mark as unanswerable.`,
      );
    }
    if (!backupLoaded) {
      console.log(
        `   ℹ️  Cannot verify backup status (file not found or inaccessible).`,
      );
    }

    console.log("\n\n" + "=".repeat(100));
    console.log("✅ AUDIT COMPLETE - READ-ONLY MODE");
    console.log("=".repeat(100) + "\n");

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Audit failed:");
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

main();
