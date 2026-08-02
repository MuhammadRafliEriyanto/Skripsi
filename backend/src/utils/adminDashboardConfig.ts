import { SCHEDULE_STATUSES, SCHEDULE_SUBJECTS } from "../models/Schedule";
import { STUDENT_STATUSES } from "../models/Student";
import { TEACHER_AVAILABILITIES, TEACHER_STATUSES } from "../models/Teacher";
import {
  ONLINE_PACKAGE_DEFINITIONS,
  type OnlinePackageKey,
} from "./subscription";
import {
  STUDENT_GRADE_OPTIONS_BY_LEVEL,
  STUDENT_LEVELS,
  buildCanonicalClassName,
  type StudentLevel,
} from "./studentClass";

export const ADMIN_SCHEDULE_TIME_SLOT_OPTIONS = [
  "04:30 - 05:30",
  "08:00 - 09:30",
  "13:00 - 14:00",
  "14:00 - 15:00",
  "15:00 - 16:00",
  "16:00 - 17:00",
] as const;

export const ADMIN_SCHEDULE_DAY_OPTIONS = [
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
  "Minggu",
] as const;

function buildStudentClassOptionsByLevel() {
  return Object.fromEntries(
    STUDENT_LEVELS.map((level) => [
      level,
      STUDENT_GRADE_OPTIONS_BY_LEVEL[level]
        .map((grade) => buildCanonicalClassName(level, grade))
        .filter((className): className is string => Boolean(className)),
    ]),
  ) as Record<StudentLevel, string[]>;
}

function buildPaymentBatchClassOptionsByLevel() {
  return Object.fromEntries(
    STUDENT_LEVELS.map((level) => [
      level,
      STUDENT_GRADE_OPTIONS_BY_LEVEL[level].map((grade) => `Kelas ${grade}`),
    ]),
  ) as Record<StudentLevel, string[]>;
}

function getBillingPackages() {
  return Object.values(ONLINE_PACKAGE_DEFINITIONS).map((item) => ({
    packageKey: item.packageKey as OnlinePackageKey,
    packageName: item.packageName,
    durationMonth: item.durationMonth,
    amount: item.amount,
  }));
}

export function getAdminDashboardConfig() {
  const studentClassOptionsByLevel = buildStudentClassOptionsByLevel();

  return {
    academic: {
      levels: [...STUDENT_LEVELS],
      gradesByLevel: Object.fromEntries(
        STUDENT_LEVELS.map((level) => [level, [...STUDENT_GRADE_OPTIONS_BY_LEVEL[level]]]),
      ) as Record<StudentLevel, string[]>,
    },
    student: {
      statuses: [...STUDENT_STATUSES],
      classOptions: Object.values(studentClassOptionsByLevel).flat(),
      classOptionsByLevel: studentClassOptionsByLevel,
    },
    teacher: {
      statuses: [...TEACHER_STATUSES],
      availabilities: [...TEACHER_AVAILABILITIES],
    },
    schedule: {
      statuses: [...SCHEDULE_STATUSES],
      subjects: [...SCHEDULE_SUBJECTS],
      timeSlots: [...ADMIN_SCHEDULE_TIME_SLOT_OPTIONS],
      days: [...ADMIN_SCHEDULE_DAY_OPTIONS],
    },
    payment: {
      billingPackages: getBillingPackages(),
      batchClassOptionsByLevel: buildPaymentBatchClassOptionsByLevel(),
    },
  };
}
