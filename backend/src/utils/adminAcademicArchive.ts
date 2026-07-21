import {
  getAcademicPeriodForYear,
  getCurrentAcademicPeriod,
  type AcademicPeriod,
} from "./academicGrade";
import { AppError } from "./apiResponse";

export const ADMIN_ACADEMIC_ARCHIVE_MESSAGE =
  "Tahun ajaran ini belum aktif atau sudah menjadi arsip. Data hanya bisa dilihat dan diekspor.";

function normalizeAcademicYearInput(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function resolveAdminAcademicPeriod(
  academicYear: unknown,
): AcademicPeriod {
  return getAcademicPeriodForYear(normalizeAcademicYearInput(academicYear));
}

export function assertAdminAcademicPeriodEditable(
  academicYear: unknown,
): AcademicPeriod {
  const period = resolveAdminAcademicPeriod(academicYear);
  const currentPeriod = getCurrentAcademicPeriod();

  if (period.academicYear !== currentPeriod.academicYear) {
    throw new AppError(403, ADMIN_ACADEMIC_ARCHIVE_MESSAGE);
  }

  return period;
}
