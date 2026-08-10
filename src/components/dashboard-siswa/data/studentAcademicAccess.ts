export type StudentAcademicPeriod = {
  academicYear?: string;
  semester?: string;
};

export type StudentAcademicAccess = {
  isUpcomingClassLocked?: boolean;
  period?: StudentAcademicPeriod;
  startsAt?: string | null;
  className?: string;
  message?: string | null;
};

const UPCOMING_CLASS_FALLBACK_MESSAGE =
  "Membership belajar sudah tercatat. Pembelajaran akan dibuka saat paket membership aktif.";

export function getStudentAcademicAccessMessage(
  academicAccess: StudentAcademicAccess | null | undefined,
) {
  if (!academicAccess?.isUpcomingClassLocked) {
    return null;
  }

  return academicAccess.message?.trim() || UPCOMING_CLASS_FALLBACK_MESSAGE;
}
