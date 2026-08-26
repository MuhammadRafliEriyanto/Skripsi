import * as XLSX from "xlsx";

import { normalizeCanonicalClassName } from "./studentClass";

const studentImportHeaderAliases = {
  name: ["nama", "name"],
  className: ["kelas", "class", "classname"],
  program: ["asalsekolah", "sekolah", "program"],
  branch: ["cabang", "branch"],
} as const;

export type ParsedStudentImportRow = {
  rowNumber: number;
  name: string;
  classNameRaw: string;
  programRaw: string;
  branchRaw: string;
};

function normalizeCell(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeHeader(value: string): string {
  return normalizeCell(value).toLowerCase().replace(/[\s_.-]+/g, "");
}

function hasHeader(headers: Set<string>, aliases: readonly string[]): boolean {
  return aliases.some((alias) => headers.has(alias));
}

function findHeaderRowIndex(rows: string[][]): number {
  for (let index = 0; index < rows.length; index += 1) {
    const normalizedHeaders = new Set(
      rows[index].map((cell) => normalizeHeader(cell)).filter(Boolean),
    );

    if (
      hasHeader(normalizedHeaders, studentImportHeaderAliases.name) &&
      hasHeader(normalizedHeaders, studentImportHeaderAliases.className) &&
      hasHeader(normalizedHeaders, studentImportHeaderAliases.program)
    ) {
      return index;
    }
  }

  return -1;
}

function getCellValue(
  row: string[],
  headerIndexes: Map<string, number>,
  aliases: readonly string[],
): string {
  const matchedAlias = aliases.find((alias) => headerIndexes.has(alias));

  if (!matchedAlias) {
    return "";
  }

  return normalizeCell(row[headerIndexes.get(matchedAlias) ?? -1] ?? "");
}

export function parseStudentImportWorkbook(buffer: Buffer): {
  sheetName: string;
  rows: ParsedStudentImportRow[];
} {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    raw: false,
    dense: false,
  });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error("Sheet Excel siswa tidak ditemukan.");
  }

  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    throw new Error("Worksheet Excel siswa tidak dapat dibaca.");
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
      "Header Excel tidak ditemukan. Pastikan ada kolom nama, kelas, dan asal sekolah.",
    );
  }

  const headerIndexes = new Map<string, number>();

  rows[headerRowIndex].forEach((header, index) => {
    const normalizedHeader = normalizeHeader(header);

    if (normalizedHeader) {
      headerIndexes.set(normalizedHeader, index);
    }
  });

  const dataRows: ParsedStudentImportRow[] = [];

  for (let index = headerRowIndex + 1; index < rows.length; index += 1) {
    const row = rows[index];
    const name = getCellValue(row, headerIndexes, studentImportHeaderAliases.name);
    const classNameRaw = getCellValue(
      row,
      headerIndexes,
      studentImportHeaderAliases.className,
    );
    const programRaw = getCellValue(
      row,
      headerIndexes,
      studentImportHeaderAliases.program,
    );
    const branchRaw = getCellValue(
      row,
      headerIndexes,
      studentImportHeaderAliases.branch,
    );

    if (![name, classNameRaw, programRaw, branchRaw].some(Boolean)) {
      continue;
    }

    dataRows.push({
      rowNumber: index + 1,
      name,
      classNameRaw,
      programRaw,
      branchRaw,
    });
  }

  return {
    sheetName,
    rows: dataRows,
  };
}

export function normalizeImportedStudentClassName(value: string): string | null {
  return normalizeCanonicalClassName(value);
}

export function normalizeImportedStudentProgram(value: string): string {
  return normalizeCell(value) || "Belum diisi";
}

export function buildImportedStudentDuplicateKey(input: {
  name: string;
  className: string;
  program: string;
}): string {
  return [
    normalizeCell(input.name).toLowerCase(),
    normalizeCell(input.className).toLowerCase(),
    normalizeCell(input.program).toLowerCase(),
  ].join("::");
}

export function buildImportedStudentEmail(studentId: string): string {
  const digits = studentId.replace(/\D/g, "");
  const suffix = (digits || "0").padStart(3, "0");

  return `siswa${suffix}@bimbel.local`;
}
