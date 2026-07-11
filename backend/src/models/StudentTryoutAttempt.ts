import { HydratedDocument, Model, Schema, model, models, type Types } from "mongoose";

export const STUDENT_TRYOUT_ATTEMPT_STATUSES = [
  "in_progress",
  "submitted",
] as const;
export const STUDENT_TRYOUT_SELECTED_ANSWERS = ["A", "B", "C", "D", ""] as const;

export type StudentTryoutAttemptStatus =
  (typeof STUDENT_TRYOUT_ATTEMPT_STATUSES)[number];
export type StudentTryoutSelectedAnswer =
  (typeof STUDENT_TRYOUT_SELECTED_ANSWERS)[number];

export interface IStudentTryoutAttemptAnswer {
  questionId: string;
  selectedAnswer: StudentTryoutSelectedAnswer;
  isCorrect: boolean | null;
}

export interface IStudentTryoutAttempt {
  attemptId: string;
  tryoutId: string;
  teacherId: Types.ObjectId;
  classId: string;
  branch: string;
  studentId: string;
  subscriptionId: Types.ObjectId | null;
  questionSetId: string;
  packageId: string;
  stage: number | null;
  answers: IStudentTryoutAttemptAnswer[];
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  score: number;
  timeUsedSeconds: number;
  startedAt: Date;
  submittedAt: Date | null;
  status: StudentTryoutAttemptStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type StudentTryoutAttemptDocument =
  HydratedDocument<IStudentTryoutAttempt>;

const studentTryoutAttemptAnswerSchema =
  new Schema<IStudentTryoutAttemptAnswer>(
    {
      questionId: {
        type: String,
        required: true,
        trim: true,
      },
      selectedAnswer: {
        type: String,
        enum: STUDENT_TRYOUT_SELECTED_ANSWERS,
        default: "",
      },
      isCorrect: {
        type: Boolean,
        default: null,
      },
    },
    {
      _id: false,
    },
  );

const studentTryoutAttemptSchema = new Schema<IStudentTryoutAttempt>(
  {
    attemptId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    tryoutId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
      index: true,
    },
    classId: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    branch: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    studentId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: "Subscription",
      default: null,
    },
    questionSetId: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    packageId: {
      type: String,
      default: "",
      trim: true,
    },
    stage: {
      type: Number,
      default: null,
      min: 1,
      max: 3,
      index: true,
    },
    answers: {
      type: [studentTryoutAttemptAnswerSchema],
      default: [],
    },
    correctCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    wrongCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    unansweredCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    score: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    timeUsedSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    startedAt: {
      type: Date,
      default: () => new Date(),
    },
    submittedAt: {
      type: Date,
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: STUDENT_TRYOUT_ATTEMPT_STATUSES,
      default: "in_progress",
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

studentTryoutAttemptSchema.index(
  {
    tryoutId: 1,
    studentId: 1,
  },
  {
    unique: true,
  },
);
studentTryoutAttemptSchema.index({
  teacherId: 1,
  classId: 1,
  branch: 1,
  stage: 1,
});

export const StudentTryoutAttempt: Model<IStudentTryoutAttempt> =
  (models.StudentTryoutAttempt as
    | Model<IStudentTryoutAttempt>
    | undefined) ??
  model<IStudentTryoutAttempt>(
    "StudentTryoutAttempt",
    studentTryoutAttemptSchema,
  );
