import { HydratedDocument, Model, Schema, model, models } from "mongoose";

export const QUESTION_BANK_ANSWERS = ["A", "B", "C", "D"] as const;

export type QuestionBankAnswer = (typeof QUESTION_BANK_ANSWERS)[number];

export interface IQuestionBank {
  questionId: string;
  program: string;
  subject: string;
  topic: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: QuestionBankAnswer;
  explanation: string;
  difficulty: string;
  createdAt: Date;
  updatedAt: Date;
}

export type QuestionBankDocument = HydratedDocument<IQuestionBank>;

const questionBankSchema = new Schema<IQuestionBank>(
  {
    questionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    program: {
      type: String,
      required: [true, "Program (Kelas) wajib diisi."],
      trim: true,
      index: true,
    },
    subject: {
      type: String,
      required: [true, "Mata pelajaran wajib diisi."],
      trim: true,
      index: true,
    },
    topic: {
      type: String,
      required: [true, "Topik materi wajib diisi."],
      trim: true,
      index: true,
    },
    questionText: {
      type: String,
      required: [true, "Pertanyaan wajib diisi."],
      trim: true,
    },
    optionA: {
      type: String,
      required: [true, "Opsi A wajib diisi."],
      trim: true,
    },
    optionB: {
      type: String,
      required: [true, "Opsi B wajib diisi."],
      trim: true,
    },
    optionC: {
      type: String,
      required: [true, "Opsi C wajib diisi."],
      trim: true,
    },
    optionD: {
      type: String,
      required: [true, "Opsi D wajib diisi."],
      trim: true,
    },
    correctAnswer: {
      type: String,
      enum: QUESTION_BANK_ANSWERS,
      required: [true, "Jawaban benar wajib diisi."],
    },
    explanation: {
      type: String,
      default: "",
      trim: true,
    },
    difficulty: {
      type: String,
      default: "Sedang",
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

questionBankSchema.index({
  program: 1,
  subject: 1,
  topic: 1,
});

export const QuestionBank: Model<IQuestionBank> =
  (models.QuestionBank as Model<IQuestionBank> | undefined) ??
  model<IQuestionBank>("QuestionBank", questionBankSchema);
