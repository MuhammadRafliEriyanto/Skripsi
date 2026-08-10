import { HydratedDocument, Model, Schema, model, models, type Types } from "mongoose";

export const TASK_SUBMISSION_MODES = [
  "file",
  "text",
  "drive",
  "cbt",
] as const;

export type TaskSubmissionMode = (typeof TASK_SUBMISSION_MODES)[number];

export interface ITaskSubmissionAttachment {
  fileName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  originalName: string;
}

export interface ITaskSubmission {
  submissionId: string;
  teacherId: Types.ObjectId;
  classId: string;
  taskId: string;
  studentId: string;
  subscriptionId: Types.ObjectId | null;
  submissionMode: TaskSubmissionMode;
  answerText: string;
  driveUrl: string;
  attachment: ITaskSubmissionAttachment | null;
  note: string;
  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type TaskSubmissionDocument = HydratedDocument<ITaskSubmission>;

const taskSubmissionSchema = new Schema<ITaskSubmission>(
  {
    submissionId: {
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
    classId: {
      type: String,
      required: [true, "Class ID wajib diisi."],
      trim: true,
      index: true,
    },
    taskId: {
      type: String,
      required: [true, "Task ID wajib diisi."],
      trim: true,
      index: true,
    },
    studentId: {
      type: String,
      required: [true, "Student ID wajib diisi."],
      trim: true,
      index: true,
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: "Subscription",
      default: null,
    },
    submissionMode: {
      type: String,
      enum: TASK_SUBMISSION_MODES,
      required: [true, "Mode pengumpulan wajib diisi."],
      index: true,
    },
    answerText: {
      type: String,
      default: "",
      trim: true,
    },
    driveUrl: {
      type: String,
      default: "",
      trim: true,
    },
    attachment: {
      type: {
        fileName: {
          type: String,
          required: true,
          trim: true,
        },
        mimeType: {
          type: String,
          required: true,
          trim: true,
        },
        size: {
          type: Number,
          required: true,
          min: 0,
        },
        storagePath: {
          type: String,
          required: true,
          trim: true,
        },
        originalName: {
          type: String,
          required: true,
          trim: true,
        },
      },
      default: null,
    },
    note: {
      type: String,
      default: "",
      trim: true,
    },
    submittedAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
  },
  {
    timestamps: true,
  },
);

taskSubmissionSchema.index({
  teacherId: 1,
  classId: 1,
  taskId: 1,
  studentId: 1,
});
taskSubmissionSchema.index(
  {
    taskId: 1,
    studentId: 1,
  },
  {
    unique: true,
  },
);

export const TaskSubmission: Model<ITaskSubmission> =
  (models.TaskSubmission as Model<ITaskSubmission> | undefined) ??
  model<ITaskSubmission>("TaskSubmission", taskSubmissionSchema);
