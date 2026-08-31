/**
 * COMPREHENSIVE EXCEL AUDIT SCRIPT - V6 Question Bank Analysis
 * READ-ONLY OPERATION - NO DATABASE CHANGES
 *
 * Purpose: Analyze all invalid questions from REKAP-BANK-SOAL-VARIED-V6.xlsx
 * Output: Creates detailed audit report in V6-INVALID-AUDIT.xlsx
 */

const fs = require("fs");
const path = require("path");
const { Workbook } = require("exceljs");

// Configuration
const EXCEL_FILE = path.join(
  __dirname,
  "../../outputs/assessment-bank-rekap/REKAP-BANK-SOAL-VARIED-V6.xlsx",
);
const OUTPUT_FILE = path.join(
  __dirname,
  "../../outputs/assessment-bank-rekap/V6-INVALID-AUDIT.xlsx",
);

// Error categories
const ERROR_CATEGORIES = {
  ANSWER_NOT_FOUND_IN_OPTIONS: "ANSWER_NOT_FOUND_IN_OPTIONS",
  FORMAT_DIFFERENCE: "FORMAT_DIFFERENCE",
  NUMERIC_NORMALIZATION_NEEDED: "NUMERIC_NORMALIZATION_NEEDED",
  EMPTY_REQUIRED_FIELD: "EMPTY_REQUIRED_FIELD",
  DUPLICATE_ID: "DUPLICATE_ID",
  KEY_EXPLANATION_CONFLICT: "KEY_EXPLANATION_CONFLICT",
  OTHER: "OTHER",
};

// Storage for audit results
const auditResults = {
  statistics: {
    totalRows: 0,
    validQuestions: 0,
    invalidQuestions: 0,
    byCategory: {},
  },
  invalidQuestions: [],
  samplesByCategory: {},
};

// Initialize category counters
Object.keys(ERROR_CATEGORIES).forEach((key) => {
  auditResults.statistics.byCategory[key] = 0;
  auditResults.samplesByCategory[key] = [];
});

async function normalizeAnswerKey(
  rawAnswer,
  optionA,
  optionB,
  optionC,
  optionD,
) {
  const answerStr = String(rawAnswer || "").trim();
  const options = {
    A: String(optionA || "").trim(),
    B: String(optionB || "").trim(),
    C: String(optionC || "").trim(),
    D: String(optionD || "").trim(),
  };

  // Check if already valid letter
  if (/^[ABCD]$/.test(answerStr)) {
    return { result: answerStr, isValid: true };
  }

  // Try to normalize format (strip dots, parentheses, spaces)
  const cleanLetter = answerStr.replace(/[\s\.\)]+/g, "");
  if (/^[ABCD]$/.test(cleanLetter)) {
    const letter = cleanLetter;
    // Check if this letter's option contains the original answer
    if (options[letter].toLowerCase().includes(answerStr.toLowerCase())) {
      return { result: letter, isValid: true, normalizedFrom: rawAnswer };
    }
  }

  // Search for value match in options
  const upperAnswer = answerStr.toUpperCase();
  for (const [letter, value] of Object.entries(options)) {
    if (!value) continue;

    const valueClean = value.trim().toUpperCase();
    const answerClean = upperAnswer.replace(/[\s\.\)]+/g, "");

    // Direct match
    if (valueClean === upperAnswer) {
      return { result: letter, isValid: true, normalizedFrom: rawAnswer };
    }

    // Partial match (answer contains value or vice versa)
    if (valueClean.includes(answerClean) || answerClean.includes(valueClean)) {
      return { result: letter, isValid: true, normalizedFrom: rawAnswer };
    }

    // Case-insensitive match with stripped symbols
    if (valueClean.includes(answerClean)) {
      return { result: letter, isValid: true, normalizedFrom: rawAnswer };
    }
  }

  // No match found - analyze why
  return await determineErrorType(rawAnswer, options);
}

async function determineErrorType(rawAnswer, options) {
  const answerStr = String(rawAnswer || "").trim();

  // Empty answer
  if (!answerStr) {
    return {
      result: null,
      isValid: false,
      errorCategory: ERROR_CATEGORIES.EMPTY_REQUIRED_FIELD,
      errorDetail: "Correct answer field is empty/null",
      suggestedFix: "Provide valid answer (A/B/C/D or actual answer text)",
    };
  }

  // Numeric answer (most common case)
  if (/^\d+$/.test(answerStr)) {
    return {
      result: null,
      isValid: false,
      errorCategory: ERROR_CATEGORIES.NUMERIC_NORMALIZATION_NEEDED,
      errorDetail: `Numeric answer "${answerStr}" detected - not a letter key`,
      suggestedFix:
        "Convert numeric answer to multiple-choice format with correct letter",
    };
  }

  // Format issue (dots, parentheses, etc.)
  const formatMatch = answerStr.match(/^([ABCD])[\s\.\)]+$/i);
  if (formatMatch) {
    const letter = formatMatch[1].toUpperCase();
    const optionValue = options[letter];
    if (
      optionValue &&
      !optionValue.toLowerCase().includes(answerStr.toLowerCase())
    ) {
      return {
        result: null,
        isValid: false,
        errorCategory: ERROR_CATEGORIES.FORMAT_DIFFERENCE,
        errorDetail: `Format mismatch - "${rawAnswer}" doesn't match option "${optionValue}"`,
        suggestedFix:
          "Use simple letter A/B/C/D or ensure answer matches option text exactly",
      };
    }
  }

  // Answer not found in any option
  return {
    result: null,
    isValid: false,
    errorCategory: ERROR_CATEGORIES.ANSWER_NOT_FOUND_IN_OPTIONS,
    errorDetail: `Answer "${answerStr}" not found in any option`,
    suggestedFix:
      "Verify that correct answer exists in one of the four options (A-D)",
    availableOptions: Object.entries(options).filter(([_, v]) => v),
  };
}

async function generateQuestionId(rowNumber, program, subject, topic) {
  const id = `${program}-${subject}-${topic}-${rowNumber}`;
  const cleanedId = id
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_-]/g, "_")
    .toUpperCase();
  return cleanedId;
}

async function auditExcel() {
  console.log("=".repeat(100));
  console.log("COMPREHENSIVE EXCEL AUDIT - V6 INVALID QUESTIONS ANALYSIS");
  console.log("=".repeat(100));
  console.log("");

  // Verify file exists
  if (!fs.existsSync(EXCEL_FILE)) {
    console.error(`❌ Excel file not found: ${EXCEL_FILE}`);
    process.exit(1);
  }

  console.log(`📄 Reading Excel file: ${EXCEL_FILE}`);
  const workbook = new Workbook();
  await workbook.xlsx.readFile(EXCEL_FILE);
  const worksheet = workbook.worksheets[0];
  const rowCount = worksheet.rowCount;

  auditResults.statistics.totalRows = rowCount - 1; // Exclude header

  console.log(
    `📊 Total data rows: ${auditResults.statistics.totalRows.toLocaleString()}`,
  );
  console.log("");

  const seenIds = new Set();

  // Process each row
  for (let i = 2; i <= rowCount; i++) {
    const row = worksheet.getRow(i);

    // Extract fields (1-based indexing)
    const programKelas = row.getCell(1).value;
    const mataPelajaran = row.getCell(2).value;
    const topik = row.getCell(3).value;
    const questionText = row.getCell(9).value;
    const optionA = row.getCell(10).value;
    const optionB = row.getCell(11).value;
    const optionC = row.getCell(12).value;
    const optionD = row.getCell(13).value;
    const correctAnswerRaw = row.getCell(14).value;

    // Parse program type
    let program = "";
    const programStr = String(programKelas || "");
    if (programStr.includes("SD")) program = "SD";
    else if (programStr.includes("SMP")) program = "SMP";
    else if (programStr.includes("SMA")) program = "SMA";
    else if (programStr.includes("UTBK")) program = "UTBK";
    else program = programStr.split(" ")[0].toUpperCase();

    // Generate unique ID
    const questionId = await generateQuestionId(
      i,
      program,
      String(mataPelajaran || ""),
      String(topik || ""),
    );

    // Check for duplicates
    if (seenIds.has(questionId)) {
      auditResults.invalidQuestions.push({
        questionId: questionId,
        program: program,
        subject: String(mataPelajaran || ""),
        topic: String(topik || ""),
        questionText: String(questionText || "").substring(0, 100),
        optionA: String(optionA || ""),
        optionB: String(optionB || ""),
        optionC: String(optionC || ""),
        optionD: String(optionD || ""),
        correctAnswerOriginal: String(correctAnswerRaw || ""),
        explanation: "Duplicate question ID detected",
        errorCategory: ERROR_CATEGORIES.DUPLICATE_ID,
        errorDetail: `Duplicate of row processed earlier`,
        suggestedFix:
          "Review and update either the content or ensure unique topic variation",
      });
      auditResults.statistics.byCategory[ERROR_CATEGORIES.DUPLICATE_ID]++;
      continue;
    }
    seenIds.add(questionId);

    // Validate required fields
    if (
      !questionText ||
      !correctAnswerRaw ||
      !mataPelajaran ||
      !programKelas ||
      !topik
    ) {
      auditResults.invalidQuestions.push({
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
        explanation: "Required field missing",
        errorCategory: ERROR_CATEGORIES.EMPTY_REQUIRED_FIELD,
        errorDetail: `Missing: ${!questionText ? "questionText " : ""}${!correctAnswerRaw ? "correctAnswer" : ""}`,
        suggestedFix: "Fill all required fields before processing",
      });
      auditResults.statistics.byCategory[
        ERROR_CATEGORIES.EMPTY_REQUIRED_FIELD
      ]++;
      continue;
    }

    // Normalize answer key
    const validation = await normalizeAnswerKey(
      correctAnswerRaw,
      optionA,
      optionB,
      optionC,
      optionD,
    );

    if (validation.isValid) {
      auditResults.statistics.validQuestions++;
    } else {
      auditResults.invalidQuestions.push({
        questionId: questionId,
        program: program,
        subject: String(mataPelajaran || ""),
        topic: String(topik || ""),
        questionText: String(questionText || "").substring(0, 150),
        optionA: String(optionA || ""),
        optionB: String(optionB || ""),
        optionC: String(optionC || ""),
        optionD: String(optionD || ""),
        correctAnswerOriginal: String(correctAnswerRaw || ""),
        explanation: validation.errorDetail || "Validation failed",
        errorCategory: validation.errorCategory,
        errorDetail: validation.errorDetail,
        suggestedFix: validation.suggestedFix,
      });

      auditResults.statistics.byCategory[validation.errorCategory]++;

      // Store sample for reporting (limit to 10 per category)
      const catSamples =
        auditResults.samplesByCategory[validation.errorCategory];
      if (catSamples.length < 10) {
        catSamples.push({
          questionId: questionId,
          program: program,
          subject: String(mataPelajaran || ""),
          topic: String(topik || ""),
          questionText: String(questionText || "").substring(0, 80),
          optionA: String(optionA || ""),
          optionB: String(optionB || ""),
          optionC: String(optionC || ""),
          optionD: String(optionD || ""),
          correctAnswerOriginal: String(correctAnswerRaw || ""),
          explanation: validation.errorDetail,
          errorCategory: validation.errorCategory,
          errorDetail: validation.errorDetail,
          suggestedFix: validation.suggestedFix,
        });
      }
    }
  }

  auditResults.statistics.invalidQuestions = Object.values(
    auditResults.statistics.byCategory,
  ).reduce((sum, count) => sum + count, 0);

  printStatistics();
  printSampleAnalysis();
  exportAuditReport();
  printConclusion();
}

function printStatistics() {
  console.log("\n" + "=".repeat(100));
  console.log("AUDIT STATISTICS");
  console.log("=".repeat(100));
  console.log("");
  console.log(
    `TOTAL ROWS PROCESSED: ${auditResults.statistics.totalRows.toLocaleString()}`,
  );
  console.log(
    `VALID QUESTIONS: ${auditResults.statistics.validQuestions.toLocaleString()}`,
  );
  console.log(
    `INVALID QUESTIONS: ${auditResults.statistics.invalidQuestions.toLocaleString()}`,
  );
  console.log("");
  console.log(
    `VALIDATION SUCCESS RATE: ${((auditResults.statistics.validQuestions / auditResults.statistics.totalRows) * 100).toFixed(1)}%`,
  );
  console.log(
    `FAILURE RATE: ${((auditResults.statistics.invalidQuestions / auditResults.statistics.totalRows) * 100).toFixed(1)}%`,
  );
  console.log("");
  console.log("BREAKDOWN BY ERROR CATEGORY:");
  console.log("-".repeat(100));

  Object.keys(auditResults.statistics.byCategory).forEach((category) => {
    const count = auditResults.statistics.byCategory[category];
    const percentage = (
      (count / Math.max(auditResults.statistics.invalidQuestions, 1)) *
      100
    ).toFixed(1);
    console.log(
      `${category}: ${count.toString().padStart(6)} (${percentage.padStart(5)}%)`,
    );
  });

  console.log("");
}

function printSampleAnalysis() {
  console.log("\n" + "=".repeat(100));
  console.log("SAMPLE ANALYSIS - TOP 10 EXAMPLES PER CATEGORY");
  console.log("=".repeat(100));
  console.log("");

  Object.keys(auditResults.samplesByCategory).forEach((category) => {
    const samples = auditResults.samplesByCategory[category];
    if (samples.length === 0) return;

    console.log(`\n📁 CATEGORY: ${category}`);
    console.log("-".repeat(100));

    samples.forEach((sample, index) => {
      console.log(`\nExample #${index + 1}:`);
      console.log(`  Question ID: ${sample.questionId}`);
      console.log(
        `  Program: ${sample.program} | Subject: ${sample.subject} | Topic: ${sample.topic}`,
      );
      console.log(`  Question Preview: ${sample.questionText}...`);
      console.log(`  Options:`);
      console.log(`    A: ${sample.optionA.substring(0, 40) || "(empty)"}`);
      console.log(`    B: ${sample.optionB.substring(0, 40) || "(empty)"}`);
      console.log(`    C: ${sample.optionC.substring(0, 40) || "(empty)"}`);
      console.log(`    D: ${sample.optionD.substring(0, 40) || "(empty)"}`);
      console.log(
        `  Correct Answer (Original): "${sample.correctAnswerOriginal}"`,
      );
      console.log(`  Error: ${sample.errorDetail}`);
      console.log(`  Suggested Fix: ${sample.suggestedFix}`);
    });

    console.log("");
  });
}

function exportAuditReport() {
  console.log("\n" + "=".repeat(100));
  console.log("EXPORTING AUDIT REPORT");
  console.log("=".repeat(100));

  const wb = new Workbook();
  const ws = wb.addWorksheet("Invalid Questions Audit");

  // Define columns
  ws.columns = [
    { header: "Question ID", key: "questionId", width: 40 },
    { header: "Program", key: "program", width: 12 },
    { header: "Subject", key: "subject", width: 15 },
    { header: "Topic", key: "topic", width: 25 },
    { header: "Question Text", key: "questionText", width: 80 },
    { header: "Option A", key: "optionA", width: 35 },
    { header: "Option B", key: "optionB", width: 35 },
    { header: "Option C", key: "optionC", width: 35 },
    { header: "Option D", key: "optionD", width: 35 },
    {
      header: "Correct Answer Original",
      key: "correctAnswerOriginal",
      width: 25,
    },
    { header: "Explanation", key: "explanation", width: 30 },
    { header: "Error Category", key: "errorCategory", width: 35 },
    { header: "Error Detail", key: "errorDetail", width: 50 },
    { header: "Suggested Fix", key: "suggestedFix", width: 40 },
  ];

  // Add all invalid questions
  auditResults.invalidQuestions.forEach((q) => {
    ws.addRow(q);
  });

  // Save workbook
  return wb.xlsx
    .writeFile(OUTPUT_FILE)
    .then(() => {
      console.log(`✅ Audit report exported to: ${OUTPUT_FILE}`);
      console.log(
        `   Total invalid questions exported: ${auditResults.invalidQuestions.toLocaleString()}`,
      );
    })
    .catch((err) => {
      console.error("❌ Failed to export:", err.message);
    });
}

function printConclusion() {
  console.log("\n" + "=".repeat(100));
  console.log("CONCLUSION & RECOMMENDATIONS");
  console.log("=".repeat(100));
  console.log("");

  console.log("📊 SUMMARY:");
  console.log("");
  console.log(
    `- Total Excel rows analyzed: ${auditResults.statistics.totalRows.toLocaleString()}`,
  );
  console.log(
    `- Successfully validated: ${auditResults.statistics.validQuestions.toLocaleString()} (${((auditResults.statistics.validQuestions / auditResults.statistics.totalRows) * 100).toFixed(1)}%)`,
  );
  console.log(
    `- Failed validation: ${auditResults.statistics.invalidQuestions.toLocaleString()} (${((auditResults.statistics.invalidQuestions / auditResults.statistics.totalRows) * 100).toFixed(1)}%)`,
  );
  console.log("");

  console.log("🔍 KEY FINDINGS:");
  console.log("");

  // Find top error categories
  const sortedCategories = Object.entries(auditResults.statistics.byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  sortedCategories.forEach(([category, count]) => {
    const percentage = (
      (count / Math.max(auditResults.statistics.invalidQuestions, 1)) *
      100
    ).toFixed(1);
    console.log(`   • ${category}: ${count.toLocaleString()} (${percentage}%)`);
  });

  console.log("");
  console.log("💡 RECOMMENDED ACTIONS:");
  console.log("");
  console.log("1. For NUMERIC_NORMALIZATION_NEEDED:");
  console.log("   - Review calculator problem generation logic");
  console.log("   - Ensure answers are mapped to letter keys");
  console.log("   - Add distractor generation for MCQ format");
  console.log("");

  console.log("2. For FORMAT_DIFFERENCE:");
  console.log("   - Standardize answer key format during generation");
  console.log("   - Strip trailing punctuation automatically");
  console.log("   - Convert lowercase to uppercase");
  console.log("");

  console.log("3. For ANSWER_NOT_FOUND_IN_OPTIONS:");
  console.log("   - Verify answer exists in one of four options");
  console.log("   - Generate appropriate distractors");
  console.log("   - Cross-validate answer-key with options");
  console.log("");

  console.log("4. For EMPTY_REQUIRED_FIELD:");
  console.log("   - Add pre-validation checks during generation");
  console.log("   - Skip or regenerate incomplete questions");
  console.log("   - Implement quality gates before export");
  console.log("");

  console.log("📁 OUTPUT FILES:");
  console.log("");
  console.log(`   ✓ Detailed audit report: V6-INVALID-AUDIT.xlsx`);
  console.log(`   ✓ Location: ${OUTPUT_FILE}`);
  console.log("");

  console.log(
    "⚠️  NOTE: This was a READ-ONLY audit. No database changes were made.",
  );
  console.log(
    "         No files were modified except creating the audit report.",
  );
  console.log("");
  console.log("=".repeat(100));
}

// Run audit
auditExcel().catch(console.error);
