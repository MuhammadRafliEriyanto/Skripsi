"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useMemo, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  Building2,
  Calendar,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  ExternalLink,
  FileCheck2,
  MapPin,
  Search,
  User,
} from "lucide-react";
import { clearAuthClientState } from "@/lib/auth";
import { buildGuruApiUrl, buildGuruUrl, getSelectedAcademicPeriod } from "@/lib/guru-helpers";

import { DEFAULT_SEMESTER_MEETING_TARGET } from "@/components/dashboard-guru/data/guruClassTypes";

type GuruDay =
  | "Senin"
  | "Selasa"
  | "Rabu"
  | "Kamis"
  | "Jumat"
  | "Sabtu"
  | "Minggu";

type GuruStatus = "Berjalan" | "Siap" | "Selesai" | "Bentrok" | "Review";

type JadwalGuruItem = {
  id: string;
  className: string;
  jenjang: string;
  tingkat: string;
  mapel: string;
  branch: string;
  day: GuruDay;
  time: string;
  room: string;
  status: GuruStatus;
};

type ReviewItem = {
  id: string;
  judul: string;
  mapel: string;
  jumlahSiswa: number;
  batasNilai: string;
  urgent: boolean;
  href: string;
};

type GuruClassCardItem = {
  kelasId: string;
  namaKelas: string;
  jenjang: string;
  tingkat: string;
  mapel: string;
  branch: string;
  day: GuruDay;
  time: string;
  ruangan: string;
  totalSiswa: number;
  totalPertemuan: number;
  status: GuruStatus;
  conflictCount: number;
  pendingTaskCount: number;
  overdueTaskCount: number;
};

type TeacherClassApiNextSchedule = {
  id?: string;
  day?: string;
  time?: string;
  room?: string;
  subject?: string;
  status?: string;
} | null;

type TeacherClassApiItem = {
  id?: string;
  className?: string;
  level?: string;
  subject?: string;
  branch?: string;
  room?: string;
  studentCount?: number;
  scheduleCount?: number;
  targetMeetingCount?: number;
  pendingTaskCount?: number;
  overdueTaskCount?: number;
  nextSchedule?: TeacherClassApiNextSchedule;
  status?: string;
};

type TeacherClassesResponse = {
  success: boolean;
  message?: string;
  data?: {
    classes?: TeacherClassApiItem[];
  };
};

type TeacherScheduleApiItem = {
  id?: string;
  className?: string;
  subject?: string;
  branch?: string;
  day?: string;
  time?: string;
  room?: string;
  status?: string;
  conflicts?: string[];
};

type TeacherScheduleResponse = {
  success: boolean;
  message?: string;
  data?: {
    schedules?: TeacherScheduleApiItem[];
  };
};

type GuruClassLookupItem = GuruClassCardItem & {
  nextScheduleId: string;
};

type TeacherClassScheduleStats = {
  conflictCount: number;
  status: GuruStatus;
};

const DAY_ORDER: GuruDay[] = [
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
  "Minggu",
];

const DAY_SHORT_LABEL: Record<GuruDay, string> = {
  Senin: "Sen",
  Selasa: "Sel",
  Rabu: "Rab",
  Kamis: "Kam",
  Jumat: "Jum",
  Sabtu: "Sab",
  Minggu: "Min",
};

const gradClass =
  "bg-gradient-to-r from-orange-400 via-orange-500 to-amber-400";

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function toSafeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isDefined<T>(value: T | null): value is T {
  return value !== null;
}

function formatTimeLabel(value: string) {
  return normalizeText(value).replace(/:/g, ".");
}

function getCurrentIndonesianDay(date = new Date()): GuruDay {
  const dayMap: Record<number, GuruDay> = {
    0: "Minggu",
    1: "Senin",
    2: "Selasa",
    3: "Rabu",
    4: "Kamis",
    5: "Jumat",
    6: "Sabtu",
  };

  return dayMap[date.getDay()];
}

function buildWeekCalendar(baseDate: Date) {
  const startDate = new Date(baseDate);
  const day = startDate.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  startDate.setDate(startDate.getDate() + diffToMonday);

  return DAY_ORDER.map((dayKey, index) => {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + index);

    return {
      key: dayKey,
      shortLabel: DAY_SHORT_LABEL[dayKey],
      dateNumber: currentDate.getDate().toString(),
      isoDate: currentDate.toISOString(),
    };
  });
}

function toMinuteValue(timeRange: string) {
  const [startTime = "00:00"] = timeRange.split("-").map((value) => value.trim());
  const normalized = startTime.replace(".", ":");
  const [hour, minute] = normalized.split(":").map((value) => Number(value));

  return hour * 60 + minute;
}

function toGuruDay(value: string | null | undefined): GuruDay | null {
  const normalizedValue = normalizeText(value).toLowerCase();

  switch (normalizedValue) {
    case "senin":
      return "Senin";
    case "selasa":
      return "Selasa";
    case "rabu":
      return "Rabu";
    case "kamis":
      return "Kamis";
    case "jumat":
      return "Jumat";
    case "sabtu":
      return "Sabtu";
    case "minggu":
      return "Minggu";
    default:
      return null;
  }
}

function toGuruStatus(value: string | null | undefined): GuruStatus {
  const normalizedValue = normalizeText(value).toLowerCase();

  switch (normalizedValue) {
    case "berjalan":
      return "Berjalan";
    case "selesai":
      return "Selesai";
    case "bentrok":
      return "Bentrok";
    case "review":
      return "Review";
    default:
      return "Siap";
  }
}

function inferJenjang(className: string, level?: string) {
  const normalizedValue = normalizeText(className).toUpperCase();
  const normalizedLevel = normalizeText(level).toUpperCase();

  if (normalizedValue.includes("SD") || normalizedLevel.includes("KELAS 4")) {
    return "SD";
  }

  if (
    normalizedValue.includes("SMP") ||
    ["KELAS 7", "KELAS 8", "KELAS 9"].some((item) =>
      normalizedLevel.includes(item),
    )
  ) {
    return "SMP";
  }

  return "SMA";
}

function inferTingkat(className: string) {
  const normalizedValue = normalizeText(className).toUpperCase();
  const numericMatch = normalizedValue.match(
    /(^|[^0-9])(4|5|6|7|8|9|10|11|12)(?![0-9])/,
  );

  if (numericMatch?.[2]) {
    return `Kelas ${numericMatch[2]}`;
  }

  const romanMatch = normalizedValue.match(/\b(XII|XI|X)\b/);

  if (romanMatch?.[1]) {
    switch (romanMatch[1]) {
      case "X":
        return "Kelas 10";
      case "XI":
        return "Kelas 11";
      case "XII":
        return "Kelas 12";
      default:
        return "Kelas belum diatur";
    }
  }

  return "Kelas belum diatur";
}

function buildItemId(prefix: string, value: string | null | undefined, index: number) {
  const normalizedValue = normalizeText(value);
  return normalizedValue || `${prefix}-${index + 1}`;
}

function mapKelasToJadwalItem(item: GuruClassCardItem): JadwalGuruItem {
  return {
    id: item.kelasId,
    className: item.namaKelas,
    jenjang: item.jenjang,
    tingkat: item.tingkat,
    mapel: item.mapel,
    branch: item.branch,
    day: item.day,
    time: item.time,
    room: item.ruangan,
    status: item.status,
  };
}

function buildClassLookupKey(
  branch: string | null | undefined,
  className: string | null | undefined,
) {
  return `${normalizeText(branch).toLowerCase()}::${normalizeText(className).toLowerCase()}`;
}

function pickHigherPriorityStatus(
  currentStatus: GuruStatus,
  nextStatus: GuruStatus,
): GuruStatus {
  const statusPriority: Record<GuruStatus, number> = {
    Bentrok: 5,
    Review: 4,
    Berjalan: 3,
    Siap: 2,
    Selesai: 1,
  };

  return statusPriority[nextStatus] > statusPriority[currentStatus]
    ? nextStatus
    : currentStatus;
}

function mapTeacherClassItem(
  item: TeacherClassApiItem,
  index: number,
): GuruClassLookupItem {
  const namaKelas = normalizeText(item.className) || `Kelas ${index + 1}`;
  const tingkat = normalizeText(item.level) || inferTingkat(namaKelas);
  const nextSchedule = item.nextSchedule ?? null;
  const configuredTotalPertemuan = DEFAULT_SEMESTER_MEETING_TARGET;
  const totalPertemuan = configuredTotalPertemuan;

  return {
    kelasId: buildItemId("kelas", item.id, index),
    namaKelas,
    jenjang: inferJenjang(namaKelas, tingkat),
    tingkat,
    mapel:
      normalizeText(item.subject) ||
      normalizeText(nextSchedule?.subject) ||
      "Mapel belum diatur",
    branch: normalizeText(item.branch) || "Cabang belum diatur",
    day: toGuruDay(nextSchedule?.day) ?? getCurrentIndonesianDay(),
    time: normalizeText(nextSchedule?.time) || "00:00 - 00:00",
    ruangan:
      normalizeText(item.room) ||
      normalizeText(nextSchedule?.room) ||
      "Ruangan belum diatur",
    totalSiswa: Math.max(toSafeNumber(item.studentCount), 0),
    totalPertemuan,
    status: toGuruStatus(nextSchedule?.status || item.status),
    conflictCount: 0,
    pendingTaskCount: Math.max(toSafeNumber(item.pendingTaskCount), 0),
    overdueTaskCount: Math.max(toSafeNumber(item.overdueTaskCount), 0),
    nextScheduleId: normalizeText(nextSchedule?.id),
  };
}

function buildClassLookups(classItems: GuruClassLookupItem[]) {
  const byBranchAndClassName = new Map<string, GuruClassLookupItem>();
  const byNextScheduleId = new Map<string, GuruClassLookupItem>();

  for (const item of classItems) {
    byBranchAndClassName.set(
      buildClassLookupKey(item.branch, item.namaKelas),
      item,
    );

    if (item.nextScheduleId) {
      byNextScheduleId.set(item.nextScheduleId, item);
    }
  }

  return {
    byBranchAndClassName,
    byNextScheduleId,
  };
}

function resolveLinkedClassItem(
  item: TeacherScheduleApiItem,
  classLookups: ReturnType<typeof buildClassLookups>,
) {
  const scheduleId = normalizeText(item.id);

  if (scheduleId) {
    const directClass = classLookups.byNextScheduleId.get(scheduleId);

    if (directClass) {
      return directClass;
    }
  }

  return (
    classLookups.byBranchAndClassName.get(
      buildClassLookupKey(item.branch, item.className),
    ) ?? null
  );
}

function buildClassScheduleStats(
  scheduleItems: TeacherScheduleApiItem[],
  classLookups: ReturnType<typeof buildClassLookups>,
) {
  const statsByClassId = new Map<string, TeacherClassScheduleStats>();

  for (const item of scheduleItems) {
    const linkedClass = resolveLinkedClassItem(item, classLookups);

    if (!linkedClass) {
      continue;
    }

    const currentStats = statsByClassId.get(linkedClass.kelasId) ?? {
      conflictCount: 0,
      status: linkedClass.status,
    };
    const nextConflictCount =
      currentStats.conflictCount +
      (Array.isArray(item.conflicts) ? item.conflicts.length : 0);
    const nextStatus =
      nextConflictCount > 0
        ? "Bentrok"
        : pickHigherPriorityStatus(
            currentStats.status,
            toGuruStatus(item.status || linkedClass.status),
          );

    statsByClassId.set(linkedClass.kelasId, {
      conflictCount: nextConflictCount,
      status: nextStatus,
    });
  }

  return statsByClassId;
}

function mergeClassScheduleStats(
  classItems: GuruClassLookupItem[],
  statsByClassId: Map<string, TeacherClassScheduleStats>,
) {
  return classItems.map((item) => {
    const nextStats = statsByClassId.get(item.kelasId);

    return {
      ...item,
      conflictCount: nextStats?.conflictCount ?? item.conflictCount,
      status: nextStats?.status ?? item.status,
    } satisfies GuruClassCardItem;
  });
}

function mapScheduleItem(
  item: TeacherScheduleApiItem,
  index: number,
  classLookups: ReturnType<typeof buildClassLookups>,
) {
  const day = toGuruDay(item.day);

  if (!day) {
    return null;
  }

  const itemId = buildItemId("jadwal", item.id, index);
  const linkedClass = resolveLinkedClassItem(item, classLookups);
  const className = normalizeText(item.className) || linkedClass?.namaKelas || `Kelas ${index + 1}`;

  return {
    id: itemId,
    className,
    jenjang: linkedClass?.jenjang || inferJenjang(className),
    tingkat: linkedClass?.tingkat || inferTingkat(className),
    mapel:
      normalizeText(item.subject) ||
      linkedClass?.mapel ||
      "Mapel belum diatur",
    branch:
      normalizeText(item.branch) ||
      linkedClass?.branch ||
      "Cabang belum diatur",
    day,
    time: normalizeText(item.time) || linkedClass?.time || "00:00 - 00:00",
    room: normalizeText(item.room) || linkedClass?.ruangan || "Ruangan belum diatur",
    status:
      Array.isArray(item.conflicts) && item.conflicts.length > 0
        ? "Bentrok"
        : toGuruStatus(item.status || linkedClass?.status),
  } satisfies JadwalGuruItem;
}

function buildFollowUpItems(kelasItems: GuruClassCardItem[]) {
  return kelasItems
    .filter(
      (item) =>
        item.conflictCount > 0 ||
        item.pendingTaskCount > 0 ||
        item.overdueTaskCount > 0 ||
        item.status === "Bentrok" ||
        item.status === "Review",
    )
    .sort((left, right) => {
      if (left.pendingTaskCount !== right.pendingTaskCount) {
        return right.pendingTaskCount - left.pendingTaskCount;
      }

      if (left.conflictCount !== right.conflictCount) {
        return right.conflictCount - left.conflictCount;
      }

      if (left.overdueTaskCount !== right.overdueTaskCount) {
        return right.overdueTaskCount - left.overdueTaskCount;
      }

      return toMinuteValue(left.time) - toMinuteValue(right.time);
    })
    .slice(0, 5)
    .map((item) => ({
      id: item.kelasId,
      judul: item.namaKelas,
      mapel: `${item.mapel} • ${item.branch}`,
      jumlahSiswa: item.totalSiswa,
      batasNilai:
        item.conflictCount > 0
          ? `${item.conflictCount} bentrok perlu dicek`
          : item.pendingTaskCount > 0
            ? `${item.pendingTaskCount} latihan belum dinilai`
            : item.overdueTaskCount > 0
              ? `${item.overdueTaskCount} latihan lewat deadline tanpa pengumpulan`
              : item.status === "Review"
                ? "Perlu ditinjau ulang"
                : "Jadwal perlu dikonfirmasi",
      urgent:
        item.conflictCount > 0 ||
        item.pendingTaskCount > 0 ||
        item.overdueTaskCount > 0 ||
        item.status === "Bentrok",
      href: `/dashboard-guru/detail-kelas?kelasId=${item.kelasId}`,
    })) satisfies ReviewItem[];
}

async function fetchTeacherJson<T>(url: string) {
  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as T | null;

  return { response, payload };
}

function getStatusBadgeClass(status: GuruStatus) {
  switch (status) {
    case "Berjalan":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    case "Bentrok":
      return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
    case "Review":
      return "bg-sky-50 text-sky-700 ring-1 ring-sky-200";
    case "Selesai":
      return "bg-slate-50 text-slate-500 ring-1 ring-slate-200";
    default:
      return "bg-orange-50 text-orange-700 ring-1 ring-orange-200";
  }
}

function getStatusDotClass(status: GuruStatus) {
  switch (status) {
    case "Berjalan":
      return "bg-emerald-500";
    case "Bentrok":
      return "bg-rose-500";
    case "Review":
      return "bg-sky-500";
    case "Selesai":
      return "bg-slate-400";
    default:
      return "bg-orange-500";
  }
}

function getStatusLabel(status: GuruStatus) {
  return status === "Review" ? "Perlu Ditinjau" : status;
}

function getBranchBadgeClass(branch: string) {
  const normalizedBranch = normalizeText(branch).toLowerCase();

  if (normalizedBranch === "slawi") {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }

  if (normalizedBranch === "adiwerna") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function LoadingStack({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={`loading-card-${index + 1}`}
          className="animate-pulse rounded-xl border border-gray-100 bg-white p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="w-full max-w-[220px]">
              <div className="h-3 w-3/4 rounded-full bg-gray-200" />
              <div className="mt-2 h-2.5 w-1/2 rounded-full bg-orange-100" />
            </div>
            <div className="h-6 w-16 rounded-full bg-gray-100" />
          </div>

          <div className="mt-4 space-y-2">
            <div className="h-2.5 w-24 rounded-full bg-gray-100" />
            <div className="h-2.5 w-32 rounded-full bg-gray-100" />
            <div className="h-2.5 w-20 rounded-full bg-gray-100" />
          </div>
        </div>
      ))}
    </>
  );
}

function JadwalCard({ item }: { item: JadwalGuruItem }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.01] hover:border-orange-300 hover:shadow-lg hover:shadow-orange-200/35 hover:ring-1 hover:ring-orange-100">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{item.className}</h3>
          <p className="mt-0.5 text-xs text-orange-600">
            {item.jenjang} {item.tingkat} - {item.mapel}
          </p>
          <span
            className={`mt-2 inline-flex items-center gap-1 border px-2 py-1 text-[10px] font-semibold ${getBranchBadgeClass(item.branch)}`}
          >
            <Building2 size={11} />
            Cabang {item.branch}
          </span>
        </div>

        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${getStatusBadgeClass(item.status)}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${getStatusDotClass(item.status)}`}
          />
          {getStatusLabel(item.status)}
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-1.5 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <Calendar size={12} />
          {item.day}
        </div>
        <div className="flex items-center gap-1.5">
          <Clock3 size={12} />
          {formatTimeLabel(item.time)} WIB
        </div>
        <div className="flex items-center gap-1.5">
          <MapPin size={12} />
          {item.room}
        </div>
      </div>
    </div>
  );
}

function PerluDinilaiCard({ item }: { item: ReviewItem }) {
  return (
    <Link
      href={item.href}
      className="group flex items-start gap-3 rounded-xl border border-gray-100 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-300 hover:bg-orange-50/80 hover:ring-2 hover:ring-orange-100"
    >
      <div
        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${
          item.urgent ? gradClass : "bg-orange-100"
        }`}
      >
        <FileCheck2
          size={15}
          className={item.urgent ? "text-white" : "text-orange-700"}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-xs font-semibold text-gray-800">
            {item.judul}
          </p>
          {item.urgent ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium text-orange-700">
              <AlertCircle size={8} />
              Segera
            </span>
          ) : null}
        </div>

        <p className="mt-0.5 text-[11px] text-orange-600">{item.mapel}</p>

        <div className="mt-1 flex items-center gap-3">
          <span className="flex items-center gap-1 text-[11px] text-gray-500">
            <User size={10} />
            {item.jumlahSiswa} siswa
          </span>

          <span className="flex items-center gap-1 text-[11px] text-gray-400">
            <Clock3 size={10} />
            {item.batasNilai}
          </span>
        </div>
      </div>

      <ChevronRight
        size={15}
        className="text-gray-300 transition-colors group-hover:text-orange-400"
      />
    </Link>
  );
}

function GuruClassCard({
  kelas,
  academicYear,
}: {
  kelas: GuruClassCardItem;
  academicYear: string;
}) {
  const gradClass =
    kelas.status === "Berjalan"
      ? "bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-400"
      : "bg-gradient-to-r from-orange-400 via-orange-500 to-amber-400 border-orange-400";

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.01] hover:border-orange-200 hover:shadow-xl hover:shadow-orange-100/60 hover:ring-2 hover:ring-orange-100 active:scale-[0.99]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">{kelas.namaKelas}</h3>
          <p className="mt-0.5 text-xs text-orange-600">
            {kelas.jenjang} {kelas.tingkat} - {kelas.mapel}
          </p>
          <span
            className={`mt-2 inline-flex items-center gap-1 border px-2 py-1 text-[10px] font-semibold ${getBranchBadgeClass(kelas.branch)}`}
          >
            <Building2 size={11} />
            Cabang {kelas.branch}
          </span>
        </div>

        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${getStatusBadgeClass(kelas.status)}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${getStatusDotClass(kelas.status)}`}
          />
          {getStatusLabel(kelas.status)}
        </span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2">
        <span className="flex items-center gap-1 text-xs text-gray-500">
          <User size={11} />
          {kelas.totalSiswa} siswa
        </span>

        <span className="flex items-center gap-1 text-xs text-gray-500">
          <BookOpen size={11} />
          Target {kelas.totalPertemuan} sesi
        </span>

        <span className="flex items-center gap-1 text-xs text-gray-500">
          <Clock3 size={11} />
          {kelas.day}, {formatTimeLabel(kelas.time)} WIB
        </span>

        <span className="flex items-center gap-1 text-xs text-gray-500">
          <MapPin size={11} />
          {kelas.ruangan}
        </span>

        <span className="flex items-center gap-1 text-xs text-gray-500">
          <AlertCircle size={11} />
          {kelas.conflictCount > 0
            ? `${kelas.conflictCount} bentrok`
            : "Jadwal aman"}
        </span>
      </div>

      <div className="mt-2 flex gap-2">
        <Link
          href={buildGuruUrl("/dashboard-guru/detail-kelas", new URLSearchParams({ academicYear }), { kelasId: kelas.kelasId })}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2 text-xs font-medium text-gray-700 transition-all hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700"
        >
          <ExternalLink size={12} />
          Detail
        </Link>

        <Link
          href={buildGuruUrl("/dashboard-guru/absensi-kelas", new URLSearchParams({ academicYear }), { kelasId: kelas.kelasId })}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium text-white shadow-sm shadow-orange-200/80 transition-all hover:brightness-[1.03] hover:shadow-md hover:shadow-orange-200/80 ${gradClass}`}
        >
          <ClipboardCheck size={12} />
          Mulai Kelas
        </Link>
      </div>
    </div>
  );
}

export default function JadwalGuruSection() {
  const searchParams = useSearchParams();
  const { academicYear } = getSelectedAcademicPeriod(searchParams);
  
  const [selectedDay, setSelectedDay] = useState<GuruDay>(
    getCurrentIndonesianDay(),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("Semua");
  const [jadwalItems, setJadwalItems] = useState<JadwalGuruItem[]>([]);
  const [kelasItems, setKelasItems] = useState<GuruClassCardItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const weekDates = useMemo(() => buildWeekCalendar(new Date()), []);

  const loadTeacherScheduleData = useEffectEvent(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const scheduleUrl = buildGuruApiUrl("/api/teacher/me/schedules", searchParams);
      const classesUrl = buildGuruApiUrl("/api/teacher/me/classes", searchParams);

      const [scheduleResult, classesResult] = await Promise.allSettled([
        fetchTeacherJson<TeacherScheduleResponse>(scheduleUrl),
        fetchTeacherJson<TeacherClassesResponse>(classesUrl),
      ]);

      let shouldClearSession = false;
      let nextBaseClassItems: GuruClassLookupItem[] = [];
      let nextKelasItems: GuruClassCardItem[] = [];
      let nextJadwalItems: JadwalGuruItem[] = [];
      let classLookups = buildClassLookups([]);

      if (classesResult.status === "fulfilled") {
        const { response, payload } = classesResult.value;

        if (response.status === 401) {
          shouldClearSession = true;
        } else if (response.ok && payload?.success) {
          nextBaseClassItems = (payload.data?.classes ?? []).map((item, index) =>
            mapTeacherClassItem(item, index),
          );
          classLookups = buildClassLookups(nextBaseClassItems);
          nextKelasItems = mergeClassScheduleStats(
            nextBaseClassItems,
            new Map<string, TeacherClassScheduleStats>(),
          );
        } else {
          console.error("[jadwal-guru-section] classes_request_failed", {
            status: response.status,
            message: payload?.message ?? "unknown_error",
          });
        }
      } else {
        console.error(
          "[jadwal-guru-section] classes_request_rejected",
          classesResult.reason,
        );
      }

      if (scheduleResult.status === "fulfilled") {
        const { response, payload } = scheduleResult.value;

        if (response.status === 401) {
          shouldClearSession = true;
        } else if (response.ok && payload?.success) {
          const scheduleItems = payload.data?.schedules ?? [];
          const statsByClassId = buildClassScheduleStats(
            scheduleItems,
            classLookups,
          );

          if (nextBaseClassItems.length > 0) {
            nextKelasItems = mergeClassScheduleStats(
              nextBaseClassItems,
              statsByClassId,
            );
          }

          nextJadwalItems = scheduleItems
            .map((item, index) => mapScheduleItem(item, index, classLookups))
            .filter(isDefined);
        } else {
          console.error("[jadwal-guru-section] schedule_request_failed", {
            status: response.status,
            message: payload?.message ?? "unknown_error",
          });
        }
      } else {
        console.error(
          "[jadwal-guru-section] schedule_request_rejected",
          scheduleResult.reason,
        );
      }

      if (shouldClearSession) {
        clearAuthClientState();
        setKelasItems([]);
        setJadwalItems([]);
        setLoadError("Sesi guru berakhir. Silakan login kembali.");
        return;
      }

      if (nextJadwalItems.length === 0 && nextKelasItems.length > 0) {
        nextJadwalItems = nextKelasItems.map(mapKelasToJadwalItem);
      }

      setKelasItems(nextKelasItems);
      setJadwalItems(nextJadwalItems);

      if (nextKelasItems.length === 0 && nextJadwalItems.length === 0) {
        setLoadError("Data jadwal guru belum tersedia saat ini.");
      }
    } catch (error) {
      console.error("[jadwal-guru-section] load_schedule_data_failed", error);
      setKelasItems([]);
      setJadwalItems([]);
      setLoadError("Data jadwal guru belum bisa dimuat.");
    } finally {
      setIsLoading(false);
    }
  });

  useEffect(() => {
    queueMicrotask(() => {
      void loadTeacherScheduleData();
    });
  }, [academicYear]);

  const sortedJadwal = useMemo(
    () =>
      [...jadwalItems].sort((left, right) => {
        const leftDayIndex = DAY_ORDER.indexOf(left.day);
        const rightDayIndex = DAY_ORDER.indexOf(right.day);

        if (leftDayIndex !== rightDayIndex) {
          return leftDayIndex - rightDayIndex;
        }

        return toMinuteValue(left.time) - toMinuteValue(right.time);
      }),
    [jadwalItems],
  );
  const branchOptions = useMemo(
    () => [
      "Semua",
      ...Array.from(
        new Set(
          sortedJadwal
            .map((item) => normalizeText(item.branch))
            .filter(Boolean),
        ),
      ).sort((left, right) => left.localeCompare(right, "id-ID")),
    ],
    [sortedJadwal],
  );
  const classCountByBranch = useMemo(() => {
    const counts = new Map<string, number>();

    for (const kelas of kelasItems) {
      const branch = normalizeText(kelas.branch);

      if (!branch) {
        continue;
      }

      counts.set(branch, (counts.get(branch) ?? 0) + 1);
    }

    return counts;
  }, [kelasItems]);
  const branchFilteredJadwal = useMemo(
    () =>
      selectedBranch === "Semua"
        ? sortedJadwal
        : sortedJadwal.filter((item) => item.branch === selectedBranch),
    [selectedBranch, sortedJadwal],
  );
  const jadwalPerHari = useMemo(
    () => branchFilteredJadwal.filter((item) => item.day === selectedDay),
    [branchFilteredJadwal, selectedDay],
  );
  const filteredKelas = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return kelasItems.filter((kelas) => {
      if (!query) {
        return true;
      }

      return (
        kelas.namaKelas.toLowerCase().includes(query) ||
        kelas.mapel.toLowerCase().includes(query) ||
        kelas.ruangan.toLowerCase().includes(query) ||
        kelas.day.toLowerCase().includes(query) ||
        kelas.tingkat.toLowerCase().includes(query) ||
        kelas.jenjang.toLowerCase().includes(query)
        || kelas.branch.toLowerCase().includes(query)
      );
    });
  }, [kelasItems, searchQuery]);
  const followUpItems = useMemo(() => buildFollowUpItems(kelasItems), [kelasItems]);
  const urgentCount = followUpItems.filter((item) => item.urgent).length;
  const weekLabel = useMemo(() => {
    const start = new Date(weekDates[0]?.isoDate ?? new Date());
    const end = new Date(weekDates[weekDates.length - 1]?.isoDate ?? new Date());
    const formatter = new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "long",
    });

    return `${formatter.format(start)} - ${formatter.format(end)}`;
  }, [weekDates]);

  return (
    <div className="mx-auto mt-4 w-full max-w-7xl px-4 py-4 md:mt-6 md:px-6">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[0.95fr_1.4fr]">
        <div className="flex flex-col gap-5">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="h-1 w-full bg-gradient-to-r from-red-800 via-orange-600 to-amber-500" />

            <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3.5">
              <h2 className="text-sm font-semibold text-slate-800">
                Jadwal Minggu Ini
              </h2>
              <div className="text-xs font-medium text-gray-500">{weekLabel}</div>
            </div>

            <div className="border-b border-gray-100 px-4 py-3">
              <div className="flex items-center gap-1 overflow-x-auto" role="group" aria-label="Filter cabang jadwal">
                {branchOptions.map((branch) => {
                  const isActive = selectedBranch === branch;
                  const classCount =
                    branch === "Semua"
                      ? kelasItems.length
                      : classCountByBranch.get(branch) ?? 0;

                  return (
                    <button
                      key={branch}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => setSelectedBranch(branch)}
                      className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 border px-3 text-xs font-semibold transition ${
                        isActive
                          ? "border-orange-300 bg-orange-50 text-orange-700"
                          : "border-slate-200 bg-white text-slate-600 hover:border-orange-200 hover:text-orange-700"
                      }`}
                    >
                      {branch !== "Semua" ? <Building2 size={13} /> : null}
                      {branch}
                      <span className="text-[10px] font-medium opacity-70">
                        {classCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex px-2 py-2.5">
              {weekDates.map((dateItem) => {
                const isActive = selectedDay === dateItem.key;
                const hasJadwal = branchFilteredJadwal.some(
                  (jadwal) => jadwal.day === dateItem.key,
                );

                return (
                  <button
                    key={dateItem.isoDate}
                    type="button"
                    onClick={() => setSelectedDay(dateItem.key)}
                    className="flex flex-1 flex-col items-center gap-1"
                  >
                    <span className="text-[11px] text-gray-400">
                      {dateItem.shortLabel}
                    </span>

                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all ${
                        isActive
                          ? `${gradClass} text-white shadow-[0_12px_24px_-16px_rgba(251,146,60,0.9)] ring-2 ring-orange-100`
                          : "text-gray-700 hover:bg-orange-50 hover:text-orange-600"
                      }`}
                    >
                      {dateItem.dateNumber}
                    </div>

                    <div
                      className={`h-1 w-1 rounded-full ${
                        isActive
                          ? "bg-orange-400"
                          : hasJadwal
                            ? "bg-orange-200"
                            : "bg-transparent"
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            <div className="flex min-h-[180px] flex-col gap-3 p-4">
              {isLoading ? (
                <LoadingStack count={3} />
              ) : jadwalPerHari.length > 0 ? (
                jadwalPerHari.map((item) => <JadwalCard key={item.id} item={item} />)
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center text-gray-400">
                  <Calendar size={28} className="opacity-40" />
                  <p className="mt-2 text-xs">
                    {loadError ??
                      `Tidak ada jadwal${selectedBranch === "Semua" ? "" : ` cabang ${selectedBranch}`} untuk ${selectedDay}`}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="h-1 w-full bg-gradient-to-r from-red-800 via-orange-600 to-amber-500" />

            <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3.5">
              <h2 className="text-sm font-semibold text-slate-800">
                Perlu Ditindaklanjuti
              </h2>
              <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                <span>{followUpItems.length} kelas</span>
                {urgentCount > 0 ? (
                  <span className="rounded-full border border-orange-100 bg-orange-50 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700">
                    {urgentCount} segera
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex min-h-[132px] flex-col gap-2 p-4">
              {isLoading ? (
                <LoadingStack count={2} />
              ) : followUpItems.length > 0 ? (
                followUpItems.map((item) => (
                  <PerluDinilaiCard key={item.id} item={item} />
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center text-gray-400">
                  <FileCheck2 size={24} className="opacity-40" />
                  <p className="mt-2 text-xs">
                    {loadError ?? "Belum ada jadwal yang perlu ditindaklanjuti."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 pb-3 pt-4">
            <div className="flex items-center gap-2 rounded-xl border border-orange-100 bg-orange-50/40 px-3 py-2 transition focus-within:border-orange-200 focus-within:ring-2 focus-within:ring-orange-100">
              <Search size={14} className="text-gray-400" />

              <input
                type="text"
                placeholder="Cari kelas..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="flex-1 bg-transparent text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none"
              />
            </div>

            <div className="mt-2 flex items-center justify-between">
              <p className="text-[11px] text-gray-400">Daftar kelas aktif</p>

              <div className="flex items-center gap-3">
                <span className="text-[11px] font-medium text-orange-600">
                  {filteredKelas.length} kelas
                </span>
                <Link
                  href={buildGuruUrl("/dashboard-guru/kelas", searchParams)}
                  className="text-[11px] font-semibold text-orange-600 transition hover:text-orange-700"
                >
                  Lihat Semua Kelas
                </Link>
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-3 overflow-y-auto bg-gradient-to-b from-white via-orange-50/30 to-amber-50/40 p-4">
            {isLoading ? (
              <LoadingStack count={3} />
            ) : filteredKelas.length > 0 ? (
                filteredKelas.map((kelas) => (
                  <GuruClassCard key={kelas.kelasId} kelas={kelas} academicYear={academicYear} />
                ))
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center text-gray-400">
                <BookOpen size={28} className="opacity-40" />
                <p className="mt-2 text-xs">
                  {loadError ?? "Tidak ada kelas ditemukan"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
