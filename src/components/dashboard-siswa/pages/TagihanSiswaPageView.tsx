"use client";

import { useEffect, useEffectEvent, useRef, useState, type FormEvent } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CalendarDays,
  Check,
  Clock,
  CreditCard,
  GraduationCap,
  History,
  LoaderCircle,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  UserRound,
  WalletCards,
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
  progressPercentage: number;
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
  progressPercentage: 0,
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

  let progressPercentage = 0;
  if (data?.subscription?.startDate && data?.subscription?.endDate) {
    const start = new Date(data.subscription.startDate).getTime();
    const end = new Date(data.subscription.endDate).getTime();
    const now = Date.now();
    if (now >= end) {
      progressPercentage = 100;
    } else if (now <= start) {
      progressPercentage = 0;
    } else {
      progressPercentage = Math.round(((now - start) / (end - start)) * 100);
    }
  }

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
    progressPercentage,
  };
}

function MembershipSkeleton() {
  return (
    <div className="space-y-8">
      <div className="h-48 animate-pulse rounded-[30px] border border-orange-100 bg-orange-50/50" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.9fr)]">
        <div className="h-80 animate-pulse rounded-[30px] border border-slate-100 bg-slate-50 shadow-sm" />
        <div className="h-96 animate-pulse rounded-[30px] border border-slate-100 bg-white shadow-sm" />
      </div>
    </div>
  );
}

function getStatusBadgeClasses(status: string) {
  switch (status) {
    case "active": return "bg-green-100 text-green-700 shadow-sm";
    case "expiring": return "bg-amber-100 text-amber-700 shadow-sm";
    case "pending": return "bg-orange-100 text-orange-700 shadow-sm";
    case "expired": return "bg-red-100 text-red-700 shadow-sm";
    case "not_registered":
    default: return "bg-slate-100 text-slate-700 shadow-sm";
  }
}

function getPaymentBadgeClasses(status: string | null) {
  switch (status) {
    case "paid": return "bg-green-100 text-green-700 shadow-sm";
    case "pending": return "bg-orange-100 text-orange-700 shadow-sm";
    case "failed":
    case "cancelled": return "bg-gray-100 text-gray-700 shadow-sm";
    case "expired": return "bg-red-100 text-red-700 shadow-sm";
    default: return "bg-slate-100 text-slate-700 shadow-sm";
  }
}

function getStatusDotColor(status: string) {
  switch (status) {
    case "active": return "bg-green-500";
    case "expiring": return "bg-amber-500";
    case "pending": return "bg-orange-500";
    case "expired": return "bg-red-500";
    default: return "bg-slate-500";
  }
}

function getPaymentDotColor(status: string | null) {
  switch (status) {
    case "paid": return "bg-green-500";
    case "pending": return "bg-orange-500";
    case "failed":
    case "cancelled": return "bg-gray-500";
    case "expired": return "bg-red-500";
    default: return "bg-slate-500";
  }
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
    <>
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8 md:py-12">
        
        <div className="relative overflow-hidden rounded-[24px] bg-[#FFF8EE] px-8 py-8 md:px-10 shadow-sm border border-orange-100/50">
          <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1">
              <p className="flex items-center text-sm font-semibold text-slate-500">
                👋 <span className="ml-2">Halo kembali,</span>
              </p>
              <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
                {overview.studentName}
              </h1>
              <p className="mt-2 text-sm font-medium text-slate-500">
                Kelola paket belajar dan riwayat pembayaran Anda
              </p>
            </div>

            {overview.accessStatus !== "not_registered" && (
              <div className="flex items-center gap-4 lg:px-8 lg:border-r border-slate-200/60">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-orange-500 shadow-sm border border-orange-100">
                  <CalendarDays className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-slate-600">Status Membership</p>
                    <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-[10px] font-bold text-green-700">Aktif</span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-600">
                    Berlaku sampai {overview.endDate}
                  </p>
                </div>
              </div>
            )}

            {overview.accessStatus !== "not_registered" && (
              <div className="flex items-center gap-8 pl-4">
                <div className="min-w-[140px]">
                  <p className="text-xs font-bold text-slate-600">Sisa Masa Aktif</p>
                  <p className="mt-1 text-3xl font-bold text-orange-500">{100 - overview.progressPercentage}%</p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full bg-orange-500 rounded-full transition-all duration-1000" style={{ width: `${100 - overview.progressPercentage}%` }} />
                  </div>
                  <p className="mt-2 text-[11px] font-medium text-slate-500">{overview.daysRemainingLabel}</p>
                </div>
                
                <div className="hidden shrink-0 lg:block">
                  <div className="relative rotate-3">
                    <div className="flex h-24 w-24 flex-col overflow-hidden rounded-[20px] bg-white shadow-lg border border-orange-100">
                      <div className="h-6 w-full bg-orange-500 flex justify-around px-3 pt-1.5">
                        <div className="h-3 w-1.5 rounded-full bg-white opacity-80" />
                        <div className="h-3 w-1.5 rounded-full bg-white opacity-80" />
                      </div>
                      <div className="flex-1 grid grid-cols-3 grid-rows-3 gap-1 p-3">
                        {Array.from({ length: 9 }).map((_, i) => (
                          <div key={i} className="rounded-sm bg-slate-100" />
                        ))}
                      </div>
                    </div>
                    <div className="absolute -bottom-3 -right-3 flex h-10 w-10 items-center justify-center rounded-full bg-orange-500 text-white shadow-md border-[3px] border-white">
                      <Check className="h-5 w-5" />
                    </div>
                    <div className="absolute -z-10 -left-4 top-4 h-8 w-8 rounded-full bg-green-400 opacity-80" />
                    <div className="absolute -z-10 -bottom-2 -left-2 h-6 w-6 rounded-full bg-orange-300 opacity-80" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {isLoading ? <MembershipSkeleton /> : null}

        {!isLoading && error ? (
          <div className="flex flex-col gap-4 rounded-[24px] border border-red-100 bg-red-50/80 p-6 md:flex-row md:items-center md:justify-between shadow-sm">
            <div className="flex items-start gap-4 text-red-700">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-lg font-bold">Ringkasan paket belajar belum bisa dimuat</p>
                <p className="mt-1 text-sm font-medium leading-6">{error}</p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="rounded-[16px] bg-white hover:bg-red-50 hover:text-red-700 transition-all shadow-sm"
              onClick={() => {
                setReloadKey((currentValue) => currentValue + 1);
              }}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Muat Ulang
            </Button>
          </div>
        ) : null}

        {!isLoading && !error ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="rounded-[24px] border border-slate-200/60 bg-white shadow-sm flex flex-col overflow-hidden transition-all hover:shadow-md">
              <div className="border-l-[6px] border-orange-500 p-6 md:p-8 h-full flex flex-col">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-[11px] font-bold tracking-[0.1em] text-slate-600 shadow-sm">
                    <WalletCards className="h-4 w-4" /> PEMBAYARAN SISWA
                  </div>
                  <div className="rounded-full bg-orange-50 border border-orange-100 px-4 py-2 text-[11px] font-bold text-orange-600 shadow-sm">
                    {overview.accessStatus === "expiring" ? "Hampir Berakhir" : "Paket Aktif"}
                  </div>
                </div>
                
                <div className="mb-8">
                  <div className="flex items-center gap-3">
                    <div className="h-2.5 w-2.5 rounded-full bg-orange-500 shadow-sm" />
                    <h2 className="text-sm font-bold text-slate-800">Paket Saat Ini</h2>
                  </div>
                  <h3 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">{overview.packageName}</h3>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <span className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">
                      <CalendarClock className="h-4 w-4 text-slate-400" /> Durasi {overview.durationLabel}
                    </span>
                    <span className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">
                      <GraduationCap className="h-4 w-4 text-slate-400" /> Program {overview.program}
                    </span>
                  </div>
                </div>
                
                <div className="mt-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-[20px] border border-slate-100 p-5 transition-colors hover:bg-slate-50 group">
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-50 text-orange-500 transition-transform group-hover:scale-110">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Status Akses</p>
                    <div className="mt-2 mb-2">
                      <span className="text-sm font-bold bg-orange-100 text-orange-800 px-2.5 py-1 rounded-md">{overview.accessLabel}</span>
                    </div>
                    <p className="text-xs font-medium text-slate-500 leading-relaxed">Akses akan berakhir segera</p>
                  </div>
                  
                  <div className="rounded-[20px] border border-slate-100 p-5 transition-colors hover:bg-slate-50 group">
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-500 transition-transform group-hover:scale-110">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Status Pembayaran</p>
                    <div className="mt-2 mb-2">
                      <span className="text-sm font-bold bg-green-100 text-green-800 px-2.5 py-1 rounded-md">{overview.paymentStatusLabel}</span>
                    </div>
                    <p className="text-xs font-medium text-slate-500 leading-relaxed">Terima kasih, pembayaran Anda lunas</p>
                  </div>
                  
                  <div className="rounded-[20px] border border-slate-100 p-5 transition-colors hover:bg-slate-50 group">
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-green-50 text-green-600 transition-transform group-hover:scale-110">
                      <CalendarDays className="h-5 w-5" />
                    </div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Mulai Aktif</p>
                    <p className="mt-2 text-sm font-bold text-slate-800">{overview.startDate}</p>
                    <p className="mt-1 text-xs font-medium text-slate-500 leading-relaxed">Tanggal paket mulai aktif</p>
                  </div>
                  
                  <div className="rounded-[20px] border border-slate-100 p-5 transition-colors hover:bg-slate-50 group">
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 transition-transform group-hover:scale-110">
                      <History className="h-5 w-5" />
                    </div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Berakhir</p>
                    <p className="mt-2 text-sm font-bold text-slate-800">{overview.endDate}</p>
                    <p className="mt-1 text-xs font-medium text-slate-500 leading-relaxed">Tanggal paket berakhir</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="rounded-[24px] border border-slate-200/60 bg-white p-6 md:p-8 shadow-sm flex flex-col h-full transition-all hover:shadow-md">
              <div className="flex items-start justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-orange-50 text-orange-600 shadow-sm border border-orange-100/50">
                    <RefreshCcw className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 md:text-2xl">Perpanjang Paket</h2>
                    <p className="text-sm font-medium text-slate-500 mt-1">Lanjutkan pembelajaran tanpa jeda</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-slate-50 border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 shadow-sm">
                  <Sparkles className="h-3.5 w-3.5 text-pink-500" /> Otomatis
                </div>
              </div>
              
              <div className="rounded-[24px] bg-slate-50/80 border border-slate-100 p-6 mb-8">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-5">Arah Perpanjangan</p>
                <div className="flex items-center gap-4">
                  <div className="flex-1 rounded-[20px] bg-white border border-slate-200 p-5 flex flex-col items-center justify-center shadow-sm">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-orange-50 text-orange-500">
                      <GraduationCap className="h-5 w-5" />
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Saat ini</p>
                    <p className="mt-1.5 text-sm font-bold text-slate-800 text-center">{renewalClassSuggestion?.currentClassLabel ?? overview.className}</p>
                  </div>
                  
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm">
                    <ArrowRight className="h-5 w-5" />
                  </div>
                  
                  <div className="flex-1 rounded-[20px] bg-green-50/60 border border-green-100 p-5 flex flex-col items-center justify-center shadow-sm">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
                      <GraduationCap className="h-5 w-5" />
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tujuan</p>
                    <p className="mt-1.5 text-sm font-bold text-slate-800 text-center">{renewalTargetClassLabel}</p>
                  </div>
                </div>
              </div>
              
              <div className="rounded-[24px] bg-[#FFF8EE] border border-orange-100 p-6 flex flex-col justify-center flex-1 shadow-sm">
                <p className="text-sm font-bold text-slate-600 mb-2">{selectedRenewalPackage?.packageName ?? "Paket belum tersedia"}</p>
                <p className="text-3xl font-bold text-slate-900 md:text-4xl tracking-tight">{formatRupiah(selectedRenewalAmount)}</p>
                <p className="mt-3 text-sm font-medium text-slate-500">Akses penuh ke semua fitur pembelajaran</p>
                
                <Button
                  type="button"
                  className="mt-8 w-full rounded-[16px] bg-[#FF6600] py-6 text-base font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-orange-600 hover:shadow-lg"
                  disabled={!canCreateRenewal || isCreatingRenewal}
                  onClick={() => {
                    setRenewalError(null);
                    setRenewalFeedback(null);
                    setIsRenewalDialogOpen(true);
                  }}
                >
                  Buat Tagihan Perpanjangan <ArrowUpRight className="ml-2 h-5 w-5" />
                </Button>
                
                {!canCreateRenewal ? (
                  <p className="mt-4 text-center text-xs font-medium leading-5 text-slate-400">
                    {renewalUnavailableMessage}
                  </p>
                ) : null}

                {renewalFeedback ? (
                  <div
                    className={`mt-6 rounded-[20px] border px-5 py-4 text-sm leading-6 shadow-sm ${
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
                        className="mt-4 w-full rounded-[14px] bg-emerald-600 py-5 text-white hover:bg-emerald-700 font-bold transition-all shadow-sm"
                        onClick={() => {
                          window.open(
                            renewalFeedback.checkoutUrl ?? "",
                            "_blank",
                            "noopener,noreferrer",
                          );
                        }}
                      >
                        Lanjutkan Pembayaran
                        <ArrowUpRight className="ml-2 h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {!isLoading && !error ? (
          <div className="mt-4" id="riwayat-tagihan">
            <HistoriTagihanSiswa reloadSignal={historyReloadKey} />
          </div>
        ) : null}

      </section>
    </div>


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
    </>
  );
}
