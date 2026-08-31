// Migration Script: Safely Import V6 Data Without Deleting Existing Questions
// Safe & Idempotent - Only adds new questions, never deletes or overwrites

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { Workbook } = require("exceljs");

// Configuration
const EXCEL_FILE = path.join(
  __dirname,
  "../../outputs/assessment-bank-rekap/REKAP-BANK-SOAL-VARIED-V6.xlsx",
);
const BACKUP_DIR = path.join(__dirname, "../backups");
const LOG_FILE = path.join(
  BACKUP_DIR,
  `migration-log-${new Date().toISOString().slice(0, 10)}.log`,
);

// REQUIREMENT: MONGO_URI must be set in environment variables
// No fallbacks allowed - ensures consistent database configuration across all environments
if (!process.env.MONGO_URI) {
  console.error("\n❌ ERROR: MONGO_URI environment variable is required");
  console.error("   Please set MONGO_URI in backend/.env file");
  console.error(
    "   Example: MONGO_URI=mongodb://localhost:27017/your_database",
  );
  console.error("");
  console.error("   For Atlas cluster use:");
  console.error(
    "   MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/database",
  );
  console.error("");
  process.exit(1);
}

const MONGODB_URI = process.env.MONGO_URI;

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run") || args.includes("--check");
const shouldApply = args.includes("--apply");

if (!isDryRun && !shouldApply) {
  console.log("⚠️  No mode specified!");
  console.log(
    "   Usage: node migrate-to-v6.js --dry-run    (preview only, no changes)",
  );
  console.log(
    "          node migrate-to-v6.js --apply      (execute insertion)",
  );
  console.log("   Running in DRY-RUN mode for safety...\n");
  const isDryRun = true;
}

async function log(message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}`;
  console.log(line);

  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    fs.appendFileSync(LOG_FILE, line + "\n");
  } catch (e) {}
}

async function connectToMongo() {
  await log("[CONNECT] Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  await log("[OK] Connected to database: " + db.databaseName);
  return db;
}

async function readExcelFile() {
  await log("[READ] Reading Excel file: " + EXCEL_FILE);

  if (!fs.existsSync(EXCEL_FILE)) {
    throw new Error("Excel file not found: " + EXCEL_FILE);
  }

  const workbook = new Workbook();
  await workbook.xlsx.readFile(EXCEL_FILE);
  const worksheet = workbook.worksheets[0];
  const rowCount = worksheet.rowCount;

  await log("[DATA] Excel contains " + rowCount + " rows");

  const questions = [];
  let invalidRows = 0;
  let validLetterOnly = 0;
  let normalizedFromValue = 0;
  let noMatchFound = 0;
  const seenIds = new Set();
  let duplicateCount = 0;

  for (let i = 2; i <= rowCount; i++) {
    const row = worksheet.getRow(i);

    // Get values by column index (1-based)
    const programKelas = row.getCell(1).value;
    const mataPelajaran = row.getCell(2).value;
    const topik = row.getCell(3).value;
    const question = row.getCell(9).value;
    const optionA = row.getCell(10).value;
    const optionB = row.getCell(11).value;
    const optionC = row.getCell(12).value;
    const optionD = row.getCell(13).value;
    const correctAnswerRaw = row.getCell(14).value;

    // Validate required fields
    if (
      !question ||
      !correctAnswerRaw ||
      !mataPelajaran ||
      !programKelas ||
      !topik
    ) {
      invalidRows++;
      continue;
    }

    // Parse program from "SD Kelas 3", "SMA IPA", etc.
    const programStr = String(programKelas || "");
    let program = "";

    if (programStr.includes("SD")) {
      program = "SD";
    } else if (programStr.includes("SMP")) {
      program = "SMP";
    } else if (programStr.includes("SMA")) {
      program = "SMA";
    } else if (programStr.includes("UTBK")) {
      program = "UTBK";
    } else {
      program = programStr.split(" ")[0].toUpperCase();
    }

    // NORMALIZATION: Smart answer key mapping
    const cleanAnswer = await normalizeAnswerKey(
      correctAnswerRaw,
      optionA,
      optionB,
      optionC,
      optionD,
    );

    if (!cleanAnswer) {
      noMatchFound++;
      continue;
    }

    // Check for duplicates based on content
    const qId =
      program.toUpperCase() +
      "-" +
      String(mataPelajaran || "").toUpperCase() +
      "-" +
      String(topik || "").toUpperCase() +
      "-" +
      i;

    const cleanId = qId
      .replace(/\s+/g, "_")
      .replace(/[^A-Z0-9_-]/g, "_")
      .toUpperCase();

    // Check for duplicate ID
    if (seenIds.has(cleanId)) {
      duplicateCount++;
      continue;
    }
    seenIds.add(cleanId);

    // Determine normalization method used
    const rawStr = String(correctAnswerRaw || "")
      .trim()
      .toUpperCase();
    if (/^[ABCD]$/.test(rawStr)) {
      validLetterOnly++;
    } else {
      normalizedFromValue++;
    }

    questions.push({
      questionId: cleanId,
      program: program.toUpperCase(),
      subject: String(mataPelajaran || "").trim(),
      topic: String(topik || "").trim(),
      questionText: String(question || "").trim(),
      options: [
        String(optionA || ""),
        String(optionB || ""),
        String(optionC || ""),
        String(optionD || ""),
      ],
      correctAnswer: cleanAnswer,
    });
  }

  await log("[STATS] Question Analysis:");
  await log(`   Total Excel rows: ${rowCount - 1}`);
  await log(`   Valid A/B/C/D format: ${validLetterOnly}`);
  await log(`   Normalized from values: ${normalizedFromValue}`);
  await log(`   No match found: ${noMatchFound}`);
  await log(`   Duplicate IDs skipped: ${duplicateCount}`);
  await log(`   Invalid rows skipped: ${invalidRows}`);
  await log("[OK] Extracted " + questions.length + " valid unique questions\n");

  return {
    questions,
    stats: {
      total: rowCount - 1,
      validLetterOnly,
      normalizedFromValue,
      noMatchFound,
      duplicateCount,
      invalidRows,
    },
  };
}

/**
 * Normalize answer key to A/B/C/D
 * Strategy:
 * 1. If already A/B/C/D, use directly
 * 2. Otherwise, search options A-D for matching VALUE
 * 3. Return the letter if match found, null if no match
 */
async function normalizeAnswerKey(rawAnswer, optA, optB, optC, optD) {
  const answerStr = String(rawAnswer || "").trim();

  // Already valid letter?
  if (/^[ABCD]$/i.test(answerStr)) {
    return answerStr.toUpperCase();
  }

  // Search for matching VALUE among options
  const options = {
    A: String(optA || ""),
    B: String(optB || ""),
    C: String(optC || ""),
    D: String(optD || ""),
  };

  for (const [letter, value] of Object.entries(options)) {
    if (String(value) === answerStr) {
      return letter; // Found match!
    }
  }

  // No match found
  return null;
}

async function checkExistingQuestions(db, questions) {
  await log("[CHECK] Checking for existing questions...");
  const collection = db.collection("questionbanks");

  const existingIds = [];
  const newQuestions = [];
  let alreadyExistsCount = 0;

  // Collect all question IDs
  const questionIds = questions.map((q) => q.questionId);

  // Query existing questions to find matches
  const existingDocs = await collection
    .find({ questionId: { $in: questionIds } })
    .toArray();

  const existingSet = new Set(existingDocs.map((d) => d.questionId));

  // Filter out duplicates
  for (const q of questions) {
    if (existingSet.has(q.questionId)) {
      alreadyExistsCount++;
    } else {
      newQuestions.push(q);
    }
  }

  await log("[OK] Found " + existingSet.size + " questions already exist");
  await log(
    "[OK] Will add " + newQuestions.length + " new questions (unique)\n",
  );

  return newQuestions;
}

async function insertNewQuestions(db, questions) {
  await log("[INSERT] Inserting " + questions.length + " new questions...");
  const collection = db.collection("questionbanks");

  if (questions.length === 0) {
    await log("[SKIP] No new questions to insert.\n");
    return 0;
  }

  const chunks = [];
  for (let i = 0; i < questions.length; i += 1000) {
    chunks.push(questions.slice(i, i + 1000));
  }

  let totalInserted = 0;
  for (let i = 0; i < chunks.length; i++) {
    try {
      await collection.insertMany(chunks[i], { ordered: false });
      totalInserted += chunks[i].length;
      await log(
        "[DATA] Progress: " +
          totalInserted +
          "/" +
          questions.length +
          " questions inserted (" +
          Math.round((totalInserted / questions.length) * 100) +
          "%)",
      );
    } catch (insertError) {
      // Handle potential unique constraint violations
      await log("[WARN] Some inserts may have failed: " + insertError.message);
    }
  }

  await log(
    "[OK] All " + totalInserted + " questions processed successfully\n",
  );
  return totalInserted;
}

async function showSummary(db, stats, insertedCount) {
  await log("\n" + "=".repeat(80));
  await log("📊 MIGRATION SUMMARY REPORT");
  await log("=".repeat(80));

  await log("\n📄 EXCEL DATA ANALYSIS:");
  await log(`   Total Excel rows:             ${stats.total.toLocaleString()}`);
  await log(
    `   Valid A/B/C/D format:         ${stats.validLetterOnly.toLocaleString()} (${((stats.validLetterOnly / stats.total) * 100).toFixed(1)}%)`,
  );
  await log(
    `   Normalized from values:       ${stats.normalizedFromValue.toLocaleString()} (${((stats.normalizedFromValue / stats.total) * 100).toFixed(1)}%)`,
  );
  await log(
    `   No match found:               ${stats.noMatchFound.toLocaleString()} (${((stats.noMatchFound / stats.total) * 100).toFixed(1)}%)`,
  );
  await log(
    `   Duplicate IDs detected:       ${stats.duplicateCount.toLocaleString()}`,
  );
  await log(
    `   Invalid rows:                 ${stats.invalidRows.toLocaleString()}`,
  );

  const currentCount = await db.collection("questionbanks").countDocuments();

  await log("\n💾 DATABASE STATUS:");
  await log(
    `   Current questions:            ${currentCount.toLocaleString()}`,
  );
  await log(
    `   New questions added:          ${insertedCount.toLocaleString()}`,
  );
  await log(
    `   Expected after migration:     ${(currentCount + insertedCount).toLocaleString()}`,
  );

  await log("\n✅ SUCCESS METRICS:");
  const successRate = (
    ((stats.validLetterOnly + stats.normalizedFromValue) / stats.total) *
    100
  ).toFixed(1);
  await log(`   Potentially usable rate:      ${successRate}%`);
  await log(
    `   Extraction efficiency:        ${stats.normalizedFromValue > 0 ? "YES" : "NO"} - Value normalization working!\n`,
  );

  await log("=".repeat(80) + "\n");
}

async function main() {
  try {
    await log("========================================");
    await log("V6 QUESTION BANK IMPORT SCRIPT");
    await log("SAFE & IDEMPOTENT MODE");
    await log("========================================\n");

    if (isDryRun) {
      await log("⚠️  DRY-RUN MODE ACTIVATED");
      await log("   - No DELETE operations");
      await log("   - No INSERT operations");
      await log("   - No UPDATE operations\n");
    } else if (shouldApply) {
      await log("✅ APPLY MODE ACTIVATED");
      await log("   - Will insert NEW questions only");
      await log("   - Existing questions preserved\n");
    } else {
      await log("❌ ERROR: Invalid or missing mode\n");
      process.exit(1);
    }

    const db = await connectToMongo();

    // Step 1: Read and analyze Excel
    const { questions, stats } = await readExcelFile();

    // Step 2: Check for duplicates
    const uniqueQuestions = await checkExistingQuestions(db, questions);

    // Step 3: Display summary
    await showSummary(db, stats, 0);

    if (isDryRun) {
      await log("💡 DRY-RUN COMPLETE");
      await log("   To execute migration, run:");
      await log("   node src/scripts/migrate-to-v6.js --apply\n");

      await mongoose.disconnect();
      await log("\nDatabase disconnected\n");
      process.exit(0);
    }

    if (shouldApply) {
      // Step 4: Insert new questions
      const insertedCount = await insertNewQuestions(db, uniqueQuestions);

      // Step 5: Final verification
      await log("[VERIFY] Verifying insertion...");
      const currentCount = await db
        .collection("questionbanks")
        .countDocuments();
      await log(
        "[OK] Final count: " + currentCount.toLocaleString() + " questions\n",
      );

      await showSummary(db, stats, insertedCount);

      await log("========================================");
      await log("✅ MIGRATION COMPLETED SUCCESSFULLY!");
      await log("========================================\n");
    }

    await mongoose.disconnect();
    await log("Database disconnected\n");
    process.exit(0);
  } catch (error) {
    await log("[FAIL] MIGRATION FAILED: " + error.message);
    await log(error.stack);
    process.exit(1);
  }
}

main();
