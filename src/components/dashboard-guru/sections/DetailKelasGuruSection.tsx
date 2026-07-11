/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CalendarDays,
  Clock3,
  MapPin,
  School,
  Users,
} from "lucide-react";

import {
  AUTH_USER_UPDATED_EVENT,
  clearAuthClientState,
  readPersistedAuthUser,
} from "@/lib/auth";
import {
  type ClassDetailData,
  type ClassStatus,
  type ClassStudent,
  type PresenceStatus,
  type ClassAttendanceSession,
  DEFAULT_SEMESTER_MEETING_TARGET,
} from "@/components/dashboard-guru/data/guruClassTypes";
import AbsensiPertemuanTable from "@/components/dashboard-guru/detail-kelas/AbsensiPertemuanTable";
import BelumDinilaiTable from "@/components/dashboard-guru/detail-kelas/BelumDinilaiTable";
import DetailKelasSidebar from "@/components/dashboard-guru/detail-kelas/DetailKelasSidebar";
import DetailPertemuanTable from "@/components/dashboard-guru/detail-kelas/DetailPertemuanTable";
import MateriFormDialog from "@/components/dashboard-guru/detail-kelas/MateriFormDialog";
import NilaiFormDialog from "@/components/dashboard-guru/detail-kelas/NilaiFormDialog";
import PesertaKelasTable from "@/components/dashboard-guru/detail-kelas/PesertaKelasTable";
import TabelNilaiTable from "@/components/dashboard-guru/detail-kelas/TabelNilaiTable";
import TaskSubmissionReviewDialog from "@/components/dashboard-guru/detail-kelas/TaskSubmissionReviewDialog";
import TugasFormDialog from "@/components/dashboard-guru/detail-kelas/TugasFormDialog";
import TugasPertemuanTable from "@/components/dashboard-guru/detail-kelas/TugasPertemuanTable";
import {
  createEmptyMateri,
  createEmptyNilai,
  createEmptyTugas,
  DETAIL_SECTION_ITEMS,
} from "@/components/dashboard-guru/detail-kelas/helpers";
import type {
  DetailSection,
  DialogMode,
  MateriPertemuan,
  NilaiDraft,
  NilaiSiswa,
  TaskSubmissionDetail,
  TaskSubmissionListItem,
  TugasPertemuan,
} from "@/components/dashboard-guru/detail-kelas/types";
import {
  EMPTY_ACADEMIC_SCORES,
  getAcademicGradeScheme,
  type AcademicGradeScheme,
  type AcademicScoreKey,
  type AcademicScores,
} from "@/lib/academic-grades";

type DetailKelasGuruSectionProps = {
  kelasId?: string | null;
};

type TeacherClassApiNextSchedule = {
  id?: string;
  day?: string;
  time?: string;
  room?: string;
  subject?: string;
  status?: string;
} | null;

type TeacherClassApiDetailItem = {
  id?: string;
  className?: string;
  level?: string;
  subject?: string;
  branch?: string;
  room?: string;
  studentCount?: number;
  scheduleCount?: number;
  targetMeetingCount?: number;
  nextSchedule?: TeacherClassApiNextSchedule;
  status?: string;
};

type TeacherClassApiScheduleItem = {
  id?: string;
  scheduleId?: string;
  day?: string;
  time?: string;
  room?: string;
  subject?: string;
  status?: string;
};

type TeacherClassApiParticipantItem = {
  id?: string;
  studentId?: string;
  name?: string;
  email?: string;
  phone?: string;
  className?: string;
  level?: string;
  branch?: string;
  status?: string;
  history?: TeacherClassApiParticipantHistoryItem[];
};

type TeacherClassApiParticipantHistoryItem = {
  sessionId?: string;
  meetingNumber?: number;
  meetingLabel?: string;
  date?: string;
  startTime?: string;
  subject?: string;
  room?: string;
  status?: string;
  note?: string;
  markedAt?: string | null;
};

type TeacherClassApiAttendanceSessionSummary = {
  hadir?: number;
  sakit?: number;
  izin?: number;
  alpa?: number;
  belumAbsen?: number;
};

type TeacherClassApiAttendanceSessionItem = {
  sessionId?: string;
  meetingNumber?: number;
  meetingLabel?: string;
  date?: string;
  startTime?: string;
  subject?: string;
  room?: string;
  status?: string;
  summary?: TeacherClassApiAttendanceSessionSummary;
};

type TeacherClassApiAttachmentItem = {
  fileName?: string;
  mimeType?: string;
  size?: number;
} | null;

type TeacherClassApiMaterialItem = {
  id?: string;
  materialId?: string;
  classId?: string;
  meetingNumber?: number;
  date?: string;
  title?: string;
  description?: string;
  linkUrl?: string;
  status?: string;
  subject?: string;
  room?: string;
  attachment?: TeacherClassApiAttachmentItem;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type TeacherClassApiTaskItem = {
  id?: string;
  taskId?: string;
  classId?: string;
  meetingNumber?: number;
  title?: string;
  description?: string;
  deadline?: string;
  submittedCount?: number;
  gradedCount?: number;
  reviewStatus?: string;
  subject?: string;
  room?: string;
  attachment?: TeacherClassApiAttachmentItem;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type TeacherClassApiGradeItem = {
  id?: string;
  gradeId?: string;
  classId?: string;
  taskId?: string;
  studentId?: string;
  score?: number;
  note?: string;
  status?: string;
  gradedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type TeacherClassApiAcademicGradeItem = {
  academicGradeId?: string;
  classId?: string;
  studentId?: string;
  academicYear?: string;

  scheme?: AcademicGradeScheme;
  scores?: Partial<AcademicScores>;
  note?: string;
  evaluatedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type TeacherClassDetailResponse = {
  success: boolean;
  message?: string;
  data?: {
    class?: TeacherClassApiDetailItem;
    schedules?: TeacherClassApiScheduleItem[];
    participants?: TeacherClassApiParticipantItem[];
    attendanceSessions?: TeacherClassApiAttendanceSessionItem[];
    materials?: TeacherClassApiMaterialItem[];
    tasks?: TeacherClassApiTaskItem[];
  };
};

type TeacherClassMaterialMutationResponse = {
  success: boolean;
  message?: string;
  data?: {
    material?: TeacherClassApiMaterialItem;
  };
};

type TeacherClassTaskMutationResponse = {
  success: boolean;
  message?: string;
  data?: {
    task?: TeacherClassApiTaskItem;
  };
};

type TeacherClassGradesResponse = {
  success: boolean;
  message?: string;
  data?: {
    grades?: TeacherClassApiGradeItem[];
    academicGrades?: TeacherClassApiAcademicGradeItem[];
    scheme?: AcademicGradeScheme;
    period?: {
      academicYear?: string;

    };
  };
};

type TeacherClassGradeMutationResponse = {
  success: boolean;
  message?: string;
  data?: {
    grade?: TeacherClassApiGradeItem;
  };
};

type TeacherClassAcademicGradeMutationResponse = {
  success: boolean;
  message?: string;
  data?: {
    academicGrade?: TeacherClassApiAcademicGradeItem | null;
    scheme?: AcademicGradeScheme;
  };
};

import { buildGuruApiUrl } from "@/lib/guru-helpers";

type TeacherClassSettingMutationResponse = {
  success: boolean;
  message?: string;
  data?: {
    classSetting?: {
      classId?: string;
      targetMeetingCount?: number;
      createdAt?: string | null;
      updatedAt?: string | null;
    };
  };
};

type TeacherTaskSubmissionApiAttachmentItem = {
  fileName?: string;
  originalName?: string;
  mimeType?: string;
  size?: number;
} | null;

type TeacherTaskSubmissionApiItem = {
  id?: string;
  submissionId?: string;
  classId?: string;
  taskId?: string;
  studentId?: string;
  studentName?: string;
  submissionMode?: "file" | "text" | "drive";
  submittedAt?: string | null;
  hasAttachment?: boolean;
  driveUrl?: string;
  answerTextPreview?: string;
  answerText?: string;
  note?: string;
  attachment?: TeacherTaskSubmissionApiAttachmentItem;
  gradeStatus?: string;
  score?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type TeacherTaskSubmissionListResponse = {
  success: boolean;
  message?: string;
  data?: {
    taskId?: string;
    submissions?: TeacherTaskSubmissionApiItem[];
    summary?: {
      submittedCount?: number;
      gradedCount?: number;
      pendingGradeCount?: number;
    };
  };
};

type TeacherTaskSubmissionDetailResponse = {
  success: boolean;
  message?: string;
  data?: {
    submission?: TeacherTaskSubmissionApiItem | null;
  };
};

type TeacherTaskGradeEntry = {
  id: string;
  gradeId: string;
  classId: string;
  taskId: string;
  studentId: string;
  score: number;
  note: string;
  status: "Belum Dinilai" | "Sudah Dinilai";
  gradedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type TeacherAcademicGradeEntry = {
  academicGradeId: string;
  classId: string;
  studentId: string;
  scheme: AcademicGradeScheme;
  scores: AcademicScores;
  note: string;
  evaluatedAt: string | null;
};

const DETAIL_CLASS_ERROR_MESSAGE =
  "Detail kelas tidak ditemukan atau tidak terhubung dengan akun guru ini.";
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
const ATTACHMENT_LIMIT_LABEL = "10 MB";

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function buildTeacherMaterialAttachmentUrl(classId: string, materialId: string) {
  const normalizedClassId = normalizeText(classId);
  const normalizedMaterialId = normalizeText(materialId);

  if (!normalizedClassId || !normalizedMaterialId) {
    return "";
  }

  return `/api/teacher/me/classes/${encodeURIComponent(normalizedClassId)}/materials/${encodeURIComponent(normalizedMaterialId)}/attachment`;
}

function buildTeacherTaskAttachmentUrl(classId: string, taskId: string) {
  const normalizedClassId = normalizeText(classId);
  const normalizedTaskId = normalizeText(taskId);

  if (!normalizedClassId || !normalizedTaskId) {
    return "";
  }

  return `/api/teacher/me/classes/${encodeURIComponent(normalizedClassId)}/tasks/${encodeURIComponent(normalizedTaskId)}/attachment`;
}

function buildTeacherTaskSubmissionAttachmentUrl(
  classId: string,
  taskId: string,
  submissionId: string,
) {
  const normalizedClassId = normalizeText(classId);
  const normalizedTaskId = normalizeText(taskId);
  const normalizedSubmissionId = normalizeText(submissionId);

  if (!normalizedClassId || !normalizedTaskId || !normalizedSubmissionId) {
    return "";
  }

  return `/api/teacher/me/classes/${encodeURIComponent(normalizedClassId)}/tasks/${encodeURIComponent(normalizedTaskId)}/submissions/${encodeURIComponent(normalizedSubmissionId)}/attachment`;
}

async function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("File lampiran tidak bisa diproses."));
        return;
      }

      const [, base64 = ""] = reader.result.split(",", 2);
      resolve(base64);
    };

    reader.onerror = () => {
      reject(new Error("File lampiran tidak bisa diproses."));
    };

    reader.readAsDataURL(file);
  });
}

function toSafeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toNullableScore(value: unknown) {
  if (value === null || value === undefined || normalizeText(String(value)) === "") {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue)
    ? Math.max(0, Math.min(100, Math.round(parsedValue)))
    : null;
}

function formatTimeLabel(value: string) {
  return normalizeText(value).replace(/:/g, ".");
}

function extractGrade(value: string) {
  const normalizedValue = normalizeText(value).toUpperCase();
  const numericMatch = normalizedValue.match(
    /(^|[^0-9])(4|5|6|7|8|9|10|11|12)(?![0-9])/,
  );

  if (numericMatch?.[2]) {
    return Number(numericMatch[2]);
  }

  const romanMatch = normalizedValue.match(/\b(XII|XI|X)\b/);

  switch (romanMatch?.[1]) {
    case "X":
      return 10;
    case "XI":
      return 11;
    case "XII":
      return 12;
    default:
      return null;
  }
}

function inferTingkat(className: string) {
  const grade = extractGrade(className);
  return grade ? `Kelas ${grade}` : "Kelas belum diatur";
}

function inferJenjang(
  className: string,
  level: string,
): ClassDetailData["jenjang"] {
  const normalizedClassName = normalizeText(className).toUpperCase();
  const normalizedLevel = normalizeText(level).toUpperCase();

  if (
    normalizedClassName.includes("SD") ||
    ["KELAS 4", "KELAS 5", "KELAS 6"].some((item) =>
      normalizedLevel.includes(item),
    )
  ) {
    return "SD";
  }

  if (
    normalizedClassName.includes("SMP") ||
    ["KELAS 7", "KELAS 8", "KELAS 9"].some((item) =>
      normalizedLevel.includes(item),
    )
  ) {
    return "SMP";
  }

  const grade = extractGrade(className) ?? extractGrade(level);

  if (grade !== null) {
    if (grade <= 6) {
      return "SD";
    }

    if (grade <= 9) {
      return "SMP";
    }
  }

  return "SMA";
}

function toClassStatus(value: string | null | undefined): ClassStatus {
  if (normalizeText(value).toLowerCase() === "berjalan") {
    return "Berjalan";
  }

  if (normalizeText(value).toLowerCase() === "selesai") {
    return "Selesai";
  }

  return "Aktif";
}

function toParticipantStatus(
  value: string | null | undefined,
): ClassStudent["status"] {
  const normalizedStatus = normalizeText(value).toLowerCase();

  if (normalizedStatus === "aktif") {
    return "Aktif";
  }

  if (normalizedStatus === "perlu pendampingan") {
    return "Perlu Pendampingan";
  }

  if (normalizedStatus === "nonaktif" || normalizedStatus === "cadangan") {
    return "Cadangan";
  }

  return "Aktif";
}

function toPresenceStatus(
  value: string | null | undefined,
): PresenceStatus {
  const normalizedStatus = normalizeText(value).toLowerCase();

  if (normalizedStatus === "hadir") {
    return "Hadir";
  }

  if (normalizedStatus === "sakit") {
    return "Sakit";
  }

  if (normalizedStatus === "izin") {
    return "Izin";
  }

  if (normalizedStatus === "alpa") {
    return "Alpa";
  }

  return "Belum Absen";
}

function toAttendanceSessionStatus(
  value: string | null | undefined,
): ClassAttendanceSession["status"] {
  const normalizedStatus = normalizeText(value).toLowerCase();

  if (normalizedStatus === "open" || normalizedStatus === "berlangsung") {
    return "Berlangsung";
  }

  return "Ditutup";
}

function buildSessionMaterialLabel(subject: string, room: string) {
  if (subject && room) {
    return `${subject} - ${room}`;
  }

  return subject || room || "Materi absensi belum diatur";
}

function buildAttendanceSummaryLabel(summary: {
  hadir: number;
  sakit: number;
  izin: number;
  alpa: number;
  belumAbsen: number;
}) {
  return `H ${summary.hadir} | S ${summary.sakit} | I ${summary.izin} | A ${summary.alpa} | Belum ${summary.belumAbsen}`;
}

function toMateriStatus(
  value: string | null | undefined,
): MateriPertemuan["statusMateri"] {
  return normalizeText(value).toLowerCase() === "dipublikasikan"
    ? "Dipublikasikan"
    : "Draft";
}

function toTugasStatusPenilaian(
  value: string | null | undefined,
): TugasPertemuan["statusPenilaian"] {
  const normalizedValue = normalizeText(value).toLowerCase();

  if (normalizedValue === "sudah dinilai") {
    return "Sudah Dinilai";
  }

  if (normalizedValue === "belum ada pengumpulan") {
    return "Belum Ada Pengumpulan";
  }

  return "Belum Dinilai";
}

function toTaskGradeStatus(
  value: string | null | undefined,
): TeacherTaskGradeEntry["status"] {
  return normalizeText(value).toLowerCase() === "sudah dinilai"
    ? "Sudah Dinilai"
    : "Belum Dinilai";
}

function sortMaterialsByMeeting(materials: MateriPertemuan[]) {
  return [...materials].sort((left, right) => {
    if (left.pertemuanKe !== right.pertemuanKe) {
      return left.pertemuanKe - right.pertemuanKe;
    }

    return left.tanggal.localeCompare(right.tanggal);
  });
}

function sortTasksByMeeting(tasks: TugasPertemuan[]) {
  return [...tasks].sort((left, right) => {
    if (left.pertemuanKe !== right.pertemuanKe) {
      return left.pertemuanKe - right.pertemuanKe;
    }

    return left.deadline.localeCompare(right.deadline);
  });
}

function mapTeacherApiMaterialToFormItem(
  material: TeacherClassApiMaterialItem,
  kelasId: string,
): MateriPertemuan {
  const materialId =
    normalizeText(material.materialId) ||
    normalizeText(material.id) ||
    `material-${Date.now()}`;

  return {
    id: materialId,
    kelasId: normalizeText(material.classId) || kelasId,
    pertemuanKe: Math.max(toSafeNumber(material.meetingNumber), 1),
    tanggal: normalizeText(material.date),
    judulMateri: normalizeText(material.title),
    deskripsi: normalizeText(material.description),
    linkMateri: normalizeText(material.linkUrl),
    statusMateri: toMateriStatus(material.status),
    attachmentFileName: normalizeText(material.attachment?.fileName) || undefined,
    attachmentMimeType: normalizeText(material.attachment?.mimeType) || undefined,
    attachmentSize: Math.max(toSafeNumber(material.attachment?.size), 0),
    attachmentUrl: normalizeText(material.attachment?.fileName)
      ? buildTeacherMaterialAttachmentUrl(
          normalizeText(material.classId) || kelasId,
          materialId,
        )
      : undefined,
  };
}

function mapTeacherApiTaskToFormItem(
  task: TeacherClassApiTaskItem,
  kelasId: string,
): TugasPertemuan {
  const taskId =
    normalizeText(task.taskId) ||
    normalizeText(task.id) ||
    `task-${Date.now()}`;

  return {
    id: taskId,
    kelasId: normalizeText(task.classId) || kelasId,
    pertemuanKe: Math.max(toSafeNumber(task.meetingNumber), 1),
    judulTugas: normalizeText(task.title),
    deskripsi: normalizeText(task.description),
    deadline: normalizeText(task.deadline),
    jumlahMengumpulkan: Math.max(toSafeNumber(task.submittedCount), 0),
    statusPenilaian: toTugasStatusPenilaian(task.reviewStatus),
    attachmentFileName: normalizeText(task.attachment?.fileName) || undefined,
    attachmentMimeType: normalizeText(task.attachment?.mimeType) || undefined,
    attachmentSize: Math.max(toSafeNumber(task.attachment?.size), 0),
    attachmentUrl: normalizeText(task.attachment?.fileName)
      ? buildTeacherTaskAttachmentUrl(
          normalizeText(task.classId) || kelasId,
          taskId,
        )
      : undefined,
  };
}

function mapTeacherDetailToMaterials(
  payload: NonNullable<TeacherClassDetailResponse["data"]>,
  kelasId: string,
) {
  return sortMaterialsByMeeting(
    (payload.materials ?? []).map((material) =>
      mapTeacherApiMaterialToFormItem(material, kelasId),
    ),
  );
}

function mapTeacherApiGradeToEntry(
  grade: TeacherClassApiGradeItem,
  kelasId: string,
): TeacherTaskGradeEntry {
  return {
    id:
      normalizeText(grade.gradeId) ||
      normalizeText(grade.id) ||
      `grade-${Date.now()}`,
    gradeId:
      normalizeText(grade.gradeId) ||
      normalizeText(grade.id) ||
      `grade-${Date.now()}`,
    classId: normalizeText(grade.classId) || kelasId,
    taskId: normalizeText(grade.taskId),
    studentId: normalizeText(grade.studentId),
    score: Math.max(Math.min(toSafeNumber(grade.score), 100), 0),
    note: normalizeText(grade.note),
    status: toTaskGradeStatus(grade.status),
    gradedAt: normalizeText(grade.gradedAt) || null,
    createdAt: normalizeText(grade.createdAt) || null,
    updatedAt: normalizeText(grade.updatedAt) || null,
  };
}

function mapTeacherGradesToEntries(
  payload: NonNullable<TeacherClassGradesResponse["data"]>,
  kelasId: string,
) {
  return (payload.grades ?? []).map((grade) =>
    mapTeacherApiGradeToEntry(grade, kelasId),
  );
}

function mapTeacherApiAcademicGradeToEntry(
  grade: TeacherClassApiAcademicGradeItem,
  kelasId: string,
  fallbackScheme: AcademicGradeScheme,
): TeacherAcademicGradeEntry {
  return {
    academicGradeId: normalizeText(grade.academicGradeId),
    classId: normalizeText(grade.classId) || kelasId,
    studentId: normalizeText(grade.studentId),
    scheme: grade.scheme ?? fallbackScheme,
    scores: {
      uts: toNullableScore(grade.scores?.uts),
      uas: toNullableScore(grade.scores?.uas),
      uts1: toNullableScore(grade.scores?.uts1),
      uts2: toNullableScore(grade.scores?.uts2),
      uts3: toNullableScore(grade.scores?.uts3),
      tryout1: toNullableScore(grade.scores?.tryout1),
      tryout2: toNullableScore(grade.scores?.tryout2),
      tryout3: toNullableScore(grade.scores?.tryout3),
    },
    note: normalizeText(grade.note),
    evaluatedAt: normalizeText(grade.evaluatedAt) || null,
  };
}

function mapTeacherAcademicGradesToEntries(
  payload: NonNullable<TeacherClassGradesResponse["data"]>,
  kelasId: string,
  fallbackScheme: AcademicGradeScheme,
) {
  return (payload.academicGrades ?? []).map((grade) =>
    mapTeacherApiAcademicGradeToEntry(grade, kelasId, fallbackScheme),
  );
}

function mapTeacherApiTaskSubmissionToListItem(
  submission: TeacherTaskSubmissionApiItem,
): TaskSubmissionListItem {
  return {
    id:
      normalizeText(submission.id) ||
      normalizeText(submission.submissionId) ||
      `submission-${Date.now()}`,
    submissionId:
      normalizeText(submission.submissionId) ||
      normalizeText(submission.id) ||
      `submission-${Date.now()}`,
    studentId: normalizeText(submission.studentId),
    studentName:
      normalizeText(submission.studentName) || "Nama siswa belum diatur",
    submissionMode: submission.submissionMode ?? "text",
    submittedAt: normalizeText(submission.submittedAt) || null,
    hasAttachment: Boolean(submission.hasAttachment),
    driveUrl: normalizeText(submission.driveUrl),
    answerTextPreview: normalizeText(submission.answerTextPreview),
    gradeStatus: toTaskGradeStatus(submission.gradeStatus),
    score:
      typeof submission.score === "number" && Number.isFinite(submission.score)
        ? submission.score
        : null,
  };
}

function mapTeacherApiTaskSubmissionToDetail(
  submission: TeacherTaskSubmissionApiItem,
  classId: string,
  taskId: string,
): TaskSubmissionDetail {
  const listItem = mapTeacherApiTaskSubmissionToListItem(submission);

  return {
    ...listItem,
    classId: normalizeText(submission.classId) || classId,
    taskId: normalizeText(submission.taskId) || taskId,
    answerText: normalizeText(submission.answerText),
    note: normalizeText(submission.note),
    attachmentFileName: normalizeText(submission.attachment?.fileName) || undefined,
    attachmentOriginalName:
      normalizeText(submission.attachment?.originalName) || undefined,
    attachmentMimeType:
      normalizeText(submission.attachment?.mimeType) || undefined,
    attachmentSize: Math.max(toSafeNumber(submission.attachment?.size), 0),
    attachmentUrl: normalizeText(submission.attachment?.fileName)
      ? buildTeacherTaskSubmissionAttachmentUrl(
          normalizeText(submission.classId) || classId,
          normalizeText(submission.taskId) || taskId,
          normalizeText(submission.submissionId) ||
            normalizeText(submission.id),
        )
      : undefined,
    createdAt: normalizeText(submission.createdAt) || null,
    updatedAt: normalizeText(submission.updatedAt) || null,
  };
}

function applyLatestGradesToSubmissionList(
  submissions: TaskSubmissionListItem[],
  gradeEntries: TeacherTaskGradeEntry[],
  taskId: string,
) {
  return submissions.map((submission) => {
    const matchedGrade = gradeEntries.find(
      (grade) =>
        normalizeText(grade.taskId) === normalizeText(taskId) &&
        normalizeText(grade.studentId) === normalizeText(submission.studentId),
    );

    if (!matchedGrade) {
      return submission;
    }

    return {
      ...submission,
      gradeStatus: matchedGrade.status,
      score: matchedGrade.status === "Sudah Dinilai" ? matchedGrade.score : null,
    } satisfies TaskSubmissionListItem;
  });
}

function applyLatestGradeToSubmissionDetail(
  submissionDetail: TaskSubmissionDetail | null,
  gradeEntries: TeacherTaskGradeEntry[],
) {
  if (!submissionDetail) {
    return null;
  }

  const matchedGrade = gradeEntries.find(
    (grade) =>
      normalizeText(grade.taskId) === normalizeText(submissionDetail.taskId) &&
      normalizeText(grade.studentId) === normalizeText(submissionDetail.studentId),
  );

  if (!matchedGrade) {
    return submissionDetail;
  }

  return {
    ...submissionDetail,
    gradeStatus: matchedGrade.status,
    score:
      matchedGrade.status === "Sudah Dinilai" ? matchedGrade.score : null,
  } satisfies TaskSubmissionDetail;
}

function resolveExpectedGradeCount(
  task: TugasPertemuan,
  participantCount: number,
) {
  return task.jumlahMengumpulkan > 0 ? task.jumlahMengumpulkan : participantCount;
}

function applyGradeStatusToTasks(
  taskRows: TugasPertemuan[],
  participants: ClassStudent[],
  gradeEntries: TeacherTaskGradeEntry[],
) {
  return sortTasksByMeeting(
    taskRows.map((task) => {
      const submittedCount = Math.max(task.jumlahMengumpulkan, 0);
      const gradedStudentIds = new Set(
        gradeEntries
          .filter(
            (grade) =>
              normalizeText(grade.taskId) === normalizeText(task.id) &&
              grade.status === "Sudah Dinilai",
          )
          .map((grade) => normalizeText(grade.studentId).toLowerCase()),
      );
      const expectedGradeCount =
        submittedCount > 0
          ? submittedCount
          : resolveExpectedGradeCount(task, participants.length);

      return {
        ...task,
        statusPenilaian:
          submittedCount <= 0
            ? "Belum Ada Pengumpulan"
            : expectedGradeCount > 0 && gradedStudentIds.size >= expectedGradeCount
              ? "Sudah Dinilai"
              : "Belum Dinilai",
      } satisfies TugasPertemuan;
    }),
  );
}

function buildNilaiRows(
  participants: ClassStudent[],
  gradeEntries: TeacherTaskGradeEntry[],
  academicGradeEntries: TeacherAcademicGradeEntry[],
) {
  return participants.map((student) => {
    const studentGrades = gradeEntries.filter(
      (grade) =>
        normalizeText(grade.studentId) === normalizeText(student.id) &&
        grade.status === "Sudah Dinilai",
    );
    const tugasScore = studentGrades.length
      ? Math.round(
          studentGrades.reduce((total, grade) => total + grade.score, 0) /
            studentGrades.length,
        )
      : null;
    const academicGrade = academicGradeEntries.find(
      (grade) =>
        normalizeText(grade.studentId) === normalizeText(student.id),
    );

    return {
      studentId: student.id,
      tugas: tugasScore,
      scores: academicGrade?.scores ?? { ...EMPTY_ACADEMIC_SCORES },
      note: academicGrade?.note ?? "",
    } satisfies NilaiSiswa;
  });
}

function createNilaiDraft(
  studentId: string,
  taskId: string,
  nilaiRows: NilaiSiswa[],
  gradeEntries: TeacherTaskGradeEntry[],
  academicGradeEntries: TeacherAcademicGradeEntry[],
): NilaiDraft {
  const currentValue =
    nilaiRows.find((nilai) => nilai.studentId === studentId) ??
    createEmptyNilai(studentId);
  const existingGrade = gradeEntries.find(
    (grade) =>
      normalizeText(grade.studentId) === normalizeText(studentId) &&
      normalizeText(grade.taskId) === normalizeText(taskId),
  );
  const existingAcademicGrade = academicGradeEntries.find(
    (grade) =>
      normalizeText(grade.studentId) === normalizeText(studentId),
  );

  return {
    studentId,
    tugas: existingGrade?.score ?? null,
    scores: existingAcademicGrade?.scores ?? currentValue.scores,
    note: existingAcademicGrade?.note ?? existingGrade?.note ?? "",
  };
}

function mapTeacherDetailToTasks(
  payload: NonNullable<TeacherClassDetailResponse["data"]>,
  kelasId: string,
) {
  return sortTasksByMeeting(
    (payload.tasks ?? []).map((task) => mapTeacherApiTaskToFormItem(task, kelasId)),
  );
}

function buildScheduleLabel(
  nextSchedule: TeacherClassApiNextSchedule,
  schedules: TeacherClassApiScheduleItem[],
) {
  const fallbackSchedule = schedules[0] ?? null;
  const day = normalizeText(nextSchedule?.day) || normalizeText(fallbackSchedule?.day);
  const time =
    normalizeText(nextSchedule?.time) || normalizeText(fallbackSchedule?.time);

  if (!day && !time) {
    return "Jadwal belum diatur";
  }

  if (!day) {
    return `${formatTimeLabel(time)} WIB`;
  }

  if (!time) {
    return day;
  }

  return `${day}, ${formatTimeLabel(time)} WIB`;
}

function buildEmptyClassDetail(
  kelasId: string | null | undefined,
  teacherName: string,
): ClassDetailData {
  return {
    kelasId: normalizeText(kelasId),
    namaKelas: "Detail kelas belum tersedia",
    guru: teacherName,
    jenjang: "SMP",
    tingkat: "Kelas belum diatur",
    mapel: "Mapel belum diatur",
    program: "Cabang belum diatur",
    jadwal: "Jadwal belum diatur",
    ruangan: "Ruangan belum diatur",
    totalSiswa: 0,
    totalPertemuan: 0,
    pertemuanSelesai: 0,
    tugasBelumDinilai: 0,
    aktifMingguIni: false,
    status: "Aktif",
    participants: [],
    meetings: [],
    assignments: [],
    attendanceSessions: [],
  };
}

function mapTeacherDetailToClassData(
  payload: NonNullable<TeacherClassDetailResponse["data"]>,
  teacherName: string,
): ClassDetailData {
  const classItem = payload.class;
  const schedules = payload.schedules ?? [];
  const kelasId = normalizeText(classItem?.id);
  const materialRows = mapTeacherDetailToMaterials(payload, kelasId);
  const taskRows = mapTeacherDetailToTasks(payload, kelasId);
  const attendanceSessions = (payload.attendanceSessions ?? [])
    .map((session, index) => {
      const meetingNumber = Math.max(
        toSafeNumber(session.meetingNumber),
        index + 1,
      );
      const summary = {
        hadir: toSafeNumber(session.summary?.hadir),
        sakit: toSafeNumber(session.summary?.sakit),
        izin: toSafeNumber(session.summary?.izin),
        alpa: toSafeNumber(session.summary?.alpa),
        belumAbsen: toSafeNumber(session.summary?.belumAbsen),
      };

      return {
        sessionId:
          normalizeText(session.sessionId) || `session-${meetingNumber}`,
        meetingNumber,
        meeting:
          normalizeText(session.meetingLabel) || `Pertemuan ${meetingNumber}`,
        date: normalizeText(session.date),
        startTime: normalizeText(session.startTime) || "00:00",
        subject: normalizeText(session.subject) || "Mapel belum diatur",
        room: normalizeText(session.room) || "Ruangan belum diatur",
        status: toAttendanceSessionStatus(session.status),
        summary,
        attendanceSummary: buildAttendanceSummaryLabel(summary),
      } satisfies ClassAttendanceSession;
    })
    .sort((left, right) => left.meetingNumber - right.meetingNumber);
  const namaKelas = normalizeText(classItem?.className) || "Kelas belum diatur";
  const tingkat = normalizeText(classItem?.level) || inferTingkat(namaKelas);
  const participants = (payload.participants ?? []).map((participant, index) => {
    const participantId =
      normalizeText(participant.studentId) ||
      normalizeText(participant.id) ||
      `student-${index + 1}`;
    const participantClassName =
      normalizeText(participant.className) || namaKelas;
    const participantLevel =
      normalizeText(participant.level) ||
      tingkat ||
      inferTingkat(participantClassName);
    const participantJenjang = inferJenjang(
      participantClassName,
      participantLevel,
    );
    const history = (participant.history ?? [])
      .map((entry, historyIndex) => {
        const meetingNumber = Math.max(
          toSafeNumber(entry.meetingNumber),
          historyIndex + 1,
        );
        const subject = normalizeText(entry.subject) || "Mapel belum diatur";
        const room = normalizeText(entry.room);
        const attendance = toPresenceStatus(entry.status);

        return {
          sessionId:
            normalizeText(entry.sessionId) ||
            `${participantId}-session-${meetingNumber}`,
          meetingNumber,
          meeting:
            normalizeText(entry.meetingLabel) || `Pertemuan ${meetingNumber}`,
          date: normalizeText(entry.date),
          material: buildSessionMaterialLabel(subject, room),
          attendance,
          note:
            normalizeText(entry.note) ||
            (attendance === "Belum Absen"
              ? "Belum ada catatan absensi."
              : "-"),
          markedAt: normalizeText(entry.markedAt) || null,
        };
      })
      .sort((left, right) => left.meetingNumber - right.meetingNumber);

    return {
      id: participantId,
      name: normalizeText(participant.name) || "Nama siswa belum diatur",
      classLevel: `${participantJenjang} / ${participantLevel}`,
      branch:
        normalizeText(participant.branch) ||
        normalizeText(classItem?.branch) ||
        "Cabang belum diatur",
      status: toParticipantStatus(participant.status),
      history,
      scores: {
        tugas: 0,
        uts: 0,
        uas: 0,
      },
    } satisfies ClassStudent;
  });
  const totalSiswa = Math.max(
    toSafeNumber(classItem?.studentCount),
    participants.length,
  );
  const configuredTotalPertemuan = DEFAULT_SEMESTER_MEETING_TARGET;

  return {
    kelasId,
    namaKelas,
    guru: teacherName,
    jenjang: inferJenjang(namaKelas, tingkat),
    tingkat,
    mapel: normalizeText(classItem?.subject) || "Mapel belum diatur",
    program: normalizeText(classItem?.branch) || "Cabang belum diatur",
    jadwal: buildScheduleLabel(classItem?.nextSchedule ?? null, schedules),
    ruangan:
      normalizeText(classItem?.room) ||
      normalizeText(classItem?.nextSchedule?.room) ||
      normalizeText(schedules[0]?.room) ||
      "Ruangan belum diatur",
    totalSiswa,
    totalPertemuan: configuredTotalPertemuan,
    pertemuanSelesai: attendanceSessions.filter(
      (session) => session.status === "Ditutup",
    ).length,
    tugasBelumDinilai: taskRows.filter(
      (task) => task.statusPenilaian === "Belum Dinilai",
    ).length,
    aktifMingguIni:
      Boolean(classItem?.nextSchedule) ||
      attendanceSessions.some((session) => session.status === "Berlangsung"),
    status: toClassStatus(classItem?.status),
    participants,
    meetings: materialRows.map((material) => ({
      id: material.id,
      meeting: `Pertemuan ${material.pertemuanKe}`,
      date: material.tanggal,
      material: material.judulMateri,
      focus: material.deskripsi,
      attendanceSummary: "",
      note: normalizeText(material.linkMateri),
    })),
    assignments: taskRows.map((task) => ({
      id: task.id,
      meeting: `Pertemuan ${task.pertemuanKe}`,
      title: task.judulTugas,
      deadline: task.deadline,
      submittedCount: task.jumlahMengumpulkan,
      totalStudents: totalSiswa,
      pendingReviewCount:
        task.statusPenilaian === "Belum Dinilai"
          ? Math.max(totalSiswa - task.jumlahMengumpulkan, 0)
          : 0,
      reviewStatus:
        task.statusPenilaian === "Sudah Dinilai"
          ? "Selesai"
          : "Belum Dinilai",
      teacherNote: task.deskripsi,
    })),
    attendanceSessions,
  };
}

function getClassStatusClass(status: ClassStatus) {
  if (status === "Aktif") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "Berjalan") {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function StatePanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="overflow-hidden border border-orange-100 bg-white shadow-[0_24px_56px_-40px_rgba(15,23,42,0.28)]">
      <div className="bg-gradient-to-r from-orange-50 via-white to-amber-50 px-5 py-6 md:px-7">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center border border-orange-100 bg-orange-50 text-orange-500">
            <AlertCircle className="h-5 w-5" />
          </div>
          <h1 className="mt-4 text-xl font-semibold text-slate-800 md:text-2xl">
            {title}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500 md:text-base">
            {description}
          </p>
        </div>
      </div>
    </section>
  );
}

function SummaryMetric({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper: string;
}) {
  return (
    <div className="border border-orange-100 bg-white p-4 shadow-[0_16px_34px_-30px_rgba(249,115,22,0.35)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-slate-800">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </div>
  );
}

function SectionBadge({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center border px-2.5 py-1 text-xs font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

export default function DetailKelasGuruSection({
  kelasId,
}: DetailKelasGuruSectionProps) {
  const searchParams = useSearchParams();
  const [teacherName, setTeacherName] = useState(
    () => readPersistedAuthUser()?.nama ?? "Guru login",
  );
  const emptyClassDetail = useMemo(
    () => buildEmptyClassDetail(kelasId, teacherName),
    [kelasId, teacherName],
  );
  const [realClassDetail, setRealClassDetail] = useState<ClassDetailData | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const activeClass = useMemo(
    () =>
      realClassDetail
        ? {
            ...realClassDetail,
            guru: teacherName,
          }
        : emptyClassDetail,
    [emptyClassDetail, realClassDetail, teacherName],
  );
  const defaultStudentId = activeClass.participants[0]?.id ?? "";
  const academicScheme = useMemo(
    () => getAcademicGradeScheme(`${activeClass.namaKelas} ${activeClass.tingkat}`),
    [activeClass.namaKelas, activeClass.tingkat],
  );

  const [activeSection, setActiveSection] = useState<DetailSection>("peserta");
  const [materials, setMaterials] = useState<MateriPertemuan[]>([]);
  const [tasks, setTasks] = useState<TugasPertemuan[]>([]);
  const [gradeEntries, setGradeEntries] = useState<TeacherTaskGradeEntry[]>([]);
  const [academicGradeEntries, setAcademicGradeEntries] = useState<
    TeacherAcademicGradeEntry[]
  >([]);
  const [nilaiRows, setNilaiRows] = useState<NilaiSiswa[]>([]);

  const [isMateriDialogOpen, setIsMateriDialogOpen] = useState(false);
  const [materiMode, setMateriMode] = useState<DialogMode>("add");
  const [materiDraft, setMateriDraft] = useState<MateriPertemuan | null>(null);
  const [materiAttachmentFile, setMateriAttachmentFile] = useState<File | null>(
    null,
  );
  const [materiAttachmentMarkedForRemoval, setMateriAttachmentMarkedForRemoval] =
    useState(false);

  const [isTugasDialogOpen, setIsTugasDialogOpen] = useState(false);
  const [tugasMode, setTugasMode] = useState<DialogMode>("add");
  const [tugasDraft, setTugasDraft] = useState<TugasPertemuan | null>(null);
  const [tugasAttachmentFile, setTugasAttachmentFile] = useState<File | null>(
    null,
  );
  const [tugasAttachmentMarkedForRemoval, setTugasAttachmentMarkedForRemoval] =
    useState(false);

  const [isNilaiDialogOpen, setIsNilaiDialogOpen] = useState(false);
  const [nilaiMode, setNilaiMode] = useState<DialogMode>("edit");
  const [nilaiDraft, setNilaiDraft] = useState<NilaiDraft | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState(defaultStudentId);
  const [selectedTaskForScore, setSelectedTaskForScore] =
    useState<TugasPertemuan | null>(null);
  const [isTaskSubmissionDialogOpen, setIsTaskSubmissionDialogOpen] =
    useState(false);
  const [selectedTaskForSubmissions, setSelectedTaskForSubmissions] =
    useState<TugasPertemuan | null>(null);
  const [taskSubmissionRows, setTaskSubmissionRows] = useState<
    TaskSubmissionListItem[]
  >([]);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState("");
  const [selectedSubmissionDetail, setSelectedSubmissionDetail] =
    useState<TaskSubmissionDetail | null>(null);
  const [isTaskSubmissionListLoading, setIsTaskSubmissionListLoading] =
    useState(false);
  const [isTaskSubmissionDetailLoading, setIsTaskSubmissionDetailLoading] =
    useState(false);
  const [isMeetingTargetEditing, setIsMeetingTargetEditing] = useState(false);
  const [isSavingMeetingTarget, setIsSavingMeetingTarget] = useState(false);
  const [meetingTargetDraft, setMeetingTargetDraft] = useState("");

  useEffect(() => {
    function handleAuthUserUpdated() {
      setTeacherName(readPersistedAuthUser()?.nama ?? "Guru login");
    }

    window.addEventListener(AUTH_USER_UPDATED_EVENT, handleAuthUserUpdated);

    return () => {
      window.removeEventListener(AUTH_USER_UPDATED_EVENT, handleAuthUserUpdated);
    };
  }, []);

  async function saveMaterialRequest(
    draft: MateriPertemuan,
    mode: DialogMode,
  ) {
    const normalizedClassId = normalizeText(activeClass.kelasId);

    if (!normalizedClassId) {
      throw new Error(DETAIL_CLASS_ERROR_MESSAGE);
    }

    const endpoint =
      mode === "add"
        ? `/api/teacher/me/classes/${encodeURIComponent(normalizedClassId)}/materials`
        : `/api/teacher/me/classes/${encodeURIComponent(normalizedClassId)}/materials/${encodeURIComponent(draft.id)}`;
    const body: Record<string, string | number | boolean> = {
      meetingNumber: draft.pertemuanKe,
      date: draft.tanggal,
      title: draft.judulMateri,
      description: draft.deskripsi,
      linkUrl: normalizeText(draft.linkMateri),
      status: draft.statusMateri,
    };

    if (materiAttachmentFile) {
      body.attachmentFileName = materiAttachmentFile.name;
      body.attachmentMimeType =
        normalizeText(materiAttachmentFile.type) || "application/octet-stream";
      body.attachmentFileDataBase64 = await readFileAsBase64(
        materiAttachmentFile,
      );
    } else if (materiAttachmentMarkedForRemoval) {
      body.removeAttachment = true;
    }

    const response = await fetch(buildGuruApiUrl(endpoint, searchParams), {
      method: mode === "add" ? "POST" : "PATCH",
      credentials: "include",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => null)) as
      | TeacherClassMaterialMutationResponse
      | null;

    if (response.status === 401) {
      clearAuthClientState();
      throw new Error("Sesi login berakhir. Silakan login ulang.");
    }

    if (!response.ok || !payload?.success || !payload.data?.material) {
      throw new Error(payload?.message || "Materi kelas belum bisa disimpan.");
    }

    return mapTeacherApiMaterialToFormItem(
      payload.data.material,
      normalizedClassId,
    );
  }

  async function saveTaskRequest(
    draft: TugasPertemuan,
    mode: DialogMode,
  ) {
    const normalizedClassId = normalizeText(activeClass.kelasId);

    if (!normalizedClassId) {
      throw new Error(DETAIL_CLASS_ERROR_MESSAGE);
    }

    const endpoint =
      mode === "add"
        ? `/api/teacher/me/classes/${encodeURIComponent(normalizedClassId)}/tasks`
        : `/api/teacher/me/classes/${encodeURIComponent(normalizedClassId)}/tasks/${encodeURIComponent(draft.id)}`;
    const body: Record<string, string | number | boolean> = {
      meetingNumber: draft.pertemuanKe,
      title: draft.judulTugas,
      description: draft.deskripsi,
      deadline: draft.deadline,
    };

    if (tugasAttachmentFile) {
      body.attachmentFileName = tugasAttachmentFile.name;
      body.attachmentMimeType =
        normalizeText(tugasAttachmentFile.type) || "application/octet-stream";
      body.attachmentFileDataBase64 = await readFileAsBase64(tugasAttachmentFile);
    } else if (tugasAttachmentMarkedForRemoval) {
      body.removeAttachment = true;
    }

    const response = await fetch(buildGuruApiUrl(endpoint, searchParams), {
      method: mode === "add" ? "POST" : "PATCH",
      credentials: "include",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => null)) as
      | TeacherClassTaskMutationResponse
      | null;

    if (response.status === 401) {
      clearAuthClientState();
      throw new Error("Sesi login berakhir. Silakan login ulang.");
    }

    if (!response.ok || !payload?.success || !payload.data?.task) {
      throw new Error(payload?.message || "Latihan kelas belum bisa disimpan.");
    }

    return mapTeacherApiTaskToFormItem(payload.data.task, normalizedClassId);
  }

  async function deleteMaterialRequest(materialId: string) {
    const normalizedClassId = normalizeText(activeClass.kelasId);

    if (!normalizedClassId) {
      throw new Error(DETAIL_CLASS_ERROR_MESSAGE);
    }

    const response = await fetch(
      buildGuruApiUrl(`/api/teacher/me/classes/${encodeURIComponent(normalizedClassId)}/materials/${encodeURIComponent(materialId)}`, searchParams),
      {
        method: "DELETE",
        credentials: "include",
        cache: "no-store",
      },
    );
    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; message?: string }
      | null;

    if (response.status === 401) {
      clearAuthClientState();
      throw new Error("Sesi login berakhir. Silakan login ulang.");
    }

    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.message || "Materi kelas belum bisa dihapus.");
    }
  }

  async function deleteTaskRequest(taskId: string) {
    const normalizedClassId = normalizeText(activeClass.kelasId);

    if (!normalizedClassId) {
      throw new Error(DETAIL_CLASS_ERROR_MESSAGE);
    }

    const response = await fetch(
      buildGuruApiUrl(`/api/teacher/me/classes/${encodeURIComponent(normalizedClassId)}/tasks/${encodeURIComponent(taskId)}`, searchParams),
      {
        method: "DELETE",
        credentials: "include",
        cache: "no-store",
      },
    );
    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; message?: string }
      | null;

    if (response.status === 401) {
      clearAuthClientState();
      throw new Error("Sesi login berakhir. Silakan login ulang.");
    }

    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.message || "Latihan kelas belum bisa dihapus.");
    }
  }

  async function saveGradeRequest(
    draft: NilaiDraft,
    task: TugasPertemuan,
  ) {
    const normalizedClassId = normalizeText(activeClass.kelasId);
    const normalizedTaskId = normalizeText(task.id);
    const normalizedStudentId = normalizeText(draft.studentId);

    if (!normalizedClassId) {
      throw new Error(DETAIL_CLASS_ERROR_MESSAGE);
    }

    if (!normalizedTaskId) {
      throw new Error("Latihan untuk penilaian belum dipilih.");
    }

    if (!normalizedStudentId) {
      throw new Error("Siswa untuk penilaian belum dipilih.");
    }

    const existingGrade = gradeEntries.find(
      (grade) =>
        normalizeText(grade.taskId) === normalizedTaskId &&
        normalizeText(grade.studentId) === normalizedStudentId,
    );
    const endpoint = existingGrade
      ? `/api/teacher/me/classes/${encodeURIComponent(normalizedClassId)}/grades/${encodeURIComponent(existingGrade.id)}`
      : `/api/teacher/me/classes/${encodeURIComponent(normalizedClassId)}/grades`;
    const response = await fetch(buildGuruApiUrl(endpoint, searchParams), {
      method: existingGrade ? "PATCH" : "POST",
      credentials: "include",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        taskId: normalizedTaskId,
        studentId: normalizedStudentId,
        score: draft.tugas,
        note: normalizeText(draft.note),
        status: "Sudah Dinilai",
      }),
    });
    const payload = (await response.json().catch(() => null)) as
      | TeacherClassGradeMutationResponse
      | null;

    if (response.status === 401) {
      clearAuthClientState();
      throw new Error("Sesi login berakhir. Silakan login ulang.");
    }

    if (!response.ok || !payload?.success || !payload.data?.grade) {
      throw new Error(payload?.message || "Nilai latihan belum bisa disimpan.");
    }

    return mapTeacherApiGradeToEntry(payload.data.grade, normalizedClassId);
  }

  async function saveAcademicGradeRequest(draft: NilaiDraft) {
    const normalizedClassId = normalizeText(activeClass.kelasId);
    const normalizedStudentId = normalizeText(draft.studentId);

    if (!normalizedClassId || !normalizedStudentId) {
      throw new Error("Kelas atau siswa untuk penilaian belum dipilih.");
    }

    const response = await fetch(
      buildGuruApiUrl(`/api/teacher/me/classes/${encodeURIComponent(normalizedClassId)}/academic-grades/${encodeURIComponent(normalizedStudentId)}`, searchParams),
      {
        method: "PUT",
        credentials: "include",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scores: draft.scores,
          note: normalizeText(draft.note),
        }),
      },
    );
    const payload = (await response.json().catch(() => null)) as
      | TeacherClassAcademicGradeMutationResponse
      | null;

    if (response.status === 401) {
      clearAuthClientState();
      throw new Error("Sesi login berakhir. Silakan login ulang.");
    }

    if (!response.ok || !payload?.success) {
      throw new Error(payload?.message || "Nilai evaluasi belum bisa disimpan.");
    }

    return payload.data?.academicGrade
      ? mapTeacherApiAcademicGradeToEntry(
          payload.data.academicGrade,
          normalizedClassId,
          academicScheme,
        )
      : null;
  }

  async function saveMeetingTargetRequest(targetMeetingCount: number) {
    const normalizedClassId = normalizeText(activeClass.kelasId);

    if (!normalizedClassId) {
      throw new Error(DETAIL_CLASS_ERROR_MESSAGE);
    }

    const response = await fetch(
      buildGuruApiUrl(`/api/teacher/me/classes/${encodeURIComponent(normalizedClassId)}/settings`, searchParams),
      {
        method: "PATCH",
        credentials: "include",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetMeetingCount,
        }),
      },
    );
    const payload = (await response.json().catch(() => null)) as
      | TeacherClassSettingMutationResponse
      | null;

    if (response.status === 401) {
      clearAuthClientState();
      throw new Error("Sesi login berakhir. Silakan login ulang.");
    }

    const savedTargetMeetingCount = toSafeNumber(
      payload?.data?.classSetting?.targetMeetingCount,
    );

    if (!response.ok || !payload?.success || savedTargetMeetingCount < 1) {
      throw new Error(
        payload?.message || "Target total pertemuan belum bisa disimpan.",
      );
    }

    return savedTargetMeetingCount;
  }

  async function loadTaskSubmissionsRequest(task: TugasPertemuan) {
    const normalizedClassId = normalizeText(activeClass.kelasId);
    const normalizedTaskId = normalizeText(task.id);

    if (!normalizedClassId) {
      throw new Error(DETAIL_CLASS_ERROR_MESSAGE);
    }

    if (!normalizedTaskId) {
      throw new Error("Latihan kelas tidak ditemukan.");
    }

    const response = await fetch(
      buildGuruApiUrl(`/api/teacher/me/classes/${encodeURIComponent(normalizedClassId)}/tasks/${encodeURIComponent(normalizedTaskId)}/submissions`, searchParams),
      {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      },
    );
    const payload = (await response.json().catch(() => null)) as
      | TeacherTaskSubmissionListResponse
      | null;

    if (response.status === 401) {
      clearAuthClientState();
      throw new Error("Sesi login berakhir. Silakan login ulang.");
    }

    if (!response.ok || !payload?.success) {
      throw new Error(
        payload?.message || "Daftar submission latihan belum bisa diambil.",
      );
    }

    const submissionRows = (payload.data?.submissions ?? []).map((submission) =>
      mapTeacherApiTaskSubmissionToListItem(submission),
    );

    return {
      submissions: submissionRows,
      submittedCount: Math.max(
        toSafeNumber(payload.data?.summary?.submittedCount),
        submissionRows.length,
      ),
    };
  }

  async function loadTaskSubmissionDetailRequest(
    task: TugasPertemuan,
    submissionId: string,
  ) {
    const normalizedClassId = normalizeText(activeClass.kelasId);
    const normalizedTaskId = normalizeText(task.id);
    const normalizedSubmissionId = normalizeText(submissionId);

    if (!normalizedClassId) {
      throw new Error(DETAIL_CLASS_ERROR_MESSAGE);
    }

    if (!normalizedTaskId || !normalizedSubmissionId) {
      throw new Error("Submission latihan tidak ditemukan.");
    }

    const response = await fetch(
      buildGuruApiUrl(`/api/teacher/me/classes/${encodeURIComponent(normalizedClassId)}/tasks/${encodeURIComponent(normalizedTaskId)}/submissions/${encodeURIComponent(normalizedSubmissionId)}`, searchParams),
      {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      },
    );
    const payload = (await response.json().catch(() => null)) as
      | TeacherTaskSubmissionDetailResponse
      | null;

    if (response.status === 401) {
      clearAuthClientState();
      throw new Error("Sesi login berakhir. Silakan login ulang.");
    }

    if (!response.ok || !payload?.success || !payload.data?.submission) {
      throw new Error(
        payload?.message || "Detail submission latihan belum bisa diambil.",
      );
    }

    return mapTeacherApiTaskSubmissionToDetail(
      payload.data.submission,
      normalizedClassId,
      normalizedTaskId,
    );
  }

  const loadTeacherClassDetail = useEffectEvent(async () => {
    setIsLoading(true);
    setLoadError(null);
    setRealClassDetail(null);

    const normalizedClassId = normalizeText(kelasId);

    if (!normalizedClassId) {
      setLoadError(DETAIL_CLASS_ERROR_MESSAGE);
      setIsLoading(false);
      return;
    }

    try {
      const [detailResponse, gradesResponse] = await Promise.all([
        fetch(buildGuruApiUrl(`/api/teacher/me/classes/${encodeURIComponent(normalizedClassId)}`, searchParams), {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        }),
        fetch(
          buildGuruApiUrl(`/api/teacher/me/classes/${encodeURIComponent(normalizedClassId)}/grades`, searchParams),
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          },
        ),
      ]);
      const detailPayload = (await detailResponse.json().catch(() => null)) as
        | TeacherClassDetailResponse
        | null;
      const gradesPayload = (await gradesResponse.json().catch(() => null)) as
        | TeacherClassGradesResponse
        | null;

      if (detailResponse.status === 401 || gradesResponse.status === 401) {
        clearAuthClientState();
        setLoadError(DETAIL_CLASS_ERROR_MESSAGE);
        return;
      }

      if (
        !detailResponse.ok ||
        !detailPayload?.success ||
        !detailPayload.data?.class
      ) {
        console.error("[detail-kelas-guru] class_detail_request_failed", {
          detailStatus: detailResponse.status,
          kelasId: normalizedClassId,
          message: detailPayload?.message ?? "unknown_error",
        });
        setLoadError(DETAIL_CLASS_ERROR_MESSAGE);
        return;
      }

      if (!gradesResponse.ok || !gradesPayload?.success) {
        console.warn("[detail-kelas-guru] grades_request_failed", {
          gradesStatus: gradesResponse.status,
          kelasId: normalizedClassId,
          message: gradesPayload?.message ?? "unknown_error",
        });
      }

      const nextClassDetail = mapTeacherDetailToClassData(
        detailPayload.data,
        teacherName,
      );
      const nextMaterials = mapTeacherDetailToMaterials(
        detailPayload.data,
        nextClassDetail.kelasId,
      );
      const nextTasks = mapTeacherDetailToTasks(
        detailPayload.data,
        nextClassDetail.kelasId,
      );
      const nextGradeEntries = mapTeacherGradesToEntries(
        gradesPayload?.data ?? {},
        nextClassDetail.kelasId,
      );
      const nextAcademicScheme =
        gradesPayload?.data?.scheme ??
        getAcademicGradeScheme(
          `${nextClassDetail.namaKelas} ${nextClassDetail.tingkat}`,
        );
      const nextAcademicGradeEntries = mapTeacherAcademicGradesToEntries(
        gradesPayload?.data ?? {},
        nextClassDetail.kelasId,
        nextAcademicScheme,
      );
      const nextNilaiRows = buildNilaiRows(
        nextClassDetail.participants,
        nextGradeEntries,
        nextAcademicGradeEntries,
      );

      setRealClassDetail(nextClassDetail);
      setMaterials(nextMaterials);
      setTasks(nextTasks);
      setGradeEntries(nextGradeEntries);
      setAcademicGradeEntries(nextAcademicGradeEntries);
      setNilaiRows(nextNilaiRows);
    } catch (error) {
      console.error("[detail-kelas-guru] load_class_detail_failed", {
        error,
        kelasId: normalizedClassId,
      });
      setLoadError(DETAIL_CLASS_ERROR_MESSAGE);
    } finally {
      setIsLoading(false);
    }
  });

  useEffect(() => {
    setActiveSection("peserta");
    setMaterials([]);
    setTasks([]);
    setGradeEntries([]);
    setAcademicGradeEntries([]);
    setNilaiRows([]);
    setSelectedStudentId("");
    setSelectedTaskForScore(null);
    setIsTaskSubmissionDialogOpen(false);
    setSelectedTaskForSubmissions(null);
    setTaskSubmissionRows([]);
    setSelectedSubmissionId("");
    setSelectedSubmissionDetail(null);
    setIsTaskSubmissionListLoading(false);
    setIsTaskSubmissionDetailLoading(false);
    setIsMeetingTargetEditing(false);
    setIsSavingMeetingTarget(false);
    setMeetingTargetDraft("");

    queueMicrotask(() => {
      void loadTeacherClassDetail();
    });
  }, [kelasId, searchParams]);

  useEffect(() => {
    setSelectedStudentId(activeClass.participants[0]?.id ?? "");
  }, [activeClass.participants]);

  useEffect(() => {
    if (!isMeetingTargetEditing) {
      setMeetingTargetDraft(
        activeClass.totalPertemuan > 0 ? String(activeClass.totalPertemuan) : "",
      );
    }
  }, [activeClass.totalPertemuan, isMeetingTargetEditing]);

  const tasksWithGradeStatus = useMemo(
    () => applyGradeStatusToTasks(tasks, activeClass.participants, gradeEntries),
    [activeClass.participants, gradeEntries, tasks],
  );
  const defaultTaskForScore = useMemo(
    () =>
      tasksWithGradeStatus.find(
        (task) => task.statusPenilaian === "Belum Dinilai",
      ) ??
      tasksWithGradeStatus[0] ??
      null,
    [tasksWithGradeStatus],
  );
  const pendingTasks = useMemo(
    () =>
      tasksWithGradeStatus.filter(
        (task) => task.statusPenilaian === "Belum Dinilai",
      ),
    [tasksWithGradeStatus],
  );
  const taskSubmissionsWithLatestGrades = useMemo(
    () =>
      selectedTaskForSubmissions
        ? applyLatestGradesToSubmissionList(
            taskSubmissionRows,
            gradeEntries,
            selectedTaskForSubmissions.id,
          )
        : taskSubmissionRows,
    [gradeEntries, selectedTaskForSubmissions, taskSubmissionRows],
  );
  const selectedTaskSubmissionDetail = useMemo(
    () => applyLatestGradeToSubmissionDetail(selectedSubmissionDetail, gradeEntries),
    [gradeEntries, selectedSubmissionDetail],
  );

  function openMeetingTargetEditor() {
    setMeetingTargetDraft(
      activeClass.totalPertemuan > 0 ? String(activeClass.totalPertemuan) : "",
    );
    setIsMeetingTargetEditing(true);
  }

  function cancelMeetingTargetEditor() {
    setMeetingTargetDraft(
      activeClass.totalPertemuan > 0 ? String(activeClass.totalPertemuan) : "",
    );
    setIsMeetingTargetEditing(false);
  }

  async function handleSaveMeetingTarget() {
    const normalizedTarget = Number.parseInt(
      normalizeText(meetingTargetDraft),
      10,
    );

    if (!Number.isInteger(normalizedTarget) || normalizedTarget < 1) {
      window.alert("Target total pertemuan wajib berupa angka bulat minimal 1.");
      return;
    }

    try {
      setIsSavingMeetingTarget(true);
      const savedTargetMeetingCount = await saveMeetingTargetRequest(
        normalizedTarget,
      );

      setRealClassDetail((current) =>
        current
          ? {
              ...current,
              totalPertemuan: savedTargetMeetingCount,
            }
          : current,
      );
      setMeetingTargetDraft(String(savedTargetMeetingCount));
      setIsMeetingTargetEditing(false);
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Target total pertemuan belum bisa disimpan.",
      );
    } finally {
      setIsSavingMeetingTarget(false);
    }
  }

  function handleMateriDialogOpenChange(open: boolean) {
    setIsMateriDialogOpen(open);
    if (!open) {
      setMateriDraft(null);
      setMateriAttachmentFile(null);
      setMateriAttachmentMarkedForRemoval(false);
    }
  }

  function handleTugasDialogOpenChange(open: boolean) {
    setIsTugasDialogOpen(open);
    if (!open) {
      setTugasDraft(null);
      setTugasAttachmentFile(null);
      setTugasAttachmentMarkedForRemoval(false);
    }
  }

  function handleNilaiDialogOpenChange(open: boolean) {
    setIsNilaiDialogOpen(open);
    if (!open) {
      setSelectedTaskForScore(null);
      setNilaiDraft(null);
    }
  }

  function handleTaskSubmissionDialogOpenChange(open: boolean) {
    setIsTaskSubmissionDialogOpen(open);

    if (!open) {
      setSelectedTaskForSubmissions(null);
      setTaskSubmissionRows([]);
      setSelectedSubmissionId("");
      setSelectedSubmissionDetail(null);
      setIsTaskSubmissionListLoading(false);
      setIsTaskSubmissionDetailLoading(false);
    }
  }

  async function handleSelectTaskSubmission(
    submissionId: string,
    taskOverride?: TugasPertemuan | null,
  ) {
    const activeTask = taskOverride ?? selectedTaskForSubmissions;
    const normalizedSubmissionId = normalizeText(submissionId);

    if (!activeTask || !normalizedSubmissionId) {
      return;
    }

    setSelectedSubmissionId(normalizedSubmissionId);
    setIsTaskSubmissionDetailLoading(true);

    try {
      const submissionDetail = await loadTaskSubmissionDetailRequest(
        activeTask,
        normalizedSubmissionId,
      );

      setSelectedSubmissionDetail(submissionDetail);
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Detail submission latihan belum bisa diambil.",
      );
    } finally {
      setIsTaskSubmissionDetailLoading(false);
    }
  }

  async function openTaskSubmissionDialog(task: TugasPertemuan) {
    setSelectedTaskForSubmissions(task);
    setTaskSubmissionRows([]);
    setSelectedSubmissionId("");
    setSelectedSubmissionDetail(null);
    setIsTaskSubmissionDialogOpen(true);
    setIsTaskSubmissionListLoading(true);
    setIsTaskSubmissionDetailLoading(false);

    try {
      const { submissions, submittedCount } = await loadTaskSubmissionsRequest(task);
      const normalizedTaskId = normalizeText(task.id);

      setTaskSubmissionRows(submissions);
      setTasks((current) =>
        sortTasksByMeeting(
          current.map((taskItem) =>
            taskItem.id === normalizedTaskId
              ? {
                  ...taskItem,
                  jumlahMengumpulkan: submittedCount,
                }
              : taskItem,
          ),
        ),
      );

      if (submissions[0]?.submissionId) {
        void handleSelectTaskSubmission(submissions[0].submissionId, task);
      }
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Daftar submission latihan belum bisa diambil.",
      );
      handleTaskSubmissionDialogOpenChange(false);
    } finally {
      setIsTaskSubmissionListLoading(false);
    }
  }

  function openAddMateriDialog() {
    setMateriMode("add");
    setMateriDraft(
      createEmptyMateri(activeClass.kelasId, Math.max(materials.length + 1, 1)),
    );
    setMateriAttachmentFile(null);
    setMateriAttachmentMarkedForRemoval(false);
    setIsMateriDialogOpen(true);
  }

  function openEditMateriDialog(material: MateriPertemuan) {
    setMateriMode("edit");
    setMateriDraft({ ...material });
    setMateriAttachmentFile(null);
    setMateriAttachmentMarkedForRemoval(false);
    setIsMateriDialogOpen(true);
  }

  function handleMateriDraftChange(
    field: keyof MateriPertemuan,
    value: string | number,
  ) {
    setMateriDraft((current) =>
      current
        ? {
            ...current,
            [field]:
              field === "pertemuanKe" ? Number(value) : String(value),
          }
        : current,
    );
  }

  function handleMateriAttachmentChange(file: File | null) {
    if (file && file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      window.alert(`Ukuran lampiran materi maksimal ${ATTACHMENT_LIMIT_LABEL}.`);
      return;
    }

    setMateriAttachmentFile(file);
    if (file) {
      setMateriAttachmentMarkedForRemoval(false);
    }
  }

  function handleClearSelectedMateriAttachment() {
    setMateriAttachmentFile(null);
  }

  function handleRemoveExistingMateriAttachment() {
    setMateriAttachmentFile(null);
    setMateriAttachmentMarkedForRemoval(true);
    setMateriDraft((current) =>
      current
        ? {
            ...current,
            attachmentFileName: undefined,
            attachmentMimeType: undefined,
            attachmentSize: undefined,
            attachmentUrl: undefined,
          }
        : current,
    );
  }

  async function handleSaveMateri() {
    if (
      !materiDraft ||
      !materiDraft.tanggal ||
      !materiDraft.judulMateri.trim() ||
      !materiDraft.deskripsi.trim()
    ) {
      window.alert("Lengkapi tanggal, judul materi, dan deskripsi terlebih dahulu.");
      return;
    }

    try {
      const savedMaterial = await saveMaterialRequest(materiDraft, materiMode);

      setMaterials((current) =>
        sortMaterialsByMeeting(
          materiMode === "add"
            ? [...current, savedMaterial]
            : current.map((material) =>
                material.id === materiDraft.id ? savedMaterial : material,
              ),
        ),
      );
      setIsMateriDialogOpen(false);
      setMateriDraft(null);
      setMateriAttachmentFile(null);
      setMateriAttachmentMarkedForRemoval(false);
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Materi kelas belum bisa disimpan.",
      );
    }
  }

  async function handleDeleteMateri(materialId: string) {
    try {
      await deleteMaterialRequest(materialId);
      setMaterials((current) =>
        current.filter((material) => material.id !== materialId),
      );
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Materi kelas belum bisa dihapus.",
      );
    }
  }

  function openAddTugasDialog() {
    setTugasMode("add");
    setTugasDraft(
      createEmptyTugas(activeClass.kelasId, Math.max(tasks.length + 1, 1)),
    );
    setTugasAttachmentFile(null);
    setTugasAttachmentMarkedForRemoval(false);
    setIsTugasDialogOpen(true);
  }

  function openEditTugasDialog(task: TugasPertemuan) {
    setTugasMode("edit");
    setTugasDraft({ ...task });
    setTugasAttachmentFile(null);
    setTugasAttachmentMarkedForRemoval(false);
    setIsTugasDialogOpen(true);
  }

  function handleTugasDraftChange(
    field: keyof TugasPertemuan,
    value: string | number,
  ) {
    setTugasDraft((current) =>
      current
        ? {
            ...current,
            [field]:
              field === "pertemuanKe" || field === "jumlahMengumpulkan"
                ? Number(value)
                : String(value),
          }
        : current,
    );
  }

  function handleTugasAttachmentChange(file: File | null) {
    if (file && file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      window.alert(`Ukuran lampiran latihan maksimal ${ATTACHMENT_LIMIT_LABEL}.`);
      return;
    }

    setTugasAttachmentFile(file);
    if (file) {
      setTugasAttachmentMarkedForRemoval(false);
    }
  }

  function handleClearSelectedTugasAttachment() {
    setTugasAttachmentFile(null);
  }

  function handleRemoveExistingTugasAttachment() {
    setTugasAttachmentFile(null);
    setTugasAttachmentMarkedForRemoval(true);
    setTugasDraft((current) =>
      current
        ? {
            ...current,
            attachmentFileName: undefined,
            attachmentMimeType: undefined,
            attachmentSize: undefined,
            attachmentUrl: undefined,
          }
        : current,
    );
  }

  async function handleSaveTugas() {
    if (
      !tugasDraft ||
      !tugasDraft.deadline ||
      !tugasDraft.judulTugas.trim() ||
      !tugasDraft.deskripsi.trim()
    ) {
      window.alert("Lengkapi judul latihan, deskripsi, dan deadline terlebih dahulu.");
      return;
    }

    try {
      const savedTask = await saveTaskRequest(tugasDraft, tugasMode);

      setTasks((current) =>
        sortTasksByMeeting(
          tugasMode === "add"
            ? [...current, savedTask]
            : current.map((task) =>
                task.id === tugasDraft.id ? savedTask : task,
              ),
        ),
      );
      setIsTugasDialogOpen(false);
      setTugasDraft(null);
      setTugasAttachmentFile(null);
      setTugasAttachmentMarkedForRemoval(false);
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Latihan kelas belum bisa disimpan.",
      );
    }
  }

  async function handleDeleteTugas(taskId: string) {
    try {
      await deleteTaskRequest(taskId);
      setTasks((current) => current.filter((task) => task.id !== taskId));
      if (normalizeText(selectedTaskForSubmissions?.id) === normalizeText(taskId)) {
        handleTaskSubmissionDialogOpenChange(false);
      }
      setGradeEntries((current) => {
        const nextGradeEntries = current.filter(
          (grade) => normalizeText(grade.taskId) !== normalizeText(taskId),
        );

        setNilaiRows(
          buildNilaiRows(
            activeClass.participants,
            nextGradeEntries,
            academicGradeEntries,
          ),
        );
        return nextGradeEntries;
      });
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Latihan kelas belum bisa dihapus.",
      );
    }
  }

  function findDefaultStudentIdForTask(taskId: string) {
    return (
      activeClass.participants.find((participant) => {
        const existingGrade = gradeEntries.find(
          (grade) =>
            normalizeText(grade.taskId) === normalizeText(taskId) &&
            normalizeText(grade.studentId) === normalizeText(participant.id) &&
            grade.status === "Sudah Dinilai",
        );

        return !existingGrade;
      })?.id ?? defaultStudentId
    );
  }

  function openNilaiDialogForStudent(studentId: string) {
    setNilaiMode("edit");
    setSelectedTaskForScore(defaultTaskForScore);
    setSelectedStudentId(studentId);
    setNilaiDraft(
      createNilaiDraft(
        studentId,
        defaultTaskForScore?.id ?? "",
        nilaiRows,
        gradeEntries,
        academicGradeEntries,
      ),
    );
    setIsNilaiDialogOpen(true);
  }

  function openNilaiDialogForTask(task: TugasPertemuan) {
    const nextStudentId = findDefaultStudentIdForTask(task.id);

    if (!nextStudentId) {
      window.alert("Belum ada siswa aktif untuk diberi nilai.");
      return;
    }

    setNilaiMode("edit");
    setSelectedTaskForScore(task);
    setSelectedStudentId(nextStudentId);
    setNilaiDraft(
      createNilaiDraft(
        nextStudentId,
        task.id,
        nilaiRows,
        gradeEntries,
        academicGradeEntries,
      ),
    );
    setIsNilaiDialogOpen(true);
  }

  function handleSelectedStudentChange(studentId: string) {
    const nextTaskId = normalizeText(selectedTaskForScore?.id);

    if (!nextTaskId) {
      setSelectedStudentId(studentId);
      setNilaiDraft(
        createNilaiDraft(
          studentId,
          "",
          nilaiRows,
          gradeEntries,
          academicGradeEntries,
        ),
      );
      return;
    }

    setSelectedStudentId(studentId);
    setNilaiDraft(
      createNilaiDraft(
        studentId,
        nextTaskId,
        nilaiRows,
        gradeEntries,
        academicGradeEntries,
      ),
    );
  }

  function handleSelectedTaskChange(taskId: string) {
    const nextTask =
      tasksWithGradeStatus.find((task) => task.id === taskId) ?? null;

    setSelectedTaskForScore(nextTask);
    setNilaiDraft(
      createNilaiDraft(
        selectedStudentId,
        normalizeText(nextTask?.id),
        nilaiRows,
        gradeEntries,
        academicGradeEntries,
      ),
    );
  }

  function handleNilaiDraftChange(
    field: keyof NilaiDraft,
    value: string | number,
  ) {
    setNilaiDraft((current) =>
      current
        ? {
            ...current,
            [field]:
              field === "studentId" || field === "note"
                ? String(value)
                : field === "tugas"
                  ? toNullableScore(value)
                  : current[field],
          }
        : current,
    );
  }

  function handleAcademicScoreChange(
    field: AcademicScoreKey,
    value: string | number,
  ) {
    setNilaiDraft((current) =>
      current
        ? {
            ...current,
            scores: {
              ...current.scores,
              [field]: toNullableScore(value),
            },
          }
        : current,
    );
  }

  async function handleSaveNilai() {
    if (!nilaiDraft) {
      return;
    }

    try {
      const [savedGrade, savedAcademicGrade] = await Promise.all([
        selectedTaskForScore && nilaiDraft.tugas !== null
          ? saveGradeRequest(nilaiDraft, selectedTaskForScore)
          : Promise.resolve(null),
        saveAcademicGradeRequest(nilaiDraft),
      ]);
      const nextGradeEntries = savedGrade
        ? [
            savedGrade,
            ...gradeEntries.filter((grade) => grade.id !== savedGrade.id),
          ]
        : gradeEntries;
      const otherAcademicGrades = academicGradeEntries.filter(
        (grade) =>
          normalizeText(grade.studentId) !== normalizeText(nilaiDraft.studentId),
      );
      const nextAcademicGradeEntries = savedAcademicGrade
        ? [savedAcademicGrade, ...otherAcademicGrades]
        : otherAcademicGrades;
      const nextNilaiRows = buildNilaiRows(
        activeClass.participants,
        nextGradeEntries,
        nextAcademicGradeEntries,
      );

      setGradeEntries(nextGradeEntries);
      setAcademicGradeEntries(nextAcademicGradeEntries);
      setNilaiRows(nextNilaiRows);
      setIsNilaiDialogOpen(false);
      setSelectedTaskForScore(null);
      setNilaiDraft(null);
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Nilai siswa belum bisa disimpan.",
      );
    }
  }

  function renderActiveSection() {
    switch (activeSection) {
      case "peserta":
        return <PesertaKelasTable activeClass={activeClass} />;
      case "absensi":
        return (
          <AbsensiPertemuanTable
            kelasName={activeClass.namaKelas}
            participants={activeClass.participants}
            sessions={activeClass.attendanceSessions}
          />
        );
      case "pertemuan":
        return (
          <DetailPertemuanTable
            kelasName={activeClass.namaKelas}
            materials={materials}
            totalMeetings={activeClass.totalPertemuan}
            onAdd={openAddMateriDialog}
            onDelete={handleDeleteMateri}
            onEdit={openEditMateriDialog}
          />
        );
      case "tugas":
        return (
          <TugasPertemuanTable
            kelasName={activeClass.namaKelas}
            tasks={tasksWithGradeStatus}
            onAdd={openAddTugasDialog}
            onDelete={handleDeleteTugas}
            onEdit={openEditTugasDialog}

            onViewSubmissions={openTaskSubmissionDialog}
          />
        );
      case "belum-dinilai":
        return (
          <BelumDinilaiTable
            kelasName={activeClass.namaKelas}
            tasks={tasksWithGradeStatus}
            onGradeNow={openNilaiDialogForTask}
          />
        );
      case "nilai":
        return (
          <TabelNilaiTable
            participants={activeClass.participants}
            nilaiRows={nilaiRows}
            onEditNilai={openNilaiDialogForStudent}
            scheme={academicScheme}
          />
        );
      default:
        return <PesertaKelasTable activeClass={activeClass} />;
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto mt-4 w-full max-w-7xl px-4 pb-8 md:mt-6 md:px-6 md:pb-10">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/dashboard-guru/kelas"
              className="inline-flex items-center gap-2 border border-orange-200 bg-white px-4 py-2 text-sm font-medium text-orange-700 shadow-sm shadow-orange-100/70 transition hover:border-orange-300 hover:bg-orange-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Semua Kelas
            </Link>
          </div>

          <StatePanel
            title="Memuat Detail Kelas"
            description="Data kelas guru sedang diambil dari backend. Mohon tunggu sebentar."
          />
        </div>
      </div>
    );
  }

  if (loadError || !realClassDetail) {
    return (
      <div className="mx-auto mt-4 w-full max-w-7xl px-4 pb-8 md:mt-6 md:px-6 md:pb-10">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/dashboard-guru/kelas"
              className="inline-flex items-center gap-2 border border-orange-200 bg-white px-4 py-2 text-sm font-medium text-orange-700 shadow-sm shadow-orange-100/70 transition hover:border-orange-300 hover:bg-orange-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Semua Kelas
            </Link>
          </div>

          <StatePanel
            title="Detail Kelas Tidak Tersedia"
            description={DETAIL_CLASS_ERROR_MESSAGE}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-4 w-full max-w-7xl px-4 pb-8 md:mt-6 md:px-6 md:pb-10">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/dashboard-guru/kelas"
            className="inline-flex items-center gap-2 border border-orange-200 bg-white px-4 py-2 text-sm font-medium text-orange-700 shadow-sm shadow-orange-100/70 transition hover:border-orange-300 hover:bg-orange-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Semua Kelas
          </Link>
        </div>

        <section className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-shadow hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
          <div className="relative overflow-hidden bg-gradient-to-br from-orange-50/80 via-white to-amber-50/40 px-5 py-6 text-slate-900 md:px-7 md:py-7">

            <div className="relative flex flex-col gap-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-4xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/60 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600 shadow-sm">
                      <School className="h-3.5 w-3.5" />
                      Detail Kelas Guru
                    </div>
                    <SectionBadge className="rounded-full bg-orange-50 text-orange-700 border border-orange-100/60">
                      {activeClass.jenjang}
                    </SectionBadge>
                    <SectionBadge className="rounded-full bg-orange-50 text-orange-700 border border-orange-100/60">
                      {activeClass.tingkat}
                    </SectionBadge>
                    <SectionBadge className="rounded-full bg-orange-50 text-orange-700 border border-orange-100/60">
                      <Building2 className="mr-1 h-3.5 w-3.5" />
                      Cabang {activeClass.program}
                    </SectionBadge>
                  </div>

                  <h1 className="mt-4 text-2xl font-bold tracking-tight md:text-3xl">
                    {activeClass.namaKelas}
                  </h1>

                  <p className="mt-2 max-w-2xl text-sm text-slate-500 md:text-base">
                    Peserta, absensi, materi, latihan, dan penilaian latihan siswa
                    sudah terhubung dengan backend kelas guru yang sedang login.
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:flex sm:flex-wrap sm:gap-2.5">
                    <div className="flex min-h-10 items-center gap-2 rounded-xl border border-orange-100/60 bg-white px-3 py-2 text-slate-700 shadow-sm">
                      <Users className="h-4 w-4" />
                      {activeClass.totalSiswa} siswa
                    </div>
                    <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-xl border border-orange-100/60 bg-white px-3 py-2 text-slate-700 shadow-sm">
                      <Clock3 className="h-4 w-4" />
                      {isMeetingTargetEditing ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            inputMode="numeric"
                            min={1}
                            step={1}
                            type="number"
                            value={meetingTargetDraft}
                            onChange={(event) =>
                              setMeetingTargetDraft(event.target.value)
                            }
                            className="w-16 rounded-md border border-slate-300 px-2 py-1 text-xs outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-200"
                          />
                          <button
                            type="button"
                            onClick={() => void handleSaveMeetingTarget()}
                            disabled={isSavingMeetingTarget}
                            className="rounded bg-orange-500 px-2 py-1 text-[10px] font-semibold text-white hover:bg-orange-600 disabled:opacity-70"
                          >
                            Simpan
                          </button>
                          <button
                            type="button"
                            onClick={cancelMeetingTargetEditor}
                            disabled={isSavingMeetingTarget}
                            className="rounded bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-200"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <>
                          Target {activeClass.totalPertemuan} sesi
                          <button
                            type="button"
                            onClick={openMeetingTargetEditor}
                            className="ml-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-200"
                          >
                            Ubah
                          </button>
                        </>
                      )}
                    </div>
                    <div className="col-span-2 flex min-h-10 items-center gap-2 rounded-xl border border-orange-100/60 bg-white px-3 py-2 text-slate-700 shadow-sm">
                      <CalendarDays className="h-4 w-4" />
                      {activeClass.jadwal}
                    </div>
                    <div className="col-span-2 flex min-h-10 items-center gap-2 rounded-xl border border-orange-100/60 bg-white px-3 py-2 text-slate-700 shadow-sm">
                      <MapPin className="h-4 w-4" />
                      {activeClass.ruangan}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <SectionBadge
                    className={`${getClassStatusClass(activeClass.status)}`}
                  >
                    Status {activeClass.status}
                  </SectionBadge>
                  <SectionBadge className="rounded-full bg-orange-50 text-orange-700 border border-orange-100/60">
                    Target {activeClass.totalPertemuan} sesi
                  </SectionBadge>
                  <SectionBadge className="rounded-full bg-orange-50 text-orange-700 border border-orange-100/60">
                    Materi {materials.length}/{activeClass.totalPertemuan}
                  </SectionBadge>
                </div>
              </div>

            </div>
          </div>
          <div className="grid gap-4 border-t border-slate-100 bg-slate-50/50 px-5 py-5 md:grid-cols-4 md:px-7">
            <SummaryMetric
              label="Peserta Aktif"
              value={activeClass.totalSiswa}
              helper="Jumlah siswa yang terdaftar pada kelas ini."
            />
            <SummaryMetric
              label="Materi Aktif"
              value={`${materials.length}/${activeClass.totalPertemuan}`}
              helper="Materi yang sudah tersusun untuk tiap pertemuan."
            />
            <SummaryMetric
              label="Latihan Berjalan"
              value={tasksWithGradeStatus.length}
              helper="Seluruh latihan yang muncul dari pertemuan aktif."
            />
            <SummaryMetric
              label="Belum Dinilai"
              value={pendingTasks.length}
              helper="Latihan yang masih perlu penilaian lanjutan."
            />
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <DetailKelasSidebar
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            sectionItems={DETAIL_SECTION_ITEMS}
          />

          <div
            key={activeSection}
            className="min-w-0 flex-1 transition-all duration-200 ease-out"
          >
            {renderActiveSection()}
          </div>
        </div>
      </div>

      <MateriFormDialog
        attachmentMarkedForRemoval={materiAttachmentMarkedForRemoval}
        draft={materiDraft}
        existingAttachmentName={materiDraft?.attachmentFileName}
        mode={materiMode}
        onAttachmentChange={handleMateriAttachmentChange}
        onChange={handleMateriDraftChange}
        onClearSelectedAttachment={handleClearSelectedMateriAttachment}
        onOpenChange={handleMateriDialogOpenChange}
        onRemoveExistingAttachment={handleRemoveExistingMateriAttachment}
        onSubmit={handleSaveMateri}
        open={isMateriDialogOpen}
        selectedAttachmentName={materiAttachmentFile?.name}
      />

      <TugasFormDialog
        attachmentMarkedForRemoval={tugasAttachmentMarkedForRemoval}
        draft={tugasDraft}
        existingAttachmentName={tugasDraft?.attachmentFileName}
        mode={tugasMode}
        onAttachmentChange={handleTugasAttachmentChange}
        onChange={handleTugasDraftChange}
        onClearSelectedAttachment={handleClearSelectedTugasAttachment}
        onOpenChange={handleTugasDialogOpenChange}
        onRemoveExistingAttachment={handleRemoveExistingTugasAttachment}
        onSubmit={handleSaveTugas}
        open={isTugasDialogOpen}
        selectedAttachmentName={tugasAttachmentFile?.name}
      />

      <TaskSubmissionReviewDialog
        kelasName={activeClass.namaKelas}
        isDetailLoading={isTaskSubmissionDetailLoading}
        isListLoading={isTaskSubmissionListLoading}
        onOpenChange={handleTaskSubmissionDialogOpenChange}
        onSelectSubmission={(submissionId) => {
          void handleSelectTaskSubmission(submissionId);
        }}
        open={isTaskSubmissionDialogOpen}
        selectedSubmissionId={selectedSubmissionId}
        submissionDetail={selectedTaskSubmissionDetail}
        submissions={taskSubmissionsWithLatestGrades}
        task={selectedTaskForSubmissions}
      />

      <NilaiFormDialog
        draft={nilaiDraft}
        mode={nilaiMode}
        onAcademicScoreChange={handleAcademicScoreChange}
        onChange={handleNilaiDraftChange}
        onOpenChange={handleNilaiDialogOpenChange}
        onStudentChange={handleSelectedStudentChange}
        onTaskChange={handleSelectedTaskChange}
        onSubmit={handleSaveNilai}
        open={isNilaiDialogOpen}
        participants={activeClass.participants}
        selectedStudentId={selectedStudentId}
        selectedTask={selectedTaskForScore}
        tasks={tasksWithGradeStatus}
        scheme={academicScheme}
      />
    </div>
  );
}
