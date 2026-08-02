"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Expand,
  MapPin,
  Minimize2,
  QrCode,
  RefreshCw,
  Users,
} from "lucide-react";

import { clearAuthClientState } from "@/lib/auth";
import {
  buildGuruApiUrl,
  buildGuruUrl,
  getGuruAcademicYearStatus,
} from "@/lib/guru-helpers";
import { DEFAULT_SEMESTER_MEETING_TARGET } from "@/components/dashboard-guru/data/guruClassTypes";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type AttendanceSelection = "H" | "S" | "A";
type AttendanceDisplayStatus = AttendanceSelection | "I" | "Belum Absen";
type TeacherAttendanceRecordStatus =
  | "Belum Absen"
  | "Hadir"
  | "Sakit"
  | "Izin"
  | "Alpa";
type TeacherAttendanceSessionStatus = "open" | "closed";
type LocalAttendanceWindowStatus =
  | "open"
  | "upcoming"
  | "ended"
  | "not_today"
  | "unavailable";

type LocalAttendanceWindow = {
  status: LocalAttendanceWindowStatus;
  canStartAttendance: boolean;
  label: string;
  startTime: string | null;
  endTime: string | null;
};

type StudentAttendanceRow = {
  id: string;
  recordId: string | null;
  studentId: string;
  name: string;
  status: AttendanceDisplayStatus;
  backendStatus: TeacherAttendanceRecordStatus;
  markedAt: string | null;
  note: string;
};

type AttendanceClassParticipant = {
  id: string;
  studentId: string;
  name: string;
};

type AttendanceClassData = {
  kelasId: string;
  scheduleId: string | null;
  namaKelas: string;
  tingkat: string;
  mapel: string;
  program: string;
  jadwal: string;
  jadwalHari: string;
  ruangan: string;
  totalSiswa: number;
  totalPertemuan: number;
  pertemuanSelesai: number;
  participants: AttendanceClassParticipant[];
};

type AbsensiKelasSectionProps = {
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
  completedMeetingCount?: number;
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

type TeacherScheduleIdSource = {
  id?: string;
  scheduleId?: string;
} | null | undefined;

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
};

type TeacherClassDetailResponse = {
  success: boolean;
  message?: string;
  data?: {
    class?: TeacherClassApiDetailItem;
    schedules?: TeacherClassApiScheduleItem[];
    participants?: TeacherClassApiParticipantItem[];
  };
};

type TeacherAttendanceSession = {
  sessionId: string;
  classId: string;
  scheduleId: string | null;
  className: string;
  subject: string;
  branch: string;
  room: string;
  date: string;
  startTime: string;
  status: TeacherAttendanceSessionStatus;
  qrToken: string | null;
  createdAt: string;
  updatedAt: string;
};

type TeacherAttendanceRecord = {
  recordId: string;
  sessionId: string;
  studentId: string;
  studentObjectId: string | null;
  name: string;
  status: TeacherAttendanceRecordStatus;
  note: string;
  markedBy: string;
  markedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type TeacherAttendanceSessionResponse = {
  success: boolean;
  message?: string;
  data?: {
    session?: TeacherAttendanceSession;
    records?: TeacherAttendanceRecord[];
  };
};

type TeacherAttendanceRecordResponse = {
  success: boolean;
  message?: string;
  data?: {
    record?: TeacherAttendanceRecord;
  };
};

type TeacherAttendanceCloseSummary = {
  hadir: number;
  sakit: number;
  izin: number;
  alpa: number;
  belumAbsen: number;
};

type TeacherAttendanceSessionCloseResponse = {
  success: boolean;
  message?: string;
  data?: {
    session?: TeacherAttendanceSession;
    summary?: TeacherAttendanceCloseSummary;
  };
};

type AttendanceSessionFetchResult =
  | {
      kind: "success";
      session: TeacherAttendanceSession;
      records: TeacherAttendanceRecord[];
    }
  | {
      kind: "not_found";
    }
  | {
      kind: "unauthorized";
    }
  | {
      kind: "error";
      message: string;
      status: number;
    };

const ABSENSI_CLASS_ERROR_MESSAGE =
  "Data kelas absensi tidak ditemukan atau tidak terhubung dengan akun guru ini.";
const ABSENSI_EMPTY_PARTICIPANTS_MESSAGE =
  "Belum ada peserta yang terhubung dengan kelas ini.";
const ABSENSI_SESSION_NOT_STARTED_MESSAGE =
  "Sesi absensi belum dimulai. Klik Mulai Absensi QR untuk membuat sesi hari ini.";
const ABSENSI_SESSION_LOAD_ERROR_MESSAGE = (isDirty: boolean) =>
  isDirty
    ? "Terdapat perubahan absensi yang belum disimpan. Pastikan Anda menyimpan sesi ini."
    : "Sesi absensi aktif. Perubahan kehadiran siswa akan otomatis tersimpan.";
const ABSENSI_SESSION_CLOSED_MESSAGE =
  "Sesi absensi ditutup. Status kehadiran tetap tersimpan dan tidak bisa diubah lagi.";
const ABSENSI_SESSION_REFRESH_ERROR_MESSAGE =
  "Sesi berhasil diproses, tetapi data absensi terbaru belum bisa dimuat ulang.";
const ABSENSI_SESSION_START_ERROR_MESSAGE =
  "Sesi absensi belum bisa dimulai saat ini.";
const ABSENSI_STATUS_UPDATE_ERROR_MESSAGE =
  "Status absensi siswa belum bisa diperbarui.";
const ABSENSI_CLOSE_SESSION_ERROR_MESSAGE =
  "Sesi absensi belum bisa ditutup saat ini.";
const AUTH_SESSION_EXPIRED_MESSAGE = "Sesi guru berakhir. Silakan login kembali.";
const ATTENDANCE_SESSION_REFRESH_INTERVAL = 4000;
const SELECTABLE_ATTENDANCE_STATUSES: AttendanceSelection[] = ["H", "S", "A"];

const STATUS_META: Record<
  AttendanceDisplayStatus,
  {
    label: string;
    badgeClass: string;
    activeClass?: string;
  }
> = {
  "Belum Absen": {
    label: "Belum Absen",
    badgeClass: "border-slate-200 bg-slate-50 text-slate-600",
  },
  H: {
    label: "Hadir",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    activeClass:
      "border-emerald-200 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-100",
  },
  S: {
    label: "Sakit",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
    activeClass:
      "border-amber-200 bg-amber-50 text-amber-700 ring-2 ring-amber-100",
  },
  I: {
    label: "Izin",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
  },
  A: {
    label: "Alpa",
    badgeClass: "border-rose-200 bg-rose-50 text-rose-700",
    activeClass:
      "border-rose-200 bg-rose-50 text-rose-700 ring-2 ring-rose-100",
  },
};

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function toSafeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatTimeLabel(value: string) {
  return normalizeText(value).replace(/:/g, ".");
}

const DAY_ALIASES = new Map<string, string>([
  ["senin", "senin"],
  ["monday", "senin"],
  ["selasa", "selasa"],
  ["tuesday", "selasa"],
  ["rabu", "rabu"],
  ["wednesday", "rabu"],
  ["kamis", "kamis"],
  ["thursday", "kamis"],
  ["jumat", "jumat"],
  ["jum'at", "jumat"],
  ["friday", "jumat"],
  ["sabtu", "sabtu"],
  ["saturday", "sabtu"],
  ["minggu", "minggu"],
  ["ahad", "minggu"],
  ["sunday", "minggu"],
]);

function normalizeDayKey(value: string | null | undefined) {
  return DAY_ALIASES.get(normalizeText(value).toLowerCase()) ?? null;
}

function formatMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (totalMinutes % 60).toString().padStart(2, "0");

  return `${hours}:${minutes}`;
}

function parseClockToken(hours: string | undefined, minutes: string | undefined) {
  const parsedHours = Number(hours ?? "");
  const parsedMinutes = Number(minutes ?? "");

  if (
    !Number.isInteger(parsedHours) ||
    !Number.isInteger(parsedMinutes) ||
    parsedHours < 0 ||
    parsedHours > 23 ||
    parsedMinutes < 0 ||
    parsedMinutes > 59
  ) {
    return null;
  }

  return parsedHours * 60 + parsedMinutes;
}

function parseScheduleTimeRange(value: string | null | undefined) {
  const normalizedTime = normalizeText(value)
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\b(?:s\/d|sd|sampai|hingga|to)\b/gi, "-");
  const matches = Array.from(
    normalizedTime.matchAll(/(\d{1,2})\s*[:.]\s*(\d{2})/g),
  );
  const startMinutes = parseClockToken(matches[0]?.[1], matches[0]?.[2]);
  const endMinutes = parseClockToken(matches[1]?.[1], matches[1]?.[2]);

  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
    return null;
  }

  return {
    startMinutes,
    endMinutes,
    startTime: formatMinutes(startMinutes),
    endTime: formatMinutes(endMinutes),
  };
}

function getJakartaDayKey(now: Date) {
  return normalizeDayKey(
    new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      timeZone: "Asia/Jakarta",
    }).format(now),
  );
}

function getJakartaCurrentMinutes(now: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  }).formatToParts(now);
  const hours = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minutes = Number(
    parts.find((part) => part.type === "minute")?.value ?? "0",
  );

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

function buildLocalAttendanceWindow(
  status: LocalAttendanceWindowStatus,
  label: string,
  startTime: string | null,
  endTime: string | null,
): LocalAttendanceWindow {
  return {
    status,
    canStartAttendance: status === "open",
    label,
    startTime,
    endTime,
  };
}

function resolveLocalAttendanceWindow(
  activeClass: Pick<AttendanceClassData, "jadwal" | "jadwalHari">,
  now = new Date(),
) {
  const scheduleDayKey = normalizeDayKey(activeClass.jadwalHari);
  const currentDayKey = getJakartaDayKey(now);
  const currentMinutes = getJakartaCurrentMinutes(now);
  const timeRange = parseScheduleTimeRange(activeClass.jadwal);

  if (!scheduleDayKey || !currentDayKey || currentMinutes === null || !timeRange) {
    return buildLocalAttendanceWindow(
      "unavailable",
      "Format hari atau jam jadwal belum valid.",
      timeRange?.startTime ?? null,
      timeRange?.endTime ?? null,
    );
  }

  if (scheduleDayKey !== currentDayKey) {
    return buildLocalAttendanceWindow(
      "not_today",
      "Absensi dibuka otomatis pada hari jadwal.",
      timeRange.startTime,
      timeRange.endTime,
    );
  }

  if (currentMinutes < timeRange.startMinutes) {
    return buildLocalAttendanceWindow(
      "upcoming",
      `Absensi dibuka pukul ${timeRange.startTime} WIB.`,
      timeRange.startTime,
      timeRange.endTime,
    );
  }

  if (currentMinutes <= timeRange.endMinutes) {
    return buildLocalAttendanceWindow(
      "open",
      `Absensi aktif sampai ${timeRange.endTime} WIB.`,
      timeRange.startTime,
      timeRange.endTime,
    );
  }

  return buildLocalAttendanceWindow(
    "ended",
    "Waktu absensi jadwal ini sudah berakhir.",
    timeRange.startTime,
    timeRange.endTime,
  );
}

function getScheduleId(schedule: TeacherScheduleIdSource) {
  return normalizeText(schedule?.scheduleId) || normalizeText(schedule?.id);
}

function resolveSelectedSchedule(
  nextSchedule: TeacherClassApiNextSchedule,
  schedules: TeacherClassApiScheduleItem[],
  selectedScheduleId: string,
) {
  const matchedSchedule = selectedScheduleId
    ? schedules.find((schedule) => getScheduleId(schedule) === selectedScheduleId) ?? null
    : null;

  return matchedSchedule ?? nextSchedule ?? schedules[0] ?? null;
}

function buildScheduleLabel(
  schedule: TeacherClassApiScheduleItem | TeacherClassApiNextSchedule,
) {
  const day = normalizeText(schedule?.day);
  const time = normalizeText(schedule?.time);

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

function buildScheduleDayLabel(
  schedule: TeacherClassApiScheduleItem | TeacherClassApiNextSchedule,
) {
  return (
    normalizeText(schedule?.day) || "Jadwal berjalan"
  );
}

function mapTeacherDetailToAttendanceData(
  payload: NonNullable<TeacherClassDetailResponse["data"]>,
  selectedScheduleId: string,
): AttendanceClassData {
  const classItem = payload.class;
  const schedules = payload.schedules ?? [];
  const selectedSchedule = resolveSelectedSchedule(
    classItem?.nextSchedule ?? null,
    schedules,
    selectedScheduleId,
  );
  const participants = (payload.participants ?? []).map((participant, index) => {
    const participantId =
      normalizeText(participant.id) ||
      normalizeText(participant.studentId) ||
      `student-${index + 1}`;
    const studentId = normalizeText(participant.studentId) || participantId;

    return {
      id: participantId,
      studentId,
      name: normalizeText(participant.name) || "Nama siswa belum diatur",
    } satisfies AttendanceClassParticipant;
  });
  const namaKelas = normalizeText(classItem?.className) || "Kelas belum diatur";
  const configuredTotalPertemuan = DEFAULT_SEMESTER_MEETING_TARGET;

  return {
    kelasId: normalizeText(classItem?.id),
    scheduleId: getScheduleId(selectedSchedule) || null,
    namaKelas,
    tingkat: normalizeText(classItem?.level) || "Kelas belum diatur",
    mapel:
      normalizeText(selectedSchedule?.subject) ||
      normalizeText(classItem?.subject) ||
      "Mapel belum diatur",
    program: normalizeText(classItem?.branch) || "Cabang belum diatur",
    jadwal: buildScheduleLabel(selectedSchedule),
    jadwalHari: buildScheduleDayLabel(selectedSchedule),
    ruangan:
      normalizeText(selectedSchedule?.room) ||
      normalizeText(classItem?.room) ||
      "Ruangan belum diatur",
    totalSiswa: Math.max(
      toSafeNumber(classItem?.studentCount),
      participants.length,
    ),
    totalPertemuan: configuredTotalPertemuan,
    pertemuanSelesai: Math.max(toSafeNumber(classItem?.completedMeetingCount), 0),
    participants,
  };
}

function getAttendanceScanBaseUrl() {
  const configuredBaseUrl = normalizeText(process.env.NEXT_PUBLIC_APP_URL);

  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/+$/, "");
  }

  if (typeof window !== "undefined") {
    return normalizeText(window.location.origin).replace(/\/+$/, "");
  }

  return "";
}

function buildAttendanceQrValue(session: TeacherAttendanceSession | null) {
  const sessionId = normalizeText(session?.sessionId);
  const qrToken = normalizeText(session?.qrToken);

  if (!sessionId || !qrToken) {
    return "";
  }

  const baseUrl = getAttendanceScanBaseUrl();
  const queryString = new URLSearchParams({
    sessionId,
    token: qrToken,
  }).toString();

  return `${baseUrl}/absensi/scan?${queryString}`;
}

async function readJsonResponse<T>(response: Response) {
  return (await response.json().catch(() => null)) as T | null;
}

function toAttendanceDisplayStatus(
  status: TeacherAttendanceRecordStatus,
): AttendanceDisplayStatus {
  switch (status) {
    case "Hadir":
      return "H";
    case "Sakit":
      return "S";
    case "Izin":
      return "I";
    case "Alpa":
      return "A";
    default:
      return "Belum Absen";
  }
}

function toBackendAttendanceStatus(status: AttendanceSelection) {
  switch (status) {
    case "H":
      return "Hadir" satisfies TeacherAttendanceRecordStatus;
    case "S":
      return "Sakit" satisfies TeacherAttendanceRecordStatus;
    case "A":
      return "Alpa" satisfies TeacherAttendanceRecordStatus;
  }
}

function mapAttendanceRecordToRow(
  record: TeacherAttendanceRecord,
  fallbackId?: string,
): StudentAttendanceRow {
  return {
    id: fallbackId || normalizeText(record.studentId) || normalizeText(record.recordId),
    recordId: normalizeText(record.recordId) || null,
    studentId: normalizeText(record.studentId),
    name: normalizeText(record.name) || "Nama siswa belum diatur",
    status: toAttendanceDisplayStatus(record.status),
    backendStatus: record.status,
    markedAt: record.markedAt,
    note: normalizeText(record.note),
  };
}

function buildFallbackAttendanceRow(
  participant: AttendanceClassParticipant,
): StudentAttendanceRow {
  return {
    id: participant.id,
    recordId: null,
    studentId: participant.studentId,
    name: participant.name,
    status: "Belum Absen",
    backendStatus: "Belum Absen",
    markedAt: null,
    note: "",
  };
}

function formatMarkedAtLabel(markedAt: string | null) {
  if (!markedAt) {
    return null;
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  }).format(new Date(markedAt));
}

function buildClosedSessionNotice(summary?: TeacherAttendanceCloseSummary) {
  if (!summary) {
    return ABSENSI_SESSION_CLOSED_MESSAGE;
  }

  const totalSickOrLeave = summary.sakit + summary.izin;

  return `Sesi absensi ditutup. Rekap akhir: ${summary.hadir} hadir, ${totalSickOrLeave} sakit/izin, ${summary.alpa} alpa.`;
}

function SummaryCard({
  label,
  value,
  accentClass,
}: {
  label: string;
  value: number | string;
  accentClass: string;
}) {
  return (
    <div className="group rounded-[24px] border border-orange-100/80 bg-white p-4 shadow-[0_18px_34px_-28px_rgba(249,115,22,0.26)] transition-all duration-300 hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-[0_24px_42px_-30px_rgba(249,115,22,0.34)]">
      <div>
        <div
          className={`mb-3 inline-flex rounded-full border border-white/80 px-2.5 py-1 text-[11px] font-semibold shadow-sm ${accentClass}`}
        >
          {label}
        </div>

        <div className="flex items-end justify-between gap-3">
          <p className="text-2xl font-bold tracking-tight text-slate-800">
            {value}
          </p>
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
            Update
          </span>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: AttendanceDisplayStatus }) {
  const meta = STATUS_META[status];

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.badgeClass}`}
    >
      {meta.label}
    </span>
  );
}

function StatusOption({
  checked,
  disabled,
  groupName,
  option,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  groupName: string;
  option: (typeof STATUS_META)[AttendanceSelection];
  onChange: () => void;
}) {
  const stateClass = checked
    ? `${option.activeClass} ${disabled ? "opacity-75" : "shadow-[0_14px_24px_-18px_rgba(249,115,22,0.45)]"}`
    : disabled
      ? "border-slate-200 bg-slate-100 text-slate-300"
      : "border-slate-200 bg-white text-slate-500 hover:-translate-y-px hover:border-orange-200 hover:text-orange-600";

  return (
    <label
      className={`flex items-center justify-center ${
        disabled ? "cursor-not-allowed" : "cursor-pointer"
      }`}
    >
      <input
        type="radio"
        name={groupName}
        value={option.label}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="sr-only"
      />
      <span
        className={`inline-flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold shadow-[0_10px_18px_-16px_rgba(15,23,42,0.28)] transition-all duration-200 ${stateClass}`}
      >
        {option.label.charAt(0)}
      </span>
    </label>
  );
}

function StatePanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-[0_24px_56px_-40px_rgba(15,23,42,0.28)]">
      <div className="bg-gradient-to-r from-orange-50 via-white to-amber-50 px-5 py-6 md:px-7">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-orange-100 bg-orange-50 text-orange-500">
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

function LoadingSection() {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_28px_70px_-42px_rgba(15,23,42,0.35),0_18px_40px_-34px_rgba(249,115,22,0.28)]">
      <div className="h-1 w-full bg-gradient-to-r from-red-800 via-orange-600 to-amber-500" />

      <div className="animate-pulse border-b border-orange-100/80 bg-white px-5 py-5 md:px-7 md:py-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="w-full max-w-3xl">
            <div className="h-6 w-36 rounded-full bg-orange-100" />
            <div className="mt-4 h-8 w-2/3 rounded-full bg-slate-200" />
            <div className="mt-3 h-4 w-full max-w-2xl rounded-full bg-orange-100" />
            <div className="mt-5 flex flex-wrap gap-2.5">
              {Array.from({ length: 4 }, (_, index) => (
                <div
                  key={`absensi-loading-chip-${index + 1}`}
                  className="h-10 w-36 rounded-full bg-slate-100"
                />
              ))}
            </div>
          </div>

          <div className="h-12 w-52 rounded-2xl bg-orange-200" />
        </div>
      </div>

      <div className="grid gap-4 border-b border-orange-100/80 bg-white px-5 py-5 md:grid-cols-4 md:px-7">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={`absensi-loading-summary-${index + 1}`}
            className="rounded-[24px] border border-orange-100/80 bg-white p-4"
          >
            <div className="h-5 w-24 rounded-full bg-orange-100" />
            <div className="mt-4 h-8 w-16 rounded-full bg-slate-200" />
          </div>
        ))}
      </div>

      <div className="animate-pulse px-5 py-5 md:px-7 md:py-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="h-6 w-48 rounded-full bg-slate-200" />
            <div className="mt-2 h-4 w-72 rounded-full bg-orange-100" />
          </div>
          <div className="h-9 w-56 rounded-full bg-orange-100" />
        </div>

        <div className="mt-5 hidden overflow-hidden rounded-[28px] border border-orange-100/80 bg-white md:block">
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }, (_, index) => (
              <div
                key={`absensi-loading-row-${index + 1}`}
                className="h-14 rounded-2xl bg-slate-100"
              />
            ))}
          </div>
        </div>

        <div className="mt-5 space-y-3 md:hidden">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={`absensi-loading-mobile-${index + 1}`}
              className="h-36 rounded-[24px] bg-slate-100"
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function AbsensiKelasSection({
  kelasId,
}: AbsensiKelasSectionProps) {
  const searchParams = useSearchParams();
  const selectedScheduleId = normalizeText(searchParams.get("scheduleId"));
  const academicYearStatus = getGuruAcademicYearStatus(searchParams);
  const isAcademicArchive = academicYearStatus.isArchive;
  const archiveMessage = `Tahun ajaran ${academicYearStatus.academicYear} sudah menjadi arsip. Data absensi hanya bisa dilihat.`;
  const [activeClass, setActiveClass] = useState<AttendanceClassData | null>(null);
  const [attendanceSession, setAttendanceSession] =
    useState<TeacherAttendanceSession | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<
    TeacherAttendanceRecord[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [updatingRecordId, setUpdatingRecordId] = useState<string | null>(null);
  const [closingSession, setClosingSession] = useState(false);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [isQrZoomed, setIsQrZoomed] = useState(false);
  const [scheduleWindowTick, setScheduleWindowTick] = useState(() => Date.now());

  function applyAttendanceSessionState(
    session: TeacherAttendanceSession | null,
    records: TeacherAttendanceRecord[],
    nextNotice?: string | null,
  ) {
    setAttendanceSession(session);
    setAttendanceRecords(records);

    if (session?.status === "closed") {
      setIsQrOpen(false);
      setIsQrZoomed(false);
    }

    if (nextNotice !== undefined) {
      setSessionNotice(nextNotice);
      return;
    }

    if (!session) {
      setSessionNotice(ABSENSI_SESSION_NOT_STARTED_MESSAGE);
      return;
    }

    setSessionNotice(
      session.status === "closed"
        ? ABSENSI_SESSION_CLOSED_MESSAGE
        : ABSENSI_SESSION_LOAD_ERROR_MESSAGE(false),
    );
  }

  async function fetchAttendanceSession(
    classId: string,
    rotateQr: boolean = false,
  ): Promise<AttendanceSessionFetchResult> {
    const url = new URL(
      buildGuruApiUrl(
        `/api/teacher/me/classes/${encodeURIComponent(classId)}/attendance/session`,
        searchParams,
      ),
      window.location.origin,
    );
    if (rotateQr) {
      url.searchParams.set("rotateQr", "true");
    }
    if (selectedScheduleId) {
      url.searchParams.set("scheduleId", selectedScheduleId);
    }
    const response = await fetch(url.toString(), {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
    const payload = await readJsonResponse<TeacherAttendanceSessionResponse>(
      response,
    );

    if (response.status === 401) {
      return {
        kind: "unauthorized",
      };
    }

    if (response.status === 404) {
      return {
        kind: "not_found",
      };
    }

    if (!response.ok || !payload?.success || !payload.data?.session) {
      console.error("[absensi-kelas-guru] attendance_session_request_failed", {
        status: response.status,
        message: payload?.message ?? "unknown_error",
        kelasId: classId,
      });
      return {
        kind: "error",
        message: payload?.message ?? "unknown_error",
        status: response.status,
      };
    }

    return {
      kind: "success",
      session: payload.data.session,
      records: payload.data.records ?? [],
    };
  }

  const loadAttendanceClass = useEffectEvent(async () => {
    setIsLoading(true);
    setSessionLoading(false);
    setLoadError(null);
    setActionError(null);
    setSessionNotice(null);
    setActiveClass(null);
    setAttendanceSession(null);
    setAttendanceRecords([]);
    setUpdatingRecordId(null);
    setClosingSession(false);
    setIsQrOpen(false);
    setIsQrZoomed(false);

    const normalizedClassId = normalizeText(kelasId);

    if (!normalizedClassId) {
      setLoadError(ABSENSI_CLASS_ERROR_MESSAGE);
      setIsLoading(false);
      return;
    }

    try {
      const classResponse = await fetch(
        buildGuruApiUrl(`/api/teacher/me/classes/${encodeURIComponent(normalizedClassId)}`, searchParams),
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        },
      );
      const classPayload = await readJsonResponse<TeacherClassDetailResponse>(
        classResponse,
      );

      if (classResponse.status === 401) {
        clearAuthClientState();
        setLoadError(AUTH_SESSION_EXPIRED_MESSAGE);
        return;
      }

      if (!classResponse.ok || !classPayload?.success || !classPayload.data?.class) {
        console.error("[absensi-kelas-guru] class_detail_request_failed", {
          status: classResponse.status,
          message: classPayload?.message ?? "unknown_error",
          kelasId: normalizedClassId,
        });
        setLoadError(ABSENSI_CLASS_ERROR_MESSAGE);
        return;
      }

      const nextClass = mapTeacherDetailToAttendanceData(
        classPayload.data,
        selectedScheduleId,
      );

      setActiveClass(nextClass);

      if (isAcademicArchive) {
        applyAttendanceSessionState(null, [], archiveMessage);
        return;
      }

      setSessionLoading(true);

      try {
        const sessionResult = await fetchAttendanceSession(normalizedClassId);

        if (sessionResult.kind === "unauthorized") {
          clearAuthClientState();
          setLoadError(AUTH_SESSION_EXPIRED_MESSAGE);
          return;
        }

        if (sessionResult.kind === "not_found") {
          applyAttendanceSessionState(
            null,
            [],
            ABSENSI_SESSION_NOT_STARTED_MESSAGE,
          );
          return;
        }

        if (sessionResult.kind === "error") {
          applyAttendanceSessionState(
            null,
            [],
            ABSENSI_SESSION_LOAD_ERROR_MESSAGE(false),
          );
          return;
        }

        applyAttendanceSessionState(
          sessionResult.session,
          sessionResult.records,
        );
      } finally {
        setSessionLoading(false);
      }
    } catch (error) {
      console.error("[absensi-kelas-guru] load_class_detail_failed", {
        error,
        kelasId: normalizedClassId,
      });
      setLoadError(ABSENSI_CLASS_ERROR_MESSAGE);
    } finally {
      setIsLoading(false);
    }
  });

  async function startAttendanceSession() {
    if (isAcademicArchive) {
      setActionError(archiveMessage);
      return;
    }

    if (!activeClass?.kelasId || sessionLoading || closingSession) {
      return;
    }

    if (attendanceWindow && !attendanceWindow.canStartAttendance) {
      setActionError(attendanceWindow.label);
      return;
    }

    setSessionLoading(true);
    setActionError(null);

    try {
      const url = new URL(
        buildGuruApiUrl(
          `/api/teacher/me/classes/${encodeURIComponent(activeClass.kelasId)}/attendance/session`,
          searchParams,
        ),
        window.location.origin,
      );
      if (activeClass.scheduleId) {
        url.searchParams.set("scheduleId", activeClass.scheduleId);
      }
      const response = await fetch(
        url.toString(),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          cache: "no-store",
          body: JSON.stringify({
            scheduleId: activeClass.scheduleId,
          }),
        },
      );
      const payload = await readJsonResponse<TeacherAttendanceSessionResponse>(
        response,
      );

      if (response.status === 401) {
        clearAuthClientState();
        setActionError(AUTH_SESSION_EXPIRED_MESSAGE);
        return;
      }

      if (!response.ok || !payload?.success || !payload.data?.session) {
        console.error("[absensi-kelas-guru] attendance_session_start_failed", {
          status: response.status,
          message: payload?.message ?? "unknown_error",
          kelasId: activeClass.kelasId,
        });
        setActionError(payload?.message ?? ABSENSI_SESSION_START_ERROR_MESSAGE);
        return;
      }

      applyAttendanceSessionState(
        payload.data.session,
        payload.data.records ?? [],
      );
      setIsQrOpen(true);
    } catch (error) {
      console.error("[absensi-kelas-guru] start_attendance_session_failed", {
        error,
        kelasId: activeClass.kelasId,
      });
      setActionError(ABSENSI_SESSION_START_ERROR_MESSAGE);
    } finally {
      setSessionLoading(false);
    }
  }

  async function updateAttendanceStatus(
    student: StudentAttendanceRow,
    status: AttendanceSelection,
  ) {
    if (isAcademicArchive) {
      setActionError(archiveMessage);
      return;
    }

    if (
      !student.recordId ||
      !attendanceSession ||
      attendanceSession.status !== "open" ||
      sessionLoading ||
      closingSession ||
      updatingRecordId
    ) {
      return;
    }

    const nextStatus = toBackendAttendanceStatus(status);

    if (student.backendStatus === nextStatus) {
      return;
    }

    setUpdatingRecordId(student.recordId);
    setActionError(null);

    try {
      const response = await fetch(
        buildGuruApiUrl(`/api/teacher/me/attendance/records/${encodeURIComponent(student.recordId)}`, searchParams),
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          cache: "no-store",
          body: JSON.stringify({
            status: nextStatus,
          }),
        },
      );
      const payload = await readJsonResponse<TeacherAttendanceRecordResponse>(
        response,
      );

      if (response.status === 401) {
        clearAuthClientState();
        setActionError(AUTH_SESSION_EXPIRED_MESSAGE);
        return;
      }

      if (
        response.status === 400 &&
        normalizeText(payload?.message).toLowerCase().includes("ditutup")
      ) {
        const sessionResult = await fetchAttendanceSession(attendanceSession.classId);

        if (sessionResult.kind === "unauthorized") {
          clearAuthClientState();
          setActionError(AUTH_SESSION_EXPIRED_MESSAGE);
          return;
        }

        if (sessionResult.kind === "success") {
          applyAttendanceSessionState(
            sessionResult.session,
            sessionResult.records,
          );
          return;
        }

        setAttendanceSession((current) =>
          current
            ? {
                ...current,
                status: "closed",
              }
            : current,
        );
        setIsQrOpen(false);
        setIsQrZoomed(false);
        setSessionNotice(ABSENSI_SESSION_CLOSED_MESSAGE);
        setActionError(ABSENSI_SESSION_REFRESH_ERROR_MESSAGE);
        return;
      }

      if (!response.ok || !payload?.success || !payload.data?.record) {
        console.error("[absensi-kelas-guru] attendance_record_update_failed", {
          status: response.status,
          message: payload?.message ?? "unknown_error",
          recordId: student.recordId,
        });
        setActionError(payload?.message ?? ABSENSI_STATUS_UPDATE_ERROR_MESSAGE);
        return;
      }

      const nextRecord = payload.data.record;

      setAttendanceRecords((current) =>
        current.map((record) =>
          record.recordId === nextRecord.recordId ? nextRecord : record,
        ),
      );
    } catch (error) {
      console.error("[absensi-kelas-guru] update_attendance_status_failed", {
        error,
        recordId: student.recordId,
      });
      setActionError(ABSENSI_STATUS_UPDATE_ERROR_MESSAGE);
    } finally {
      setUpdatingRecordId(null);
    }
  }

  async function closeAttendanceSession() {
    if (isAcademicArchive) {
      setActionError(archiveMessage);
      return;
    }

    if (
      !attendanceSession?.sessionId ||
      attendanceSession.status !== "open" ||
      closingSession
    ) {
      return;
    }

    setClosingSession(true);
    setActionError(null);

    try {
      const response = await fetch(
        buildGuruApiUrl(`/api/teacher/me/attendance/session/${encodeURIComponent(attendanceSession.sessionId)}/close`, searchParams),
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          cache: "no-store",
          body: JSON.stringify({}),
        },
      );
      const payload =
        await readJsonResponse<TeacherAttendanceSessionCloseResponse>(response);

      if (response.status === 401) {
        clearAuthClientState();
        setActionError(AUTH_SESSION_EXPIRED_MESSAGE);
        return;
      }

      if (!response.ok || !payload?.success || !payload.data?.session) {
        console.error("[absensi-kelas-guru] close_attendance_session_failed", {
          status: response.status,
          message: payload?.message ?? "unknown_error",
          sessionId: attendanceSession.sessionId,
        });
        setActionError(payload?.message ?? ABSENSI_CLOSE_SESSION_ERROR_MESSAGE);
        return;
      }

      const nextSession = payload.data.session;
      const sessionResult = await fetchAttendanceSession(nextSession.classId);

      if (sessionResult.kind === "unauthorized") {
        clearAuthClientState();
        setActionError(AUTH_SESSION_EXPIRED_MESSAGE);
        return;
      }

      if (sessionResult.kind === "success") {
        applyAttendanceSessionState(
          sessionResult.session,
          sessionResult.records,
          buildClosedSessionNotice(payload.data.summary),
        );
        return;
      }

      setAttendanceSession(nextSession);
      setIsQrOpen(false);
      setIsQrZoomed(false);
      setSessionNotice(buildClosedSessionNotice(payload.data.summary));
      setActionError(ABSENSI_SESSION_REFRESH_ERROR_MESSAGE);
    } catch (error) {
      console.error("[absensi-kelas-guru] close_attendance_session_request_failed", {
        error,
        sessionId: attendanceSession.sessionId,
      });
      setActionError(ABSENSI_CLOSE_SESSION_ERROR_MESSAGE);
    } finally {
      setClosingSession(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void loadAttendanceClass();
    });
  }, [academicYearStatus.academicYear, kelasId, selectedScheduleId]);

  const refreshAttendanceSessionWhileOpen = useEffectEvent(async (rotateQr: boolean = false) => {
    if (isAcademicArchive || !attendanceSession || attendanceSession.status !== "open") {
      return;
    }

    const sessionResult = await fetchAttendanceSession(attendanceSession.classId, rotateQr);

    if (sessionResult.kind === "unauthorized") {
      clearAuthClientState();
      setActionError(AUTH_SESSION_EXPIRED_MESSAGE);
      return;
    }

    if (sessionResult.kind === "success") {
      applyAttendanceSessionState(sessionResult.session, sessionResult.records);
    }
  });

  useEffect(() => {
    if (isAcademicArchive || !attendanceSession || attendanceSession.status !== "open") {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (sessionLoading || closingSession || updatingRecordId !== null) {
        return;
      }

      void refreshAttendanceSessionWhileOpen(true);
    }, ATTENDANCE_SESSION_REFRESH_INTERVAL);

    return () => window.clearInterval(intervalId);
  }, [
    attendanceSession,
    attendanceSession?.classId,
    attendanceSession?.sessionId,
    attendanceSession?.status,
    closingSession,
    sessionLoading,
    updatingRecordId,
    isAcademicArchive,
  ]);

  useEffect(() => {
    if (!isAcademicArchive) {
      return;
    }

    queueMicrotask(() => {
      setIsQrOpen(false);
      setIsQrZoomed(false);
    });
  }, [isAcademicArchive]);

  useEffect(() => {
    if (!activeClass || attendanceSession) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setScheduleWindowTick(Date.now());
    }, 30_000);

    return () => window.clearInterval(intervalId);
  }, [activeClass, attendanceSession]);

  const attendanceRows = useMemo(() => {
    if (!activeClass) {
      return [];
    }

    if (attendanceRecords.length === 0) {
      return activeClass.participants.map(buildFallbackAttendanceRow);
    }

    const recordsByStudentId = new Map(
      attendanceRecords.map((record) => [
        normalizeText(record.studentId).toLowerCase(),
        record,
      ]),
    );
    const seenStudentIds = new Set<string>();
    const rows = activeClass.participants.map((participant) => {
      const candidateKeys = [
        normalizeText(participant.studentId).toLowerCase(),
        normalizeText(participant.id).toLowerCase(),
      ].filter(Boolean);

      let matchingRecord: TeacherAttendanceRecord | null = null;

      for (const key of candidateKeys) {
        const record = recordsByStudentId.get(key);

        if (record) {
          matchingRecord = record;
          break;
        }
      }

      if (!matchingRecord) {
        return buildFallbackAttendanceRow(participant);
      }

      seenStudentIds.add(normalizeText(matchingRecord.studentId).toLowerCase());
      return mapAttendanceRecordToRow(matchingRecord, participant.id);
    });
    const extraRows = attendanceRecords
      .filter(
        (record) =>
          !seenStudentIds.has(normalizeText(record.studentId).toLowerCase()),
      )
      .map((record) => mapAttendanceRecordToRow(record));

    return [...rows, ...extraRows];
  }, [activeClass, attendanceRecords]);

  const isSessionOpen = attendanceSession?.status === "open";
  const isSessionClosed = attendanceSession?.status === "closed";
  const attendanceWindow = useMemo(
    () =>
      activeClass
        ? resolveLocalAttendanceWindow(activeClass, new Date(scheduleWindowTick))
        : null,
    [activeClass, scheduleWindowTick],
  );
  const canStartNewSession = Boolean(
    !attendanceSession && attendanceWindow?.canStartAttendance,
  );
  const shouldShowPrimaryButton = Boolean(attendanceSession) || canStartNewSession;
  const primaryActionDisabled =
    isAcademicArchive ||
    sessionLoading ||
    closingSession ||
    isSessionClosed ||
    (!attendanceSession && !canStartNewSession);
  const attendanceControlsDisabled =
    isAcademicArchive ||
    sessionLoading ||
    closingSession ||
    updatingRecordId !== null ||
    !isSessionOpen;
  const qrSize = isQrZoomed ? 400 : 280;
  const qrValue = useMemo(
    () => buildAttendanceQrValue(attendanceSession),
    [attendanceSession],
  );

  function handlePrimaryAction() {
    if (isAcademicArchive) {
      setActionError(archiveMessage);
      return;
    }

    if (!attendanceSession) {
      if (!canStartNewSession) {
        setActionError(
          attendanceWindow?.label ??
            "Absensi hanya bisa dimulai saat jadwal berlangsung.",
        );
        return;
      }

      void startAttendanceSession();
      return;
    }

    if (attendanceSession.status === "open") {
      handleQrOpenChange(true);
    }
  }

  function handleQrOpenChange(open: boolean) {
    setIsQrOpen(open);

    if (!open) {
      setIsQrZoomed(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto mt-4 w-full max-w-7xl px-4 pb-8 md:mt-6 md:px-6 md:pb-10">
        <div className="flex flex-col gap-4">
          <Link
            href={buildGuruUrl("/dashboard-guru/jadwal", searchParams)}
            className="inline-flex w-fit items-center gap-2 text-sm font-medium text-orange-700 transition-colors duration-300 hover:text-orange-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Jadwal
          </Link>

          <LoadingSection />
        </div>
      </div>
    );
  }

  if (loadError || !activeClass) {
    return (
      <div className="mx-auto mt-4 w-full max-w-7xl px-4 pb-8 md:mt-6 md:px-6 md:pb-10">
        <div className="flex flex-col gap-4">
          <Link
            href={buildGuruUrl("/dashboard-guru/jadwal", searchParams)}
            className="inline-flex w-fit items-center gap-2 text-sm font-medium text-orange-700 transition-colors duration-300 hover:text-orange-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Jadwal
          </Link>

          <StatePanel
            title="Data Absensi Kelas Belum Tersedia"
            description={loadError ?? ABSENSI_CLASS_ERROR_MESSAGE}
          />
        </div>
      </div>
    );
  }

  const sessionStatusMeta = isAcademicArchive
    ? {
        label: "Tahun ajaran arsip",
        className: "border-slate-200 bg-slate-100 text-slate-700",
      }
    : sessionLoading
      ? {
          label: "Memuat sesi absensi...",
          className: "border-orange-200 bg-orange-50 text-orange-700",
      }
    : !attendanceSession
      ? {
          label: attendanceWindow?.canStartAttendance
            ? "Sesi absensi siap dimulai"
            : attendanceWindow?.label ?? "Sesi absensi belum dimulai",
          className: attendanceWindow?.canStartAttendance
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-amber-200 bg-amber-50 text-amber-700",
        }
        : isSessionClosed
          ? {
              label: "Sesi ditutup",
              className: "border-slate-200 bg-slate-100 text-slate-700",
            }
          : {
              label: "Status tersimpan ke sistem",
              className: "border-emerald-200 bg-emerald-50 text-emerald-700",
            };

  const primaryButtonLabel = isAcademicArchive
    ? "Arsip Absensi"
    : sessionLoading
      ? "Menyiapkan Sesi..."
      : !attendanceSession
        ? "Mulai Absensi QR"
        : isSessionClosed
          ? "Sesi Ditutup"
          : "Buka QR Absensi";

  return (
    <div className="mx-auto mt-4 w-full max-w-7xl px-4 pb-8 md:mt-6 md:px-6 md:pb-10">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={buildGuruUrl("/dashboard-guru/jadwal", searchParams)}
            className="inline-flex items-center gap-2 text-sm font-medium text-orange-700 transition-colors duration-300 hover:text-orange-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Jadwal
          </Link>
        </div>

        {isAcademicArchive ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600">
            {archiveMessage} Mulai sesi, tutup sesi, dan ubah status kehadiran dinonaktifkan.
          </div>
        ) : null}

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_28px_70px_-42px_rgba(15,23,42,0.35),0_18px_40px_-34px_rgba(249,115,22,0.28)]">
          <div className="h-1 w-full bg-gradient-to-r from-red-800 via-orange-600 to-amber-500" />

          <div className="border-b border-orange-100/80 bg-white px-5 py-5 md:px-7 md:py-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-700 shadow-sm shadow-orange-100/70">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Absensi Kelas
                </div>

                <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                  {activeClass.namaKelas}
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-500 md:text-base">
                  Data peserta kelas diambil otomatis dari daftar siswa terdaftar.
                </p>

                <div className="mt-5 flex flex-wrap gap-2.5 text-sm">
                  <div className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-white px-3.5 py-2 text-slate-600 shadow-sm shadow-orange-100/50">
                    <Users className="h-4 w-4" />
                    Target Semester {activeClass.totalPertemuan} sesi
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-white px-3.5 py-2 text-slate-600 shadow-sm shadow-orange-100/50">
                    <CalendarDays className="h-4 w-4" />
                    {activeClass.jadwalHari}
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-white px-3.5 py-2 text-slate-600 shadow-sm shadow-orange-100/50">
                    <Clock3 className="h-4 w-4" />
                    {activeClass.jadwal}
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-white px-3.5 py-2 text-slate-600 shadow-sm shadow-orange-100/50">
                    <MapPin className="h-4 w-4" />
                    {activeClass.ruangan}
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-stretch gap-3 sm:items-end">
                <div
                  className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold ${sessionStatusMeta.className}`}
                >
                  {sessionLoading ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : isSessionClosed ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5" />
                  )}
                  {sessionStatusMeta.label}
                </div>

                <div className="flex flex-wrap gap-3">
                  {shouldShowPrimaryButton ? (
                    <button
                      type="button"
                      onClick={handlePrimaryAction}
                      disabled={primaryActionDisabled}
                      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                        primaryActionDisabled
                          ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400 shadow-none"
                          : "border border-orange-300/70 bg-gradient-to-r from-orange-500 via-orange-500 to-amber-400 text-white shadow-[0_18px_30px_-24px_rgba(249,115,22,0.6)] hover:scale-[1.01] hover:shadow-[0_24px_36px_-24px_rgba(249,115,22,0.72)]"
                      }`}
                    >
                      {sessionLoading ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <QrCode className="h-4 w-4" />
                      )}
                      {primaryButtonLabel}
                    </button>
                  ) : (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
                      {attendanceWindow?.label ??
                        "Absensi dibuka saat jadwal berlangsung."}
                    </div>
                  )}

                  {isSessionOpen ? (
                    <button
                      type="button"
                      onClick={() => void closeAttendanceSession()}
                      disabled={
                        isAcademicArchive ||
                        closingSession ||
                        updatingRecordId !== null
                      }
                      className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-5 py-3 text-sm font-semibold transition ${
                        isAcademicArchive ||
                        closingSession ||
                        updatingRecordId !== null
                          ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                          : "border-orange-200 bg-white text-orange-700 shadow-[0_18px_30px_-24px_rgba(249,115,22,0.2)] hover:-translate-y-0.5 hover:border-orange-300 hover:bg-orange-50"
                      }`}
                    >
                      {closingSession ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      {closingSession ? "Menutup Sesi..." : "Tutup Absensi"}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 border-b border-orange-100/80 bg-white px-5 py-5 md:grid-cols-4 md:px-7">
            <SummaryCard
              label="Target Semester"
              value={activeClass.totalPertemuan}
              accentClass="bg-orange-50 text-orange-700"
            />
            <SummaryCard
              label="Pertemuan Selesai"
              value={activeClass.pertemuanSelesai}
              accentClass="bg-emerald-50 text-emerald-700"
            />
            <SummaryCard
              label="Sisa Pertemuan"
              value={Math.max(0, activeClass.totalPertemuan - activeClass.pertemuanSelesai)}
              accentClass="bg-amber-50 text-amber-700"
            />
            <SummaryCard
              label="Progress"
              value={`${activeClass.pertemuanSelesai}/${activeClass.totalPertemuan}`}
              accentClass="bg-blue-50 text-blue-700"
            />
          </div>

          <div className="px-5 py-5 md:px-7 md:py-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">
                  Daftar Kehadiran Siswa
                </h2>
                <p className="text-sm text-slate-500">
                  Pilih status kehadiran siswa di baris tabel. Perubahan
                  akan langsung tersimpan ke sistem.
                </p>
              </div>

              <div
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium ${sessionStatusMeta.className}`}
              >
                {sessionLoading ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : isSessionClosed ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : !attendanceSession ? (
                  <AlertCircle className="h-3.5 w-3.5" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                {sessionStatusMeta.label}
              </div>
            </div>

            {sessionNotice || actionError ? (
              <div className="mt-4 space-y-3">
                {sessionNotice ? (
                  <div className="rounded-2xl border border-orange-100 bg-orange-50/70 px-4 py-3 text-sm text-orange-700">
                    {sessionNotice}
                  </div>
                ) : null}

                {actionError ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700">
                    {actionError}
                  </div>
                ) : null}
              </div>
            ) : null}

            {attendanceRows.length === 0 ? (
              <div className="mt-5 rounded-[28px] border border-dashed border-orange-200 bg-orange-50/50 px-5 py-8 text-center shadow-[0_18px_36px_-30px_rgba(249,115,22,0.2)]">
                <p className="text-base font-semibold text-slate-700">
                  {ABSENSI_EMPTY_PARTICIPANTS_MESSAGE}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Data peserta akan muncul di sini setelah siswa terhubung ke
                  kelas yang diajar guru login.
                </p>
              </div>
            ) : (
              <>
                <div className="mt-5 hidden overflow-hidden rounded-[28px] border border-orange-100/80 bg-white shadow-[0_22px_40px_-34px_rgba(249,115,22,0.22)] md:block">
                  <div className="overflow-x-auto">
                    <table className="min-w-[760px] w-full">
                      <thead className="bg-orange-50/70 text-left">
                        <tr className="text-xs uppercase tracking-[0.16em] text-slate-500">
                          <th className="px-4 py-4 font-semibold">No</th>
                          <th className="px-4 py-4 font-semibold">Nama Siswa</th>
                          <th className="px-4 py-4 font-semibold">
                            Status Kehadiran
                          </th>
                          <th className="px-4 py-4 text-center font-semibold">
                            H
                          </th>
                          <th className="px-4 py-4 text-center font-semibold">
                            S
                          </th>
                          <th className="px-4 py-4 text-center font-semibold">
                            A
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceRows.map((student, index) => {
                          const isUpdatingCurrentRow =
                            updatingRecordId !== null &&
                            updatingRecordId === student.recordId;
                          const markedAtLabel = formatMarkedAtLabel(student.markedAt);

                          return (
                            <tr
                              key={student.recordId ?? student.studentId}
                              className="border-t border-orange-100/80 bg-white text-sm transition-colors duration-200 even:bg-orange-50/[0.18] hover:bg-orange-50/70"
                            >
                              <td className="px-4 py-4 font-medium text-slate-500">
                                {index + 1}
                              </td>
                              <td className="px-4 py-4 font-semibold text-slate-800">
                                {student.name}
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex flex-col items-start gap-1.5">
                                  <StatusBadge status={student.status} />
                                  {isUpdatingCurrentRow ? (
                                    <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-600">
                                      <RefreshCw className="h-3 w-3 animate-spin" />
                                      Menyimpan...
                                    </span>
                                  ) : markedAtLabel ? (
                                    <span className="text-xs text-slate-400">
                                      Tersimpan {markedAtLabel} WIB
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                              {SELECTABLE_ATTENDANCE_STATUSES.map((status) => (
                                <td key={status} className="px-4 py-4 text-center">
                                  <StatusOption
                                    checked={student.status === status}
                                    disabled={
                                      attendanceControlsDisabled ||
                                      student.recordId === null
                                    }
                                    groupName={`attendance-${student.recordId ?? student.studentId}`}
                                    option={STATUS_META[status]}
                                    onChange={() =>
                                      void updateAttendanceStatus(student, status)
                                    }
                                  />
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-5 space-y-3 md:hidden">
                  {attendanceRows.map((student, index) => {
                    const isUpdatingCurrentRow =
                      updatingRecordId !== null &&
                      updatingRecordId === student.recordId;
                    const markedAtLabel = formatMarkedAtLabel(student.markedAt);

                    return (
                      <div
                        key={student.recordId ?? student.studentId}
                        className="group rounded-[24px] border border-orange-100/80 bg-white p-4 shadow-[0_18px_34px_-28px_rgba(249,115,22,0.22)] transition-all duration-300 hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-[0_24px_40px_-30px_rgba(249,115,22,0.3)]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                              Siswa {index + 1}
                            </p>
                            <h3 className="mt-1 text-base font-semibold text-slate-800">
                              {student.name}
                            </h3>
                            {isUpdatingCurrentRow ? (
                              <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-orange-600">
                                <RefreshCw className="h-3 w-3 animate-spin" />
                                Menyimpan...
                              </p>
                            ) : markedAtLabel ? (
                              <p className="mt-2 text-xs text-slate-400">
                                Tersimpan {markedAtLabel} WIB
                              </p>
                            ) : null}
                          </div>
                          <StatusBadge status={student.status} />
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-2">
                          {SELECTABLE_ATTENDANCE_STATUSES.map((status) => (
                            <div
                              key={status}
                              className="flex flex-col items-center gap-2 rounded-[20px] border border-orange-100/70 bg-white px-3 py-3 shadow-[0_12px_22px_-18px_rgba(15,23,42,0.18)]"
                            >
                              <span className="text-[11px] font-semibold text-slate-500">
                                {STATUS_META[status].label}
                              </span>
                              <StatusOption
                                checked={student.status === status}
                                disabled={
                                  attendanceControlsDisabled ||
                                  student.recordId === null
                                }
                                groupName={`attendance-mobile-${student.recordId ?? student.studentId}`}
                                option={STATUS_META[status]}
                                onChange={() =>
                                  void updateAttendanceStatus(student, status)
                                }
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      <Dialog open={isQrOpen} onOpenChange={handleQrOpenChange}>
        <DialogContent
          className={`max-h-[90vh] w-full gap-0 overflow-hidden rounded-3xl border-white/80 bg-white/98 p-0 shadow-[0_32px_88px_-44px_rgba(15,23,42,0.28),0_20px_38px_-30px_rgba(249,115,22,0.18)] transition-[transform,opacity] duration-300 ease-out data-[state=closed]:scale-95 data-[state=closed]:opacity-0 data-[state=open]:scale-100 data-[state=open]:opacity-100 [&>button]:right-4 [&>button]:top-4 [&>button]:h-9 [&>button]:w-9 [&>button]:rounded-full [&>button]:border [&>button]:border-slate-200 [&>button]:bg-white [&>button]:p-0 [&>button]:text-slate-500 [&>button]:shadow-sm [&>button:hover]:bg-slate-50 [&>button:hover]:text-orange-700 ${
            isQrZoomed ? "max-w-xl" : "max-w-md"
          }`}
        >
          <div
            className={`relative overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_top,rgba(251,146,60,0.12),transparent_32%),linear-gradient(180deg,#ffffff_0%,#fffaf5_100%)] ${
              isQrZoomed ? "p-5" : "p-4"
            }`}
          >
            <div className="absolute left-1/2 top-0 h-28 w-28 -translate-x-1/2 rounded-full bg-orange-100/60 blur-3xl" />

            <DialogHeader className="relative items-center text-center">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-600 shadow-sm shadow-orange-100/80">
                <QrCode className="h-3.5 w-3.5" />
                QR Absensi
              </div>
              <DialogTitle className="mt-2.5 text-xl text-slate-900 sm:text-2xl">
                Mulai Absensi QR
              </DialogTitle>
              <DialogDescription className="mt-1 max-w-sm text-center text-xs leading-5 text-slate-500 sm:text-sm">
                Siswa yang login bisa scan QR ini untuk langsung tercatat hadir
                di kelas {activeClass.namaKelas}.
              </DialogDescription>
            </DialogHeader>

            <div className="relative mt-4 flex flex-col items-center gap-3.5">
              <div
                className={`mx-auto flex items-center justify-center rounded-3xl border border-orange-100 bg-white p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_22px_48px_-36px_rgba(249,115,22,0.28)] transition-all duration-300 ${
                  isQrZoomed ? "w-full max-w-[28rem]" : "w-full max-w-[19rem]"
                }`}
              >
                <QRCodeSVG
                  value={qrValue}
                  size={qrSize}
                  bgColor="#ffffff"
                  fgColor="#ea580c"
                  level="M"
                  marginSize={2}
                  title={`QR Absensi ${activeClass.namaKelas}`}
                  className={`shrink-0 transition-all duration-300 ${
                    isQrZoomed
                      ? "h-[min(84vw,400px)] w-[min(84vw,400px)]"
                      : "h-[min(72vw,280px)] w-[min(72vw,280px)]"
                  }`}
                />
              </div>

              <div className="flex w-full flex-col items-center justify-center gap-2 sm:flex-row sm:gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsQrZoomed((current) => !current)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-orange-200 bg-white px-4 py-2.5 text-sm font-semibold text-orange-700 shadow-sm shadow-orange-100/80 transition hover:-translate-y-0.5 hover:bg-orange-50 sm:w-auto sm:min-w-[165px]"
                >
                  {isQrZoomed ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Expand className="h-4 w-4" />
                  )}
                  {isQrZoomed ? "Perkecil QR" : "Perbesar QR"}
                </button>

                <DialogClose asChild>
                  <button
                    type="button"
                    className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700 sm:w-auto sm:min-w-[140px]"
                  >
                    Tutup
                  </button>
                </DialogClose>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
