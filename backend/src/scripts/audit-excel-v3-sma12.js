require("dotenv").config({ path: "backend/.env" });

const fs = require("node:fs/promises");
const path = require("node:path");
const XLSX = require("../../node_modules/xlsx");
const mongoose = require("mongoose");

const excelPath = path.resolve(__dirname, "../../..", "outputs/assessment-bank-rekap/rekap-bank-soal-bimbel-bina-cendekia-ber-sumber-V3.xlsx");
const mdPath = path.resolve(__dirname, "../../..", "docs/audit-excel-v3-sma12.md");
const jsonPath = path.resolve(__dirname, "../../..", "docs/audit-excel-v3-sma12.json");

function text(value) { return String(value ?? "").trim().replace(/\s+/g, " "); }
function clean(value) { return text(value).replaceAll("|", "\\|").replaceAll("\n", " "); }
function norm(value) { return text(value).toLowerCase().replace(/[^a-z0-9]+/g, ""); }
function increment(map, key) { map[key] = (map[key] || 0) + 1; }
function mapRows(rows, source) {
  return rows.map((row) => ({
    source,
    program: text(row["Program/Kelas"] || row.program || row.Program || ""),
    className: text(row["Kelas"] || row.kelas || row.className || ""),
    major: text(row["Jurusan"] || row.jurusan || row.major || ""),
    subject: text(row["Mata Pelajaran"] || row.subject || row.Subject || ""),
    topic: text(row["Topik/Materi"] || row.topic || row.Topic || row["Bab"] || row.chapter || ""),
    chapter: text(row["Bab"] || row.chapter || ""),
  }));
}
function variationCounts(rows, field) {
  const result = {};
  for (const row of rows) if (row[field]) increment(result, row[field]);
  return Object.fromEntries(Object.entries(result).sort((a, b) => b[1] - a[1]));
}
function comboCounts(rows) {
  const result = {};
  for (const row of rows) {
    const key = [row.program, row.className || row.major, row.subject, row.topic].join("|");
    increment(result, key);
  }
  return Object.fromEntries(Object.entries(result).sort((a, b) => b[1] - a[1]));
}
function subjectByProgram(rows) {
  const result = {};
  for (const row of rows) {
    if (!row.program || !row.subject) continue;
    result[row.program] ||= {};
    increment(result[row.program], row.subject);
  }
  return result;
}
function selectSma(rows, program) {
  return rows.filter((row) => norm(row.program) === norm(program) || norm(row.className) === norm(program) || norm(row.major) === norm(program));
}

async function main() {
  const workbook = XLSX.readFile(excelPath, { cellDates: true });
  const sheets = workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: false });
    const headers = (matrix[0] || []).map(text).filter(Boolean);
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    return { name, headers, rowCount: rows.length, rows: mapRows(rows, name) };
  });
  const excelRows = sheets.flatMap((sheet) => sheet.rows);
  await mongoose.connect(process.env.MONGO_URI);
  const mongoRows = await mongoose.connection.db.collection("questionbanks").find({}).project({ program: 1, subject: 1, topic: 1 }).toArray();
  const mongoMapped = mongoRows.map((row) => ({ program: text(row.program), className: "", major: "", subject: text(row.subject), topic: text(row.topic), chapter: "" }));
  const excelPrograms = Object.keys(variationCounts(excelRows, "program"));
  const mongoPrograms = Object.keys(variationCounts(mongoMapped, "program"));
  const excelProgramSubject = subjectByProgram(excelRows);
  const mongoProgramSubject = subjectByProgram(mongoMapped);
  const programComparison = [...new Set([...excelPrograms, ...mongoPrograms])].sort().map((program) => ({ program, excelCount: excelRows.filter((row) => norm(row.program) === norm(program)).length, mongoCount: mongoMapped.filter((row) => norm(row.program) === norm(program)).length, excelSubjects: excelProgramSubject[program] || {}, mongoSubjects: mongoProgramSubject[program] || {} }));
  const special = {};
  for (const program of ["SMA IPA", "SMA IPS"]) {
    const rows = selectSma(excelRows, program);
    special[program] = { total: rows.length, subjects: variationCounts(rows, "subject"), classes: variationCounts(rows, "className"), majors: variationCounts(rows, "major"), topics: variationCounts(rows, "topic"), examples: rows.slice(0, 5) };
  }
  const searchTerms = ["SMA 12", "Kelas 12", "SMA IPA", "SMA IPS", "Matematika", "Bahasa Indonesia", "Bahasa Inggris"];
  const termHits = Object.fromEntries(searchTerms.map((term) => {
    const matchingRows = excelRows.filter((row) =>
      [row.program, row.className, row.major, row.subject, row.topic]
        .some((value) => norm(value).includes(norm(term))),
    );
    const matchingValues = [...new Set(
      excelRows.flatMap((row) =>
        [row.program, row.className, row.major, row.subject, row.topic]
          .filter((value) => norm(value).includes(norm(term))),
      ),
    )].slice(0, 30);
    return [term, { rows: matchingRows.length, values: matchingValues }];
  }));
  const excelCombos = comboCounts(excelRows);
  const excelKeys = new Set(Object.keys(excelCombos));
  const mongoCombos = comboCounts(mongoMapped);
  const mongoKeys = new Set(Object.keys(mongoCombos));
  const output = { readOnly: true, generatedAt: new Date().toISOString(), file: excelPath, sheets: sheets.map(({ name, headers, rowCount }) => ({ name, headers, rowCount })), excel: { totalRows: excelRows.length, programs: variationCounts(excelRows, "program"), classes: variationCounts(excelRows, "className"), majors: variationCounts(excelRows, "major"), subjects: variationCounts(excelRows, "subject"), topics: variationCounts(excelRows, "topic"), combinations: excelCombos, termHits, special }, mongo: { totalRows: mongoMapped.length, programs: variationCounts(mongoMapped, "program"), subjects: variationCounts(mongoMapped, "subject"), combinations: mongoCombos }, comparison: { sameProgramLabels: JSON.stringify(excelPrograms.map(norm).sort()) === JSON.stringify(mongoPrograms.map(norm).sort()), excelOnlyPrograms: excelPrograms.filter((value) => !mongoPrograms.some((other) => norm(other) === norm(value))), mongoOnlyPrograms: mongoPrograms.filter((value) => !excelPrograms.some((other) => norm(other) === norm(value))), excelOnlyCombinations: [...excelKeys].filter((key) => !mongoKeys.has(key)).length, mongoOnlyCombinations: [...mongoKeys].filter((key) => !excelKeys.has(key)).length, programComparison }, conclusions: { sma12Ipa: special["SMA IPA"].total > 0 ? "DATA_TIDAK_MEMISAHKAN_KELAS_12" : "TIDAK_ADA_DATA_SMA_IPA", sma12Ips: special["SMA IPS"].total > 0 ? "DATA_TIDAK_MEMISAHKAN_KELAS_12" : "TIDAK_ADA_DATA_SMA_IPS", exactClass12IpaRows: termHits["Kelas 12"].rows, exactSma12Rows: termHits["SMA 12"].rows, mappingDetermined: false } };
  await fs.writeFile(jsonPath, JSON.stringify(output, null, 2), "utf8");
  await fs.writeFile(mdPath, buildMarkdown(output), "utf8");
  console.log(JSON.stringify({ mdPath, jsonPath, sheets: output.sheets, excelRows: output.excel.totalRows, mongoRows: output.mongo.totalRows, excelPrograms: output.excel.programs, mongoPrograms: output.mongo.programs, special: output.excel.special, termHits: output.excel.termHits, comparison: output.comparison, conclusions: output.conclusions }, null, 2));
  await mongoose.disconnect();
}

function linesForMap(map) { return Object.entries(map).map(([key, value]) => `- ${clean(key)}: **${value}**`); }
function tableForMap(map, columns = ["Value", "Jumlah"]) { return ["| " + columns.join(" | ") + " |", "| " + columns.map(() => "---").join(" | ") + " |", ...Object.entries(map).map(([key, value]) => `| ${clean(key)} | ${value} |`)]; }
function buildMarkdown(output) {
  const lines = ["# Audit Excel QuestionBank V3: SMA 12 (Read-Only)", "", `Generated: ${output.generatedAt}`, "", "> READ-ONLY: Excel dan MongoDB hanya dibaca. Tidak ada perubahan database, file Excel, QuestionBank, atau soal.", "", "## 1. Sheet dan Header", "", ...output.sheets.flatMap((sheet) => [`### ${sheet.name}`, "", `- Baris data: **${sheet.rowCount}**`, `- Header: ${sheet.headers.map((header) => `\`${header}\``).join(", ")}`, ""]), "## 2. Variasi Nilai Excel", "", "### Program/Kelas", ...linesForMap(output.excel.programs), "", "### Kelas", ...linesForMap(output.excel.classes), "", "### Jurusan", ...linesForMap(output.excel.majors), "", "### Subject", ...linesForMap(output.excel.subjects), "", "### Topic/Bab", ...linesForMap(output.excel.topics), "", "## 3. Pencarian Khusus", "", ...Object.entries(output.excel.termHits).flatMap(([term, hit]) => [`### ${term}`, `- Baris yang cocok: **${hit.rows}**`, `- Nilai contoh: ${hit.values.map((value) => `\`${clean(value)}\``).join(", ") || "-"}`, ""]), "## 4. Kombinasi Program + Subject + Topic", "", `Total kombinasi unik: **${Object.keys(output.excel.combinations).length}**`, "", "| Program | Kelas/Jurusan | Subject | Topic | Jumlah |", "| --- | --- | --- | --- | ---: |", ...Object.entries(output.excel.combinations).map(([key, count]) => { const parts = key.split("|"); return `| ${clean(parts[0])} | ${clean(parts[1])} | ${clean(parts[2])} | ${clean(parts.slice(3).join("|"))} | ${count} |`; }), "", "## 5. Rincian SMA IPA dan SMA IPS", "", ...Object.entries(output.excel.special).flatMap(([program, data]) => [`### ${program}`, `- Jumlah soal: **${data.total}**`, "- Subject:", ...linesForMap(data.subjects), "- Kelas:", ...linesForMap(data.classes), "- Jurusan:", ...linesForMap(data.majors), "- Contoh data:", ...data.examples.map((row) => `  - ${JSON.stringify(row)}`), ""]), "## 6. Perbandingan Excel vs MongoDB", "", `- Jumlah Excel: **${output.excel.totalRows}**`, `- Jumlah MongoDB QuestionBank: **${output.mongo.totalRows}**`, `- Label program sama setelah normalisasi: **${output.comparison.sameProgramLabels ? "Ya" : "Tidak"}**`, `- Program hanya di Excel: ${output.comparison.excelOnlyPrograms.join(", ") || "tidak ada"}`, `- Program hanya di MongoDB: ${output.comparison.mongoOnlyPrograms.join(", ") || "tidak ada"}`, `- Kombinasi hanya di Excel: **${output.comparison.excelOnlyCombinations}**`, `- Kombinasi hanya di MongoDB: **${output.comparison.mongoOnlyCombinations}**`, "", "| Program | Excel | MongoDB |", "| --- | ---: | ---: |", ...output.comparison.programComparison.map((row) => `| ${clean(row.program)} | ${row.excelCount} | ${row.mongoCount} |`), "", "## 7. Kesimpulan", "", `1. SMA 12 IPA: **${output.conclusions.sma12Ipa}**`, `2. SMA 12 IPS: **${output.conclusions.sma12Ips}**`, `3. Data literal \\"SMA 12\\" ditemukan: **${output.conclusions.exactSma12Rows} baris**.`, `4. Data literal \\"Kelas 12\\" ditemukan: **${output.conclusions.exactClass12IpaRows} baris**.`, "5. Excel menggunakan label agregat program (`SMA IPA`, `SMA IPS`), bukan pemisahan eksplisit `SMA 10 IPA`, `SMA 10 IPS`, `SMA 12 IPA`, atau `SMA 12 IPS`.", "6. Excel **tidak dapat menentukan mapping final siswa SMA 10/12** secara pasti.", "", "## 8. Keamanan", "", "Analisis ini hanya membaca workbook dan collection `questionbanks`, kemudian menulis dua laporan lokal. Tidak ada operasi mutasi database."];
  return `${lines.join("\n")}\n`;
}

main().catch(async (error) => { console.error(error); await mongoose.disconnect(); process.exitCode = 1; });
