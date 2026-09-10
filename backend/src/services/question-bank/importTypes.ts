import type { QuestionDraft, QuestionDraftError } from "./questionDraft";

export type QuestionImportSource = "excel" | "pdf";
export type QuestionDuplicateState = "none" | "file" | "database";

export type ImportPreviewItem = {
  rowNumber: number;
  pageNumber?: number;
  selected: boolean;
  draft: Partial<QuestionDraft>;
  fingerprint: string;
  errors: QuestionDraftError[];
  warnings: string[];
  duplicate: QuestionDuplicateState;
  imageDataUri?: string;
};

export type ImportPreviewResponse = {
  source: QuestionImportSource;
  fileName: string;
  items: ImportPreviewItem[];
  summary: { total: number; valid: number; invalid: number; duplicates: number };
};
