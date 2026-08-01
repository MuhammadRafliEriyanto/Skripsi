"use client";

import {
  Download,
  Eye,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Trash2,
  Upload,
} from "lucide-react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";

import { AdminApiRequestError, requestAdminApi } from "@/lib/admin-api";
import {
  getAdminAcademicYearLockMessage,
  getAdminAcademicYearOptions,
  getAdminAcademicYearStatus,
  getCurrentAdminAcademicYear,
} from "@/lib/admin-academic-year";
import {
  exportAdminSchedulesCsv,
  fetchAdminSchedules,
  importAdminSchedules,
  type AdminSchedulesSummary,
} from "@/lib/admin-directory";
import {
  defaultAdminDashboardConfig,
  type AdminAcademicLevel,
  type AdminDashboardConfigData,
} from "@/lib/admin-dashboard-config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { TableCell, TableRow } from "@/components/ui/table";

import type {
  AdminTeacher,
  AdminSchedule as AdminScheduleItem,
} from "./admin-data";
import {
  AdminDataTable,
  type AdminColumnDefinition,
} from "./components/AdminDataTable";
import { AdminPaginationFooter } from "./components/AdminPaginationFooter";
import { AdminSummaryLineSkeleton } from "./components/AdminLoadingState";
import { AdminSectionCard } from "./components/AdminSectionCard";
import { AdminStatusBadge } from "./components/AdminStatusBadge";

type AdminScheduleProps = {
  dashboardConfig?: AdminDashboardConfigData;
  onRefresh?: () => Promise<void> | void;
  globalSearchQuery?: string;
};

type ScheduleLevel = AdminAcademicLevel | "UTBK";

type ScheduleFormValues = {
  day: string;
  time: string;
  level: string;
  grade: string;
  subject: string;
  teacherId: string;
  room: string;
  status: AdminScheduleItem["status"];
};

type ScheduleStatusFilterOption = AdminScheduleItem["status"] | "Semua";

type ScheduleRoomDirectoryItem = {
  id: string;
  name: string;
  floor: string;
};

const requiredImportColumns = [
  "hari",
  "jam",
  "kelas",
  "mapel",
  "guru",
  "ruangan",
] as const;
const scheduleDayAllLabel = "Semua hari";
const allScheduleStatusFilterLabel = "Semua";
const warmFieldClassName =
  "border-slate-200 hover:border-orange-200 focus:border-orange-300 focus:ring-4 focus:ring-orange-500/10 focus-visible:border-orange-300 focus-visible:ring-4 focus-visible:ring-orange-500/10";
const warmSelectTriggerClassName =
  "border-slate-200 hover:border-orange-200 focus:border-orange-300 focus:ring-4 focus:ring-orange-500/10 focus-visible:border-orange-300 focus-visible:ring-4 focus-visible:ring-orange-500/10 data-[state=open]:border-orange-300 data-[state=open]:ring-4 data-[state=open]:ring-orange-500/10";
const warmSelectContentClassName =
  "border-orange-100/80 shadow-lg shadow-orange-100/20";
const warmSelectItemClassName =
  "hover:bg-orange-50 hover:text-orange-700 focus:bg-orange-50 focus:text-orange-700 data-[highlighted]:bg-orange-50 data-[highlighted]:text-orange-700 data-[state=checked]:bg-orange-50 data-[state=checked]:text-orange-700";
const warmOutlineButtonClassName =
  "border-slate-200 bg-white text-slate-700 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700 active:border-orange-300 active:bg-orange-100/80 active:text-orange-800 focus-visible:border-orange-300 focus-visible:ring-orange-500/10";
const warmPrimaryButtonClassName =
  "bg-orange-600 hover:bg-orange-700 active:bg-orange-800 focus-visible:ring-orange-500/20";
const warmOverlayPanelClassName =
  "[&>button]:hover:bg-orange-50 [&>button]:hover:text-orange-700 [&>button]:focus-visible:ring-orange-500/10";
const warmFileInputClassName =
  "block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition hover:border-orange-200 focus:border-orange-300 focus:ring-4 focus:ring-orange-500/10 focus-visible:border-orange-300 focus-visible:ring-4 focus-visible:ring-orange-500/10 file:mr-4 file:rounded-xl file:border-0 file:bg-orange-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-orange-700";
const utbkScheduleLevel = "UTBK" as const;
const utbkScheduleGeneralGrade = "Program Umum";
const utbkScheduleGradeOptions = [
  utbkScheduleGeneralGrade,
  "Kelas 12",
  "Alumni / Gap Year",
] as const;
const defaultScheduleGradeOptionsByLevel: Record<ScheduleLevel, string[]> = {
  ...defaultAdminDashboardConfig.academic.gradesByLevel,
  UTBK: [...utbkScheduleGradeOptions],
};
const defaultScheduleSubjectOptions = defaultAdminDashboardConfig.schedule.subjects;
const defaultOrderedScheduleDays = defaultAdminDashboardConfig.schedule.days;
const fallbackScheduleStatus: AdminScheduleItem["status"] =
  defaultAdminDashboardConfig.schedule.statuses.find(
    (status) => status === "Siap",
  ) ??
  defaultAdminDashboardConfig.schedule.statuses[0] ??
  "Siap";

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function getScheduleGradeOptions(
  level: string,
  gradeOptionsByLevel: Record<ScheduleLevel, string[]> = defaultScheduleGradeOptionsByLevel,
) {
  const normalizedLevel = normalizeText(level).toUpperCase() as ScheduleLevel;
  return gradeOptionsByLevel[normalizedLevel] ?? [];
}

function buildAcademicClassName(
  level: string,
  grade: string,
  gradeOptionsByLevel: Record<ScheduleLevel, string[]> = defaultScheduleGradeOptionsByLevel,
) {
  const normalizedLevel = normalizeText(level).toUpperCase();
  const normalizedGrade = normalizeText(grade);
  const availableGrades = gradeOptionsByLevel[normalizedLevel as ScheduleLevel];

  if (!availableGrades?.includes(normalizedGrade)) {
    return "";
  }

  if (normalizedLevel === utbkScheduleLevel) {
    return normalizedGrade === utbkScheduleGeneralGrade
      ? utbkScheduleLevel
      : `${utbkScheduleLevel} ${normalizedGrade}`;
  }

  return `${normalizedLevel} ${normalizedGrade}`;
}

function parseAcademicClassName(
  value: string,
  gradeOptionsByLevel: Record<ScheduleLevel, string[]> = defaultScheduleGradeOptionsByLevel,
) {
  const normalizedValue = normalizeText(value);

  if (normalizedValue.toUpperCase() === utbkScheduleLevel) {
    return {
      level: utbkScheduleLevel,
      grade: utbkScheduleGeneralGrade,
    };
  }

  const match = /^([A-Za-z]+)\s+(.+)$/.exec(normalizedValue);

  if (!match) {
    return null;
  }

  const level = match[1].toUpperCase() as ScheduleLevel;
  const grade = match[2];

  if (!gradeOptionsByLevel[level]?.includes(grade)) {
    return null;
  }

  return {
    level,
    grade,
  };
}

function normalizeScheduleSubject(
  value: string,
  subjectOptions: string[] = defaultScheduleSubjectOptions,
) {
  const normalizedValue = normalizeText(value).toLowerCase();

  return (
    subjectOptions.find(
      (subject) => subject.toLowerCase() === normalizedValue,
    ) ?? ""
  );
}

function getScheduleRequestErrorMessage(error: unknown, fallback: string) {
  if (error instanceof AdminApiRequestError) {
    if (error.status === 403) {
      return `${error.message} Login harus memakai akun admin atau owner yang sudah terverifikasi.`;
    }

    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("File import jadwal tidak dapat dibaca."));
    };
    reader.onerror = () => {
      reject(new Error("File import jadwal tidak dapat dibaca."));
    };
    reader.readAsDataURL(file);
  });
}

function getAvailableScheduleDays(
  schedules: AdminScheduleItem[],
  orderedDays: string[] = defaultOrderedScheduleDays,
) {
  const uniqueDays = Array.from(
    new Set(
      schedules
        .map((schedule) => normalizeText(schedule.day))
        .filter((day) => day.length > 0),
    ),
  );
  const dayOrder = new Map(
    orderedDays.map((day, index) => [day.toLowerCase(), index]),
  );

  return uniqueDays.sort((leftDay, rightDay) => {
    const leftIndex = dayOrder.get(leftDay.toLowerCase());
    const rightIndex = dayOrder.get(rightDay.toLowerCase());

    if (leftIndex === undefined && rightIndex === undefined) {
      return leftDay.localeCompare(rightDay, "id-ID");
    }

    if (leftIndex === undefined) {
      return 1;
    }

    if (rightIndex === undefined) {
      return -1;
    }

    return leftIndex - rightIndex;
  });
}

function getDefaultDay(
  schedules: AdminScheduleItem[],
  orderedDays: string[] = defaultOrderedScheduleDays,
) {
  return getAvailableScheduleDays(schedules, orderedDays)[0] ?? orderedDays[0] ?? "";
}

function getDefaultTeacherId(teachers: AdminTeacher[]) {
  return teachers.find((teacher) => teacher.status === "Aktif")?.id ?? "";
}

function createTeacherOptions(
  teachers: AdminTeacher[],
  selectedTeacherId = "",
) {
  const activeTeachers = teachers.filter((teacher) => teacher.status === "Aktif");
  const selectedTeacher = teachers.find((teacher) => teacher.id === selectedTeacherId);
  const optionTeachers =
    selectedTeacher && !activeTeachers.some((teacher) => teacher.id === selectedTeacher.id)
      ? [...activeTeachers, selectedTeacher]
      : activeTeachers;

  return optionTeachers.map((teacher) => ({
    id: teacher.id,
    label: teacher.name,
  }));
}

function createRoomOptions(rooms: ScheduleRoomDirectoryItem[]) {
  return Array.from(
    new Map(
      rooms
        .map((room) => ({
          value: normalizeText(room.name),
          label: `${normalizeText(room.name)}${
            normalizeText(room.floor) ? ` • ${normalizeText(room.floor)}` : ""
          }`,
        }))
        .filter((room) => room.value.length > 0)
        .map((room) => [room.value, room]),
    ).values(),
  );
}

function createEmptyScheduleForm(
  defaultDay = "",
  defaultTeacherId = "",
  defaultStatus: AdminScheduleItem["status"] = fallbackScheduleStatus,
): ScheduleFormValues {
  return {
    day: defaultDay,
    time: "",
    level: "",
    grade: "",
    subject: "",
    teacherId: defaultTeacherId,
    room: "",
    status: defaultStatus,
  };
}

function toScheduleFormValues(
  schedule: AdminScheduleItem,
  subjectOptions: string[] = defaultScheduleSubjectOptions,
  gradeOptionsByLevel: Record<ScheduleLevel, string[]> = defaultScheduleGradeOptionsByLevel,
): ScheduleFormValues {
  const parsedClassName = parseAcademicClassName(
    schedule.className,
    gradeOptionsByLevel,
  );

  return {
    day: schedule.day,
    time: schedule.time,
    level: parsedClassName?.level ?? "",
    grade: parsedClassName?.grade ?? "",
    subject: normalizeScheduleSubject(schedule.subject, subjectOptions),
    teacherId: schedule.teacherId,
    room: schedule.room,
    status: schedule.status,
  };
}

function ScheduleField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-700">{label}</p>
      {children}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-slate-200/80 bg-white/95 p-4 shadow-[0_12px_26px_-22px_rgba(15,23,42,0.14)]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}

function ScheduleActions({
  schedule,
  readOnly = false,
  readOnlyMessage = "",
  onEdit,
  onDelete,
  onToggleStatus,
}: {
  schedule: AdminScheduleItem;
  readOnly?: boolean;
  readOnlyMessage?: string;
  onEdit: (schedule: AdminScheduleItem) => void;
  onDelete: (schedule: AdminScheduleItem) => void;
  onToggleStatus: (schedule: AdminScheduleItem) => void;
}) {
  const isReview = schedule.status === "Review";

  return (
    <div className="flex items-center justify-center gap-1.5">
      <Sheet>
        <SheetTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={`size-9 rounded-xl p-0 text-slate-500 shadow-sm transition ${warmOutlineButtonClassName}`}
            aria-label={`Lihat detail ${schedule.className}`}
            title="Detail"
          >
            <Eye className="size-4" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="right"
          className={`w-[92vw] overflow-y-auto sm:max-w-lg ${warmOverlayPanelClassName}`}
        >
          <SheetHeader>
            <SheetTitle>Detail jadwal</SheetTitle>
            <SheetDescription>
              Ringkasan slot kelas, pengajar, ruangan, dan status jadwal.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-5">
            <div className="rounded-[22px] border border-orange-100/70 bg-gradient-to-r from-orange-50/85 to-white p-4 shadow-[0_16px_32px_-24px_rgba(249,115,22,0.22)]">
              <p className="text-base font-semibold text-slate-950">
                {schedule.className}
              </p>
              <p className="mt-1 text-sm font-medium text-orange-700">
                {schedule.subject || "Mapel belum dipilih"}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {schedule.day}, {schedule.time}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <DetailItem label="Hari" value={schedule.day} />
              <DetailItem label="Jam" value={schedule.time} />
              <DetailItem label="Mapel" value={schedule.subject || "-"} />
              <DetailItem label="Guru" value={schedule.teacher} />
              <DetailItem label="Cabang" value={schedule.branch || "-"} />
              <DetailItem label="Ruangan" value={schedule.room} />
              <DetailItem label="Status" value={schedule.status} />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <AdminStatusBadge status={schedule.status} />
            </div>

            {schedule.conflicts.length ? (
              <div className="rounded-[20px] border border-rose-100/80 bg-rose-50/70 p-4 shadow-[0_12px_26px_-22px_rgba(244,63,94,0.18)]">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-500">
                  Catatan bentrok
                </p>
                <div className="mt-2 space-y-2 text-sm leading-6 text-rose-700">
                  {schedule.conflicts.map((conflict) => (
                    <p key={conflict}>{conflict}</p>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <Button
        type="button"
        variant="outline"
        size="icon"
        className={`size-9 rounded-xl p-0 text-orange-600 shadow-sm transition ${warmOutlineButtonClassName}`}
        aria-label={`Edit ${schedule.className}`}
        title={readOnly ? readOnlyMessage : "Edit"}
        disabled={readOnly}
        onClick={() => onEdit(schedule)}
      >
        <Pencil className="size-4" />
      </Button>

      <Button
        type="button"
        variant="outline"
        size="icon"
        className={
          isReview
            ? "size-9 rounded-xl border-emerald-200 bg-white p-0 text-emerald-600 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 active:border-emerald-300 active:bg-emerald-100/80 focus-visible:ring-orange-500/10"
            : "size-9 rounded-xl border-amber-200 bg-white p-0 text-amber-600 shadow-sm transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 active:border-amber-300 active:bg-amber-100/80 focus-visible:ring-orange-500/10"
        }
        aria-label={
          isReview
            ? `Tandai siap ${schedule.className}`
            : `Tandai review ${schedule.className}`
        }
        title={
          readOnly ? readOnlyMessage : isReview ? "Tandai siap" : "Tandai review"
        }
        disabled={readOnly}
        onClick={() => onToggleStatus(schedule)}
      >
        {isReview ? <Power className="size-4" /> : <PowerOff className="size-4" />}
      </Button>

      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-9 rounded-xl border-rose-200 bg-white p-0 text-rose-600 shadow-sm transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 active:border-rose-300 active:bg-rose-100/80 focus-visible:ring-orange-500/10"
        aria-label={`Hapus ${schedule.className}`}
        title={readOnly ? readOnlyMessage : "Hapus"}
        disabled={readOnly}
        onClick={() => onDelete(schedule)}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

export function AdminSchedule({
  dashboardConfig = defaultAdminDashboardConfig,
  onRefresh,
  globalSearchQuery = "",
}: AdminScheduleProps) {
  const scheduleStatusOptions = dashboardConfig.schedule.statuses;
  const scheduleStatusFilterOptions: ScheduleStatusFilterOption[] = [
    allScheduleStatusFilterLabel,
    ...scheduleStatusOptions,
  ];
  const scheduleLevelOptions: ScheduleLevel[] = [
    ...dashboardConfig.academic.levels,
    utbkScheduleLevel,
  ];
  const scheduleGradeOptionsByLevel: Record<ScheduleLevel, string[]> = {
    ...dashboardConfig.academic.gradesByLevel,
    UTBK: [...utbkScheduleGradeOptions],
  };
  const scheduleSubjectOptions = dashboardConfig.schedule.subjects;
  const scheduleTimeSlotOptions = dashboardConfig.schedule.timeSlots;
  const orderedScheduleDays = dashboardConfig.schedule.days;
  const defaultScheduleStatus =
    scheduleStatusOptions.find((status) => status === "Siap") ??
    scheduleStatusOptions[0] ??
    fallbackScheduleStatus;
  const [schedules, setSchedules] = useState<AdminScheduleItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teacherDirectory, setTeacherDirectory] = useState<AdminTeacher[]>([]);
  const [roomDirectory, setRoomDirectory] =
    useState<ScheduleRoomDirectoryItem[] | null>(null);
  const [isTeacherDirectoryLoading, setIsTeacherDirectoryLoading] =
    useState(false);
  const [isRoomDirectoryLoading, setIsRoomDirectoryLoading] = useState(false);
  const [teacherDirectoryError, setTeacherDirectoryError] =
    useState<string | null>(null);
  const [roomDirectoryError, setRoomDirectoryError] =
    useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dayFilter, setDayFilter] = useState<string>(scheduleDayAllLabel);
  const [statusFilter, setStatusFilter] = useState<ScheduleStatusFilterOption>(
    allScheduleStatusFilterLabel,
  );
  const [academicYearFilter, setAcademicYearFilter] = useState<string>(
    getCurrentAdminAcademicYear,
  );
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(
    null,
  );
  const [scheduleToDelete, setScheduleToDelete] =
    useState<AdminScheduleItem | null>(null);
  const [formValues, setFormValues] = useState<ScheduleFormValues>(() =>
    createEmptyScheduleForm(
      getDefaultDay([], orderedScheduleDays),
      "",
      defaultScheduleStatus,
    ),
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [importInputVersion, setImportInputVersion] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageLimit, setPageLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [summary, setSummary] = useState<AdminSchedulesSummary>({
    totalItems: 0,
    runningCount: 0,
    reviewCount: 0,
    conflictCount: 0,
    scheduledRoomCount: 0,
    roomConflictCount: 0,
  });
  const deferredSearch = useDeferredValue(search);
  const deferredGlobalSearch = useDeferredValue(globalSearchQuery);
  const previousQueryKeyRef = useRef<string | null>(null);
  const resolvedTeachers = teacherDirectory;
  const scheduleDayOptions = getAvailableScheduleDays(
    schedules,
    orderedScheduleDays,
  );
  const scheduleDayFilterOptions = [
    scheduleDayAllLabel,
    ...scheduleDayOptions,
  ];
  const scheduleDayFormOptions = [...orderedScheduleDays];
  const roomOptions = createRoomOptions(roomDirectory ?? []);
  const teacherOptions = createTeacherOptions(
    resolvedTeachers,
    formValues.teacherId,
  );
  const scheduleGradeOptions = getScheduleGradeOptions(
    formValues.level,
    scheduleGradeOptionsByLevel,
  );
  const hasTeacherOptions = teacherOptions.length > 0;
  const hasRoomOptions = roomOptions.length > 0;
  const isTeacherSelectDisabled =
    isTeacherDirectoryLoading || !hasTeacherOptions;
  const isRoomSelectDisabled = isRoomDirectoryLoading || !hasRoomOptions;
  const isSelectedTimeSlotAvailable = scheduleTimeSlotOptions.includes(
    formValues.time,
  );
  const isSelectedRoomAvailable = roomOptions.some(
    (room) => room.value === normalizeText(formValues.room),
  );
  const isSelectedGradeAvailable =
    !formValues.grade || scheduleGradeOptions.includes(formValues.grade);
  const normalizedSelectedSubject = normalizeScheduleSubject(
    formValues.subject,
    scheduleSubjectOptions,
  );
  const selectedTeacher = resolvedTeachers.find(
    (teacher) => teacher.id === formValues.teacherId,
  );
  const editingSchedule = schedules.find(
    (schedule) => schedule.id === editingScheduleId,
  );
  const editingScheduleHasLegacyClassName = Boolean(
    editingSchedule &&
      !parseAcademicClassName(
        editingSchedule.className,
        scheduleGradeOptionsByLevel,
      ),
  );
  const editingScheduleHasLegacySubject = Boolean(
    editingSchedule &&
      !normalizeScheduleSubject(
        editingSchedule.subject,
        scheduleSubjectOptions,
      ),
  );
  const isSelectedTeacherInactive = Boolean(
    selectedTeacher && selectedTeacher.status !== "Aktif",
  );

  const refreshTeacherDirectory = useCallback(async () => {
    setIsTeacherDirectoryLoading(true);

    try {
      const payload = await requestAdminApi<{ teachers: AdminTeacher[] }>(
        "/api/teachers",
        {
          method: "GET",
        },
      );

      setTeacherDirectory(payload.data?.teachers ?? []);
      setTeacherDirectoryError(null);
    } catch (requestError) {
      setTeacherDirectoryError(
        requestError instanceof Error
          ? requestError.message
          : "Gagal memuat daftar guru dari server.",
      );
    } finally {
      setIsTeacherDirectoryLoading(false);
    }
  }, []);

  const refreshRoomDirectory = useCallback(async () => {
    setIsRoomDirectoryLoading(true);

    try {
      const payload = await requestAdminApi<{
        rooms: ScheduleRoomDirectoryItem[];
      }>("/api/rooms", {
        method: "GET",
      });

      setRoomDirectory(payload.data?.rooms ?? []);
      setRoomDirectoryError(null);
    } catch (requestError) {
      setRoomDirectoryError(
        requestError instanceof Error
          ? requestError.message
          : "Gagal memuat master ruangan dari server.",
      );
    } finally {
      setIsRoomDirectoryLoading(false);
    }
  }, []);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void refreshTeacherDirectory();
      void refreshRoomDirectory();
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [refreshRoomDirectory, refreshTeacherDirectory]);

  const combinedSearchQuery = [
    deferredSearch.trim(),
    deferredGlobalSearch.trim(),
  ]
    .filter(Boolean)
    .join(" ");
  const requestKey = [
    combinedSearchQuery.toLowerCase(),
    dayFilter,
    statusFilter,
    academicYearFilter,
    pageLimit,
  ].join("|");

  const refreshSchedules = useCallback(
    async (nextPage: number = page) => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await fetchAdminSchedules({
          page: nextPage,
          limit: pageLimit,
          q: combinedSearchQuery || undefined,
          day: dayFilter === scheduleDayAllLabel ? undefined : dayFilter,
          academicYear: academicYearFilter,
          status:
            statusFilter === allScheduleStatusFilterLabel
              ? undefined
              : statusFilter,
        });

        setSchedules(result.schedules);
        setSummary(result.summary);
        setPage(result.pagination.page);
        setPageLimit(result.pagination.limit);
        setTotalPages(result.pagination.totalPages);
        setTotalItems(result.pagination.totalItems);
        setError(null);
      } catch (requestError) {
        setSchedules([]);
        setSummary({
          totalItems: 0,
          runningCount: 0,
          reviewCount: 0,
          conflictCount: 0,
          scheduledRoomCount: 0,
          roomConflictCount: 0,
        });
        setTotalPages(1);
        setTotalItems(0);
        setError(
          getScheduleRequestErrorMessage(
            requestError,
            "Gagal memuat daftar jadwal.",
          ),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [combinedSearchQuery, dayFilter, page, pageLimit, statusFilter, academicYearFilter],
  );

  const refreshScheduleViews = useCallback(
    async (nextPage: number = page) => {
      await Promise.allSettled([
        refreshSchedules(nextPage),
        Promise.resolve(onRefresh?.()),
      ]);
    },
    [onRefresh, page, refreshSchedules],
  );

  useEffect(() => {
    const filtersChanged =
      previousQueryKeyRef.current !== null &&
      previousQueryKeyRef.current !== requestKey;

    previousQueryKeyRef.current = requestKey;

    if (filtersChanged && page !== 1) {
      setPage(1);
      return;
    }

    const timerId = window.setTimeout(() => {
      void refreshSchedules(page);
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [page, refreshSchedules, requestKey]);

  const orderedSchedules = schedules;
  const filteredSchedules = orderedSchedules;

  const isFirstScheduleOfDay = (index: number) =>
    index === 0 || filteredSchedules[index - 1]?.day !== filteredSchedules[index]?.day;
  const getDayScopedNumber = (index: number) =>
    filteredSchedules
      .slice(0, index + 1)
      .filter((schedule) => schedule.day === filteredSchedules[index]?.day).length;

  const isEditing = editingScheduleId !== null;
  const runningCount = summary.runningCount;
  const reviewCount = summary.reviewCount;
  const conflictCount = summary.conflictCount;
  const academicYearOptions = getAdminAcademicYearOptions(academicYearFilter);
  const academicYearStatus = getAdminAcademicYearStatus(academicYearFilter);
  const academicYearLockMessage =
    getAdminAcademicYearLockMessage(academicYearFilter);
  const isAcademicYearLocked = academicYearStatus.isLocked;

  const openCreateDialog = () => {
    if (isAcademicYearLocked) {
      setActionNotice(academicYearLockMessage);
      return;
    }

    setEditingScheduleId(null);
    setFormValues(
      createEmptyScheduleForm(
        getDefaultDay(schedules, orderedScheduleDays),
        getDefaultTeacherId(resolvedTeachers),
        defaultScheduleStatus,
      ),
    );
    setFormError(null);
    setActionNotice(null);
    setIsFormOpen(true);
    void refreshTeacherDirectory();
    void refreshRoomDirectory();
  };

  const openEditDialog = (schedule: AdminScheduleItem) => {
    if (isAcademicYearLocked) {
      setActionNotice(academicYearLockMessage);
      return;
    }

    setEditingScheduleId(schedule.id);
    setFormValues(
      toScheduleFormValues(
        schedule,
        scheduleSubjectOptions,
        scheduleGradeOptionsByLevel,
      ),
    );
    setFormError(null);
    setActionNotice(null);
    setIsFormOpen(true);
    void refreshTeacherDirectory();
    void refreshRoomDirectory();
  };

  const closeFormDialog = (sourceSchedules = schedules) => {
    setIsFormOpen(false);
    setEditingScheduleId(null);
    setFormValues(
      createEmptyScheduleForm(
        getDefaultDay(sourceSchedules, orderedScheduleDays),
        getDefaultTeacherId(resolvedTeachers),
        defaultScheduleStatus,
      ),
    );
    setFormError(null);
  };

  const closeImportDialog = () => {
    setIsImportOpen(false);
    setImportFile(null);
    setImportError(null);
    setImportInputVersion((currentValue) => currentValue + 1);
  };

  const updateFormValue = <K extends keyof ScheduleFormValues>(
    key: K,
    value: ScheduleFormValues[K],
  ) => {
    setFormValues((currentValues) => ({
      ...currentValues,
      [key]: value,
    }));
  };

  const handleLevelChange = (value: string) => {
    setFormValues((currentValues) => {
      const nextGradeOptions = getScheduleGradeOptions(
        value,
        scheduleGradeOptionsByLevel,
      );

      return {
        ...currentValues,
        level: value,
        grade: nextGradeOptions.includes(currentValues.grade)
          ? currentValues.grade
          : "",
      };
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isAcademicYearLocked) {
      setFormError(academicYearLockMessage);
      return;
    }

    const normalizedDay = normalizeText(formValues.day);
    const normalizedTime = normalizeText(formValues.time);
    const normalizedLevel = normalizeText(formValues.level).toUpperCase();
    const normalizedGrade = normalizeText(formValues.grade);
    const normalizedClassName = buildAcademicClassName(
      normalizedLevel,
      normalizedGrade,
      scheduleGradeOptionsByLevel,
    );
    const normalizedSubject = normalizeScheduleSubject(
      formValues.subject,
      scheduleSubjectOptions,
    );
    const normalizedTeacherId = normalizeText(formValues.teacherId);
    const normalizedRoom = normalizeText(formValues.room);

    if (!normalizedDay) {
      setFormError("Hari jadwal wajib dipilih.");
      return;
    }

    if (!normalizedTime) {
      setFormError("Jam jadwal wajib diisi.");
      return;
    }

    if (!scheduleTimeSlotOptions.includes(normalizedTime)) {
      setFormError("Jam jadwal wajib dipilih dari slot yang tersedia.");
      return;
    }

    if (!normalizedLevel) {
      setFormError("Jenjang kelas wajib dipilih.");
      return;
    }

    if (!scheduleLevelOptions.includes(normalizedLevel as ScheduleLevel)) {
      setFormError("Jenjang kelas wajib dipilih dari opsi yang tersedia.");
      return;
    }

    if (!normalizedGrade) {
      setFormError("Kelas akademik wajib dipilih.");
      return;
    }

    if (
      !scheduleGradeOptionsByLevel[normalizedLevel as ScheduleLevel]?.includes(
        normalizedGrade,
      )
    ) {
      setFormError("Kelas akademik wajib dipilih dari opsi yang tersedia.");
      return;
    }

    if (!normalizedClassName) {
      setFormError("Format kelas akademik belum valid.");
      return;
    }

    if (!normalizedSubject) {
      setFormError("Mata pelajaran wajib dipilih.");
      return;
    }

    if (!normalizedTeacherId) {
      setFormError("Guru wajib dipilih.");
      return;
    }

    if (!normalizedRoom) {
      setFormError("Ruangan wajib diisi.");
      return;
    }

    if (!roomOptions.some((room) => room.value === normalizedRoom)) {
      setFormError("Ruangan wajib dipilih dari master ruangan yang tersedia.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      await requestAdminApi<{ schedule: AdminScheduleItem }>(
        editingScheduleId
          ? `/api/schedules/${encodeURIComponent(editingScheduleId)}`
          : "/api/schedules",
        {
          method: editingScheduleId ? "PUT" : "POST",
          body: JSON.stringify({
            day: normalizedDay,
            time: normalizedTime,
            className: normalizedClassName,
            subject: normalizedSubject,
            teacherId: normalizedTeacherId,
            room: normalizedRoom,
            status: formValues.status,
            academicYear: academicYearFilter,
          }),
        },
      );

      await refreshScheduleViews();
      closeFormDialog();
      setActionNotice(
        editingScheduleId
          ? "Jadwal berhasil diperbarui."
          : "Jadwal berhasil ditambahkan."
      );
    } catch (requestError) {
      setFormError(
        getScheduleRequestErrorMessage(
          requestError,
          "Gagal menyimpan data jadwal.",
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (schedule: AdminScheduleItem) => {
    if (isAcademicYearLocked) {
      setFormError(academicYearLockMessage);
      return;
    }

    const nextStatus: AdminScheduleItem["status"] =
      schedule.status === "Review" ? "Siap" : "Review";
    const parsedClassName = parseAcademicClassName(
      schedule.className,
      scheduleGradeOptionsByLevel,
    );
    const normalizedSubject = normalizeScheduleSubject(
      schedule.subject,
      scheduleSubjectOptions,
    );

    if (!parsedClassName) {
      openEditDialog(schedule);
      setFormError(
        "Jadwal ini masih memakai format kelas lama. Pilih jenjang dan kelas akademik sebelum mengubah status.",
      );
      return;
    }

    if (!normalizedSubject) {
      openEditDialog(schedule);
      setFormError(
        "Jadwal ini belum punya mata pelajaran yang valid. Pilih mapel sebelum mengubah status.",
      );
      return;
    }

    try {
      await requestAdminApi<{ schedule: AdminScheduleItem }>(
        `/api/schedules/${encodeURIComponent(schedule.id)}`,
        {
          method: "PUT",
          body: JSON.stringify({
            day: schedule.day,
            time: schedule.time,
            className: buildAcademicClassName(
              parsedClassName.level,
              parsedClassName.grade,
              scheduleGradeOptionsByLevel,
            ),
            subject: normalizedSubject,
            teacherId: schedule.teacherId,
            room: schedule.room,
            status: nextStatus,
            academicYear: academicYearFilter,
          }),
        },
      );
      await refreshScheduleViews();
    } catch (requestError) {
      setFormError(
        getScheduleRequestErrorMessage(
          requestError,
          "Gagal memperbarui status jadwal.",
        ),
      );
    }
  };

  const handleDelete = async () => {
    if (!scheduleToDelete) {
      return;
    }

    if (isAcademicYearLocked) {
      setFormError(academicYearLockMessage);
      setScheduleToDelete(null);
      return;
    }

    setIsDeleting(true);

    try {
      await requestAdminApi(`/api/schedules/${encodeURIComponent(scheduleToDelete.id)}`, {
        method: "DELETE",
      });
      await refreshScheduleViews();
      setScheduleToDelete(null);
      setActionNotice("Jadwal berhasil dihapus.");
    } catch (requestError) {
      setFormError(
        getScheduleRequestErrorMessage(
          requestError,
          "Gagal menghapus data jadwal.",
        ),
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExport = async () => {
    if (!filteredSchedules.length) {
      return;
    }

    try {
      await exportAdminSchedulesCsv({
        q: combinedSearchQuery || undefined,
        day: dayFilter === scheduleDayAllLabel ? undefined : dayFilter,
        status: statusFilter === "Semua" ? undefined : statusFilter,
        academicYear: academicYearFilter,
      });
    } catch (requestError) {
      setFormError(
        getScheduleRequestErrorMessage(
          requestError,
          "Gagal mengunduh export jadwal.",
        ),
      );
    }
  };

  const handleImportFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setImportFile(event.target.files?.[0] ?? null);
    setImportError(null);
  };

  const handleImportSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isAcademicYearLocked) {
      setImportError(academicYearLockMessage);
      return;
    }

    if (!importFile) {
      setImportError("Pilih file CSV atau Excel terlebih dahulu.");
      return;
    }

    setIsImporting(true);
    setImportError(null);

    try {
      const fileDataUrl = await readFileAsDataUrl(importFile);
      const fileDataBase64 = fileDataUrl.includes(",")
        ? (fileDataUrl.split(",")[1] ?? "")
        : fileDataUrl;
      const result = await importAdminSchedules({
        fileName: importFile.name,
        fileDataBase64,
        academicYear: academicYearFilter,
      });

      if (!result.summary.successCount) {
        setImportError(
          result.errorRows[0]?.reason ??
            "Tidak ada baris valid yang berhasil diimpor.",
        );
        return;
      }

      await refreshScheduleViews();
      setActionNotice(
        `${result.summary.successCount} jadwal berhasil diimpor${
          result.summary.failedCount
            ? `, ${result.summary.failedCount} baris gagal`
            : ""
        }.`,
      );
      closeImportDialog();
    } catch (requestError) {
      setImportError(
        getScheduleRequestErrorMessage(
          requestError,
          "Gagal mengimpor data jadwal.",
        ),
      );
    } finally {
      setIsImporting(false);
    }
  };

  const columns: AdminColumnDefinition<AdminScheduleItem>[] = [
    {
      key: "number",
      header: "No",
      className: "w-16 text-center",
      cell: (_schedule, index) => (
        <span className="text-sm font-semibold text-slate-500">
          {getDayScopedNumber(index)}
        </span>
      ),
    },
    {
      key: "day",
      header: "Hari / Jam",
      cell: (schedule) => (
        <div>
          <p className="text-sm text-slate-500">{schedule.time}</p>
        </div>
      ),
    },
    {
      key: "className",
      header: "Kelas",
      cell: (schedule) => (
        <div>
          <p className="font-semibold text-slate-950">{schedule.className}</p>
          <p className="text-sm text-slate-500">
            {schedule.subject || "Mapel belum dipilih"}
          </p>
        </div>
      ),
    },
    {
      key: "teacher",
      header: "Guru",
      cell: (schedule) => (
        <div>
          <p className="font-medium text-slate-800">{schedule.teacher}</p>
          <p className="text-sm text-slate-500">{schedule.branch || "-"}</p>
        </div>
      ),
    },
    {
      key: "room",
      header: "Ruangan",
      cell: (schedule) => schedule.room,
    },
    {
      key: "status",
      header: "Status",
      cell: (schedule) => (
        <div className="space-y-2">
          <AdminStatusBadge status={schedule.status} />
          {schedule.conflicts.length ? (
            <p className="max-w-[280px] text-sm leading-6 text-rose-600">
              {schedule.conflicts[0]}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Aksi",
      cell: (schedule) => (
        <ScheduleActions
          schedule={schedule}
          readOnly={isAcademicYearLocked}
          readOnlyMessage={academicYearLockMessage}
          onEdit={openEditDialog}
          onDelete={setScheduleToDelete}
          onToggleStatus={handleToggleStatus}
        />
      ),
      className: "w-[196px] text-center",
    },
  ];

  return (
    <>
      <AdminSectionCard
        title="Kelola jadwal"
        description="Kelola jadwal kelas, ubah slot belajar, dan atur status jadwal."
        square
        action={
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Button
              variant="secondary"
              className={warmPrimaryButtonClassName}
              onClick={openCreateDialog}
              disabled={isAcademicYearLocked}
              title={isAcademicYearLocked ? academicYearLockMessage : "Tambah Data"}
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">Tambah Data</span>
              <span className="inline sm:hidden">Tambah</span>
            </Button>
            <Button
              variant="outline"
              className={warmOutlineButtonClassName}
              onClick={handleExport}
              disabled={!filteredSchedules.length}
            >
              <Download className="size-4" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button
              variant="outline"
              className={warmOutlineButtonClassName}
              onClick={() => setIsImportOpen(true)}
              disabled={isAcademicYearLocked}
              title={isAcademicYearLocked ? academicYearLockMessage : "Import"}
            >
              <Upload className="size-4" />
              <span className="hidden sm:inline">Import</span>
            </Button>
          </div>
        }
      >
        {isLoading ? (
          <AdminSummaryLineSkeleton className="mb-4" />
        ) : (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <span>
            Menampilkan {filteredSchedules.length} dari {totalItems} jadwal.
          </span>
          <Badge variant="secondary" className="bg-slate-100 text-slate-700">
            Berjalan {runningCount}
          </Badge>
          <Badge variant="secondary" className="bg-slate-100 text-slate-700">
            Review {reviewCount}
          </Badge>
          <Badge variant="secondary" className="bg-slate-100 text-slate-700">
            Bentrok {conflictCount}
          </Badge>
          <Badge
            variant="secondary"
            className={
              academicYearStatus.isActive
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-700"
            }
          >
            {academicYearStatus.label} {academicYearStatus.academicYear}
          </Badge>
        </div>
        )}

        {isAcademicYearLocked ? (
          <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-700">
            {academicYearLockMessage}
          </div>
        ) : null}

        {actionNotice ? (
          <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {actionNotice}
          </div>
        ) : null}

        {error ? (
          <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {error}
          </div>
        ) : null}

        <div className="mb-6 flex flex-col gap-3 md:flex-row md:flex-wrap">
          <div className="w-full md:flex-1">
            <Input
              className={warmFieldClassName}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari hari, jam, kelas, mapel, guru, cabang, ruangan, atau status..."
            />
          </div>

          <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto sm:flex-wrap">
            <div className="w-full sm:w-[160px]">
              <Select
                value={academicYearFilter}
                onValueChange={setAcademicYearFilter}
              >
                <SelectTrigger className={warmSelectTriggerClassName}>
                  <SelectValue placeholder="Tahun Ajaran" />
                </SelectTrigger>
                <SelectContent className={warmSelectContentClassName}>
                  {academicYearOptions.map((option) => (
                    <SelectItem
                      key={option}
                      value={option}
                      className={warmSelectItemClassName}
                    >
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-full sm:w-[160px]">
              <Select
                value={dayFilter}
                onValueChange={setDayFilter}
              >
                <SelectTrigger className={warmSelectTriggerClassName}>
                  <SelectValue placeholder="Hari" />
                </SelectTrigger>
                <SelectContent className={warmSelectContentClassName}>
                  {scheduleDayFilterOptions.map((option) => (
                    <SelectItem
                      key={option}
                      value={option}
                      className={warmSelectItemClassName}
                    >
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 w-full sm:col-span-1 sm:w-[160px]">
              <Select
                value={statusFilter}
                onValueChange={(value) =>
                  setStatusFilter(value as ScheduleStatusFilterOption)
                }
              >
                <SelectTrigger className={warmSelectTriggerClassName}>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className={warmSelectContentClassName}>
                  {scheduleStatusFilterOptions.map((option) => (
                    <SelectItem
                      key={option}
                      value={option}
                      className={warmSelectItemClassName}
                    >
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <AdminDataTable
          columns={columns}
          data={filteredSchedules}
          keyExtractor={(schedule) => schedule.id}
          renderBeforeRow={(schedule, index) =>
            isFirstScheduleOfDay(index) ? (
              <TableRow
                key={`group-${schedule.day}-${schedule.id}`}
                className="hover:bg-transparent"
              >
                <TableCell
                  colSpan={columns.length}
                  className={`border-0 bg-white px-0 ${index === 0 ? "pt-0 pb-3" : "pt-6 pb-3"}`}
                >
                  <div className="flex items-center gap-3 rounded-[18px] border border-slate-200/80 bg-gradient-to-r from-slate-50 via-white to-orange-50/35 px-4 py-3 shadow-[0_12px_24px_-22px_rgba(15,23,42,0.14)]">
                    <span className="inline-flex rounded-full border border-orange-200/80 bg-orange-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-700">
                      {schedule.day}
                    </span>
                    <span className="text-sm text-slate-500">
                      Jadwal khusus hari {schedule.day}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : null
          }
          emptyTitle="Tidak ada jadwal yang cocok"
          emptyDescription="Coba ubah kata kunci pencarian atau kombinasi filter."
          isLoading={isLoading}
          square
          getRowClassName={(schedule) =>
            schedule.status === "Bentrok"
              ? "bg-rose-50/40 hover:bg-rose-50/60"
              : undefined
          }
          minWidthClassName="min-w-[1240px]"
        />
        <div className="mt-4">
          <AdminPaginationFooter
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            visibleCount={filteredSchedules.length}
            limit={pageLimit}
            isLoading={isLoading}
            label="jadwal"
            onPrevious={() => {
              setPage((currentPage) => Math.max(1, currentPage - 1));
            }}
            onNext={() => {
              setPage((currentPage) => Math.min(totalPages, currentPage + 1));
            }}
          />
        </div>
      </AdminSectionCard>

      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeFormDialog();
          }
        }}
      >
        <DialogContent
          className={`max-h-[85vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] sm:max-w-3xl ${warmOverlayPanelClassName}`}
        >
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit jadwal" : "Tambah jadwal baru"}
            </DialogTitle>
            <DialogDescription>
              Isi hari, jam, kelas akademik, mata pelajaran, guru, ruangan, dan status jadwal kelas.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <ScheduleField label="Hari">
                <Select
                  value={formValues.day}
                  onValueChange={(value) => updateFormValue("day", value)}
                >
                  <SelectTrigger className={warmSelectTriggerClassName}>
                    <SelectValue placeholder="Pilih hari" />
                  </SelectTrigger>
                  <SelectContent className={warmSelectContentClassName}>
                    {scheduleDayFormOptions.map((option) => (
                      <SelectItem
                        key={option}
                        value={option}
                        className={warmSelectItemClassName}
                      >
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ScheduleField>

              <ScheduleField label="Jam">
                <Select
                  value={isSelectedTimeSlotAvailable ? formValues.time : ""}
                  onValueChange={(value) => updateFormValue("time", value)}
                >
                  <SelectTrigger className={warmSelectTriggerClassName}>
                    <SelectValue placeholder="Pilih slot jadwal" />
                  </SelectTrigger>
                  <SelectContent className={warmSelectContentClassName}>
                    {scheduleTimeSlotOptions.map((option) => (
                      <SelectItem
                        key={option}
                        value={option}
                        className={warmSelectItemClassName}
                      >
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isEditing && formValues.time && !isSelectedTimeSlotAvailable ? (
                  <p className="text-xs text-amber-600">
                    Jadwal ini memakai format jam lama. Pilih salah satu slot
                    jadwal yang tersedia sebelum menyimpan perubahan.
                  </p>
                ) : null}
                <p className="text-xs leading-5 text-slate-500">
                  Tombol Mulai Absen siswa otomatis muncul hanya saat hari dan
                  jam ini sedang berlangsung.
                </p>
              </ScheduleField>

              <ScheduleField label="Jenjang">
                <Select
                  value={formValues.level}
                  onValueChange={handleLevelChange}
                >
                  <SelectTrigger className={warmSelectTriggerClassName}>
                    <SelectValue placeholder="Pilih jenjang" />
                  </SelectTrigger>
                  <SelectContent className={warmSelectContentClassName}>
                    {scheduleLevelOptions.map((option) => (
                      <SelectItem
                        key={option}
                        value={option}
                        className={warmSelectItemClassName}
                      >
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isEditing &&
                editingScheduleHasLegacyClassName &&
                !formValues.level ? (
                  <p className="text-xs text-amber-600">
                    Jadwal ini masih memakai format kelas lama. Pilih ulang
                    jenjang akademik sebelum menyimpan perubahan.
                  </p>
                ) : null}
              </ScheduleField>

              <ScheduleField label="Kelas">
                <Select
                  value={isSelectedGradeAvailable ? formValues.grade : ""}
                  onValueChange={(value) => updateFormValue("grade", value)}
                  disabled={!formValues.level}
                >
                  <SelectTrigger className={warmSelectTriggerClassName}>
                    <SelectValue
                      placeholder={
                        formValues.level
                          ? "Pilih kelas"
                          : "Pilih jenjang terlebih dahulu"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className={warmSelectContentClassName}>
                    {scheduleGradeOptions.map((option) => (
                      <SelectItem
                        key={option}
                        value={option}
                        className={warmSelectItemClassName}
                      >
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isEditing &&
                editingScheduleHasLegacyClassName &&
                !formValues.grade ? (
                  <p className="text-xs text-amber-600">
                    Kelas pada jadwal lama belum sesuai format `SD 4`, `SMP 8`,
                    `SMA 11`, atau `UTBK`. Pilih ulang kelas akademik sebelum
                    menyimpan perubahan.
                  </p>
                ) : null}
              </ScheduleField>

              <ScheduleField label="Mata pelajaran">
                <Select
                  value={normalizedSelectedSubject}
                  onValueChange={(value) => updateFormValue("subject", value)}
                >
                  <SelectTrigger className={warmSelectTriggerClassName}>
                    <SelectValue placeholder="Pilih mata pelajaran" />
                  </SelectTrigger>
                  <SelectContent className={warmSelectContentClassName}>
                    {scheduleSubjectOptions.map((option) => (
                      <SelectItem
                        key={option}
                        value={option}
                        className={warmSelectItemClassName}
                      >
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isEditing &&
                editingScheduleHasLegacySubject &&
                !normalizedSelectedSubject ? (
                  <p className="text-xs text-amber-600">
                    Jadwal ini belum punya mapel yang valid. Pilih mata
                    pelajaran sebelum menyimpan perubahan.
                  </p>
                ) : null}
              </ScheduleField>

              <ScheduleField label="Guru">
                <Select
                  value={formValues.teacherId}
                  onValueChange={(value) =>
                    updateFormValue("teacherId", value)
                  }
                  disabled={isTeacherSelectDisabled}
                >
                  <SelectTrigger className={warmSelectTriggerClassName}>
                    <SelectValue
                      placeholder={
                        isTeacherDirectoryLoading
                          ? "Memuat guru..."
                          : hasTeacherOptions
                            ? "Pilih guru"
                            : "Belum ada guru aktif"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent
                    side="bottom"
                    sideOffset={10}
                    avoidCollisions={false}
                    className={`${warmSelectContentClassName} max-h-[min(18rem,var(--radix-select-content-available-height))]`}
                  >
                    {teacherOptions.map((teacher) => (
                      <SelectItem
                        key={teacher.id}
                        value={teacher.id}
                        className={warmSelectItemClassName}
                      >
                        {teacher.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isTeacherDirectoryLoading ? (
                  <Skeleton className="h-3 w-56" />
                ) : null}
                {teacherDirectoryError ? (
                  <p className="text-xs text-rose-600">
                    {teacherDirectoryError}
                  </p>
                ) : null}
                {!isTeacherDirectoryLoading && !hasTeacherOptions ? (
                  <p className="text-xs text-amber-600">
                    Belum ada guru aktif yang bisa dipilih untuk jadwal baru.
                  </p>
                ) : null}
                {isSelectedTeacherInactive ? (
                  <p className="text-xs text-amber-600">
                    Jadwal ini masih terhubung ke guru nonaktif, tetapi tetap
                    ditampilkan agar data lama bisa diedit.
                  </p>
                ) : null}
              </ScheduleField>

              <ScheduleField label="Ruangan">
                <Select
                  value={
                    isSelectedRoomAvailable ? normalizeText(formValues.room) : ""
                  }
                  onValueChange={(value) => updateFormValue("room", value)}
                  disabled={isRoomSelectDisabled}
                >
                  <SelectTrigger className={warmSelectTriggerClassName}>
                    <SelectValue
                      placeholder={
                        isRoomDirectoryLoading
                          ? "Memuat ruangan..."
                          : hasRoomOptions
                            ? "Pilih ruangan"
                            : "Data ruangan belum tersedia"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent
                    side="bottom"
                    sideOffset={10}
                    avoidCollisions={false}
                    className={`${warmSelectContentClassName} max-h-[min(18rem,var(--radix-select-content-available-height))]`}
                  >
                    {roomOptions.map((room) => (
                      <SelectItem
                        key={room.value}
                        value={room.value}
                        className={warmSelectItemClassName}
                      >
                        {room.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isRoomDirectoryLoading ? (
                  <Skeleton className="h-3 w-52" />
                ) : null}
                {roomDirectoryError ? (
                  <p className="text-xs text-rose-600">{roomDirectoryError}</p>
                ) : null}
                {!isRoomDirectoryLoading && !hasRoomOptions ? (
                  <p className="text-xs text-amber-600">
                    Data ruangan belum tersedia. Tambahkan master ruangan di
                    sistem pusat terlebih dahulu.
                  </p>
                ) : null}
                {isEditing && formValues.room && !isSelectedRoomAvailable ? (
                  <p className="text-xs text-amber-600">
                    Ruangan pada jadwal ini belum ada di master ruangan saat
                    ini. Pilih ruangan yang tersedia sebelum menyimpan
                    perubahan.
                  </p>
                ) : null}
              </ScheduleField>

              <ScheduleField label="Status">
                <Select
                  value={formValues.status}
                  onValueChange={(value) =>
                    updateFormValue(
                      "status",
                      value as AdminScheduleItem["status"],
                    )
                  }
                >
                  <SelectTrigger className={warmSelectTriggerClassName}>
                    <SelectValue placeholder="Pilih status" />
                  </SelectTrigger>
                  <SelectContent className={warmSelectContentClassName}>
                    {scheduleStatusOptions.map((option) => (
                      <SelectItem
                        key={option}
                        value={option}
                        className={warmSelectItemClassName}
                      >
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ScheduleField>
            </div>

            {formError ? (
              <p className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-600">
                {formError}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className={warmOutlineButtonClassName}
                onClick={() => closeFormDialog()}
              >
                Batal
              </Button>
              <Button
                type="submit"
                variant="secondary"
                className={warmPrimaryButtonClassName}
                disabled={
                  isSubmitting ||
                  isRoomDirectoryLoading ||
                  !hasRoomOptions ||
                  isAcademicYearLocked
                }
              >
                {isSubmitting
                  ? "Menyimpan..."
                  : isEditing
                    ? "Simpan perubahan"
                    : "Tambah jadwal"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isImportOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeImportDialog();
          }
        }}
      >
        <DialogContent className={`max-h-[85vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] sm:max-w-xl ${warmOverlayPanelClassName}`}>
          <DialogHeader>
            <DialogTitle>Import data jadwal</DialogTitle>
            <DialogDescription>
              Unggah file CSV atau Excel untuk menambahkan jadwal menggunakan format standar.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-5" onSubmit={handleImportSubmit}>
            <div className="rounded-[22px] border border-slate-200/80 bg-gradient-to-r from-white to-orange-50/45 px-4 py-3 text-sm leading-6 text-slate-600 shadow-[0_12px_26px_-22px_rgba(249,115,22,0.16)]">
              Kolom minimal yang wajib ada: {requiredImportColumns.join(", ")}.
            </div>

            <ScheduleField label="File CSV / Excel">
              <input
                key={importInputVersion}
                type="file"
                accept=".csv,text/csv,.xlsx,.xls"
                onChange={handleImportFileChange}
                className={warmFileInputClassName}
              />
            </ScheduleField>

            {importError ? (
              <p className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-600">
                {importError}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className={warmOutlineButtonClassName}
                onClick={closeImportDialog}
              >
                Batal
              </Button>
              <Button
                type="submit"
                variant="secondary"
                className={warmPrimaryButtonClassName}
                disabled={isImporting || isAcademicYearLocked}
              >
                {isImporting ? "Mengimpor..." : "Import File"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(scheduleToDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setScheduleToDelete(null);
          }
        }}
      >
        <DialogContent className={warmOverlayPanelClassName}>
          <DialogHeader>
            <DialogTitle>Hapus jadwal</DialogTitle>
            <DialogDescription>
              Jadwal yang dihapus akan hilang dari tabel yang sedang aktif.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-[22px] border border-slate-200/80 bg-gradient-to-r from-white to-orange-50/45 px-4 py-3 text-sm leading-6 text-slate-600 shadow-[0_12px_26px_-22px_rgba(249,115,22,0.16)]">
            {scheduleToDelete
              ? `Hapus jadwal ${scheduleToDelete.className} pada ${scheduleToDelete.day}, ${scheduleToDelete.time}?`
              : "Pilih jadwal yang ingin dihapus."}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className={warmOutlineButtonClassName}
              onClick={() => setScheduleToDelete(null)}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="focus-visible:ring-orange-500/10"
              disabled={isDeleting}
              onClick={handleDelete}
            >
              {isDeleting ? "Menghapus..." : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
