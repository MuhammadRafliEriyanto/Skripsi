import * as XLSX from "xlsx";

export type ParsedScheduleImportRow = {
  rowNumber: number;
  dayRaw: string;
  timeRaw: string;
  classNameRaw: string;
  subjectRaw: string;
  teacherRaw: string;
  roomRaw: string;
  statusRaw: string;
};

const scheduleImportHeaderAliases = {
  day: ["hari", "day"],
  time: ["jam", "time"],
  className: ["kelas", "classname", "class", "namakelas"],
  subject: ["mapel", "subject", "matapelajaran"],
  teacher: ["guru", "teacher", "pengajar"],
  room: ["ruangan", "room"],
  status: ["status", "state"],
} as const;

function normalizeCell(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeHeader(value: string) {
  return normalizeCell(value).toLowerCase().replace(/[\s_.-]+/g, "");
}

function hasHeader(headers: Set<string>, aliases: readonly string[]) {
  return aliases.some((alias) => headers.has(alias));
}

function getCellValue(
  row: string[],
  headerIndexes: Map<string, number>,
  aliases: readonly string[],
) {
  const matchedAlias = aliases.find((alias) => headerIndexes.has(alias));

  if (!matchedAlias) {
    return "";
  }

  return normalizeCell(row[headerIndexes.get(matchedAlias) ?? -1] ?? "");
}

function findHeaderRowIndex(rows: string[][]) {
  for (let index = 0; index < rows.length; index += 1) {
    const normalizedHeaders = new Set(
      rows[index].map((cell) => normalizeHeader(cell)).filter(Boolean),
    );

    if (
      hasHeader(normalizedHeaders, scheduleImportHeaderAliases.day) &&
      hasHeader(normalizedHeaders, scheduleImportHeaderAliases.time) &&
      hasHeader(normalizedHeaders, scheduleImportHeaderAliases.className) &&
      hasHeader(normalizedHeaders, scheduleImportHeaderAliases.subject) &&
      hasHeader(normalizedHeaders, scheduleImportHeaderAliases.teacher) &&
      hasHeader(normalizedHeaders, scheduleImportHeaderAliases.room)
    ) {
      return index;
    }
  }

  return -1;
}

export function parseScheduleImportWorkbook(buffer: Buffer) {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    raw: false,
    dense: false,
  });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error("Sheet import jadwal tidak ditemukan.");
  }

  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    throw new Error("Worksheet import jadwal tidak dapat dibaca.");
  }

  const sheetRows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  }) as unknown[][];
  const rows = sheetRows.map((row) =>
    Array.isArray(row) ? row.map((cell) => normalizeCell(cell)) : [],
  );
  const headerRowIndex = findHeaderRowIndex(rows);

  if (headerRowIndex < 0) {
    throw new Error(
      "Header import jadwal tidak ditemukan. Pastikan ada kolom hari, jam, kelas, mapel, guru, dan ruangan.",
    );
  }

  const headerIndexes = new Map<string, number>();

  rows[headerRowIndex].forEach((header, index) => {
    const normalizedHeader = normalizeHeader(header);

    if (normalizedHeader) {
      headerIndexes.set(normalizedHeader, index);
    }
  });

  const dataRows: ParsedScheduleImportRow[] = [];

  for (let index = headerRowIndex + 1; index < rows.length; index += 1) {
    const row = rows[index];
    const dayRaw = getCellValue(row, headerIndexes, scheduleImportHeaderAliases.day);
    const timeRaw = getCellValue(row, headerIndexes, scheduleImportHeaderAliases.time);
    const classNameRaw = getCellValue(
      row,
      headerIndexes,
      scheduleImportHeaderAliases.className,
    );
    const subjectRaw = getCellValue(
      row,
      headerIndexes,
      scheduleImportHeaderAliases.subject,
    );
    const teacherRaw = getCellValue(
      row,
      headerIndexes,
      scheduleImportHeaderAliases.teacher,
    );
    const roomRaw = getCellValue(row, headerIndexes, scheduleImportHeaderAliases.room);
    const statusRaw = getCellValue(
      row,
      headerIndexes,
      scheduleImportHeaderAliases.status,
    );

    if (
      ![
        dayRaw,
        timeRaw,
        classNameRaw,
        subjectRaw,
        teacherRaw,
        roomRaw,
        statusRaw,
      ].some(Boolean)
    ) {
      continue;
    }

    dataRows.push({
      rowNumber: index + 1,
      dayRaw,
      timeRaw,
      classNameRaw,
      subjectRaw,
      teacherRaw,
      roomRaw,
      statusRaw,
    });
  }

  return {
    sheetName,
    rows: dataRows,
  };
}
