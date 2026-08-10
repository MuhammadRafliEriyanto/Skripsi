import type { NextFunction, Request, Response } from "express";

import { ClassTask } from "../models/ClassTask";
import { Schedule } from "../models/Schedule";
import { Teacher } from "../models/Teacher";
import { TeacherTryout } from "../models/TeacherTryout";
import asyncHandler from "../utils/asyncHandler";
import { AppError, sendSuccess } from "../utils/apiResponse";
import { getCurrentAcademicPeriod } from "../utils/academicGrade";
import { buildTeacherAcademicPeriodOrLegacyFilter } from "../utils/teacherAcademicPeriod";

type TeacherNotificationType = "schedule" | "class" | "task" | "tryout";

type TeacherNotificationItem = {
  id: string;
  title: string;
  message: string;
  type: TeacherNotificationType;
  createdAt: string;
  read: boolean;
  href?: string;
};

function normalizeText(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function getCurrentIndonesianDay(): string {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    timeZone: "Asia/Jakarta",
  }).format(new Date());
}

function toIsoDate(value: Date | null | undefined) {
  return value instanceof Date && !Number.isNaN(value.getTime())
    ? value.toISOString()
    : new Date().toISOString();
}

function buildTryoutStatusMessage(draftCount: number, publishedCount: number) {
  if (draftCount > 0 && publishedCount > 0) {
    return `${draftCount} tryout masih draft dan ${publishedCount} tryout sudah dipublikasikan.`;
  }

  if (draftCount > 0) {
    return `${draftCount} tryout masih berstatus draft dan siap dilengkapi.`;
  }

  return `${publishedCount} tryout sudah dipublikasikan dan siap dipantau.`;
}

export const getMyTeacherNotifications = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const teacher = await Teacher.findOne({ userId: req.user._id })
      .select("_id activeClasses updatedAt")
      .lean()
      .exec();

    if (!teacher) {
      next(new AppError(404, "Profil guru tidak ditemukan."));
      return;
    }

    const currentPeriod = getCurrentAcademicPeriod();
    const periodFilter = buildTeacherAcademicPeriodOrLegacyFilter(currentPeriod);
    const [schedules, pendingTasks, tryouts] = await Promise.all([
      Schedule.find({
        $and: [
          { teacherId: teacher._id },
          periodFilter,
        ],
      })
        .select("className day time createdAt updatedAt")
        .sort({ updatedAt: -1, createdAt: -1 })
        .lean()
        .exec(),
      ClassTask.find({
        $and: [
          {
            teacherId: teacher._id,
            reviewStatus: "Belum Dinilai",
          },
          periodFilter,
        ],
      })
        .select("taskId title classId createdAt updatedAt")
        .sort({ updatedAt: -1, createdAt: -1 })
        .lean()
        .exec(),
      TeacherTryout.find({
        $and: [
          { teacherId: teacher._id },
          periodFilter,
        ],
      })
        .select("tryoutId publishStatus createdAt updatedAt")
        .sort({ updatedAt: -1, createdAt: -1 })
        .lean()
        .exec(),
    ]);

    const notifications: TeacherNotificationItem[] = [];
    const todayLabel = normalizeText(getCurrentIndonesianDay()).toLowerCase();
    const todaySchedules = schedules.filter(
      (schedule) => normalizeText(schedule.day).toLowerCase() === todayLabel,
    );
    const uniqueClassCount = new Set(
      schedules
        .map((schedule) => normalizeText(schedule.className))
        .filter(Boolean)
        .map((className) => className.toLowerCase()),
    ).size;
    const activeClassCount =
      uniqueClassCount > 0 ? uniqueClassCount : teacher.activeClasses;
    const latestSchedule = schedules[0];

    if (todaySchedules.length > 0) {
      const primarySchedule = todaySchedules[0];
      const scheduleMessage =
        todaySchedules.length === 1
          ? `Hari ini ada 1 jadwal mengajar untuk ${normalizeText(primarySchedule.className)} pukul ${normalizeText(primarySchedule.time)}.`
          : `Hari ini ada ${todaySchedules.length} jadwal mengajar yang perlu dipantau.`;

      notifications.push({
        id: "teacher-schedule-today",
        title: "Jadwal Hari Ini",
        message: scheduleMessage,
        type: "schedule",
        createdAt: toIsoDate(primarySchedule.updatedAt ?? primarySchedule.createdAt),
        read: false,
        href: "/dashboard-guru/jadwal",
      });
    }

    if (activeClassCount > 0) {
      notifications.push({
        id: "teacher-active-classes",
        title: "Kelas Aktif",
        message: `Saat ini Anda mengampu ${activeClassCount} kelas aktif yang bisa dikelola dari menu Semua Kelas.`,
        type: "class",
        createdAt: toIsoDate(latestSchedule?.updatedAt ?? teacher.updatedAt),
        read: false,
        href: "/dashboard-guru/kelas",
      });
    }

    if (pendingTasks.length > 0) {
      const primaryTask = pendingTasks[0];
      const taskMessage =
        pendingTasks.length === 1
          ? `Latihan "${normalizeText(primaryTask.title)}" masih menunggu penilaian.`
          : `${pendingTasks.length} latihan masih berstatus Belum Dinilai dan perlu ditinjau.`;

      notifications.push({
        id: "teacher-pending-grades",
        title: "Latihan Perlu Dinilai",
        message: taskMessage,
        type: "task",
        createdAt: toIsoDate(primaryTask.updatedAt ?? primaryTask.createdAt),
        read: false,
        href: primaryTask.classId
          ? `/dashboard-guru/detail-kelas?kelasId=${encodeURIComponent(primaryTask.classId)}`
          : "/dashboard-guru/kelas",
      });
    }

    if (tryouts.length > 0) {
      const draftCount = tryouts.filter(
        (tryout) => tryout.publishStatus === "draft",
      ).length;
      const publishedCount = tryouts.filter(
        (tryout) => tryout.publishStatus === "published",
      ).length;

      notifications.push({
        id: "teacher-tryout-status",
        title: "Status Tryout",
        message: buildTryoutStatusMessage(draftCount, publishedCount),
        type: "tryout",
        createdAt: toIsoDate(tryouts[0]?.updatedAt ?? tryouts[0]?.createdAt),
        read: false,
        href: "/dashboard-guru/tryout",
      });
    }

    notifications.sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );

    sendSuccess(res, {
      message: "Notifikasi guru berhasil diambil.",
      data: {
        notifications,
        unreadCount: notifications.filter((notification) => !notification.read).length,
      },
    });
  },
);
