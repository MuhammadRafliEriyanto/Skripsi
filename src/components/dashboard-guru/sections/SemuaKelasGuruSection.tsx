"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  BookOpen,
  Building2,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  MapPin,
  Search,
  Users,
} from "lucide-react";
import { clearAuthClientState } from "@/lib/auth";
import { buildGuruApiUrl, buildGuruUrl, getSelectedAcademicPeriod } from "@/lib/guru-helpers";
import {
  CLASS_FILTERS,
  DEFAULT_SEMESTER_MEETING_TARGET,
  JENJANG_ITEMS,
  type ClassStatus,
  type GuruClassSummary,
  type JenjangFilter,
} from "@/components/dashboard-guru/data/guruClassTypes";

type FilterKey = "all" | "weekly" | "pending";
type GuruClassSummaryWithBranch = GuruClassSummary & { branch: string };

const FILTER_ITEMS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "Semua Kelas" },
  { key: "weekly", label: "Aktif Minggu Ini" },
  { key: "pending", label: "Perlu Dinilai" },
];

type TeacherClassApiNextSchedule = {
  id?: string;
  day?: string;
  time?: string;
  room?: string;
  subject?: string;
  status?: string;
} | null;

type TeacherClassApiItem = {
  id?: string;
  className?: string;
  level?: string;
  subject?: string;
  branch?: string;
  room?: string;
  studentCount?: number;
  scheduleCount?: number;
  completedMeetingCount?: number;
  targetMeetingCount?: number;
  pendingTaskCount?: number;
  nextSchedule?: TeacherClassApiNextSchedule;
  status?: string;
};

type TeacherClassesResponse = {
  success: boolean;
  message?: string;
  data?: {
    classes?: TeacherClassApiItem[];
  };
};

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function toSafeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatTimeLabel(value: string) {
  return normalizeText(value).replace(/:/g, ".");
}

function extractGrade(value: string) {
  const normalizedValue = normalizeText(value).toUpperCase();
  const numericMatch = normalizedValue.match(
    /(^|[^0-9])(4|5|6|7|8|9|10|11|12)(?![0-9])/,
  );

  if (numericMatch?.[2]) {
    return Number(numericMatch[2]);
  }

  const romanMatch = normalizedValue.match(/\b(XII|XI|X)\b/);

  switch (romanMatch?.[1]) {
    case "X":
      return 10;
    case "XI":
      return 11;
    case "XII":
      return 12;
    default:
      return null;
  }
}

function inferJenjang(
  className: string,
  level: string,
): GuruClassSummary["jenjang"] {
  const normalizedClassName = normalizeText(className).toUpperCase();
  const normalizedLevel = normalizeText(level).toUpperCase();

  if (normalizedClassName.includes("SD") || normalizedLevel.includes("KELAS 4")) {
    return "SD";
  }

  if (
    normalizedClassName.includes("SMP") ||
    ["KELAS 7", "KELAS 8", "KELAS 9"].some((item) =>
      normalizedLevel.includes(item),
    )
  ) {
    return "SMP";
  }

  const grade = extractGrade(className) ?? extractGrade(level);

  if (grade !== null) {
    if (grade <= 6) {
      return "SD";
    }

    if (grade <= 9) {
      return "SMP";
    }
  }

  return "SMA";
}

function inferTingkat(className: string) {
  const grade = extractGrade(className);
  return grade ? `Kelas ${grade}` : "Kelas belum diatur";
}

function toClassStatus(value: string | null | undefined): ClassStatus {
  return normalizeText(value).toLowerCase() === "berjalan" ? "Berjalan" : "Aktif";
}

function buildScheduleLabel(nextSchedule: TeacherClassApiNextSchedule) {
  const day = normalizeText(nextSchedule?.day);
  const time = normalizeText(nextSchedule?.time);

  if (!day && !time) {
    return "Jadwal belum diatur";
  }

  if (!day) {
    return `${formatTimeLabel(time)} WIB`;
  }

  if (!time) {
    return day;
  }

  return `${day}, ${formatTimeLabel(time)} WIB`;
}

function mapTeacherClassToSummary(
  item: TeacherClassApiItem,
  index: number,
): GuruClassSummaryWithBranch {
  const kelasId = normalizeText(item.id) || `class-${index + 1}`;
  const namaKelas = normalizeText(item.className) || `Kelas ${index + 1}`;
  const tingkat = normalizeText(item.level) || inferTingkat(namaKelas);
  const mapel = normalizeText(item.subject) || "Mapel belum diatur";
  const branch = normalizeText(item.branch);
  const nextSchedule = item.nextSchedule ?? null;
  const configuredTotalPertemuan = DEFAULT_SEMESTER_MEETING_TARGET;
  const totalPertemuan = configuredTotalPertemuan;
  const pertemuanSelesai = Math.max(toSafeNumber(item.completedMeetingCount), 0);

  return {
    kelasId,
    namaKelas,
    guru: "Guru login",
    jenjang: inferJenjang(namaKelas, tingkat),
    tingkat,
    mapel,
    branch: branch || "Cabang belum diatur",
    program: branch || `${mapel} - ${namaKelas}`,
    jadwal: buildScheduleLabel(nextSchedule),
    ruangan:
      normalizeText(item.room) ||
      normalizeText(nextSchedule?.room) ||
      "Ruangan belum diatur",
    totalSiswa: Math.max(toSafeNumber(item.studentCount), 0),
    totalPertemuan,
    pertemuanSelesai,
    tugasBelumDinilai: Math.max(toSafeNumber(item.pendingTaskCount), 0),
    aktifMingguIni: Boolean(nextSchedule),
    status: toClassStatus(item.status),
  };
}

function getStatusClass(status: ClassStatus) {
  if (status === "Aktif") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "Berjalan") {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function getJenjangClass(jenjang: GuruClassSummary["jenjang"]) {
  if (jenjang === "SMP") {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }

  if (jenjang === "SMA") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  helper: string;
}) {
  return (
    <div className="border border-orange-100 bg-white px-4 py-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-[0_24px_44px_-34px_rgba(249,115,22,0.28)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          {label}
        </p>
        <div className="flex h-9 w-9 items-center justify-center border border-orange-100 bg-orange-50 text-orange-500 transition duration-300 hover:border-orange-200 hover:bg-orange-100">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-3xl font-bold text-slate-800">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </div>
  );
}

function LoadingClassCards({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={`kelas-loading-${index + 1}`}
          className="animate-pulse border border-orange-100 bg-white p-5 shadow-[0_22px_46px_-36px_rgba(15,23,42,0.18)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="w-full max-w-[220px]">
              <div className="h-3 w-24 rounded-full bg-orange-100" />
              <div className="mt-3 h-5 w-3/4 rounded-full bg-slate-200" />
              <div className="mt-2 h-3 w-1/2 rounded-full bg-orange-100" />
            </div>
            <div className="h-6 w-16 rounded-full bg-slate-100" />
          </div>

          <div className="mt-5 flex gap-2">
            <div className="h-6 w-14 rounded-full bg-orange-100" />
            <div className="h-6 w-20 rounded-full bg-slate-100" />
            <div className="h-6 w-28 rounded-full bg-emerald-100" />
          </div>

          <div className="mt-5 space-y-3">
            <div className="h-3 w-3/4 rounded-full bg-slate-100" />
            <div className="h-3 w-1/2 rounded-full bg-slate-100" />
            <div className="h-3 w-2/3 rounded-full bg-slate-100" />
          </div>

          <div className="mt-5 border-t border-orange-100 pt-4">
            <div className="flex items-center justify-between">
              <div className="h-3 w-24 rounded-full bg-slate-100" />
              <div className="h-3 w-10 rounded-full bg-slate-100" />
            </div>
            <div className="mt-3 h-2 w-full rounded-full bg-orange-50" />
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <div className="h-10 rounded-none bg-orange-100" />
              <div className="h-10 rounded-none bg-orange-200" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

export default function SemuaKelasGuruSection() {
  const searchParams = useSearchParams();
  const { academicYear } = getSelectedAcademicPeriod(searchParams);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [selectedJenjang, setSelectedJenjang] =
    useState<JenjangFilter>("Semua");
  const [selectedTingkat, setSelectedTingkat] = useState<string>("Semua");
  const [selectedBranch, setSelectedBranch] = useState("Semua");
  const [allClasses, setAllClasses] = useState<GuruClassSummaryWithBranch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadTeacherClasses = useEffectEvent(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await fetch(buildGuruApiUrl("/api/teacher/me/classes", searchParams), {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | TeacherClassesResponse
        | null;

      if (response.status === 401) {
        clearAuthClientState();
        setAllClasses([]);
        setLoadError("Gagal memuat kelas guru. Silakan coba lagi.");
        return;
      }

      if (!response.ok || !payload?.success) {
        console.error("[semua-kelas-guru] classes_request_failed", {
          status: response.status,
          message: payload?.message ?? "unknown_error",
        });
        setAllClasses([]);
        setLoadError("Gagal memuat kelas guru. Silakan coba lagi.");
        return;
      }

      const nextClasses = (payload.data?.classes ?? []).map(
        mapTeacherClassToSummary,
      );

      setAllClasses(nextClasses);
    } catch (error) {
      console.error("[semua-kelas-guru] load_classes_failed", error);
      setAllClasses([]);
      setLoadError("Gagal memuat kelas guru. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  });

  useEffect(() => {
    queueMicrotask(() => {
      void loadTeacherClasses();
    });
  }, [academicYear]);

  const branchOptions = useMemo(
    () => [
      "Semua",
      ...Array.from(
        new Set(allClasses.map((item) => item.branch).filter(Boolean)),
      ).sort((left, right) => left.localeCompare(right, "id-ID")),
    ],
    [allClasses],
  );
  const branchScopedClasses = useMemo(
    () =>
      selectedBranch === "Semua"
        ? allClasses
        : allClasses.filter((item) => item.branch === selectedBranch),
    [allClasses, selectedBranch],
  );
  const stats = useMemo(
    () => ({
      totalKelas: branchScopedClasses.length,
      totalSiswa: branchScopedClasses.reduce(
        (total, item) => total + item.totalSiswa,
        0,
      ),
      tugasBelumDinilai: branchScopedClasses.reduce(
        (total, item) => total + item.tugasBelumDinilai,
        0,
      ),
      jadwalAktif: branchScopedClasses.filter((item) => item.aktifMingguIni)
        .length,
    }),
    [branchScopedClasses],
  );

  const tingkatOptions = useMemo(() => {
    if (selectedJenjang === "Semua") {
      return [];
    }

    return CLASS_FILTERS[selectedJenjang];
  }, [selectedJenjang]);

  const filteredClasses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return branchScopedClasses.filter((item) => {
      const matchesSearch =
        !query ||
        item.namaKelas.toLowerCase().includes(query) ||
        item.mapel.toLowerCase().includes(query) ||
        item.program.toLowerCase().includes(query) ||
        item.jenjang.toLowerCase().includes(query) ||
        item.tingkat.toLowerCase().includes(query);

      const matchesFilter =
        activeFilter === "all" ||
        (activeFilter === "weekly" && item.aktifMingguIni) ||
        (activeFilter === "pending" && item.tugasBelumDinilai > 0);

      const matchesJenjang =
        selectedJenjang === "Semua" || item.jenjang === selectedJenjang;

      const matchesTingkat =
        selectedTingkat === "Semua" || item.tingkat === selectedTingkat;

      return (
        matchesSearch && matchesFilter && matchesJenjang && matchesTingkat
      );
    });
  }, [
    activeFilter,
    branchScopedClasses,
    searchQuery,
    selectedJenjang,
    selectedTingkat,
  ]);

  function handleJenjangChange(jenjang: JenjangFilter) {
    setSelectedJenjang(jenjang);
    setSelectedTingkat("Semua");
  }

  return (
    <div className="mx-auto mt-4 w-full max-w-7xl px-4 py-4 md:mt-6 md:px-6">
      <div className="flex flex-col gap-5">
        <Link
          href="/dashboard-guru/jadwal"
          className="inline-flex w-fit items-center gap-2 border border-orange-100 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-[0_16px_30px_-28px_rgba(15,23,42,0.4)] transition hover:-translate-y-px hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Jadwal
        </Link>

        <section className="overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-[0_28px_60px_-42px_rgba(15,23,42,0.28)]">
          <div className="grid gap-px bg-orange-100 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="bg-gradient-to-br from-orange-50 via-white to-amber-50 px-5 py-5 md:px-6 md:py-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-500">
                Dashboard Kelas Guru
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-800 md:text-3xl">
                Semua Kelas Saya
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                Kelola kelas Slawi dan Adiwerna dari satu tempat dengan data
                peserta, jadwal, dan progres yang tetap terpisah per cabang.
              </p>
            </div>

            <div className="grid gap-px bg-orange-100 sm:grid-cols-2">
              <SummaryCard
                icon={BookOpen}
                label="Total Kelas"
                value={stats.totalKelas}
                helper="Kelas aktif yang sedang Anda tangani."
              />
              <SummaryCard
                icon={Users}
                label="Total Siswa"
                value={stats.totalSiswa}
                helper="Akumulasi peserta dari seluruh kelas saat ini."
              />
              <SummaryCard
                icon={ClipboardCheck}
                label="Belum Dinilai"
                value={stats.tugasBelumDinilai}
                helper="Latihan yang masih membutuhkan review."
              />
              <SummaryCard
                icon={CalendarDays}
                label="Jadwal Minggu Ini"
                value={stats.jadwalAktif}
                helper="Kelas yang memiliki sesi aktif pekan ini."
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-orange-100 bg-white px-5 py-5 shadow-[0_22px_48px_-38px_rgba(15,23,42,0.26)] md:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-800">
                Cari dan Filter Kelas
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Gunakan pencarian, status, dan jenjang untuk memfokuskan kelas
                yang ingin Anda tindak lanjuti lebih dulu.
              </p>
            </div>

            <div className="w-full max-w-md">
              <div className="flex items-center gap-2 border border-orange-100 bg-orange-50/40 px-3 py-3 transition focus-within:border-orange-200 focus-within:ring-2 focus-within:ring-orange-100">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Cari kelas, mapel, cabang, atau jenjang..."
                  className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Cabang
              <select
                value={selectedBranch}
                onChange={(event) => setSelectedBranch(event.target.value)}
                className="min-h-11 rounded-lg border border-orange-100 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              >
                {branchOptions.map((branch) => (
                  <option key={branch} value={branch}>
                    {branch === "Semua"
                      ? `Semua Cabang (${allClasses.length})`
                      : `${branch} (${allClasses.filter((item) => item.branch === branch).length})`}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Status
              <select
                value={activeFilter}
                onChange={(event) =>
                  setActiveFilter(event.target.value as FilterKey)
                }
                className="min-h-11 rounded-lg border border-orange-100 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              >
                {FILTER_ITEMS.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Jenjang
              <select
                value={selectedJenjang}
                onChange={(event) =>
                  handleJenjangChange(event.target.value as JenjangFilter)
                }
                className="min-h-11 rounded-lg border border-orange-100 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              >
                {JENJANG_ITEMS.map((item) => (
                  <option key={item} value={item}>
                    {item === "Semua" ? "Semua Jenjang" : item}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Tingkat
              <select
                value={selectedTingkat}
                disabled={selectedJenjang === "Semua"}
                onChange={(event) => setSelectedTingkat(event.target.value)}
                className="min-h-11 rounded-lg border border-orange-100 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="Semua">Semua Tingkat</option>
                {tingkatOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-orange-100 pt-4">
            <span className="text-sm font-semibold text-slate-700">
              {filteredClasses.length} kelas ditemukan
            </span>
            {selectedBranch !== "Semua" ? (
              <span className="inline-flex items-center gap-1 border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                <Building2 className="h-3.5 w-3.5" />
                Cabang {selectedBranch}
              </span>
            ) : null}
            {selectedJenjang !== "Semua" ? (
              <span className="inline-flex items-center border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700">
                {selectedJenjang}
              </span>
            ) : null}
            {selectedTingkat !== "Semua" ? (
              <span className="inline-flex items-center border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                {selectedTingkat}
              </span>
            ) : null}
            {activeFilter !== "all" ? (
              <span className="inline-flex items-center border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                {FILTER_ITEMS.find((item) => item.key === activeFilter)?.label}
              </span>
            ) : null}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {isLoading ? (
            <LoadingClassCards />
          ) : loadError ? (
            <div className="border border-dashed border-orange-200 bg-white px-5 py-12 text-center md:col-span-2 xl:col-span-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center border border-orange-100 bg-orange-50 text-orange-500">
                <BookOpen className="h-5 w-5" />
              </div>
              <p className="mt-4 text-base font-semibold text-slate-700">
                Gagal memuat kelas guru. Silakan coba lagi.
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Periksa sesi login guru atau refresh halaman untuk mencoba
                memuat data backend sekali lagi.
              </p>
            </div>
          ) : allClasses.length === 0 ? (
            <div className="border border-dashed border-orange-200 bg-white px-5 py-12 text-center md:col-span-2 xl:col-span-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center border border-orange-100 bg-orange-50 text-orange-500">
                <BookOpen className="h-5 w-5" />
              </div>
              <p className="mt-4 text-base font-semibold text-slate-700">
                Belum ada kelas yang terhubung dengan akun guru ini.
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Jadwal yang sudah dibuat admin akan muncul di sini setelah
                berhasil dikelompokkan menjadi daftar kelas guru.
              </p>
            </div>
          ) : filteredClasses.length > 0 ? (
            filteredClasses.map((kelas) => {
              const progress =
                kelas.totalPertemuan > 0
                  ? Math.round(
                      (kelas.pertemuanSelesai / kelas.totalPertemuan) * 100,
                    )
                  : 0;

              return (
                <article
                  key={kelas.kelasId}
                  className="group relative overflow-hidden rounded-2xl border border-orange-100 bg-[linear-gradient(180deg,#fffdf9_0%,#ffffff_22%,#fffaf5_100%)] p-5 shadow-[0_22px_46px_-36px_rgba(15,23,42,0.26)] transition-all duration-300 hover:-translate-y-1 hover:border-orange-300 hover:shadow-[0_32px_58px_-34px_rgba(249,115,22,0.28)]"
                >
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-400 via-orange-500 to-amber-400" />

                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {kelas.program}
                      </p>
                      <h3 className="mt-1 text-lg font-semibold text-slate-800 transition-colors group-hover:text-orange-700">
                        {kelas.namaKelas}
                      </h3>
                      <p className="mt-1 text-sm font-medium text-orange-600">
                        {kelas.mapel}
                      </p>
                    </div>

                    <span
                      className={`inline-flex items-center border px-2.5 py-1 text-xs font-semibold ${getStatusClass(kelas.status)}`}
                    >
                      {kelas.status}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                      <Building2 className="h-3.5 w-3.5" />
                      Cabang {kelas.branch}
                    </span>
                    <span
                      className={`inline-flex items-center border px-2.5 py-1 text-[11px] font-semibold ${getJenjangClass(kelas.jenjang)}`}
                    >
                      {kelas.jenjang}
                    </span>
                    <span className="inline-flex items-center border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                      {kelas.tingkat}
                    </span>
                    <span
                      className={`inline-flex items-center border px-2.5 py-1 text-[11px] font-semibold ${
                        kelas.tugasBelumDinilai > 0
                          ? "border-orange-200 bg-orange-50 text-orange-700"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {kelas.tugasBelumDinilai > 0
                        ? `${kelas.tugasBelumDinilai} latihan belum dinilai`
                        : "Latihan sudah aman"}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-2.5 text-sm text-slate-500">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-orange-500" />
                      <span>{kelas.jadwal}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-orange-500" />
                      <span>{kelas.ruangan}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-orange-500" />
                      <span>{kelas.totalSiswa} siswa aktif</span>
                    </div>
                  </div>

                  <div className="mt-5 border-t border-orange-100 pt-4">
                    <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                      <span>Progress Pertemuan</span>
                      <span>{progress}%</span>
                    </div>

                    <div className="mt-2 h-2 border border-orange-100 bg-orange-50">
                      <div
                        className="h-full bg-gradient-to-r from-orange-400 via-orange-500 to-amber-400"
                        style={{ width: `${progress}%` }}
                      />
                    </div>

                    <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="h-3.5 w-3.5 text-orange-500" />
                        {kelas.pertemuanSelesai}/{kelas.totalPertemuan} sesi
                      </span>
                      <span>Selesai / target kelas</span>
                    </div>

                    <div className="mt-5 grid gap-2 sm:grid-cols-2">
                      <Link
                        href={buildGuruUrl("/dashboard-guru/detail-kelas", searchParams, { kelasId: kelas.kelasId })}
                        className="inline-flex items-center justify-center gap-1.5 border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm font-semibold text-orange-700 transition hover:-translate-y-px hover:border-orange-300 hover:bg-orange-100"
                      >
                        Detail Kelas
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                      <Link
                        href={buildGuruUrl("/dashboard-guru/absensi-kelas", searchParams, { kelasId: kelas.kelasId })}
                        className="inline-flex items-center justify-center gap-1.5 border border-orange-400 bg-gradient-to-r from-orange-400 via-orange-500 to-amber-400 px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-px hover:shadow-[0_20px_34px_-22px_rgba(249,115,22,0.62)]"
                      >
                        <ClipboardCheck className="h-4 w-4" />
                        Mulai Kelas
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="border border-dashed border-orange-200 bg-white px-5 py-12 text-center md:col-span-2 xl:col-span-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center border border-orange-100 bg-orange-50 text-orange-500">
                <BookOpen className="h-5 w-5" />
              </div>
              <p className="mt-4 text-base font-semibold text-slate-700">
                Tidak ada kelas yang cocok dengan filter saat ini.
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Coba ubah pencarian, pilih jenjang lain, atau reset tingkat
                kelas agar daftar kembali tampil.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
