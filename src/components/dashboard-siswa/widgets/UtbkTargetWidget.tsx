"use client";

import {
  BookOpenCheck,
  Building2,
  Gauge,
  GraduationCap,
  Target,
  TrendingUp,
} from "lucide-react";

import {
  normalizeUtbkTryoutStage,
  UTBK_MAIN_TRYOUT_STAGE_COUNT,
} from "@/lib/utbk-tryout-stages";
import {
  useStudentTryouts,
  type StudentTryoutItem,
} from "../data/useStudentTryouts";
import type { StudentLearningProfile } from "../data/learning-types";

type UtbkTargetWidgetProps = {
  student: StudentLearningProfile | null;
  materialCount: number;
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

export default function UtbkTargetWidget({
  student,
  materialCount,
}: UtbkTargetWidgetProps) {
  const { tryouts, isLoading: isTryoutsLoading } = useStudentTryouts();
  const program = normalizeText(student?.program).toUpperCase();

  if (program !== "UTBK") {
    return null;
  }

  const targetKampus = normalizeText(student?.targetKampus);
  const targetJurusan = normalizeText(student?.targetJurusan);
  const utbkTrack = normalizeText(student?.utbkTrack) || "Program SNBT";
  const targetStatus =
    targetKampus && targetJurusan
      ? "Lengkap"
      : targetKampus || targetJurusan
        ? "Perlu dilengkapi"
        : "Belum diisi";
  const completedTryoutStages = new Set<number>();

  for (const tryout of tryouts.filter(isSubmittedTryout)) {
    const stage = normalizeUtbkTryoutStage(tryout.stage);

    if (stage !== null) {
      completedTryoutStages.add(stage);
    }
  }
  const bestScore = tryouts.reduce<number | null>((currentBest, tryout) => {
    const score = getAttemptScore(tryout);

    if (score === null) {
      return currentBest;
    }

    return currentBest === null ? score : Math.max(currentBest, score);
  }, null);
  const summaryItems = [
    {
      label: "Target",
      value: targetStatus,
    },
    {
      label: "Materi",
      value: `${materialCount} aktif`,
    },
    {
      label: "Tryout",
      value: isTryoutsLoading
        ? "Memuat"
        : `${completedTryoutStages.size}/${UTBK_MAIN_TRYOUT_STAGE_COUNT} selesai`,
    },
    {
      label: "Skor terbaik",
      value: isTryoutsLoading ? "Memuat" : bestScore !== null ? bestScore : "-",
    },
  ];

  return (
    <section className="overflow-hidden rounded-[24px] border border-white/70 bg-[linear-gradient(135deg,#0f172a_0%,#0f766e_48%,#f97316_100%)] p-[1px] shadow-[0_24px_54px_-38px_rgba(15,23,42,0.45)]">
      <div className="bg-white/90 px-5 py-5 backdrop-blur-xl md:px-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-700">
                <GraduationCap className="h-4 w-4" />
                {utbkTrack}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700">
                <Target className="h-4 w-4" />
                SNBT Intensif
              </span>
            </div>

            <h3 className="mt-4 text-xl font-black tracking-tight text-slate-900 md:text-2xl">
              Target UTBK kamu
            </h3>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-600">
              Fokus belajar diarahkan ke target kampus dan jurusan yang kamu incar.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[20px] border border-slate-200/70 bg-white/80 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-slate-500">
                  <Building2 className="h-4 w-4 text-cyan-600" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em]">
                    Kampus
                  </span>
                </div>
                <p className="mt-2 break-words text-base font-black text-slate-900">
                  {targetKampus || "Target kampus belum diisi"}
                </p>
              </div>

              <div className="rounded-[20px] border border-slate-200/70 bg-white/80 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-slate-500">
                  <BookOpenCheck className="h-4 w-4 text-orange-600" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em]">
                    Jurusan
                  </span>
                </div>
                <p className="mt-2 break-words text-base font-black text-slate-900">
                  {targetJurusan || "Target jurusan belum diisi"}
                </p>
              </div>
            </div>
          </div>

          <div className="w-full rounded-[22px] border border-white/70 bg-slate-950 px-5 py-5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] lg:max-w-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-100">
                  Status Target
                </p>
                <p className="mt-2 text-3xl font-black">{targetStatus}</p>
                <p className="mt-1 text-xs font-medium leading-5 text-slate-300">
                  Berdasarkan target, materi, dan tryout akun UTBK.
                </p>
              </div>
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-white/10 text-cyan-100">
                <Gauge className="h-7 w-7" />
              </div>
            </div>

            <div className="mt-5 space-y-2.5">
              {summaryItems.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm"
                >
                  <span className="font-medium text-slate-300">
                    {item.label}
                  </span>
                  <span className="text-right font-bold text-white">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-3 py-3 text-sm font-semibold text-slate-100">
              <TrendingUp className="h-4 w-4 text-emerald-300" />
              Rekap ini mengikuti data materi dan hasil tryout yang sudah
              terhubung ke akun siswa.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
