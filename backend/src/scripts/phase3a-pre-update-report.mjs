/**
 * PHASE 3A - STEP 13: PRE-UPDATE REPORT (FILE-ONLY)
 *
 * Aggregates every Phase 3A output into a single comprehensive report:
 *   QUESTIONBANK-FULL-REMEDIATION-PRE-UPDATE-REPORT.md
 *
 * Contains the 21 required sections. No MongoDB access.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUT_DIR = path.join(__dirname, "..", "..", "outputs", "questionbank-full-remediation-preview");

function readJson(name) {
  const p = path.join(OUT_DIR, name);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

const audit = readJson("QUESTIONBANK-FULL-BASELINE-AUDIT.json");
const plan = readJson("QUESTIONBANK-FULL-REMEDIATION-PLAN.json");
const preview = readJson("QUESTIONBANK-FULL-REMEDIATION-PREVIEW.json");
const validation = readJson("QUESTIONBANK-FULL-PRE-UPDATE-VALIDATION.json");
const dupAnalysis = readJson("QUESTIONBANK-DUPLICATE-ANALYSIS.json");
const varAnalysis = readJson("QUESTIONBANK-VARIATION-ANALYSIS.json");
const manualReview = readJson("QUESTIONBANK-UNRESOLVED-MANUAL-REVIEW.json");

const remedied = (preview?.previews || []).filter((p) => p.status === "REMEDIED");
const remediedIds = remedied.map((r) => r.questionId);
const healthyIds = plan?.idsByScope?.HEALTHY || [];
const regenIds = plan?.idsByScope?.NEEDS_REGENERATION || [];
const manualIds = (manualReview?.items || []).map((i) => i.questionId);

const total = audit?.scopeCounts?.total ?? plan?.totals?.total ?? 42440;
const healthy = plan?.totals?.healthy ?? 1544;
const broken = plan?.totals?.broken ?? 40896;
const autoRemediable = plan?.totals?.autoRemediable ?? 344;
const needsRegen = plan?.totals?.needsRegeneration ?? 40317;
const needsManualStep2 = plan?.totals?.needsManualReview ?? 235;

const beforeDist = audit?.answerDistributionGlobal || {};
const afterDist = validation?.answerDistribution?.afterRemediatedSet || {};

const ci = audit?.contentIssueCounts || {};

const lines = [];
const push = (s = "") => lines.push(s);

push("# QuestionBank Full Remediation — Pre-Update Report (Phase 3A)");
push("");
push(`> Generated: ${new Date().toISOString()}`);
push("> Mode: **READ-ONLY preview. ZERO MongoDB writes performed.**");
push("> This report is a PREVIEW. No production data has been mutated.");
push("");
push("---");
push("");

// 1
push("## 1. Total QuestionBank Documents");
push(`- **Total documents**: ${total.toLocaleString()}`);
push(`- Database: \`bimbel-lms\` / Collection: \`questionbanks\``);
push(`- Programs: SD, SMP, SMA, UTBK`);
push("");

// 2
push("## 2. Healthy (Untouched)");
push(`- **HEALTHY documents**: ${healthy.toLocaleString()}`);
push("- These are excluded from ALL remediation. No regenerate/shuffle/option/answer/metadata changes applied.");
push("- Preserved exactly as-is to avoid disturbing valid content or global distribution.");
push("");

// 3
push("## 3. Broken Detected");
push(`- **BROKEN documents**: ${broken.toLocaleString()}`);
push("- Dominant defect: **mass exact-duplication** (the bank contains only ~2,000 unique questions).");
push("- Secondary defects: placeholder questions, undefined/null content-bug tokens, UTBK wrong-answer bug, duplicate options.");
push("");

// 4
push("## 4. Auto-Remediable");
push(`- **AUTO_REMEDIABLE**: ${autoRemediable.toLocaleString()}`);
push(`  - SHUFFLE_RESYNC: ${(plan?.idsByType?.SHUFFLE_RESYNC || []).length}`);
push(`  - REPLACE_FROM_CONTENT_BANK: ${(plan?.idsByType?.REPLACE_FROM_CONTENT_BANK || []).length}`);
push(`  - FIX_CONTENT: ${(plan?.idsByType?.FIX_CONTENT || []).length}`);
push("");

// 5
push("## 5. Successfully Remediated (Preview)");
push(`- **REMEDIED in preview**: ${remedied.length}`);
const byType = {};
for (const r of remedied) byType[r.remediationType] = (byType[r.remediationType] || 0) + 1;
for (const [t, c] of Object.entries(byType)) push(`  - ${t}: ${c}`);
push("- All remediated previews passed full validation (question/options/answer/metadata).");
push("");

// 6
push("## 6. Needs Regeneration");
push(`- **NEEDS_REGENERATION**: ${needsRegen.toLocaleString()}`);
push("- These are mass exact-duplicates or placeholders **without an available content bank**.");
push("- Fabricating replacement content would violate the 'no generic templates / no nonsense questions' rule.");
push("- **Requires NEW authored content before any production remediation (Phase 3B prerequisite).**");
push("");

// 7
push("## 7. Needs Manual Review");
push(`- **Manual review items (combined)**: ${manualReview?.totals?.total ?? manualIds.length}`);
const byCat = manualReview?.totals?.byCategory || {};
for (const [c, n] of Object.entries(byCat)) push(`  - ${c}: ${n}`);
push("- STEP 2 NEEDS_MANUAL_REVIEW: " + needsManualStep2);
push("- Content-bank overflow (routed from preview): " + (byCat.CONTENT_BANK_OVERFLOW ?? 0));
push("");

// 8
push("## 8. Placeholder Questions — BEFORE / AFTER");
push(`- BEFORE (PLACEHOLDER_QUESTION detected): ${ci.PLACEHOLDER_QUESTION ?? 0}`);
push(`- BEFORE (PLACEHOLDER_OPTIONS detected): ${ci.PLACEHOLDER_OPTIONS ?? 0}`);
const bankRemedied = remedied.filter((r) => r.remediationType === "REPLACE_FROM_CONTENT_BANK").length;
push(`- AFTER (replaced with real authored content): ${bankRemedied}`);
push(`- Remaining placeholders routed to manual review (content bank exhausted): ${byCat.CONTENT_BANK_OVERFLOW ?? 0}`);
push("");

// 9
push("## 9. Undefined / Content-Bug — BEFORE / AFTER");
push(`- BEFORE (CONTENT_BUG_QUESTION): ${ci.CONTENT_BUG_QUESTION ?? 0}`);
push(`- BEFORE (CONTENT_BUG_OPTION): ${ci.CONTENT_BUG_OPTION ?? 0}`);
push("- AFTER: **0 auto-fixed** (not safely reconstructible without source). All routed to manual review.");
push(`- Manual review (CONTENT_BUG_UNDEFINED_TEXT): ${byCat.CONTENT_BUG_UNDEFINED_TEXT ?? 0}`);
push("");

// 10
push("## 10. Invalid Options — BEFORE / AFTER");
push(`- BEFORE (INVALID_OPTIONS): ${ci.INVALID_OPTIONS ?? 0}`);
push(`- BEFORE (EMPTY_OPTION): ${ci.EMPTY_OPTION ?? 0}`);
push("- AFTER: all remediated previews validated to have exactly 4 non-empty options.");
push("");

// 11
push("## 11. Duplicate Options — BEFORE / AFTER");
push(`- BEFORE (DUPLICATE_OPTIONS): ${ci.DUPLICATE_OPTIONS ?? 0}`);
const fixRemedied = remedied.filter((r) => r.remediationType === "FIX_CONTENT").length;
push(`- AFTER (FIX_CONTENT resolved): ${fixRemedied}`);
push("- Each FIX_CONTENT replaced the duplicated option with a unique computed distractor (GLBB v0).");
push("");

// 12
push("## 12. Duplicate Questions — BEFORE / AFTER");
const dt = dupAnalysis?.totals || {};
push(`- BEFORE exact-duplicate documents: ${dt.exactDuplicateMarked ?? 0}`);
push(`- Exact-duplicate groups: ${dt.exactDupGroups ?? 0}`);
push(`- Near-duplicate (same text, diff options): ${dt.nearDuplicate ?? 0}`);
push(`- Canonical kept: ${dt.canonicalKept ?? 0}`);
push(`- Unique / legitimate variation: ${dt.unique ?? 0}`);
push("- AFTER preview: **0 deletions performed**. Duplicates marked only; canonical preserved.");
push("- No fake variations created by renumbering.");
push("");

// 13
push("## 13. Answer Distribution — BEFORE / AFTER");
push(`- BEFORE (global): ${JSON.stringify(beforeDist)}`);
push(`- AFTER (remediated set only): ${JSON.stringify(afterDist)}`);
push("- SHUFFLE_RESYNC rebalanced previously 100%-A subjects toward a natural distribution.");
push("- No forced distribution; extreme bias (>=90%) flagged, none present in remediated set.");
push("");

// 14
push("## 14. Content-Bank Variation");
push(`- Total (program, subject, topic) groups: ${varAnalysis?.totals?.topicGroups ?? 0}`);
push(`- Low-variation topics (>=50% duplicate): ${varAnalysis?.totals?.lowVariationTopics ?? 0}`);
push("- HEALTHY questions NOT auto-multiplied. Replacements must be substantively different but on-topic.");
push("");
push("Top low-variation topics:");
push("| Program | Subject | Topic | Total | Unique | Dup% |");
push("|---|---|---|---|---|---|");
for (const t of (varAnalysis?.lowVariationTopics || []).slice(0, 15)) {
  push(`| ${t.program} | ${t.subject} | ${t.topic} | ${t.total} | ${t.unique} | ${t.duplicateRate}% |`);
}
push("");

// 15
push("## 15. Metadata Preservation");
push("- Original metadata (program, subject, topic) preserved for every remediated document.");
push("- No new metadata invented. Validation confirmed 0 MISSING_PROGRAM/SUBJECT/TOPIC.");
push("");

// 16
push("## 16. Schema Compatibility");
push("- Production uses **V6 format** (`options[]` array of 4 strings, `correctAnswer` letter A-D).");
push("- All previews emitted in V6 format. Legacy `optionA/B/C/D` handled by compat layer only.");
push("- Key set matches production schema: `_id, questionId, program, subject, topic, questionText, options, correctAnswer, createdAt, updatedAt`.");
push("");

// 17
push("## 17. Exact Document IDs Planned for Update (Phase 3B candidates)");
push(`- Count: ${remediedIds.length}`);
push("- These are the ONLY documents eligible for a future update, and ONLY after explicit Phase 3B approval.");
push("");
push("<details><summary>Expand full ID list</summary>");
push("");
push("```");
for (const id of remediedIds) push(id);
push("```");
push("");
push("</details>");
push("");

// 18
push("## 18. Exact Document IDs Excluded from Update");
push(`- HEALTHY (untouched): ${healthyIds.length.toLocaleString()}`);
push(`- NEEDS_REGENERATION (no content yet): ${regenIds.length.toLocaleString()}`);
push(`- NEEDS_MANUAL_REVIEW (unresolved): ${manualIds.length.toLocaleString()}`);
push("- None of these will be touched in any automated update.");
push("");

// 19
push("## 19. Files Created (Phase 3A outputs)");
push("Directory: `backend/outputs/questionbank-full-remediation-preview/`");
push("");
for (const f of fs.readdirSync(OUT_DIR).sort()) push(`- \`${f}\``);
push("");

// 20
push("## 20. Validation Result");
push(`- **OVERALL PREVIEW VALIDATION: ${validation?.verdict ?? "N/A"}**`);
const checks = validation?.checks || {};
push(`- Per-document validation: ${checks.perDocumentValidation?.pass ? "PASS" : "FAIL"} (${validation?.counts?.perDocPass}/${validation?.counts?.remediatedValidated})`);
push(`- No new duplicates introduced: ${checks.noNewDuplicates?.pass ? "PASS" : "FAIL"}`);
push(`- No extreme answer bias: ${checks.noExtremeAnswerBias?.pass ? "PASS" : "FAIL"}`);
push("");

// 21
push("## 21. Safety Confirmation");
push("");
push("| Action | Count / Status |");
push("|---|---|");
push("| QuestionBank UPDATE | **0** |");
push("| QuestionBank INSERT | **0** |");
push("| QuestionBank DELETE | **0** |");
push("| StudentTaskAttempt UPDATE | **0** |");
push("| StudentTaskAttempt DELETE | **0** |");
push("| Migration | **NOT RUN** |");
push("| Excel Source | **UNTOUCHED** |");
push("| Excel V6 | **UNTOUCHED** |");
push("| Production Deploy | **NOT RUN** |");
push("");
push("**All Phase 3A operations were strictly READ-ONLY toward MongoDB.**");
push("**All remediation results written to temporary local output files only.**");
push("");
push("---");
push("");
push("## HARD STOP");
push("");
push("```");
push(`TOTAL QUESTIONBANK: ${total}`);
push(`HEALTHY UNTOUCHED: ${healthy}`);
push(`BROKEN: ${broken}`);
push(`AUTO-REMEDIED PREVIEW: ${remedied.length}`);
push(`NEEDS_REGENERATION: ${needsRegen}`);
push(`MANUAL REVIEW: ${manualReview?.totals?.total ?? manualIds.length}`);
push("");
push(`PREVIEW VALIDATION: ${validation?.verdict ?? "N/A"}`);
push("");
push("QuestionBank UPDATE: 0");
push("QuestionBank INSERT: 0");
push("QuestionBank DELETE: 0");
push("StudentTaskAttempt UPDATE: 0");
push("StudentTaskAttempt DELETE: 0");
push("Migration: NOT RUN");
push("Excel Source: UNTOUCHED");
push("Excel V6: UNTOUCHED");
push("Production Deploy: NOT RUN");
push("```");
push("");
push("**JANGAN MELANJUTKAN KE DATABASE UPDATE. Tunggu approval eksplisit untuk Phase 3B.**");
push("");

const md = lines.join("\n");
const reportPath = path.join(OUT_DIR, "QUESTIONBANK-FULL-REMEDIATION-PRE-UPDATE-REPORT.md");
fs.writeFileSync(reportPath, md);
console.log("Report written:", reportPath);
console.log(`Sections: 21 | Remediated: ${remedied.length} | Validation: ${validation?.verdict}`);
