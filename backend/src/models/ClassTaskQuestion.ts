import { HydratedDocument, Model, Schema, model, models, type Types } from "mongoose";

export const CLASS_TASK_QUESTION_ANSWERS = ["A", "B", "C", "D"] as const;

export type ClassTaskQuestionAnswer =
  (typeof CLASS_TASK_QUESTION_ANSWERS)[number];

export interface IClassTaskQuestion {
  questionId: string;
  teacherId: Types.ObjectId;
  taskId: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: ClassTaskQuestionAnswer;
  explanation: string;
  topic: string;
  difficulty: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export type ClassTaskQuestionDocument =
  HydratedDocument<IClassTaskQuestion>;

const classTaskQuestionSchema = new Schema<IClassTaskQuestion>(
  {
    questionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
      required: [true, "Guru wajib diisi."],
      index: true,
    },
    taskId: {
      type: String,
      required: [true, "Task ID wajib diisi."],
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
      enum: CLASS_TASK_QUESTION_ANSWERS,
      required: [true, "Jawaban benar wajib diisi."],
    },
    explanation: {
      type: String,
      default: "",
      trim: true,
    },
    topic: {
      type: String,
      default: "",
      trim: true,
    },
    difficulty: {
      type: String,
      default: "Sedang",
      trim: true,
    },
    order: {
      type: Number,
      required: [true, "Urutan soal wajib diisi."],
      min: 1,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

classTaskQuestionSchema.index({
  teacherId: 1,
  taskId: 1,
  order: 1,
});

export const ClassTaskQuestion: Model<IClassTaskQuestion> =
  (models.ClassTaskQuestion as
    | Model<IClassTaskQuestion>
    | undefined) ??
  model<IClassTaskQuestion>(
    "ClassTaskQuestion",
    classTaskQuestionSchema,
  );
