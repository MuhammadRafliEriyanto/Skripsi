import { createHash } from "node:crypto";

import {
  QUESTION_BANK_ITEM_ANSWERS,
  QUESTION_BANK_ITEM_DIFFICULTIES,
  type QuestionBankItemAnswer,
  type QuestionBankItemDifficulty,
} from "../../models/QuestionBankItem";

const PROGRAMS = ["SD", "SMP", "SMA"] as const;
type QuestionProgram = (typeof PROGRAMS)[number];

export type QuestionDraft = {
  program: QuestionProgram;
  className: string;
  subject: string;
  topic: string;
  indicator: string;
  cognitiveLevel: string;
  questionText: string;
  options: Record<QuestionBankItemAnswer, string>;
  correctAnswer: QuestionBankItemAnswer;
  explanation: string;
  difficulty: QuestionBankItemDifficulty;
  imageUrl?: string;
};

export type QuestionDraftDefaults = Partial<
  Pick<QuestionDraft, "program" | "className" | "subject" | "topic" | "difficulty">
> & {
  requireExplanation?: boolean;
};

export type QuestionDraftError = { field: string; message: string };
export type QuestionDraftResult =
  | { ok: true; value: QuestionDraft }
  | { ok: false; errors: QuestionDraftError[] };

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function first(input: Record<string, unknown>, names: string[]): string {
  for (const name of names) {
    const direct = clean(input[name]);
    if (direct) return direct;
    const key = Object.keys(input).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
    const aliased = key ? clean(input[key]) : "";
    if (aliased) return aliased;
  }
  return "";
}

function readOption(input: Record<string, unknown>, answer: QuestionBankItemAnswer): string {
  const nested = input.options;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const value = clean((nested as Record<string, unknown>)[answer]);
    if (value) return value;
  }
  return first(input, [answer, `option${answer}`, `opsi ${answer}`]);
}

export function normalizeQuestionDraft(
  input: Record<string, unknown>,
  defaults: QuestionDraftDefaults = {},
): QuestionDraftResult {
  const program = (first(input, ["program", "jenjang"]) || clean(defaults.program)).toUpperCase();
  const className = first(input, ["className", "kelas"]) || clean(defaults.className);
  const subject = first(input, ["subject", "mapel", "mata pelajaran"]) || clean(defaults.subject);
  const topic = first(input, ["topic", "topik"]) || clean(defaults.topic) || "Umum";
  const questionText = first(input, ["questionText", "question", "soal", "pertanyaan"]);
  const explanation = first(input, ["explanation", "pembahasan"]);
  const correctAnswer = first(input, ["correctAnswer", "kunci", "jawaban"]).toUpperCase();
  const difficulty = first(input, ["difficulty", "kesulitan"]) || clean(defaults.difficulty) || "Sedang";
  const options = Object.fromEntries(
    QUESTION_BANK_ITEM_ANSWERS.map((answer) => [answer, readOption(input, answer)]),
  ) as Record<QuestionBankItemAnswer, string>;
  const errors: QuestionDraftError[] = [];

  if (!PROGRAMS.includes(program as QuestionProgram)) {
    errors.push({ field: "program", message: "Jenjang harus SD, SMP, atau SMA." });
  }
  if (!className) {
    errors.push({ field: "className", message: "Kelas wajib diisi." });
  } else if (PROGRAMS.includes(program as QuestionProgram) && !className.toUpperCase().startsWith(`${program} `)) {
    errors.push({ field: "className", message: "Kelas tidak sesuai dengan jenjang." });
  }
  if (!subject) errors.push({ field: "subject", message: "Mata pelajaran wajib diisi." });
  if (!questionText) errors.push({ field: "questionText", message: "Pertanyaan wajib diisi." });
  for (const answer of QUESTION_BANK_ITEM_ANSWERS) {
    if (!options[answer]) errors.push({ field: `options.${answer}`, message: `Opsi ${answer} wajib diisi.` });
  }
  if (!QUESTION_BANK_ITEM_ANSWERS.includes(correctAnswer as QuestionBankItemAnswer)) {
    errors.push({ field: "correctAnswer", message: "Kunci jawaban harus A, B, C, atau D." });
  }
  if (!QUESTION_BANK_ITEM_DIFFICULTIES.includes(difficulty as QuestionBankItemDifficulty)) {
    errors.push({ field: "difficulty", message: "Kesulitan harus Mudah, Sedang, atau Sulit." });
  }
  if (defaults.requireExplanation && !explanation) {
    errors.push({ field: "explanation", message: "Pembahasan wajib diisi." });
  }
  const imageUrl = first(input, ["imageUrl", "gambar"]);
  if (imageUrl) {
    try {
      const url = new URL(imageUrl);
      if (url.protocol !== "https:") throw new Error("invalid protocol");
    } catch {
      errors.push({ field: "imageUrl", message: "URL gambar harus berupa HTTPS yang valid." });
    }
  }
  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    value: {
      program: program as QuestionProgram,
      className,
      subject,
      topic,
      indicator: first(input, ["indicator", "indikator"]),
      cognitiveLevel: first(input, ["cognitiveLevel", "level kognitif"]),
      questionText,
      options,
      correctAnswer: correctAnswer as QuestionBankItemAnswer,
      explanation,
      difficulty: difficulty as QuestionBankItemDifficulty,
      ...(imageUrl ? { imageUrl } : {}),
    },
  };
}

function fingerprintPart(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID");
}

export function questionFingerprint(draft: QuestionDraft): string {
  const parts = [
    draft.program,
    draft.className,
    draft.subject,
    draft.questionText,
    ...QUESTION_BANK_ITEM_ANSWERS.map((answer) => draft.options[answer]),
  ];
  return createHash("sha256").update(parts.map(fingerprintPart).join("\u001f")).digest("hex");
}
