"use client";

import { useEffect, useEffectEvent, useRef, useState, type FormEvent } from "react";
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CreditCard,
  GraduationCap,
  History,
  LoaderCircle,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import HistoriTagihanSiswa from "../sections/HistoriTagihanSiswa";
import {
  publishStudentDashboardRefresh,
  subscribeStudentDashboardRefresh,
} from "../student-dashboard-refresh-events";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MembershipRequestError,
  findPackageByName,
  formatDateLabel,
  formatRupiah,
  getPriceByClassAndPackage,
  membershipService,
  type OnlinePackageKey,
  type ProgramOptionValue,
  type MembershipStatusData,
  type OnlinePackageDefinition,
} from "@/lib/subscription";
import { useSubscriptionConfig } from "@/lib/use-subscription-config";

type MembershipOverview = {
  studentName: string;
  studentId: string;
  branch: string;
  className: string;
  program: string;
  packageKey: string | null;
  packageName: string;
  durationLabel: string;
  startDate: string;
  endDate: string;
  accessStatus: MembershipStatusData["accessStatus"];
  accessLabel: string;
  paymentStatusLabel: string;
  daysRemainingLabel: string;
  paymentStatus: string | null;
  isScheduledAccess: boolean;
  scheduledStartDate: string | null;
};

const emptyOverview: MembershipOverview = {
  studentName: "Siswa",
  studentId: "-",
  branch: "-",
  className: "-",
  program: "-",
  packageKey: null,
  packageName: "Belum ada paket belajar aktif",
  durationLabel: "-",
  startDate: "-",
  endDate: "-",
  accessStatus: "not_registered",
  accessLabel: "Belum Terdaftar",
  paymentStatusLabel: "Belum ada tagihan",
  daysRemainingLabel: "-",
  paymentStatus: null,
  isScheduledAccess: false,
  scheduledStartDate: null,
};

type RenewalFormValues = {
  program: ProgramOptionValue;
  classLevel: string;
  packageKey: OnlinePackageKey;
};

type RenewalClassSuggestion = Pick<RenewalFormValues, "program" | "classLevel"> & {
  currentClassLabel: string;
  targetClassLabel: string;
};

type RenewalFeedback = {
  tone: "success" | "warning";
  message: string;
  checkoutUrl?: string | null;
} | null;

const defaultRenewalFormValues: RenewalFormValues = {
  program: "",
  classLevel: "",
  packageKey: "",
};

function isOnlinePackageKey(
  value: string | null | undefined,
  packages: OnlinePackageDefinition[],
): value is OnlinePackageKey {
  return packages.some((item) => item.packageKey === value);
}

function extractGrade(value: string | null | undefined) {
  return value?.match(/\b(1[0-2]|[2-9])\b/)?.[1] ?? null;
}

function inferProgramFromOverview(
  overview: MembershipOverview,
): ProgramOptionValue | null {
  const normalizedProgram = overview.program.trim().toUpperCase();
  const normalizedClassName = overview.className.trim().toUpperCase();
  const grade = Number(extractGrade(overview.className));

  if (normalizedProgram === "SD" || normalizedProgram === "SMP" || normalizedProgram === "SMA") {
    return normalizedProgram;
  }

  if (normalizedClassName.includes("SD")) {
    return "SD";
  }

  if (normalizedClassName.includes("SMP")) {
    return "SMP";
  }

  if (normalizedClassName.includes("SMA")) {
    return "SMA";
  }

  if (grade >= 2 && grade <= 6) {
    return "SD";
  }

  if (grade >= 7 && grade <= 9) {
    return "SMP";
  }

  if (grade >= 10 && grade <= 12) {
    return "SMA";
  }

  return null;
}

function inferClassLevelFromClassName(
  overview: MembershipOverview,
  program: ProgramOptionValue,
  classOptionsByProgram: Record<string, string[]>,
) {
  const grade = extractGrade(overview.className) ?? "";
  const classLevel = grade ? `Kelas ${grade}` : "";

  const classOptions = classOptionsByProgram[program] ?? [];

  return classOptions.includes(classLevel) ? classLevel : null;
}

function getSuggestedRenewalClass(
  program: ProgramOptionValue,
  classLevel: string,
  classOptionsByProgram: Record<string, string[]>,
): Pick<RenewalFormValues, "program" | "classLevel"> {
  const classOptions = classOptionsByProgram[program] ?? [];
  const currentIndex = classOptions.indexOf(classLevel);

  if (currentIndex >= 0 && currentIndex < classOptions.length - 1) {
    return {
      program,
      classLevel: classOptions[currentIndex + 1],
    };
  }

  const programOrder = Object.keys(classOptionsByProgram);
  const nextProgram = programOrder[programOrder.indexOf(program) + 1];
  const nextProgramClassOptions = nextProgram
    ? classOptionsByProgram[nextProgram] ?? []
    : [];

  if (currentIndex === classOptions.length - 1 && nextProgramClassOptions[0]) {
    return {
      program: nextProgram,
      classLevel: nextProgramClassOptions[0],
    };
  }

  return {
    program,
    classLevel,
  };
}

function formatClassTargetLabel(program: ProgramOptionValue, classLevel: string) {
  return `${program} ${classLevel.replace(/^Kelas\s+/i, "")}`;
}

function resolveRenewalClassSuggestion(
  overview: MembershipOverview,
  classOptionsByProgram: Record<string, string[]>,
): RenewalClassSuggestion | null {
  if (overview.studentId === "-") {
    return null;
  }

  const program = inferProgramFromOverview(overview);

  if (!program) {
    return null;
  }

  const classLevel = inferClassLevelFromClassName(
    overview,
    program,
    classOptionsByProgram,
  );

  if (!classLevel) {
    return null;
  }

  const suggestedClass = getSuggestedRenewalClass(
    program,
    classLevel,
    classOptionsByProgram,
  );

  return {
    ...suggestedClass,
    currentClassLabel: formatClassTargetLabel(program, classLevel),
    targetClassLabel: formatClassTargetLabel(
      suggestedClass.program,
      suggestedClass.classLevel,
    ),
  };
}

function buildRenewalFormDefaults(
  overview: MembershipOverview,
  classOptionsByProgram: Record<string, string[]>,
  packages: OnlinePackageDefinition[],
): RenewalFormValues {
  const suggestedClass = resolveRenewalClassSuggestion(
    overview,
    classOptionsByProgram,
  );

  return {
    ...(suggestedClass ?? defaultRenewalFormValues),
    packageKey: isOnlinePackageKey(overview.packageKey, packages)
      ? overview.packageKey
      : packages[0]?.packageKey ?? "",
  };
}

function formatAccessLabel(accessStatus: MembershipStatusData["accessStatus"]) {
  switch (accessStatus) {
    case "active":
      return "Aktif";
    case "expiring":
      return "Hampir Berakhir";
    case "pending":
      return "Menunggu Aktivasi";
    case "expired":
      return "Masa Aktif Berakhir";
    case "not_registered":
      return "Belum Terdaftar";
    default:
      return "Belum Terdaftar";
  }
}

function formatAccessVariant(accessStatus: MembershipStatusData["accessStatus"]) {
  switch (accessStatus) {
    case "active":
      return "success";
    case "expiring":
      return "warning";
    case "pending":
      return "warning";
    case "expired":
      return "danger";
    case "not_registered":
      return "secondary";
    default:
      return "secondary";
  }
}

function formatPaymentStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "paid":
      return "Pembayaran lunas";
    case "pending":
      return "Tagihan menunggu pembayaran";
    case "failed":
      return "Pembayaran perlu diulang";
    case "expired":
      return "Tagihan sudah kedaluwarsa";
    case "draft_renewal":
      return "Menunggu pilihan paket perpanjangan";
    default:
      return "Belum ada tagihan";
  }
}

function resolveScheduledMembershipStartDate(
  data: MembershipStatusData | undefined | null,
) {
  if (
    data?.accessStatus !== "pending" ||
    !data.subscription?.startDate ||
    (data.payment?.status !== "paid" &&
      data.subscription.paymentStatus !== "paid")
  ) {
    return null;
  }

  const startDate = new Date(data.subscription.startDate);

  if (Number.isNaN(startDate.getTime()) || startDate.getTime() <= Date.now()) {
    return null;
  }

  return data.subscription.startDate;
}

function buildMembershipOverview(
  data: MembershipStatusData | undefined | null,
  packages: OnlinePackageDefinition[],
): MembershipOverview {
  if (!data) {
    return emptyOverview;
  }

  const resolvedPackage =
    findPackageByName(data.subscription?.packageName, packages) ??
    (data.subscription?.durationMonth
      ? {
          packageName: data.subscription.packageName,
          durationMonth: data.subscription.durationMonth,
          amount: data.payment?.amount ?? 0,
          packageKey: data.subscription.packageKey,
          highlight: "",
        }
      : null);
  const scheduledStartDate = resolveScheduledMembershipStartDate(data);
  const isScheduledAccess = Boolean(scheduledStartDate);

  return {
    studentName: data.student?.name?.trim() || data.user.nama,
    studentId: data.student?.id?.trim() || "-",
    branch: data.student?.branch?.trim() || "-",
    className: data.student?.className?.trim() || "-",
    program: data.student?.program?.trim() || "-",
    packageKey: data.subscription?.packageKey?.trim() || null,
    packageName: data.subscription?.packageName?.trim() || "Belum ada paket belajar aktif",
    durationLabel: resolvedPackage
      ? `${resolvedPackage.durationMonth} bulan`
      : data.subscription?.durationMonth
        ? `${data.subscription.durationMonth} bulan`
        : "-",
    startDate: formatDateLabel(data.subscription?.startDate ?? null),
    endDate: formatDateLabel(data.subscription?.endDate ?? null),
    accessStatus: data.accessStatus,
    accessLabel: isScheduledAccess
      ? "Akses Terjadwal"
      : formatAccessLabel(data.accessStatus),
    paymentStatusLabel: isScheduledAccess
      ? "Pembayaran lunas, akses terjadwal"
      : formatPaymentStatusLabel(data.payment?.status),
    daysRemainingLabel:
      isScheduledAccess && scheduledStartDate
        ? `Dibuka ${formatDateLabel(scheduledStartDate)}`
        : typeof data.daysRemaining === "number"
        ? `${data.daysRemaining} hari tersisa`
        : data.accessStatus === "expired"
          ? "Perlu perpanjangan"
          : "-",
    paymentStatus: data.payment?.status ?? null,
    isScheduledAccess,
    scheduledStartDate,
  };
}

function MembershipSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-52 animate-pulse rounded-[32px] border border-slate-200 bg-slate-50" />
      <div className="grid grid-cols-2 gap-4 sm:gap-5">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-[24px] border border-slate-100 bg-white shadow-sm"
          />
        ))}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  note?: string;
  icon: LucideIcon;
  tone?: string;
}) {
  return (
    <article
      className="h-full flex flex-col justify-center rounded-[24px] border border-slate-200/60 bg-white px-5 py-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
    >
      <div className="flex items-center gap-4">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-md"
        >
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {label}
          </p>
          <p className="mt-1 text-sm font-bold text-slate-900">{value}</p>
        </div>
      </div>
    </article>
  );
}



export default function TagihanSiswaPageView() {
  const {
    config: subscriptionConfig,
    isLoading: isSubscriptionConfigLoading,
  } = useSubscriptionConfig();
  const packageOptions = subscriptionConfig.packages;
  const classOptionsByProgram = subscriptionConfig.classOptionsByProgram;
  const [overview, setOverview] = useState<MembershipOverview>(emptyOverview);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [historyReloadKey, setHistoryReloadKey] = useState(0);
  const [isRenewalDialogOpen, setIsRenewalDialogOpen] = useState(false);
  const [isCreatingRenewal, setIsCreatingRenewal] = useState(false);
  const [renewalFormValues, setRenewalFormValues] =
    useState<RenewalFormValues>(defaultRenewalFormValues);
  const [renewalError, setRenewalError] = useState<string | null>(null);
  const [renewalFeedback, setRenewalFeedback] = useState<RenewalFeedback>(null);
  const lastLoadedClassNameRef = useRef<string | null>(null);

  const loadMembershipOverview = useEffectEvent(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await membershipService.getMySubscription();
      const nextOverview = buildMembershipOverview(response.data, packageOptions);
      const previousClassName = lastLoadedClassNameRef.current;

      lastLoadedClassNameRef.current = nextOverview.className;
      setOverview(nextOverview);
      setRenewalFormValues(
        buildRenewalFormDefaults(
          nextOverview,
          classOptionsByProgram,
          packageOptions,
        ),
      );

      if (
        previousClassName !== null &&
        previousClassName !== nextOverview.className
      ) {
        publishStudentDashboardRefresh();
      }
    } catch (requestError) {
      if (
        requestError instanceof MembershipRequestError &&
        (requestError.status === 401 || requestError.status === 403)
      ) {
        setError("Sesi kamu berakhir. Silakan login ulang untuk melihat tagihan.");
      } else {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Gagal memuat ringkasan paket belajar siswa.",
        );
      }

      setOverview(emptyOverview);
    } finally {
      setIsLoading(false);
    }
  });

  useEffect(() => {
    queueMicrotask(() => {
      void loadMembershipOverview();
    });
  }, [reloadKey]);

  useEffect(() => {
    return subscribeStudentDashboardRefresh(() => {
      setReloadKey((currentValue) => currentValue + 1);
      setHistoryReloadKey((currentValue) => currentValue + 1);
    });
  }, []);

  useEffect(() => {
    if (overview.paymentStatus === "pending") {
      const intervalId = window.setInterval(() => {
        setReloadKey((k) => k + 1);
      }, 5000);
      return () => window.clearInterval(intervalId);
    }
  }, [overview.paymentStatus]);

  useEffect(() => {
    queueMicrotask(() => {
      setRenewalFormValues(
        buildRenewalFormDefaults(overview, classOptionsByProgram, packageOptions),
      );
    });
  }, [classOptionsByProgram, overview, packageOptions]);

  const renewalClassSuggestion = resolveRenewalClassSuggestion(
    overview,
    classOptionsByProgram,
  );
  const effectiveRenewalFormValues: RenewalFormValues = {
    ...renewalFormValues,
    ...(renewalClassSuggestion
      ? {
          program: renewalClassSuggestion.program,
          classLevel: renewalClassSuggestion.classLevel,
        }
      : {}),
  };
  const selectedRenewalPackage =
    packageOptions.find((item) => item.packageKey === effectiveRenewalFormValues.packageKey) ??
    packageOptions[0] ??
    null;
  const selectedRenewalAmount = getPriceByClassAndPackage(
    effectiveRenewalFormValues.classLevel,
    effectiveRenewalFormValues.packageKey,
    subscriptionConfig.classPricingMatrix,
    packageOptions,
  );
  const renewalTargetClassLabel =
    renewalClassSuggestion?.targetClassLabel ??
    formatClassTargetLabel(
      effectiveRenewalFormValues.program,
      effectiveRenewalFormValues.classLevel,
    );
  const canShowRenewalAction =
    overview.accessStatus === "expiring" || overview.accessStatus === "expired";
  const canCreateRenewal =
    canShowRenewalAction &&
    overview.studentId !== "-" &&
    Boolean(renewalClassSuggestion) &&
    !isSubscriptionConfigLoading &&
    packageOptions.length > 0 &&
    overview.accessStatus !== "not_registered" &&
    overview.paymentStatus !== "pending" &&
    overview.accessStatus !== "pending";
  const renewalUnavailableMessage = !renewalClassSuggestion
    ? "Kelas siswa belum bisa dikenali otomatis. Minta admin merapikan data kelas siswa terlebih dahulu."
    : overview.paymentStatus === "pending"
      ? "Masih ada tagihan yang menunggu pembayaran. Selesaikan atau batalkan tagihan lama terlebih dahulu."
      : overview.isScheduledAccess
        ? "Paket belajar sudah lunas dan akses belajar terjadwal. Perpanjangan baru tersedia setelah paket berjalan."
          : overview.accessStatus === "pending"
            ? "Paket belajar belum aktif. Selesaikan aktivasi terlebih dahulu sebelum membuat perpanjangan."
            : !canShowRenewalAction
              ? "Tombol perpanjangan muncul otomatis saat paket tersisa 14 hari atau sudah berakhir."
              : "Perpanjangan tersedia setelah paket awal tercatat.";

  async function handleCreateRenewalPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canCreateRenewal) {
      setRenewalError("Perpanjangan belum tersedia untuk status paket saat ini.");
      return;
    }

    setIsCreatingRenewal(true);
    setRenewalError(null);
    setRenewalFeedback(null);

    try {
      const response = await membershipService.createMyRenewalPayment({
        packageKey: effectiveRenewalFormValues.packageKey,
      });
      const checkoutUrl = response.data?.payment?.checkoutUrl ?? null;

      setRenewalFeedback({
        tone: "success",
        message: "Perpanjangan paket belajar berhasil disiapkan.",
        checkoutUrl,
      });
      setIsRenewalDialogOpen(false);
      setReloadKey((currentValue) => currentValue + 1);
      setHistoryReloadKey((currentValue) => currentValue + 1);
      publishStudentDashboardRefresh();
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Tagihan perpanjangan belum bisa dibuat.";

      setRenewalError(message);
      setRenewalFeedback({
        tone: "warning",
        message,
      });
    } finally {
      setIsCreatingRenewal(false);
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-7 px-4 py-6 md:px-6 md:py-8">
      <div className="relative overflow-hidden rounded-[32px] border border-slate-200/60 bg-white p-5 shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.1)] md:p-6">
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white shadow-sm">
              <CreditCard className="h-3.5 w-3.5" />
              Pembayaran Siswa
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">
              Paket Belajar dan Riwayat Pembayaran
            </h1>
          </div>


        </div>
      </div>

      {isLoading ? <MembershipSkeleton /> : null}

      {!isLoading && error ? (
        <div className="flex flex-col gap-4 rounded-[24px] border border-red-100 bg-red-50/80 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-5">
          <div className="flex items-start gap-3 text-red-700">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Ringkasan paket belajar belum bisa dimuat</p>
              <p className="mt-1 text-sm leading-6">{error}</p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setReloadKey((currentValue) => currentValue + 1);
            }}
          >
            <RefreshCcw className="h-4 w-4" />
            Muat Ulang
          </Button>
        </div>
      ) : null}

      {!isLoading && !error ? (
        <section className="overflow-hidden rounded-[32px] border border-slate-200/60 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.1)]">
          <div className="grid gap-6 px-5 py-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.9fr)] lg:px-6">
            <div className={`space-y-4 ${canShowRenewalAction ? "" : "lg:col-span-2"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="mt-2 text-lg font-bold text-slate-900">
                    {overview.studentName}
                  </h2>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-slate-600">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                      ID {overview.studentId}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
                      {overview.className}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                      Cabang {overview.branch}
                    </span>
                  </div>
                </div>

                <Badge
                  variant={formatAccessVariant(overview.accessStatus)}
                  className="rounded-full px-3 py-1"
                >
                  {overview.accessLabel}
                </Badge>
              </div>

              <div className="rounded-[28px] border border-slate-200/60 bg-slate-50/80 p-5 shadow-sm transition-all duration-300 hover:shadow-md">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                      Paket Saat Ini
                    </p>
                    <h3 className="text-lg font-bold text-slate-900">
                      {overview.packageName}
                    </h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-600">
                      <span className="inline-flex items-center gap-2">
                        <CalendarClock className="h-4 w-4 text-slate-400" />
                        Durasi {overview.durationLabel}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <UserRound className="h-4 w-4 text-slate-400" />
                        Program {overview.program}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-4 sm:gap-5">
                  <SummaryCard
                    label="Status Akses"
                    value={overview.accessLabel}
                    note={overview.daysRemainingLabel}
                    icon={ShieldCheck}
                    tone="emerald"
                  />
                  <SummaryCard
                    label="Status Pembayaran"
                    value={overview.paymentStatusLabel}
                    note="Pembayaran terakhir yang tercatat pada paket belajar siswa."
                    icon={CreditCard}
                    tone="orange"
                  />
                  <SummaryCard
                    label="Mulai Aktif"
                    value={overview.startDate}
                    note="Tanggal mulai akses belajar untuk paket ini."
                    icon={CalendarClock}
                    tone="sky"
                  />
                  <SummaryCard
                    label="Berakhir"
                    value={overview.endDate}
                    note="Setelah tanggal ini, siswa perlu memperpanjang paket."
                    icon={History}
                    tone="slate"
                  />
                </div>
              </div>
            </div>

            {canShowRenewalAction ? (
              <aside className="rounded-[28px] border border-slate-200/60 bg-white p-5 shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.1)]">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-md">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex items-center pt-2">
                    <p className="text-sm font-bold text-slate-900">
                      Perpanjang Paket
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                  <div className="pt-2">
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50/50 p-4">
                      <div className="flex items-center gap-2 text-slate-500">
                        <GraduationCap className="h-4 w-4 text-slate-400" />
                        <p className="text-xs font-semibold uppercase text-slate-500 tracking-[0.12em]">
                          Arah Perpanjangan
                        </p>
                        <Badge variant="outline" className="ml-auto px-2 py-0.5 text-[11px]">
                          Otomatis
                        </Badge>
                      </div>

                      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
                          <p className="text-[11px] font-medium text-slate-400">
                            Saat ini
                          </p>
                          <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                            {renewalClassSuggestion?.currentClassLabel ?? overview.className}
                          </p>
                        </div>
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white shadow-md">
                          <ArrowRight className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
                          <p className="text-[11px] font-medium text-slate-400">
                            Tujuan
                          </p>
                          <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                            {renewalTargetClassLabel}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-slate-200/60 bg-slate-50/80 px-4 py-3 shadow-sm transition-all duration-300 hover:shadow-md">
                      <p className="text-xs font-bold text-slate-500">
                        {selectedRenewalPackage?.packageName ?? "Paket belum tersedia"}
                      </p>
                      <p className="mt-1 text-xl font-bold tracking-tight text-slate-950">
                        {formatRupiah(selectedRenewalAmount)}
                      </p>
                    </div>

                    <Button
                      type="button"
                      className="mt-4 w-full rounded-xl bg-slate-900 font-bold text-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-lg"
                      disabled={!canCreateRenewal || isCreatingRenewal}
                      onClick={() => {
                        setRenewalError(null);
                        setRenewalFeedback(null);
                        setIsRenewalDialogOpen(true);
                      }}
                    >
                      Buat Tagihan Perpanjangan
                      <ArrowUpRight className="h-4 w-4" />
                    </Button>

                    {!canCreateRenewal ? (
                      <p className="mt-3 text-xs leading-5 text-slate-400">
                        {renewalUnavailableMessage}
                      </p>
                    ) : null}

                    {renewalFeedback ? (
                      <div
                        className={`mt-4 rounded-2xl border px-3 py-3 text-sm leading-6 ${
                          renewalFeedback.tone === "success"
                            ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                            : "border-amber-100 bg-amber-50 text-amber-700"
                        }`}
                      >
                        <p className="font-semibold">{renewalFeedback.message}</p>
                        {renewalFeedback.checkoutUrl ? (
                          <Button
                            type="button"
                            size="sm"
                            className="mt-3 rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
                            onClick={() => {
                              window.open(
                                renewalFeedback.checkoutUrl ?? "",
                                "_blank",
                                "noopener,noreferrer",
                              );
                            }}
                          >
                            Lanjutkan Pembayaran
                            <ArrowUpRight className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </aside>
            ) : null}
          </div>
        </section>
      ) : null}

      <Dialog
        open={isRenewalDialogOpen}
        onOpenChange={(open) => {
          if (!isCreatingRenewal) {
            setIsRenewalDialogOpen(open);
          }
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-md border-slate-200 bg-white p-0 shadow-[0_24px_48px_-30px_rgba(15,23,42,0.24)] sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100%-2rem)]">
          <form
            onSubmit={handleCreateRenewalPayment}
            className="flex max-h-[calc(100dvh-1rem)] min-h-0 flex-col sm:max-h-[calc(100dvh-2rem)]"
          >
            <DialogHeader className="shrink-0 border-b border-slate-200 px-4 py-3.5 pr-14 text-left sm:px-5 sm:pr-16">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  {overview.studentId}
                </Badge>
                <Badge variant={formatAccessVariant(overview.accessStatus)}>
                  {overview.accessLabel}
                </Badge>
              </div>
              <DialogTitle className="text-lg font-semibold tracking-tight text-slate-950">
                Perpanjang Paket Belajar
              </DialogTitle>
              <DialogDescription>
                Kelas tujuan sudah disiapkan. Pilih paket yang ingin dilanjutkan.
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 [-ms-overflow-style:none] [scrollbar-width:none] sm:px-5 [&::-webkit-scrollbar]:hidden">
              <div className="rounded-[18px] border border-slate-200 bg-slate-50/70 p-3">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-slate-500" />
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    Kelas Otomatis
                  </p>
                  <Badge variant="outline" className="ml-auto px-2 py-0.5 text-[11px]">
                    Dari data siswa
                  </Badge>
                </div>

                <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <p className="text-[11px] font-medium text-slate-400">Saat ini</p>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                      {renewalClassSuggestion?.currentClassLabel ?? overview.className}
                    </p>
                  </div>
                  <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <p className="text-[11px] font-medium text-slate-400">Tujuan</p>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                      {renewalTargetClassLabel}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Paket
                </label>
                <Select
                  value={renewalFormValues.packageKey}
                  onValueChange={(value) =>
                    setRenewalFormValues((current) => ({
                      ...current,
                      packageKey: value as OnlinePackageKey,
                    }))
                  }
                  disabled={isCreatingRenewal}
                >
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue placeholder="Pilih paket" />
                  </SelectTrigger>
                  <SelectContent>
                    {packageOptions.map((item) => (
                      <SelectItem key={item.packageKey} value={item.packageKey}>
                        {item.packageName} -{" "}
                        {formatRupiah(
                          getPriceByClassAndPackage(
                            effectiveRenewalFormValues.classLevel,
                            item.packageKey,
                            subscriptionConfig.classPricingMatrix,
                            packageOptions,
                          ),
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-[18px] border border-slate-200 bg-white px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase text-slate-500">
                    Total Pembayaran
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {selectedRenewalPackage?.packageName ?? "Paket belum tersedia"} - {renewalTargetClassLabel}
                  </p>
                </div>
                <p className="shrink-0 text-lg font-semibold tracking-tight text-slate-950">
                  {formatRupiah(selectedRenewalAmount)}
                </p>
              </div>

              {renewalError ? (
                <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
                  {renewalError}
                </div>
              ) : null}
            </div>

            <DialogFooter className="!grid shrink-0 grid-cols-2 gap-2 border-t border-slate-200/80 bg-white px-4 py-3 sm:px-5">
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl"
                disabled={isCreatingRenewal}
                onClick={() => setIsRenewalDialogOpen(false)}
              >
                Batal
              </Button>
              <Button
                type="submit"
                variant="secondary"
                className="h-10 rounded-xl"
                disabled={isCreatingRenewal || !canCreateRenewal}
              >
                {isCreatingRenewal ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4" />
                )}
                Perpanjang Paket
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div id="riwayat-tagihan">
        <HistoriTagihanSiswa reloadSignal={historyReloadKey} />
      </div>
    </section>
  );
}
