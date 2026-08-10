import { withStoredAuthHeader } from "@/lib/auth";
import { formatUtbkTryoutStageLabel } from "@/lib/utbk-tryout-stages";
import { formatUtbkSubjectLabel } from "@/lib/utbk-subjects";
import { cn } from "@/lib/utils";
import type { StudentLearningProfile } from "../data/learning-types";
import type { StudentAcademicAccess } from "../data/studentAcademicAccess";

export type AnswerMap = Record<string, string>;
export type AssessmentType = "UTS" | "UAS" | "Tryout" | "Latihan";

export type StudentTryoutOption = {
  id: string;
  content: string;
};

export type StudentTryoutAttempt = {
  submitted: boolean;
  attemptId: string | null;
  status: "in_progress" | "submitted" | null;
  score: number | null;
  correctCount: number | null;
  wrongCount: number | null;
  unansweredCount: number | null;
  timeUsedSeconds: number | null;
  startedAt: string | null;
  expiresAt: string | null;
  remainingSeconds: number | null;
  submittedAt: string | null;
};

export type StudentTryoutItem = {
  id?: string;
  tryoutId?: string;
  classId?: string;
  branch?: string;
  canonicalClassName?: string;
  assessmentType?: AssessmentType;
  title?: string;
  jenjang?: string;
  kelas?: string;
  subject?: string;
  stage?: number | null;
  durationMinutes?: number;
  startAt?: string | null;
  endAt?: string | null;
  questionSource?: string;
  questionCount?: number;
  totalQuestions?: number;
  questionSetId?: string | null;
  packageId?: string | null;
  availability?: string;
  availabilityMessage?: string;
  isOpen?: boolean;
  myAttempt?: StudentTryoutAttempt;
};

export type StudentTryoutQuestion = {
  id: string;
  questionId?: string;
  order?: number;
  number?: number;
  section: string;
  topic: string;
  prompt: string;
  options: StudentTryoutOption[];
  difficulty: string;
  clue: string;
  selectedOptionId?: string | null;
  isCorrect?: boolean | null;
  correctOptionId?: string | null;
  explanation?: string;
};

export type StudentTryoutListResponse = {
  success: boolean;
  message?: string;
  data?: {
    student?: StudentLearningProfile | null;
    tryouts?: StudentTryoutItem[];
    academicAccess?: StudentAcademicAccess | null;
  };
};

export type StudentTryoutResult = {
  score: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  totalQuestions: number;
};

export type StudentTryoutDetailResponse = {
  success: boolean;
  message?: string;
  data?: {
    tryout?: StudentTryoutItem;
    questions?: StudentTryoutQuestion[];
    attempt?: StudentTryoutAttempt;
    result?: StudentTryoutResult;
    expiresAt?: string;
    remainingSeconds?: number;
  };
};

export type StudentTryoutStartResponse = {
  success: boolean;
  message?: string;
  data?: {
    attemptId?: string;
    status?: "in_progress" | "submitted";
    startedAt?: string;
    expiresAt?: string;
    remainingSeconds?: number;
    attempt?: StudentTryoutAttempt;
  };
};

export type StudentTryoutSubmitResponse = {
  success: boolean;
  message?: string;
  data?: {
    tryout?: StudentTryoutItem;
    attempt?: StudentTryoutAttempt;
    result?: StudentTryoutResult;
    questions?: StudentTryoutQuestion[];
  };
};

export type ActiveTryoutSession = {
  id: string;
  assessmentType: AssessmentType;
  assessmentLabel: string;
  title: string;
  code: string;
  subject: string;
  level: string;
  branch: string;
  durationMinutes: number;
  totalQuestions: number;
  targetScore: string;
  schedule: string;
  availability: string;
  availabilityMessage: string;
  isOpen: boolean;
  mode: string;
  instructions: string[];
  focusAreas: string[];
  pacingNotes: {
    label: string;
    value: string;
  }[];
  myAttempt: StudentTryoutAttempt | null;
  questions: StudentTryoutQuestion[];
};

export function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

export function normalizeAssessmentType(value: string | null | undefined): AssessmentType {
  const normalizedValue = normalizeText(value).toUpperCase();

  if (normalizedValue === "UTS" || normalizedValue === "UAS") {
    return normalizedValue;
  }

  if (normalizedValue === "LATIHAN") {
    return "Latihan";
  }

  return "Tryout";
}

export function formatTimer(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => value.toString().padStart(2, "0"))
    .join(":");
}

export function formatDateTime(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return "-";
  }

  const parsedDate = new Date(normalizedValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(parsedDate);
}

export function formatSchedule(startAt: string | null | undefined, endAt: string | null | undefined) {
  return `${formatDateTime(startAt)} - ${formatDateTime(endAt)} WIB`;
}

export function getQuestionKey(question: StudentTryoutQuestion) {
  return normalizeText(question.questionId) || normalizeText(question.id);
}

export function getTotalQuestions(session: ActiveTryoutSession | null) {
  if (!session) {
    return 0;
  }

  return Math.max(session.totalQuestions, session.questions.length);
}

export function getPaletteClass({
  isCurrent,
  isAnswered,
  isBookmarked,
}: {
  isCurrent: boolean;
  isAnswered: boolean;
  isBookmarked: boolean;
}) {
  if (isCurrent) {
    return "border-orange-300 bg-orange-500 text-white shadow-sm";
  }

  if (isAnswered) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (isBookmarked) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-orange-100 bg-orange-50/60 text-orange-700 hover:border-orange-200 hover:bg-orange-100";
}

export function getOptionClass({
  isSelected,
  isSubmitted,
  isCorrect,
  isIncorrectSelected,
}: {
  isSelected: boolean;
  isSubmitted: boolean;
  isCorrect: boolean;
  isIncorrectSelected: boolean;
}) {
  return cn(
    "flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition",
    !isSubmitted &&
      "hover:border-orange-200 hover:bg-orange-50/60 hover:shadow-sm",
    isSelected && !isSubmitted && "border-orange-300 bg-orange-50 text-orange-900",
    isCorrect && "border-emerald-300 bg-emerald-50 text-emerald-900",
    isIncorrectSelected && "border-rose-200 bg-rose-50 text-rose-800",
    !isSelected &&
      !isSubmitted &&
      "border-slate-200 bg-white text-slate-700 shadow-sm",
    !isSelected &&
      isSubmitted &&
      !isCorrect &&
      "border-slate-200 bg-white text-slate-600",
  );
}

export async function fetchStudentTryoutJson<T>(url: string, init: RequestInit = {}) {
  const authInit = withStoredAuthHeader({
    ...init,
    credentials: "include",
    cache: "no-store",
  });
  const headers = new Headers(authInit.headers);

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...authInit,
    headers,
  });
  const payload = (await response.json().catch(() => null)) as T | null;

  return { response, payload };
}

export function buildSessionFromTryout(
  tryout: StudentTryoutItem,
  questions: StudentTryoutQuestion[] = [],
): ActiveTryoutSession {
  const id = normalizeText(tryout.tryoutId) || normalizeText(tryout.id);
  const assessmentType = normalizeAssessmentType(tryout.assessmentType);
  const assessmentLabel =
    assessmentType === "Tryout" &&
    typeof tryout.stage === "number" &&
    Number.isFinite(tryout.stage)
      ? formatUtbkTryoutStageLabel(tryout.stage, `Tryout ${tryout.stage}`)
      : assessmentType;
  const rawSubject = normalizeText(tryout.subject);
  const subject = rawSubject ? formatUtbkSubjectLabel(rawSubject) : "Mapel ujian";
  const level =
    normalizeText(tryout.canonicalClassName) ||
    [normalizeText(tryout.jenjang), normalizeText(tryout.kelas)]
      .filter(Boolean)
      .join(" ");
  const totalQuestions = Math.max(
    tryout.totalQuestions ?? 0,
    tryout.questionCount ?? 0,
    questions.length,
  );

  return {
    id,
    assessmentType,
    assessmentLabel,
    title: normalizeText(tryout.title) || `${assessmentLabel} ${subject}`,
    code: id || "-",
    subject,
    level: level || normalizeText(tryout.kelas) || "Kelas ujian",
    branch: normalizeText(tryout.branch) || "Cabang belum diatur",
    durationMinutes: Math.max(tryout.durationMinutes ?? 90, 1),
    totalQuestions,
    targetScore: "Target sesuai capaian terbaikmu",
    schedule: formatSchedule(tryout.startAt, tryout.endAt),
    availability: normalizeText(tryout.availability) || "Belum tersedia",
    availabilityMessage:
      normalizeText(tryout.availabilityMessage) ||
      "Status pengerjaan mengikuti jadwal yang diterbitkan guru.",
    isOpen: tryout.isOpen === true,
    mode:
      tryout.questionSource === "bank"
        ? "Ujian Bank Soal"
        : `CBT ${assessmentLabel} Terjadwal`,
    instructions: [
      `Klik mulai ${assessmentLabel} saat jadwal sudah terbuka dan kamu siap mengerjakan.`,
      `Jawaban tersimpan otomatis untuk guru dan nilai ${assessmentLabel}.`,
      "Gunakan penanda soal untuk menandai nomor yang ingin dicek ulang sebelum dikirim.",
      "Setelah dikirim, pembahasan dan kunci jawaban akan tampil saat tersedia.",
    ],
    focusAreas: Array.from(
      new Set(
        questions
          .map((question) => normalizeText(question.topic))
          .filter(Boolean)
          .slice(0, 4),
      ),
    ),
    pacingNotes: [
      {
        label: "Durasi total",
        value: `${Math.max(tryout.durationMinutes ?? 90, 1)} menit`,
      },
      {
        label: "Jumlah soal",
        value: `${totalQuestions} soal`,
      },
      {
        label: "Cabang",
        value: normalizeText(tryout.branch) || "-",
      },
    ],
    myAttempt: tryout.myAttempt ?? null,
    questions,
  };
}
