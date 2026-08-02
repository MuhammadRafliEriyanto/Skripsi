export const TEACHER_VISIBLE_ACADEMIC_YEAR = "2026/2027";
const TEACHER_DEMO_SOURCE_ACADEMIC_YEAR = "2025/2026";

export type TeacherAcademicPeriodFilters = {
  academicYear?: string;
  semester?: string;
};

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function buildExactAcademicPeriodFilter(filters?: TeacherAcademicPeriodFilters) {
  const periodFilter: Record<string, string> = {};
  const academicYear = normalizeText(filters?.academicYear);
  const semester = normalizeText(filters?.semester);

  if (academicYear) {
    periodFilter.academicYear = academicYear;
  }

  if (semester) {
    periodFilter.semester = semester;
  }

  return periodFilter;
}

export function buildTeacherAcademicPeriodOrLegacyFilter(
  filters?: TeacherAcademicPeriodFilters,
) {
  const periodFilter = buildExactAcademicPeriodFilter(filters);

  if (Object.keys(periodFilter).length === 0) {
    return {};
  }

  const periodCandidates: Array<Record<string, string>> = [periodFilter];

  if (periodFilter.academicYear === TEACHER_VISIBLE_ACADEMIC_YEAR) {
    periodCandidates.push({
      academicYear: TEACHER_DEMO_SOURCE_ACADEMIC_YEAR,
    });
  }

  return {
    $or: [
      ...periodCandidates,
      { academicYear: null },
      { academicYear: { $exists: false } },
    ],
  };
}
