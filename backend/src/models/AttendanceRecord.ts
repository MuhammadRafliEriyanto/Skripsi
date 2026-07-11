import { HydratedDocument, Model, Schema, model, models, type Types } from "mongoose";

export const ATTENDANCE_RECORD_STATUSES = [
  "Belum Absen",
  "Hadir",
  "Sakit",
  "Izin",
  "Alpa",
] as const;
export const ATTENDANCE_RECORD_MARKED_BY = [
  "teacher",
  "manual",
  "qr",
] as const;

export type AttendanceRecordStatus =
  (typeof ATTENDANCE_RECORD_STATUSES)[number];
export type AttendanceRecordMarkedBy =
  (typeof ATTENDANCE_RECORD_MARKED_BY)[number];

export interface IAttendanceRecord {
  recordId: string;
  sessionId: string;
  studentId: string;
  studentObjectId: Types.ObjectId | null;
  subscriptionId: Types.ObjectId | null;
  name: string;
  status: AttendanceRecordStatus;
  note: string;
  markedBy: AttendanceRecordMarkedBy;
  markedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type AttendanceRecordDocument = HydratedDocument<IAttendanceRecord>;

const attendanceRecordSchema = new Schema<IAttendanceRecord>(
  {
    recordId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    sessionId: {
      type: String,
      required: [true, "Session ID absensi wajib diisi."],
      ref: "AttendanceSession",
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
      default: null,
      index: true,
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: "Subscription",
      default: null,
    },
    name: {
      type: String,
      required: [true, "Nama siswa wajib diisi."],
      trim: true,
    },
    status: {
      type: String,
      enum: ATTENDANCE_RECORD_STATUSES,
      default: "Belum Absen",
      index: true,
    },
    note: {
      type: String,
      default: "",
      trim: true,
    },
    markedBy: {
      type: String,
      enum: ATTENDANCE_RECORD_MARKED_BY,
      default: "teacher",
      trim: true,
    },
    markedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

attendanceRecordSchema.index(
  {
    sessionId: 1,
    studentId: 1,
  },
  {
    unique: true,
  },
);

attendanceRecordSchema.index({ sessionId: 1, name: 1 });

export const AttendanceRecord: Model<IAttendanceRecord> =
  (models.AttendanceRecord as Model<IAttendanceRecord> | undefined) ??
  model<IAttendanceRecord>("AttendanceRecord", attendanceRecordSchema);
