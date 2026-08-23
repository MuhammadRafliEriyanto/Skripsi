import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const XLSX = require("../backend/node_modules/xlsx");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const SOURCE_ROOT = path.join(REPO_ROOT, "data", "assessment-bank-xlsx");
const OUTPUT_DIR = path.join(REPO_ROOT, "outputs", "assessment-bank-rekap");
const OUTPUT_PATH = path.join(
  OUTPUT_DIR,
  "rekap-bank-soal-bimbel-bina-cendekia.xlsx",
);

const GENERATED_DATE = "2026-08-22";

const DETAIL_HEADERS = [
  "Jenis",
  "Segmen",
  "Jenjang",
  "Kelas",
  "Fase",
  "Mapel",
  "Pertemuan/Tahap",
  "Question Set ID",
  "Question Key",
  "No",
  "Pertanyaan",
  "Opsi A",
  "Opsi B",
  "Opsi C",
  "Opsi D",
  "Jawaban Benar",
  "Pembahasan",
  "Topik/Materi",
  "Kesulitan/Level",
  "Kompetensi",
  "Indikator",
  "Level Kognitif",
  "Review Status",
  "Catatan Reviewer",
  "Sumber File",
];

const FILE_HEADERS = [
  "No",
  "Jenis",
  "Segmen",
  "Jenjang",
  "Kelas",
  "Fase",
  "Mapel",
  "Pertemuan/Tahap",
  "Question Set ID",
  "Jumlah Soal Metadata",
  "Jumlah Soal Dibaca",
  "Durasi Menit",
  "Status Review",
  "Generated At",
  "Last Modified",
  "Validasi",
  "Sumber File",
];

const TYPE_ORDER = new Map([
  ["Latihan", 1],
  ["UTS", 2],
  ["UAS", 3],
  ["Tryout", 4],
]);

const CLASS_ORDER = new Map([
  ["SD 4", 1],
  ["SD 5", 2],
  ["SD 6", 3],
  ["SMP 7", 4],
  ["SMP 8", 5],
  ["SMP 9", 6],
  ["SMA 10", 7],
  ["SMA 11", 8],
  ["SMA 12", 9],
  ["UTBK", 10],
]);

const SUBJECT_LABELS = {
  "bahasa-indonesia": "Bahasa Indonesia",
  "bahasa-inggris": "Bahasa Inggris",
  biologi: "Biologi",
  ekonomi: "Ekonomi",
  fisika: "Fisika",
  ipa: "IPA",
  ips: "IPS",
  kimia: "Kimia",
  "literasi-bahasa-indonesia": "Literasi Bahasa Indonesia",
  "literasi-bahasa-inggris": "Literasi Bahasa Inggris",
  matematika: "Matematika",
  "penalaran-matematika": "Penalaran Matematika",
  sejarah: "Sejarah",
  tps: "TPS",
};

function normalizePath(value) {
  return value.replaceAll("\\", "/");
}

function relativeSourcePath(filePath) {
  return normalizePath(path.relative(SOURCE_ROOT, filePath));
}

function normalizeHeader(value) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "");
}

function cleanText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value;
  }

  return String(value)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim().replace(/\s+/g, " "))
    .join("\n")
    .trim();
}

function getCell(row, aliases) {
  const normalizedAliases = new Set(aliases.map(normalizeHeader));
  const matchedEntry = Object.entries(row).find(([header]) =>
    normalizedAliases.has(normalizeHeader(header)),
  );

  return cleanText(matchedEntry?.[1]);
}

function parsePositiveInteger(value) {
  const parsed = Number.parseInt(cleanText(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : "";
}

function classNameFromSlug(slug) {
  const match = slug.match(/^(sd|smp|sma)-(\d+)$/i);
  if (!match) {
    return slug.toUpperCase();
  }

  return `${match[1].toUpperCase()} ${match[2]}`;
}

function levelFromClassName(className) {
  if (className === "UTBK") {
    return "UTBK";
  }

  return cleanText(className).split(" ")[0] ?? "";
}

function gradeFromClassName(className) {
  return Number.parseInt(cleanText(className).match(/\d+/)?.[0] ?? "", 10) || "";
}

function phaseFromGrade(grade, fallback = "") {
  if (!grade) {
    return fallback;
  }

  if (grade <= 4) {
    return "Fase B";
  }

  if (grade <= 6) {
    return "Fase C";
  }

  if (grade <= 9) {
    return "Fase D";
  }

  if (grade === 10) {
    return "Fase E";
  }

  return "Fase F";
}

function subjectFromSlug(slug) {
  if (SUBJECT_LABELS[slug]) {
    return SUBJECT_LABELS[slug];
  }

  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function questionKey(questionSetId, questionNumber) {
  if (!questionSetId || !questionNumber) {
    return "";
  }

  return `${questionSetId}-${String(questionNumber).padStart(3, "0")}`;
}

function sortValue(value) {
  return cleanText(value).toLowerCase();
}

function compareText(left, right) {
  return sortValue(left).localeCompare(sortValue(right), "id");
}

function meetingRank(value) {
  const text = cleanText(value);
  const meetingMatch = text.match(/^P(\d+)$/i);

  if (meetingMatch) {
    return Number(meetingMatch[1]);
  }

  const stageMatch = text.match(/^Tahap\s+(\d+)$/i);

  if (stageMatch) {
    return 1000 + Number(stageMatch[1]);
  }

  return text ? 9999 : 0;
}

function compareMeeting(left, right) {
  return meetingRank(left) - meetingRank(right) || compareText(left, right);
}

function formatMeetingSet(values) {
  const items = [...values].filter(Boolean).sort(compareMeeting);
  const pNumbers = items
    .map((item) => item.match(/^P(\d+)$/i)?.[1])
    .filter(Boolean)
    .map(Number);
  const stageNumbers = items
    .map((item) => item.match(/^Tahap\s+(\d+)$/i)?.[1])
    .filter(Boolean)
    .map(Number);

  if (pNumbers.length === items.length && isConsecutive(pNumbers)) {
    return `P${pNumbers[0]}-P${pNumbers.at(-1)}`;
  }

  if (stageNumbers.length === items.length && isConsecutive(stageNumbers)) {
    return `Tahap ${stageNumbers[0]}-${stageNumbers.at(-1)}`;
  }

  return items.join(", ");
}

function isConsecutive(numbers) {
  const sortedNumbers = [...numbers].sort((left, right) => left - right);

  return sortedNumbers.every((number, index) => {
    return index === 0 || number === sortedNumbers[index - 1] + 1;
  });
}

async function walkFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const currentPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walkFiles(currentPath)));
    } else if (entry.isFile()) {
      files.push(currentPath);
    }
  }

  return files;
}

function readSheetRows(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    return [];
  }

  return XLSX.utils.sheet_to_json(sheet, {
    defval: "",
  });
}

function readMetadata(workbook) {
  const metadataSheetName = workbook.SheetNames.find(
    (sheetName) => normalizeHeader(sheetName) === "metadata",
  );

  if (!metadataSheetName) {
    return {};
  }

  const rows = readSheetRows(workbook, metadataSheetName);
  const metadata = {};

  for (const row of rows) {
    const field = cleanText(row.Field ?? row.field ?? row.FIELD);
    const value = row.Value ?? row.value ?? row.VALUE ?? "";

    if (field) {
      metadata[normalizeHeader(field)] = cleanText(value);
    }
  }

  return metadata;
}

function isSourceWorkbook(relPath) {
  return (
    relPath.startsWith("latihan/regular/") ||
    relPath.startsWith("latihan/utbk/") ||
    relPath.startsWith("uts/") ||
    relPath.startsWith("uas/") ||
    relPath.startsWith("tryout/")
  );
}

function loadLatihanIndex() {
  const indexPath = path.join(SOURCE_ROOT, "latihan-bank-index.xlsx");
  const workbook = XLSX.readFile(indexPath);
  const rows = readSheetRows(workbook, "Index");
  const indexByPath = new Map();

  for (const row of rows) {
    const relPath = normalizePath(cleanText(row.filePath));

    if (relPath) {
      indexByPath.set(relPath, row);
    }
  }

  return indexByPath;
}

function metadataFromPath(relPath, workbookMetadata, latihanIndexRow = {}) {
  const parts = relPath.split("/");
  const rootType = parts[0] ?? "";

  if (rootType === "latihan") {
    const questionSetId = cleanText(latihanIndexRow.questionSetId);
    const className =
      cleanText(latihanIndexRow.className) ||
      (parts[1] === "utbk" ? "UTBK" : classNameFromSlug(parts[2] ?? ""));
    const meetingNumber =
      parsePositiveInteger(latihanIndexRow.meetingNumber) ||
      parsePositiveInteger(relPath.match(/-p(\d+)\.xlsx$/i)?.[1]);
    const meetingCode =
      cleanText(latihanIndexRow.meetingCode) ||
      (meetingNumber ? `P${meetingNumber}` : "");
    const grade = gradeFromClassName(className);

    return {
      assessmentType: "Latihan",
      segment: cleanText(latihanIndexRow.segment) || cleanText(parts[1]),
      level: cleanText(latihanIndexRow.level) || levelFromClassName(className),
      className,
      grade,
      phase: cleanText(latihanIndexRow.phase) || phaseFromGrade(grade, "UTBK"),
      subject:
        cleanText(latihanIndexRow.subject) ||
        subjectFromSlug(parts[parts.length - 2] ?? ""),
      meetingLabel: meetingCode,
      meetingSort: meetingNumber || 0,
      questionSetId,
      questionCount: parsePositiveInteger(latihanIndexRow.questionCount),
      suggestedDurationMinutes: parsePositiveInteger(
        latihanIndexRow.suggestedDurationMinutes,
      ),
      reviewStatus:
        cleanText(latihanIndexRow.reviewStatus) || "Perlu Review Guru",
      generatedAt: cleanText(latihanIndexRow.generatedAt),
    };
  }

  const assessmentType =
    rootType === "uts"
      ? "UTS"
      : rootType === "uas"
        ? "UAS"
        : rootType === "tryout"
          ? "Tryout"
          : cleanText(workbookMetadata.assessmenttype);
  const className =
    cleanText(workbookMetadata.classname) || classNameFromSlug(parts[1] ?? "");
  const grade =
    parsePositiveInteger(workbookMetadata.grade) || gradeFromClassName(className);
  const fileName = parts.at(-1) ?? "";
  const subjectSlug = fileName
    .replace(/-(uts|uas)\.xlsx$/i, "")
    .replace(/-tryout-\d+\.xlsx$/i, "");
  const stage =
    parsePositiveInteger(workbookMetadata.stage) ||
    parsePositiveInteger(fileName.match(/tryout-(\d+)\.xlsx$/i)?.[1]);

  return {
    assessmentType: cleanText(workbookMetadata.assessmenttype) || assessmentType,
    segment: assessmentType.toLowerCase(),
    level: levelFromClassName(className),
    className,
    grade,
    phase: cleanText(workbookMetadata.phase) || phaseFromGrade(grade),
    subject: cleanText(workbookMetadata.subject) || subjectFromSlug(subjectSlug),
    meetingLabel: stage ? `Tahap ${stage}` : "",
    meetingSort: stage || 0,
    questionSetId: cleanText(workbookMetadata.questionsetid),
    questionCount: parsePositiveInteger(workbookMetadata.questioncount),
    suggestedDurationMinutes: parsePositiveInteger(
      workbookMetadata.suggesteddurationminutes,
    ),
    reviewStatus:
      cleanText(workbookMetadata.reviewstatus) || "Perlu Review Guru",
    generatedAt: "",
  };
}

function readQuestionsFromWorkbook(workbook) {
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    return [];
  }

  const rows = readSheetRows(workbook, firstSheetName);

  return rows.filter((row) => {
    return (
      getCell(row, ["Pertanyaan", "Soal", "Question", "Question Text"]) ||
      getCell(row, ["Opsi A", "Pilihan A", "Option A", "A"]) ||
      getCell(row, ["Opsi B", "Pilihan B", "Option B", "B"]) ||
      getCell(row, ["Opsi C", "Pilihan C", "Option C", "C"]) ||
      getCell(row, ["Opsi D", "Pilihan D", "Option D", "D"]) ||
      getCell(row, ["Jawaban Benar", "Kunci Jawaban", "Jawaban", "Answer"])
    );
  });
}

function normalizeQuestionRow(row, meta, relPath, index) {
  const questionNumber =
    parsePositiveInteger(getCell(row, ["No", "Nomor", "Number", "Urutan"])) ||
    index + 1;
  const rowQuestionKey =
    getCell(row, ["Question ID", "QuestionID", "ID Soal"]) ||
    questionKey(meta.questionSetId, questionNumber);

  return {
    Jenis: meta.assessmentType,
    Segmen: meta.segment,
    Jenjang: meta.level,
    Kelas: meta.className,
    Fase: meta.phase,
    Mapel: meta.subject,
    "Pertemuan/Tahap": meta.meetingLabel,
    "Question Set ID": meta.questionSetId,
    "Question Key": rowQuestionKey,
    No: questionNumber,
    Pertanyaan: getCell(row, ["Pertanyaan", "Soal", "Question", "Question Text"]),
    "Opsi A": getCell(row, ["Opsi A", "Pilihan A", "Option A", "A"]),
    "Opsi B": getCell(row, ["Opsi B", "Pilihan B", "Option B", "B"]),
    "Opsi C": getCell(row, ["Opsi C", "Pilihan C", "Option C", "C"]),
    "Opsi D": getCell(row, ["Opsi D", "Pilihan D", "Option D", "D"]),
    "Jawaban Benar": getCell(row, [
      "Jawaban Benar",
      "Kunci Jawaban",
      "Jawaban",
      "Answer",
      "Correct Answer",
    ]).toUpperCase(),
    Pembahasan: getCell(row, ["Pembahasan", "Penjelasan", "Explanation"]),
    "Topik/Materi": getCell(row, ["Topik", "Materi", "Topic"]),
    "Kesulitan/Level":
      getCell(row, ["Kesulitan", "Level", "Difficulty"]) || "Sedang",
    Kompetensi: getCell(row, ["Kompetensi", "Competency"]),
    Indikator: getCell(row, ["Indikator", "Indicator"]),
    "Level Kognitif": getCell(row, ["Level Kognitif", "Cognitive Level"]),
    "Review Status":
      getCell(row, ["Review Status", "Status Review"]) || meta.reviewStatus,
    "Catatan Reviewer": getCell(row, ["Catatan Reviewer", "Reviewer Note"]),
    "Sumber File": relPath,
  };
}

function validationNote(meta, questionRows) {
  const expected = Number(meta.questionCount) || 0;

  if (!expected) {
    return questionRows.length > 0 ? "OK" : "Tidak ada soal terbaca";
  }

  return expected === questionRows.length
    ? "OK"
    : `Jumlah soal tidak sama: metadata ${expected}, terbaca ${questionRows.length}`;
}

function detailSort(left, right) {
  return (
    (CLASS_ORDER.get(left.Kelas) ?? 999) - (CLASS_ORDER.get(right.Kelas) ?? 999) ||
    (TYPE_ORDER.get(left.Jenis) ?? 999) - (TYPE_ORDER.get(right.Jenis) ?? 999) ||
    compareText(left.Mapel, right.Mapel) ||
    compareMeeting(left["Pertemuan/Tahap"], right["Pertemuan/Tahap"]) ||
    Number(left.No) - Number(right.No)
  );
}

function fileSort(left, right) {
  return (
    (CLASS_ORDER.get(left.Kelas) ?? 999) - (CLASS_ORDER.get(right.Kelas) ?? 999) ||
    (TYPE_ORDER.get(left.Jenis) ?? 999) - (TYPE_ORDER.get(right.Jenis) ?? 999) ||
    compareText(left.Mapel, right.Mapel) ||
    compareMeeting(left["Pertemuan/Tahap"], right["Pertemuan/Tahap"]) ||
    compareText(left["Sumber File"], right["Sumber File"])
  );
}

function addWorksheet(workbook, name, rows, headers, columnWidths = {}) {
  const sheet = XLSX.utils.json_to_sheet(rows, {
    header: headers,
  });

  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:A1");
  sheet["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: range.e.r, c: headers.length - 1 },
    }),
  };
  sheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  sheet["!cols"] = headers.map((header) => ({
    wch: columnWidths[header] ?? defaultColumnWidth(header),
  }));

  XLSX.utils.book_append_sheet(workbook, sheet, name);
}

function defaultColumnWidth(header) {
  if (header === "Pertanyaan" || header === "Pembahasan") {
    return 60;
  }

  if (header === "Sumber File") {
    return 62;
  }

  if (header.includes("Question")) {
    return 26;
  }

  if (header.startsWith("Opsi")) {
    return 32;
  }

  if (header === "Indikator" || header === "Topik/Materi") {
    return 34;
  }

  if (header === "Catatan Reviewer") {
    return 28;
  }

  return 18;
}

function addSummarySheet(workbook, rows, fileRows) {
  const totalQuestions = rows.length;
  const sourceFiles = fileRows.length;
  const classes = [...new Set(rows.map((row) => row.Kelas))].sort(
    (left, right) => (CLASS_ORDER.get(left) ?? 999) - (CLASS_ORDER.get(right) ?? 999),
  );
  const subjects = [...new Set(rows.map((row) => row.Mapel))].filter(Boolean);
  const byType = aggregate(rows, ["Jenis"]);
  const byClass = aggregate(rows, ["Kelas"]);
  const byClassSubjectType = aggregate(rows, ["Kelas", "Mapel", "Jenis"]);

  const summaryRows = [
    ["Rekap Bank Soal Bimbel Bina Cendekia"],
    [`Dibuat: ${GENERATED_DATE}`],
    [
      "Catatan",
      "Workbook ini menggabungkan file soal upload-ready dari data/assessment-bank-xlsx. Sheet detail tetap dipisah per kelas, termasuk UTBK.",
    ],
    [],
    ["Metrik", "Jumlah"],
    ["File sumber soal", sourceFiles],
    ["Total soal terbaca", totalQuestions],
    ["Kelompok kelas", classes.length],
    ["Mapel unik", subjects.length],
    ["Soal Latihan", byType.get("Latihan")?.questions ?? 0],
    ["Soal UTS", byType.get("UTS")?.questions ?? 0],
    ["Soal UAS", byType.get("UAS")?.questions ?? 0],
    ["Soal Tryout", byType.get("Tryout")?.questions ?? 0],
    [],
    ["Ringkasan Per Kelas"],
    [
      "Kelas",
      "Jenjang",
      "Total Set",
      "Total Soal",
      "Latihan",
      "UTS",
      "UAS",
      "Tryout",
      "Mapel",
      "Sheet Detail",
    ],
  ];

  for (const className of classes) {
    const classRows = rows.filter((row) => row.Kelas === className);
    const classFileRows = fileRows.filter((row) => row.Kelas === className);
    const classByType = aggregate(classRows, ["Jenis"]);
    const classSubjects = [...new Set(classRows.map((row) => row.Mapel))].filter(
      Boolean,
    );

    summaryRows.push([
      className,
      classRows[0]?.Jenjang ?? "",
      classFileRows.length,
      classRows.length,
      classByType.get("Latihan")?.questions ?? 0,
      classByType.get("UTS")?.questions ?? 0,
      classByType.get("UAS")?.questions ?? 0,
      classByType.get("Tryout")?.questions ?? 0,
      classSubjects.length,
      className,
    ]);
  }

  summaryRows.push([]);
  summaryRows.push(["Rekap Detail Per Kelas, Mapel, dan Jenis"]);
  summaryRows.push([
    "Kelas",
    "Mapel",
    "Jenis",
    "Total Set",
    "Total Soal",
    "Rentang Pertemuan/Tahap",
  ]);

  for (const item of [...byClassSubjectType.values()].sort((left, right) => {
    return (
      (CLASS_ORDER.get(left.Kelas) ?? 999) -
        (CLASS_ORDER.get(right.Kelas) ?? 999) ||
      compareText(left.Mapel, right.Mapel) ||
      (TYPE_ORDER.get(left.Jenis) ?? 999) - (TYPE_ORDER.get(right.Jenis) ?? 999)
    );
  })) {
    summaryRows.push([
      item.Kelas,
      item.Mapel,
      item.Jenis,
      item.sets.size,
      item.questions,
      item.meetings.size ? formatMeetingSet(item.meetings) : "",
    ]);
  }

  const sheet = XLSX.utils.aoa_to_sheet(summaryRows);
  sheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
  ];
  sheet["!cols"] = [
    { wch: 24 },
    { wch: 24 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 18 },
  ];
  sheet["!freeze"] = { xSplit: 0, ySplit: 5 };
  XLSX.utils.book_append_sheet(workbook, sheet, "Ringkasan");
}

function aggregate(rows, keys) {
  const grouped = new Map();

  for (const row of rows) {
    const key = keys.map((item) => row[item] ?? "").join("||");

    if (!grouped.has(key)) {
      grouped.set(key, {
        questions: 0,
        sets: new Set(),
        meetings: new Set(),
        ...Object.fromEntries(keys.map((item) => [item, row[item] ?? ""])),
      });
    }

    const item = grouped.get(key);
    item.questions += 1;

    if (row["Question Set ID"]) {
      item.sets.add(row["Question Set ID"]);
    }

    if (row["Pertemuan/Tahap"]) {
      item.meetings.add(row["Pertemuan/Tahap"]);
    }
  }

  return grouped;
}

async function buildWorkbook() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const latihanIndex = loadLatihanIndex();
  const allFiles = await walkFiles(SOURCE_ROOT);
  const sourceFiles = allFiles
    .filter((filePath) => filePath.toLowerCase().endsWith(".xlsx"))
    .map((filePath) => ({ filePath, relPath: relativeSourcePath(filePath) }))
    .filter(({ relPath }) => isSourceWorkbook(relPath))
    .sort((left, right) => compareText(left.relPath, right.relPath));

  const detailRows = [];
  const fileRows = [];

  for (const { filePath, relPath } of sourceFiles) {
    const workbook = XLSX.readFile(filePath, {
      cellDates: true,
    });
    const metadata = readMetadata(workbook);
    const meta = metadataFromPath(relPath, metadata, latihanIndex.get(relPath));
    const questionRows = readQuestionsFromWorkbook(workbook);
    const stat = await fs.stat(filePath);
    const note = validationNote(meta, questionRows);

    fileRows.push({
      No: fileRows.length + 1,
      Jenis: meta.assessmentType,
      Segmen: meta.segment,
      Jenjang: meta.level,
      Kelas: meta.className,
      Fase: meta.phase,
      Mapel: meta.subject,
      "Pertemuan/Tahap": meta.meetingLabel,
      "Question Set ID": meta.questionSetId,
      "Jumlah Soal Metadata": meta.questionCount || "",
      "Jumlah Soal Dibaca": questionRows.length,
      "Durasi Menit": meta.suggestedDurationMinutes || "",
      "Status Review": meta.reviewStatus,
      "Generated At": meta.generatedAt,
      "Last Modified": stat.mtime,
      Validasi: note,
      "Sumber File": relPath,
    });

    questionRows.forEach((row, index) => {
      detailRows.push(normalizeQuestionRow(row, meta, relPath, index));
    });
  }

  detailRows.sort(detailSort);
  fileRows.sort(fileSort);
  fileRows.forEach((row, index) => {
    row.No = index + 1;
  });

  const workbook = XLSX.utils.book_new();
  addSummarySheet(workbook, detailRows, fileRows);
  addWorksheet(workbook, "Daftar File", fileRows, FILE_HEADERS);

  const groupedByClass = new Map();
  for (const row of detailRows) {
    if (!groupedByClass.has(row.Kelas)) {
      groupedByClass.set(row.Kelas, []);
    }

    groupedByClass.get(row.Kelas).push(row);
  }

  const classNames = [...groupedByClass.keys()].sort((left, right) => {
    return (CLASS_ORDER.get(left) ?? 999) - (CLASS_ORDER.get(right) ?? 999);
  });

  for (const className of classNames) {
    addWorksheet(workbook, className, groupedByClass.get(className), DETAIL_HEADERS);
  }

  XLSX.writeFile(workbook, OUTPUT_PATH, {
    bookType: "xlsx",
    compression: true,
  });

  return {
    outputPath: OUTPUT_PATH,
    sourceFileCount: sourceFiles.length,
    totalQuestionCount: detailRows.length,
    sheetNames: workbook.SheetNames,
    invalidFiles: fileRows.filter((row) => row.Validasi !== "OK"),
  };
}

const result = await buildWorkbook();
console.log(JSON.stringify(result, null, 2));
