import { HydratedDocument, Model, Schema, model, models, type Types } from "mongoose";

export const SCHEDULE_STATUSES = ["Berjalan", "Siap", "Review", "Bentrok"] as const;
export const SCHEDULE_SUBJECTS = [
  "Matematika",
  "Bahasa Indonesia",
  "Bahasa Inggris",
  "IPA",
  "IPS",
  "Guru Kelas SD",
  "TPS",
  "Literasi Bahasa Indonesia",
  "Literasi Bahasa Inggris",
  "Penalaran Matematika",
  "Pembahasan Tryout UTBK",
  "Strategi SNBT",
] as const;

export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];
export type ScheduleSubject = (typeof SCHEDULE_SUBJECTS)[number];

export interface ISchedule {
  scheduleId: string;
  day: string;
  time: string;
  className: string;
  branch: string;
  subject: string;
  teacherId: Types.ObjectId;
  room: string;
  status: ScheduleStatus;
  academicYear?: string;
  semester?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ScheduleDocument = HydratedDocument<ISchedule>;

const scheduleSchema = new Schema<ISchedule>(
  {
    scheduleId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    day: {
      type: String,
      required: [true, "Hari wajib diisi."],
      trim: true,
    },
    time: {
      type: String,
      required: [true, "Jam wajib diisi."],
      trim: true,
    },
    className: {
      type: String,
      required: [true, "Nama kelas wajib diisi."],
      trim: true,
    },
    branch: {
      type: String,
      required: [true, "Cabang jadwal wajib diisi."],
      trim: true,
      index: true,
    },
    subject: {
      type: String,
      required: [true, "Mata pelajaran wajib diisi."],
      trim: true,
      enum: SCHEDULE_SUBJECTS,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
      required: [true, "Guru wajib dipilih."],
    },
    room: {
      type: String,
      required: [true, "Ruangan wajib diisi."],
      trim: true,
    },
    status: {
      type: String,
      enum: SCHEDULE_STATUSES,
      default: "Berjalan",
    },
    academicYear: {
      type: String,
      trim: true,
      default: null,
    },
    semester: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

export const Schedule: Model<ISchedule> =
  (models.Schedule as Model<ISchedule> | undefined) ?? model<ISchedule>("Schedule", scheduleSchema);
