"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Flag,
  ListChecks,
  Loader2,
  RefreshCcw,
  SendHorizontal,
  Target,
} from "lucide-react";

import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { clearAuthClientState } from "@/lib/auth";
import { cn } from "@/lib/utils";

import StudentLearningShell from "../learning/StudentLearningShell";
import {
  type ActiveTryoutSession,
  type AnswerMap,
  type StudentTryoutDetailResponse,
  type StudentTryoutQuestion,
  type StudentTryoutResult,
  type StudentTryoutSubmitResponse,
  buildSessionFromTryout,
  fetchStudentTryoutJson,
  formatTimer,
  getOptionClass,
  getPaletteClass,
  getQuestionKey,
  getTotalQuestions,
  normalizeText,
} from "./tryoutUtils";

function ReviewBadge({
  question,
  selectedOptionId,
}: {
  question: StudentTryoutQuestion;
  selectedOptionId?: string;
}) {
  if (!selectedOptionId) {
    return (
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
        Belum dijawab
      </span>
    );
  }

  const isCorrect =
    question.isCorrect === true ||
    (Boolean(question.correctOptionId) &&
      selectedOptionId === question.correctOptionId);

  return (
    <span
      className={cn(
        "rounded-full px-3 py-1 text-xs font-semibold",
        isCorrect
          ? "bg-emerald-50 text-emerald-700"
          : "bg-rose-50 text-rose-700",
      )}
    >
      {isCorrect ? "Jawaban benar" : "Perlu dicek ulang"}
    </span>
  );
}

function formatReviewOptionLabel(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);

  return normalizedValue ? normalizedValue.toUpperCase() : "Belum dijawab";
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

type ActiveLatihanPageViewProps = {
  taskId: string;
};

export default function ActiveLatihanPageView({ taskId }: ActiveLatihanPageViewProps) {
  const router = useRouter();
  const attemptId = taskId;
  const [activeSession, setActiveSession] = useState<ActiveTryoutSession | null>(null);
  const [result, setResult] = useState<StudentTryoutResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedByTimer, setSubmittedByTimer] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);

  // Anti-cheat states
  const [, setCheatWarnings] = useState(0);
  const [isCheatModalOpen, setIsCheatModalOpen] = useState(false);
  const [cheatModalMessage, setCheatModalMessage] = useState("");
  const lastCheatRef = useRef<number>(0);

  const totalDurationSeconds = Math.max(
    activeSession?.durationMinutes ?? 0,
    1,
  ) * 60;
  const totalQuestions = getTotalQuestions(activeSession);
  const currentQuestion =
    activeSession?.questions[currentQuestionIndex] ?? null;
  const answeredCount = Object.keys(answers).filter(
    (questionId) => Boolean(answers[questionId]),
  ).length;
  const unansweredCount = Math.max(totalQuestions - answeredCount, 0);
  const progressValue = totalQuestions
    ? Math.round((answeredCount / totalQuestions) * 100)
    : 0;
  const timeUsedSeconds =
    isSubmitted && typeof activeSession?.myAttempt?.timeUsedSeconds === "number"
      ? activeSession.myAttempt.timeUsedSeconds
      : Math.max(totalDurationSeconds - secondsRemaining, 0);
  const timerRatio = totalDurationSeconds
    ? secondsRemaining / totalDurationSeconds
    : 0;

  const resetTryoutSessionState = useCallback((
    session: ActiveTryoutSession | null,
    initialRemainingSeconds?: number | null,
  ) => {
    if (!session) {
      setResult(null);
      setIsSubmitted(false);
      setHasStarted(false);
      setSubmittedByTimer(false);
      setCurrentQuestionIndex(0);
      setSecondsRemaining(0);
      setAnswers({});
      setBookmarkedIds([]);
      return;
    }

    const sessionTotalDurationSeconds = Math.max(session.durationMinutes, 1) * 60;
    const sessionTotalQuestions = getTotalQuestions(session);
    const submittedAttempt = session.myAttempt;

    setSecondsRemaining(
      typeof initialRemainingSeconds === "number"
        ? Math.max(initialRemainingSeconds, 0)
        : sessionTotalDurationSeconds,
    );
    setResult(
      submittedAttempt?.submitted && typeof submittedAttempt.score === "number"
        ? {
            score: submittedAttempt.score,
            correctCount: submittedAttempt.correctCount ?? 0,
            wrongCount: submittedAttempt.wrongCount ?? 0,
            unansweredCount: submittedAttempt.unansweredCount ?? 0,
            totalQuestions: sessionTotalQuestions,
          }
        : null,
    );
    setIsSubmitted(submittedAttempt?.submitted === true);
    setHasStarted(false);
    setSubmittedByTimer(false);
    setCurrentQuestionIndex(0);
    setAnswers({});
    setBookmarkedIds([]);
  }, []);

  const loadExamAttempt = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError(null);

      const { response, payload } =
        await fetchStudentTryoutJson<StudentTryoutDetailResponse>(
          `/api/student/me/learning/tasks/cbt/${encodeURIComponent(attemptId)}`,
          {
            method: "GET",
          },
        );

      if (response.status === 401) {
        clearAuthClientState();
      }

      if (!response.ok || !payload?.success || !payload.data?.tryout) {
        throw new Error(payload?.message || "Sesi latihan belum bisa dimuat.");
      }

      const tryout = {
        ...payload.data.tryout,
        myAttempt: payload.data.attempt ?? payload.data.tryout.myAttempt,
      };
      const nextSession = buildSessionFromTryout(
        tryout,
        payload.data.questions ?? [],
      );
      const restoredAnswers: AnswerMap = {};

      for (const question of nextSession.questions) {
        const questionKey = getQuestionKey(question);

        if (question.selectedOptionId) {
          restoredAnswers[questionKey] = question.selectedOptionId;
        }
      }

      setActiveSession(nextSession);
      resetTryoutSessionState(
        nextSession,
        payload.data.remainingSeconds ??
          payload.data.attempt?.remainingSeconds ??
          nextSession.myAttempt?.remainingSeconds,
      );
      setAnswers(restoredAnswers);
      setHasStarted(true);
      setIsSubmitted(nextSession.myAttempt?.submitted === true);
      setResult(payload.data.result ?? null);
    } catch (error) {
      console.error("[active-tryout-page] load_exam_attempt_failed", error);
      setActiveSession(null);
      resetTryoutSessionState(null);
      setLoadError(
        error instanceof Error && error.message
          ? error.message
          : "Sesi latihan belum bisa dimuat.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [attemptId, resetTryoutSessionState]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadExamAttempt();
    });
  }, [loadExamAttempt]);

  async function handleSubmitTryout(fromTimer = false) {
    if (!activeSession || isSubmitting || isSubmitted) {
      return;
    }

    const activeAttemptId =
      normalizeText(attemptId) ||
      normalizeText(activeSession.myAttempt?.attemptId);

    if (!activeAttemptId) {
      window.alert("Sesi latihan tidak ditemukan.");
      return;
    }

    try {
      setIsSubmitting(true);
      const answerPayload = activeSession.questions.map((question) => {
        const questionId = getQuestionKey(question);

        return {
          questionId,
          selectedAnswer: answers[questionId] ?? "",
        };
      });
      const { response, payload } =
        await fetchStudentTryoutJson<StudentTryoutSubmitResponse>(
          `/api/student/me/learning/tasks/cbt/${encodeURIComponent(activeAttemptId)}/submission`,
          {
            method: "POST",
            body: JSON.stringify({
              answers: answerPayload,
              timeUsedSeconds,
            }),
          },
        );

      if (response.status === 401) {
        clearAuthClientState();
      }

      if (!response.ok || !payload?.success || !payload.data?.tryout) {
        throw new Error(payload?.message || "Jawaban latihan belum bisa dikirim.");
      }

      const nextSession = buildSessionFromTryout(
        payload.data.tryout,
        payload.data.questions ?? activeSession.questions,
      );
      const nextAnswers: AnswerMap = {};

      for (const question of nextSession.questions) {
        const questionId = getQuestionKey(question);

        if (question.selectedOptionId) {
          nextAnswers[questionId] = question.selectedOptionId;
        }
      }

      setActiveSession(nextSession);
      setAnswers(nextAnswers);
      setResult(payload.data.result ?? null);
      setSubmittedByTimer(fromTimer);
      setIsSubmitted(true);
      setSecondsRemaining(0);
    } catch (error) {
      console.error("[active-tryout-page] submit_tryout_failed", error);
      if (fromTimer) {
        setSubmittedByTimer(false);
      }
      window.alert(
        error instanceof Error && error.message
          ? error.message
          : "Jawaban latihan belum bisa dikirim.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const submitTryoutFromTimer = useEffectEvent(() => {
    void handleSubmitTryout(true);
  });

  const submitTryoutFromCheating = useEffectEvent(() => {
    void handleSubmitTryout(true);
  });

  useEffect(() => {
    if (!hasStarted || isSubmitted || isSubmitting) {
      return undefined;
    }

    const timerId = window.setInterval(() => {
      setSecondsRemaining((currentValue) => {
        if (currentValue <= 1) {
          window.clearInterval(timerId);
          setSubmittedByTimer(true);
          submitTryoutFromTimer();
          return 0;
        }

        return currentValue - 1;
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [hasStarted, isSubmitted, isSubmitting]);

  // Anti-Cheat Detection
  useEffect(() => {
    if (!hasStarted || isSubmitted || isSubmitting) {
      return undefined;
    }

    const handleCheatingDetection = () => {
      const now = Date.now();
      // Debounce: ignore multiple rapid events within 2 seconds
      if (now - lastCheatRef.current < 2000) return;
      lastCheatRef.current = now;

      setCheatWarnings((prev) => {
        const nextCount = prev + 1;
        
        if (nextCount === 1) {
          setCheatModalMessage("Anda terdeteksi meninggalkan layar latihan (berpindah tab atau window). Harap fokus pada layar latihan. Ini adalah peringatan pertama. Jika mencapai 3 pelanggaran, latihan akan diakhiri secara otomatis.");
          setIsCheatModalOpen(true);
        } else if (nextCount === 2) {
          setCheatModalMessage("Peringatan ke-2! Anda terdeteksi kembali meninggalkan layar latihan. Jika Anda melakukannya sekali lagi, latihan akan langsung diakhiri otomatis dan jawaban akan dikirimkan.");
          setIsCheatModalOpen(true);
        } else if (nextCount >= 3) {
          setCheatModalMessage("Pelanggaran maksimal! Anda telah meninggalkan layar latihan sebanyak 3 kali. Latihan telah diakhiri otomatis.");
          setIsCheatModalOpen(true);
          submitTryoutFromCheating();
        }

        return nextCount;
      });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        handleCheatingDetection();
      }
    };

    const onWindowBlur = () => {
      handleCheatingDetection();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onWindowBlur);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onWindowBlur);
    };
  }, [hasStarted, isSubmitted, isSubmitting]);

  function handleSelectAnswer(questionId: string, optionId: string) {
    if (isSubmitted || isSubmitting) {
      return;
    }

    setAnswers((currentAnswers) => ({
      ...currentAnswers,
      [questionId]: optionId,
    }));
  }

  function handleToggleBookmark(questionId: string) {
    if (isSubmitted || isSubmitting) {
      return;
    }

    setBookmarkedIds((currentIds) => {
      if (currentIds.includes(questionId)) {
        return currentIds.filter((item) => item !== questionId);
      }

      return [...currentIds, questionId];
    });
  }

  function handleBackToDashboard() {
    router.push("/dashboard-siswa/latihan");
  }

  const displayResult = useMemo(() => {
    if (result) {
      return result;
    }

    const attempt = activeSession?.myAttempt;

    if (!attempt?.submitted || typeof attempt.score !== "number") {
      return null;
    }

    return {
      score: attempt.score,
      correctCount: attempt.correctCount ?? 0,
      wrongCount: attempt.wrongCount ?? 0,
      unansweredCount: attempt.unansweredCount ?? 0,
      totalQuestions,
    };
  }, [activeSession?.myAttempt, result, totalQuestions]);

  return (
    <StudentLearningShell
      title="Latihan Soal"
      description="Sesi latihan CBT dengan durasi dan pengawasan sistem."
      summary={isLoading ? "Memuat latihan" : "Sesi latihan aktif"}
    >
      <Dialog open={isCheatModalOpen} onOpenChange={setIsCheatModalOpen}>
        <DialogContent className="max-w-md text-center">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <DialogTitle className="text-xl">Peringatan Kecurangan</DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-6">
              {cheatModalMessage}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 sm:justify-center">
            <button
              onClick={() => setIsCheatModalOpen(false)}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-rose-600 px-6 font-semibold text-white transition hover:bg-rose-700"
            >
              Saya Mengerti
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <section className="rounded-[24px] border border-slate-100 bg-white px-5 py-10 text-center shadow-sm">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-orange-500" />
          <p className="mt-3 text-sm font-semibold text-slate-700">
            Memuat detail latihan...
          </p>
        </section>
      ) : loadError ? (
        <EmptyTryoutState
          title="Latihan belum bisa dimuat"
          description={loadError}
          onRetry={loadExamAttempt}
        />
      ) : !activeSession || (!hasStarted && !isSubmitted) ? (
        <EmptyTryoutState
          title="Soal latihan belum tersedia"
          description="Sesi latihan belum siap atau belum bisa dimuat."
          onRetry={loadExamAttempt}
        />
      ) : (
        <>
          {isSubmitted && displayResult ? (
            <section className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm md:p-6">
          <SectionHeader
            icon={CheckCircle2}
            title={`Hasil ${activeSession.assessmentLabel}`}
            description="Ringkasan hasil dari jawaban yang sudah dikirim."
          />

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                {submittedByTimer
                  ? `${activeSession.assessmentLabel} terkirim otomatis`
                  : `${activeSession.assessmentLabel} berhasil dikirim`}
              </div>
              <h2 className="mt-3 text-xl font-semibold text-slate-800">
                Ringkasan hasil {activeSession.assessmentLabel} kamu
              </h2>
            </div>

            <button
              type="button"
              onClick={handleBackToDashboard}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-orange-200 bg-orange-50 px-5 text-sm font-semibold text-orange-700 transition hover:bg-orange-100"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Daftar
            </button>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Skor
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-800">
                {displayResult.score}
              </p>
            </div>
            <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Jawaban Benar
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-800">
                {displayResult.correctCount}/{displayResult.totalQuestions}
              </p>
            </div>
            <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Waktu Terpakai
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-800">
                {formatTimer(timeUsedSeconds)}
              </p>
            </div>
            <div className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Belum Dijawab
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-800">
                {displayResult.unansweredCount}
              </p>
            </div>
          </div>
            </section>
          ) : null}

          {currentQuestion ? (
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm md:p-6">
            <SectionHeader
              icon={ListChecks}
              title={isSubmitted ? "Review Soal" : "Area Pengerjaan"}
              description={
                isSubmitted
                  ? "Lihat kembali soal, jawaban kamu, kunci jawaban, dan pembahasan yang tersedia."
                  : "Baca soal dengan teliti, pilih jawaban terbaik, lalu tandai bila ingin dicek ulang lagi."
              }
            />

            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
                    {currentQuestion.section}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {currentQuestion.topic}
                  </span>
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                    {currentQuestion.difficulty}
                  </span>
                </div>

                <h2 className="mt-4 text-xl font-semibold text-slate-800">
                  Soal {currentQuestionIndex + 1} dari {totalQuestions}
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {isSubmitted ? (
                  <ReviewBadge
                    question={currentQuestion}
                    selectedOptionId={answers[getQuestionKey(currentQuestion)]}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      handleToggleBookmark(getQuestionKey(currentQuestion))
                    }
                    className={cn(
                      "inline-flex h-11 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition",
                      bookmarkedIds.includes(getQuestionKey(currentQuestion))
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100",
                    )}
                  >
                    <Flag className="h-4 w-4" />
                    {bookmarkedIds.includes(getQuestionKey(currentQuestion))
                      ? "Ditandai"
                      : "Tandai Cek Ulang"}
                  </button>
                )}
              </div>
            </div>

            <div className="mt-6 rounded-[24px] border border-slate-100 bg-slate-50/55 p-5">
              <p className="text-base leading-8 text-slate-700">
                {currentQuestion.prompt}
              </p>

              <div className="mt-6 space-y-3">
                {currentQuestion.options.map((option) => {
                  const questionId = getQuestionKey(currentQuestion);
                  const selectedOptionId = answers[questionId];
                  const isSelected = selectedOptionId === option.id;
                  const isCorrect =
                    isSubmitted && currentQuestion.correctOptionId === option.id;
                  const isIncorrectSelected =
                    isSubmitted && isSelected && !isCorrect;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      disabled={isSubmitted || isSubmitting}
                      onClick={() => handleSelectAnswer(questionId, option.id)}
                      className={getOptionClass({
                        isSelected,
                        isSubmitted,
                        isCorrect,
                        isIncorrectSelected,
                      })}
                    >
                      <span
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                          isCorrect &&
                            "border-emerald-200 bg-white text-emerald-700",
                          isIncorrectSelected &&
                            "border-rose-200 bg-white text-rose-700",
                          isSelected &&
                            !isSubmitted &&
                            "border-orange-200 bg-white text-orange-700",
                          !isSelected &&
                            !isCorrect &&
                            !isIncorrectSelected &&
                            "border-slate-200 bg-slate-50 text-slate-500",
                        )}
                      >
                        {option.id.toUpperCase()}
                      </span>

                      <span className="flex-1 pt-1 text-sm leading-6">
                        {option.content}
                      </span>
                    </button>
                  );
                })}
              </div>

              {isSubmitted ? (
                <div className="mt-5 rounded-[20px] border border-emerald-100 bg-white p-4">
                  <div className="flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                      Jawaban kamu:{" "}
                      {formatReviewOptionLabel(
                        answers[getQuestionKey(currentQuestion)],
                      )}
                    </span>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                      Kunci:{" "}
                      {formatReviewOptionLabel(currentQuestion.correctOptionId)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-800">
                    Pembahasan
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {currentQuestion.explanation ||
                      currentQuestion.clue ||
                      "Pembahasan belum tersedia untuk soal ini."}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() =>
                  setCurrentQuestionIndex((currentIndex) =>
                    Math.max(currentIndex - 1, 0),
                  )
                }
                disabled={currentQuestionIndex === 0}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-orange-200 bg-orange-50 px-4 text-sm font-semibold text-orange-700 transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <ArrowLeft className="h-4 w-4" />
                Soal Sebelumnya
              </button>

              <div className="flex flex-wrap gap-3">
                {!isSubmitted ? (
                  <button
                    type="button"
                    onClick={() => void handleSubmitTryout(false)}
                    disabled={isSubmitting}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-orange-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-orange-200"
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <SendHorizontal className="h-4 w-4" />
                    )}
                    {isSubmitting
                      ? "Mengirim..."
                      : `Kirim ${activeSession.assessmentLabel}`}
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() =>
                    setCurrentQuestionIndex((currentIndex) =>
                      Math.min(currentIndex + 1, totalQuestions - 1),
                    )
                  }
                  disabled={currentQuestionIndex === totalQuestions - 1}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-orange-200 bg-orange-50 px-4 text-sm font-semibold text-orange-700 transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Soal Berikutnya
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </section>

          <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
            {!isSubmitted ? (
              <section className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm md:p-6">
              <SectionHeader
                icon={Clock3}
                title={`Timer ${activeSession.assessmentLabel}`}
                description="Pantau sisa waktu dan ritme pengerjaan selama sesi berlangsung."
              />

              <div
                className={cn(
                  "rounded-[24px] border px-4 py-4",
                  timerRatio <= 0.1 && "border-rose-200 bg-rose-50 text-rose-700",
                  timerRatio > 0.1 &&
                    timerRatio <= 0.25 &&
                    "border-amber-200 bg-amber-50 text-amber-700",
                  timerRatio > 0.25 &&
                    "border-orange-100 bg-orange-50/70 text-orange-700",
                )}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em]">
                      Sisa waktu
                    </p>
                    <p className="mt-2 text-3xl font-semibold tracking-[0.08em]">
                      {formatTimer(secondsRemaining)}
                    </p>
                  </div>
                </div>

                <Progress
                  value={Math.max(0, Math.round(timerRatio * 100))}
                  className={cn(
                    "mt-4 h-2.5 bg-white/90",
                    timerRatio <= 0.1 && "[&>div]:bg-rose-500",
                    timerRatio > 0.1 &&
                      timerRatio <= 0.25 &&
                      "[&>div]:bg-amber-500",
                    timerRatio > 0.25 && "[&>div]:bg-orange-500",
                  )}
                />
              </div>
              </section>
            ) : null}

            <section className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm md:p-6">
              <SectionHeader
                icon={Target}
                title={isSubmitted ? "Rekap Jawaban" : "Progres Jawaban"}
                description={
                  isSubmitted
                    ? "Ringkasan status jawaban dari attempt yang sudah dikirim."
                    : "Lihat jumlah soal yang sudah terjawab, tertunda, dan masih perlu dicek ulang."
                }
              />

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Terjawab
                  </p>
                  <p className="mt-2 text-xl font-semibold text-slate-800">
                    {answeredCount}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Belum
                  </p>
                  <p className="mt-2 text-xl font-semibold text-slate-800">
                    {unansweredCount}
                  </p>
                </div>
              </div>

              <Progress value={progressValue} className="mt-4 h-2.5 bg-slate-100" />
            </section>

            <section className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm md:p-6">
              <SectionHeader
                icon={Flag}
                title="Navigasi Soal"
                description="Pindah antar nomor soal dengan cepat sambil tetap memantau status jawabannya."
              />

              <div className="grid grid-cols-4 gap-2.5">
                {activeSession.questions.map((question, index) => {
                  const questionId = getQuestionKey(question);

                  return (
                    <button
                      key={questionId}
                      type="button"
                      onClick={() => setCurrentQuestionIndex(index)}
                      className={cn(
                        "inline-flex h-11 items-center justify-center rounded-2xl border text-sm font-semibold transition",
                        getPaletteClass({
                          isCurrent: currentQuestionIndex === index,
                          isAnswered: Boolean(answers[questionId]),
                          isBookmarked: bookmarkedIds.includes(questionId),
                        }),
                      )}
                    >
                      {index + 1}
                    </button>
                  );
                })}
              </div>
            </section>
          </aside>
            </div>
          ) : null}
        </>
      )}
    </StudentLearningShell>
  );
}
