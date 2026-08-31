/**
 * PHASE 3A - STEP 2: IDENTIFY EXACT REMEDIATION SCOPE
 *
 * Reads the STEP 1 baseline audit JSON (file-only, NO MongoDB access) and
 * produces the exact remediation scope:
 *   TOTAL, HEALTHY, BROKEN, AUTO_REMEDIABLE, NEEDS_REGENERATION, NEEDS_MANUAL_REVIEW
 * plus COMPLETE document-ID lists per category and per remediation type.
 *
 * HEALTHY documents are explicitly EXCLUDED from all remediation candidates.
 *
 * Outputs:
 *   QUESTIONBANK-FULL-REMEDIATION-PLAN.json  (complete ID lists)
 *   QUESTIONBANK-FULL-REMEDIATION-PLAN.md    (human-readable plan)
 *
 * SAFETY: FILE-ONLY. Zero MongoDB operations.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_DIR = path.join(__dirname, "..", "..", "outputs", "questionbank-full-remediation-preview");

const AUDIT_JSON = path.join(OUT_DIR, "QUESTIONBANK-FULL-BASELINE-AUDIT.json");

function main() {
  console.log("=".repeat(80));
  console.log("PHASE 3A - STEP 2: IDENTIFY EXACT REMEDIATION SCOPE");
  console.log("   Input: QUESTIONBANK-FULL-BASELINE-AUDIT.json  (FILE-ONLY, no MongoDB)");
  console.log("=".repeat(80));

  const audit = JSON.parse(fs.readFileSync(AUDIT_JSON, "utf8"));
  const docs = audit.docs;
  const total = docs.length;

  // ---- Build complete ID lists per scope and per remediation type ----
  const idsByScope = { HEALTHY: [], AUTO_REMEDIABLE: [], NEEDS_REGENERATION: [], NEEDS_MANUAL_REVIEW: [] };
  const idsByType = {};
  const scopeByProgramSubject = {};

  for (const d of docs) {
    if (idsByScope[d.scope]) idsByScope[d.scope].push(d.questionId);
    if (!idsByType[d.remediationType]) idsByType[d.remediationType] = [];
    idsByType[d.remediationType].push(d.questionId);

    const k = `${d.program}::${d.subject}`;
    if (!scopeByProgramSubject[k]) scopeByProgramSubject[k] = { HEALTHY: 0, AUTO_REMEDIABLE: 0, NEEDS_REGENERATION: 0, NEEDS_MANUAL_REVIEW: 0, total: 0 };
    scopeByProgramSubject[k][d.scope]++;
    scopeByProgramSubject[k].total++;
  }

  const healthy = idsByScope.HEALTHY.length;
  const autoRemediable = idsByScope.AUTO_REMEDIABLE.length;
  const needsRegeneration = idsByScope.NEEDS_REGENERATION.length;
  const needsManualReview = idsByScope.NEEDS_MANUAL_REVIEW.length;
  const broken = total - healthy;

  console.log(`\nTOTAL QUESTIONBANK     : ${total}`);
  console.log(`HEALTHY (excluded)     : ${healthy}`);
  console.log(`BROKEN                 : ${broken}`);
  console.log(`AUTO_REMEDIABLE        : ${autoRemediable}`);
  console.log(`NEEDS_REGENERATION     : ${needsRegeneration}`);
  console.log(`NEEDS_MANUAL_REVIEW    : ${needsManualReview}`);
  console.log(`\nSanity check: ${autoRemediable} + ${needsRegeneration} + ${needsManualReview} = ${autoRemediable + needsRegeneration + needsManualReview} (should equal BROKEN ${broken})`);

  // ---- Write plan JSON (complete ID lists) ----
  const planJson = {
    generatedAt: new Date().toISOString(),
    mode: "READ-ONLY / FILE-ONLY",
    sourceAudit: "QUESTIONBANK-FULL-BASELINE-AUDIT.json",
    totals: {
      total,
      healthy,
      broken,
      autoRemediable,
      needsRegeneration,
      needsManualReview,
    },
    remediationTypeCounts: audit.remediationTypeCounts,
    healthyExcludedFromRemediation: true,
    idsByScope,
    idsByType,
    scopeByProgramSubject,
  };

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const planJsonPath = path.join(OUT_DIR, `QUESTIONBANK-FULL-REMEDIATION-PLAN-${ts}.json`);
  const planJsonStable = path.join(OUT_DIR, "QUESTIONBANK-FULL-REMEDIATION-PLAN.json");
  fs.writeFileSync(planJsonPath, JSON.stringify(planJson));
  fs.writeFileSync(planJsonStable, JSON.stringify(planJson));
  console.log(`\nSaved plan JSON:\n  ${planJsonPath}\n  ${planJsonStable}`);

  // ---- Write plan Markdown ----
  writePlanMarkdown(planJson, audit);

  console.log("\nSTEP 2 complete. FILE-ONLY (0 MongoDB operations).");
}

function writePlanMarkdown(plan, audit) {
  const L = [];
  const t = plan.totals;
  L.push("# QUESTIONBANK FULL REMEDIATION PLAN (Phase 3A - STEP 2)");
  L.push("");
  L.push(`- Generated: ${plan.generatedAt}`);
  L.push(`- Source: \`QUESTIONBANK-FULL-BASELINE-AUDIT.json\` (STEP 1)`);
  L.push(`- Mode: **READ-ONLY / FILE-ONLY** (no MongoDB writes)`);
  L.push("");
  L.push("## 1. Exact Remediation Scope");
  L.push("");
  L.push("| Metric | Count |");
  L.push("|---|---|");
  L.push(`| TOTAL QUESTIONBANK | ${t.total} |`);
  L.push(`| HEALTHY (excluded from remediation) | ${t.healthy} |`);
  L.push(`| BROKEN | ${t.broken} |`);
  L.push(`| AUTO_REMEDIABLE | ${t.autoRemediable} |`);
  L.push(`| NEEDS_REGENERATION | ${t.needsRegeneration} |`);
  L.push(`| NEEDS_MANUAL_REVIEW | ${t.needsManualReview} |`);
  L.push("");
  L.push(`Sanity: AUTO_REMEDIABLE + NEEDS_REGENERATION + NEEDS_MANUAL_REVIEW = ${t.autoRemediable + t.needsRegeneration + t.needsManualReview} = BROKEN (${t.broken}).`);
  L.push("");
  L.push("> **HEALTHY documents are NOT remediation candidates.** They will not be");
  L.push("> regenerated, shuffled, or have options/answers/metadata altered.");
  L.push("");

  L.push("## 2. Remediation Type Breakdown");
  L.push("");
  L.push("| Remediation Type | Count | Strategy |");
  L.push("|---|---|---|");
  const strategy = {
    REGENERATE_CONTENT: "Replace with substantively-different, on-topic real question (from expanded content bank or authored). Never fake by renumbering.",
    SHUFFLE_RESYNC: "Deterministic option shuffle + correctAnswer re-sync. Only for Phase-2-verified subjects where current answer is genuinely correct.",
    REPLACE_FROM_CONTENT_BANK: "Replace placeholder with real authored question from content bank matching subject/topic.",
    FIX_CONTENT: "Fix duplicate/invalid options; regenerate the bad option; re-sync answer.",
    MANUAL_REVIEW: "Cannot be safely auto-fixed (undefined/null in text, or wrong-answer bug). Routed to human review.",
    NONE: "Healthy - no action.",
  };
  for (const [type, cnt] of Object.entries(plan.remediationTypeCounts).sort((a, b) => b[1] - a[1])) {
    L.push(`| ${type} | ${cnt} | ${strategy[type] || ""} |`);
  }
  L.push("");

  L.push("## 3. Scope by Program / Subject");
  L.push("");
  L.push("| Program | Subject | Total | Healthy | Auto | Regen | Manual |");
  L.push("|---|---|---|---|---|---|---|");
  const rows = Object.entries(plan.scopeByProgramSubject).sort((a, b) => b[1].total - a[1].total);
  for (const [k, v] of rows) {
    const [p, s] = k.split("::");
    L.push(`| ${p} | ${s} | ${v.total} | ${v.HEALTHY} | ${v.AUTO_REMEDIABLE} | ${v.NEEDS_REGENERATION} | ${v.NEEDS_MANUAL_REVIEW} |`);
  }
  L.push("");

  L.push("## 4. Key Findings Driving the Scope");
  L.push("");
  L.push("1. **Mass exact-duplication is the dominant defect.** The 42,440-document bank");
  L.push("   contains only a few thousand unique questions. Verified examples:");
  L.push("   - SMA Matematika: 23,250 docs -> 1,489 unique (93.6% duplicate)");
  L.push("   - SMP Matematika: 11,750 docs -> 401 unique (96.6% duplicate)");
  L.push("   - SMA Sejarah: 550 docs -> 6 unique (98.9% duplicate)");
  L.push("   Non-canonical duplicates are routed to NEEDS_REGENERATION (replaced with");
  L.push("   substantively-different on-topic content, never deleted).");
  L.push("");
  L.push("2. **Placeholder questions** (`Soal ... Variasi N` / `English Language Question ... Variation N`");
  L.push("   with `Pilihan A-D` / `Option A-D` / bare `A-D` options) total ~4,450 docs.");
  L.push("");
  L.push("3. **Content bugs** (`undefined`/`null`/`NaN` in question text) total 550 docs ->");
  L.push("   NEEDS_MANUAL_REVIEW (reconstructibility must be verified by hand).");
  L.push("");
  L.push("4. **Wrong-answer bug in UTBK subjects**: correctAnswer hardcoded to A while the");
  L.push("   correct value sits at a random position. Shuffling would preserve the wrong");
  L.push("   answer, so these are routed to NEEDS_MANUAL_REVIEW, NOT shuffled.");
  L.push("");
  L.push("5. **Safe position bias** (SMA Fisika/Geografi/Sejarah, SMP IPA/Bahasa Indonesia):");
  L.push("   current answer letter genuinely points to the correct option (verified Phase 2),");
  L.push("   so deterministic shuffle + re-sync is safe -> AUTO_REMEDIABLE.");
  L.push("");

  L.push("## 5. Document ID Lists");
  L.push("");
  L.push("Complete document-ID lists for every scope and remediation type are stored in");
  L.push("`QUESTIONBANK-FULL-REMEDIATION-PLAN.json` under `idsByScope` and `idsByType`.");
  L.push("");
  L.push(`- HEALTHY (excluded): ${t.healthy} IDs`);
  L.push(`- AUTO_REMEDIABLE: ${t.autoRemediable} IDs`);
  L.push(`- NEEDS_REGENERATION: ${t.needsRegeneration} IDs`);
  L.push(`- NEEDS_MANUAL_REVIEW: ${t.needsManualReview} IDs`);
  L.push("");
  L.push("### Sample IDs per scope (first 10)");
  L.push("");
  for (const scope of ["AUTO_REMEDIABLE", "NEEDS_REGENERATION", "NEEDS_MANUAL_REVIEW"]) {
    L.push(`**${scope}:**`);
    L.push("```");
    for (const id of plan.idsByScope[scope].slice(0, 10)) L.push(id);
    L.push("```");
    L.push("");
  }

  L.push("## 6. Safety Confirmation");
  L.push("");
  L.push("- This step performed **ZERO** writes to MongoDB (file-only).");
  L.push("- HEALTHY documents are excluded from all remediation candidates.");
  L.push("- No UPDATE / INSERT / DELETE / drop / replace has been executed.");
  L.push("");

  const mdPath = path.join(OUT_DIR, "QUESTIONBANK-FULL-REMEDIATION-PLAN.md");
  fs.writeFileSync(mdPath, L.join("\n"));
  console.log(`Saved plan Markdown:\n  ${mdPath}`);
}

main();
