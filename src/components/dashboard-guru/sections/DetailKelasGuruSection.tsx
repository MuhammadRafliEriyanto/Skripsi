"use client";
/* eslint-disable react-hooks/set-state-in-effect */

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
  startAt?: string | null;
  endAt?: string | null;
  durationMinutes?: number | null;
  questionCount?: number | null;
  passingGrade?: number | null;
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

type TeacherClassTaskQuestionsUploadResponse = {
  success: boolean;
  message?: string;
  data?: {
    questionCount?: number;
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

import {
  buildGuruApiUrl,
  buildGuruUrl,
} from "@/lib/guru-helpers";
import toast from "react-hot-toast";

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
  status: "Belum Dinilai" | "Sudah Dinilai" | "Perlu Remedial";
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

function isUtbkClassName(value: string | null | undefined) {
  const normalizedValue = normalizeText(value).toUpperCase();

  return (
    normalizedValue === "UTBK" ||
    normalizedValue === "SNBT" ||
    normalizedValue.startsWith("UTBK ") ||
    normalizedValue.startsWith("SNBT ") ||
    normalizedValue.includes("PROGRAM UTBK") ||
    normalizedValue.includes("PROGRAM SNBT")
  );
}

function isUtbkClassDetail(classDetail: Pick<ClassDetailData, "namaKelas" | "tingkat">) {
  return isUtbkClassName(classDetail.namaKelas) || isUtbkClassName(classDetail.tingkat);
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

function isTaskQuestionWorkbook(file: File | null) {
  if (!file) {
    return false;
  }

  const normalizedName = normalizeText(file.name).toLowerCase();
  return normalizedName.endsWith(".xlsx") || normalizedName.endsWith(".xls");
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

function normalizeTimeInput(value: string | null | undefined) {
  const matchedTime = normalizeText(value).match(/(\d{1,2})[.:](\d{2})/);

  if (!matchedTime) {
    return "";
  }

  const hour = Number.parseInt(matchedTime[1], 10);
  const minute = Number.parseInt(matchedTime[2], 10);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return "";
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseTimeRange(value: string | null | undefined) {
  const timeMatches = [...normalizeText(value).matchAll(/(\d{1,2})[.:](\d{2})/g)]
    .map((match) => normalizeTimeInput(match[0]))
    .filter(Boolean);

  if (timeMatches.length < 2) {
    return null;
  }

  return {
    startTime: timeMatches[0],
    endTime: timeMatches[1],
  };
}

function timeToMinutes(value: string | null | undefined) {
  const normalizedTime = normalizeTimeInput(value);
  const [hourText, minuteText] = normalizedTime.split(":");
  const hour = Number.parseInt(hourText, 10);
  const minute = Number.parseInt(minuteText, 10);

  if (!normalizedTime || !Number.isInteger(hour) || !Number.isInteger(minute)) {
    return null;
  }

  return hour * 60 + minute;
}

function getTimeRangeDurationMinutes(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
) {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
    return null;
  }

  return endMinutes - startMinutes;
}

function addMinutesToTime(timeValue: string | null | undefined, minutes: number) {
  const startMinutes = timeToMinutes(timeValue);

  if (startMinutes === null || !Number.isFinite(minutes) || minutes <= 0) {
    return "";
  }

  const totalMinutes = (startMinutes + Math.trunc(minutes)) % (24 * 60);
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatJakartaDateInput(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return "";
  }

  const date = new Date(normalizedValue);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Jakarta",
    year: "numeric",
  }).format(date);
}

function formatJakartaTimeInput(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return "";
  }

  const date = new Date(normalizedValue);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function buildJakartaDateTimeIso(
  dateValue: string | null | undefined,
  timeValue: string | null | undefined,
) {
  const normalizedDate = normalizeText(dateValue);
  const normalizedTime = normalizeTimeInput(timeValue);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate) || !normalizedTime) {
    return "";
  }

  return `${normalizedDate}T${normalizedTime}:00+07:00`;
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

  if (normalizedValue === "perlu remedial") {
    return "Perlu Remedial";
  }

  return "Belum Dinilai";
}

function toTaskGradeStatus(
  value: string | null | undefined,
): TeacherTaskGradeEntry["status"] {
  const normalizedValue = normalizeText(value).toLowerCase();

  if (normalizedValue === "sudah dinilai") {
    return "Sudah Dinilai";
  }

  if (normalizedValue === "perlu remedial") {
    return "Perlu Remedial";
  }

  return "Belum Dinilai";
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
  const startTime = formatJakartaTimeInput(task.startAt);
  const endTime = formatJakartaTimeInput(task.endAt);
  const sessionDuration =
    getTimeRangeDurationMinutes(startTime, endTime) ??
    Math.max(toSafeNumber(task.durationMinutes) || 60, 1);

  return {
    id: taskId,
    kelasId: normalizeText(task.classId) || kelasId,
    pertemuanKe: Math.max(toSafeNumber(task.meetingNumber), 1),
    judulTugas: normalizeText(task.title),
    deskripsi: normalizeText(task.description),
    deadline:
      formatJakartaDateInput(task.startAt) ||
      normalizeText(task.deadline),
    jamMulai: startTime,
    jamSelesai: endTime,
    durasiMenit: sessionDuration,
    jumlahSoal: Math.max(toSafeNumber(task.questionCount), 0),
    nilaiMinimum: Math.min(
      Math.max(toSafeNumber(task.passingGrade) || 70, 1),
      100,
    ),
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
      score:
        matchedGrade.status === "Sudah Dinilai" ||
        matchedGrade.status === "Perlu Remedial"
          ? matchedGrade.score
          : null,
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
      matchedGrade.status === "Sudah Dinilai" ||
      matchedGrade.status === "Perlu Remedial"
        ? matchedGrade.score
        : null,
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
      const taskGrades = gradeEntries.filter(
        (grade) => normalizeText(grade.taskId) === normalizeText(task.id),
      );
      const gradedStudentIds = new Set(
        taskGrades
          .filter(
            (grade) =>
              grade.status === "Sudah Dinilai",
          )
          .map((grade) => normalizeText(grade.studentId).toLowerCase()),
      );
      const hasRemedialStudent = taskGrades.some(
        (grade) => grade.status === "Perlu Remedial",
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
            : hasRemedialStudent
              ? "Perlu Remedial"
            : expectedGradeCount > 0 && gradedStudentIds.size >= expectedGradeCount
              ? "Sudah Dinilai"
              : "Belum Dinilai",
      } satisfies TugasPertemuan;
    }),
  );
}

function buildNilaiRows(
  participants: ClassStudent[],
  taskRows: TugasPertemuan[],
  gradeEntries: TeacherTaskGradeEntry[],
  academicGradeEntries: TeacherAcademicGradeEntry[],
) {
  const taskMeetingMap = new Map(
    taskRows.map((task) => [normalizeText(task.id), task.pertemuanKe]),
  );

  return participants.map((student) => {
    const studentGrades = gradeEntries.filter(
      (grade) =>
        normalizeText(grade.studentId) === normalizeText(student.id) &&
        (grade.status === "Sudah Dinilai" ||
          grade.status === "Perlu Remedial"),
    );
    const pertemuanScoreBuckets = new Map<number, number[]>();
    const pertemuanStatuses: Record<number, TeacherTaskGradeEntry["status"]> = {};

    studentGrades.forEach((grade) => {
      const meetingNumber = taskMeetingMap.get(normalizeText(grade.taskId));

      if (!meetingNumber || meetingNumber < 1) {
        return;
      }

      const currentScores = pertemuanScoreBuckets.get(meetingNumber) ?? [];
      currentScores.push(grade.score);
      pertemuanScoreBuckets.set(meetingNumber, currentScores);

      if (
        grade.status === "Perlu Remedial" ||
        !pertemuanStatuses[meetingNumber]
      ) {
        pertemuanStatuses[meetingNumber] = grade.status;
      }
    });

    const pertemuanScores = Object.fromEntries(
      [...pertemuanScoreBuckets.entries()].map(([meetingNumber, scores]) => [
        meetingNumber,
        scores.length
          ? Math.round(
              scores.reduce((total, score) => total + score, 0) /
                scores.length,
            )
          : null,
      ]),
    ) as Record<number, number | null>;
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
      pertemuanScores,
      pertemuanStatuses,
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
  selectedScheduleId = "",
) {
  const normalizedSelectedScheduleId = normalizeText(selectedScheduleId);
  const selectedSchedule =
    normalizedSelectedScheduleId
      ? schedules.find(
          (schedule) =>
            normalizeText(schedule.scheduleId) === normalizedSelectedScheduleId ||
            normalizeText(schedule.id) === normalizedSelectedScheduleId,
        ) ?? null
      : null;
  const fallbackSchedule = selectedSchedule ?? schedules[0] ?? null;
  const day =
    normalizeText(selectedSchedule?.day) ||
    normalizeText(nextSchedule?.day) ||
    normalizeText(fallbackSchedule?.day);
  const time =
    normalizeText(selectedSchedule?.time) ||
    normalizeText(nextSchedule?.time) ||
    normalizeText(fallbackSchedule?.time);

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

function buildDefaultTaskSchedule(
  activeClass: ClassDetailData,
  materialRows: MateriPertemuan[],
  meetingNumber: number,
) {
  const scheduleTimeRange = parseTimeRange(activeClass.jadwal);
  const matchedSession =
    activeClass.attendanceSessions.find(
      (session) => session.meetingNumber === meetingNumber,
    ) ?? null;
  const matchedMaterial =
    materialRows.find((material) => material.pertemuanKe === meetingNumber) ?? null;
  const startTime =
    normalizeTimeInput(matchedSession?.startTime) ||
    scheduleTimeRange?.startTime ||
    "";
  const endTime =
    scheduleTimeRange?.endTime ||
    addMinutesToTime(startTime, 90);
  const durationMinutes =
    getTimeRangeDurationMinutes(startTime, endTime) ?? 90;

  return {
    deadline:
      normalizeText(matchedSession?.date) ||
      normalizeText(matchedMaterial?.tanggal),
    jamMulai: startTime,
    jamSelesai: endTime,
    durasiMenit: durationMinutes,
  };
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
  selectedScheduleId = "",
): ClassDetailData {
  const classItem = payload.class;
  const schedules = payload.schedules ?? [];
  const normalizedSelectedScheduleId = normalizeText(selectedScheduleId);
  const selectedSchedule =
    normalizedSelectedScheduleId
      ? schedules.find(
          (schedule) =>
            normalizeText(schedule.scheduleId) === normalizedSelectedScheduleId ||
            normalizeText(schedule.id) === normalizedSelectedScheduleId,
        ) ?? null
      : null;
  const kelasId = normalizeText(classItem?.id);
  const isUtbkClass =
    isUtbkClassName(classItem?.className) || isUtbkClassName(classItem?.level);
  const materialRows = mapTeacherDetailToMaterials(payload, kelasId);
  const taskRows = isUtbkClass
    ? []
    : mapTeacherDetailToTasks(payload, kelasId);
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
    mapel:
      normalizeText(selectedSchedule?.subject) ||
      normalizeText(classItem?.subject) ||
      "Mapel belum diatur",
    program: normalizeText(classItem?.branch) || "Cabang belum diatur",
    jadwal: buildScheduleLabel(
      classItem?.nextSchedule ?? null,
      schedules,
      normalizedSelectedScheduleId,
    ),
    ruangan:
      normalizeText(selectedSchedule?.room) ||
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
  const archiveMessage = "";
  const isAcademicArchive = false;
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
  const isUtbkClass = useMemo(
    () => isUtbkClassDetail(activeClass),
    [activeClass],
  );
  const visibleDetailSectionItems = useMemo(
    () =>
      isUtbkClass
        ? DETAIL_SECTION_ITEMS.filter(
            (item) =>
              item.key !== "tugas" &&
              item.key !== "belum-dinilai" &&
              item.key !== "nilai",
          )
        : DETAIL_SECTION_ITEMS.filter((item) => item.key !== "belum-dinilai"),
    [isUtbkClass],
  );
  const defaultStudentId = activeClass.participants[0]?.id ?? "";
  const academicScheme = useMemo(
    () =>
      isUtbkClass
        ? "tryout"
        : getAcademicGradeScheme(`${activeClass.namaKelas} ${activeClass.tingkat}`),
    [activeClass.namaKelas, activeClass.tingkat, isUtbkClass],
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
    attachmentFile: File | null = tugasAttachmentFile,
  ) {
    const normalizedClassId = normalizeText(activeClass.kelasId);

    if (!normalizedClassId) {
      throw new Error(DETAIL_CLASS_ERROR_MESSAGE);
    }

    const endpoint =
      mode === "add"
        ? `/api/teacher/me/classes/${encodeURIComponent(normalizedClassId)}/tasks`
        : `/api/teacher/me/classes/${encodeURIComponent(normalizedClassId)}/tasks/${encodeURIComponent(draft.id)}`;
    const sessionDuration =
      getTimeRangeDurationMinutes(draft.jamMulai, draft.jamSelesai) ??
      Math.max(Number(draft.durasiMenit) || 60, 1);
    const body: Record<string, string | number | boolean> = {
      meetingNumber: draft.pertemuanKe,
      title: draft.judulTugas,
      description: draft.deskripsi,
      deadline: draft.deadline,
      startAt: buildJakartaDateTimeIso(draft.deadline, draft.jamMulai),
      endAt: buildJakartaDateTimeIso(draft.deadline, draft.jamSelesai),
      durationMinutes: sessionDuration,
      questionCount: Math.max(Number(draft.jumlahSoal) || 0, 0),
      passingGrade: Math.min(
        Math.max(Number(draft.nilaiMinimum) || 70, 1),
        100,
      ),
    };

    if (attachmentFile) {
      body.attachmentFileName = attachmentFile.name;
      body.attachmentMimeType =
        normalizeText(attachmentFile.type) || "application/octet-stream";
      body.attachmentFileDataBase64 = await readFileAsBase64(attachmentFile);
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

  async function uploadTaskQuestionsRequest(taskId: string, file: File) {
    const normalizedClassId = normalizeText(activeClass.kelasId);
    const normalizedTaskId = normalizeText(taskId);

    if (!normalizedClassId || !normalizedTaskId) {
      throw new Error(DETAIL_CLASS_ERROR_MESSAGE);
    }

    const response = await fetch(
      buildGuruApiUrl(
        `/api/teacher/me/classes/${encodeURIComponent(normalizedClassId)}/tasks/${encodeURIComponent(normalizedTaskId)}`,
        searchParams,
      ),
      {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          attachmentFileName: file.name,
          attachmentFileDataBase64: await readFileAsBase64(file),
        }),
      },
    );
    const payload = (await response.json().catch(() => null)) as
      | TeacherClassTaskQuestionsUploadResponse
      | null;

    if (response.status === 401) {
      clearAuthClientState();
      throw new Error("Sesi login berakhir. Silakan login ulang.");
    }

    if (!response.ok || !payload?.success) {
      throw new Error(payload?.message || "Soal CBT latihan belum bisa diunggah.");
    }

    return Math.max(Number(payload.data?.questionCount) || 0, 0);
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
    const normalizedNote = normalizeText(draft.note);
    const isChangingExistingGrade =
      Boolean(existingGrade) &&
      (existingGrade?.score !== draft.tugas ||
        normalizeText(existingGrade?.status) !== "Sudah Dinilai");

    if (
      isChangingExistingGrade &&
      normalizedNote === normalizeText(existingGrade?.note)
    ) {
      throw new Error(
        "Isi alasan perubahan nilai pada catatan penilaian terlebih dahulu.",
      );
    }

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
        note: normalizedNote,
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
      const selectedScheduleId = normalizeText(searchParams.get("scheduleId"));
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
        selectedScheduleId,
      );
      const nextMaterials = mapTeacherDetailToMaterials(
        detailPayload.data,
        nextClassDetail.kelasId,
      );
      const nextClassIsUtbk = isUtbkClassDetail(nextClassDetail);
      const nextTasks = nextClassIsUtbk
        ? []
        : mapTeacherDetailToTasks(
            detailPayload.data,
            nextClassDetail.kelasId,
          );
      const nextGradeEntries = nextClassIsUtbk
        ? []
        : mapTeacherGradesToEntries(
            gradesPayload?.data ?? {},
            nextClassDetail.kelasId,
          );
      const nextAcademicScheme =
        nextClassIsUtbk
          ? "tryout"
          : gradesPayload?.data?.scheme ??
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
        nextTasks,
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
    if (
      activeSection === "belum-dinilai" ||
      (isUtbkClass && (activeSection === "tugas" || activeSection === "nilai"))
    ) {
      setActiveSection(isUtbkClass ? "pertemuan" : "tugas");
    }
  }, [activeSection, isUtbkClass]);

  useEffect(() => {
    if (!isMeetingTargetEditing) {
      setMeetingTargetDraft(
        activeClass.totalPertemuan > 0 ? String(activeClass.totalPertemuan) : "",
      );
    }
  }, [activeClass.totalPertemuan, isMeetingTargetEditing]);

  useEffect(() => {
    if (!isAcademicArchive) {
      return;
    }

    setIsMeetingTargetEditing(false);
    setIsMateriDialogOpen(false);
    setMateriDraft(null);
    setMateriAttachmentFile(null);
    setMateriAttachmentMarkedForRemoval(false);
    setIsTugasDialogOpen(false);
    setTugasDraft(null);
    setTugasAttachmentFile(null);
    setTugasAttachmentMarkedForRemoval(false);
    setIsNilaiDialogOpen(false);
    setSelectedTaskForScore(null);
    setNilaiDraft(null);
  }, [isAcademicArchive]);

  const classTasks = useMemo(() => (isUtbkClass ? [] : tasks), [
    isUtbkClass,
    tasks,
  ]);
  const tasksWithGradeStatus = useMemo(
    () =>
      applyGradeStatusToTasks(classTasks, activeClass.participants, gradeEntries),
    [activeClass.participants, classTasks, gradeEntries],
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

  function ensureAcademicYearEditable() {
    if (!isAcademicArchive) {
      return true;
    }

    toast.error(archiveMessage);
    return false;
  }

  function ensureClassTaskFlowEnabled() {
    if (!isUtbkClass) {
      return true;
    }

    toast.error("Program UTBK menggunakan materi dan tryout, bukan latihan pertemuan.");
    return false;
  }

  function openMeetingTargetEditor() {
    if (!ensureAcademicYearEditable()) {
      return;
    }

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
    if (!ensureAcademicYearEditable()) {
      return;
    }

    const normalizedTarget = Number.parseInt(
      normalizeText(meetingTargetDraft),
      10,
    );

    if (!Number.isInteger(normalizedTarget) || normalizedTarget < 1) {
      toast.error("Target total pertemuan wajib berupa angka bulat minimal 1.");
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
      toast.error(
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
      toast.error(
        error instanceof Error
          ? error.message
          : "Detail submission latihan belum bisa diambil.",
      );
    } finally {
      setIsTaskSubmissionDetailLoading(false);
    }
  }

  async function openTaskSubmissionDialog(task: TugasPertemuan) {
    if (!ensureClassTaskFlowEnabled()) {
      return;
    }

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
      toast.error(
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
    if (!ensureAcademicYearEditable()) {
      return;
    }

    setMateriMode("add");
    setMateriDraft(
      createEmptyMateri(activeClass.kelasId, Math.max(materials.length + 1, 1)),
    );
    setMateriAttachmentFile(null);
    setMateriAttachmentMarkedForRemoval(false);
    setIsMateriDialogOpen(true);
  }

  function openEditMateriDialog(material: MateriPertemuan) {
    if (!ensureAcademicYearEditable()) {
      return;
    }

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
      toast.error(`Ukuran lampiran materi maksimal ${ATTACHMENT_LIMIT_LABEL}.`);
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
    if (!ensureAcademicYearEditable()) {
      return;
    }

    if (
      !materiDraft ||
      !materiDraft.tanggal ||
      !materiDraft.judulMateri.trim() ||
      !materiDraft.deskripsi.trim()
    ) {
      toast.error("Mohon lengkapi tanggal, judul materi, dan deskripsi terlebih dahulu.");
      return;
    }

    const todayDate = formatJakartaDateInput(new Date().toISOString());
    if (materiDraft.tanggal !== todayDate) {
      toast.error("Anda hanya dapat menyimpan materi pada hari jadwal kelas berlangsung (hari ini).");
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
      toast.error(
        error instanceof Error
          ? error.message
          : "Materi kelas belum bisa disimpan.",
      );
    }
  }

  async function handleDeleteMateri(materialId: string) {
    if (!ensureAcademicYearEditable()) {
      return;
    }

    try {
      await deleteMaterialRequest(materialId);
      setMaterials((current) =>
        current.filter((material) => material.id !== materialId),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Materi kelas belum bisa dihapus.",
      );
    }
  }

  function openAddTugasDialog() {
    if (!ensureAcademicYearEditable() || !ensureClassTaskFlowEnabled()) {
      return;
    }

    const nextMeetingNumber = Math.max(tasks.length + 1, 1);
    setTugasMode("add");
    setTugasDraft(
      createEmptyTugas(
        activeClass.kelasId,
        nextMeetingNumber,
        buildDefaultTaskSchedule(activeClass, materials, nextMeetingNumber),
      ),
    );
    setTugasAttachmentFile(null);
    setTugasAttachmentMarkedForRemoval(false);
    setIsTugasDialogOpen(true);
  }

  function openEditTugasDialog(task: TugasPertemuan) {
    if (!ensureAcademicYearEditable() || !ensureClassTaskFlowEnabled()) {
      return;
    }

    setTugasMode("edit");
    const scheduleDefaults = buildDefaultTaskSchedule(
      activeClass,
      materials,
      task.pertemuanKe,
    );
    const jamMulai = task.jamMulai || scheduleDefaults.jamMulai;
    const jamSelesai = task.jamSelesai || scheduleDefaults.jamSelesai;
    setTugasDraft({
      ...task,
      deadline: task.deadline || scheduleDefaults.deadline,
      jamMulai,
      jamSelesai,
      durasiMenit:
        getTimeRangeDurationMinutes(jamMulai, jamSelesai) ??
        task.durasiMenit,
    });
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
        ? (() => {
            const nextValue = (() => {
              if (
                field === "pertemuanKe" ||
                field === "jumlahMengumpulkan" ||
                field === "durasiMenit" ||
                field === "jumlahSoal"
              ) {
                return Number(value);
              }

              if (field === "nilaiMinimum") {
                return value === "" ? null : Number(value);
              }

              return String(value);
            })();
            const nextDraft = {
              ...current,
              [field]: nextValue,
            };

            if (field === "pertemuanKe") {
              const meetingNumber = Math.max(Number(value) || 1, 1);
              const scheduleDefaults = buildDefaultTaskSchedule(
                activeClass,
                materials,
                meetingNumber,
              );
              const jamMulai = scheduleDefaults.jamMulai || nextDraft.jamMulai;
              const jamSelesai =
                scheduleDefaults.jamSelesai || nextDraft.jamSelesai;

              return {
                ...nextDraft,
                deadline: scheduleDefaults.deadline || nextDraft.deadline,
                jamMulai,
                jamSelesai,
                durasiMenit:
                  getTimeRangeDurationMinutes(jamMulai, jamSelesai) ??
                  nextDraft.durasiMenit,
              };
            }

            if (field === "jamMulai" || field === "jamSelesai") {
              const jamMulai =
                field === "jamMulai"
                  ? normalizeTimeInput(String(value))
                  : nextDraft.jamMulai;
              const jamSelesai =
                field === "jamSelesai"
                  ? normalizeTimeInput(String(value))
                  : nextDraft.jamSelesai;

              return {
                ...nextDraft,
                jamMulai,
                jamSelesai,
                durasiMenit:
                  getTimeRangeDurationMinutes(jamMulai, jamSelesai) ??
                  nextDraft.durasiMenit,
              };
            }

            return nextDraft;
          })()
        : current,
    );
  }

  function handleTugasAttachmentChange(file: File | null) {
    if (file && file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      toast.error(`Ukuran lampiran latihan maksimal ${ATTACHMENT_LIMIT_LABEL}.`);
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
    if (!ensureAcademicYearEditable() || !ensureClassTaskFlowEnabled()) {
      return;
    }

    if (
      !tugasDraft ||
      !tugasDraft.deadline ||
      !normalizeTimeInput(tugasDraft.jamMulai) ||
      !normalizeTimeInput(tugasDraft.jamSelesai) ||
      !tugasDraft.judulTugas.trim() ||
      !tugasDraft.deskripsi.trim()
    ) {
      toast.error("Mohon isi jadwal sesi, judul latihan, dan deskripsi terlebih dahulu.");
      return;
    }

    const todayDate = formatJakartaDateInput(new Date().toISOString());
    if (tugasDraft.deadline !== todayDate) {
      toast.error("Anda hanya dapat menyimpan latihan pada hari jadwal kelas berlangsung (hari ini).");
      return;
    }

    const sessionDuration = getTimeRangeDurationMinutes(
      tugasDraft.jamMulai,
      tugasDraft.jamSelesai,
    );

    if (!sessionDuration) {
      toast.error("Jam selesai latihan harus lebih besar dari jam mulai.");
      return;
    }

    if (
      sessionDuration < 1 ||
      Number(tugasDraft.nilaiMinimum) < 1 ||
      Number(tugasDraft.nilaiMinimum) > 100
    ) {
      toast.error("Durasi latihan minimal 1 menit dan KKM harus di antara 1-100.");
      return;
    }

    try {
      const questionWorkbook = isTaskQuestionWorkbook(tugasAttachmentFile)
        ? tugasAttachmentFile
        : null;
      const savedTask = await saveTaskRequest(
        tugasDraft,
        tugasMode,
        questionWorkbook ? null : tugasAttachmentFile,
      );
      const taskWithQuestions = questionWorkbook
        ? {
            ...savedTask,
            jumlahSoal: await uploadTaskQuestionsRequest(
              savedTask.id,
              questionWorkbook,
            ),
          }
        : savedTask;

      const nextTasks = sortTasksByMeeting(
        tugasMode === "add"
          ? [...tasks, taskWithQuestions]
          : tasks.map((task) =>
              task.id === tugasDraft.id ? taskWithQuestions : task,
            ),
      );

      setTasks(nextTasks);
      setNilaiRows(
        buildNilaiRows(
          activeClass.participants,
          nextTasks,
          gradeEntries,
          academicGradeEntries,
        ),
      );
      setIsTugasDialogOpen(false);
      setTugasDraft(null);
      setTugasAttachmentFile(null);
      setTugasAttachmentMarkedForRemoval(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Latihan kelas belum bisa disimpan.",
      );
    }
  }

  async function handleDeleteTugas(taskId: string) {
    if (!ensureAcademicYearEditable() || !ensureClassTaskFlowEnabled()) {
      return;
    }

    try {
      await deleteTaskRequest(taskId);
      const nextTasks = tasks.filter(
        (task) => normalizeText(task.id) !== normalizeText(taskId),
      );

      setTasks(nextTasks);
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
            nextTasks,
            nextGradeEntries,
            academicGradeEntries,
          ),
        );
        return nextGradeEntries;
      });
    } catch (error) {
      toast.error(
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
    if (!ensureAcademicYearEditable()) {
      return;
    }

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
    if (!ensureAcademicYearEditable() || !ensureClassTaskFlowEnabled()) {
      return;
    }

    const nextStudentId = findDefaultStudentIdForTask(task.id);

    if (!nextStudentId) {
      toast.error("Belum ada siswa aktif untuk diberi nilai.");
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
    if (!ensureAcademicYearEditable()) {
      return;
    }

    if (!nilaiDraft) {
      return;
    }

    const shouldSaveTaskGrade = Boolean(
      selectedTaskForScore && nilaiDraft.tugas !== null,
    );

    if (!shouldSaveTaskGrade) {
      toast.error("Isi nilai latihan terlebih dahulu.");
      return;
    }

    try {
      const savedGrade = selectedTaskForScore
        ? await saveGradeRequest(nilaiDraft, selectedTaskForScore)
        : null;
      const nextGradeEntries = savedGrade
        ? [
            savedGrade,
            ...gradeEntries.filter((grade) => grade.id !== savedGrade.id),
          ]
        : gradeEntries;
      const nextNilaiRows = buildNilaiRows(
        activeClass.participants,
        tasksWithGradeStatus,
        nextGradeEntries,
        academicGradeEntries,
      );

      setGradeEntries(nextGradeEntries);
      setNilaiRows(nextNilaiRows);
      setIsNilaiDialogOpen(false);
      setSelectedTaskForScore(null);
      setNilaiDraft(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nilai siswa belum bisa disimpan.",
      );
    }
  }

  function renderActiveSection() {
    const resolvedActiveSection =
      activeSection === "belum-dinilai" ? "tugas" : activeSection;

    switch (resolvedActiveSection) {
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
            readOnly={isAcademicArchive}
            readOnlyMessage={archiveMessage}
            totalMeetings={activeClass.totalPertemuan}
            onAdd={openAddMateriDialog}
            onDelete={handleDeleteMateri}
            onEdit={openEditMateriDialog}
          />
        );
      case "tugas":
        if (isUtbkClass) {
          return (
            <DetailPertemuanTable
              kelasName={activeClass.namaKelas}
              materials={materials}
              readOnly={isAcademicArchive}
              readOnlyMessage={archiveMessage}
              totalMeetings={activeClass.totalPertemuan}
              onAdd={openAddMateriDialog}
              onDelete={handleDeleteMateri}
              onEdit={openEditMateriDialog}
            />
          );
        }

        return (
          <TugasPertemuanTable
            kelasName={activeClass.namaKelas}
            tasks={tasksWithGradeStatus}
            readOnly={isAcademicArchive}
            readOnlyMessage={archiveMessage}
            onAdd={openAddTugasDialog}
            onDelete={handleDeleteTugas}
            onEdit={openEditTugasDialog}
            onGrade={openNilaiDialogForTask}
            onViewSubmissions={openTaskSubmissionDialog}
          />
        );
      case "nilai":
        return (
          <TabelNilaiTable
            participants={activeClass.participants}
            nilaiRows={nilaiRows}
            readOnly={isAcademicArchive}
            readOnlyMessage={archiveMessage}
            onEditNilai={openNilaiDialogForStudent}
            scheme={academicScheme}
            includeTaskScore={!isUtbkClass}
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
              href={buildGuruUrl("/dashboard-guru/kelas", searchParams)}
              className="inline-flex items-center gap-2 border border-orange-200 bg-white px-4 py-2 text-sm font-medium text-orange-700 shadow-sm shadow-orange-100/70 transition hover:border-orange-300 hover:bg-orange-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Semua Kelas
            </Link>
          </div>

          <StatePanel
            title="Memuat Detail Kelas"
            description="Data kelas Anda sedang dimuat. Mohon tunggu sebentar."
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
              href={buildGuruUrl("/dashboard-guru/kelas", searchParams)}
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
            href={buildGuruUrl("/dashboard-guru/kelas", searchParams)}
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
                    {isUtbkClass
                      ? "Program UTBK difokuskan pada jadwal kelas, absensi, materi, dan tryout."
                      : "Jadwal detail di bawah ini akan aktif setelah modul sudah terhubung dengan jadwal kelas Anda."}
                  </p>

                  {isUtbkClass ? (
                    <div className="mt-4">
                      <Link
                        href={buildGuruUrl("/dashboard-guru/ujian", searchParams)}
                        className="inline-flex items-center rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-700 transition hover:border-orange-300 hover:bg-orange-100"
                      >
                        Kelola Tryout
                      </Link>
                    </div>
                  ) : null}

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
                          {isAcademicArchive ? (
                            <span className="ml-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                              Arsip
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={openMeetingTargetEditor}
                              className="ml-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-200"
                            >
                              Ubah
                            </button>
                          )}
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
            {isUtbkClass ? (
              <>
                <SummaryMetric
                  label="Absensi"
                  value={`${activeClass.pertemuanSelesai}/${activeClass.totalPertemuan}`}
                  helper="Sesi yang sudah ditutup dari jadwal kelas."
                />
                <SummaryMetric
                  label="Tryout"
                  value="Ujian"
                  helper="Soal dan hasil tryout dikelola dari menu Ujian."
                />
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <DetailKelasSidebar
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            sectionItems={visibleDetailSectionItems}
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
        includeTaskScore={!isUtbkClass}
      />
    </div>
  );
}
