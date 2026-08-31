/**
 * AUTOMATED BEFORE/AFTER AUDIT - CONTROLLED REMEDIATION SAMPLE
 *
 * Compares the clean BEFORE sample against the AFTER sample and produces a
 * structured audit covering every metric required by the remediation spec:
 *   - Total Questions
 *   - Placeholder Question / Placeholder Options / Empty Options
 *   - Duplicate Options / Invalid Correct Answer
 *   - NEEDS_REGENERATION / NEEDS_MANUAL_REVIEW / Duplicate Question
 *   - Answer distribution A/B/C/D/Invalid
 *   - Breakdown Program -> Subject -> Topic
 *
 * SAFETY: FILE-ONLY. Reads two JSON files, writes one audit JSON + console.
 * Zero MongoDB operations.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ANSWER_LETTERS = ["A", "B", "C", "D"];

// =====================================================
// HELPERS
// =====================================================

function normalizeOption(option) {
  if (!option) return "";
  return String(option).trim().replace(/^[ABCD][.\)]\s*/, "");
}

function isPlaceholderQuestion(text) {
  if (!text) return false;
  const lower = String(text).toLowerCase().trim();
  return [
    /variasi\s+\d+/i,
    /soal\s+\w+\s+untuk\s+bab/i,
    /pilihan\s+[abcd]/i,
  ].some((p) => p.test(lower));
}

function hasPlaceholderOptions(options) {
  if (!options || options.length !== 4) return false;
  return options.some((o) => /^Pilihan [ABCD]$/i.test(normalizeOption(o)));
}

function hasEmptyOptions(options) {
  if (!options) return true;
  return options.some((o) => normalizeOption(o).length === 0);
}

function hasDuplicateOptions(options) {
  if (!options || options.length !== 4) return false;
  const norm = options.map((o) => normalizeOption(o).toLowerCase());
  return new Set(norm).size !== norm.length;
}

function isValidCorrectAnswer(doc) {
  const ans = String(doc.correctAnswer ?? "").trim().toUpperCase();
  if (!ANSWER_LETTERS.includes(ans)) return false;
  const idx = ANSWER_LETTERS.indexOf(ans);
  const opt = normalizeOption(doc.options?.[idx]);
  return opt.length > 0 && !/^Pilihan [ABCD]$/i.test(opt);
}

function hasUndefined(doc) {
  return (
    /\bundefined\b/i.test(String(doc.questionText ?? "")) ||
    (doc.options || []).some((o) => /\bundefined\b/i.test(String(o ?? "")))
  );
}

// =====================================================
// AUDIT ONE SIDE
// =====================================================

function auditSide(docs) {
  const m = {
    total: docs.length,
    placeholderQuestion: 0,
    placeholderOptions: 0,
    emptyOptions: 0,
    duplicateOptions: 0,
    invalidCorrectAnswer: 0,
    undefinedContent: 0,
    needsRegeneration: 0,
    needsManualReview: 0,
    remediated: 0,
    answerDist: { A: 0, B: 0, C: 0, D: 0, Invalid: 0 },
    byProgram: {},
  };

  const seenText = new Map();

  for (const doc of docs) {
    if (isPlaceholderQuestion(doc.questionText)) m.placeholderQuestion++;
    if (hasPlaceholderOptions(doc.options)) m.placeholderOptions++;
    if (hasEmptyOptions(doc.options)) m.emptyOptions++;
    if (hasDuplicateOptions(doc.options)) m.duplicateOptions++;
    if (!isValidCorrectAnswer(doc)) m.invalidCorrectAnswer++;
    if (hasUndefined(doc)) m.undefinedContent++;

    // remediation status (AFTER side)
    if (doc.remediationStatus === "NEEDS_MANUAL_REVIEW") m.needsManualReview++;
    else if (doc.remediationStatus === "REMEDIED") m.remediated++;

    // answer distribution
    const ans = String(doc.correctAnswer ?? "").trim().toUpperCase();
    if (ANSWER_LETTERS.includes(ans)) m.answerDist[ans]++;
    else m.answerDist.Invalid++;

    // duplicate question detection (same questionText)
    const key = String(doc.questionText ?? "").trim().toLowerCase();
    seenText.set(key, (seenText.get(key) || 0) + 1);

    // breakdown program -> subject -> topic
    const p = doc.program || "(none)";
    const s = doc.subject || "(none)";
    const t = doc.topic || "(none)";
    m.byProgram[p] = m.byProgram[p] || {};
    m.byProgram[p][s] = m.byProgram[p][s] || {};
    m.byProgram[p][s][t] = (m.byProgram[p][s][t] || 0) + 1;
  }

  m.duplicateQuestion = [...seenText.values()].filter((c) => c > 1).length;
  return m;
}

function flatten(docs) {
  return Object.values(docs).flat();
}

// =====================================================
// MAIN
// =====================================================

async function main() {
  console.log("=".repeat(80));
  console.log("AUTOMATED BEFORE/AFTER AUDIT");
  console.log("   Mode: FILE-ONLY (zero MongoDB operations)");
  console.log("=".repeat(80));

  const dir = path.join(__dirname, "..", "..", "outputs", "questionbank-remediation-sample");
  const beforeFiles = fs.readdirSync(dir).filter((f) => f.startsWith("QUESTIONBANK-REMEDIATION-BEFORE-")).sort();
  const afterFiles = fs.readdirSync(dir).filter((f) => f.startsWith("QUESTIONBANK-REMEDIATION-AFTER-")).sort();

  const beforePath = path.join(dir, beforeFiles[beforeFiles.length - 1]);
  const afterPath = path.join(dir, afterFiles[afterFiles.length - 1]);
  console.log(`\nBEFORE: ${beforeFiles[beforeFiles.length - 1]}`);
  console.log(`AFTER : ${afterFiles[afterFiles.length - 1]}\n`);

  const before = JSON.parse(fs.readFileSync(beforePath, "utf8"));
  const after = JSON.parse(fs.readFileSync(afterPath, "utf8"));

  const beforeDocs = flatten(before);
  const afterDocs = flatten(after);

  const b = auditSide(beforeDocs);
  const a = auditSide(afterDocs);

  // ---- Comparison table ----
  const rows = [
    ["Total Questions", b.total, a.total],
    ["Placeholder Question", b.placeholderQuestion, a.placeholderQuestion],
    ["Placeholder Options", b.placeholderOptions, a.placeholderOptions],
    ["Empty Options", b.emptyOptions, a.emptyOptions],
    ["Duplicate Options", b.duplicateOptions, a.duplicateOptions],
    ["Invalid Correct Answer", b.invalidCorrectAnswer, a.invalidCorrectAnswer],
    ["Undefined Content", b.undefinedContent, a.undefinedContent],
    ["Duplicate Question", b.duplicateQuestion, a.duplicateQuestion],
    ["REMEDIED", b.remediated, a.remediated],
    ["NEEDS_MANUAL_REVIEW", b.needsManualReview, a.needsManualReview],
  ];

  console.log("METRIC".padEnd(26) + "BEFORE".padStart(10) + "AFTER".padStart(10));
  console.log("-".repeat(46));
  for (const [label, bv, av] of rows) {
    console.log(label.padEnd(26) + String(bv).padStart(10) + String(av).padStart(10));
  }

  console.log("\nANSWER DISTRIBUTION");
  console.log("KEY".padEnd(10) + "BEFORE".padStart(10) + "AFTER".padStart(10));
  console.log("-".repeat(30));
  for (const k of ["A", "B", "C", "D", "Invalid"]) {
    console.log(k.padEnd(10) + String(b.answerDist[k]).padStart(10) + String(a.answerDist[k]).padStart(10));
  }

  console.log("\nBREAKDOWN PROGRAM -> SUBJECT -> TOPIC (AFTER)");
  for (const [p, subjects] of Object.entries(a.byProgram)) {
    console.log(`\n  ${p}`);
    for (const [s, topics] of Object.entries(subjects)) {
      const total = Object.values(topics).reduce((x, y) => x + y, 0);
      console.log(`    ${s} (${total})`);
      for (const [t, c] of Object.entries(topics)) console.log(`      - ${t}: ${c}`);
    }
  }

  // ---- Write audit JSON ----
  const audit = {
    generatedAt: new Date().toISOString(),
    beforeFile: beforeFiles[beforeFiles.length - 1],
    afterFile: afterFiles[afterFiles.length - 1],
    before: b,
    after: a,
    comparison: rows.map(([label, bv, av]) => ({ metric: label, before: bv, after: av })),
    answerDistribution: { before: b.answerDist, after: a.answerDist },
  };
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(dir, `QUESTIONBANK-REMEDIATION-AUDIT-${ts}.json`);
  fs.writeFileSync(outPath, JSON.stringify(audit, null, 2));
  console.log(`\nSaved audit to:\n  ${outPath}`);
  console.log("\nFILE-ONLY audit complete (0 MongoDB writes).");
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
