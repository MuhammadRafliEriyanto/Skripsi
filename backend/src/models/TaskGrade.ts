import { HydratedDocument, Model, Schema, model, models, type Types } from "mongoose";

export const TASK_GRADE_STATUSES = [
  "Belum Dinilai",
  "Sudah Dinilai",
  "Perlu Remedial",
] as const;

export type TaskGradeStatus = (typeof TASK_GRADE_STATUSES)[number];

export interface ITaskGrade {
  gradeId: string;
  teacherId: Types.ObjectId;
  classId: string;
  taskId: string;
  studentId: string;
  subscriptionId: Types.ObjectId | null;
  score: number;
  note: string;
  status: TaskGradeStatus;
  gradedAt: Date | null;
  remedialRequestedAt: Date | null;
  remedialCompletedAt: Date | null;
  remedialCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type TaskGradeDocument = HydratedDocument<ITaskGrade>;

const taskGradeSchema = new Schema<ITaskGrade>(
  {
    gradeId: {
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
    score: {
      type: Number,
      required: [true, "Nilai tugas wajib diisi."],
      min: 0,
      max: 100,
    },
    note: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: TASK_GRADE_STATUSES,
      default: "Belum Dinilai",
      index: true,
    },
    gradedAt: {
      type: Date,
      default: null,
    },
    remedialRequestedAt: {
      type: Date,
      default: null,
    },
    remedialCompletedAt: {
      type: Date,
      default: null,
    },
    remedialCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
);

taskGradeSchema.index(
  {
    teacherId: 1,
    classId: 1,
    taskId: 1,
    studentId: 1,
  },
  {
    unique: true,
  },
);

export const TaskGrade: Model<ITaskGrade> =
  (models.TaskGrade as Model<ITaskGrade> | undefined) ??
  model<ITaskGrade>("TaskGrade", taskGradeSchema);
