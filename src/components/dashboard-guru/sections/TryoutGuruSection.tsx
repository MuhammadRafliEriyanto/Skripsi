/*  */"use client";
import toast from "react-hot-toast";

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
  MoreHorizontal,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { clearAuthClientState } from "@/lib/auth";
import {
  buildGuruApiUrl,
  getGuruAcademicYearStatus,
  getSelectedAcademicPeriod,
} from "@/lib/guru-helpers";
import { formatUtbkTryoutStageLabel } from "@/lib/utbk-tryout-stages";

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
  "Soal hanya dapat diubah saat ujian belum diterbitkan.";

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

function normalizeUtbkClassName(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);
  const normalizedUpper = normalizedValue.toUpperCase();

  if (!normalizedValue) {
    return "";
  }

  if (normalizedUpper === "UTBK" || normalizedUpper === "SNBT") {
    return "UTBK";
  }

  const trackValue = normalizedValue.replace(/^(UTBK|SNBT)\s*[-/]?\s*/i, "");
  const normalizedTrack = trackValue
    .replace(/\s*\/\s*/g, " / ")
    .trim()
    .toUpperCase();

  if (normalizedTrack === "12" || normalizedTrack === "KELAS 12") {
    return "UTBK Kelas 12";
  }

  if (
    normalizedTrack === "ALUMNI" ||
    normalizedTrack === "GAP YEAR" ||
    normalizedTrack === "ALUMNI/GAP YEAR" ||
    normalizedTrack === "ALUMNI / GAP YEAR"
  ) {
    return "UTBK Alumni / Gap Year";
  }

  return "";
}

function getAssessmentModeForClass(className: string): AssessmentMode {
  return normalizeUtbkClassName(className) || isFinalAssessmentClass(className)
    ? "tryout"
    : "semester";
}

function getAssessmentTypeLabel(type: AssessmentType) {
  if (type === "UTS") return "Simulasi UTS 1";
  if (type === "UAS") return "Simulasi UAS 1";
  return type;
}

function getTryoutStageLabel(stage: number | null | undefined) {
  return formatUtbkTryoutStageLabel(stage, stage ? `Tryout ${stage}` : "Tryout");
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
  const utbkClassName = normalizeUtbkClassName(className);

  if (className && branch && utbkClassName) {
    return {
      id: normalizeText(item.id) || `${branch}-${utbkClassName}`,
      className,
      branch,
      subject: normalizeText(item.subject) || fallbackSubject,
      jenjang: "SMA",
      kelas: utbkClassName,
      canonicalClassName: utbkClassName,
      assessmentMode: "tryout",
      studentCount: toSafeNumber(item.studentCount, 0),
      scheduleCount: toSafeNumber(item.scheduleCount, 0),
    };
  }

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

    reader.onerror = () => reject(new Error("File Excel belum bisa dibaca."));
    reader.onload = () => {
      const result = reader.result;

      if (typeof result !== "string") {
        reject(new Error("File Excel belum bisa diproses."));
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
    classId: normalizeText(draft.classId),
    branch: normalizeText(draft.branch),
    canonicalClassName: normalizeText(draft.canonicalClassName),
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

function getPublishStatusLabel(status: StatusFilter) {
  if (status === "Published") {
    return "Diterbitkan";
  }

  if (status === "Draft") {
    return "Belum Diterbitkan";
  }

  return status;
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
    return "File Excel";
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

  return item.jumlahSoal > 0 ? `${item.jumlahSoal} soal Excel` : "Menunggu File";
}

function getTryoutQuestionStatusLabel(item: Pick<TryoutItem, "questionSource" | "jumlahSoal">) {
  if (item.questionSource === "file") {
    return item.jumlahSoal > 0 ? "File Siap" : "Menunggu File";
  }

  if (item.questionSource === "bank") {
    return item.jumlahSoal > 0 ? "Bank Soal Siap" : "Bank Soal Kosong";
  }

  return item.jumlahSoal > 0 ? "Soal Siap" : "Menunggu Soal";
}

function getQuestionSourceDetail(item: TryoutItem) {
  if (item.questionSource === "bank") {
    return "Bank soal sudah terhubung.";
  }

  if (item.questionSource === "file") {
    return item.fileName
      ? `Soal dari file Excel: ${item.fileName}`
      : "Belum ada file Excel yang diunggah.";
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

function PrimaryActionButton({
  label,
  title,
  icon: Icon,
  className,
  onClick,
  disabled = false,
}: {
  label: string;
  title: string;
  icon: LucideIcon;
  className: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </button>
  );
}

function TryoutActionControls({
  tryout,
  isAcademicArchive,
  archiveMessage,
  onEdit,
  onManageQuestions,
  onViewResults,
  onTogglePublish,
  onDelete,
}: {
  tryout: TryoutItem;
  isAcademicArchive: boolean;
  archiveMessage: string;
  onEdit: () => void;
  onManageQuestions: () => void;
  onViewResults: () => void;
  onTogglePublish: () => void;
  onDelete: () => void;
}) {
  const isReadyToPublish = isTryoutReadyToPublish(tryout);
  const isPublished = tryout.publishStatus === "Published";
  const hasQuestions = tryout.jumlahSoal > 0;
  const primaryAction = isPublished
    ? {
        label: "Hasil",
        title: "Lihat Hasil",
        icon: BarChart3,
        className: "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100",
        onClick: onViewResults,
        disabled: false,
      }
    : isReadyToPublish
      ? {
          label: "Terbitkan",
          title: "Terbitkan Ujian",
          icon: Eye,
          className:
            "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
          onClick: onTogglePublish,
          disabled: isAcademicArchive,
        }
      : hasQuestions
        ? {
            label: "Lengkapi",
            title: "Lengkapi Data Ujian",
            icon: Pencil,
            className:
              "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100",
            onClick: onEdit,
            disabled: isAcademicArchive,
          }
        : {
            label: "Soal",
            title: "Unggah atau Kelola Soal",
            icon: UploadCloud,
            className:
              "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100",
            onClick: onManageQuestions,
            disabled: isAcademicArchive,
          };

  return (
    <div className="flex items-center justify-end gap-2">
      <PrimaryActionButton
        label={primaryAction.label}
        title={isAcademicArchive ? archiveMessage : primaryAction.title}
        icon={primaryAction.icon}
        className={primaryAction.className}
        onClick={primaryAction.onClick}
        disabled={primaryAction.disabled}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title="Aksi Lainnya"
            aria-label="Aksi Lainnya"
            className={`${ACTION_BUTTON_CLASS} rounded-xl border-slate-200 bg-white text-slate-600 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700`}
          >
            <MoreHorizontal className="h-4 w-4 shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[13rem]">
          <DropdownMenuItem disabled={isAcademicArchive} onSelect={onEdit}>
            <Pencil className="h-4 w-4" />
            Edit Ujian
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onManageQuestions}>
            <UploadCloud className="h-4 w-4" />
            {isPublished ? "Lihat Soal" : "Kelola Soal"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onViewResults}>
            <BarChart3 className="h-4 w-4" />
            Lihat Hasil
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={
              isAcademicArchive ||
              (!isPublished && !isReadyToPublish)
            }
            onSelect={onTogglePublish}
          >
            {isPublished ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
            {isPublished ? "Tarik Publikasi" : "Terbitkan"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={isAcademicArchive || isPublished}
            onSelect={onDelete}
            className="text-rose-700 focus:text-rose-700 data-[highlighted]:text-rose-700"
          >
            <Trash2 className="h-4 w-4" />
            Hapus Ujian
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
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
  const selectedClassOption =
    classOptions.find((option) => option.id === draft?.classId) ??
    classOptions.find(
      (option) =>
        option.branch === draft?.branch &&
        option.canonicalClassName === draft?.canonicalClassName,
    ) ??
    null;
  const allowedAssessmentTypes: AssessmentType[] =
    selectedClassOption?.assessmentMode === "tryout"
      ? ["Tryout"]
      : ["UTS", "UAS"];
  const currentAssessmentType =
    draft?.assessmentType ??
    (selectedClassOption?.assessmentMode === "tryout" ? "Tryout" : "UTS");

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => !isOpen && !isSubmitting && onClose()}
    >
      <DialogContent className="max-h-[85vh] max-w-3xl gap-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] rounded-[24px] border border-orange-100 bg-white p-0 [&>button]:rounded-full [&>button]:border [&>button]:border-orange-100 [&>button]:bg-white [&>button]:text-slate-400 [&>button]:hover:bg-orange-50 [&>button]:hover:text-orange-700">
        <DialogHeader className="border-b border-orange-100 bg-gradient-to-r from-orange-50/90 via-white to-amber-50/70 px-4 py-4 md:px-5">
          <DialogTitle>
            {mode === "add" ? "Tambah Ujian Baru" : "Edit Ujian"}
          </DialogTitle>
          <DialogDescription>
            Isi detail ujian di bawah ini.
          </DialogDescription>
        </DialogHeader>

        {questionsLocked ? (
          <div className="mx-4 mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 md:mx-5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Soal terkunci karena ujian sudah diterbitkan. Ubah status menjadi
              belum diterbitkan terlebih dahulu untuk mengelola soal.
            </span>
          </div>
        ) : null}

        <div className="grid gap-4 px-4 py-4 md:grid-cols-2 md:px-5">
          <label className="grid gap-2 md:col-span-2">
            <span className={LABEL_CLASS}>Judul Ujian</span>
            <input
              type="text"
              value={draft?.judulTryout ?? ""}
              onChange={(event) => onChange("judulTryout", event.target.value)}
              placeholder="Contoh: UTS Bahasa Indonesia Kelas 8"
              className={FIELD_CLASS}
            />
          </label>

          <label className="grid gap-2 md:col-span-2">
            <span className={LABEL_CLASS}>Kelas yang Diajar</span>
            <select
              value={draft?.classId ?? ""}
              onChange={(event) => onChange("classId", event.target.value)}
              className={FIELD_CLASS}
            >
              <option value="" disabled>
                Pilih kelas dari jadwal guru
              </option>
              {classOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.branch} - {option.className} - {option.subject}
                </option>
              ))}
            </select>
          </label>


          <label className="grid gap-2">
            <span className={LABEL_CLASS}>Jenis Ujian</span>
            <select
              value={currentAssessmentType}
              onChange={(event) =>
                onChange("assessmentType", event.target.value)
              }
              disabled={allowedAssessmentTypes.length === 1}
              className={`${FIELD_CLASS} ${
                allowedAssessmentTypes.length === 1
                  ? "bg-orange-50/40 text-slate-600"
                  : ""
              }`}
            >
              {allowedAssessmentTypes.map((item) => (
                <option key={item} value={item}>
                  {getAssessmentTypeLabel(item)}
                </option>
              ))}
            </select>
          </label>

          {currentAssessmentType === "Tryout" ? (
            <label className="grid gap-2">
              <span className={LABEL_CLASS}>Tahap Tryout UTBK/SNBT</span>
              <select
                value={String(draft?.stage ?? 1)}
                onChange={(event) => onChange("stage", Number(event.target.value))}
                className={FIELD_CLASS}
              >
                <option value="1">{getTryoutStageLabel(1)}</option>
                <option value="2">{getTryoutStageLabel(2)}</option>
                <option value="3">{getTryoutStageLabel(3)}</option>
              </select>
            </label>
          ) : null}

          {mode === "edit" ? (
            <label className="grid gap-2">
              <span className={LABEL_CLASS}>Status Ujian</span>
              <select
                value={draft?.publishStatus ?? "Draft"}
                onChange={(event) =>
                  onChange("publishStatus", event.target.value)
                }
                className={FIELD_CLASS}
              >
                <option value="Draft">Belum Diterbitkan</option>
                <option value="Published">Diterbitkan</option>
              </select>
            </label>
          ) : (
            <div className="grid gap-2">
              <span className={LABEL_CLASS}>Status Ujian</span>
              <div className="flex min-h-11 items-center rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-600">
                Disimpan sebagai Draft
              </div>
            </div>
          )}

          <label className="grid gap-2">
            <span className={LABEL_CLASS}>Durasi Menit</span>
            <input
              type="number"
              min={15}
              value={draft?.durasiMenit ?? 90}
              onChange={(event) => onChange("durasiMenit", event.target.value)}
              className={FIELD_CLASS}
            />
          </label>

          <label className="grid gap-2">
            <span className={LABEL_CLASS}>Tanggal Mulai</span>
            <input
              type="datetime-local"
              value={draft?.tanggalMulai ?? ""}
              onChange={(event) => onChange("tanggalMulai", event.target.value)}
              className={FIELD_CLASS}
            />
          </label>

          <label className="grid gap-2">
            <span className={LABEL_CLASS}>Tanggal Selesai</span>
            <input
              type="datetime-local"
              value={draft?.tanggalSelesai ?? ""}
              onChange={(event) =>
                onChange("tanggalSelesai", event.target.value)
              }
              className={FIELD_CLASS}
            />
          </label>

          <div className="grid gap-4 md:col-span-2">
            {isManualSource ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-orange-100 bg-orange-50/40 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className={LABEL_CLASS}>Kelola Soal</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Ujian ini dibuat dengan metode input soal manual.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isSubmitting || questionsLocked}
                  onClick={onOpenManualManager}
                  className="shrink-0 border border-orange-500 bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:border-orange-200 disabled:bg-orange-200"
                >
                  Kelola Soal Manual
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 rounded-2xl border border-orange-100 bg-orange-50/40 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className={LABEL_CLASS}>File Soal Excel</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {draft?.id
                      ? "Silakan unggah file Excel untuk menambahkan soal."
                      : "Simpan ujian ini terlebih dahulu untuk mengaktifkan fitur unggah file Excel."}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isSubmitting || questionsLocked}
                  onClick={onOpenFileUploader}
                  className="shrink-0 border border-orange-500 bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:border-orange-200 disabled:bg-orange-200"
                >
                  {draft?.id ? "Unggah File Excel" : "Simpan Dulu"}
                </button>
              </div>
            )}
          </div>
              <div className="flex flex-wrap items-center gap-2 md:col-span-2">
                <StatusBadge className={getQuestionSourceBadgeClass(draft?.questionSource ?? "file")}>
                  {getQuestionSourceLabel(draft?.questionSource ?? "file")}
                </StatusBadge>
                <StatusBadge className={getQuestionBadgeClass(draft?.jumlahSoal ?? 0)}>
                  {draft
                    ? getTryoutQuestionCountLabel(draft)
                    : "0 soal"}
                </StatusBadge>
              </div>
        </div>

        <DialogFooter className="border-t border-orange-100 px-4 py-3 md:px-5">
          <DialogClose asChild>
            <button
              type="button"
              disabled={isSubmitting}
              className="border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Batal
            </button>
          </DialogClose>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onSubmit}
            aria-busy={isSubmitting}
            className="inline-flex items-center justify-center gap-2 border border-orange-500 bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-wait disabled:border-orange-300 disabled:bg-orange-300"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isFileSource ? "Menyiapkan Unggahan..." : "Menyimpan..."}
              </>
            ) : isFileSource && !questionsLocked
              ? mode === "add"
                ? "Simpan & Lanjut Unggah"
                : "Perbarui & Buka Unggahan"
              : mode === "add"
                ? "Simpan Ujian"
                : "Perbarui Ujian"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UploadSoalDialog({
  open,
  tryout,
  draft,
  editingQuestionId,
  isQuestionLoading,
  questionLoadError,
  questionSuccessMessage,
  isQuestionSubmitting,
  isXlsxUploading,
  readOnly = false,
  readOnlyMessage,
  onClose,
  onChange,
  onUploadXlsx,
  onSubmitQuestion,
  onCancelEditQuestion,
  onEditQuestion,
  onDeleteQuestion,
  onMoveQuestion,
}: {
  open: boolean;
  tryout: TryoutItem | null;
  draft: QuestionDraft;
  editingQuestionId: string | null;
  isQuestionLoading: boolean;
  questionLoadError: string | null;
  questionSuccessMessage: string | null;
  isQuestionSubmitting: boolean;
  isXlsxUploading: boolean;
  readOnly?: boolean;
  readOnlyMessage?: string;
  onClose: () => void;
  onChange: (field: keyof QuestionDraft, value: string) => void;
  onUploadXlsx: (file: File) => void;
  onSubmitQuestion: () => void;
  onCancelEditQuestion: () => void;
  onEditQuestion: (question: TryoutQuestion) => void;
  onDeleteQuestion: (questionId: string) => void;
  onMoveQuestion: (questionId: string, direction: "up" | "down") => void;
}) {
  const source = tryout?.questionSource ?? "manual";
  const isManualSource = source === "manual";
  const isBankSource = source === "bank";
  const isFileSource = source === "file";
  const isReadonlyQuestionSource = isBankSource || isFileSource;
  const isEditingQuestion = Boolean(editingQuestionId);
  const isBusy = isQuestionSubmitting || isXlsxUploading;
  const questionsLocked = readOnly || tryout?.publishStatus !== "Draft";

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => !isOpen && !isBusy && onClose()}
    >
      <DialogContent className="max-h-[85vh] max-w-4xl gap-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] rounded-[24px] border border-orange-100 bg-white p-0 [&>button]:rounded-full [&>button]:border [&>button]:border-orange-100 [&>button]:bg-white [&>button]:text-slate-400 [&>button]:hover:bg-orange-50 [&>button]:hover:text-orange-700">
        <DialogHeader className="border-b border-orange-100 bg-gradient-to-r from-orange-50/90 via-white to-amber-50/70 px-4 py-4 md:px-5">
          <DialogTitle>Unggah Soal Ujian</DialogTitle>
          <DialogDescription>
            Kelola sumber soal untuk {tryout?.judulTryout ?? "-"} sesuai mode
            yang dipilih saat ujian dibuat.
          </DialogDescription>
        </DialogHeader>

        {questionsLocked ? (
          <div className="mx-4 mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 md:mx-5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {readOnly
                ? readOnlyMessage ?? "Tahun ajaran ini sudah menjadi arsip. Soal hanya bisa dilihat."
                : "Soal terkunci karena ujian sudah diterbitkan. Tarik publikasi ujian terlebih dahulu sebelum mengubah soal."}
            </span>
          </div>
        ) : null}

        {questionSuccessMessage ? (
          <div className="mx-4 mt-4 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 md:mx-5">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{questionSuccessMessage}</span>
          </div>
        ) : null}

        <div className="grid gap-4 px-4 py-4 md:px-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="grid gap-4">
            {isManualSource ? (
              <div className="grid gap-4 rounded-2xl border border-orange-100 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-orange-100 pb-3">
                  <div>
                    <p className={LABEL_CLASS}>Input Manual Soal</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {isEditingQuestion
                        ? "Perbarui pertanyaan, opsi jawaban, dan kunci jawaban soal yang sedang dipilih."
                        : "Tambahkan pertanyaan, empat opsi jawaban, dan kunci jawaban untuk setiap soal ujian."}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled
                    className="border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-400 opacity-80"
                  >
                    Mode Manual
                  </button>
                </div>

                <label className="grid gap-2">
                  <span className={LABEL_CLASS}>Pertanyaan</span>
                  <textarea
                    value={draft.pertanyaan ?? ""}
                    disabled={questionsLocked || isQuestionSubmitting}
                    onChange={(event) => onChange("pertanyaan", event.target.value)}
                    rows={3}
                    placeholder="Masukkan pertanyaan ujian..."
                    className={FIELD_CLASS}
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2">
                    <span className={LABEL_CLASS}>Opsi A</span>
                    <input
                      type="text"
                      value={draft.opsiA ?? ""}
                      disabled={questionsLocked || isQuestionSubmitting}
                      onChange={(event) => onChange("opsiA", event.target.value)}
                      className={FIELD_CLASS}
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className={LABEL_CLASS}>Opsi B</span>
                    <input
                      type="text"
                      value={draft.opsiB ?? ""}
                      disabled={questionsLocked || isQuestionSubmitting}
                      onChange={(event) => onChange("opsiB", event.target.value)}
                      className={FIELD_CLASS}
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className={LABEL_CLASS}>Opsi C</span>
                    <input
                      type="text"
                      value={draft.opsiC ?? ""}
                      disabled={questionsLocked || isQuestionSubmitting}
                      onChange={(event) => onChange("opsiC", event.target.value)}
                      className={FIELD_CLASS}
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className={LABEL_CLASS}>Opsi D</span>
                    <input
                      type="text"
                      value={draft.opsiD ?? ""}
                      disabled={questionsLocked || isQuestionSubmitting}
                      onChange={(event) => onChange("opsiD", event.target.value)}
                      className={FIELD_CLASS}
                    />
                  </label>
                </div>

                <label className="grid gap-2 md:max-w-[220px]">
                  <span className={LABEL_CLASS}>Jawaban Benar</span>
                  <select
                    value={draft.jawabanBenar ?? "A"}
                    disabled={questionsLocked || isQuestionSubmitting}
                    onChange={(event) =>
                      onChange("jawabanBenar", event.target.value)
                    }
                    className={FIELD_CLASS}
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                  </select>
                </label>

                <div className="flex flex-wrap justify-end gap-2">
                  {isEditingQuestion ? (
                    <button
                      type="button"
                      disabled={questionsLocked || isQuestionSubmitting}
                      onClick={onCancelEditQuestion}
                      className="border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Batal Edit
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={
                      questionsLocked ||
                      isQuestionLoading ||
                      isQuestionSubmitting
                    }
                    onClick={onSubmitQuestion}
                    className="border border-orange-500 bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:border-orange-200 disabled:bg-orange-200"
                  >
                    {isQuestionSubmitting
                      ? "Menyimpan..."
                      : isEditingQuestion
                        ? "Simpan Perubahan"
                        : "Tambah Soal"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 rounded-2xl border border-orange-100 bg-white p-3">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-orange-100 pb-3">
                  <div>
                    <p className={LABEL_CLASS}>
                      {isBankSource ? "Sumber Bank Soal" : "Sumber File Soal"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {isBankSource
                        ? "Ujian ini memakai bank soal yang sudah terhubung. Butir soal dapat ditinjau sebelum diterbitkan."
                        : "Ujian ini memakai file Excel. Sistem akan membaca isi file agar soal bisa ditinjau."}
                    </p>
                  </div>
                  <StatusBadge
                    className={getQuestionSourceBadgeClass(source)}
                  >
                    {getQuestionSourceLabel(source)}
                  </StatusBadge>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-orange-100 bg-orange-50/30 p-3">
                    <p className={LABEL_CLASS}>
                      {isBankSource ? "Status Bank Soal" : "Status File Soal"}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-800">
                      {isBankSource
                        ? "Bank soal terhubung"
                        : tryout?.fileName ?? "File soal belum diunggah"}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {isBankSource
                        ? `${tryout?.jumlahSoal ?? 0} soal bank siap ditinjau guru.`
                        : `${tryout?.jumlahSoal ?? 0} soal dari file Excel siap ditinjau guru.`}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-orange-100 bg-white p-3">
                    <p className={LABEL_CLASS}>Kesiapan Terbit</p>
                    <p className="mt-2 text-sm font-semibold text-slate-800">
                      {isTryoutQuestionSourceReady(source)
                        ? (tryout?.jumlahSoal ?? 0) > 0
                          ? "Siap diterbitkan"
                          : "Belum siap diterbitkan"
                        : "Sumber soal belum siap"}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {isTryoutQuestionSourceReady(source)
                        ? "Ujian hanya dapat diterbitkan ketika jumlah soal lebih dari nol."
                        : "Tombol terbit akan aktif setelah sumber soal siap digunakan."}
                    </p>
                  </div>
                </div>

                {isFileSource ? (
                  <div className="rounded-2xl border border-orange-100 bg-orange-50/30 p-3">
                    <p className={LABEL_CLASS}>Unggah Template Excel</p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      Kolom wajib: No, Pertanyaan, Opsi A, Opsi B, Opsi C,
                      Opsi D, Jawaban Benar. Kolom opsional: Pembahasan, Topik,
                      Kesulitan.
                    </p>
                    <label className="mt-3 inline-flex cursor-pointer items-center justify-center border border-orange-500 bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 has-[:disabled]:cursor-not-allowed has-[:disabled]:border-orange-200 has-[:disabled]:bg-orange-200">
                      {isXlsxUploading ? "Mengunggah..." : "Pilih File Excel"}
                      <input
                        key={`${tryout?.id ?? "tryout"}-${isXlsxUploading ? "uploading" : "idle"}-${tryout?.fileName ?? "empty"}`}
                        type="file"
                        accept=".xlsx,.xls"
                        disabled={
                          questionsLocked ||
                          isXlsxUploading ||
                          isQuestionLoading
                        }
                        className="sr-only"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;

                          if (file) {
                            onUploadXlsx(file);
                          }
                        }}
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="grid gap-4">
            <div className="rounded-[24px] border border-orange-100 bg-gradient-to-br from-orange-50/80 via-white to-amber-50/50 p-3">
              <p className={LABEL_CLASS}>Ringkasan Sumber Soal</p>
              <h3 className="mt-2 text-lg font-semibold text-slate-800">
                {tryout?.judulTryout ?? "-"}
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                {tryout?.jenjang ?? "-"} - {tryout?.kelas ?? "-"} -{" "}
                {tryout?.mapel ?? "-"}
              </p>
              <div className="mt-4 grid gap-3">
                <StatusBadge
                  className={getQuestionSourceBadgeClass(source)}
                >
                  {getQuestionSourceLabel(source)}
                </StatusBadge>
                <StatusBadge className={getQuestionBadgeClass(tryout?.jumlahSoal ?? 0)}>
                  {tryout
                    ? getTryoutQuestionCountLabel(tryout)
                    : "0 soal"}
                </StatusBadge>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                {getQuestionSourceDetail(tryout ?? {
                  id: "",
                  assessmentType: "Tryout",
                  judulTryout: "",
                  jenjang: "SMA",
                  kelas: "Kelas 12",
                  mapel: "",
                  jumlahSoal: 0,
                  durasiMenit: 0,
                  tanggalMulai: "",
                  tanggalSelesai: "",
                  publishStatus: "Draft",
                  questionSource: source,
                  soal: [],
                  hasil: [],
                })}
              </p>
            </div>

            <div className="overflow-hidden rounded-[24px] border border-orange-100 bg-white">
              <div className="border-b border-orange-100 px-4 py-3">
                <p className="text-sm font-semibold text-slate-800">
                  {isManualSource ? "Daftar Soal Tersimpan" : "Detail Sumber Soal"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {isManualSource
                    ? "Soal yang sudah diinput manual akan muncul di sini."
                    : "Ringkasan sumber soal aktif ditampilkan di panel ini."}
                </p>
              </div>

              <div className="max-h-[320px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] px-4 py-4">
                {(isManualSource || isReadonlyQuestionSource) && isQuestionLoading ? (
                  <div className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/30 px-4 py-8 text-center">
                    <p className="text-sm font-semibold text-slate-700">
                      Memuat soal ujian...
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Daftar soal tersimpan sedang disinkronkan untuk tryout ini.
                    </p>
                  </div>
                ) : (isManualSource || isReadonlyQuestionSource) && questionLoadError ? (
                  <div className="border border-rose-200 bg-rose-50/70 px-4 py-4 text-sm text-rose-700">
                    {questionLoadError}
                  </div>
                ) : isManualSource && tryout && tryout.soal.length > 0 ? (
                  <div className="grid gap-3">
                    {tryout.soal.map((question, index) => (
                      <div
                        key={question.id}
                        className="rounded-2xl border border-orange-100 bg-orange-50/30 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-800">
                            {(question.order || index + 1).toString()}.{" "}
                            {question.pertanyaan}
                          </p>
                          <div className="flex shrink-0 items-center gap-2">
                            <ActionIconButton
                              title="Naikkan Urutan"
                              disabled={
                                questionsLocked ||
                                isQuestionLoading ||
                                isQuestionSubmitting ||
                                index === 0
                              }
                              onClick={() => onMoveQuestion(question.id, "up")}
                              className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                            >
                              <ChevronUp className="h-4 w-4 shrink-0" />
                            </ActionIconButton>
                            <ActionIconButton
                              title="Turunkan Urutan"
                              disabled={
                                questionsLocked ||
                                isQuestionLoading ||
                                isQuestionSubmitting ||
                                index === tryout.soal.length - 1
                              }
                              onClick={() => onMoveQuestion(question.id, "down")}
                              className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                            >
                              <ChevronDown className="h-4 w-4 shrink-0" />
                            </ActionIconButton>
                            <ActionIconButton
                              title="Edit Soal"
                              disabled={
                                questionsLocked ||
                                isQuestionLoading ||
                                isQuestionSubmitting
                              }
                              onClick={() => onEditQuestion(question)}
                              className="border-orange-200 bg-white text-orange-700 hover:bg-orange-100"
                            >
                              <Pencil className="h-4 w-4 shrink-0" />
                            </ActionIconButton>
                            <ActionIconButton
                              title="Hapus Soal"
                              disabled={
                                questionsLocked ||
                                isQuestionLoading ||
                                isQuestionSubmitting
                              }
                              onClick={() => onDeleteQuestion(question.id)}
                              className="border-rose-200 bg-white text-rose-700 hover:bg-rose-100"
                            >
                              <Trash2 className="h-4 w-4 shrink-0" />
                            </ActionIconButton>
                            <StatusBadge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                              Jawaban {question.jawabanBenar}
                            </StatusBadge>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-2 text-xs text-slate-600">
                          <p>A. {question.opsiA}</p>
                          <p>B. {question.opsiB}</p>
                          <p>C. {question.opsiC}</p>
                          <p>D. {question.opsiD}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : isReadonlyQuestionSource && tryout && tryout.soal.length > 0 ? (
                  <div className="grid gap-3">
                    {tryout.soal.map((question, index) => (
                      <div
                        key={question.id}
                        className="rounded-2xl border border-orange-100 bg-orange-50/30 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-800">
                            {(question.order || index + 1).toString()}.{" "}
                            {question.pertanyaan}
                          </p>
                          <StatusBadge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                            Jawaban {question.jawabanBenar}
                          </StatusBadge>
                        </div>
                        <div className="mt-3 grid gap-2 text-xs text-slate-600">
                          <p>A. {question.opsiA}</p>
                          <p>B. {question.opsiB}</p>
                          <p>C. {question.opsiC}</p>
                          <p>D. {question.opsiD}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : isReadonlyQuestionSource ? (
                  <div className="grid gap-3">
                    <div className="rounded-2xl border border-orange-100 bg-orange-50/30 p-3">
                      <p className="text-sm font-semibold text-slate-800">
                        Soal belum berhasil dimuat
                      </p>
                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        Klik ulang tombol unggah soal, pilih file Excel, atau
                        muat ulang halaman untuk menampilkan butir soal.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/30 px-4 py-8 text-center">
                    <p className="text-sm font-semibold text-slate-700">
                      Tryout ini belum memiliki soal.
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Tambahkan soal manual terlebih dahulu agar tryout siap
                      dipublikasikan dan dikerjakan siswa.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-orange-100 px-4 py-3 md:px-5">
          <DialogClose asChild>
            <button
              type="button"
              disabled={isBusy}
              className="border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Tutup
            </button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HasilTryoutDialog({
  open,
  tryout,
  isLoading,
  error,
  onRetry,
  onClose,
}: {
  open: boolean;
  tryout: TryoutItem | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-3xl gap-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] rounded-[24px] border border-orange-100 bg-white p-0 [&>button]:rounded-full [&>button]:border [&>button]:border-orange-100 [&>button]:bg-white [&>button]:text-slate-400 [&>button]:hover:bg-orange-50 [&>button]:hover:text-orange-700">
        <DialogHeader className="border-b border-orange-100 bg-gradient-to-r from-orange-50/90 via-white to-amber-50/70 px-4 py-4 md:px-5">
          <DialogTitle>Hasil Ujian Siswa</DialogTitle>
          <DialogDescription>
            Hasil ujian akan tersedia setelah siswa mengerjakan dan mengirim jawaban.
          </DialogDescription>
        </DialogHeader>

        <div className="px-4 py-4 md:px-5">
          {isLoading ? (
            <div className="rounded-[24px] border border-dashed border-orange-200 bg-orange-50/30 px-5 py-10 text-center">
              <p className="text-sm font-semibold text-slate-700">
                Memuat hasil ujian...
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Sistem sedang membaca jawaban siswa yang sudah dikirim.
              </p>
            </div>
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
  const academicYearStatus = getGuruAcademicYearStatus(searchParams);
  const isAcademicArchive = academicYearStatus.isArchive;
  const archiveMessage = `Tahun ajaran ${academicYearStatus.academicYear} sudah menjadi arsip. Data ujian hanya bisa dilihat.`;
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
          payload?.message || "Data ujian guru belum bisa dimuat.",
        );
      }

      const apiTryouts = payload.data?.tryouts ?? [];
      const loadedTryouts = apiTryouts.map((item) =>
        mapTeacherTryoutApiItem(item),
      );

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
          : "Data ujian guru belum bisa dimuat.",
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

  useEffect(() => {
    if (!isAcademicArchive) {
      return;
    }

    queueMicrotask(() => {
      setIsFormOpen(false);
      setDraftTryout(null);
      setIsTryoutSubmitting(false);
      setEditingQuestionId(null);
      setQuestionDraft(createEmptyQuestionDraft());
      setIsQuestionSubmitting(false);
      setIsXlsxUploading(false);
      saveTryoutInFlightRef.current = false;
      questionSubmitInFlightRef.current = false;
      xlsxUploadInFlightRef.current = false;
    });
  }, [isAcademicArchive]);

  const loadManualQuestions = useCallback(async (tryoutId: string) => {
    try {
      setIsQuestionLoading(true);
      setQuestionLoadError(null);

      const { response, payload } =
        await fetchTeacherTryoutJson<TeacherTryoutQuestionListResponse>(
          buildGuruApiUrl(
            `/api/teacher/me/tryouts/${encodeURIComponent(tryoutId)}/questions`,
            searchParams,
          ),
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
  }, [searchParams]);

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

  function ensureAcademicYearEditable() {
    if (!isAcademicArchive) {
      return true;
    }

    toast.error(archiveMessage);
    return false;
  }

  function openAddDialog() {
    if (!ensureAcademicYearEditable()) {
      return;
    }

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
    if (!ensureAcademicYearEditable()) {
      return;
    }

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
    if (!ensureAcademicYearEditable()) {
      return;
    }

    if (!draftTryout?.id) {
      toast.error(
    "Simpan ujian terlebih dahulu sebelum menambahkan soal manual.",
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
    if (!ensureAcademicYearEditable()) {
      return;
    }

    if (!draftTryout?.id) {
      toast.error(
        "Lengkapi detail ujian, lalu klik Simpan & Lanjut Unggah untuk memilih file soal.",
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
    if (!ensureAcademicYearEditable()) {
      return;
    }

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
        "Sumber soal ini belum siap diterbitkan.",
      );
      return;
    }

    if (
      draftForSave.publishStatus === "Published" &&
      draftForSave.jumlahSoal === 0
    ) {
      toast.error(
        draftForSave.questionSource === "manual"
          ? "Ujian manual belum dapat diterbitkan karena belum memiliki soal."
          : "Ujian belum dapat diterbitkan karena sumber soal belum siap.",
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
        await fetchTeacherTryoutJson<TeacherTryoutDetailResponse>(
          buildGuruApiUrl(endpoint, searchParams),
          {
            method,
            body: JSON.stringify(buildTryoutMutationPayload(draftForSave)),
          },
        );

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
    if (!ensureAcademicYearEditable()) {
      return;
    }

    const targetTryout = tryouts.find((item) => item.id === tryoutId);

    if (!targetTryout || targetTryout.publishStatus !== "Draft") {
      toast.error("Ujian hanya dapat dihapus saat belum diterbitkan.");
      return;
    }

    if (!window.confirm("Hapus tryout ini dari daftar guru?")) {
      return;
    }

    try {
      const { response, payload } =
        await fetchTeacherTryoutJson<TeacherTryoutDetailResponse>(
          buildGuruApiUrl(
            `/api/teacher/me/tryouts/${encodeURIComponent(targetTryout.id)}`,
            searchParams,
          ),
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

  async function updateTryoutPublishStatus(
    targetTryout: TryoutItem,
    nextPublishStatus: PublishStatus,
  ) {
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
        publishStatus: nextPublishStatus,
        questionSource: targetTryout.questionSource,
        questionBankId: targetTryout.questionBankId,
        fileName: targetTryout.fileName,
      },
      tryouts,
    );

    try {
      const { response, payload } =
        await fetchTeacherTryoutJson<TeacherTryoutDetailResponse>(
          buildGuruApiUrl(
            `/api/teacher/me/tryouts/${encodeURIComponent(targetTryout.id)}`,
            searchParams,
          ),
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
      toast.success(
        nextPublishStatus === "Published"
          ? "Ujian berhasil diterbitkan."
          : "Publikasi ujian berhasil ditarik.",
      );
    } catch (error) {
      console.error("[tryout-guru-section] toggle_publish_failed", error);
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Status tryout belum bisa diperbarui.",
      );
    }
  }

  async function handleTogglePublish(tryoutId: string) {
    if (!ensureAcademicYearEditable()) {
      return;
    }

    const targetTryout = tryouts.find((item) => item.id === tryoutId);

    if (!targetTryout) {
      return;
    }

    if (
      targetTryout.publishStatus === "Draft" &&
      !isTryoutQuestionSourceReady(targetTryout.questionSource)
    ) {
      toast.error(
        "Sumber soal ini belum siap diterbitkan.",
      );
      return;
    }

    if (
      targetTryout.publishStatus === "Draft" &&
      targetTryout.jumlahSoal === 0
    ) {
      toast.error(
        targetTryout.questionSource === "manual"
          ? "Ujian manual belum dapat diterbitkan karena belum memiliki soal."
          : "Ujian belum dapat diterbitkan karena sumber soal belum siap.",
      );
      return;
    }

    if (
      targetTryout.publishStatus === "Draft" &&
      !isTryoutReadyToPublish(targetTryout)
    ) {
      toast.error(
        "Lengkapi judul, kelas, mapel, durasi, dan minimal 1 soal sebelum diterbitkan.",
      );
      return;
    }

    await updateTryoutPublishStatus(
      targetTryout,
      targetTryout.publishStatus === "Published" ? "Draft" : "Published",
    );
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
    if (!ensureAcademicYearEditable()) {
      return;
    }

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
    if (!ensureAcademicYearEditable()) {
      return;
    }

    if (!selectedUploadTryoutId || xlsxUploadInFlightRef.current) {
      return;
    }

    if (uploadTargetTryout?.publishStatus !== "Draft") {
      toast.error(DRAFT_ONLY_QUESTION_MESSAGE);
      return;
    }

    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      toast.error("File soal wajib berformat .xlsx atau .xls.");
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
          buildGuruApiUrl(
            `/api/teacher/me/tryouts/${encodeURIComponent(selectedUploadTryoutId)}/questions/xlsx`,
            searchParams,
          ),
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
        throw new Error(payload?.message || "File Excel belum bisa diproses.");
      }

      const uploadedQuestions = payload.data?.questions ?? [];
      const nextTryouts = syncTryoutQuestionsFromApi(
        tryouts,
        selectedUploadTryoutId,
        uploadedQuestions,
        payload.data?.tryout,
      );
      const nextTryout = nextTryouts.find(
        (item) => item.id === selectedUploadTryoutId,
      );

      setTryouts(nextTryouts);
      setLoadError(null);
      setQuestionLoadError(null);
      setQuestionSuccessMessage(
        `File ${file.name} berhasil diproses menjadi ${uploadedQuestions.length} soal.`,
      );

      if (
        nextTryout?.publishStatus === "Draft" &&
        isTryoutReadyToPublish(nextTryout) &&
        window.confirm("Soal sudah siap. Terbitkan ujian ini sekarang?")
      ) {
        await updateTryoutPublishStatus(nextTryout, "Published");
      }
    } catch (error) {
      console.error("[tryout-guru-section] upload_xlsx_failed", error);
      setQuestionLoadError(
        error instanceof Error && error.message
          ? error.message
          : "File Excel belum bisa diproses.",
      );
    } finally {
      xlsxUploadInFlightRef.current = false;
      setIsXlsxUploading(false);
    }
  }

  async function handleSubmitQuestion() {
    if (!ensureAcademicYearEditable()) {
      return;
    }

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
      toast.error("Lengkapi pertanyaan dan seluruh opsi jawaban terlebih dahulu.");
      return;
    }

    questionSubmitInFlightRef.current = true;

    try {
      setIsQuestionSubmitting(true);
      setQuestionSuccessMessage(null);
      const isEditMode = Boolean(editingQuestionId);

      const { response, payload } =
        await fetchTeacherTryoutJson<TeacherTryoutQuestionDetailResponse>(
          buildGuruApiUrl(
            isEditMode
            ? `/api/teacher/me/tryouts/${encodeURIComponent(selectedUploadTryoutId)}/questions/${encodeURIComponent(editingQuestionId ?? "")}`
            : `/api/teacher/me/tryouts/${encodeURIComponent(selectedUploadTryoutId)}/questions`,
            searchParams,
          ),
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
    if (!ensureAcademicYearEditable()) {
      return;
    }

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
          buildGuruApiUrl(
            `/api/teacher/me/tryouts/${encodeURIComponent(selectedUploadTryoutId)}/questions/${encodeURIComponent(questionId)}`,
            searchParams,
          ),
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
    if (!ensureAcademicYearEditable()) {
      return;
    }

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
          buildGuruApiUrl(
            `/api/teacher/me/tryouts/${encodeURIComponent(selectedUploadTryoutId)}/questions/${encodeURIComponent(questionId)}`,
            searchParams,
          ),
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
          buildGuruApiUrl(
            `/api/teacher/me/tryouts/${encodeURIComponent(tryoutId)}/results`,
            searchParams,
          ),
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
  }, [searchParams]);

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

          {isAcademicArchive ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600">
              {archiveMessage} Tambah ujian, edit, publikasi, hapus, dan kelola soal dinonaktifkan.
            </div>
          ) : null}

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              icon={ClipboardList}
              label="Total Ujian"
              value={stats.total}
              helper="Seluruh ujian aktif dan belum diterbitkan milik guru."
            />
            <SummaryCard
              icon={CheckCircle2}
              label="Diterbitkan"
              value={stats.published}
              helper="Tryout yang sudah siap dibuka untuk siswa."
            />
            <SummaryCard
              icon={FileText}
              label="Belum Terbit"
              value={stats.draft}
              helper="Tryout yang masih perlu dilengkapi sebelum diterbitkan."
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
                  status terbit untuk menjaga daftar tryout tetap fokus.
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
                <p className={LABEL_CLASS}>Status Terbit</p>
                <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-100 bg-slate-50/50 p-2">
                  {STATUS_FILTERS.map((item) => (
                    <SegmentedButton
                      key={item}
                      active={selectedStatus === item}
                      label={getPublishStatusLabel(item)}
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
                  {getPublishStatusLabel(selectedStatus)}
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
                  terbit sesuai kelas yang diajar guru.
                </p>
              </div>

              <button
                type="button"
                onClick={openAddDialog}
                disabled={isAcademicArchive}
                title={isAcademicArchive ? archiveMessage : "Tambah Ujian"}
                className={`inline-flex items-center justify-center gap-2 border px-4 py-2 text-sm font-semibold transition ${
                  isAcademicArchive
                    ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                    : "border-orange-500 bg-orange-500 text-white hover:bg-orange-600"
                }`}
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
                                      Cabang {tryout.branch ?? "-"}
                                    </p>
                                    <p className="hidden">
                                      {tryout.branch ?? "-"} ·{" "}
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
                                    {getTryoutStageLabel(tryout.stage)}
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
                                    {getPublishStatusLabel(tryout.publishStatus)}
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
                                    Soal terkunci setelah ujian diterbitkan.
                                  </p>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-4 py-4 align-middle text-center">
                              <TryoutActionControls
                                tryout={tryout}
                                isAcademicArchive={isAcademicArchive}
                                archiveMessage={archiveMessage}
                                onEdit={() => openEditDialog(tryout)}
                                onManageQuestions={() => openUploadDialog(tryout.id)}
                                onViewResults={() => openResultDialog(tryout.id)}
                                onTogglePublish={() => {
                                  void handleTogglePublish(tryout.id);
                                }}
                                onDelete={() => {
                                  void handleDeleteTryout(tryout.id);
                                }}
                              />
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
                              {getPublishStatusLabel(tryout.publishStatus)}
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
                                {getTryoutStageLabel(tryout.stage)}
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
                              Soal terkunci setelah ujian diterbitkan.
                            </p>
                          ) : null}

                          <div className="border-t border-orange-100 pt-4">
                            <TryoutActionControls
                              tryout={tryout}
                              isAcademicArchive={isAcademicArchive}
                              archiveMessage={archiveMessage}
                              onEdit={() => openEditDialog(tryout)}
                              onManageQuestions={() => openUploadDialog(tryout.id)}
                              onViewResults={() => openResultDialog(tryout.id)}
                              onTogglePublish={() => {
                                void handleTogglePublish(tryout.id);
                              }}
                              onDelete={() => {
                                void handleDeleteTryout(tryout.id);
                              }}
                            />
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
        readOnly={isAcademicArchive}
        readOnlyMessage={archiveMessage}
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
