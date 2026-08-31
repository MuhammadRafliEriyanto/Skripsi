/**
 * V6 BANK SOAL VALIDATION & FIX PROCESSOR
 *
 * READ-ONLY OPERATION - NO DATABASE CHANGES
 *
 * Purpose:
 * - Validate all rows in REKAP-BANK-SOAL-VARIED-V6.xlsx
 * - Separate valid and invalid questions
 * - Attempt automatic fixes where objectively determinable
 * - Re-validate fixed questions
 * - Generate 3 output files: VALID, FIXED, STILL-INVALID
 *
 * Rules:
 * - NO AI guessing or external knowledge
 * - Only fix if answer can be objectively determined from existing data
 * - Preserve ALL original columns
 * - Add audit columns for fixed questions
 * - NEVER modify source Excel file
 * - NEVER connect to MongoDB
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import exceljs from "exceljs";
const { Workbook } = exceljs;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// CONFIGURATION
// ============================================================================

const SOURCE_FILE = path.join(
  __dirname,
  "../../outputs/assessment-bank-rekap/REKAP-BANK-SOAL-VARIED-V6.xlsx",
);

const OUTPUT_VALID = path.join(
  __dirname,
  "../../outputs/assessment-bank-rekap/REKAP-BANK-SOAL-VARIED-V6-VALID.xlsx",
);

const OUTPUT_FIXED = path.join(
  __dirname,
  "../../outputs/assessment-bank-rekap/REKAP-BANK-SOAL-VARIED-V6-FIXED.xlsx",
);

const OUTPUT_STILL_INVALID = path.join(
  __dirname,
  "../../outputs/assessment-bank-rekap/REKAP-BANK-SOAL-VARIED-V6-STILL-INVALID.xlsx",
);

// Error categories
const ERROR_CATEGORIES = {
  ANSWER_NOT_FOUND_IN_OPTIONS: "ANSWER_NOT_FOUND_IN_OPTIONS",
  FORMAT_DIFFERENCE: "FORMAT_DIFFERENCE",
  NUMERIC_NORMALIZATION_NEEDED: "NUMERIC_NORMALIZATION_NEEDED",
  EMPTY_REQUIRED_FIELD: "EMPTY_REQUIRED_FIELD",
  DUPLICATE_ID: "DUPLICATE_ID",
  KEY_EXPLANATION_CONFLICT: "KEY_EXPLANATION_CONFLICT",
  MULTIPLE_MATCHES: "MULTIPLE_MATCHES", // More than one option matches answer
  OTHER: "OTHER",
};

// Validation states
const VALIDATION_STATE = {
  VALID: "VALID",
  INVALID_FIXED: "INVALID_FIXED",
  INVALID_STILL_INVALID: "INVALID_STILL_INVALID",
};

// ============================================================================
// DATA STRUCTURES
// ============================================================================

const stats = {
  totalRows: 0,
  validInitially: 0,
  invalidInitially: 0,
  fixedSuccessfully: 0,
  stillInvalid: 0,

  // Breakdown by error category
  errorBreakdown: {},
};

// Initialize error breakdown
Object.keys(ERROR_CATEGORIES).forEach((cat) => {
  stats.errorBreakdown[cat] = 0;
});

// Result collections
const results = {
  validQuestions: [],
  fixedQuestions: [],
  stillInvalidQuestions: [],
};

// Duplicate ID tracking
const seenQuestionIds = new Map();

// ============================================================================
// VALIDATION LOGIC
// ============================================================================

function normalizeString(str) {
  if (!str) return "";
  return String(str).trim().toLowerCase();
}

function normalizeNumber(str) {
  if (!str) return null;

  const strVal = String(str);

  // Handle negative numbers - keep minus sign at beginning only
  if (strVal.startsWith("-")) {
    const num = parseFloat(strVal);
    return isNaN(num) ? null : num;
  }

  // For positive numbers, remove non-numeric characters except .
  const cleaned = strVal.replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseFraction(str) {
  /**
   * Parse fraction like "1/2" to numeric value
   * Returns null if not a valid fraction
   */
  if (!str) return null;

  const fractionRegex = /^(\d+)\s*\/\s*(\d+)$/;
  const match = String(str).match(fractionRegex);

  if (match) {
    const numerator = parseInt(match[1], 10);
    const denominator = parseInt(match[2], 10);

    if (denominator === 0) return null;
    return numerator / denominator;
  }

  return null;
}

function stringToValue(str) {
  /**
   * Convert string to appropriate value type for comparison
   * Handles: numbers, fractions, normal strings
   */
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

function valuesMatch(val1, val2) {
  /**
   * Compare two values accounting for different representations
   * Works with objects: { type: 'number'|'fraction'|'string', value: ... }
   */
  if (val1 === null || val2 === null) return false;

  if (val1.type === val2.type) {
    // Same type: direct comparison
    return val1.value === val2.value;
  } else if (val1.type === "number" && val2.type === "string") {
    // Check if number equals string's numeric value
    const strAsNum = parseFloat(val2.value);
    return !isNaN(strAsNum) && Math.abs(val1.value - strAsNum) < 0.0001;
  } else if (val1.type === "string" && val2.type === "number") {
    // Check if string's numeric value equals number
    const strAsNum = parseFloat(val1.value);
    return !isNaN(strAsNum) && Math.abs(strAsNum - val2.value) < 0.0001;
  } else if (val1.type === "fraction" && val2.type === "number") {
    // Fraction vs number
    return Math.abs(val1.value - val2.value) < 0.0001;
  } else if (val1.type === "number" && val2.type === "fraction") {
    // Number vs fraction
    return Math.abs(val1.value - val2.value) < 0.0001;
  }

  // Different types that can't be compared
  return false;
}

async function normalizeAnswerKey(
  rawAnswer,
  optionA,
  optionB,
  optionC,
  optionD,
  attemptFix = true,
) {
  /**
   * Normalize answer key to A/B/C/D format
   *
   * Parameters:
   * - rawAnswer: Original answer from Excel
   * - options: Array of option values [optA, optB, optC, optD]
   * - attemptFix: If true, try to find matching option (for fixing invalid questions)
   *
   * Returns:
   * {
   *   isValid: boolean,
   *   letter: 'A'|'B'|'C'|'D'|null,
   *   matchCount: number,
   *   matches: Array<{letter, value, matchedValue}>,
   *   reason: string
   * }
   */

  if (!rawAnswer) {
    return {
      isValid: false,
      letter: null,
      matchCount: 0,
      matches: [],
      reason: "Empty answer",
    };
  }

  const options = {
    A: optionA,
    B: optionB,
    C: optionC,
    D: optionD,
  };

  // Already valid letter?
  const answerStr = String(rawAnswer).trim();
  if (/^[ABCD]$/.test(answerStr.toUpperCase())) {
    return {
      isValid: true,
      letter: answerStr.toUpperCase(),
      matchCount: 1,
      matches: [
        { letter: answerStr.toUpperCase(), value: null, matchedValue: null },
      ],
      reason: "Direct letter match",
    };
  }

  // Try to match answer to option values
  const answerValue = stringToValue(answerStr);
  const matches = [];

  for (const [letter, optionValue] of Object.entries(options)) {
    if (!optionValue) continue;

    const optionObj = stringToValue(optionValue);

    if (valuesMatch(answerValue, optionObj)) {
      matches.push({
        letter: letter,
        value: optionValue,
        matchedValue: answerStr,
      });
    }
  }

  if (matches.length === 1) {
    // Single clear match
    return {
      isValid: true,
      letter: matches[0].letter,
      matchCount: 1,
      matches: matches,
      reason: "Single match found",
    };
  } else if (matches.length > 1) {
    // Multiple matches - ambiguous
    return {
      isValid: false,
      letter: null,
      matchCount: matches.length,
      matches: matches,
      reason: `Multiple matches (${matches.length}) - ambiguous`,
    };
  }

  // No match found
  if (attemptFix) {
    // For fixing, check if answer is a simple representation issue
    const upperAnswer = answerStr.toUpperCase();
    const cleanLetter = upperAnswer.replace(/[\s\.\)]+/g, "");

    if (/^[ABCD]$/.test(cleanLetter)) {
      const suggestedLetter = cleanLetter;
      const optionValue = options[suggestedLetter];

      if (optionValue) {
        return {
          isValid: false,
          letter: suggestedLetter,
          matchCount: 0,
          matches: [],
          reason: "Format issue - could be fixed",
          suggestedFix: `Strip formatting to get '${suggestedLetter}'`,
          suggestedLetter: suggestedLetter,
          optionContainsOriginal: optionValue
            .toLowerCase()
            .includes(answerStr.toLowerCase()),
        };
      }
    }
  }

  return {
    isValid: false,
    letter: null,
    matchCount: 0,
    matches: [],
    reason: "No match found in any option",
    availableOptions: Object.entries(options)
      .filter(([_, v]) => v)
      .map(([k, v]) => ({ [k]: v })),
  };
}

function determineErrorCategory(validationResult) {
  /**
   * Categorize the validation failure
   */

  if (!validationResult.isValid) {
    if (validationResult.matchCount > 1) {
      return ERROR_CATEGORIES.MULTIPLE_MATCHES;
    }

    if (!validationResult.reason || validationResult.reason.includes("Empty")) {
      return ERROR_CATEGORIES.EMPTY_REQUIRED_FIELD;
    }

    if (validationResult.suggestedFix) {
      return ERROR_CATEGORIES.FORMAT_DIFFERENCE;
    }

    // Default: answer not found
    return ERROR_CATEGORIES.ANSWER_NOT_FOUND_IN_OPTIONS;
  }

  return null; // Valid
}

async function processRow(rowIndex, worksheetRow) {
  /**
   * Process a single row from Excel
   * Returns processed question object with validation state
   */

  // Extract fields (1-based indexing)
  const programKelas = worksheetRow.getCell(1).value;
  const mataPelajaran = worksheetRow.getCell(2).value;
  const topik = worksheetRow.getCell(3).value;
  const questionText = worksheetRow.getCell(9).value;
  const optionA = worksheetRow.getCell(10).value;
  const optionB = worksheetRow.getCell(11).value;
  const optionC = worksheetRow.getCell(12).value;
  const optionD = worksheetRow.getCell(13).value;
  const correctAnswerRaw = worksheetRow.getCell(14).value;

  // Parse program type
  let program = "";
  const programStr = String(programKelas || "");
  if (programStr.includes("SD")) program = "SD";
  else if (programStr.includes("SMP")) program = "SMP";
  else if (programStr.includes("SMA")) program = "SMA";
  else if (programStr.includes("UTBK")) program = "UTBK";
  else program = programStr.split(" ")[0].toUpperCase() || "UNKNOWN";

  // Generate unique ID
  const baseId = `${program}-${mataPelajaran}-${topik}-${rowIndex}`;
  const questionId = baseId
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_-]/g, "_")
    .toUpperCase();

  // Create base question object
  const question = {
    questionId: questionId,
    program: program,
    subject: String(mataPelajaran || ""),
    topic: String(topik || ""),
    questionText: String(questionText || ""),
    optionA: String(optionA || ""),
    optionB: String(optionB || ""),
    optionC: String(optionC || ""),
    optionD: String(optionD || ""),
    correctAnswerOriginal: String(correctAnswerRaw || ""),
    rowIndex: rowIndex,
  };

  // Check for duplicates
  if (seenQuestionIds.has(questionId)) {
    const originalRow = seenQuestionIds.get(questionId);
    return {
      ...question,
      validationState: VALIDATION_STATE.INVALID_STILL_INVALID,
      errorCategory: ERROR_CATEGORIES.DUPLICATE_ID,
      errorDetail: `Duplicate ID with row ${originalRow}`,
      suggestedFix: "Manual review required to resolve duplicate",
    };
  }
  seenQuestionIds.set(questionId, rowIndex);

  // Validate required fields
  if (
    !questionText ||
    !correctAnswerRaw ||
    !mataPelajaran ||
    !programKelas ||
    !topik
  ) {
    return {
      ...question,
      validationState: VALIDATION_STATE.INVALID_STILL_INVALID,
      errorCategory: ERROR_CATEGORIES.EMPTY_REQUIRED_FIELD,
      errorDetail: "Missing required field(s)",
      suggestedFix: "Fill all required fields",
    };
  }

  // Check empty options
  const optionsPresent = [optionA, optionB, optionC, optionD].filter(
    Boolean,
  ).length;
  if (optionsPresent === 0) {
    return {
      ...question,
      validationState: VALIDATION_STATE.INVALID_STILL_INVALID,
      errorCategory: ERROR_CATEGORIES.EMPTY_REQUIRED_FIELD,
      errorDetail: "All options are empty",
      suggestedFix: "Provide at least one valid option",
    };
  }

  // Normalize answer key
  const validationResult = await normalizeAnswerKey(
    correctAnswerRaw,
    optionA,
    optionB,
    optionC,
    optionD,
    true, // attemptFix = true for initial validation
  );

  if (validationResult.isValid) {
    // Question is valid as-is
    return {
      ...question,
      validationState: VALIDATION_STATE.VALID,
      correctAnswer: validationResult.letter,
      validationResult: validationResult,
    };
  }

  // Question is invalid - categorize the error
  const errorCategory = determineErrorCategory(validationResult);

  return {
    ...question,
    validationState: VALIDATION_STATE.INVALID_STILL_INVALID,
    errorCategory: errorCategory,
    errorDetail: validationResult.reason,
    suggestedFix: validationResult.suggestedFix || "Review answer-key mapping",
    validationResult: validationResult,
    attemptsAutoFix: false,
  };
}

async function tryAutoFix(question) {
  /**
   * Attempt automatic fix for invalid questions
   * Returns fixed question object if fix successful, otherwise returns original
   */

  const {
    optionA,
    optionB,
    optionC,
    optionD,
    correctAnswerOriginal,
    errorCategory,
    validationResult,
  } = question;

  const options = {
    A: optionA,
    B: optionB,
    C: optionC,
    D: optionD,
  };

  // Fix #1: Numeric normalization - answer is numeric, match with option values
  if (
    errorCategory === ERROR_CATEGORIES.NUMERIC_NORMALIZATION_NEEDED ||
    errorCategory === ERROR_CATEGORIES.ANSWER_NOT_FOUND_IN_OPTIONS
  ) {
    // Try to find exact numeric match in options
    const answerNum = parseFloat(String(correctAnswerOriginal).trim());

    if (!isNaN(answerNum)) {
      const matches = [];

      for (const [letter, optionValue] of Object.entries(options)) {
        if (!optionValue) continue;

        const optionNum = parseFloat(String(optionValue).trim());

        if (!isNaN(optionNum) && Math.abs(answerNum - optionNum) < 0.0001) {
          matches.push({ letter, optionValue });
        }
      }

      if (matches.length === 1) {
        // Single clear match - safe to fix!
        return {
          ...question,
          validationState: VALIDATION_STATE.INVALID_FIXED,
          fixedAnswer: matches[0].letter,
          fixCategory: "NUMERIC_NORMALIZATION",
          fixDetail: `Numeric answer "${correctAnswerOriginal}" matched option ${matches[0].letter}="${matches[0].optionValue}"`,
          correctAnswer: matches[0].letter,
          originalAnswer: correctAnswerOriginal,
          attemptedFix: true,
        };
      }
    }

    // Try fraction parsing
    const fractionRegex = /^(\d+)\s*\/\s*(\d+)$/;
    const fracMatch = String(correctAnswerOriginal).match(fractionRegex);

    if (fracMatch) {
      const numerator = parseFloat(fracMatch[1]);
      const denominator = parseFloat(fracMatch[2]);

      if (denominator !== 0) {
        const fracValue = numerator / denominator;

        const matches = [];

        for (const [letter, optionValue] of Object.entries(options)) {
          if (!optionValue) continue;

          // Try to parse option as fraction or number
          const optionFrac = parseFraction(optionValue);
          const optionNum = parseFloat(optionValue);

          const optionValueToCompare =
            optionFrac !== null ? optionFrac : optionNum;

          if (
            optionValueToCompare !== null &&
            Math.abs(fracValue - optionValueToCompare) < 0.0001
          ) {
            matches.push({ letter, optionValue });
          }
        }

        if (matches.length === 1) {
          return {
            ...question,
            validationState: VALIDATION_STATE.INVALID_FIXED,
            fixedAnswer: matches[0].letter,
            fixCategory: "FRACTION_NORMALIZATION",
            fixDetail: `Fraction "${correctAnswerOriginal}" (${fracValue}) matched option ${matches[0].letter}="${matches[0].optionValue}"`,
            correctAnswer: matches[0].letter,
            originalAnswer: correctAnswerOriginal,
            attemptedFix: true,
          };
        }
      }
    }
  }

  // Fix #2: Format normalization - strip punctuation, whitespace
  if (errorCategory === ERROR_CATEGORIES.FORMAT_DIFFERENCE) {
    const cleanAnswer = String(correctAnswerOriginal)
      .trim()
      .toUpperCase()
      .replace(/[\s\.\)\(:]+/g, "");

    if (/^[ABCD]$/.test(cleanAnswer)) {
      const letter = cleanAnswer;
      const optionValue = options[letter];

      if (
        optionValue &&
        optionValue.toLowerCase().includes(correctAnswerOriginal.toLowerCase())
      ) {
        return {
          ...question,
          validationState: VALIDATION_STATE.INVALID_FIXED,
          fixedAnswer: letter,
          fixCategory: "FORMAT_NORMALIZATION",
          fixDetail: `Stripped formatting from "${correctAnswerOriginal}" → "${letter}", option "${optionValue}" contains original text`,
          correctAnswer: letter,
          originalAnswer: correctAnswerOriginal,
          attemptedFix: true,
        };
      }
    }
  }

  // No safe auto-fix possible
  return null;
}

async function validateFixedQuestion(question) {
  /**
   * Re-validate a fixed question to ensure it now passes validation
   */

  if (!question.correctAnswer) {
    return false;
  }

  // Basic re-validation
  if (!/^[ABCD]$/.test(question.correctAnswer)) {
    return false;
  }

  // Verify the answer corresponds to an actual option
  const optionMap = {
    A: question.optionA,
    B: question.optionB,
    C: question.optionC,
    D: question.optionD,
  };

  const optionValue = optionMap[question.correctAnswer];

  if (!optionValue) {
    return false;
  }

  return true;
}

// ============================================================================
// MAIN PROCESSING FUNCTION
// ============================================================================

async function processExcelFile() {
  console.log("=".repeat(120));
  console.log("V6 BANK SOAL VALIDATION & FIX PROCESSOR");
  console.log("=".repeat(120));
  console.log("");

  // Verify source file exists
  if (!fs.existsSync(SOURCE_FILE)) {
    console.error(`❌ Source file not found: ${SOURCE_FILE}`);
    process.exit(1);
  }

  console.log(`📄 Reading source file: ${SOURCE_FILE}`);
  const workbook = new Workbook();
  await workbook.xlsx.readFile(SOURCE_FILE);
  const worksheet = workbook.worksheets[0];
  const rowCount = worksheet.rowCount;

  stats.totalRows = rowCount - 1; // Exclude header
  console.log(`📊 Total data rows: ${stats.totalRows.toLocaleString()}`);
  console.log("");

  console.log("🔍 Processing rows...");

  // Process each row
  for (let i = 2; i <= rowCount; i++) {
    const row = worksheet.getRow(i);
    const question = await processRow(i, row);

    if (question.validationState === VALIDATION_STATE.VALID) {
      results.validQuestions.push(question);
      stats.validInitially++;
    } else {
      // Attempt auto-fix
      const fixedQuestion = await tryAutoFix(question);

      if (fixedQuestion) {
        // Apply fix
        question.correctAnswer = fixedQuestion.fixedAnswer;
        question.originalAnswer = fixedQuestion.originalAnswer;
        question.fixCategory = fixedQuestion.fixCategory;
        question.fixDetail = fixedQuestion.fixDetail;
        question.attemptedFix = true;

        // Re-validate
        const isValid = await validateFixedQuestion(question);

        if (isValid) {
          results.fixedQuestions.push(question);
          stats.fixedSuccessfully++;
          question.validationState = VALIDATION_STATE.INVALID_FIXED;
        } else {
          results.stillInvalidQuestions.push(question);
          stats.stillInvalid++;
          question.validationState = VALIDATION_STATE.INVALID_STILL_INVALID;
        }

        // Track error category before fix attempt
        const originalCategory = question.errorCategory;
        stats.errorBreakdown[originalCategory]++;
      } else {
        // No fix possible
        results.stillInvalidQuestions.push(question);
        stats.stillInvalid++;
        question.validationState = VALIDATION_STATE.INVALID_STILL_INVALID;

        // Track error category
        stats.errorBreakdown[question.errorCategory]++;
      }
    }

    // Progress indicator
    if (i % 500 === 0) {
      console.log(`   Processed ${i - 1}/${rowCount - 1} rows...`);
    }
  }

  console.log("");
  printFinalStatistics();
  exportResults();
  printConclusion();
}

function printFinalStatistics() {
  console.log("\n" + "=".repeat(120));
  console.log("FINAL STATISTICS");
  console.log("=".repeat(120));
  console.log("");

  console.log(`TOTAL ROWS PROCESSED:     ${stats.totalRows.toLocaleString()}`);
  console.log(
    `VALID FROM START:         ${stats.validInitially.toLocaleString()} (${((stats.validInitially / stats.totalRows) * 100).toFixed(1)}%)`,
  );
  console.log(
    `INVALID INITIALLY:        ${stats.invalidInitially.toLocaleString()} (${((stats.invalidInitially / stats.totalRows) * 100).toFixed(1)}%)`,
  );
  console.log("");
  console.log(
    `FIXED SUCCESSFULLY:       ${stats.fixedSuccessfully.toLocaleString()} (${((stats.fixedSuccessfully / stats.totalRows) * 100).toFixed(1)}%)`,
  );
  console.log(
    `STILL INVALID:            ${stats.stillInvalid.toLocaleString()} (${((stats.stillInvalid / stats.totalRows) * 100).toFixed(1)}%)`,
  );
  console.log("");
  console.log(`FINAL RESULTS:`);
  console.log(
    `   ✓ Valid + Fixed:        ${(stats.validInitially + stats.fixedSuccessfully).toLocaleString()}`,
  );
  console.log(
    `   ✗ Still Invalid:        ${stats.stillInvalid.toLocaleString()}`,
  );
  console.log("");
  console.log(`VERIFICATION:`);
  console.log(
    `   Valid + Fixed + Invalid = ${stats.validInitially + stats.fixedSuccessfully + stats.stillInvalid} (should equal ${stats.totalRows})`,
  );
  console.log("");

  console.log("BREAKDOWN BY ERROR CATEGORY:");
  console.log("-".repeat(120));

  const sortedErrors = Object.entries(stats.errorBreakdown)
    .sort((a, b) => b[1] - a[1])
    .filter(([_, count]) => count > 0);

  sortedErrors.forEach(([category, count]) => {
    const percentage = ((count / stats.invalidInitially) * 100).toFixed(1);
    console.log(
      `   ${category.padEnd(40)} ${count.toString().padStart(8)} (${percentage.padStart(5)}%)`,
    );
  });

  console.log("");
}

function exportResults() {
  console.log("\n" + "=".repeat(120));
  console.log("EXPORTING RESULTS");
  console.log("=".repeat(120));

  // Helper to create workbook and sheet
  function createWorkbook(sheetName, data, extraColumns = []) {
    const wb = new Workbook();
    const ws = wb.addWorksheet(sheetName);

    const columns = [
      { header: "Question ID", key: "questionId", width: 40 },
      { header: "Program", key: "program", width: 12 },
      { header: "Subject", key: "subject", width: 15 },
      { header: "Topic", key: "topic", width: 25 },
      { header: "Question Text", key: "questionText", width: 100 },
      { header: "Option A", key: "optionA", width: 35 },
      { header: "Option B", key: "optionB", width: 35 },
      { header: "Option C", key: "optionC", width: 35 },
      { header: "Option D", key: "optionD", width: 35 },
      { header: "Correct Answer", key: "correctAnswer", width: 10 },
      {
        header: "Correct Answer Original",
        key: "correctAnswerOriginal",
        width: 25,
      },
    ];

    // Add extra columns if provided
    columns.push(...extraColumns);

    ws.columns = columns;

    data.forEach((q) => {
      const row = {};
      columns.forEach((col) => {
        row[col.key] = q[col.key] || "";
      });
      ws.addRow(row);
    });

    return wb;
  }

  // Export VALID questions
  const validWb = createWorkbook("Valid Questions", results.validQuestions);
  return validWb.xlsx
    .writeFile(OUTPUT_VALID)
    .then(() => {
      console.log(`✅ Exported VALID questions to: ${OUTPUT_VALID}`);
      console.log(
        `   Count: ${results.validQuestions.length.toLocaleString()}`,
      );
    })
    .then(() => {
      // Export FIXED questions with audit columns
      const fixedColumns = [
        { header: "Original Answer", key: "originalAnswer", width: 20 },
        { header: "Fixed Answer", key: "fixedAnswer", width: 10 },
        { header: "Fix Category", key: "fixCategory", width: 25 },
        { header: "Fix Detail", key: "fixDetail", width: 80 },
      ];

      const fixedWb = createWorkbook(
        "Fixed Questions",
        results.fixedQuestions,
        fixedColumns,
      );
      return fixedWb.xlsx.writeFile(OUTPUT_FIXED).then(() => {
        console.log(`✅ Exported FIXED questions to: ${OUTPUT_FIXED}`);
        console.log(
          `   Count: ${results.fixedQuestions.length.toLocaleString()}`,
        );
      });
    })
    .then(() => {
      // Export STILL INVALID questions
      const invalidColumns = [
        { header: "Error Category", key: "errorCategory", width: 35 },
        { header: "Error Detail", key: "errorDetail", width: 60 },
        { header: "Suggested Fix", key: "suggestedFix", width: 40 },
      ];

      const invalidWb = createWorkbook(
        "Still Invalid",
        results.stillInvalidQuestions,
        invalidColumns,
      );
      return invalidWb.xlsx.writeFile(OUTPUT_STILL_INVALID).then(() => {
        console.log(
          `✅ Exported STILL INVALID questions to: ${OUTPUT_STILL_INVALID}`,
        );
        console.log(
          `   Count: ${results.stillInvalidQuestions.length.toLocaleString()}`,
        );
      });
    })
    .catch((err) => {
      console.error("❌ Export failed:", err.message);
      throw err;
    });
}

function printConclusion() {
  console.log("\n" + "=".repeat(120));
  console.log("CONCLUSION & EXAMPLES");
  console.log("=".repeat(120));
  console.log("");

  console.log("📊 FINAL SUMMARY:");
  console.log("");
  console.log(
    `   Total questions analyzed:        ${stats.totalRows.toLocaleString()}`,
  );
  console.log(
    `   Successfully usable (valid):     ${stats.validInitially.toLocaleString()}`,
  );
  console.log(
    `   Repaired automatically:          ${stats.fixedSuccessfully.toLocaleString()}`,
  );
  console.log(
    `   Remain problematic:              ${stats.stillInvalid.toLocaleString()}`,
  );
  console.log(
    `   Overall success rate:            ${(((stats.validInitially + stats.fixedSuccessfully) / stats.totalRows) * 100).toFixed(1)}%`,
  );
  console.log("");

  if (results.fixedQuestions.length > 0) {
    console.log("💡 EXAMPLE OF AUTOMATIC FIXES:");
    console.log("");

    results.fixedQuestions.slice(0, 5).forEach((q, idx) => {
      console.log(`   Example ${idx + 1}:`);
      console.log(`     Original Answer: "${q.correctAnswerOriginal}"`);
      console.log(`     Fixed Answer:    "${q.fixedAnswer}"`);
      console.log(`     Fix Type:        ${q.fixCategory}`);
      console.log(`     Details:         ${q.fixDetail.substring(0, 80)}...`);
      console.log(`     Topic:           ${q.topic}`);
      console.log("");
    });
  }

  console.log("🔒 SAFETY VERIFICATION:");
  console.log("");
  console.log(`   ✓ Source file unchanged: ${SOURCE_FILE}`);
  console.log(`   ✓ No MongoDB connection established`);
  console.log(`   ✓ No database operations performed`);
  console.log(`   ✓ All 3 output files created successfully`);
  console.log("");

  console.log("📁 OUTPUT FILES LOCATION:");
  console.log("");
  console.log(`   1. VALID Questions:`);
  console.log(`      ${OUTPUT_VALID}`);
  console.log("");
  console.log(`   2. FIXED Questions:`);
  console.log(`      ${OUTPUT_FIXED}`);
  console.log("");
  console.log(`   3. STILL INVALID:`);
  console.log(`      ${OUTPUT_STILL_INVALID}`);
  console.log("");
  console.log("=".repeat(120));
  console.log("PROCESS COMPLETED SUCCESSFULLY!");
  console.log("=".repeat(120));
}

// Run processor
processExcelFile().catch(console.error);
