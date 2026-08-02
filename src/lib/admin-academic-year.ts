import { getCurrentAcademicPeriod } from "@/lib/utils";

type AcademicYearStatusKind = "active" | "future" | "archive";

function normalizeAcademicYear(value: string | null | undefined) {
  const normalizedValue = value?.trim().replace(/\s+/g, "") ?? "";
  const match = normalizedValue.match(/^(\d{4})\/(\d{4})$/);

  if (!match?.[1] || !match[2]) {
    return normalizedValue;
  }

  const startYear = Number(match[1]);
  const endYear = Number(match[2]);

  return endYear === startYear + 1 ? `${startYear}/${endYear}` : normalizedValue;
}

function getAcademicStartYear(academicYear: string) {
  const match = normalizeAcademicYear(academicYear).match(/^(\d{4})\/(\d{4})$/);

  return match?.[1] ? Number(match[1]) : null;
}

function buildAcademicYear(startYear: number) {
  return `${startYear}/${startYear + 1}`;
}

export function getCurrentAdminAcademicYear() {
  return getCurrentAcademicPeriod().academicYear;
}

export function getAdminAcademicYearOptions(selectedAcademicYear?: string) {
  const currentAcademicYear = getCurrentAdminAcademicYear();
  const currentStartYear = getAcademicStartYear(currentAcademicYear);
  const options: string[] = [];
  const addOption = (academicYear: string) => {
    if (!options.includes(academicYear)) {
      options.push(academicYear);
    }
  };

  if (currentStartYear !== null) {
    addOption(buildAcademicYear(currentStartYear));
    addOption(buildAcademicYear(currentStartYear + 1));
    addOption(buildAcademicYear(currentStartYear - 1));
  } else {
    addOption(currentAcademicYear);
  }

  const normalizedSelectedAcademicYear = normalizeAcademicYear(selectedAcademicYear);

  if (normalizedSelectedAcademicYear) {
    addOption(normalizedSelectedAcademicYear);
  }

  return options;
}

export function getAdminAcademicYearStatus(academicYear: string) {
  const selectedAcademicYear = normalizeAcademicYear(academicYear) || getCurrentAdminAcademicYear();
  const currentAcademicYear = getCurrentAdminAcademicYear();
  const selectedStartYear = getAcademicStartYear(selectedAcademicYear);
  const currentStartYear = getAcademicStartYear(currentAcademicYear);
  let kind: AcademicYearStatusKind = "archive";

  if (
    selectedAcademicYear === currentAcademicYear ||
    (selectedStartYear !== null &&
      currentStartYear !== null &&
      selectedStartYear === currentStartYear)
  ) {
    kind = "active";
  } else if (
    selectedStartYear !== null &&
    currentStartYear !== null &&
    selectedStartYear > currentStartYear
  ) {
    kind = "future";
  }

  return {
    academicYear: selectedAcademicYear,
    currentAcademicYear,
    kind,
    label:
      kind === "active" ? "Aktif" : kind === "future" ? "Belum Aktif" : "Arsip",
    isActive: kind === "active",
    isArchive: kind === "archive",
    isFuture: kind === "future",
    isLocked: false, // kind !== "active",
  };
}

export function getAdminAcademicYearLockMessage(academicYear: string) {
  const status = getAdminAcademicYearStatus(academicYear);

  if (status.isFuture) {
    return `Tahun ajaran ${status.academicYear} belum aktif. Data baru bisa dikelola saat tahun ajaran tersebut berjalan.`;
  }

  if (status.isArchive) {
    return `Tahun ajaran ${status.academicYear} sudah menjadi arsip. Data hanya bisa dilihat dan diekspor.`;
  }

  return "";
}
