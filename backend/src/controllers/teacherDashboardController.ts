import type { NextFunction, Request, Response } from "express";
import type { FilterQuery } from "mongoose";

import { Student, type StudentDocument } from "../models/Student";
import { Schedule, type ISchedule } from "../models/Schedule";
import { Subscription } from "../models/Subscription";
import { Teacher } from "../models/Teacher";
import { User, type UserDocument } from "../models/User";
import {
  hasPopulatedUserDocument,
  toPublicStudent,
} from "../utils/adminView";
import asyncHandler from "../utils/asyncHandler";
import { AppError, sendSuccess } from "../utils/apiResponse";
import {
  buildSchedulePresentation,
  type ScheduleWithTeacher,
} from "../utils/scheduleConflicts";
import { resolveAcademicPeriodFromQuery } from "../utils/academicGrade";
import {
  buildTeacherAcademicPeriodOrLegacyFilter,
  type TeacherAcademicPeriodFilters,
} from "../utils/teacherAcademicPeriod";

type StudentWithUser = StudentDocument & {
  userId: UserDocument | null;
};

type DashboardJenjang = "SD" | "SMP" | "SMA";

type DashboardClass = {
  id: string;
  classKey: string;
  className: string;
  branch: string;
  jenjang: DashboardJenjang;
  tingkat: string;
  mapel: string;
  day: string;
  time: string;
  room: string;
  status: "Berjalan" | "Siap" | "Review" | "Bentrok";
  conflicts: string[];
  participants: ReturnType<typeof toPublicStudent>[];
};

const ROMAN_GRADE_MAP: Record<string, number> = {
  X: 10,
  XI: 11,
  XII: 12,
};

function normalizeText(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function buildInitials(name: string): string {
  return (
    normalizeText(name)
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 2) || "GU"
  );
}

function extractGrade(value: string): number | null {
  const normalizedValue = normalizeText(value).toUpperCase();
  const numericMatch = normalizedValue.match(/(^|[^0-9])(4|5|6|7|8|9|10|11|12)(?![0-9])/);

  if (numericMatch?.[2]) {
    return Number(numericMatch[2]);
  }

  const romanMatch = normalizedValue.match(/\b(XII|XI|X)\b/);

  if (!romanMatch?.[1]) {
    return null;
  }

  return ROMAN_GRADE_MAP[romanMatch[1]] ?? null;
}

function inferJenjang(grade: number | null, className: string): DashboardJenjang {
  const normalizedValue = normalizeText(className).toUpperCase();

  if (normalizedValue.includes("SD")) {
    return "SD";
  }

  if (normalizedValue.includes("SMP")) {
    return "SMP";
  }

  if (normalizedValue.includes("SMA")) {
    return "SMA";
  }

  if (grade !== null) {
    if (grade <= 6) {
      return "SD";
    }

    if (grade <= 9) {
      return "SMP";
    }
  }

  return "SMA";
}

function buildClassKey(jenjang: DashboardJenjang, grade: number | null): string {
  return grade ? `${jenjang}-${grade}` : `${jenjang}-unknown`;
}

function buildBranchClassKey(branch: string, classKey: string) {
  return `${normalizeText(branch).toLowerCase()}::${classKey.toLowerCase()}`;
}

function getAcademicInfo(className: string) {
  const grade = extractGrade(className);
  const jenjang = inferJenjang(grade, className);

  return {
    jenjang,
    tingkat: grade ? `Kelas ${grade}` : "Kelas belum diatur",
    classKey: buildClassKey(jenjang, grade),
  };
}

async function getTeacherSchedules(
  teacherId: string,
  filters?: TeacherAcademicPeriodFilters,
) {
  const query: FilterQuery<ISchedule> = {
    $and: [
      { teacherId },
      buildTeacherAcademicPeriodOrLegacyFilter(filters),
    ],
  };

  return (await Schedule.find(query)
    .populate<{
      teacherId: {
        teacherId: string;
        userId: {
          nama: string;
        };
      };
    }>({
      path: "teacherId",
      populate: {
        path: "userId",
        model: User,
      },
    })
    .sort({ createdAt: -1 })
    .lean()
    .exec()) as unknown as ScheduleWithTeacher[];
}

async function getStudentsByClassKey() {
  const students = (await Student.find({ status: "Aktif" })
    .populate<{ userId: StudentWithUser["userId"] }>("userId")
    .sort({ createdAt: -1 })
    .exec()) as StudentWithUser[];
  const studentObjectIds = students.map((student) => student._id).filter(Boolean);
  const paidSubscriptions = studentObjectIds.length
    ? await Subscription.find({
        studentId: {
          $in: studentObjectIds,
        },
        paymentStatus: "paid",
      })
        .select("studentId startDate endDate")
        .lean()
        .exec()
    : [];
  const now = Date.now();
  const studentsWithPaidSubscription = new Set<string>();
  const studentsWithActiveSubscription = new Set<string>();

  for (const subscription of paidSubscriptions) {
    const studentObjectId = subscription.studentId?.toString() ?? "";
    const startAt = subscription.startDate ? new Date(subscription.startDate) : null;
    const endAt = subscription.endDate ? new Date(subscription.endDate) : null;

    if (!studentObjectId) {
      continue;
    }

    studentsWithPaidSubscription.add(studentObjectId);

    if (
      startAt &&
      endAt &&
      !Number.isNaN(startAt.getTime()) &&
      !Number.isNaN(endAt.getTime()) &&
      startAt.getTime() <= now &&
      endAt.getTime() > now
    ) {
      studentsWithActiveSubscription.add(studentObjectId);
    }
  }

  const studentsByClassKey = new Map<string, ReturnType<typeof toPublicStudent>[]>();

  for (const student of students) {
    const studentObjectId = student._id.toString();

    if (
      studentsWithPaidSubscription.has(studentObjectId) &&
      !studentsWithActiveSubscription.has(studentObjectId)
    ) {
      continue;
    }

    if (!hasPopulatedUserDocument(student.userId)) {
      console.warn("[teacher-dashboard] skipped_orphan_student", {
        studentId: student.studentId,
      });
      continue;
    }

    const publicStudent = toPublicStudent(student, student.userId);
    const { jenjang, classKey } = getAcademicInfo(publicStudent.className);
    const normalizedKey = classKey === `${jenjang}-unknown`
      ? buildClassKey(jenjang, extractGrade(publicStudent.className))
      : classKey;

    const branchClassKey = buildBranchClassKey(publicStudent.branch, normalizedKey);

    studentsByClassKey.set(branchClassKey, [
      ...(studentsByClassKey.get(branchClassKey) ?? []),
      publicStudent,
    ]);
  }

  return studentsByClassKey;
}

function getCurrentIndonesianDay(): string {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    timeZone: "Asia/Jakarta",
  }).format(new Date());
}

export const getMyTeacherDashboard = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const teacher = await Teacher.findOne({ userId: req.user._id }).exec();

    if (!teacher) {
      next(new AppError(404, "Profil guru tidak ditemukan."));
      return;
    }

    const { academicYear, semester } = resolveAcademicPeriodFromQuery(req.query);
    const [scheduleDocuments, studentsByClassKey] = await Promise.all([
      getTeacherSchedules(teacher._id.toString(), {
        academicYear,
        semester,
      }),
      getStudentsByClassKey(),
    ]);
    const schedules = buildSchedulePresentation(scheduleDocuments);
    const dashboardClasses: DashboardClass[] = schedules.map((schedule) => {
      const academicInfo = getAcademicInfo(schedule.className);
      const branch = normalizeText(schedule.branch);
      const participants =
        studentsByClassKey.get(buildBranchClassKey(branch, academicInfo.classKey)) ?? [];

      return {
        id: schedule.id,
        classKey: academicInfo.classKey,
        className: schedule.className,
        branch,
        jenjang: academicInfo.jenjang,
        tingkat: academicInfo.tingkat,
        mapel: teacher.subject,
        day: schedule.day,
        time: schedule.time,
        room: schedule.room,
        status: schedule.status,
        conflicts: schedule.conflicts,
        participants,
      };
    });
    const totalStudents = new Set(
      dashboardClasses.flatMap((dashboardClass) =>
        dashboardClass.participants.map((participant) => participant.id),
      ),
    ).size;
    const activeScheduleCount = dashboardClasses.filter(
      (dashboardClass) => dashboardClass.status === "Berjalan",
    ).length;
    const todayLabel = normalizeText(getCurrentIndonesianDay()).toLowerCase();
    const todaySchedules = dashboardClasses.filter(
      (dashboardClass) =>
        normalizeText(dashboardClass.day).toLowerCase() === todayLabel,
    ).length;

    sendSuccess(res, {
      data: {
        teacher: {
          id: teacher.teacherId,
          name: req.user.nama,
          email: req.user.email,
          avatar: req.user.avatar,
          subject: teacher.subject,
          branch: teacher.branch,
          branches: Array.from(
            new Set([teacher.branch, ...(teacher.branches ?? [])].filter(Boolean)),
          ),
          phone: teacher.phone,
          schedule: teacher.schedule,
          activeClasses: teacher.activeClasses,
          classList: teacher.classList,
          status: teacher.status,
          availability: teacher.availability,
          roleLabel: `Guru ${teacher.subject}`,
          initials: buildInitials(req.user.nama),
        },
        classes: dashboardClasses,
        summary: {
          totalClasses: dashboardClasses.length,
          totalSchedules: dashboardClasses.length,
          totalStudents,
          todaySchedules,
          activeSchedules: activeScheduleCount,
        },
      },
    });
  },
);
