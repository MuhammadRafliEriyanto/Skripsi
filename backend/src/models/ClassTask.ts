import { HydratedDocument, Model, Schema, model, models, type Types } from "mongoose";

export const CLASS_TASK_REVIEW_STATUSES = [
  "Belum Ada Pengumpulan",
  "Sudah Dinilai",
  "Belum Dinilai",
] as const;

export type ClassTaskReviewStatus =
  (typeof CLASS_TASK_REVIEW_STATUSES)[number];

export interface IClassTaskAttachment {
  fileName: string;
  mimeType: string;
  size: number;
  storagePath: string;
}

export interface IClassTask {
  taskId: string;
  classId: string;
  teacherId: Types.ObjectId;
  className: string;
  canonicalClassName: string;
  subject: string;
  branch: string;
  room: string;
  meetingNumber: number;
  title: string;
  description: string;
  deadline: string;
  startAt?: Date | null;
  endAt?: Date | null;
  durationMinutes?: number | null;
  questionCount?: number | null;
  passingGrade?: number | null;
  attachment: IClassTaskAttachment | null;
  submittedCount: number;
  reviewStatus: ClassTaskReviewStatus;
  academicYear?: string | null;
  semester?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ClassTaskDocument = HydratedDocument<IClassTask>;

const classTaskSchema = new Schema<IClassTask>(
  {
    taskId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    classId: {
      type: String,
      required: [true, "Class ID wajib diisi."],
      trim: true,
      index: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
      required: [true, "Guru wajib diisi."],
      index: true,
    },
    className: {
      type: String,
      required: [true, "Nama kelas wajib diisi."],
      trim: true,
    },
    canonicalClassName: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    subject: {
      type: String,
      required: [true, "Mata pelajaran wajib diisi."],
      trim: true,
    },
    branch: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    room: {
      type: String,
      default: "",
      trim: true,
    },
    meetingNumber: {
      type: Number,
      required: [true, "Pertemuan wajib diisi."],
      min: 1,
      index: true,
    },
    title: {
      type: String,
      required: [true, "Judul tugas wajib diisi."],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Deskripsi tugas wajib diisi."],
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
      },
      default: null,
    },
    deadline: {
      type: String,
      required: [true, "Deadline tugas wajib diisi."],
      trim: true,
    },
    startAt: {
      type: Date,
      default: null,
      index: true,
    },
    endAt: {
      type: Date,
      default: null,
    },
    durationMinutes: {
      type: Number,
      default: null,
      min: 1,
    },
    questionCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    passingGrade: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
    submittedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    reviewStatus: {
      type: String,
      enum: CLASS_TASK_REVIEW_STATUSES,
      default: "Belum Ada Pengumpulan",
      index: true,
    },
    academicYear: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    semester: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

classTaskSchema.index({
  teacherId: 1,
  classId: 1,
  meetingNumber: 1,
  deadline: 1,
});

export const ClassTask: Model<IClassTask> =
  (models.ClassTask as Model<IClassTask> | undefined) ??
  model<IClassTask>("ClassTask", classTaskSchema);
