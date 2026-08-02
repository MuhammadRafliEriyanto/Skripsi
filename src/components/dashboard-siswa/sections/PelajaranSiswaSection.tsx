"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BookOpen,
  Eye,
  FileText,
  Send,
  TimerReset,
  Target,
  Calendar,
  Building,
  ChevronRight,
  Check,
  TrendingUp,
} from "lucide-react";
import { useStudentDashboardData } from "../data/useStudentDashboardData";
import { useStudentLearningData } from "../data/useStudentLearningData";
import { useStudentTryouts } from "../data/useStudentTryouts";
import { getStudentAcademicAccessMessage } from "../data/studentAcademicAccess";
import { isUtbkStudentProfile } from "../data/studentProgram";
import { formatUtbkTryoutStageLabel } from "@/lib/utbk-tryout-stages";

type TabKey = "materi" | "tugas" | "tryout";

type TabConfig = {
  key: TabKey;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  href: string;
};

const tabs: TabConfig[] = [
  {
    key: "materi",
    label: "Daftar Materi",
    shortLabel: "Materi",
    icon: BookOpen,
    href: "/dashboard-siswa/materi",
  },
  {
    key: "tugas",
    label: "Daftar Latihan",
    shortLabel: "Tugas",
    icon: FileText,
    href: "/dashboard-siswa/tugas",
  },
  {
    key: "tryout",
    label: "Sesi Ujian",
    shortLabel: "Ujian",
    icon: TimerReset,
    href: "/dashboard-siswa/ujian",
  },
];

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center rounded-b-[22px] bg-white px-6 py-12 text-center">
      <p className="text-base font-semibold text-slate-700">{title}</p>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
        {description}
      </p>
    </div>
  );
}

function SectionAction({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 transition hover:text-orange-700"
    >
      {label}
      <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );
}

export default function PelajaranSection() {
  const [activeTab, setActiveTab] = useState<TabKey>("materi");
  const { dashboardData, isLoading: isDashboardLoading } = useStudentDashboardData();
  const { materials, tasks, student, academicAccess, isLoading, loadError } =
    useStudentLearningData();
  const {
    tryouts,
    academicAccess: tryoutAcademicAccess,
    isLoading: isTryoutsLoading,
    loadError: tryoutsError,
  } = useStudentTryouts();
  const academicAccessMessage =
    getStudentAcademicAccessMessage(academicAccess);
  const tryoutAcademicAccessMessage =
    getStudentAcademicAccessMessage(tryoutAcademicAccess);
  const isUtbkStudent = isUtbkStudentProfile(student ?? dashboardData?.student);
  const visibleTabs = useMemo(
    () =>
      tabs
        .filter((tab) => !isUtbkStudent || tab.key !== "tugas")
        .map((tab) =>
          isUtbkStudent && tab.key === "tryout"
            ? {
                ...tab,
                label: "Sesi Tryout",
                shortLabel: "Tryout",
              }
            : tab,
        ),
    [isUtbkStudent],
  );
  const resolvedActiveTab =
    isUtbkStudent && activeTab === "tugas" ? "materi" : activeTab;

  const activeTabConfig = useMemo(
    () =>
      visibleTabs.find((tab) => tab.key === resolvedActiveTab) ??
      visibleTabs[0] ??
      tabs[0],
    [resolvedActiveTab, visibleTabs],
  );

  const summaryLabel = useMemo(() => {
    if (isLoading || isDashboardLoading || isTryoutsLoading) {
      return "Memuat data aktivitas...";
    }

    if (resolvedActiveTab === "materi")
      return `${materials.length} materi tersedia`;
    if (resolvedActiveTab === "tugas") return `${tasks.length} tugas aktif`;
    return `${tryouts.length} ${isUtbkStudent ? "tryout tersedia" : "ujian tersedia"}`;
  }, [resolvedActiveTab, isLoading, isDashboardLoading, isTryoutsLoading, materials.length, tasks.length, tryouts.length, isUtbkStudent]);

  const renderMateri = () => {
    if (isLoading) {
      return (
        <EmptyState
          title="Memuat materi"
          description="Sistem sedang mengambil materi terbaru dari kelas kamu."
        />
      );
    }

    if (materials.length === 0) {
      return (
        <EmptyState
          title="Belum ada materi"
          description={
            academicAccessMessage ??
            loadError ??
            "Materi pembelajaran belum diunggah oleh guru untuk kelas kamu."
          }
        />
      );
    }

    return (
      <div className="space-y-3 bg-white p-4 md:p-5">
        {materials.map((item) => (
          <article
            key={item.id}
            className="flex flex-col gap-3 rounded-2xl border border-slate-100 px-4 py-4 transition hover:border-orange-200 hover:bg-orange-50/50 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-700">
                  {item.mapel}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-500">
                  Pertemuan {item.pertemuan}
                </span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                  {item.durasi}
                </span>
              </div>

              <h4 className="mt-2 text-sm font-semibold text-slate-800">
                {item.judul}
              </h4>
              <p className="mt-1 text-xs text-slate-500">
                Materi siap dibaca untuk penguatan konsep dan latihan mandiri.
              </p>
            </div>

            <Link
              href={item.href}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-orange-500 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-orange-600"
            >
              <Eye className="h-3.5 w-3.5" />
              Baca Materi
            </Link>
          </article>
        ))}
      </div>
    );
  };

  const renderTugas = () => {
    if (isLoading) {
      return (
        <EmptyState
          title="Memuat tugas"
          description="Sistem sedang mengambil tugas terbaru dari kelas kamu."
        />
      );
    }

    if (tasks.length === 0) {
      return (
        <EmptyState
          title="Belum ada tugas"
          description={
            academicAccessMessage ??
            loadError ??
            "Tugas mandiri maupun kelompok belum ditambahkan oleh guru kelas kamu."
          }
        />
      );
    }

    return (
      <div className="space-y-3 bg-white p-4 md:p-5">
        {tasks.map((item) => (
          <article
            key={item.id}
            className="flex flex-col gap-3 rounded-2xl border border-slate-100 px-4 py-4 transition hover:border-orange-100 hover:bg-orange-50/30 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-700">
                  {item.mapel}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-500">
                  Pertemuan {item.pertemuan}
                </span>
              </div>

              <h4 className="mt-2 text-sm font-semibold text-slate-800">
                {item.judul}
              </h4>
              <p className="mt-1 text-xs text-slate-500">
                Batas pengumpulan pada {item.deadline}.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={item.detailHref}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                <Eye className="h-3.5 w-3.5" />
                Detail
              </Link>
              <Link
                href={item.submitHref}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-orange-500 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-orange-600"
              >
                <Send className="h-3.5 w-3.5" />
                Kirim Jawaban
              </Link>
            </div>
          </article>
        ))}
      </div>
    );
  };

  const renderTryout = () => {
    if (isTryoutsLoading) {
      return (
        <EmptyState
          title="Memuat sesi ujian"
          description="Sistem sedang mengambil sesi ujian atau tryout terbaru dari kelas kamu."
        />
      );
    }

    if (tryouts.length === 0) {
      return (
        <EmptyState
          title="Belum ada sesi ujian"
          description={
            tryoutAcademicAccessMessage ??
            tryoutsError ??
            "Belum ada sesi ujian atau tryout yang diterbitkan untuk kelas kamu saat ini."
          }
        />
      );
    }

    return (
      <div className="space-y-3 bg-white p-4 md:p-5">
        {tryouts.map((tryout) => {
          const assessmentType = tryout.assessmentType || "Ujian";
          const assessmentLabel =
            assessmentType === "Tryout" && tryout.stage
              ? isUtbkStudent
                ? formatUtbkTryoutStageLabel(
                    tryout.stage,
                    `Tryout ${tryout.stage}`,
                  )
                : `Tryout ${tryout.stage}`
              : assessmentType;
          const totalQ = Math.max(
            tryout.totalQuestions ?? 0,
            tryout.questionCount ?? 0
          );
          const title = tryout.title || `${assessmentLabel} ${tryout.subject || ""}`;

          return (
            <article key={tryout.id || tryout.tryoutId} className="flex flex-col gap-4 rounded-2xl border border-slate-100 px-4 py-4 transition hover:border-orange-200 hover:bg-orange-50/50">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-700">
                      {tryout.subject || "Campuran"}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-500">
                      {totalQ} soal
                    </span>
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                      {tryout.durationMinutes ?? 90} menit
                    </span>
                  </div>

                  <h4 className="mt-2 text-sm font-semibold text-slate-800">
                    {title}
                  </h4>
                  <p className="mt-1 text-xs leading-6 text-slate-500">
                    {tryout.availability || "Status ujian belum tersedia"}
                  </p>
                </div>

                <div className="rounded-2xl bg-orange-50 px-3 py-2 text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-600">
                    Kode
                  </p>
                  <p className="mt-1 text-sm font-semibold text-orange-700">
                    {tryout.tryoutId || tryout.id || "-"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="rounded-full bg-slate-100 px-2.5 py-1">
                  {tryout.questionSource === "bank" ? "Ujian Bank Soal" : "Ujian Terjadwal"}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1">
                  {tryout.branch || "Pusat"}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href="/dashboard-siswa/ujian"
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-orange-500 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-orange-600"
                >
                  <TimerReset className="h-3.5 w-3.5" />
                  Buka Menu Ujian
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    );
  };

  if (isUtbkStudent) {
    const targetKampus = dashboardData?.student?.targetKampus || "Universitas Gajah Mada";
    const targetJurusan = dashboardData?.student?.targetJurusan || "Teknik Sipil";
    const tryoutCount = tryouts.length > 0 ? tryouts.length : 3;
    const completedTryoutCount = 0; 

    return (
      <div className="flex flex-col xl:flex-row gap-6">
        {/* Left Column */}
        <div className="w-full xl:w-[360px] shrink-0 space-y-4">
          <div className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50">
                  <Target className="h-5 w-5 text-orange-500" />
                </div>
                <h3 className="font-semibold text-slate-800 text-sm">Fokus UTBK/SNBT</h3>
              </div>
              <Link href="/dashboard-siswa/jadwal" className="flex items-center gap-1.5 rounded-full border border-orange-100 bg-orange-50 px-3 py-1.5 text-[11px] font-semibold text-orange-600 transition hover:bg-orange-100">
                <Calendar className="h-3.5 w-3.5" />
                Lihat Jadwal
              </Link>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mb-6">
              Kelas 12 difokuskan ke jadwal kelas, materi, dan tryout UTBK.
            </p>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600 flex items-center gap-1.5 mb-1.5">
                  <Building className="h-3.5 w-3.5" /> TARGET KAMPUS
                </p>
                <p className="text-sm font-semibold text-slate-800">{targetKampus}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600 mb-1.5">
                  TARGET JURUSAN
                </p>
                <p className="text-sm font-semibold text-slate-800">{targetJurusan}</p>
              </div>
            </div>

            <Link href="/dashboard-siswa/materi" className="mt-6 flex w-full items-center justify-center rounded-xl bg-orange-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700">
              Buka Kelas UTBK
            </Link>
          </div>
        </div>

        {/* Right Column */}
        <div className="flex-1">
          <div className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm h-full flex flex-col md:flex-row gap-6">
            <div className="flex-1 space-y-6">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-orange-600 mb-1.5">REKAP BELAJAR UTBK</p>
                <h3 className="text-2xl font-extrabold text-slate-900 mb-3">Ringkasan materi dan tryout</h3>
                <div className="inline-flex items-center rounded-full bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-600 border border-slate-100">
                  {targetKampus} - {targetJurusan}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-slate-100 p-4 text-center transition hover:border-slate-200 hover:bg-slate-50">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-50 mb-3">
                    <BookOpen className="h-6 w-6 text-cyan-500" />
                  </div>
                  <p className="text-[11px] font-semibold text-slate-500 mb-1">Materi aktif</p>
                  <p className="text-2xl font-bold text-slate-800">{materials.length || 1}</p>
                  <p className="text-[10px] text-slate-400 mt-1">Konten UTBK</p>
                </div>
                <div className="rounded-2xl border border-slate-100 p-4 text-center transition hover:border-slate-200 hover:bg-slate-50">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 mb-3">
                    <TimerReset className="h-6 w-6 text-orange-500" />
                  </div>
                  <p className="text-[11px] font-semibold text-slate-500 mb-1">Tahap UTBK</p>
                  <p className="text-2xl font-bold text-slate-800">{completedTryoutCount}/{tryoutCount}</p>
                  <p className="text-[10px] text-slate-400 mt-1">Tryout utama</p>
                </div>
                <div className="rounded-2xl border border-slate-100 p-4 text-center transition hover:border-slate-200 hover:bg-slate-50">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 mb-3">
                    <TrendingUp className="h-6 w-6 text-emerald-500" />
                  </div>
                  <p className="text-[11px] font-semibold text-slate-500 mb-1">Skor terbaru</p>
                  <p className="text-2xl font-bold text-slate-800">-</p>
                  <p className="text-[10px] text-slate-400 mt-1">Dari tryout terkirim</p>
                </div>
                <div className="rounded-2xl border border-slate-100 p-4 text-center transition hover:border-slate-200 hover:bg-slate-50">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 mb-3">
                    <Target className="h-6 w-6 text-purple-500" />
                  </div>
                  <p className="text-[11px] font-semibold text-slate-500 mb-1">Skor terbaik</p>
                  <p className="text-2xl font-bold text-slate-800">-</p>
                  <p className="text-[10px] text-slate-400 mt-1">Capaian tertinggi</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[1, 2, 3].map((num) => (
                  <div key={num} className="rounded-2xl border border-slate-100 p-4 relative flex flex-col justify-between items-start transition hover:border-slate-200 hover:bg-slate-50">
                    <div>
                      <p className="text-sm font-bold text-slate-800 mb-1">Tryout UTBK {num}</p>
                      <p className="text-[11px] text-slate-500 mb-4 line-clamp-2">Simulasi soal UTBK tahap</p>
                    </div>
                    <span className="inline-flex rounded-md bg-orange-50 px-2.5 py-1 text-[10px] font-semibold text-orange-700">Belum mulai</span>
                  </div>
                ))}
              </div>

              <Link href="/dashboard-siswa/ujian" className="flex w-full items-center justify-center rounded-xl border border-orange-200 bg-white py-3.5 text-sm font-semibold text-orange-600 transition hover:bg-orange-50">
                Lihat semua tryout <ChevronRight className="ml-1.5 h-4 w-4" />
              </Link>
            </div>

            <div className="w-full md:w-[280px] shrink-0 rounded-[20px] bg-orange-500 p-6 text-white flex flex-col relative overflow-hidden shadow-sm">
              <div className="relative z-10 flex-1">
                <div className="flex items-start justify-between mb-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-orange-100">STATUS DATA</p>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-orange-500 shadow-sm">
                    <Check className="h-5 w-5" />
                  </div>
                </div>
                <h3 className="text-3xl font-extrabold mb-3">Terhubung</h3>
                <p className="text-[13px] text-orange-100/90 leading-relaxed mb-6">Rekap mengikuti data target, materi, dan tryout siswa.</p>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm">
                    <span className="text-[13px] font-medium text-slate-600">Target</span>
                    <span className="text-[13px] font-bold text-slate-900">Lengkap</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm">
                    <span className="text-[13px] font-medium text-slate-600">Materi</span>
                    <span className="text-[13px] font-bold text-slate-900">{materials.length || 1} aktif</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm">
                    <span className="text-[13px] font-medium text-slate-600">Tryout</span>
                    <span className="text-[13px] font-bold text-slate-900">{completedTryoutCount}/{tryoutCount} selesai</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm">
                    <span className="text-[13px] font-medium text-slate-600">Skor terbaik</span>
                    <span className="text-[13px] font-bold text-slate-900">-</span>
                  </div>
                </div>
              </div>
              
              {/* Optional Decoration */}
              <div className="absolute -bottom-10 -right-10 h-48 w-48 opacity-10 pointer-events-none">
                 <svg viewBox="0 0 100 100" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="50" cy="50" r="50" />
                 </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-sm md:p-5">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-600">
            Aktivitas Belajar
          </p>
          <h3 className="mt-1 text-base font-semibold text-slate-800">
            {isUtbkStudent
              ? "Materi dan tryout UTBK"
              : "Materi, tugas, dan tryout siswa"}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-orange-50 px-3 py-1 text-[11px] font-medium text-orange-700">
            {summaryLabel}
          </span>
          <SectionAction
            href={activeTabConfig.href}
            label={`Lihat semua ${activeTabConfig.shortLabel.toLowerCase()}`}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-[22px] border border-slate-100 bg-slate-50/50">
        <div className="flex flex-wrap border-b border-slate-100 bg-slate-50">
          {visibleTabs.map((tab) => {
            const isActive = resolvedActiveTab === tab.key;
            const Icon = tab.icon;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-2 border-r border-slate-100 px-4 py-3 text-sm font-medium transition last:border-r-0 ${
                  isActive
                    ? "border-t-[3px] border-t-orange-500 bg-white text-orange-700"
                    : "border-t-[3px] border-t-transparent text-slate-500 hover:bg-slate-100 hover:text-orange-600"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {resolvedActiveTab === "materi" && renderMateri()}
        {resolvedActiveTab === "tugas" && renderTugas()}
        {resolvedActiveTab === "tryout" && renderTryout()}
      </div>
    </section>
  );
}
