export type ScheduleAttendanceWindowStatus =
  | "open"
  | "upcoming"
  | "ended"
  | "not_today"
  | "unavailable";

export type ScheduleAttendanceWindow = {
  status: ScheduleAttendanceWindowStatus;
  canStartAttendance: boolean;
  label: string;
  startTime: string | null;
  endTime: string | null;
};

type ScheduleWindowSource = {
  day?: string | null;
  time?: string | null;
};

const dayAliases = new Map<string, string>([
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

function normalizeText(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function normalizeDayKey(value: string | null | undefined) {
  const normalizedValue = normalizeText(value).toLowerCase();
  return dayAliases.get(normalizedValue) ?? null;
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

export function parseScheduleTimeRange(time: string | null | undefined) {
  const normalizedTime = normalizeText(time)
    .replace(/[–—]/g, "-")
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

function buildWindow(
  status: ScheduleAttendanceWindowStatus,
  label: string,
  startTime: string | null,
  endTime: string | null,
): ScheduleAttendanceWindow {
  return {
    status,
    canStartAttendance: status === "open",
    label,
    startTime,
    endTime,
  };
}

export function resolveScheduleAttendanceWindow(
  schedule: ScheduleWindowSource,
  now = new Date(),
): ScheduleAttendanceWindow {
  const scheduleDayKey = normalizeDayKey(schedule.day);
  const currentDayKey = getJakartaDayKey(now);
  const currentMinutes = getJakartaCurrentMinutes(now);
  const timeRange = parseScheduleTimeRange(schedule.time);

  if (!scheduleDayKey || !currentDayKey || currentMinutes === null || !timeRange) {
    return buildWindow(
      "unavailable",
      "Format hari atau jam jadwal belum valid.",
      timeRange?.startTime ?? null,
      timeRange?.endTime ?? null,
    );
  }

  if (scheduleDayKey !== currentDayKey) {
    return buildWindow(
      "not_today",
      "Absensi dibuka otomatis pada hari jadwal.",
      timeRange.startTime,
      timeRange.endTime,
    );
  }

  if (currentMinutes < timeRange.startMinutes) {
    return buildWindow(
      "upcoming",
      `Absensi dibuka pukul ${timeRange.startTime} WIB.`,
      timeRange.startTime,
      timeRange.endTime,
    );
  }

  if (currentMinutes <= timeRange.endMinutes) {
    return buildWindow(
      "open",
      `Absensi aktif sampai ${timeRange.endTime} WIB.`,
      timeRange.startTime,
      timeRange.endTime,
    );
  }

  return buildWindow(
    "ended",
    "Waktu absensi jadwal ini sudah berakhir.",
    timeRange.startTime,
    timeRange.endTime,
  );
}
