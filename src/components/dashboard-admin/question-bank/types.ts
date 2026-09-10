export type QuestionOptions = { A: string; B: string; C: string; D: string };

export type QuestionDraft = {
  program: string;
  className: string;
  subject: string;
  topic: string;
  questionText: string;
  options: QuestionOptions;
  correctAnswer: string;
  explanation: string;
  difficulty: string;
  imageUrl?: string;
  imageDataUri?: string;
};

export type QuestionItem = QuestionDraft & {
  _id: string;
  questionId: string;
  status: string;
  createdByName?: string;
};

export type ImportPreviewItem = {
  rowNumber: number;
  pageNumber?: number;
  selected: boolean;
  draft: QuestionDraft;
  fingerprint: string;
  errors: Array<{ field: string; message: string }>;
  warnings: string[];
  duplicate: "none" | "file" | "database";
  imageDataUri?: string;
};

export const EMPTY_QUESTION: QuestionDraft = {
  program: "SMP",
  className: "SMP 8",
  subject: "",
  topic: "Umum",
  questionText: "",
  options: { A: "", B: "", C: "", D: "" },
  correctAnswer: "A",
  explanation: "",
  difficulty: "Sedang",
};
