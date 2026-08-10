import { type MembershipAccessStatus } from "./subscription";

type MembershipAccessContext = {
  subscription?: {
    paymentStatus?: string | null;
    startDate?: Date | string | null;
    packageName?: string | null;
  } | null;
  payment?: {
    status?: string | null;
    packageName?: string | null;
  } | null;
};

export type StudentMembershipContentAccess = {
  isMembershipLocked: boolean;
  accessStatus: MembershipAccessStatus;
  isScheduledAccess: boolean;
  startsAt: string | null;
  message: string | null;
};

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function parseDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatIndonesianDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(value);
}

function resolveContextPaymentStatus(context: MembershipAccessContext | undefined) {
  return normalizeText(context?.payment?.status ?? context?.subscription?.paymentStatus)
    .toLowerCase();
}

function resolvePackageLabel(context: MembershipAccessContext | undefined) {
  return (
    normalizeText(context?.payment?.packageName) ||
    normalizeText(context?.subscription?.packageName) ||
    "Membership"
  );
}

export function resolveStudentMembershipContentAccess(
  accessStatus: MembershipAccessStatus,
  context?: MembershipAccessContext,
): StudentMembershipContentAccess {
  const startDate = parseDate(context?.subscription?.startDate);
  const isScheduledAccess =
    accessStatus === "pending" &&
    resolveContextPaymentStatus(context) === "paid" &&
    Boolean(startDate && startDate.getTime() > Date.now());
  const startsAt = startDate?.toISOString() ?? null;

  if (accessStatus === "active" || accessStatus === "expiring") {
    return {
      isMembershipLocked: false,
      accessStatus,
      isScheduledAccess: false,
      startsAt: null,
      message: null,
    };
  }

  if (accessStatus === "pending") {
    if (isScheduledAccess && startDate) {
      return {
        isMembershipLocked: true,
        accessStatus,
        isScheduledAccess,
        startsAt,
        message: `${resolvePackageLabel(context)} sudah tercatat. Akses materi, latihan soal, jadwal, absensi, nilai, dan tryout dibuka mulai ${formatIndonesianDate(startDate)}.`,
      };
    }

    return {
      isMembershipLocked: true,
      accessStatus,
      isScheduledAccess,
      startsAt,
      message:
        "Pembayaran membership masih pending. Selesaikan pembayaran untuk membuka akses materi, latihan soal, jadwal, absensi, nilai, dan tryout.",
    };
  }

  if (accessStatus === "expired") {
    return {
      isMembershipLocked: true,
      accessStatus,
      isScheduledAccess: false,
      startsAt: null,
      message:
        "Membership sudah berakhir. Perpanjang membership untuk membuka akses materi, latihan soal, jadwal, absensi, nilai, dan tryout.",
    };
  }

  return {
    isMembershipLocked: true,
    accessStatus,
    isScheduledAccess: false,
    startsAt: null,
    message:
      "Membership belum aktif. Aktifkan membership untuk membuka akses materi, latihan soal, jadwal, absensi, nilai, dan tryout.",
  };
}
