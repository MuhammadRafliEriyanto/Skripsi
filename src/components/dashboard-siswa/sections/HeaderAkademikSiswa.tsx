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
  Bookmark,
} from "lucide-react";

import type { StudentDashboardData } from "../data/useStudentDashboardData";
import { getStudentAcademicAccessMessage } from "../data/studentAcademicAccess";
import { getUtbkTrackLabel, isUtbkStudentProfile } from "../data/studentProgram";


type HeaderAkademikSiswaProps = {
  dashboardData: StudentDashboardData | null;
  dashboardLoading?: boolean;
  dashboardError?: string | null;
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

  const heroTitle = useMemo(() => {
    if (dashboardLoading) {
      return "Memuat ringkasan akademik siswa";
    }

    if (!dashboardData) {
      return "Ringkasan belajar belum tersedia";
    }

    if (isUtbkStudentProfile(dashboardData.student)) {
      return `Fokus UTBK ${getUtbkTrackLabel(dashboardData.student)}`;
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

    const { academicSummary, student } = dashboardData;
    if (isUtbkStudentProfile(student)) {
      return `Ada ${academicSummary.materialCount} materi dan ${academicSummary.tryoutCount} tryout untuk persiapan UTBK kamu.`;
    }

    return `Kamu punya ${academicSummary.materialCount} materi untuk dipelajari dan ${academicSummary.taskCount} latihan soal untuk diselesaikan. Semangat!`;
  }, [academicAccessMessage, dashboardData, dashboardError, dashboardLoading]);

  const emptyStateMessage = dashboardLoading
    ? "Memuat ringkasan belajar siswa..."
    : academicAccessMessage ??
      dashboardError ??
      "Data akademik siswa belum tersedia.";

  return (
    <div id="header-akademik-siswa" className="scroll-mt-24 space-y-4">
      <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
        <div className="flex w-16 shrink-0 items-center justify-center bg-gradient-to-br from-orange-400 to-orange-500 text-white md:w-20">
          <Bookmark className="h-6 w-6 md:h-8 md:w-8" />
        </div>
        <div className="flex flex-1 flex-col justify-center px-4 py-4 md:px-5">
          <label
            htmlFor="academicYearFilter"
            className="text-[11px] font-semibold tracking-wide text-slate-500 md:text-xs"
          >
            TAHUN AKADEMIK
          </label>
          <div className="relative mt-2 w-full">
            <select
              id="academicYearFilter"
              className="w-full appearance-none rounded-md border border-slate-200 bg-white px-3 py-2.5 pr-10 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-400 cursor-pointer"
              defaultValue=""
            >
              <option value="" disabled>
                -- Pilih Tahun Akademik --
              </option>
              <option value="2026/2027">2025/2026</option>
              <option value="2027/2028">2026/2027</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
              <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

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
        <div className="flex flex-col md:flex-row items-stretch">
          <div className="flex w-full md:w-24 shrink-0 flex-col items-center justify-center bg-orange-50 p-4 md:p-6">
            <Flame className="h-8 w-8 mb-2 text-orange-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-orange-600 text-center">Fokus Hari Ini</span>
          </div>

          <div className="flex-1 p-5 md:p-6">
            {dashboardLoading ? (
              <div className="flex flex-col gap-6">
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-5 w-5 animate-pulse rounded-full bg-slate-200" />
                    <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
                  </div>
                  <div className="h-32 w-full animate-pulse rounded-2xl bg-slate-100" />
                </div>
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-4 w-4 animate-pulse rounded-full bg-slate-200" />
                    <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
                    <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
                  </div>
                </div>
              </div>
            ) : !dashboardData ? (
               <EmptyState message={emptyStateMessage} />
            ) : (
              <div className="flex flex-col gap-6">
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <Target className="h-5 w-5 text-orange-500" />
                    <h2 className="text-lg font-bold text-slate-800">Lanjutkan Belajar</h2>
                  </div>
                  
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm font-semibold text-slate-800 md:text-base">
                      {isUtbkStudentProfile(dashboardData.student) ? `Persiapan ${getUtbkTrackLabel(dashboardData.student)}` : `Materi ${dashboardData.academicSummary.kelasLabel}`}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 md:text-sm">
                      {academicAccessMessage ?? "Mari lanjutkan materi dan selesaikan latihan soalmu hari ini."}
                    </p>

                    <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Link
                        href="/dashboard-siswa/materi"
                        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 hover:-translate-y-0.5"
                      >
                        <BookOpen className="h-4 w-4" />
                        Buka Materi
                      </Link>
                      <Link
                        href="/dashboard-siswa/tugas"
                        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-orange-200"
                      >
                        <FileText className="h-4 w-4" />
                        Kerjakan Latihan
                      </Link>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <Target className="h-4 w-4 text-slate-400" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Statistik Belajar</h3>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-orange-50/50 border border-orange-100 p-4">
                      <p className="text-2xl font-black text-orange-600">{dashboardData.academicSummary.materialCount}</p>
                      <p className="mt-1 text-[11px] font-medium text-orange-800 uppercase tracking-wide">Materi Tersedia</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                      <p className="text-2xl font-black text-slate-700">{dashboardData.academicSummary.taskCount}</p>
                      <p className="mt-1 text-[11px] font-medium text-slate-500 uppercase tracking-wide">Latihan Soal</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
