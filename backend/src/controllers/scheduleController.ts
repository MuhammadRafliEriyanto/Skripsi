import { Types } from "mongoose";
import type { NextFunction, Request, Response } from "express";

import {
  Schedule,
  SCHEDULE_STATUSES,
  SCHEDULE_SUBJECTS,
  type ScheduleStatus,
  type ScheduleDocument,
} from "../models/Schedule";
import { Room } from "../models/Room";
import { Teacher, type TeacherDocument } from "../models/Teacher";
import { User } from "../models/User";
import type { PublicSchedule } from "../utils/adminView";
import { assertAdminAcademicPeriodEditable } from "../utils/adminAcademicArchive";
import asyncHandler from "../utils/asyncHandler";
import {
  assertBranchAccess,
  matchesBranchScope,
  resolveAdminBranchScope,
  type AdminBranchScope,
} from "../utils/adminBranchScope";
import { AppError, sendSuccess } from "../utils/apiResponse";
import { buildCsvContent } from "../utils/csv";
import { getCurrentAcademicPeriod } from "../utils/academicGrade";
import { getNextPublicId } from "../utils/publicId";
import { parseScheduleImportWorkbook } from "../utils/scheduleImport";
import {
  buildSchedulePresentation,
  type ScheduleWithTeacher,
} from "../utils/scheduleConflicts";
import { normalizeCanonicalClassName } from "../utils/studentClass";
import { syncTeacherScheduleStats } from "../utils/teacherStats";
import { normalizeUtbkScheduleClassName } from "../utils/studentProgram";

type ScheduleRequestBody = {
  day?: string;
  time?: string;
  className?: string;
  branch?: string;
  subject?: string;
  teacherId?: string;
  room?: string;
  status?: string;
  academicYear?: string;
};

type ScheduleImportRequestBody = {
  fileName?: string;
  fileDataBase64?: string;
  academicYear?: string;
};

type ScheduleListQuery = {
  page?: string;
  limit?: string;
  q?: string;
  sort?: string;
  status?: string;
  branch?: string;
  className?: string;
  day?: string;
  academicYear?: string;
};

type ScheduleImportErrorRow = {
  rowNumber: number;
  day: string;
  time: string;
  className: string;
  teacher: string;
  room: string;
  reason: string;
};

type ScheduleImportTeacherLookup = {
  _id: Types.ObjectId;
  branch?: string;
  branches?: string[];
  userId: {
    nama: string;
  } | null;
  capableGrades?: string[];
};

type ScheduleListSummary = {
  totalItems: number;
  runningCount: number;
  reviewCount: number;
  conflictCount: number;
  scheduledRoomCount: number;
  roomConflictCount: number;
};

type ScheduleListEntry = {
  schedule: PublicSchedule;
  createdAt: Date;
};

const academicGradesByLevel = {
  SD: ["4", "5", "6"],
  SMP: ["7", "8", "9"],
  SMA: ["10", "11", "12"],
} as const;

type AcademicLevel = keyof typeof academicGradesByLevel;

const orderedScheduleDays = [
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
  "Minggu",
] as const;

const scheduleDayOrderMap = new Map(
  orderedScheduleDays.map((day, index) => [day.toLowerCase(), index]),
);

function normalizeText(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function tokenizeSearchQuery(value: string | undefined) {
  return normalizeText(value)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function matchesSearchQuery(tokens: string[], values: string[]) {
  if (!tokens.length) {
    return true;
  }

  const normalizedValues = values.map((value) => value.toLowerCase());

  return tokens.every((token) =>
    normalizedValues.some((value) => value.includes(token)),
  );
}

function parsePositiveIntegerParam(
  value: string | undefined,
  fallbackValue: number,
  options: {
    min?: number;
    max?: number;
    fieldName: string;
  },
) {
  if (!value) {
    return fallbackValue;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue)) {
    throw new AppError(400, `${options.fieldName} harus berupa angka bulat.`);
  }

  if (options.min !== undefined && parsedValue < options.min) {
    throw new AppError(400, `${options.fieldName} minimal ${options.min}.`);
  }

  if (options.max !== undefined && parsedValue > options.max) {
    throw new AppError(400, `${options.fieldName} maksimal ${options.max}.`);
  }

  return parsedValue;
}

function resolveCreatedAt(value: Date | string | null | undefined) {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string") {
    const parsedDate = new Date(value);

    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  }

  return new Date(0);
}

function normalizeAcademicClassName(value: string | undefined): string {
  const normalizedValue = normalizeText(value);
  const utbkClassName = normalizeUtbkScheduleClassName(normalizedValue);

  if (utbkClassName) {
    return utbkClassName;
  }

  const match = /^(SD|SMP|SMA)\s+(\d{1,2})$/i.exec(normalizedValue);

  if (!match) {
    return "";
  }

  const level = match[1].toUpperCase() as AcademicLevel;
  const grade = match[2];
  const allowedGrades = academicGradesByLevel[level] as readonly string[];

  if (!allowedGrades.includes(grade)) {
    return "";
  }

  return `${level} ${grade}`;
}

function normalizeScheduleClassFilter(value: string | undefined) {
  const normalizedValue = normalizeText(value);
  return (
    normalizeUtbkScheduleClassName(normalizedValue) ||
    normalizeCanonicalClassName(normalizedValue) ||
    ""
  );
}

function normalizeScheduleSubject(value: string | undefined): string {
  const normalizedValue = normalizeText(value).toLowerCase();

  return (
    SCHEDULE_SUBJECTS.find(
      (subject) => subject.toLowerCase() === normalizedValue,
    ) ?? ""
  );
}

function normalizeScheduleStatus(value: string | undefined): ScheduleStatus {
  const normalizedValue = normalizeText(value).toLowerCase();

  if (normalizedValue === "berjalan") {
    return "Berjalan";
  }

  if (normalizedValue === "review") {
    return "Review";
  }

  if (normalizedValue === "bentrok") {
    return "Bentrok";
  }

  return "Siap";
}

function decodeImportFileData(value: string | undefined): Buffer | null {
  const trimmedValue = value?.trim() ?? "";

  if (!trimmedValue) {
    return null;
  }

  const normalizedValue = trimmedValue.includes(",")
    ? trimmedValue.slice(trimmedValue.indexOf(",") + 1)
    : trimmedValue;

  try {
    return Buffer.from(normalizedValue, "base64");
  } catch {
    return null;
  }
}

function getScheduleDayOrder(day: string) {
  return scheduleDayOrderMap.get(normalizeText(day).toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
}

function getScheduleTimeOrder(time: string) {
  const [startTime] = normalizeText(time).split("-");

  if (!startTime) {
    return Number.MAX_SAFE_INTEGER;
  }

  const matchedTime = startTime.trim().match(/^(\d{1,2}):(\d{2})$/);

  if (!matchedTime) {
    return Number.MAX_SAFE_INTEGER;
  }

  const hours = Number(matchedTime[1] ?? "0");
  const minutes = Number(matchedTime[2] ?? "0");

  return hours * 60 + minutes;
}

function getScheduleSequence(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : Number.MAX_SAFE_INTEGER;
}

async function findTeacherByPublicId(teacherId: string): Promise<TeacherDocument | null> {
  return Teacher.findOne({
    $or: [
      { teacherId },
      ...(Types.ObjectId.isValid(teacherId) ? [{ _id: teacherId }] : []),
    ],
  }).exec();
}

function getTeacherBranches(teacher: Pick<TeacherDocument, "branch" | "branches">) {
  return Array.from(
    new Set(
      [teacher.branch, ...(teacher.branches ?? [])]
        .map((branch) => normalizeText(branch))
        .filter(Boolean),
    ),
  );
}

function resolveScheduleBranch(options: {
  requestedBranch?: string;
  existingBranch?: string;
  teacher: Pick<TeacherDocument, "branch" | "branches">;
  scope: AdminBranchScope;
}) {
  const teacherBranches = getTeacherBranches(options.teacher);
  const requestedBranch = normalizeText(options.requestedBranch);
  const existingBranch = normalizeText(options.existingBranch);
  const scopedDefault = options.scope.isScopedToManagedBranches
    ? options.scope.managedBranches.find((branch) =>
        teacherBranches.some(
          (teacherBranch) => teacherBranch.toLowerCase() === branch.toLowerCase(),
        ),
      ) ?? ""
    : "";
  const branch = requestedBranch || existingBranch || scopedDefault || teacherBranches[0] || "";

  if (!branch) {
    throw new AppError(400, "Cabang jadwal wajib dipilih.");
  }

  if (
    teacherBranches.length > 0 &&
    !teacherBranches.some(
      (teacherBranch) => teacherBranch.toLowerCase() === branch.toLowerCase(),
    )
  ) {
    throw new AppError(400, "Guru tidak terhubung ke cabang jadwal yang dipilih.");
  }

  assertBranchAccess(branch, options.scope);
  return branch;
}

async function findScheduleByParam(id: string): Promise<ScheduleDocument | null> {
  return Schedule.findOne({
    $or: [
      { scheduleId: id },
      ...(Types.ObjectId.isValid(id) ? [{ _id: id }] : []),
    ],
  }).exec();
}

async function getScheduleTeacherBranch(schedule: ScheduleDocument): Promise<string> {
  const scheduleBranch = normalizeText(schedule.branch);

  if (scheduleBranch) {
    return scheduleBranch;
  }

  const teacher = await Teacher.findById(schedule.teacherId).select("branch").lean().exec();

  return normalizeText(teacher?.branch);
}

async function findDuplicateScheduleInBranch(options: {
  day: string;
  time: string;
  className: string;
  branch: string;
  academicYear: string;
  excludeScheduleId?: Types.ObjectId;
}) {
  const schedules = await Schedule.find({
    day: options.day,
    time: options.time,
    className: options.className,
    academicYear: options.academicYear,
    ...(options.excludeScheduleId ? { _id: { $ne: options.excludeScheduleId } } : {}),
  })
    .select("_id scheduleId branch teacherId")
    .populate<{ teacherId: { branch?: string | null } | null }>({
      path: "teacherId",
      select: "branch",
    })
    .lean()
    .exec();
  const normalizedBranch = normalizeText(options.branch).toLowerCase();

  return (
    schedules.find((schedule) => {
      const teacherBranch = normalizeText(
        schedule.branch || schedule.teacherId?.branch,
      ).toLowerCase();

      return teacherBranch === normalizedBranch;
    }) ?? null
  );
}

async function getScheduleDocuments(filter: Record<string, unknown> = {}) {
  return (await Schedule.find(filter)
    .populate<{
      teacherId: {
        teacherId: string;
        branch: string;
        userId: {
          nama: string;
        };
      };
    }>({
      path: "teacherId",
      populate: {
        path: "userId",
        model: User,
      },
    })
    .sort({ createdAt: -1 })
    .lean()
    .exec()) as unknown as ScheduleWithTeacher[];
}

async function getPublicScheduleById(id: string) {
  const schedules = await getScheduleDocuments();
  return buildSchedulePresentation(schedules).find((schedule) => schedule.id === id) ?? null;
}

function sortScheduleEntries(entries: ScheduleListEntry[], sort: string | undefined) {
  const sortValue = normalizeText(sort).toLowerCase();
  const sortedEntries = [...entries];

  sortedEntries.sort((leftEntry, rightEntry) => {
    if (!sortValue) {
      const dayOrderDifference =
        getScheduleDayOrder(leftEntry.schedule.day) -
        getScheduleDayOrder(rightEntry.schedule.day);

      if (dayOrderDifference !== 0) {
        return dayOrderDifference;
      }

      const timeOrderDifference =
        getScheduleTimeOrder(leftEntry.schedule.time) -
        getScheduleTimeOrder(rightEntry.schedule.time);

      if (timeOrderDifference !== 0) {
        return timeOrderDifference;
      }

      const sequenceDifference =
        getScheduleSequence(leftEntry.schedule.id) -
        getScheduleSequence(rightEntry.schedule.id);

      if (sequenceDifference !== 0) {
        return sequenceDifference;
      }

      return leftEntry.schedule.id.localeCompare(rightEntry.schedule.id, "id-ID");
    }

    switch (sortValue) {
      case "createdat_desc":
        return rightEntry.createdAt.getTime() - leftEntry.createdAt.getTime();
      case "createdat_asc":
        return leftEntry.createdAt.getTime() - rightEntry.createdAt.getTime();
      case "day_asc":
        return leftEntry.schedule.day.localeCompare(rightEntry.schedule.day, "id-ID");
      case "day_desc":
        return rightEntry.schedule.day.localeCompare(leftEntry.schedule.day, "id-ID");
      case "classname_asc":
        return leftEntry.schedule.className.localeCompare(
          rightEntry.schedule.className,
          "id-ID",
        );
      case "classname_desc":
        return rightEntry.schedule.className.localeCompare(
          leftEntry.schedule.className,
          "id-ID",
        );
      case "teacher_asc":
        return leftEntry.schedule.teacher.localeCompare(
          rightEntry.schedule.teacher,
          "id-ID",
        );
      case "teacher_desc":
        return rightEntry.schedule.teacher.localeCompare(
          leftEntry.schedule.teacher,
          "id-ID",
        );
      case "status_asc":
        return leftEntry.schedule.status.localeCompare(
          rightEntry.schedule.status,
          "id-ID",
        );
      case "status_desc":
        return rightEntry.schedule.status.localeCompare(
          leftEntry.schedule.status,
          "id-ID",
        );
      default:
        return leftEntry.schedule.id.localeCompare(rightEntry.schedule.id, "id-ID");
    }
  });

  return sortedEntries;
}

async function buildScheduleListPayload(
  query: ScheduleListQuery,
  scope: AdminBranchScope,
) {
  const searchTokens = tokenizeSearchQuery(query.q);
  const normalizedStatus = normalizeText(query.status);
  const branchFilter = normalizeText(query.branch);
  const normalizedClassName = normalizeScheduleClassFilter(query.className);
  const normalizedDay = normalizeText(query.day);
  const requestedPage = parsePositiveIntegerParam(query.page, 1, {
    min: 1,
    fieldName: "page",
  });
  const requestedLimit = parsePositiveIntegerParam(query.limit, 20, {
    min: 1,
    max: 100,
    fieldName: "limit",
  });
  const shouldPaginate =
    typeof query.page === "string" || typeof query.limit === "string";

  if (
    normalizedStatus &&
    !SCHEDULE_STATUSES.includes(normalizedStatus as (typeof SCHEDULE_STATUSES)[number])
  ) {
    throw new AppError(400, "Status jadwal filter tidak valid.");
  }

  if (query.className && !normalizedClassName) {
    throw new AppError(400, "Kelas jadwal filter tidak valid.");
  }

  const academicYear = normalizeText(query.academicYear);
  const scheduleDocuments = await getScheduleDocuments(academicYear ? { academicYear } : {});
  const publicSchedules = buildSchedulePresentation(scheduleDocuments);
  const scheduleById = new Map(
    scheduleDocuments.map((schedule) => [schedule.scheduleId, schedule]),
  );
  const entries = publicSchedules.map((schedule) => ({
    schedule,
    createdAt: resolveCreatedAt(scheduleById.get(schedule.id)?.createdAt),
  }));

  const filteredEntries = sortScheduleEntries(entries, query.sort).filter(
    ({ schedule }) => {
      const matchesQuery = matchesSearchQuery(searchTokens, [
        schedule.id,
        schedule.day,
        schedule.time,
        schedule.className,
        schedule.subject,
        schedule.teacher,
        schedule.branch,
        schedule.room,
        schedule.status,
      ]);
      const matchesStatus = normalizedStatus ? schedule.status === normalizedStatus : true;
      const matchesBranch = matchesBranchScope(schedule.branch, scope, branchFilter);
      const matchesClassName = normalizedClassName
        ? normalizeScheduleClassFilter(schedule.className) === normalizedClassName
        : true;
      const matchesDay = normalizedDay ? schedule.day === normalizedDay : true;

      return (
        matchesQuery &&
        matchesStatus &&
        matchesBranch &&
        matchesClassName &&
        matchesDay
      );
    },
  );

  const items = filteredEntries.map((entry) => entry.schedule);
  const totalItems = items.length;
  const totalPages = totalItems === 0 ? 1 : Math.ceil(totalItems / requestedLimit);
  const safePage = shouldPaginate ? Math.min(requestedPage, totalPages) : 1;
  const offset = shouldPaginate ? (safePage - 1) * requestedLimit : 0;
  const paginatedItems = shouldPaginate
    ? items.slice(offset, offset + requestedLimit)
    : items;
  const scheduledRooms = new Set(
    items.map((schedule) => normalizeText(schedule.room)).filter(Boolean),
  );
  const roomConflictCount = new Set(
    items
      .filter((schedule) =>
        schedule.conflicts.some((conflict) =>
          conflict.toLowerCase().includes("ruangan"),
        ),
      )
      .map((schedule) => normalizeText(schedule.room)),
  ).size;

  return {
    schedules: paginatedItems,
    filteredSchedules: items,
    summary: {
      totalItems,
      runningCount: items.filter((schedule) => schedule.status === "Berjalan").length,
      reviewCount: items.filter((schedule) => schedule.status === "Review").length,
      conflictCount: items.filter((schedule) => schedule.status === "Bentrok").length,
      scheduledRoomCount: scheduledRooms.size,
      roomConflictCount,
    } satisfies ScheduleListSummary,
    pagination: {
      page: safePage,
      limit: shouldPaginate ? requestedLimit : Math.max(totalItems, 1),
      totalPages: shouldPaginate ? totalPages : 1,
      totalItems,
    },
  };
}

export const getSchedules = asyncHandler(
  async (
    req: Request<Record<string, string>, Record<string, never>, Record<string, never>, ScheduleListQuery>,
    res: Response,
  ) => {
    const scope = await resolveAdminBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    const payload = await buildScheduleListPayload(req.query, scope);

    sendSuccess(res, {
      data: {
        schedules: payload.schedules,
        summary: payload.summary,
        pagination: payload.pagination,
      },
    });
  },
);

export const exportSchedules = asyncHandler(
  async (
    req: Request<Record<string, string>, Record<string, never>, Record<string, never>, ScheduleListQuery>,
    res: Response,
  ) => {
    const scope = await resolveAdminBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    const payload = await buildScheduleListPayload(req.query, scope);
    const csvContent = buildCsvContent(
      [
        "Schedule ID",
        "Hari",
        "Jam",
        "Kelas",
        "Mapel",
        "Teacher ID",
        "Guru",
        "Cabang",
        "Ruangan",
        "Status",
        "Konflik",
      ],
      payload.filteredSchedules.map((schedule) => [
        schedule.id,
        schedule.day,
        schedule.time,
        schedule.className,
        schedule.subject,
        schedule.teacherId,
        schedule.teacher,
        schedule.branch,
        schedule.room,
        schedule.status,
        schedule.conflicts.join(" | "),
      ]),
    );

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="schedules-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    res.status(200).send(csvContent);
  },
);

export const importSchedules = asyncHandler(
  async (
    req: Request<Record<string, string>, Record<string, never>, ScheduleImportRequestBody>,
    res: Response,
    next: NextFunction,
  ) => {
    const scope = await resolveAdminBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    const academicPeriod = assertAdminAcademicPeriodEditable(req.body.academicYear);
    const fileName = normalizeText(req.body.fileName);
    const fileBuffer = decodeImportFileData(req.body.fileDataBase64);

    if (!fileName || !fileBuffer) {
      next(new AppError(400, "File import jadwal belum dikirim dengan benar."));
      return;
    }

    let parsedWorkbook: ReturnType<typeof parseScheduleImportWorkbook>;

    try {
      parsedWorkbook = parseScheduleImportWorkbook(fileBuffer);
    } catch (error) {
      next(
        new AppError(
          400,
          error instanceof Error
            ? error.message
            : "File import jadwal tidak dapat diproses.",
        ),
      );
      return;
    }

    const [activeTeachers, rooms, existingSchedules] = await Promise.all([
      Teacher.find({ status: "Aktif" })
        .select("_id userId capableGrades branch branches")
        .populate<{ userId: { nama: string } | null }>({
          path: "userId",
          select: "nama",
          model: User,
        })
        .lean()
        .exec() as Promise<ScheduleImportTeacherLookup[]>,
      Room.find().select("name").exec(),
      Schedule.find({ academicYear: academicPeriod.academicYear })
        .select("day time className branch teacherId")
        .populate<{ teacherId: { branch?: string | null } | null }>({
          path: "teacherId",
          select: "branch",
        })
        .lean()
        .exec(),
    ]);
    const teacherNameMap = new Map<string, ScheduleImportTeacherLookup[]>();

    for (const teacher of activeTeachers) {
      const teacherBranches = Array.from(
        new Set(
          [teacher.branch, ...(teacher.branches ?? [])]
            .map((branch) => normalizeText(branch))
            .filter(Boolean),
        ),
      );

      if (!teacherBranches.some((branch) => matchesBranchScope(branch, scope))) {
        continue;
      }

      const teacherName = normalizeText(teacher.userId?.nama);

      if (!teacherName) {
        continue;
      }

      const teacherKey = teacherName.toLowerCase();
      const currentTeachers = teacherNameMap.get(teacherKey) ?? [];

      currentTeachers.push(teacher);
      teacherNameMap.set(teacherKey, currentTeachers);
    }

    const roomNameMap = new Map(
      rooms.map((room) => [normalizeText(room.name).toLowerCase(), room.name]),
    );
    const existingScheduleKeys = new Set(
      existingSchedules.map((schedule) =>
        [
          normalizeText(schedule.branch || schedule.teacherId?.branch).toLowerCase(),
          normalizeText(schedule.day).toLowerCase(),
          normalizeText(schedule.time).toLowerCase(),
          normalizeText(schedule.className).toLowerCase(),
        ].join("|"),
      ),
    );
    const importedScheduleKeys = new Set<string>();
    const errorRows: ScheduleImportErrorRow[] = [];
    const affectedTeacherIds = new Set<string>();
    let successCount = 0;

    for (const row of parsedWorkbook.rows) {
      const day = normalizeText(row.dayRaw);
      const time = normalizeText(row.timeRaw);
      const className = normalizeAcademicClassName(row.classNameRaw);
      const subject = normalizeScheduleSubject(row.subjectRaw);
      const teacherName = normalizeText(row.teacherRaw);
      const roomName = normalizeText(row.roomRaw);
      const room = roomNameMap.get(roomName.toLowerCase()) ?? "";
      const status = normalizeScheduleStatus(row.statusRaw);
      const teacherMatches = teacherNameMap.get(teacherName.toLowerCase()) ?? [];

      const pushErrorRow = (reason: string) => {
        errorRows.push({
          rowNumber: row.rowNumber,
          day,
          time,
          className: className || normalizeText(row.classNameRaw),
          teacher: teacherName,
          room: roomName,
          reason,
        });
      };

      if (!day || !time || !teacherName || !roomName) {
        pushErrorRow("Hari, jam, guru, dan ruangan wajib diisi.");
        continue;
      }

      if (!className) {
        pushErrorRow("Kelas akademik tidak valid. Gunakan format SD/SMP/SMA yang tersedia.");
        continue;
      }

      if (!subject) {
        pushErrorRow("Mata pelajaran tidak valid untuk master jadwal.");
        continue;
      }

      if (!room) {
        pushErrorRow(`Ruangan "${roomName}" tidak ditemukan di master ruangan.`);
        continue;
      }

      if (teacherMatches.length === 0) {
        pushErrorRow(`Guru aktif "${teacherName}" tidak ditemukan.`);
        continue;
      }

      if (teacherMatches.length > 1) {
        pushErrorRow(
          `Guru "${teacherName}" terdeteksi lebih dari satu. Gunakan nama guru yang unik di master.`,
        );
        continue;
      }

      const selectedTeacher = teacherMatches[0];
      const selectedTeacherBranches = Array.from(
        new Set(
          [selectedTeacher.branch, ...(selectedTeacher.branches ?? [])]
            .map((branch) => normalizeText(branch))
            .filter(Boolean),
        ),
      );
      const scheduleBranch = scope.isScopedToManagedBranches
        ? scope.managedBranches.find((branch) =>
            selectedTeacherBranches.some(
              (teacherBranch) => teacherBranch.toLowerCase() === branch.toLowerCase(),
            ),
          ) ?? ""
        : normalizeText(selectedTeacher.branch);
      const scheduleKey = [
        scheduleBranch.toLowerCase(),
        day.toLowerCase(),
        time.toLowerCase(),
        className.toLowerCase(),
      ].join("|");

      if (existingScheduleKeys.has(scheduleKey) || importedScheduleKeys.has(scheduleKey)) {
        pushErrorRow("Jadwal dengan hari, jam, dan kelas yang sama sudah ada.");
        continue;
      }

      const gradeMatch = className.match(/\b(\d{1,2})\b/);
      const extractedGrade = gradeMatch ? gradeMatch[1] : null;

      if (
        extractedGrade && 
        selectedTeacher.capableGrades && 
        selectedTeacher.capableGrades.length > 0 &&
        !selectedTeacher.capableGrades.includes(extractedGrade)
      ) {
        pushErrorRow(`Guru tidak diizinkan mengajar untuk kelas akademik tingkat ini (hanya: ${selectedTeacher.capableGrades.join(", ")}).`);
        continue;
      }

      try {
        const scheduleId = await getNextPublicId(Schedule, "scheduleId", "SCH");
        await Schedule.create({
          scheduleId,
          day,
          time,
          className,
          subject,
          teacherId: selectedTeacher._id,
          branch: scheduleBranch,
          room,
          status,
          academicYear: academicPeriod.academicYear,
          semester: academicPeriod.semester,
        });

        affectedTeacherIds.add(selectedTeacher._id.toString());
        existingScheduleKeys.add(scheduleKey);
        importedScheduleKeys.add(scheduleKey);
        successCount += 1;
      } catch (error) {
        pushErrorRow(
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan saat menyimpan jadwal hasil import.",
        );
      }
    }

    for (const teacherIdStr of Array.from(affectedTeacherIds)) {
      await syncTeacherScheduleStats(new Types.ObjectId(teacherIdStr));
    }

    sendSuccess(res, {
      message: successCount
        ? "Import jadwal selesai diproses."
        : "Tidak ada jadwal baru yang berhasil diimpor.",
      data: {
        fileName,
        sheetName: parsedWorkbook.sheetName,
        summary: {
          totalRows: parsedWorkbook.rows.length,
          successCount,
          failedCount: errorRows.length,
        },
        errorRows,
      },
    });
  },
);

export const getScheduleById = asyncHandler(
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    const scope = await resolveAdminBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    const schedule = await getPublicScheduleById(req.params.id);

    if (!schedule) {
      next(new AppError(404, "Data jadwal tidak ditemukan."));
      return;
    }

    assertBranchAccess(schedule.branch, scope);

    sendSuccess(res, {
      data: {
        schedule,
      },
    });
  },
);

export const createSchedule = asyncHandler(
  async (
    req: Request<Record<string, string>, Record<string, never>, ScheduleRequestBody>,
    res: Response,
    next: NextFunction,
  ) => {
    const scope = await resolveAdminBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    const day = normalizeText(req.body.day);
    const time = normalizeText(req.body.time);
    const className = normalizeAcademicClassName(req.body.className);
    const subject = normalizeScheduleSubject(req.body.subject);
    const requestedBranch = normalizeText(req.body.branch);
    const teacherPublicId = normalizeText(req.body.teacherId);
    const room = normalizeText(req.body.room);
    const status = normalizeText(req.body.status) as ScheduleRequestBody["status"];
    const period = assertAdminAcademicPeriodEditable(req.body.academicYear);

    if (!day || !time || !teacherPublicId || !room) {
      next(new AppError(400, "Data jadwal belum lengkap."));
      return;
    }

    if (!className) {
      next(new AppError(400, "Kelas akademik wajib dipilih dari opsi yang tersedia."));
      return;
    }

    if (!subject) {
      next(new AppError(400, "Mata pelajaran wajib dipilih dari opsi yang tersedia."));
      return;
    }

    if (!status || !SCHEDULE_STATUSES.includes(status as (typeof SCHEDULE_STATUSES)[number])) {
      next(new AppError(400, "Status jadwal belum valid."));
      return;
    }

    const teacher = await findTeacherByPublicId(teacherPublicId);

    if (!teacher) {
      next(new AppError(404, "Guru untuk jadwal tidak ditemukan."));
      return;
    }

    const scheduleBranch = resolveScheduleBranch({
      requestedBranch,
      teacher,
      scope,
    });

    const gradeMatch = className.match(/\b(\d{1,2})\b/);
    const extractedGrade = gradeMatch ? gradeMatch[1] : null;

    if (
      extractedGrade &&
      teacher.capableGrades &&
      teacher.capableGrades.length > 0 &&
      !teacher.capableGrades.includes(extractedGrade)
    ) {
      next(new AppError(400, `Guru tidak diizinkan mengajar untuk kelas akademik tingkat ini (hanya: ${teacher.capableGrades.join(", ")}).`));
      return;
    }

    const duplicateSchedule = await findDuplicateScheduleInBranch({
      day,
      time,
      className,
      branch: scheduleBranch,
      academicYear: period.academicYear,
    });

    if (duplicateSchedule) {
      next(new AppError(409, "Jadwal dengan hari, jam, dan kelas yang sama sudah ada."));
      return;
    }

    const scheduleId = await getNextPublicId(Schedule, "scheduleId", "SCH");
    const schedule = await Schedule.create({
      scheduleId,
      day,
      time,
      className,
      subject,
      teacherId: teacher._id,
      branch: scheduleBranch,
      room,
      status: status as (typeof SCHEDULE_STATUSES)[number],
      academicYear: period.academicYear,
      semester: period.semester,
    });

    await syncTeacherScheduleStats(teacher._id);

    const publicSchedule = await getPublicScheduleById(schedule.scheduleId);

    if (!publicSchedule) {
      next(new AppError(500, "Gagal memuat ulang data jadwal yang baru dibuat."));
      return;
    }

    sendSuccess(res, {
      statusCode: 201,
      message: "Data jadwal berhasil dibuat.",
      data: {
        schedule: publicSchedule,
      },
    });
  },
);

export const updateSchedule = asyncHandler(
  async (
    req: Request<{ id: string }, Record<string, never>, ScheduleRequestBody>,
    res: Response,
    next: NextFunction,
  ) => {
    const scope = await resolveAdminBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    const schedule = await findScheduleByParam(req.params.id);

    if (!schedule) {
      next(new AppError(404, "Data jadwal tidak ditemukan."));
      return;
    }

    assertBranchAccess(await getScheduleTeacherBranch(schedule), scope);
    assertAdminAcademicPeriodEditable(schedule.academicYear);

    const day = normalizeText(req.body.day);
    const time = normalizeText(req.body.time);
    const className = normalizeAcademicClassName(req.body.className);
    const subject = normalizeScheduleSubject(req.body.subject);
    const requestedBranch = normalizeText(req.body.branch);
    const teacherPublicId = normalizeText(req.body.teacherId);
    const room = normalizeText(req.body.room);
    const status = normalizeText(req.body.status) as ScheduleRequestBody["status"];

    if (!day || !time || !teacherPublicId || !room) {
      next(new AppError(400, "Data jadwal belum lengkap."));
      return;
    }

    if (!className) {
      next(new AppError(400, "Kelas akademik wajib dipilih dari opsi yang tersedia."));
      return;
    }

    if (!subject) {
      next(new AppError(400, "Mata pelajaran wajib dipilih dari opsi yang tersedia."));
      return;
    }

    if (!status || !SCHEDULE_STATUSES.includes(status as (typeof SCHEDULE_STATUSES)[number])) {
      next(new AppError(400, "Status jadwal belum valid."));
      return;
    }

    const teacher = await findTeacherByPublicId(teacherPublicId);

    if (!teacher) {
      next(new AppError(404, "Guru untuk jadwal tidak ditemukan."));
      return;
    }

    const scheduleBranch = resolveScheduleBranch({
      requestedBranch,
      existingBranch: schedule.branch,
      teacher,
      scope,
    });

    const gradeMatch = className.match(/\b(\d{1,2})\b/);
    const extractedGrade = gradeMatch ? gradeMatch[1] : null;

    if (
      extractedGrade &&
      teacher.capableGrades &&
      teacher.capableGrades.length > 0 &&
      !teacher.capableGrades.includes(extractedGrade)
    ) {
      next(new AppError(400, `Guru tidak diizinkan mengajar untuk kelas akademik tingkat ini (hanya: ${teacher.capableGrades.join(", ")}).`));
      return;
    }

    const duplicateSchedule = await findDuplicateScheduleInBranch({
      day,
      time,
      className,
      branch: scheduleBranch,
      academicYear: schedule.academicYear || getCurrentAcademicPeriod().academicYear,
      excludeScheduleId: schedule._id,
    });

    if (duplicateSchedule) {
      next(new AppError(409, "Jadwal dengan hari, jam, dan kelas yang sama sudah ada."));
      return;
    }

    schedule.day = day;
    schedule.time = time;
    schedule.className = className;
    schedule.subject = subject;
    schedule.teacherId = teacher._id;
    schedule.branch = scheduleBranch;
    schedule.room = room;
    schedule.status = status as (typeof SCHEDULE_STATUSES)[number];
    
    const oldTeacherId = schedule.isModified("teacherId") ? schedule.get("teacherId", null, { getters: false }) : null;
    
    await schedule.save();

    await syncTeacherScheduleStats(teacher._id);
    if (oldTeacherId && oldTeacherId.toString() !== teacher._id.toString()) {
      await syncTeacherScheduleStats(oldTeacherId);
    }

    const publicSchedule = await getPublicScheduleById(schedule.scheduleId);

    if (!publicSchedule) {
      next(new AppError(500, "Gagal memuat ulang data jadwal yang diperbarui."));
      return;
    }

    sendSuccess(res, {
      message: "Data jadwal berhasil diperbarui.",
      data: {
        schedule: publicSchedule,
      },
    });
  },
);

export const deleteSchedule = asyncHandler(
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    const scope = await resolveAdminBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    const schedule = await findScheduleByParam(req.params.id);

    if (!schedule) {
      next(new AppError(404, "Data jadwal tidak ditemukan."));
      return;
    }

    assertBranchAccess(await getScheduleTeacherBranch(schedule), scope);
    assertAdminAcademicPeriodEditable(schedule.academicYear);

    const teacherId = schedule.teacherId;
    await Schedule.deleteOne({ _id: schedule._id });
    
    await syncTeacherScheduleStats(teacherId);

    sendSuccess(res, {
      message: "Data jadwal berhasil dihapus.",
    });
  },
);
