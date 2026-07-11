"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Clock3,
  ListChecks,
  Loader2,
  PlayCircle,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Target,
  TimerReset,
} from "lucide-react";

import { clearAuthClientState } from "@/lib/auth";
import { cn } from "@/lib/utils";

import {
  getStudentAcademicAccessMessage,
  type StudentAcademicAccess,
} from "../data/studentAcademicAccess";
import StudentLearningShell from "../learning/StudentLearningShell";
import { subscribeStudentDashboardRefresh } from "../student-dashboard-refresh-events";
import {
  type ActiveTryoutSession,
  type StudentTryoutItem,
  type StudentTryoutListResponse,
  buildSessionFromTryout,
  fetchStudentTryoutJson,
  normalizeText,
} from "./tryoutUtils";

function TryoutStatCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  tone?: "default" | "highlight";
}) {
  return (
    <section className="group rounded-[20px] border border-slate-100 bg-white px-4 py-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-orange-100">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            {label}
          </p>
          <p className="mt-3 text-lg font-semibold text-slate-800">{value}</p>
        </div>

        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border transition-colors duration-300",
            tone === "highlight"
              ? "border-orange-200 bg-orange-100 text-orange-700 group-hover:bg-white"
              : "border-slate-200 bg-slate-50 text-slate-500 group-hover:border-orange-100 group-hover:bg-orange-50 group-hover:text-orange-600",
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <p className="mt-2 text-sm leading-6 text-slate-500">{helper}</p>
    </section>
  );
}

function TryoutInstructionList({ items }: { items: string[] }) {
  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={item}
          className="flex items-start gap-3 rounded-[20px] border border-slate-100 bg-slate-50/60 px-4 py-3"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-orange-100 bg-white text-xs font-semibold text-orange-600">
            {index + 1}
          </div>
          <p className="text-sm leading-6 text-slate-600">{item}</p>
        </div>
      ))}
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-slate-200 bg-slate-50 text-slate-600">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">{title}</p>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyTryoutState({
  title,
  description,
  onRetry,
}: {
  title: string;
  description: string;
  onRetry: () => void;
}) {
  return (
    <section className="rounded-[24px] border border-dashed border-orange-200 bg-orange-50/30 px-5 py-12 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[18px] border border-orange-100 bg-white text-orange-500">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <h2 className="mt-4 text-base font-semibold text-slate-800">{title}</h2>
      <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-500">
        {description}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-orange-200 bg-white px-5 text-sm font-semibold text-orange-700 transition hover:bg-orange-50"
      >
        <RefreshCcw className="h-4 w-4" />
        Muat Ulang
      </button>
    </section>
  );
}

export default function TryoutSiswaPageView() {
  const router = useRouter();
  const [tryouts, setTryouts] = useState<StudentTryoutItem[]>([]);
  const [activeSession, setActiveSession] = useState<ActiveTryoutSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [academicAccess, setAcademicAccess] =
    useState<StudentAcademicAccess | null>(null);

  const totalQuestions = activeSession?.totalQuestions ?? 0;
  const academicAccessMessage =
    getStudentAcademicAccessMessage(academicAccess);
  const summaryText = isLoading
    ? "Memuat ujian"
    : `${tryouts.length} ujian published`;

  const loadTryoutList = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError(null);

      const { response, payload } =
        await fetchStudentTryoutJson<StudentTryoutListResponse>(
          "/api/student/me/tryouts",
          {
            method: "GET",
          },
        );

      if (response.status === 401) {
        clearAuthClientState();
      }

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Data ujian siswa belum bisa dimuat.");
      }

      const nextTryouts = payload.data?.tryouts ?? [];
      setTryouts(nextTryouts);
      setAcademicAccess(payload.data?.academicAccess ?? null);

      if (nextTryouts.length > 0) {
        const nextSession = buildSessionFromTryout(nextTryouts[0]);
        setActiveSession(nextSession);
      } else {
        setActiveSession(null);
      }
    } catch (error) {
      console.error("[tryout-siswa-page] load_tryouts_failed", error);
      setTryouts([]);
      setActiveSession(null);
      setAcademicAccess(null);
      setLoadError(
        error instanceof Error && error.message
          ? error.message
          : "Data ujian siswa belum bisa dimuat.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  function handleSelectAssessment(assessmentId: string) {
    const selectedAssessment = tryouts.find((item) => {
      const itemId = normalizeText(item.tryoutId) || normalizeText(item.id);
      return itemId === assessmentId;
    });

    if (!selectedAssessment) {
      return;
    }

    const nextSession = buildSessionFromTryout(selectedAssessment);
    setActiveSession(nextSession);
  }

  useEffect(() => {
    queueMicrotask(() => {
      void loadTryoutList();
    });
  }, [loadTryoutList]);

  useEffect(() => {
    return subscribeStudentDashboardRefresh(() => {
      void loadTryoutList();
    });
  }, [loadTryoutList]);

  async function handleStartTryout() {
    if (!activeSession || isDetailLoading) {
      return;
    }

    if (!activeSession.isOpen && !activeSession.myAttempt?.submitted) {
      window.alert(activeSession.availabilityMessage);
      return;
    }

    try {
      setIsDetailLoading(true);
      const { response, payload } =
        await fetchStudentTryoutJson<{
          success: boolean;
          message?: string;
          data?: { attemptId?: string };
        }>(
          `/api/student/me/exams/${encodeURIComponent(activeSession.id)}/start`,
          {
            method: "POST",
          },
        );

      if (response.status === 401) {
        clearAuthClientState();
      }

      const nextAttemptId = normalizeText(payload?.data?.attemptId);

      if (!response.ok || !payload?.success || !nextAttemptId) {
        throw new Error(
          payload?.message ||
            `Sesi ujian belum bisa dimulai. (Status: ${response.status})`,
        );
      }

      router.push(`/dashboard-siswa/ujian/${encodeURIComponent(nextAttemptId)}`);
    } catch (error) {
      console.error("[tryout-siswa-page] load_tryout_detail_failed", error);
      window.alert(
        error instanceof Error && error.message
          ? error.message
          : "Detail ujian belum bisa dimuat.",
      );
    } finally {
      setIsDetailLoading(false);
    }
  }

  return (
    <StudentLearningShell
      title="Ujian Siswa"
      description="Kerjakan UTS, UAS, atau Tryout dari data backend sesuai cabang dan kelas kamu. Soal, submit, dan hasilnya tersimpan real."
      summary={summaryText}
    >
      {isLoading ? (
        <section className="rounded-[24px] border border-slate-100 bg-white px-5 py-10 text-center shadow-sm">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-orange-500" />
          <p className="mt-3 text-sm font-semibold text-slate-700">
            Memuat ujian dari backend...
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Sistem sedang mencocokkan data siswa dengan cabang dan kelas.
          </p>
        </section>
      ) : loadError ? (
        <EmptyTryoutState
          title="Ujian belum bisa dimuat"
          description={loadError}
          onRetry={loadTryoutList}
        />
      ) : !activeSession ? (
        <EmptyTryoutState
          title="Belum ada ujian published untuk akun ini"
          description={
            academicAccessMessage ??
            "Siswa hanya melihat UTS, UAS, atau Tryout yang sudah dipublish guru dan cocok dengan cabang serta kelasnya."
          }
          onRetry={loadTryoutList}
        />
      ) : (
        <>
          {tryouts.length > 1 ? (
            <section className="rounded-[20px] border border-slate-100 bg-white p-4 shadow-sm">
              <label
                htmlFor="student-assessment-selector"
                className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400"
              >
                Pilih Ujian
              </label>
              <select
                id="student-assessment-selector"
                value={activeSession.id}
                onChange={(event) => handleSelectAssessment(event.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              >
                {tryouts.map((item) => {
                  const session = buildSessionFromTryout(item);

                  return (
                    <option key={session.id} value={session.id}>
                      {session.assessmentLabel} · {session.title} · {session.subject}
                    </option>
                  );
                })}
              </select>
            </section>
          ) : null}

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            <TryoutStatCard
              label="Durasi"
              value={`${activeSession.durationMinutes} menit`}
              helper={`Timer berjalan sejak ${activeSession.assessmentLabel} dimulai.`}
              icon={Clock3}
              tone="highlight"
            />
            <TryoutStatCard
              label="Jumlah Soal"
              value={`${totalQuestions} soal`}
              helper="Jumlah soal dibaca dari bank soal backend."
              icon={ListChecks}
            />
            <TryoutStatCard
              label="Cabang"
              value={activeSession.branch}
              helper={`${activeSession.assessmentLabel} difilter sesuai cabang dan kelas akun siswa.`}
              icon={Target}
              tone="highlight"
            />
            <TryoutStatCard
              label="Status"
              value={activeSession.availability}
              helper={activeSession.availabilityMessage}
              icon={ShieldCheck}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
            <section className="overflow-hidden rounded-[24px] border border-slate-100 bg-white shadow-sm">
              <div className="border-b border-slate-100 bg-orange-50/55 px-5 py-5 md:px-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-3xl">
                    <div className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-orange-600 shadow-sm">
                      <Sparkles className="h-4 w-4" />
                      Sesi CBT Backend
                    </div>
                    <h2 className="mt-4 text-2xl font-semibold text-slate-800 md:text-[30px]">
                      {activeSession.title}
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                      {activeSession.subject} untuk {activeSession.level} di
                      cabang {activeSession.branch}. Data ini sudah difilter
                      berdasarkan akun siswa yang login.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[20px] border border-slate-100 bg-white px-4 py-3 shadow-sm">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
                        Kode
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {activeSession.code}
                      </p>
                    </div>
                    <div className="rounded-[20px] border border-slate-100 bg-white px-4 py-3 shadow-sm">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
                        Jadwal
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {activeSession.schedule}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleStartTryout}
                    disabled={
                      isDetailLoading ||
                      (!activeSession.isOpen &&
                        !activeSession.myAttempt?.submitted)
                    }
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-orange-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-orange-200"
                  >
                    {isDetailLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <PlayCircle className="h-4 w-4" />
                    )}
                    {activeSession.myAttempt?.submitted
                      ? "Lihat Hasil"
                      : `Mulai ${activeSession.assessmentLabel}`}
                  </button>
                  <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                    <ShieldCheck className="h-4 w-4 text-orange-500" />
                    {activeSession.availabilityMessage}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 md:p-6">
                <div className="rounded-[20px] border border-slate-100 bg-slate-50/60 p-4">
                  <div className="flex items-center gap-2 text-orange-700">
                    <Target className="h-4 w-4" />
                    <p className="text-xs font-semibold uppercase tracking-[0.16em]">
                      Fokus Materi
                    </p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(activeSession.focusAreas.length
                      ? activeSession.focusAreas
                      : [activeSession.subject, activeSession.level]
                    ).map((area) => (
                      <span
                        key={area}
                        className="rounded-full border border-slate-100 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm"
                      >
                        {area}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-[20px] border border-slate-100 bg-slate-50/60 p-4">
                  <div className="flex items-center gap-2 text-orange-700">
                    <TimerReset className="h-4 w-4" />
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Ringkasan Sesi
                    </p>
                  </div>
                  <div className="mt-4 space-y-3">
                    {activeSession.pacingNotes.map((note) => (
                      <div
                        key={note.label}
                        className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-3 py-2.5 shadow-sm"
                      >
                        <span className="text-sm text-slate-500">{note.label}</span>
                        <span className="text-sm font-semibold text-slate-700">
                          {note.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <aside className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm md:p-6">
              <SectionHeader
                icon={ListChecks}
                title="Panduan Pengerjaan"
                description="Checklist singkat sebelum sesi dimulai agar pengerjaan lebih tenang dan rapi."
              />

              <TryoutInstructionList items={activeSession.instructions} />
            </aside>
          </div>
        </>
      )}
    </StudentLearningShell>
  );
}
