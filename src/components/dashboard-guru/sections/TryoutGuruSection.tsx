/*  */"use client";

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  UploadCloud,
} from "lucide-react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { clearAuthClientState } from "@/lib/auth";
import { buildGuruApiUrl, getSelectedAcademicPeriod } from "@/lib/guru-helpers";
import toast from "react-hot-toast";

type TryoutJenjang = "SD" | "SMP" | "SMA";
type AssessmentType = "UTS" | "UAS" | "Tryout";
type AssessmentMode = "semester" | "tryout";
type PublishStatus = "Published" | "Draft";
type StatusFilter = "Semua" | PublishStatus;
type JawabanBenar = "A" | "B" | "C" | "D";
type ResultStatus = "Sangat Baik" | "Baik" | "Perlu Bimbingan";
type QuestionSource = "bank" | "file" | "manual";

type TryoutQuestion = {
  id: string;
  order: number;
  pertanyaan: string;
  opsiA: string;
  opsiB: string;
  opsiC: string;
  opsiD: string;
  jawabanBenar: JawabanBenar;
};

type TryoutResult = {
  id: string;
  namaSiswa: string;
  benar: number;
  salah: number;
  belumDijawab?: number;
  nilai: number;
  status: ResultStatus;
  submittedAt?: string | null;
  timeUsedSeconds?: number;
};

type TryoutItem = {
  id: string;
  classId?: string;
  branch?: string;
  canonicalClassName?: string;
  assessmentType: AssessmentType;
  judulTryout: string;
  jenjang: TryoutJenjang;
  kelas: string;
  mapel: string;
  stage?: number | null;
  jumlahSoal: number;
  durasiMenit: number;
  tanggalMulai: string;
  tanggalSelesai: string;
  publishStatus: PublishStatus;
  reviewStatus?: string;
  questionSource: QuestionSource;
  questionBankId?: string;
  questionSetId?: string;
  packageId?: string;
  fileName?: string;
  soal: TryoutQuestion[];
  hasil: TryoutResult[];
};

type TryoutDraft = Omit<TryoutItem, "soal" | "hasil">;
type QuestionDraft = Omit<TryoutQuestion, "id" | "order">;
type DialogMode = "add" | "edit";
type BackendPublishStatus = "draft" | "published";

type TeacherTryoutApiItem = {
  id?: string;
  tryoutId?: string;
  classId?: string;
  branch?: string;
  canonicalClassName?: string;
  assessmentType?: string;
  title?: string;
  jenjang?: string;
  kelas?: string;
  subject?: string;
  stage?: number | null;
  durationMinutes?: number;
  startAt?: string | null;
  endAt?: string | null;
  publishStatus?: string;
  reviewStatus?: string;
  questionSource?: string;
  questionCount?: number;
  questionBankId?: string | null;
  questionSetId?: string | null;
  packageId?: string | null;
  fileName?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type TeacherTryoutQuestionApiItem = {
  id?: string;
  questionId?: string;
  tryoutId?: string;
  questionText?: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  correctAnswer?: string;
  order?: number;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type TeacherTryoutListResponse = {
  success: boolean;
  message?: string;
  data?: {
    tryouts?: TeacherTryoutApiItem[];
  };
};

type TeacherTryoutDetailResponse = {
  success: boolean;
  message?: string;
  data?: {
    tryout?: TeacherTryoutApiItem;
  };
};

type TeacherTryoutQuestionListResponse = {
  success: boolean;
  message?: string;
  data?: {
    tryout?: TeacherTryoutApiItem;
    questions?: TeacherTryoutQuestionApiItem[];
  };
};

type TeacherDashboardResponse = {
  success: boolean;
  message?: string;
  data?: {
    teacher?: {
      subject?: string;
      branch?: string;
      branches?: string[];
    };
  };
};

type TeacherClassApiItem = {
  id?: string;
  className?: string;
  level?: string;
  subject?: string;
  branch?: string;
  studentCount?: number;
  scheduleCount?: number;
};

type TeacherClassListResponse = {
  success: boolean;
  message?: string;
  data?: {
    classes?: TeacherClassApiItem[];
  };
};

type TeacherAssessmentClassOption = {
  id: string;
  className: string;
  branch: string;
  subject: string;
  jenjang: TryoutJenjang;
  kelas: string;
  canonicalClassName: string;
  assessmentMode: AssessmentMode;
  studentCount: number;
  scheduleCount: number;
};

type TeacherTryoutQuestionDetailResponse = {
  success: boolean;
  message?: string;
  data?: {
    tryout?: TeacherTryoutApiItem;
    question?: TeacherTryoutQuestionApiItem;
  };
};

type TeacherTryoutResultApiItem = {
  id?: string;
  attemptId?: string;
  studentId?: string;
  namaSiswa?: string;
  benar?: number;
  salah?: number;
  belumDijawab?: number;
  nilai?: number;
  score?: number;
  status?: string;
  submittedAt?: string | null;
  timeUsedSeconds?: number;
};

type TeacherTryoutResultListResponse = {
  success: boolean;
  message?: string;
  data?: {
    tryout?: TeacherTryoutApiItem;
    results?: TeacherTryoutResultApiItem[];
  };
};

const JENJANG_OPTIONS: TryoutJenjang[] = ["SD", "SMP", "SMA"];
const ASSESSMENT_TYPE_OPTIONS: AssessmentType[] = [
  "UTS",
  "UAS",
  "Tryout",
];
const STATUS_FILTERS: StatusFilter[] = ["Semua", "Published", "Draft"];
const FINAL_CLASS_BY_JENJANG: Record<TryoutJenjang, string> = {
  SD: "Kelas 6",
  SMP: "Kelas 9",
  SMA: "Kelas 12",
};

const FIELD_CLASS =
  "w-full border border-orange-100 bg-white px-3 py-2.5 text-sm text-slate-700 transition placeholder:text-slate-400 focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100";
const LABEL_CLASS =
  "text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400";
const ACTION_BUTTON_CLASS =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center border transition";
const DRAFT_ONLY_QUESTION_MESSAGE =
  "Soal hanya dapat diubah saat ujian masih berstatus draft.";

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function toSafeNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toTryoutJenjang(value: string | null | undefined): TryoutJenjang | null {
  const normalizedValue = normalizeText(value).toUpperCase();

  return JENJANG_OPTIONS.find((item) => item === normalizedValue) ?? null;
}

function toAssessmentType(value: string | null | undefined): AssessmentType | null {
  const normalizedValue = normalizeText(value);

  if (normalizedValue.startsWith("UTS")) return "UTS";
  if (normalizedValue.startsWith("UAS")) return "UAS";

  return (
    ASSESSMENT_TYPE_OPTIONS.find(
      (item) => item === normalizedValue,
    ) ?? null
  );
}

function getGradeFromClassName(className: string) {
  return Number(normalizeText(className).match(/\b(\d{1,2})\b/)?.[1] ?? 0);
}

function isFinalAssessmentClass(className: string) {
  return [6, 9, 12].includes(getGradeFromClassName(className));
}

function getAssessmentModeForClass(className: string): AssessmentMode {
  return isFinalAssessmentClass(className) ? "tryout" : "semester";
}

function getAssessmentTypeLabel(type: AssessmentType) {
  if (type === "UTS") return "Simulasi UTS 1";
  if (type === "UAS") return "Simulasi UAS 1";
  return type;
}

function getJenjangFromClassName(className: string): TryoutJenjang | null {
  const normalizedValue = normalizeText(className).toUpperCase();

  if (normalizedValue.startsWith("SD")) return "SD";
  if (normalizedValue.startsWith("SMP")) return "SMP";
  if (normalizedValue.startsWith("SMA")) return "SMA";

  return null;
}

function getKelasLabelFromClassName(className: string) {
  const grade = getGradeFromClassName(className);

  return grade ? `Kelas ${grade}` : "";
}

function getCanonicalClassName(jenjang: TryoutJenjang, kelas: string) {
  const grade = getGradeFromClassName(kelas);

  return grade ? `${jenjang} ${grade}` : "";
}

function mapTeacherClassApiItem(
  item: TeacherClassApiItem,
  fallbackSubject: string,
): TeacherAssessmentClassOption | null {
  const className = normalizeText(item.className);
  const branch = normalizeText(item.branch);
  const jenjang = getJenjangFromClassName(className);
  const kelas = getKelasLabelFromClassName(className);

  if (!className || !branch || !jenjang || !kelas) {
    return null;
  }

  const canonicalClassName = getCanonicalClassName(jenjang, kelas);

  if (!canonicalClassName) {
    return null;
  }

  return {
    id: normalizeText(item.id) || `${branch}-${canonicalClassName}`,
    className,
    branch,
    subject: normalizeText(item.subject) || fallbackSubject,
    jenjang,
    kelas,
    canonicalClassName,
    assessmentMode: getAssessmentModeForClass(canonicalClassName),
    studentCount: toSafeNumber(item.studentCount, 0),
    scheduleCount: toSafeNumber(item.scheduleCount, 0),
  };
}

function applyClassOptionToDraft(
  draft: TryoutDraft,
  option: TeacherAssessmentClassOption,
) {
  const nextAssessmentType: AssessmentType =
    option.assessmentMode === "tryout"
      ? "Tryout"
      : draft.assessmentType === "UAS"
        ? "UAS"
        : "UTS";

  return normalizeTryoutDraft(
    {
      ...draft,
      classId: option.id,
      branch: option.branch,
      canonicalClassName: option.canonicalClassName,
      assessmentType: nextAssessmentType,
      jenjang: option.jenjang,
      kelas: option.kelas,
      mapel: option.subject,
      stage: nextAssessmentType === "Tryout" ? draft.stage ?? 1 : null,
    },
    [],
  );
}

function toTryoutPublishStatus(
  value: string | null | undefined,
): PublishStatus | null {
  const normalizedValue = normalizeText(value).toLowerCase();

  if (normalizedValue === "published") {
    return "Published";
  }

  if (normalizedValue === "draft") {
    return "Draft";
  }

  return null;
}

function toBackendPublishStatus(status: PublishStatus): BackendPublishStatus {
  return status === "Published" ? "published" : "draft";
}

function toTryoutQuestionSource(
  value: string | null | undefined,
): QuestionSource | null {
  const normalizedValue = normalizeText(value).toLowerCase();

  if (
    normalizedValue === "bank" ||
    normalizedValue === "file" ||
    normalizedValue === "manual"
  ) {
    return normalizedValue;
  }

  return null;
}

function toJawabanBenar(value: string | null | undefined): JawabanBenar | null {
  const normalizedValue = normalizeText(value).toUpperCase();

  if (
    normalizedValue === "A" ||
    normalizedValue === "B" ||
    normalizedValue === "C" ||
    normalizedValue === "D"
  ) {
    return normalizedValue;
  }

  return null;
}

function toTryoutResultStatus(value: string | null | undefined): ResultStatus {
  const normalizedValue = normalizeText(value).toLowerCase();

  if (normalizedValue === "sangat baik") {
    return "Sangat Baik";
  }

  if (normalizedValue === "baik") {
    return "Baik";
  }

  return "Perlu Bimbingan";
}

function formatDateTimeLocalValue(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return "";
  }

  const parsedDate = new Date(normalizedValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  // Convert to WIB (+07:00) explicitly for the datetime-local input
  const wibTime = parsedDate.getTime() + (7 * 60 * 60 * 1000);
  const wibDate = new Date(wibTime);

  const year = wibDate.getUTCFullYear();
  const month = String(wibDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(wibDate.getUTCDate()).padStart(2, "0");
  const hour = String(wibDate.getUTCHours()).padStart(2, "0");
  const minute = String(wibDate.getUTCMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function toIsoDateTimeValue(value: string) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return "";
  }

  // Force the input to be parsed as WIB (+07:00) instead of local browser timezone
  // This ensures the backend always receives the correct UTC time for Indonesia
  const parsedDate = new Date(`${normalizedValue}:00+07:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return parsedDate.toISOString();
}

async function fetchTeacherTryoutJson<T>(
  url: string,
  init: RequestInit,
) {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const payload = (await response.json().catch(() => null)) as T | null;

  return { response, payload };
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("File XLSX belum bisa dibaca."));
    reader.onload = () => {
      const result = reader.result;

      if (typeof result !== "string") {
        reject(new Error("File XLSX belum bisa diproses."));
        return;
      }

      resolve(result.includes(",") ? result.slice(result.indexOf(",") + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

function mapTeacherTryoutApiItem(
  item: TeacherTryoutApiItem,
  existingTryout?: TryoutItem | null,
): TryoutItem {
  const jenjang = toTryoutJenjang(item.jenjang) ?? existingTryout?.jenjang ?? "SMA";
  const assessmentType =
    toAssessmentType(item.assessmentType) ??
    existingTryout?.assessmentType ??
    "Tryout";
  const questionSource =
    toTryoutQuestionSource(item.questionSource) ??
    existingTryout?.questionSource ??
    "manual";
  const questionSetId = normalizeText(item.questionSetId) || undefined;
  const packageId = normalizeText(item.packageId) || undefined;
  const questionBankId =
    normalizeText(item.questionBankId) || questionSetId || undefined;
  const fileName = normalizeText(item.fileName) || undefined;

  return {
    id:
      normalizeText(item.tryoutId) ||
      normalizeText(item.id) ||
      existingTryout?.id ||
      createId("tryout"),
    classId: normalizeText(item.classId) || existingTryout?.classId,
    branch: normalizeText(item.branch) || existingTryout?.branch,
    canonicalClassName:
      normalizeText(item.canonicalClassName) || existingTryout?.canonicalClassName,
    assessmentType,
    judulTryout:
      normalizeText(item.title) ||
      existingTryout?.judulTryout ||
      "Ujian belum diatur",
    jenjang,
    kelas:
      normalizeText(item.kelas) ||
      existingTryout?.kelas ||
      FINAL_CLASS_BY_JENJANG[jenjang],
    mapel:
      normalizeText(item.subject) ||
      existingTryout?.mapel ||
      "Mapel belum diatur",
    stage:
      typeof item.stage === "number" && Number.isFinite(item.stage)
        ? item.stage
        : existingTryout?.stage ?? null,
    jumlahSoal: Math.max(
      toSafeNumber(item.questionCount, existingTryout?.jumlahSoal ?? 0),
      0,
    ),
    durasiMenit: Math.max(
      toSafeNumber(item.durationMinutes, existingTryout?.durasiMenit ?? 90),
      15,
    ),
    tanggalMulai:
      formatDateTimeLocalValue(item.startAt) || existingTryout?.tanggalMulai || "",
    tanggalSelesai:
      formatDateTimeLocalValue(item.endAt) || existingTryout?.tanggalSelesai || "",
    publishStatus:
      toTryoutPublishStatus(item.publishStatus) ??
      existingTryout?.publishStatus ??
      "Draft",
    reviewStatus: normalizeText(item.reviewStatus) || existingTryout?.reviewStatus,
    questionSource,
    questionBankId: questionSource === "bank" ? questionBankId : undefined,
    questionSetId: questionSource === "bank" ? questionSetId : undefined,
    packageId: questionSource === "bank" ? packageId : undefined,
    fileName: questionSource === "file" ? fileName : undefined,
    soal: existingTryout?.soal ?? [],
    hasil: existingTryout?.hasil ?? [],
  };
}

function mapTeacherTryoutQuestionApiItem(
  item: TeacherTryoutQuestionApiItem,
): TryoutQuestion | null {
  const questionId = normalizeText(item.questionId) || normalizeText(item.id);
  const correctAnswer = toJawabanBenar(item.correctAnswer);
  const questionText = normalizeText(item.questionText);
  const optionA = normalizeText(item.optionA);
  const optionB = normalizeText(item.optionB);
  const optionC = normalizeText(item.optionC);
  const optionD = normalizeText(item.optionD);

  if (
    !questionId ||
    !correctAnswer ||
    !questionText ||
    !optionA ||
    !optionB ||
    !optionC ||
    !optionD
  ) {
    return null;
  }

  return {
    id: questionId,
    order: Math.max(toSafeNumber(item.order, 0), 0),
    pertanyaan: questionText,
    opsiA: optionA,
    opsiB: optionB,
    opsiC: optionC,
    opsiD: optionD,
    jawabanBenar: correctAnswer,
  };
}

function mapTeacherTryoutResultApiItem(
  item: TeacherTryoutResultApiItem,
): TryoutResult | null {
  const resultId =
    normalizeText(item.attemptId) ||
    normalizeText(item.id) ||
    normalizeText(item.studentId);
  const namaSiswa = normalizeText(item.namaSiswa) || normalizeText(item.studentId);

  if (!resultId || !namaSiswa) {
    return null;
  }

  const nilai = Math.max(
    0,
    Math.min(100, toSafeNumber(item.nilai ?? item.score, 0)),
  );

  return {
    id: resultId,
    namaSiswa,
    benar: Math.max(toSafeNumber(item.benar, 0), 0),
    salah: Math.max(toSafeNumber(item.salah, 0), 0),
    belumDijawab: Math.max(toSafeNumber(item.belumDijawab, 0), 0),
    nilai,
    status: toTryoutResultStatus(item.status),
    submittedAt: item.submittedAt ?? null,
    timeUsedSeconds: Math.max(toSafeNumber(item.timeUsedSeconds, 0), 0),
  };
}

function sortTryoutQuestions(questions: TryoutQuestion[]) {
  return [...questions].sort((left, right) => {
    if (left.order !== right.order) {
      return left.order - right.order;
    }

    return left.id.localeCompare(right.id);
  });
}

function syncTryoutQuestionsFromApi(
  currentTryouts: TryoutItem[],
  tryoutId: string,
  apiQuestions: TeacherTryoutQuestionApiItem[],
  apiTryout?: TeacherTryoutApiItem,
) {
  const nextTryouts = apiTryout
    ? upsertTryoutFromApi(currentTryouts, apiTryout)
    : currentTryouts;
  const questions = sortTryoutQuestions(
    apiQuestions
      .map(mapTeacherTryoutQuestionApiItem)
      .filter((item): item is TryoutQuestion => item !== null),
  );

  return nextTryouts.map((item) =>
    item.id === tryoutId
      ? {
          ...item,
          jumlahSoal: Math.max(
            apiTryout?.questionCount ?? item.jumlahSoal,
            questions.length,
          ),
          soal: questions,
        }
      : item,
  );
}

function upsertTryoutQuestionFromApi(
  currentTryouts: TryoutItem[],
  tryoutId: string,
  apiQuestion: TeacherTryoutQuestionApiItem,
  apiTryout?: TeacherTryoutApiItem,
) {
  const question = mapTeacherTryoutQuestionApiItem(apiQuestion);

  if (!question) {
    return currentTryouts;
  }

  const nextTryouts = apiTryout
    ? upsertTryoutFromApi(currentTryouts, apiTryout)
    : currentTryouts;

  return nextTryouts.map((item) => {
    if (item.id !== tryoutId) {
      return item;
    }

    const nextQuestions = sortTryoutQuestions([
      ...item.soal.filter((candidate) => candidate.id !== question.id),
      question,
    ]);

    return {
      ...item,
      jumlahSoal: Math.max(
        apiTryout?.questionCount ?? item.jumlahSoal,
        nextQuestions.length,
      ),
      soal: nextQuestions,
    };
  });
}

function syncTryoutResultsFromApi(
  currentTryouts: TryoutItem[],
  tryoutId: string,
  apiResults: TeacherTryoutResultApiItem[],
  apiTryout?: TeacherTryoutApiItem,
) {
  const nextTryouts = apiTryout
    ? upsertTryoutFromApi(currentTryouts, apiTryout)
    : currentTryouts;
  const results = apiResults
    .map(mapTeacherTryoutResultApiItem)
    .filter((item): item is TryoutResult => item !== null);

  return nextTryouts.map((item) =>
    item.id === tryoutId
      ? {
          ...item,
          hasil: results,
        }
      : item,
  );
}

function replaceTryoutsFromApi(
  apiTryouts: TeacherTryoutApiItem[],
  currentTryouts: TryoutItem[],
) {
  return apiTryouts.map((item) => {
    const nextTryoutId = normalizeText(item.tryoutId) || normalizeText(item.id);
    const existingTryout =
      currentTryouts.find((candidate) => candidate.id === nextTryoutId) ?? null;

    return mapTeacherTryoutApiItem(item, existingTryout);
  });
}

function upsertTryoutFromApi(
  currentTryouts: TryoutItem[],
  apiTryout: TeacherTryoutApiItem,
) {
  const nextTryoutId = normalizeText(apiTryout.tryoutId) || normalizeText(apiTryout.id);
  const existingTryout =
    currentTryouts.find((candidate) => candidate.id === nextTryoutId) ?? null;
  const nextTryout = mapTeacherTryoutApiItem(apiTryout, existingTryout);
  const nextIndex = currentTryouts.findIndex((candidate) => candidate.id === nextTryout.id);

  if (nextIndex === -1) {
    return [nextTryout, ...currentTryouts];
  }

  return currentTryouts.map((candidate, index) =>
    index === nextIndex ? nextTryout : candidate,
  );
}

function buildTryoutMutationPayload(draft: TryoutDraft) {
  return {
    assessmentType: draft.assessmentType,
    branch: normalizeText(draft.branch),
    title: normalizeText(draft.judulTryout),
    jenjang: draft.jenjang,
    kelas: draft.kelas,
    subject: normalizeText(draft.mapel),
    stage: draft.assessmentType === "Tryout" ? (draft.stage ?? 1) : null,
    durationMinutes: draft.durasiMenit,
    startAt: toIsoDateTimeValue(draft.tanggalMulai),
    endAt: toIsoDateTimeValue(draft.tanggalSelesai),
    publishStatus: toBackendPublishStatus(draft.publishStatus),
    questionSource: draft.questionSource,
    questionCount: draft.jumlahSoal,
    questionBankId:
      draft.questionSource === "bank" ? draft.questionBankId ?? "" : "",
    fileName: draft.questionSource === "file" ? draft.fileName ?? "" : "",
  };
}

function createEmptyTryoutDraft(
  jenjang: TryoutJenjang,
  branch = "",
): TryoutDraft {
  return {
    id: "",
    branch,
    assessmentType: "Tryout",
    judulTryout: "",
    jenjang,
    kelas: FINAL_CLASS_BY_JENJANG[jenjang],
    mapel: "",
    stage: 1,
    jumlahSoal: 0,
    durasiMenit: 90,
    tanggalMulai: "",
    tanggalSelesai: "",
    publishStatus: "Draft",
    questionSource: "file",
    questionBankId: undefined,
    fileName: undefined,
  };
}

function createEmptyQuestionDraft(): QuestionDraft {
  return {
    pertanyaan: "",
    opsiA: "",
    opsiB: "",
    opsiC: "",
    opsiD: "",
    jawabanBenar: "A",
  };
}

function createQuestionDraftFromQuestion(question: TryoutQuestion): QuestionDraft {
  return {
    pertanyaan: question.pertanyaan,
    opsiA: question.opsiA,
    opsiB: question.opsiB,
    opsiC: question.opsiC,
    opsiD: question.opsiD,
    jawabanBenar: question.jawabanBenar,
  };
}

function formatDateTime(value: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatScheduleRange(start: string, end: string) {
  return `${formatDateTime(start)} - ${formatDateTime(end)}`;
}

function normalizeTryoutDraft(
  draft: TryoutDraft,
  tryouts: TryoutItem[],
): TryoutDraft {
  if (draft.questionSource === "bank") {
    return {
      ...draft,
      questionBankId: draft.questionBankId,
      fileName: undefined,
    };
  }

  if (draft.questionSource === "file") {
    return {
      ...draft,
      questionBankId: undefined,
    };
  }

  const existingTryout = tryouts.find((item) => item.id === draft.id);

  return {
    ...draft,
    jumlahSoal: Math.max(
      existingTryout?.jumlahSoal ?? 0,
      existingTryout?.soal.length ?? 0,
    ),
    questionBankId: undefined,
    fileName: undefined,
  };
}

function forceFileUploadDraftBeforeUpload(draft: TryoutDraft): TryoutDraft {
  if (draft.questionSource !== "file" || draft.jumlahSoal > 0) {
    return draft;
  }

  return {
    ...draft,
    publishStatus: "Draft",
  };
}

function getPublishBadgeClass(status: PublishStatus) {
  return status === "Published"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-slate-200 bg-slate-50 text-slate-600";
}

function getQuestionBadgeClass(totalQuestion: number) {
  return totalQuestion > 0
    ? "border-orange-200 bg-orange-50 text-orange-700"
    : "border-amber-200 bg-amber-50 text-amber-700";
}

function getResultStatusClass(status: ResultStatus) {
  if (status === "Sangat Baik") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "Baik") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  return "border-orange-200 bg-orange-50 text-orange-700";
}

function getQuestionSourceLabel(source: QuestionSource) {
  if (source === "bank") {
    return "Bank Soal";
  }

  if (source === "file") {
    return "File";
  }

  return "Manual";
}

function getQuestionSourceBadgeClass(source: QuestionSource) {
  if (source === "bank") {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }

  if (source === "file") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function isTryoutQuestionSourceReady(source: QuestionSource) {
  return source === "manual" || source === "file";
}

function isTryoutReadyToPublish(item: TryoutItem) {
  return Boolean(
    normalizeText(item.judulTryout) &&
      (normalizeText(item.canonicalClassName) || normalizeText(item.kelas)) &&
      normalizeText(item.mapel) &&
      item.durasiMenit > 0 &&
      item.jumlahSoal > 0 &&
      isTryoutQuestionSourceReady(item.questionSource),
  );
}

function getTryoutQuestionCountLabel(item: Pick<TryoutItem, "questionSource" | "jumlahSoal">) {
  if (item.questionSource === "manual") {
    return `${item.jumlahSoal} soal`;
  }

  if (item.questionSource === "bank") {
    return `${item.jumlahSoal} soal bank`;
  }

  return item.jumlahSoal > 0 ? `${item.jumlahSoal} soal XLSX` : "Menunggu Upload";
}

function getTryoutQuestionStatusLabel(item: Pick<TryoutItem, "questionSource" | "jumlahSoal">) {
  if (item.questionSource === "file") {
    return item.jumlahSoal > 0 ? "File Siap" : "Menunggu File";
  }

  if (item.questionSource === "bank") {
    return item.jumlahSoal > 0 ? "Bank Siap" : "Bank Kosong";
  }

  return item.jumlahSoal > 0 ? "Soal Siap" : "Menunggu Soal";
}
}

function createEmptyTryoutDraft(
  jenjang: TryoutJenjang,
  branch = "",
): TryoutDraft {
  return {
    id: "",
    branch,
    assessmentType: "Tryout",
    judulTryout: "",
    jenjang,
    kelas: FINAL_CLASS_BY_JENJANG[jenjang],
    mapel: "",
    stage: 1,
    jumlahSoal: 0,
    durasiMenit: 90,
    tanggalMulai: "",
    tanggalSelesai: "",
    publishStatus: "Draft",
    questionSource: "file",
    questionBankId: undefined,
    fileName: undefined,
  };
}

function createEmptyQuestionDraft(): QuestionDraft {
  return {
    pertanyaan: "",
    opsiA: "",
    opsiB: "",
    opsiC: "",
    opsiD: "",
    jawabanBenar: "A",
  };
}

function createQuestionDraftFromQuestion(question: TryoutQuestion): QuestionDraft {
  return {
    pertanyaan: question.pertanyaan,
    opsiA: question.opsiA,
    opsiB: question.opsiB,
    opsiC: question.opsiC,
    opsiD: question.opsiD,
    jawabanBenar: question.jawabanBenar,
  };
}

function formatDateTime(value: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatScheduleRange(start: string, end: string) {
  return `${formatDateTime(start)} - ${formatDateTime(end)}`;
}

function normalizeTryoutDraft(
  draft: TryoutDraft,
  tryouts: TryoutItem[],
): TryoutDraft {
  if (draft.questionSource === "bank") {
    return {
      ...draft,
      questionBankId: draft.questionBankId,
      fileName: undefined,
    };
  }

  if (draft.questionSource === "file") {
    return {
      ...draft,
      questionBankId: undefined,
    };
  }

  const existingTryout = tryouts.find((item) => item.id === draft.id);

  return {
    ...draft,
    jumlahSoal: Math.max(
      existingTryout?.jumlahSoal ?? 0,
      existingTryout?.soal.length ?? 0,
    ),
    questionBankId: undefined,
    fileName: undefined,
  };
}

function forceFileUploadDraftBeforeUpload(draft: TryoutDraft): TryoutDraft {
  if (draft.questionSource !== "file" || draft.jumlahSoal > 0) {
    return draft;
  }

  return {
    ...draft,
    publishStatus: "Draft",
  };
}

function getPublishBadgeClass(status: PublishStatus) {
  return status === "Published"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-slate-200 bg-slate-50 text-slate-600";
}

function getQuestionBadgeClass(totalQuestion: number) {
  return totalQuestion > 0
    ? "border-orange-200 bg-orange-50 text-orange-700"
    : "border-amber-200 bg-amber-50 text-amber-700";
}

function getResultStatusClass(status: ResultStatus) {
  if (status === "Sangat Baik") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "Baik") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  return "border-orange-200 bg-orange-50 text-orange-700";
}

function getQuestionSourceLabel(source: QuestionSource) {
  if (source === "bank") {
    return "Bank Soal";
  }

  if (source === "file") {
    return "File";
  }

  return "Manual";
}

function getQuestionSourceBadgeClass(source: QuestionSource) {
  if (source === "bank") {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }

  if (source === "file") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function isTryoutQuestionSourceReady(source: QuestionSource) {
  return source === "manual" || source === "file";
}

function isTryoutReadyToPublish(item: TryoutItem) {
  return Boolean(
    normalizeText(item.judulTryout) &&
      (normalizeText(item.canonicalClassName) || normalizeText(item.kelas)) &&
      normalizeText(item.mapel) &&
      item.durasiMenit > 0 &&
      item.jumlahSoal > 0 &&
      isTryoutQuestionSourceReady(item.questionSource),
  );
}

function getTryoutQuestionCountLabel(item: Pick<TryoutItem, "questionSource" | "jumlahSoal">) {
  if (item.questionSource === "manual") {
    return `${item.jumlahSoal} soal`;
  }

  if (item.questionSource === "bank") {
    return `${item.jumlahSoal} soal bank`;
  }

  return item.jumlahSoal > 0 ? `${item.jumlahSoal} soal XLSX` : "Menunggu Upload";
}

function getTryoutQuestionStatusLabel(item: Pick<TryoutItem, "questionSource" | "jumlahSoal">) {
  if (item.questionSource === "file") {
    return item.jumlahSoal > 0 ? "File Siap" : "Menunggu File";
  }

  if (item.questionSource === "bank") {
    return item.jumlahSoal > 0 ? "Bank Siap" : "Bank Kosong";
  }

  return item.jumlahSoal > 0 ? "Soal Siap" : "Menunggu Soal";
}

function getQuestionSourceDetail(item: TryoutItem) {
  if (item.questionSource === "bank") {
    const packageLabel = item.packageId || item.questionSetId || item.questionBankId;

    return packageLabel
      ? `Bank soal terhubung: ${packageLabel}`
      : "Bank soal terhubung ke sistem.";
  }

  if (item.questionSource === "file") {
    return item.fileName
      ? `Soal hasil upload XLSX: ${item.fileName}`
      : "Belum ada file XLSX yang diupload.";
  }

  const totalManualQuestions = Math.max(item.jumlahSoal, item.soal.length);

  return totalManualQuestions > 0
    ? `${totalManualQuestions} soal manual tersimpan`
    : "Belum ada soal manual";
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  helper: string;
}) {
  return (
    <div className="rounded-[24px] border border-orange-100 bg-white px-4 py-4 shadow-[0_18px_38px_-34px_rgba(249,115,22,0.24)] transition-all duration-300 hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-[0_22px_42px_-32px_rgba(249,115,22,0.28)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          {label}
        </p>
        <div className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-orange-100 bg-orange-50 text-orange-500">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-3xl font-bold text-slate-800">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </div>
  );
}

function SegmentedButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border border-transparent px-3.5 py-1.5 text-xs font-medium transition-all ${
        active
          ? "bg-orange-500 text-white shadow-sm"
          : "bg-white text-slate-600 hover:bg-orange-50 hover:text-orange-600"
      }`}
    >
      {label}
    </button>
  );
}

function StatusBadge({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

function ActionIconButton({
  title,
  className,
  onClick,
  disabled = false,
  children,
}: {
  title: string;
  className: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`${ACTION_BUTTON_CLASS} rounded-xl ${className} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {children}
    </button>
  );
}

function TryoutFormDialog({
  draft,
  classOptions,
  mode,
  open,
  onClose,
  onChange,
  onOpenFileUploader,
  onOpenManualManager,
  onSubmit,
  isSubmitting,
  questionsLocked,
}: {
  draft: TryoutDraft | null;
  classOptions: TeacherAssessmentClassOption[];
  mode: DialogMode;
  open: boolean;
  onClose: () => void;
  onChange: (field: keyof TryoutDraft, value: string | number) => void;
  onOpenFileUploader: () => void;
  onOpenManualManager: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  questionsLocked: boolean;
}) {
  const isFileSource = draft?.questionSource === "file";
  const isManualSource = draft?.questionSource === "manual";
          ) : error ? (
            <div className="rounded-[24px] border border-rose-200 bg-rose-50/70 px-5 py-6 text-center">
              <p className="text-sm font-semibold text-rose-700">{error}</p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-4 border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
              >
                Muat Ulang Hasil
              </button>
            </div>
          ) : tryout && tryout.hasil.length > 0 ? (
            <div className="overflow-x-auto rounded-[20px] border border-orange-100">
              <table className="min-w-full">
                <thead className="bg-orange-50/80 text-left">
                  <tr className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    <th className="px-4 py-3 font-semibold">Nama Siswa</th>
                    <th className="px-4 py-3 font-semibold">Benar</th>
                    <th className="px-4 py-3 font-semibold">Salah</th>
                    <th className="px-4 py-3 font-semibold">Kosong</th>
                    <th className="px-4 py-3 font-semibold">Nilai</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tryout.hasil.map((result) => (
                    <tr
                      key={result.id}
                      className="border-t border-orange-100/80 text-sm"
                    >
                      <td className="px-4 py-4 font-semibold text-slate-800">
                        {result.namaSiswa}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {result.benar}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {result.salah}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {result.belumDijawab ?? 0}
                      </td>
                      <td className="px-4 py-4 font-semibold text-slate-800">
                        {result.nilai}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge
                          className={getResultStatusClass(result.status)}
                        >
                          {result.status}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-[24px] border border-dashed border-orange-200 bg-orange-50/30 px-5 py-10 text-center">
              <p className="text-sm font-semibold text-slate-700">
                Belum ada hasil ujian yang tersedia.
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Hasil ujian akan tersedia setelah siswa mengerjakan ujian
                dan data penilaian tersimpan.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-orange-100 px-4 py-3 md:px-5">
          <DialogClose asChild>
            <button
              type="button"
              className="border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Tutup
            </button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function TryoutGuruSection() {
  const searchParams = useSearchParams();
  const { academicYear } = getSelectedAcademicPeriod(searchParams);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedJenjang, setSelectedJenjang] =
    useState<TryoutJenjang>("SMA");
  const [selectedStatus, setSelectedStatus] =
    useState<StatusFilter>("Semua");
  const [tryouts, setTryouts] = useState<TryoutItem[]>([]);
  const [branchOptions, setBranchOptions] = useState<string[]>([]);
  const [teacherSubject, setTeacherSubject] = useState("");
  const [classOptions, setClassOptions] = useState<TeacherAssessmentClassOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<DialogMode>("add");
  const [draftTryout, setDraftTryout] = useState<TryoutDraft | null>(null);
  const [isTryoutSubmitting, setIsTryoutSubmitting] = useState(false);

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedUploadTryoutId, setSelectedUploadTryoutId] = useState<
    string | null
  >(null);
  const [questionDraft, setQuestionDraft] = useState<QuestionDraft>(
    createEmptyQuestionDraft(),
  );
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [isQuestionLoading, setIsQuestionLoading] = useState(false);
  const [questionLoadError, setQuestionLoadError] = useState<string | null>(null);
  const [questionSuccessMessage, setQuestionSuccessMessage] = useState<
    string | null
  >(null);
  const [isQuestionSubmitting, setIsQuestionSubmitting] = useState(false);
  const [isXlsxUploading, setIsXlsxUploading] = useState(false);
  const [tryoutReloadSignal, setTryoutReloadSignal] = useState(0);
  const saveTryoutInFlightRef = useRef(false);
  const questionSubmitInFlightRef = useRef(false);
  const xlsxUploadInFlightRef = useRef(false);

  const [isResultOpen, setIsResultOpen] = useState(false);
  const [selectedResultTryoutId, setSelectedResultTryoutId] = useState<
    string | null
  >(null);
  const [isResultLoading, setIsResultLoading] = useState(false);
  const [resultLoadError, setResultLoadError] = useState<string | null>(null);

  const selectedKelas = `Semua kelas ${selectedJenjang}`;

  const stats = useMemo(() => {
    return {
      draft: tryouts.filter((item) => item.publishStatus === "Draft").length,
      menungguSoal: tryouts.filter((item) => item.jumlahSoal === 0).length,
      published: tryouts.filter((item) => item.publishStatus === "Published")
        .length,
      total: tryouts.length,
    };
  }, [tryouts]);

  const filteredTryouts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return tryouts.filter((item) => {
      const matchesSearch =
        !normalizedQuery ||
        item.judulTryout.toLowerCase().includes(normalizedQuery) ||
        item.mapel.toLowerCase().includes(normalizedQuery) ||
        normalizeText(item.branch).toLowerCase().includes(normalizedQuery) ||
        normalizeText(item.classId).toLowerCase().includes(normalizedQuery) ||
        normalizeText(item.packageId).toLowerCase().includes(normalizedQuery) ||
        item.assessmentType.toLowerCase().includes(normalizedQuery) ||
        item.kelas.toLowerCase().includes(normalizedQuery) ||
        item.jenjang.toLowerCase().includes(normalizedQuery) ||
        getQuestionSourceLabel(item.questionSource)
          .toLowerCase()
          .includes(normalizedQuery) ||
        getQuestionSourceDetail(item).toLowerCase().includes(normalizedQuery);

      const matchesJenjang = item.jenjang === selectedJenjang;
      const matchesStatus =
        selectedStatus === "Semua" || item.publishStatus === selectedStatus;

      return matchesSearch && matchesJenjang && matchesStatus;
    });
  }, [searchQuery, selectedJenjang, selectedStatus, tryouts]);

  const uploadTargetTryout = useMemo(
    () =>
      tryouts.find((item) => item.id === selectedUploadTryoutId) ?? null,
    [selectedUploadTryoutId, tryouts],
  );

  const resultTargetTryout = useMemo(
    () =>
      tryouts.find((item) => item.id === selectedResultTryoutId) ?? null,
    [selectedResultTryoutId, tryouts],
  );
  const formQuestionsLocked = Boolean(
    formMode === "edit" &&
      draftTryout?.id &&
      tryouts.find((item) => item.id === draftTryout.id)?.publishStatus !==
        "Draft",
  );

  const loadTeacherTryouts = useEffectEvent(async () => {
    try {
      setIsLoading(true);
      setLoadError(null);

      const { response, payload } =
        await fetchTeacherTryoutJson<TeacherTryoutListResponse>(
          buildGuruApiUrl("/api/teacher/me/tryouts", searchParams),
          {
            method: "GET",
          },
        );

      if (response.status === 401) {
        clearAuthClientState();
      }

      if (!response.ok || !payload?.success) {
        throw new Error(
          payload?.message || "Data tryout guru belum bisa dimuat.",
        );
      }

      const apiTryouts = payload.data?.tryouts ?? [];
      const loadedTryouts = apiTryouts.map((item) =>
        mapTeacherTryoutApiItem(item),
      );

      console.log("[DEBUG TryoutGuruSection] fetched tryouts length:", apiTryouts.length, "for url:", buildGuruApiUrl("/api/teacher/me/tryouts", searchParams));

      setTryouts((current) => replaceTryoutsFromApi(apiTryouts, current));
      setSelectedJenjang((currentJenjang) => {
        if (loadedTryouts.length === 0) {
          return currentJenjang;
        }

        const hasVisibleTryoutForCurrentFilter = loadedTryouts.some(
          (item) => item.jenjang === currentJenjang,
        );

        if (hasVisibleTryoutForCurrentFilter) {
          return currentJenjang;
        }

        return loadedTryouts[0].jenjang;
      });
    } catch (error) {
      console.error("[tryout-guru-section] load_tryouts_failed", error);
      setTryouts([]);
      setLoadError(
        error instanceof Error && error.message
          ? error.message
          : "Data tryout guru belum bisa dimuat.",
      );
    } finally {
      setIsLoading(false);
    }
  });

  const loadTeacherBranches = useEffectEvent(async () => {
    try {
      const response = await fetch(buildGuruApiUrl("/api/teacher/me/dashboard", searchParams), {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | TeacherDashboardResponse
        | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Cabang guru belum bisa dimuat.");
      }

      const teacher = payload.data?.teacher;
      const subject = normalizeText(teacher?.subject);
      const branches = Array.from(
        new Set(
          [teacher?.branch, ...(teacher?.branches ?? [])]
            .map((branch) => normalizeText(branch))
            .filter(Boolean),
        ),
      );
      const classResponse = await fetch(buildGuruApiUrl("/api/teacher/me/classes", searchParams), {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const classPayload = (await classResponse.json().catch(() => null)) as
        | TeacherClassListResponse
        | null;

      if (!classResponse.ok || !classPayload?.success) {
        throw new Error(
          classPayload?.message || "Kelas guru belum bisa dimuat.",
        );
      }

      const classes = (classPayload.data?.classes ?? [])
        .map((item) => mapTeacherClassApiItem(item, subject))
        .filter(
          (item): item is TeacherAssessmentClassOption => item !== null,
        );

      setTeacherSubject(subject);
      setBranchOptions(branches);
      setClassOptions(classes);
    } catch (error) {
      console.error("[tryout-guru-section] load_branches_failed", error);
      setTeacherSubject("");
      setBranchOptions([]);
      setClassOptions([]);
    }
  });

  useEffect(() => {
    queueMicrotask(() => {
      void loadTeacherTryouts();
      void loadTeacherBranches();
    });
  }, [academicYear, tryoutReloadSignal]);

  const loadManualQuestions = useCallback(async (tryoutId: string) => {
    try {
      setIsQuestionLoading(true);
      setQuestionLoadError(null);

      const { response, payload } =
        await fetchTeacherTryoutJson<TeacherTryoutQuestionListResponse>(
          `/api/teacher/me/tryouts/${encodeURIComponent(tryoutId)}/questions`,
          {
            method: "GET",
          },
        );

      if (response.status === 401) {
        clearAuthClientState();
      }

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Soal tryout belum bisa dimuat.");
      }

      setTryouts((current) =>
        syncTryoutQuestionsFromApi(
          current,
          tryoutId,
          payload.data?.questions ?? [],
          payload.data?.tryout,
        ),
      );
      setLoadError(null);
    } catch (error) {
      console.error("[tryout-guru-section] load_questions_failed", error);
      setQuestionLoadError(
        error instanceof Error && error.message
          ? error.message
          : "Soal tryout belum bisa dimuat.",
      );
    } finally {
      setIsQuestionLoading(false);
    }
  }, []);

  useEffect(() => {
    if (
      !isUploadOpen ||
      !selectedUploadTryoutId
    ) {
      return;
    }

    queueMicrotask(() => {
      void loadManualQuestions(selectedUploadTryoutId);
    });
  }, [
    isUploadOpen,
    loadManualQuestions,
    selectedUploadTryoutId,
    uploadTargetTryout?.questionSource,
  ]);

  function openAddDialog() {
    const initialClassOption =
      classOptions.find((option) => option.assessmentMode === "tryout") ??
      classOptions[0] ??
      null;
    const emptyDraft = createEmptyTryoutDraft(
      initialClassOption?.jenjang ?? selectedJenjang,
      initialClassOption?.branch ?? (branchOptions.length === 1 ? branchOptions[0] : ""),
    );

    setFormMode("add");
    setDraftTryout(
      initialClassOption
        ? applyClassOptionToDraft(emptyDraft, initialClassOption)
        : {
            ...emptyDraft,
            mapel: teacherSubject,
          },
    );
    setIsFormOpen(true);
  }

  function openEditDialog(tryout: TryoutItem) {
    setFormMode("edit");
    setDraftTryout({
      id: tryout.id,
      classId: tryout.classId,
      branch: tryout.branch,
      canonicalClassName: tryout.canonicalClassName,
      assessmentType: tryout.assessmentType,
      judulTryout: tryout.judulTryout,
      jenjang: tryout.jenjang,
      kelas: tryout.kelas,
      mapel: tryout.mapel,
      stage: tryout.stage,
      jumlahSoal: tryout.jumlahSoal,
      durasiMenit: tryout.durasiMenit,
      tanggalMulai: tryout.tanggalMulai,
      tanggalSelesai: tryout.tanggalSelesai,
      publishStatus: tryout.publishStatus,
      questionSource: tryout.questionSource,
      questionBankId: tryout.questionBankId,
      fileName: tryout.fileName,
    });
    setIsFormOpen(true);
  }

  function closeFormDialog() {
    setIsFormOpen(false);
    setDraftTryout(null);
  }

  function handleTryoutDraftChange(
    field: keyof TryoutDraft,
    value: string | number,
  ) {
    setDraftTryout((current) => {
      if (!current) {
        return current;
      }

      if (field === "jenjang") {
        const nextJenjang = value as TryoutJenjang;
        return normalizeTryoutDraft(
          {
            ...current,
            jenjang: nextJenjang,
            kelas: FINAL_CLASS_BY_JENJANG[nextJenjang],
          },
          tryouts,
        );
      }

      if (field === "classId") {
        const selectedClassOption =
          classOptions.find((option) => option.id === String(value)) ?? null;

        return selectedClassOption
          ? applyClassOptionToDraft(current, selectedClassOption)
          : current;
      }

      if (field === "assessmentType") {
        const nextAssessmentType = value as AssessmentType;
        const isTryoutClass =
          getAssessmentModeForClass(current.canonicalClassName ?? "") ===
          "tryout";

        return normalizeTryoutDraft(
          {
            ...current,
            assessmentType: isTryoutClass ? "Tryout" : nextAssessmentType,
            stage: isTryoutClass ? current.stage ?? 1 : null,
          },
          tryouts,
        );
      }

      if (field === "durasiMenit" || field === "stage") {
        return normalizeTryoutDraft(
          {
            ...current,
            [field]: Number(value),
          },
          tryouts,
        );
      }

      if (field === "questionSource") {
        return normalizeTryoutDraft(
          {
            ...current,
            questionSource: value as QuestionSource,
          },
          tryouts,
        );
      }

      if (field === "questionBankId") {
        return normalizeTryoutDraft(
          {
            ...current,
            questionBankId: String(value),
          },
          tryouts,
        );
      }

      return normalizeTryoutDraft(
        {
          ...current,
          [field]: String(value),
        },
        tryouts,
      );
    });
  }

  function handleOpenManualManagerFromForm() {
    if (!draftTryout?.id) {
      toast.error(
        "Simpan ujian sebagai draft terlebih dahulu sebelum menambahkan soal manual.",
      );
      return;
    }

    const persistedTryout = tryouts.find((item) => item.id === draftTryout.id);

    if (persistedTryout?.publishStatus !== "Draft") {
      toast.error(DRAFT_ONLY_QUESTION_MESSAGE);
      return;
    }

    setIsFormOpen(false);
    openUploadDialog(draftTryout.id);
  }

  function handleOpenFileUploaderFromForm() {
    if (!draftTryout?.id) {
      toast.error(
        "Lengkapi metadata ujian, lalu klik Simpan & Lanjut Upload XLSX untuk memilih file soal.",
      );
      return;
    }

    const persistedTryout = tryouts.find((item) => item.id === draftTryout.id);

    if (persistedTryout?.publishStatus !== "Draft") {
      toast.error(DRAFT_ONLY_QUESTION_MESSAGE);
      return;
    }

    setIsFormOpen(false);
    openUploadDialog(draftTryout.id);
  }

  async function handleSaveTryout() {
    if (!draftTryout || saveTryoutInFlightRef.current) {
      return;
    }

    const normalizedDraft = normalizeTryoutDraft(draftTryout, tryouts);
    const draftForSave = forceFileUploadDraftBeforeUpload(normalizedDraft);

    if (
      !normalizeText(draftForSave.classId) ||
      !draftForSave.judulTryout.trim() ||
      !normalizeText(draftForSave.branch) ||
      !draftForSave.mapel.trim() ||
      !draftForSave.tanggalMulai ||
      !draftForSave.tanggalSelesai
    ) {
      toast.error(
        "Pilih kelas, lalu lengkapi judul, tanggal mulai, dan tanggal selesai.",
      );
      return;
    }

    if (
      new Date(draftForSave.tanggalSelesai) <=
      new Date(draftForSave.tanggalMulai)
    ) {
      toast.error("Tanggal selesai harus lebih besar dari tanggal mulai.");
      return;
    }

    if (draftForSave.durasiMenit < 15) {
      toast.error("Durasi assessment minimal 15 menit.");
      return;
    }

    if (
      draftForSave.publishStatus === "Published" &&
      !isTryoutQuestionSourceReady(draftForSave.questionSource)
    ) {
      toast.error(
        "Sumber soal ini belum siap dipublish.",
      );
      return;
    }

    if (
      draftForSave.publishStatus === "Published" &&
      draftForSave.jumlahSoal === 0
    ) {
      toast.error(
        draftForSave.questionSource === "manual"
          ? "Ujian manual belum dapat dipublish karena belum memiliki soal."
          : "Ujian belum dapat dipublish karena sumber soal belum siap.",
      );
      return;
    }

    saveTryoutInFlightRef.current = true;
    setIsTryoutSubmitting(true);

    try {
      const isEditMode =
        formMode === "edit" && Boolean(normalizeText(draftForSave.id));
      const endpoint = isEditMode
        ? `/api/teacher/me/tryouts/${encodeURIComponent(draftForSave.id)}`
        : "/api/teacher/me/tryouts";
      const method = isEditMode ? "PATCH" : "POST";
      const { response, payload } =
        await fetchTeacherTryoutJson<TeacherTryoutDetailResponse>(endpoint, {
          method,
          body: JSON.stringify(buildTryoutMutationPayload(draftForSave)),
        });

      if (response.status === 401) {
        clearAuthClientState();
      }

      if (!response.ok || !payload?.success || !payload.data?.tryout) {
        throw new Error(payload?.message || "Tryout guru belum bisa disimpan.");
      }

      const savedTryout = payload.data.tryout;
      const savedTryoutId =
        normalizeText(savedTryout.tryoutId) ||
        normalizeText(savedTryout.id) ||
        normalizeText(draftForSave.id);
      const shouldOpenUploadAfterSave =
        draftForSave.questionSource === "file" &&
        toTryoutPublishStatus(savedTryout.publishStatus) === "Draft" &&
        Boolean(savedTryoutId);

      setTryouts((current) =>
        upsertTryoutFromApi(current, savedTryout as TeacherTryoutApiItem),
      );
      setLoadError(null);
      closeFormDialog();

      if (shouldOpenUploadAfterSave) {
        openUploadDialog(savedTryoutId);
      }
    } catch (error) {
      console.error("[tryout-guru-section] save_tryout_failed", error);
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Tryout guru belum bisa disimpan.",
      );
    } finally {
      saveTryoutInFlightRef.current = false;
      setIsTryoutSubmitting(false);
    }
  }

  async function handleDeleteTryout(tryoutId: string) {
    const targetTryout = tryouts.find((item) => item.id === tryoutId);

    if (!targetTryout || targetTryout.publishStatus !== "Draft") {
      toast.error("Ujian hanya bisa dihapus jika masih berstatus draft.");
      return;
    }

    if (!window.confirm("Hapus tryout ini dari daftar guru?")) {
      return;
    }

    try {
      const { response, payload } =
        await fetchTeacherTryoutJson<TeacherTryoutDetailResponse>(
          `/api/teacher/me/tryouts/${encodeURIComponent(tryoutId)}`,
          {
            method: "DELETE",
          },
        );

      if (response.status === 401) {
        clearAuthClientState();
      }

      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.message || "Tryout guru belum bisa dihapus.");
      }

      setTryouts((current) => current.filter((item) => item.id !== tryoutId));
      setLoadError(null);
    } catch (error) {
      console.error("[tryout-guru-section] delete_tryout_failed", error);
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Tryout guru belum bisa dihapus.",
      );
    }
  }

  async function handleTogglePublish(tryoutId: string) {
    const targetTryout = tryouts.find((item) => item.id === tryoutId);

    if (
      targetTryout &&
      targetTryout.publishStatus === "Draft" &&
      !isTryoutQuestionSourceReady(targetTryout.questionSource)
    ) {
      toast.error(
        "Sumber soal ini belum siap dipublish.",
      );
      return;
    }

    if (
      targetTryout &&
      targetTryout.publishStatus === "Draft" &&
      targetTryout.jumlahSoal === 0
    ) {
      toast.error(
        targetTryout.questionSource === "manual"
      ? "Ujian manual belum dapat dipublish karena belum memiliki soal."
      : "Ujian belum dapat dipublish karena sumber soal belum siap.",
      );
      return;
    }

    if (!targetTryout) {
      return;
    }

    if (
      targetTryout.publishStatus === "Draft" &&
      !isTryoutReadyToPublish(targetTryout)
    ) {
      toast.error(
        "Lengkapi judul, kelas, mapel, durasi, dan minimal 1 soal sebelum publish.",
      );
      return;
    }

    const nextDraft = normalizeTryoutDraft(
      {
        id: targetTryout.id,
        classId: targetTryout.classId,
        branch: targetTryout.branch ?? "",
        canonicalClassName: targetTryout.canonicalClassName,
        assessmentType: targetTryout.assessmentType,
        judulTryout: targetTryout.judulTryout,
        jenjang: targetTryout.jenjang,
        kelas: targetTryout.kelas,
        mapel: targetTryout.mapel,
        stage: targetTryout.stage,
        jumlahSoal: targetTryout.jumlahSoal,
        durasiMenit: targetTryout.durasiMenit,
        tanggalMulai: targetTryout.tanggalMulai,
        tanggalSelesai: targetTryout.tanggalSelesai,
        publishStatus:
          targetTryout.publishStatus === "Published" ? "Draft" : "Published",
        questionSource: targetTryout.questionSource,
        questionBankId: targetTryout.questionBankId,
        fileName: targetTryout.fileName,
      },
      tryouts,
    );

    try {
      const { response, payload } =
        await fetchTeacherTryoutJson<TeacherTryoutDetailResponse>(
          `/api/teacher/me/tryouts/${encodeURIComponent(tryoutId)}`,
          {
            method: "PATCH",
            body: JSON.stringify(buildTryoutMutationPayload(nextDraft)),
          },
        );

      if (response.status === 401) {
        clearAuthClientState();
      }

      if (!response.ok || !payload?.success || !payload.data?.tryout) {
        throw new Error(payload?.message || "Status tryout belum bisa diperbarui.");
      }

      setTryouts((current) =>
        upsertTryoutFromApi(current, payload.data?.tryout as TeacherTryoutApiItem),
      );
      setLoadError(null);
    } catch (error) {
      console.error("[tryout-guru-section] toggle_publish_failed", error);
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Status tryout belum bisa diperbarui.",
      );
    }
  }

  function openUploadDialog(tryoutId: string) {
    setSelectedUploadTryoutId(tryoutId);
    setQuestionDraft(createEmptyQuestionDraft());
    setEditingQuestionId(null);
    setQuestionLoadError(null);
    setQuestionSuccessMessage(null);
    setIsUploadOpen(true);
  }

  function closeUploadDialog() {
    setIsUploadOpen(false);
    setSelectedUploadTryoutId(null);
    setQuestionDraft(createEmptyQuestionDraft());
    setEditingQuestionId(null);
    setQuestionLoadError(null);
    setQuestionSuccessMessage(null);
    setIsQuestionLoading(false);
    setIsQuestionSubmitting(false);
    setIsXlsxUploading(false);
    setTryoutReloadSignal((current) => current + 1);
  }

  function resetQuestionEditor() {
    setQuestionDraft(createEmptyQuestionDraft());
    setEditingQuestionId(null);
  }

  function handleQuestionDraftChange(
    field: keyof QuestionDraft,
    value: string,
  ) {
    setQuestionSuccessMessage(null);
    setQuestionDraft((current) => ({
      ...current,
      [field]:
        field === "jawabanBenar" ? (value as JawabanBenar) : value,
    }));
  }

  function handleEditQuestion(question: TryoutQuestion) {
    setEditingQuestionId(question.id);
    setQuestionDraft(createQuestionDraftFromQuestion(question));
    setQuestionLoadError(null);
    setQuestionSuccessMessage(null);
  }

  function handleCancelEditQuestion() {
    resetQuestionEditor();
    setQuestionSuccessMessage(null);
  }

  async function handleUploadXlsxQuestionFile(file: File) {
    if (!selectedUploadTryoutId || xlsxUploadInFlightRef.current) {
      return;
    }

    if (uploadTargetTryout?.publishStatus !== "Draft") {
      toast.error(DRAFT_ONLY_QUESTION_MESSAGE);
      return;
    }

    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      toast.error("Format file tidak didukung. Harap unggah file .xlsx atau .xls.");
      return;
    }

    xlsxUploadInFlightRef.current = true;

    try {
      setIsXlsxUploading(true);
      setQuestionLoadError(null);
      setQuestionSuccessMessage(null);

      const fileDataBase64 = await readFileAsBase64(file);
      const { response, payload } =
        await fetchTeacherTryoutJson<TeacherTryoutQuestionListResponse>(
          `/api/teacher/me/tryouts/${encodeURIComponent(selectedUploadTryoutId)}/questions/xlsx`,
          {
            method: "POST",
            body: JSON.stringify({
              fileName: file.name,
              fileDataBase64,
            }),
          },
        );

      if (response.status === 401) {
        clearAuthClientState();
      }

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "File XLSX belum bisa diproses.");
      }

      setTryouts((current) =>
        syncTryoutQuestionsFromApi(
          current,
          selectedUploadTryoutId,
          payload.data?.questions ?? [],
          payload.data?.tryout,
        ),
      );
      setLoadError(null);
      setQuestionLoadError(null);
      setQuestionSuccessMessage(
        `File ${file.name} berhasil diproses menjadi ${payload.data?.questions?.length ?? 0} soal.`,
      );
    } catch (error) {
      console.error("[tryout-guru-section] upload_xlsx_failed", error);
      setQuestionLoadError(
        error instanceof Error && error.message
          ? error.message
          : "File XLSX belum bisa diproses.",
      );
    } finally {
      xlsxUploadInFlightRef.current = false;
      setIsXlsxUploading(false);
    }
  }

  async function handleSubmitQuestion() {
    if (
      !selectedUploadTryoutId ||
      uploadTargetTryout?.questionSource !== "manual" ||
      questionSubmitInFlightRef.current
    ) {
      return;
    }

    if (uploadTargetTryout.publishStatus !== "Draft") {
      toast.error(DRAFT_ONLY_QUESTION_MESSAGE);
      return;
    }

    const fields = [
      questionDraft.pertanyaan,
      questionDraft.opsiA,
      questionDraft.opsiB,
      questionDraft.opsiC,
      questionDraft.opsiD,
    ];

    if (fields.some((field) => !field.trim())) {
      toast.error("Mohon lengkapi pertanyaan dan semua opsi jawaban terlebih dahulu.");
      return;
    }

    questionSubmitInFlightRef.current = true;

    try {
      setIsQuestionSubmitting(true);
      setQuestionSuccessMessage(null);
      const isEditMode = Boolean(editingQuestionId);

      const { response, payload } =
        await fetchTeacherTryoutJson<TeacherTryoutQuestionDetailResponse>(
          isEditMode
            ? `/api/teacher/me/tryouts/${encodeURIComponent(selectedUploadTryoutId)}/questions/${encodeURIComponent(editingQuestionId ?? "")}`
            : `/api/teacher/me/tryouts/${encodeURIComponent(selectedUploadTryoutId)}/questions`,
          {
            method: isEditMode ? "PATCH" : "POST",
            body: JSON.stringify({
              questionText: normalizeText(questionDraft.pertanyaan),
              optionA: normalizeText(questionDraft.opsiA),
              optionB: normalizeText(questionDraft.opsiB),
              optionC: normalizeText(questionDraft.opsiC),
              optionD: normalizeText(questionDraft.opsiD),
              correctAnswer: questionDraft.jawabanBenar,
            }),
          },
        );

      if (response.status === 401) {
        clearAuthClientState();
      }

      if (!response.ok || !payload?.success || !payload.data?.question) {
        throw new Error(payload?.message || "Soal tryout belum bisa disimpan.");
      }

      setTryouts((current) => {
        if (!payload.data?.question) {
          return current;
        }

        return upsertTryoutQuestionFromApi(
          current,
          selectedUploadTryoutId,
          payload.data.question as TeacherTryoutQuestionApiItem,
          payload.data?.tryout,
        );
      });
      resetQuestionEditor();
      setQuestionLoadError(null);
      setLoadError(null);
      setQuestionSuccessMessage(
        isEditMode
          ? "Perubahan soal berhasil disimpan."
          : "Soal baru berhasil ditambahkan.",
      );
    } catch (error) {
      console.error("[tryout-guru-section] save_question_failed", error);
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Soal tryout belum bisa disimpan.",
      );
    } finally {
      questionSubmitInFlightRef.current = false;
      setIsQuestionSubmitting(false);
    }
  }

  async function handleDeleteQuestion(questionId: string) {
    if (
      !selectedUploadTryoutId ||
      uploadTargetTryout?.questionSource !== "manual"
    ) {
      return;
    }

    if (uploadTargetTryout.publishStatus !== "Draft") {
      toast.error(DRAFT_ONLY_QUESTION_MESSAGE);
      return;
    }

    if (!window.confirm("Hapus soal manual ini dari tryout?")) {
      return;
    }

    try {
      setIsQuestionSubmitting(true);

      const { response, payload } =
        await fetchTeacherTryoutJson<TeacherTryoutQuestionDetailResponse>(
          `/api/teacher/me/tryouts/${encodeURIComponent(selectedUploadTryoutId)}/questions/${encodeURIComponent(questionId)}`,
          {
            method: "DELETE",
          },
        );

      if (response.status === 401) {
        clearAuthClientState();
      }

      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.message || "Soal tryout belum bisa dihapus.");
      }

      if (editingQuestionId === questionId) {
        resetQuestionEditor();
      }

      setLoadError(null);
      setQuestionLoadError(null);
      await loadManualQuestions(selectedUploadTryoutId);
    } catch (error) {
      console.error("[tryout-guru-section] delete_question_failed", error);
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Soal tryout belum bisa dihapus.",
      );
    } finally {
      setIsQuestionSubmitting(false);
    }
  }

  async function handleMoveQuestion(
    questionId: string,
    direction: "up" | "down",
  ) {
    if (
      !selectedUploadTryoutId ||
      uploadTargetTryout?.questionSource !== "manual"
    ) {
      return;
    }

    if (uploadTargetTryout.publishStatus !== "Draft") {
      toast.error(DRAFT_ONLY_QUESTION_MESSAGE);
      return;
    }

    const currentQuestionIndex = uploadTargetTryout.soal.findIndex(
      (question) => question.id === questionId,
    );

    if (currentQuestionIndex === -1) {
      return;
    }

    const targetIndex =
      direction === "up" ? currentQuestionIndex - 1 : currentQuestionIndex + 1;

    if (
      targetIndex < 0 ||
      targetIndex >= uploadTargetTryout.soal.length
    ) {
      return;
    }

    try {
      setIsQuestionSubmitting(true);

      const { response, payload } =
        await fetchTeacherTryoutJson<TeacherTryoutQuestionDetailResponse>(
          `/api/teacher/me/tryouts/${encodeURIComponent(selectedUploadTryoutId)}/questions/${encodeURIComponent(questionId)}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              order: targetIndex + 1,
            }),
          },
        );

      if (response.status === 401) {
        clearAuthClientState();
      }

      if (!response.ok || payload?.success === false) {
        throw new Error(
          payload?.message || "Urutan soal tryout belum bisa diperbarui.",
        );
      }

      setLoadError(null);
      setQuestionLoadError(null);
      await loadManualQuestions(selectedUploadTryoutId);
    } catch (error) {
      console.error("[tryout-guru-section] reorder_question_failed", error);
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Urutan soal tryout belum bisa diperbarui.",
      );
    } finally {
      setIsQuestionSubmitting(false);
    }
  }

  const loadTryoutResults = useCallback(async (tryoutId: string) => {
    try {
      setIsResultLoading(true);
      setResultLoadError(null);

      const { response, payload } =
        await fetchTeacherTryoutJson<TeacherTryoutResultListResponse>(
          `/api/teacher/me/tryouts/${encodeURIComponent(tryoutId)}/results`,
          {
            method: "GET",
          },
        );

      if (response.status === 401) {
        clearAuthClientState();
      }

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Hasil tryout belum bisa dimuat.");
      }

      setTryouts((current) =>
        syncTryoutResultsFromApi(
          current,
          tryoutId,
          payload.data?.results ?? [],
          payload.data?.tryout,
        ),
      );
      setLoadError(null);
    } catch (error) {
      console.error("[tryout-guru-section] load_results_failed", error);
      setResultLoadError(
        error instanceof Error && error.message
          ? error.message
          : "Hasil tryout belum bisa dimuat.",
      );
    } finally {
      setIsResultLoading(false);
    }
  }, []);

  function openResultDialog(tryoutId: string) {
    setSelectedResultTryoutId(tryoutId);
    setResultLoadError(null);
    setIsResultOpen(true);
    void loadTryoutResults(tryoutId);
  }

  function closeResultDialog() {
    setIsResultOpen(false);
    setSelectedResultTryoutId(null);
    setResultLoadError(null);
    setIsResultLoading(false);
  }

  return (
    <>
      <div className="mx-auto mt-4 w-full max-w-7xl px-4 py-4 md:mt-6 md:px-6">
        <div className="flex flex-col gap-5">
          <section className="overflow-hidden rounded-[24px] border border-orange-100 bg-white shadow-[0_28px_60px_-42px_rgba(15,23,42,0.28)]">
            <div className="bg-gradient-to-br from-orange-50 via-white to-amber-50">
              <div className="bg-gradient-to-br from-orange-50 via-white to-amber-50 px-5 py-5 md:px-6 md:py-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-500">
                  Dashboard Ujian Guru
                </p>
                <h1 className="mt-2 text-2xl font-semibold text-slate-800 md:text-3xl">
                  Manajemen Ujian
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500 md:text-[15px]">
                  Kelola UTS/UAS untuk kelas non-akhir dan Tryout untuk kelas
                  akhir. Kelas dan mapel mengikuti data guru yang sedang login.
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              icon={ClipboardList}
              label="Total Ujian"
              value={stats.total}
              helper="Seluruh ujian aktif dan draft milik guru."
            />
            <SummaryCard
              icon={CheckCircle2}
              label="Published"
              value={stats.published}
              helper="Tryout yang sudah siap dibuka untuk siswa."
            />
            <SummaryCard
              icon={FileText}
              label="Draft"
              value={stats.draft}
              helper="Tryout yang masih perlu dilengkapi sebelum publish."
            />
            <SummaryCard
              icon={AlertTriangle}
              label="Menunggu Soal"
              value={stats.menungguSoal}
              helper="Tryout yang metadata-nya ada tetapi bank soal belum masuk."
            />
          </section>

          <section className="rounded-[24px] border border-orange-100 bg-white px-5 py-5 shadow-[0_22px_48px_-38px_rgba(15,23,42,0.26)] md:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-800">
                  Filter Tryout Kelas Akhir
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Kombinasikan pencarian, jenjang, kelas akhir otomatis, dan
                  status publish untuk menjaga daftar tryout tetap fokus.
                </p>
              </div>

              <div className="w-full max-w-md">
                <div className="flex items-center gap-2 rounded-2xl border border-orange-100 bg-orange-50/40 px-3 py-3 transition focus-within:border-orange-200 focus-within:ring-2 focus-within:ring-orange-100">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Cari judul tryout, mapel, atau kelas..."
                    className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.9fr_1fr]">
              <div className="grid gap-3">
                <p className={LABEL_CLASS}>Filter Jenjang</p>
                <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-100 bg-slate-50/50 p-2">
                  {JENJANG_OPTIONS.map((item) => (
                    <SegmentedButton
                      key={item}
                      active={selectedJenjang === item}
                      label={item}
                      onClick={() => setSelectedJenjang(item)}
                    />
                  ))}
                </div>
              </div>

              <div className="grid gap-3">
                <p className={LABEL_CLASS}>Kelas Otomatis</p>
                <div className="rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-800">
                    {selectedKelas}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Filter kelas akhir akan mengikuti jenjang yang sedang aktif.
                  </p>
                </div>
              </div>

              <div className="grid gap-3">
                <p className={LABEL_CLASS}>Status Publish</p>
                <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-100 bg-slate-50/50 p-2">
                  {STATUS_FILTERS.map((item) => (
                    <SegmentedButton
                      key={item}
                      active={selectedStatus === item}
                      label={item}
                      onClick={() => setSelectedStatus(item)}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-orange-100 pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge className="border-orange-200 bg-orange-50 text-orange-700">
                  {selectedJenjang}
                </StatusBadge>
                <StatusBadge className="border-slate-200 bg-white text-slate-600">
                  {selectedKelas}
                </StatusBadge>
                <StatusBadge className="border-slate-200 bg-slate-50 text-slate-600">
                  {selectedStatus}
                </StatusBadge>
              </div>

              <p className="text-sm font-semibold text-slate-600">
                {isLoading
                  ? "Memuat ujian..."
                  : `${filteredTryouts.length} ujian ditemukan`}
              </p>
            </div>
          </section>

          <section className="overflow-hidden rounded-[24px] border border-orange-100 bg-white shadow-[0_24px_52px_-40px_rgba(15,23,42,0.28)]">
            <div className="flex flex-col gap-4 border-b border-orange-100 bg-gradient-to-r from-orange-50/70 via-white to-amber-50/50 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">
                  Daftar Ujian
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Pantau UTS/UAS dan Tryout aktif, progress soal, dan jadwal
                  publish sesuai kelas yang diajar guru.
                </p>
              </div>

              <button
                type="button"
                onClick={openAddDialog}
                className="inline-flex items-center justify-center gap-2 border border-orange-500 bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
              >
                <Plus className="h-4 w-4" />
                Tambah Ujian
              </button>
            </div>

            <div className="px-5 py-5 md:px-6">
              {isLoading ? (
                <div className="grid gap-4">
                  {Array.from({ length: 3 }, (_, index) => (
                    <div
                      key={`tryout-loading-${index + 1}`}
                      className="animate-pulse rounded-[20px] border border-orange-100 bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="w-full max-w-[320px]">
                          <div className="h-3 w-2/3 bg-slate-200" />
                          <div className="mt-2 h-2.5 w-1/3 bg-orange-100" />
                        </div>
                        <div className="h-6 w-24 bg-slate-100" />
                      </div>
                      <div className="mt-4 grid gap-2 md:grid-cols-3">
                        <div className="h-10 bg-slate-100" />
                        <div className="h-10 bg-slate-100" />
                        <div className="h-10 bg-slate-100" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredTryouts.length > 0 ? (
                <>
                  <div className="hidden overflow-x-auto rounded-[20px] border border-orange-100 lg:block">
                    <table className="min-w-[1320px] w-full">
                      <thead className="bg-orange-50/80 text-left">
                        <tr className="text-xs uppercase tracking-[0.16em] text-slate-500">
                          <th className="px-4 py-3 font-semibold">
                            Judul Tryout
                          </th>
                          <th className="px-4 py-3 font-semibold">
                            Jenjang/Kelas
                          </th>
                          <th className="px-4 py-3 font-semibold">Mapel</th>
                          <th className="px-4 py-3 font-semibold">
                            Jumlah Soal
                          </th>
                          <th className="px-4 py-3 font-semibold">Durasi</th>
                          <th className="px-4 py-3 font-semibold">Jadwal</th>
                          <th className="px-4 py-3 font-semibold">Status</th>
                          <th className="px-4 py-3 text-center font-semibold">
                            Aksi
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTryouts.map((tryout) => (
                          <tr
                            key={tryout.id}
                            className="border-t border-orange-100/80 text-sm transition hover:bg-orange-50/40"
                          >
                            <td className="px-4 py-4 align-middle">
                              <div className="grid gap-1">
                                <div className="flex items-center gap-2">
                                  <span className="h-8 w-1 bg-orange-400" />
                                  <div>
                                    <p className="font-semibold text-slate-800">
                                      {tryout.judulTryout}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      ID {tryout.id}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {tryout.branch ?? "-"} ·{" "}
                                      {tryout.classId ?? "classId belum ada"}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 align-middle text-slate-600">
                              <div className="grid gap-1">
                                <p className="font-semibold text-slate-800">
                                  {tryout.jenjang}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {tryout.kelas}
                                </p>
                                <p className="text-xs text-orange-600">
                                  {getAssessmentTypeLabel(tryout.assessmentType)}
                                </p>
                                {tryout.stage ? (
                                  <p className="text-xs text-orange-600">
                                    Tryout {tryout.stage}
                                  </p>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-4 py-4 align-middle text-slate-600">
                              {tryout.mapel}
                            </td>
                            <td className="px-4 py-4 align-middle text-slate-600">
                              <div className="grid gap-1">
                                <p className="font-semibold text-slate-800">
                                  {getTryoutQuestionCountLabel(tryout)}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {getQuestionSourceDetail(tryout)}
                                </p>
                              </div>
                            </td>
                            <td className="px-4 py-4 align-middle text-slate-600">
                              {tryout.durasiMenit} menit
                            </td>
                            <td className="px-4 py-4 align-middle text-slate-600">
                              <div className="grid gap-1">
                                <p>{formatDateTime(tryout.tanggalMulai)}</p>
                                <p className="text-xs text-slate-500">
                                  sampai {formatDateTime(tryout.tanggalSelesai)}
                                </p>
                              </div>
                            </td>
                            <td className="px-4 py-4 align-middle">
                              <div className="grid gap-2">
                                <div className="flex flex-wrap gap-2">
                                  <StatusBadge
                                    className={getPublishBadgeClass(
                                      tryout.publishStatus,
                                    )}
                                  >
                                    {tryout.publishStatus}
                                  </StatusBadge>
                                  <StatusBadge
                                    className={getQuestionBadgeClass(
                                      tryout.jumlahSoal,
                                    )}
                                  >
                                    {getTryoutQuestionStatusLabel(tryout)}
                                  </StatusBadge>
                                  <StatusBadge
                                    className={getQuestionSourceBadgeClass(
                                      tryout.questionSource,
                                    )}
                                  >
                                    {getQuestionSourceLabel(tryout.questionSource)}
                                  </StatusBadge>
                                </div>
                                <p className="text-xs leading-5 text-slate-500">
                                  {getQuestionSourceDetail(tryout)}
                                </p>
                                {tryout.publishStatus !== "Draft" ? (
                                  <p className="text-xs font-medium text-amber-700">
                                    Soal terkunci setelah ujian dipublish.
                                  </p>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-4 py-4 align-middle text-center">
                              <div className="mx-auto flex w-fit items-center justify-center gap-2">
                                <ActionIconButton
                                  title="Edit Tryout"
                                  onClick={() => openEditDialog(tryout)}
                                  className="border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
                                >
                                  <Pencil className="h-4 w-4 shrink-0" />
                                </ActionIconButton>
                                <ActionIconButton
                                  title={
                                    tryout.publishStatus === "Draft"
                                      ? "Kelola Soal"
                                      : "Lihat Soal Terkunci"
                                  }
                                  onClick={() => openUploadDialog(tryout.id)}
                                  className="border-slate-200 bg-white text-slate-600 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                                >
                                  <UploadCloud className="h-4 w-4 shrink-0" />
                                </ActionIconButton>
                                <ActionIconButton
                                  title="Lihat Hasil"
                                  onClick={() => openResultDialog(tryout.id)}
                                  className="border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
                                >
                                  <BarChart3 className="h-4 w-4 shrink-0" />
                                </ActionIconButton>
                                <ActionIconButton
                                  title={
                                    tryout.publishStatus === "Published"
                                      ? "Unpublish Ujian"
                                      : isTryoutReadyToPublish(tryout)
                                        ? "Publish Ujian"
                                        : "Lengkapi data dan soal sebelum publish"
                                  }
                                  disabled={
                                    tryout.publishStatus === "Draft" &&
                                    !isTryoutReadyToPublish(tryout)
                                  }
                                  onClick={() => handleTogglePublish(tryout.id)}
                                  className={
                                    tryout.publishStatus === "Published"
                                      ? "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
                                      : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                  }
                                >
                                  {tryout.publishStatus === "Published" ? (
                                    <EyeOff className="h-4 w-4 shrink-0" />
                                  ) : (
                                    <Eye className="h-4 w-4 shrink-0" />
                                  )}
                                </ActionIconButton>
                                <ActionIconButton
                                  title={
                                    tryout.publishStatus === "Draft"
                                      ? "Hapus Ujian"
                                      : "Unpublish ujian sebelum menghapus"
                                  }
                                  disabled={tryout.publishStatus !== "Draft"}
                                  onClick={() => handleDeleteTryout(tryout.id)}
                                  className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                >
                                  <Trash2 className="h-4 w-4 shrink-0" />
                                </ActionIconButton>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="grid gap-4 lg:hidden">
                    {filteredTryouts.map((tryout) => (
                      <article
                        key={tryout.id}
                        className="overflow-hidden rounded-[24px] border border-orange-100 bg-white shadow-[0_20px_42px_-34px_rgba(249,115,22,0.28)] transition-all duration-300 hover:-translate-y-0.5 hover:border-orange-200"
                      >
                        <div className="h-1 w-full bg-gradient-to-r from-orange-400 via-orange-500 to-amber-400" />
                        <div className="grid gap-4 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-base font-semibold text-slate-800">
                                {tryout.judulTryout}
                              </p>
                              <p className="mt-1 text-sm text-slate-500">
                                {tryout.jenjang} - {tryout.kelas} - {tryout.mapel}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {tryout.branch ?? "Cabang belum ada"}
                                {" · "}
                                {getAssessmentTypeLabel(tryout.assessmentType)}
                                {tryout.stage ? ` ${tryout.stage}` : ""}
                              </p>
                            </div>
                            <StatusBadge
                              className={getPublishBadgeClass(
                                tryout.publishStatus,
                              )}
                            >
                              {tryout.publishStatus}
                            </StatusBadge>
                          </div>

                          <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                            <div className="grid gap-1">
                              <p className={LABEL_CLASS}>Jumlah Soal</p>
                              <p className="font-semibold text-slate-800">
                                {getTryoutQuestionCountLabel(tryout)}
                              </p>
                            </div>
                            <div className="grid gap-1">
                              <p className={LABEL_CLASS}>Durasi</p>
                              <p className="font-semibold text-slate-800">
                                {tryout.durasiMenit} menit
                              </p>
                            </div>
                            <div className="grid gap-1 sm:col-span-2">
                              <p className={LABEL_CLASS}>Jadwal</p>
                              <p className="font-semibold text-slate-800">
                                {formatScheduleRange(
                                  tryout.tanggalMulai,
                                  tryout.tanggalSelesai,
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <StatusBadge className="border-slate-200 bg-white text-slate-600">
                              {getAssessmentTypeLabel(tryout.assessmentType)}
                            </StatusBadge>
                            {tryout.stage ? (
                              <StatusBadge className="border-orange-200 bg-orange-50 text-orange-700">
                                Tryout {tryout.stage}
                              </StatusBadge>
                            ) : null}
                            <StatusBadge
                              className={getQuestionBadgeClass(tryout.jumlahSoal)}
                            >
                              {getTryoutQuestionStatusLabel(tryout)}
                            </StatusBadge>
                            <StatusBadge
                              className={getQuestionSourceBadgeClass(
                                tryout.questionSource,
                              )}
                            >
                              {getQuestionSourceLabel(tryout.questionSource)}
                            </StatusBadge>
                            <StatusBadge className="border-slate-200 bg-slate-50 text-slate-600">
                              {getTryoutQuestionCountLabel(tryout)}
                            </StatusBadge>
                          </div>

                          <p className="text-xs leading-5 text-slate-500">
                            {getQuestionSourceDetail(tryout)}
                          </p>
                          {tryout.publishStatus !== "Draft" ? (
                            <p className="text-xs font-medium text-amber-700">
                              Soal terkunci setelah ujian dipublish.
                            </p>
                          ) : null}

                          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-orange-100 pt-4">
                            <ActionIconButton
                              title="Edit Tryout"
                              onClick={() => openEditDialog(tryout)}
                              className="border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
                            >
                              <Pencil className="h-4 w-4 shrink-0" />
                            </ActionIconButton>
                            <ActionIconButton
                              title={
                                tryout.publishStatus === "Draft"
                                  ? "Kelola Soal"
                                  : "Lihat Soal Terkunci"
                              }
                              onClick={() => openUploadDialog(tryout.id)}
                              className="border-slate-200 bg-white text-slate-600 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                            >
                              <UploadCloud className="h-4 w-4 shrink-0" />
                            </ActionIconButton>
                            <ActionIconButton
                              title="Lihat Hasil"
                              onClick={() => openResultDialog(tryout.id)}
                              className="border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
                            >
                              <BarChart3 className="h-4 w-4 shrink-0" />
                            </ActionIconButton>
                            <ActionIconButton
                              title={
                                tryout.publishStatus === "Published"
                                  ? "Unpublish Ujian"
                                  : isTryoutReadyToPublish(tryout)
                                    ? "Publish Ujian"
                                    : "Lengkapi data dan soal sebelum publish"
                              }
                              disabled={
                                tryout.publishStatus === "Draft" &&
                                !isTryoutReadyToPublish(tryout)
                              }
                              onClick={() => handleTogglePublish(tryout.id)}
                              className={
                                tryout.publishStatus === "Published"
                                  ? "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              }
                            >
                              {tryout.publishStatus === "Published" ? (
                                <EyeOff className="h-4 w-4 shrink-0" />
                              ) : (
                                <Eye className="h-4 w-4 shrink-0" />
                              )}
                            </ActionIconButton>
                            <ActionIconButton
                              title={
                                tryout.publishStatus === "Draft"
                                  ? "Hapus Ujian"
                                  : "Unpublish ujian sebelum menghapus"
                              }
                              disabled={tryout.publishStatus !== "Draft"}
                              onClick={() => handleDeleteTryout(tryout.id)}
                              className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                            >
                              <Trash2 className="h-4 w-4 shrink-0" />
                            </ActionIconButton>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                <div className="rounded-[24px] border border-dashed border-orange-200 bg-orange-50/30 px-6 py-12 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[18px] border border-orange-100 bg-white text-orange-500">
                    <Search className="h-5 w-5" />
                  </div>
                  <p className="mt-4 text-base font-semibold text-slate-700">
                    {loadError
                      ? "Data ujian guru belum berhasil dimuat."
                      : tryouts.length === 0
                      ? "Tidak ada ujian di tahun ajaran ini."
                      : "Belum ada ujian yang cocok dengan filter saat ini."}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {loadError
                      ? loadError
                      : tryouts.length === 0
                      ? "Silakan buat ujian baru atau pilih tahun yang aktif."
                      : "Ubah jenjang, status, atau kata kunci pencarian untuk melihat daftar ujian lain yang sudah tersimpan."}
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      <TryoutFormDialog
        draft={draftTryout}
        classOptions={classOptions}
        mode={formMode}
        open={isFormOpen}
        onClose={closeFormDialog}
        onChange={handleTryoutDraftChange}
        onOpenFileUploader={handleOpenFileUploaderFromForm}
        onOpenManualManager={handleOpenManualManagerFromForm}
        onSubmit={handleSaveTryout}
        isSubmitting={isTryoutSubmitting}
        questionsLocked={formQuestionsLocked}
      />

      <UploadSoalDialog
        open={isUploadOpen}
        tryout={uploadTargetTryout}
        draft={questionDraft}
        editingQuestionId={editingQuestionId}
        isQuestionLoading={isQuestionLoading}
        questionLoadError={questionLoadError}
        questionSuccessMessage={questionSuccessMessage}
        isQuestionSubmitting={isQuestionSubmitting}
        isXlsxUploading={isXlsxUploading}
        onClose={closeUploadDialog}
        onChange={handleQuestionDraftChange}
        onUploadXlsx={handleUploadXlsxQuestionFile}
        onSubmitQuestion={handleSubmitQuestion}
        onCancelEditQuestion={handleCancelEditQuestion}
        onEditQuestion={handleEditQuestion}
        onDeleteQuestion={handleDeleteQuestion}
        onMoveQuestion={handleMoveQuestion}
      />

      <HasilTryoutDialog
        open={isResultOpen}
        tryout={resultTargetTryout}
        isLoading={isResultLoading}
        error={resultLoadError}
        onRetry={() => {
          if (selectedResultTryoutId) {
            void loadTryoutResults(selectedResultTryoutId);
          }
        }}
        onClose={closeResultDialog}
      />
    </>
  );
}
