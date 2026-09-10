/**
 * ORCHESTRATOR GENERATOR BANK SOAL V7 — PILOT KELAS 3 (IPA & IPS)
 *
 * 1. Generate soal per bab (targetCount per bab, tersebar merata ke subBab)
 * 2. Simpan aset SVG (gambar soal) ke folder assets
 * 3. Ekspor Excel `REKAP-BANK-SOAL-V7-PILOT-KELAS3-IPA-IPS.xlsx`
 * 4. Buat file preview HTML untuk review visual bareng
 * 5. Buat laporan statistik Markdown
 *
 * Usage: node src/scripts/v7/generate-pilot-kelas3.mjs [--per-bab 500] [--seed 12345]
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as XLSX from "xlsx";

import { IPA_KELAS3, IPS_KELAS3 } from "./data-materi-kelas3.mjs";
import { generateBab as generateIpaBab } from "./generator-ipa-kelas3.mjs";
import { generateBab as generateIpsBab } from "./generator-ips-kelas3.mjs";
import { makeRng } from "./lib/soal-helpers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// =====================================================
// CLI ARGS
// =====================================================
const args = process.argv.slice(2);
const getArg = (name, def) => {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : def;
};
const PER_BAB = Number(getArg("--per-bab", "500"));
const SEED = Number(getArg("--seed", "20260903"));
const OUTPUT_DIR = path.resolve(__dirname, "../../../outputs/v7-pilot-kelas3");
const ASSETS_DIR = path.join(OUTPUT_DIR, "assets");
const EXCEL_PATH = path.join(OUTPUT_DIR, "REKAP-BANK-SOAL-V7-PILOT-KELAS3-IPA-IPS.xlsx");
const HTML_PATH = path.join(OUTPUT_DIR, "PREVIEW-KELAS3-IPA-IPS.html");
const REPORT_PATH = path.join(OUTPUT_DIR, "LAPORAN-PILOT-KELAS3.md");

// =====================================================
// RESOLVE GAMBAR: tulis SVG ke file, ganti jadi path relatif
// =====================================================
let gambarCounter = 0;

function resolveGambar(gambarUrl, subject, babSlug, nomor) {
  if (!gambarUrl || typeof gambarUrl !== "object" || gambarUrl.type !== "svg") {
    return null;
  }
  const safe = subject.toLowerCase().replace(/[^a-z0-9]/g, "");
  const bab = babSlug.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24);
  const fileName = `${safe}-${bab}-q${String(nomor).padStart(4, "0")}-${gambarCounter++}.svg`;
  const filePath = path.join(ASSETS_DIR, fileName);
  fs.writeFileSync(filePath, gambarUrl.svg, "utf8");
  return `assets/${fileName}`;
}

// =====================================================
// BUILD EXCEL ROW
// =====================================================
function toExcelRow(q) {
  return {
    "Program/Kelas": `${q.program} Kelas ${q.kelas}`,
    Fase: q.fase,
    "Mata Pelajaran": q.subject,
    "Bab": q.bab,
    "Sub Bab": q.subBab,
    Kompetensi: q.kompetensi,
    Tipe: q.tipe,
    "Teks Soal": q.teksSoal,
    "Teks Pendukung": q.teksPendukung,
    "Gambar (URL/Path)": q.gambarUrl || "",
    "Opsi A": q.opsiA,
    "Opsi B": q.opsiB,
    "Opsi C": q.opsiC,
    "Opsi D": q.opsiD,
    "Kunci Jawaban": q.kunci,
    Pembahasan: q.pembahasan,
    "Tingkat Kesulitan": q.kesulitan,
  };
}

// =====================================================
// MAIN
// =====================================================
function main() {
  console.log("=".repeat(80));
  console.log("🧪 GENERATOR BANK SOAL V7 — PILOT KELAS 3 (IPA & IPS)");
  console.log(`   Per bab: ${PER_BAB} soal | Seed: ${SEED}`);
  console.log("=".repeat(80));

  fs.mkdirSync(ASSETS_DIR, { recursive: true });

  const rng = makeRng(SEED);
  const allQuestions = [];
  const allFailed = [];
  const statPerBab = [];

  const subjects = [IPA_KELAS3, IPS_KELAS3];

  for (const subject of subjects) {
    const metaBase = {
      program: subject.program,
      kelas: subject.kelas,
      fase: subject.fase,
      subject: subject.subject,
    };

    for (const bab of subject.bab) {
      const meta = { ...metaBase, bab: bab.bab };
      const generator = subject.subject === "IPA" ? generateIpaBab : generateIpsBab;

      console.log(`\n▶ Generate ${meta.subject} — ${bab.bab} (${PER_BAB} soal target)...`);
      const { soal, failed } = generator(meta, PER_BAB, rng);

      // Resolve gambar & nomor
      soal.forEach((q, i) => {
        const nomor = allQuestions.length + i + 1;
        q.gambarUrl = resolveGambar(q.gambarUrl, q.subject, q.bab, nomor);
        allQuestions.push(toExcelRow(q));
      });
      allFailed.push(...failed);

      statPerBab.push({
        subject: meta.subject,
        bab: bab.bab,
        jumlahSubBab: bab.subBab.length,
        target: PER_BAB,
        berhasil: soal.length,
      });

      console.log(`   ✅ ${soal.length} soal valid | ❌ ${failed.length} gagal`);
    }
  }

  // =====================================================
  // Kunci jawaban distribution check
  // =====================================================
  const keyDist = { A: 0, B: 0, C: 0, D: 0 };
  for (const q of allQuestions) {
    keyDist[q["Kunci Jawaban"]]++;
  }
  const total = allQuestions.length || 1;
  console.log("\n📊 DISTRIBUSI KUNCI JAWABAN:");
  for (const k of ["A", "B", "C", "D"]) {
    console.log(`   ${k}: ${keyDist[k]} (${((keyDist[k] / total) * 100).toFixed(1)}%)`);
  }

  // =====================================================
  // EXPORT EXCEL
  // =====================================================
  const worksheet = XLSX.utils.json_to_sheet(allQuestions);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Pilot Kelas 3 IPA IPS");
  worksheet["!cols"] = [
    { wch: 16 }, { wch: 6 }, { wch: 16 }, { wch: 28 }, { wch: 22 },
    { wch: 24 }, { wch: 6 }, { wch: 60 }, { wch: 40 }, { wch: 40 },
    { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 12 },
    { wch: 50 }, { wch: 14 },
  ];
  XLSX.writeFile(workbook, EXCEL_PATH);
  console.log(`\n✅ Excel: ${EXCEL_PATH}`);
  console.log(`   Total baris: ${allQuestions.length}`);

  // =====================================================
  // PREVIEW HTML
  // =====================================================
  const html = buildHtmlPreview(allQuestions, ASSETS_DIR);
  fs.writeFileSync(HTML_PATH, html, "utf8");
  console.log(`✅ Preview: ${HTML_PATH}`);

  // =====================================================
  // LAPORAN MARKDOWN
  // =====================================================
  let md = `# 📋 Laporan Generator Bank Soal V7 — Pilot Kelas 3 (IPA & IPS)\n\n`;
  md += `**Tanggal:** ${new Date().toLocaleDateString("id-ID")}\n`;
  md += `**Per bab:** ${PER_BAB} soal | **Seed:** ${SEED}\n\n`;
  md += `## Statistik per Bab\n\n`;
  md += `| Mapel | Bab | SubBab | Target | Berhasil |\n`;
  md += `|---|---|---|---|---|\n`;
  for (const s of statPerBab) {
    md += `| ${s.subject} | ${s.bab} | ${s.jumlahSubBab} | ${s.target} | ${s.berhasil} |\n`;
  }
  md += `\n## Total\n`;
  md += `**${allQuestions.length} soal** berhasil digenerate (valid).\n`;
  md += `**${allFailed.length} soal** gagal (tidak diexport).\n\n`;
  md += `## Distribusi Kunci Jawaban\n\n`;
  md += `| Kunci | Jumlah | Persentase |\n|---|---|---|\n`;
  for (const k of ["A", "B", "C", "D"]) {
    md += `| ${k} | ${keyDist[k]} | ${((keyDist[k] / total) * 100).toFixed(1)}% |\n`;
  }
  md += `\n## File Output\n`;
  md += `- Excel: \`${path.basename(EXCEL_PATH)}\`\n`;
  md += `- Preview HTML: \`${path.basename(HTML_PATH)}\`\n`;
  md += `- Aset gambar: \`assets/\` (${gambarCounter} file SVG)\n`;

  fs.writeFileSync(REPORT_PATH, md, "utf8");
  console.log(`✅ Laporan: ${REPORT_PATH}`);

  console.log("\n" + "=".repeat(80));
  console.log("🏁 Selesai!");
  console.log("=".repeat(80));
}

// =====================================================
// HTML PREVIEW BUILDER
// =====================================================
function esc(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtmlPreview(rows, assetsDir) {
  const cards = rows
    .map((q, i) => {
      const img = q["Gambar (URL/Path)"]
        ? `<img class="q-img" src="${esc(q["Gambar (URL/Path)"])}" alt="gambar soal" />`
        : "";
      const pendukung = q["Teks Pendukung"] ? `<div class="pendukung">${esc(q["Teks Pendukung"])}</div>` : "";
      return `
      <div class="card">
        <div class="badge">${esc(q["Program/Kelas"])} • ${esc(q["Mata Pelajaran"])} • ${esc(q.Bab)} • ${esc(q["Sub Bab"])}</div>
        <div class="no">Soal #${i + 1} <span class="diff">${esc(q["Tingkat Kesulitan"])}</span></div>
        ${img}
        <p class="q">${esc(q["Teks Soal"])}</p>
        ${pendukung}
        <div class="opsi">
          <div>A. ${esc(q["Opsi A"])}</div>
          <div>B. ${esc(q["Opsi B"])}</div>
          <div>C. ${esc(q["Opsi C"])}</div>
          <div>D. ${esc(q["Opsi D"])}</div>
        </div>
        <div class="kunci">Kunci: <b>${esc(q["Kunci Jawaban"])}</b></div>
        <details class="pembahasan"><summary>Pembahasan</summary>${esc(q.Pembahasan)}</details>
      </div>`;
    })
    .join("");

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>Preview Bank Soal V7 — Kelas 3 IPA & IPS</title>
<style>
  body { font-family: system-ui, Arial, sans-serif; background: #f6f7fb; margin: 0; padding: 24px; }
  h1 { color: #1e293b; font-size: 22px; }
  .sub { color: #64748b; margin-bottom: 20px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); gap: 16px; }
  .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
  .badge { font-size: 11px; color: #b45309; background: #fffbeb; border: 1px solid #fde68a; border-radius: 999px; padding: 4px 10px; display: inline-block; margin-bottom: 8px; }
  .no { font-size: 12px; color: #94a3b8; margin-bottom: 8px; }
  .diff { color: #0284c7; }
  .q-img { display: block; max-width: 320px; margin: 8px auto 12px; border: 1px solid #e2e8f0; border-radius: 10px; background: #fff8e7; }
  .q { font-size: 15px; color: #0f172a; line-height: 1.5; }
  .pendukung { background: #f1f5f9; border-left: 4px solid #94a3b8; padding: 10px 12px; font-size: 14px; color: #334155; border-radius: 8px; margin: 8px 0; }
  .opsi { margin-top: 10px; display: grid; gap: 4px; font-size: 14px; color: #334155; }
  .kunci { margin-top: 10px; font-size: 13px; color: #047857; }
  details.pembahasan { margin-top: 8px; font-size: 13px; color: #475569; }
  summary { cursor: pointer; color: #2563eb; }
</style>
</head>
<body>
  <h1>🧪 Preview Bank Soal V7 — Pilot Kelas 3 (IPA & IPS)</h1>
  <div class="sub">${rows.length} soal • kunci diacak • gambar SVG inline (relative)</div>
  <div class="grid">${cards}</div>
</body>
</html>`;
}

main();