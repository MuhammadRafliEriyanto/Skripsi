/**
 * REMEDIATION ENGINE - CONTROLLED SAMPLE (READ-ONLY PROOF OF CONCEPT)
 *
 * Reads the clean BEFORE sample (broken questions only) and produces an AFTER
 * sample demonstrating that each broken question can be correctly remediated.
 *
 * Remediation rules (per user spec):
 *   (a) valid question + broken options  -> keep questionText, generate 1 correct
 *       + 3 relevant distractors, 4 unique options, shuffled position, synced answer
 *   (b) placeholder questionText         -> generate NEW real question from metadata
 *       (subject + topic) using the authored content bank. NO generic templates.
 *   (c) format-only correctAnswer        -> normalize only if provable, never guess
 *   (d) unsafe / cannot prove            -> mark NEEDS_MANUAL_REVIEW
 *
 * Categories handled:
 *   PLACEHOLDER_QUESTION -> rule (b): full regeneration from content bank
 *   POSITION_BIAS_A      -> keep questionText + real options, shuffle options and
 *                           re-sync correctAnswer (provably safe: the content marked
 *                           correct stays correct, only its position changes)
 *   CONTENT_BUG          -> rule (d): NEEDS_MANUAL_REVIEW (undefined text / dup options)
 *
 * SAFETY: This script only READS the BEFORE JSON file and WRITES a new AFTER JSON.
 * It performs ZERO MongoDB operations. No UPDATE/INSERT/DELETE anywhere.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pickRealQuestion, getContentBank } from "./remediation-content-bank.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ANSWER_LETTERS = ["A", "B", "C", "D"];

// =====================================================
// DETERMINISTIC PRNG (reproducible shuffle for auditing)
// =====================================================

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle(arr, seedStr) {
  const rand = mulberry32(hashString(seedStr));
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// =====================================================
// HELPERS
// =====================================================

function normalizeOption(option) {
  if (!option) return "";
  return String(option).trim().replace(/^[ABCD][.\)]\s*/, "");
}

function hasDuplicateOptions(options) {
  if (!options || options.length !== 4) return false;
  const norm = options.map((o) => normalizeOption(o).toLowerCase());
  return new Set(norm).size !== norm.length;
}

function hasUndefined(text) {
  return /\bundefined\b/i.test(String(text ?? ""));
}

function hasAnyUndefined(doc) {
  return (
    hasUndefined(doc.questionText) ||
    (doc.options || []).some((o) => hasUndefined(o))
  );
}

// =====================================================
// REMEDIATION: PLACEHOLDER_QUESTION (rule b)
// =====================================================

function remediatePlaceholder(doc, index) {
  const real = pickRealQuestion(doc.subject, doc.topic, index);

  if (!real) {
    // No authored content available -> cannot safely remediate
    return {
      ...doc,
      originalIssue: doc.issue,
      remediationStatus: "NEEDS_MANUAL_REVIEW",
      remediationNote:
        "No authored content bank for this subject/topic. Requires manual authoring.",
      remediatedAt: new Date().toISOString(),
    };
  }

  // Build 4 options: 1 correct + 3 distractors, shuffled deterministically
  const allOptions = [real.correctAnswer, ...real.distractors];
  const shuffled = seededShuffle(allOptions, `${doc.questionId}::${index}`);
  const correctIndex = shuffled.indexOf(real.correctAnswer);
  const correctAnswer = ANSWER_LETTERS[correctIndex];

  return {
    questionId: doc.questionId,
    program: doc.program,
    subject: doc.subject,
    topic: doc.topic,
    questionText: real.question,
    options: shuffled,
    correctAnswer,
    originalIssue: doc.issue,
    remediationStatus: "REMEDIED",
    remediationNote: `Regenerated with real ${doc.subject} content for "${doc.topic}"`,
    remediatedAt: new Date().toISOString(),
  };
}

// =====================================================
// REMEDIATION: POSITION_BIAS_A (rule a/c - provably safe shuffle)
// =====================================================

function remediatePositionBias(doc, index) {
  // Guard: if options contain undefined or duplicates, route to manual review
  if (hasAnyUndefined(doc)) {
    return {
      ...doc,
      originalIssue: doc.issue,
      remediationStatus: "NEEDS_MANUAL_REVIEW",
      remediationNote: "Options/question contain 'undefined' - needs manual content fix.",
      remediatedAt: new Date().toISOString(),
    };
  }
  if (hasDuplicateOptions(doc.options)) {
    return {
      ...doc,
      originalIssue: doc.issue,
      remediationStatus: "NEEDS_MANUAL_REVIEW",
      remediationNote: "Duplicate options present - shuffle cannot fix; needs manual review.",
      remediatedAt: new Date().toISOString(),
    };
  }
  if (!doc.options || doc.options.length !== 4) {
    return {
      ...doc,
      originalIssue: doc.issue,
      remediationStatus: "NEEDS_MANUAL_REVIEW",
      remediationNote: "Option count is not 4 - needs manual review.",
      remediatedAt: new Date().toISOString(),
    };
  }

  // The content currently marked correct is options[correctAnswerIndex].
  const currentIdx = ANSWER_LETTERS.indexOf(String(doc.correctAnswer).toUpperCase());
  const correctContent = doc.options[currentIdx];

  // Shuffle options deterministically; keep the SAME content correct, new position.
  const shuffled = seededShuffle(doc.options, `${doc.questionId}::bias::${index}`);
  const newIdx = shuffled.indexOf(correctContent);
  const correctAnswer = ANSWER_LETTERS[newIdx];

  return {
    questionId: doc.questionId,
    program: doc.program,
    subject: doc.subject,
    topic: doc.topic,
    questionText: doc.questionText,
    options: shuffled,
    correctAnswer,
    originalIssue: doc.issue,
    remediationStatus: "REMEDIED",
    remediationNote:
      "Position-bias fix: options shuffled, correct content preserved and re-synced.",
    remediatedAt: new Date().toISOString(),
  };
}

// =====================================================
// REMEDIATION: CONTENT_BUG (rule d - manual review)
// =====================================================

function remediateContentBug(doc) {
  const problems = [];
  if (hasUndefined(doc.questionText)) problems.push("undefined in questionText");
  if ((doc.options || []).some((o) => hasUndefined(o))) problems.push("undefined in options");
  if (hasDuplicateOptions(doc.options)) problems.push("duplicate options");

  return {
    ...doc,
    originalIssue: doc.issue,
    remediationStatus: "NEEDS_MANUAL_REVIEW",
    remediationNote: `Content bug detected: ${problems.join(", ")}. Cannot auto-fix safely.`,
    remediatedAt: new Date().toISOString(),
  };
}

// =====================================================
// MAIN
// =====================================================

async function main() {
  console.log("=".repeat(80));
  console.log("REMEDIATION ENGINE - CONTROLLED SAMPLE");
  console.log("   Input : clean BEFORE sample (broken questions only)");
  console.log("   Output: AFTER sample (remediated / manual-review)");
  console.log("   Mode  : FILE-ONLY (zero MongoDB operations)");
  console.log("=".repeat(80));

  // Locate the latest clean BEFORE sample
  const inDir = path.join(__dirname, "..", "..", "outputs", "questionbank-remediation-sample");
  const beforeFiles = fs
    .readdirSync(inDir)
    .filter((f) => f.startsWith("QUESTIONBANK-REMEDIATION-BEFORE-") && f.endsWith(".json"))
    .sort();

  if (beforeFiles.length === 0) {
    console.error("No clean BEFORE sample found. Run build-clean-before-sample.mjs first.");
    process.exit(1);
  }
  const beforePath = path.join(inDir, beforeFiles[beforeFiles.length - 1]);
  console.log(`\nReading BEFORE sample:\n  ${beforePath}\n`);

  const before = JSON.parse(fs.readFileSync(beforePath, "utf8"));

  const after = {
    PLACEHOLDER_QUESTION: [],
    POSITION_BIAS_A: [],
    CONTENT_BUG: [],
  };

  // Track per-topic index so placeholder docs cycle through authored content
  const topicCounter = {};

  // ---- PLACEHOLDER_QUESTION ----
  for (const doc of before.PLACEHOLDER_QUESTION || []) {
    const key = `${doc.subject}::${doc.topic}`;
    topicCounter[key] = (topicCounter[key] ?? -1) + 1;
    after.PLACEHOLDER_QUESTION.push(remediatePlaceholder(doc, topicCounter[key]));
  }

  // ---- POSITION_BIAS_A ----
  (before.POSITION_BIAS_A || []).forEach((doc, i) => {
    after.POSITION_BIAS_A.push(remediatePositionBias(doc, i));
  });

  // ---- CONTENT_BUG ----
  for (const doc of before.CONTENT_BUG || []) {
    after.CONTENT_BUG.push(remediateContentBug(doc));
  }

  // ---- Summary ----
  const count = (arr, status) => arr.filter((q) => q.remediationStatus === status).length;
  const all = [...after.PLACEHOLDER_QUESTION, ...after.POSITION_BIAS_A, ...after.CONTENT_BUG];

  console.log("AFTER SAMPLE SUMMARY");
  console.log(`  PLACEHOLDER_QUESTION : ${after.PLACEHOLDER_QUESTION.length} ` +
    `(REMEDIED ${count(after.PLACEHOLDER_QUESTION, "REMEDIED")}, MANUAL ${count(after.PLACEHOLDER_QUESTION, "NEEDS_MANUAL_REVIEW")})`);
  console.log(`  POSITION_BIAS_A      : ${after.POSITION_BIAS_A.length} ` +
    `(REMEDIED ${count(after.POSITION_BIAS_A, "REMEDIED")}, MANUAL ${count(after.POSITION_BIAS_A, "NEEDS_MANUAL_REVIEW")})`);
  console.log(`  CONTENT_BUG          : ${after.CONTENT_BUG.length} ` +
    `(REMEDIED ${count(after.CONTENT_BUG, "REMEDIED")}, MANUAL ${count(after.CONTENT_BUG, "NEEDS_MANUAL_REVIEW")})`);
  console.log(`  TOTAL                : ${all.length} ` +
    `(REMEDIED ${count(all, "REMEDIED")}, MANUAL ${count(all, "NEEDS_MANUAL_REVIEW")})`);
  console.log("=".repeat(80));

  // ---- Write output ----
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(inDir, `QUESTIONBANK-REMEDIATION-AFTER-${ts}.json`);
  fs.writeFileSync(outPath, JSON.stringify(after, null, 2));
  console.log(`\nSaved AFTER sample to:\n  ${outPath}`);
  console.log("\nFILE-ONLY remediation complete (0 MongoDB writes).");
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
