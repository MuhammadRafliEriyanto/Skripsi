import { HydratedDocument, Model, Schema, model, models, type Types } from "mongoose";

export const STUDENT_TASK_ATTEMPT_STATUSES = [
  "in_progress",
  "submitted",
] as const;
export const STUDENT_TASK_SELECTED_ANSWERS = ["A", "B", "C", "D", ""] as const;

export type StudentTaskAttemptStatus =
  (typeof STUDENT_TASK_ATTEMPT_STATUSES)[number];
export type StudentTaskSelectedAnswer =
  (typeof STUDENT_TASK_SELECTED_ANSWERS)[number];

export interface IStudentTaskAttemptAnswer {
  questionId: string;
  selectedAnswer: StudentTaskSelectedAnswer;
  isCorrect: boolean | null;
}

export interface IStudentTaskAttemptHistory {
  remedialNumber: number;
  reason: string;
  answers: IStudentTaskAttemptAnswer[];
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  score: number;
  timeUsedSeconds: number;
  startedAt: Date;
  submittedAt: Date | null;
  archivedAt: Date;
}

export interface IStudentTaskAttempt {
  attemptId: string;
  taskId: string;
  teacherId: Types.ObjectId;
  classId: string;
  branch: string;
  studentId: string;
  subscriptionId: Types.ObjectId | null;
  answers: IStudentTaskAttemptAnswer[];
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  score: number;
  timeUsedSeconds: number;
  remedialCount: number;
  remedialReason: string;
  history: IStudentTaskAttemptHistory[];
  startedAt: Date;
  submittedAt: Date | null;
  status: StudentTaskAttemptStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type StudentTaskAttemptDocument =
  HydratedDocument<IStudentTaskAttempt>;

const studentTaskAttemptAnswerSchema =
  new Schema<IStudentTaskAttemptAnswer>(
    {
      questionId: {
        type: String,
        required: true,
        trim: true,
      },
      selectedAnswer: {
        type: String,
        enum: STUDENT_TASK_SELECTED_ANSWERS,
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

const studentTaskAttemptHistorySchema =
  new Schema<IStudentTaskAttemptHistory>(
    {
      remedialNumber: {
        type: Number,
        required: true,
        min: 1,
      },
      reason: {
        type: String,
        default: "",
        trim: true,
      },
      answers: {
        type: [studentTaskAttemptAnswerSchema],
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
        required: true,
      },
      submittedAt: {
        type: Date,
        default: null,
      },
      archivedAt: {
        type: Date,
        default: () => new Date(),
      },
    },
    {
      _id: false,
    },
  );

const studentTaskAttemptSchema = new Schema<IStudentTaskAttempt>(
  {
    attemptId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    taskId: {
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
    answers: {
      type: [studentTaskAttemptAnswerSchema],
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
    remedialCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    remedialReason: {
      type: String,
      default: "",
      trim: true,
    },
    history: {
      type: [studentTaskAttemptHistorySchema],
      default: [],
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
      enum: STUDENT_TASK_ATTEMPT_STATUSES,
      default: "in_progress",
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

studentTaskAttemptSchema.index(
  {
    taskId: 1,
    studentId: 1,
  },
  {
    unique: true,
  },
);
studentTaskAttemptSchema.index({
  teacherId: 1,
  classId: 1,
  branch: 1,
});

export const StudentTaskAttempt: Model<IStudentTaskAttempt> =
  (models.StudentTaskAttempt as
    | Model<IStudentTaskAttempt>
    | undefined) ??
  model<IStudentTaskAttempt>(
    "StudentTaskAttempt",
    studentTaskAttemptSchema,
  );
