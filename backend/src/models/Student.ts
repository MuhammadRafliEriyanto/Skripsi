import { HydratedDocument, Model, Schema, model, models, type Types } from "mongoose";

export const STUDENT_STATUSES = ["Aktif", "Nonaktif"] as const;

export type StudentStatus = (typeof STUDENT_STATUSES)[number];

export interface IStudent {
  studentId: string;
  userId: Types.ObjectId;
  phone: string;
  branch: string;
  program: string;
  className: string;
  utbkTrack?: string;
  targetKampus?: string;
  targetJurusan?: string;
  academicYear: string;
  birthDate: Date | null;
  gender: "Laki-laki" | "Perempuan" | null;
  address: string;
  schoolOrigin: string;
  status: StudentStatus;
  academicJoinedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type StudentDocument = HydratedDocument<IStudent>;

const studentSchema = new Schema<IStudent>(
  {
    studentId: {
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
    phone: {
      type: String,
      default: "",
      trim: true,
    },
    branch: {
      type: String,
      default: "",
      trim: true,
    },
    program: {
      type: String,
      required: [true, "Program wajib diisi."],
      trim: true,
    },
    className: {
      type: String,
      required: [true, "Kelas wajib diisi."],
      trim: true,
    },
    utbkTrack: {
      type: String,
      default: "",
      trim: true,
    },
    targetKampus: {
      type: String,
      default: "",
      trim: true,
    },
    targetJurusan: {
      type: String,
      default: "",
      trim: true,
    },
    academicYear: {
      type: String,
      trim: true,
    },
    birthDate: {
      type: Date,
      default: null,
    },
    gender: {
      type: String,
      enum: ["Laki-laki", "Perempuan"],
      default: null,
    },
    address: {
      type: String,
      default: "",
      trim: true,
    },
    schoolOrigin: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: STUDENT_STATUSES,
      default: "Aktif",
    },
    academicJoinedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

export const Student: Model<IStudent> =
  (models.Student as Model<IStudent> | undefined) ?? model<IStudent>("Student", studentSchema);
