import { Student, type StudentDocument } from "../models/Student";
import { type SubscriptionDocument } from "../models/Subscription";

type StudentAcademicStatusSource = {
  status?: string | null;
  academicJoinedAt?: Date | string | null;
};

type SubscriptionAcademicJoinSource = {
  startDate?: Date | string | null;
  paymentStatus?: string | null;
};

type StudentAcademicActiveOptions = {
  subscription?: SubscriptionAcademicJoinSource | null;
  referenceDate?: Date;
};

type StudentAcademicTaskSource = {
  publishAt?: Date | string | null;
  createdAt?: Date | string | null;
};

type StudentAcademicTryoutSource = {
  endAt?: Date | string | null;
};

type StudentAcademicAttendanceSessionSource = {
  date?: string | null;
};

export function parseValidDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function hasSameDate(first: Date | string | null | undefined, second: Date | null) {
  return (parseValidDate(first)?.toISOString() ?? null) === (second?.toISOString() ?? null);
}

export function getStudentEffectiveAcademicJoinedAt(
  student: StudentAcademicStatusSource,
  subscription?: SubscriptionAcademicJoinSource | null,
) {
  const studentAcademicJoinedAt = parseValidDate(student.academicJoinedAt);

  if (studentAcademicJoinedAt) {
    return studentAcademicJoinedAt;
  }

  if (subscription?.paymentStatus && subscription.paymentStatus !== "paid") {
    return null;
  }

  return parseValidDate(subscription?.startDate);
}

export function buildStudentAcademicTaskFilter(academicJoinedAt: Date) {
  // BYPASS: Tampilkan semua tugas untuk keperluan testing/skripsi
  return {};
}

export function isStudentAcademicTaskAvailable(
  task: StudentAcademicTaskSource,
  academicJoinedAt: Date,
) {
  const publishedAt = parseValidDate(task.publishAt);
  const effectiveTaskDate = publishedAt ?? parseValidDate(task.createdAt);

  if (!effectiveTaskDate) {
    return false;
  }

  return effectiveTaskDate.getTime() >= academicJoinedAt.getTime();
}

export function buildStudentAcademicTryoutFilter(academicJoinedAt: Date) {
  return {
    endAt: {
      $gte: academicJoinedAt,
    },
  };
}

export function isStudentAcademicTryoutAvailable(
  tryout: StudentAcademicTryoutSource,
  academicJoinedAt: Date,
) {
  const endAt = parseValidDate(tryout.endAt);

  if (!endAt) {
    return false;
  }

  return endAt.getTime() >= academicJoinedAt.getTime();
}

export function getJakartaDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Jakarta",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

export function isAttendanceSessionOnOrAfterAcademicJoin(
  session: StudentAcademicAttendanceSessionSource,
  academicJoinedAt: Date,
) {
  const sessionDateKey = session.date?.trim() ?? "";

  if (!sessionDateKey) {
    return false;
  }

  return sessionDateKey >= getJakartaDateKey(academicJoinedAt);
}

export function isStudentAcademicallyActive(
  student: StudentAcademicStatusSource,
  options: StudentAcademicActiveOptions = {},
) {
  if (student.status !== "Aktif") {
    return false;
  }

  const joinedAt = getStudentEffectiveAcademicJoinedAt(student, options.subscription);

  if (!joinedAt) {
    return false;
  }

  return joinedAt.getTime() <= (options.referenceDate ?? new Date()).getTime();
}

export function applyStudentAcademicActivation(
  student: StudentDocument,
  subscription: SubscriptionAcademicJoinSource,
) {
  let changed = false;
  const academicJoinedAt = parseValidDate(subscription.startDate);

  if (student.status !== "Aktif") {
    student.status = "Aktif";
    changed = true;
  }

  // academicJoinedAt tracks the first academic activation, so renewals must not move it.
  if (academicJoinedAt && !hasSameDate(student.academicJoinedAt, academicJoinedAt)) {
    const currentAcademicJoinedAt = parseValidDate(student.academicJoinedAt);

    if (!currentAcademicJoinedAt) {
      student.academicJoinedAt = academicJoinedAt;
      changed = true;
    }
  }

  return changed;
}

export async function ensureStudentAcademicallyActivatedForSubscription(
  subscription: SubscriptionDocument,
) {
  const student = await Student.findById(subscription.studentId).exec();

  if (!student) {
    return {
      student: null,
      changed: false,
    };
  }

  const changed = applyStudentAcademicActivation(student, subscription);

  if (changed) {
    await student.save();
  }

  return {
    student,
    changed,
  };
}
