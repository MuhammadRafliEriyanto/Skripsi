"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  CalendarClock,
  ChevronDown,
  FileText,
  Flame,
  Lock,
  Target,
  TimerReset,
} from "lucide-react";

import type { StudentDashboardData } from "../data/useStudentDashboardData";
import { getStudentAcademicAccessMessage } from "../data/studentAcademicAccess";

type HeaderAkademikSiswaProps = {
  dashboardData: StudentDashboardData | null;
  dashboardLoading?: boolean;
  dashboardError?: string | null;
};

type TabConfig = {
  name: string;
  icon: LucideIcon;
  content: {
    title: string;
    desc: string;
    stats: string;
    primaryLabel: string;
    primaryHref: string;
    secondaryLabel: string;
    secondaryHref: string;
  };
};

type ProgramConfig = {
  name: string;
  tabs: TabConfig[];
};

function EmptyState({ message }: { message: string }) {
  return (
    <div className="mt-4 flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-5 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
        <Lock className="h-4 w-4 text-slate-400" />
      </div>
      <p className="text-xs font-semibold text-slate-600">{message}</p>
      <p className="text-[11px] text-gray-400">
        Ringkasan belajar akan muncul setelah data dashboard siswa tersedia.
      </p>
    </div>
  );
}

export default function HeaderAkademikSiswa({
  dashboardData,
  dashboardLoading = false,
  dashboardError = null,
}: HeaderAkademikSiswaProps) {
  const academicAccessMessage = getStudentAcademicAccessMessage(
    dashboardData?.academicAccess,
  );

  const derivedProgram = useMemo<ProgramConfig | null>(() => {
    if (!dashboardData) {
      return null;
    }

    const { student, academicSummary } = dashboardData;
    const scheduleDescription =
      academicAccessMessage ??
      (academicSummary.todayScheduleCount > 0
        ? `${academicSummary.todayScheduleCount} sesi belajar terjadwal hari ini untuk kelas ${student.className}.`
        : academicSummary.scheduleCount > 0
          ? `Tidak ada jadwal hari ini. Total ${academicSummary.scheduleCount} jadwal mingguan siap dipantau dari dashboard siswa.`
          : "Jadwal pelajaran untuk kelas kamu belum tersedia di backend.");

    return {
      name: `${student.program || academicSummary.jenjang} - ${academicSummary.kelasLabel}`,
      tabs: [
        {
          name: "Materi",
          icon: FileText,
          content: {
            title: "Materi belajar aktif",
            desc:
              academicSummary.materialCount > 0
                ? `${academicSummary.materialCount} materi sudah dipublikasikan untuk kelas ${student.className}.`
                : academicAccessMessage ??
                  `Guru belum mempublikasikan materi untuk kelas ${student.className}.`,
            stats: `${academicSummary.materialCount} Materi`,
            primaryLabel: "Buka Materi",
            primaryHref: "/dashboard-siswa/materi",
            secondaryLabel: "Lihat Detail",
            secondaryHref: "/dashboard-siswa/materi",
          },
        },
        {
          name: "Tugas",
          icon: BookOpen,
          content: {
            title: "Tugas dan agenda belajar",
            desc:
              academicSummary.taskCount > 0
                ? `${academicSummary.taskCount} tugas tersedia untuk dipantau dan dikerjakan dari dashboard siswa.`
                : academicAccessMessage ??
                  "Belum ada tugas aktif yang dibagikan untuk kelas kamu.",
            stats: `${academicSummary.taskCount} Tugas`,
            primaryLabel: "Lihat Tugas",
            primaryHref: "/dashboard-siswa/tugas",
            secondaryLabel: "Kirim Jawaban",
            secondaryHref: "/dashboard-siswa/kirim-tugas",
          },
        },
        {
          name: "Sesi Ujian",
          icon: TimerReset,
          content: {
            title: "Sesi Ujian dan Tryout",
            desc:
              academicSummary.tryoutCount > 0
                ? `${academicSummary.tryoutCount} sesi ujian/tryout tersedia untuk kelas ${student.className}.`
                : academicAccessMessage ??
                  "Belum ada sesi ujian aktif yang tersedia untuk kelas kamu.",
            stats: `${academicSummary.tryoutCount} Ujian`,
            primaryLabel: "Mulai Ujian",
            primaryHref: "/dashboard-siswa/ujian",
            secondaryLabel: "Lihat Ujian",
            secondaryHref: "/dashboard-siswa/ujian",
          },
        },
        {
          name: "Jadwal",
          icon: CalendarClock,
          content: {
            title: "Jadwal pelajaran hari ini",
            desc: scheduleDescription,
            stats: `${academicSummary.todayScheduleCount} Jadwal`,
            primaryLabel: "Lihat Jadwal",
            primaryHref: "/dashboard-siswa#jadwal-mata-pelajaran",
            secondaryLabel: "Buka Dashboard",
            secondaryHref: "/dashboard-siswa",
          },
        },
      ],
    };
  }, [academicAccessMessage, dashboardData]);

  const heroTitle = useMemo(() => {
    if (dashboardLoading) {
      return "Memuat ringkasan akademik siswa";
    }

    if (!dashboardData) {
      return "Ringkasan belajar belum tersedia";
    }

    return `Fokus belajar ${dashboardData.academicSummary.jenjang} ${dashboardData.academicSummary.kelasLabel}`;
  }, [dashboardData, dashboardLoading]);

  const heroSubtitle = useMemo(() => {
    if (dashboardLoading) {
      return "Sistem sedang menyiapkan materi, tugas, dan jadwal belajar terbaru untuk akun siswa kamu.";
    }

    if (!dashboardData) {
      return (
        dashboardError ??
        "Ringkasan akademik akan tampil setelah data dashboard siswa berhasil dimuat."
      );
    }

    if (academicAccessMessage) {
      return academicAccessMessage;
    }

    const { academicSummary } = dashboardData;
    return `${academicSummary.materialCount} materi, ${academicSummary.taskCount} tugas, ${academicSummary.tryoutCount} ujian, dan ${academicSummary.todayScheduleCount} jadwal hari ini siap dipantau dari dashboard siswa.`;
  }, [academicAccessMessage, dashboardData, dashboardError, dashboardLoading]);

  const programOptions = useMemo(
    () => (derivedProgram ? [derivedProgram] : []),
    [derivedProgram],
  );
  const [selectedProgramName, setSelectedProgramName] = useState("");

  const selectedProgram =
    programOptions.find((program) => program.name === selectedProgramName) ??
    programOptions[0] ??
    null;
  const [activeTabName, setActiveTabName] = useState("");

  const selectedTab =
    selectedProgram?.tabs.find((tab) => tab.name === activeTabName) ??
    selectedProgram?.tabs[0] ??
    null;
  const emptyStateMessage = dashboardLoading
    ? "Memuat ringkasan belajar siswa..."
    : academicAccessMessage ??
      dashboardError ??
      "Data akademik siswa belum tersedia.";

  return (
    <div id="header-akademik-siswa" className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-orange-100 bg-orange-50/50 shadow-sm">
        <div className="relative flex items-center gap-4 px-4 py-4 md:px-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-100 shadow-sm">
            <Flame className="h-6 w-6 text-orange-600" />
          </div>
          <div className="overflow-hidden text-slate-800">
            <p className="text-sm font-semibold md:text-base">{heroTitle}</p>
            <div className="overflow-hidden whitespace-nowrap">
              <p className="animate-marquee text-xs text-slate-500 md:text-sm">
                {heroSubtitle}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-stretch">
          <div className="flex w-16 items-center justify-center bg-orange-50 md:w-20">
            <BookOpen className="h-6 w-6 text-orange-400 md:h-7 md:w-7" />
          </div>

          <div className="flex-1 px-4 py-4">
            <div className="mb-2 flex items-center gap-2">
              <Target className="h-4 w-4 text-orange-500" />
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Panel Siswa
              </p>
            </div>

            {selectedProgram ? (
              <>
                <div className="relative">
                  <select
                    value={selectedProgram?.name ?? ""}
                    onChange={(event) => setSelectedProgramName(event.target.value)}
                    className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 pr-10 text-sm font-medium text-gray-700 transition focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  >
                    {programOptions.map((program) => (
                      <option key={program.name} value={program.name}>
                        {program.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedProgram.tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = selectedTab?.name === tab.name;

                    return (
                      <button
                        key={tab.name}
                        type="button"
                        onClick={() => setActiveTabName(tab.name)}
                        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                          isActive
                            ? "bg-orange-500 text-white shadow-sm"
                            : "bg-slate-50 text-slate-600 hover:bg-orange-50 hover:text-orange-600"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {tab.name}
                      </button>
                    );
                  })}
                </div>

                {selectedTab ? (
                  <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-800 md:text-base">
                          {selectedTab.content.title}
                        </h3>
                        <p className="mt-1 text-xs text-slate-500 md:text-sm">
                          {selectedTab.content.desc}
                        </p>
                      </div>
                      <div className="shrink-0 rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">
                        {selectedTab.content.stats}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href={selectedTab.content.primaryHref}
                        className="rounded-xl bg-orange-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-orange-700"
                      >
                        {selectedTab.content.primaryLabel}
                      </Link>
                      <Link
                        href={selectedTab.content.secondaryHref}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
                      >
                        {selectedTab.content.secondaryLabel}
                      </Link>
                    </div>
                  </div>
                ) : (
                  <EmptyState message={emptyStateMessage} />
                )}
              </>
            ) : (
              <EmptyState message={emptyStateMessage} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
