import { HydratedDocument, Model, Schema, model, models, type Types } from "mongoose";

export const TEACHER_STATUSES = ["Aktif", "Nonaktif"] as const;
export const TEACHER_AVAILABILITIES = ["Tersedia", "Padat", "Cuti"] as const;

export type TeacherStatus = (typeof TEACHER_STATUSES)[number];
export type TeacherAvailability = (typeof TEACHER_AVAILABILITIES)[number];

export interface ITeacher {
  teacherId: string;
  userId: Types.ObjectId;
  subject: string;
  branch: string;
  branches: string[];
  phone: string;
  schedule: string;
  activeClasses: number;
  classList: string;
  capableGrades: string[];
  status: TeacherStatus;
  availability: TeacherAvailability;
  address?: string;
  education?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type TeacherDocument = HydratedDocument<ITeacher>;

const teacherSchema = new Schema<ITeacher>(
  {
    teacherId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    subject: {
      type: String,
      required: [true, "Mapel wajib diisi."],
      trim: true,
    },
    branch: {
      type: String,
      required: [true, "Cabang wajib diisi."],
      trim: true,
    },
    branches: {
      type: [String],
      default: [],
    },
    phone: {
      type: String,
      required: [true, "No. HP wajib diisi."],
      trim: true,
    },
    schedule: {
      type: String,
      required: [true, "Jadwal mengajar wajib diisi."],
      trim: true,
    },
    activeClasses: {
      type: Number,
      required: [true, "Kelas aktif wajib diisi."],
      min: 0,
    },
    classList: {
      type: String,
      required: [true, "Kelas diampu wajib diisi."],
      trim: true,
    },
    capableGrades: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: TEACHER_STATUSES,
      default: "Aktif",
    },
    availability: {
      type: String,
      enum: TEACHER_AVAILABILITIES,
      default: "Tersedia",
    },
    address: {
      type: String,
      default: "",
      trim: true,
    },
    education: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

export const Teacher: Model<ITeacher> =
  (models.Teacher as Model<ITeacher> | undefined) ?? model<ITeacher>("Teacher", teacherSchema);
