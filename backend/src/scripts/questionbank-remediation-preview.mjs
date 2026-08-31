/**
 * QUESTION BANK CONTENT REMEDIATION PIPELINE — READ-ONLY PREVIEW
 *
 * Input (READ-ONLY, never modified):
 *   backend/outputs/assessment-bank-rekap/REKAP-BANK-SOAL-VARIED-V6.xlsx
 *
 * Outputs (NEW files only):
 *   backend/outputs/questionbank-remediation-preview/
 *     1. QUESTIONBANK-REMEDIATION-PREVIEW.xlsx  (all rows + audit columns)
 *     2. QUESTIONBANK-REMEDIATION-AUDIT.json    (stats + breakdowns)
 *     3. QUESTIONBANK-INVALID-QUARANTINE.xlsx   (unsafe rows only)
 *
 * SAFETY (absolute):
 *   - No content fabrication. No guessing. No fuzzy matching. No random replacement.
 *   - No writes to the original Excel. No MongoDB writes. No row deletion.
 *   - AUTO_REKEY is the ONLY mutation: deterministic exact-match of a numeric
 *     answer value to the single option that equals it, mapped to A/B/C/D.
 *   - Every unrecoverable row -> CONTENT_INVALID + REPLACEMENT_REQUIRED (quarantine).
 *
 * Status taxonomy:
 *   UNCHANGED_VALID | AUTO_REKEY | AUTO_REPAIR | AUTO_REGENERATE |
 *   AMBIGUOUS | UNRESOLVED | CONTENT_INVALID
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import XLSX from "xlsx";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_XLSX = path.join(
  __dirname, "..", "..", "outputs", "assessment-bank-rekap", "REKAP-BANK-SOAL-VARIED-V6.xlsx"
);
const OUT_DIR = path.join(__dirname, "..", "..", "outputs", "questionbank-remediation-preview");

const ANSWER_LETTERS = ["A", "B", "C", "D"];
const OPTION_COLUMNS = ["Opsi A", "Opsi B", "Opsi C", "Opsi D"];

// =====================================================
// DETECTION HELPERS
// =====================================================

const BUG_TOKEN_RE = /\bundefined\b|\bnull\b|\bNaN\b|\[object Object\]/i;
const NUMERIC_RE = /^-?\d+(\.\d+)?$/;

function str(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function isPlaceholderSoal(text) {
  return (
    /untuk\s+Bab\s+\d/i.test(text) ||
    /english language question for/i.test(text) ||
    /-\s*Variasi\s+\d+\s*$/i.test(text)
  );
}

const PLACEHOLDER_OPTION_RE =
  /^(Pilihan|Option)\s+[A-D]$|^Salah\s*\d+$|^Jawaban\s+Salah\s*\d+$/i;

/**
 * Detect content-level issues in Soal / Opsi / Pembahasan.
 * Returns a list of issue codes (empty = content clean).
 */
function detectContentIssues(row) {
  const issues = [];
  const soal = str(row["Soal"]);
  const options = OPTION_COLUMNS.map((c) => str(row[c]));
  const pembahasan = str(row["Pembahasan"]);

  if (!soal) issues.push("EMPTY_SOAL");
  if (BUG_TOKEN_RE.test(soal)) issues.push("UNDEFINED_SOAL");
  if (isPlaceholderSoal(soal)) issues.push("PLACEHOLDER_SOAL");

  options.forEach((o) => {
    if (!o) issues.push("EMPTY_OPTION");
    if (BUG_TOKEN_RE.test(o)) issues.push("UNDEFINED_OPTION");
    if (PLACEHOLDER_OPTION_RE.test(o)) issues.push("PLACEHOLDER_OPTION");
  });

  const uniqueLower = new Set(options.map((o) => o.toLowerCase()));
  if (uniqueLower.size !== options.length) issues.push("DUPLICATE_OPTION");

  if (BUG_TOKEN_RE.test(pembahasan)) issues.push("UNDEFINED_PEMBAHASAN");

  return [...new Set(issues)];
}

/**
 * Map a content issue code to a quarantine invalidReason.
 */
function toInvalidReasons(issueCodes) {
  const map = {
    EMPTY_SOAL: "EMPTY_SOAL_NO_SOURCE",
    UNDEFINED_SOAL: "UNDEFINED_NO_SOURCE",
    PLACEHOLDER_SOAL: "PLACEHOLDER_NO_SOURCE",
    EMPTY_OPTION: "EMPTY_OPTION_NO_SOURCE",
    UNDEFINED_OPTION: "UNDEFINED_NO_SOURCE",
    PLACEHOLDER_OPTION: "PLACEHOLDER_NO_SOURCE",
    DUPLICATE_OPTION: "DUPLICATE_OPTION_NO_SOURCE",
    UNDEFINED_PEMBAHASAN: "UNDEFINED_NO_SOURCE",
  };
  return [...new Set(issueCodes.map((c) => map[c] || `${c}_NO_SOURCE`))];
}

/**
 * Attempt deterministic re-key for a numeric answer value.
 * Returns { letter, matchType } or { letter: null, ambiguity }.
 * NO fuzzy matching: exact string equality first, then exact numeric equality.
 */
function resolveNumericKey(key, options) {
  const stringMatches = [];
  options.forEach((o, i) => {
    if (o === key) stringMatches.push(ANSWER_LETTERS[i]);
  });
  if (stringMatches.length === 1) return { letter: stringMatches[0], matchType: "EXACT_STRING" };
  if (stringMatches.length > 1) return { letter: null, ambiguity: "MULTI_STRING_MATCH" };

  const numericMatches = [];
  options.forEach((o, i) => {
    if (NUMERIC_RE.test(o) && Number(o) === Number(key)) numericMatches.push(ANSWER_LETTERS[i]);
  });
  if (numericMatches.length === 1) return { letter: numericMatches[0], matchType: "EXACT_NUMERIC" };
  if (numericMatches.length > 1) return { letter: null, ambiguity: "MULTI_NUMERIC_MATCH" };

  return { letter: null, ambiguity: "NO_MATCH" };
}

/**
 * Post-repair validation for a row given its final answer letter.
 * Returns { pass, failures[] }.
 */
function validateRow(row, finalLetter) {
  const failures = [];
  const soal = str(row["Soal"]);
  const options = OPTION_COLUMNS.map((c) => str(row[c]));
  const pembahasan = str(row["Pembahasan"]);

  if (!soal || isPlaceholderSoal(soal) || BUG_TOKEN_RE.test(soal)) failures.push("SOAL_INVALID");
  options.forEach((o, i) => {
    if (!o || PLACEHOLDER_OPTION_RE.test(o) || BUG_TOKEN_RE.test(o)) failures.push(`OPTION_${ANSWER_LETTERS[i]}_INVALID`);
  });
  if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) failures.push("OPTIONS_DUPLICATE");
  if (!ANSWER_LETTERS.includes(finalLetter)) failures.push("KEY_NOT_LETTER");
  if (BUG_TOKEN_RE.test(pembahasan)) failures.push("PEMBAHASAN_INVALID");

  return { pass: failures.length === 0, failures };
}

// =====================================================
// MAIN
// =====================================================

function main() {
  console.log("=".repeat(70));
  console.log("QUESTION BANK REMEDIATION PIPELINE — READ-ONLY PREVIEW");
  console.log("=".repeat(70));

  if (!fs.existsSync(INPUT_XLSX)) {
    console.error("INPUT FILE NOT FOUND:", INPUT_XLSX);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const workbook = XLSX.readFile(INPUT_XLSX);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
  const originalHeaders = rows.length ? Object.keys(rows[0]) : [];

  console.log(`Loaded ${rows.length} rows from ${path.basename(INPUT_XLSX)}`);

  const previewRows = [];
  const quarantineRows = [];

  const stats = {
    total: rows.length,
    UNCHANGED_VALID: 0,
    AUTO_REKEY: 0,
    AUTO_REPAIR: 0,
    AUTO_REGENERATE: 0,
    AMBIGUOUS: 0,
    UNRESOLVED: 0,
    CONTENT_INVALID: 0,
  };

  const byProgram = {};
  const bySubject = {};
  const byVariationType = {};
  const byVariationStatus = {};
  const byInvalidReason = {};
  const samples = {
    UNCHANGED_VALID: [],
    AUTO_REKEY: [],
    AMBIGUOUS: [],
    UNRESOLVED: [],
    CONTENT_INVALID: [],
  };

  function bump(map, key, status) {
    if (!map[key]) map[key] = { total: 0 };
    map[key].total += 1;
    map[key][status] = (map[key][status] || 0) + 1;
  }

  rows.forEach((row, index) => {
    const originalRowNumber = index + 2; // +1 header, +1 one-based
    const questionId = str(row["ID Unik Soal"]);
    const originalKey = str(row["Kunci Jawaban"]);
    const originalSoal = str(row["Soal"]);
    const options = OPTION_COLUMNS.map((c) => str(row[c]));
    const program = str(row["Program/Kelas"]) || "(empty)";
    const subject = str(row["Mata Pelajaran"]) || "(empty)";
    const variationType = str(row["variation_type"]) || "(none)";
    const variationStatus = str(row["variation_status"]) || "(none)";

    const contentIssues = detectContentIssues(row);
    const upperKey = originalKey.toUpperCase();
    const isLetterKey = ANSWER_LETTERS.includes(upperKey);
    const isNumericKey = NUMERIC_RE.test(originalKey);

    let remediationStatus;
    let remediationReason;
    let remediatedAnswerKey = null;
    let remediatedSoal = originalSoal; // never altered except by deterministic rekey (soal untouched)
    let validationStatus;
    let invalidReasons = [];

    if (contentIssues.length > 0) {
      // Content is broken and has NO recoverable source data -> quarantine.
      remediationStatus = "CONTENT_INVALID";
      invalidReasons = toInvalidReasons(contentIssues);
      remediationReason = `Content broken: ${contentIssues.join(", ")}. No recoverable source data.`;
      validationStatus = "FAIL";
    } else if (isLetterKey) {
      remediationStatus = "UNCHANGED_VALID";
      remediationReason = "Content valid; answer key already a letter A-D.";
      remediatedAnswerKey = upperKey;
      const v = validateRow(row, upperKey);
      validationStatus = v.pass ? "PASS" : `FAIL:${v.failures.join(",")}`;
    } else if (isNumericKey) {
      const resolved = resolveNumericKey(originalKey, options);
      if (resolved.letter) {
        remediationStatus = "AUTO_REKEY";
        remediatedAnswerKey = resolved.letter;
        remediationReason = `Numeric key "${originalKey}" exactly matches Opsi ${resolved.letter} (${resolved.matchType}).`;
        const v = validateRow(row, resolved.letter);
        // Extra guard: the letter must point to an option equal to the numeric value.
        const pointed = options[ANSWER_LETTERS.indexOf(resolved.letter)];
        const pointsCorrectly =
          pointed === originalKey ||
          (NUMERIC_RE.test(pointed) && Number(pointed) === Number(originalKey));
        validationStatus = v.pass && pointsCorrectly ? "PASS" : `FAIL:${[...v.failures, "KEY_MISMATCH"].join(",")}`;
      } else if (resolved.ambiguity && resolved.ambiguity.startsWith("MULTI")) {
        remediationStatus = "AMBIGUOUS";
        remediationReason = `Numeric key "${originalKey}" matches multiple options (${resolved.ambiguity}). Cannot determine safely.`;
        validationStatus = "FAIL";
      } else {
        remediationStatus = "UNRESOLVED";
        remediationReason = `Numeric key "${originalKey}" matches no option. Cannot re-key deterministically.`;
        validationStatus = "FAIL";
      }
    } else {
      // Non-letter, non-numeric key (e.g. "0A", "Contoh jawaban", fractions).
      remediationStatus = "UNRESOLVED";
      remediationReason = `Malformed answer key "${originalKey}". No deterministic recovery available.`;
      invalidReasons = ["INVALID_KEY_NO_SOURCE"];
      validationStatus = "FAIL";
    }

    stats[remediationStatus] += 1;
    bump(byProgram, program, remediationStatus);
    bump(bySubject, subject, remediationStatus);
    bump(byVariationType, variationType, remediationStatus);
    bump(byVariationStatus, variationStatus, remediationStatus);
    invalidReasons.forEach((r) => {
      byInvalidReason[r] = (byInvalidReason[r] || 0) + 1;
    });

    if (samples[remediationStatus] && samples[remediationStatus].length < 10) {
      samples[remediationStatus].push({
        originalRowNumber,
        questionId,
        program,
        subject,
        originalKey,
        remediatedAnswerKey,
        remediationReason,
        soal: originalSoal.slice(0, 80),
      });
    }

    // Preview row: original columns + audit columns.
    const previewRow = { ...row };
    previewRow["remediationStatus"] = remediationStatus;
    previewRow["remediationReason"] = remediationReason;
    previewRow["originalAnswerKey"] = originalKey;
    previewRow["remediatedAnswerKey"] = remediatedAnswerKey;
    previewRow["originalSoal"] = originalSoal;
    previewRow["remediatedSoal"] = remediatedSoal;
    previewRow["validationStatus"] = validationStatus;
    previewRows.push(previewRow);

    // Quarantine: everything NOT safe for production.
    const isSafe = remediationStatus === "UNCHANGED_VALID" || remediationStatus === "AUTO_REKEY";
    if (!isSafe) {
      const qRow = { ...row };
      qRow["originalRowNumber"] = originalRowNumber;
      qRow["questionId"] = questionId;
      qRow["remediationStatus"] = remediationStatus;
      qRow["invalidReason"] = invalidReasons.length ? invalidReasons.join("; ") : remediationReason;
      qRow["repairAttempted"] = remediationStatus === "AUTO_REKEY" ? "rekey" : "none";
      qRow["repairResult"] = validationStatus;
      qRow["replacementRequired"] = true;
      quarantineRows.push(qRow);
    }
  });

  // =====================================================
  // WRITE OUTPUTS
  // =====================================================

  // 1. Preview Excel (all rows).
  const previewSheet = XLSX.utils.json_to_sheet(previewRows);
  const previewWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(previewWb, previewSheet, "Remediation Preview");
  const previewPath = path.join(OUT_DIR, "QUESTIONBANK-REMEDIATION-PREVIEW.xlsx");
  XLSX.writeFile(previewWb, previewPath);

  // 2. Quarantine Excel (unsafe rows only).
  const quarantineSheet = XLSX.utils.json_to_sheet(quarantineRows);
  const quarantineWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(quarantineWb, quarantineSheet, "Quarantine");
  const quarantinePath = path.join(OUT_DIR, "QUESTIONBANK-INVALID-QUARANTINE.xlsx");
  XLSX.writeFile(quarantineWb, quarantinePath);

  // 3. Audit JSON.
  const audit = {
    generatedAt: new Date().toISOString(),
    mode: "READ-ONLY / PREVIEW",
    inputFile: path.basename(INPUT_XLSX),
    stats,
    quarantine: {
      total: quarantineRows.length,
      CONTENT_INVALID: stats.CONTENT_INVALID,
      REPLACEMENT_REQUIRED: quarantineRows.length,
    },
    breakdown: {
      byProgram,
      bySubject,
      byVariationType,
      byVariationStatus,
      byInvalidReason,
    },
    samples,
  };
  const auditPath = path.join(OUT_DIR, "QUESTIONBANK-REMEDIATION-AUDIT.json");
  fs.writeFileSync(auditPath, JSON.stringify(audit, null, 2));

  // =====================================================
  // CONSOLE SUMMARY
  // =====================================================

  console.log("\n=== REMEDIATION SUMMARY ===\n");
  console.log(`Total rows:        ${stats.total}`);
  console.log(`UNCHANGED_VALID:   ${stats.UNCHANGED_VALID}`);
  console.log(`AUTO_REKEY:        ${stats.AUTO_REKEY}`);
  console.log(`AUTO_REPAIR:       ${stats.AUTO_REPAIR}`);
  console.log(`AUTO_REGENERATE:   ${stats.AUTO_REGENERATE}`);
  console.log(`AMBIGUOUS:         ${stats.AMBIGUOUS}`);
  console.log(`UNRESOLVED:        ${stats.UNRESOLVED}`);
  console.log(`CONTENT_INVALID:   ${stats.CONTENT_INVALID}`);

  console.log("\n=== QUARANTINE ===\n");
  console.log(`Quarantined rows:      ${quarantineRows.length}`);
  console.log(`CONTENT_INVALID:       ${stats.CONTENT_INVALID}`);
  console.log(`REPLACEMENT_REQUIRED:  ${quarantineRows.length}`);

  console.log("\n--- Breakdown by invalidReason ---");
  Object.entries(byInvalidReason).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`  ${k}: ${v}`);
  });

  console.log("\n--- Breakdown by Mata Pelajaran (top statuses) ---");
  Object.entries(bySubject).forEach(([k, v]) => {
    console.log(`  ${k}: total=${v.total} valid=${v.UNCHANGED_VALID || 0} rekey=${v.AUTO_REKEY || 0} invalid=${v.CONTENT_INVALID || 0} unresolved=${v.UNRESOLVED || 0}`);
  });

  console.log("\n--- Breakdown by variation_status ---");
  Object.entries(byVariationStatus).forEach(([k, v]) => {
    console.log(`  ${k}: total=${v.total} valid=${v.UNCHANGED_VALID || 0} rekey=${v.AUTO_REKEY || 0} invalid=${v.CONTENT_INVALID || 0} unresolved=${v.UNRESOLVED || 0}`);
  });

  console.log("\n--- Breakdown by variation_type ---");
  Object.entries(byVariationType).forEach(([k, v]) => {
    console.log(`  ${k}: total=${v.total} valid=${v.UNCHANGED_VALID || 0} rekey=${v.AUTO_REKEY || 0} invalid=${v.CONTENT_INVALID || 0} unresolved=${v.UNRESOLVED || 0}`);
  });

  // Samples per category.
  for (const status of ["UNCHANGED_VALID", "AUTO_REKEY", "AMBIGUOUS", "UNRESOLVED", "CONTENT_INVALID"]) {
    console.log(`\n=== SAMPLES: ${status} (${samples[status].length}) ===`);
    samples[status].forEach((s, i) => {
      console.log(`  [${i + 1}] row=${s.originalRowNumber} id=${s.questionId} key="${s.originalKey}" -> "${s.remediatedAnswerKey ?? "-"}"`);
      console.log(`      ${s.program} / ${s.subject}`);
      console.log(`      soal: ${s.soal}`);
      console.log(`      reason: ${s.remediationReason}`);
    });
  }

  // Quarantine samples.
  console.log("\n=== QUARANTINE SAMPLES (10) ===");
  quarantineRows.slice(0, 10).forEach((q, i) => {
    console.log(`  [${i + 1}] row=${q.originalRowNumber} id=${q.questionId} status=${q.remediationStatus}`);
    console.log(`      invalidReason: ${q.invalidReason}`);
    console.log(`      soal: ${str(q["Soal"]).slice(0, 80)}`);
    console.log(`      opsi: A="${str(q["Opsi A"]).slice(0, 25)}" B="${str(q["Opsi B"]).slice(0, 25)}" C="${str(q["Opsi C"]).slice(0, 25)}" D="${str(q["Opsi D"]).slice(0, 25)}"`);
  });

  console.log("\n=== OUTPUT FILES ===");
  console.log(`  ${previewPath}`);
  console.log(`  ${quarantinePath}`);
  console.log(`  ${auditPath}`);
  console.log("\nREAD-ONLY PREVIEW COMPLETE. No MongoDB writes. Original Excel untouched.");
  console.log("STOP. Do NOT import remediation results to MongoDB without further instruction.");
}

main();
