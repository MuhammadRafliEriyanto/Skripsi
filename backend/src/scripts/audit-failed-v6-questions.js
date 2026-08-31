/**
 * AUDIT SCRIPT - Analyze why 3,810 questions failed validation
 * READ-ONLY operation - NO database changes
 */

const fs = require("fs");
const path = require("path");
const { Workbook } = require("exceljs");

// Configuration
const EXCEL_FILE = path.join(
  __dirname,
  "../../outputs/assessment-bank-rekap/REKAP-BANK-SOAL-VARIED-V6.xlsx",
);

// Storage for failed rows analysis
const totalFailures = [];

async function normalizeAnswerKey(
  rawAnswer,
  optA,
  optB,
  optC,
  optD,
  debugInfo = {},
) {
  const answerStr = String(rawAnswer || "").trim();

  // Already valid letter?
  if (/^[ABCD]$/.test(answerStr)) {
    return {
      result: answerStr,
      type: "validLetter",
      details: "Direct match: simple A/B/C/D",
    };
  }

  // Options mapping
  const options = {
    A: String(optA || "").trim(),
    B: String(optB || "").trim(),
    C: String(optC || "").trim(),
    D: String(optD || "").trim(),
  };

  // Check for common formats first
  const upperAnswer = answerStr.toUpperCase();

  // Format: "A.", "A)", "A )", etc.
  const formatMatch = upperAnswer.match(/^([ABCD])[\s\.\)]+$/);
  if (formatMatch) {
    const letter = formatMatch[1];
    if (
      options[letter].length > 0 &&
      options[letter].toLowerCase() === answerStr.toLowerCase()
    ) {
      return {
        result: letter,
        type: "formatNormalized",
        details: `Format: "${rawAnswer}" → "${letter}" (${debugInfo.formatReason})`,
      };
    }
  }

  // Try each option's value
  for (const [letter, value] of Object.entries(options)) {
    if (!value) continue;

    const valueClean = value.trim().toUpperCase();
    const answerClean = upperAnswer.replace(/[\s\.\)]+/g, "");

    if (valueClean.includes(answerClean) || answerClean.includes(valueClean)) {
      return {
        result: letter,
        type: "valueMatch",
        details: `Value match: "${rawAnswer}" found in option ${letter}`,
      };
    }

    // Exact case-insensitive match
    if (valueClean === upperAnswer) {
      return {
        result: letter,
        type: "caseInsensitiveMatch",
        details: `Case-insensitive match: "${rawAnswer}" → option ${letter}="${value}"`,
      };
    }
  }

  // No match found - categorize the failure
  return {
    result: null,
    type: "noMatch",
    reason: determineFailureCategory(
      rawAnswer,
      optA,
      optB,
      optC,
      optD,
      debugInfo,
    ).reason,
    severity: determineFailureCategory(
      rawAnswer,
      optA,
      optB,
      optC,
      optD,
      debugInfo,
    ).severity,
    category: determineFailureCategory(
      rawAnswer,
      optA,
      optB,
      optC,
      optD,
      debugInfo,
    ).category,
    rawAnswer: rawAnswer,
    options: { A: optA, B: optB, C: optC, D: optD },
  };
}

function determineFailureCategory(
  rawAnswer,
  optA,
  optB,
  optC,
  optD,
  debugInfo,
) {
  const answerStr = String(rawAnswer || "").trim();

  // Empty answer
  if (!answerStr) {
    return {
      category: "answerEmpty",
      reason: "Correct answer field is empty/null",
      severity: "high",
    };
  }

  // Options are empty
  if (!optA && !optB && !optC && !optD) {
    return {
      category: "optionsEmpty",
      reason: "All options are empty",
      severity: "high",
    };
  }

  // Check for formatting issues
  const hasDot = answerStr.endsWith(".") || answerStr.includes(".");
  const hasParenthesis = answerStr.includes(")") || answerStr.includes("(");
  const hasKeyword = /jawaban|key|answer/i.test(answerStr);
  const isUpperCase =
    answerStr === answerStr.toUpperCase() && /[abcd]/i.test(answerStr);
  const hasExtraChars = answerStr.length > 4;

  if (hasDot || hasParenthesis) {
    return {
      category: "correctAnswerFormat",
      reason: `Format dengan simbol: "${rawAnswer}" (${debugInfo.formatReason || "dot/parenthesis detected"})`,
      severity: "medium",
    };
  }

  if (hasKeyword) {
    return {
      category: "correctAnswerFormat",
      reason: `Mengandung kata kunci: "${rawAnswer}" (${debugInfo.formatReason})`,
      severity: "medium",
    };
  }

  // Case sensitivity issue
  if (/[abcd]/.test(answerStr) && answerStr !== answerStr.toUpperCase()) {
    return {
      category: "wrongLetterCase",
      reason: `Huruf kecil: "${rawAnswer}"`,
      severity: "low",
    };
  }

  // Check if it looks like a value search should work
  const allOptions = [optA, optB, optC, optD].filter(Boolean).map(String);
  const normalizedAnswer = answerStr.replace(/\s+/g, "").toUpperCase();

  const foundPartial = allOptions.find(
    (opt) =>
      String(opt).toUpperCase().includes(normalizedAnswer) ||
      normalizedAnswer.includes(String(opt).toUpperCase()),
  );

  if (foundPartial) {
    return {
      category: "other",
      reason: `Ada partial match tapi tidak cocok sempurna: "${rawAnswer}" vs "${foundPartial}"`,
      severity: "medium",
    };
  }

  // Object/Formulas that don't convert properly
  if (
    typeof rawAnswer === "object" ||
    debugInfo.isFormula ||
    debugInfo.isObject
  ) {
    return {
      category: "objectFormulaType",
      reason: `Tipe data tidak bisa dibaca normal: ${JSON.stringify(rawAnswer).substring(0, 50)}`,
      severity: "high",
    };
  }

  // Whitespace issues
  if (rawAnswer !== answerStr) {
    return {
      category: "whitespaceIssue",
      reason: `Masalah whitespace: "${rawAnswer}" (original) vs "${answerStr}" (trimmed)`,
      severity: "low",
    };
  }

  // Default: answer doesn't match any option
  return {
    category: "answerNotInOptions",
    reason: `Jawaban "${rawAnswer}" tidak ada di opsi manapun`,
    severity: "medium",
    options: allOptions.slice(0, 2),
  };
}

async function exportFailuresToExcel(samplesByCategory, totalFailuresArr) {
  console.log("\n📊 Exporting full failure data to Excel...");

  const wb = new Workbook();
  const ws = wb.addWorksheet("Failed Questions Detail");

  // Define columns
  ws.columns = [
    { header: "Row Number", key: "rowNumber", width: 10 },
    { header: "Program", key: "program", width: 12 },
    { header: "Subject", key: "subject", width: 15 },
    { header: "Topic", key: "topic", width: 20 },
    { header: "Question Preview", key: "question", width: 70 },
    { header: "Option A", key: "optionA", width: 40 },
    { header: "Option B", key: "optionB", width: 40 },
    { header: "Option C", key: "optionC", width: 40 },
    { header: "Option D", key: "optionD", width: 40 },
    { header: "Raw Answer", key: "rawAnswer", width: 25 },
    { header: "Reason", key: "reason", width: 60 },
    { header: "Severity", key: "severity", width: 12 },
    { header: "Category", key: "category", width: 20 },
  ];

  // Add all failures with detailed info
  for (const catKey of Object.keys(samplesByCategory)) {
    const items = samplesByCategory[catKey];
    items.forEach((item) => {
      ws.addRow({
        rowNumber: item.rowNumber,
        program: item.program,
        subject: item.subject,
        topic: item.topic,
        question: item.questionPreview + "...",
        optionA: item.options.A || "",
        optionB: item.options.B || "",
        optionC: item.options.C || "",
        optionD: item.options.D || "",
        rawAnswer: item.rawAnswer,
        reason: item.reason,
        severity: item.severity,
        category: catKey.toUpperCase(),
      });
    });
  }

  // Save file
  const outputPath = path.join(
    __dirname,
    "../backups/V6_FAILURES_FULL_DETAIL.xlsx",
  );
  await wb.xlsx.writeFile(outputPath);

  console.log(
    `✅ Exported ${totalFailuresArr.length} failed rows to: ${outputPath}`,
  );
  return outputPath;
}

async function auditExcel() {
  console.log("=".repeat(80));
  console.log("AUDIT SCRIPT: 3,810 Failed Questions Analysis");
  console.log("=".repeat(80));
  console.log("");

  if (!fs.existsSync(EXCEL_FILE)) {
    console.error(`❌ Excel file not found: ${EXCEL_FILE}`);
    process.exit(1);
  }

  console.log(`📄 Reading Excel file: ${EXCEL_FILE}`);
  const workbook = new Workbook();
  await workbook.xlsx.readFile(EXCEL_FILE);
  const worksheet = workbook.worksheets[0];
  const rowCount = worksheet.rowCount;

  console.log(`📊 Total rows in Excel: ${rowCount}`);
  console.log("");

  let processed = 0;
  let successCount = 0;
  let failureCount = 0;

  const samplesByCategory = {};
  const sampleLimitPerCategory = 50;

  for (let i = 2; i <= rowCount; i++) {
    const row = worksheet.getRow(i);
    const programKelas = row.getCell(1).value;
    const mataPelajaran = row.getCell(2).value;
    const topik = row.getCell(3).value;
    const question = row.getCell(9).value;
    const optionA = row.getCell(10).value;
    const optionB = row.getCell(11).value;
    const optionC = row.getCell(12).value;
    const optionD = row.getCell(13).value;
    const correctAnswerRaw = row.getCell(14).value;

    processed++;

    // Validate required fields exist
    if (
      !question ||
      !correctAnswerRaw ||
      !mataPelajaran ||
      !programKelas ||
      !topik
    ) {
      continue;
    }

    // Debug info for this row
    const debugInfo = {
      rowNumber: i,
      cellType: typeof correctAnswerRaw,
      isFormula: false,
      isObject:
        typeof correctAnswerRaw === "object" &&
        !(correctAnswerRaw instanceof Date),
      formatType: detectFormatType(correctAnswerRaw),
    };

    const result = await normalizeAnswerKey(
      correctAnswerRaw,
      optionA,
      optionB,
      optionC,
      optionD,
      debugInfo,
    );

    if (result.result) {
      successCount++;
    } else {
      failureCount++;

      // Categorize and store samples
      const catKey = result.category;
      if (!samplesByCategory[catKey]) {
        samplesByCategory[catKey] = [];
      }

      if (samplesByCategory[catKey].length < sampleLimitPerCategory) {
        samplesByCategory[catKey].push({
          rowNumber: i,
          program: String(programKelas || "").substring(0, 15),
          subject: String(mataPelajaran || "").substring(0, 12),
          topic: String(topik || "").substring(0, 10),
          questionPreview: String(question || "")
            .substring(0, 60)
            .replace(/\n/g, " "),
          options: {
            A: String(optionA || ""),
            B: String(optionB || ""),
            C: String(optionC || ""),
            D: String(optionD || ""),
          },
          rawAnswer: String(correctAnswerRaw || ""),
          reason: result.reason || result.details,
          severity: result.severity || "medium",
        });
      }
    }
  }

  printSummary(processed, successCount, failureCount, samplesByCategory);
  printDetailedAnalysis(samplesByCategory);

  // Export full details to Excel
  await exportFailuresToExcel(samplesByCategory, []);

  printRecommendations();
}

function detectFormatType(rawValue) {
  if (typeof rawValue !== "string") {
    return "non-string";
  }

  const str = rawValue.trim();

  if (/^[ABCD]\.?$/i.test(str)) return "simple_with_dot";
  if (/^[ABCD]\)?$/i.test(str)) return "with_parenthesis";
  if (/^([ABCD])[)\s.]+$/i.test(str)) return "multiple_symbols";
  if (/jawaban/i.test(str)) return "with_keyword";
  if (/^[abcd]$/.test(str)) return "lowercase";
  if (/^[A-Z]$/.test(str)) return "uppercase";
  if (/^\d+$/.test(str)) return "numeric";
  if (str.length > 2) return "text_response";
  return "unknown_format";
}

function printSummary(
  processed,
  successCount,
  failureCount,
  samplesByCategory,
) {
  console.log("");
  console.log("=".repeat(80));
  console.log("SUMMARY STATISTICS");
  console.log("=".repeat(80));
  console.log(`Total rows processed: ${processed.toLocaleString()}`);
  console.log(`Successes (can be imported): ${successCount.toLocaleString()}`);
  console.log(
    `Failures (cannot be imported): ${failureCount.toLocaleString()}`,
  );
  console.log("");
  console.log(
    `Failure rate: ${((failureCount / processed) * 100).toFixed(1)}%`,
  );
  console.log(
    `Recoverable rate: ${((successCount / processed) * 100).toFixed(1)}%`,
  );
  console.log("");
}

function printDetailedAnalysis(samplesByCategory) {
  console.log("=".repeat(80));
  console.log("DETAILED FAILURE ANALYSIS BY CATEGORY");
  console.log("=".repeat(80));
  console.log("");

  const categories = Object.keys(samplesByCategory);
  const totalFailures = categories.reduce(
    (sum, cat) => sum + samplesByCategory[cat].length,
    0,
  );

  categories.forEach((cat) => {
    const items = samplesByCategory[cat];
    const percentage = (
      (items.length / Math.max(totalFailures, 1)) *
      100
    ).toFixed(1);

    console.log(
      `📁 CATEGORY: ${cat.toUpperCase()} (${items.length} rows - ${percentage}%)`,
    );
    console.log("-".repeat(80));

    items.slice(0, Math.min(items.length, 5)).forEach((item) => {
      console.log(
        `   Row ${item.rowNumber}: ${item.program} - ${item.subject} - ${item.topic}`,
      );
      console.log(`   Question: ${item.questionPreview}...`);
      console.log(`   Raw Answer: "${item.rawAnswer}"`);
      console.log(`   Severity: ${item.severity.toUpperCase()}`);
      console.log(`   Reason: ${item.reason}`);
      console.log(
        `   Option Values: A="${item.options.A?.substring(0, 30)}...", B="${item.options.B?.substring(0, 30)}..."`,
      );
      console.log("");
    });
  });
}

function printRecommendations() {
  console.log("=".repeat(80));
  console.log("RECOMMENDATIONS FOR FIXING FAILED QUESTIONS");
  console.log("=".repeat(80));
  console.log("");
  console.log("🔧 VALIDATION IMPROVEMENTS:");
  console.log("");
  console.log("1. FORMAT NORMALIZATION:");
  console.log("   - Strip trailing dots: 'A.' → 'A'");
  console.log("   - Remove parentheses: 'A)' → 'A'");
  console.log("   - Handle multiple symbols: 'A )' → 'A'");
  console.log("");
  console.log("2. CASE SENSITIVITY:");
  console.log("   - Accept lowercase: 'a' → 'A'");
  console.log("   - Convert to uppercase automatically");
  console.log("");
  console.log("3. KEYWORD EXTRACTION:");
  console.log("   - Extract from: 'Jawaban: A', 'Key: B'");
  console.log("   - Regex pattern: /([ABCD])/i");
  console.log("");
  console.log("4. WHITESPACE HANDLING:");
  console.log("   - Trim leading/trailing spaces");
  console.log("   - Collapse multiple spaces");
  console.log("");
  console.log("5. VALUE MATCH ENHANCEMENT:");
  console.log("   - Improve fuzzy matching");
  console.log("   - Handle special characters");
  console.log("   - Normalize Unicode");
  console.log("");
  console.log("⚠️  MANUAL REVIEW REQUIRED:");
  console.log("");
  console.log("- Empty answers: Verify source Excel");
  console.log("- Completely mismatched: Manual correction needed");
  console.log("- Complex formatting: Excel formula review");
  console.log("");
  console.log("📋 NEXT STEPS:");
  console.log("");
  console.log("1. Update normalizeAnswerKey() with improved logic");
  console.log("2. Run additional validation tests");
  console.log("3. Manually review low-severity failures");
  console.log("4. Consider Excel source file corrections");
  console.log("");
}

// Run audit
auditExcel().catch(console.error);
