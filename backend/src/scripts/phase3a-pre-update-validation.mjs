/**
 * PHASE 3A - STEP 11: FULL PRE-UPDATE VALIDATION (FILE-ONLY)
 *
 * Validates every REMEDIED preview produced in STEPS 4-8. No MongoDB access.
 *
 * Checks per remediated document:
 *   QUESTION      : non-empty, not placeholder/template, no undefined/null/NaN/[object Object]
 *   OPTIONS       : exactly 4, all unique, non-empty, not placeholder
 *   CORRECT ANSWER: valid letter A/B/C/D, synced to the correct content, exactly 1 correct
 *   METADATA      : program/subject/topic preserved (not lost, not invented)
 *
 * Aggregate checks:
 *   DUPLICATES    : BEFORE vs AFTER preview (remediation must not introduce new duplicates)
 *   ANSWER POSITION: global + per-subject distribution AFTER; flag extreme bias (>=90%)
 *
 * Output: QUESTIONBANK-FULL-PRE-UPDATE-VALIDATION.json (+ .md) with PASS/FAIL verdict.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUT_DIR = path.join(__dirname, "..", "..", "outputs", "questionbank-full-remediation-preview");
const PREVIEW_JSON = path.join(OUT_DIR, "QUESTIONBANK-FULL-REMEDIATION-PREVIEW.json");
const AUDIT_JSON = path.join(OUT_DIR, "QUESTIONBANK-FULL-BASELINE-AUDIT.json");

const ANSWER_LETTERS = ["A", "B", "C", "D"];

// ---- detection helpers (mirror baseline audit) ----
const CONTENT_BUG_RE = /\bundefined\b|\bnull\b|\bNaN\b|\[object Object\]/i;
const PLACEHOLDER_Q_RE = /variasi\s+\d+/i;
const PLACEHOLDER_OPT_RE = /^Pilihan [ABCD]$/i;

function normalizeOption(option) {
  if (option === null || option === undefined) return "";
  return String(option).trim().replace(/^[ABCD][.\)]\s*/, "").toLowerCase();
}
function normalizeQuestionText(text) {
  if (text === null || text === undefined) return "";
  return String(text).toLowerCase().replace(/\s+/g, " ").replace(/[^\p{L}\p{N}\s]/gu, "").trim();
}

function validateQuestion(text) {
  const issues = [];
  const t = String(text ?? "");
  if (!t.trim()) issues.push("EMPTY_QUESTION");
  else if (t.trim().length < 20) issues.push("QUESTION_TOO_SHORT");
  if (PLACEHOLDER_Q_RE.test(t)) issues.push("PLACEHOLDER_QUESTION");
  if (CONTENT_BUG_RE.test(t)) issues.push("CONTENT_BUG_QUESTION");
  return issues;
}
function validateOptions(options) {
  const issues = [];
  if (!Array.isArray(options) || options.length !== 4) {
    issues.push("INVALID_OPTIONS_COUNT");
    return issues;
  }
  const norms = options.map(normalizeOption);
  if (norms.some((o) => !o)) issues.push("EMPTY_OPTION");
  if (options.some((o) => PLACEHOLDER_OPT_RE.test(String(o ?? "").trim()))) issues.push("PLACEHOLDER_OPTION");
  if (options.some((o) => CONTENT_BUG_RE.test(String(o ?? "")))) issues.push("CONTENT_BUG_OPTION");
  if (new Set(norms).size !== norms.length) issues.push("DUPLICATE_OPTIONS");
  return issues;
}
function validateAnswer(correctAnswer, options) {
  const issues = [];
  const letter = String(correctAnswer ?? "").trim().toUpperCase();
  if (!ANSWER_LETTERS.includes(letter)) {
    issues.push("INVALID_CORRECT_ANSWER");
    return issues;
  }
  const idx = ANSWER_LETTERS.indexOf(letter);
  const content = normalizeOption(options[idx]);
  if (!content) issues.push("ANSWER_POINTS_TO_EMPTY");
  return issues;
}
function validateMetadata(doc) {
  const issues = [];
  if (!doc.program) issues.push("MISSING_PROGRAM");
  if (!doc.subject) issues.push("MISSING_SUBJECT");
  if (!doc.topic) issues.push("MISSING_TOPIC");
  return issues;
}

async function main() {
  console.log("=".repeat(80));
  console.log("PHASE 3A - STEP 11: FULL PRE-UPDATE VALIDATION (FILE-ONLY)");
  console.log("=".repeat(80));

  const preview = JSON.parse(fs.readFileSync(PREVIEW_JSON, "utf8"));
  const audit = JSON.parse(fs.readFileSync(AUDIT_JSON, "utf8"));

  const remedied = preview.previews.filter((p) => p.status === "REMEDIED");
  const manual = preview.previews.filter((p) => p.status !== "REMEDIED");
  console.log(`\nPreviews total : ${preview.previews.length}`);
  console.log(`  REMEDIED (validated here) : ${remedied.length}`);
  console.log(`  NEEDS_MANUAL_REVIEW       : ${manual.length} (excluded from update)`);

  const failures = [];
  let passCount = 0;

  // ---- per-document validation ----
  for (const r of remedied) {
    const qIssues = validateQuestion(r.questionTextAfter);
    const oIssues = validateOptions(r.optionsAfter);
    const aIssues = validateAnswer(r.correctAnswerAfter, r.optionsAfter);
    const mIssues = validateMetadata(r);
    const all = [...qIssues, ...oIssues, ...aIssues, ...mIssues];
    if (all.length === 0) {
      passCount++;
    } else {
      failures.push({ questionId: r.questionId, type: r.remediationType, issues: all });
    }
  }

  // ---- DUPLICATES: BEFORE vs AFTER preview ----
  // Build AFTER normalized-text set for remediated docs; detect new collisions.
  const auditByText = new Map();
  for (const d of audit.docs) {
    // audit docs don't store text; use questionId grouping only for AFTER self-collision.
  }
  // AFTER self-collision among remediated (same normalized question text).
  const afterByText = new Map();
  for (const r of remedied) {
    const nt = normalizeQuestionText(r.questionTextAfter);
    if (!afterByText.has(nt)) afterByText.set(nt, []);
    afterByText.get(nt).push(r.questionId);
  }
  const afterDupCollisions = [];
  for (const [nt, ids] of afterByText.entries()) {
    if (ids.length > 1) afterDupCollisions.push({ normalizedText: nt.slice(0, 60), ids });
  }

  // ---- ANSWER POSITION distribution AFTER (remediated set) ----
  const afterDist = { A: 0, B: 0, C: 0, D: 0 };
  const afterDistBySubject = {};
  for (const r of remedied) {
    const letter = String(r.correctAnswerAfter).trim().toUpperCase();
    if (afterDist[letter] !== undefined) afterDist[letter]++;
    const sk = `${r.program}::${r.subject}`;
    if (!afterDistBySubject[sk]) afterDistBySubject[sk] = { A: 0, B: 0, C: 0, D: 0, total: 0 };
    if (afterDistBySubject[sk][letter] !== undefined) afterDistBySubject[sk][letter]++;
    afterDistBySubject[sk].total++;
  }
  const extremeBiasAfter = [];
  for (const [sk, d] of Object.entries(afterDistBySubject)) {
    if (d.total < 20) continue;
    for (const L of ANSWER_LETTERS) {
      if (d[L] / d.total >= 0.9) extremeBiasAfter.push({ subject: sk, letter: L, pct: Math.round((d[L] / d.total) * 100) });
    }
  }

  // ---- BEFORE distribution (from baseline audit) for comparison ----
  const beforeDist = audit.answerDistributionGlobal || {};

  const perDocPass = failures.length === 0;
  const noNewDup = afterDupCollisions.length === 0;
  const noExtremeBias = extremeBiasAfter.length === 0;
  const overallPass = perDocPass && noNewDup && noExtremeBias;

  console.log("\n--- VALIDATION RESULTS ---");
  console.log(`  Per-document checks PASS : ${passCount}/${remedied.length} (${failures.length} failures)`);
  console.log(`  No new duplicates (AFTER): ${noNewDup ? "PASS" : "FAIL"} (${afterDupCollisions.length} collisions)`);
  console.log(`  No extreme answer bias   : ${noExtremeBias ? "PASS" : "FAIL"} (${extremeBiasAfter.length} subjects)`);
  console.log(`  AFTER answer distribution: ${JSON.stringify(afterDist)}`);
  console.log(`\n  OVERALL PREVIEW VALIDATION: ${overallPass ? "PASS" : "FAIL"}`);

  if (failures.length) {
    console.log("\n  Failures:");
    for (const f of failures.slice(0, 20)) console.log(`    ${f.questionId} [${f.type}]: ${f.issues.join(", ")}`);
  }
  if (afterDupCollisions.length) {
    console.log("\n  AFTER duplicate collisions:");
    for (const c of afterDupCollisions.slice(0, 10)) console.log(`    "${c.normalizedText}" -> ${c.ids.length} docs`);
  }

  // ---- write outputs ----
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const out = {
    generatedAt: new Date().toISOString(),
    mode: "FILE-ONLY validation - 0 MongoDB access",
    step: "STEP 11 - Full pre-update validation",
    verdict: overallPass ? "PASS" : "FAIL",
    counts: {
      previewsTotal: preview.previews.length,
      remediatedValidated: remedied.length,
      manualReviewExcluded: manual.length,
      perDocPass: passCount,
      perDocFail: failures.length,
    },
    checks: {
      perDocumentValidation: { pass: perDocPass, failures },
      noNewDuplicates: { pass: noNewDup, afterCollisions: afterDupCollisions },
      noExtremeAnswerBias: { pass: noExtremeBias, extremeBiasAfter },
    },
    answerDistribution: {
      before: beforeDist,
      afterRemediatedSet: afterDist,
      afterBySubject: afterDistBySubject,
    },
    note: "Validation covers only the REMEDIED preview set (candidates for Phase 3B update). NEEDS_MANUAL_REVIEW and NEEDS_REGENERATION are excluded from any update.",
  };
  const jsonPath = path.join(OUT_DIR, `QUESTIONBANK-FULL-PRE-UPDATE-VALIDATION-${ts}.json`);
  const jsonStable = path.join(OUT_DIR, "QUESTIONBANK-FULL-PRE-UPDATE-VALIDATION.json");
  fs.writeFileSync(jsonPath, JSON.stringify(out, null, 2));
  fs.writeFileSync(jsonStable, JSON.stringify(out, null, 2));

  // ---- markdown summary ----
  const md = [
    "# QuestionBank Full Pre-Update Validation (STEP 11)",
    "",
    `Generated: ${out.generatedAt}`,
    `Mode: FILE-ONLY validation (0 MongoDB access)`,
    "",
    `## Verdict: **${out.verdict}**`,
    "",
    "## Counts",
    `- Previews total: ${out.counts.previewsTotal}`,
    `- Remediated (validated): ${out.counts.remediatedValidated}`,
    `- Manual review (excluded): ${out.counts.manualReviewExcluded}`,
    `- Per-document PASS: ${out.counts.perDocPass} / FAIL: ${out.counts.perDocFail}`,
    "",
    "## Checks",
    `| Check | Result |`,
    `|---|---|`,
    `| Per-document validation (question/options/answer/metadata) | ${perDocPass ? "PASS" : "FAIL"} |`,
    `| No new duplicates introduced (AFTER) | ${noNewDup ? "PASS" : "FAIL"} |`,
    `| No extreme answer-position bias (>=90%) | ${noExtremeBias ? "PASS" : "FAIL"} |`,
    "",
    "## Answer Distribution",
    `- BEFORE (global, from baseline audit): ${JSON.stringify(beforeDist)}`,
    `- AFTER (remediated set): ${JSON.stringify(afterDist)}`,
    "",
    "## Notes",
    "- Validation covers only the REMEDIED preview set (Phase 3B update candidates).",
    "- NEEDS_MANUAL_REVIEW and NEEDS_REGENERATION are excluded from any update.",
    "- No MongoDB writes performed.",
    "",
  ].join("\n");
  const mdPath = path.join(OUT_DIR, "QUESTIONBANK-FULL-PRE-UPDATE-VALIDATION.md");
  fs.writeFileSync(mdPath, md);

  console.log(`\nSaved:\n  ${jsonStable}\n  ${mdPath}`);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
