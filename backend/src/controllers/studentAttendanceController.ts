import type { NextFunction, Request, Response } from "express";

import { AttendanceRecord } from "../models/AttendanceRecord";
import { AttendanceSession } from "../models/AttendanceSession";
import { Student } from "../models/Student";
import { Teacher } from "../models/Teacher";
import { User } from "../models/User";
import { AppError, sendSuccess } from "../utils/apiResponse";
import asyncHandler from "../utils/asyncHandler";
import { resolveStudentAcademicContentAccess } from "../utils/studentAcademicAccess";
import { resolveStudentMembershipContentAccess } from "../utils/studentMembershipAccess";
import { normalizeCanonicalClassName } from "../utils/studentClass";
import { getMembershipSnapshotByUserId } from "../utils/subscription";
import {
  getStudentEffectiveAcademicJoinedAt,
  isAttendanceSessionOnOrAfterAcademicJoin,
} from "../utils/studentAcademicStatus";

function normalizeText(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function matchesStudentClass(sessionClassName: string, studentClassName: string) {
  const normalizedSessionClassName = normalizeText(sessionClassName);
  const normalizedStudentClassName = normalizeText(studentClassName);

  if (!normalizedSessionClassName || !normalizedStudentClassName) {
    return false;
  }

  if (
    normalizedSessionClassName.toLowerCase() ===
    normalizedStudentClassName.toLowerCase()
  ) {
    return true;
  }

  const canonicalSessionClassName = normalizeCanonicalClassName(
    normalizedSessionClassName,
  );
  const canonicalStudentClassName = normalizeCanonicalClassName(
    normalizedStudentClassName,
  );

  return (
    Boolean(canonicalSessionClassName) &&
    Boolean(canonicalStudentClassName) &&
    canonicalSessionClassName?.toLowerCase() ===
      canonicalStudentClassName?.toLowerCase()
  );
}

function matchesStudentBranch(sessionBranch: string, studentBranch: string) {
  const normalizedSessionBranch = normalizeText(sessionBranch).toLowerCase();
  const normalizedStudentBranch = normalizeText(studentBranch).toLowerCase();

  if (!normalizedStudentBranch) {
    return true;
  }

  return !normalizedSessionBranch || normalizedSessionBranch === normalizedStudentBranch;
}

function getAttendanceHistoryOrderKey(date: string, startTime: string) {
  const normalizedDate = normalizeText(date);
  const normalizedStartTime = normalizeText(startTime).replace(".", ":");

  if (!normalizedDate) {
    return "";
  }

  return `${normalizedDate}T${normalizedStartTime || "00:00"}`;
}

async function getAuthenticatedStudent(userId: string) {
  return Student.findOne({
    userId,
    status: "Aktif",
  }).exec();
}

export const getMyAttendanceHistory = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const membershipSnapshot = await getMembershipSnapshotByUserId(
      req.user._id.toString(),
    );
    const student = membershipSnapshot.student;

    if (!student) {
      next(new AppError(404, "Profil siswa aktif tidak ditemukan."));
      return;
    }

    const membershipAccess = resolveStudentMembershipContentAccess(
      membershipSnapshot.accessStatus,
      {
        subscription: membershipSnapshot.subscription,
        payment: membershipSnapshot.payment,
      },
    );
    const academicAccess = await resolveStudentAcademicContentAccess(student);

    if (
      membershipAccess.isMembershipLocked ||
      academicAccess.isUpcomingClassLocked
    ) {
      sendSuccess(res, {
        message: "Riwayat absensi siswa berhasil diambil.",
        data: {
          records: [],
          academicAccess,
          membershipAccess,
        },
      });
      return;
    }

    const academicJoinedAt = getStudentEffectiveAcademicJoinedAt(
      student,
      membershipSnapshot.subscription,
    );

    if (!academicJoinedAt) {
      sendSuccess(res, {
        message: "Riwayat absensi siswa berhasil diambil.",
        data: {
          records: [],
          academicAccess,
          membershipAccess,
        },
      });
      return;
    }

    const records = await AttendanceRecord.find({
      $or: [
        { studentId: normalizeText(student.studentId) },
        { studentObjectId: student._id },
      ],
    })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const sessionIds = Array.from(
      new Set(records.map((record) => normalizeText(record.sessionId))),
    );

    const sessions = await AttendanceSession.find({
      sessionId: { $in: sessionIds },
    })
      .populate<{ teacherId: { userId: { nama: string } } }>({
        path: "teacherId",
        model: Teacher,
        populate: {
          path: "userId",
          model: User,
        },
      })
      .lean()
      .exec();

    const matchedSessions = sessions.filter(
      (session) =>
        matchesStudentClass(session.className, student.className) &&
        matchesStudentBranch(session.branch, student.branch) &&
        isAttendanceSessionOnOrAfterAcademicJoin(session, academicJoinedAt),
    );
    const sessionMap = new Map(
      matchedSessions.map((session) => [normalizeText(session.sessionId), session]),
    );

    const attendanceHistory = records
      .map((record) => {
        const session = sessionMap.get(normalizeText(record.sessionId));

        if (!session) {
          return null;
        }

        return {
          id: record.recordId,
          sessionId: normalizeText(session.sessionId),
          date: normalizeText(session.date),
          startTime: normalizeText(session.startTime),
          subject: normalizeText(session.subject) || "-",
          className: normalizeText(session.className) || "-",
          branch: normalizeText(session.branch),
          room: normalizeText(session.room) || "-",
          teacherName: session.teacherId?.userId?.nama
            ? normalizeText(session.teacherId.userId.nama)
            : "-",
          status: record.status,
          sessionStatus: session.status,
          markedBy: record.markedBy,
          note: normalizeText(record.note),
          markedAt: record.markedAt ? record.markedAt.toISOString() : null,
        };
      })
      .filter((record): record is NonNullable<typeof record> => record !== null)
      .sort((leftRecord, rightRecord) =>
        getAttendanceHistoryOrderKey(
          rightRecord.date,
          rightRecord.startTime,
        ).localeCompare(
          getAttendanceHistoryOrderKey(leftRecord.date, leftRecord.startTime),
        ),
      );

    sendSuccess(res, {
      message: "Riwayat absensi siswa berhasil diambil.",
      data: { records: attendanceHistory, academicAccess, membershipAccess },
    });
  },
);
