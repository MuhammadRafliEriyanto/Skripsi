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
