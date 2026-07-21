import type { NextFunction, Request, Response } from "express";

import { AttendanceSession } from "../models/AttendanceSession";
import { TeacherClassSetting } from "../models/TeacherClassSetting";
import asyncHandler from "../utils/asyncHandler";
import { AppError, sendSuccess } from "../utils/apiResponse";
import { ensureTeacherAcademicPeriodEditable } from "../utils/teacherAcademicArchive";
import { resolveTeacherClassDetailContext } from "./teacherScheduleController";

type UpdateTeacherClassSettingBody = {
  targetMeetingCount?: number | string;
};

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function normalizeTargetMeetingCount(value: number | string | undefined) {
  const parsedValue =
    typeof value === "number" ? value : Number.parseInt(normalizeText(value), 10);

  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    return null;
  }

  return parsedValue;
}

export const updateTeacherClassSetting = asyncHandler(
  async (
    req: Request<
      { classId: string },
      Record<string, never>,
      UpdateTeacherClassSettingBody
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

    const targetMeetingCount = normalizeTargetMeetingCount(
      req.body.targetMeetingCount,
    );

    if (targetMeetingCount === null) {
      next(new AppError(400, "Target pertemuan wajib berupa angka bulat minimal 1."));
      return;
    }

    const { teacher, classGroup } = await resolveTeacherClassDetailContext(
      req.user._id.toString(),
      req.params.classId,
    );
    const completedMeetingCount = await AttendanceSession.countDocuments({
      teacherId: teacher._id,
      classId: classGroup.item.id,
      status: "closed",
    }).exec();

    if (targetMeetingCount < completedMeetingCount) {
      next(
        new AppError(
          400,
          `Target pertemuan tidak boleh lebih kecil dari ${completedMeetingCount} sesi yang sudah ditutup.`,
        ),
      );
      return;
    }

    const setting = await TeacherClassSetting.findOneAndUpdate(
      {
        teacherId: teacher._id,
        classId: classGroup.item.id,
      },
      {
        $set: {
          className: classGroup.item.className,
          branch: classGroup.item.branch,
          targetMeetingCount,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    ).exec();

    sendSuccess(res, {
      message: "Target total pertemuan kelas berhasil diperbarui.",
      data: {
        classSetting: {
          classId: setting.classId,
          teacherId: setting.teacherId.toString(),
          className: setting.className,
          branch: setting.branch,
          targetMeetingCount: setting.targetMeetingCount,
          createdAt: setting.createdAt?.toISOString() ?? null,
          updatedAt: setting.updatedAt?.toISOString() ?? null,
        },
      },
    });
  },
);
