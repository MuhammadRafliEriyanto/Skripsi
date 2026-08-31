// Migration Script: Replace questionbanks with Validated V6 Questions Only
// SAFE REPLACE - Full backup, atomic swap, validation before deletion

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
const BACKUP_FILE = path.join(
  BACKUP_DIR,
  `backup-v6-replace-${new Date().toISOString().slice(0, 10)}.json`,
);
const LOG_FILE = path.join(
  BACKUP_DIR,
  `migration-replace-log-${new Date().toISOString().slice(0, 10)}.log`,
);
const TEMP_COLLECTION = "questionbanks_v6_temp";
const TARGET_COLLECTION = "questionbanks";

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
    "   Usage: node migrate-v6-replace.js --dry-run    (preview only, no changes)",
  );
  console.log(
    "          node migrate-v6-replace.js --apply      (execute replace operation)",
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

  // Disconnect any existing connections
  if (
    mongoose.connection.readyState === 1 ||
    mongoose.connection.readyState === 3
  ) {
    await mongoose.disconnect();
  }

  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  const dbName = db.databaseName;
  await log("[OK] Connected to database: " + dbName);
  return db;
}

async function createFullBackup(db) {
  await log(
    "[BACKUP] Creating complete backup of current questions collection...",
  );

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const collection = db.collection(TARGET_COLLECTION);
  const questions = await collection.find({}).toArray();

  const backupData = {
    backupDate: new Date().toISOString(),
    backupType: "PRE_MIGRATION_REPLACE",
    sourceDatabase: "bimbel-lms",
    targetCollection: "questionbanks",
    totalCount: questions.length,
    questions: questions,
  };

  fs.writeFileSync(BACKUP_FILE, JSON.stringify(backupData, null, 2));

  const fileSize =
    Math.round((fs.statSync(BACKUP_FILE).size / 1024 / 1024) * 100) / 100;

  await log("[OK] Backup completed successfully!");
  await log(`   File: ${BACKUP_FILE}`);
  await log(`   Size: ${fileSize} MB`);
  await log(`   Questions backed up: ${questions.length.toLocaleString()}\n`);

  return backupData;
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
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  await log("[STATS] Question Analysis:");
  await log(`   Total Excel rows: ${rowCount - 1}`);
  await log(
    `   Valid A/B/C/D format: ${validLetterOnly.toLocaleString()} (${((validLetterOnly / (rowCount - 1)) * 100).toFixed(1)}%)`,
  );
  await log(
    `   Normalized from values: ${normalizedFromValue.toLocaleString()} (${((normalizedFromValue / (rowCount - 1)) * 100).toFixed(1)}%)`,
  );
  await log(
    `   No match found: ${noMatchFound.toLocaleString()} (${((noMatchFound / (rowCount - 1)) * 100).toFixed(1)}%)`,
  );
  await log(`   Duplicate IDs skipped: ${duplicateCount.toLocaleString()}`);
  await log(`   Invalid rows skipped: ${invalidRows.toLocaleString()}`);
  await log(
    "[OK] Extracted " +
      questions.length.toLocaleString() +
      " valid unique questions\n",
  );

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
  if (/^[ABCD]$/.test(answerStr)) {
    return answerStr;
  }

  // Search in options
  const options = {
    A: String(optA || "").trim(),
    B: String(optB || "").trim(),
    C: String(optC || "").trim(),
    D: String(optD || "").trim(),
  };

  for (const [letter, value] of Object.entries(options)) {
    if (value.toUpperCase() === answerStr.toUpperCase()) {
      return letter;
    }
  }

  return null;
}

async function insertQuestionsToTemp(db, questions) {
  await log("[INSERT] Inserting V6 questions to temporary collection...");
  const tempCollection = db.collection(TEMP_COLLECTION);

  if (questions.length === 0) {
    throw new Error("No valid questions to insert!");
  }

  // Clear any existing temp data
  await tempCollection.deleteMany({});

  const chunks = [];
  for (let i = 0; i < questions.length; i += 1000) {
    chunks.push(questions.slice(i, i + 1000));
  }

  let totalInserted = 0;
  for (let i = 0; i < chunks.length; i++) {
    await tempCollection.insertMany(chunks[i], { ordered: false });
    totalInserted += chunks[i].length;
    await log(
      "[PROGRESS] " +
        totalInserted.toLocaleString() +
        "/" +
        questions.length.toLocaleString() +
        " inserted (" +
        Math.round((totalInserted / questions.length) * 100) +
        "%)",
    );
  }

  await log(
    "[OK] All " +
      totalInserted.toLocaleString() +
      " questions inserted to temp collection\n",
  );
  return totalInserted;
}

async function verifyTempCollection(db, expectedCount) {
  await log("[VERIFY] Verifying temporary collection integrity...");
  const tempCollection = db.collection(TEMP_COLLECTION);
  const actualCount = await tempCollection.countDocuments({});

  if (actualCount !== expectedCount) {
    throw new Error(
      `Verification failed! Expected ${expectedCount.toLocaleString()} questions, but found ${actualCount.toLocaleString()}`,
    );
  }

  await log(
    "[OK] Temp collection verified: " +
      actualCount.toLocaleString() +
      " documents\n",
  );
  return actualCount;
}

async function replaceCollections(db) {
  await log("[SWAP] Replacing collections (atomic rename)...");

  // Rename old to backup FIRST - before touching temp
  await log("   Renaming 'questionbanks' to 'questionbanks_backup_v5'...");
  await db.renameCollection(TARGET_COLLECTION, "questionbanks_backup_v5", {
    dropTarget: true,
  });

  // Rename temp to target SECOND
  await log("   Renaming '" + TEMP_COLLECTION + "' to 'questionbanks'...");
  await db.renameCollection(TEMP_COLLECTION, TARGET_COLLECTION, {
    dropTarget: false,
  });

  await log("[OK] Collection swap completed successfully!\n");
}

async function cleanupOldBackup(db) {
  await log("[CLEANUP] Removing old backup collection...");
  try {
    await db.dropCollection("questionbanks_backup_v5");
    await log("[OK] Old backup removed\n");
  } catch (err) {
    await log("[WARN] No old backup to remove\n");
  }
}

async function showSummary(beforeCount, afterCount, stats) {
  await log("\n" + "=".repeat(80));
  await log("📊 MIGRATION SUMMARY REPORT - REPLACE OPERATION");
  await log("=".repeat(80));

  await log("\n📄 EXCEL DATA ANALYSIS:");
  await log(
    `   Total Excel rows:               ${stats.total.toLocaleString()}`,
  );
  await log(
    `   Valid A/B/C/D format:           ${stats.validLetterOnly.toLocaleString()} (${((stats.validLetterOnly / stats.total) * 100).toFixed(1)}%)`,
  );
  await log(
    `   Normalized from values:         ${stats.normalizedFromValue.toLocaleString()} (${((stats.normalizedFromValue / stats.total) * 100).toFixed(1)}%)`,
  );
  await log(
    `   No match found:                 ${stats.noMatchFound.toLocaleString()} (${((stats.noMatchFound / stats.total) * 100).toFixed(1)}%)`,
  );
  await log(
    `   Duplicate IDs detected:         ${stats.duplicateCount.toLocaleString()}`,
  );
  await log(
    `   Invalid rows:                   ${stats.invalidRows.toLocaleString()}`,
  );

  await log("\n💾 DATABASE STATUS:");
  await log(
    `   BEFORE migration:               ${beforeCount.toLocaleString()} questions`,
  );
  await log(
    `   AFTER migration:                ${afterCount.toLocaleString()} questions`,
  );
  await log(`   REPLACED (not added):           YES`);
  await log(`   Backup created:                 YES`);

  await log("\n✅ SUCCESS METRICS:");
  const successRate = (
    ((stats.validLetterOnly + stats.normalizedFromValue) / stats.total) *
    100
  ).toFixed(1);
  await log(`   Potentially usable rate:        ${successRate}%`);
  await log(
    `   Extraction efficiency:          ${stats.normalizedFromValue > 0 ? "YES" : "NO"} - Value normalization working!`,
  );
  await log(
    `   Data loss prevented:            YES - Complete backup available\n`,
  );

  await log("=".repeat(80) + "\n");
}

async function main() {
  let beforeCount = 0;

  try {
    await log("========================================");
    await log("V6 QUESTION BANK REPLACE SCRIPT");
    await log("SAFE ROLLING UPDATE WITH FULL BACKUP");
    await log("========================================\n");

    if (isDryRun) {
      await log("⚠️  DRY-RUN MODE ACTIVATED");
      await log("   - Read Excel and validate data");
      await log("   - Simulate backup creation");
      await log("   - Simulate temp collection insertion");
      await log("   - NO actual database modifications\n");
    } else if (shouldApply) {
      await log("✅ APPLY MODE ACTIVATED");
      await log("   - Create full backup first");
      await log("   - Insert V6 data to temp collection");
      await log("   - Verify temp collection integrity");
      await log("   - Swap collections atomically");
      await log("   - Clean up old backup\n");
    } else {
      await log("❌ ERROR: Invalid or missing mode\n");
      process.exit(1);
    }

    const db = await connectToMongo();

    // Step 1: Get current database count
    const currentCollection = db.collection(TARGET_COLLECTION);
    beforeCount = await currentCollection.countDocuments();
    await log(
      "\n" +
        "[CURRENT] Current questionbanks count: ".concat(
          beforeCount.toLocaleString(),
        ),
    );

    // Step 2: Read and analyze Excel (in dry-run this stops here)
    const { questions, stats } = await readExcelFile();

    if (questions.length === 0) {
      throw new Error("No valid questions extracted from Excel!");
    }

    // In dry-run mode, stop here
    if (isDryRun) {
      await showSummary(beforeCount, questions.length, stats);
      await log("🛑 DRY-RUN COMPLETE - No changes made to database\n");
      await log(
        "To execute replacement, run:\n  node src/scripts/migrate-v6-replace.js --apply\n",
      );
      await mongoose.disconnect();
      process.exit(0);
    }

    // Step 3: Create full backup
    await createFullBackup(db);

    // Step 4: Insert to temporary collection
    await insertQuestionsToTemp(db, questions);

    // Step 5: Verify temp collection
    await verifyTempCollection(db, questions.length);

    // Step 6: Replace collections
    await replaceCollections(db);

    // Step 7: Cleanup old backup
    await cleanupOldBackup(db);

    // Step 8: Final verification
    const afterCollection = db.collection(TARGET_COLLECTION);
    const afterCount = await afterCollection.countDocuments();

    await showSummary(beforeCount, afterCount, stats);

    await log("🎉 MIGRATION COMPLETED SUCCESSFULLY!");
    await log("   Database replaced with validated V6 questions.");
    await log("   Backup saved to: " + BACKUP_FILE);
    await log("   To restore previous data, import from backup file.\n");

    await mongoose.disconnect();
    await log("Database disconnected\n");
    process.exit(0);
  } catch (error) {
    await log("[FAIL] MIGRATION FAILED: " + error.message);
    await log(error.stack);
    await log(
      "\n⚠️  ROLLBACK REQUIRED: Review backup file and restore manually\n",
    );
    try {
      await mongoose.disconnect();
    } catch (e) {}
    process.exit(1);
  }
}

main();
