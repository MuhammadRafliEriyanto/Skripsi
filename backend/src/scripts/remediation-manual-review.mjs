/**
 * MANUAL REVIEW SAMPLES GENERATOR - MANDATORY HUMAN REVIEW
 *
 * Produces a readable Markdown document showing, for each affected subject,
 * at least 10 remediated questions in BEFORE -> AFTER format so a human can
 * visually verify the transformation from "Pilihan A/B/C/D" placeholders to
 * real, subject/topic-appropriate options.
 *
 * Format per question:
 *   Program/Class, Subject, Topic, Question, A-D options, Correct Answer,
 *   Previous Issues, Review Notes.
 *
 * SAFETY: FILE-ONLY. Reads BEFORE + AFTER JSON, writes one Markdown file.
 * Zero MongoDB operations.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LETTERS = ["A", "B", "C", "D"];
const PER_SUBJECT = 10;

function fmtOptions(options) {
  return options
    .map((o, i) => `   ${LETTERS[i]}. ${o}`)
    .join("\n");
}

function renderQuestion(before, after, idx) {
  const lines = [];
  lines.push(`#### ${idx}. ${after.subject} — ${after.topic}`);
  lines.push("");
  lines.push(`- **Program/Kelas**: ${after.program}`);
  lines.push(`- **Mata Pelajaran**: ${after.subject}`);
  lines.push(`- **Topik**: ${after.topic}`);
  lines.push(`- **Status**: ${after.remediationStatus}`);
  lines.push(`- **Previous Issue**: ${after.originalIssue}`);
  lines.push("");
  lines.push("**BEFORE (rusak):**");
  lines.push("");
  lines.push(`> ${before.questionText}`);
  lines.push("");
  lines.push(fmtOptions(before.options));
  lines.push(`   Kunci: ${before.correctAnswer}`);
  lines.push("");
  lines.push("**AFTER (revisi):**");
  lines.push("");
  lines.push(`> ${after.questionText}`);
  lines.push("");
  lines.push(fmtOptions(after.options));
  lines.push(`   Kunci: ${after.correctAnswer}`);
  lines.push("");
  lines.push(`**Review Notes**: ${after.remediationNote}`);
  lines.push("");
  lines.push("---");
  lines.push("");
  return lines.join("\n");
}

async function main() {
  console.log("=".repeat(80));
  console.log("MANUAL REVIEW SAMPLES GENERATOR");
  console.log("   Mode: FILE-ONLY (zero MongoDB operations)");
  console.log("=".repeat(80));

  const dir = path.join(__dirname, "..", "..", "outputs", "questionbank-remediation-sample");
  const beforeFiles = fs.readdirSync(dir).filter((f) => f.startsWith("QUESTIONBANK-REMEDIATION-BEFORE-")).sort();
  const afterFiles = fs.readdirSync(dir).filter((f) => f.startsWith("QUESTIONBANK-REMEDIATION-AFTER-")).sort();
  const before = JSON.parse(fs.readFileSync(path.join(dir, beforeFiles[beforeFiles.length - 1]), "utf8"));
  const after = JSON.parse(fs.readFileSync(path.join(dir, afterFiles[afterFiles.length - 1]), "utf8"));

  // Index BEFORE by questionId for pairing
  const beforeById = new Map();
  for (const arr of Object.values(before)) {
    for (const d of arr) beforeById.set(d.questionId, d);
  }

  const md = [];
  md.push("# QUESTIONBANK REMEDIATION — MANUAL REVIEW SAMPLES");
  md.push("");
  md.push(`> Generated: ${new Date().toISOString()}`);
  md.push("> **Tujuan**: Verifikasi manual bahwa soal rusak (`Pilihan A/B/C/D`) benar-benar");
  md.push("> berubah menjadi soal + opsi nyata yang sesuai mata pelajaran & topik.");
  md.push("> Mode: READ-ONLY proof of concept. Tidak ada perubahan ke MongoDB.");
  md.push("");

  // ---- Section 1: PLACEHOLDER (the showcase) ----
  md.push("## 1. PLACEHOLDER QUESTION → REGENERATED (showcase utama)");
  md.push("");
  md.push("Soal-soal ini sebelumnya hanya berisi teks generik `Soal ... Variasi N` dengan");
  md.push("opsi `Pilihan A/B/C/D`. Sekarang diganti soal + opsi NYATA sesuai topik.");
  md.push("");

  const phBySubject = {};
  for (const q of after.PLACEHOLDER_QUESTION) {
    (phBySubject[q.subject] = phBySubject[q.subject] || []).push(q);
  }
  for (const [subject, qs] of Object.entries(phBySubject)) {
    md.push(`### Mata Pelajaran: ${subject} (${Math.min(qs.length, PER_SUBJECT)} sampel)`);
    md.push("");
    qs.slice(0, PER_SUBJECT).forEach((q, i) => {
      const b = beforeById.get(q.questionId);
      md.push(renderQuestion(b, q, i + 1));
    });
  }

  // ---- Section 2: POSITION_BIAS ----
  md.push("## 2. POSITION BIAS (100% A) → SHUFFLED + RE-SYNCED");
  md.push("");
  md.push("Soal-soal ini isinya BENAR, tetapi kunci jawaban selalu `A`. Opsi di-shuffle");
  md.push("dan kunci disinkronkan ulang (konten yang benar tetap benar, hanya pindah posisi).");
  md.push("");

  const biasBySubject = {};
  for (const q of after.POSITION_BIAS_A) {
    (biasBySubject[q.subject] = biasBySubject[q.subject] || []).push(q);
  }
  for (const [subject, qs] of Object.entries(biasBySubject)) {
    const remedied = qs.filter((q) => q.remediationStatus === "REMEDIED");
    const manual = qs.filter((q) => q.remediationStatus === "NEEDS_MANUAL_REVIEW");
    md.push(
      `### Mata Pelajaran: ${subject} ` +
        `(${remedied.length} REMEDIED, ${manual.length} NEEDS_MANUAL_REVIEW)`,
    );
    md.push("");
    // Show remedied first, then manual-review items so every subject is visible
    const shown = [...remedied, ...manual].slice(0, PER_SUBJECT);
    shown.forEach((q, i) => {
      const b = beforeById.get(q.questionId);
      md.push(renderQuestion(b, q, i + 1));
    });
  }

  // ---- Section 3: CONTENT_BUG (manual review) ----
  md.push("## 3. CONTENT BUG → NEEDS_MANUAL_REVIEW");
  md.push("");
  md.push("Soal-soal ini mengandung `undefined` atau opsi duplikat. TIDAK bisa diperbaiki");
  md.push("otomatis dengan aman — ditandai untuk penulisan ulang manual.");
  md.push("");
  after.CONTENT_BUG.slice(0, PER_SUBJECT).forEach((q, i) => {
    const b = beforeById.get(q.questionId);
    md.push(renderQuestion(b, q, i + 1));
  });

  const outPath = path.join(dir, "QUESTIONBANK-REMEDIATION-MANUAL-REVIEW.md");
  fs.writeFileSync(outPath, md.join("\n"));
  console.log(`\nSaved manual review document to:\n  ${outPath}`);
  console.log("\nFILE-ONLY generation complete (0 MongoDB writes).");
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
