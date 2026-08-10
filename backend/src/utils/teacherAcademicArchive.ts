import type { NextFunction, Request } from "express";

export const TEACHER_ACADEMIC_ARCHIVE_MESSAGE =
  "Data jadwal ini hanya bisa diubah dari dashboard admin.";

export function ensureTeacherAcademicPeriodEditable(
  req: Request,
  next: NextFunction,
) {
  void req;
  void next;
  return true;
}
