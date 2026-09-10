import { HydratedDocument, Model, Schema, model, models } from "mongoose";

export const QUESTION_BANK_ITEM_STATUSES = ["draft", "review", "approved", "rejected", "archived"] as const;
export const QUESTION_BANK_ITEM_DIFFICULTIES = ["Mudah", "Sedang", "Sulit"] as const;
export const QUESTION_BANK_ITEM_ANSWERS = ["A", "B", "C", "D"] as const;

export type QuestionBankItemStatus = (typeof QUESTION_BANK_ITEM_STATUSES)[number];
export type QuestionBankItemDifficulty = (typeof QUESTION_BANK_ITEM_DIFFICULTIES)[number];
export type QuestionBankItemAnswer = (typeof QUESTION_BANK_ITEM_ANSWERS)[number];

export interface IQuestionBankItem {
  questionId: string;
  program: string;
  className: string;
  subject: string;
  topic: string;
  indicator: string;
  cognitiveLevel: string;
  questionText: string;
  options: { A: string; B: string; C: string; D: string };
  imageUrl?: string;
  imagePublicId?: string;
  correctAnswer: QuestionBankItemAnswer;
  explanation: string;
  difficulty: QuestionBankItemDifficulty;
  status: QuestionBankItemStatus;
  createdBy?: string;
  createdByName?: string;
  bankScope?: "global" | "teacher";
  reviewedBy?: string;
  reviewedAt?: Date;
  fingerprint?: string;
  explanationSource?: "manual" | "ai";
  source?: {
    kind: "manual" | "excel" | "pdf";
    fileName?: string;
    rowNumber?: number;
    pageNumber?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export type QuestionBankItemDocument = HydratedDocument<IQuestionBankItem>;

const questionBankItemSchema = new Schema<IQuestionBankItem>(
  {
    questionId: { type: String, required: true, unique: true, trim: true },
    program: { type: String, required: true, trim: true, index: true },
    className: { type: String, required: true, trim: true, index: true },
    subject: { type: String, required: true, trim: true, index: true },
    topic: { type: String, required: true, trim: true, index: true },
    indicator: { type: String, default: "", trim: true },
    cognitiveLevel: { type: String, default: "", trim: true },
    questionText: { type: String, required: true, trim: true },
    options: {
      A: { type: String, required: true, trim: true },
      B: { type: String, required: true, trim: true },
      C: { type: String, required: true, trim: true },
      D: { type: String, required: true, trim: true },
    },
    imageUrl: { type: String, default: "", trim: true },
    imagePublicId: { type: String, default: "", trim: true },
    correctAnswer: { type: String, enum: QUESTION_BANK_ITEM_ANSWERS, required: true },
    explanation: { type: String, required: true, trim: true },
    difficulty: { type: String, enum: QUESTION_BANK_ITEM_DIFFICULTIES, required: true },
    status: { type: String, enum: QUESTION_BANK_ITEM_STATUSES, default: "draft", index: true },
    createdBy: { type: String, default: "", trim: true },
    createdByName: { type: String, default: "", trim: true },
    bankScope: { type: String, enum: ["global", "teacher"], default: "teacher", index: true },
    reviewedBy: { type: String, default: "", trim: true },
    reviewedAt: { type: Date },
    fingerprint: { type: String, default: "", trim: true, index: true },
    explanationSource: { type: String, enum: ["manual", "ai"], default: "manual" },
    source: {
      kind: { type: String, enum: ["manual", "excel", "pdf"], default: "manual" },
      fileName: { type: String, default: "", trim: true },
      rowNumber: { type: Number },
      pageNumber: { type: Number },
    },
  },
  { timestamps: true, collection: "questionbank_items" },
);

questionBankItemSchema.index({ program: 1, className: 1, subject: 1, topic: 1, status: 1 });

export const QuestionBankItem: Model<IQuestionBankItem> =
  (models.QuestionBankItem as Model<IQuestionBankItem> | undefined) ??
  model<IQuestionBankItem>("QuestionBankItem", questionBankItemSchema);
