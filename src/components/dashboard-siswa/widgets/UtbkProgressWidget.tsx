"use client";

import Link from "next/link";
import {
  BookOpenCheck,
  Check,
  ChevronRight,
  Gauge,
  Target,
  TimerReset,
  TrendingUp,
} from "lucide-react";

import type { StudentDashboardData } from "../data/useStudentDashboardData";
import { useStudentTryouts, type StudentTryoutItem } from "../data/useStudentTryouts";
import { isUtbkStudentProfile } from "../data/studentProgram";
import {
  normalizeUtbkTryoutStage,
  UTBK_MAIN_TRYOUT_STAGE_COUNT,
  UTBK_TRYOUT_STAGE_META,
} from "@/lib/utbk-tryout-stages";

type UtbkProgressWidgetProps = {
  dashboardData: StudentDashboardData | null;
  dashboardLoading?: boolean;
};

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function isSubmittedTryout(tryout: StudentTryoutItem) {
  const attempt = tryout.myAttempt;

  return Boolean(
    attempt?.submitted ||
      attempt?.status === "submitted" ||
      normalizeText(attempt?.submittedAt),
  );
}

function getAttemptScore(tryout: StudentTryoutItem) {
  const score = tryout.myAttempt?.score;
  return typeof score === "number" && Number.isFinite(score) ? score : null;
}

function getAttemptDate(tryout: StudentTryoutItem) {
  const rawDate =
    tryout.myAttempt?.submittedAt ??
    tryout.myAttempt?.endedAt ??
    tryout.myAttempt?.startedAt ??
    tryout.startAt ??
    "";
  const date = new Date(rawDate);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export default function UtbkProgressWidget({
  dashboardData,
  dashboardLoading = false,
}: UtbkProgressWidgetProps) {
  const { tryouts, isLoading: isTryoutsLoading, loadError } = useStudentTryouts();
  const student = dashboardData?.student;

  if (!isUtbkStudentProfile(student)) {
    return null;
  }

  const targetKampus = normalizeText(student?.targetKampus);
  const targetJurusan = normalizeText(student?.targetJurusan);
  const materialCount = dashboardData?.academicSummary.materialCount ?? 0;
  const submittedTryouts = tryouts.filter(isSubmittedTryout);
  const stageProgress = UTBK_TRYOUT_STAGE_META.map((stage) => {
    const stageTryouts = submittedTryouts
      .filter((tryout) => normalizeUtbkTryoutStage(tryout.stage) === stage.stage)
      .sort((left, right) => getAttemptDate(right) - getAttemptDate(left));
    const latestStageTryout = stageTryouts[0] ?? null;

    return {
      ...stage,
      tryout: latestStageTryout,
      score: latestStageTryout ? getAttemptScore(latestStageTryout) : null,
      submittedAt: latestStageTryout ? getAttemptDate(latestStageTryout) : 0,
    };
  });
  const completedMainStageCount = stageProgress.filter(
    (stage) => stage.tryout,
  ).length;
  const scoredTryouts = submittedTryouts.reduce<
    Array<{ tryout: StudentTryoutItem; score: number; submittedAt: number }>
  >((items, tryout) => {
    if (!normalizeUtbkTryoutStage(tryout.stage)) {
      return items;
    }

    const score = getAttemptScore(tryout);

    if (score === null) {
      return items;
    }

    return [
      ...items,
      {
        tryout,
        score,
        submittedAt: getAttemptDate(tryout),
      },
    ];
  }, []);
  const latestScoredTryout = [...scoredTryouts].sort(
    (left, right) => right.submittedAt - left.submittedAt,
  )[0];
  const bestScore = scoredTryouts.length
    ? Math.max(...scoredTryouts.map((item) => item.score))
    : null;
  const isLoading = dashboardLoading || isTryoutsLoading;
  const targetStatus =
    targetKampus && targetJurusan
      ? "Lengkap"
      : targetKampus || targetJurusan
        ? "Perlu dilengkapi"
        : "Belum diisi";
  const summaryItems = [
    {
      label: "Target",
      value: isLoading ? "Memuat" : targetStatus,
    },
    {
      label: "Materi",
      value: isLoading ? "Memuat" : `${materialCount} aktif`,
    },
    {
      label: "Tryout",
      value: isLoading
        ? "Memuat"
        : `${completedMainStageCount}/${UTBK_MAIN_TRYOUT_STAGE_COUNT} selesai`,
    },
    {
      label: "Skor terbaik",
      value: isLoading ? "Memuat" : bestScore !== null ? bestScore.toString() : "-",
    },
  ];
  const stats = [
    {
      label: "Materi aktif",
      value: isLoading ? "-" : materialCount.toString(),
      detail: "Konten UTBK",
      icon: BookOpenCheck,
      color: "text-cyan-700",
      bg: "bg-cyan-50",
    },
    {
      label: "Tahap UTBK",
      value: isLoading
        ? "-"
        : `${completedMainStageCount}/${UTBK_MAIN_TRYOUT_STAGE_COUNT}`,
      detail: "Tryout utama",
      icon: TimerReset,
      color: "text-orange-700",
      bg: "bg-orange-50",
    },
    {
      label: "Skor terbaru",
      value: isLoading
        ? "-"
        : latestScoredTryout
          ? latestScoredTryout.score.toString()
          : "-",
      detail: "Dari tryout terkirim",
      icon: TrendingUp,
      color: "text-emerald-700",
      bg: "bg-emerald-50",
    },
    {
      label: "Skor terbaik",
      value: isLoading ? "-" : bestScore !== null ? bestScore.toString() : "-",
      detail: "Capaian tertinggi",
      icon: Target,
      color: "text-violet-700",
      bg: "bg-violet-50",
    },
  ];

  return (
    <section
      id="perkembangan-utbk"
      className="scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"
    >
      <div className="grid gap-0 lg:grid-cols-[minmax(0,0.84fr)_minmax(260px,0.42fr)]">
        <div className="p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-orange-600">
                Rekap Belajar UTBK
              </p>
              <h3 className="mt-1.5 text-lg font-semibold text-slate-900 md:text-xl">
                Ringkasan materi dan tryout
              </h3>
            </div>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-medium text-slate-600">
              {targetKampus || targetJurusan
                ? `${targetKampus || "Kampus"} - ${targetJurusan || "Jurusan"}`
                : "Target belum lengkap"}
            </div>
          </div>

          {loadError ? (
            <p className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
              {loadError}
            </p>
          ) : null}

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.label}
                  className="flex flex-col items-center rounded-2xl border border-slate-100 bg-white p-3 shadow-sm text-center transition hover:border-slate-200 hover:shadow-md"
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.bg} ${item.color}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="mt-3 text-[10px] sm:text-[11px] font-medium text-slate-500 whitespace-nowrap">
                    {item.label}
                  </p>
                  <p className="mt-1 text-xl sm:text-2xl font-semibold text-slate-800">
                    {item.value}
                  </p>
                  <p className="mt-1 text-[9px] sm:text-[10px] font-medium text-slate-400 whitespace-nowrap">
                    {item.detail}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {stageProgress.map((stage) => {
              const isDone = Boolean(stage.tryout);

              return (
                <div
                  key={stage.stage}
                  className={`relative flex flex-col justify-between rounded-2xl border px-3.5 py-3.5 shadow-sm transition hover:shadow-md ${
                    isDone
                      ? "border-emerald-100 bg-emerald-50/30"
                      : "border-slate-100 bg-white"
                  }`}
                >
                  <div>
                    <p className="text-[11px] sm:text-xs font-semibold text-slate-800 line-clamp-1">
                      {stage.label}
                    </p>
                    <p className="mt-1.5 mb-3 text-[10px] sm:text-[11px] font-medium leading-relaxed text-slate-500 line-clamp-2">
                      {stage.description}
                    </p>
                  </div>
                  <div>
                    {isDone ? (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2 py-1 text-[9px] sm:text-[10px] font-medium text-emerald-600 border border-emerald-100/50">
                        Skor {stage.score !== null ? stage.score : "-"}
                      </span>
                    ) : (
                      <span className="inline-flex rounded-lg bg-orange-50 px-2 py-1 text-[9px] sm:text-[10px] font-medium text-orange-600 border border-orange-100/50">
                        Belum selesai
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4">
            <Link
              href="/dashboard-siswa/ujian"
              className="flex w-full items-center justify-center rounded-2xl border border-orange-200 bg-white py-3 text-[11px] sm:text-xs font-semibold text-orange-600 transition hover:bg-orange-50 hover:border-orange-300"
            >
              Lihat semua tryout <ChevronRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <div className="border-t border-orange-600 bg-orange-500 p-5 md:p-6 text-white lg:border-t-0 lg:border-l relative overflow-hidden">
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-orange-100">
                  Status Data
                </p>
                <p className="mt-1.5 text-2xl font-semibold">
                  {isLoading ? "Memuat" : "Terhubung"}
                </p>
                <p className="mt-1.5 text-[11px] font-medium leading-relaxed text-orange-100">
                  Rekap mengikuti data target, materi, dan tryout siswa.
                </p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
                <Check className="h-5 w-5 text-orange-500" strokeWidth={3} />
              </div>
            </div>

            <div className="mt-6 space-y-2.5 text-sm flex-1">
              {summaryItems.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-3 rounded-[14px] bg-white px-3.5 py-3 shadow-sm"
                >
                  <span className="text-[11px] font-medium text-slate-500">
                    {item.label}
                  </span>
                  <span className="text-right text-[11px] font-semibold text-slate-800">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
