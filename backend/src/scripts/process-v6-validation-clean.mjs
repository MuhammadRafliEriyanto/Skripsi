/**
 * VALIDATION SCRIPT V7 - CLEAN REGENERATION FROM SOURCE
 *
 * TARGET: Ensure each source row maps to exactly ONE output category
 * INVARIANT: VALID + FIXED + STILL-INVALID = SOURCE TOTAL
 *
 * SECURITY: NO DATABASE OPERATIONS
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import exceljs from "exceljs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// CONFIGURATION
// ============================================================================

const SOURCE_FILE =
  "outputs/assessment-bank-rekap/REKAP-BANK-SOAL-VARIED-V6.xlsx";
const OUTPUT_DIR = "outputs/assessment-bank-rekap";

const VALID_FILE = path.join(
  OUTPUT_DIR,
  "REKAP-BANK-SOAL-VARIED-V6-VALID.xlsx",
);
const FIXED_FILE = path.join(
  OUTPUT_DIR,
  "REKAP-BANK-SOAL-VARIED-V6-FIXED.xlsx",
);
const INVALID_FILE = path.join(
  OUTPUT_DIR,
  "REKAP-BANK-SOAL-VARIED-V6-STILL-INVALID.xlsx",
);

// Error categories
const ERROR_CATEGORIES = {
  ANSWER_NOT_FOUND_IN_OPTIONS: "ANSWER_NOT_FOUND_IN_OPTIONS",
  NUMERIC_NORMALIZATION_NEEDED: "NUMERIC_NORMALIZATION_NEEDED",
  EMPTY_REQUIRED_FIELD: "EMPTY_REQUIRED_FIELD",
  DUPLICATE_ID: "DUPLICATE_ID",
  MULTIPLE_MATCHES: "MULTIPLE_MATCHES",
  OTHER: "OTHER",
};

// Track all processed IDs globally
const processedIds = new Set();

// ExcelJS is imported directly via ES modules
const Workbook = exceljs.Workbook;

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Normalize string to lowercase without extra characters
 */
function normalizeString(str) {
  if (!str) return "";
  return String(str).trim().toLowerCase();
}

/**
 * CRITICAL: Normalize number preserving sign correctly
 * @param {string|number|null} str
 * @returns {number|null}
 */
function normalizeNumber(str) {
  if (str === null || str === undefined || str === "") return null;

  const strVal = String(str);

  // Handle negative numbers FIRST - preserve minus sign
  if (strVal.startsWith("-")) {
    const num = parseFloat(strVal);
    return isNaN(num) ? null : num; // ✅ Correctly handles -5
  }

  // For positive numbers, remove non-numeric characters except .
  const cleaned = strVal.replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Parse fraction like "1/2" to decimal
 */
function parseFraction(str) {
  if (!str) return null;
  const fracMatch = String(str).match(/^(-?\d+)\s*\/\s*(-?\d+)$/);
  if (fracMatch) {
    const numerator = parseFloat(fracMatch[1]);
    const denominator = parseFloat(fracMatch[2]);
    if (denominator !== 0 && !isNaN(numerator) && !isNaN(denominator)) {
      return numerator / denominator;
    }
  }
  return null;
}

/**
 * Convert string to typed value object
 */
function stringToValue(str) {
  if (!str) return null;

  const normalized = normalizeString(str);

  // Try numeric first
  const num = normalizeNumber(str);
  if (num !== null) return { type: "number", value: num };

  // Try fraction
  const frac = parseFraction(str);
  if (frac !== null) return { type: "fraction", value: frac };

  // Return as string
  return { type: "string", value: normalized };
}

/**
 * Compare two values accounting for different representations
 */
function valuesMatch(val1, val2) {
  if (val1 === null || val2 === null) return false;

  if (val1.type === val2.type) {
    return val1.value === val2.value;
  } else if (val1.type === "number" && val2.type === "string") {
    const strAsNum = parseFloat(val2.value);
    return !isNaN(strAsNum) && Math.abs(val1.value - strAsNum) < 0.0001;
  } else if (val1.type === "string" && val2.type === "number") {
    const strAsNum = parseFloat(val1.value);
    return !isNaN(strAsNum) && Math.abs(strAsNum - val2.value) < 0.0001;
  } else if (val1.type === "fraction" && val2.type === "number") {
    return Math.abs(val1.value - val2.value) < 0.0001;
  } else if (val1.type === "number" && val2.type === "fraction") {
    return Math.abs(val1.value - val2.value) < 0.0001;
  }

  return false;
}

/**
 * Validate answer key against options
 * Returns: { isValid: boolean, matchCount: number, matches: Array<{index, value}> }
 */
function validateAnswer(answerKey, optionA, optionB, optionC, optionD) {
  const target = stringToValue(answerKey);
  if (!target)
    return {
      isValid: false,
      matchCount: 0,
      matches: [],
      reason: "Empty answer",
    };

  const options = [
    { index: "A", value: optionA },
    { index: "B", value: optionB },
    { index: "C", value: optionC },
    { index: "D", value: optionD },
  ];

  const matches = [];
  for (const opt of options) {
    const optVal = stringToValue(opt.value);
    if (optVal && valuesMatch(target, optVal)) {
      matches.push({ index: opt.index, value: opt.value });
    }
  }

  const isValid = matches.length === 1;
  return { isValid, matchCount: matches.length, matches };
}

/**
 * Attempt auto-fix if single clear match exists
 */
function tryAutoFix(question) {
  const { answer, optionA, optionB, optionC, optionD } = question;

  // If already in A/B/C/D format, skip auto-fix
  if (/^[ABCD]$/i.test(answer)) {
    return { canFix: false, reason: "Already in letter format" };
  }

  const validation = validateAnswer(answer, optionA, optionB, optionC, optionD);

  // Only fix if exactly ONE match
  if (validation.isValid && validation.matches.length === 1) {
    return {
      canFix: true,
      fixedAnswer: validation.matches[0].index,
      originalAnswer: answer,
      fixCategory: "NUMERIC_NORMALIZATION_NEEDED",
      fixDetail: `Correct answer '${answer}' matches option ${validation.matches[0].index}`,
    };
  }

  return {
    canFix: false,
    reason: validation.matchCount > 1 ? "Multiple matches" : "No match found",
  };
}

// ============================================================================
// FILE PROCESSING
// ============================================================================

async function readSourceFile() {
  console.log(`📖 Reading source file: ${SOURCE_FILE}`);

  const workbook = new Workbook();
  await workbook.xlsx.readFile(path.join(__dirname, "..", SOURCE_FILE));

  const worksheet = workbook.worksheets[0];
  const totalRows = worksheet.rowCount - 1; // Subtract header

  console.log(`✅ Source loaded: ${totalRows.toLocaleString()} rows`);

  return { workbook, worksheet, totalRows };
}

async function exportToFile(filePath, data, columns, auditColumns = []) {
  const workbook = new Workbook();
  const worksheet = workbook.addWorksheet("Questions");

  // Header row
  const header = [...columns];
  if (auditColumns.length > 0) {
    header.push(...auditColumns);
  }
  worksheet.addRow(header);

  // Data rows
  for (const item of data) {
    const rowData = [];
    for (const col of columns) {
      rowData.push(item[col]);
    }
    if (auditColumns.length > 0) {
      for (const auditCol of auditColumns) {
        rowData.push(item[auditCol] || "");
      }
    }
    worksheet.addRow(rowData);
  }

  await workbook.xlsx.writeFile(filePath);
  console.log(`✅ Exported: ${filePath} (${data.length} rows)`);
}

// ============================================================================
// MAIN PROCESSING
// ============================================================================

async function main() {
  console.log("\n========================================");
  console.log("VALIDATION SCRIPT V7 - CLEAN START");
  console.log("========================================\n");

  // Clear any old output files before processing (handle locked files)
  console.log("🗑️  Cleaning up old output files...");
  [VALID_FILE, FIXED_FILE, INVALID_FILE].forEach((file) => {
    if (fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
        console.log(`   Deleted: ${path.basename(file)}`);
      } catch (err) {
        // If file is locked, just skip deletion - will overwrite later
        console.log(`   Skipped (locked): ${path.basename(file)}`);
      }
    }
  });

  // Read source
  const { worksheet, totalRows } = await readSourceFile();

  const results = {
    valid: [],
    fixed: [],
    invalid: [],
  };

  let duplicateCount = 0;

  // Process each row (skip header row)
  for (let i = 2; i <= worksheet.rowCount; i++) {
    const row = worksheet.getRow(i);

    // Extract fields (1-indexed columns)
    const questionId = row.getCell(1).value;
    const program = row.getCell(2).value;
    const subject = row.getCell(3).value;
    const topic = row.getCell(4).value;
    const questionText = row.getCell(5).value;
    const optionA = row.getCell(6).value;
    const optionB = row.getCell(7).value;
    const optionC = row.getCell(8).value;
    const optionD = row.getCell(9).value;
    const answerKey = row.getCell(10).value;

    // Check for duplicates
    if (processedIds.has(questionId)) {
      duplicateCount++;
      results.invalid.push({
        questionId,
        program,
        subject,
        topic,
        questionText,
        optionA,
        optionB,
        optionC,
        optionD,
        correctAnswer: answerKey,
        correctAnswerOriginal: answerKey,
        errorCategory: ERROR_CATEGORIES.DUPLICATE_ID,
        errorDetail: `Duplicate ID detected`,
        suggestedFix: "Manual review required",
      });
      continue;
    }
    processedIds.add(questionId);

    const question = {
      questionId,
      program,
      subject,
      topic,
      questionText,
      optionA,
      optionB,
      optionC,
      optionD,
      answer: answerKey,
    };

    // Validate
    const validationResult = validateAnswer(
      answerKey,
      optionA,
      optionB,
      optionC,
      optionD,
    );

    if (validationResult.isValid) {
      // Valid answer
      results.valid.push({
        questionId,
        program,
        subject,
        topic,
        questionText,
        optionA,
        optionB,
        optionC,
        optionD,
        correctAnswer: answerKey,
        correctAnswerOriginal: answerKey,
      });
    } else {
      // Try auto-fix
      const fixResult = tryAutoFix(question);

      if (fixResult.canFix) {
        results.fixed.push({
          questionId,
          program,
          subject,
          topic,
          questionText,
          optionA,
          optionB,
          optionC,
          optionD,
          correctAnswer: fixResult.fixedAnswer,
          correctAnswerOriginal: answerKey,
          originalAnswer: answerKey,
          fixedAnswer: fixResult.fixedAnswer,
          fixCategory: fixResult.fixCategory,
          fixDetail: fixResult.fixDetail,
        });
      } else {
        // Determine error category
        let errorCategory;
        if (validationResult.matchCount > 1) {
          errorCategory = ERROR_CATEGORIES.MULTIPLE_MATCHES;
        } else {
          errorCategory = ERROR_CATEGORIES.ANSWER_NOT_FOUND_IN_OPTIONS;
        }

        results.invalid.push({
          questionId,
          program,
          subject,
          topic,
          questionText,
          optionA,
          optionB,
          optionC,
          optionD,
          correctAnswer: answerKey,
          correctAnswerOriginal: answerKey,
          errorCategory,
          errorDetail: validationResult.reason || "Validation failed",
          suggestedFix: "Manual review required",
        });
      }
    }
  }

  // Export all three files
  console.log("\n📤 Exporting output files...\n");

  const validCols = [
    "questionId",
    "program",
    "subject",
    "topic",
    "questionText",
    "optionA",
    "optionB",
    "optionC",
    "optionD",
    "correctAnswer",
    "correctAnswerOriginal",
  ];

  const fixedCols = [
    "questionId",
    "program",
    "subject",
    "topic",
    "questionText",
    "optionA",
    "optionB",
    "optionC",
    "optionD",
    "correctAnswer",
    "correctAnswerOriginal",
    "originalAnswer",
    "fixedAnswer",
    "fixCategory",
    "fixDetail",
  ];

  const invalidCols = [
    "questionId",
    "program",
    "subject",
    "topic",
    "questionText",
    "optionA",
    "optionB",
    "optionC",
    "optionD",
    "correctAnswer",
    "correctAnswerOriginal",
  ];

  const invalidAudit = ["errorCategory", "errorDetail", "suggestedFix"];

  // Export VALID
  await exportToFile(VALID_FILE, results.valid, validCols);

  // Export FIXED
  await exportToFile(FIXED_FILE, results.fixed, fixedCols);

  // Export INVALID
  await exportToFile(INVALID_FILE, results.invalid, invalidCols, invalidAudit);

  // ========================================================================
  // INTEGRITY CHECKS
  // ========================================================================

  console.log("\n========================================");
  console.log("INTEGRITY VERIFICATION");
  console.log("========================================\n");

  // Re-read files independently
  const validWorkbook = new Workbook();
  await validWorkbook.xlsx.readFile(VALID_FILE);
  const validRowCount = validWorkbook.worksheets[0].rowCount - 1;

  const fixedWorkbook = new Workbook();
  await fixedWorkbook.xlsx.readFile(FIXED_FILE);
  const fixedRowCount = fixedWorkbook.worksheets[0].rowCount - 1;

  const invalidWorkbook = new Workbook();
  await invalidWorkbook.xlsx.readFile(INVALID_FILE);
  const invalidRowCount = invalidWorkbook.worksheets[0].rowCount - 1;

  const validSet = new Set();
  const fixedSet = new Set();
  const invalidSet = new Set();

  // Collect unique IDs from each output
  for (let i = 2; i <= validWorkbook.worksheets[0].rowCount; i++) {
    validSet.add(validWorkbook.worksheets[0].getRow(i).getCell(1).value);
  }

  for (let i = 2; i <= fixedWorkbook.worksheets[0].rowCount; i++) {
    fixedSet.add(fixedWorkbook.worksheets[0].getRow(i).getCell(1).value);
  }

  for (let i = 2; i <= invalidWorkbook.worksheets[0].rowCount; i++) {
    invalidSet.add(invalidWorkbook.worksheets[0].getRow(i).getCell(1).value);
  }

  // Calculate overlaps
  const allOutputIds = new Set([...validSet, ...fixedSet, ...invalidSet]);
  const overlappingIds = new Set();

  for (const id of validSet) {
    if (fixedSet.has(id) || invalidSet.has(id)) {
      overlappingIds.add(id);
    }
  }
  for (const id of fixedSet) {
    if (invalidSet.has(id)) {
      overlappingIds.add(id);
    }
  }

  // Final report
  console.log("📊 COUNT SUMMARY");
  console.log("=".repeat(40));
  console.log(`SOURCE TOTAL           : ${totalRows.toLocaleString()}`);
  console.log(
    `VALID COUNT            : ${results.valid.length.toLocaleString()}`,
  );
  console.log(
    `FIXED COUNT            : ${results.fixed.length.toLocaleString()}`,
  );
  console.log(
    `STILL INVALID COUNT    : ${results.invalid.length.toLocaleString()}`,
  );
  console.log("-".repeat(40));
  console.log(
    `TOTAL OUTPUT           : ${(results.valid.length + results.fixed.length + results.invalid.length).toLocaleString()}`,
  );
  console.log(`UNIQUE OUTPUT ID       : ${allOutputIds.size.toLocaleString()}`);
  console.log(`DUPLICATE ID           : ${duplicateCount}`);
  console.log(`OVERLAPPING ID         : ${overlappingIds.size}`);
  console.log("");

  // Verification
  const invariantOk =
    results.valid.length + results.fixed.length + results.invalid.length ===
    totalRows;
  const uniqueOk =
    allOutputIds.size === validRowCount + fixedRowCount + invalidRowCount;
  const overlapOk = overlappingIds.size === 0;

  console.log("✅ VERIFICATION RESULTS");
  console.log("=".repeat(40));
  console.log(
    `INVARIANT MET:           ${invariantOk ? "YES ✓" : "NO ✗"} (${results.valid.length + results.fixed.length + results.invalid.length} === ${totalRows})`,
  );
  console.log(`UNIQUE IDS:              ${uniqueOk ? "YES ✓" : "NO ✗"}`);
  console.log(`NO OVERLAP:              ${overlapOk ? "YES ✓" : "NO ✗"}`);
  console.log("");

  if (invariantOk && uniqueOk && overlapOk) {
    console.log("🎉 PROCESS COMPLETED SUCCESSFULLY");
    console.log("All integrity checks passed!\n");
    process.exit(0);
  } else {
    console.log("⚠️  PROCESS FAILED INTEGRITY CHECKS");
    console.log("DO NOT proceed to next stage until issues are resolved.\n");

    if (!invariantOk) {
      console.log("ISSUE: VALID + FIXED + INVALID != SOURCE TOTAL");
    }
    if (!uniqueOk) {
      console.log("ISSUE: Duplicate IDs within outputs");
    }
    if (!overlapOk) {
      console.log("ISSUE: Overlapping IDs across outputs");
      if (overlappingIds.size <= 10) {
        console.log("Overlapping IDs:", Array.from(overlappingIds));
      }
    }

    process.exit(1);
  }
}

main().catch((err) => {
  console.error("❌ Fatal error:", err.message);
  console.error(err.stack);
  process.exit(1);
});
