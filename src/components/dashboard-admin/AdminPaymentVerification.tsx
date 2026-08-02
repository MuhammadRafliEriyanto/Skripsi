/*  */"use client";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  LoaderCircle,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import type { FormEvent } from "react";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requestAdminApi } from "@/lib/admin-api";
import {
  defaultAdminDashboardConfig,
  type AdminBillingPackage,
  type AdminDashboardConfigData,
} from "@/lib/admin-dashboard-config";
import {
  archiveAdminPayment,
  createAdminBatchPaymentSession,
  exportAdminPaymentActivationsCsv,
  exportAdminPaymentsCsv,
  fetchAdminPaymentActivations,
  fetchAdminPayments,
  replaceAdminPayment,
  updateAdminPaymentStatus,
  type AdminBatchPaymentReasonCode,
  type AdminPaymentActivationsData,
  type AdminPaymentListItem,
  type AdminPaymentsListData,
  type CreateAdminBatchPaymentSessionData,
  type CreateAdminBatchPaymentSessionItem,
  type CreateAdminBatchPaymentSessionPayload,
  type ReplaceAdminPaymentPayload,
} from "@/lib/admin-payments";
import { type OwnerActivityStudentActivation } from "@/lib/owner-activities";
import {
  findPackageByKey,
  findPackageByName,
  getPriceByClassAndPackage,
  type ClassPricingMatrix,
  type OnlinePackageDefinition,
} from "@/lib/subscription";
import { useSubscriptionConfig } from "@/lib/use-subscription-config";
import { cn, formatCurrency } from "@/lib/utils";

import type { AdminStudent } from "./admin-data";
import { AdminBranchFinance } from "./AdminBranchFinance";
import {
  AdminDataTable,
  type AdminColumnDefinition,
} from "./components/AdminDataTable";
import { AdminPaginationFooter } from "./components/AdminPaginationFooter";
import { AdminListPanelSkeleton } from "./components/AdminLoadingState";
import { AdminSectionCard } from "./components/AdminSectionCard";
import { AdminStatusBadge } from "./components/AdminStatusBadge";

type PaymentTab = "incoming" | "expenses" | "activations";
type ActivationMembershipView = "without_membership" | "with_membership";
type IncomingPaymentRecord = AdminPaymentListItem;
type ActivationRecord = OwnerActivityStudentActivation;
type PaymentStatus = IncomingPaymentRecord["status"];
type ActivationStatus = ActivationRecord["activationStatus"];
type StudentLevel = Extract<ActivationRecord["jenjang"], "SD" | "SMP" | "SMA">;
type LevelFilterOption = StudentLevel | "Semua jenjang";
type BatchPackageMode = CreateAdminBatchPaymentSessionPayload["packageMode"];
type BillingFeedbackTone = "success" | "warning" | "info";
type BillingFeedback = {
  tone: BillingFeedbackTone;
  title: string;
  message: string;
  checkoutUrl?: string | null;
  statusPagePath?: string | null;
};

type PaymentViewRefreshOptions = {
  includeStudents?: boolean;
  page?: number;
  activationPageValue?: number;
};

type PackageFilterOption = {
  value: string;
  label: string;
};

const ALL_PAYMENT_STATUSES = "Semua status";
const ALL_PACKAGES = "Semua paket";
const ALL_LEVELS = "Semua jenjang";
const ALL_CLASSES = "Semua kelas";
const ALL_ACTIVATION_STATUSES = "Semua aktivasi";

const paymentStatusOptions = [
  ALL_PAYMENT_STATUSES,
  "paid",
  "pending",
  "failed",
  "expired",
] as const;

const activationStatusOptions = [
  ALL_ACTIVATION_STATUSES,
  "Aktif",
  "Menunggu Pembayaran",
  "Expired",
  "Pembayaran Gagal",
] as const;

const warmFieldClassName =
  "border-slate-200 hover:border-orange-200 focus:border-orange-300 focus:ring-4 focus:ring-orange-500/10 focus-visible:border-orange-300 focus-visible:ring-4 focus-visible:ring-orange-500/10";
const warmSelectTriggerClassName =
  "border-slate-200 hover:border-orange-200 focus:border-orange-300 focus:ring-4 focus:ring-orange-500/10 focus-visible:border-orange-300 focus-visible:ring-4 focus-visible:ring-orange-500/10 data-[state=open]:border-orange-300 data-[state=open]:ring-4 data-[state=open]:ring-orange-500/10";
const warmSelectContentClassName =
  "border-orange-100/80 shadow-lg shadow-orange-100/20";
const warmSelectItemClassName =
  "hover:bg-orange-50 hover:text-orange-700 focus:bg-orange-50 focus:text-orange-700 data-[highlighted]:bg-orange-50 data-[highlighted]:text-orange-700 data-[state=checked]:bg-orange-50 data-[state=checked]:text-orange-700";
const detailDialogClassName =
  "w-[calc(100%-1.5rem)] max-h-[90vh] max-w-2xl gap-0 overflow-hidden border-slate-200/80 bg-white p-0 shadow-[0_24px_48px_-30px_rgba(15,23,42,0.22)]";
const billingDialogClassName =
  "w-[calc(100%-1rem)] max-h-[92vh] max-w-5xl gap-0 overflow-hidden border-slate-200/80 bg-white p-0 shadow-[0_24px_48px_-30px_rgba(15,23,42,0.22)]";
const defaultIncomingPageLimit = 20;
const emptyIncomingSummary: AdminPaymentsListData["summary"] = {
  totalItems: 0,
  pendingCount: 0,
  paidCount: 0,
  expiredCount: 0,
  failedCount: 0,
  totalAmount: 0,
};

function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function formatDateTimeLocalInput(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return "";
  }

  const date = new Date(normalizedValue);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offsetMilliseconds = date.getTimezoneOffset() * 60 * 1000;

  return new Date(date.getTime() - offsetMilliseconds)
    .toISOString()
    .slice(0, 16);
}

function formatPaymentSourceLabel(value: IncomingPaymentRecord["source"]) {
  switch (value) {
    case "admin":
      return "Transaksi Admin";
    case "register_online":
      return "Register Online";
    default:
      return value;
  }
}

function formatPaymentStatusLabel(status: PaymentStatus) {
  switch (status) {
    case "paid":
      return "Lunas";
    case "pending":
      return "Pending";
    case "failed":
      return "Gagal";
    case "expired":
      return "Expired";
    default:
      return status;
  }
}

function formatPaymentStatusTone(status: PaymentStatus) {
  switch (status) {
    case "paid":
      return "success" as const;
    case "pending":
      return "warning" as const;
    case "failed":
    case "expired":
      return "danger" as const;
    default:
      return "default" as const;
  }
}

function canArchivePaymentRecord(record: IncomingPaymentRecord | null | undefined) {
  return (
    record?.source === "admin" &&
    (record.status === "pending" || record.status === "expired")
  );
}

function formatActivationStatusTone(status: ActivationStatus) {
  switch (status) {
    case "Aktif":
      return "success" as const;
    case "Menunggu Pembayaran":
      return "warning" as const;
    case "Expired":
    case "Pembayaran Gagal":
      return "danger" as const;
    default:
      return "default" as const;
  }
}

function formatDateTimeLabel(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatPaymentMethodLabel(value: string) {
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

function formatProviderLabel(value: string) {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return "-";
  }

  return normalizedValue
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatCancelReasonLabel(value: IncomingPaymentRecord["cancelReason"]) {
  switch (value) {
    case "admin_cancelled":
      return "Dibatalkan admin";
    case "replaced_by_new_session":
      return "Diganti sesi baru";
    case "provider_canceled":
      return "Dibatalkan provider";
    default:
      return "-";
  }
}

function buildPaymentStatusPagePath(paymentId: string | null | undefined) {
  return paymentId
    ? `/register/status?paymentId=${encodeURIComponent(paymentId)}`
    : null;
}

function normalizeRegistrationPath(path: string | null | undefined) {
  if (!path) {
    return null;
  }

  return path.replace(/^\/register-online(?=\/|$)/, "/register");
}

function getIncomingDisplayDate(record: IncomingPaymentRecord) {
  return record.paidAt ?? record.createdAt;
}

function getIncomingDisplayDateLabel(record: IncomingPaymentRecord) {
  return record.paidAt ? "Tanggal bayar" : "Tanggal dibuat";
}

function compareTextValue(first: string, second: string) {
  return first.localeCompare(second, "id-ID", { sensitivity: "base" });
}

function compareClassValue(first: string, second: string) {
  const firstNumber = Number(first);
  const secondNumber = Number(second);

  if (Number.isFinite(firstNumber) && Number.isFinite(secondNumber)) {
    return firstNumber - secondNumber;
  }

  return compareTextValue(first, second);
}

function createSelectOptions(
  values: Array<string | null | undefined>,
  allLabel: string,
  compare: (first: string, second: string) => number = compareTextValue,
) {
  const uniqueValues = Array.from(
    new Set(values.map((value) => normalizeText(value)).filter(Boolean)),
  ).sort(compare);

  return [allLabel, ...uniqueValues];
}

function buildPackageFilterValue(packageKey?: string | null, packageName?: string | null) {
  const normalizedPackageKey = normalizeText(packageKey);

  if (normalizedPackageKey) {
    return `key:${normalizedPackageKey.toLowerCase()}`;
  }

  const normalizedPackageName = normalizeText(packageName);

  return normalizedPackageName
    ? `name:${normalizedPackageName.toLowerCase()}`
    : "";
}

function formatPackageFilterLabel(input: {
  packageKey?: string | null;
  packageName?: string | null;
  durationMonth?: number | null;
  amount?: number | null;
}, packages: OnlinePackageDefinition[]) {
  const knownPackage =
    findPackageByKey(input.packageKey, packages) ??
    findPackageByName(input.packageName, packages);
  const packageName = normalizeText(knownPackage?.packageName ?? input.packageName) || "-";
  const amount =
    typeof knownPackage?.amount === "number"
      ? knownPackage.amount
      : typeof input.amount === "number"
        ? input.amount
        : null;
  const durationMonth =
    typeof knownPackage?.durationMonth === "number"
      ? knownPackage.durationMonth
      : typeof input.durationMonth === "number"
        ? input.durationMonth
        : null;
  const segments = [packageName];

  if (
    typeof durationMonth === "number" &&
    durationMonth > 0 &&
    !/(bulan|tahun)/i.test(packageName)
  ) {
    segments.push(`${durationMonth} bulan`);
  }

  if (typeof amount === "number") {
    segments.push(formatCurrency(amount));
  }

  return segments.join(" - ");
}

function createPackageFilterOptions(
  items: Array<{
    packageKey?: string | null;
    packageName?: string | null;
    durationMonth?: number | null;
    amount?: number | null;
  }>,
  allLabel: string,
  packages: OnlinePackageDefinition[],
) {
  const options = new Map<string, PackageFilterOption>();

  for (const item of items) {
    const value = buildPackageFilterValue(item.packageKey, item.packageName);

    if (!value || options.has(value)) {
      continue;
    }

    options.set(value, {
      value,
      label: formatPackageFilterLabel(item, packages),
    });
  }

  return [
    { value: allLabel, label: allLabel },
    ...Array.from(options.values()).sort((first, second) =>
      compareTextValue(first.label, second.label),
    ),
  ];
}

function getIncomingAnomalyReasons(record: IncomingPaymentRecord) {
  const reasons = [...record.anomalyReasons];

  if (!record.student.studentId) {
    reasons.push("Nomor induk belum tersedia.");
  }

  if (record.student.name === "Siswa tidak ditemukan") {
    reasons.push("Relasi student atau user tidak ditemukan.");
  }

  if (!record.student.email) {
    reasons.push("Email siswa belum tersedia.");
  }

  if (!record.paymentId) {
    reasons.push("No. referensi kosong.");
  }

  if (!record.subscription?.subscriptionCode) {
    reasons.push("Kode layanan kosong.");
  }

  if (record.status === "pending" && record.source === "admin" && !record.checkoutUrl) {
    reasons.push("Checkout URL belum tersedia.");
  }

  return Array.from(new Set(reasons));
}

function getActivationAnomalyReasons(record: ActivationRecord) {
  const reasons: string[] = [];

  if (!record.studentId) {
    reasons.push("Nomor induk kosong.");
  }

  if (record.studentName === "Siswa tidak ditemukan") {
    reasons.push("Relasi user siswa tidak ditemukan.");
  }

  if (!record.studentEmail) {
    reasons.push("Email siswa belum tersedia.");
  }

  if (record.activationStatus === "Aktif" && !record.paymentId) {
    reasons.push("Status aktif belum memiliki no referensi.");
  }

  return reasons;
}

function extractGradeFromClassOption(classOption: string) {
  const match = classOption.match(/\b([1-9]|1[0-2])\b/);
  return match?.[1] ?? "";
}

function buildCanonicalBatchClassName(level: StudentLevel, classOption: string) {
  const grade = extractGradeFromClassOption(classOption);
  return grade ? `${level} ${grade}` : level;
}

function formatBatchReasonLabel(reasonCode: AdminBatchPaymentReasonCode) {
  switch (reasonCode) {
    case "NO_PREVIOUS_PACKAGE":
      return "Belum pernah punya paket";
    case "INVALID_PREVIOUS_PACKAGE":
      return "Paket terakhir tidak valid";
    case "STUDENT_USER_NOT_FOUND":
      return "User siswa tidak ditemukan";
    case "STUDENT_INACTIVE":
      return "Siswa nonaktif";
    case "BLOCKING_PENDING_PAYMENT":
      return "Masih ada pending payment";
    case "XENDIT_SESSION_FAILED":
      return "Gagal membuat sesi pembayaran";
    case "UNKNOWN_ERROR":
      return "Error tidak diketahui";
    default:
      return reasonCode;
  }
}

function formatBatchItemStatusTone(
  status: CreateAdminBatchPaymentSessionItem["status"],
) {
  switch (status) {
    case "created":
      return "success" as const;
    case "skipped":
      return "warning" as const;
    case "failed":
      return "danger" as const;
    default:
      return "default" as const;
  }
}

function formatBatchItemStatusLabel(
  status: CreateAdminBatchPaymentSessionItem["status"],
) {
  switch (status) {
    case "created":
      return "Berhasil";
    case "skipped":
      return "Skipped";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

function formatResolvedPackageSourceLabel(
  source: NonNullable<CreateAdminBatchPaymentSessionItem["resolvedPackage"]>["source"],
) {
  switch (source) {
    case "fixed_package":
      return "Paket tetap";
    case "latest_subscription":
      return "Paket subscription terakhir";
    default:
      return source;
  }
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-slate-200/80 bg-white/95 px-4 py-3 shadow-[0_12px_24px_-24px_rgba(15,23,42,0.14)]">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function BillingFeedbackBanner({
  feedback,
  onDismiss,
}: {
  feedback: BillingFeedback;
  onDismiss: () => void;
}) {
  const toneClassNames: Record<BillingFeedbackTone, string> = {
    success:
      "border-emerald-100/80 bg-emerald-50/90 text-emerald-700 shadow-[0_14px_24px_-24px_rgba(16,185,129,0.2)]",
    warning:
      "border-amber-100/80 bg-amber-50/90 text-amber-700 shadow-[0_14px_24px_-24px_rgba(245,158,11,0.2)]",
    info: "border-sky-100/80 bg-sky-50/90 text-sky-700 shadow-[0_14px_24px_-24px_rgba(14,165,233,0.2)]",
  };

  return (
    <div
      className={cn(
        "rounded-[24px] px-5 py-4",
        toneClassNames[feedback.tone],
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-950">{feedback.title}</p>
          <p className="mt-1 text-sm leading-6">{feedback.message}</p>

          {feedback.checkoutUrl || feedback.statusPagePath ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {feedback.checkoutUrl ? (
                <a
                  href={feedback.checkoutUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-full border border-white/80 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white"
                >
                  Buka Checkout Link
                </a>
              ) : null}
              {feedback.statusPagePath ? (
                <a
                  href={normalizeRegistrationPath(feedback.statusPagePath) ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-full border border-white/80 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white"
                >
                  Buka Status Page
                </a>
              ) : null}
            </div>
          ) : null}
        </div>

        <Button type="button" variant="outline" size="sm" onClick={onDismiss}>
          Tutup
        </Button>
      </div>
    </div>
  );
}

function AnomalyBanner({
  count,
  message,
}: {
  count: number;
  message: string;
}) {
  if (!count) {
    return null;
  }

  return (
    <div className="rounded-[22px] border border-rose-100/80 bg-rose-50/90 px-4 py-3 text-sm leading-6 text-rose-700 shadow-[0_14px_24px_-24px_rgba(244,63,94,0.18)]">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl border border-white/80 bg-white text-rose-600 shadow-sm">
          <AlertTriangle className="size-4" />
        </div>
        <div>
          <p className="font-semibold text-slate-900">
            {count} data perlu perhatian admin
          </p>
          <p className="mt-1 text-rose-700">{message}</p>
        </div>
      </div>
    </div>
  );
}

function LoadingPanel({ title }: { title: string }) {
  return (
    <div aria-label={title} role="status">
      <AdminListPanelSkeleton rows={5} />
      <span className="sr-only">{title}...</span>
    </div>
  );
}

function ActivationOverviewCard({
  label,
  value,
  tone = "default",
  isLoading = false,
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning" | "info";
  isLoading?: boolean;
}) {
  const toneClassName =
    tone === "success"
      ? "border-emerald-100 bg-emerald-50/80 text-emerald-800"
      : tone === "warning"
        ? "border-amber-100 bg-amber-50/80 text-amber-800"
        : tone === "info"
          ? "border-orange-100 bg-orange-50/80 text-orange-800"
          : "border-slate-200 bg-white text-slate-800";

  return (
    <div
      className={cn(
        "rounded-[18px] border px-3 py-2.5 shadow-[0_10px_20px_-22px_rgba(15,23,42,0.22)]",
        toneClassName,
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-75">
        {label}
      </p>
      {isLoading ? (
        <Skeleton className="mt-1 h-5 w-20" />
      ) : (
        <p className="mt-1 text-sm font-semibold">{value}</p>
      )}
    </div>
  );
}

function ErrorPanel({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-[24px] border border-rose-100/80 bg-[linear-gradient(180deg,rgba(255,241,242,0.92),rgba(255,255,255,0.98))] px-5 py-8 shadow-[0_16px_28px_-24px_rgba(244,63,94,0.2)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-rose-100/80 bg-white text-rose-600 shadow-sm shadow-white/60">
            <AlertTriangle className="size-5" />
          </div>
          <div>
            <p className="text-base font-semibold text-slate-950">
              Data pembayaran belum bisa dimuat
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-600">{message}</p>
          </div>
        </div>

        <Button type="button" variant="outline" onClick={onRetry}>
          <RefreshCw className="size-4" />
          Coba lagi
        </Button>
      </div>
    </div>
  );
}

function StudentsWithoutMembershipPanel({
  students,
  isLoading,
  error,
}: {
  students: AdminStudent[];
  isLoading: boolean;
  error: string | null;
}) {
  return (
    <div className="rounded-[24px] border border-orange-100/80 bg-[linear-gradient(180deg,rgba(255,247,237,0.72),rgba(255,255,255,0.96))] p-4 shadow-[0_16px_30px_-26px_rgba(15,23,42,0.14)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-slate-950">
              Siswa Belum Membership
            </p>
            <Badge variant="warning">{students.length} siswa</Badge>
          </div>
          <p className="text-sm leading-6 text-slate-600">
            Daftar ini menampilkan siswa existing yang belum muncul pada data
            aktivasi membership. Cocok dipakai untuk aktivasi awal siswa lama
            tanpa mengganggu sistem utama.
          </p>
          <p className="text-xs leading-5 text-slate-500">
            Filter pencarian, jenjang, dan kelas tetap berlaku di panel ini.
            Data cabang mengikuti scope akun admin secara otomatis.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-20 animate-pulse rounded-[20px] border border-orange-100/80 bg-white/80"
            />
          ))}
        </div>
      ) : null}

      {!isLoading && error ? (
        <div className="mt-4 rounded-[20px] border border-rose-100/80 bg-rose-50/85 px-4 py-3 text-sm leading-6 text-rose-700">
          {error}
        </div>
      ) : null}

      {!isLoading && !error && students.length === 0 ? (
        <div className="mt-4 rounded-[20px] border border-emerald-100/80 bg-emerald-50/75 px-4 py-4 text-sm leading-6 text-emerald-800">
          Semua siswa yang cocok dengan filter saat ini sudah memiliki jejak
          membership di sistem.
        </div>
      ) : null}

      {!isLoading && !error && students.length > 0 ? (
        <div className="mt-4 max-h-[28rem] space-y-3 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pr-1">
          {students.map((student) => (
            <div
              key={student.id}
              className="flex flex-col gap-4 rounded-[20px] border border-white/80 bg-white/95 px-4 py-4 shadow-[0_12px_24px_-24px_rgba(15,23,42,0.16)] lg:flex-row lg:items-start lg:justify-between"
            >
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-950">{student.name}</p>
                  <AdminStatusBadge status={student.status} className="w-fit" />
                </div>
                <p className="text-sm text-slate-500">
                  {student.id} | {student.className} | {student.branch || "Belum diatur"}
                </p>
                <p className="text-sm text-slate-500">{student.email}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CreateMembershipBillingDialog({
  open,
  onOpenChange,
  levelOptions,
  batchLevel,
  batchClassOptions,
  batchClassOption,
  billingPackages,
  classPricingMatrix,
  packageLookupOptions,
  batchPackageMode,
  batchPackageKey,
  batchIncludeInactive,
  batchResult,
  batchError,
  isSubmitting,
  onBatchLevelChange,
  onBatchClassOptionChange,
  onBatchPackageModeChange,
  onBatchPackageKeyChange,
  onBatchIncludeInactiveChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  levelOptions: StudentLevel[];
  batchLevel: StudentLevel;
  batchClassOptions: string[];
  batchClassOption: string;
  billingPackages: AdminBillingPackage[];
  classPricingMatrix: ClassPricingMatrix;
  packageLookupOptions: OnlinePackageDefinition[];
  batchPackageMode: BatchPackageMode;
  batchPackageKey: string;
  batchIncludeInactive: boolean;
  batchResult: CreateAdminBatchPaymentSessionData | null;
  batchError: string | null;
  isSubmitting: boolean;
  onBatchLevelChange: (value: StudentLevel) => void;
  onBatchClassOptionChange: (value: string) => void;
  onBatchPackageModeChange: (value: BatchPackageMode) => void;
  onBatchPackageKeyChange: (value: string) => void;
  onBatchIncludeInactiveChange: (value: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const batchClassNameForPrice = buildCanonicalBatchClassName(
    batchLevel,
    batchClassOption,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={billingDialogClassName}>
        <form className="flex max-h-[90vh] flex-col" onSubmit={onSubmit}>
          <DialogHeader className="gap-3 border-b border-slate-100 px-5 pb-4 pt-5 pr-12 sm:px-6">
            <DialogTitle className="text-xl sm:text-2xl">
              Perpanjangan Membership Massal
            </DialogTitle>
            <DialogDescription>
              Sistem akan otomatis mengecek masa aktif siswa dan membuatkan transaksi perpanjangan.
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] px-5 py-4 sm:px-6">
              <div className="mt-4 space-y-4">
                <div className="rounded-[22px] border border-orange-100/80 bg-[linear-gradient(135deg,rgba(255,247,237,0.95),rgba(255,255,255,0.98))] px-4 py-4 shadow-[0_18px_32px_-30px_rgba(15,23,42,0.16)]">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-950">
                        Perpanjangan Massal per Kelas
                      </p>
                      <p className="text-sm leading-6 text-slate-600">
                        Otomatis membuat transaksi untuk satu kelas sekaligus. 
                        Sistem dapat membaca riwayat langganan sebelumnya secara cerdas.
                      </p>
                    </div>
                    <Badge variant="info" className="w-fit">
                      Sistem Cerdas Aktif
                    </Badge>
                  </div>
                </div>

                {batchError ? (
                  <div className="rounded-[20px] border border-rose-100/80 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
                    {batchError}
                  </div>
                ) : null}

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-800">
                      Jenjang / program
                    </label>
                    <Select
                      value={batchLevel}
                      onValueChange={(value) => onBatchLevelChange(value as StudentLevel)}
                    >
                      <SelectTrigger className={warmSelectTriggerClassName}>
                        <SelectValue placeholder="Pilih jenjang" />
                      </SelectTrigger>
                      <SelectContent className={warmSelectContentClassName}>
                        {levelOptions.map((option) => (
                          <SelectItem
                            key={option}
                            value={option}
                            className={warmSelectItemClassName}
                          >
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-800">
                      Kelas
                    </label>
                    <Select
                      value={batchClassOption}
                      onValueChange={onBatchClassOptionChange}
                    >
                      <SelectTrigger className={warmSelectTriggerClassName}>
                        <SelectValue placeholder="Pilih kelas" />
                      </SelectTrigger>
                      <SelectContent className={warmSelectContentClassName}>
                        {batchClassOptions.map((option) => (
                          <SelectItem
                            key={option}
                            value={option}
                            className={warmSelectItemClassName}
                          >
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-800">
                      Mode paket
                    </label>
                    <Select
                      value={batchPackageMode}
                      onValueChange={(value) =>
                        onBatchPackageModeChange(value as BatchPackageMode)
                      }
                    >
                      <SelectTrigger className={warmSelectTriggerClassName}>
                        <SelectValue placeholder="Pilih mode paket" />
                      </SelectTrigger>
                      <SelectContent className={warmSelectContentClassName}>
                        <SelectItem
                          value="follow_latest_package"
                          className={warmSelectItemClassName}
                        >
                          Ikuti paket terakhir siswa
                        </SelectItem>
                        <SelectItem
                          value="fixed_package"
                          className={warmSelectItemClassName}
                        >
                          Paket seragam satu kelas
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs leading-5 text-slate-500">
                      {batchPackageMode === "follow_latest_package"
                        ? "Siswa tanpa riwayat paket akan masuk laporan skipped."
                        : "Paket ini dipakai untuk seluruh siswa target."}
                    </p>
                  </div>

                  {batchPackageMode === "fixed_package" ? (
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-800">
                        Paket seragam
                      </label>
                      <Select
                        value={batchPackageKey}
                        onValueChange={onBatchPackageKeyChange}
                      >
                        <SelectTrigger className={warmSelectTriggerClassName}>
                          <SelectValue placeholder="Pilih paket" />
                        </SelectTrigger>
                        <SelectContent className={warmSelectContentClassName}>
                          {billingPackages.map((item) => {
                            const dynamicAmount = getPriceByClassAndPackage(
                              batchClassNameForPrice,
                              item.packageKey,
                              classPricingMatrix,
                              packageLookupOptions,
                            );

                            return (
                              <SelectItem
                                key={item.packageKey}
                                value={item.packageKey}
                                className={warmSelectItemClassName}
                              >
                                {item.packageName} | {formatCurrency(dynamicAmount)}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/75 px-4 py-3 text-sm leading-6 text-slate-600">
                      Sistem membaca paket membership terakhir setiap siswa lalu
                      membuat draft perpanjangan massal untuk kelas terpilih.
                    </div>
                  )}
                </div>

                <label className="flex items-start gap-3 rounded-[20px] border border-slate-200/80 bg-slate-50/75 px-4 py-3 text-sm text-slate-700 shadow-[0_12px_22px_-24px_rgba(15,23,42,0.16)]">
                  <input
                    type="checkbox"
                    checked={batchIncludeInactive}
                    onChange={(event) =>
                      onBatchIncludeInactiveChange(event.target.checked)
                    }
                    className="mt-0.5 size-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                  />
                  <span className="leading-6">
                    <span className="font-semibold text-slate-800">
                      Termasuk siswa nonaktif (berhenti/cuti).
                    </span>{" "}
                    Jika dimatikan, sistem pintar akan otomatis mendeteksi dan
                    melewati (skip) siswa yang sudah tidak aktif di kelas tersebut.
                  </span>
                </label>

                {batchResult ? (
                  <div className="space-y-4 rounded-[24px] border border-slate-200/80 bg-white/95 p-4 shadow-[0_16px_30px_-28px_rgba(15,23,42,0.16)]">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-base font-semibold text-slate-950">
                          Laporan Sistem Perpanjangan
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-500">
                          Target kelas {batchResult.filters.level}{" "}
                          {batchResult.filters.className} (Tipe: {" "}
                          {batchResult.filters.packageMode ===
                          "follow_latest_package"
                            ? "Sistem Cerdas / Otomatis"
                            : "Manual Seragam"}
                          ).
                        </p>
                      </div>
                      <Badge
                        variant={
                          batchResult.summary.failedCount > 0
                            ? "warning"
                            : "success"
                        }
                        className="w-fit"
                      >
                        {batchResult.summary.createdCount} berhasil
                      </Badge>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <InfoField
                        label="Total target"
                        value={String(batchResult.summary.totalTargetStudents)}
                      />
                      <InfoField
                        label="Berhasil dibuat"
                        value={String(batchResult.summary.createdCount)}
                      />
                      <InfoField
                        label="Skipped"
                        value={String(batchResult.summary.skippedCount)}
                      />
                      <InfoField
                        label="Failed"
                        value={String(batchResult.summary.failedCount)}
                      />
                        <InfoField
                        label="Cabang"
                        value={batchResult.filters.branch ?? "Cabang admin"}
                      />
                    </div>

                    {Object.keys(batchResult.summary.reasonCounts).length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-slate-800">
                          Reason counts
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(batchResult.summary.reasonCounts).map(
                            ([reasonCode, count]) => (
                              <Badge key={reasonCode} variant="outline">
                                {formatBatchReasonLabel(
                                  reasonCode as AdminBatchPaymentReasonCode,
                                )}{" "}
                                • {count}
                              </Badge>
                            ),
                          )}
                        </div>
                      </div>
                    ) : null}

                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-slate-800">
                        Detail siswa
                      </p>
                      <div className="max-h-[38vh] space-y-3 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pr-1">
                        {batchResult.items.map((item) => (
                          <div
                            key={`${item.studentId}-${item.paymentId ?? item.reasonCode ?? item.status}`}
                            className="rounded-[22px] border border-slate-200/80 bg-slate-50/80 p-4 shadow-[0_12px_22px_-24px_rgba(15,23,42,0.14)]"
                          >
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div className="space-y-1.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-semibold text-slate-950">
                                    {item.studentName}
                                  </p>
                                  <Badge
                                    variant={formatBatchItemStatusTone(item.status)}
                                  >
                                    {formatBatchItemStatusLabel(item.status)}
                                  </Badge>
                                  <Badge variant="secondary">
                                    {item.studentStatus}
                                  </Badge>
                                  {item.reasonCode ? (
                                    <Badge variant="outline">
                                      {formatBatchReasonLabel(item.reasonCode)}
                                    </Badge>
                                  ) : null}
                                </div>
                                <p className="text-sm text-slate-500">
                                  {item.studentId} • {item.className}
                                </p>
                                {item.email ? (
                                  <p className="text-sm text-slate-500">
                                    {item.email}
                                  </p>
                                ) : null}
                                <p className="text-sm leading-6 text-slate-600">
                                  {item.message}
                                </p>
                              </div>

                              {item.resolvedPackage ? (
                                <div className="rounded-[18px] border border-orange-100/80 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
                                  <p className="font-semibold text-slate-900">
                                    {item.resolvedPackage.packageName}
                                  </p>
                                  <p className="mt-1 text-xs leading-5 text-slate-500">
                                    {item.resolvedPackage.durationMonth} bulan •{" "}
                                    {formatResolvedPackageSourceLabel(
                                      item.resolvedPackage.source,
                                    )}
                                  </p>
                                  {item.resolvedPackage.sourceSubscriptionCode ? (
                                    <p className="mt-1 text-xs leading-5 text-slate-500">
                                      Dari subscription{" "}
                                      {item.resolvedPackage.sourceSubscriptionCode}
                                    </p>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>

                            {item.status === "created" ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {item.paymentId ? (
                                  <Badge variant="success">
                                    No. Ref: {item.paymentId}
                                  </Badge>
                                ) : null}
                                {item.subscriptionCode ? (
                                  <Badge variant="secondary">
                                    {item.subscriptionCode}
                                  </Badge>
                                ) : null}
                                {item.checkoutUrl ? (
                                  <a
                                    href={item.checkoutUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center rounded-full border border-white/80 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-orange-50 hover:text-orange-700"
                                  >
                                    Buka checkout
                                  </a>
                                ) : null}
                                {item.statusPagePath ? (
                                  <a
                                    href={normalizeRegistrationPath(item.statusPagePath) ?? "#"}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center rounded-full border border-white/80 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-orange-50 hover:text-orange-700"
                                  >
                                    Buka status
                                  </a>
                                ) : null}
                              </div>
                            ) : null}

                            {item.reasonCode === "BLOCKING_PENDING_PAYMENT" ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {item.blockingPaymentId ? (
                                  <Badge variant="warning">
                                    Blocking payment: {item.blockingPaymentId}
                                  </Badge>
                                ) : null}
                                {item.blockingSubscriptionCode ? (
                                  <Badge variant="warning">
                                    {item.blockingSubscriptionCode}
                                  </Badge>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
          </div>

          <DialogFooter className="border-t border-slate-100 px-5 py-4 sm:px-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Tutup
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              {batchResult ? "Proses Batch Lagi" : "Proses Perpanjangan Massal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function IncomingPaymentEditDialog({
  record,
  billingPackages,
  classPricingMatrix,
  packageLookupOptions,
  open,
  isSubmitting,
  isStatusSubmitting,
  onOpenChange,
  onConfirm,
  onMarkPaid,
}: {
  record: IncomingPaymentRecord | null;
  billingPackages: AdminBillingPackage[];
  classPricingMatrix: ClassPricingMatrix;
  packageLookupOptions: OnlinePackageDefinition[];
  open: boolean;
  isSubmitting: boolean;
  isStatusSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (
    record: IncomingPaymentRecord,
    payload: ReplaceAdminPaymentPayload,
  ) => void;
  onMarkPaid: (record: IncomingPaymentRecord) => void;
}) {
  const initialPackage =
    billingPackages.find((item) => item.packageKey === record?.packageKey) ??
    billingPackages.find((item) => item.packageName === record?.packageName) ??
    billingPackages[0];
  const [packageKey, setPackageKey] = useState(
    initialPackage?.packageKey ?? "",
  );
  const [expiresAtValue, setExpiresAtValue] = useState(
    formatDateTimeLocalInput(record?.expiresAt),
  );

  const isBusy = isSubmitting || isStatusSubmitting;
  const showTransactionEditor = record?.source === "admin";
  const canMarkPaid = record?.status === "pending";
  const canSubmit =
    Boolean(record) &&
    showTransactionEditor &&
    record.status === "pending" &&
    Boolean(packageKey);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={detailDialogClassName}>
        {record ? (
          <form
            className="flex max-h-[84vh] flex-col"
            onSubmit={(event) => {
              event.preventDefault();

              if (!canSubmit) {
                return;
              }

              onConfirm(record, {
                packageKey,
                expiresAt: expiresAtValue
                  ? new Date(expiresAtValue).toISOString()
                  : undefined,
              });
            }}
          >
            <DialogHeader className="gap-3 border-b border-slate-100 px-5 pb-4 pt-5 pr-12 sm:px-6">
              <div className="flex flex-wrap items-center gap-2">
                <AdminStatusBadge
                  status={formatPaymentStatusLabel(record.status)}
                  tone={formatPaymentStatusTone(record.status)}
                  className="w-fit"
                />
                <Badge variant="secondary">Edit pembayaran</Badge>
              </div>
              <DialogTitle className="text-xl sm:text-2xl">
                {record.paymentId}
              </DialogTitle>
              <DialogDescription>
                {showTransactionEditor
                  ? "Edit transaksi admin pending atau tandai statusnya menjadi lunas dari dialog yang sama."
                  : "Tandai pembayaran pending menjadi lunas tanpa mengubah detail transaksi asal."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] px-5 py-4 sm:px-6">
              <div className="grid gap-4 md:grid-cols-2">
                <InfoField label="Nama siswa" value={record.student.name} />
                <InfoField label="Transaksi lama" value={record.paymentId} />

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-semibold text-slate-700">
                    Paket membership
                  </label>
                  <Select value={packageKey} onValueChange={setPackageKey}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih paket" />
                    </SelectTrigger>
                    <SelectContent>
                      {billingPackages.map((item) => {
                        const dynamicAmount = getPriceByClassAndPackage(
                          record?.student.className,
                          item.packageKey,
                          classPricingMatrix,
                          packageLookupOptions,
                        );
                        return (
                          <SelectItem key={item.packageKey} value={item.packageKey}>
                            {item.packageName} · {formatCurrency(dynamicAmount)}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label
                    htmlFor="edit-payment-expires-at"
                    className="text-sm font-semibold text-slate-700"
                  >
                    Batas pembayaran baru
                  </label>
                  <Input
                    id="edit-payment-expires-at"
                    type="datetime-local"
                    value={expiresAtValue}
                    onChange={(event) => setExpiresAtValue(event.target.value)}
                  />
                  <p className="text-xs leading-5 text-slate-500">
                    Kosongkan bila ingin memakai masa berlaku default dari provider.
                  </p>
                </div>
              </div>

              <div className="rounded-[20px] border border-amber-100/80 bg-amber-50/90 px-4 py-3 text-sm leading-6 text-amber-700">
                Tautan lama akan dibatalkan. Sistem membuat no referensi dan
                tautan pembayaran baru agar data tetap konsisten.
              </div>

              <div className="rounded-[20px] border border-emerald-100/80 bg-emerald-50/90 px-4 py-3 text-sm leading-6 text-emerald-700">
                Dari dialog ini admin juga bisa menandai transaksi pending
                menjadi Lunas tanpa membuat sesi pembayaran baru.
              </div>
            </div>

            <DialogFooter className="border-t border-slate-100 px-5 py-4 sm:px-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isBusy}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-700"
                disabled={!canMarkPaid || isBusy}
                onClick={() => onMarkPaid(record)}
              >
                {isStatusSubmitting ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                Tandai Lunas
              </Button>
              <Button type="submit" disabled={!canSubmit || isBusy}>
                {isSubmitting ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Pencil className="size-4" />
                )}
                Simpan Transaksi
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function IncomingPaymentStatusEditDialog({
  record,
  open,
  isSubmitting,
  onOpenChange,
  onConfirm,
}: {
  record: IncomingPaymentRecord | null;
  open: boolean;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (record: IncomingPaymentRecord) => void;
}) {
  const canMarkPaid = record?.status === "pending";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={detailDialogClassName}>
        {record ? (
          <div className="flex max-h-[84vh] flex-col">
            <DialogHeader className="gap-3 border-b border-slate-100 px-5 pb-4 pt-5 pr-12 sm:px-6">
              <div className="flex flex-wrap items-center gap-2">
                <AdminStatusBadge
                  status={formatPaymentStatusLabel(record.status)}
                  tone={formatPaymentStatusTone(record.status)}
                  className="w-fit"
                />
                <Badge variant="secondary">Edit status pembayaran</Badge>
              </div>
              <DialogTitle className="text-xl sm:text-2xl">
                {record.paymentId}
              </DialogTitle>
              <DialogDescription>
                Tandai pembayaran yang tertunda sebagai lunas.
                Status layanan siswa akan mengikuti pengaturan sistem otomatis.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] px-5 py-4 sm:px-6">
              <div className="grid gap-3 md:grid-cols-2">
                <InfoField label="Nama siswa" value={record.student.name} />
                <InfoField
                  label="Kode Layanan"
                  value={record.subscription?.subscriptionCode ?? "-"}
                />
                <InfoField label="Paket membership" value={record.packageName} />
                <InfoField label="Nominal" value={formatCurrency(record.amount)} />
                <InfoField
                  label="Status sekarang"
                  value={formatPaymentStatusLabel(record.status)}
                />
                <InfoField
                  label="Status baru"
                  value={canMarkPaid ? "Lunas" : "Tidak dapat diubah"}
                />
              </div>

              <div className="rounded-[20px] border border-amber-100/80 bg-amber-50/90 px-4 py-3 text-sm leading-6 text-amber-700">
                Perubahan ini akan menyimpan tanggal bayar saat tombol ditekan,
                mengubah payment menjadi Lunas, dan mengaktifkan subscription jika
                periode membership sudah mulai.
              </div>
            </div>

            <DialogFooter className="border-t border-slate-100 px-5 py-4 sm:px-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Batal
              </Button>
              <Button
                type="button"
                disabled={!canMarkPaid || isSubmitting}
                onClick={() => onConfirm(record)}
              >
                {isSubmitting ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                Tandai Lunas
              </Button>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function IncomingPaymentDetailDialog({
  record,
  open,
  onOpenChange,
}: {
  record: IncomingPaymentRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const anomalyReasons = record ? getIncomingAnomalyReasons(record) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={detailDialogClassName}>
        {record ? (
          <div className="flex max-h-[84vh] flex-col">
            <DialogHeader className="gap-3 border-b border-slate-100 px-5 pb-4 pt-5 pr-12 sm:px-6">
              <div className="flex flex-wrap items-center gap-2">
                <AdminStatusBadge
                  status={formatPaymentStatusLabel(record.status)}
                  tone={formatPaymentStatusTone(record.status)}
                  className="w-fit"
                />
                {anomalyReasons.length ? (
                  <Badge variant="danger">Anomali data</Badge>
                ) : null}
              </div>
              <DialogTitle className="text-xl sm:text-2xl">
                {record.student.name}
              </DialogTitle>
              <DialogDescription>
                Detail transaksi membership dan status pembayaran berdasarkan
                sistem pusat.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] px-5 py-4 sm:px-6">
              {anomalyReasons.length ? (
                <div className="rounded-[22px] border border-rose-100/80 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
                  {anomalyReasons.join(" ")}
                </div>
              ) : null}

              <div className="grid gap-3 md:grid-cols-2">
                <InfoField label="No. Referensi" value={record.paymentId} />
                <InfoField
                  label="Kode Layanan"
                  value={record.subscription?.subscriptionCode ?? "-"}
                />
                <InfoField
                  label="Nomor Induk"
                  value={record.student.studentId ?? "-"}
                />
                <InfoField label="Nama siswa" value={record.student.name} />
                <InfoField
                  label="Email siswa"
                  value={record.student.email ?? "Email tidak tersedia"}
                />
                <InfoField label="Cabang" value={record.student.branch} />
                <InfoField
                  label="Program / Kelas"
                  value={`${record.student.program || "-"} / ${record.student.className || "-"}`}
                />
                <InfoField label="Paket membership" value={record.packageName} />
                <InfoField label="Nominal" value={formatCurrency(record.amount)} />
                <InfoField
                  label="Durasi"
                  value={
                    record.durationMonth
                      ? `${record.durationMonth} bulan`
                      : "Durasi belum tersedia"
                  }
                />
                <InfoField
                  label="Provider"
                  value={formatProviderLabel(record.provider)}
                />
                <InfoField
                  label="Metode"
                  value={formatPaymentMethodLabel(record.method)}
                />
                <InfoField
                  label="Sumber"
                  value={formatPaymentSourceLabel(record.source)}
                />
                <InfoField
                  label="Status"
                  value={formatPaymentStatusLabel(record.status)}
                />
                <InfoField
                  label={getIncomingDisplayDateLabel(record)}
                  value={formatDateTimeLabel(getIncomingDisplayDate(record))}
                />
                <InfoField
                  label="Expired at"
                  value={formatDateTimeLabel(record.expiresAt)}
                />
                <InfoField
                  label="Link terakhir dikirim"
                  value={formatDateTimeLabel(record.checkoutLastSentAt)}
                />
                <InfoField
                  label="Jumlah resend"
                  value={`${record.checkoutSendCount}x`}
                />
                <InfoField
                  label="Alasan cancel"
                  value={formatCancelReasonLabel(record.cancelReason)}
                />
                <InfoField
                  label="Dibatalkan pada"
                  value={formatDateTimeLabel(record.canceledAt)}
                />
              </div>

              {record.checkoutUrl ? (
                <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/90 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Checkout link
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={record.checkoutUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center rounded-full border border-white/80 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-orange-50"
                    >
                      Buka checkout
                    </a>
                    {buildPaymentStatusPagePath(record.paymentId) ? (
                      <a
                        href={buildPaymentStatusPagePath(record.paymentId) ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center rounded-full border border-white/80 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-orange-50"
                      >
                        Buka status page
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            <DialogFooter className="border-t border-slate-100 px-5 py-4 sm:px-6">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Tutup
              </Button>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ActivationDetailDialog({
  record,
  open,
  onOpenChange,
}: {
  record: ActivationRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const anomalyReasons = record ? getActivationAnomalyReasons(record) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={detailDialogClassName}>
        {record ? (
          <div className="flex max-h-[84vh] flex-col">
            <DialogHeader className="gap-3 border-b border-slate-100 px-5 pb-4 pt-5 pr-12 sm:px-6">
              <div className="flex flex-wrap items-center gap-2">
                <AdminStatusBadge
                  status={formatPaymentStatusLabel(record.paymentStatus)}
                  tone={formatPaymentStatusTone(record.paymentStatus)}
                  className="w-fit"
                />
                <AdminStatusBadge
                  status={record.activationStatus}
                  tone={formatActivationStatusTone(record.activationStatus)}
                  className="w-fit"
                />
                {anomalyReasons.length ? (
                  <Badge variant="danger">Anomali data</Badge>
                ) : null}
              </div>
              <DialogTitle className="text-xl sm:text-2xl">
                {record.studentName}
              </DialogTitle>
              <DialogDescription>
                Detail aktivasi layanan siswa.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] px-5 py-4 sm:px-6">
              {anomalyReasons.length ? (
                <div className="rounded-[22px] border border-rose-100/80 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
                  {anomalyReasons.join(" ")}
                </div>
              ) : null}

              <div className="grid gap-3 md:grid-cols-2">
                <InfoField label="Nomor Induk" value={record.studentId ?? "-"} />
                <InfoField label="No. Referensi" value={record.paymentId ?? "-"} />
                <InfoField label="Nama siswa" value={record.studentName} />
                <InfoField
                  label="Email siswa"
                  value={record.studentEmail ?? "Email tidak tersedia"}
                />
                <InfoField label="Cabang" value={record.branch} />
                <InfoField label="Jenjang" value={record.jenjang} />
                <InfoField label="Kelas" value={record.classLabel} />
                <InfoField
                  label="Paket membership"
                  value={record.membershipPackage}
                />
                <InfoField
                  label="Status pembayaran"
                  value={formatPaymentStatusLabel(record.paymentStatus)}
                />
                <InfoField
                  label="Status aktivasi"
                  value={record.activationStatus}
                />
                <InfoField
                  label="Registered at"
                  value={formatDateTimeLabel(record.registeredAt)}
                />
                <InfoField
                  label="Active until"
                  value={formatDateTimeLabel(record.activeUntil)}
                />
                <InfoField
                  label="Kode Layanan"
                  value={record.subscriptionCode}
                />
              </div>
            </div>

            <DialogFooter className="border-t border-slate-100 px-5 py-4 sm:px-6">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Tutup
              </Button>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function AdminPaymentVerification({
  dashboardConfig = defaultAdminDashboardConfig,
  onRefresh,
  globalSearchQuery = "",
}: {
  dashboardConfig?: AdminDashboardConfigData;
  onRefresh?: () => Promise<void> | void;
  globalSearchQuery?: string;
}) {
  const { config: subscriptionConfig } = useSubscriptionConfig();
  const billingPackages = dashboardConfig.payment.billingPackages;
  const packageLookupOptions: OnlinePackageDefinition[] =
    subscriptionConfig.packages.length > 0
      ? subscriptionConfig.packages
      : billingPackages.map((item) => ({
          ...item,
          highlight: "",
        }));
  const batchClassOptionsByLevel =
    dashboardConfig.payment.batchClassOptionsByLevel;
  const billingLevelOptions = dashboardConfig.academic.levels as StudentLevel[];
  const levelFilterOptions: LevelFilterOption[] = [
    ALL_LEVELS,
    ...billingLevelOptions,
  ];
  const defaultBatchLevel = billingLevelOptions[0] ?? "SD";
  const defaultBatchClassOption =
    batchClassOptionsByLevel[defaultBatchLevel]?.[0] ?? "";
  const defaultBillingPackageKey = billingPackages[0]?.packageKey ?? "";
  const [activeTab, setActiveTab] = useState<PaymentTab>("incoming");
  const [incomingPayments, setIncomingPayments] = useState<
    IncomingPaymentRecord[]
  >([]);
  const [activationStudents, setActivationStudents] = useState<ActivationRecord[]>([]);
  const [students, setStudents] = useState<AdminStudent[]>([]);
  const [studentsWithMembershipIds, setStudentsWithMembershipIds] = useState<
    string[]
  >([]);
  const [adminManagedBranches, setAdminManagedBranches] = useState<string[]>([]);
  const [studentBranchAvailable, setStudentBranchAvailable] = useState(false);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [activationsLoading, setActivationsLoading] = useState(true);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [membershipCoverageLoading, setMembershipCoverageLoading] =
    useState(true);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [activationsError, setActivationsError] = useState<string | null>(null);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [membershipCoverageError, setMembershipCoverageError] = useState<
    string | null
  >(null);
  const [incomingPage, setIncomingPage] = useState(1);
  const [incomingPageLimit, setIncomingPageLimit] = useState(
    defaultIncomingPageLimit,
  );
  const [incomingTotalPages, setIncomingTotalPages] = useState(1);
  const [incomingTotalItems, setIncomingTotalItems] = useState(0);
  const [activationPage, setActivationPage] = useState(1);
  const [activationPageLimit, setActivationPageLimit] =
    useState(defaultIncomingPageLimit);
  const [activationTotalPages, setActivationTotalPages] = useState(1);
  const [activationTotalItems, setActivationTotalItems] = useState(0);
  const [activationSummary, setActivationSummary] =
    useState<AdminPaymentActivationsData["summary"]>({
      totalItems: 0,
      activeCount: 0,
      pendingCount: 0,
      expiredCount: 0,
      failedCount: 0,
    });
  const [incomingSummary, setIncomingSummary] =
    useState<AdminPaymentsListData["summary"]>(emptyIncomingSummary);
  const [billingFeedback, setBillingFeedback] = useState<BillingFeedback | null>(
    null,
  );

  const [incomingSearchQuery, setIncomingSearchQuery] = useState("");
  const [incomingStatusFilter, setIncomingStatusFilter] =
    useState<(typeof paymentStatusOptions)[number]>(ALL_PAYMENT_STATUSES);
  const [incomingPackageFilter, setIncomingPackageFilter] = useState(ALL_PACKAGES);

  const [activationSearchQuery, setActivationSearchQuery] = useState("");
  const [activationPaymentStatusFilter, setActivationPaymentStatusFilter] =
    useState<(typeof paymentStatusOptions)[number]>(ALL_PAYMENT_STATUSES);
  const [activationPackageFilter, setActivationPackageFilter] =
    useState(ALL_PACKAGES);
  const [activationStatusFilter, setActivationStatusFilter] =
    useState<(typeof activationStatusOptions)[number]>(ALL_ACTIVATION_STATUSES);
  const [levelFilter, setLevelFilter] = useState<LevelFilterOption>(ALL_LEVELS);
  const [classFilter, setClassFilter] = useState(ALL_CLASSES);
  const [activationMembershipView, setActivationMembershipView] =
    useState<ActivationMembershipView>("without_membership");

  const [selectedIncomingPaymentId, setSelectedIncomingPaymentId] = useState<
    string | null
  >(null);
  const [paymentStatusEditRecord, setPaymentStatusEditRecord] =
    useState<IncomingPaymentRecord | null>(null);
  const [paymentEditRecord, setPaymentEditRecord] =
    useState<IncomingPaymentRecord | null>(null);
  const [selectedActivationId, setSelectedActivationId] = useState<string | null>(
    null,
  );
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [batchLevel, setBatchLevel] = useState<StudentLevel>(defaultBatchLevel);
  const [batchClassOption, setBatchClassOption] =
    useState<string>(defaultBatchClassOption);
  const [batchPackageMode, setBatchPackageMode] =
    useState<BatchPackageMode>("follow_latest_package");
  const [batchPackageKey, setBatchPackageKey] =
    useState<string>(defaultBillingPackageKey);
  const [batchIncludeInactive, setBatchIncludeInactive] = useState(false);
  const [batchResult, setBatchResult] =
    useState<CreateAdminBatchPaymentSessionData | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [activePaymentActionKey, setActivePaymentActionKey] = useState<
    string | null
  >(null);
  const [isUpdatingPaymentStatus, setIsUpdatingPaymentStatus] = useState(false);
  const [isReplacingPayment, setIsReplacingPayment] = useState(false);
  const [financeRefreshKey, setFinanceRefreshKey] = useState(0);
  const previousIncomingFiltersRef = useRef<string | null>(null);
  const previousActivationFiltersRef = useRef<string | null>(null);
  const deferredIncomingSearchQuery = useDeferredValue(incomingSearchQuery);
  const deferredGlobalSearchQuery = useDeferredValue(globalSearchQuery);
  const deferredActivationSearchQuery = useDeferredValue(activationSearchQuery);

  const isRefreshing =
    paymentsLoading ||
    activationsLoading ||
    studentsLoading ||
    membershipCoverageLoading;

  function resetCreateDialogState() {
    setBatchLevel(defaultBatchLevel);
    setBatchClassOption(defaultBatchClassOption);
    setBatchPackageMode("follow_latest_package");
    setBatchPackageKey(defaultBillingPackageKey);
    setBatchIncludeInactive(false);
    setBatchResult(null);
    setBatchError(null);
  }

  function clearBatchOutcome() {
    setBatchError(null);
    setBatchResult(null);
  }

  function handleBatchLevelChange(value: StudentLevel) {
    setBatchLevel(value);
    setBatchClassOption(batchClassOptionsByLevel[value]?.[0] ?? "");
    clearBatchOutcome();
  }

  function handleBatchClassOptionChange(value: string) {
    setBatchClassOption(value);
    clearBatchOutcome();
  }

  function handleBatchPackageModeChange(value: BatchPackageMode) {
    setBatchPackageMode(value);
    clearBatchOutcome();
  }

  function handleBatchPackageKeyChange(value: string) {
    setBatchPackageKey(value);
    clearBatchOutcome();
  }

  function handleBatchIncludeInactiveChange(value: boolean) {
    setBatchIncludeInactive(value);
    clearBatchOutcome();
  }

  const normalizedIncomingSearchQuery = normalizeText(deferredIncomingSearchQuery);
  const normalizedGlobalIncomingSearchQuery = normalizeText(deferredGlobalSearchQuery);
  const incomingServerSearchQuery = [
    normalizedIncomingSearchQuery,
    normalizedGlobalIncomingSearchQuery,
  ]
    .filter(Boolean)
    .join(" ");
  const incomingRequestFiltersKey = [
    incomingServerSearchQuery.toLowerCase(),
    incomingStatusFilter,
    incomingPackageFilter,
    incomingPageLimit,
  ].join("|");
  const activationServerSearchQuery = [
    normalizeText(deferredActivationSearchQuery),
    normalizedGlobalIncomingSearchQuery,
  ]
    .filter(Boolean)
    .join(" ");
  const activationRequestFiltersKey = [
    activationServerSearchQuery.toLowerCase(),
    activationPaymentStatusFilter,
    activationPackageFilter,
    activationStatusFilter,
    levelFilter,
    classFilter,
    activationPageLimit,
  ].join("|");

  const loadIncomingPayments = useCallback(
    async (page: number = incomingPage) => {
      setPaymentsLoading(true);
      setPaymentsError(null);

      try {
        const result = await fetchAdminPayments({
          page,
          limit: incomingPageLimit,
          q: incomingServerSearchQuery || undefined,
          status:
            incomingStatusFilter === ALL_PAYMENT_STATUSES
              ? undefined
              : incomingStatusFilter,
          package:
            incomingPackageFilter === ALL_PACKAGES
              ? undefined
              : incomingPackageFilter,
        });

        setIncomingPayments(result.items);
        setAdminManagedBranches(result.scope?.managedBranches ?? []);
        setIncomingSummary(result.summary);
        setIncomingPage(result.pagination.page);
        setIncomingPageLimit(result.pagination.limit);
        setIncomingTotalPages(result.pagination.totalPages);
        setIncomingTotalItems(result.pagination.totalItems);
        setPaymentsError(null);
      } catch (error) {
        setIncomingPayments([]);
        setIncomingSummary(emptyIncomingSummary);
        setIncomingTotalPages(1);
        setIncomingTotalItems(0);
        setPaymentsError(
          error instanceof Error
            ? error.message
            : "Gagal memuat daftar payment admin.",
        );
      } finally {
        setPaymentsLoading(false);
      }
    },
    [
      incomingPage,
      incomingPageLimit,
      incomingPackageFilter,
      incomingServerSearchQuery,
      incomingStatusFilter,
    ],
  );

  const loadActivationStudents = useCallback(async (page: number = activationPage) => {
    setActivationsLoading(true);
    setActivationsError(null);

    try {
      const result = await fetchAdminPaymentActivations({
        page,
        limit: activationPageLimit,
        q: activationServerSearchQuery || undefined,
        paymentStatus:
          activationPaymentStatusFilter === ALL_PAYMENT_STATUSES
            ? undefined
            : activationPaymentStatusFilter,
        activationStatus:
          activationStatusFilter === ALL_ACTIVATION_STATUSES
            ? undefined
            : activationStatusFilter,
        package:
          activationPackageFilter === ALL_PACKAGES
            ? undefined
            : activationPackageFilter,
        level: levelFilter === ALL_LEVELS ? undefined : levelFilter,
        className: classFilter === ALL_CLASSES ? undefined : classFilter,
      });

      setActivationStudents(result.items);
      setAdminManagedBranches(result.scope?.managedBranches ?? []);
      setActivationSummary(result.summary);
      setActivationPage(result.pagination.page);
      setActivationPageLimit(result.pagination.limit);
      setActivationTotalPages(result.pagination.totalPages);
      setActivationTotalItems(result.pagination.totalItems);
      setStudentBranchAvailable(result.studentBranchAvailable);
      setActivationsError(null);
    } catch (error) {
      setActivationStudents([]);
      setActivationSummary({
        totalItems: 0,
        activeCount: 0,
        pendingCount: 0,
        expiredCount: 0,
        failedCount: 0,
      });
      setActivationTotalPages(1);
      setActivationTotalItems(0);
      setStudentBranchAvailable(false);
      setActivationsError(
        error instanceof Error
          ? error.message
          : "Gagal memuat aktivasi membership siswa.",
      );
    } finally {
      setActivationsLoading(false);
    }
  }, [
    activationPage,
    activationPageLimit,
    activationPackageFilter,
    activationPaymentStatusFilter,
    activationServerSearchQuery,
    activationStatusFilter,
    classFilter,
    levelFilter,
  ]);

  const loadStudentsList = useCallback(async () => {
    setStudentsLoading(true);
    setStudentsError(null);

    try {
      const result = await requestAdminApi<{ students: AdminStudent[] }>(
        "/api/students",
        {
          method: "GET",
        },
      );

      setStudents(result.data?.students ?? []);
      setStudentsError(null);
    } catch (error) {
      setStudents([]);
      setStudentsError(
        error instanceof Error
          ? error.message
          : "Gagal memuat daftar siswa existing.",
      );
    } finally {
      setStudentsLoading(false);
    }
  }, []);

  const loadMembershipCoverage = useCallback(async () => {
    setMembershipCoverageLoading(true);
    setMembershipCoverageError(null);

    try {
      const knownStudentIds = new Set<string>();
      let nextPage = 1;
      let totalPages = 1;

      do {
        const result = await fetchAdminPaymentActivations({
          page: nextPage,
          limit: 100,
        });

        result.items.forEach((item) => {
          const normalizedStudentId = normalizeText(item.studentId);

          if (normalizedStudentId) {
            knownStudentIds.add(normalizedStudentId);
          }
        });

        totalPages = Math.max(result.pagination.totalPages, 1);
        nextPage += 1;
      } while (nextPage <= totalPages);

      setStudentsWithMembershipIds([...knownStudentIds]);
      setMembershipCoverageError(null);
    } catch (error) {
      setStudentsWithMembershipIds([]);
      setMembershipCoverageError(
        error instanceof Error
          ? error.message
          : "Gagal memetakan siswa yang sudah memiliki membership.",
      );
    } finally {
      setMembershipCoverageLoading(false);
    }
  }, []);

  const loadPaymentView = useCallback(
    async ({
      includeStudents = true,
      page = incomingPage,
      activationPageValue = activationPage,
    }: PaymentViewRefreshOptions = {}) => {
      await Promise.allSettled([
        loadIncomingPayments(page),
        loadActivationStudents(activationPageValue),
        includeStudents ? loadStudentsList() : Promise.resolve(),
      ]);
    },
    [
      activationPage,
      incomingPage,
      loadActivationStudents,
      loadIncomingPayments,
      loadStudentsList,
    ],
  );

  const refreshPaymentViews = useCallback(
    async (options: PaymentViewRefreshOptions = {}) => {
      await Promise.allSettled([
        loadPaymentView(options),
        Promise.resolve(onRefresh?.()),
      ]);
    },
    [loadPaymentView, onRefresh],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void Promise.allSettled([
        loadActivationStudents(activationPage),
        loadStudentsList(),
      ]);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activationPage, loadActivationStudents, loadStudentsList]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadMembershipCoverage();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadMembershipCoverage]);

  useEffect(() => {
    const filtersChanged =
      previousIncomingFiltersRef.current !== null &&
      previousIncomingFiltersRef.current !== incomingRequestFiltersKey;

    previousIncomingFiltersRef.current = incomingRequestFiltersKey;

    if (filtersChanged && incomingPage !== 1) {
      setIncomingPage(1);
      return;
    }

    const timer = window.setTimeout(() => {
      void loadIncomingPayments(incomingPage);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [incomingPage, incomingRequestFiltersKey, loadIncomingPayments]);

  useEffect(() => {
    const filtersChanged =
      previousActivationFiltersRef.current !== null &&
      previousActivationFiltersRef.current !== activationRequestFiltersKey;

    previousActivationFiltersRef.current = activationRequestFiltersKey;

    if (filtersChanged && activationPage !== 1) {
      setActivationPage(1);
      return;
    }

    const timer = window.setTimeout(() => {
      void loadActivationStudents(activationPage);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    activationPage,
    activationRequestFiltersKey,
    loadActivationStudents,
  ]);

  useEffect(() => {
    const refreshOnFocus = () => {
      void refreshPaymentViews({
        includeStudents: false,
      });
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshOnFocus();
      }
    };

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshPaymentViews]);

  const incomingPackageOptions = useMemo(
    () =>
      createPackageFilterOptions(
        [
          ...billingPackages.map((item) => ({
            packageKey: item.packageKey,
            packageName: item.packageName,
            durationMonth: item.durationMonth,
            amount: item.amount,
          })),
          ...incomingPayments.map((payment) => ({
            packageKey: payment.packageKey,
            packageName: payment.packageName,
            durationMonth: payment.durationMonth,
            amount: payment.amount,
          })),
        ],
        ALL_PACKAGES,
        packageLookupOptions,
      ),
    [billingPackages, incomingPayments, packageLookupOptions],
  );

  const activationPackageOptions = useMemo(
    () =>
      createPackageFilterOptions(
        [
          ...billingPackages.map((item) => ({
            packageKey: item.packageKey,
            packageName: item.packageName,
            durationMonth: item.durationMonth,
            amount: item.amount,
          })),
          ...activationStudents.map((student) => ({
            packageKey: student.packageKey,
            packageName: student.membershipPackage,
            durationMonth: student.durationMonth,
            amount: null,
          })),
        ],
        ALL_PACKAGES,
        packageLookupOptions,
      ),
    [activationStudents, billingPackages, packageLookupOptions],
  );

  const activationClassOptions = useMemo(() => {
    if (levelFilter === ALL_LEVELS) {
      return [ALL_CLASSES];
    }

    return createSelectOptions(
      [...(batchClassOptionsByLevel[levelFilter as StudentLevel] ?? [])],
      ALL_CLASSES,
      compareClassValue,
    );
  }, [batchClassOptionsByLevel, levelFilter]);

  const filteredIncomingPayments = incomingPayments;
  const filteredActivationStudents = activationStudents;
  const adminManagedBranchKeys = useMemo(
    () =>
      adminManagedBranches.map((branch) =>
        normalizeText(branch).toLowerCase(),
      ),
    [adminManagedBranches],
  );
  const scopedStudents = useMemo(
    () =>
      adminManagedBranchKeys.length
        ? students.filter((student) =>
            adminManagedBranchKeys.includes(
              normalizeText(student.branch).toLowerCase(),
            ),
          )
        : students,
    [adminManagedBranchKeys, students],
  );
  const studentsWithMembershipIdSet = useMemo(
    () => new Set(studentsWithMembershipIds.map((value) => normalizeText(value))),
    [studentsWithMembershipIds],
  );
  const filteredStudentsWithoutMembership = useMemo(() => {
    const normalizedSearch = activationServerSearchQuery.trim().toLowerCase();
    const normalizedClassFilter =
      classFilter === ALL_CLASSES ? "" : normalizeText(classFilter);

    return scopedStudents
      .filter(
        (student) => !studentsWithMembershipIdSet.has(normalizeText(student.id)),
      )
      .filter((student) =>
        normalizedSearch
          ? [
              student.id,
              student.name,
              student.email,
              student.className,
              student.program,
              student.branch,
            ].some((value) => value.toLowerCase().includes(normalizedSearch))
          : true,
      )
      .filter((student) =>
        levelFilter === ALL_LEVELS ? true : student.level === levelFilter,
      )
      .filter((student) =>
        normalizedClassFilter
          ? normalizeText(student.className) === normalizedClassFilter
          : true,
      )
      .sort((first, second) => first.name.localeCompare(second.name, "id-ID"));
  }, [
    activationServerSearchQuery,
    classFilter,
    levelFilter,
    scopedStudents,
    studentsWithMembershipIdSet,
  ]);

  const incomingAnomalyCount = useMemo(
    () =>
      filteredIncomingPayments.filter(
        (payment) => getIncomingAnomalyReasons(payment).length > 0,
      ).length,
    [filteredIncomingPayments],
  );

  const activationAnomalyCount = useMemo(
    () =>
      activationStudents.filter(
        (student) => getActivationAnomalyReasons(student).length > 0,
      ).length,
    [activationStudents],
  );

  const studentsWithoutMembershipActiveCount = useMemo(
    () =>
      filteredStudentsWithoutMembership.filter(
        (student) => student.status === "Aktif",
      ).length,
    [filteredStudentsWithoutMembership],
  );
  const studentsWithoutMembershipInactiveCount = useMemo(
    () =>
      filteredStudentsWithoutMembership.filter(
        (student) => student.status !== "Aktif",
      ).length,
    [filteredStudentsWithoutMembership],
  );

  const incomingOverview = useMemo(
    () => ({
      totalCount: incomingTotalItems,
      filteredAmount: incomingSummary.totalAmount,
      paidCount: incomingSummary.paidCount,
      visibleCount: incomingPayments.length,
    }),
    [incomingPayments.length, incomingSummary.paidCount, incomingSummary.totalAmount, incomingTotalItems],
  );
  const incomingPageStart =
    incomingTotalItems > 0 ? (incomingPage - 1) * incomingPageLimit + 1 : 0;
  const incomingPageEnd =
    incomingPageStart > 0 && filteredIncomingPayments.length > 0
      ? incomingPageStart + filteredIncomingPayments.length - 1
      : 0;

  const activationOverview = useMemo(
    () => ({
      totalCount: activationSummary.totalItems,
      activeCount: activationSummary.activeCount,
      pendingCount: activationSummary.pendingCount,
      missingCount: filteredStudentsWithoutMembership.length,
    }),
    [activationSummary, filteredStudentsWithoutMembership.length],
  );
  const activationOverviewCards = useMemo(() => {
    if (activationMembershipView === "without_membership") {
      return [
        {
          label: "Belum membership",
          value: `${filteredStudentsWithoutMembership.length} siswa`,
          tone: "warning" as const,
        },
        {
          label: "Akun aktif",
          value: `${studentsWithoutMembershipActiveCount} siswa`,
          tone: "success" as const,
        },
        {
          label: "Akun nonaktif",
          value: `${studentsWithoutMembershipInactiveCount} siswa`,
          tone: "default" as const,
        },
      ];
    }

    return [
      {
        label: "Siswa tampil",
        value: `${activationOverview.totalCount} siswa`,
        tone: "default" as const,
      },
      {
        label: "Membership aktif",
        value: `${activationOverview.activeCount} siswa`,
        tone: "success" as const,
      },
      {
        label: "Menunggu bayar",
        value: `${activationOverview.pendingCount} siswa`,
        tone: "warning" as const,
      },
      {
        label: "Belum membership",
        value: `${activationOverview.missingCount} siswa`,
        tone: "info" as const,
      },
    ];
  }, [
    activationMembershipView,
    activationOverview.activeCount,
    activationOverview.missingCount,
    activationOverview.pendingCount,
    activationOverview.totalCount,
    filteredStudentsWithoutMembership.length,
    studentsWithoutMembershipActiveCount,
    studentsWithoutMembershipInactiveCount,
  ]);

  const selectedIncomingPayment = useMemo(
    () =>
      selectedIncomingPaymentId
        ? incomingPayments.find((payment) => payment.id === selectedIncomingPaymentId) ??
          null
        : null,
    [incomingPayments, selectedIncomingPaymentId],
  );

  const selectedActivationStudent = useMemo(
    () =>
      selectedActivationId
        ? activationStudents.find((student) => student.id === selectedActivationId) ??
          null
        : null,
    [activationStudents, selectedActivationId],
  );

  function buildPaymentRecordFromActivation(
    student: ActivationRecord,
  ): IncomingPaymentRecord | null {
    if (!student.paymentId) {
      return null;
    }

    const matchingPayment =
      incomingPayments.find((payment) => payment.paymentId === student.paymentId) ??
      null;

    if (matchingPayment) {
      return matchingPayment;
    }

    const paymentSource = student.paymentSource ?? null;

    if (!paymentSource) {
      return null;
    }

    const paymentCreatedAt = student.paymentCreatedAt ?? student.registeredAt;
    const paymentUpdatedAt = student.paymentUpdatedAt ?? paymentCreatedAt;

    return {
      id: student.paymentId,
      paymentId: student.paymentId,
      source: paymentSource,
      packageKey: student.packageKey,
      packageName: student.membershipPackage,
      durationMonth: student.durationMonth,
      amount: student.paymentAmount ?? 0,
      provider: student.paymentProvider ?? "-",
      method: student.paymentMethod ?? "-",
      status: student.paymentStatus,
      paidAt: student.paymentPaidAt ?? null,
      checkoutUrl: student.paymentCheckoutUrl ?? null,
      expiresAt: student.paymentExpiresAt ?? null,
      checkoutLastSentAt: student.paymentCheckoutLastSentAt ?? null,
      checkoutSendCount: student.paymentCheckoutSendCount ?? 0,
      cancelReason: student.paymentCancelReason ?? null,
      canceledAt: student.paymentCanceledAt ?? null,
      createdAt: paymentCreatedAt,
      updatedAt: paymentUpdatedAt,
      displayDate: student.paymentPaidAt ?? paymentCreatedAt,
      canResendLink: student.paymentCanResendLink === true,
      canCancel: student.paymentCanCancel === true,
      anomalyReasons: [],
      student: {
        id: null,
        studentId: student.studentId,
        userId: null,
        name: student.studentName,
        email: student.studentEmail,
        role: "siswa",
        branch: student.branch,
        program: student.jenjang,
        className: student.kelas,
      },
      subscription: {
        id: student.id,
        subscriptionCode: student.subscriptionCode,
        status: student.activationStatus === "Aktif" ? "active" : "pending",
        paymentStatus: student.paymentStatus,
        startDate: null,
        endDate: student.activeUntil,
        source: paymentSource,
        renewalOfSubscriptionId: null,
      },
    };
  }

  async function handleCreateBatchPaymentSession(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (batchPackageMode === "fixed_package" && !batchPackageKey) {
      const message =
        "Belum ada paket membership yang tersedia untuk penagihan massal.";
      setBatchError(message);
      window.alert(message);
      return;
    }

    const selectedGrade = extractGradeFromClassOption(batchClassOption);

    if (!selectedGrade) {
      const message = "Pilih kelas yang valid untuk batch transaksi.";
      setBatchError(message);
      window.alert(message);
      return;
    }

    setIsCreatingPayment(true);
    setBatchError(null);
    setBatchResult(null);

    try {
      const response = await createAdminBatchPaymentSession({
        level: batchLevel,
        grade: selectedGrade,
        className: buildCanonicalBatchClassName(batchLevel, batchClassOption),
        packageMode: batchPackageMode,
        packageKey:
          batchPackageMode === "fixed_package" ? batchPackageKey : undefined,
        includeInactive: batchIncludeInactive,
      });

      setBatchResult(response);
      setBillingFeedback({
        tone:
          response.summary.failedCount > 0 || response.summary.skippedCount > 0
            ? "warning"
            : "success",
        title: "Batch transaksi selesai diproses",
        message: `${response.summary.createdCount} berhasil dibuat, ${response.summary.skippedCount} skipped, dan ${response.summary.failedCount} failed untuk ${response.summary.totalTargetStudents} siswa target.`,
      });
      setIncomingPage(1);
      await Promise.allSettled([
        refreshPaymentViews({
          includeStudents: false,
          page: 1,
        }),
        loadMembershipCoverage(),
      ]);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Batch transaksi belum bisa diproses.";

      setBatchError(message);
      setBillingFeedback({
        tone: "warning",
        title: "Batch transaksi belum bisa diproses",
        message,
      });
      window.alert(message);
    } finally {
      setIsCreatingPayment(false);
    }
  }

  async function handleCreateBillingSubmit(event: FormEvent<HTMLFormElement>) {
    await handleCreateBatchPaymentSession(event);
  }

  async function handleReplacePayment(
    payment: IncomingPaymentRecord,
    payload: ReplaceAdminPaymentPayload,
  ) {
    setIsReplacingPayment(true);
    setActivePaymentActionKey(`${payment.id}:replace`);

    try {
      const response = await replaceAdminPayment(payment.paymentId, payload);
      const statusPagePath =
        normalizeRegistrationPath(response.statusPagePath) ??
        buildPaymentStatusPagePath(response.payment.paymentId);

      setBillingFeedback({
        tone: "success",
        title: "Transaksi berhasil diperbarui",
        message: `Payment ${response.replacedPaymentId} diganti dengan ${response.payment.paymentId}. Bagikan checkout link baru kepada siswa.`,
        checkoutUrl: response.payment.checkoutUrl ?? null,
        statusPagePath,
      });
      setPaymentEditRecord(null);
      window.alert("Transaksi berhasil diperbarui dengan payment baru.");
      setIncomingPage(1);
      await Promise.allSettled([
        refreshPaymentViews({
          includeStudents: false,
          page: 1,
        }),
        loadMembershipCoverage(),
      ]);
      setFinanceRefreshKey((value) => value + 1);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Transaksi belum bisa diperbarui.";

      setBillingFeedback({
        tone: "warning",
        title: "Edit transaksi gagal",
        message,
      });
      window.alert(message);
      await refreshPaymentViews({
        includeStudents: false,
      });
    } finally {
      setIsReplacingPayment(false);
      setActivePaymentActionKey(null);
    }
  }

  async function handleArchivePayment(payment: IncomingPaymentRecord) {
    const confirmed = window.confirm(
      `Hapus transaksi ${payment.paymentId} dari daftar? Data tidak dihapus permanen dan tetap tersimpan sebagai arsip audit.`,
    );

    if (!confirmed) {
      return;
    }

    setActivePaymentActionKey(`${payment.id}:archive`);

    try {
      const response = await archiveAdminPayment(
        payment.paymentId,
        "Dihapus melalui kolom aksi Informasi Pembayaran.",
      );

      setBillingFeedback({
        tone: "warning",
        title: "Transaksi dihapus dari daftar",
        message: `Payment ${response.paymentId} tetap tersimpan sebagai arsip audit.`,
      });
      setSelectedIncomingPaymentId(null);
      window.alert("Transaksi berhasil dihapus dari daftar pembayaran.");
      await Promise.allSettled([
        refreshPaymentViews({
          includeStudents: false,
        }),
        loadMembershipCoverage(),
      ]);
      setFinanceRefreshKey((value) => value + 1);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Transaksi belum bisa dihapus.";

      setBillingFeedback({
        tone: "warning",
        title: "Hapus transaksi gagal",
        message,
      });
      window.alert(message);
      await refreshPaymentViews({
        includeStudents: false,
      });
    } finally {
      setActivePaymentActionKey(null);
    }
  }

  async function handleMarkPaymentPaid(payment: IncomingPaymentRecord) {
    if (payment.status !== "pending") {
      const message = "Hanya payment pending yang bisa ditandai lunas.";
      setBillingFeedback({
        tone: "warning",
        title: "Status tidak bisa diubah",
        message,
      });
      window.alert(message);
      return;
    }

    setIsUpdatingPaymentStatus(true);
    setActivePaymentActionKey(`${payment.id}:mark-paid`);

    try {
      const response = await updateAdminPaymentStatus(payment.paymentId, {
        status: "paid",
      });

      setBillingFeedback({
        tone: "success",
        title: "Pembayaran berhasil ditandai lunas",
        message: `Payment ${response.paymentId} sudah Lunas. Subscription ${response.subscriptionCode} sekarang ${response.subscriptionStatus} dengan status pembayaran ${formatPaymentStatusLabel(response.subscriptionPaymentStatus)}.`,
      });
      setPaymentStatusEditRecord(null);
      setPaymentEditRecord(null);
      window.alert("Pembayaran berhasil ditandai lunas.");
      await refreshPaymentViews({
        includeStudents: false,
      });
      setFinanceRefreshKey((value) => value + 1);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Status pembayaran belum bisa diubah.";

      setBillingFeedback({
        tone: "warning",
        title: "Update status pembayaran gagal",
        message,
      });
      window.alert(message);
      await refreshPaymentViews({
        includeStudents: false,
      });
    } finally {
      setIsUpdatingPaymentStatus(false);
      setActivePaymentActionKey(null);
    }
  }

  const incomingColumns: AdminColumnDefinition<IncomingPaymentRecord>[] = [
    {
      key: "number",
      header: "No",
      className: "w-16 text-center",
      cell: (_payment, index) => (
        <span className="text-sm font-semibold text-slate-500">
          {incomingPageStart + index}
        </span>
      ),
    },

    {
      key: "student",
      header: "Siswa",
      className: "min-w-[250px]",
      cell: (payment) => {
        const anomalyReasons = getIncomingAnomalyReasons(payment);

        return (
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-slate-950">{payment.student.name}</p>
              {anomalyReasons.length ? (
                <Badge variant="danger" className="px-2.5 py-1 text-[11px]">
                  Anomali data
                </Badge>
              ) : null}
            </div>
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Mail className="size-3.5 text-slate-400" />
              {payment.student.email ?? "Email siswa tidak tersedia"}
            </p>
            <p className="text-xs text-slate-400">
              {payment.student.program || "-"} | {payment.student.className || "-"}
            </p>
            {anomalyReasons.length ? (
              <p className="text-xs leading-5 text-rose-600">
                {anomalyReasons.join(" ")}
              </p>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "branch",
      header: "Cabang",
      className: "min-w-[140px]",
      cell: (payment) => (
        <span className="text-sm font-medium text-slate-700">
          {payment.student.branch}
        </span>
      ),
    },
    {
      key: "package",
      header: "Paket Membership",
      className: "min-w-[180px]",
      cell: (payment) => (
        <span className="text-sm leading-6 text-slate-700">{payment.packageName}</span>
      ),
    },
    {
      key: "amount",
      header: "Nominal",
      className: "min-w-[140px]",
      cell: (payment) => (
        <span className="text-sm font-semibold text-slate-900">
          {formatCurrency(payment.amount)}
        </span>
      ),
    },

    {
      key: "status",
      header: "Status",
      className: "min-w-[120px]",
      cell: (payment) => (
        <AdminStatusBadge
          status={formatPaymentStatusLabel(payment.status)}
          tone={formatPaymentStatusTone(payment.status)}
          className="w-fit"
        />
      ),
    },
    {
      key: "date",
      header: "Tanggal Bayar / Dibuat",
      className: "min-w-[170px]",
      cell: (payment) => (
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-800">
            {formatDateTimeLabel(getIncomingDisplayDate(payment))}
          </p>
          <p className="text-xs text-slate-400">
            {getIncomingDisplayDateLabel(payment)}
          </p>
        </div>
      ),
    },

    {
      key: "actions",
      header: "Aksi",
      className: "min-w-[112px] text-center",
      cell: (payment) => {
        const isMarkingPaid =
          activePaymentActionKey === `${payment.id}:mark-paid`;
        const isReplacing =
          activePaymentActionKey === `${payment.id}:replace`;
        const isArchiving =
          activePaymentActionKey === `${payment.id}:archive`;
        const isEditing = isMarkingPaid || isReplacing;
        const isProcessing = isEditing || isArchiving;
        const canEditPayment =
          payment.source === "admin" && payment.status === "pending";
        const canArchivePayment = canArchivePaymentRecord(payment);

        return (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Edit pembayaran"
              title="Edit pembayaran"
              className="size-9 rounded-xl border-sky-200 text-sky-700 hover:bg-sky-50 hover:text-sky-700"
              disabled={!canEditPayment || isProcessing}
              onClick={() => {
                if (canEditPayment) {
                  setPaymentEditRecord(payment);
                }
              }}
            >
              {isEditing ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Pencil className="size-4" />
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Hapus pembayaran"
              title="Hapus pembayaran"
              className="size-9 rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-700"
              disabled={!canArchivePayment || isProcessing}
              onClick={() => {
                if (canArchivePayment) {
                  void handleArchivePayment(payment);
                }
              }}
            >
              {isArchiving ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
            </Button>
          </div>
        );
      },
    },
  ];

  const activationColumns: AdminColumnDefinition<ActivationRecord>[] = [
    {
      key: "number",
      header: "No",
      className: "w-16 text-center",
      cell: (_student, index) => (
        <span className="text-sm font-semibold text-slate-500">{index + 1}</span>
      ),
    },
    {
      key: "studentId",
      header: "Nomor Induk",
      className: "min-w-[130px]",
      cell: (student) => (
        <span className="text-sm font-semibold text-slate-900">
          {student.studentId ?? "-"}
        </span>
      ),
    },
    {
      key: "student",
      header: "Siswa",
      className: "min-w-[250px]",
      cell: (student) => {
        const anomalyReasons = getActivationAnomalyReasons(student);

        return (
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-slate-950">{student.studentName}</p>
              {anomalyReasons.length ? (
                <Badge variant="danger" className="px-2.5 py-1 text-[11px]">
                  Anomali data
                </Badge>
              ) : null}
            </div>
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Mail className="size-3.5 text-slate-400" />
              {student.studentEmail ?? "Email siswa tidak tersedia"}
            </p>
            {anomalyReasons.length ? (
              <p className="text-xs leading-5 text-rose-600">
                {anomalyReasons.join(" ")}
              </p>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "branch",
      header: "Cabang",
      className: "min-w-[140px]",
      cell: (student) => (
        <span className="text-sm font-medium text-slate-700">{student.branch}</span>
      ),
    },
    {
      key: "level",
      header: "Jenjang",
      className: "min-w-[100px]",
      cell: (student) => (
        <span className="text-sm text-slate-700">{student.jenjang}</span>
      ),
    },
    {
      key: "class",
      header: "Kelas",
      className: "min-w-[120px]",
      cell: (student) => (
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-800">{student.kelas}</p>
          <p className="text-xs text-slate-400">{student.classLabel}</p>
        </div>
      ),
    },
    {
      key: "package",
      header: "Paket Membership",
      className: "min-w-[180px]",
      cell: (student) => (
        <span className="text-sm leading-6 text-slate-700">
          {student.membershipPackage}
        </span>
      ),
    },
    {
      key: "paymentStatus",
      header: "Status Pembayaran",
      className: "min-w-[150px]",
      cell: (student) => (
        <AdminStatusBadge
          status={formatPaymentStatusLabel(student.paymentStatus)}
          tone={formatPaymentStatusTone(student.paymentStatus)}
          className="w-fit"
        />
      ),
    },
    {
      key: "activationStatus",
      header: "Status Aktivasi",
      className: "min-w-[160px]",
      cell: (student) => (
        <AdminStatusBadge
          status={student.activationStatus}
          tone={formatActivationStatusTone(student.activationStatus)}
          className="w-fit"
        />
      ),
    },
    {
      key: "registeredAt",
      header: "Registered At",
      className: "min-w-[170px]",
      cell: (student) => (
        <span className="text-sm text-slate-700">
          {formatDateTimeLabel(student.registeredAt)}
        </span>
      ),
    },
    {
      key: "activeUntil",
      header: "Active Until",
      className: "min-w-[170px]",
      cell: (student) => (
        <span className="text-sm text-slate-700">
          {formatDateTimeLabel(student.activeUntil)}
        </span>
      ),
    },
    {
      key: "paymentId",
      header: "No. Referensi",
      className: "min-w-[150px]",
      cell: (student) => (
        <span className="text-sm text-slate-700">{student.paymentId ?? "-"}</span>
      ),
    },
    {
      key: "subscriptionCode",
      header: "Kode Layanan",
      className: "min-w-[160px]",
      cell: (student) => (
        <span className="text-sm text-slate-700">{student.subscriptionCode}</span>
      ),
    },
    {
      key: "actions",
      header: "Aksi",
      className: "min-w-[112px] text-center",
      cell: (student) => {
        const payment = buildPaymentRecordFromActivation(student);
        const isMarkingPaid = payment
          ? activePaymentActionKey === `${payment.id}:mark-paid`
          : false;
        const isReplacing = payment
          ? activePaymentActionKey === `${payment.id}:replace`
          : false;
        const isArchiving = payment
          ? activePaymentActionKey === `${payment.id}:archive`
          : false;
        const isEditing = isMarkingPaid || isReplacing;
        const isProcessing = isEditing || isArchiving;
        const canEditPayment =
          payment?.source === "admin" && payment.status === "pending";
        const canArchivePayment = canArchivePaymentRecord(payment);

        return (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {payment ? (
              <>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Edit pembayaran"
                title="Edit pembayaran"
                className="size-9 rounded-xl border-sky-200 text-sky-700 hover:bg-sky-50 hover:text-sky-700"
                disabled={!canEditPayment || isProcessing}
                onClick={() => {
                  if (canEditPayment) {
                    setPaymentEditRecord(payment);
                  }
                }}
              >
                {isEditing ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Pencil className="size-4" />
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Hapus pembayaran"
                title="Hapus pembayaran"
                className="size-9 rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-700"
                disabled={!canArchivePayment || isProcessing}
                onClick={() => {
                  if (canArchivePayment) {
                    void handleArchivePayment(payment);
                  }
                }}
              >
                {isArchiving ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </Button>
              </>
            ) : null}
          </div>
        );
      },
    },
  ];

  function resetIncomingFilters() {
    setIncomingPage(1);
    setIncomingSearchQuery("");
    setIncomingStatusFilter(ALL_PAYMENT_STATUSES);
    setIncomingPackageFilter(ALL_PACKAGES);
  }

  function resetActivationFilters() {
    setActivationSearchQuery("");
    setActivationPaymentStatusFilter(ALL_PAYMENT_STATUSES);
    setActivationPackageFilter(ALL_PACKAGES);
    setActivationStatusFilter(ALL_ACTIVATION_STATUSES);
    setLevelFilter(ALL_LEVELS);
    setClassFilter(ALL_CLASSES);
  }

  async function exportIncomingPaymentsCsv() {
    try {
      await exportAdminPaymentsCsv({
        q: incomingServerSearchQuery || undefined,
        status:
          incomingStatusFilter === ALL_PAYMENT_STATUSES
            ? undefined
            : incomingStatusFilter,
        package:
          incomingPackageFilter === ALL_PACKAGES
            ? undefined
            : incomingPackageFilter,
      });
    } catch (error) {
      setPaymentsError(
        error instanceof Error
          ? error.message
          : "Gagal mengunduh export pembayaran masuk.",
      );
    }
  }

  async function exportActivationMembershipCsv() {
    try {
      await exportAdminPaymentActivationsCsv({
        q: activationServerSearchQuery || undefined,
        paymentStatus:
          activationPaymentStatusFilter === ALL_PAYMENT_STATUSES
            ? undefined
            : activationPaymentStatusFilter,
        activationStatus:
          activationStatusFilter === ALL_ACTIVATION_STATUSES
            ? undefined
            : activationStatusFilter,
        package:
          activationPackageFilter === ALL_PACKAGES
            ? undefined
            : activationPackageFilter,
        level: levelFilter === ALL_LEVELS ? undefined : levelFilter,
        className: classFilter === ALL_CLASSES ? undefined : classFilter,
      });
    } catch (error) {
      setActivationsError(
        error instanceof Error
          ? error.message
          : "Gagal mengunduh export aktivasi membership.",
      );
    }
  }

  return (
    <>
      <div className="space-y-6">
        {billingFeedback ? (
          <BillingFeedbackBanner
            feedback={billingFeedback}
            onDismiss={() => {
              setBillingFeedback(null);
            }}
          />
        ) : null}

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as PaymentTab)}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <TabsList className="bg-slate-100/90">
              <TabsTrigger value="incoming">Pembayaran Masuk</TabsTrigger>
              <TabsTrigger value="expenses">Pengeluaran</TabsTrigger>
              <TabsTrigger value="activations">Aktivasi Membership</TabsTrigger>
            </TabsList>

            <div className="flex flex-wrap items-center gap-2">
              {!studentBranchAvailable ? (
                <Badge variant="warning">
                  Sebagian cabang siswa belum terdaftar di sistem pusat
                </Badge>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  void Promise.allSettled([
                    refreshPaymentViews(),
                    loadMembershipCoverage(),
                  ]);
                  setFinanceRefreshKey((currentValue) => currentValue + 1);
                }}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Refresh data
              </Button>
            </div>
          </div>

          <TabsContent value="incoming" className="mt-6">
            <AdminSectionCard
              title="Pembayaran Masuk"
              description="Kelola transaksi membership untuk siswa lama dan pantau riwayat transaksi yang tersimpan."
              action={
                <div className="flex flex-wrap gap-2">
                  {paymentsLoading && incomingPayments.length === 0 ? (
                    <>
                      <Skeleton className="h-6 w-32 rounded-full" />
                      <Skeleton className="h-6 w-28 rounded-full" />
                      <Skeleton className="h-6 w-20 rounded-full" />
                    </>
                  ) : (
                    <>
                      <Badge variant="secondary">
                        {incomingOverview.totalCount} transaksi tampil
                      </Badge>
                      <Badge variant="info">
                        {formatCurrency(incomingOverview.filteredAmount)}
                      </Badge>
                      <Badge variant="success">
                        {incomingOverview.paidCount} lunas
                      </Badge>
                    </>
                  )}
                </div>
              }
            >
              <div className="space-y-6">
                <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/75 p-4 shadow-[0_12px_22px_-24px_rgba(15,23,42,0.16)]">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="relative w-full xl:max-w-xl">
                      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        value={incomingSearchQuery}
                        onChange={(event) =>
                          setIncomingSearchQuery(event.target.value)
                        }
                        placeholder="Cari nama siswa, no referensi, atau kode layanan..."
                        className={cn("pl-10", warmFieldClassName)}
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={exportIncomingPaymentsCsv}
                        disabled={
                          paymentsLoading || filteredIncomingPayments.length === 0
                        }
                      >
                        <Download className="size-4" />
                        Export CSV Filter
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={resetIncomingFilters}
                      >
                        Reset filter
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Select
                      value={incomingStatusFilter}
                      onValueChange={(value) =>
                        setIncomingStatusFilter(
                          value as (typeof paymentStatusOptions)[number],
                        )
                      }
                    >
                      <SelectTrigger className={warmSelectTriggerClassName}>
                        <SelectValue placeholder="Filter status" />
                      </SelectTrigger>
                      <SelectContent className={warmSelectContentClassName}>
                        {paymentStatusOptions.map((option) => (
                          <SelectItem
                            key={option}
                            value={option}
                            className={warmSelectItemClassName}
                          >
                            {option === ALL_PAYMENT_STATUSES
                              ? option
                              : formatPaymentStatusLabel(option)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={incomingPackageFilter}
                      onValueChange={setIncomingPackageFilter}
                    >
                      <SelectTrigger className={warmSelectTriggerClassName}>
                        <SelectValue placeholder="Filter paket" />
                      </SelectTrigger>
                      <SelectContent className={warmSelectContentClassName}>
                        {incomingPackageOptions.map((option) => (
                          <SelectItem
                            key={option.value}
                            value={option.value}
                            className={warmSelectItemClassName}
                          >
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                  </div>
                </div>

                {paymentsError ? (
                  <ErrorPanel
                    message={paymentsError}
                    onRetry={() => {
                      void refreshPaymentViews({
                        includeStudents: false,
                      });
                    }}
                  />
                ) : paymentsLoading ? (
                  <LoadingPanel title="Memuat pembayaran masuk" />
                ) : (
                  <>
                    <AnomalyBanner
                      count={incomingAnomalyCount}
                      message="Sebagian transaksi memiliki relasi user, student, atau metadata checkout yang belum lengkap. Data tetap ditampilkan agar admin bisa memonitor anomali tanpa mengubah histori payment."
                    />

                    <AdminDataTable
                      columns={incomingColumns}
                      data={filteredIncomingPayments}
                      keyExtractor={(payment) => payment.id}
                      minWidthClassName="min-w-[1760px]"
                      emptyTitle="Belum ada pembayaran masuk"
                      emptyDescription="Belum ada transaksi pembayaran yang tercatat atau semua data tersaring oleh filter aktif."
                      getRowClassName={(payment) =>
                        getIncomingAnomalyReasons(payment).length
                          ? "bg-rose-50/30"
                          : undefined
                      }
                    />

                    <div className="flex flex-col gap-3 rounded-[22px] border border-slate-200/80 bg-white px-4 py-3 text-sm text-slate-600 shadow-[0_12px_22px_-26px_rgba(15,23,42,0.14)] sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <p className="font-medium text-slate-800">
                          Halaman {incomingPage} dari {incomingTotalPages}
                        </p>
                        <p className="text-xs text-slate-500">
                          Menampilkan {filteredIncomingPayments.length} transaksi
                          pada halaman ini.
                          {incomingTotalItems > 0 && incomingPageEnd > 0
                            ? ` Rentang data ${incomingPageStart}-${incomingPageEnd} dari total ${incomingTotalItems} transaksi.`
                            : incomingTotalItems > 0
                              ? ` Total ada ${incomingTotalItems} transaksi, tetapi belum ada yang lolos filter tambahan pada halaman ini.`
                              : " Belum ada transaksi yang cocok dengan filter aktif."}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setIncomingPage((currentPage) =>
                              Math.max(1, currentPage - 1),
                            )
                          }
                          disabled={paymentsLoading || incomingPage <= 1}
                        >
                          Previous
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setIncomingPage((currentPage) =>
                              Math.min(incomingTotalPages, currentPage + 1),
                            )
                          }
                          disabled={
                            paymentsLoading || incomingPage >= incomingTotalPages
                          }
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </AdminSectionCard>
          </TabsContent>

          <TabsContent value="expenses" className="mt-6">
            <AdminBranchFinance
              key={financeRefreshKey}
              compactSummary
              onRefresh={async () => {
                await Promise.resolve(onRefresh?.());
              }}
              globalSearchQuery={
                activeTab === "expenses" ? globalSearchQuery : ""
              }
            />
          </TabsContent>

          <TabsContent value="activations" className="mt-6">
            <AdminSectionCard
              title="Aktivasi Membership"
              description="Pantau status aktivasi siswa berdasarkan subscription terbaru dan status pembayaran yang tersedia."
              action={
                <div className="flex w-full flex-col gap-3 sm:min-w-[360px] sm:max-w-[520px] sm:items-end">
                  <div className="inline-flex w-full rounded-2xl border border-slate-200 bg-slate-50/80 p-1 shadow-sm sm:w-auto">
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        activationMembershipView === "without_membership"
                          ? "default"
                          : "ghost"
                      }
                      className="h-8 flex-1 rounded-xl sm:flex-none"
                      onClick={() => {
                        setActivationMembershipView("without_membership");
                      }}
                    >
                      Belum Membership
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        activationMembershipView === "with_membership"
                          ? "default"
                          : "ghost"
                      }
                      className="h-8 flex-1 rounded-xl sm:flex-none"
                      onClick={() => {
                        setActivationMembershipView("with_membership");
                      }}
                    >
                      Sudah Membership
                    </Button>
                  </div>

                  <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {activationOverviewCards.map((item) => (
                      <ActivationOverviewCard
                        key={item.label}
                        label={item.label}
                        value={item.value}
                        tone={item.tone}
                        isLoading={
                          activationMembershipView === "without_membership"
                            ? studentsLoading || membershipCoverageLoading
                            : activationsLoading
                        }
                      />
                    ))}
                  </div>
                </div>
              }
            >
              <div className="space-y-6">
                <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/75 p-4 shadow-[0_12px_22px_-24px_rgba(15,23,42,0.16)]">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="relative w-full xl:max-w-xl">
                      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        value={activationSearchQuery}
                        onChange={(event) =>
                          setActivationSearchQuery(event.target.value)
                        }
                        placeholder="Cari nama siswa, no referensi, atau kode layanan..."
                        className={cn("pl-10", warmFieldClassName)}
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={exportActivationMembershipCsv}
                        disabled={
                          activationsLoading ||
                          activationMembershipView === "without_membership" ||
                          filteredActivationStudents.length === 0
                        }
                      >
                        <Download className="size-4" />
                        Export CSV
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={resetActivationFilters}
                      >
                        Reset filter
                      </Button>
                    </div>
                  </div>

                  <div
                    className={`mt-3 grid gap-3 ${
                      activationMembershipView === "with_membership"
                        ? "sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5"
                        : "sm:grid-cols-2"
                    }`}
                  >
                    {activationMembershipView === "with_membership" ? (
                      <>
                        <Select
                          value={activationPaymentStatusFilter}
                          onValueChange={(value) =>
                            setActivationPaymentStatusFilter(
                              value as (typeof paymentStatusOptions)[number],
                            )
                          }
                        >
                          <SelectTrigger className={warmSelectTriggerClassName}>
                            <SelectValue placeholder="Status pembayaran" />
                          </SelectTrigger>
                          <SelectContent className={warmSelectContentClassName}>
                            {paymentStatusOptions.map((option) => (
                              <SelectItem
                                key={option}
                                value={option}
                                className={warmSelectItemClassName}
                              >
                                {option === ALL_PAYMENT_STATUSES
                                  ? option
                                  : formatPaymentStatusLabel(option)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select
                          value={activationStatusFilter}
                          onValueChange={(value) =>
                            setActivationStatusFilter(
                              value as (typeof activationStatusOptions)[number],
                            )
                          }
                        >
                          <SelectTrigger className={warmSelectTriggerClassName}>
                            <SelectValue placeholder="Status aktivasi" />
                          </SelectTrigger>
                          <SelectContent className={warmSelectContentClassName}>
                            {activationStatusOptions.map((option) => (
                              <SelectItem
                                key={option}
                                value={option}
                                className={warmSelectItemClassName}
                              >
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select
                          value={activationPackageFilter}
                          onValueChange={setActivationPackageFilter}
                        >
                          <SelectTrigger className={warmSelectTriggerClassName}>
                            <SelectValue placeholder="Filter paket" />
                          </SelectTrigger>
                          <SelectContent className={warmSelectContentClassName}>
                            {activationPackageOptions.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                                className={warmSelectItemClassName}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </>
                    ) : null}

                    <Select
                      value={levelFilter}
                      onValueChange={(value) => {
                        setLevelFilter(value as LevelFilterOption);
                        setClassFilter(ALL_CLASSES);
                      }}
                    >
                      <SelectTrigger className={warmSelectTriggerClassName}>
                        <SelectValue placeholder="Filter jenjang" />
                      </SelectTrigger>
                      <SelectContent className={warmSelectContentClassName}>
                        {levelFilterOptions.map((option) => (
                          <SelectItem
                            key={option}
                            value={option}
                            className={warmSelectItemClassName}
                          >
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={classFilter} onValueChange={setClassFilter}>
                      <SelectTrigger className={warmSelectTriggerClassName}>
                        <SelectValue placeholder="Filter kelas" />
                      </SelectTrigger>
                      <SelectContent className={warmSelectContentClassName}>
                        {activationClassOptions.map((option) => (
                          <SelectItem
                            key={option}
                            value={option}
                            className={warmSelectItemClassName}
                          >
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {activationMembershipView === "without_membership" ? (
                  <StudentsWithoutMembershipPanel
                    students={filteredStudentsWithoutMembership}
                    isLoading={studentsLoading || membershipCoverageLoading}
                    error={studentsError ?? membershipCoverageError}
                  />
                ) : activationsError ? (
                  <ErrorPanel
                    message={activationsError}
                    onRetry={() => {
                      void refreshPaymentViews({
                        includeStudents: false,
                      });
                    }}
                  />
                ) : activationsLoading ? (
                  <LoadingPanel title="Memuat aktivasi membership" />
                ) : (
                  <>
                    <AnomalyBanner
                      count={activationAnomalyCount}
                      message="Sebagian aktivasi memiliki relasi user atau payment reference yang belum lengkap. Kondisi ini ikut terbaca dari data existing agar admin bisa memonitor tanpa menyembunyikan anomali."
                    />

                    <AdminDataTable
                      columns={activationColumns}
                      data={filteredActivationStudents}
                      keyExtractor={(student) => student.id}
                      minWidthClassName="min-w-[1880px]"
                      emptyTitle="Belum ada data aktivasi membership"
                      emptyDescription="Belum ada subscription siswa yang bisa ditampilkan atau semua data tersaring oleh filter."
                      getRowClassName={(student) =>
                        getActivationAnomalyReasons(student).length
                          ? "bg-rose-50/30"
                          : undefined
                      }
                    />
                    <div className="mt-4">
                      <AdminPaginationFooter
                        page={activationPage}
                        totalPages={activationTotalPages}
                        totalItems={activationTotalItems}
                        visibleCount={filteredActivationStudents.length}
                        limit={activationPageLimit}
                        isLoading={activationsLoading}
                        label="aktivasi"
                        onPrevious={() => {
                          setActivationPage((currentPage) =>
                            Math.max(1, currentPage - 1),
                          );
                        }}
                        onNext={() => {
                          setActivationPage((currentPage) =>
                            Math.min(activationTotalPages, currentPage + 1),
                          );
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
            </AdminSectionCard>
          </TabsContent>
        </Tabs>
      </div>

      <CreateMembershipBillingDialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);

          if (!open) {
            resetCreateDialogState();
          }
        }}
        levelOptions={billingLevelOptions}
        batchLevel={batchLevel}
        batchClassOptions={batchClassOptionsByLevel[batchLevel] ?? []}
        batchClassOption={batchClassOption}
        billingPackages={billingPackages}
        classPricingMatrix={subscriptionConfig.classPricingMatrix}
        packageLookupOptions={packageLookupOptions}
        batchPackageMode={batchPackageMode}
        batchPackageKey={batchPackageKey}
        batchIncludeInactive={batchIncludeInactive}
        batchResult={batchResult}
        batchError={batchError}
        isSubmitting={isCreatingPayment}
        onBatchLevelChange={handleBatchLevelChange}
        onBatchClassOptionChange={handleBatchClassOptionChange}
        onBatchPackageModeChange={handleBatchPackageModeChange}
        onBatchPackageKeyChange={handleBatchPackageKeyChange}
        onBatchIncludeInactiveChange={handleBatchIncludeInactiveChange}
        onSubmit={(event) => {
          void handleCreateBillingSubmit(event);
        }}
      />

      <IncomingPaymentEditDialog
        key={paymentEditRecord?.id ?? "empty-payment-edit"}
        record={paymentEditRecord}
        billingPackages={billingPackages}
        classPricingMatrix={subscriptionConfig.classPricingMatrix}
        packageLookupOptions={packageLookupOptions}
        open={paymentEditRecord !== null}
        isSubmitting={isReplacingPayment}
        isStatusSubmitting={isUpdatingPaymentStatus}
        onOpenChange={(open) => {
          if (!open && !isReplacingPayment && !isUpdatingPaymentStatus) {
            setPaymentEditRecord(null);
          }
        }}
        onConfirm={(record, payload) => {
          void handleReplacePayment(record, payload);
        }}
        onMarkPaid={(record) => {
          void handleMarkPaymentPaid(record);
        }}
      />

      <IncomingPaymentStatusEditDialog
        record={paymentStatusEditRecord}
        open={paymentStatusEditRecord !== null}
        isSubmitting={isUpdatingPaymentStatus}
        onOpenChange={(open) => {
          if (!open && !isUpdatingPaymentStatus) {
            setPaymentStatusEditRecord(null);
          }
        }}
        onConfirm={(record) => {
          void handleMarkPaymentPaid(record);
        }}
      />

      <IncomingPaymentDetailDialog
        record={selectedIncomingPayment}
        open={selectedIncomingPayment !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedIncomingPaymentId(null);
          }
        }}
      />

      <ActivationDetailDialog
        record={selectedActivationStudent}
        open={selectedActivationStudent !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedActivationId(null);
          }
        }}
      />
    </>
  );
}
