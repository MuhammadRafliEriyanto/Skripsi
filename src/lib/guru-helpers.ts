import { type ReadonlyURLSearchParams } from "next/navigation";

export const GURU_ACTIVE_ACADEMIC_YEAR = "2026/2027";

const GURU_ACADEMIC_YEAR_OPTIONS = [GURU_ACTIVE_ACADEMIC_YEAR];

function normalizeGuruAcademicYear(value: string | null | undefined) {
  const normalizedValue = value?.trim() ?? "";

  return GURU_ACADEMIC_YEAR_OPTIONS.includes(normalizedValue)
    ? normalizedValue
    : GURU_ACTIVE_ACADEMIC_YEAR;
}

export function getGuruAcademicYearOptions() {
  return [...GURU_ACADEMIC_YEAR_OPTIONS];
}

/**
 * Returns the academic year and semester to use for fetching data.
 * Guru dashboard is temporarily pinned to the 2026/2027 demo period.
 */
export function getSelectedAcademicPeriod(
  searchParams: ReadonlyURLSearchParams | URLSearchParams,
) {
  return {
    academicYear: normalizeGuruAcademicYear(searchParams.get("academicYear")),
  };
}

export function getGuruAcademicYearStatus(
  searchParams: ReadonlyURLSearchParams | URLSearchParams,
) {
  const selectedPeriod = getSelectedAcademicPeriod(searchParams);
  const isActive = selectedPeriod.academicYear === GURU_ACTIVE_ACADEMIC_YEAR;

  return {
    academicYear: selectedPeriod.academicYear,
    currentAcademicYear: GURU_ACTIVE_ACADEMIC_YEAR,
    isActive,
    isArchive: !isActive,
  };
}

/**
 * Appends the pinned academicYear to a given path.
 */
export function buildGuruUrl(
  path: string,
  searchParams: ReadonlyURLSearchParams | URLSearchParams,
  additionalParams?: Record<string, string>,
) {
  const { academicYear } = getSelectedAcademicPeriod(searchParams);
  
  // Create a new URL object to properly handle paths that already have query strings
  const [basePath, existingQuery] = path.split("?");
  const params = new URLSearchParams(existingQuery || "");
  
  params.set("academicYear", academicYear);

  if (additionalParams) {
    Object.entries(additionalParams).forEach(([key, value]) => {
      params.set(key, value);
    });
  }
  
  return `${basePath}?${params.toString()}`;
}

/**
 * Appends the pinned academicYear to a base API URL.
 */
export function buildGuruApiUrl(
  baseApiUrl: string,
  searchParams: ReadonlyURLSearchParams | URLSearchParams,
) {
  const { academicYear } = getSelectedAcademicPeriod(searchParams);
  
  const [basePath, existingQuery] = baseApiUrl.split("?");
  const params = new URLSearchParams(existingQuery || "");
  
  params.set("academicYear", academicYear);
  
  return `${basePath}?${params.toString()}`;
}
