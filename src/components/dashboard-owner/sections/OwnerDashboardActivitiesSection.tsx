"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";
import { TrendingDown, TrendingUp, MapPin, CalendarDays } from "lucide-react";

import { OwnerActivityDetailDialog } from "@/components/dashboard-owner/sections/activities/OwnerActivityDetailDialog";
import { OwnerIncomingPaymentsTable } from "@/components/dashboard-owner/sections/activities/OwnerIncomingPaymentsTable";
import { OwnerOutgoingPaymentsTable } from "@/components/dashboard-owner/sections/activities/OwnerOutgoingPaymentsTable";
import { OwnerStudentActivationsTable } from "@/components/dashboard-owner/sections/activities/OwnerStudentActivationsTable";
import type {
  BranchFilter,
  IncomingPaymentPeriodFilter,
  IncomingPaymentStatusFilter,
  MembershipActivationFilter,
  OwnerIncomingPaymentRecord,
  OwnerOutgoingPaymentRecord,
  OwnerStudentActivationRecord,
  OutgoingPaymentStatusFilter,
  PaymentTab,
  StudentClassFilter,
  StudentLevelFilter,
} from "@/components/dashboard-owner/sections/activities/owner-activity-types";
import {
  allBranchFilter,
  allClassOptions,
  classOptionsByLevel,
  combinedIncomingPaymentStatusFilter,
  createExportFileName,
  escapeCsvCell,
  branchesMatch,
  getBranchFilterOptions,
  getIncomingPaymentActivityDate,
  inactiveActivationStatusFilter,
  isDateInIncomingPaymentPeriod,
  mapRouteActivationStatusToFilter,
  mapRouteIncomingStatusToFilter,
  mapRouteOutgoingStatusToFilter,
  triggerDownload,
} from "@/components/dashboard-owner/sections/activities/owner-activity-utils";
import { subscribeOwnerDashboardRefresh } from "@/components/dashboard-owner/dashboard-refresh-events";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatRupiah } from "@/lib/subscription";
import {
  defaultOwnerActivitiesRouteState,
  type OwnerActivitiesRouteState,
} from "@/lib/owner-dashboard-routing";
import {
  fetchOwnerActivities,
  fetchOwnerActivityBranchOptions,
} from "@/lib/owner-activities";

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const currentYear = new Date().getFullYear().toString();
const YEARS = ["2026", "2027"];
const defaultSummaryYear = YEARS.includes(currentYear) ? currentYear : YEARS[0];

type OwnerDashboardActivitiesSectionProps = {
  initialRouteState?: OwnerActivitiesRouteState;
};

function matchesOutgoingStatusFilter(
  status: OwnerOutgoingPaymentRecord["status"],
  filter: OutgoingPaymentStatusFilter,
) {
  if (filter === "Semua") {
    return true;
  }

  if (filter === "Menunggu") {
    return status === "Menunggu" || status === "Dijadwalkan";
  }

  return status === filter;
}

export function OwnerDashboardActivitiesSection({
  initialRouteState = defaultOwnerActivitiesRouteState,
}: OwnerDashboardActivitiesSectionProps) {
  const initialTab: PaymentTab =
    initialRouteState.tab === "aktivasi"
      ? "aktivasi"
      : initialRouteState.tab === "keluar"
        ? "keluar"
        : "masuk";
  const routeIncomingStatusFilter = mapRouteIncomingStatusToFilter(
    initialRouteState.incomingStatus,
  );
  const routeOutgoingStatusFilter = mapRouteOutgoingStatusToFilter(
    initialRouteState.outgoingStatus,
  );
  const routeActivationStatusFilter = mapRouteActivationStatusToFilter(
    initialRouteState.activationStatus,
  );
  const [activeTab, setActiveTab] = useState<PaymentTab>(initialTab);
  const [summaryBranchFilter, setSummaryBranchFilter] = useState<string>("Semua Cabang");
  const [summaryMonthFilter, setSummaryMonthFilter] = useState<string>("Semua Bulan");
  const [summaryYearFilter, setSummaryYearFilter] = useState<string>(defaultSummaryYear);

  const [incomingSearchQuery, setIncomingSearchQuery] = useState("");
  const [incomingBranchFilter, setIncomingBranchFilter] =
    useState<BranchFilter>(allBranchFilter);
  const [incomingStatusFilter, setIncomingStatusFilter] =
    useState<IncomingPaymentStatusFilter>(routeIncomingStatusFilter);
  const [incomingPeriodFilter, setIncomingPeriodFilter] =
    useState<IncomingPaymentPeriodFilter>("Semua Periode");

  const [outgoingSearchQuery, setOutgoingSearchQuery] = useState("");
  const [outgoingBranchFilter, setOutgoingBranchFilter] =
    useState<BranchFilter>(allBranchFilter);
  const [outgoingStatusFilter, setOutgoingStatusFilter] =
    useState<OutgoingPaymentStatusFilter>(routeOutgoingStatusFilter);

  const [activationSearchQuery, setActivationSearchQuery] = useState("");
  const [activationBranchFilter, setActivationBranchFilter] =
    useState<BranchFilter>(allBranchFilter);
  const [activationStatusFilter, setActivationStatusFilter] =
    useState<MembershipActivationFilter>(routeActivationStatusFilter);
  const [levelFilter, setLevelFilter] = useState<StudentLevelFilter>("Semua");
  const [classFilter, setClassFilter] = useState<StudentClassFilter>("Semua");

  const [selectedIncomingPaymentId, setSelectedIncomingPaymentId] = useState<
    string | null
  >(null);
  const [selectedOutgoingPaymentId, setSelectedOutgoingPaymentId] = useState<
    string | null
  >(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const [incomingPayments, setIncomingPayments] = useState<OwnerIncomingPaymentRecord[]>(
    [],
  );
  const [outgoingPayments, setOutgoingPayments] = useState<OwnerOutgoingPaymentRecord[]>(
    [],
  );
  const [activationStudents, setActivationStudents] = useState<
    OwnerStudentActivationRecord[]
  >([]);
  const [branchDirectoryOptions, setBranchDirectoryOptions] = useState<string[]>([]);
  const [outgoingPaymentsAvailable, setOutgoingPaymentsAvailable] = useState(false);
  const [studentBranchAvailable, setStudentBranchAvailable] = useState(false);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);
  const [activitiesError, setActivitiesError] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
    setIncomingSearchQuery("");
    setIncomingBranchFilter(allBranchFilter);
    setIncomingStatusFilter(routeIncomingStatusFilter);
    setIncomingPeriodFilter("Semua Periode");
    setOutgoingSearchQuery("");
    setOutgoingBranchFilter(allBranchFilter);
    setOutgoingStatusFilter(routeOutgoingStatusFilter);
    setActivationSearchQuery("");
    setActivationBranchFilter(allBranchFilter);
    setActivationStatusFilter(routeActivationStatusFilter);
    setLevelFilter("Semua");
    setClassFilter("Semua");
    setSelectedIncomingPaymentId(null);
    setSelectedOutgoingPaymentId(null);
    setSelectedStudentId(null);
  }, [
    initialTab,
    routeActivationStatusFilter,
    routeIncomingStatusFilter,
    routeOutgoingStatusFilter,
  ]);

  useEffect(() => {
    let isCancelled = false;

    async function loadBranchOptions() {
      try {
        const branches = await fetchOwnerActivityBranchOptions();

        if (!isCancelled) {
          setBranchDirectoryOptions(branches);
        }
      } catch {
        if (!isCancelled) {
          setBranchDirectoryOptions([]);
        }
      }
    }

    void loadBranchOptions();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function loadOwnerActivities() {
      setIsLoadingActivities(true);
      setActivitiesError(null);

      try {
        const data = await fetchOwnerActivities();

        if (isCancelled) {
          return;
        }

        setIncomingPayments(data.incomingPayments);
        setOutgoingPayments(data.outgoingPayments);
        setActivationStudents(data.activationStudents);
        setOutgoingPaymentsAvailable(data.outgoingPaymentsAvailable);
        setStudentBranchAvailable(data.studentBranchAvailable);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setIncomingPayments([]);
        setOutgoingPayments([]);
        setActivationStudents([]);
        setOutgoingPaymentsAvailable(false);
        setStudentBranchAvailable(false);
        setActivitiesError(
          error instanceof Error
            ? error.message
            : "Gagal memuat log aktivitas. Silakan coba lagi.",
        );
      } finally {
        if (!isCancelled) {
          setIsLoadingActivities(false);
        }
      }
    }

    void loadOwnerActivities();
    const unsubscribe = subscribeOwnerDashboardRefresh(() => {
      void loadOwnerActivities();
    });

    return () => {
      isCancelled = true;
      unsubscribe();
    };
  }, []);

  const incomingBranchOptions = useMemo(
    () => getBranchFilterOptions(incomingPayments, branchDirectoryOptions),
    [branchDirectoryOptions, incomingPayments],
  );
  const activationBranchOptions = useMemo(
    () => getBranchFilterOptions(activationStudents, branchDirectoryOptions),
    [activationStudents, branchDirectoryOptions],
  );
  const outgoingBranchOptions = useMemo(
    () => getBranchFilterOptions(outgoingPayments, branchDirectoryOptions),
    [branchDirectoryOptions, outgoingPayments],
  );

  const classFilterOptions = useMemo(() => {
    if (levelFilter === "Semua") {
      return allClassOptions;
    }

    return classOptionsByLevel[levelFilter];
  }, [levelFilter]);

  const filteredIncomingPayments = useMemo(() => {
    const query = incomingSearchQuery.trim().toLowerCase();

    return incomingPayments.filter((item) => {
      const matchesQuery = query
        ? item.studentName.toLowerCase().includes(query) ||
          item.branch.toLowerCase().includes(query) ||
          item.packageName.toLowerCase().includes(query) ||
          item.method.toLowerCase().includes(query) ||
          (item.paymentId ?? "").toLowerCase().includes(query)
        : true;
      const matchesBranch = branchesMatch(item.branch, incomingBranchFilter);
      const matchesStatus =
        incomingStatusFilter === "Semua"
          ? true
          : incomingStatusFilter === combinedIncomingPaymentStatusFilter
            ? item.status === "failed" || item.status === "expired"
            : item.status === incomingStatusFilter;
      const activityDate = getIncomingPaymentActivityDate(item);
      const matchesPeriod = isDateInIncomingPaymentPeriod(
        activityDate,
        incomingPeriodFilter,
      );

      return (
        matchesQuery &&
        matchesBranch &&
        matchesStatus &&
        matchesPeriod
      );
    });
  }, [
    incomingBranchFilter,
    incomingPeriodFilter,
    incomingPayments,
    incomingSearchQuery,
    incomingStatusFilter,
  ]);

  const filteredStudents = useMemo(() => {
    const query = activationSearchQuery.trim().toLowerCase();

    return activationStudents.filter((item) => {
      const matchesQuery = query
        ? item.studentName.toLowerCase().includes(query) ||
          item.branch.toLowerCase().includes(query) ||
          item.membershipPackage.toLowerCase().includes(query) ||
          item.jenjang.toLowerCase().includes(query) ||
          item.kelas.toLowerCase().includes(query)
        : true;
      const matchesBranch = branchesMatch(item.branch, activationBranchFilter);
      const matchesStatus =
        activationStatusFilter === "Semua"
          ? true
          : activationStatusFilter === inactiveActivationStatusFilter
            ? item.activationStatus !== "Aktif"
            : item.activationStatus === activationStatusFilter;
      const matchesLevel = levelFilter === "Semua" ? true : item.jenjang === levelFilter;
      const matchesClass = classFilter === "Semua" ? true : item.kelas === classFilter;

      return (
        matchesQuery &&
        matchesBranch &&
        matchesStatus &&
        matchesLevel &&
        matchesClass
      );
    });
  }, [
    activationBranchFilter,
    activationStudents,
    activationSearchQuery,
    activationStatusFilter,
    classFilter,
    levelFilter,
  ]);

  const filteredOutgoingPayments = useMemo(() => {
    const query = outgoingSearchQuery.trim().toLowerCase();

    return outgoingPayments.filter((item) => {
      const matchesQuery = query
        ? item.title.toLowerCase().includes(query) ||
          item.branch.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query) ||
          item.referenceId.toLowerCase().includes(query)
        : true;
      const matchesBranch = branchesMatch(item.branch, outgoingBranchFilter);
      const matchesStatus = matchesOutgoingStatusFilter(
        item.status,
        outgoingStatusFilter,
      );

      return matchesQuery && matchesBranch && matchesStatus;
    });
  }, [
    outgoingBranchFilter,
    outgoingPayments,
    outgoingSearchQuery,
    outgoingStatusFilter,
  ]);

  const selectedIncomingPayment = useMemo(
    () =>
      selectedIncomingPaymentId
        ? incomingPayments.find((item) => item.id === selectedIncomingPaymentId) ?? null
        : null,
    [incomingPayments, selectedIncomingPaymentId],
  );

  const selectedOutgoingPayment = useMemo(
    () =>
      selectedOutgoingPaymentId
        ? outgoingPayments.find((item) => item.id === selectedOutgoingPaymentId) ?? null
        : null,
    [outgoingPayments, selectedOutgoingPaymentId],
  );

  const selectedStudent = useMemo(
    () =>
      selectedStudentId
        ? activationStudents.find((item) => item.id === selectedStudentId) ?? null
        : null,
    [activationStudents, selectedStudentId],
  );

  const hasIncomingFilters =
    incomingSearchQuery.trim().length > 0 ||
    incomingBranchFilter !== allBranchFilter ||
    incomingStatusFilter !== "paid" ||
    incomingPeriodFilter !== "Semua Periode";

  const hasActivationFilters =
    activationSearchQuery.trim().length > 0 ||
    activationBranchFilter !== allBranchFilter ||
    activationStatusFilter !== "Semua" ||
    levelFilter !== "Semua" ||
    classFilter !== "Semua";

  const hasOutgoingFilters =
    outgoingSearchQuery.trim().length > 0 ||
    outgoingBranchFilter !== allBranchFilter ||
    outgoingStatusFilter !== "Semua";

  function handleLevelFilterChange(value: string) {
    setLevelFilter(value as StudentLevelFilter);
    setClassFilter("Semua");
  }

  function resetIncomingFilters() {
    setIncomingSearchQuery("");
    setIncomingBranchFilter(allBranchFilter);
    setIncomingStatusFilter("paid");
    setIncomingPeriodFilter("Semua Periode");
  }

  function resetActivationFilters() {
    setActivationSearchQuery("");
    setActivationBranchFilter(allBranchFilter);
    setActivationStatusFilter("Semua");
    setLevelFilter("Semua");
    setClassFilter("Semua");
  }

  function resetOutgoingFilters() {
    setOutgoingSearchQuery("");
    setOutgoingBranchFilter(allBranchFilter);
    setOutgoingStatusFilter("Semua");
  }

  function exportIncomingPayments(format: "csv" | "json") {
    if (filteredIncomingPayments.length === 0) {
      return;
    }

    const exportRows = filteredIncomingPayments.map((payment) => ({
      namaSiswa: payment.studentName,
      cabang: payment.branch,
      paket: payment.packageName,
      jumlah: payment.amount,
      status: payment.status,
      tanggalBayar: payment.paidAt ?? "",
      expiredAt: payment.expiresAt ?? "",
      subscriptionCode: payment.subscriptionCode ?? "",
    }));

    if (format === "json") {
      triggerDownload(
        createExportFileName("pembayaran-masuk", "json"),
        JSON.stringify(exportRows, null, 2),
        "application/json;charset=utf-8",
      );
      return;
    }

    const csvContent = [
      "nama siswa,cabang,paket,jumlah,status,tanggal bayar,expired at,kode layanan",
      ...exportRows.map((payment) =>
        [
          escapeCsvCell(payment.namaSiswa),
          escapeCsvCell(payment.cabang),
          escapeCsvCell(payment.paket),
          escapeCsvCell(String(payment.jumlah)),
          escapeCsvCell(payment.status),
          escapeCsvCell(payment.tanggalBayar),
          escapeCsvCell(payment.expiredAt),
          escapeCsvCell(payment.subscriptionCode),
        ].join(","),
      ),
    ].join("\n");

    triggerDownload(
      createExportFileName("pembayaran-masuk", "csv"),
      csvContent,
      "text/csv;charset=utf-8",
    );
  }

  function exportOutgoingPayments(format: "csv" | "json") {
    if (filteredOutgoingPayments.length === 0) {
      return;
    }

    const exportRows = filteredOutgoingPayments.map((payment) => ({
      judul: payment.title,
      referenceId: payment.referenceId,
      cabang: payment.branch,
      kategori: payment.category,
      jumlah: payment.amount,
      status: payment.status,
      tanggalDicatatDibayar: payment.disbursedAt ?? "",
      catatan: payment.note,
    }));

    if (format === "json") {
      triggerDownload(
        createExportFileName("pengeluaran-cabang", "json"),
        JSON.stringify(exportRows, null, 2),
        "application/json;charset=utf-8",
      );
      return;
    }

    const csvContent = [
      "judul,reference id,cabang,kategori,jumlah,status,tanggal dicatat dibayar,catatan",
      ...exportRows.map((payment) =>
        [
          escapeCsvCell(payment.judul),
          escapeCsvCell(payment.referenceId),
          escapeCsvCell(payment.cabang),
          escapeCsvCell(payment.kategori),
          escapeCsvCell(String(payment.jumlah)),
          escapeCsvCell(payment.status),
          escapeCsvCell(payment.tanggalDicatatDibayar),
          escapeCsvCell(payment.catatan),
        ].join(","),
      ),
    ].join("\n");

    triggerDownload(
      createExportFileName("pengeluaran-cabang", "csv"),
      csvContent,
      "text/csv;charset=utf-8",
    );
  }

  function exportActivationStudents(format: "csv" | "json") {
    if (filteredStudents.length === 0) {
      return;
    }

    const exportRows = filteredStudents.map((student) => ({
      namaSiswa: student.studentName,
      cabang: student.branch,
      jenjang: student.jenjang,
      kelas: student.classLabel,
      paketMembership: student.membershipPackage,
      pembayaran: student.paymentStatus,
      statusAktivasi: student.activationStatus,
      tanggalDaftar: student.registeredAt,
      activeUntil: student.activeUntil ?? "",
      subscriptionCode: student.subscriptionCode,
    }));

    if (format === "json") {
      triggerDownload(
        createExportFileName("aktivasi-siswa", "json"),
        JSON.stringify(exportRows, null, 2),
        "application/json;charset=utf-8",
      );
      return;
    }

    const csvContent = [
      "nama siswa,cabang,jenjang,kelas,paket membership,status pembayaran,status aktivasi,tanggal daftar,active until,kode layanan",
      ...exportRows.map((student) =>
        [
          escapeCsvCell(student.namaSiswa),
          escapeCsvCell(student.cabang),
          escapeCsvCell(student.jenjang),
          escapeCsvCell(student.kelas),
          escapeCsvCell(student.paketMembership),
          escapeCsvCell(student.pembayaran),
          escapeCsvCell(student.statusAktivasi),
          escapeCsvCell(student.tanggalDaftar),
          escapeCsvCell(student.activeUntil),
          escapeCsvCell(student.subscriptionCode),
        ].join(","),
      ),
    ].join("\n");

    triggerDownload(
      createExportFileName("aktivasi-siswa", "csv"),
      csvContent,
      "text/csv;charset=utf-8",
    );
  }

  const incomingPanelNote = studentBranchAvailable
    ? "Owner hanya memantau. Tidak ada aksi edit atau hapus di halaman ini."
    : "Owner hanya memiliki akses pantau. Kolom cabang untuk siswa saat ini belum diatur.";

  const outgoingPanelNote = outgoingPaymentsAvailable
    ? "Owner hanya memantau pengeluaran. Tidak ada aksi edit atau hapus di halaman ini."
    : "Data pengeluaran belum tersedia.";

  const activationPanelNote = studentBranchAvailable
    ? "Status aktivasi mengikuti hasil pembayaran otomatis."
    : "Status aktivasi mengikuti hasil pembayaran otomatis. Kolom cabang saat ini belum diatur.";

  const incomingEmptyDescription = isLoadingActivities
    ? "Sedang memuat data pembayaran masuk..."
    : activitiesError
      ? activitiesError
      : hasIncomingFilters
        ? "Ubah pencarian atau filter agar data kembali tampil."
        : "Belum ada data pembayaran masuk.";

  const activationEmptyDescription = isLoadingActivities
    ? "Sedang memuat data aktivasi siswa..."
    : activitiesError
      ? activitiesError
      : hasActivationFilters
        ? "Ubah pencarian atau filter agar data kembali tampil."
        : "Belum ada data aktivasi siswa.";

  const outgoingEmptyDescription = isLoadingActivities
    ? "Sedang memuat data pengeluaran..."
    : activitiesError
      ? activitiesError
      : hasOutgoingFilters
        ? "Ubah pencarian atau filter agar data pengeluaran kembali tampil."
        : "Belum ada data pengeluaran.";

  const totalPemasukan = useMemo(() => {
    return incomingPayments
      .filter((payment) => {
        if (payment.status !== "paid") return false;
        if (summaryBranchFilter !== "Semua Cabang" && payment.branch !== summaryBranchFilter) return false;

        const dateStr = payment.paidAt ?? payment.createdAt;
        if (!dateStr) return false;
        const d = new Date(dateStr);
        if (Number.isNaN(d.getTime())) return false;

        if (d.getFullYear().toString() !== summaryYearFilter) return false;
        if (summaryMonthFilter !== "Semua Bulan" && MONTHS[d.getMonth()] !== summaryMonthFilter) return false;

        return true;
      })
      .reduce((sum, payment) => sum + payment.amount, 0);
  }, [incomingPayments, summaryBranchFilter, summaryMonthFilter, summaryYearFilter]);

  const totalPengeluaran = useMemo(() => {
    return outgoingPayments
      .filter((payment) => {
        if (payment.status !== "Selesai") return false;
        if (summaryBranchFilter !== "Semua Cabang" && payment.branch !== summaryBranchFilter) return false;

        const dateStr = payment.disbursedAt ?? payment.createdAt;
        if (!dateStr) return false;
        const d = new Date(dateStr);
        if (Number.isNaN(d.getTime())) return false;

        if (d.getFullYear().toString() !== summaryYearFilter) return false;
        if (summaryMonthFilter !== "Semua Bulan" && MONTHS[d.getMonth()] !== summaryMonthFilter) return false;

        return true;
      })
      .reduce((sum, payment) => sum + payment.amount, 0);
  }, [outgoingPayments, summaryBranchFilter, summaryMonthFilter, summaryYearFilter]);

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-slate-200/80 bg-white px-6 py-6 shadow-[0_16px_32px_-26px_rgba(15,23,42,0.12)]">
        <div className="mb-6 flex flex-col gap-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                  Informasi Pembayaran
                </h2>
                <Badge
                  variant="secondary"
                  className="w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-600"
                >
                  View only
                </Badge>
              </div>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                Pantau pembayaran masuk, pengeluaran operasional, dan aktivasi
                membership dalam satu tampilan ringkas.
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap xl:w-auto xl:shrink-0 xl:items-center">
              <Select value={summaryMonthFilter} onValueChange={setSummaryMonthFilter}>
                <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-slate-50/50 sm:w-[140px]">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <CalendarDays className="size-4 text-slate-400" />
                    <SelectValue placeholder="Bulan" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Semua Bulan">Semua Bulan</SelectItem>
                  {MONTHS.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={summaryYearFilter} onValueChange={setSummaryYearFilter}>
                <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-slate-50/50 sm:w-[120px]">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <CalendarDays className="size-4 text-slate-400" />
                    <SelectValue placeholder="Tahun" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={summaryBranchFilter} onValueChange={setSummaryBranchFilter}>
                <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-slate-50/50 sm:w-[180px]">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <MapPin className="size-4 text-slate-400" />
                    <SelectValue placeholder="Pilih Cabang" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Semua Cabang">Semua Cabang</SelectItem>
                  {branchDirectoryOptions.map((branch) => (
                    <SelectItem key={branch} value={branch}>
                      {branch}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-4 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/50 to-white p-5 shadow-sm">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <TrendingUp className="size-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-600/80">Total Pemasukan</p>
              <p className="mt-1 text-2xl font-black text-slate-800">{formatRupiah(totalPemasukan)}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50/50 to-white p-5 shadow-sm">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <TrendingDown className="size-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-rose-600/80">Total Pengeluaran</p>
              <p className="mt-1 text-2xl font-black text-slate-800">{formatRupiah(totalPengeluaran)}</p>
            </div>
          </div>
        </div>
      </section>

      {activitiesError ? (
        <section className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">
          Data aktivitas belum bisa dimuat penuh. Halaman tetap
          menampilkan state kosong yang jujur tanpa data dummy.
        </section>
      ) : null}

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as PaymentTab)}>
        <div className="rounded-[28px] border border-slate-200/80 bg-white p-2 shadow-[0_12px_24px_-22px_rgba(15,23,42,0.12)]">
          <TabsList className="grid w-full grid-cols-1 rounded-[20px] bg-slate-100/80 p-1 sm:grid-cols-3">
            <TabsTrigger
              value="masuk"
              className="rounded-2xl px-5 py-3 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-sm"
            >
              Pembayaran Masuk
            </TabsTrigger>
            <TabsTrigger
              value="keluar"
              className="rounded-2xl px-5 py-3 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-sm"
            >
              Pengeluaran
            </TabsTrigger>
            <TabsTrigger
              value="aktivasi"
              className="rounded-2xl px-5 py-3 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-sm"
            >
              Aktivasi Membership
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="masuk" className="space-y-4">
          <OwnerIncomingPaymentsTable
            branchFilter={incomingBranchFilter}
            branchOptions={incomingBranchOptions}
            emptyDescription={incomingEmptyDescription}
            hasActiveFilters={hasIncomingFilters}
            isLoading={isLoadingActivities}
            panelNote={incomingPanelNote}
            payments={filteredIncomingPayments}
            searchQuery={incomingSearchQuery}
            statusFilter={incomingStatusFilter}
            periodFilter={incomingPeriodFilter}
            onBranchFilterChange={setIncomingBranchFilter}
            onExport={exportIncomingPayments}
            onOpenDetail={setSelectedIncomingPaymentId}
            onPeriodFilterChange={setIncomingPeriodFilter}
            onResetFilters={resetIncomingFilters}
            onSearchQueryChange={setIncomingSearchQuery}
            onStatusFilterChange={setIncomingStatusFilter}
          />
        </TabsContent>

        <TabsContent value="keluar" className="space-y-4">
          <OwnerOutgoingPaymentsTable
            branchFilter={outgoingBranchFilter}
            branchOptions={outgoingBranchOptions}
            emptyDescription={outgoingEmptyDescription}
            hasActiveFilters={hasOutgoingFilters}
            outgoingPaymentsAvailable={outgoingPaymentsAvailable}
            isLoading={isLoadingActivities}
            panelNote={outgoingPanelNote}
            payments={filteredOutgoingPayments}
            searchQuery={outgoingSearchQuery}
            statusFilter={outgoingStatusFilter}
            onBranchFilterChange={setOutgoingBranchFilter}
            onExport={exportOutgoingPayments}
            onOpenDetail={setSelectedOutgoingPaymentId}
            onResetFilters={resetOutgoingFilters}
            onSearchQueryChange={setOutgoingSearchQuery}
            onStatusFilterChange={setOutgoingStatusFilter}
          />
        </TabsContent>

        <TabsContent value="aktivasi" className="space-y-4">
          <OwnerStudentActivationsTable
            activationBranchFilter={activationBranchFilter}
            activationBranchOptions={activationBranchOptions}
            activationStatusFilter={activationStatusFilter}
            classFilter={classFilter}
            classFilterOptions={classFilterOptions}
            emptyDescription={activationEmptyDescription}
            hasActiveFilters={hasActivationFilters}
            isLoading={isLoadingActivities}
            levelFilter={levelFilter}
            panelNote={activationPanelNote}
            searchQuery={activationSearchQuery}
            students={filteredStudents}
            onActivationBranchFilterChange={setActivationBranchFilter}
            onActivationStatusFilterChange={setActivationStatusFilter}
            onClassFilterChange={setClassFilter}
            onExport={exportActivationStudents}
            onLevelFilterChange={handleLevelFilterChange}
            onOpenDetail={setSelectedStudentId}
            onResetFilters={resetActivationFilters}
            onSearchQueryChange={setActivationSearchQuery}
          />
        </TabsContent>
      </Tabs>

      <OwnerActivityDetailDialog
        selectedIncomingPayment={selectedIncomingPayment}
        selectedOutgoingPayment={selectedOutgoingPayment}
        selectedStudent={selectedStudent}
        onCloseIncomingPayment={() => setSelectedIncomingPaymentId(null)}
        onCloseOutgoingPayment={() => setSelectedOutgoingPaymentId(null)}
        onCloseStudent={() => setSelectedStudentId(null)}
      />
    </div>
  );
}
