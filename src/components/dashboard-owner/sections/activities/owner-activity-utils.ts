import type { BadgeProps } from "@/components/ui/badge";
import type { OwnerActivitiesRouteState } from "@/lib/owner-dashboard-routing";

import type {
  BranchFilter,
  IncomingPaymentPeriodFilter,
  IncomingPaymentStatusFilter,
  MembershipActivationFilter,
  OwnerIncomingPaymentRecord,
  OutgoingPaymentStatusFilter,
  StudentClass,
  StudentLevel,
  StudentLevelFilter,
  SurfaceTone,
} from "./owner-activity-types";
import {
  allIncomingPaymentPeriodFilter,
  combinedIncomingPaymentStatusFilter,
  inactiveActivationStatusFilter,
  allBranchFilter,
} from "./owner-activity-types";

export const incomingStatusOptions = [
  "Semua",
  "paid",
  "pending",
  combinedIncomingPaymentStatusFilter,
  "draft_renewal",
  "failed",
  "expired",
] as const satisfies readonly IncomingPaymentStatusFilter[];

export const incomingPeriodOptions = [
  allIncomingPaymentPeriodFilter,
  "Minggu ini",
  "Bulan ini",
  "Tahun ini",
] as const satisfies readonly IncomingPaymentPeriodFilter[];

export const outgoingStatusOptions = [
  "Semua",
  "Menunggu",
  "Dijadwalkan",
  "Selesai",
  "Dibatalkan",
] as const satisfies readonly OutgoingPaymentStatusFilter[];

export const activationFilterOptions = [
  "Semua",
  "Aktif",
  inactiveActivationStatusFilter,
  "Menunggu Pembayaran",
  "Expired",
  "Pembayaran Gagal",
] as const satisfies readonly MembershipActivationFilter[];

export const levelFilterOptions = [
  "Semua",
  "SD",
  "SMP",
  "SMA",
] as const satisfies readonly StudentLevelFilter[];

export const classOptionsByLevel = {
  SD: ["4", "5", "6"],
  SMP: ["7", "8", "9"],
  SMA: ["10", "11", "12"],
} as const satisfies Record<Exclude<StudentLevel, "-">, readonly StudentClass[]>;

export const allClassOptions = [
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
] as const satisfies readonly StudentClass[];

type ActivityStatusMeta = {
  badgeVariant: BadgeProps["variant"];
  label: string;
};

export const incomingStatusMeta = {
  paid: {
    badgeVariant: "success",
    label: "Lunas",
  },
  pending: {
    badgeVariant: "warning",
    label: "Pending",
  },
  failed: {
    badgeVariant: "danger",
    label: "Gagal",
  },
  expired: {
    badgeVariant: "danger",
    label: "Expired",
  },
  draft_renewal: {
    badgeVariant: "secondary",
    label: "Draft Perpanjangan",
  },
} as const satisfies Record<Exclude<IncomingPaymentStatusFilter, "Semua" | typeof combinedIncomingPaymentStatusFilter>, ActivityStatusMeta>;

export const outgoingStatusMeta = {
  Menunggu: {
    badgeVariant: "warning",
    label: "Menunggu",
  },
  Dijadwalkan: {
    badgeVariant: "secondary",
    label: "Dijadwalkan",
  },
  Selesai: {
    badgeVariant: "success",
    label: "Selesai",
  },
  Dibatalkan: {
    badgeVariant: "danger",
    label: "Dibatalkan",
  },
} as const satisfies Record<Exclude<OutgoingPaymentStatusFilter, "Semua">, ActivityStatusMeta>;

export const paymentStatusMeta = {
  paid: {
    badgeVariant: "success",
    label: "Lunas",
  },
  pending: {
    badgeVariant: "warning",
    label: "Pending",
  },
  failed: {
    badgeVariant: "danger",
    label: "Gagal",
  },
  expired: {
    badgeVariant: "danger",
    label: "Expired",
  },
  draft_renewal: {
    badgeVariant: "secondary",
    label: "Draft Perpanjangan",
  },
} as const;

export const activationStatusMeta = {
  Aktif: {
    badgeVariant: "success",
    label: "Aktif",
  },
  "Menunggu Pembayaran": {
    badgeVariant: "warning",
    label: "Menunggu Pembayaran",
  },
  Expired: {
    badgeVariant: "danger",
    label: "Expired",
  },
  "Pembayaran Gagal": {
    badgeVariant: "danger",
    label: "Pembayaran Gagal",
  },
} as const;

export const surfaceToneStyles: Record<
  SurfaceTone,
  {
    shell: string;
    accentText: string;
    badge: string;
    orbPrimary: string;
    orbSecondary: string;
    toolbar: string;
    metric: string;
    iconWrap: string;
    icon: string;
    dot: string;
    table: string;
    empty: string;
  }
> = {
  orange: {
    shell: "border-slate-200/80 bg-white",
    accentText: "text-orange-600",
    badge: "border-orange-100 bg-orange-50 text-orange-700",
    orbPrimary: "bg-transparent",
    orbSecondary: "bg-transparent",
    toolbar: "border-slate-200/80 bg-slate-50/70",
    metric: "border-slate-200/80 bg-white",
    iconWrap: "bg-orange-50 text-orange-600",
    icon: "text-orange-500",
    dot: "bg-orange-500",
    table: "border-slate-200/80 bg-white",
    empty: "bg-orange-50 text-orange-600",
  },
  sky: {
    shell: "border-slate-200/80 bg-white",
    accentText: "text-sky-600",
    badge: "border-sky-100 bg-sky-50 text-sky-700",
    orbPrimary: "bg-transparent",
    orbSecondary: "bg-transparent",
    toolbar: "border-slate-200/80 bg-slate-50/70",
    metric: "border-slate-200/80 bg-white",
    iconWrap: "bg-sky-50 text-sky-600",
    icon: "text-sky-500",
    dot: "bg-sky-500",
    table: "border-slate-200/80 bg-white",
    empty: "bg-sky-50 text-sky-600",
  },
  emerald: {
    shell: "border-slate-200/80 bg-white",
    accentText: "text-emerald-600",
    badge: "border-emerald-100 bg-emerald-50 text-emerald-700",
    orbPrimary: "bg-transparent",
    orbSecondary: "bg-transparent",
    toolbar: "border-slate-200/80 bg-slate-50/70",
    metric: "border-slate-200/80 bg-white",
    iconWrap: "bg-emerald-50 text-emerald-600",
    icon: "text-emerald-500",
    dot: "bg-emerald-500",
    table: "border-slate-200/80 bg-white",
    empty: "bg-emerald-50 text-emerald-600",
  },
};

export function mapRouteIncomingStatusToFilter(
  status: OwnerActivitiesRouteState["incomingStatus"],
): IncomingPaymentStatusFilter {
  switch (status) {
    case "paid":
      return "paid";
    case "pending":
      return "pending";
    case "failed":
      return "failed";
    case "expired":
      return "expired";
    case "failed-expired":
      return combinedIncomingPaymentStatusFilter;
    default:
      return "Semua";
  }
}

export function mapRouteOutgoingStatusToFilter(
  status: OwnerActivitiesRouteState["outgoingStatus"],
): OutgoingPaymentStatusFilter {
  switch (status) {
    case "menunggu":
      return "Menunggu";
    case "dijadwalkan":
      return "Dijadwalkan";
    case "selesai":
      return "Selesai";
    case "dibatalkan":
      return "Dibatalkan";
    default:
      return "Semua";
  }
}

export function mapRouteActivationStatusToFilter(
  status: OwnerActivitiesRouteState["activationStatus"],
): MembershipActivationFilter {
  switch (status) {
    case "active":
      return "Aktif";
    case "pending":
      return "Menunggu Pembayaran";
    case "expired":
      return "Expired";
    case "failed":
      return "Pembayaran Gagal";
    case "inactive":
      return inactiveActivationStatusFilter;
    default:
      return "Semua";
  }
}

export function getIncomingStatusFilterLabel(value: IncomingPaymentStatusFilter) {
  if (value === "Semua" || value === combinedIncomingPaymentStatusFilter) {
    return value;
  }

  return incomingStatusMeta[value].label;
}

export function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function formatLongDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function escapeCsvCell(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

export function triggerDownload(fileName: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  anchor.click();

  URL.revokeObjectURL(url);
}

export function createExportFileName(
  prefix: "pembayaran-masuk" | "pembayaran-keluar" | "aktivasi-siswa",
  extension: "csv" | "json",
) {
  const stamp = new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .replaceAll("-", "");

  return `owner-${prefix}-${stamp}.${extension}`;
}

export function formatPaymentMethodLabel(value: string) {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return "-";
  }

  const knownLabels: Record<string, string> = {
    xendit_payment_link: "Xendit Payment Link",
    manual_confirmation: "Konfirmasi Manual",
    manual_transfer: "Transfer Manual",
  };

  return (
    knownLabels[normalizedValue] ??
    normalizedValue
      .replace(/_/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase())
  );
}

function normalizeFilterText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeLookupKey(value: string) {
  return normalizeFilterText(value).toLowerCase();
}

function isUnassignedBranchLabel(value: string) {
  return normalizeLookupKey(value) === "belum diatur";
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfLocalDay(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );
}

function getPeriodRange(periodFilter: IncomingPaymentPeriodFilter, referenceDate: Date) {
  const reference = new Date(referenceDate);

  if (Number.isNaN(reference.getTime())) {
    return null;
  }

  if (periodFilter === "Minggu ini") {
    const start = startOfLocalDay(reference);
    const day = start.getDay();
    const distanceFromMonday = day === 0 ? 6 : day - 1;

    start.setDate(start.getDate() - distanceFromMonday);

    const end = endOfLocalDay(start);
    end.setDate(start.getDate() + 6);

    return { start, end };
  }

  if (periodFilter === "Bulan ini") {
    return {
      start: new Date(reference.getFullYear(), reference.getMonth(), 1),
      end: new Date(
        reference.getFullYear(),
        reference.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      ),
    };
  }

  if (periodFilter === "Tahun ini") {
    return {
      start: new Date(reference.getFullYear(), 0, 1),
      end: new Date(reference.getFullYear(), 11, 31, 23, 59, 59, 999),
    };
  }

  return null;
}

export function getIncomingPaymentActivityDate(
  payment: Pick<OwnerIncomingPaymentRecord, "paidAt" | "createdAt">,
) {
  const value = payment.paidAt ?? payment.createdAt;

  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function isDateInIncomingPaymentPeriod(
  date: Date | null,
  periodFilter: IncomingPaymentPeriodFilter,
  referenceDate = new Date(),
) {
  if (periodFilter === allIncomingPaymentPeriodFilter) {
    return true;
  }

  if (!date) {
    return false;
  }

  const range = getPeriodRange(periodFilter, referenceDate);

  if (!range) {
    return true;
  }

  const timestamp = date.getTime();

  return timestamp >= range.start.getTime() && timestamp <= range.end.getTime();
}

export function branchesMatch(branch: string, branchFilter: BranchFilter) {
  if (branchFilter === allBranchFilter) {
    return true;
  }

  return normalizeLookupKey(branch) === normalizeLookupKey(branchFilter);
}

export function getBranchFilterOptions(
  items: Array<{ branch: string }>,
  additionalBranches: string[] = [],
): BranchFilter[] {
  const branchByKey = new Map<string, string>();

  for (const branch of [
    ...additionalBranches,
    ...items.map((item) => item.branch),
  ]) {
    const normalizedBranch = normalizeFilterText(branch);

    if (!normalizedBranch || isUnassignedBranchLabel(normalizedBranch)) {
      continue;
    }

    const key = normalizeLookupKey(normalizedBranch);

    if (!branchByKey.has(key)) {
      branchByKey.set(key, normalizedBranch);
    }
  }

  const branches = [...branchByKey.values()].sort((first, second) =>
    first.localeCompare(second, "id-ID"),
  );

  return [allBranchFilter, ...branches];
}

export {
  allBranchFilter,
  combinedIncomingPaymentStatusFilter,
  inactiveActivationStatusFilter,
};
