import type { NextFunction, Request, Response } from "express";

import { ClassMaterial } from "../models/ClassMaterial";
import { ClassTask } from "../models/ClassTask";
import { Schedule } from "../models/Schedule";
import { TaskGrade } from "../models/TaskGrade";
import { TaskSubmission } from "../models/TaskSubmission";
import { User } from "../models/User";
import asyncHandler from "../utils/asyncHandler";
import { AppError, sendSuccess } from "../utils/apiResponse";
import {
  buildStudentLearningClassFilter,
  normalizeText,
} from "../utils/classroomLearning";
import {
  buildSchedulePresentation,
  type ScheduleWithTeacher,
} from "../utils/scheduleConflicts";
import { normalizeCanonicalClassName } from "../utils/studentClass";
import {
  buildAcademicRecordSubscriptionFilter,
  getMembershipSnapshotByUserId,
  type StudentWithUser,
} from "../utils/subscription";
import { resolveStudentAcademicContentAccess } from "../utils/studentAcademicAccess";
import { resolveStudentMembershipContentAccess } from "../utils/studentMembershipAccess";
import {
  buildStudentAcademicTaskFilter,
  getStudentEffectiveAcademicJoinedAt,
  parseValidDate,
} from "../utils/studentAcademicStatus";

type StudentNotificationType =
  | "schedule"
  | "task"
  | "material"
  | "billing"
  | "grade";

type StudentNotificationItem = {
  id: string;
  title: string;
  message: string;
  type: StudentNotificationType;
  createdAt: string;
  read: boolean;
  href?: string;
};

type StudentScheduleItem = {
  id: string;
  day: string;
  time: string;
  className: string;
  subject: string;
  teacher: string;
  room: string;
  branch: string;
  status: string;
};

const orderedScheduleDays = [
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
  "Minggu",
] as const;

const scheduleDayOrderMap = new Map(
  orderedScheduleDays.map((day, index) => [day.toLowerCase(), index]),
);

const MAX_NOTIFICATION_ITEMS = 5;
const UPCOMING_TASK_WINDOW_DAYS = 3;
const RECENT_MATERIAL_WINDOW_DAYS = 14;
const RECENT_GRADE_WINDOW_DAYS = 30;

function toIsoDate(value: Date | null | undefined) {
  return value instanceof Date && !Number.isNaN(value.getTime())
    ? value.toISOString()
    : new Date().toISOString();
}

function getCurrentIndonesianDay() {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    timeZone: "Asia/Jakarta",
  }).format(new Date());
}

function getJakartaDateKey(value: Date | number = 0) {
  const date =
    value instanceof Date
      ? value
      : new Date(Date.now() + value * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Jakarta",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

function buildClassContentPeriodFilter(
  period: { academicYear: string; semester: string },
  legacyFilter: Record<string, unknown> = {},
) {
  return {
    $or: [
      {
        academicYear: period.academicYear,
        semester: period.semester,
      },
      {
        $and: [
          {
            $or: [
              { academicYear: null },
              { academicYear: { $exists: false } },
            ],
          },
          legacyFilter,
        ],
      },
    ],
  };
}

function parseDateValue(value: string | Date | null | undefined) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  const normalizedValue =
    typeof value === "string" ? normalizeText(value) : "";

  if (!normalizedValue) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    const parsedDate = new Date(`${normalizedValue}T00:00:00+07:00`);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  const parsedDate = new Date(normalizedValue);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function formatIndonesianDate(value: string | Date | null | undefined) {
  const parsedDate = parseDateValue(value);

  if (!parsedDate) {
    return normalizeText(typeof value === "string" ? value : "") || "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(parsedDate);
}

function getScheduleDayOrder(day: string) {
  return (
    scheduleDayOrderMap.get(normalizeText(day).toLowerCase()) ??
    Number.MAX_SAFE_INTEGER
  );
}

function getScheduleTimeOrder(time: string) {
  const [startTime] = normalizeText(time).split("-");
  const matchedTime = startTime?.trim().match(/^(\d{1,2})[:.](\d{2})$/);

  if (!matchedTime) {
    return Number.MAX_SAFE_INTEGER;
  }

  const hours = Number(matchedTime[1] ?? "0");
  const minutes = Number(matchedTime[2] ?? "0");

  return hours * 60 + minutes;
}

function getRelativeScheduleDayDistance(day: string, currentDay: string) {
  const currentDayOrder = getScheduleDayOrder(currentDay);
  const targetDayOrder = getScheduleDayOrder(day);

  if (
    currentDayOrder === Number.MAX_SAFE_INTEGER ||
    targetDayOrder === Number.MAX_SAFE_INTEGER
  ) {
    return Number.MAX_SAFE_INTEGER;
  }

  return (targetDayOrder - currentDayOrder + orderedScheduleDays.length) %
    orderedScheduleDays.length;
}

function matchesStudentScheduleClass(
  scheduleClassName: string,
  studentClassName: string,
  canonicalClassName: string,
) {
  const normalizedScheduleClassName = normalizeText(scheduleClassName);
  const normalizedStudentClassName = normalizeText(studentClassName);

  if (
    normalizedScheduleClassName.toLowerCase() ===
    normalizedStudentClassName.toLowerCase()
  ) {
    return true;
  }

  if (!canonicalClassName) {
    return false;
  }

  return (
    normalizeCanonicalClassName(normalizedScheduleClassName)?.toLowerCase() ===
    canonicalClassName.toLowerCase()
  );
}

function isIsoDateKey(value: string | null | undefined) {
  return /^\d{4}-\d{2}-\d{2}$/.test(normalizeText(value));
}

function getDateKeyDifference(targetDateKey: string, baseDateKey: string) {
  if (!isIsoDateKey(targetDateKey) || !isIsoDateKey(baseDateKey)) {
    return Number.MAX_SAFE_INTEGER;
  }

  const targetDate = new Date(`${targetDateKey}T00:00:00+07:00`);
  const baseDate = new Date(`${baseDateKey}T00:00:00+07:00`);

  if (
    Number.isNaN(targetDate.getTime()) ||
    Number.isNaN(baseDate.getTime())
  ) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Math.round(
    (targetDate.getTime() - baseDate.getTime()) / (24 * 60 * 60 * 1000),
  );
}

function isWithinRecentWindow(
  value: Date | null | undefined,
  windowDays: number,
) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return false;
  }

  const difference = Date.now() - value.getTime();
  const windowMs = windowDays * 24 * 60 * 60 * 1000;

  return difference >= 0 && difference <= windowMs;
}

async function getStudentSchedules(
  student: StudentWithUser,
  period?: { academicYear: string; semester: string },
) {
  const canonicalClassName =
    normalizeCanonicalClassName(student.className)?.toLowerCase() ?? "";
  const normalizedBranch = normalizeText(student.branch).toLowerCase();
  const currentDay = getCurrentIndonesianDay();
  const scheduleDocuments = (await Schedule.find(
    period ? buildClassContentPeriodFilter(period) : {},
  )
    .populate<{
      teacherId: {
        teacherId: string;
        branch: string;
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

  return buildSchedulePresentation(scheduleDocuments)
    .filter((schedule) => {
      const matchesClassName = matchesStudentScheduleClass(
        schedule.className,
        student.className,
        canonicalClassName,
      );
      const scheduleBranch = normalizeText(schedule.branch).toLowerCase();
      const matchesBranch = normalizedBranch
        ? scheduleBranch === normalizedBranch || !scheduleBranch
        : true;

      return matchesClassName && matchesBranch;
    })
    .sort((leftSchedule, rightSchedule) => {
      const distanceDifference =
        getRelativeScheduleDayDistance(leftSchedule.day, currentDay) -
        getRelativeScheduleDayDistance(rightSchedule.day, currentDay);

      if (distanceDifference !== 0) {
        return distanceDifference;
      }

      return (
        getScheduleTimeOrder(leftSchedule.time) -
        getScheduleTimeOrder(rightSchedule.time)
      );
    })
    .map<StudentScheduleItem>((schedule) => ({
      id: schedule.id,
      day: normalizeText(schedule.day),
      time: normalizeText(schedule.time),
      className: normalizeText(schedule.className),
      subject: normalizeText(schedule.subject) || "Mapel belum diatur",
      teacher: normalizeText(schedule.teacher) || "Guru belum diatur",
      room: normalizeText(schedule.room) || "Ruangan belum diatur",
      branch: normalizeText(schedule.branch),
      status: normalizeText(schedule.status) || "Siap",
    }));
}

export const getMyStudentNotifications = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const membershipSnapshot = await getMembershipSnapshotByUserId(
      req.user._id.toString(),
    );
    const student = membershipSnapshot.student;

    if (!student || student.status !== "Aktif") {
      next(new AppError(404, "Profil siswa aktif tidak ditemukan."));
      return;
    }

    const academicAccess = await resolveStudentAcademicContentAccess(student);
    const membershipAccess = resolveStudentMembershipContentAccess(
      membershipSnapshot.accessStatus,
      {
        subscription: membershipSnapshot.subscription,
        payment: membershipSnapshot.payment,
      },
    );
    const classFilter = buildStudentLearningClassFilter(
      student.className,
      student.branch,
    );
    const academicJoinedAt = getStudentEffectiveAcademicJoinedAt(
      student,
      membershipSnapshot.subscription,
    );
    const subscriptionId = membershipSnapshot.subscription?._id ?? null;
    const subscriptionStartAt =
      parseValidDate(membershipSnapshot.subscription?.startDate) ?? academicJoinedAt;
    const subscriptionEndAt = parseValidDate(membershipSnapshot.subscription?.endDate);
    const materialDateRange: Record<string, string> = {};

    if (subscriptionStartAt) {
      materialDateRange.$gte = getJakartaDateKey(subscriptionStartAt);
    }

    if (subscriptionEndAt) {
      materialDateRange.$lt = getJakartaDateKey(subscriptionEndAt);
    }

    const shouldHideAcademicNotifications =
      membershipAccess.isMembershipLocked ||
      academicAccess.isUpcomingClassLocked ||
      !academicJoinedAt;
    const [materials, tasks, schedules] =
      shouldHideAcademicNotifications || !academicJoinedAt
        ? [[], [], []]
        : await Promise.all([
          ClassMaterial.find({
            $and: [
              classFilter,
              { status: "Dipublikasikan" },
              buildClassContentPeriodFilter(
                academicAccess.period,
                Object.keys(materialDateRange).length > 0
                  ? { date: materialDateRange }
                  : {},
              ),
            ],
          })
            .select("materialId subject title date createdAt updatedAt")
            .sort({ updatedAt: -1, createdAt: -1 })
            .lean()
            .exec(),
          ClassTask.find({
            $and: [
              classFilter,
              buildStudentAcademicTaskFilter(subscriptionStartAt ?? academicJoinedAt),
              buildClassContentPeriodFilter(academicAccess.period),
            ],
          })
            .select("taskId classId title deadline createdAt updatedAt")
            .sort({ deadline: 1, updatedAt: -1, createdAt: -1 })
            .lean()
            .exec(),
          getStudentSchedules(student, academicAccess.period),
        ]);

    const normalizedTaskIds = tasks
      .map((task) => normalizeText(task.taskId))
      .filter(Boolean);
    const normalizedClassIds = Array.from(
      new Set(tasks.map((task) => normalizeText(task.classId)).filter(Boolean)),
    );

    const [submissions, rawGrades] = await Promise.all([
      normalizedTaskIds.length > 0
        ? TaskSubmission.find({
            studentId: normalizeText(student.studentId),
            taskId: {
              $in: normalizedTaskIds,
            },
            ...buildAcademicRecordSubscriptionFilter(subscriptionId),
          })
            .select("taskId submittedAt createdAt updatedAt")
            .sort({ updatedAt: -1, createdAt: -1 })
            .lean()
            .exec()
        : [],
      normalizedTaskIds.length > 0
        ? TaskGrade.find({
            studentId: normalizeText(student.studentId),
            classId: {
              $in: normalizedClassIds,
            },
            taskId: {
              $in: normalizedTaskIds,
            },
            status: "Sudah Dinilai",
            ...buildAcademicRecordSubscriptionFilter(subscriptionId),
          })
            .select("taskId score status gradedAt createdAt updatedAt")
            .sort({ gradedAt: -1, updatedAt: -1, createdAt: -1 })
            .lean()
            .exec()
        : [],
    ]);
    const grades = rawGrades.filter((grade) => {
      if (!academicJoinedAt) {
        return false;
      }

      const gradeDate = parseValidDate(
        grade.gradedAt ?? grade.updatedAt ?? grade.createdAt,
      );

      return Boolean(
        gradeDate &&
          gradeDate.getTime() >=
            (subscriptionStartAt ?? academicJoinedAt).getTime(),
      );
    });

    const notifications: StudentNotificationItem[] = [];
    const todayLabel = normalizeText(getCurrentIndonesianDay()).toLowerCase();
    const todayKey = getJakartaDateKey();
    const taskById = new Map(
      tasks.map((task) => [normalizeText(task.taskId), task] as const),
    );
    const submissionByTaskId = new Map(
      submissions.map((submission) => [
        normalizeText(submission.taskId),
        submission,
      ] as const),
    );
    const gradeByTaskId = new Map(
      grades.map((grade) => [normalizeText(grade.taskId), grade] as const),
    );

    const todaySchedules = schedules.filter(
      (schedule) => normalizeText(schedule.day).toLowerCase() === todayLabel,
    );
    const nextSchedule = schedules[0];

    if (todaySchedules.length > 0) {
      const primarySchedule = todaySchedules[0];
      const scheduleMessage =
        todaySchedules.length === 1
          ? `Hari ini ada kelas ${normalizeText(primarySchedule.subject)} pukul ${normalizeText(primarySchedule.time)} bersama ${normalizeText(primarySchedule.teacher)}.`
          : `Hari ini ada ${todaySchedules.length} jadwal belajar. Kelas pertama dimulai pukul ${normalizeText(primarySchedule.time)}.`;

      notifications.push({
        id: "student-schedule-today",
        title: "Jadwal Hari Ini",
        message: scheduleMessage,
        type: "schedule",
        createdAt: new Date().toISOString(),
        read: false,
        href: "/dashboard-siswa/jadwal",
      });
    } else if (nextSchedule) {
      const dayDistance = getRelativeScheduleDayDistance(
        nextSchedule.day,
        getCurrentIndonesianDay(),
      );
      const nextScheduleTitle =
        dayDistance === 1 ? "Jadwal Besok" : "Jadwal Berikutnya";
      const nextScheduleMessage =
        dayDistance === 1
          ? `Besok ada kelas ${normalizeText(nextSchedule.subject)} pukul ${normalizeText(nextSchedule.time)} bersama ${normalizeText(nextSchedule.teacher)}.`
          : `${normalizeText(nextSchedule.day)} ada kelas ${normalizeText(nextSchedule.subject)} pukul ${normalizeText(nextSchedule.time)} bersama ${normalizeText(nextSchedule.teacher)}.`;

      notifications.push({
        id: "student-next-schedule",
        title: nextScheduleTitle,
        message: nextScheduleMessage,
        type: "schedule",
        createdAt: new Date().toISOString(),
        read: false,
        href: "/dashboard-siswa/jadwal",
      });
    }

    const overdueTasks = tasks.filter((task) => {
      const taskId = normalizeText(task.taskId);
      const deadline = normalizeText(task.deadline);

      return (
        !submissionByTaskId.has(taskId) &&
        !gradeByTaskId.has(taskId) &&
        isIsoDateKey(deadline) &&
        deadline < todayKey
      );
    });

    if (overdueTasks.length > 0) {
      const primaryTask = overdueTasks[0];
      const overdueMessage =
        overdueTasks.length === 1
          ? `Latihan "${normalizeText(primaryTask.title)}" sudah melewati deadline ${formatIndonesianDate(primaryTask.deadline)} dan belum dikerjakan.`
          : `Ada ${overdueTasks.length} latihan yang sudah melewati deadline. Latihan terdekat berakhir pada ${formatIndonesianDate(primaryTask.deadline)}.`;

      notifications.push({
        id: "student-task-overdue",
        title: "Latihan Terlewat",
        message: overdueMessage,
        type: "task",
        createdAt: toIsoDate(primaryTask.updatedAt ?? primaryTask.createdAt),
        read: false,
        href: "/dashboard-siswa/latihan",
      });
    } else {
      const upcomingTasks = tasks.filter((task) => {
        const taskId = normalizeText(task.taskId);
        const deadline = normalizeText(task.deadline);

        if (submissionByTaskId.has(taskId) || gradeByTaskId.has(taskId)) {
          return false;
        }

        const dayDifference = getDateKeyDifference(deadline, todayKey);
        return dayDifference >= 0 && dayDifference <= UPCOMING_TASK_WINDOW_DAYS;
      });

      if (upcomingTasks.length > 0) {
        const primaryTask = upcomingTasks[0];
        const upcomingTaskMessage =
          upcomingTasks.length === 1
            ? `Latihan "${normalizeText(primaryTask.title)}" perlu dikerjakan paling lambat ${formatIndonesianDate(primaryTask.deadline)}.`
            : `Ada ${upcomingTasks.length} latihan dengan deadline dalam ${UPCOMING_TASK_WINDOW_DAYS} hari ke depan.`;

        notifications.push({
          id: "student-task-upcoming",
          title: "Deadline Latihan Dekat",
          message: upcomingTaskMessage,
          type: "task",
          createdAt: toIsoDate(primaryTask.updatedAt ?? primaryTask.createdAt),
          read: false,
          href: "/dashboard-siswa/latihan",
        });
      }
    }

    const recentMaterials = materials.filter((material) =>
      isWithinRecentWindow(
        material.updatedAt ?? material.createdAt ?? null,
        RECENT_MATERIAL_WINDOW_DAYS,
      ),
    );

    if (recentMaterials.length > 0) {
      const primaryMaterial = recentMaterials[0];
      const materialMessage =
        recentMaterials.length === 1
          ? `Materi "${normalizeText(primaryMaterial.title)}" untuk ${normalizeText(primaryMaterial.subject) || "kelas kamu"} sudah tersedia untuk dipelajari.`
          : `Ada ${recentMaterials.length} materi yang baru dibagikan untuk kelas kamu.`;

      notifications.push({
        id: "student-new-material",
        title: "Materi Baru",
        message: materialMessage,
        type: "material",
        createdAt: toIsoDate(
          primaryMaterial.updatedAt ?? primaryMaterial.createdAt,
        ),
        read: false,
        href: "/dashboard-siswa/materi",
      });
    }

    const recentGrades = grades.filter((grade) =>
      isWithinRecentWindow(
        grade.gradedAt ?? grade.updatedAt ?? grade.createdAt ?? null,
        RECENT_GRADE_WINDOW_DAYS,
      ),
    );

    if (recentGrades.length > 0) {
      const primaryGrade = recentGrades[0];
      const relatedTask = taskById.get(normalizeText(primaryGrade.taskId));
      const relatedTaskTitle =
        normalizeText(relatedTask?.title) || "latihan terbaru";
      const scoreLabel =
        typeof primaryGrade.score === "number" && Number.isFinite(primaryGrade.score)
          ? `${primaryGrade.score}/100`
          : "sudah tersedia";
      const gradeMessage =
        recentGrades.length === 1
          ? `Nilai untuk ${relatedTaskTitle} sudah tersedia dengan skor ${scoreLabel}.`
          : `Ada ${recentGrades.length} latihan yang sudah dinilai. Nilai terbaru tercatat ${scoreLabel}.`;

      notifications.push({
        id: "student-grade-updated",
        title: "Nilai Latihan Terbit",
        message: gradeMessage,
        type: "grade",
        createdAt: toIsoDate(
          primaryGrade.gradedAt ?? primaryGrade.updatedAt ?? primaryGrade.createdAt,
        ),
        read: false,
        href: "/dashboard-siswa/nilai",
      });
    }

    const latestPayment = membershipSnapshot.payment;
    const primarySubscription = membershipSnapshot.subscription;
    const latestPackageLabel =
      normalizeText(latestPayment?.packageName) ||
      normalizeText(primarySubscription?.packageName) ||
      "membership";

    if (membershipAccess.isScheduledAccess) {
      notifications.push({
        id: "student-billing-scheduled",
        title: "Akses Belajar Terjadwal",
        message:
          membershipAccess.message ??
          `${latestPackageLabel} sudah tercatat dan akses belajar akan dibuka pada tanggal mulai membership.`,
        type: "billing",
        createdAt: toIsoDate(
          primarySubscription?.updatedAt ?? latestPayment?.updatedAt,
        ),
        read: false,
        href: "/dashboard-siswa/tagihan",
      });
    } else if (
      membershipSnapshot.accessStatus === "pending" ||
      latestPayment?.status === "pending"
    ) {
      const pendingBillingMessage = latestPayment?.expiresAt
        ? `Pembayaran ${latestPackageLabel} masih menunggu penyelesaian hingga ${formatIndonesianDate(latestPayment.expiresAt)}.`
        : `Aktivasi ${latestPackageLabel} masih menunggu penyelesaian pembayaran.`;

      notifications.push({
        id: "student-billing-pending",
        title: "Tagihan Menunggu Pembayaran",
        message: pendingBillingMessage,
        type: "billing",
        createdAt: toIsoDate(
          latestPayment?.updatedAt ?? primarySubscription?.updatedAt,
        ),
        read: false,
        href: "/dashboard-siswa/tagihan",
      });
    } else if (
      latestPayment?.status === "failed" ||
      latestPayment?.status === "expired" ||
      membershipSnapshot.accessStatus === "expired"
    ) {
      const expiredBillingMessage =
        membershipSnapshot.accessStatus === "expired" &&
        primarySubscription?.endDate
          ? `Masa aktif ${latestPackageLabel} berakhir pada ${formatIndonesianDate(primarySubscription.endDate)} dan perlu diperbarui.`
          : `Status pembayaran ${latestPackageLabel} ${latestPayment?.status === "failed" ? "gagal" : "kedaluwarsa"} dan perlu ditindaklanjuti.`;

      notifications.push({
        id: "student-billing-expired",
        title: "Membership Perlu Diperbarui",
        message: expiredBillingMessage,
        type: "billing",
        createdAt: toIsoDate(
          latestPayment?.updatedAt ?? primarySubscription?.updatedAt,
        ),
        read: false,
        href: "/dashboard-siswa/tagihan",
      });
    } else if (
      membershipSnapshot.accessStatus === "expiring" &&
      typeof membershipSnapshot.daysRemaining === "number" &&
      membershipSnapshot.daysRemaining <= 14
    ) {
      const renewalMessage =
        membershipSnapshot.daysRemaining <= 0
          ? `Masa aktif ${latestPackageLabel} berakhir hari ini.`
          : `Masa aktif ${latestPackageLabel} akan berakhir dalam ${membershipSnapshot.daysRemaining} hari.`;

      notifications.push({
        id: "student-billing-renewal",
        title: "Membership Hampir Berakhir",
        message: renewalMessage,
        type: "billing",
        createdAt: new Date().toISOString(),
        read: false,
        href: "/dashboard-siswa/tagihan",
      });
    }

    notifications.sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );

    const visibleNotifications = notifications.slice(0, MAX_NOTIFICATION_ITEMS);

    sendSuccess(res, {
      message: "Notifikasi siswa berhasil diambil.",
      data: {
        notifications: visibleNotifications,
        unreadCount: visibleNotifications.filter((notification) => !notification.read)
          .length,
        academicAccess,
        membershipAccess,
      },
    });
  },
);
