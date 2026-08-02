import { HydratedDocument, Model, Schema, model, models, type Types } from "mongoose";

export const ATTENDANCE_SESSION_STATUSES = ["open", "closed"] as const;

export type AttendanceSessionStatus =
  (typeof ATTENDANCE_SESSION_STATUSES)[number];

export interface IAttendanceSession {
  sessionId: string;
  classId: string;
  teacherId: Types.ObjectId;
  scheduleId: string | null;
  className: string;
  subject: string;
  branch: string;
  room: string;
  date: string;
  startTime: string;
  academicYear?: string | null;
  semester?: string | null;
  status: AttendanceSessionStatus;
  qrToken: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type AttendanceSessionDocument = HydratedDocument<IAttendanceSession>;

const attendanceSessionSchema = new Schema<IAttendanceSession>(
  {
    sessionId: {
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
    scheduleId: {
      type: String,
      default: null,
      trim: true,
    },
    className: {
      type: String,
      required: [true, "Nama kelas wajib diisi."],
      trim: true,
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
    },
    room: {
      type: String,
      default: "",
      trim: true,
    },
    date: {
      type: String,
      required: [true, "Tanggal absensi wajib diisi."],
      trim: true,
    },
    startTime: {
      type: String,
      required: [true, "Jam mulai absensi wajib diisi."],
      trim: true,
    },
    academicYear: {
      type: String,
      default: null,
      trim: true,
    },
    semester: {
      type: String,
      default: null,
      trim: true,
    },
    status: {
      type: String,
      enum: ATTENDANCE_SESSION_STATUSES,
      default: "open",
      index: true,
    },
    qrToken: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

attendanceSessionSchema.index(
  {
    teacherId: 1,
    classId: 1,
    scheduleId: 1,
    date: 1,
  },
  {
    unique: true,
  },
);

export const AttendanceSession: Model<IAttendanceSession> =
  (models.AttendanceSession as Model<IAttendanceSession> | undefined) ??
  model<IAttendanceSession>("AttendanceSession", attendanceSessionSchema);
