/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import {
  Building2,
  Clock3,
  GraduationCap,
  ReceiptText,
  ShieldCheck,
  Users,
  WalletCards,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { subscribeOwnerDashboardRefresh } from "@/components/dashboard-owner/dashboard-refresh-events";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { requestAdminApi } from "@/lib/admin-api";
import { getCurrentAdminAcademicYear } from "@/lib/admin-academic-year";
import { fetchOwnerActivities } from "@/lib/owner-activities";

type DirectoryItem = {
  status?: string | null;
};

type OwnerOverviewMetrics = {
  totalStudents: number;
  totalTeachers: number;
  totalBranches: number;
  activeMemberships: number;
  paymentsThisMonth: number;
  expensesThisMonth: number | null;
};

const pollingIntervalMs = 30_000;

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function isCurrentMonth(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  const today = new Date();

  return (
    !Number.isNaN(date.getTime()) &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

function formatSyncedAt(value: Date | null) {
  if (!value) {
    return "Menunggu sinkronisasi";
  }

  return `Diperbarui ${new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(value)}`;
}

export function OwnerDashboardOverviewSection() {
  const currentAcademicYear = getCurrentAdminAcademicYear();
  const [metrics, setMetrics] = useState<OwnerOverviewMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);

  const loadMetrics = useCallback(async () => {
    const [studentsResult, teachersResult, branchesResult, activitiesResult] =
      await Promise.allSettled([
        requestAdminApi<{ students: DirectoryItem[] }>(
          `/api/students?academicYear=${encodeURIComponent(currentAcademicYear)}`,
          {
            method: "GET",
          },
        ),
        requestAdminApi<{ teachers: DirectoryItem[] }>("/api/teachers", {
          method: "GET",
        }),
        requestAdminApi<{ branches: DirectoryItem[] }>("/api/branches", {
          method: "GET",
        }),
        fetchOwnerActivities(),
      ]);

    const failedSources: string[] = [];
    const students =
      studentsResult.status === "fulfilled"
        ? (studentsResult.value.data?.students ?? [])
        : [];
    const teachers =
      teachersResult.status === "fulfilled"
        ? (teachersResult.value.data?.teachers ?? [])
        : [];
    const branches =
      branchesResult.status === "fulfilled"
        ? (branchesResult.value.data?.branches ?? [])
        : [];

    if (studentsResult.status === "rejected") failedSources.push("siswa");
    if (teachersResult.status === "rejected") failedSources.push("guru");
    if (branchesResult.status === "rejected") failedSources.push("cabang");
    if (activitiesResult.status === "rejected") failedSources.push("pembayaran");

    const activities =
      activitiesResult.status === "fulfilled" ? activitiesResult.value : null;
    const paymentsThisMonth =
      activities?.incomingPayments
        .filter(
          (payment) =>
            payment.status === "paid" &&
            isCurrentMonth(payment.paidAt ?? payment.createdAt),
        )
        .reduce((total, payment) => total + payment.amount, 0) ?? 0;
    const expensesThisMonth = activities?.outgoingPaymentsAvailable
      ? activities.outgoingPayments
          .filter(
            (expense) =>
              expense.status === "Selesai" &&
              isCurrentMonth(expense.disbursedAt ?? expense.createdAt),
          )
          .reduce((total, expense) => total + expense.amount, 0)
      : null;

    setMetrics({
      totalStudents: students.length,
      totalTeachers: teachers.length,
      totalBranches: branches.length,
      activeMemberships:
        activities?.activationStudents.filter(
          (student) => student.activationStatus === "Aktif",
        ).length ?? 0,
      paymentsThisMonth,
      expensesThisMonth,
    });
    setErrorMessage(
      failedSources.length > 0
        ? `Sebagian data belum dapat dimuat: ${failedSources.join(", ")}.`
        : null,
    );
    setSyncedAt(new Date());
    setIsLoading(false);
  }, [currentAcademicYear]);

  useEffect(() => {
    void loadMetrics();
    const unsubscribe = subscribeOwnerDashboardRefresh(() => {
      void loadMetrics();
    });
    const intervalId = window.setInterval(() => {
      void loadMetrics();
    }, pollingIntervalMs);

    return () => {
      unsubscribe();
      window.clearInterval(intervalId);
    };
  }, [loadMetrics]);

  const cards = useMemo(
    () => [
      {
        title: "Total Siswa",
        value: metrics ? formatNumber(metrics.totalStudents) : "-",
        description: "Seluruh siswa Bimbel yang terdaftar di sistem.",
        icon: Users,
        tone: "border-orange-100 bg-orange-50 text-orange-700",
      },
      {
        title: "Total Guru",
        value: metrics ? formatNumber(metrics.totalTeachers) : "-",
        description: "Seluruh guru yang tergabung di Bina Cendekia.",
        icon: GraduationCap,
        tone: "border-red-100 bg-red-50 text-red-700",
      },
      {
        title: "Total Cabang",
        value: metrics ? formatNumber(metrics.totalBranches) : "-",
        description: "Cabang aktif, persiapan, dan nonaktif.",
        icon: Building2,
        tone: "border-amber-100 bg-amber-50 text-amber-700",
      },
      {
        title: "Membership Aktif",
        value: metrics ? formatNumber(metrics.activeMemberships) : "-",
        description: "Aktivasi membership siswa berstatus aktif.",
        icon: ShieldCheck,
        tone: "border-orange-100 bg-orange-50 text-orange-700",
      },
      {
        title: "Pembayaran Bulan Ini",
        value: metrics ? formatCurrency(metrics.paymentsThisMonth) : "-",
        description: "Pembayaran lunas pada bulan berjalan.",
        icon: WalletCards,
        tone: "border-amber-100 bg-amber-50 text-amber-700",
      },
      {
        title: "Pengeluaran Bulan Ini",
        value:
          metrics?.expensesThisMonth === null
            ? "Belum tersedia"
            : metrics
              ? formatCurrency(metrics.expensesThisMonth)
              : "-",
        description:
          metrics?.expensesThisMonth === null
            ? "Data pengeluaran operasional belum tersedia."
            : "Pengeluaran selesai pada bulan berjalan.",
        icon: ReceiptText,
        tone: "border-red-100 bg-red-50 text-red-700",
      },
    ],
    [metrics],
  );

  const isEmpty =
    metrics !== null &&
    metrics.totalStudents === 0 &&
    metrics.totalTeachers === 0 &&
    metrics.totalBranches === 0 &&
    metrics.activeMemberships === 0 &&
    metrics.paymentsThisMonth === 0 &&
    (metrics.expensesThisMonth === null || metrics.expensesThisMonth === 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-orange-600">
            Owner Workspace
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Ringkasan operasional dan performa seluruh cabang Bina Cendekia.
          </p>
        </div>
        <Badge
          variant="secondary"
          className="w-fit rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
        >
          <Clock3 className="size-3.5" />
          {formatSyncedAt(syncedAt)}
        </Badge>
      </div>

      {errorMessage ? (
        <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {isLoading
          ? Array.from({ length: 6 }).map((_, index) => (
              <Card
                key={index}
                className="rounded-2xl border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <CardHeader className="flex-row items-start justify-between gap-4 p-5 pb-3">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-8 w-32" />
                  </div>
                  <Skeleton className="size-10 rounded-lg" />
                </CardHeader>
                <CardContent className="px-5 pb-5">
                  <Skeleton className="h-4 w-48" />
                </CardContent>
              </Card>
            ))
          : cards.map((card) => {
              const Icon = card.icon;

              return (
                <Card
                  key={card.title}
                  className="rounded-2xl border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                >
                  <CardHeader className="flex-row items-start justify-between gap-4 p-5 pb-3">
                    <div className="min-w-0">
                      <CardDescription className="font-medium text-slate-500 dark:text-slate-400">
                        {card.title}
                      </CardDescription>
                      <CardTitle className="mt-2 break-words text-2xl text-slate-950 dark:text-white">
                        {card.value}
                      </CardTitle>
                    </div>
                    <div
                      className={`flex size-10 shrink-0 items-center justify-center rounded-lg border ${card.tone}`}
                    >
                      <Icon className="size-5" />
                    </div>
                  </CardHeader>
                  <CardContent className="px-5 pb-5">
                    <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                      {card.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
      </div>

      {!isLoading && isEmpty && !errorMessage ? (
        <EmptyState
          icon={Building2}
          title="Belum ada data operasional"
          description="Belum ada data operasional yang tercatat di sistem."
        />
      ) : null}
    </div>
  );
}
