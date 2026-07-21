import type { NextFunction, Request } from "express";

import { isAcademicPeriodEditable } from "./academicGrade";
import { AppError } from "./apiResponse";

export const TEACHER_ACADEMIC_ARCHIVE_MESSAGE =
  "Tahun ajaran ini sudah menjadi arsip. Data guru hanya bisa dilihat.";

export function ensureTeacherAcademicPeriodEditable(
  req: Request,
  next: NextFunction,
) {
  if (isAcademicPeriodEditable(req.query)) {
    return true;
  }

  next(new AppError(403, TEACHER_ACADEMIC_ARCHIVE_MESSAGE));
  return false;
}
