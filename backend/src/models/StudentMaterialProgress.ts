import { HydratedDocument, Model, Schema, model, models, type Types } from "mongoose";

export const STUDENT_MATERIAL_PROGRESS_STATUSES = [
  "Belum Dibuka",
  "Sedang Dipelajari",
  "Selesai",
] as const;

export type StudentMaterialProgressStatus =
  (typeof STUDENT_MATERIAL_PROGRESS_STATUSES)[number];

export interface IStudentMaterialProgress {
  progressId: string;
  materialId: string;
  classId: string;
  studentId: string;
  studentObjectId: Types.ObjectId;
  subscriptionId: Types.ObjectId | null;
  status: StudentMaterialProgressStatus;
  startedAt: Date | null;
  lastOpenedAt: Date | null;
  completedAt: Date | null;
  durationSeconds: number;
  createdAt: Date;
  updatedAt: Date;
}

export type StudentMaterialProgressDocument =
  HydratedDocument<IStudentMaterialProgress>;

const studentMaterialProgressSchema = new Schema<IStudentMaterialProgress>(
  {
    progressId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    materialId: {
      type: String,
      required: [true, "Material ID wajib diisi."],
      trim: true,
      index: true,
    },
    classId: {
      type: String,
      required: [true, "Class ID wajib diisi."],
      trim: true,
      index: true,
    },
    studentId: {
      type: String,
      required: [true, "Student ID wajib diisi."],
      trim: true,
      index: true,
    },
    studentObjectId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: [true, "Siswa wajib diisi."],
      index: true,
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: "Subscription",
      default: null,
    },
    status: {
      type: String,
      enum: STUDENT_MATERIAL_PROGRESS_STATUSES,
      default: "Belum Dibuka",
      index: true,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    lastOpenedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    durationSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
);

studentMaterialProgressSchema.index(
  {
    materialId: 1,
    studentId: 1,
    subscriptionId: 1,
  },
  {
    unique: true,
  },
);

export const StudentMaterialProgress: Model<IStudentMaterialProgress> =
  (models.StudentMaterialProgress as Model<IStudentMaterialProgress> | undefined) ??
  model<IStudentMaterialProgress>(
    "StudentMaterialProgress",
    studentMaterialProgressSchema,
  );
