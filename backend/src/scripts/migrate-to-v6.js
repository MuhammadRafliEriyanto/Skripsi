// Migration Script: Replace Old Bank Soal with V6 Data
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { Workbook } = require("exceljs");

const EXCEL_FILE = path.join(
  __dirname,
  "../../outputs/assessment-bank-rekap/REKAP-BANK-SOAL-VARIED-V6.xlsx",
);
const BACKUP_DIR = path.join(__dirname, "../backups");
const BACKUP_FILE = path.join(
  BACKUP_DIR,
  `backup-before-v6-migration-${new Date().toISOString().slice(0, 10)}.json`,
);
const LOG_FILE = path.join(
  BACKUP_DIR,
  `migration-log-${new Date().toISOString().slice(0, 10)}.log`,
);

// REQUIREMENT: MONGO_URI must be set in environment variables
// No fallbacks allowed - ensures consistent database configuration across all environments
if (!process.env.MONGO_URI) {
  console.error('\n❌ ERROR: MONGO_URI environment variable is required');
  console.error('   Please set MONGO_URI in backend/.env file');
  console.error('   Example: MONGO_URI=mongodb://localhost:27017/your_database');
  console.error('');
  console.error('   For Atlas cluster use:');
  console.error('   MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/database');
  console.error('');
  process.exit(1);
}

const MONGODB_URI = process.env.MONGO_URI;

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

async function createBackup(db) {
  await log("[OK] Creating backup of current questions collection...");
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  const collection = db.collection("questionbanks");
  const questions = await collection.find({}).toArray();
  const backupData = {
    backupDate: new Date().toISOString(),
    totalCount: questions.length,
    questions: questions,
  };
  fs.writeFileSync(BACKUP_FILE, JSON.stringify(backupData, null, 2));
  await log(
    "[OK] Backup created: " +
      questions.length +
      " questions saved to " +
      BACKUP_FILE,
  );
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

  for (let i = 2; i <= rowCount; i++) {
    const row = worksheet.getRow(i);

    // Get values by column index (1-based) - CORRECT MAPPING
    const programKelas = row.getCell(1).value; // Col 1: Program/Kelas
    const mataPelajaran = row.getCell(2).value; // Col 2: Mata Pelajaran
    const topik = row.getCell(3).value; // Col 3: Topik/Materi
    const question = row.getCell(9).value; // Col 9: Soal (IMPORTANT!)
    const optionA = row.getCell(10).value; // Col 10: Opsi A
    const optionB = row.getCell(11).value; // Col 11: Opsi B
    const optionC = row.getCell(12).value; // Col 12: Opsi C
    const optionD = row.getCell(13).value; // Col 13: Opsi D
    const correctAnswer = row.getCell(14).value; // Col 14: Kunci Jawaban (already A,B,C,D)

    // Validate required fields
    if (
      !question ||
      !correctAnswer ||
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

    // Ensure correct answer is uppercase letter
    const cleanAnswer = String(correctAnswer || "")
      .trim()
      .toUpperCase()
      .charAt(0);
    if (!["A", "B", "C", "D"].includes(cleanAnswer)) {
      invalidRows++;
      continue;
    }

    // Create unique question ID
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

  await log(
    "[OK] Extracted " +
      questions.length +
      " valid questions (" +
      invalidRows +
      " invalid rows skipped)",
  );
  return questions;
}

async function validateQuestions(questions) {
  await log("[VERIFY] Validating questions data...");
  const errors = [];
  const warnings = [];

  const seenIds = new Set();
  for (const q of questions) {
    if (seenIds.has(q.questionId)) {
      errors.push("Duplicate questionId: " + q.questionId);
    }
    seenIds.add(q.questionId);

    if (!["A", "B", "C", "D"].includes(q.correctAnswer)) {
      warnings.push(
        "Invalid answer format: " + q.questionId + " -> " + q.correctAnswer,
      );
    }

    if (q.questionText.length > 2000) {
      warnings.push(
        "Question too long: " +
          q.questionId +
          " (" +
          q.questionText.length +
          " chars)",
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join(", "));
  }

  await log("[OK] Validation passed");
  if (warnings.length > 0) {
    for (const w of warnings) {
      await log("[WARN] Warning: " + w);
    }
  }

  return { valid: true, warnings };
}

async function dropOldCollection(db) {
  await log("[DELETE] Removing old questions collection...");
  const collection = db.collection("questionbanks");
  const count = await collection.countDocuments({});
  await collection.deleteMany({});
  await log("[OK] Removed " + count + " old questions from database");
}

async function insertNewQuestions(db, questions) {
  await log("[INSERT] Inserting " + questions.length + " new questions...");
  const collection = db.collection("questionbanks");
  const chunks = [];
  for (let i = 0; i < questions.length; i += 1000) {
    chunks.push(questions.slice(i, i + 1000));
  }

  let totalInserted = 0;
  for (let i = 0; i < chunks.length; i++) {
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
  }

  await log(
    "[OK] All " + questions.length + " questions inserted successfully",
  );
}

async function verifyMigration(db, expectedCount) {
  await log("[VERIFY] Verifying migration...");
  const collection = db.collection("questionbanks");
  const actualCount = await collection.countDocuments({});

  if (actualCount !== expectedCount) {
    throw new Error(
      "Migration verification failed! Expected " +
        expectedCount +
        ", got " +
        actualCount,
    );
  }

  const sample = await collection.findOne({});
  if (!sample) {
    throw new Error("Sample query returned no results");
  }

  await log("[OK] Migration verified successfully!");
  await log("   - Total questions: " + actualCount);
  await log("   - Sample question ID: " + sample.questionId);
  const subjects = await collection.distinct("subject");
  await log("   - Subject coverage: " + subjects.join(", "));
}

async function main() {
  try {
    await log("========================================");
    await log("STARTING BANK SOAL MIGRATION TO V6");
    await log("========================================");

    await log("[CONNECT] Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;
    await log("[OK] Connected to database");

    const backupData = await createBackup(db);
    const questions = await readExcelFile();
    await validateQuestions(questions);
    await dropOldCollection(db);
    await insertNewQuestions(db, questions);
    await verifyMigration(db, questions.length);

    await log("========================================");
    await log("[OK] MIGRATION COMPLETED SUCCESSFULLY!");
    await log("========================================");
    await log("Summary:");
    await log("  - Backup: " + BACKUP_FILE);
    await log("  - Questions migrated: " + questions.length);
    await log("  - Log file: " + LOG_FILE);
    await log("========================================");

    process.exit(0);
  } catch (error) {
    await log("[FAIL] MIGRATION FAILED: " + error.message);
    await log(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    await log("Database disconnected");
  }
}

main();
