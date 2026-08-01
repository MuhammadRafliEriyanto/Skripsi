"use client";

import type { LucideIcon } from "lucide-react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  GraduationCap,
  Search,
  Users,
  WalletCards,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchAdminPayments,
  fetchAdminPaymentSummary,
  type AdminPaymentListItem,
  type AdminPaymentSummaryData,
} from "@/lib/admin-payments";
import {
  defaultAdminDashboardConfig,
  fetchAdminDashboardConfig,
  type AdminDashboardConfigData,
} from "@/lib/admin-dashboard-config";
import {
  fetchAdminFinanceSummary,
  type AdminFinanceSummaryData,
} from "@/lib/admin-finances";
import {
  fetchAdminSchedules,
  fetchAdminStudents,
  fetchAdminTeachers,
  type AdminSchedulesSummary,
  type AdminStudentsSummary,
  type AdminTeachersSummary,
} from "@/lib/admin-directory";
import { getCurrentAdminAcademicYear } from "@/lib/admin-academic-year";
import { cn, formatCurrency } from "@/lib/utils";

import { adminPoppins } from "./components/admin-font";
import {
  AdminChartSkeleton,
  AdminDonutSkeleton,
  AdminListPanelSkeleton,
  AdminMetricGridSkeleton,
} from "./components/AdminLoadingState";
import type {
  AdminSchedule as AdminScheduleItem,
  AdminStudent,
  AdminTab,
  AdminTeacher,
} from "./admin-data";

type StatAccent = "orange" | "emerald" | "amber" | "slate";

type DashboardStatCardData = {
  key: string;
  title: string;
  value: string;
  note: string;
  percentage: number;
  trend: string;
  direction: "up" | "down";
  accent: StatAccent;
  icon: LucideIcon;
  isLoading?: boolean;
};

type PaymentOverviewSummary = AdminPaymentSummaryData["summary"];
type PaymentOverviewPeriod = "week" | "month" | "year";
type PaymentTrendPoint = AdminPaymentSummaryData["trend"][number];
type FinanceOverviewSummary = AdminFinanceSummaryData["summary"];

type ChartPoint = {
  x: number;
  y: number;
};

type OverviewSearchResults = {
  students: AdminStudent[];
  teachers: AdminTeacher[];
  schedules: AdminScheduleItem[];
  payments: AdminPaymentListItem[];
  totals: {
    students: number;
    teachers: number;
    schedules: number;
    payments: number;
  };
};

const emptyOverviewSearchResults: OverviewSearchResults = {
  students: [],
  teachers: [],
  schedules: [],
  payments: [],
  totals: {
    students: 0,
    teachers: 0,
    schedules: 0,
    payments: 0,
  },
};

const paymentOverviewPeriodOptions: Array<{
  label: string;
  value: PaymentOverviewPeriod;
}> = [
  { value: "week", label: "7 hari terakhir" },
  { value: "month", label: "30 hari terakhir" },
  { value: "year", label: "Tahun ini" },
];

const accentStyles: Record<
  StatAccent,
  {
    icon: string;
    badge: string;
    progress: string;
  }
> = {
  orange: {
    icon: "border-orange-100/80 bg-gradient-to-br from-orange-50 to-amber-50 text-orange-600",
    badge: "border-orange-100/80 bg-orange-50/90 text-orange-700",
    progress: "[&>div]:bg-orange-500",
  },
  emerald: {
    icon: "border-emerald-100/80 bg-gradient-to-br from-emerald-50 to-emerald-100/60 text-emerald-600",
    badge: "border-emerald-100/80 bg-emerald-50/90 text-emerald-700",
    progress: "[&>div]:bg-emerald-500",
  },
  amber: {
    icon: "border-amber-100/80 bg-gradient-to-br from-amber-50 to-orange-50 text-amber-600",
    badge: "border-amber-100/80 bg-amber-50/90 text-amber-700",
    progress: "[&>div]:bg-amber-500",
  },
  slate: {
    icon: "border-slate-200/80 bg-gradient-to-br from-slate-50 to-white text-slate-600",
    badge: "border-slate-200/80 bg-slate-100/85 text-slate-700",
    progress: "[&>div]:bg-slate-700",
  },
};

function DashboardStatCard({
  title,
  value,
  note,
  percentage,
  trend,
  direction,
  accent,
  icon: Icon,
  isLoading = false,
}: DashboardStatCardData) {
  const styles = accentStyles[accent];

  return (
    <Card className="group relative overflow-hidden rounded-[24px] border border-slate-200/80 bg-white/96 shadow-[0_20px_36px_-30px_rgba(15,23,42,0.18)] transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_28px_48px_-34px_rgba(15,23,42,0.16)]">
      <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
      <div className="absolute -right-10 top-0 size-24 rounded-full bg-slate-100/70 blur-3xl" />

      <CardContent className="relative p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-slate-500">{title}</p>
            {isLoading ? (
              <Skeleton className="mt-2 h-8 w-24" />
            ) : (
              <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                {value}
              </h3>
            )}
          </div>

          <div
            className={cn(
              "flex size-11 items-center justify-center rounded-2xl border border-white/80 shadow-sm shadow-slate-950/5",
              styles.icon,
            )}
          >
            <Icon className="size-4.5" />
          </div>
        </div>

        {isLoading ? (
          <div className="mt-3 flex items-center gap-2">
            <Skeleton className="h-6 w-16 rounded-md" />
            <Skeleton className="h-3 w-24" />
          </div>
        ) : (
        <div className="mt-3 flex items-center gap-2">
          <Badge
            variant="secondary"
            className={cn(
              "gap-1 rounded-md px-2 py-0.5 text-[11px]",
              styles.badge,
            )}
          >
            {direction === "up" ? (
              <ArrowUpRight className="size-3" />
            ) : (
              <ArrowDownRight className="size-3" />
            )}
            {trend}
          </Badge>

          <span className="text-[11px] text-slate-400">{note}</span>
        </div>
        )}

        {isLoading ? (
          <Skeleton className="mt-3 h-1.5 w-full rounded-full" />
        ) : (
          <Progress
            value={percentage}
            className={cn("mt-3 h-1.5 bg-slate-100", styles.progress)}
          />
        )}
      </CardContent>
    </Card>
  );
}

function formatCompactCurrency(value: number) {
  if (value <= 0) {
    return "Rp0";
  }

  if (value < 1_000_000) {
    return formatCurrency(value);
  }

  return `Rp${new Intl.NumberFormat("id-ID", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)}`;
}

function startOfDay(value: Date) {
  const nextDate = new Date(value);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function endOfDay(value: Date) {
  const nextDate = new Date(value);
  nextDate.setHours(23, 59, 59, 999);
  return nextDate;
}

function addDays(value: Date, amount: number) {
  const nextDate = new Date(value);
  nextDate.setDate(nextDate.getDate() + amount);
  return nextDate;
}

function resolvePaymentOverviewDateRange(period: PaymentOverviewPeriod) {
  const today = new Date();

  switch (period) {
    case "week": {
      const rangeEnd = endOfDay(today);
      const rangeStart = startOfDay(addDays(today, -6));

      return {
        dateFrom: rangeStart.toISOString(),
        dateTo: rangeEnd.toISOString(),
      };
    }
    case "month": {
      const rangeEnd = endOfDay(today);
      const rangeStart = startOfDay(addDays(today, -29));

      return {
        dateFrom: rangeStart.toISOString(),
        dateTo: rangeEnd.toISOString(),
      };
    }
    default: {
      const rangeEnd = endOfDay(today);
      const rangeStart = startOfDay(new Date(today.getFullYear(), 0, 1));

      return {
        dateFrom: rangeStart.toISOString(),
        dateTo: rangeEnd.toISOString(),
      };
    }
  }
}

function getPaymentOverviewCopy(period: PaymentOverviewPeriod) {
  switch (period) {
    case "week":
      return {
        description: "Tren nominal transaksi membership untuk 7 hari terakhir.",
        totalHelper: "Akumulasi nominal untuk 7 hari terakhir.",
        emptyDescription:
          "Belum ada histori pembayaran yang cukup untuk 7 hari terakhir.",
        limitedHistoryDescription:
          "Grafik dibentuk dari 100 transaksi terbaru pada 7 hari terakhir.",
      };
    case "month":
      return {
        description: "Tren nominal transaksi membership untuk 30 hari terakhir.",
        totalHelper: "Akumulasi nominal untuk 30 hari terakhir.",
        emptyDescription:
          "Belum ada histori pembayaran yang cukup untuk 30 hari terakhir.",
        limitedHistoryDescription:
          "Grafik dibentuk dari 100 transaksi terbaru pada 30 hari terakhir.",
      };
    default:
      return {
        description: "Tren nominal transaksi membership untuk tahun ini.",
        totalHelper: "Akumulasi nominal untuk tahun berjalan.",
        emptyDescription:
          "Belum ada histori pembayaran yang cukup untuk tahun ini.",
        limitedHistoryDescription:
          "Grafik dibentuk dari 100 transaksi terbaru pada tahun ini.",
      };
  }
}

function buildSmoothLinePath(points: ChartPoint[]) {
  if (points.length === 0) {
    return "";
  }

  if (points.length === 1) {
    return `M ${points[0]?.x ?? 0} ${points[0]?.y ?? 0}`;
  }

  let path = `M ${points[0]?.x ?? 0} ${points[0]?.y ?? 0}`;

  for (let index = 0; index < points.length - 1; index += 1) {
    const currentPoint = points[index];
    const nextPoint = points[index + 1];

    if (!currentPoint || !nextPoint) {
      continue;
    }

    const controlX = (currentPoint.x + nextPoint.x) / 2;
    path += ` C ${controlX} ${currentPoint.y}, ${controlX} ${nextPoint.y}, ${nextPoint.x} ${nextPoint.y}`;
  }

  return path;
}

function buildAreaPath(points: ChartPoint[], chartBottom: number) {
  if (points.length === 0) {
    return "";
  }

  const linePath = buildSmoothLinePath(points);
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  if (!firstPoint || !lastPoint) {
    return "";
  }

  return `${linePath} L ${lastPoint.x} ${chartBottom} L ${firstPoint.x} ${chartBottom} Z`;
}

function PaymentDistributionCard({
  summary,
  trend,
  isLoading,
  error,
  period,
  onPeriodChange,
}: {
  summary: PaymentOverviewSummary | null;
  trend: PaymentTrendPoint[];
  isLoading: boolean;
  error: string | null;
  period: PaymentOverviewPeriod;
  onPeriodChange: (period: PaymentOverviewPeriod) => void;
}) {
  const resolvedSummary = summary ?? {
    totalTransactions: 0,
    pendingCount: 0,
    paidCount: 0,
    expiredCount: 0,
    failedCount: 0,
    totalAmount: 0,
  };
  const expiredOrFailedCount =
    resolvedSummary.expiredCount + resolvedSummary.failedCount;
  const overviewCopy = getPaymentOverviewCopy(period);
  const chartSeries = trend;
  const hasChartData = chartSeries.some((item) => item.totalAmount > 0);
  const totalTransactionCount = resolvedSummary.totalTransactions;
  const overviewDescription = overviewCopy.description;
  const overviewHistoryLabel = `Grafik menampilkan ${totalTransactionCount} transaksi pada periode yang dipilih.`;
  const chartWidth = 720;
  const chartBottom = 188;
  const chartHeight = 164;
  const maxAmount = Math.max(1, ...chartSeries.map((item) => item.totalAmount));
  const chartPoints = chartSeries.map((item, index) => ({
    x:
      chartSeries.length > 1
        ? (index / (chartSeries.length - 1)) * chartWidth
        : chartWidth / 2,
    y: chartBottom - (item.totalAmount / maxAmount) * chartHeight,
  }));
  const linePath = buildSmoothLinePath(chartPoints);
  const areaPath = buildAreaPath(chartPoints, chartBottom);
  const yAxisTicks = [1, 0.75, 0.5, 0.25, 0].map((ratio) =>
    formatCompactCurrency(maxAmount * ratio),
  );
  const totalPaymentAmountLabel = formatCurrency(resolvedSummary.totalAmount);

  return (
    <Card className="relative overflow-hidden rounded-[24px] border border-slate-200/80 bg-white/96 shadow-[0_20px_36px_-30px_rgba(15,23,42,0.16)]">
      <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
      <CardContent className="p-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xl">
            <h2 className="text-sm font-semibold text-slate-900">
              Overview Pembayaran
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {overviewDescription}
            </p>
          </div>

          <div className="flex flex-col items-stretch gap-3 sm:min-w-[260px] sm:items-end">
            <Select
              value={period}
              onValueChange={(value) => {
                onPeriodChange(value as PaymentOverviewPeriod);
              }}
            >
              <SelectTrigger className="h-10 min-w-[190px] rounded-full border-slate-200 bg-white px-3 text-sm shadow-sm shadow-slate-950/5 sm:w-auto">
                <SelectValue placeholder="Pilih periode" />
              </SelectTrigger>
              <SelectContent align="end">
                {paymentOverviewPeriodOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="w-full rounded-[20px] border border-slate-200/90 bg-white px-4 py-4 text-left shadow-[0_18px_34px_-28px_rgba(15,23,42,0.22)] sm:text-right">
              <p className="text-xs font-medium text-slate-500">
                Total Pembayaran
              </p>
              {isLoading && !summary ? (
                <>
                  <Skeleton className="mt-2 h-8 w-36 sm:ml-auto" />
                  <Skeleton className="mt-2 h-3 w-44 sm:ml-auto" />
                </>
              ) : (
                <>
                  <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                    {totalPaymentAmountLabel}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {error
                      ? "Ringkasan nominal belum berhasil dimuat."
                      : overviewCopy.totalHelper}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[22px] border border-orange-100/60 bg-[linear-gradient(180deg,rgba(255,247,237,0.52),rgba(255,255,255,0.98))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
          {isLoading && !hasChartData ? (
            <AdminChartSkeleton className="border-0 bg-transparent" />
          ) : !hasChartData ? (
            <div className="flex h-[320px] items-center justify-center px-6 text-center">
              <div className="max-w-xs space-y-2">
                <p className="text-sm font-semibold text-slate-800">
                  Grafik pembayaran belum tersedia
                </p>
                <p className="text-sm leading-6 text-slate-500">
                  {error
                    ? "Data pembayaran belum berhasil dimuat, jadi dashboard tidak menampilkan angka pengganti."
                    : overviewCopy.emptyDescription}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                  Lunas {resolvedSummary.paidCount}
                </span>
                <span className="rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">
                  Pending {resolvedSummary.pendingCount}
                </span>
                <span className="rounded-full border border-orange-100 bg-orange-50 px-2.5 py-1 font-semibold text-orange-700">
                  Expired/Gagal {expiredOrFailedCount}
                </span>
                <span className="text-slate-400">
                  Lunas memakai `paidAt`, status lain memakai `createdAt`.
                </span>
              </div>

              <div className="grid gap-4 lg:grid-cols-[72px_1fr]">
                <div className="flex h-[262px] flex-col justify-between pb-10 pt-2 text-[11px] text-slate-400">
                  {yAxisTicks.map((tickLabel) => (
                    <span key={tickLabel}>{tickLabel}</span>
                  ))}
                </div>

                <div>
                  <div className="relative h-[262px] overflow-hidden rounded-[20px] border border-white/70 bg-white/70 px-2 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                    <div className="absolute inset-x-3 top-6 h-px border-t border-dashed border-orange-100/90" />
                    <div className="absolute inset-x-3 top-[71px] h-px border-t border-dashed border-orange-100/90" />
                    <div className="absolute inset-x-3 top-[116px] h-px border-t border-dashed border-orange-100/90" />
                    <div className="absolute inset-x-3 top-[161px] h-px border-t border-dashed border-orange-100/90" />
                    <div className="absolute inset-x-3 top-[206px] h-px border-t border-dashed border-orange-100/90" />

                    <svg
                      viewBox={`0 0 ${chartWidth} 210`}
                      className="relative z-10 h-[214px] w-full"
                      preserveAspectRatio="none"
                    >
                      <defs>
                        <linearGradient id="paymentOverviewArea" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#fb923c" stopOpacity="0.26" />
                          <stop offset="100%" stopColor="#fb923c" stopOpacity="0.04" />
                        </linearGradient>
                        <linearGradient id="paymentOverviewLine" x1="0" x2="1" y1="0" y2="0">
                          <stop offset="0%" stopColor="#f59e0b" />
                          <stop offset="100%" stopColor="#f97316" />
                        </linearGradient>
                      </defs>

                      {areaPath ? (
                        <path d={areaPath} fill="url(#paymentOverviewArea)" />
                      ) : null}
                      {linePath ? (
                        <path
                          d={linePath}
                          fill="none"
                          stroke="url(#paymentOverviewLine)"
                          strokeWidth="4"
                          strokeLinecap="round"
                        />
                      ) : null}

                      {chartPoints.map((point, index) => {
                        const pointMeta = chartSeries[index];

                        if (!pointMeta) {
                          return null;
                        }

                        return (
                          <circle
                            key={pointMeta.key}
                            cx={point.x}
                            cy={point.y}
                            r="4.5"
                            fill="#ffffff"
                            stroke="#f97316"
                            strokeWidth="3"
                          />
                        );
                      })}
                    </svg>
                  </div>

                  <div className="mt-3 flex justify-between gap-2 text-[11px] text-slate-400">
                  {chartSeries.map((item) => (
                      <div key={item.key} className="flex-1 text-center">
                        <p className="font-medium text-slate-500">
                          {item.shortLabel}
                        </p>
                        <p className="text-[10px] leading-4">{item.totalCount} trx</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-3 text-xs leading-5 text-slate-500">
                {overviewHistoryLabel}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PaymentStatusDonutCard({
  summary,
  isLoading,
  error,
  onViewDetails,
}: {
  summary: PaymentOverviewSummary | null;
  isLoading: boolean;
  error: string | null;
  onViewDetails: () => void;
}) {
  const resolvedSummary = summary ?? {
    totalTransactions: 0,
    pendingCount: 0,
    paidCount: 0,
    expiredCount: 0,
    failedCount: 0,
    totalAmount: 0,
  };
  const expiredOrFailedCount =
    resolvedSummary.expiredCount + resolvedSummary.failedCount;
  const totalItems = resolvedSummary.totalTransactions;
  const chartSegments = [
    {
      key: "paid",
      label: "Lunas",
      value: resolvedSummary.paidCount,
      color: "#10b981",
      dotClassName: "bg-emerald-500",
    },
    {
      key: "pending",
      label: "Pending",
      value: resolvedSummary.pendingCount,
      color: "#f59e0b",
      dotClassName: "bg-amber-500",
    },
    {
      key: "risk",
      label: "Expired/Gagal",
      value: expiredOrFailedCount,
      color: "#f97316",
      dotClassName: "bg-orange-500",
    },
  ].filter((segment) => segment.value > 0);
  const conicGradient =
    chartSegments.length > 0 && totalItems > 0
      ? `conic-gradient(${chartSegments
          .map((segment, index) => {
            const start = chartSegments
              .slice(0, index)
              .reduce((sum, item) => sum + item.value, 0);
            const end = start + segment.value;

            return `${segment.color} ${(start / totalItems) * 360}deg ${(end / totalItems) * 360}deg`;
          })
          .join(", ")})`
      : "conic-gradient(#e2e8f0 0deg 360deg)";
  const hasSummary = totalItems > 0;

  return (
    <Card className="relative overflow-hidden rounded-[24px] border border-slate-200/80 bg-white/96 shadow-[0_20px_36px_-30px_rgba(15,23,42,0.16)]">
      <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
      <CardContent className="p-5">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Status Pembayaran
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Diagram lingkaran status payment membership yang sedang terpantau.
            </p>
          </div>

          <button
            type="button"
            onClick={onViewDetails}
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-1 py-0.5 text-xs font-semibold text-orange-600 transition hover:text-orange-700"
          >
            Lihat detail
            <ChevronRight className="size-3.5" />
          </button>
        </div>

        {isLoading && !hasSummary ? (
          <AdminDonutSkeleton />
        ) : !hasSummary ? (
          <div className="flex h-[320px] items-center justify-center px-6 text-center">
            <div className="max-w-xs space-y-2">
              <p className="text-sm font-semibold text-slate-800">
                Diagram pembayaran belum tersedia
              </p>
              <p className="text-sm leading-6 text-slate-500">
                {error
                  ? "Data pembayaran live belum berhasil dimuat, jadi donut chart tidak menampilkan angka pengganti."
                  : "Belum ada pembayaran yang bisa dibentuk menjadi komposisi status."}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-center">
              <div
                className="relative flex size-[220px] items-center justify-center rounded-full"
                style={{ backgroundImage: conicGradient }}
              >
                <div className="flex size-[144px] flex-col items-center justify-center rounded-full bg-white text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                  <span className="text-[11px] font-medium text-slate-500">
                    Total payment
                  </span>
                  <span className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
                    {totalItems}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {chartSegments.map((segment) => (
                <div
                  key={segment.key}
                  className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/70 px-3.5 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cn("size-3 rounded-full", segment.dotClassName)}
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {segment.label}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {Math.round((segment.value / totalItems) * 100)}% dari
                        total payment
                      </p>
                    </div>
                  </div>

                  <p className="text-lg font-bold tracking-tight text-slate-900">
                    {segment.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-3 text-xs leading-5 text-slate-500">
              Status gagal digabung ke kelompok expired/gagal supaya diagram
              tetap ringkas seperti contoh yang kamu kirim.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BranchFinanceOverviewPanel({
  summary,
  isLoading,
  error,
  onViewDetails,
}: {
  summary: FinanceOverviewSummary | null;
  isLoading: boolean;
  error: string | null;
  onViewDetails: () => void;
}) {
  const membershipPaidAmount = summary?.membership.paidAmount ?? 0;
  const membershipPaidCount = summary?.membership.paidCount ?? 0;
  const membershipPendingAmount = summary?.membership.pendingAmount ?? 0;
  const membershipPendingCount = summary?.membership.pendingCount ?? 0;
  const manualIncomeReceivedAmount = summary?.manualIncome.receivedAmount ?? 0;
  const manualIncomeReceivedCount = summary?.manualIncome.receivedCount ?? 0;
  const expenseSettledCount = summary?.expense.settledCount ?? 0;
  const expensePendingAmount = summary?.expense.pendingAmount ?? 0;
  const expensePendingCount = summary?.expense.pendingCount ?? 0;
  const totalRealizedIncome = summary?.totalRealizedIncome ?? 0;
  const totalRealizedExpense = summary?.totalRealizedExpense ?? 0;
  const operationalBalance = summary?.netCashflow ?? 0;
  const metricItems = [
    {
      label: "Total Pemasukan",
      value: formatCurrency(totalRealizedIncome),
      helper: `${membershipPaidCount + manualIncomeReceivedCount} transaksi terealisasi`,
      tone: "emerald",
    },
    {
      label: "Membership Lunas",
      value: formatCurrency(membershipPaidAmount),
      helper: `${membershipPaidCount} lunas, ${membershipPendingCount} menunggu (${formatCurrency(membershipPendingAmount)})`,
      tone: "amber",
    },
    {
      label: "Pengeluaran Operasional",
      value: formatCurrency(totalRealizedExpense),
      helper: `${expenseSettledCount} selesai, ${expensePendingCount} menunggu (${formatCurrency(expensePendingAmount)})`,
      tone: "orange",
    },
    {
      label: "Saldo Operasional",
      value: formatCurrency(operationalBalance),
      helper: `Termasuk pemasukan manual ${formatCurrency(manualIncomeReceivedAmount)}`,
      tone: "slate",
    },
  ] as const;

  return (
    <Card className="relative overflow-hidden rounded-[24px] border border-slate-200/80 bg-white/96 shadow-[0_20px_36px_-30px_rgba(15,23,42,0.16)]">
      <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
      <div className="absolute -right-12 -top-10 size-40 rounded-full bg-orange-100/45 blur-3xl" />
      <CardContent className="relative p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-2xl border border-orange-100 bg-orange-50 text-orange-600">
                <WalletCards className="size-5" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-950">
                  Ringkasan Keuangan Cabang
                </h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Satu area untuk membaca paid, pending, pengeluaran, dan saldo
                  tanpa menambah card utama dashboard.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onViewDetails}
            className="inline-flex w-fit items-center gap-1 rounded-full px-1 py-0.5 text-xs font-semibold text-orange-600 transition hover:text-orange-700"
          >
            Lihat detail pembayaran
            <ChevronRight className="size-3.5" />
          </button>
        </div>

        {error ? (
          <div className="mt-5 rounded-[20px] border border-amber-100 bg-amber-50/80 px-4 py-3 text-sm leading-6 text-amber-700">
            {error}
          </div>
        ) : null}

        {isLoading && !summary ? (
          <AdminMetricGridSkeleton className="mt-5" />
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metricItems.map((item) => (
            <div
              key={item.label}
              className={cn(
                "rounded-[20px] border px-4 py-3 shadow-[0_16px_28px_-28px_rgba(15,23,42,0.18)]",
                item.tone === "emerald"
                  ? "border-emerald-100 bg-emerald-50/70"
                  : item.tone === "amber"
                    ? "border-amber-100 bg-amber-50/70"
                    : item.tone === "orange"
                      ? "border-orange-100 bg-orange-50/70"
                      : "border-slate-200 bg-slate-50/80",
              )}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {item.label}
              </p>
              <p className="mt-2 text-xl font-bold tracking-tight text-slate-950">
                {item.value}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {item.helper}
              </p>
            </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OverviewSearchResultsSection({
  query,
  results,
  isLoading,
  error,
  onOpenTab,
}: {
  query: string;
  results: OverviewSearchResults;
  isLoading: boolean;
  error: string | null;
  onOpenTab: (tab: AdminTab) => void;
}) {
  const totalMatches =
    results.totals.students +
    results.totals.teachers +
    results.totals.schedules +
    results.totals.payments;

  return (
    <section className="rounded-[24px] border border-slate-200/80 bg-white/96 p-5 shadow-[0_20px_36px_-30px_rgba(15,23,42,0.16)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex size-10 items-center justify-center rounded-2xl border border-orange-100/80 bg-orange-50 text-orange-600">
              <Search className="size-4.5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-950">
                Hasil pencarian dashboard
              </p>
              <p className="text-xs text-slate-500">
                Menelusuri data siswa, guru, jadwal, dan transaksi.
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-600">
            Kata kunci: <span className="font-semibold text-slate-900">{query}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="bg-slate-100 text-slate-700">
            {totalMatches} hasil
          </Badge>
          {error ? (
            <Badge variant="warning">Sebagian data belum lengkap</Badge>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <div className="mt-5 grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <AdminListPanelSkeleton key={index} rows={2} />
          ))}
        </div>
      ) : totalMatches === 0 ? (
        <div className="mt-5 rounded-[20px] border border-slate-200/80 bg-slate-50/80 px-4 py-4 text-sm leading-6 text-slate-500">
          Tidak ada data admin yang cocok dengan kata kunci ini.
        </div>
      ) : (
        <div className="mt-5 grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
          <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/80 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-orange-500" />
                <p className="text-sm font-semibold text-slate-900">Siswa</p>
              </div>
              <Badge variant="secondary">{results.totals.students}</Badge>
            </div>
            <div className="mt-3 space-y-2">
              {results.students.length ? (
                results.students.map((student) => (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => onOpenTab("students")}
                    className="flex w-full flex-col rounded-2xl border border-white/80 bg-white px-3 py-2 text-left transition hover:border-orange-200 hover:bg-orange-50/70"
                  >
                    <span className="text-sm font-semibold text-slate-900">
                      {student.name}
                    </span>
                    <span className="text-xs text-slate-500">
                      {student.className} • {student.branch || "Tanpa cabang"}
                    </span>
                  </button>
                ))
              ) : (
                <p className="text-sm text-slate-500">Tidak ada siswa cocok.</p>
              )}
            </div>
          </div>

          <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/80 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <GraduationCap className="size-4 text-emerald-500" />
                <p className="text-sm font-semibold text-slate-900">Guru</p>
              </div>
              <Badge variant="secondary">{results.totals.teachers}</Badge>
            </div>
            <div className="mt-3 space-y-2">
              {results.teachers.length ? (
                results.teachers.map((teacher) => (
                  <button
                    key={teacher.id}
                    type="button"
                    onClick={() => onOpenTab("teachers")}
                    className="flex w-full flex-col rounded-2xl border border-white/80 bg-white px-3 py-2 text-left transition hover:border-orange-200 hover:bg-orange-50/70"
                  >
                    <span className="text-sm font-semibold text-slate-900">
                      {teacher.name}
                    </span>
                    <span className="text-xs text-slate-500">
                      {teacher.subject} • {teacher.branch}
                    </span>
                  </button>
                ))
              ) : (
                <p className="text-sm text-slate-500">Tidak ada guru cocok.</p>
              )}
            </div>
          </div>

          <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/80 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="size-4 text-amber-500" />
                <p className="text-sm font-semibold text-slate-900">Jadwal</p>
              </div>
              <Badge variant="secondary">{results.totals.schedules}</Badge>
            </div>
            <div className="mt-3 space-y-2">
              {results.schedules.length ? (
                results.schedules.map((schedule) => (
                  <button
                    key={schedule.id}
                    type="button"
                    onClick={() => onOpenTab("schedule")}
                    className="flex w-full flex-col rounded-2xl border border-white/80 bg-white px-3 py-2 text-left transition hover:border-orange-200 hover:bg-orange-50/70"
                  >
                    <span className="text-sm font-semibold text-slate-900">
                      {schedule.className}
                    </span>
                    <span className="text-xs text-slate-500">
                      {schedule.day}, {schedule.time} • {schedule.teacher}
                    </span>
                  </button>
                ))
              ) : (
                <p className="text-sm text-slate-500">Tidak ada jadwal cocok.</p>
              )}
            </div>
          </div>

          <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/80 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <WalletCards className="size-4 text-slate-600" />
                <p className="text-sm font-semibold text-slate-900">Payment</p>
              </div>
              <Badge variant="secondary">{results.totals.payments}</Badge>
            </div>
            <div className="mt-3 space-y-2">
              {results.payments.length ? (
                results.payments.map((payment) => (
                  <button
                    key={payment.id}
                    type="button"
                    onClick={() => onOpenTab("payments")}
                    className="flex w-full flex-col rounded-2xl border border-white/80 bg-white px-3 py-2 text-left transition hover:border-orange-200 hover:bg-orange-50/70"
                  >
                    <span className="text-sm font-semibold text-slate-900">
                      {payment.student.name}
                    </span>
                    <span className="text-xs text-slate-500">
                      {payment.paymentId} • {payment.packageName}
                    </span>
                  </button>
                ))
              ) : (
                <p className="text-sm text-slate-500">Tidak ada payment cocok.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {error ? (
        <p className="mt-4 text-xs leading-5 text-amber-700">{error}</p>
      ) : null}
    </section>
  );
}

export function AdminDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const globalSearchQuery = searchParams.get("q") || "";
  const currentAcademicYear = getCurrentAdminAcademicYear();
  
  const [, setDashboardConfig] = useState<AdminDashboardConfigData>(
    defaultAdminDashboardConfig,
  );
  const [paymentOverviewPeriod, setPaymentOverviewPeriod] =
    useState<PaymentOverviewPeriod>("year");
  const [studentSummary, setStudentSummary] = useState<AdminStudentsSummary>({
    totalItems: 0,
    activeCount: 0,
    inactiveCount: 0,
    branchCount: 0,
    classCount: 0,
  });
  const [teacherSummary, setTeacherSummary] = useState<AdminTeachersSummary>({
    totalItems: 0,
    activeCount: 0,
    inactiveCount: 0,
    branchCount: 0,
    activeClassesTotal: 0,
  });
  const [scheduleSummary, setScheduleSummary] = useState<AdminSchedulesSummary>({
    totalItems: 0,
    runningCount: 0,
    reviewCount: 0,
    conflictCount: 0,
    scheduledRoomCount: 0,
    roomConflictCount: 0,
  });
  const [paymentSummary, setPaymentSummary] =
    useState<PaymentOverviewSummary | null>(null);
  const [paymentTrend, setPaymentTrend] = useState<PaymentTrendPoint[]>([]);
  const [financeSummary, setFinanceSummary] =
    useState<FinanceOverviewSummary | null>(null);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [financeLoading, setFinanceLoading] = useState(true);
  const [financeError, setFinanceError] = useState<string | null>(null);
  const [overviewSearchResults, setOverviewSearchResults] =
    useState<OverviewSearchResults>(emptyOverviewSearchResults);
  const [isOverviewSearchLoading, setIsOverviewSearchLoading] = useState(false);
  const [overviewSearchError, setOverviewSearchError] = useState<string | null>(
    null,
  );
  const [studentSummaryLoading, setStudentSummaryLoading] = useState(true);
  const [teacherSummaryLoading, setTeacherSummaryLoading] = useState(true);
  const [scheduleSummaryLoading, setScheduleSummaryLoading] = useState(true);

  const refreshStudentSummary = useCallback(async () => {
    try {
      const result = await fetchAdminStudents({
        page: 1,
        limit: 1,
      });

      setStudentSummary(result.summary);
    } catch {
      setStudentSummary({
        totalItems: 0,
        activeCount: 0,
        inactiveCount: 0,
        branchCount: 0,
        classCount: 0,
      });
    } finally {
      setStudentSummaryLoading(false);
    }
  }, [currentAcademicYear]);

  const refreshTeacherSummary = useCallback(async () => {
    try {
      const result = await fetchAdminTeachers({
        page: 1,
        limit: 1,
      });

      setTeacherSummary(result.summary);
    } catch {
      setTeacherSummary({
        totalItems: 0,
        activeCount: 0,
        inactiveCount: 0,
        branchCount: 0,
        activeClassesTotal: 0,
      });
    } finally {
      setTeacherSummaryLoading(false);
    }
  }, []);

  const refreshScheduleSummary = useCallback(async () => {
    try {
      const result = await fetchAdminSchedules({
        page: 1,
        limit: 1,
        academicYear: currentAcademicYear,
      });

      setScheduleSummary(result.summary);
    } catch {
      setScheduleSummary({
        totalItems: 0,
        runningCount: 0,
        reviewCount: 0,
        conflictCount: 0,
        scheduledRoomCount: 0,
        roomConflictCount: 0,
      });
    } finally {
      setScheduleSummaryLoading(false);
    }
  }, [currentAcademicYear]);

  const refreshPayments = useCallback(
    async (period: PaymentOverviewPeriod = paymentOverviewPeriod) => {
      setPaymentsLoading(true);

      try {
        const range = resolvePaymentOverviewDateRange(period);
        const payload = await fetchAdminPaymentSummary({
          period,
          dateFrom: range.dateFrom,
          dateTo: range.dateTo,
        });

        setPaymentSummary(payload.summary);
        setPaymentTrend(payload.trend);
        setPaymentsError(null);
      } catch (error) {
        setPaymentSummary(null);
        setPaymentTrend([]);
        setPaymentsError(
          error instanceof Error
            ? error.message
            : "Gagal memuat ringkasan pembayaran dari server.",
        );
      } finally {
        setPaymentsLoading(false);
      }
    },
    [paymentOverviewPeriod],
  );

  const refreshFinanceSummary = useCallback(async () => {
    setFinanceLoading(true);

    try {
      const payload = await fetchAdminFinanceSummary();
      setFinanceSummary(payload.summary);
      setFinanceError(null);
    } catch (error) {
      setFinanceSummary(null);
      setFinanceError(
        error instanceof Error
          ? error.message
          : "Ringkasan keuangan cabang belum berhasil dimuat.",
      );
    } finally {
      setFinanceLoading(false);
    }
  }, []);

  const refreshOverview = useCallback(async () => {
    await Promise.allSettled([
      refreshStudentSummary(),
      refreshTeacherSummary(),
      refreshScheduleSummary(),
      refreshPayments(paymentOverviewPeriod),
      refreshFinanceSummary(),
    ]);
  }, [
    paymentOverviewPeriod,
    refreshFinanceSummary,
    refreshPayments,
    refreshScheduleSummary,
    refreshStudentSummary,
    refreshTeacherSummary,
  ]);

  useEffect(() => {
    let isCancelled = false;

    async function loadDashboardConfig() {
      try {
        const nextConfig = await fetchAdminDashboardConfig();

        if (!isCancelled) {
          setDashboardConfig(nextConfig);
        }
      } catch (error) {
        console.error("[admin-dashboard] load_config_failed", error);
      }
    }

    void loadDashboardConfig();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void Promise.allSettled([
        refreshStudentSummary(),
        refreshTeacherSummary(),
        refreshScheduleSummary(),
      ]);
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [refreshScheduleSummary, refreshStudentSummary, refreshTeacherSummary]);

  useEffect(() => {
    document.body.classList.add(adminPoppins.className);

    return () => {
      document.body.classList.remove(adminPoppins.className);
    };
  }, []);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void refreshPayments(paymentOverviewPeriod);
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [paymentOverviewPeriod, refreshPayments]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void refreshFinanceSummary();
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [refreshFinanceSummary]);

  useEffect(() => {
    const refreshOnFocus = () => {
      void refreshOverview();
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
  }, [refreshOverview]);

  useEffect(() => {
    let isCancelled = false;
    const trimmedQuery = globalSearchQuery.trim();

    if (!trimmedQuery) {
      return () => {
        isCancelled = true;
      };
    }

    const timerId = window.setTimeout(async () => {
      setIsOverviewSearchLoading(true);

      const [
        studentsResult,
        teachersResult,
        schedulesResult,
        paymentsResult,
      ] = await Promise.allSettled([
        fetchAdminStudents({
          page: 1,
          limit: 5,
          q: trimmedQuery,
          sort: "createdAt_desc",
        }),
        fetchAdminTeachers({
          page: 1,
          limit: 5,
          q: trimmedQuery,
          sort: "createdAt_desc",
        }),
        fetchAdminSchedules({
          page: 1,
          limit: 5,
          q: trimmedQuery,
          sort: "createdAt_desc",
          academicYear: currentAcademicYear,
        }),
        fetchAdminPayments({
          page: 1,
          limit: 5,
          q: trimmedQuery,
        }),
      ]);

      if (isCancelled) {
        return;
      }

      const nextResults: OverviewSearchResults = {
        students:
          studentsResult.status === "fulfilled" ? studentsResult.value.students : [],
        teachers:
          teachersResult.status === "fulfilled" ? teachersResult.value.teachers : [],
        schedules:
          schedulesResult.status === "fulfilled" ? schedulesResult.value.schedules : [],
        payments:
          paymentsResult.status === "fulfilled" ? paymentsResult.value.items : [],
        totals: {
          students:
            studentsResult.status === "fulfilled"
              ? studentsResult.value.pagination.totalItems
              : 0,
          teachers:
            teachersResult.status === "fulfilled"
              ? teachersResult.value.pagination.totalItems
              : 0,
          schedules:
            schedulesResult.status === "fulfilled"
              ? schedulesResult.value.pagination.totalItems
              : 0,
          payments:
            paymentsResult.status === "fulfilled"
              ? paymentsResult.value.pagination.totalItems
              : 0,
        },
      };

      const errorMessages = [
        studentsResult,
        teachersResult,
        schedulesResult,
        paymentsResult,
      ]
        .filter((result) => result.status === "rejected")
        .map((result) =>
          result.reason instanceof Error
            ? result.reason.message
            : "Sebagian hasil pencarian gagal dimuat.",
        );

      setOverviewSearchResults(nextResults);
      setOverviewSearchError(
        errorMessages.length
          ? `Sebagian hasil pencarian belum berhasil dimuat. ${errorMessages[0]}`
          : null,
      );
      setIsOverviewSearchLoading(false);
    }, 250);

    return () => {
      isCancelled = true;
      window.clearTimeout(timerId);
    };
  }, [currentAcademicYear, globalSearchQuery]);

  const activeStudents = studentSummary.activeCount;
  const activeTeachers = teacherSummary.activeCount;
  const ongoingSchedules = scheduleSummary.runningCount;
  const conflictSchedules = scheduleSummary.conflictCount;
  const totalRealizedIncome = financeSummary?.totalRealizedIncome ?? 0;
  const totalRealizedExpense = financeSummary?.totalRealizedExpense ?? 0;
  const operationalBalance = financeSummary?.netCashflow ?? 0;

  const studentPercentage = studentSummary.totalItems
    ? Math.round((activeStudents / studentSummary.totalItems) * 100)
    : 0;

  const teacherPercentage = teacherSummary.totalItems
    ? Math.round((activeTeachers / teacherSummary.totalItems) * 100)
    : 0;

  const schedulePercentage = scheduleSummary.totalItems
    ? Math.round((ongoingSchedules / scheduleSummary.totalItems) * 100)
    : 0;
  const financePercentage = totalRealizedIncome
    ? Math.min(
        100,
        Math.max(0, Math.round((operationalBalance / totalRealizedIncome) * 100)),
      )
    : 0;

  const dashboardStats: DashboardStatCardData[] = [
    {
      key: "students",
      title: "Total Siswa",
      value: studentSummary.totalItems.toString(),
      note: "siswa terdaftar",
      percentage: studentPercentage,
      trend: `${studentPercentage}%`,
      direction: "up",
      accent: "orange",
      icon: Users,
      isLoading: studentSummaryLoading,
    },
    {
      key: "teachers",
      title: "Guru Aktif",
      value: activeTeachers.toString(),
      note: "siap mengajar",
      percentage: teacherPercentage,
      trend: `${teacherPercentage}%`,
      direction: "up",
      accent: "emerald",
      icon: GraduationCap,
      isLoading: teacherSummaryLoading,
    },
    {
      key: "schedules",
      title: "Total Jadwal",
      value: scheduleSummary.totalItems.toString(),
      note: `${ongoingSchedules} sedang berjalan`,
      percentage: schedulePercentage,
      trend: `${conflictSchedules} bentrok`,
      direction: conflictSchedules ? "down" : "up",
      accent: "amber",
      icon: CalendarDays,
      isLoading: scheduleSummaryLoading,
    },
    {
      key: "finance",
      title: "Saldo Operasional",
      value: formatCompactCurrency(operationalBalance),
      note: financeError
        ? "Ringkasan keuangan belum termuat"
        : `Masuk ${formatCompactCurrency(totalRealizedIncome)} | Keluar ${formatCompactCurrency(totalRealizedExpense)}`,
      percentage: financePercentage,
      trend: `${operationalBalance >= 0 ? "+" : "-"}${formatCompactCurrency(Math.abs(operationalBalance))}`,
      direction: operationalBalance >= 0 ? "up" : "down",
      accent: "slate",
      icon: WalletCards,
      isLoading: financeLoading && !financeSummary,
    },
  ];
  return (
    <div className="space-y-6">
      {globalSearchQuery.trim() ? (
        <OverviewSearchResultsSection
          query={globalSearchQuery.trim()}
          results={overviewSearchResults}
          isLoading={isOverviewSearchLoading}
          error={overviewSearchError}
          onOpenTab={(tab) => {
            switch (tab) {
              case "students": router.push("/dashboard-admin/siswa"); break;
              case "teachers": router.push("/dashboard-admin/guru"); break;
              case "payments": router.push("/dashboard-admin/pembayaran"); break;
              case "schedule": router.push("/dashboard-admin/jadwal"); break;
              case "profile": router.push("/dashboard-admin/profil"); break;
              default: router.push("/dashboard-admin"); break;
            }
          }}
        />
      ) : null}

      <section className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        {dashboardStats.map(({ key, ...stat }) => (
          <DashboardStatCard key={key} {...stat} />
        ))}
      </section>

      <BranchFinanceOverviewPanel
        summary={financeSummary}
        isLoading={financeLoading}
        error={financeError}
        onViewDetails={() => {
          router.push("/dashboard-admin/pembayaran");
        }}
      />

      <section className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <PaymentDistributionCard
          summary={paymentSummary}
          trend={paymentTrend}
          isLoading={paymentsLoading}
          error={paymentsError}
          period={paymentOverviewPeriod}
          onPeriodChange={setPaymentOverviewPeriod}
        />
        <PaymentStatusDonutCard
          summary={paymentSummary}
          isLoading={paymentsLoading}
          error={paymentsError}
          onViewDetails={() => {
            router.push("/dashboard-admin/pembayaran");
          }}
        />
      </section>
    </div>
  );
}
