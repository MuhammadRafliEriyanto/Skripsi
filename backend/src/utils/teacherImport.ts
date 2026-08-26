import * as XLSX from "xlsx";

import type { TeacherAvailability, TeacherStatus } from "../models/Teacher";

const teacherImportHeaderAliases = {
  name: ["nama", "namaguru", "guru", "name"],
  subject: ["bidang", "mapel", "subject", "matapelajaran"],
  education: ["pendidikanterakhir", "pendidikan", "education", "lasteducation"],
  email: ["email"],
  phone: ["nohp", "nomorhp", "phone"],
  branch: ["cabang", "branch"],
  schedule: ["jadwal", "schedule"],
  status: ["status"],
  availability: ["ketersediaan", "availability", "availibility"],
} as const;

export type ParsedTeacherImportRow = {
  rowNumber: number;
  name: string;
  subjectRaw: string;
  educationRaw: string;
  emailRaw: string;
  phoneRaw: string;
  branchRaw: string;
  scheduleRaw: string;
  statusRaw: string;
  availabilityRaw: string;
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

    if (hasHeader(normalizedHeaders, teacherImportHeaderAliases.name)) {
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

export function parseTeacherImportWorkbook(buffer: Buffer): {
  sheetName: string;
  rows: ParsedTeacherImportRow[];
} {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    raw: false,
    dense: false,
  });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error("Sheet Excel guru tidak ditemukan.");
  }

  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    throw new Error("Worksheet Excel guru tidak dapat dibaca.");
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
    throw new Error("Header Excel guru tidak ditemukan. Pastikan ada kolom nama.");
  }

  const headerIndexes = new Map<string, number>();

  rows[headerRowIndex].forEach((header, index) => {
    const normalizedHeader = normalizeHeader(header);

    if (normalizedHeader) {
      headerIndexes.set(normalizedHeader, index);
    }
  });

  const dataRows: ParsedTeacherImportRow[] = [];

  for (let index = headerRowIndex + 1; index < rows.length; index += 1) {
    const row = rows[index];
    const name = getCellValue(row, headerIndexes, teacherImportHeaderAliases.name);
    const subjectRaw = getCellValue(
      row,
      headerIndexes,
      teacherImportHeaderAliases.subject,
    );
    const educationRaw = getCellValue(
      row,
      headerIndexes,
      teacherImportHeaderAliases.education,
    );
    const emailRaw = getCellValue(
      row,
      headerIndexes,
      teacherImportHeaderAliases.email,
    );
    const phoneRaw = getCellValue(
      row,
      headerIndexes,
      teacherImportHeaderAliases.phone,
    );
    const branchRaw = getCellValue(
      row,
      headerIndexes,
      teacherImportHeaderAliases.branch,
    );
    const scheduleRaw = getCellValue(
      row,
      headerIndexes,
      teacherImportHeaderAliases.schedule,
    );
    const statusRaw = getCellValue(
      row,
      headerIndexes,
      teacherImportHeaderAliases.status,
    );
    const availabilityRaw = getCellValue(
      row,
      headerIndexes,
      teacherImportHeaderAliases.availability,
    );

    if (
      ![
        name,
        subjectRaw,
        educationRaw,
        emailRaw,
        phoneRaw,
        branchRaw,
        scheduleRaw,
        statusRaw,
        availabilityRaw,
      ].some(Boolean)
    ) {
      continue;
    }

    dataRows.push({
      rowNumber: index + 1,
      name,
      subjectRaw,
      educationRaw,
      emailRaw,
      phoneRaw,
      branchRaw,
      scheduleRaw,
      statusRaw,
      availabilityRaw,
    });
  }

  return {
    sheetName,
    rows: dataRows,
  };
}

export function normalizeImportedTeacherSubject(value: string): string {
  return normalizeCell(value) || "-";
}

export function normalizeImportedTeacherEducation(value: string): string {
  return normalizeCell(value);
}

export function normalizeImportedTeacherClassList(education: string): string {
  return education ? `Pendidikan terakhir: ${education}` : "-";
}

export function normalizeImportedTeacherPhone(value: string): string {
  const normalizedValue = normalizeCell(value).replace(/\s+/g, "");

  return normalizedValue || "-";
}

export function normalizeImportedTeacherBranch(value: string): string {
  return normalizeCell(value);
}

export function normalizeImportedTeacherSchedule(value: string): string {
  return normalizeCell(value) || "-";
}

export function normalizeImportedTeacherStatus(value: string): TeacherStatus {
  return normalizeCell(value).toLowerCase() === "nonaktif" ? "Nonaktif" : "Aktif";
}

export function normalizeImportedTeacherAvailability(
  value: string,
): TeacherAvailability {
  const normalizedValue = normalizeCell(value).toLowerCase();

  if (normalizedValue === "padat") {
    return "Padat";
  }

  if (normalizedValue === "cuti") {
    return "Cuti";
  }

  return "Tersedia";
}

export function buildImportedTeacherDuplicateKey(input: {
  name: string;
  subject?: string;
  education?: string;
  branch?: string;
}): string | null {
  const normalizedName = normalizeCell(input.name).toLowerCase();
  const normalizedSubject = normalizeCell(input.subject).toLowerCase();
  const normalizedEducation = normalizeCell(input.education).toLowerCase();

  if (!normalizedName) {
    return null;
  }

  if (!normalizedSubject && !normalizedEducation) {
    return null;
  }

  return [
    normalizedName,
    normalizedSubject,
    normalizedEducation,
    normalizeCell(input.branch).toLowerCase(),
  ].join("::");
}

export function buildImportedTeacherEmail(teacherId: string): string {
  const digits = teacherId.replace(/\D/g, "");
  const suffix = (digits || "0").padStart(3, "0");

  return `guru${suffix}@bimbel.local`;
}
