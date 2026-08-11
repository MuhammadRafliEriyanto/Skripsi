"use client";

import { useMemo, useState } from "react";
import {
  BarChart2,
  BarChart3,
  BookOpen,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Eye,
  ListChecks,
  Sparkles,
  Star,
  Target,
  TimerReset,
  TrendingUp,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

import { useStudentLearningData } from "../data/useStudentLearningData";
import { useStudentTryouts, type StudentTryoutItem } from "../data/useStudentTryouts";
import { getStudentAcademicAccessMessage } from "../data/studentAcademicAccess";
import { isUtbkStudentProfile } from "../data/studentProgram";
import type { StudentAcademicSummary, StudentTask } from "../data/learning-types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  normalizeUtbkTryoutStage,
  UTBK_MAIN_TRYOUT_STAGE_COUNT,
  UTBK_TRYOUT_STAGE_META,
} from "@/lib/utbk-tryout-stages";
import { formatUtbkSubjectLabel } from "@/lib/utbk-subjects";
import { cn } from "@/lib/utils";

function formatGradedTime(value: string | null) {
  if (!value) {
    return "-";
  }

  const gradedDate = new Date(value);

  if (Number.isNaN(gradedDate.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(gradedDate);
}

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

function getTryoutScore(tryout: StudentTryoutItem) {
  const score = tryout.myAttempt?.score;
  return typeof score === "number" && Number.isFinite(score) ? score : null;
}

function getTryoutDateValue(tryout: StudentTryoutItem) {
  const rawDate =
    tryout.myAttempt?.submittedAt ??
    tryout.myAttempt?.endedAt ??
    tryout.myAttempt?.startedAt ??
    tryout.startAt ??
    "";
  const date = new Date(rawDate);

  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatTryoutDate(value: number) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function averageScores(values: number[]) {
  if (!values.length) {
    return null;
  }

  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function getUtbkReadinessStatus(bestScore: number | null, completedStageCount: number) {
  if (bestScore === null || completedStageCount === 0) {
    return "Belum Ada Nilai";
  }

  if (bestScore < 60) {
    return "Perlu Penguatan";
  }

  if (completedStageCount >= 3) {
    return "Data Lengkap";
  }

  return "Sebagian Terisi";
}

function getReadinessClassName(status: string) {
  if (status === "Data Lengkap") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "Sebagian Terisi") {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }

  if (status === "Perlu Penguatan") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function UtbkScoreCard({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: typeof Trophy;
}) {
  return (
    <article className="rounded-[22px] border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            {label}
          </p>
          <p className="mt-3 text-2xl font-black text-slate-950">{value}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-500">{helper}</p>
    </article>
  );
}

function UtbkNilaiView({
  isLoading,
  academicAccessMessage,
  profileLoadError,
}: {
  isLoading: boolean;
  academicAccessMessage: string | null;
  profileLoadError: string | null;
}) {
  const {
    tryouts,
    academicAccess,
    isLoading: isTryoutsLoading,
    loadError: tryoutsLoadError,
  } = useStudentTryouts();
  const studentAcademicAccessMessage =
    getStudentAcademicAccessMessage(academicAccess);
  const isDataLoading = isLoading || isTryoutsLoading;
  const submittedTryouts = tryouts.filter(isSubmittedTryout);
  const stageProgress = UTBK_TRYOUT_STAGE_META.map((stage) => {
    const stageTryouts = submittedTryouts
      .filter((tryout) => normalizeUtbkTryoutStage(tryout.stage) === stage.stage)
      .sort((left, right) => getTryoutDateValue(right) - getTryoutDateValue(left));
    const latestTryout = stageTryouts[0] ?? null;

    return {
      ...stage,
      tryout: latestTryout,
      score: latestTryout ? getTryoutScore(latestTryout) : null,
      submittedAt: latestTryout ? getTryoutDateValue(latestTryout) : 0,
    };
  });
  const completedStages = stageProgress.filter((stage) => stage.tryout);
  const availableScores = stageProgress
    .map((stage) => stage.score)
    .filter((score): score is number => typeof score === "number");
  const latestStage = [...completedStages].sort(
    (left, right) => right.submittedAt - left.submittedAt,
  )[0];
  const latestScore = latestStage?.score ?? null;
  const bestScore = availableScores.length ? Math.max(...availableScores) : null;
  const averageScore = averageScores(availableScores);
  const readinessStatus = getUtbkReadinessStatus(
    bestScore,
    completedStages.length,
  );
  const loadError = profileLoadError ?? academicAccessMessage ?? studentAcademicAccessMessage ?? tryoutsLoadError;

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <div className="flex flex-col gap-4 rounded-[28px] border border-slate-100 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between md:p-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-600">
            Hasil Nilai UTBK/SNBT
          </p>
          <h1 className="mt-2 text-xl font-semibold text-slate-900 md:text-2xl">
            Rekap Nilai Tryout UTBK
          </h1>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
            Nilai UTBK ditampilkan berdasarkan Tryout UTBK 1, Tryout UTBK 2,
            dan Tryout UTBK 3 yang sudah dikerjakan. Latihan reguler tidak
            ditampilkan untuk akun UTBK.
          </p>
        </div>
        <span
          className={cn(
            "inline-flex w-fit rounded-full border px-3 py-1.5 text-xs font-bold",
            getReadinessClassName(readinessStatus),
          )}
        >
          {readinessStatus}
        </span>
      </div>

      {isDataLoading ? (
        <section className="rounded-[26px] border border-slate-100 bg-white p-8 text-center shadow-sm">
          <p className="text-base font-semibold text-slate-800">
            Data nilai UTBK sedang dimuat
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Sistem sedang membaca hasil tryout yang sudah kamu submit.
          </p>
        </section>
      ) : loadError && tryouts.length === 0 ? (
        <section className="rounded-[26px] border border-amber-100 bg-amber-50 p-8 text-center shadow-sm">
          <p className="text-base font-semibold text-amber-800">
            Nilai UTBK belum bisa dimuat
          </p>
          <p className="mt-2 text-sm text-amber-700">{loadError}</p>
        </section>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <UtbkScoreCard
              label="Tahap selesai"
              value={`${completedStages.length}/${UTBK_MAIN_TRYOUT_STAGE_COUNT}`}
              helper="Tahap utama yang sudah dikerjakan."
              icon={CheckCircle2}
            />
            <UtbkScoreCard
              label="Skor terbaru"
              value={latestScore !== null ? latestScore.toString() : "-"}
              helper={latestStage ? latestStage.label : "Belum ada tryout selesai."}
              icon={TrendingUp}
            />
            <UtbkScoreCard
              label="Skor terbaik"
              value={bestScore !== null ? bestScore.toString() : "-"}
              helper="Skor tertinggi dari tryout utama."
              icon={Trophy}
            />
            <UtbkScoreCard
              label="Rata-rata"
              value={averageScore !== null ? averageScore.toString() : "-"}
              helper="Rata-rata skor tahap yang sudah selesai."
              icon={Target}
            />
          </div>

          <section className="rounded-[26px] border border-slate-100 bg-white p-5 shadow-sm md:p-6">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-600">
                  Rincian Tryout
                </p>
                <h2 className="mt-2 text-lg font-semibold text-slate-800">
                  Tryout UTBK 1, 2, dan 3
                </h2>
              </div>
              <Link
                href="/dashboard-siswa/ujian"
                className="inline-flex h-11 w-fit items-center justify-center gap-2 rounded-2xl bg-orange-600 px-4 text-sm font-semibold text-white transition hover:bg-orange-700"
              >
                <TimerReset className="h-4 w-4" />
                Buka Tryout
              </Link>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {stageProgress.map((stage) => {
                const isDone = Boolean(stage.tryout);

                return (
                  <article
                    key={stage.stage}
                    className={cn(
                      "rounded-[22px] border p-5",
                      isDone
                        ? "border-emerald-100 bg-emerald-50/50"
                        : "border-slate-100 bg-slate-50/70",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-slate-900">
                          {stage.label}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {stage.description}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[11px] font-bold",
                          isDone
                            ? "border-emerald-200 bg-white text-emerald-700"
                            : "border-slate-200 bg-white text-slate-500",
                        )}
                      >
                        {isDone ? "Selesai" : "Belum"}
                      </span>
                    </div>

                    <div className="mt-5 rounded-2xl border border-white/80 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Nilai
                      </p>
                      <p className="mt-2 text-3xl font-black text-slate-950">
                        {stage.score !== null ? stage.score : "-"}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        {isDone
                          ? formatTryoutDate(stage.submittedAt)
                          : "Kerjakan tryout ini untuk menampilkan nilai."}
                      </p>
                    </div>

                    {stage.tryout ? (
                      <div className="mt-4 text-xs leading-5 text-slate-500">
                        <p className="font-semibold text-slate-700">
                          {stage.tryout.title || "Tryout UTBK"}
                        </p>
                        <p>
                          {stage.tryout.subject
                            ? formatUtbkSubjectLabel(stage.tryout.subject)
                            : "Materi SNBT"}
                        </p>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}
    </section>
  );
}

const REGULAR_MEETING_COUNT = 24;
const RESULT_DROPDOWN_LATEST = "latest";

type MeetingStatus = "mastered" | "remedial" | "waiting" | "available" | "empty";

type LearningProgressGroup = {
  id: string;
  subject: string;
  className: string;
  tasks: StudentTask[];
};

type MeetingSlot = {
  meetingNumber: number;
  label: string;
  task: StudentTask | null;
  score: number | null;
  status: MeetingStatus;
  statusLabel: string;
};

function toSafeMeetingNumber(value: number) {
  return Number.isFinite(value)
    ? Math.min(Math.max(Math.round(value), 1), REGULAR_MEETING_COUNT)
    : 1;
}

function getTaskScore(task: StudentTask | null | undefined) {
  const score = task?.myGrade?.score;
  return typeof score === "number" && Number.isFinite(score) ? score : null;
}

function getMeetingStatus(task: StudentTask | null): MeetingStatus {
  if (!task) {
    return "empty";
  }

  const score = getTaskScore(task);

  if (
    task.myGrade?.status === "Perlu Remedial" ||
    task.isRemedial ||
    (typeof score === "number" && score < 70)
  ) {
    return "remedial";
  }

  if (task.myGrade?.graded || typeof score === "number") {
    return "mastered";
  }

  if (task.mySubmission?.submitted) {
    return "waiting";
  }

  return "available";
}

function getMeetingStatusLabel(status: MeetingStatus) {
  switch (status) {
    case "mastered":
      return "Tuntas";
    case "remedial":
      return "Remedial";
    case "waiting":
      return "Menunggu nilai";
    case "available":
      return "Belum dikerjakan";
    default:
      return "Belum ada latihan";
  }
}

function buildMeetingSlots(tasks: StudentTask[]) {
  const taskByMeeting = new Map<number, StudentTask>();

  for (const task of tasks) {
    const meetingNumber = toSafeMeetingNumber(task.pertemuan);
    const currentTask = taskByMeeting.get(meetingNumber);
    const currentTime = currentTask?.myGrade?.gradedAt
      ? new Date(currentTask.myGrade.gradedAt).getTime()
      : 0;
    const nextTime = task.myGrade?.gradedAt
      ? new Date(task.myGrade.gradedAt).getTime()
      : 0;

    if (!currentTask || nextTime >= currentTime) {
      taskByMeeting.set(meetingNumber, task);
    }
  }

  return Array.from({ length: REGULAR_MEETING_COUNT }, (_, index) => {
    const meetingNumber = index + 1;
    const task = taskByMeeting.get(meetingNumber) ?? null;
    const status = getMeetingStatus(task);

    return {
      meetingNumber,
      label: `P${meetingNumber}`,
      task,
      score: getTaskScore(task),
      status,
      statusLabel: getMeetingStatusLabel(status),
    } satisfies MeetingSlot;
  });
}

function getProgressRingOffset(progressPercent: number) {
  const circumference = 2 * Math.PI * 48;
  return circumference - (Math.min(Math.max(progressPercent, 0), 100) / 100) * circumference;
}

function getSlotClassName(status: MeetingStatus) {
  switch (status) {
    case "mastered":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "remedial":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "waiting":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "available":
      return "border-slate-200 bg-white text-slate-600";
    default:
      return "border-slate-100 bg-slate-50 text-slate-300";
  }
}

function getBarClassName(status: MeetingStatus) {
  switch (status) {
    case "mastered":
      return "bg-emerald-500";
    case "remedial":
      return "bg-amber-500";
    case "waiting":
      return "bg-sky-400";
    case "available":
      return "bg-slate-300";
    default:
      return "bg-slate-100";
  }
}

function getResultPanelClassName(status: MeetingStatus) {
  switch (status) {
    case "mastered":
      return "border-emerald-100 bg-emerald-50/70";
    case "remedial":
      return "border-amber-100 bg-amber-50/80";
    case "waiting":
      return "border-sky-100 bg-sky-50/80";
    default:
      return "border-slate-100 bg-slate-50/80";
  }
}

function getResultAdvice(slot: MeetingSlot) {
  if (!slot.task) {
    return "Guru belum membuka latihan untuk pertemuan ini.";
  }

  if (slot.status === "remedial") {
    return "Nilai latihan belum mencapai target 70. Guru bisa menyarankan remedial agar pemahaman naik.";
  }

  if (slot.status === "mastered") {
    return "Latihan sudah tuntas. Gunakan catatan pembahasan untuk menguatkan materi.";
  }

  if (slot.status === "waiting") {
    return "Latihan sudah dikerjakan dan sedang menunggu hasil tersimpan.";
  }

  return "Latihan tersedia. Kerjakan CBT untuk memperbarui progres belajar.";
}

function formatScoreLabel(value: number | null) {
  return typeof value === "number" ? value.toString() : "-";
}

function getSubmittedTaskAttemptId(task: StudentTask | null | undefined) {
  const attempt = task?.myAttempt;

  if (!attempt?.submitted) {
    return "";
  }

  return normalizeText(attempt.attemptId);
}

function buildLearningGroups(
  tasks: StudentTask[],
  summaries: StudentAcademicSummary[],
) {
  const groupsBySubjectAndClass = new Map<string, LearningProgressGroup>();

  function getGroupKey(subject: string, className: string) {
    const s = normalizeText(subject) || "Mapel belum diatur";
    const c = normalizeText(className) || "Kelas belum diatur";
    return `${s} - ${c}`;
  }

  for (const summary of summaries) {
    const key = getGroupKey(summary.subject, summary.className);
    if (!groupsBySubjectAndClass.has(key)) {
      groupsBySubjectAndClass.set(key, {
        id: normalizeText(summary.classId) || key,
        subject: normalizeText(summary.subject) || "Mapel belum diatur",
        className: normalizeText(summary.className) || "Kelas belum diatur",
        tasks: [],
      });
    }
  }

  for (const task of tasks) {
    const key = getGroupKey(task.mapel, task.className);
    
    let currentGroup = groupsBySubjectAndClass.get(key);
    if (!currentGroup) {
      currentGroup = {
        id: normalizeText(task.classId) || key,
        subject: normalizeText(task.mapel) || "Mapel belum diatur",
        className: normalizeText(task.className) || "Kelas belum diatur",
        tasks: [],
      };
      groupsBySubjectAndClass.set(key, currentGroup);
    }
    
    currentGroup.tasks.push(task);
  }

  return Array.from(groupsBySubjectAndClass.values()).map((group) => ({
    ...group,
    tasks: [...group.tasks].sort(
      (left, right) => left.pertemuan - right.pertemuan,
    ),
  }));
}

function NilaiSiswaPageContent() {
  const { student, academicSummaries, tasks, academicAccess, isLoading, loadError } =
    useStudentLearningData();
  const academicAccessMessage =
    getStudentAcademicAccessMessage(academicAccess);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedResultKey, setSelectedResultKey] = useState(RESULT_DROPDOWN_LATEST);
  const isUtbkStudent = isUtbkStudentProfile(student);

  const learningGroups = useMemo(
    () => buildLearningGroups(tasks, academicSummaries),
    [academicSummaries, tasks],
  );
  const selectedGroup =
    learningGroups.find((group) => group.id === selectedClassId) ??
    learningGroups[0] ??
    null;
  const meetingSlots = useMemo(
    () => buildMeetingSlots(selectedGroup?.tasks ?? []),
    [selectedGroup],
  );
  const gradedSlots = meetingSlots.filter((slot) => typeof slot.score === "number");
  const masteredSlots = gradedSlots.filter((slot) => slot.status === "mastered");
  const remedialSlots = gradedSlots.filter((slot) => slot.status === "remedial");
  const waitingSlots = meetingSlots.filter((slot) => slot.status === "waiting");
  const averageScore = gradedSlots.length
    ? Math.round(
        gradedSlots.reduce((total, slot) => total + (slot.score ?? 0), 0) /
          gradedSlots.length,
      )
    : null;
  const progressPercent = Math.round(
    (gradedSlots.length / REGULAR_MEETING_COUNT) * 100,
  );
  const masteryPercent = Math.round(
    (masteredSlots.length / REGULAR_MEETING_COUNT) * 100,
  );
  const latestResultSlot =
    [...gradedSlots].sort((left, right) => right.meetingNumber - left.meetingNumber)[0] ??
    meetingSlots.find((slot) => slot.task) ??
    meetingSlots[0];
  const selectedResultSlot =
    selectedResultKey === RESULT_DROPDOWN_LATEST
      ? latestResultSlot
      : meetingSlots.find(
          (slot) => `p-${slot.meetingNumber}` === selectedResultKey,
        ) ?? latestResultSlot;
  const ringOffset = getProgressRingOffset(masteryPercent);

  if (!isLoading && isUtbkStudent) {
    return (
      <UtbkNilaiView
        isLoading={isLoading}
        academicAccessMessage={academicAccessMessage}
        profileLoadError={loadError}
      />
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <div className="relative overflow-hidden rounded-[28px] border border-slate-100 bg-white p-5 shadow-sm md:p-8">
        <div className="absolute inset-0 bg-gradient-to-br from-white via-blue-50/20 to-orange-50/30"></div>
        
        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-orange-600">
              STATISTIK BELAJAR
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900 md:text-3xl">
              Progres Latihan P1-P24
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Pantau kemajuan belajar pertemuanmu. Nilai & status P10 dst akan tersedia
              setelah pertemuan berlangsung. Tetap konsisten belajar agar target penguasaan
              materi tercapai dan kamu semakin siap meraih hasil terbaik! 💪
            </p>
          </div>

          <div className="hidden shrink-0 md:block lg:absolute lg:right-10 lg:bottom-0">
            <Image 
              src="/images/header-illustration.png" 
              alt="Ilustrasi Belajar" 
              width={240} 
              height={200} 
              className="h-auto w-48 object-contain lg:w-60"
              priority
            />
          </div>

          <div className="flex shrink-0 lg:absolute lg:right-8 lg:top-8">
            <Link
              href="/dashboard-siswa/laporan"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-orange-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700"
            >
              <BarChart2 className="h-4 w-4" />
              Lihat Laporan
            </Link>
          </div>
        </div>
      </div>

      {isLoading ? (
        <section className="rounded-[26px] border border-slate-100 bg-white p-8 text-center shadow-sm">
          <p className="text-base font-semibold text-slate-800">
            Data progres sedang dimuat
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Sistem sedang mengambil hasil latihan CBT terbaru kamu...
          </p>
        </section>
      ) : learningGroups.length === 0 ? (
        <section className="rounded-[26px] border border-slate-100 bg-white p-8 text-center shadow-sm">
          <p className="text-base font-semibold text-slate-800">
            Belum ada hasil latihan
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {academicAccessMessage ??
              loadError ??
              "Guru belum memberikan latihan CBT untuk membership aktif kamu."}
          </p>
        </section>
      ) : selectedGroup ? (
        <>
          <section className="rounded-[26px] border border-slate-100 bg-white p-5 shadow-sm md:p-6">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.52fr)]">
              <div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs font-semibold text-slate-500">
                      Pilih mata pelajaran
                    </p>
                    <Select
                      value={selectedGroup.id}
                      onValueChange={(value) => {
                        setSelectedClassId(value);
                        setSelectedResultKey(RESULT_DROPDOWN_LATEST);
                      }}
                    >
                      <SelectTrigger className="pl-10">
                        <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                          <BookOpen className="h-4 w-4 text-blue-500" />
                        </div>
                        <SelectValue placeholder="Pilih mata pelajaran" />
                      </SelectTrigger>
                      <SelectContent>
                        {learningGroups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.subject} - {group.className}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold text-slate-500">
                      Pilih hasil latihan
                    </p>
                    <Select
                      value={selectedResultKey}
                      onValueChange={setSelectedResultKey}
                    >
                      <SelectTrigger className="pl-10">
                        <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                          <Star className="h-4 w-4 text-emerald-500" />
                        </div>
                        <SelectValue placeholder="Pilih hasil latihan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={RESULT_DROPDOWN_LATEST}>
                          Hasil latihan terbaru
                        </SelectItem>
                        {meetingSlots.map((slot) => (
                          <SelectItem
                            key={slot.meetingNumber}
                            value={`p-${slot.meetingNumber}`}
                          >
                            {slot.label} - {slot.task?.judul ?? slot.statusLabel}{" "}
                            {slot.score !== null ? `(${slot.score})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div
                  className={`mt-5 relative overflow-hidden rounded-[24px] border p-5 ${getResultPanelClassName(
                    selectedResultSlot.status,
                  )}`}
                >
                  <div className="flex flex-col gap-6 md:flex-row">
                    <div className="hidden shrink-0 md:block w-32 relative">
                      <Image
                        src="/images/girl-checklist.png"
                        alt="Progres Latihan"
                        fill
                        className="object-contain object-bottom"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-lime-400 text-white">
                              <span className="h-2 w-2 rounded-full bg-white"></span>
                            </span>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-600">
                              {selectedResultSlot.label}
                            </p>
                          </div>
                          <h2 className="mt-2 text-xl font-bold text-slate-900">
                            {selectedResultSlot.task?.judul ?? "Latihan belum tersedia"}
                          </h2>
                          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                            {getResultAdvice(selectedResultSlot)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-4 sm:flex-col sm:items-end sm:gap-1">
                          <p className="text-xs font-semibold text-slate-500">Nilai</p>
                          <div className="flex items-center gap-3">
                            <p className="text-4xl font-black text-slate-950">
                              {formatScoreLabel(selectedResultSlot.score)}
                            </p>
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${getSlotClassName(
                                selectedResultSlot.status,
                              )}`}
                            >
                              {selectedResultSlot.status === "mastered" ? <Trophy className="h-3.5 w-3.5" /> : null}
                              {selectedResultSlot.statusLabel}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 grid gap-3 grid-cols-3">
                        <div className="flex flex-col justify-between rounded-2xl border border-white/80 bg-white/75 p-4 shadow-sm">
                          <div className="flex items-start justify-between">
                            <p className="text-xs font-semibold text-slate-500">Dikerjakan</p>
                            <ClipboardList className="h-5 w-5 text-orange-400 opacity-50" />
                          </div>
                          <p className="mt-3 text-xl font-black text-slate-900">
                            {gradedSlots.length}/{REGULAR_MEETING_COUNT}
                          </p>
                        </div>
                        <div className="flex flex-col justify-between rounded-2xl border border-white/80 bg-white/75 p-4 shadow-sm">
                          <div className="flex items-start justify-between">
                            <p className="text-xs font-semibold text-slate-500">Tuntas</p>
                            <CheckSquare className="h-5 w-5 text-emerald-500 opacity-50" />
                          </div>
                          <p className="mt-3 text-xl font-black text-emerald-700">
                            {masteredSlots.length}
                          </p>
                        </div>
                        <div className="flex flex-col justify-between rounded-2xl border border-white/80 bg-white/75 p-4 shadow-sm">
                          <div className="flex items-start justify-between">
                            <p className="text-xs font-semibold text-slate-500">Remedial</p>
                            <Target className="h-5 w-5 text-amber-500 opacity-50" />
                          </div>
                          <p className="mt-3 text-xl font-black text-amber-700">
                            {remedialSlots.length}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm">
                <div className="relative flex items-center justify-center py-4">
                  <div className="absolute left-1/2 top-0 h-10 w-10 -translate-x-14 -translate-y-2 opacity-50">
                    <Sparkles className="h-6 w-6 text-orange-300" />
                  </div>
                  <div className="absolute right-1/2 top-4 h-10 w-10 translate-x-12 translate-y-6 opacity-30">
                    <Star className="h-4 w-4 text-orange-400" />
                  </div>
                  <div className="relative h-40 w-40">
                    <svg
                      className="h-full w-full -rotate-90 transform"
                      viewBox="0 0 100 100"
                    >
                      <circle
                        className="text-slate-100"
                        strokeWidth="10"
                        stroke="currentColor"
                        fill="transparent"
                        r="48"
                        cx="50"
                        cy="50"
                      />
                      <circle
                        className="text-orange-500 transition-all duration-1000 ease-in-out"
                        strokeWidth="10"
                        strokeDasharray={2 * Math.PI * 48}
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="transparent"
                        r="48"
                        cx="50"
                        cy="50"
                        strokeDashoffset={ringOffset}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <p className="text-3xl font-black text-slate-950">
                        {masteryPercent}%
                      </p>
                      <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-orange-600">
                        Mastery
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                      <BarChart3 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-500">Rata-rata</p>
                      <p className="text-xl font-black text-slate-900">
                        {averageScore ?? "-"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                      <ClipboardCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-500">Total Latihan</p>
                      <p className="text-xl font-black text-slate-900">
                        {gradedSlots.length} <span className="text-sm font-medium text-slate-400">/ 24</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[26px] border border-slate-100 bg-white p-5 shadow-sm md:p-6">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-600">
                  Diagram Progres
                </p>
                <h2 className="mt-2 text-lg font-semibold text-slate-800">
                  Jalur Belajar {selectedGroup.subject} P1-P24
                </h2>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                <span className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700">
                  <CheckSquare className="h-3.5 w-3.5" />
                  <div className="text-left leading-tight">
                    <p>Tuntas</p>
                    <p className="text-[9px] font-medium opacity-80">Materi dikuasai dengan baik</p>
                  </div>
                </span>
                <span className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-800">
                  <Target className="h-3.5 w-3.5" />
                  <div className="text-left leading-tight">
                    <p>Remedial</p>
                    <p className="text-[9px] font-medium opacity-80">Perlu penguatan materi</p>
                  </div>
                </span>
                <span className="flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-1.5 text-sky-700">
                  <Clock className="h-3.5 w-3.5" />
                  <div className="text-left leading-tight">
                    <p>Menunggu</p>
                    <p className="text-[9px] font-medium opacity-80">Belum tersedia / akan datang</p>
                  </div>
                </span>
              </div>
            </div>

            <div className="relative mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 before:absolute before:inset-x-0 before:top-1/2 before:-z-10 before:border-t-2 before:border-dashed before:border-slate-200">
              {meetingSlots.map((slot) => (
                <button
                  key={slot.meetingNumber}
                  type="button"
                  title={`${slot.label}: ${slot.task?.judul ?? slot.statusLabel}`}
                  onClick={() => setSelectedResultKey(`p-${slot.meetingNumber}`)}
                  className={`group relative flex h-20 w-16 shrink-0 snap-start flex-col items-center justify-center rounded-[20px] border-2 bg-white transition hover:-translate-y-1 hover:shadow-md ${
                    slot.status === "mastered"
                      ? "border-emerald-200"
                      : slot.status === "remedial"
                        ? "border-amber-200"
                        : slot.status === "waiting"
                          ? "border-sky-200"
                          : "border-slate-100"
                  }`}
                >
                  <span
                    className={`text-xs font-black ${
                      slot.status === "mastered"
                        ? "text-emerald-700"
                        : slot.status === "remedial"
                          ? "text-amber-800"
                          : slot.status === "waiting"
                            ? "text-sky-700"
                            : "text-slate-300"
                    }`}
                  >
                    {slot.label}
                  </span>
                  <span
                    className={`mt-1 text-[11px] font-semibold ${
                      slot.status === "mastered"
                        ? "text-emerald-600"
                        : slot.status === "remedial"
                          ? "text-amber-700"
                          : slot.status === "waiting"
                            ? "text-sky-600"
                            : "text-slate-300"
                    }`}
                  >
                    {slot.status === "available" || slot.status === "empty" ? "-" : formatScoreLabel(slot.score)}
                  </span>
                  {slot.status === "mastered" && (
                    <div className="absolute -bottom-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white ring-4 ring-white">
                      <Check className="h-3 w-3 stroke-[3]" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-[26px] border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-6 md:px-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-600">
                    Riwayat Latihan
                  </p>
                  <h2 className="mt-2 text-lg font-semibold text-slate-800">
                    {selectedGroup.subject} - {selectedGroup.className}
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <button className="flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-orange-700">
                    <ListChecks className="h-3.5 w-3.5" />
                    Semua
                  </button>
                  <button className="flex items-center gap-1.5 rounded-full border border-slate-100 bg-white px-3 py-1.5 text-emerald-700 opacity-60 transition hover:opacity-100">
                    <CheckSquare className="h-3.5 w-3.5" />
                    Tuntas
                  </button>
                  <button className="flex items-center gap-1.5 rounded-full border border-slate-100 bg-white px-3 py-1.5 text-amber-700 opacity-60 transition hover:opacity-100">
                    <Target className="h-3.5 w-3.5" />
                    Remedial
                  </button>
                  <button className="flex items-center gap-1.5 rounded-full border border-slate-100 bg-white px-3 py-1.5 text-sky-700 opacity-60 transition hover:opacity-100">
                    <Clock className="h-3.5 w-3.5" />
                    Menunggu
                  </button>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2">
                  <span className="text-xl font-black text-orange-600">{gradedSlots.length}</span>
                  <div className="text-[10px] uppercase leading-tight text-slate-500">
                    <p>Total</p>
                    <p>Latihan</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2">
                  <span className="text-xl font-black text-emerald-600">{masteredSlots.length}</span>
                  <span className="text-[10px] font-bold uppercase text-slate-500">Tuntas</span>
                </div>
                <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2">
                  <span className="text-xl font-black text-amber-500">{remedialSlots.length}</span>
                  <span className="text-[10px] font-bold uppercase text-slate-500">Remedial</span>
                </div>
                <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2">
                  <span className="text-xl font-black text-sky-500">{waitingSlots.length}</span>
                  <span className="text-[10px] font-bold uppercase text-slate-500">Menunggu</span>
                </div>
                <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2">
                  <Star className="h-5 w-5 text-purple-400" />
                  <span className="text-xl font-black text-purple-950">{averageScore ?? "-"}</span>
                  <span className="text-[10px] font-bold uppercase text-slate-500">Rata-rata</span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[940px] text-left text-sm text-slate-600">
                <thead className="bg-slate-50/50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Pertemuan</th>
                    <th className="w-1/3 px-6 py-4 font-semibold">Latihan</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 text-center font-semibold">Nilai</th>
                    <th className="px-6 py-4 font-semibold">Catatan</th>
                    <th className="px-6 py-4 text-center font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {meetingSlots.map((slot) => {
                    const submittedAttemptId = getSubmittedTaskAttemptId(slot.task);

                    return (
                      <tr key={slot.meetingNumber} className="group transition-colors hover:bg-slate-50/50">
                        <td className="px-6 py-4 font-semibold text-slate-800">
                          <div className={`flex h-12 w-12 items-center justify-center rounded-full border-2 bg-white ${
                            slot.status === "mastered" ? "border-emerald-200 text-emerald-700" :
                            slot.status === "remedial" ? "border-amber-200 text-amber-700" :
                            slot.status === "waiting" ? "border-sky-200 text-sky-700" :
                            "border-slate-100 text-slate-400"
                          }`}>
                            {slot.label}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {slot.task ? (
                            <Link
                              href={slot.task.detailHref}
                              className="font-semibold text-slate-800 transition hover:text-orange-600"
                            >
                              {slot.task.judul}
                            </Link>
                          ) : (
                            <span className="text-slate-400">Belum ada latihan</span>
                          )}
                          <p className="mt-1 line-clamp-1 text-xs text-slate-500">
                            {slot.task?.deskripsi ?? "-"}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getSlotClassName(
                              slot.status,
                            )}`}
                          >
                            {slot.statusLabel}
                          </span>
                          {slot.task?.myGrade?.gradedAt ? (
                            <p className="mt-1.5 text-xs text-slate-500">
                              {formatGradedTime(slot.task.myGrade.gradedAt)}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-flex h-10 min-w-12 items-center justify-center rounded-xl border font-bold ${getSlotClassName(
                              slot.status,
                            )}`}
                          >
                            {formatScoreLabel(slot.score)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="line-clamp-3 text-xs leading-5 text-slate-600">
                            {slot.task?.myGrade?.note || getResultAdvice(slot)}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {submittedAttemptId ? (
                            <Link
                              href={`/dashboard-siswa/latihan/${encodeURIComponent(
                                submittedAttemptId,
                              )}/cbt`}
                              aria-label={`Lihat detail soal ${slot.label}`}
                              title={`Lihat detail soal ${slot.label}`}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-orange-200 bg-orange-50 text-orange-600 transition hover:bg-orange-100 hover:text-orange-700"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                          ) : (
                            <span
                              title="Detail soal tersedia setelah latihan dikerjakan."
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-slate-300"
                            >
                              <Eye className="h-4 w-4" />
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-100 p-5 text-center">
              <button className="inline-flex items-center justify-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-5 py-2 text-sm font-semibold text-orange-600 transition hover:bg-orange-100">
                Lihat semua ({meetingSlots.length})
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </section>

          {waitingSlots.length > 0 ? (
            <p className="rounded-[22px] border border-sky-100 bg-sky-50 px-5 py-4 text-sm font-medium leading-6 text-sky-800">
              Ada {waitingSlots.length} latihan yang sudah dikerjakan dan sedang
              menunggu hasil tersimpan ke progres.
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

export { NilaiSiswaPageContent as NilaiSiswaPageView };
