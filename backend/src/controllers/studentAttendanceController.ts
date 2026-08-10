import type { NextFunction, Request, Response } from "express";

import { AttendanceRecord } from "../models/AttendanceRecord";
import { AttendanceSession } from "../models/AttendanceSession";
import { Schedule } from "../models/Schedule";
import { Teacher } from "../models/Teacher";
import { User } from "../models/User";
import { AppError, sendSuccess } from "../utils/apiResponse";
import asyncHandler from "../utils/asyncHandler";
import { resolveStudentAcademicContentAccess } from "../utils/studentAcademicAccess";
import { resolveStudentMembershipContentAccess } from "../utils/studentMembershipAccess";
import { normalizeCanonicalClassName } from "../utils/studentClass";
import {
  buildAcademicRecordSubscriptionFilter,
  getMembershipSnapshotByUserId,
} from "../utils/subscription";
import {
  getStudentEffectiveAcademicJoinedAt,
  isAttendanceSessionOnOrAfterAcademicJoin,
  parseValidDate,
} from "../utils/studentAcademicStatus";
import {
  hasUtbkScheduleSignal,
  isUtbkStudent,
  matchesUtbkScheduleClassName,
} from "../utils/studentProgram";
import { buildStableTeacherClassId } from "../utils/teacherClassIdentity";

type StudentAttendanceSchedule = {
  scheduleId?: string | null;
  className?: string | null;
  branch?: string | null;
  subject?: string | null;
  room?: string | null;
  status?: string | null;
  teacherId?:
    | {
        teacherId?: string | null;
        branch?: string | null;
      }
    | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

type StudentAttendanceProfile = {
  branch: string;
  program: string;
  className: string;
  utbkTrack?: string | null;
};

function normalizeText(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function extractClassModifier(name: string) {
  const match = normalizeText(name).match(/(?:^|\s)(?:1[0-2]|[2-9])\s*([A-Za-z]+)\b/);
  return match?.[1]?.toUpperCase() ?? "";
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

  if (
    !canonicalSessionClassName ||
    !canonicalStudentClassName ||
    canonicalSessionClassName.toLowerCase() !==
      canonicalStudentClassName.toLowerCase()
  ) {
    return false;
  }

  return (
    extractClassModifier(normalizedSessionClassName) ===
    extractClassModifier(normalizedStudentClassName)
  );
}

function matchesStudentBranch(sessionBranch: string, studentBranch: string) {
  const normalizedSessionBranch = normalizeText(sessionBranch).toLowerCase();
  const normalizedStudentBranch = normalizeText(studentBranch).toLowerCase();

  if (!normalizedStudentBranch) {
    return false;
  }

  return Boolean(
    normalizedSessionBranch &&
      normalizedSessionBranch === normalizedStudentBranch,
  );
}

function inferStudentLevel(program: string, className: string) {
  const normalizedProgram = normalizeText(program).toUpperCase();

  if (
    normalizedProgram === "SD" ||
    normalizedProgram === "SMP" ||
    normalizedProgram === "SMA"
  ) {
    return normalizedProgram;
  }

  const normalizedClassName = normalizeText(className).toUpperCase();

  if (normalizedClassName.startsWith("SD")) {
    return "SD";
  }

  if (normalizedClassName.startsWith("SMP")) {
    return "SMP";
  }

  return "SMA";
}

function isRegularStudentSessionSubjectAllowed(
  session: { subject?: string | null },
  student: { program: string; className: string },
) {
  const normalizedSubject = normalizeText(session.subject).toLowerCase();

  if (normalizedSubject !== "guru kelas sd") {
    return true;
  }

  return inferStudentLevel(student.program, student.className) === "SD";
}

function matchesStudentSessionProgram(
  session: {
    sessionId?: string | null;
    scheduleId?: string | null;
    className?: string | null;
    subject?: string | null;
    room?: string | null;
  },
  student: {
    program: string;
    className: string;
    utbkTrack?: string | null;
  },
) {
  const sessionHasUtbkSignal =
    hasUtbkScheduleSignal(session) ||
    hasUtbkScheduleSignal({
      scheduleId: session.sessionId,
      className: session.className,
      subject: session.subject,
      room: session.room,
    });

  if (isUtbkStudent(student)) {
    return (
      sessionHasUtbkSignal ||
      matchesUtbkScheduleClassName(session.className, student)
    );
  }

  if (sessionHasUtbkSignal) {
    return false;
  }

  return (
    isRegularStudentSessionSubjectAllowed(session, student) &&
    matchesStudentClass(session.className ?? "", student.className)
  );
}

function getAttendanceHistoryOrderKey(date: string, startTime: string) {
  const normalizedDate = normalizeText(date);
  const normalizedStartTime = normalizeText(startTime).replace(".", ":");

  if (!normalizedDate) {
    return "";
  }

  return `${normalizedDate}T${normalizedStartTime || "00:00"}`;
}

function getScheduleTeacherPublicId(schedule: StudentAttendanceSchedule) {
  return normalizeText(schedule.teacherId?.teacherId);
}

function getScheduleBranch(schedule: StudentAttendanceSchedule) {
  return (
    normalizeText(schedule.branch) ||
    normalizeText(schedule.teacherId?.branch)
  );
}

function getSchedulePriorityTime(schedule: StudentAttendanceSchedule) {
  return (
    parseValidDate(schedule.updatedAt)?.getTime() ??
    parseValidDate(schedule.createdAt)?.getTime() ??
    0
  );
}

function isPreferredSchedule(
  candidate: StudentAttendanceSchedule,
  current: StudentAttendanceSchedule | null,
) {
  if (!current) {
    return true;
  }

  const candidateTime = getSchedulePriorityTime(candidate);
  const currentTime = getSchedulePriorityTime(current);

  if (candidateTime !== currentTime) {
    return candidateTime > currentTime;
  }

  return normalizeText(candidate.scheduleId).localeCompare(
    normalizeText(current.scheduleId),
  ) > 0;
}

async function getEligibleAttendanceClassIds(
  student: StudentAttendanceProfile,
) {
  const branch = normalizeText(student.branch);
  const canonicalClassName =
    normalizeCanonicalClassName(student.className)?.toLowerCase() ?? "";

  if (!branch) {
    return new Set<string>();
  }

  const rawSchedules = await Schedule.find({
    branch,
    status: { $ne: "Bentrok" },
  })
    .select(
      "scheduleId className branch subject room status teacherId createdAt updatedAt",
    )
    .lean()
    .exec();
  const schedules = (await Schedule.populate(rawSchedules, {
    path: "teacherId",
    select: "teacherId branch",
  })) as unknown as StudentAttendanceSchedule[];
  const selectedScheduleBySubject = new Map<
    string,
    StudentAttendanceSchedule
  >();

  for (const schedule of schedules) {
    if (
      !matchesStudentBranch(getScheduleBranch(schedule), student.branch) ||
      !matchesStudentSessionProgram(schedule, student)
    ) {
      continue;
    }

    if (!isUtbkStudent(student)) {
      const scheduleCanonicalClassName =
        normalizeCanonicalClassName(schedule.className)?.toLowerCase() ?? "";

      if (
        canonicalClassName &&
        scheduleCanonicalClassName &&
        scheduleCanonicalClassName !== canonicalClassName
      ) {
        continue;
      }
    }

    const subjectKey =
      normalizeText(schedule.subject).toLowerCase() || "mapel";
    const currentSchedule = selectedScheduleBySubject.get(subjectKey) ?? null;

    if (isPreferredSchedule(schedule, currentSchedule)) {
      selectedScheduleBySubject.set(subjectKey, schedule);
    }
  }

  return new Set(
    Array.from(selectedScheduleBySubject.values())
      .map((schedule) =>
        buildStableTeacherClassId(
          getScheduleTeacherPublicId(schedule),
          getScheduleBranch(schedule),
          normalizeText(schedule.className),
        ),
      )
      .filter(Boolean),
  );
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
    const subscriptionId = membershipSnapshot.subscription?._id ?? null;
    const subscriptionStartAt =
      parseValidDate(membershipSnapshot.subscription?.startDate) ?? academicJoinedAt;
    const eligibleAttendanceClassIds =
      await getEligibleAttendanceClassIds(student);

    const records = await AttendanceRecord.find({
      $and: [
        {
          $or: [
            { studentId: normalizeText(student.studentId) },
            { studentObjectId: student._id },
          ],
        },
        buildAcademicRecordSubscriptionFilter(subscriptionId),
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

    const matchedSessions = sessions.filter((session) => {
      const matchesProgram = matchesStudentSessionProgram(session, student);
      const sessionClassId = normalizeText(session.classId);

      if (
        eligibleAttendanceClassIds.size > 0 &&
        !eligibleAttendanceClassIds.has(sessionClassId)
      ) {
        return false;
      }

      return (
        matchesProgram &&
        matchesStudentBranch(session.branch, student.branch) &&
        isAttendanceSessionOnOrAfterAcademicJoin(session, subscriptionStartAt)
      );
    });
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
