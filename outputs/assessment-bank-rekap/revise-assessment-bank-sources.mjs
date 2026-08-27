import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const inputPath = path.resolve(
  "outputs/assessment-bank-rekap/rekap-bank-soal-bimbel-bina-cendekia.xlsx",
);
const outputPath = path.resolve(
  "outputs/assessment-bank-rekap/rekap-bank-soal-bimbel-bina-cendekia-ber-sumber.xlsx",
);

const REGULAR_SOURCE = {
  type: "Acuan kurikulum dan buku teks resmi",
  title:
    "CP/Kurikulum Merdeka Kemendikdasmen; Panduan Mata Pelajaran; SIBI Buku Teks Kurikulum Merdeka",
  urls: [
    "https://kurikulum.kemendikdasmen.go.id/rujukan/",
    "https://kurikulum.kemendikdasmen.go.id/panduan-mapel",
    "https://buku.kemendikdasmen.go.id/katalog",
  ].join("\n"),
  note:
    "Butir soal adalah draf latihan internal berdasarkan topik/materi pada baris ini; bukan salinan verbatim dari sumber resmi. Wajib direview guru/mapel sebelum dipakai resmi.",
  status: "Perlu Review Guru",
};

const UTBK_SOURCE = {
  type: "Acuan framework UTBK-SNBT resmi",
  title: "SNPMB UTBK-SNBT 2026: Informasi Umum dan Framework Tes",
  urls: [
    "https://www.snpmb.id/utbk-snbt/informasi-umum",
    "https://snpmb.id/fr/",
  ].join("\n"),
  note:
    "Butir soal adalah draf latihan internal yang mengikuti komponen tes UTBK-SNBT; bukan soal resmi SNPMB. Wajib direview tentor/guru UTBK sebelum dipakai resmi.",
  status: "Perlu Review Guru",
};

const SOURCE_HEADERS = [
  "Jenis Sumber Akademik",
  "Sumber Acuan Resmi",
  "URL Sumber Acuan",
  "Catatan Sumber",
  "Status Validasi Akademik",
];

const DETAIL_SHEETS = new Set([
  "SD 4",
  "SD 5",
  "SD 6",
  "SMP 7",
  "SMP 8",
  "SMP 9",
  "SMA 10",
  "SMA 11",
  "SMA 12",
  "UTBK",
]);

function sourceForRow(row) {
  const segment = String(row["Segmen"] ?? "").trim().toLowerCase();
  const jenjang = String(row["Jenjang"] ?? "").trim().toUpperCase();
  const kelas = String(row["Kelas"] ?? "").trim().toUpperCase();

  return segment === "utbk" || jenjang === "UTBK" || kelas === "UTBK"
    ? UTBK_SOURCE
    : REGULAR_SOURCE;
}

function annotateRow(row) {
  const source = sourceForRow(row);

  return {
    ...row,
    "Jenis Sumber Akademik": source.type,
    "Sumber Acuan Resmi": source.title,
    "URL Sumber Acuan": source.urls,
    "Catatan Sumber": source.note,
    "Status Validasi Akademik": source.status,
  };
}

function headersWithSources(headers) {
  const existing = new Set(headers);
  const nextHeaders = [...headers];

  for (const header of SOURCE_HEADERS) {
    if (!existing.has(header)) {
      nextHeaders.push(header);
    }
  }

  return nextHeaders;
}

function sheetToRows(worksheet) {
  return XLSX.utils.sheet_to_json(worksheet, {
    defval: "",
    raw: false,
  });
}

function headerRowOf(worksheet) {
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  return rows[0]?.map((cell) => String(cell ?? "")) ?? [];
}

function applyColumnWidths(worksheet, headers) {
  const widths = headers.map((header) => {
    if (header === "Pertanyaan" || header === "Pembahasan" || header === "Catatan Sumber") {
      return { wch: 54 };
    }

    if (header === "URL Sumber Acuan") {
      return { wch: 58 };
    }

    if (header === "Sumber Acuan Resmi") {
      return { wch: 48 };
    }

    if (header === "Sumber File") {
      return { wch: 42 };
    }

    if (header === "Question Set ID" || header === "Question Key") {
      return { wch: 32 };
    }

    if (header === "Status Validasi Akademik" || header === "Jenis Sumber Akademik") {
      return { wch: 26 };
    }

    return { wch: 18 };
  });

  worksheet["!cols"] = widths;
}

function replaceSheetFromObjects(workbook, sheetName, rows) {
  const original = workbook.Sheets[sheetName];
  const headers = headersWithSources(headerRowOf(original));
  const annotatedRows = rows.map(annotateRow);
  const worksheet = XLSX.utils.json_to_sheet(annotatedRows, { header: headers });

  applyColumnWidths(worksheet, headers);
  workbook.Sheets[sheetName] = worksheet;
}

function buildReferenceSheet() {
  const rows = [
    {
      Kode: "KURIKULUM-RUJUKAN",
      Konteks: "SD/SMP/SMA",
      "Nama Rujukan": "Sistem Informasi Kurikulum Nasional - Rujukan Kurikulum",
      "Lembaga/Penerbit": "Kemendikdasmen",
      URL: "https://kurikulum.kemendikdasmen.go.id/rujukan/",
      "Digunakan Untuk": "Acuan CP, regulasi, dan dokumen kurikulum.",
      Catatan:
        "Dipakai sebagai acuan kurikulum umum; bukan sumber salinan butir soal.",
    },
    {
      Kode: "PANDUAN-MAPEL",
      Konteks: "SD/SMP/SMA",
      "Nama Rujukan": "Panduan Mata Pelajaran",
      "Lembaga/Penerbit": "Kemendikdasmen",
      URL: "https://kurikulum.kemendikdasmen.go.id/panduan-mapel",
      "Digunakan Untuk":
        "Acuan menerjemahkan CP ke praktik pembelajaran dan asesmen per mapel.",
      Catatan:
        "Guru tetap perlu memetakan topik ke tujuan pembelajaran yang dipakai lembaga.",
    },
    {
      Kode: "SIBI-BUKU-TEKS",
      Konteks: "SD/SMP/SMA",
      "Nama Rujukan": "SIBI - Katalog Buku Teks Kurikulum Merdeka",
      "Lembaga/Penerbit": "Pusat Perbukuan Kemendikdasmen",
      URL: "https://buku.kemendikdasmen.go.id/katalog",
      "Digunakan Untuk":
        "Acuan buku teks resmi/pemerintah sesuai jenjang, kelas, dan mata pelajaran.",
      Catatan:
        "Butir soal pada workbook ini tidak menyalin halaman buku; isi perlu review guru.",
    },
    {
      Kode: "SNPMB-UTBK-INFO",
      Konteks: "UTBK",
      "Nama Rujukan": "Informasi Umum UTBK-SNBT 2026",
      "Lembaga/Penerbit": "SNPMB",
      URL: "https://www.snpmb.id/utbk-snbt/informasi-umum",
      "Digunakan Untuk":
        "Acuan komponen materi UTBK-SNBT: TPS, Literasi, dan Penalaran Matematika.",
      Catatan:
        "Bukan sumber soal resmi UTBK; hanya acuan struktur dan materi tes.",
    },
    {
      Kode: "SNPMB-UTBK-FRAMEWORK",
      Konteks: "UTBK",
      "Nama Rujukan": "Framework UTBK-SNBT 2026",
      "Lembaga/Penerbit": "SNPMB",
      URL: "https://snpmb.id/fr/",
      "Digunakan Untuk":
        "Acuan tujuan subtes, jumlah soal, durasi, dan cakupan kemampuan UTBK-SNBT.",
      Catatan:
        "Butir soal workbook tetap draf internal dan wajib ditinjau tentor/guru.",
    },
  ];
  const headers = Object.keys(rows[0]);
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });

  worksheet["!cols"] = [
    { wch: 24 },
    { wch: 16 },
    { wch: 48 },
    { wch: 32 },
    { wch: 58 },
    { wch: 58 },
    { wch: 58 },
  ];

  return worksheet;
}

function updateSummarySheet(workbook) {
  const sheetName = "Ringkasan";
  const original = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(original, {
    header: 1,
    defval: "",
    raw: false,
  });
  const note =
    "Workbook ini menggabungkan file soal upload-ready dari data/assessment-bank-xlsx. Revisi 2026-08-25 menambahkan kolom sumber acuan resmi. Sumber yang dicantumkan adalah acuan kurikulum/materi, bukan klaim bahwa butir soal disalin dari dokumen resmi. Semua soal tetap berstatus Perlu Review Guru.";

  if (!rows[2]) {
    rows[2] = [];
  }

  rows[2][0] = "Catatan";
  rows[2][1] = note;
  rows[10] = ["Referensi resmi", "Lihat sheet Referensi Resmi", "", "", "", "", "", "", "", ""];

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
  ];
  worksheet["!cols"] = original["!cols"] ?? [
    { wch: 24 },
    { wch: 72 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
  ];

  workbook.Sheets[sheetName] = worksheet;
}

function insertReferenceSheet(workbook) {
  const sheetName = "Referensi Resmi";

  workbook.Sheets[sheetName] = buildReferenceSheet();
  workbook.SheetNames = workbook.SheetNames.filter((name) => name !== sheetName);
  const insertIndex = Math.min(2, workbook.SheetNames.length);
  workbook.SheetNames.splice(insertIndex, 0, sheetName);
}

if (!fs.existsSync(inputPath)) {
  console.error(`Input workbook tidak ditemukan: ${inputPath}`);
  process.exit(1);
}

const workbook = XLSX.readFile(inputPath, {
  cellDates: true,
  cellStyles: true,
});

updateSummarySheet(workbook);
insertReferenceSheet(workbook);

for (const sheetName of workbook.SheetNames) {
  if (sheetName === "Daftar File" || DETAIL_SHEETS.has(sheetName)) {
    replaceSheetFromObjects(workbook, sheetName, sheetToRows(workbook.Sheets[sheetName]));
  }
}

XLSX.writeFile(workbook, outputPath, {
  bookType: "xlsx",
  compression: true,
});

console.log(outputPath);
