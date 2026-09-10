import * as XLSX from "xlsx";

import type { ImportPreviewItem } from "./importTypes";
import {
  normalizeQuestionDraft,
  questionFingerprint,
  type QuestionDraftDefaults,
} from "./questionDraft";

export const TEMPLATE_HEADERS = [
  "program", "className", "subject", "topic", "questionText",
  "optionA", "optionB", "optionC", "optionD", "correctAnswer",
  "explanation", "difficulty", "imageUrl",
] as const;

const ALIASES: Record<(typeof TEMPLATE_HEADERS)[number], string[]> = {
  program: ["program", "jenjang"],
  className: ["className", "kelas"],
  subject: ["subject", "mapel", "mata pelajaran"],
  topic: ["topic", "topik"],
  questionText: ["questionText", "question", "soal", "pertanyaan"],
  optionA: ["optionA", "A", "opsi A"],
  optionB: ["optionB", "B", "opsi B"],
  optionC: ["optionC", "C", "opsi C"],
  optionD: ["optionD", "D", "opsi D"],
  correctAnswer: ["correctAnswer", "kunci", "jawaban"],
  explanation: ["explanation", "pembahasan"],
  difficulty: ["difficulty", "kesulitan"],
  imageUrl: ["imageUrl", "gambar", "url gambar"],
};

function clean(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function readAlias(row: Record<string, unknown>, aliases: string[]): string {
  for (const alias of aliases) {
    const key = Object.keys(row).find((candidate) => candidate.trim().toLowerCase() === alias.toLowerCase());
    const value = key ? clean(row[key]) : "";
    if (value) return value;
  }
  return "";
}

function schoolProgram(value: string): "SD" | "SMP" | "SMA" | "" {
  const match = value.toUpperCase().match(/\b(SD|SMP|SMA)\b/);
  return match?.[1] as "SD" | "SMP" | "SMA" | "";
}

function gradeNumber(value: string): number | null {
  const match = value.match(/\b(1[0-2]|[1-9])\b/);
  return match ? Number(match[1]) : null;
}

function programFromGrade(grade: number | null): "SD" | "SMP" | "SMA" | "" {
  if (grade && grade <= 6) return "SD";
  if (grade && grade <= 9) return "SMP";
  if (grade && grade <= 12) return "SMA";
  return "";
}

function normalizeSchoolLevel(
  rawProgram: string,
  rawClassName: string,
  defaults: QuestionDraftDefaults,
): { program: string; className: string } {
  const explicitProgram = schoolProgram(rawProgram);
  const grade = gradeNumber(rawClassName);
  const program = programFromGrade(grade) || explicitProgram || clean(defaults.program);
  const explicitClassProgram = schoolProgram(rawClassName);
  const className = grade
    ? `${programFromGrade(grade) || explicitClassProgram || program} ${grade}`
    : rawClassName || clean(defaults.className);
  return { program, className };
}

function canonicalRow(row: Record<string, unknown>, defaults: QuestionDraftDefaults): Record<string, unknown> {
  const values = Object.fromEntries(
    TEMPLATE_HEADERS.map((header) => [header, readAlias(row, ALIASES[header])]),
  );
  const schoolLevel = normalizeSchoolLevel(clean(values.program), clean(values.className), defaults);
  return {
    program: schoolLevel.program,
    className: schoolLevel.className,
    subject: values.subject || defaults.subject,
    topic: values.topic || defaults.topic || "Umum",
    questionText: values.questionText,
    options: { A: values.optionA, B: values.optionB, C: values.optionC, D: values.optionD },
    correctAnswer: values.correctAnswer,
    explanation: values.explanation,
    difficulty: values.difficulty || defaults.difficulty || "Sedang",
    imageUrl: values.imageUrl,
  };
}

export function parseQuestionWorkbook(
  buffer: Buffer,
  defaults: QuestionDraftDefaults,
  options: { maxRows?: number } = {},
): ImportPreviewItem[] {
  const maxRows = options.maxRows ?? 5_000;
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error("Workbook tidak memiliki sheet.");
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheetName], { defval: "" });
  if (rows.length > maxRows) throw new Error(`Workbook maksimal ${maxRows} baris.`);

  const fingerprints = new Set<string>();
  return rows.map((row, index) => {
    const canonical = canonicalRow(row, defaults);
    const result = normalizeQuestionDraft(canonical, { requireExplanation: true });
    const warnings = clean(canonical.explanation) ? [] : ["Pembahasan belum tersedia."];
    const fingerprint = result.ok ? questionFingerprint(result.value) : "";
    const duplicate = fingerprint && fingerprints.has(fingerprint) ? "file" : "none";
    if (fingerprint) fingerprints.add(fingerprint);
    return {
      rowNumber: index + 2,
      selected: result.ok && duplicate === "none",
      draft: result.ok ? result.value : canonical,
      fingerprint,
      errors: result.ok ? [] : result.errors,
      warnings,
      duplicate,
    } as ImportPreviewItem;
  });
}

export function createQuestionBankTemplate(): Buffer {
  const sheet = XLSX.utils.aoa_to_sheet([[...TEMPLATE_HEADERS]]);
  sheet["!cols"] = TEMPLATE_HEADERS.map((header) => ({ wch: header === "questionText" || header === "explanation" ? 40 : 18 }));
  return XLSX.write(
    { SheetNames: ["Bank Soal"], Sheets: { "Bank Soal": sheet } },
    { type: "buffer", bookType: "xlsx" },
  );
}
