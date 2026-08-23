import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Types } from "mongoose";
import type { NextFunction, Request, Response } from "express";

import { validateEnv } from "../config/env";
import { sendVerificationEmail } from "../utils/email";

import { Branch } from "../models/Branch";
import { Schedule } from "../models/Schedule";
import {
  Teacher,
  TEACHER_AVAILABILITIES,
  TEACHER_STATUSES,
  type TeacherAvailability,
  type TeacherDocument,
  type TeacherStatus,
} from "../models/Teacher";
import { User, type UserDocument } from "../models/User";
import { toPublicTeacher, type PublicTeacher } from "../utils/adminView";
import asyncHandler from "../utils/asyncHandler";
import {
  matchesBranchScope,
  resolveAccessibleBranchName,
  resolveAdminBranchScope,
  type AdminBranchScope,
} from "../utils/adminBranchScope";
import { AppError, sendSuccess } from "../utils/apiResponse";
import { buildTeacherLoginCode } from "../utils/accountCode";
import { clearUserLoginLock } from "../utils/authLock";
import { buildCsvContent } from "../utils/csv";
import { getNextPublicId } from "../utils/publicId";
import {
  buildImportedTeacherDuplicateKey,
  buildImportedTeacherEmail,
  normalizeImportedTeacherAvailability,
  normalizeImportedTeacherBranch,
  normalizeImportedTeacherClassList,
  normalizeImportedTeacherEducation,
  normalizeImportedTeacherPhone,
  normalizeImportedTeacherSchedule,
  normalizeImportedTeacherStatus,
  normalizeImportedTeacherSubject,
  parseTeacherImportWorkbook,
  type ParsedTeacherImportRow,
} from "../utils/teacherImport";
import { buildGeneratedPasswordFromTeacherId } from "../utils/teacherPassword";

type TeacherRequestBody = {
  name?: string;
  email?: string;
  password?: string;
  autoGenerateCredentials?: boolean;
  subject?: string;
  branch?: string;
  phone?: string;
  schedule?: string;
  activeClasses?: number;
  classList?: string;
  capableGrades?: string[];
  address?: string;
  education?: string;
  status?: string;
  availability?: string;
};

function getTeacherBranchNames(teacher: { branch: string; branches?: string[] }) {
  return Array.from(
    new Set(
      [teacher.branch, ...(teacher.branches ?? [])]
        .map((branch) => normalizeText(branch))
        .filter(Boolean),
    ),
  );
}

function assertTeacherBranchAccess(
  teacher: { branch: string; branches?: string[] },
  scope: AdminBranchScope,
) {
  if (getTeacherBranchNames(teacher).some((branch) => matchesBranchScope(branch, scope))) {
    return;
  }

  throw new AppError(403, "Admin tidak memiliki akses ke data cabang guru ini.");
}

type TeacherImportRequestBody = {
  fileName?: string;
  fileDataBase64?: string;
};

type TeacherListQuery = {
  page?: string;
  limit?: string;
  q?: string;
  sort?: string;
  status?: string;
  branch?: string;
};

type TeacherWithUser = TeacherDocument & {
  userId: UserDocument;
};

type TeacherCreateInput = {
  teacherId: string;
  name: string;
  email: string;
  loginCode: string;
  generatedPassword: string;
  subject: string;
  branch: string;
  phone: string;
  schedule: string;
  activeClasses: number;
  classList: string;
  capableGrades: string[];
  address: string;
  education: string;
  status: TeacherStatus;
  availability: TeacherAvailability;
};

type TeacherImportDetail = {
  rowNumber: number;
  name: string;
  subject: string;
  branch: string;
  status: "imported" | "failed" | "skipped";
  email?: string;
  loginCode?: string;
  generatedPassword?: string;
  reason?: string;
};

type TeacherListSummary = {
  totalItems: number;
  activeCount: number;
  inactiveCount: number;
  branchCount: number;
  activeClassesTotal: number;
};

type TeacherListEntry = {
  teacher: PublicTeacher;
  createdAt: Date;
};

function normalizeText(value: string | undefined): string {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function normalizeEmail(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function normalizePhone(value: string | undefined): string {
  return value?.trim().replace(/\s+/g, "") ?? "";
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseActiveClasses(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }

  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return Number(value.trim());
  }

  return null;
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

function isPlaceholderPhone(value: string): boolean {
  return !value || value === "-";
}

function isTeacherStatus(value: string): value is TeacherStatus {
  return TEACHER_STATUSES.includes(value as TeacherStatus);
}

function isTeacherAvailability(value: string): value is TeacherAvailability {
  return TEACHER_AVAILABILITIES.includes(value as TeacherAvailability);
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

async function getTeacherBranchNameMap(): Promise<Map<string, string>> {
  const branches = await Branch.find().select("name").sort({ name: 1 }).exec();

  return new Map(
    branches.map((branch) => [normalizeText(branch.name).toLowerCase(), branch.name]),
  );
}

async function resolveTeacherBranchName(
  value: string,
  options: {
    allowCurrentValue?: string;
    branchNameMap?: Map<string, string>;
  } = {},
): Promise<string> {
  const normalizedBranch = normalizeText(value);

  if (!normalizedBranch) {
    throw new AppError(400, "Cabang guru wajib diisi.");
  }

  const normalizedBranchKey = normalizedBranch.toLowerCase();
  const currentBranchValue = options.allowCurrentValue ?? "";
  const normalizedCurrentBranch = normalizeText(currentBranchValue);
  const mappedBranch = options.branchNameMap?.get(normalizedBranchKey);

  if (mappedBranch) {
    return mappedBranch;
  }

  if (!options.branchNameMap) {
    const branch = await Branch.findOne({
      name: new RegExp(`^${escapeRegex(normalizedBranch)}$`, "i"),
    })
      .select("name")
      .exec();

    if (branch) {
      return branch.name;
    }
  }

  if (
    normalizedCurrentBranch &&
    normalizedCurrentBranch.toLowerCase() === normalizedBranchKey
  ) {
    return currentBranchValue;
  }

  throw new AppError(400, `Cabang "${normalizedBranch}" tidak ditemukan di master cabang.`);
}

async function resolveTeacherCreateBranchName(
  value: string,
  scope: AdminBranchScope,
) {
  if (value) {
    return resolveAccessibleBranchName(
      await resolveTeacherBranchName(value),
      scope,
      {
        useFirstManagedBranchAsDefault: true,
      },
    );
  }

  if (scope.isScopedToManagedBranches) {
    return resolveAccessibleBranchName("", scope, {
      useFirstManagedBranchAsDefault: true,
    });
  }

  const fallbackBranch = await Branch.findOne()
    .select("name")
    .sort({ name: 1, createdAt: 1, _id: 1 })
    .exec();
  const fallbackBranchName = normalizeText(fallbackBranch?.name);

  if (!fallbackBranchName) {
    throw new AppError(400, "Cabang guru wajib diisi.");
  }

  return fallbackBranchName;
}

function getImportDetailMessage(
  error: unknown,
  fallback = "Terjadi kesalahan saat menyimpan data guru hasil import.",
): string {
  if (error instanceof AppError) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function buildTeacherImportDetail(
  row: ParsedTeacherImportRow,
  options: {
    status: TeacherImportDetail["status"];
    subject?: string;
    branch?: string;
    email?: string;
    loginCode?: string;
    generatedPassword?: string;
    reason?: string;
  },
): TeacherImportDetail {
  return {
    rowNumber: row.rowNumber,
    name: normalizeText(row.name),
    subject: options.subject ?? normalizeImportedTeacherSubject(row.subjectRaw),
    branch: options.branch ?? normalizeImportedTeacherBranch(row.branchRaw),
    status: options.status,
    ...(options.email ? { email: options.email } : {}),
    ...(options.loginCode ? { loginCode: options.loginCode } : {}),
    ...(options.generatedPassword
      ? { generatedPassword: options.generatedPassword }
      : {}),
    ...(options.reason ? { reason: options.reason } : {}),
  };
}

async function findTeacherByParam(id: string): Promise<TeacherWithUser | null> {
  return Teacher.findOne({
    $or: [
      { teacherId: id },
      ...(Types.ObjectId.isValid(id) ? [{ _id: id }] : []),
    ],
  })
    .populate<{ userId: TeacherWithUser["userId"] }>("userId")
    .exec() as Promise<TeacherWithUser | null>;
}

async function createTeacherAccount(
  input: TeacherCreateInput,
): Promise<TeacherWithUser> {
  const existingUser = await User.findOne({
    $or: [{ email: input.email }, { loginCode: input.loginCode }],
  }).exec();

  if (existingUser) {
    throw new AppError(409, "Email atau kode login guru sudah digunakan.");
  }

  if (!isPlaceholderPhone(input.phone)) {
    const existingPhone = await Teacher.findOne({ phone: input.phone }).exec();

    if (existingPhone) {
      throw new AppError(409, "No. HP guru sudah digunakan.");
    }
  }

  const hashedPassword = await bcrypt.hash(input.generatedPassword, 12);
  let createdUser: UserDocument | null = null;

  try {
    const plainVerificationToken = crypto.randomBytes(32).toString("hex");
    const emailVerificationToken = crypto
      .createHash("sha256")
      .update(plainVerificationToken)
      .digest("hex");
      
    createdUser = await User.create({
      nama: input.name,
      email: input.email,
      loginCode: input.loginCode,
      password: hashedPassword,
      role: "guru",
      isEmailVerified: input.email.endsWith("@bimbel.local"),
      emailVerificationToken: input.email.endsWith("@bimbel.local") ? null : emailVerificationToken,
      emailVerificationExpires: null,
    });

    const teacher = await Teacher.create({
      teacherId: input.teacherId,
      userId: createdUser._id,
      subject: input.subject,
      branch: input.branch,
      branches: [input.branch],
      phone: input.phone,
      schedule: input.schedule,
      activeClasses: input.activeClasses,
      classList: input.classList,
      capableGrades: input.capableGrades,
      address: input.address,
      education: input.education,
      status: input.status,
      availability: input.availability,
    });

    const populatedTeacher = (await Teacher.findById(teacher._id)
      .populate<{ userId: TeacherWithUser["userId"] }>("userId")
      .exec()) as TeacherWithUser | null;

    if (!populatedTeacher) {
      throw new AppError(500, "Gagal memuat ulang data guru yang baru dibuat.");
    }

    return {
      ...populatedTeacher.toObject(),
      plainVerificationToken,
    } as TeacherWithUser & { plainVerificationToken: string };
  } catch (error) {
    if (createdUser) {
      await User.deleteOne({ _id: createdUser._id });
    }

    throw error;
  }
}

async function getExistingTeacherImportKeys(): Promise<Set<string>> {
  const teachers = (await Teacher.find()
    .populate<{ userId: TeacherWithUser["userId"] }>("userId")
    .exec()) as TeacherWithUser[];

  return new Set(
    teachers
      .map((teacher) =>
        buildImportedTeacherDuplicateKey({
          name: teacher.userId.nama,
          subject: teacher.subject,
          education: teacher.classList.replace(/^Pendidikan terakhir:\s*/i, ""),
          branch: teacher.branch,
        }),
      )
      .filter((value): value is string => Boolean(value)),
  );
}

async function getResolvedTeacherEntries() {
  const [teachers, branchNameMap] = await Promise.all([
    Teacher.find()
      .populate<{ userId: TeacherWithUser["userId"] }>("userId")
      .sort({ createdAt: -1 })
      .exec() as Promise<TeacherWithUser[]>,
    getTeacherBranchNameMap(),
  ]);

  return teachers.map((teacher) => {
    const publicTeacher = toPublicTeacher(teacher, teacher.userId);
    const registeredBranches = Array.from(
      new Set(
        publicTeacher.branches
          .map((branch) => branchNameMap.get(normalizeText(branch).toLowerCase()) ?? "")
          .filter(Boolean),
      ),
    );
    const registeredPrimaryBranch =
      branchNameMap.get(normalizeText(publicTeacher.branch).toLowerCase()) ??
      registeredBranches[0] ??
      "";

    return {
      teacher: {
        ...publicTeacher,
        branch: registeredPrimaryBranch,
        branches: registeredBranches,
      },
      createdAt: teacher.createdAt,
    };
  });
}

function sortTeacherEntries(entries: TeacherListEntry[], sort: string | undefined) {
  const sortValue = normalizeText(sort).toLowerCase() || "createdat_desc";
  const sortedEntries = [...entries];

  sortedEntries.sort((leftEntry, rightEntry) => {
    switch (sortValue) {
      case "createdat_asc":
        return leftEntry.createdAt.getTime() - rightEntry.createdAt.getTime();
      case "name_asc":
        return leftEntry.teacher.name.localeCompare(rightEntry.teacher.name, "id-ID");
      case "name_desc":
        return rightEntry.teacher.name.localeCompare(leftEntry.teacher.name, "id-ID");
      case "subject_asc":
        return leftEntry.teacher.subject.localeCompare(
          rightEntry.teacher.subject,
          "id-ID",
        );
      case "subject_desc":
        return rightEntry.teacher.subject.localeCompare(
          leftEntry.teacher.subject,
          "id-ID",
        );
      case "branch_asc":
        return leftEntry.teacher.branch.localeCompare(
          rightEntry.teacher.branch,
          "id-ID",
        );
      case "branch_desc":
        return rightEntry.teacher.branch.localeCompare(
          leftEntry.teacher.branch,
          "id-ID",
        );
      case "status_asc":
        return leftEntry.teacher.status.localeCompare(rightEntry.teacher.status, "id-ID");
      case "status_desc":
        return rightEntry.teacher.status.localeCompare(leftEntry.teacher.status, "id-ID");
      case "teacherid_asc":
        return leftEntry.teacher.id.localeCompare(rightEntry.teacher.id, "id-ID");
      case "teacherid_desc":
        return rightEntry.teacher.id.localeCompare(leftEntry.teacher.id, "id-ID");
      case "createdat_desc":
      default:
        return rightEntry.createdAt.getTime() - leftEntry.createdAt.getTime();
    }
  });

  return sortedEntries;
}

async function buildTeacherListPayload(
  query: TeacherListQuery,
  scope: AdminBranchScope,
) {
  const searchTokens = tokenizeSearchQuery(query.q);
  const normalizedStatus = normalizeText(query.status);
  const branchFilter = normalizeText(query.branch);
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
    !TEACHER_STATUSES.includes(normalizedStatus as (typeof TEACHER_STATUSES)[number])
  ) {
    throw new AppError(400, "Status guru filter tidak valid.");
  }

  const filteredEntries = sortTeacherEntries(await getResolvedTeacherEntries(), query.sort).filter(
    ({ teacher }) => {
      const matchesQuery = matchesSearchQuery(searchTokens, [
        teacher.id,
        teacher.loginCode,
        teacher.name,
        teacher.email,
        teacher.subject,
        teacher.branch,
        ...teacher.branches,
        teacher.phone,
        teacher.schedule,
        teacher.classList,
        teacher.status,
        teacher.availability,
      ]);
      const matchesStatus = normalizedStatus ? teacher.status === normalizedStatus : true;
      const matchesBranch = teacher.branches.some((branch) =>
        matchesBranchScope(branch, scope, branchFilter),
      );

      return matchesQuery && matchesStatus && matchesBranch;
    },
  );

  const items = filteredEntries.map((entry) => entry.teacher);
  const totalItems = items.length;
  const totalPages = totalItems === 0 ? 1 : Math.ceil(totalItems / requestedLimit);
  const safePage = shouldPaginate ? Math.min(requestedPage, totalPages) : 1;
  const offset = shouldPaginate ? (safePage - 1) * requestedLimit : 0;
  const paginatedItems = shouldPaginate
    ? items.slice(offset, offset + requestedLimit)
    : items;

  return {
    teachers: paginatedItems,
    filteredTeachers: items,
    summary: {
      totalItems,
      activeCount: items.filter((teacher) => teacher.status === "Aktif").length,
      inactiveCount: items.filter((teacher) => teacher.status === "Nonaktif").length,
      branchCount: new Set(
        items.flatMap((teacher) => teacher.branches.map((branch) => normalizeText(branch))).filter(Boolean),
      ).size,
      activeClassesTotal: items.reduce(
        (total, teacher) => total + teacher.activeClasses,
        0,
      ),
    } satisfies TeacherListSummary,
    pagination: {
      page: safePage,
      limit: shouldPaginate ? requestedLimit : Math.max(totalItems, 1),
      totalPages: shouldPaginate ? totalPages : 1,
      totalItems,
    },
  };
}

export const getTeachers = asyncHandler(
  async (
    req: Request<Record<string, string>, Record<string, never>, Record<string, never>, TeacherListQuery>,
    res: Response,
  ) => {
    const scope = await resolveAdminBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    const payload = await buildTeacherListPayload(req.query, scope);

  sendSuccess(res, {
    data: {
      teachers: payload.teachers,
      summary: payload.summary,
      pagination: payload.pagination,
    },
  });
  },
);

export const exportTeachers = asyncHandler(
  async (
    req: Request<Record<string, string>, Record<string, never>, Record<string, never>, TeacherListQuery>,
    res: Response,
  ) => {
    const scope = await resolveAdminBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    const payload = await buildTeacherListPayload(req.query, scope);
    const csvContent = buildCsvContent(
      [
        "Teacher ID",
        "Kode Login",
        "Nama",
        "Email",
        "Mapel",
        "Cabang",
        "Jadwal",
        "Kelas Aktif",
        "Pendidikan Terakhir",
        "Status",
        "Ketersediaan",
      ],
      payload.filteredTeachers.map((teacher) => [
        teacher.id,
        teacher.loginCode,
        teacher.name,
        teacher.email,
        teacher.subject,
        teacher.branches.join(" / "),
        teacher.schedule,
        teacher.activeClasses,
        teacher.classList,
        teacher.status,
        teacher.availability,
      ]),
    );

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="teachers-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    res.status(200).send(csvContent);
  },
);

export const getTeacherById = asyncHandler(
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    const scope = await resolveAdminBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    const teacher = await findTeacherByParam(req.params.id);

    if (!teacher) {
      next(new AppError(404, "Data guru tidak ditemukan."));
      return;
    }

    assertTeacherBranchAccess(teacher, scope);

    sendSuccess(res, {
      data: {
        teacher: toPublicTeacher(teacher, teacher.userId),
      },
    });
  },
);

export const createTeacher = asyncHandler(
  async (
    req: Request<Record<string, string>, Record<string, never>, TeacherRequestBody>,
    res: Response,
    next: NextFunction,
  ) => {
    const scope = await resolveAdminBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    const name = normalizeText(req.body.name);
    const email = normalizeEmail(req.body.email);
    const password = req.body.password?.trim() ?? "";
    const autoGenerateCredentials = req.body.autoGenerateCredentials === true;
    const subject = normalizeText(req.body.subject);
    const branch = normalizeText(req.body.branch);
    const phone = normalizePhone(req.body.phone) || "-";
    const schedule = normalizeText(req.body.schedule) || "-";
    const activeClasses = parseActiveClasses(req.body.activeClasses ?? 0);
    const classList = normalizeText(req.body.classList);
    const capableGrades = Array.isArray(req.body.capableGrades) 
      ? req.body.capableGrades.map(String) 
      : [];
    const address = normalizeText(req.body.address);
    const education = normalizeText(req.body.education);
    const status = normalizeText(req.body.status);
    const availability = normalizeText(req.body.availability) || "Tersedia";

    if (
      !name ||
      !subject ||
      activeClasses === null ||
      !classList
    ) {
      next(new AppError(400, "Data guru belum lengkap."));
      return;
    }

    if (email && !isValidEmail(email)) {
      next(new AppError(400, "Email guru belum valid."));
      return;
    }

    if (password && password.length < 8) {
      next(new AppError(400, "Password guru minimal 8 karakter."));
      return;
    }

    if (!autoGenerateCredentials && !email) {
      next(new AppError(400, "Email guru wajib diisi."));
      return;
    }

    if (!autoGenerateCredentials && !password) {
      next(new AppError(400, "Password guru wajib diisi."));
      return;
    }

    if (!isTeacherStatus(status)) {
      next(new AppError(400, "Status guru belum valid."));
      return;
    }

    if (!isTeacherAvailability(availability)) {
      next(new AppError(400, "Ketersediaan guru belum valid."));
      return;
    }

    const resolvedBranch = await resolveTeacherCreateBranchName(branch, scope);
    const teacherId = await getNextPublicId(Teacher, "teacherId", "TCH");
    const resolvedEmail = email || buildImportedTeacherEmail(teacherId);
    const loginCode = buildTeacherLoginCode(teacherId);
    const resolvedPassword = password || buildGeneratedPasswordFromTeacherId(teacherId);
    const autoGeneratedEmail = !email;
    const autoGeneratedPassword = !password;
    const teacher = await createTeacherAccount({
      teacherId,
      name,
      email: resolvedEmail,
      loginCode,
      generatedPassword: resolvedPassword,
      subject,
      branch: resolvedBranch,
      phone,
      schedule,
      activeClasses,
      classList,
      capableGrades,
      address,
      education,
      status,
      availability,
    });

    sendSuccess(res, {
      statusCode: 201,
      message: "Data guru berhasil dibuat.",
      data: {
        teacher: toPublicTeacher(teacher, teacher.userId),
        generatedCredentials:
          autoGeneratedEmail || autoGeneratedPassword
            ? {
                email: resolvedEmail,
                loginCode,
                password: resolvedPassword,
                autoGeneratedEmail,
                autoGeneratedPassword,
              }
            : undefined,
      },
    });

    if ("plainVerificationToken" in teacher && (teacher as any).plainVerificationToken && !resolvedEmail.endsWith("@bimbel.local")) {
      const { clientUrl } = validateEnv();
      const verificationLink = `${clientUrl}/verify-email?token=${(teacher as any).plainVerificationToken}`;
      sendVerificationEmail({
        nama: name,
        email: resolvedEmail,
        verificationLink,
        accountCredentials: {
          loginCode,
          password: resolvedPassword,
        },
      }).catch((err) => {
        console.error("Gagal mengirim email verifikasi ke guru baru:", err);
      });
    }
  },
);

export const importTeachers = asyncHandler(
  async (
    req: Request<Record<string, string>, Record<string, never>, TeacherImportRequestBody>,
    res: Response,
    next: NextFunction,
  ) => {
    const scope = await resolveAdminBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    const fileName = normalizeText(req.body.fileName);
    const fileBuffer = decodeImportFileData(req.body.fileDataBase64);

    if (!fileName || !fileBuffer) {
      next(new AppError(400, "File import guru belum dikirim dengan benar."));
      return;
    }

    let parsedWorkbook: {
      sheetName: string;
      rows: ParsedTeacherImportRow[];
    };

    try {
      parsedWorkbook = parseTeacherImportWorkbook(fileBuffer);
    } catch (error) {
      next(
        new AppError(
          400,
          error instanceof Error
            ? error.message
            : "File Excel guru tidak dapat diproses.",
        ),
      );
      return;
    }

    const [existingKeys, branchNameMap] = await Promise.all([
      getExistingTeacherImportKeys(),
      getTeacherBranchNameMap(),
    ]);
    const importedKeys = new Set<string>();
    const details: TeacherImportDetail[] = [];

    for (const row of parsedWorkbook.rows) {
      const name = normalizeText(row.name);

      if (!name) {
        details.push(
          buildTeacherImportDetail(row, {
            status: "skipped",
            reason: "Nama guru kosong.",
          }),
        );
        continue;
      }

      const subject = normalizeImportedTeacherSubject(row.subjectRaw);
      const education = normalizeImportedTeacherEducation(row.educationRaw);
      const importedBranch = normalizeImportedTeacherBranch(row.branchRaw);
      let branch: string;

      try {
        branch = resolveAccessibleBranchName(
          await resolveTeacherBranchName(importedBranch, {
            branchNameMap,
          }),
          scope,
          {
            useFirstManagedBranchAsDefault: true,
          },
        );
      } catch (error) {
        details.push(
          buildTeacherImportDetail(row, {
            status: "failed",
            subject,
            branch: importedBranch,
            reason: getImportDetailMessage(
              error,
              "Cabang guru pada file import belum valid.",
            ),
          }),
        );
        continue;
      }

      const duplicateKey = buildImportedTeacherDuplicateKey({
        name,
        subject: row.subjectRaw,
        education,
        branch,
      });

      if (duplicateKey && (existingKeys.has(duplicateKey) || importedKeys.has(duplicateKey))) {
        details.push(
          buildTeacherImportDetail(row, {
            status: "skipped",
            subject,
            branch,
            reason:
              "Data guru dengan nama, bidang, dan pendidikan terakhir yang sama sudah ada.",
          }),
        );
        continue;
      }

      const teacherId = await getNextPublicId(Teacher, "teacherId", "TCH");
      const providedEmail = normalizeEmail(row.emailRaw);
      const hasValidProvidedEmail =
        providedEmail && isValidEmail(providedEmail);
      const providedEmailExists = hasValidProvidedEmail
        ? await User.exists({ email: providedEmail })
        : null;
      const email =
        hasValidProvidedEmail && !providedEmailExists
          ? providedEmail
          : buildImportedTeacherEmail(teacherId);
      const loginCode = buildTeacherLoginCode(teacherId);
      const generatedPassword = buildGeneratedPasswordFromTeacherId(teacherId);
      const phone = normalizeImportedTeacherPhone(row.phoneRaw);
      const schedule = normalizeImportedTeacherSchedule(row.scheduleRaw);
      const classList = normalizeImportedTeacherClassList(education);
      const status = normalizeImportedTeacherStatus(row.statusRaw);
      const availability = normalizeImportedTeacherAvailability(row.availabilityRaw);

      try {
        await createTeacherAccount({
          teacherId,
          name,
          email,
          loginCode,
          generatedPassword,
          subject,
          branch,
          phone,
          schedule,
          activeClasses: 0,
          classList,
          capableGrades: [],
          address: "",
          education: "",
          status,
          availability,
        });

        if (duplicateKey) {
          existingKeys.add(duplicateKey);
          importedKeys.add(duplicateKey);
        }

        details.push(
          buildTeacherImportDetail(row, {
            status: "imported",
            subject,
            branch,
            email,
            loginCode,
            generatedPassword,
          }),
        );
      } catch (error) {
        details.push(
          buildTeacherImportDetail(row, {
            status: "failed",
            subject,
            branch,
            reason: getImportDetailMessage(error),
          }),
        );
      }
    }

    const importedRows = details.filter((detail) => detail.status === "imported").length;
    const failedRows = details.filter((detail) => detail.status === "failed").length;
    const skippedRows = details.filter((detail) => detail.status === "skipped").length;

    sendSuccess(res, {
      message: importedRows
        ? "Import data guru selesai."
        : "Tidak ada data guru baru yang berhasil diimpor.",
      data: {
        fileName,
        sheetName: parsedWorkbook.sheetName,
        summary: {
          totalRows: parsedWorkbook.rows.length,
          importedRows,
          failedRows,
          skippedRows,
        },
        details,
      },
    });
  },
);

export const updateTeacher = asyncHandler(
  async (
    req: Request<{ id: string }, Record<string, never>, TeacherRequestBody>,
    res: Response,
    next: NextFunction,
  ) => {
    const scope = await resolveAdminBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    const teacher = await findTeacherByParam(req.params.id);

    if (!teacher) {
      next(new AppError(404, "Data guru tidak ditemukan."));
      return;
    }

    assertTeacherBranchAccess(teacher, scope);

    const name = normalizeText(req.body.name);
    const email = normalizeEmail(req.body.email) || normalizeEmail(teacher.userId.email);
    const password = req.body.password?.trim() ?? "";
    const subject = normalizeText(req.body.subject);
    const branch = normalizeText(req.body.branch) || normalizeText(teacher.branch);
    const phone = normalizePhone(req.body.phone) || normalizePhone(teacher.phone) || "-";
    const schedule = normalizeText(req.body.schedule) || normalizeText(teacher.schedule) || "-";
    const activeClasses = parseActiveClasses(req.body.activeClasses ?? teacher.activeClasses ?? 0);
    const classList = normalizeText(req.body.classList) || normalizeText(teacher.classList);
    const address = normalizeText(req.body.address) || normalizeText(teacher.address);
    const education = normalizeText(req.body.education) || normalizeText(teacher.education);
    const status = normalizeText(req.body.status) || normalizeText(teacher.status);
    const availability =
      normalizeText(req.body.availability) ||
      normalizeText(teacher.availability) ||
      "Tersedia";

    if (
      !name ||
      !email ||
      !subject ||
      !branch ||
      !phone ||
      !schedule ||
      activeClasses === null ||
      !classList
    ) {
      next(new AppError(400, "Data guru belum lengkap."));
      return;
    }

    if (!isValidEmail(email)) {
      next(new AppError(400, "Email guru belum valid."));
      return;
    }

    if (!isTeacherStatus(status)) {
      next(new AppError(400, "Status guru belum valid."));
      return;
    }

    if (!isTeacherAvailability(availability)) {
      next(new AppError(400, "Ketersediaan guru belum valid."));
      return;
    }

    let resolvedBranch = await resolveTeacherBranchName(branch, {
      allowCurrentValue: teacher.branch,
    });

    if (resolvedBranch !== teacher.branch) {
      resolvedBranch = resolveAccessibleBranchName(resolvedBranch, scope, {
        useFirstManagedBranchAsDefault: true,
      });
    }



    let isEmailChanged = false;
    let plainVerificationToken: string | null = null;
    
    if (email && email !== teacher.userId.email) {
      const duplicateEmail = await User.findOne({
        email,
        _id: { $ne: teacher.userId._id },
      });
      if (duplicateEmail) {
        next(new AppError(409, "Email guru sudah digunakan."));
        return;
      }
      teacher.userId.email = email;
      isEmailChanged = true;
    }

    if (isEmailChanged) {
      if (email.endsWith("@bimbel.local")) {
        teacher.userId.isEmailVerified = true;
        teacher.userId.emailVerificationToken = null;
        teacher.userId.emailVerificationExpires = null;
      } else {
        plainVerificationToken = crypto.randomBytes(32).toString("hex");
        teacher.userId.isEmailVerified = false;
        teacher.userId.emailVerificationToken = crypto
          .createHash("sha256")
          .update(plainVerificationToken)
          .digest("hex");
        teacher.userId.emailVerificationExpires = null;
      }
    }

    if (!isPlaceholderPhone(phone)) {
      const duplicatePhone = await Teacher.findOne({
        phone,
        _id: { $ne: teacher._id },
      });

      if (duplicatePhone) {
        next(new AppError(409, "No. HP guru sudah digunakan."));
        return;
      }
    }

    teacher.userId.nama = name;
    teacher.userId.loginCode = teacher.userId.loginCode || buildTeacherLoginCode(teacher.teacherId);

    if (password) {
      if (password.length < 8) {
        next(new AppError(400, "Password guru minimal 8 karakter."));
        return;
      }

      teacher.userId.password = await bcrypt.hash(password, 12);
      clearUserLoginLock(teacher.userId);
    }

    teacher.subject = subject;
    teacher.branch = resolvedBranch;
    teacher.branches = Array.from(
      new Set([resolvedBranch, ...(teacher.branches ?? [])].filter(Boolean)),
    );
    teacher.phone = phone;
    teacher.schedule = schedule;
    teacher.activeClasses = activeClasses;
    teacher.classList = classList;
    teacher.capableGrades = classList.split(",").map(val => val.trim()).filter(Boolean);
    teacher.address = address;
    teacher.education = education;
    teacher.status = status as TeacherStatus;
    teacher.availability = availability as TeacherAvailability;

    await Promise.all([teacher.userId.save(), teacher.save()]);

    if (plainVerificationToken) {
      const { clientUrl } = validateEnv();
      const verificationLink = `${clientUrl}/verify-email?token=${plainVerificationToken}`;
      sendVerificationEmail({
        nama: name,
        email: email,
        verificationLink,
      }).catch((err) => {
        console.error("Gagal mengirim email verifikasi otomatis:", err);
      });
    }

    sendSuccess(res, {
      message: "Data guru berhasil diperbarui.",
      data: {
        teacher: toPublicTeacher(teacher, teacher.userId),
      },
    });
  },
);

export const resetTeacherPassword = asyncHandler(
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    const scope = await resolveAdminBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    const teacher = await findTeacherByParam(req.params.id);

    if (!teacher) {
      next(new AppError(404, "Data guru tidak ditemukan."));
      return;
    }

    assertTeacherBranchAccess(teacher, scope);

    const loginCode = buildTeacherLoginCode(teacher.teacherId);
    const generatedPassword = buildGeneratedPasswordFromTeacherId(teacher.teacherId);
    const duplicateLoginCode = await User.findOne({
      loginCode,
      _id: { $ne: teacher.userId._id },
    }).exec();

    if (duplicateLoginCode) {
      next(new AppError(409, "Kode login awal guru sudah digunakan akun lain."));
      return;
    }

    teacher.userId.loginCode = loginCode;
    teacher.userId.password = await bcrypt.hash(generatedPassword, 12);
    teacher.userId.passwordResetToken = null;
    teacher.userId.passwordResetExpires = null;
    clearUserLoginLock(teacher.userId);
    teacher.userId.isEmailVerified = true;
    teacher.userId.emailVerificationToken = null;
    teacher.userId.emailVerificationExpires = null;

    await teacher.userId.save();

    sendSuccess(res, {
      message: "Password guru berhasil direset ke password awal.",
      data: {
        teacher: toPublicTeacher(teacher, teacher.userId),
        credentials: {
          loginCode,
          password: generatedPassword,
        },
      },
    });
  },
);

export const deleteTeacher = asyncHandler(
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    const scope = await resolveAdminBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    const teacher = await findTeacherByParam(req.params.id);

    if (!teacher) {
      next(new AppError(404, "Data guru tidak ditemukan."));
      return;
    }

    assertTeacherBranchAccess(teacher, scope);

    await Promise.all([
      Schedule.deleteMany({ teacherId: teacher._id }),
      Teacher.deleteOne({ _id: teacher._id }),
      User.deleteOne({ _id: teacher.userId._id }),
    ]);

    sendSuccess(res, {
      message: "Data guru berhasil dihapus.",
    });
  },
);

export const resendTeacherVerification = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const teacher = await Teacher.findOne({ teacherId: id })
      .populate<{ userId: UserDocument }>("userId")
      .exec();

    if (!teacher || !teacher.userId) {
      next(new AppError(404, "Data guru tidak ditemukan."));
      return;
    }

    const user = teacher.userId;

    if (user.isEmailVerified) {
      next(new AppError(400, "Email guru ini sudah terverifikasi."));
      return;
    }

    if (!user.email || user.email.endsWith("@bimbel.local")) {
      next(
        new AppError(400, "Guru ini menggunakan email sistem, tidak perlu verifikasi."),
      );
      return;
    }

    const plainVerificationToken = crypto.randomBytes(32).toString("hex");
    user.emailVerificationToken = crypto
      .createHash("sha256")
      .update(plainVerificationToken)
      .digest("hex");
    user.emailVerificationExpires = null;
    await user.save();

    const { clientUrl } = validateEnv();
    const verificationLink = `${clientUrl}/verify-email?token=${plainVerificationToken}`;

    await sendVerificationEmail({
      nama: user.nama,
      email: user.email,
      verificationLink,
    });

    sendSuccess(res, {
      message: "Email verifikasi berhasil dikirim ulang.",
    });
  },
);
