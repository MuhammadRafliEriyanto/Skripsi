"use client";

import {
  Activity,
  ArrowDownCircle,
  BanknoteArrowUp,
  Building2,
  CalendarRange,
  Clock3,
  Landmark,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

import { subscribeOwnerDashboardRefresh } from "@/components/dashboard-owner/dashboard-refresh-events";
import {
  OwnerDashboardMetricList,
  OwnerDashboardPerformanceChart,
  OwnerDashboardStatCard,
  type OwnerDashboardMetricListDonutItem,
  type OwnerDashboardAccent,
  type OwnerDashboardStatCardProps,
} from "@/components/dashboard-owner/components";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ApiResponse } from "@/lib/auth";
import { requestAdminApi } from "@/lib/admin-api";
import { getCurrentAdminAcademicYear } from "@/lib/admin-academic-year";
import {
  fetchOwnerActivities,
  type OwnerActivityIncomingPayment,
} from "@/lib/owner-activities";

type OwnerStudentSummary = {
  status?: string | null;
};
type OwnerBranchSummary = {
  status?: string | null;
  updatedAt?: string | null;
};

type OwnerActivitySummary = {
  paidRevenue: number;
  unsettledRevenue: number;
  incomingCount: number;
  paidIncomingCount: number;
  expenseCount: number;
  settledExpenseCount: number;
  settledExpenseAmount: number;
  pendingExpenseAmount: number;
  totalActivityCount: number;
  activeActivationCount: number;
  attentionActivationCount: number;
};

type OwnerDashboardPerformanceDatum = {
  label: string;
  primary: number;
  secondary: number;
};

type OwnerDashboardPerformancePeriod = "week" | "month" | "year";

type OwnerDashboardPerformanceSummary = {
  emptyStateMessage: string | null;
  hasActivity: boolean;
};

type OwnerBranchStatusFilter = "all" | "attention" | "active";

const ownerDashboardPollingIntervalMs = 30_000;

const unavailableValue = "Belum tersedia";
const unavailableDonutValue = "-";

const unavailableBranchStatusItems: OwnerDashboardMetricListDonutItem[] = [
  {
    label: "Belum ada data",
    value: unavailableValue,
    share: 100,
    accent: "slate",
  },
];

const performanceMonthLabels = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
] as const;

const performancePeriodOptions: Array<{
  label: string;
  value: OwnerDashboardPerformancePeriod;
}> = [
  { value: "week", label: "7 hari terakhir" },
  { value: "month", label: "30 hari terakhir" },
  { value: "year", label: "Tahun ini" },
];

const branchStatusFilterOptions: Array<{
  label: string;
  value: OwnerBranchStatusFilter;
}> = [
  { value: "all", label: "Semua Status" },
  { value: "active", label: "Aktif" },
  { value: "attention", label: "Persiapan & Nonaktif" },
];

function formatStudentCount(count: number) {
  return `${new Intl.NumberFormat("id-ID").format(count)} siswa`;
}

function formatBranchCount(count: number) {
  return `${new Intl.NumberFormat("id-ID").format(count)} cabang`;
}

function formatActivityCount(count: number) {
  return `${new Intl.NumberFormat("id-ID").format(count)} aktivitas`;
}

function formatPerformanceCurrency(value: number) {
  if (value <= 0) {
    return "Rp0";
  }

  return `Rp${new Intl.NumberFormat("id-ID", {
    notation: "compact",
    maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
  }).format(value)}`;
}

function formatCompactCurrency(value: number) {
  if (value < 1_000_000) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(value);
  }

  return `Rp${new Intl.NumberFormat("id-ID", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)}`;
}

function OwnerFinanceOverviewPanel({
  summary,
}: {
  summary: OwnerActivitySummary | null;
}) {
  const paidRevenue = summary?.paidRevenue ?? 0;
  const unsettledRevenue = summary?.unsettledRevenue ?? 0;
  const settledExpenseAmount = summary?.settledExpenseAmount ?? 0;
  const pendingExpenseAmount = summary?.pendingExpenseAmount ?? 0;
  const netBalance = paidRevenue - settledExpenseAmount;
  const items = [
    {
      label: "Pemasukan lunas",
      value: summary ? formatCompactCurrency(paidRevenue) : unavailableValue,
      helper:
        summary && unsettledRevenue > 0
          ? `${formatCompactCurrency(unsettledRevenue)} masih belum lunas.`
          : "Pembayaran membership yang sudah tervalidasi.",
      icon: WalletCards,
      tone: "emerald",
    },
    {
      label: "Pengeluaran selesai",
      value: summary ? formatCompactCurrency(settledExpenseAmount) : unavailableValue,
      helper:
        summary && pendingExpenseAmount > 0
          ? `${formatCompactCurrency(pendingExpenseAmount)} masih menunggu/dijadwalkan.`
          : "Operasional cabang yang sudah selesai dibayar.",
      icon: ArrowDownCircle,
      tone: "orange",
    },
    {
      label: "Saldo bersih",
      value: summary ? formatCompactCurrency(netBalance) : unavailableValue,
      helper: "Pemasukan lunas dikurangi pengeluaran selesai.",
      icon: Landmark,
      tone: netBalance >= 0 ? "sky" : "slate",
    },
  ] as const;
  const toneStyles = {
    emerald: {
      label: "text-emerald-700",
      iconWrap: "border-emerald-100 bg-emerald-50 text-emerald-500",
      dot: "bg-emerald-500",
    },
    orange: {
      label: "text-orange-700",
      iconWrap: "border-orange-100 bg-orange-50 text-orange-500",
      dot: "bg-orange-500",
    },
    sky: {
      label: "text-sky-700",
      iconWrap: "border-sky-100 bg-sky-50 text-sky-500",
      dot: "bg-sky-500",
    },
    slate: {
      label: "text-slate-700",
      iconWrap: "border-slate-200 bg-slate-50 text-slate-500",
      dot: "bg-slate-500",
    },
  } as const;

  return (
    <section className="rounded-[24px] border border-slate-200/80 bg-white px-5 py-5 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.16)]">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-slate-950">
            Ringkasan Keuangan
          </h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Gabungan pemasukan pembayaran dan pengeluaran operasional seluruh cabang.
          </p>
        </div>
        <Badge variant="secondary" className="w-fit rounded-full px-3 py-1.5">
          Pembayaran + Pengeluaran
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;
          const styles = toneStyles[item.tone];



  return (
            <div
              key={item.label}
              className="rounded-[18px] border border-slate-200/80 bg-slate-50/70 px-4 py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`size-2 rounded-full ${styles.dot}`} />
                    <p
                      className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${styles.label}`}
                    >
                      {item.label}
                    </p>
                  </div>
                  <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                    {item.value}
                  </p>
                </div>
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-2xl border ${styles.iconWrap}`}
                >
                  <Icon className="size-5" />
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-500">{item.helper}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function calculateProgress(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round((numerator / denominator) * 100)));
}

function formatUpdateBadge(value: string | null) {
  if (!value) {
    return "Sinkronisasi belum tersedia";
  }

  const updatedAt = new Date(value);

  if (Number.isNaN(updatedAt.getTime())) {
    return "Sinkronisasi belum tersedia";
  }

  const diffMinutes = Math.max(
    0,
    Math.round((Date.now() - updatedAt.getTime()) / (1000 * 60)),
  );

  if (diffMinutes < 1) {
    return "Update baru saja";
  }

  if (diffMinutes < 60) {
    return `Update ${diffMinutes} menit lalu`;
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (diffHours < 24) {
    return `Update ${diffHours} jam lalu`;
  }

  const diffDays = Math.round(diffHours / 24);

  return `Update ${diffDays} hari lalu`;
}

function pickLatestTimestamp(values: Array<string | null | undefined>) {
  let latestTimestamp: string | null = null;
  let latestTime = 0;

  for (const value of values) {
    if (!value) {
      continue;
    }

    const parsedTime = new Date(value).getTime();

    if (Number.isNaN(parsedTime) || parsedTime <= latestTime) {
      continue;
    }

    latestTime = parsedTime;
    latestTimestamp = value;
  }

  return latestTimestamp;
}

function resolveChartDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
}

function getChartPaymentDate(payment: OwnerActivityIncomingPayment) {
  return payment.status === "paid"
    ? resolveChartDate(payment.paidAt) ?? resolveChartDate(payment.createdAt)
    : resolveChartDate(payment.createdAt);
}

function startOfDay(value: Date) {
  const nextDate = new Date(value);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function addDays(value: Date, days: number) {
  const nextDate = new Date(value);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function formatPerformanceDateLabel(value: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
  }).format(value);
}

function formatPerformanceRangeLabel(startDate: Date, endDate: Date) {
  const startLabel = formatPerformanceDateLabel(startDate);
  const endLabel = formatPerformanceDateLabel(endDate);

  return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
}

function buildOwnerPerformanceSeries(
  incomingPayments: OwnerActivityIncomingPayment[],
  period: OwnerDashboardPerformancePeriod,
): OwnerDashboardPerformanceDatum[] {
  const today = startOfDay(new Date());
  const currentYear = today.getFullYear();

  if (period === "week") {
    const rangeStart = addDays(today, -6);
    const series = Array.from({ length: 7 }, (_, index) => {
      const bucketDate = addDays(rangeStart, index);

      return {
        label: formatPerformanceDateLabel(bucketDate),
        primary: 0,
        secondary: 0,
      };
    });

    for (const payment of incomingPayments) {
      const chartDate = getChartPaymentDate(payment);

      if (!chartDate) {
        continue;
      }

      const normalizedChartDate = startOfDay(chartDate);
      const dayIndex = Math.floor(
        (normalizedChartDate.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (dayIndex < 0 || dayIndex >= series.length) {
        continue;
      }

      if (payment.status === "paid") {
        series[dayIndex].primary += payment.amount;
      } else {
        series[dayIndex].secondary += payment.amount;
      }
    }

    return series;
  }

  if (period === "month") {
    const rangeStart = addDays(today, -29);
    const bucketSizeInDays = 5;
    const totalBuckets = 6;
    const series = Array.from({ length: totalBuckets }, (_, index) => {
      const bucketStart = addDays(rangeStart, index * bucketSizeInDays);
      const bucketEnd = addDays(bucketStart, bucketSizeInDays - 1);

      return {
        label: formatPerformanceRangeLabel(bucketStart, bucketEnd > today ? today : bucketEnd),
        primary: 0,
        secondary: 0,
      };
    });

    for (const payment of incomingPayments) {
      const chartDate = getChartPaymentDate(payment);

      if (!chartDate) {
        continue;
      }

      const normalizedChartDate = startOfDay(chartDate);
      const dayIndex = Math.floor(
        (normalizedChartDate.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (dayIndex < 0 || dayIndex >= totalBuckets * bucketSizeInDays) {
        continue;
      }

      const bucketIndex = Math.floor(dayIndex / bucketSizeInDays);

      if (payment.status === "paid") {
        series[bucketIndex].primary += payment.amount;
      } else {
        series[bucketIndex].secondary += payment.amount;
      }
    }

    return series;
  }

  const series = performanceMonthLabels.map((label) => ({
    label,
    primary: 0,
    secondary: 0,
  }));

  for (const payment of incomingPayments) {
    const chartDate = getChartPaymentDate(payment);

    if (!chartDate || chartDate.getFullYear() !== currentYear) {
      continue;
    }

    const monthIndex = chartDate.getMonth();

    if (payment.status === "paid") {
      series[monthIndex].primary += payment.amount;
    } else {
      series[monthIndex].secondary += payment.amount;
    }
  }

  return series;
}

function getPerformanceChartCopy(period: OwnerDashboardPerformancePeriod) {
  switch (period) {
    case "week":
      return {
        description:
          "Tren omzet lunas dibanding tagihan yang belum dibayar selama 7 hari terakhir.",
        primaryLabel: "Omzet lunas",
        secondaryLabel: "Belum lunas",
      };
    case "month":
      return {
        description:
          "Tren omzet lunas dibanding tagihan yang belum dibayar selama 30 hari terakhir.",
        primaryLabel: "Omzet lunas",
        secondaryLabel: "Belum lunas",
      };
    default:
      return {
        description:
          "Tren omzet lunas dibanding tagihan yang belum dibayar selama tahun berjalan.",
        primaryLabel: "Omzet lunas",
        secondaryLabel: "Belum lunas",
      };
  }
}

function summarizePerformanceSeries(
  period: OwnerDashboardPerformancePeriod,
  series: OwnerDashboardPerformanceDatum[],
): OwnerDashboardPerformanceSummary {
  const hasActivity = series.some((item) => item.primary > 0 || item.secondary > 0);

  if (hasActivity) {
    return {
      hasActivity: true,
      emptyStateMessage: null,
    };
  }

  switch (period) {
    case "week":
      return {
        hasActivity: false,
        emptyStateMessage:
          "Belum ada transaksi yang tercatat untuk 7 hari terakhir.",
      };
    case "month":
      return {
        hasActivity: false,
        emptyStateMessage:
          "Belum ada transaksi yang tercatat untuk 30 hari terakhir.",
      };
    default:
      return {
        hasActivity: false,
        emptyStateMessage:
          "Belum ada transaksi yang tercatat untuk tahun ini di sistem.",
      };
  }
}

function buildBranchStatusItems(
  branches: OwnerBranchSummary[],
  options?: {
    emptyLabel?: string;
  },
): {
  donutItems: OwnerDashboardMetricListDonutItem[];
  donutValue: string;
} {
  const totalBranches = branches.length;

  if (totalBranches === 0) {
    return {
      donutItems: [
        {
          label: options?.emptyLabel ?? "Belum ada cabang",
          value: formatBranchCount(0),
          share: 100,
          accent: "slate",
        },
      ],
      donutValue: "0",
    };
  }

  const branchStatusConfig: Array<{
    accent: OwnerDashboardAccent;
    count: number;
    label: string;
  }> = [
    {
      label: "Aktif",
      count: branches.filter((branch) => branch.status === "Aktif").length,
      accent: "emerald" as const,
    },
    {
      label: "Persiapan",
      count: branches.filter((branch) => branch.status === "Persiapan").length,
      accent: "amber" as const,
    },
    {
      label: "Nonaktif",
      count: branches.filter((branch) => branch.status === "Nonaktif").length,
      accent: "slate" as const,
    },
  ].filter((item) => item.count > 0);

  const donutItems = branchStatusConfig.map((item, index) => {
    const computedShare = Math.round((item.count / totalBranches) * 100);
    const consumedShare = branchStatusConfig
      .slice(0, index)
      .reduce((total, current) => total + Math.round((current.count / totalBranches) * 100), 0);

    return {
      label: item.label,
      value: formatBranchCount(item.count),
      share:
        index === branchStatusConfig.length - 1
          ? Math.max(100 - consumedShare, 0)
          : computedShare,
      accent: item.accent,
    };
  });

  return {
    donutItems,
    donutValue: String(totalBranches),
  };
}

function filterBranchesByStatus(
  branches: OwnerBranchSummary[],
  filter: OwnerBranchStatusFilter,
) {
  switch (filter) {
    case "attention":
      return branches.filter(
        (branch) => branch.status === "Persiapan" || branch.status === "Nonaktif",
      );
    case "active":
      return branches.filter((branch) => branch.status === "Aktif");
    default:
      return branches;
  }
}

function buildBranchStatusSummary(
  branches: OwnerBranchSummary[] | null,
  filter: OwnerBranchStatusFilter,
): {
  donutItems: OwnerDashboardMetricListDonutItem[];
  donutLabel: string;
  donutValue: string;
} {
  if (!branches) {
    return {
      donutItems: unavailableBranchStatusItems,
      donutLabel: "Total",
      donutValue: unavailableDonutValue,
    };
  }

  const filteredBranches = filterBranchesByStatus(branches, filter);
  const filterConfig: Record<
    OwnerBranchStatusFilter,
    { donutLabel: string; emptyLabel: string }
  > = {
    all: {
      donutLabel: "Total",
      emptyLabel: "Belum ada cabang",
    },
    attention: {
      donutLabel: "Total",
      emptyLabel: "Tidak ada cabang berstatus Persiapan atau Nonaktif",
    },
    active: {
      donutLabel: "Aktif",
      emptyLabel: "Belum ada cabang aktif",
    },
  };
  const summary = buildBranchStatusItems(filteredBranches, {
    emptyLabel: filterConfig[filter].emptyLabel,
  });

  return {
    donutItems: summary.donutItems,
    donutLabel: filterConfig[filter].donutLabel,
    donutValue: summary.donutValue,
  };
}

function readResponseItems<T>(
  payload: ApiResponse<Record<string, unknown>>,
  key: string,
): T[] {
  const nestedValue = payload.data?.[key];

  if (Array.isArray(nestedValue)) {
    return nestedValue as T[];
  }

  const topLevelValue = (payload as Record<string, unknown>)[key];

  if (Array.isArray(topLevelValue)) {
    return topLevelValue as T[];
  }

  return [];
}

export function OwnerDashboardCanvasSection() {
  const currentAcademicYear = getCurrentAdminAcademicYear();
  const [performancePeriod, setPerformancePeriod] =
    useState<OwnerDashboardPerformancePeriod>("year");
  const [branchStatusFilter, setBranchStatusFilter] =
    useState<OwnerBranchStatusFilter>("all");
  const [studentCount, setStudentCount] = useState<number | null>(null);
  const [activeStudentCount, setActiveStudentCount] = useState<number | null>(null);
  const [branchCount, setBranchCount] = useState<number | null>(null);
  const [activeBranchCount, setActiveBranchCount] = useState<number | null>(null);
  const [branches, setBranches] = useState<OwnerBranchSummary[] | null>(null);
  const [activitySummary, setActivitySummary] = useState<OwnerActivitySummary | null>(null);
  const [incomingPayments, setIncomingPayments] = useState<OwnerActivityIncomingPayment[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const isRefreshingRef = useRef(false);

  const loadDashboardCardValues = useEffectEvent(async () => {
    if (isRefreshingRef.current) {
      return;
    }

    isRefreshingRef.current = true;

    try {
    const [studentsResult, branchesResult, activitiesResult] = await Promise.allSettled([
      requestAdminApi<{ students: OwnerStudentSummary[] }>(
        `/api/students?academicYear=${encodeURIComponent(currentAcademicYear)}`,
        {
          method: "GET",
        },
      ),
      requestAdminApi<{ branches: Record<string, unknown>[] }>("/api/branches", {
        method: "GET",
      }),
      fetchOwnerActivities(),
    ]);
      const latestTimestamps: Array<string | null | undefined> = [];

      if (studentsResult.status === "fulfilled") {
        const payload = studentsResult.value;
        const students = readResponseItems<OwnerStudentSummary>(payload, "students");
        const totalStudents = students.length;
        const activeStudents = students.filter((student) => student.status === "Aktif").length;

        setStudentCount(totalStudents);
        setActiveStudentCount(activeStudents);
      }

      if (branchesResult.status === "fulfilled") {
        const branches = readResponseItems<OwnerBranchSummary>(
          branchesResult.value,
          "branches",
        );
        const activeBranches = branches.filter((branch) => branch.status === "Aktif").length;

        setBranchCount(branches.length);
        setActiveBranchCount(activeBranches);
        setBranches(branches);
        latestTimestamps.push(...branches.map((branch) => branch.updatedAt));
      }

      if (activitiesResult.status === "fulfilled") {
        const { incomingPayments, outgoingPayments, activationStudents } =
          activitiesResult.value;
        const paidRevenue = incomingPayments
          .filter((payment) => payment.status === "paid")
          .reduce((total, payment) => total + payment.amount, 0);
        const unsettledRevenue = incomingPayments
          .filter((payment) => payment.status !== "paid")
          .reduce((total, payment) => total + payment.amount, 0);
        const paidIncomingCount = incomingPayments.filter(
          (payment) => payment.status === "paid",
        ).length;
        const settledExpenses = outgoingPayments.filter(
          (expense) => expense.status === "Selesai",
        );
        const pendingExpenses = outgoingPayments.filter(
          (expense) =>
            expense.status === "Menunggu" || expense.status === "Dijadwalkan",
        );
        const settledExpenseAmount = settledExpenses.reduce(
          (total, expense) => total + expense.amount,
          0,
        );
        const pendingExpenseAmount = pendingExpenses.reduce(
          (total, expense) => total + expense.amount,
          0,
        );
        const activeActivationCount = activationStudents.filter(
          (student) => student.activationStatus === "Aktif",
        ).length;
        const attentionActivationCount = activationStudents.filter(
          (student) => student.activationStatus !== "Aktif",
        ).length;

        setActivitySummary({
          paidRevenue,
          unsettledRevenue,
          incomingCount: incomingPayments.length,
          paidIncomingCount,
          expenseCount: outgoingPayments.length,
          settledExpenseCount: settledExpenses.length,
          settledExpenseAmount,
          pendingExpenseAmount,
          totalActivityCount:
            incomingPayments.length + outgoingPayments.length + activationStudents.length,
          activeActivationCount,
          attentionActivationCount,
        });
        setIncomingPayments(incomingPayments);

        latestTimestamps.push(
          ...incomingPayments.map((payment) => payment.updatedAt),
          ...outgoingPayments.map((expense) => expense.updatedAt),
          ...activationStudents.map((student) => student.registeredAt),
        );
      }

      const latestTimestamp = pickLatestTimestamp(latestTimestamps);

      if (latestTimestamp) {
        setLastUpdatedAt(latestTimestamp);
      }
    } finally {
      isRefreshingRef.current = false;
      setIsInitialLoading(false);
    }
  });

  useEffect(() => {
    void loadDashboardCardValues();
    const unsubscribe = subscribeOwnerDashboardRefresh(() => {
      void loadDashboardCardValues();
    });
    const intervalId = window.setInterval(() => {
      void loadDashboardCardValues();
    }, ownerDashboardPollingIntervalMs);

    return () => {
      unsubscribe();
      window.clearInterval(intervalId);
    };
  }, []);

  const performanceSeries = useMemo(
    () => buildOwnerPerformanceSeries(incomingPayments, performancePeriod),
    [incomingPayments, performancePeriod],
  );
  const performanceChartCopy = useMemo(
    () => getPerformanceChartCopy(performancePeriod),
    [performancePeriod],
  );
  const performanceSummary = useMemo(
    () => summarizePerformanceSeries(performancePeriod, performanceSeries),
    [performancePeriod, performanceSeries],
  );
  const branchStatusSummary = useMemo(
    () => buildBranchStatusSummary(branches, branchStatusFilter),
    [branches, branchStatusFilter],
  );

  const resolvedSummaryCards: OwnerDashboardStatCardProps[] = [
    activitySummary
      ? {
          title: "Omzet",
          value: formatCompactCurrency(activitySummary.paidRevenue),
          note:
            activitySummary.unsettledRevenue > 0
              ? `${formatCompactCurrency(activitySummary.unsettledRevenue)} masih belum lunas.`
              : "Semua pembayaran yang tercatat saat ini sudah lunas.",
          progress: calculateProgress(
            activitySummary.paidRevenue,
            activitySummary.paidRevenue + activitySummary.unsettledRevenue,
          ),
          trend:
            activitySummary.incomingCount > 0
              ? `${activitySummary.paidIncomingCount} pembayaran lunas`
              : "Belum ada pembayaran",
          direction: activitySummary.paidRevenue > 0 ? "up" : "down",
          accent: "orange",
          icon: BanknoteArrowUp,
        }
      : {
          title: "Omzet",
          value: unavailableValue,
          note: "Sedang memuat data transaksi pembayaran...",
          progress: 0,
          trend: "Menunggu data",
          direction: "down",
          accent: "orange",
          icon: BanknoteArrowUp,
        },
    branchCount !== null
      ? {
          title: "Cabang",
          value: formatBranchCount(branchCount),
          note:
            branchCount > 0
              ? `${Math.max(branchCount - (activeBranchCount ?? 0), 0)} cabang lain masih persiapan atau nonaktif.`
              : "Belum ada data cabang terdaftar di sistem.",
          progress: calculateProgress(activeBranchCount ?? 0, branchCount),
          trend:
            branchCount > 0
              ? `${activeBranchCount ?? 0} cabang aktif`
              : "Belum ada cabang",
          direction: branchCount > 0 ? "up" : "down",
          accent: "emerald",
          icon: Building2,
        }
      : {
          title: "Cabang",
          value: unavailableValue,
          note: "Sedang memuat data operasional cabang...",
          progress: 0,
          trend: "Menunggu data",
          direction: "down",
          accent: "emerald",
          icon: Building2,
        },
    activitySummary
      ? {
          title: "Aktivitas Sistem",
          value: formatActivityCount(activitySummary.totalActivityCount),
          note:
            activitySummary.attentionActivationCount > 0
              ? `${activitySummary.attentionActivationCount} status aktivasi masih perlu tindak lanjut.`
              : "Seluruh sistem pembayaran dan aktivasi berjalan normal.",
          progress: calculateProgress(
            activitySummary.paidIncomingCount + activitySummary.activeActivationCount,
            activitySummary.totalActivityCount,
          ),
          trend:
            activitySummary.activeActivationCount > 0
              ? `${activitySummary.activeActivationCount} aktivasi aktif`
              : "Belum ada aktivasi aktif",
          direction: activitySummary.totalActivityCount > 0 ? "up" : "down",
          accent: "sky",
          icon: Activity,
        }
      : {
          title: "Aktivitas Sistem",
          value: unavailableValue,
          note: "Sedang memuat data transaksi dan aktivasi...",
          progress: 0,
          trend: "Menunggu data",
          direction: "down",
          accent: "sky",
          icon: Activity,
        },
    studentCount !== null
      ? {
          title: "Total Siswa",
          value: formatStudentCount(studentCount),
          note:
            studentCount > 0
              ? `${Math.max(studentCount - (activeStudentCount ?? 0), 0)} siswa berstatus nonaktif.`
              : "Belum ada data siswa yang terdaftar di sistem.",
          progress: calculateProgress(activeStudentCount ?? 0, studentCount),
          trend:
            studentCount > 0
              ? `${activeStudentCount ?? 0} siswa aktif`
              : "Belum ada siswa",
          direction: studentCount > 0 ? "up" : "down",
          accent: "amber",
          icon: ShieldCheck,
        }
      : {
          title: "Total Siswa",
          value: unavailableValue,
          note: "Sedang memuat profil dan data siswa...",
          progress: 0,
          trend: "Menunggu data",
          direction: "down",
          accent: "amber",
          icon: ShieldCheck,
        },
  ];

  if (isInitialLoading) {
    return (
      <div className="space-y-4">
        <div>
          <Skeleton className="h-8 w-40" />
        </div>
        <Skeleton className="h-6 w-32 rounded-full" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="space-y-4 rounded-[24px] border border-slate-200/80 bg-white p-5"
            >
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-4 w-36" />
            </div>
          ))}
        </div>
        <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 space-y-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-72" />
          <div className="grid gap-3 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="space-y-3 rounded-[18px] border border-slate-200/80 bg-slate-50/70 p-4"
              >
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-28" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
          <div className="space-y-4 rounded-[24px] border border-slate-200/80 bg-white p-5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-72" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="space-y-4 rounded-[24px] border border-slate-200/80 bg-white p-5">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-56" />
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
          Dashboard
        </h2>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="rounded-full px-3 py-1.5">
          <Clock3 className="size-3.5" />
          {formatUpdateBadge(lastUpdatedAt)}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {resolvedSummaryCards.map((card) => (
          <OwnerDashboardStatCard key={card.title} {...card} />
        ))}
      </div>

      <OwnerFinanceOverviewPanel summary={activitySummary} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
        <OwnerDashboardPerformanceChart
          title="Ikhtisar Omzet"
          description={performanceChartCopy.description}
          primaryLabel={performanceChartCopy.primaryLabel}
          secondaryLabel={performanceChartCopy.secondaryLabel}
          data={performanceSeries}
          valueFormatter={formatPerformanceCurrency}
          emptyStateMessage={performanceSummary.emptyStateMessage}
          headerControl={
            <Select
              value={performancePeriod}
              onValueChange={(value) =>
                setPerformancePeriod(value as OwnerDashboardPerformancePeriod)
              }
            >
              <SelectTrigger className="h-10 min-w-[148px] rounded-full border-slate-200 bg-white px-3 text-sm shadow-sm shadow-slate-950/5">
                <div className="flex items-center gap-2">
                  <CalendarRange className="size-4 text-slate-400" />
                  <SelectValue placeholder="Pilih periode" />
                </div>
              </SelectTrigger>
              <SelectContent align="end">
                {performancePeriodOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />

        <OwnerDashboardMetricList
          title="Status Operasional Cabang"
          description="Komposisi status operasional seluruh cabang berdasarkan pembaruan data terakhir."
          items={[]}
          donutItems={branchStatusSummary.donutItems}
          donutLabel={branchStatusSummary.donutLabel}
          donutValue={branchStatusSummary.donutValue}
          footerNote="Bagian ini ikut diperbarui otomatis setiap kali data cabang berhasil disimpan atau dihapus."
          headerControl={
            <Select
              value={branchStatusFilter}
              onValueChange={(value) =>
                setBranchStatusFilter(value as OwnerBranchStatusFilter)
              }
            >
              <SelectTrigger className="h-10 min-w-[168px] rounded-full border-slate-200 bg-white px-3 text-sm shadow-sm shadow-slate-950/5">
                <SelectValue placeholder="Pilih status" />
              </SelectTrigger>
              <SelectContent align="end">
                {branchStatusFilterOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
      </div>
    </div>
  );
}
