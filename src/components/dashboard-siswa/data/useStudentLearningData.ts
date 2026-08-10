"use client";

import { useEffect, useRef, useState } from "react";

import { withStoredAuthHeader } from "@/lib/auth";
import { subscribeStudentDashboardRefresh } from "../student-dashboard-refresh-events";
import type { StudentAcademicAccess } from "./studentAcademicAccess";
import type {
  StudentAcademicSummary,
  StudentTaskAttemptSummary,
  StudentLearningProfile,
  StudentMaterial,
  StudentTaskGradeSummary,
  StudentTask,
  StudentTaskSubmissionSummary,
  StudentTaskStatus,
  SubmissionMode,
} from "./learning-types";
import {
  EMPTY_ACADEMIC_SCORES,
  type AcademicGradeScheme,
  type AcademicScores,
} from "@/lib/academic-grades";

type StudentLearningApiMaterialItem = {
  id?: string;
  materialId?: string;
  subject?: string;
  title?: string;
  meetingNumber?: number;
  description?: string;
  linkUrl?: string;
  updatedAt?: string | null;
  attachment?: StudentLearningApiAttachmentItem | null;
};

type StudentLearningApiTaskItem = {
  id?: string;
  taskId?: string;
  classId?: string;
  className?: string;
  subject?: string;
  title?: string;
  meetingNumber?: number;
  description?: string;
  deadline?: string;
  startAt?: string | null;
  endAt?: string | null;
  durationMinutes?: number | null;
  questionCount?: number | null;
  passingGrade?: number | null;
  reviewStatus?: string;
  attachment?: StudentLearningApiAttachmentItem | null;
  mySubmission?: StudentLearningApiTaskSubmissionItem | null;
  myGrade?: StudentLearningApiTaskGradeItem | null;
  myAttempt?: StudentLearningApiTaskAttemptItem | null;
};

type StudentLearningApiAttachmentItem = {
  fileName?: string;
  mimeType?: string;
  size?: number;
};

type StudentLearningApiTaskSubmissionItem = {
  submitted?: boolean;
  submissionId?: string | null;
  submissionMode?: SubmissionMode | null;
  submittedAt?: string | null;
  hasAttachment?: boolean;
  driveUrl?: string;
  answerTextPreview?: string;
};

type StudentLearningApiTaskGradeItem = {
  graded?: boolean;
  gradeId?: string | null;
  score?: number | null;
  note?: string;
  status?: string;
  gradedAt?: string | null;
  remedialRequestedAt?: string | null;
  remedialCompletedAt?: string | null;
  remedialCount?: number;
};

type StudentLearningApiTaskAttemptItem = {
  submitted?: boolean;
  attemptId?: string | null;
  status?: string;
  score?: number | null;
  submittedAt?: string | null;
  startedAt?: string | null;
  remedialCount?: number;
};

type StudentLearningResponse = {
  success: boolean;
  message?: string;
  data?: {
    materials?: StudentLearningApiMaterialItem[];
    tasks?: StudentLearningApiTaskItem[];
    academicSummaries?: StudentLearningApiAcademicSummaryItem[];
    student?: StudentLearningProfile | null;
    academicAccess?: StudentAcademicAccess | null;
  };
};

type StudentLearningApiAcademicSummaryItem = {
  classId?: string;
  className?: string;
  subject?: string;
  scheme?: AcademicGradeScheme;
  period?: {
    academicYear?: string;
    semester?: string;
  };
  taskAverage?: number | null;
  gradedTaskCount?: number;
  scores?: Partial<AcademicScores>;
  note?: string;
  finalAverage?: number | null;
  evaluatedAt?: string | null;
  targetMeetingCount?: number;
};

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function slugify(value: string) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatDisplayDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatTaskWindowLabel(
  startAt: string | null,
  endAt: string | null,
) {
  if (!startAt || !endAt) {
    return "Jadwal mengikuti arahan guru";
  }

  const startDate = new Date(startAt);
  const endDate = new Date(endAt);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return "Jadwal mengikuti arahan guru";
  }

  const dateLabel = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(startDate);
  const timeFormatter = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });

  return `${dateLabel}, ${timeFormatter.format(startDate)} - ${timeFormatter.format(endDate)} WIB`;
}

function formatDateTimeDeadlineLabel(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "long",
    timeZone: "Asia/Jakarta",
    year: "numeric",
  }).format(date);
}

function buildTextDownloadUrl(title: string, sections: string[]) {
  const body = [title, "", ...sections].join("\n");
  return `data:text/plain;charset=utf-8,${encodeURIComponent(body)}`;
}

function inferMaterialFormat(params: {
  linkUrl: string;
  attachment: StudentLearningApiAttachmentItem | null | undefined;
}): StudentMaterial["format"] {
  const normalizedLink = normalizeText(params.linkUrl).toLowerCase();
  const normalizedFileName = normalizeText(params.attachment?.fileName).toLowerCase();
  const normalizedMimeType = normalizeText(params.attachment?.mimeType).toLowerCase();

  if (
    normalizedMimeType.startsWith("video/") ||
    normalizedFileName.endsWith(".mp4") ||
    normalizedLink.includes("youtube.com") ||
    normalizedLink.includes("youtu.be") ||
    normalizedLink.endsWith(".mp4")
  ) {
    return "Video";
  }

  if (
    normalizedMimeType.includes("pdf") ||
    normalizedFileName.endsWith(".pdf") ||
    normalizedLink.endsWith(".pdf")
  ) {
    return "PDF";
  }

  return "Modul";
}

function formatUpdatedLabel(updatedAt: string | null | undefined) {
  const normalizedUpdatedAt = normalizeText(updatedAt);

  if (!normalizedUpdatedAt) {
    return "Diperbarui baru-baru ini";
  }

  const updatedDate = new Date(normalizedUpdatedAt);

  if (Number.isNaN(updatedDate.getTime())) {
    return "Diperbarui baru-baru ini";
  }

  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);
  const updatedKey = updatedDate.toISOString().slice(0, 10);

  if (updatedKey === todayKey) {
    return "Diperbarui hari ini";
  }

  if (updatedKey === yesterdayKey) {
    return "Diperbarui kemarin";
  }

  return `Diperbarui ${formatDisplayDate(updatedKey)}`;
}

function deriveTaskStatus(
  deadline: string,
  grade: StudentLearningApiTaskGradeItem | null | undefined,
  submission: StudentLearningApiTaskSubmissionItem | null | undefined,
): StudentTaskStatus {
  if (normalizeText(grade?.status).toLowerCase() === "perlu remedial") {
    return "Perlu Remedial";
  }

  if (normalizeText(grade?.status).toLowerCase() === "sudah dinilai") {
    return "Sudah Dinilai";
  }

  if (submission?.submitted) {
    return "Sudah Dikirim";
  }

  const normalizedDeadline = normalizeText(deadline);
  const today = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date());

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedDeadline) && normalizedDeadline < today) {
    return "Belum Dikerjakan";
  }

  return "Menunggu Dikirim";
}

function mapTaskSubmissionSummary(
  submission: StudentLearningApiTaskSubmissionItem | null | undefined,
): StudentTaskSubmissionSummary | undefined {
  if (!submission) {
    return undefined;
  }

  return {
    submitted: Boolean(submission.submitted),
    submissionId: submission.submissionId?.trim() || null,
    submissionMode: submission.submissionMode ?? null,
    submittedAt: submission.submittedAt?.trim() || null,
    hasAttachment: Boolean(submission.hasAttachment),
    driveUrl: normalizeText(submission.driveUrl),
    answerTextPreview: normalizeText(submission.answerTextPreview),
  };
}

function mapTaskGradeSummary(
  grade: StudentLearningApiTaskGradeItem | null | undefined,
): StudentTaskGradeSummary | undefined {
  if (!grade) {
    return undefined;
  }

  const normalizedGradeStatus = normalizeText(grade.status).toLowerCase();
  const normalizedStatus =
    normalizedGradeStatus === "sudah dinilai"
      ? "Sudah Dinilai"
      : normalizedGradeStatus === "perlu remedial"
        ? "Perlu Remedial"
        : "Belum Dinilai";

  return {
    graded: Boolean(grade.graded) || normalizedStatus === "Sudah Dinilai",
    gradeId: normalizeText(grade.gradeId) || null,
    score:
      typeof grade.score === "number" && Number.isFinite(grade.score)
        ? grade.score
        : null,
    note: normalizeText(grade.note),
    status: normalizedStatus,
    gradedAt: grade.gradedAt?.trim() || null,
    remedialRequestedAt: grade.remedialRequestedAt?.trim() || null,
    remedialCompletedAt: grade.remedialCompletedAt?.trim() || null,
    remedialCount: Math.max(grade.remedialCount ?? 0, 0),
  };
}

function mapTaskAttemptSummary(
  attempt: StudentLearningApiTaskAttemptItem | null | undefined,
): StudentTaskAttemptSummary | undefined {
  if (!attempt) {
    return undefined;
  }

  const normalizedStatus = normalizeText(attempt.status) || "not_started";
  const isSubmitted =
    Boolean(attempt.submitted) ||
    normalizedStatus === "submitted" ||
    Boolean(normalizeText(attempt.submittedAt));

  return {
    submitted: isSubmitted,
    attemptId: normalizeText(attempt.attemptId) || null,
    status: normalizedStatus,
    score:
      isSubmitted &&
      typeof attempt.score === "number" &&
      Number.isFinite(attempt.score)
        ? attempt.score
        : null,
    submittedAt: attempt.submittedAt?.trim() || null,
    startedAt: attempt.startedAt?.trim() || null,
    remedialCount: Math.max(attempt.remedialCount ?? 0, 0),
  };
}

function mapApiMaterialToStudentMaterial(
  material: StudentLearningApiMaterialItem,
): StudentMaterial {
  const title = normalizeText(material.title) || "Materi belum diatur";
  const description =
    normalizeText(material.description) || "Ringkasan materi belum tersedia.";
  const linkUrl = normalizeText(material.linkUrl);
  const materialId =
    normalizeText(material.materialId) ||
    normalizeText(material.id) ||
    `materi-${Date.now()}`;
  const attachment = material.attachment;
  const attachmentFileName = normalizeText(attachment?.fileName);
  const format = inferMaterialFormat({ linkUrl, attachment });
  const previewPoints = description
    .split(".")
    .map((point) => normalizeText(point))
    .filter(Boolean)
    .slice(0, 3);

  return {
    id: materialId,
    mapel: normalizeText(material.subject) || "Mapel belum diatur",
    judul: title,
    pertemuan: Math.max(
      typeof material.meetingNumber === "number" ? material.meetingNumber : 1,
      1,
    ),
    durasi: format === "Video" ? "Tonton Online" : "Materi Kelas",
    format,
    status: "Baru",
    ringkasan: description,
    diperbarui: formatUpdatedLabel(material.updatedAt),
    href: "/dashboard-siswa/materi",
    downloadName:
      attachmentFileName || `${slugify(title) || "materi-kelas"}.txt`,
    downloadUrl:
      attachmentFileName
        ? `/api/student/me/learning/materials/${encodeURIComponent(materialId)}/attachment`
        : linkUrl ||
          buildTextDownloadUrl(title, [
            description,
            "Ringkasan materi ini disimpan dari dashboard guru dan tersedia untuk siswa kelas terkait.",
          ]),
    previewHeading: title,
    previewBody: description,
    previewPoints:
      previewPoints.length > 0
        ? previewPoints
        : ["Materi ini sudah dibagikan guru untuk dipelajari mandiri."],
  };
}

function mapApiTaskToStudentTask(task: StudentLearningApiTaskItem): StudentTask {
  const title = normalizeText(task.title) || "Latihan belum diatur";
  const description =
    normalizeText(task.description) || "Instruksi latihan belum tersedia.";
  const deadline = normalizeText(task.deadline);
  const taskId =
    normalizeText(task.taskId) ||
    normalizeText(task.id) ||
    `latihan-${Date.now()}`;
  const encodedTaskId = encodeURIComponent(taskId);
  const attachmentFileName = normalizeText(task.attachment?.fileName);
  const myGrade = mapTaskGradeSummary(task.myGrade);
  const startAt = normalizeText(task.startAt) || null;
  const endAt = normalizeText(task.endAt) || null;
  const durationMinutes =
    typeof task.durationMinutes === "number" && task.durationMinutes > 0
      ? task.durationMinutes
      : null;
  const questionCount = Math.max(task.questionCount ?? 0, 0);
  const passingGrade =
    typeof task.passingGrade === "number" && task.passingGrade >= 0
      ? task.passingGrade
      : null;
  const now = new Date();
  const parsedStartAt = startAt ? new Date(startAt) : null;
  const parsedEndAt = endAt ? new Date(endAt) : null;
  const isBeforeStart =
    parsedStartAt !== null &&
    !Number.isNaN(parsedStartAt.getTime()) &&
    now < parsedStartAt;
  const isAfterEnd =
    parsedEndAt !== null &&
    !Number.isNaN(parsedEndAt.getTime()) &&
    now > parsedEndAt;
  const hasCbtContent = questionCount > 0 && Boolean(durationMinutes);
  const isRemedial = myGrade?.status === "Perlu Remedial";
  const isCbtReady = hasCbtContent && !isBeforeStart && !isAfterEnd;
  const availabilityMessage = !hasCbtContent
    ? "Latihan belum memiliki soal CBT atau durasi yang valid."
    : isBeforeStart
      ? "Latihan belum dimulai sesuai jadwal guru."
      : isAfterEnd
        ? "Waktu pengerjaan latihan sudah berakhir."
        : isRemedial
          ? "Nilai belum mencapai KKM. Kerjakan remedial latihan ini."
          : `${questionCount} soal CBT siap dikerjakan.`;

  return {
    id: taskId,
    classId: normalizeText(task.classId),
    className: normalizeText(task.className),
    mapel: normalizeText(task.subject) || "Mapel belum diatur",
    judul: title,
    pertemuan: Math.max(
      typeof task.meetingNumber === "number" ? task.meetingNumber : 1,
      1,
    ),
    deadline:
      formatDateTimeDeadlineLabel(endAt) ||
      (deadline ? `${formatDisplayDate(deadline)}, 23.59 WIB` : "-"),
    estimasi: durationMinutes ? `${durationMinutes} menit` : "Mandiri",
    jadwalPengerjaan: formatTaskWindowLabel(startAt, endAt),
    poin:
      typeof myGrade?.score === "number"
        ? `${myGrade.score}/100${passingGrade !== null ? ` (KKM ${passingGrade})` : ""}`
        : passingGrade !== null
          ? `Minimal ${passingGrade}`
          : "Nilai latihan CBT",
    status: deriveTaskStatus(
      deadline,
      task.myGrade,
      task.mySubmission,
    ),
    deskripsi: description,
    detailHref: `/dashboard-siswa/latihan?taskId=${encodedTaskId}`,
    submitHref: `/dashboard-siswa/latihan?taskId=${encodedTaskId}`,
    attachmentName: attachmentFileName || undefined,
    attachmentUrl: attachmentFileName
      ? `/api/student/me/learning/tasks/${encodeURIComponent(taskId)}/attachment`
      : undefined,
    startAt,
    endAt,
    durationMinutes,
    questionCount,
    passingGrade,
    isCbtReady,
    isRemedial,
    availabilityMessage,
    submissionModes: ["cbt"] satisfies SubmissionMode[],
    instruksiPengumpulan: [
      hasCbtContent
        ? "Kerjakan latihan CBT sesuai durasi yang ditentukan guru."
        : "Latihan CBT belum memiliki soal atau durasi yang lengkap dari guru.",
      isRemedial
        ? "Remedial dibuka khusus karena nilai sebelumnya belum mencapai KKM."
        : "Hasil CBT langsung tersimpan ke nilai dan progres belajar.",
      "Setelah selesai, pembahasan bisa digunakan guru untuk bahas singkat sebelum pulang.",
    ],
    mySubmission: mapTaskSubmissionSummary(task.mySubmission),
    myGrade,
    myAttempt: mapTaskAttemptSummary(task.myAttempt),
  };
}

function mapApiAcademicSummary(
  summary: StudentLearningApiAcademicSummaryItem,
): StudentAcademicSummary {
  return {
    classId: normalizeText(summary.classId),
    className: normalizeText(summary.className),
    subject: normalizeText(summary.subject) || "Mapel belum diatur",
    scheme: summary.scheme ?? "semester",
    academicYear: normalizeText(summary.period?.academicYear),
    semester: normalizeText(summary.period?.semester),
    taskAverage:
      typeof summary.taskAverage === "number" ? summary.taskAverage : null,
    gradedTaskCount: Math.max(summary.gradedTaskCount ?? 0, 0),
    scores: {
      ...EMPTY_ACADEMIC_SCORES,
      ...summary.scores,
    },
    note: normalizeText(summary.note),
    finalAverage:
      typeof summary.finalAverage === "number" ? summary.finalAverage : null,
    evaluatedAt: normalizeText(summary.evaluatedAt) || null,
    targetMeetingCount: Math.max(summary.targetMeetingCount ?? 24, 1),
  };
}

export function useStudentLearningData() {
  const [student, setStudent] = useState<StudentLearningProfile | null>(null);
  const [materials, setMaterials] = useState<StudentMaterial[]>([]);
  const [tasks, setTasks] = useState<StudentTask[]>([]);
  const [academicSummaries, setAcademicSummaries] = useState<
    StudentAcademicSummary[]
  >([]);
  const [academicAccess, setAcademicAccess] =
    useState<StudentAcademicAccess | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const isMountedRef = useRef(true);
  const silentReloadRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    const showLoading = !silentReloadRef.current;
    silentReloadRef.current = false;

    async function loadStudentLearningData() {
      if (showLoading && isMountedRef.current) {
        setIsLoading(true);
      }

      if (isMountedRef.current) {
        setLoadError(null);
      }

      try {
        const url = new URL("/api/student/me/learning", window.location.origin);

        const response = await fetch(url.toString(), {
          method: "GET",
          ...withStoredAuthHeader(),
          credentials: "include",
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | StudentLearningResponse
          | null;

        if (!isMountedRef.current) {
          return;
        }

        if (response.status === 401) {
          setMaterials([]);
          setTasks([]);
          setAcademicSummaries([]);
          setStudent(null);
          setAcademicAccess(null);
          setLoadError("Sesi login berakhir. Silakan login ulang.");
          return;
        }

        if (!response.ok || !payload?.success) {
          setMaterials([]);
          setTasks([]);
          setAcademicSummaries([]);
          setStudent(null);
          setAcademicAccess(null);
          setLoadError(
            payload?.message || "Materi dan latihan siswa belum bisa dimuat saat ini.",
          );
          return;
        }

        setMaterials(
          (payload.data?.materials ?? []).map(mapApiMaterialToStudentMaterial),
        );
        setTasks((payload.data?.tasks ?? []).map(mapApiTaskToStudentTask));
        setAcademicSummaries(
          (payload.data?.academicSummaries ?? []).map(mapApiAcademicSummary),
        );
        setStudent(payload.data?.student ?? null);
        setAcademicAccess(payload.data?.academicAccess ?? null);
      } catch (error) {
        if (!isMountedRef.current) {
          return;
        }

        console.error("[dashboard-siswa] load_learning_data_failed", { error });
        setMaterials([]);
        setTasks([]);
        setAcademicSummaries([]);
        setStudent(null);
        setAcademicAccess(null);
        setLoadError("Materi dan latihan siswa belum bisa dimuat saat ini.");
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    }

    queueMicrotask(() => {
      void loadStudentLearningData();
    });

    return () => {
      isMountedRef.current = false;
    };
  }, [reloadToken]);

  function refreshLearningData() {
    silentReloadRef.current = true;
    setReloadToken((currentToken) => currentToken + 1);
  }

  useEffect(() => {
    return subscribeStudentDashboardRefresh(() => {
      silentReloadRef.current = true;
      setReloadToken((currentToken) => currentToken + 1);
    });
  }, []);

  function updateTaskSubmissionSummary(
    taskId: string,
    submissionSummary: StudentTaskSubmissionSummary,
  ) {
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              mySubmission: submissionSummary,
              status:
                task.myGrade?.status === "Sudah Dinilai"
                  ? "Sudah Dinilai"
                  : submissionSummary.submitted
                    ? "Sudah Dikirim"
                    : task.status,
            }
          : task,
      ),
    );
  }

  return {
    materials,
    tasks,
    academicSummaries,
    student,
    academicAccess,
    isLoading,
    loadError,
    refreshLearningData,
    updateTaskSubmissionSummary,
  };
}
