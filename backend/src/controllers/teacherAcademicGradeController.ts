import type { NextFunction, Request, Response } from "express";

import { AcademicGrade } from "../models/AcademicGrade";
import {
  getAcademicGradeScheme,
  getAcademicGradeScoreKeys,
  getCurrentAcademicPeriod,
  toPublicAcademicGrade,
} from "../utils/academicGrade";
import asyncHandler from "../utils/asyncHandler";
import { AppError, sendSuccess } from "../utils/apiResponse";
import { normalizeText } from "../utils/classroomLearning";
import { getNextPublicId } from "../utils/publicId";
import { resolveTeacherClassDetailContext } from "./teacherScheduleController";
import { parseValidDate } from "../utils/studentAcademicStatus";

type AcademicScoreInput = number | string | null;

type UpsertAcademicGradeBody = {
  scores?: {
    uts?: AcademicScoreInput;
    uas?: AcademicScoreInput;
    uts1?: AcademicScoreInput;
    uts2?: AcademicScoreInput;
    uts3?: AcademicScoreInput;
    tryout1?: AcademicScoreInput;
    tryout2?: AcademicScoreInput;
    tryout3?: AcademicScoreInput;
  };
  note?: string;
};

function normalizeOptionalScore(value: AcademicScoreInput | undefined) {
  if (value === undefined || value === null || normalizeText(String(value)) === "") {
    return { valid: true, value: null } as const;
  }

  const parsedValue =
    typeof value === "number" ? value : Number.parseFloat(normalizeText(value));

  if (!Number.isFinite(parsedValue) || parsedValue < 0 || parsedValue > 100) {
    return { valid: false, value: null } as const;
  }

  return { valid: true, value: Math.round(parsedValue) } as const;
}

export const upsertTeacherClassAcademicGrade = asyncHandler(
  async (
    req: Request<
      { classId: string; studentId: string },
      Record<string, never>,
      UpsertAcademicGradeBody
    >,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const { teacher, classGroup, participants } =
      await resolveTeacherClassDetailContext(
        req.user._id.toString(),
        req.params.classId,
      );
    const studentId = normalizeText(req.params.studentId);
    const participant = participants.find(
      (participant) =>
        normalizeText(participant.studentId).toLowerCase() ===
        studentId.toLowerCase(),
    );

    if (!studentId || !participant) {
      next(new AppError(404, "Siswa kelas untuk penilaian tidak ditemukan."));
      return;
    }

    const academicJoinedAt = parseValidDate(participant.academicJoinedAt);

    if (!academicJoinedAt || academicJoinedAt.getTime() > Date.now()) {
      next(new AppError(404, "Siswa kelas untuk penilaian tidak ditemukan."));
      return;
    }

    const scheme = getAcademicGradeScheme(classGroup.className);
    const scoreKeys = getAcademicGradeScoreKeys(scheme);
    const scoreUpdates: Record<string, number | null> = {
      uts: null,
      uas: null,
      uts1: null,
      uts2: null,
      uts3: null,
      tryout1: null,
      tryout2: null,
      tryout3: null,
    };

    for (const scoreKey of scoreKeys) {
      const normalizedScore = normalizeOptionalScore(req.body.scores?.[scoreKey]);

      if (!normalizedScore.valid) {
        next(new AppError(400, "Nilai evaluasi wajib berupa angka 0 sampai 100."));
        return;
      }

      scoreUpdates[scoreKey] = normalizedScore.value;
    }

    const note = normalizeText(req.body.note);
    const period = getCurrentAcademicPeriod();
    const existingGrade = await AcademicGrade.findOne({
      teacherId: teacher._id,
      classId: classGroup.item.id,
      studentId,
      academicYear: period.academicYear,
      semester: period.semester,
    }).exec();
    const hasScore = scoreKeys.some((scoreKey) => scoreUpdates[scoreKey] !== null);

    if (!hasScore && !note) {
      if (existingGrade) {
        await existingGrade.deleteOne();
      }

      sendSuccess(res, {
        message: "Nilai evaluasi siswa berhasil dikosongkan.",
        data: {
          academicGrade: null,
          scheme,
          period,
        },
      });
      return;
    }

    const academicGradeId =
      existingGrade?.academicGradeId ??
      (await getNextPublicId(AcademicGrade, "academicGradeId", "ACG"));
    const academicGrade = await AcademicGrade.findOneAndUpdate(
      {
        teacherId: teacher._id,
        classId: classGroup.item.id,
        studentId,
        academicYear: period.academicYear,
        semester: period.semester,
      },
      {
        $set: {
          academicGradeId,
          scheme,
          ...scoreUpdates,
          note,
          evaluatedAt: new Date(),
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    ).exec();

    sendSuccess(res, {
      message: "Nilai evaluasi siswa berhasil disimpan.",
      data: {
        academicGrade: academicGrade
          ? toPublicAcademicGrade(academicGrade)
          : null,
        scheme,
        period,
      },
    });
  },
);
