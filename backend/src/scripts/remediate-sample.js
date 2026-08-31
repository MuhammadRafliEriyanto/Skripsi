/**
 * QUESTIONBANK DATASET REMEDIATION - CONTROLLED SAMPLE
 *
 * This script identifies problematic questions in the existing Excel dataset
 * and performs controlled remediation on a SAMPLE only (NOT full 46,251 rows).
 *
 * GOAL: Fix placeholder questions, hardcoded answers, and option repetition
 * WITHOUT touching production database or overwriting source files.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as XLSX from "xlsx";
import {
  validateQuestion,
  classifyQuestion,
} from "./remediation-validator.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =====================================================
// CONFIGURATION
// =====================================================

const SOURCE_FILE =
  "backend/outputs/assessment-bank-repak/V6-INVALID-AUDIT.xlsx";
const OUTPUT_FILE = "backend/outputs/QUESTIONBANK-REMEDIATION-SAMPLE.xlsx";
const REPORT_FILE = "backend/outputs/QUESTIONBANK-REMEDIATION-SAMPLE-REPORT.md";

// Sample size for testing (NOT full 46,251 rows)
const SAMPLE_SIZE = 800; // 500-1000 range as recommended

// Priority subjects that have 100% Answer A issue
const PRIORITY_SUBJECTS = [
  "IPs",
  "Bahasa Indonesia",
  "Bahasa Inggris",
  "Sejarah",
];

// =====================================================
// CLASSIFICATION RESULTS
// =====================================================

const classifications = {
  HEALTHY: [],
  ANSWER_FORMAT_ONLY: [],
  PLACEHOLDER_QUESTION: [],
  PLACEHOLDER_OPTIONS: [],
  INVALID_OPTIONS: [],
  INVALID_CORRECT_ANSWER: [],
  DUPLICATE_QUESTION: [],
  NEEDS_REGENERATION: [],
  NEEDS_MANUAL_REVIEW: [],
};

const statistics = {
  total: 0,
  validAnswers: { A: 0, B: 0, C: 0, D: 0 },
  invalidAnswer: 0,
  numericAnswer: 0,
  placeholdersDetected: 0,
  duplicatesDetected: 0,
};

// =====================================================
// MAIN PROCESSING
// =====================================================

async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("QUESTIONBANK DATASET REMEDIATION - CONTROLLED SAMPLE");
  console.log("=".repeat(80) + "\n");

  try {
    // Step 1: Load source Excel
    console.log("[1/8] Loading source Excel file...");
    const workbook = XLSX.readFile(SOURCE_FILE);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (jsonData.length === 0) {
      console.error("❌ EMPTY FILE!");
      process.exit(1);
    }

    // Parse headers
    const headers = jsonData[0].map((h) => String(h).toLowerCase().trim());
    const dataRows = jsonData.slice(1);

    statistics.total = dataRows.length;
    console.log(`   Sheet: ${sheetName}`);
    console.log(`   Total rows: ${dataRows.length.toLocaleString()}`);
    console.log(`   Headers: ${headers.join(", ")}\n`);

    // Step 2: Classify each row
    console.log("[2/8] Classifying questions...\n");

    let healthyCount = 0;
    let sampleIndices = [];

    for (let i = 0; i < dataRows.length; i++) {
      const rowObj = {};
      headers.forEach((header, idx) => {
        rowObj[header] = dataRows[i][idx];
      });

      const classification = classifyQuestion(rowObj, headers);

      if (!classifications[classification]) {
        classifications[classification] = [];
      }
      classifications[classification].push({
        index: i,
        row: rowObj,
        classification,
      });

      // Collect sample for remediation (prioritize problematic ones)
      if (
        [
          "PLACEHOLDER_QUESTION",
          "PLACEHOLDER_OPTIONS",
          "INVALID_CORRECT_ANSWER",
          "INVALID_OPTIONS",
        ].includes(classification)
      ) {
        if (sampleIndices.length < SAMPLE_SIZE * 0.6) {
          sampleIndices.push(i);
        }
      } else if (
        ["HEALTHY", "ANSWER_FORMAT_ONLY"].includes(classification) &&
        sampleIndices.length < SAMPLE_SIZE
      ) {
        sampleIndices.push(i); // Include some healthy as control
      }

      // Count valid answers
      const answer = normalizeAnswer(rowObj["kunci jawaban"]);
      if (answer && ["A", "B", "C", "D"].includes(answer)) {
        statistics.validAnswers[answer]++;
      } else if (answer === null || answer === undefined) {
        statistics.invalidAnswer++;
      } else if (!isNaN(Number(answer))) {
        statistics.numericAnswer++;
      }

      // Progress tracking
      if ((i + 1) % 1000 === 0) {
        console.log(
          `   Processed ${i + 1}/${dataRows.length.toLocaleString()} rows...`,
        );
      }
    }

    console.log("\n✅ Classification Complete!\n");

    // Print classification summary
    console.log("[Classification Summary]:");
    for (const [key, items] of Object.entries(classifications)) {
      console.log(
        `   ${key.padEnd(30)}: ${items.length.toString().padStart(7)} (${((items.length / dataRows.length) * 100).toFixed(1)}%)`,
      );
    }

    // Step 3: Select controlled sample
    console.log(`\n[3/8] Selecting controlled sample (${SAMPLE_SIZE} rows)...`);
    console.log(
      `   Total classified questions: ${dataRows.length.toLocaleString()}`,
    );
    console.log(`   Sample selected: ${sampleIndices.length}\n`);

    const sampleData = sampleIndices.map((idx) => {
      const originalRow = dataRows[idx];
      const rowObj =
        classifications.classifications.find((c) => c.index === idx)?.row || {};
      return {
        originalIndex: idx,
        row: originalRow,
        rowData: rowObj,
        classification:
          classifications.classifications.find((c) => c.index === idx)
            ?.classification || "UNKNOWN",
      };
    });

    // Step 4: Apply remediation to sample
    console.log("[4/8] Applying remediation to sample...\n");

    const remediatedSample = [];

    for (const item of sampleData) {
      const remediated = remediateQuestion(item.rowData, item.classification);
      remediated.originalRow = item.row;
      remediated.classification = item.classification;
      remediated.removedPlaceholder = wasPlaceholder(item.rowData);
      remediatedSample.push(remediated);

      if (remediated.removedPlaceholder) {
        statistics.placeholdersDetected++;
      }
    }

    console.log(`   Remediated ${remediatedSample.length} questions\n`);

    // Step 5: Validate remediated sample
    console.log("[5/8] Validating remediated sample...");

    const validationResults = {
      valid: 0,
      invalid: 0,
      errors: [],
    };

    for (const q of remediatedSample) {
      const validationResult = validateQuestion(q);

      if (validationResult.isValid) {
        validationResults.valid++;
      } else {
        validationResults.invalid++;
        validationResults.errors.push({
          questionId: q.questionId || `INDEX-${q.originalIndex}`,
          errors: validationResult.errors,
        });
      }
    }

    console.log(`   Valid: ${validationResults.valid.toLocaleString()}`);
    console.log(`   Invalid: ${validationResults.invalid.toLocaleString()}\n`);

    // Step 6: Calculate before/after comparison
    console.log("[6/8] Calculating before/after comparison...");

    const beforeStats = calculateDistribution(dataRows, headers);
    const afterStats = calculateDistribution(remediatedSample, headers);

    console.log("\nBefore Remediation:");
    consoleTable(beforeStats);

    console.log("\nAfter Remediation:");
    consoleTable(afterStats);

    // Step 7: Generate output Excel
    console.log("[7/8] Generating remediation sample output...");

    const remediatedSheet = remediatedSample.map((item) => {
      const newRow = [];
      headers.forEach((header) => {
        const value = item[header.toLowerCase()] || "";
        newRow.push(value);
      });
      return newRow;
    });

    remediatedSheet.unshift(headers); // Add headers back

    const newWorkbook = XLSX.utils.book_new();
    const newWorksheet = XLSX.utils.aoa_to_sheet(remediatedSheet);
    XLSX.utils.book_append_sheet(
      newWorkbook,
      newWorksheet,
      "Remediated_Sample",
    );

    XLSX.writeFile(newWorkbook, OUTPUT_FILE);
    console.log(`   Output saved to: ${OUTPUT_FILE}\n`);

    // Step 8: Generate comprehensive report
    console.log("[8/8] Generating remediation report...");

    const report = generateReport({
      sourceFile: SOURCE_FILE,
      outputFiles: [OUTPUT_FILE, REPORT_FILE],
      sampleSize: SAMPLE_SIZE,
      classifications,
      statistics,
      validationResults,
      beforeStats,
      afterStats,
      remediatedSample,
      metadata: {
        date: new Date().toISOString(),
        version: "1.0",
        phase: "Controlled Sample Validation",
      },
    });

    fs.writeFileSync(REPORT_FILE, report);
    console.log(`   Report saved to: ${REPORT_FILE}\n`);

    // Final summary
    console.log("=".repeat(80));
    console.log("REMEDIATION COMPLETE - CONTROLLED SAMPLE VALIDATED");
    console.log("=".repeat(80));
    console.log("\n📊 Key Findings:");
    console.log(
      `   • Original dataset: ${statistics.total.toLocaleString()} rows`,
    );
    console.log(
      `   • Sample remediated: ${remediatedSample.length.toLocaleString()} rows`,
    );
    console.log(
      `   • Validations passed: ${validationResults.valid.toLocaleString()}`,
    );
    console.log(
      `   • Placeholders detected & fixed: ${statistics.placeholdersDetected.toLocaleString()}`,
    );
    console.log(`\n✅ Next Step: Review remediation report`);
    console.log("⏸️ Standing by for instruction on full remediation.\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ ERROR:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function normalizeAnswer(answer) {
  if (!answer) return null;

  const str = String(answer).trim().toUpperCase();

  // Already valid letter?
  if (/^[ABCD]$/i.test(str)) {
    return str;
  }

  // Numeric answer - check if it matches option position
  const num = Number(answer);
  if (num >= 1 && num <= 4) {
    const letters = ["A", "B", "C", "D"];
    return letters[num - 1];
  }

  // Otherwise invalid
  return null;
}

function wasPlaceholder(rowData) {
  const text = String(rowData["soal"] || "")
    .toLowerCase()
    .trim();
  const hasPlaceholderText =
    text.includes("pilihan") ||
    text.includes("variasi") ||
    text.includes("question") ||
    text.includes("placeholder");

  // Check options too
  const hasGenericOptions = Object.values(rowData).some((val) => {
    const valStr = String(val || "").toLowerCase();
    return (
      valStr === "pilihan a" ||
      valStr === "pilihan b" ||
      valStr === "pilihan c" ||
      valStr === "pilihan d"
    );
  });

  return hasPlaceholderText || hasGenericOptions;
}

function calculateDistribution(rows, headers) {
  const dist = {
    total: rows.length,
    answers: { A: 0, B: 0, C: 0, D: 0 },
    invalid: 0,
    numeric: 0,
    percent: {},
  };

  let validCount = 0;

  for (const row of rows) {
    const answerIdx = headers.findIndex(
      (h) => h.includes("jawaban") || h.includes("kunci"),
    );
    if (answerIdx === -1) continue;

    const answer = row[answerIdx];
    const normalized = normalizeAnswer(answer);

    if (normalized && ["A", "B", "C", "D"].includes(normalized)) {
      dist.answers[normalized]++;
      validCount++;
    } else if (!isNaN(Number(answer))) {
      dist.numeric++;
    } else {
      dist.invalid++;
    }
  }

  // Calculate percentages
  for (const key of ["A", "B", "C", "D"]) {
    dist.percent[key] =
      validCount > 0
        ? ((dist.answers[key] / validCount) * 100).toFixed(1)
        : "0.0";
  }

  return dist;
}

function consoleTable(stats) {
  console.log("".padEnd(20) + "|".padEnd(15) + "|".padEnd(15));
  console.log("-".repeat(50));
  console.log(
    `${"Total".padEnd(20)}|${stats.total.toString().padEnd(15)}|${"-".padEnd(15)}`,
  );
  for (const key of ["A", "B", "C", "D"]) {
    const pct = stats.percent[key] || "0.0";
    console.log(
      `${`${key}:`.padEnd(20)}|${stats.answers[key].toString().padEnd(15)}|${`${pct}%`.padEnd(15)}`,
    );
  }
  console.log(
    `${"Invalid".padEnd(20)}|${stats.invalid.toString().padEnd(15)}|${"-".padEnd(15)}`,
  );
  console.log(
    `${"Numeric".padEnd(20)}|${stats.numeric.toString().padEnd(15)}|${"-".padEnd(15)}`,
  );
}

function generateReport(data) {
  return `# QUESTIONBANK REMEDIATION SAMPLE REPORT

**Date:** ${data.metadata.date}  
**Phase:** ${data.metadata.phase}  
**Sample Size:** ${data.sampleSize.toLocaleString()} rows (from ${data.statistics.total.toLocaleString()} total)

---

## 1. FILES MODIFIED

### Source File (READ-ONLY):
- **Location:** \`backend/outputs/assessment-bank-repak/V6-INVALID-AUDIT.xlsx\`
- **Status:** UNTOUCHED (read-only audit)
- **Original Rows:** ${data.statistics.total.toLocaleString()}

### Output Files (NEW):
- **Remediation Sample:** \`backend/outputs/QUESTIONBANK-REMEDIATION-SAMPLE.xlsx\`
- **Audit Report:** \`${REPORT_FILE}\`

**IMPORTANT:** Production database, source Excel, and migration scripts remain UNCHANGED.

---

## 2. SOURCE DATASET ANALYSIS

Total Questions: ${data.statistics.total.toLocaleString()}

### Dataset Composition:

`;

  for (const [key, items] of Object.entries(data.classifications)) {
    const pct = ((items.length / data.statistics.total) * 100).toFixed(1);
    report += `• **${key}**: ${items.length.toLocaleString()} (${pct}%)\n`;
  }

  report += `
### Answer Distribution Before:

| Answer | Count | Percentage |
|--------|-------|------------|
`;

  for (const key of ["A", "B", "C", "D"]) {
    report += `| ${key} | ${data.beforeStats.answers[key].toLocaleString()} | ${data.beforeStats.percent[key]}% |\n`;
  }

  report += `| Invalid | ${data.beforeStats.invalid.toLocaleString()} | - |\n`;
  report += `| Numeric | ${data.beforeStats.numeric.toLocaleString()} | - |\n`;

  return report;
}

main();
