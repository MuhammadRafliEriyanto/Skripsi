import { type StudentDocument } from "../models/Student";
import { Subscription } from "../models/Subscription";
import {
  getAcademicPeriodForYear,
  type AcademicPeriod,
} from "./academicGrade";
import { normalizeCanonicalClassName } from "./studentClass";

type StudentAcademicContentAccess = {
  isUpcomingClassLocked: boolean;
  period: AcademicPeriod;
  startsAt: string | null;
  className: string;
  message: string | null;
};

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function getJakartaMonthAndYear(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    month: "numeric",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).formatToParts(date);

  return {
    month: Number(parts.find((part) => part.type === "month")?.value ?? 1),
    year: Number(parts.find((part) => part.type === "year")?.value ?? 2026),
  };
}

function getUpcomingAcademicPeriod(date: Date): AcademicPeriod {
  const { year } = getJakartaMonthAndYear(date);

  return {
    academicYear: `${year}/${year + 1}`,
    semester: "Ganjil",
  };
}

function getAcademicYearStartDateKey(date: Date) {
  const { year } = getJakartaMonthAndYear(date);
  return `${year}-08-01`;
}

function formatIndonesianDateKey(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function isBeforeAcademicYearStart(date: Date) {
  return getJakartaMonthAndYear(date).month < 8;
}

function getClassMatchKey(value: string | null | undefined) {
  return (
    normalizeCanonicalClassName(value) ??
    normalizeText(value).toUpperCase()
  ).toLowerCase();
}

async function hasPaidPendingTargetForCurrentClass(
  student: StudentDocument,
  date: Date,
) {
  const currentClassKey = getClassMatchKey(student.className);

  if (!currentClassKey) {
    return false;
  }

  const targetSubscriptions = await Subscription.find({
    studentId: student._id,
    paymentStatus: "paid",
    status: "pending",
    targetClassName: {
      $nin: [null, ""],
    },
  })
    .select("targetClassName startDate")
    .lean()
    .exec();

  return targetSubscriptions.some((subscription) => {
    const targetClassKey = getClassMatchKey(subscription.targetClassName);
    const startsInFuture =
      !subscription.startDate || subscription.startDate.getTime() > date.getTime();

    return targetClassKey === currentClassKey && startsInFuture;
  });
}

export async function resolveStudentAcademicContentAccess(
  student: StudentDocument,
  date = new Date(),
): Promise<StudentAcademicContentAccess> {
  const studentAcademicPeriod = getAcademicPeriodForYear(
    student.academicYear,
    date,
  );
  const className = normalizeText(student.className);

  if (!isBeforeAcademicYearStart(date)) {
    return {
      isUpcomingClassLocked: false,
      period: studentAcademicPeriod,
      startsAt: null,
      className,
      message: null,
    };
  }

  const isUpcomingClassLocked = await hasPaidPendingTargetForCurrentClass(
    student,
    date,
  );

  if (!isUpcomingClassLocked) {
    return {
      isUpcomingClassLocked: false,
      period: studentAcademicPeriod,
      startsAt: null,
      className,
      message: null,
    };
  }

  const startsAt = getAcademicYearStartDateKey(date);

  return {
    isUpcomingClassLocked: true,
    period: getUpcomingAcademicPeriod(date),
    startsAt,
    className,
    message: `Kelas ${className} sudah terdaftar. Materi, tugas, jadwal, absensi, dan tryout dibuka mulai ${formatIndonesianDateKey(startsAt)}.`,
  };
}
