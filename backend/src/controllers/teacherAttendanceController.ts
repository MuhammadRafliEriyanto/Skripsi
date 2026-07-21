import { randomBytes } from "crypto";
import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";

import {
  AttendanceRecord,
  ATTENDANCE_RECORD_MARKED_BY,
  ATTENDANCE_RECORD_STATUSES,
  type AttendanceRecordDocument,
  type AttendanceRecordMarkedBy,
  type AttendanceRecordStatus,
} from "../models/AttendanceRecord";
import {
  AttendanceSession,
  type AttendanceSessionDocument,
} from "../models/AttendanceSession";
import { Teacher } from "../models/Teacher";
import asyncHandler from "../utils/asyncHandler";
import { AppError, sendSuccess } from "../utils/apiResponse";
import { getNextPublicId } from "../utils/publicId";
import { resolveStudentAcademicContentAccess } from "../utils/studentAcademicAccess";
import { resolveStudentMembershipContentAccess } from "../utils/studentMembershipAccess";
import {
  findActiveSubscriptionIdForAcademicRecord,
  getMembershipSnapshotByUserId,
} from "../utils/subscription";
import {
  getStudentEffectiveAcademicJoinedAt,
  isAttendanceSessionOnOrAfterAcademicJoin,
  parseValidDate,
} from "../utils/studentAcademicStatus";
import { getCurrentAcademicPeriod } from "../utils/academicGrade";
import {
  ensureTeacherAcademicPeriodEditable,
  TEACHER_ACADEMIC_ARCHIVE_MESSAGE,
} from "../utils/teacherAcademicArchive";
import { resolveTeacherClassDetailContext } from "./teacherScheduleController";

type UpdateAttendanceRecordRequestBody = {
  status?: string;
  note?: string;
  markedBy?: string;
};

type StudentAttendanceQrScanRequestBody = {
  sessionId?: string;
  token?: string;
};

type AttendanceSummary = {
  hadir: number;
  sakit: number;
  izin: number;
  alpa: number;
  belumAbsen: number;
};

function normalizeText(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function getCurrentJakartaDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Jakarta",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

function getCurrentJakartaTime() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  }).formatToParts(new Date());
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";

  return `${hour}:${minute}`;
}

function normalizeAttendanceRecordStatus(
  value: string | null | undefined,
): AttendanceRecordStatus | null {
  const normalizedValue = normalizeText(value).toLowerCase();

  switch (normalizedValue) {
    case "belum absen":
      return "Belum Absen";
    case "hadir":
      return "Hadir";
    case "sakit":
      return "Sakit";
    case "izin":
      return "Izin";
    case "alpa":
      return "Alpa";
    default:
      return null;
  }
}

function normalizeAttendanceMarkedBy(
  value: string | null | undefined,
): AttendanceRecordMarkedBy | null {
  const normalizedValue = normalizeText(value).toLowerCase();

  if (
    ATTENDANCE_RECORD_MARKED_BY.includes(
      normalizedValue as AttendanceRecordMarkedBy,
    )
  ) {
    return normalizedValue as AttendanceRecordMarkedBy;
  }

  return null;
}

function toPublicAttendanceSession(session: AttendanceSessionDocument) {
  return {
    sessionId: normalizeText(session.sessionId),
    classId: normalizeText(session.classId),
    scheduleId: normalizeText(session.scheduleId) || null,
    className: normalizeText(session.className),
    subject: normalizeText(session.subject),
    branch: normalizeText(session.branch),
    room: normalizeText(session.room),
    date: normalizeText(session.date),
    startTime: normalizeText(session.startTime),
    status: session.status,
    qrToken: normalizeText(session.qrToken) || null,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

function toPublicAttendanceRecord(record: AttendanceRecordDocument) {
  return {
    recordId: normalizeText(record.recordId),
    sessionId: normalizeText(record.sessionId),
    studentId: normalizeText(record.studentId),
    studentObjectId: record.studentObjectId?.toString() ?? null,
    name: normalizeText(record.name),
    status: record.status,
    note: normalizeText(record.note),
    markedBy: record.markedBy,
    markedAt: record.markedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function buildAttendanceSummary(
  records: Array<Pick<AttendanceRecordDocument, "status">>,
): AttendanceSummary {
  return records.reduce<AttendanceSummary>(
    (summary, record) => {
      switch (record.status) {
        case "Hadir":
          summary.hadir += 1;
          break;
        case "Sakit":
          summary.sakit += 1;
          break;
        case "Izin":
          summary.izin += 1;
          break;
        case "Alpa":
          summary.alpa += 1;
          break;
        case "Belum Absen":
          summary.belumAbsen += 1;
          break;
      }

      return summary;
    },
    {
      hadir: 0,
      sakit: 0,
      izin: 0,
      alpa: 0,
      belumAbsen: 0,
    },
  );
}

async function getAuthenticatedTeacher(userId: string) {
  return Teacher.findOne({ userId, status: "Aktif" }).exec();
}

function generateAttendanceQrToken() {
  return `qr_${randomBytes(24).toString("hex")}`;
}

function isAttendanceSessionInEditableAcademicYear(
  session: AttendanceSessionDocument,
) {
  const sessionDate = new Date(`${normalizeText(session.date)}T00:00:00+07:00`);

  if (Number.isNaN(sessionDate.getTime())) {
    return false;
  }

  return (
    getCurrentAcademicPeriod(sessionDate).academicYear ===
    getCurrentAcademicPeriod().academicYear
  );
}

function ensureAttendanceSessionEditable(
  session: AttendanceSessionDocument,
  next: NextFunction,
) {
  if (isAttendanceSessionInEditableAcademicYear(session)) {
    return true;
  }

  next(new AppError(403, TEACHER_ACADEMIC_ARCHIVE_MESSAGE));
  return false;
}

async function ensureAttendanceSessionQrToken(session: AttendanceSessionDocument) {
  const existingQrToken = normalizeText(session.qrToken);

  if (existingQrToken) {
    return existingQrToken;
  }

  session.qrToken = generateAttendanceQrToken();
  await session.save();

  return normalizeText(session.qrToken);
}

async function findTeacherAttendanceSessionByParam(
  sessionId: string,
  teacherId: string,
) {
  return AttendanceSession.findOne({
    teacherId,
    $or: [
      { sessionId },
      ...(Types.ObjectId.isValid(sessionId) ? [{ _id: sessionId }] : []),
    ],
  }).exec();
}

async function findAttendanceRecordByParam(recordId: string) {
  return AttendanceRecord.findOne({
    $or: [
      { recordId },
      ...(Types.ObjectId.isValid(recordId) ? [{ _id: recordId }] : []),
    ],
  }).exec();
}

async function getAttendanceSessionRecords(sessionId: string) {
  return AttendanceRecord.find({ sessionId }).sort({ name: 1, createdAt: 1 }).exec();
}

async function ensureAttendanceRecordsForSession(
  session: AttendanceSessionDocument,
  participants: Array<{
    id: string;
    studentId: string;
    studentObjectId?: string | null;
    name: string;
    academicJoinedAt?: string | null;
  }>,
) {
  const existingRecords = await getAttendanceSessionRecords(session.sessionId);
  const existingStudentIds = new Set(
    existingRecords.map((record) => normalizeText(record.studentId).toLowerCase()),
  );

  for (const participant of participants) {
    const studentId = normalizeText(participant.studentId);
    const academicJoinedAt = parseValidDate(participant.academicJoinedAt);

    if (
      !studentId ||
      existingStudentIds.has(studentId.toLowerCase()) ||
      !academicJoinedAt ||
      !isAttendanceSessionOnOrAfterAcademicJoin(session, academicJoinedAt)
    ) {
      continue;
    }

    const recordId = await getNextPublicId(
      AttendanceRecord,
      "recordId",
      "ATR",
    );
    const studentObjectIdCandidate =
      normalizeText(participant.studentObjectId) || normalizeText(participant.id);
    const studentObjectId = Types.ObjectId.isValid(studentObjectIdCandidate)
      ? studentObjectIdCandidate
      : null;
    const subscriptionId = await findActiveSubscriptionIdForAcademicRecord({
      studentObjectId,
      publicStudentId: studentId,
    });

    await AttendanceRecord.create({
      recordId,
      sessionId: session.sessionId,
      studentId,
      studentObjectId,
      subscriptionId,
      name: normalizeText(participant.name) || "Nama siswa belum diatur",
      status: "Belum Absen",
      note: "",
      markedBy: "teacher",
      markedAt: null,
    });
    existingStudentIds.add(studentId.toLowerCase());
  }

  return getAttendanceSessionRecords(session.sessionId);
}

export const createOrGetTeacherAttendanceSession = asyncHandler(
  async (req: Request<{ classId: string }>, res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    if (!ensureTeacherAcademicPeriodEditable(req, next)) {
      return;
    }

    const { teacher, classGroup, participants } =
      await resolveTeacherClassDetailContext(
        req.user._id.toString(),
        req.params.classId,
      );
    const date = getCurrentJakartaDate();
    const startTime = getCurrentJakartaTime();

    let session = await AttendanceSession.findOne({
      teacherId: teacher._id,
      classId: classGroup.item.id,
      date,
    }).exec();
    let isCreated = false;

    if (!session) {
      try {
        const sessionId = await getNextPublicId(
          AttendanceSession,
          "sessionId",
          "ATS",
        );

        session = await AttendanceSession.create({
          sessionId,
          classId: classGroup.item.id,
          teacherId: teacher._id,
          scheduleId: null,
          className: classGroup.item.className,
          subject: classGroup.item.subject,
          branch: classGroup.item.branch,
          room: classGroup.item.room,
          date,
          startTime,
          status: "open",
          qrToken: null,
        });
        isCreated = true;
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === 11000
        ) {
          session = await AttendanceSession.findOne({
            teacherId: teacher._id,
            classId: classGroup.item.id,
            date,
          }).exec();
        } else {
          throw error;
        }
      }
    }

    if (!session) {
      next(new AppError(500, "Sesi absensi guru gagal disiapkan."));
      return;
    }

    await ensureAttendanceSessionQrToken(session);
    const records = await ensureAttendanceRecordsForSession(session, participants);

    sendSuccess(res, {
      statusCode: isCreated ? 201 : 200,
      message: isCreated
        ? "Sesi absensi guru berhasil dibuat."
        : "Sesi absensi guru hari ini berhasil diambil.",
      data: {
        session: toPublicAttendanceSession(session),
        records: records.map(toPublicAttendanceRecord),
      },
    });
  },
);

export const getTeacherAttendanceSession = asyncHandler(
  async (req: Request<{ classId: string }>, res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    if (!ensureTeacherAcademicPeriodEditable(req, next)) {
      return;
    }

    const { teacher, classGroup, participants } = await resolveTeacherClassDetailContext(
      req.user._id.toString(),
      req.params.classId,
    );
    const date = getCurrentJakartaDate();
    const session = await AttendanceSession.findOne({
      teacherId: teacher._id,
      classId: classGroup.item.id,
      date,
    }).exec();

    if (!session) {
      next(new AppError(404, "Sesi absensi kelas belum dibuat untuk hari ini."));
      return;
    }

    if (req.query.rotateQr === "true") {
      if (!ensureTeacherAcademicPeriodEditable(req, next)) {
        return;
      }

      if (!ensureAttendanceSessionEditable(session, next)) {
        return;
      }

      session.qrToken = generateAttendanceQrToken();
      await session.save();
    } else {
      await ensureAttendanceSessionQrToken(session);
    }
    const records = await ensureAttendanceRecordsForSession(session, participants);

    sendSuccess(res, {
      message: "Sesi absensi guru berhasil diambil.",
      data: {
        session: toPublicAttendanceSession(session),
        records: records.map(toPublicAttendanceRecord),
      },
    });
  },
);

export const updateTeacherAttendanceRecord = asyncHandler(
  async (
    req: Request<
      { recordId: string },
      Record<string, never>,
      UpdateAttendanceRecordRequestBody
    >,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    if (!ensureTeacherAcademicPeriodEditable(req, next)) {
      return;
    }

    const teacher = await getAuthenticatedTeacher(req.user._id.toString());

    if (!teacher) {
      next(new AppError(404, "Profil guru tidak ditemukan."));
      return;
    }

    const recordId = normalizeText(req.params.recordId);

    if (!recordId) {
      next(new AppError(404, "Data record absensi tidak ditemukan."));
      return;
    }

    const record = await findAttendanceRecordByParam(recordId);

    if (!record) {
      next(new AppError(404, "Data record absensi tidak ditemukan."));
      return;
    }

    const session = await AttendanceSession.findOne({
      teacherId: teacher._id,
      sessionId: record.sessionId,
    }).exec();

    if (!session) {
      next(new AppError(404, "Data record absensi tidak ditemukan."));
      return;
    }

    if (!ensureAttendanceSessionEditable(session, next)) {
      return;
    }

    if (session.status !== "open") {
      next(new AppError(400, "Sesi absensi sudah ditutup."));
      return;
    }

    const status = normalizeAttendanceRecordStatus(req.body.status);
    const markedBy =
      normalizeAttendanceMarkedBy(req.body.markedBy) ?? "teacher";
    const note = normalizeText(req.body.note);

    if (!status) {
      next(
        new AppError(
          400,
          `Status absensi harus salah satu dari: ${ATTENDANCE_RECORD_STATUSES.join(", ")}.`,
        ),
      );
      return;
    }

    if (req.body.markedBy && !normalizeAttendanceMarkedBy(req.body.markedBy)) {
      next(
        new AppError(
          400,
          `markedBy harus salah satu dari: ${ATTENDANCE_RECORD_MARKED_BY.join(", ")}.`,
        ),
      );
      return;
    }

    record.status = status;
    record.note = note;
    record.markedBy = markedBy;
    record.markedAt = status === "Belum Absen" ? null : new Date();
    await record.save();

    sendSuccess(res, {
      message: "Status absensi siswa berhasil diperbarui.",
      data: {
        record: toPublicAttendanceRecord(record),
      },
    });
  },
);

export const closeTeacherAttendanceSession = asyncHandler(
  async (
    req: Request<{ sessionId: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    if (!ensureTeacherAcademicPeriodEditable(req, next)) {
      return;
    }

    const teacher = await getAuthenticatedTeacher(req.user._id.toString());

    if (!teacher) {
      next(new AppError(404, "Profil guru tidak ditemukan."));
      return;
    }

    const sessionId = normalizeText(req.params.sessionId);

    if (!sessionId) {
      next(new AppError(404, "Sesi absensi tidak ditemukan."));
      return;
    }

    const session = await findTeacherAttendanceSessionByParam(
      sessionId,
      teacher._id.toString(),
    );

    if (!session) {
      next(new AppError(404, "Sesi absensi tidak ditemukan."));
      return;
    }

    if (!ensureAttendanceSessionEditable(session, next)) {
      return;
    }

    const now = new Date();
    await AttendanceRecord.updateMany(
      {
        sessionId: session.sessionId,
        status: "Belum Absen",
      },
      {
        $set: {
          status: "Alpa",
          markedBy: "teacher",
          markedAt: now,
        },
      },
    ).exec();

    if (session.status !== "closed") {
      session.status = "closed";
      await session.save();
    }

    const records = await getAttendanceSessionRecords(session.sessionId);
    const summary = buildAttendanceSummary(records);

    sendSuccess(res, {
      message: "Sesi absensi berhasil ditutup.",
      data: {
        session: toPublicAttendanceSession(session),
        summary,
      },
    });
  },
);

export const scanStudentAttendanceByQr = asyncHandler(
  async (
    req: Request<
      Record<string, never>,
      Record<string, never>,
      StudentAttendanceQrScanRequestBody
    >,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const membershipSnapshot = await getMembershipSnapshotByUserId(
      req.user._id.toString(),
    );
    const student = membershipSnapshot.student;

    if (!student || student.status !== "Aktif") {
      next(new AppError(404, "Profil siswa tidak ditemukan."));
      return;
    }

    const membershipAccess = resolveStudentMembershipContentAccess(
      membershipSnapshot.accessStatus,
      {
        subscription: membershipSnapshot.subscription,
        payment: membershipSnapshot.payment,
      },
    );

    if (membershipAccess.isMembershipLocked) {
      next(
        new AppError(
          403,
          membershipAccess.message ?? "Membership siswa belum aktif.",
          { membershipAccess },
          "MEMBERSHIP_ACCESS_REQUIRED",
        ),
      );
      return;
    }

    const academicAccess = await resolveStudentAcademicContentAccess(student);

    if (academicAccess.isUpcomingClassLocked) {
      next(
        new AppError(
          403,
          academicAccess.message ?? "Akses akademik siswa belum dibuka.",
          { academicAccess, membershipAccess },
          "ACADEMIC_ACCESS_SCHEDULED",
        ),
      );
      return;
    }

    const sessionId = normalizeText(req.body.sessionId);
    const token = normalizeText(req.body.token);

    if (!sessionId || !token) {
      next(new AppError(400, "QR absensi tidak valid."));
      return;
    }

    const session = await AttendanceSession.findOne({
      sessionId,
      qrToken: token,
    }).exec();

    if (!session) {
      next(new AppError(404, "Sesi absensi QR tidak ditemukan."));
      return;
    }

    if (session.status !== "open") {
      next(new AppError(400, "Sesi absensi sudah ditutup."));
      return;
    }

    if (normalizeText(session.date) !== getCurrentJakartaDate()) {
      next(new AppError(400, "QR absensi ini sudah tidak berlaku."));
      return;
    }

    const academicJoinedAt = getStudentEffectiveAcademicJoinedAt(
      student,
      membershipSnapshot.subscription,
    );

    if (
      !academicJoinedAt ||
      !isAttendanceSessionOnOrAfterAcademicJoin(session, academicJoinedAt)
    ) {
      next(new AppError(403, "Siswa ini belum terdaftar pada tanggal sesi absensi."));
      return;
    }

    const record = await AttendanceRecord.findOne({
      sessionId: session.sessionId,
      $or: [
        { studentId: normalizeText(student.studentId) },
        { studentObjectId: student._id },
      ],
    }).exec();

    if (!record) {
      next(new AppError(403, "Siswa ini tidak terdaftar pada sesi absensi tersebut."));
      return;
    }

    if (record.status === "Hadir") {
      sendSuccess(res, {
        message: "Absensi QR siswa sudah tercatat sebelumnya.",
        data: {
          session: toPublicAttendanceSession(session),
          record: toPublicAttendanceRecord(record),
        },
      });
      return;
    }

    if (record.status === "Sakit" || record.status === "Izin") {
      next(
        new AppError(
          409,
          `Status kehadiran sudah ditandai sebagai ${record.status.toLowerCase()} oleh guru.`,
        ),
      );
      return;
    }

    record.status = "Hadir";
    record.markedBy = "qr";
    record.markedAt = new Date();
    await record.save();

    sendSuccess(res, {
      message: "Absensi QR siswa berhasil dicatat.",
      data: {
        session: toPublicAttendanceSession(session),
        record: toPublicAttendanceRecord(record),
      },
    });
  },
);
