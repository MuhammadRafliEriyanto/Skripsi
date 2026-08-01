import { UTBK_PROGRAM_VALUE } from "@/lib/subscription";

export const UTBK_STUDENT_DEFAULT_PATH = "/dashboard-siswa/materi";

const UTBK_RESTRICTED_STUDENT_PATH_PREFIXES = [
  "/dashboard-siswa/kirim-tugas",
  "/dashboard-siswa/riwayat-akademik",
  "/dashboard-siswa/tugas",
] as const;

export type StudentProgramProfile = {
  program?: string | null;
  utbkTrack?: string | null;
};

function normalizeProgram(value: string | null | undefined) {
  return value?.trim().toUpperCase() ?? "";
}

function matchesPathPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isUtbkProgram(value: string | null | undefined) {
  const normalizedProgram = normalizeProgram(value);
  return (
    normalizedProgram === UTBK_PROGRAM_VALUE ||
    normalizedProgram.includes("UTBK") ||
    normalizedProgram.includes("SNBT")
  );
}

export function isUtbkStudentProfile(
  student: StudentProgramProfile | null | undefined,
) {
  return isUtbkProgram(student?.program);
}

export function isUtbkRestrictedStudentPath(pathname: string) {
  return UTBK_RESTRICTED_STUDENT_PATH_PREFIXES.some((prefix) =>
    matchesPathPrefix(pathname, prefix),
  );
}

export function getUtbkTrackLabel(
  student: StudentProgramProfile | null | undefined,
) {
  return student?.utbkTrack?.trim() || "Program SNBT";
}
