export const UTBK_PROGRAM_VALUE = "UTBK";
export const UTBK_GENERAL_SCHEDULE_CLASS_NAME = "UTBK";
export const UTBK_KELAS_12_SCHEDULE_CLASS_NAME = "UTBK Kelas 12";
export const UTBK_ALUMNI_SCHEDULE_CLASS_NAME = "UTBK Alumni / Gap Year";

function normalizeProgram(value: string | null | undefined) {
  return value?.trim().toUpperCase() ?? "";
}

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

export function isUtbkProgram(value: string | null | undefined) {
  const normalizedProgram = normalizeProgram(value);
  return (
    normalizedProgram === UTBK_PROGRAM_VALUE ||
    normalizedProgram.includes("UTBK") ||
    normalizedProgram.includes("SNBT")
  );
}

export function isUtbkStudent(student: { program?: string | null } | null | undefined) {
  return isUtbkProgram(student?.program);
}

export function normalizeUtbkTrack(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);
  const normalizedTrack = normalizedValue
    .replace(/\s*\/\s*/g, " / ")
    .toUpperCase();

  if (!normalizedTrack) {
    return "";
  }

  if (normalizedTrack === "12" || normalizedTrack === "KELAS 12") {
    return "Kelas 12";
  }

  if (
    normalizedTrack === "ALUMNI" ||
    normalizedTrack === "GAP YEAR" ||
    normalizedTrack === "ALUMNI/GAP YEAR" ||
    normalizedTrack === "ALUMNI / GAP YEAR"
  ) {
    return "Alumni / Gap Year";
  }

  return normalizedValue;
}

export function normalizeUtbkScheduleClassName(
  value: string | null | undefined,
) {
  const normalizedValue = normalizeText(value);
  const normalizedUpper = normalizedValue.toUpperCase();

  if (!normalizedValue) {
    return "";
  }

  if (normalizedUpper === "UTBK" || normalizedUpper === "SNBT") {
    return UTBK_GENERAL_SCHEDULE_CLASS_NAME;
  }

  const trackValue = normalizedValue.replace(/^(UTBK|SNBT)\s*[-/]?\s*/i, "");
  const normalizedTrack = normalizeUtbkTrack(trackValue);

  if (normalizedTrack === "Kelas 12") {
    return UTBK_KELAS_12_SCHEDULE_CLASS_NAME;
  }

  if (normalizedTrack === "Alumni / Gap Year") {
    return UTBK_ALUMNI_SCHEDULE_CLASS_NAME;
  }

  return "";
}

export function isUtbkScheduleClassName(value: string | null | undefined) {
  return Boolean(normalizeUtbkScheduleClassName(value));
}

export function getUtbkScheduleClassNames(
  student:
    | { program?: string | null; utbkTrack?: string | null }
    | null
    | undefined,
) {
  if (!isUtbkStudent(student)) {
    return [];
  }

  const track = normalizeUtbkTrack(student?.utbkTrack);
  const classNames = [UTBK_GENERAL_SCHEDULE_CLASS_NAME];

  if (track) {
    classNames.push(`${UTBK_GENERAL_SCHEDULE_CLASS_NAME} ${track}`);
  }

  return Array.from(
    new Set(
      classNames
        .map((className) => normalizeUtbkScheduleClassName(className))
        .filter(Boolean),
    ),
  );
}

export function matchesUtbkScheduleClassName(
  scheduleClassName: string | null | undefined,
  student:
    | { program?: string | null; utbkTrack?: string | null }
    | null
    | undefined,
) {
  if (!isUtbkStudent(student)) {
    return false;
  }

  const normalizedScheduleClassName =
    normalizeUtbkScheduleClassName(scheduleClassName);

  if (!normalizedScheduleClassName) {
    return false;
  }

  const eligibleClassNames = getUtbkScheduleClassNames(student);

  if (eligibleClassNames.length === 1) {
    return normalizedScheduleClassName === UTBK_GENERAL_SCHEDULE_CLASS_NAME;
  }

  return eligibleClassNames.includes(normalizedScheduleClassName);
}
