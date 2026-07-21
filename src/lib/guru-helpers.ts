import { type ReadonlyURLSearchParams } from "next/navigation";
import { getCurrentAcademicPeriod } from "./utils";

/**
 * Returns the academic year and semester to use for fetching data.
 * It strictly reads from the URL searchParams.
 * It ONLY falls back to getCurrentAcademicPeriod() if the URL is completely missing both parameters.
 */
export function getSelectedAcademicPeriod(
  searchParams: ReadonlyURLSearchParams | URLSearchParams,
) {
  const period = getCurrentAcademicPeriod();
  const urlAcademicYear = searchParams.get("academicYear");

  // If the URL has ANY of the period parameters, use what's in the URL
  if (urlAcademicYear !== null) {
    return {
      academicYear: urlAcademicYear ?? period.academicYear,
    };
  }

  // Fallback to current period ONLY when URL is completely empty
  return {
    academicYear: period.academicYear,
  };
}

export function getGuruAcademicYearStatus(
  searchParams: ReadonlyURLSearchParams | URLSearchParams,
) {
  const currentPeriod = getCurrentAcademicPeriod();
  const selectedPeriod = getSelectedAcademicPeriod(searchParams);
  const isActive = selectedPeriod.academicYear === currentPeriod.academicYear;

  return {
    academicYear: selectedPeriod.academicYear,
    currentAcademicYear: currentPeriod.academicYear,
    isActive,
    isArchive: !isActive,
  };
}

/**
 * Appends the academicYear and semester to a given path, preserving the current selection.
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
 * Appends the academicYear and semester to a base API URL.
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
