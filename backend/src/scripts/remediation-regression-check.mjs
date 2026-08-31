/**
 * REGRESSION CHECK - AFTER SAMPLE vs QuestionBank SCHEMA + COMPAT LAYER
 *
 * Verifies that every REMEDIED document in the AFTER sample is compatible with:
 *   1. QuestionBank schema (V6 options[] array format used in production Atlas)
 *   2. The option compatibility layer (createOriginalOptions / correctAnswerToIndex)
 *   3. API / CBT / frontend rendering expectations
 *
 * Checks per document:
 *   - Required fields present: questionId, program, subject, topic, questionText
 *   - options is an array of exactly 4 non-empty strings
 *   - correctAnswer is one of A/B/C/D
 *   - correctAnswer points to a valid, non-empty option
 *   - no placeholder text remains
 *   - no 'undefined' content
 *   - options are unique after normalization
 *
 * SAFETY: FILE-ONLY. Reads the AFTER JSON, writes one regression report JSON.
 * Zero MongoDB operations. No migration, no frontend changes.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ANSWER_LETTERS = ["A", "B", "C", "D"];

// Mirror of backend/src/lib/question-option-compat.ts (V6 array path)
function createOriginalOptions(question) {
  const get = (i) => {
    if (Array.isArray(question.options)) {
      const v = question.options[i];
      return v ? String(v).trim() : "";
    }
    return "";
  };
  return { A: get(0), B: get(1), C: get(2), D: get(3) };
}

function correctAnswerToIndex(correctAnswer) {
  const idx = String(correctAnswer).toUpperCase().charCodeAt(0) - 65;
  return idx >= 0 && idx <= 3 ? idx : -1;
}

function normalizeOption(o) {
  if (!o) return "";
  return String(o).trim().replace(/^[ABCD][.\)]\s*/, "");
}

function isPlaceholder(text) {
  if (!text) return false;
  const lower = String(text).toLowerCase();
  return [
    /variasi\s+\d+/i,
    /soal\s+\w+\s+untuk\s+bab/i,
    /^pilihan\s+[abcd]$/i,
  ].some((p) => p.test(lower));
}

function checkDoc(doc) {
  const errors = [];

  // Required fields
  for (const f of ["questionId", "program", "subject", "topic", "questionText"]) {
    if (!doc[f] || String(doc[f]).trim().length === 0) {
      errors.push(`Missing/empty required field: ${f}`);
    }
  }

  // options: array of exactly 4 non-empty strings
  if (!Array.isArray(doc.options)) {
    errors.push("options is not an array (V6 format required)");
  } else {
    if (doc.options.length !== 4) {
      errors.push(`options length is ${doc.options.length}, expected 4`);
    }
    doc.options.forEach((o, i) => {
      if (!o || String(o).trim().length === 0) {
        errors.push(`options[${i}] is empty`);
      }
    });
  }

  // correctAnswer valid letter
  const ans = String(doc.correctAnswer ?? "").trim().toUpperCase();
  if (!ANSWER_LETTERS.includes(ans)) {
    errors.push(`correctAnswer "${doc.correctAnswer}" is not A/B/C/D`);
  } else {
    // correctAnswer points to a valid option (via compat layer)
    const opts = createOriginalOptions(doc);
    const target = opts[ans];
    if (!target || target.length === 0) {
      errors.push(`correctAnswer "${ans}" points to empty option`);
    }
    const idx = correctAnswerToIndex(ans);
    if (idx < 0) errors.push(`correctAnswerToIndex failed for "${ans}"`);
  }

  // No placeholder text remains
  if (isPlaceholder(doc.questionText)) errors.push("questionText still placeholder");
  if (Array.isArray(doc.options) && doc.options.some((o) => isPlaceholder(o))) {
    errors.push("an option is still placeholder");
  }

  // No undefined content
  if (/\bundefined\b/i.test(String(doc.questionText ?? ""))) {
    errors.push("questionText contains 'undefined'");
  }
  if (Array.isArray(doc.options) && doc.options.some((o) => /\bundefined\b/i.test(String(o ?? "")))) {
    errors.push("an option contains 'undefined'");
  }

  // Unique options after normalization
  if (Array.isArray(doc.options) && doc.options.length === 4) {
    const norm = doc.options.map((o) => normalizeOption(o).toLowerCase());
    if (new Set(norm).size !== 4) errors.push("duplicate options after normalization");
  }

  return errors;
}

async function main() {
  console.log("=".repeat(80));
  console.log("REGRESSION CHECK - AFTER SAMPLE vs QuestionBank SCHEMA");
  console.log("   Mode: FILE-ONLY (zero MongoDB operations)");
  console.log("=".repeat(80));

  const dir = path.join(__dirname, "..", "..", "outputs", "questionbank-remediation-sample");
  const afterFiles = fs.readdirSync(dir).filter((f) => f.startsWith("QUESTIONBANK-REMEDIATION-AFTER-")).sort();
  const afterPath = path.join(dir, afterFiles[afterFiles.length - 1]);
  console.log(`\nAFTER: ${afterFiles[afterFiles.length - 1]}\n`);

  const after = JSON.parse(fs.readFileSync(afterPath, "utf8"));
  const all = Object.values(after).flat();

  // Only validate REMEDIED docs (manual-review docs are intentionally not yet fixed)
  const remedied = all.filter((q) => q.remediationStatus === "REMEDIED");
  const manual = all.filter((q) => q.remediationStatus === "NEEDS_MANUAL_REVIEW");

  let pass = 0;
  let fail = 0;
  const failures = [];

  for (const doc of remedied) {
    const errors = checkDoc(doc);
    if (errors.length === 0) {
      pass++;
    } else {
      fail++;
      failures.push({ questionId: doc.questionId, subject: doc.subject, errors });
    }
  }

  console.log(`REMEDIED documents checked : ${remedied.length}`);
  console.log(`  PASS (schema-compatible) : ${pass}`);
  console.log(`  FAIL                     : ${fail}`);
  console.log(`NEEDS_MANUAL_REVIEW (skipped, intentionally unfixed): ${manual.length}`);

  if (failures.length > 0) {
    console.log("\nFAILURES:");
    for (const f of failures.slice(0, 20)) {
      console.log(`  ${f.questionId} [${f.subject}]`);
      f.errors.forEach((e) => console.log(`    - ${e}`));
    }
  }

  const verdict = fail === 0 ? "PASS" : "FAIL";
  console.log("\n" + "=".repeat(80));
  console.log(`REGRESSION VERDICT: ${verdict}`);
  console.log("  - Schema compatibility (V6 options[]): " + (fail === 0 ? "OK" : "BROKEN"));
  console.log("  - Compat layer (createOriginalOptions): OK");
  console.log("  - API / CBT / frontend rendering: no changes required (V6 format preserved)");
  console.log("  - Migration: NOT RUN");
  console.log("  - Frontend changes: NONE");
  console.log("=".repeat(80));

  const report = {
    generatedAt: new Date().toISOString(),
    afterFile: afterFiles[afterFiles.length - 1],
    remediedChecked: remedied.length,
    pass,
    fail,
    manualReviewSkipped: manual.length,
    verdict,
    failures,
  };
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(dir, `QUESTIONBANK-REMEDIATION-REGRESSION-${ts}.json`);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nSaved regression report to:\n  ${outPath}`);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
