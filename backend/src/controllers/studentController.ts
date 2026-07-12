import bcrypt from "bcrypt";
import { Types } from "mongoose";
import type { NextFunction, Request, Response } from "express";

import { Branch } from "../models/Branch";
import { Payment, type PaymentDocument } from "../models/Payment";
import {
  Student,
  STUDENT_STATUSES,
  type StudentDocument,
  type StudentStatus,
} from "../models/Student";
import { Subscription, type SubscriptionDocument } from "../models/Subscription";
import { User, type UserDocument } from "../models/User";
import {
  type PublicStudent,
  hasPopulatedUserDocument,
  toPublicStudent,
} from "../utils/adminView";
import asyncHandler from "../utils/asyncHandler";
import {
  assertBranchAccess,
  matchesBranchScope,
  resolveAccessibleBranchName,
  resolveAdminBranchScope,
  type AdminBranchScope,
} from "../utils/adminBranchScope";
import { AppError, sendSuccess } from "../utils/apiResponse";
import { buildStudentLoginCode } from "../utils/accountCode";
import { buildCsvContent } from "../utils/csv";
import { getNextPublicId } from "../utils/publicId";
import { getCurrentAcademicPeriod } from "../utils/academicGrade";
import {
  buildImportedStudentDuplicateKey,
  buildImportedStudentEmail,
  normalizeImportedStudentClassName,
  normalizeImportedStudentProgram,
  parseStudentImportWorkbook,
  type ParsedStudentImportRow,
} from "../utils/studentImport";
import {
  buildGeneratedPasswordForStudent,
} from "../utils/studentPassword";
import {
  applyPaidSubscriptionStudentData,
  markPaymentPaidManually,
} from "../utils/membershipPayments";
import {
  normalizeCanonicalClassName,
  normalizeStudentLevel,
} from "../utils/studentClass";
import {
  getClassPricedOnlinePackageByKey,
  getOnlinePackageByKey,
  resolveMembershipAccessStatus,
  selectPrimarySubscription,
  toPublicPayment,
  toPublicSubscription,
} from "../utils/subscription";

type StudentRequestBody = {
  name?: string;
  email?: string;
  phone?: string;
  branch?: string;
  program?: string;
  className?: string;
  birthDate?: string;
  academicYear?: string;
  status?: string;
  password?: string;
  membershipPaymentMode?: string;
  membershipPackageKey?: string;
  membershipPaymentMethod?: string;
  membershipPaidAt?: string;
};

type StudentImportRequestBody = {
  fileName?: string;
  fileDataBase64?: string;
};

type StudentListQuery = {
  page?: string;
  limit?: string;
  q?: string;
  sort?: string;
  status?: string;
  branch?: string;
  className?: string;
  level?: string;
  academicYear?: string;
};

type StudentWithUser = StudentDocument & {
  userId: UserDocument | null;
};

type StudentCreateInput = {
  studentId: string;
  name: string;
  email: string;
  loginCode: string;
  phone: string;
  branch: string;
  program: string;
  className: string;
  birthDate: Date | null;
  academicYear: string;
  status: StudentStatus;
  generatedPassword: string;
};

type StudentImportIssue = {
  rowNumber: number;
  name: string;
  className: string;
  program: string;
  status: "failed" | "skipped";
  reason: string;
};

type StudentListSummary = {
  totalItems: number;
  activeCount: number;
  inactiveCount: number;
  branchCount: number;
  classCount: number;
};

type StudentListEntry = {
  student: PublicStudent;
  createdAt: Date;
};

const MEMBERSHIP_PAYMENT_METHODS = [
  "cash",
  "manual_transfer",
  "qris_offline",
] as const;

type MembershipPaymentMode = "none" | "paid" | "pending";
type MembershipPaymentMethod = (typeof MEMBERSHIP_PAYMENT_METHODS)[number];

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

function parseBirthDate(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidClassName(value: string): boolean {
  return value.startsWith("SD ") || value.startsWith("SMP ") || value.startsWith("SMA ");
}

function normalizeMembershipPaymentMethod(value: string | undefined): MembershipPaymentMethod {
  const normalizedValue = normalizeText(value).toLowerCase();

  return MEMBERSHIP_PAYMENT_METHODS.includes(normalizedValue as MembershipPaymentMethod)
    ? (normalizedValue as MembershipPaymentMethod)
    : "cash";
}

function parseMembershipPaidAt(value: string | undefined): Date {
  const normalizedValue = normalizeText(value);
  const paidAt = normalizedValue ? new Date(normalizedValue) : new Date();

  if (Number.isNaN(paidAt.getTime())) {
    throw new AppError(400, "Tanggal pembayaran offline belum valid.", {
      membershipPaidAt: "Tanggal pembayaran offline belum valid.",
    });
  }

  return paidAt;
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

async function resolveStudentBranchName(value: string) {
  const normalizedBranch = normalizeText(value);

  if (!normalizedBranch) {
    return "";
  }

  const branch = await Branch.findOne({
    name: new RegExp(`^${escapeRegex(normalizedBranch)}$`, "i"),
  })
    .select("name")
    .exec();

  if (!branch) {
    throw new AppError(400, `Cabang "${normalizedBranch}" tidak ditemukan.`);
  }

  return branch.name;
}

async function getBranchNameMap() {
  const branches = await Branch.find().select("name").sort({ name: 1 }).exec();

  return new Map(
    branches.map((branch) => [normalizeText(branch.name).toLowerCase(), branch.name]),
  );
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

function getImportIssueMessage(
  error: unknown,
  fallback = "Terjadi kesalahan saat menyimpan siswa hasil import.",
): string {
  if (error instanceof AppError) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function hasResolvedStudentUser(
  student: StudentWithUser,
): student is StudentDocument & { userId: UserDocument } {
  return hasPopulatedUserDocument(student.userId);
}

function logSkippedStudents(context: string, students: StudentWithUser[]) {
  const skippedStudents = students.filter(
    (student) => !hasPopulatedUserDocument(student.userId),
  );

  if (!skippedStudents.length) {
    return;
  }

  console.warn(`[student-controller] ${context}_skipped_orphan_students`, {
    skippedCount: skippedStudents.length,
    studentIds: skippedStudents.map((student) => student.studentId),
  });
}

async function findStudentByParam(id: string): Promise<StudentWithUser | null> {
  return Student.findOne({
    $or: [
      { studentId: id },
      ...(Types.ObjectId.isValid(id) ? [{ _id: id }] : []),
    ],
  })
    .populate<{ userId: StudentWithUser["userId"] }>("userId")
    .exec() as Promise<StudentWithUser | null>;
}

function buildStudentFinancialHistoryQuery(student: StudentWithUser) {
  const referenceFilters: Array<Record<string, Types.ObjectId>> = [
    { studentId: student._id },
  ];

  if (hasPopulatedUserDocument(student.userId)) {
    referenceFilters.push({ userId: student.userId._id });
  }

  return referenceFilters.length === 1
    ? referenceFilters[0]
    : { $or: referenceFilters };
}

async function getStudentFinancialHistory(student: StudentWithUser) {
  const query = buildStudentFinancialHistoryQuery(student);
  const [paymentCount, subscriptionCount] = await Promise.all([
    Payment.countDocuments(query).exec(),
    Subscription.countDocuments(query).exec(),
  ]);

  return {
    paymentCount,
    subscriptionCount,
    hasFinancialHistory: paymentCount > 0 || subscriptionCount > 0,
  };
}

async function createStudentAccount(
  input: StudentCreateInput,
): Promise<StudentWithUser> {
  const existingUser = await User.findOne({
    $or: [{ email: input.email }, { loginCode: input.loginCode }],
  }).exec();

  if (existingUser) {
    throw new AppError(409, "Email atau kode login siswa sudah digunakan.");
  }

  const hashedPassword = await bcrypt.hash(input.generatedPassword, 12);
  let createdUser: UserDocument | null = null;

  try {
    createdUser = await User.create({
      nama: input.name,
      email: input.email,
      loginCode: input.loginCode,
      password: hashedPassword,
      role: "siswa",
      isEmailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null,
    });

    const student = await Student.create({
      studentId: input.studentId,
      userId: createdUser._id,
      phone: input.phone,
      branch: input.branch,
      program: input.program,
      className: input.className,
      academicYear: input.academicYear,
      birthDate: input.birthDate,
      status: input.status,
    });

    const populatedStudent = (await Student.findById(student._id)
      .populate<{ userId: StudentWithUser["userId"] }>("userId")
      .exec()) as StudentWithUser | null;

    if (!populatedStudent) {
      throw new AppError(500, "Gagal memuat ulang data siswa yang baru dibuat.");
    }

    return populatedStudent;
  } catch (error) {
    if (createdUser) {
      await User.deleteOne({ _id: createdUser._id });
    }

    throw error;
  }
}

async function getExistingStudentImportKeys(): Promise<Set<string>> {
  const students = (await Student.find()
    .populate<{ userId: StudentWithUser["userId"] }>("userId")
    .exec()) as StudentWithUser[];
  const resolvedStudents = students.filter(hasResolvedStudentUser);

  logSkippedStudents("import_keys", students);

  return new Set(
    resolvedStudents.map((student) =>
      buildImportedStudentDuplicateKey({
        name: student.userId.nama,
        className: student.className,
        program: student.program,
      }),
    ),
  );
}

function buildImportIssue(
  row: ParsedStudentImportRow,
  status: StudentImportIssue["status"],
  reason: string,
  normalizedClassName = "",
  normalizedProgram = "",
): StudentImportIssue {
  return {
    rowNumber: row.rowNumber,
    name: normalizeText(row.name),
    className: normalizedClassName || normalizeText(row.classNameRaw),
    program: normalizedProgram || normalizeImportedStudentProgram(row.programRaw),
    status,
    reason,
  };
}

async function getResolvedStudentEntries() {
  const students = (await Student.find()
    .populate<{ userId: StudentWithUser["userId"] }>("userId")
    .sort({ createdAt: -1 })
    .exec()) as StudentWithUser[];
  const resolvedStudents = students.filter(hasResolvedStudentUser);

  logSkippedStudents("list", students);

  const studentObjectIds = resolvedStudents.map((s) => s._id);
  const subscriptions = await Subscription.find({
    studentId: { $in: studentObjectIds },
  })
    .sort({ createdAt: -1, _id: -1 })
    .exec();

  const subscriptionsByStudentId = new Map<string, typeof subscriptions>();
  for (const sub of subscriptions) {
    const sid = String(sub.studentId);
    if (!subscriptionsByStudentId.has(sid)) {
      subscriptionsByStudentId.set(sid, []);
    }
    subscriptionsByStudentId.get(sid)!.push(sub);
  }

  return resolvedStudents.map((student) => {
    const studentSubs = subscriptionsByStudentId.get(String(student._id)) ?? [];
    const primarySub = selectPrimarySubscription(studentSubs);

    let membership: PublicStudent["membership"] = { status: "none" };

    if (primarySub) {
      const accessStatus = resolveMembershipAccessStatus(primarySub);
      const pkg = getOnlinePackageByKey(primarySub.packageKey);

      membership = {
        status: accessStatus === "not_registered" ? "none" : accessStatus,
        packageKey: primarySub.packageKey,
        packageName: pkg?.packageName || primarySub.packageKey,
        paymentStatus: primarySub.paymentStatus,
        startDate: primarySub.startDate?.toISOString(),
        endDate: primarySub.endDate?.toISOString(),
      };
    }

    return {
      student: toPublicStudent(student, student.userId, membership),
      createdAt: student.createdAt,
    };
  });
}

function sortStudentEntries(entries: StudentListEntry[], sort: string | undefined) {
  const sortValue = normalizeText(sort).toLowerCase() || "createdat_desc";

  const sortedEntries = [...entries];

  sortedEntries.sort((leftEntry, rightEntry) => {
    switch (sortValue) {
      case "createdat_asc":
        return leftEntry.createdAt.getTime() - rightEntry.createdAt.getTime();
      case "name_asc":
        return leftEntry.student.name.localeCompare(rightEntry.student.name, "id-ID");
      case "name_desc":
        return rightEntry.student.name.localeCompare(leftEntry.student.name, "id-ID");
      case "classname_asc":
        return leftEntry.student.className.localeCompare(
          rightEntry.student.className,
          "id-ID",
        );
      case "classname_desc":
        return rightEntry.student.className.localeCompare(
          leftEntry.student.className,
          "id-ID",
        );
      case "branch_asc":
        return leftEntry.student.branch.localeCompare(
          rightEntry.student.branch,
          "id-ID",
        );
      case "branch_desc":
        return rightEntry.student.branch.localeCompare(
          leftEntry.student.branch,
          "id-ID",
        );
      case "status_asc":
        return leftEntry.student.status.localeCompare(rightEntry.student.status, "id-ID");
      case "status_desc":
        return rightEntry.student.status.localeCompare(leftEntry.student.status, "id-ID");
      case "studentid_asc":
        return leftEntry.student.id.localeCompare(rightEntry.student.id, "id-ID");
      case "studentid_desc":
        return rightEntry.student.id.localeCompare(leftEntry.student.id, "id-ID");
      case "createdat_desc":
      default:
        return rightEntry.createdAt.getTime() - leftEntry.createdAt.getTime();
    }
  });

  return sortedEntries;
}

async function buildStudentListPayload(
  query: StudentListQuery,
  scope: AdminBranchScope,
) {
  const searchTokens = tokenizeSearchQuery(query.q);
  const normalizedStatus = normalizeText(query.status);
  const branchFilter = normalizeText(query.branch);
  const normalizedClassName = normalizeCanonicalClassName(query.className);
  const levelFilter = normalizeStudentLevel(query.level);
  const academicYearFilter = normalizeText(query.academicYear);
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
    !STUDENT_STATUSES.includes(normalizedStatus as (typeof STUDENT_STATUSES)[number])
  ) {
    throw new AppError(400, "Status siswa filter tidak valid.");
  }

  if (query.level && !levelFilter) {
    throw new AppError(400, "Jenjang siswa filter tidak valid.");
  }

  if (query.className && !normalizedClassName) {
    throw new AppError(400, "Kelas siswa filter tidak valid.");
  }

  const filteredEntries = sortStudentEntries(await getResolvedStudentEntries(), query.sort).filter(
    ({ student }) => {
      const matchesQuery = matchesSearchQuery(searchTokens, [
        student.id,
        student.loginCode,
        student.name,
        student.email,
        student.phone,
        student.branch,
        student.program,
        student.className,
        student.level,
        student.status,
      ]);
      const matchesStatus = normalizedStatus ? student.status === normalizedStatus : true;
      const matchesBranch = matchesBranchScope(student.branch, scope, branchFilter);
      const matchesClassName = normalizedClassName
        ? normalizeCanonicalClassName(student.className) === normalizedClassName
        : true;
      const matchesLevel = levelFilter ? student.level === levelFilter : true;
      const matchesAcademicYear = academicYearFilter ? student.academicYear === academicYearFilter : true;

      return (
        matchesQuery &&
        matchesStatus &&
        matchesBranch &&
        matchesClassName &&
        matchesLevel &&
        matchesAcademicYear
      );
    },
  );

  const items = filteredEntries.map((entry) => entry.student);
  const totalItems = items.length;
  const totalPages = totalItems === 0 ? 1 : Math.ceil(totalItems / requestedLimit);
  const safePage = shouldPaginate ? Math.min(requestedPage, totalPages) : 1;
  const offset = shouldPaginate ? (safePage - 1) * requestedLimit : 0;
  const paginatedItems = shouldPaginate
    ? items.slice(offset, offset + requestedLimit)
    : items;

  return {
    students: paginatedItems,
    filteredStudents: items,
    summary: {
      totalItems,
      activeCount: items.filter((student) => student.status === "Aktif").length,
      inactiveCount: items.filter((student) => student.status === "Nonaktif").length,
      branchCount: new Set(
        items.map((student) => normalizeText(student.branch)).filter(Boolean),
      ).size,
      classCount: new Set(items.map((student) => student.className)).size,
    } satisfies StudentListSummary,
    pagination: {
      page: safePage,
      limit: shouldPaginate ? requestedLimit : Math.max(totalItems, 1),
      totalPages: shouldPaginate ? totalPages : totalItems > 0 ? 1 : 1,
      totalItems,
    },
  };
}

async function createOfflineMembershipPaymentForStudent(params: {
  student: StudentDocument;
  user: UserDocument;
  adminId: Types.ObjectId;
  packageKey: string;
  className: string;
  paymentMode: Exclude<MembershipPaymentMode, "none">;
  paymentMethod: MembershipPaymentMethod;
  paidAt: Date;
}) {
  const packageDefinition = getClassPricedOnlinePackageByKey(
    params.packageKey,
    params.className,
  );

  if (!packageDefinition) {
    throw new AppError(400, "Paket membership offline belum valid.", {
      membershipPackageKey: "Paket membership offline belum valid.",
    });
  }

  const subscriptionCode = await getNextPublicId(Subscription, "subscriptionCode", "SUB");
  const paymentId = await getNextPublicId(Payment, "paymentId", "PAY");
  let subscription: SubscriptionDocument | null = null;
  let payment: PaymentDocument | null = null;

  try {
    subscription = await Subscription.create({
      subscriptionCode,
      userId: params.user._id,
      studentId: params.student._id,
      packageKey: packageDefinition.packageKey,
      packageName: packageDefinition.packageName,
      durationMonth: packageDefinition.durationMonth,
      startDate: null,
      endDate: null,
      status: "pending",
      paymentStatus: "pending",
      source: "admin",
      createdByAdminId: params.adminId,
      renewalOfSubscriptionId: null,
      targetProgram: params.student.program,
      targetClassName: params.student.className,
    });

    payment = await Payment.create({
      paymentId,
      userId: params.user._id,
      studentId: params.student._id,
      subscriptionId: subscription._id,
      packageKey: packageDefinition.packageKey,
      packageName: packageDefinition.packageName,
      durationMonth: packageDefinition.durationMonth,
      amount: packageDefinition.amount,
      provider: "manual",
      method: params.paymentMethod,
      status: "pending",
      source: "admin",
      createdByAdminId: params.adminId,
      paidAt: null,
    });

    if (params.paymentMode === "paid") {
      const paidResult = await markPaymentPaidManually({
        payment,
        subscription,
        paidAt: params.paidAt,
        method: params.paymentMethod,
      });

      if (paidResult.paymentChanged || paidResult.subscriptionChanged) {
        await Promise.all([
          paidResult.paymentChanged ? payment.save() : Promise.resolve(payment),
          paidResult.subscriptionChanged
            ? subscription.save()
            : Promise.resolve(subscription),
        ]);
      }

      await applyPaidSubscriptionStudentData(subscription);
    }

    return {
      subscription,
      payment,
    };
  } catch (error) {
    await Promise.all([
      payment ? Payment.deleteOne({ _id: payment._id }) : Promise.resolve(),
      subscription
        ? Subscription.deleteOne({ _id: subscription._id })
        : Promise.resolve(),
    ]);

    throw error;
  }
}

export const getStudents = asyncHandler(
  async (
    req: Request<Record<string, string>, Record<string, never>, Record<string, never>, StudentListQuery>,
    res: Response,
  ) => {
    const scope = await resolveAdminBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    const payload = await buildStudentListPayload(req.query, scope);

  sendSuccess(res, {
    data: {
      students: payload.students,
      summary: payload.summary,
      pagination: payload.pagination,
    },
  });
  },
);

export const exportStudents = asyncHandler(
  async (
    req: Request<Record<string, string>, Record<string, never>, Record<string, never>, StudentListQuery>,
    res: Response,
  ) => {
    const scope = await resolveAdminBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    const payload = await buildStudentListPayload(req.query, scope);
    const csvContent = buildCsvContent(
      [
        "Student ID",
        "Kode Login",
        "Nama",
        "Email",
        "No HP",
        "Cabang",
        "Program",
        "Jenjang",
        "Kelas",
        "Tanggal Lahir",
        "Tahun Akademik",
        "Status",
      ],
      payload.filteredStudents.map((student) => [
        student.id,
        student.loginCode,
        student.name,
        student.email,
        student.phone,
        student.branch,
        student.program,
        student.level,
        student.className,
        student.birthDate ? new Date(student.birthDate).toISOString().slice(0, 10) : "",
        student.academicYear,
        student.status,
      ]),
    );

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="students-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    res.status(200).send(csvContent);
  },
);

export const getStudentById = asyncHandler(
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    const scope = await resolveAdminBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    const student = await findStudentByParam(req.params.id);

    if (!student) {
      next(new AppError(404, "Data siswa tidak ditemukan."));
      return;
    }

    if (!hasResolvedStudentUser(student)) {
      next(
        new AppError(
          404,
          "Data siswa tidak dapat ditampilkan karena akun user terkait tidak ditemukan.",
        ),
      );
      return;
    }

    assertBranchAccess(student.branch, scope);

    sendSuccess(res, {
      data: {
        student: toPublicStudent(student, student.userId),
      },
    });
  },
);

export const createStudent = asyncHandler(
  async (
    req: Request<Record<string, string>, Record<string, never>, StudentRequestBody>,
    res: Response,
    next: NextFunction,
  ) => {
    const scope = await resolveAdminBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    const authenticatedUser = req.user;

    if (!authenticatedUser) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const name = normalizeText(req.body.name);
    const email = normalizeEmail(req.body.email);
    const phone = normalizePhone(req.body.phone);
    const branch = resolveAccessibleBranchName(
      await resolveStudentBranchName(req.body.branch ?? ""),
      scope,
      {
        useFirstManagedBranchAsDefault: true,
      },
    );
    const program = normalizeText(req.body.program);
    const className = normalizeText(req.body.className);
    const birthDate = parseBirthDate(req.body.birthDate);
    const academicYear = normalizeText(req.body.academicYear) || getCurrentAcademicPeriod().academicYear;
    const status = normalizeText(req.body.status) as StudentRequestBody["status"];
    const membershipPaymentMode: Exclude<
      MembershipPaymentMode,
      "none" | "pending"
    > = "paid";
    const membershipPackageKey = normalizeText(req.body.membershipPackageKey);
    const membershipPaymentMethod = normalizeMembershipPaymentMethod(
      req.body.membershipPaymentMethod,
    );
    const membershipPaidAt = parseMembershipPaidAt(req.body.membershipPaidAt);

    if (!name) {
      next(new AppError(400, "Nama siswa wajib diisi."));
      return;
    }

    if (email && !isValidEmail(email)) {
      next(new AppError(400, "Email siswa belum valid."));
      return;
    }

    if (!phone) {
      next(new AppError(400, "No. HP siswa wajib diisi."));
      return;
    }

    if (!program) {
      next(new AppError(400, "Program siswa wajib diisi."));
      return;
    }

    if (!className || !isValidClassName(className)) {
      next(new AppError(400, "Kelas siswa belum valid."));
      return;
    }

    if (!birthDate || !req.body.birthDate) {
      next(new AppError(400, "Tanggal lahir siswa belum valid."));
      return;
    }

    if (!academicYear) {
      next(new AppError(400, "Tahun akademik siswa wajib diisi."));
      return;
    }

    if (!status || !STUDENT_STATUSES.includes(status as (typeof STUDENT_STATUSES)[number])) {
      next(new AppError(400, "Status siswa belum valid."));
      return;
    }

    const password = req.body.password?.trim() ?? "";

    if (password && password.length < 8) {
      next(new AppError(400, "Password siswa minimal 8 karakter."));
      return;
    }

    const membershipPackage = getClassPricedOnlinePackageByKey(
      membershipPackageKey,
      className,
    );

    if (!membershipPackageKey) {
      next(new AppError(400, "Paket membership offline wajib dipilih.", {
        membershipPackageKey: "Paket membership offline wajib dipilih.",
      }));
      return;
    }

    if (!membershipPackage) {
      next(new AppError(400, "Paket membership offline belum valid.", {
        membershipPackageKey: "Paket membership offline belum valid.",
      }));
      return;
    }

    const studentId = await getNextPublicId(Student, "studentId", "STD");
    const generatedPassword = password || buildGeneratedPasswordForStudent({ studentId });

    if (!generatedPassword) {
      next(new AppError(400, "Password siswa gagal digenerate dari kode akun."));
      return;
    }

    const resolvedEmail = email || buildImportedStudentEmail(studentId);
    const loginCode = buildStudentLoginCode(studentId);
    const student = await createStudentAccount({
      studentId,
      name,
      email: resolvedEmail,
      loginCode,
      phone,
      branch,
      program,
      className,
      birthDate,
      academicYear,
      status: status as StudentStatus,
      generatedPassword,
    });
    let membership:
      | Awaited<ReturnType<typeof createOfflineMembershipPaymentForStudent>>
      | null = null;
    const createdStudentId = student._id;

    if (!hasResolvedStudentUser(student)) {
      await Student.deleteOne({ _id: createdStudentId });
      next(new AppError(500, "Akun siswa gagal dimuat untuk membuat pembayaran offline."));
      return;
    }

    const createdStudentUser = student.userId;

    try {
      membership = await createOfflineMembershipPaymentForStudent({
        student,
        user: createdStudentUser,
        adminId: authenticatedUser._id,
        packageKey: membershipPackageKey,
        className,
        paymentMode: membershipPaymentMode,
        paymentMethod: membershipPaymentMethod,
        paidAt: membershipPaidAt,
      });
    } catch (error) {
      await Promise.all([
        Student.deleteOne({ _id: createdStudentId }),
        User.deleteOne({ _id: createdStudentUser._id }),
      ]);
      throw error;
    }
    const membershipSnapshot: PublicStudent["membership"] | undefined = membership
      ? (() => {
          const accessStatus =
            membership.subscription.paymentStatus === "paid"
              ? resolveMembershipAccessStatus(membership.subscription)
              : "pending";

          return {
            status: accessStatus === "not_registered" ? "none" : accessStatus,
            packageKey: membership.subscription.packageKey,
            packageName: membership.subscription.packageName,
            paymentStatus: membership.subscription.paymentStatus,
            startDate: membership.subscription.startDate?.toISOString(),
            endDate: membership.subscription.endDate?.toISOString(),
          };
        })()
      : undefined;

    sendSuccess(res, {
      statusCode: 201,
      message: "Data siswa dan pembayaran offline berhasil dibuat.",
      data: {
        student: toPublicStudent(
          student,
          student.userId,
          membershipSnapshot,
        ),
        ...(membership
          ? {
              subscription: toPublicSubscription(membership.subscription),
              payment: toPublicPayment(membership.payment),
            }
          : {}),
      },
    });
  },
);

export const importStudents = asyncHandler(
  async (
    req: Request<Record<string, string>, Record<string, never>, StudentImportRequestBody>,
    res: Response,
    next: NextFunction,
  ) => {
    const scope = await resolveAdminBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    const fileName = normalizeText(req.body.fileName);
    const fileBuffer = decodeImportFileData(req.body.fileDataBase64);

    if (!fileName || !fileBuffer) {
      next(new AppError(400, "File import siswa belum dikirim dengan benar."));
      return;
    }

    let parsedWorkbook: {
      sheetName: string;
      rows: ParsedStudentImportRow[];
    };

    try {
      parsedWorkbook = parseStudentImportWorkbook(fileBuffer);
    } catch (error) {
      next(
        new AppError(
          400,
          error instanceof Error
            ? error.message
            : "File Excel siswa tidak dapat diproses.",
        ),
      );
      return;
    }

    const existingKeys = await getExistingStudentImportKeys();
    const branchNameMap = await getBranchNameMap();
    const importedKeys = new Set<string>();
    const issues: StudentImportIssue[] = [];
    let importedRows = 0;

    for (const row of parsedWorkbook.rows) {
      const name = normalizeText(row.name);
      const className = normalizeImportedStudentClassName(row.classNameRaw);
      const program = normalizeImportedStudentProgram(row.programRaw);
      const normalizedBranch = normalizeText(row.branchRaw);
      const importedBranch = normalizedBranch
        ? branchNameMap.get(normalizedBranch.toLowerCase()) ?? null
        : "";
      let branch = "";

      if (!name) {
        issues.push(buildImportIssue(row, "skipped", "Nama siswa kosong."));
        continue;
      }

      if (!className) {
        issues.push(
          buildImportIssue(
            row,
            "skipped",
            "Kelas tidak valid. Gunakan kelas 4 sampai 12 atau format SD/SMP/SMA.",
            normalizeText(row.classNameRaw),
            program,
          ),
        );
        continue;
      }

      if (normalizedBranch && !importedBranch) {
        issues.push(
          buildImportIssue(
            row,
            "skipped",
            `Cabang "${normalizedBranch}" tidak ditemukan di backend.`,
            className,
            program,
          ),
        );
        continue;
      }

      try {
        branch = resolveAccessibleBranchName(importedBranch, scope, {
          useFirstManagedBranchAsDefault: true,
        });
      } catch (error) {
        issues.push(
          buildImportIssue(
            row,
            "skipped",
            error instanceof Error
              ? error.message
              : "Cabang siswa pada file import berada di luar scope admin.",
            className,
            program,
          ),
        );
        continue;
      }

      const duplicateKey = buildImportedStudentDuplicateKey({
        name,
        className,
        program,
      });

      if (existingKeys.has(duplicateKey) || importedKeys.has(duplicateKey)) {
        issues.push(
          buildImportIssue(
            row,
            "skipped",
            "Data siswa dengan nama, kelas, dan asal sekolah yang sama sudah ada.",
            className,
            program,
          ),
        );
        continue;
      }

      const studentId = await getNextPublicId(Student, "studentId", "STD");
      const email = buildImportedStudentEmail(studentId);
      const loginCode = buildStudentLoginCode(studentId);
      const generatedPassword = buildGeneratedPasswordForStudent({ studentId });

      try {
        await createStudentAccount({
          studentId,
          name,
          email,
          loginCode,
          phone: "",
          branch,
          program,
          className,
          birthDate: null,
          academicYear: "",
          status: "Aktif",
          generatedPassword,
        });
        existingKeys.add(duplicateKey);
        importedKeys.add(duplicateKey);
        importedRows += 1;
      } catch (error) {
        issues.push(
          buildImportIssue(
            row,
            "failed",
            getImportIssueMessage(error),
            className,
            program,
          ),
        );
      }
    }

    const failedRows = issues.filter((issue) => issue.status === "failed").length;
    const skippedRows = issues.filter((issue) => issue.status === "skipped").length;

    sendSuccess(res, {
      message: importedRows
        ? "Import data siswa selesai."
        : "Tidak ada data siswa baru yang berhasil diimpor.",
      data: {
        fileName,
        sheetName: parsedWorkbook.sheetName,
        summary: {
          totalRows: parsedWorkbook.rows.length,
          importedRows,
          failedRows,
          skippedRows,
        },
        issues,
      },
    });
  },
);

export const updateStudent = asyncHandler(
  async (
    req: Request<{ id: string }, Record<string, never>, StudentRequestBody>,
    res: Response,
    next: NextFunction,
  ) => {
    const scope = await resolveAdminBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    const student = await findStudentByParam(req.params.id);

    if (!student) {
      next(new AppError(404, "Data siswa tidak ditemukan."));
      return;
    }

    assertBranchAccess(student.branch, scope);

    if (!hasResolvedStudentUser(student)) {
      next(
        new AppError(
          409,
          "Data siswa tidak dapat diperbarui karena akun user terkait tidak ditemukan.",
        ),
      );
      return;
    }

    const name = normalizeText(req.body.name);
    const email = normalizeEmail(req.body.email);
    const phone = normalizePhone(req.body.phone);
    const branch = resolveAccessibleBranchName(
      await resolveStudentBranchName(req.body.branch ?? ""),
      scope,
      {
        useFirstManagedBranchAsDefault: true,
      },
    );
    const program = normalizeText(req.body.program);
    const className = normalizeText(req.body.className);
    const birthDate = parseBirthDate(req.body.birthDate);
    const academicYear = normalizeText(req.body.academicYear);
    const status = normalizeText(req.body.status) as StudentRequestBody["status"];

    if (!name || !email || !phone || !program || !className || !req.body.birthDate || !birthDate || !academicYear) {
      next(new AppError(400, "Data siswa belum lengkap."));
      return;
    }

    if (!isValidEmail(email)) {
      next(new AppError(400, "Email siswa belum valid."));
      return;
    }

    if (!isValidClassName(className)) {
      next(new AppError(400, "Kelas siswa belum valid."));
      return;
    }

    if (!status || !STUDENT_STATUSES.includes(status as (typeof STUDENT_STATUSES)[number])) {
      next(new AppError(400, "Status siswa belum valid."));
      return;
    }

    const duplicateUser = await User.findOne({
      email,
      _id: { $ne: student.userId._id },
    });

    if (duplicateUser) {
      next(new AppError(409, "Email siswa sudah digunakan."));
      return;
    }

    student.userId.nama = name;
    student.userId.email = email;
    student.userId.loginCode = student.userId.loginCode || buildStudentLoginCode(student.studentId);
    student.phone = phone;
    student.branch = branch;
    student.program = program;
    student.className = className;
    student.birthDate = birthDate;
    student.academicYear = academicYear;
    student.status = status as StudentStatus;

    const password = req.body.password?.trim() ?? "";
    if (password) {
      if (password.length < 8) {
        next(new AppError(400, "Password siswa minimal 8 karakter."));
        return;
      }
      student.userId.password = await bcrypt.hash(password, 12);
    }

    student.userId.isEmailVerified = true;
    student.userId.emailVerificationToken = null;
    student.userId.emailVerificationExpires = null;

    await Promise.all([student.userId.save(), student.save()]);

    sendSuccess(res, {
      message: "Data siswa berhasil diperbarui.",
      data: {
        student: toPublicStudent(student, student.userId),
      },
    });
  },
);

export const deleteStudent = asyncHandler(
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    const scope = await resolveAdminBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    const student = await findStudentByParam(req.params.id);

    if (!student) {
      next(new AppError(404, "Data siswa tidak ditemukan."));
      return;
    }

    assertBranchAccess(student.branch, scope);

    const financialHistory = await getStudentFinancialHistory(student);

    if (financialHistory.hasFinancialHistory) {
      const wasArchived = student.status === "Nonaktif";

      if (!wasArchived) {
        student.status = "Nonaktif";
        await student.save();
      }

      if (!hasPopulatedUserDocument(student.userId)) {
        sendSuccess(res, {
          message: wasArchived
            ? "Siswa tidak dihapus karena memiliki histori pembayaran atau subscription. Record siswa tetap dipertahankan sebagai Nonaktif."
            : "Siswa tidak dihapus karena memiliki histori pembayaran atau subscription. Record siswa dipertahankan dan statusnya diubah menjadi Nonaktif.",
          data: {
            deletionMode: "archived",
            hasFinancialHistory: true,
            paymentCount: financialHistory.paymentCount,
            subscriptionCount: financialHistory.subscriptionCount,
            studentId: student.studentId,
            status: student.status,
          },
        });
        return;
      }

      sendSuccess(res, {
        message: wasArchived
          ? "Siswa tidak bisa dihapus karena memiliki histori pembayaran atau subscription. Status siswa tetap Nonaktif."
          : "Siswa tidak bisa dihapus karena memiliki histori pembayaran atau subscription. Status siswa diubah menjadi Nonaktif.",
        data: {
          deletionMode: "archived",
          hasFinancialHistory: true,
          paymentCount: financialHistory.paymentCount,
          subscriptionCount: financialHistory.subscriptionCount,
          student: toPublicStudent(student, student.userId),
        },
      });
      return;
    }

    if (!hasPopulatedUserDocument(student.userId)) {
      await Student.deleteOne({ _id: student._id });

      sendSuccess(res, {
        message: "Data siswa orphan berhasil dibersihkan.",
        data: {
          deletionMode: "deleted",
          hasFinancialHistory: false,
        },
      });
      return;
    }

    await Promise.all([
      Student.deleteOne({ _id: student._id }),
      User.deleteOne({ _id: student.userId._id }),
    ]);

    sendSuccess(res, {
      message: "Data siswa berhasil dihapus.",
      data: {
        deletionMode: "deleted",
        hasFinancialHistory: false,
      },
    });
  },
);
