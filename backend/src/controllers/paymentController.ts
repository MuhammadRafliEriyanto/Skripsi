import type { NextFunction, Request, Response } from "express";

import { validateEnv } from "../config/env";
import { Expense } from "../models/Expense";
import {
  PAYMENT_SOURCES,
  PAYMENT_STATUSES,
  Payment,
  type PaymentDocument,
} from "../models/Payment";
import { Subscription, type SubscriptionDocument } from "../models/Subscription";
import { hasPopulatedUserDocument } from "../utils/adminView";
import { buildCsvContent } from "../utils/csv";
import {
  buildXenditReturnUrls,
  expireXenditInvoice,
  createXenditInvoice,
  type XenditInvoiceWebhookPayload,
  XenditServiceError,
  verifyXenditWebhookToken,
} from "../services/xenditService";
import { User, type UserDocument } from "../models/User";
import { Student, type StudentDocument } from "../models/Student";
import { AppError, sendSuccess } from "../utils/apiResponse";
import asyncHandler from "../utils/asyncHandler";
import {
  resolveAccessibleBranchName,
  resolveFinanceBranchScope,
  toPublicFinanceScope,
  type FinanceBranchScope,
} from "../utils/branchFinanceScope";
import {
  applyXenditSessionSnapshot,
  applyPaidSubscriptionStudentData,
  buildXenditPermissionHelpMessage,
  createAdminPaymentSessionForStudent,
  expirePendingPayment,
  findStudentAndUserByPublicStudentId,
  isXenditBackedPayment,
  markPaymentPaidManually,
  markPaymentPaidFromProvider,
  normalizeXenditSessionSnapshot,
  resolveLatestPackageForStudent,
  replaceAdminPaymentSessionForStudent,
  syncPendingPaymentWithXendit,
  type XenditSessionSnapshot,
} from "../utils/membershipPayments";
import {
  refreshSubscriptionLifecycle,
  resolveMembershipAccessStatus,
  selectPrimarySubscription,
  getOnlinePackageByKey,
  type StudentWithUser,
  toPublicPayment,
  toPublicStudentMembership,
  toPublicSubscription,
} from "../utils/subscription";
import {
  normalizeCanonicalClassName,
  normalizeStudentLevel,
  resolveCanonicalClassSelection,
} from "../utils/studentClass";

type ConfirmPaymentRequestBody = {
  paymentId?: string;
  method?: string;
};

type TestXenditSessionRequestBody = {
  amount?: number;
  email?: string;
  phone?: string;
  givenNames?: string;
  surname?: string;
};

type AdminCreateSessionRequestBody = {
  studentId?: string;
  packageKey?: string;
  expiresAt?: string;
};

type AdminCreateBatchSessionRequestBody = {
  level?: string;
  grade?: string;
  className?: string;
  branch?: string;
  packageMode?: string;
  packageKey?: string;
  expiresAt?: string | null;
  includeInactive?: boolean;
};

type AdminUpdatePaymentStatusRequestBody = {
  status?: string;
  paidAt?: string;
};

type AdminReplacePaymentRequestBody = {
  packageKey?: string;
  expiresAt?: string;
};

type AdminArchivePaymentRequestBody = {
  reason?: string;
};

const ARCHIVED_PAYMENT_STATUS_FILTER = "archived";

type AdminBatchPackageMode = "follow_latest_package" | "fixed_package";

type AdminBatchReasonCode =
  | "NO_PREVIOUS_PACKAGE"
  | "INVALID_PREVIOUS_PACKAGE"
  | "STUDENT_USER_NOT_FOUND"
  | "STUDENT_INACTIVE"
  | "BLOCKING_PENDING_PAYMENT"
  | "XENDIT_SESSION_FAILED"
  | "UNKNOWN_ERROR";

type AdminBatchItemResolvedPackage = {
  packageKey: string;
  packageName: string;
  durationMonth: number;
  source: "fixed_package" | "latest_subscription";
  sourceSubscriptionCode?: string | null;
};

type AdminBatchItem = {
  studentId: string;
  studentName: string;
  email: string | null;
  className: string;
  canonicalClassName: string;
  studentStatus: StudentDocument["status"];
  status: "created" | "skipped" | "failed";
  reasonCode?: AdminBatchReasonCode;
  message: string;
  resolvedPackage?: AdminBatchItemResolvedPackage;
  paymentId?: string;
  subscriptionCode?: string;
  checkoutUrl?: string | null;
  statusPagePath?: string | null;
  blockingPaymentId?: string;
  blockingSubscriptionCode?: string;
};

type AdminPaymentsQuery = {
  page?: string;
  limit?: string;
  q?: string;
  status?: string;
  package?: string;
  packageKey?: string;
  source?: string;
  branch?: string;
  program?: string;
  className?: string;
  dateFrom?: string;
  dateTo?: string;
};

type AdminPaymentsSummaryQuery = AdminPaymentsQuery & {
  period?: string;
};

type AdminActivationsQuery = {
  page?: string;
  limit?: string;
  q?: string;
  paymentStatus?: string;
  activationStatus?: string;
  package?: string;
  branch?: string;
  className?: string;
  level?: string;
};

type XenditWebhookPayload = XenditInvoiceWebhookPayload;

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function readSingleHeaderValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function resolveStablePaymentIdFromXenditSession(session: XenditSessionSnapshot) {
  return normalizeText(session.external_id);
}

async function buildPaymentStatusResponse(paymentId: string) {
  const payment = await Payment.findOne({ paymentId }).exec();

  if (!payment) {
    throw new AppError(404, "Data pembayaran tidak ditemukan.", null, "PAYMENT_NOT_FOUND");
  }

  const subscription = await refreshSubscriptionLifecycle(
    await Subscription.findById(payment.subscriptionId).exec(),
  );

  if (!subscription) {
    throw new AppError(
      404,
      "Subscription terkait pembayaran tidak ditemukan.",
      null,
      "SUBSCRIPTION_NOT_FOUND",
    );
  }

  try {
    await syncPendingPaymentWithXendit(payment, subscription);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown Xendit sync error";
    console.error("[payment-status] sync_xendit_failed", {
      paymentId: payment.paymentId,
      paymentSessionId: payment.xenditPaymentSessionId,
      message: errorMessage,
      errorCode: error instanceof XenditServiceError ? error.errorCode : null,
    });
  }

  const student = (await Student.findById(payment.studentId)
    .populate<{ userId: UserDocument }>("userId")
    .exec()) as StudentWithUser | null;

  if (!student || !hasPopulatedUserDocument(student.userId)) {
    throw new AppError(404, "Data siswa untuk pembayaran tidak ditemukan.");
  }

  return {
    payment,
    subscription,
    student,
    accessStatus: resolveMembershipAccessStatus(subscription),
  };
}

type OwnerActivityActivationStatus =
  | "Aktif"
  | "Menunggu Pembayaran"
  | "Expired"
  | "Pembayaran Gagal";

function toDocumentIdString(value: { toString: () => string } | string | null | undefined) {
  if (!value) {
    return "";
  }

  return typeof value === "string" ? value : value.toString();
}

function readStudentBranch(student: StudentDocument | null) {
  if (!student) {
    return "Belum diatur";
  }

  const branchValue = (student as unknown as { branch?: unknown }).branch;

  if (typeof branchValue !== "string") {
    return "Belum diatur";
  }

  const normalizedBranch = normalizeText(branchValue);

  return normalizedBranch || "Belum diatur";
}

function normalizeBranchKey(value: string | null | undefined) {
  return normalizeText(value).toLowerCase();
}

function resolveScopedBranchFilter(
  branchFilter: string | null | undefined,
  scope: FinanceBranchScope | null | undefined,
) {
  if (!scope?.isScopedToManagedBranches) {
    return normalizeText(branchFilter);
  }

  return resolveAccessibleBranchName(branchFilter, scope);
}

function matchesScopedBranch(
  branchName: string,
  branchFilter: string,
  scope: FinanceBranchScope | null | undefined,
) {
  const normalizedBranchName = normalizeBranchKey(branchName);
  const normalizedBranchFilter = normalizeBranchKey(branchFilter);

  if (normalizedBranchFilter) {
    return normalizedBranchName === normalizedBranchFilter;
  }

  if (!scope?.isScopedToManagedBranches) {
    return true;
  }

  const managedBranchKeys = scope.managedBranches.map((branch) =>
    normalizeBranchKey(branch),
  );

  return managedBranchKeys.includes(normalizedBranchName);
}

async function assertPaymentBranchAccess(
  payment: PaymentDocument,
  scope: FinanceBranchScope,
) {
  if (!scope.isScopedToManagedBranches) {
    return;
  }

  const student = await Student.findById(payment.studentId).exec();
  const studentBranch = readStudentBranch(student);

  if (matchesScopedBranch(studentBranch, "", scope)) {
    return;
  }

  throw new AppError(
    403,
    "Admin tidak memiliki akses ke payment cabang ini.",
    null,
    "ADMIN_BRANCH_SCOPE_FORBIDDEN",
  );
}

function deriveStudentLevel(student: StudentDocument | null) {
  const program = normalizeText(student?.program);

  if (program === "SD" || program === "SMP" || program === "SMA") {
    return program;
  }

  const className = normalizeText(student?.className);

  if (className.startsWith("SD")) {
    return "SD";
  }

  if (className.startsWith("SMP")) {
    return "SMP";
  }

  if (className.startsWith("SMA")) {
    return "SMA";
  }

  return "-";
}

function deriveStudentClassValue(student: StudentDocument | null) {
  const className = normalizeText(student?.className);
  const match = className.match(/\b(4|5|6|7|8|9|10|11|12)\b/);

  if (match?.[1]) {
    return match[1];
  }

  return className || "-";
}

function deriveStudentClassLabel(classValue: string) {
  if (!classValue || classValue === "-") {
    return "Belum diatur";
  }

  if (/^\d+$/.test(classValue)) {
    return `Kelas ${classValue}`;
  }

  return classValue;
}

function deriveActivationStatus(
  subscription: SubscriptionDocument,
  paymentStatus: PaymentDocument["status"] | SubscriptionDocument["paymentStatus"],
): OwnerActivityActivationStatus {
  if (paymentStatus === "failed" || subscription.paymentStatus === "failed") {
    return "Pembayaran Gagal";
  }

  const accessStatus = resolveMembershipAccessStatus(subscription);

  if (accessStatus === "active" || accessStatus === "expiring") {
    return "Aktif";
  }

  if (accessStatus === "expired") {
    return "Expired";
  }

  return "Menunggu Pembayaran";
}

function parsePositiveInteger(
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

function parseOptionalDate(value: string | undefined, fieldName: string) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return null;
  }

  const parsedDate = new Date(normalizedValue);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new AppError(400, `${fieldName} harus berupa tanggal yang valid.`);
  }

  return parsedDate;
}

function toAdminMembershipStudentResponse(
  student: StudentDocument,
  user: UserDocument,
) {
  return {
    id: student.studentId,
    userId: user._id.toString(),
    name: user.nama,
    email: user.email,
    phone: student.phone,
    branch: student.branch,
    program: student.program,
    className: student.className,
    status: student.status,
    isEmailVerified: user.isEmailVerified,
  };
}

function mapBatchReasonCode(error: unknown): AdminBatchReasonCode {
  if (error instanceof AppError) {
    switch (error.errorCode) {
      case "NO_PREVIOUS_PACKAGE":
        return "NO_PREVIOUS_PACKAGE";
      case "INVALID_PREVIOUS_PACKAGE":
        return "INVALID_PREVIOUS_PACKAGE";
      case "STUDENT_USER_NOT_FOUND":
        return "STUDENT_USER_NOT_FOUND";
      case "PENDING_PAYMENT_EXISTS":
        return "BLOCKING_PENDING_PAYMENT";
      default:
        if (
          error.errorCode?.startsWith("XENDIT_") ||
          error.statusCode === 502
        ) {
          return "XENDIT_SESSION_FAILED";
        }
    }
  }

  return "UNKNOWN_ERROR";
}

function buildPackageFilterValue(
  packageKey: string | null | undefined,
  packageName: string | null | undefined,
) {
  const normalizedPackageKey = normalizeText(packageKey);

  if (normalizedPackageKey) {
    return `key:${normalizedPackageKey.toLowerCase()}`;
  }

  const normalizedPackageName = normalizeText(packageName);

  return normalizedPackageName ? `name:${normalizedPackageName.toLowerCase()}` : "";
}

function buildAdminPaymentsAggregate<
  T extends {
    status: PaymentDocument["status"];
    amount: number;
  },
>(items: T[]) {
  return {
    totalItems: items.length,
    pendingCount: items.filter((item) => item.status === "pending").length,
    paidCount: items.filter((item) => item.status === "paid").length,
    expiredCount: items.filter((item) => item.status === "expired").length,
    failedCount: items.filter((item) => item.status === "failed").length,
    totalAmount: items.reduce((total, item) => total + item.amount, 0),
  };
}

async function buildAdminPaymentItems(
  query: AdminPaymentsQuery,
  scope?: FinanceBranchScope,
) {
  const searchTokens = tokenizeSearchQuery(query.q);
  const statusFilter = normalizeText(query.status);
  const packageFilter = normalizeText(query.package).toLowerCase();
  const packageKeyFilter = normalizeText(query.packageKey);
  const sourceFilter = normalizeText(query.source);
  const branchFilter = resolveScopedBranchFilter(query.branch, scope);
  const programFilter = normalizeText(query.program).toLowerCase();
  const classNameFilter = normalizeText(query.className).toLowerCase();
  const dateFrom = parseOptionalDate(query.dateFrom, "dateFrom");
  const dateTo = parseOptionalDate(query.dateTo, "dateTo");

  const isArchivedFilter = statusFilter === ARCHIVED_PAYMENT_STATUS_FILTER;

  if (
    statusFilter &&
    !isArchivedFilter &&
    !PAYMENT_STATUSES.includes(statusFilter as PaymentDocument["status"])
  ) {
    throw new AppError(400, "status payment filter tidak valid.");
  }

  if (
    sourceFilter &&
    !PAYMENT_SOURCES.includes(sourceFilter as (typeof PAYMENT_SOURCES)[number])
  ) {
    throw new AppError(400, "source payment filter tidak valid.");
  }

  if (dateFrom && dateTo && dateFrom.getTime() > dateTo.getTime()) {
    throw new AppError(400, "dateFrom tidak boleh lebih besar dari dateTo.");
  }

  const paymentQuery: Record<string, unknown> = {
    archivedAt: isArchivedFilter ? { $ne: null } : null,
    status: { $ne: "draft_renewal" },
  };
  const payments = await Payment.find(paymentQuery)
    .sort({ createdAt: -1, _id: -1 })
    .exec();
  const subscriptionIds = [
    ...new Set(
      payments
        .map((payment) => toDocumentIdString(payment.subscriptionId))
        .filter(Boolean),
    ),
  ];
  const subscriptions = subscriptionIds.length
    ? await Subscription.find({
        _id: {
          $in: subscriptionIds,
        },
      }).exec()
    : [];
  const studentIds = new Set<string>();
  const userIds = new Set<string>();

  for (const payment of payments) {
    const studentId = toDocumentIdString(payment.studentId);
    const userId = toDocumentIdString(payment.userId);

    if (studentId) {
      studentIds.add(studentId);
    }

    if (userId) {
      userIds.add(userId);
    }
  }

  for (const subscription of subscriptions) {
    const studentId = toDocumentIdString(subscription.studentId);
    const userId = toDocumentIdString(subscription.userId);

    if (studentId) {
      studentIds.add(studentId);
    }

    if (userId) {
      userIds.add(userId);
    }
  }

  const students = studentIds.size
    ? await Student.find({
        _id: {
          $in: [...studentIds],
        },
      }).exec()
    : [];

  for (const student of students) {
    const userId = toDocumentIdString(student.userId);

    if (userId) {
      userIds.add(userId);
    }
  }

  const users = userIds.size
    ? await User.find({
        _id: {
          $in: [...userIds],
        },
      })
        .select("_id nama email role")
        .exec()
    : [];

  const studentById = new Map(students.map((student) => [student._id.toString(), student]));
  const userById = new Map(users.map((user) => [user._id.toString(), user]));
  const subscriptionById = new Map(
    subscriptions.map((subscription) => [subscription._id.toString(), subscription]),
  );

  const items = payments.map((payment) => {
    const subscription =
      subscriptionById.get(toDocumentIdString(payment.subscriptionId)) ?? null;
    const student = studentById.get(toDocumentIdString(payment.studentId)) ?? null;
    const user =
      userById.get(toDocumentIdString(payment.userId)) ??
      (student ? userById.get(toDocumentIdString(student.userId)) : null) ??
      null;
    const paymentSource = payment.source ?? "register_online";
    const branch = readStudentBranch(student);
    const program = normalizeText(student?.program) || "-";
    const className = normalizeText(student?.className) || "-";
    const packageKey =
      normalizeText(payment.packageKey) || normalizeText(subscription?.packageKey) || null;
    const packageName =
      normalizeText(payment.packageName) || normalizeText(subscription?.packageName) || "-";
    const durationMonth = payment.durationMonth ?? subscription?.durationMonth ?? null;
    const displayDate = payment.paidAt ?? payment.createdAt;
    const anomalyReasons: string[] = [];

    if (!student) {
      anomalyReasons.push("Student tidak ditemukan.");
    }

    if (!user) {
      anomalyReasons.push("User siswa tidak ditemukan.");
    }

    if (!subscription) {
      anomalyReasons.push("Subscription tidak ditemukan.");
    }

    const canResendLink =
      paymentSource === "admin" &&
      payment.provider === "xendit" &&
      payment.method === "xendit_payment_link" &&
      payment.status === "pending" &&
      Boolean(payment.checkoutUrl);
    const canCancel =
      paymentSource === "admin" &&
      payment.status === "pending" &&
      payment.provider === "xendit";

    return {
      id: payment._id.toString(),
      paymentId: payment.paymentId,
      source: paymentSource,
      packageKey,
      packageName,
      durationMonth,
      amount: payment.amount,
      provider: payment.provider,
      method: payment.method,
      status: payment.status,
      paidAt: payment.paidAt,
      checkoutUrl: payment.checkoutUrl,
      expiresAt: payment.expiresAt,
      checkoutLastSentAt: payment.checkoutLastSentAt,
      checkoutSendCount: payment.checkoutSendCount,
      cancelReason: payment.cancelReason,
      canceledAt: payment.canceledAt,
      archivedAt: payment.archivedAt,
      archiveReason: payment.archiveReason,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      displayDate,
      canResendLink,
      canCancel,
      anomalyReasons,
      student: {
        id: student?._id.toString() ?? null,
        studentId: student?.studentId ?? null,
        userId: user?._id.toString() ?? null,
        name: user?.nama ?? "Siswa tidak ditemukan",
        email: user?.email ?? null,
        role: user?.role ?? null,
        branch,
        program,
        className,
      },
      subscription: subscription
        ? {
            id: subscription._id.toString(),
            subscriptionCode: subscription.subscriptionCode,
            status: subscription.status,
            paymentStatus: subscription.paymentStatus,
            startDate: subscription.startDate,
            endDate: subscription.endDate,
            source: subscription.source ?? "register_online",
            renewalOfSubscriptionId:
              subscription.renewalOfSubscriptionId?.toString() ?? null,
          }
        : null,
    };
  });

  return items.filter((item) => {
    const matchesQuery = matchesSearchQuery(searchTokens, [
      item.paymentId,
      item.student.studentId ?? "",
      item.student.name,
      item.student.email ?? "",
      item.student.program,
      item.student.className,
      item.packageName,
      item.subscription?.subscriptionCode ?? "",
    ]);
    const matchesStatus =
      statusFilter && !isArchivedFilter ? item.status === statusFilter : true;
    const matchesPackage = packageFilter
      ? buildPackageFilterValue(item.packageKey, item.packageName) === packageFilter
      : packageKeyFilter
        ? normalizeText(item.packageKey) === packageKeyFilter
        : true;
    const matchesSource = sourceFilter ? item.source === sourceFilter : true;
    const matchesBranch = matchesScopedBranch(item.student.branch, branchFilter, scope);
    const matchesProgram = programFilter
      ? item.student.program.toLowerCase() === programFilter
      : true;
    const matchesClassName = classNameFilter
      ? item.student.className.toLowerCase() === classNameFilter
      : true;
    const matchesDateFrom = dateFrom ? item.displayDate.getTime() >= dateFrom.getTime() : true;
    const matchesDateTo = dateTo ? item.displayDate.getTime() <= dateTo.getTime() : true;

    return (
      matchesQuery &&
      matchesStatus &&
      matchesPackage &&
      matchesSource &&
      matchesBranch &&
      matchesProgram &&
      matchesClassName &&
      matchesDateFrom &&
      matchesDateTo
    );
  });
}

async function buildAdminPaymentsResponse(
  query: AdminPaymentsQuery,
  scope?: FinanceBranchScope,
) {
  const page = parsePositiveInteger(query.page, 1, {
    min: 1,
    fieldName: "page",
  });
  const limit = parsePositiveInteger(query.limit, 20, {
    min: 1,
    max: 100,
    fieldName: "limit",
  });
  const filteredItems = await buildAdminPaymentItems(query, scope);
  const totalItems = filteredItems.length;
  const totalPages = totalItems === 0 ? 1 : Math.ceil(totalItems / limit);
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * limit;
  const paginatedItems = filteredItems.slice(offset, offset + limit);

  return {
    items: paginatedItems,
    summary: buildAdminPaymentsAggregate(filteredItems),
    pagination: {
      page: safePage,
      limit,
      totalPages,
      totalItems,
    },
  };
}

function startOfDay(value: Date) {
  const nextDate = new Date(value);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function endOfDay(value: Date) {
  const nextDate = new Date(value);
  nextDate.setHours(23, 59, 59, 999);
  return nextDate;
}

function addDays(value: Date, amount: number) {
  const nextDate = new Date(value);
  nextDate.setDate(nextDate.getDate() + amount);
  return nextDate;
}

function formatPaymentTrendDateLabel(value: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
  }).format(value);
}

function formatPaymentTrendRangeLabel(startDate: Date, endDate: Date) {
  const startLabel = formatPaymentTrendDateLabel(startDate);
  const endLabel = formatPaymentTrendDateLabel(endDate);

  return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
}

function resolvePaymentTrendDate(item: {
  status: PaymentDocument["status"];
  paidAt: Date | null;
  createdAt: Date;
}) {
  const value = item.status === "paid" ? item.paidAt ?? item.createdAt : item.createdAt;
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
}

function resolvePaymentSummaryPeriod(period: string | undefined) {
  const normalizedPeriod = normalizeText(period).toLowerCase();

  if (!normalizedPeriod || normalizedPeriod === "month") {
    return "month" as const;
  }

  if (normalizedPeriod === "week" || normalizedPeriod === "year") {
    return normalizedPeriod;
  }

  throw new AppError(400, "period summary payment tidak valid.");
}

function resolvePaymentSummaryDateRange(period: "week" | "month" | "year") {
  const today = new Date();

  switch (period) {
    case "week":
      return {
        dateFrom: startOfDay(addDays(today, -6)),
        dateTo: endOfDay(today),
      };
    case "month":
      return {
        dateFrom: startOfDay(addDays(today, -29)),
        dateTo: endOfDay(today),
      };
    case "year":
    default:
      return {
        dateFrom: startOfDay(new Date(today.getFullYear(), 0, 1)),
        dateTo: endOfDay(today),
      };
  }
}

function buildAdminPaymentTrend(
  items: Array<{
    amount: number;
    status: PaymentDocument["status"];
    paidAt: Date | null;
    createdAt: Date;
  }>,
  period: "week" | "month" | "year",
) {
  const formatter = new Intl.DateTimeFormat("id-ID", {
    month: "short",
  });
  const today = startOfDay(new Date());

  if (period === "week") {
    const rangeStart = addDays(today, -6);
    const series = Array.from({ length: 7 }, (_, index) => {
      const bucketDate = addDays(rangeStart, index);
      const label = formatPaymentTrendDateLabel(bucketDate);

      return {
        key: bucketDate.toISOString(),
        label,
        shortLabel: label,
        totalAmount: 0,
        totalCount: 0,
      };
    });

    for (const item of items) {
      const chartDate = resolvePaymentTrendDate(item);

      if (!chartDate) {
        continue;
      }

      const normalizedChartDate = startOfDay(chartDate);
      const dayIndex = Math.floor(
        (normalizedChartDate.getTime() - rangeStart.getTime()) /
          (1000 * 60 * 60 * 24),
      );

      if (dayIndex < 0 || dayIndex >= series.length) {
        continue;
      }

      const targetItem = series[dayIndex];

      if (!targetItem) {
        continue;
      }

      targetItem.totalAmount += item.amount;
      targetItem.totalCount += 1;
    }

    return series;
  }

  if (period === "month") {
    const rangeStart = addDays(today, -29);
    const bucketSizeInDays = 5;
    const totalBuckets = 6;
    const series = Array.from({ length: totalBuckets }, (_, index) => {
      const bucketStart = addDays(rangeStart, index * bucketSizeInDays);
      const bucketEnd = addDays(bucketStart, bucketSizeInDays - 1);
      const safeBucketEnd = bucketEnd > today ? today : bucketEnd;
      const label = formatPaymentTrendRangeLabel(bucketStart, safeBucketEnd);

      return {
        key: `${bucketStart.toISOString()}-${safeBucketEnd.toISOString()}`,
        label,
        shortLabel: label,
        totalAmount: 0,
        totalCount: 0,
      };
    });

    for (const item of items) {
      const chartDate = resolvePaymentTrendDate(item);

      if (!chartDate) {
        continue;
      }

      const normalizedChartDate = startOfDay(chartDate);
      const dayIndex = Math.floor(
        (normalizedChartDate.getTime() - rangeStart.getTime()) /
          (1000 * 60 * 60 * 24),
      );

      if (dayIndex < 0 || dayIndex >= totalBuckets * bucketSizeInDays) {
        continue;
      }

      const bucketIndex = Math.floor(dayIndex / bucketSizeInDays);
      const targetItem = series[bucketIndex];

      if (!targetItem) {
        continue;
      }

      targetItem.totalAmount += item.amount;
      targetItem.totalCount += 1;
    }

    return series;
  }

  const currentYear = today.getFullYear();
  const series = Array.from({ length: 12 }, (_, index) => {
    const targetMonth = new Date(currentYear, index, 1);
    const monthLabel = formatter.format(targetMonth);

    return {
      key: `${targetMonth.getFullYear()}-${String(targetMonth.getMonth() + 1).padStart(2, "0")}`,
      label: monthLabel,
      shortLabel: monthLabel,
      totalAmount: 0,
      totalCount: 0,
    };
  });

  for (const item of items) {
    const chartDate = resolvePaymentTrendDate(item);

    if (!chartDate || chartDate.getFullYear() !== currentYear) {
      continue;
    }

    const monthIndex = chartDate.getMonth();
    const targetItem = series[monthIndex];

    if (!targetItem) {
      continue;
    }

    targetItem.totalAmount += item.amount;
    targetItem.totalCount += 1;
  }

  return series;
}

async function buildAdminPaymentsSummaryResponse(
  query: AdminPaymentsSummaryQuery,
  scope?: FinanceBranchScope,
) {
  const period = resolvePaymentSummaryPeriod(query.period);
  const fallbackDateRange = resolvePaymentSummaryDateRange(period);
  const filteredItems = await buildAdminPaymentItems({
    ...query,
    dateFrom: query.dateFrom ?? fallbackDateRange.dateFrom.toISOString(),
    dateTo: query.dateTo ?? fallbackDateRange.dateTo.toISOString(),
  }, scope);
  const summary = buildAdminPaymentsAggregate(filteredItems);

  return {
    period,
    range: {
      dateFrom: query.dateFrom ?? fallbackDateRange.dateFrom.toISOString(),
      dateTo: query.dateTo ?? fallbackDateRange.dateTo.toISOString(),
    },
    summary: {
      totalTransactions: summary.totalItems,
      pendingCount: summary.pendingCount,
      paidCount: summary.paidCount,
      expiredCount: summary.expiredCount,
      failedCount: summary.failedCount,
      totalAmount: summary.totalAmount,
    },
    trend: buildAdminPaymentTrend(filteredItems, period),
  };
}

async function buildActivationStudentsCollection() {
  const [payments, subscriptions] = await Promise.all([
    Payment.find({ archivedAt: null, status: { $ne: "draft_renewal" } }).sort({ createdAt: -1, _id: -1 }).exec(),
    Subscription.find().sort({ createdAt: -1, _id: -1 }).exec(),
  ]);
  const subscriptionsByStudentId = new Map<string, SubscriptionDocument[]>();

  for (const subscription of subscriptions) {
    const studentId = toDocumentIdString(subscription.studentId);

    if (!studentId) {
      continue;
    }

    const studentSubscriptions = subscriptionsByStudentId.get(studentId) ?? [];
    studentSubscriptions.push(subscription);
    subscriptionsByStudentId.set(studentId, studentSubscriptions);
  }

  const primarySubscriptions = (
    await Promise.all(
      [...subscriptionsByStudentId.values()].map(async (studentSubscriptions) => {
        const refreshedSubscriptions = (
          await Promise.all(
            studentSubscriptions.map((subscription) =>
              refreshSubscriptionLifecycle(subscription),
            ),
          )
        ).filter((subscription): subscription is SubscriptionDocument => subscription !== null);

        return selectPrimarySubscription(refreshedSubscriptions);
      }),
    )
  ).filter((subscription): subscription is SubscriptionDocument => subscription !== null);
  const latestPaymentBySubscriptionId = new Map<string, PaymentDocument>();

  for (const payment of payments) {
    const subscriptionId = toDocumentIdString(payment.subscriptionId);

    if (!subscriptionId || latestPaymentBySubscriptionId.has(subscriptionId)) {
      continue;
    }

    latestPaymentBySubscriptionId.set(subscriptionId, payment);
  }

  const studentIds = new Set<string>();
  const userIds = new Set<string>();

  for (const payment of payments) {
    const studentId = toDocumentIdString(payment.studentId);
    const userId = toDocumentIdString(payment.userId);

    if (studentId) {
      studentIds.add(studentId);
    }

    if (userId) {
      userIds.add(userId);
    }
  }

  for (const subscription of primarySubscriptions) {
    const studentId = toDocumentIdString(subscription.studentId);
    const userId = toDocumentIdString(subscription.userId);

    if (studentId) {
      studentIds.add(studentId);
    }

    if (userId) {
      userIds.add(userId);
    }
  }

  const students = studentIds.size
    ? await Student.find({
        _id: {
          $in: [...studentIds],
        },
      }).exec()
    : [];

  for (const student of students) {
    const userId = toDocumentIdString(student.userId);

    if (userId) {
      userIds.add(userId);
    }
  }

  const users = userIds.size
    ? await User.find({
        _id: {
          $in: [...userIds],
        },
      })
        .select("_id nama email")
        .exec()
    : [];
  const studentById = new Map(
    students.map((student) => [student._id.toString(), student]),
  );
  const userById = new Map(users.map((user) => [user._id.toString(), user]));

  return {
    items: primarySubscriptions.map((subscription) => {
      const student = studentById.get(toDocumentIdString(subscription.studentId)) ?? null;
      const user =
        userById.get(toDocumentIdString(subscription.userId)) ??
        (student ? userById.get(toDocumentIdString(student.userId)) : null) ??
        null;
      const latestPayment =
        latestPaymentBySubscriptionId.get(subscription._id.toString()) ?? null;
      const jenjang = deriveStudentLevel(student);
      const kelas = deriveStudentClassValue(student);
      const paymentStatus = latestPayment?.status ?? subscription.paymentStatus;
      const paymentSource = latestPayment?.source ?? null;
      const paymentProvider = normalizeText(latestPayment?.provider);
      const paymentMethod = normalizeText(latestPayment?.method);
      const paymentCanResendLink =
        paymentSource === "admin" &&
        paymentProvider === "xendit" &&
        paymentMethod === "xendit_payment_link" &&
        latestPayment?.status === "pending" &&
        Boolean(latestPayment.checkoutUrl);
      const paymentCanCancel =
        paymentSource === "admin" &&
        latestPayment?.status === "pending" &&
        paymentProvider === "xendit";

      return {
        id: subscription._id.toString(),
        studentId: student?.studentId ?? null,
        studentName: user?.nama ?? "Siswa tidak ditemukan",
        studentEmail: user?.email ?? null,
        branch: readStudentBranch(student),
        packageKey:
          normalizeText(subscription.packageKey) ||
          normalizeText(latestPayment?.packageKey) ||
          null,
        jenjang,
        kelas,
        classLabel: deriveStudentClassLabel(kelas),
        membershipPackage:
          normalizeText(subscription.packageName) ||
          normalizeText(latestPayment?.packageName) ||
          "-",
        durationMonth: subscription.durationMonth ?? latestPayment?.durationMonth ?? null,
        paymentStatus,
        activationStatus: deriveActivationStatus(subscription, paymentStatus),
        registeredAt: subscription.createdAt,
        activeUntil: subscription.endDate,
        paymentId: latestPayment?.paymentId ?? null,
        paymentSource,
        paymentAmount: latestPayment?.amount ?? null,
        paymentProvider: paymentProvider || null,
        paymentMethod: paymentMethod || null,
        paymentCheckoutUrl: latestPayment?.checkoutUrl ?? null,
        paymentExpiresAt: latestPayment?.expiresAt ?? null,
        paymentPaidAt: latestPayment?.paidAt ?? null,
        paymentCreatedAt: latestPayment?.createdAt ?? null,
        paymentUpdatedAt: latestPayment?.updatedAt ?? null,
        paymentCheckoutLastSentAt: latestPayment?.checkoutLastSentAt ?? null,
        paymentCheckoutSendCount: latestPayment?.checkoutSendCount ?? 0,
        paymentCancelReason: latestPayment?.cancelReason ?? null,
        paymentCanceledAt: latestPayment?.canceledAt ?? null,
        paymentCanResendLink,
        paymentCanCancel,
        subscriptionCode: subscription.subscriptionCode,
      };
    }),
    studentBranchAvailable: students.some(
      (student) => normalizeText(student.branch).length > 0,
    ),
  };
}

async function buildAdminActivationsResponse(
  query: AdminActivationsQuery,
  scope?: FinanceBranchScope,
) {
  const page = parsePositiveInteger(query.page, 1, {
    min: 1,
    fieldName: "page",
  });
  const limit = parsePositiveInteger(query.limit, 20, {
    min: 1,
    max: 100,
    fieldName: "limit",
  });
  const searchTokens = tokenizeSearchQuery(query.q);
  const paymentStatusFilter = normalizeText(query.paymentStatus);
  const activationStatusFilter = normalizeText(query.activationStatus);
  const packageFilter = normalizeText(query.package).toLowerCase();
  const branchFilter = resolveScopedBranchFilter(query.branch, scope);
  const classNameFilter = normalizeText(query.className);
  const levelFilter = normalizeStudentLevel(query.level);

  if (
    paymentStatusFilter &&
    !PAYMENT_STATUSES.includes(paymentStatusFilter as PaymentDocument["status"])
  ) {
    throw new AppError(400, "Status pembayaran aktivasi tidak valid.");
  }

  if (
    activationStatusFilter &&
    ![
      "Aktif",
      "Menunggu Pembayaran",
      "Expired",
      "Pembayaran Gagal",
    ].includes(activationStatusFilter)
  ) {
    throw new AppError(400, "Status aktivasi tidak valid.");
  }

  if (query.level && !levelFilter) {
    throw new AppError(400, "Jenjang aktivasi tidak valid.");
  }

  const { items, studentBranchAvailable } = await buildActivationStudentsCollection();
  const filteredItems = items.filter((item) => {
    const matchesQuery = matchesSearchQuery(searchTokens, [
      item.studentId ?? "",
      item.studentName,
      item.studentEmail ?? "",
      item.paymentId ?? "",
      item.membershipPackage,
      item.subscriptionCode,
      item.activationStatus,
    ]);
    const matchesPaymentStatus = paymentStatusFilter
      ? item.paymentStatus === paymentStatusFilter
      : true;
    const matchesActivationStatus = activationStatusFilter
      ? item.activationStatus === activationStatusFilter
      : true;
    const matchesPackage = packageFilter
      ? buildPackageFilterValue(item.packageKey, item.membershipPackage) === packageFilter
      : true;
    const matchesBranch = matchesScopedBranch(item.branch, branchFilter, scope);
    const matchesClassName = classNameFilter ? item.kelas === classNameFilter : true;
    const matchesLevel = levelFilter ? item.jenjang === levelFilter : true;

    return (
      matchesQuery &&
      matchesPaymentStatus &&
      matchesActivationStatus &&
      matchesPackage &&
      matchesBranch &&
      matchesClassName &&
      matchesLevel
    );
  });
  const totalItems = filteredItems.length;
  const totalPages = totalItems === 0 ? 1 : Math.ceil(totalItems / limit);
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * limit;

  return {
    items: filteredItems.slice(offset, offset + limit),
    filteredItems,
    summary: {
      totalItems,
      activeCount: filteredItems.filter((item) => item.activationStatus === "Aktif").length,
      pendingCount: filteredItems.filter(
        (item) => item.activationStatus === "Menunggu Pembayaran",
      ).length,
      expiredCount: filteredItems.filter((item) => item.activationStatus === "Expired")
        .length,
      failedCount: filteredItems.filter(
        (item) => item.activationStatus === "Pembayaran Gagal",
      ).length,
    },
    pagination: {
      page: safePage,
      limit,
      totalPages,
      totalItems,
    },
    studentBranchAvailable,
  };
}

export async function buildOwnerActivitiesResponse() {
  const [payments, subscriptions, expenses] = await Promise.all([
    Payment.find({ status: { $ne: "draft_renewal" } }).sort({ createdAt: -1, _id: -1 }).exec(),
    Subscription.find().sort({ createdAt: -1, _id: -1 }).exec(),
    Expense.find().sort({ createdAt: -1, _id: -1 }).exec(),
  ]);

  const subscriptionsByStudentId = new Map<string, SubscriptionDocument[]>();

  for (const subscription of subscriptions) {
    const studentId = toDocumentIdString(subscription.studentId);

    if (!studentId) {
      continue;
    }

    const studentSubscriptions = subscriptionsByStudentId.get(studentId) ?? [];
    studentSubscriptions.push(subscription);
    subscriptionsByStudentId.set(studentId, studentSubscriptions);
  }

  const primarySubscriptions = (
    await Promise.all(
      [...subscriptionsByStudentId.values()].map(async (studentSubscriptions) => {
        const refreshedSubscriptions = (
          await Promise.all(
            studentSubscriptions.map((subscription) => refreshSubscriptionLifecycle(subscription)),
          )
        ).filter((subscription): subscription is SubscriptionDocument => subscription !== null);

        return selectPrimarySubscription(refreshedSubscriptions);
      }),
    )
  ).filter((subscription): subscription is SubscriptionDocument => subscription !== null);

  const latestPaymentBySubscriptionId = new Map<string, PaymentDocument>();

  for (const payment of payments) {
    const subscriptionId = toDocumentIdString(payment.subscriptionId);

    if (!subscriptionId || latestPaymentBySubscriptionId.has(subscriptionId)) {
      continue;
    }

    latestPaymentBySubscriptionId.set(subscriptionId, payment);
  }

  const studentIds = new Set<string>();
  const userIds = new Set<string>();

  for (const payment of payments) {
    const studentId = toDocumentIdString(payment.studentId);
    const userId = toDocumentIdString(payment.userId);

    if (studentId) {
      studentIds.add(studentId);
    }

    if (userId) {
      userIds.add(userId);
    }
  }

  for (const subscription of primarySubscriptions) {
    if (!subscription) {
      continue;
    }

    const studentId = toDocumentIdString(subscription.studentId);
    const userId = toDocumentIdString(subscription.userId);

    if (studentId) {
      studentIds.add(studentId);
    }

    if (userId) {
      userIds.add(userId);
    }
  }

  const students = studentIds.size
    ? await Student.find({
        _id: {
          $in: [...studentIds],
        },
      }).exec()
    : [];

  for (const student of students) {
    const userId = toDocumentIdString(student.userId);

    if (userId) {
      userIds.add(userId);
    }
  }

  const users = userIds.size
    ? await User.find({
        _id: {
          $in: [...userIds],
        },
      })
        .select("_id nama email")
        .exec()
    : [];

  const studentById = new Map(
    students.map((student) => [student._id.toString(), student]),
  );
  const userById = new Map(users.map((user) => [user._id.toString(), user]));
  const subscriptionById = new Map(
    subscriptions.map((subscription) => [subscription._id.toString(), subscription]),
  );

  const incomingPayments = payments.map((payment) => {
    const student = studentById.get(toDocumentIdString(payment.studentId)) ?? null;
    const subscription =
      subscriptionById.get(toDocumentIdString(payment.subscriptionId)) ?? null;
    const user =
      userById.get(toDocumentIdString(payment.userId)) ??
      (student ? userById.get(toDocumentIdString(student.userId)) : null) ??
      null;

    return {
      id: payment._id.toString(),
      paymentId: payment.paymentId ?? null,
      studentName: user?.nama ?? "Siswa tidak ditemukan",
      studentEmail: user?.email ?? null,
      branch: readStudentBranch(student),
      packageName:
        normalizeText(payment.packageName) ||
        normalizeText(subscription?.packageName) ||
        "-",
      amount: payment.amount,
      provider: normalizeText(payment.provider) || "-",
      method: normalizeText(payment.method) || normalizeText(payment.provider) || "-",
      status: payment.status,
      paidAt: payment.paidAt,
      expiresAt: payment.expiresAt,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      subscriptionCode: subscription?.subscriptionCode ?? null,
    };
  });

  const activationStudents = primarySubscriptions
    .map((subscription) => {
      const student = studentById.get(toDocumentIdString(subscription.studentId)) ?? null;
      const user =
        userById.get(toDocumentIdString(subscription.userId)) ??
        (student ? userById.get(toDocumentIdString(student.userId)) : null) ??
        null;
      const latestPayment =
        latestPaymentBySubscriptionId.get(subscription._id.toString()) ?? null;
      const jenjang = deriveStudentLevel(student);
      const kelas = deriveStudentClassValue(student);
      const paymentStatus = latestPayment?.status ?? subscription.paymentStatus;

      return {
        id: subscription._id.toString(),
        studentId: student?.studentId ?? null,
        studentName: user?.nama ?? "Siswa tidak ditemukan",
        studentEmail: user?.email ?? null,
        branch: readStudentBranch(student),
        jenjang,
        kelas,
        classLabel: deriveStudentClassLabel(kelas),
        packageKey:
          normalizeText(subscription.packageKey) ||
          normalizeText(latestPayment?.packageKey) ||
          null,
        membershipPackage:
          normalizeText(subscription.packageName) ||
          normalizeText(latestPayment?.packageName) ||
          "-",
        durationMonth: subscription.durationMonth ?? latestPayment?.durationMonth ?? null,
        paymentStatus,
        activationStatus: deriveActivationStatus(subscription, paymentStatus),
        registeredAt: subscription.createdAt,
        activeUntil: subscription.endDate,
        paymentId: latestPayment?.paymentId ?? null,
        subscriptionCode: subscription.subscriptionCode,
      };
    });

  const outgoingPayments = expenses.map((expense) => ({
    id: expense._id.toString(),
    referenceId: expense.expenseId,
    title: normalizeText(expense.title) || expense.expenseId,
    branch: normalizeText(expense.branch) || "Pusat",
    category: expense.category,
    vendor: normalizeText(expense.vendorOrRecipient) || "-",
    amount: expense.amount,
    status: expense.status,
    paymentMethod: normalizeText(expense.paymentMethod) || "-",
    disbursedAt: expense.paidAt,
    dueDate: expense.dueDate,
    note: normalizeText(expense.note),
    createdAt: expense.createdAt,
    updatedAt: expense.updatedAt,
  }));

  const studentBranchAvailable = students.some(
    (student) => normalizeText(student.branch).length > 0,
  );

  return {
    incomingPayments,
    outgoingPayments,
    activationStudents,
    outgoingPaymentsAvailable: outgoingPayments.length > 0,
    studentBranchAvailable,
  };
}

export const getAdminPayments = asyncHandler(
  async (
    req: Request<Record<string, string>, Record<string, never>, Record<string, never>, AdminPaymentsQuery>,
    res: Response,
  ) => {
    const scope = await resolveFinanceBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    const payload = await buildAdminPaymentsResponse(req.query, scope);

    sendSuccess(res, {
      message: "Daftar payment admin berhasil diambil.",
      data: {
        ...payload,
        scope: toPublicFinanceScope(scope),
      },
    });
  },
);

export const exportAdminPayments = asyncHandler(
  async (
    req: Request<Record<string, string>, Record<string, never>, Record<string, never>, AdminPaymentsQuery>,
    res: Response,
  ) => {
    const scope = await resolveFinanceBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    const items = await buildAdminPaymentItems(req.query, scope);
    const csvContent = buildCsvContent(
      [
        "Payment ID",
        "Source",
        "Package Key",
        "Package Name",
        "Amount",
        "Provider",
        "Method",
        "Status",
        "Paid At",
        "Expires At",
        "Created At",
        "Subscription Code",
        "Student ID",
        "Student Name",
        "Student Email",
        "Branch",
        "Program",
        "Class",
      ],
      items.map((item) => [
        item.paymentId,
        item.source,
        item.packageKey,
        item.packageName,
        item.amount,
        item.provider,
        item.method,
        item.status,
        item.paidAt,
        item.expiresAt,
        item.createdAt,
        item.subscription?.subscriptionCode ?? "",
        item.student.studentId ?? "",
        item.student.name,
        item.student.email ?? "",
        item.student.branch,
        item.student.program,
        item.student.className,
      ]),
    );

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="admin-payments-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    res.status(200).send(csvContent);
  },
);

export const getAdminPaymentSummary = asyncHandler(
  async (
    req: Request<
      Record<string, string>,
      Record<string, never>,
      Record<string, never>,
      AdminPaymentsSummaryQuery
    >,
    res: Response,
  ) => {
    const scope = await resolveFinanceBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    const payload = await buildAdminPaymentsSummaryResponse(req.query, scope);

    sendSuccess(res, {
      message: "Ringkasan payment admin berhasil diambil.",
      data: {
        ...payload,
        scope: toPublicFinanceScope(scope),
      },
    });
  },
);

export const getAdminPaymentActivations = asyncHandler(
  async (
    req: Request<
      Record<string, string>,
      Record<string, never>,
      Record<string, never>,
      AdminActivationsQuery
    >,
    res: Response,
  ) => {
    const scope = await resolveFinanceBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    const payload = await buildAdminActivationsResponse(req.query, scope);

    sendSuccess(res, {
      message: "Aktivasi membership admin berhasil diambil.",
      data: {
        scope: toPublicFinanceScope(scope),
        items: payload.items,
        summary: payload.summary,
        pagination: payload.pagination,
        studentBranchAvailable: payload.studentBranchAvailable,
      },
    });
  },
);

export const exportAdminPaymentActivations = asyncHandler(
  async (
    req: Request<
      Record<string, string>,
      Record<string, never>,
      Record<string, never>,
      AdminActivationsQuery
    >,
    res: Response,
  ) => {
    const scope = await resolveFinanceBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    const payload = await buildAdminActivationsResponse(req.query, scope);
    const csvContent = buildCsvContent(
      [
        "Subscription Code",
        "Payment ID",
        "Student ID",
        "Student Name",
        "Student Email",
        "Branch",
        "Jenjang",
        "Kelas",
        "Package Key",
        "Package Name",
        "Duration Month",
        "Payment Status",
        "Activation Status",
        "Registered At",
        "Active Until",
      ],
      payload.filteredItems.map((item) => [
        item.subscriptionCode,
        item.paymentId,
        item.studentId,
        item.studentName,
        item.studentEmail,
        item.branch,
        item.jenjang,
        item.kelas,
        item.packageKey,
        item.membershipPackage,
        item.durationMonth,
        item.paymentStatus,
        item.activationStatus,
        item.registeredAt,
        item.activeUntil,
      ]),
    );

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="admin-payment-activations-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    res.status(200).send(csvContent);
  },
);

export const createAdminPaymentSession = asyncHandler(
  async (
    req: Request<Record<string, string>, Record<string, never>, AdminCreateSessionRequestBody>,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user || req.user.role !== "admin") {
      next(new AppError(403, "Hanya admin yang dapat membuat tagihan membership."));
      return;
    }

    const studentId = normalizeText(req.body.studentId);
    const packageKey = normalizeText(req.body.packageKey);
    const selectedPackage = getOnlinePackageByKey(packageKey);
    const errors: Record<string, string> = {};

    if (!studentId) {
      errors.studentId = "Student ID wajib dikirim.";
    }

    if (!packageKey) {
      errors.packageKey = "packageKey wajib dikirim.";
    } else if (!selectedPackage) {
      errors.packageKey = "packageKey tidak valid.";
    }

    let parsedExpiresAt: Date | null = null;

    if (req.body.expiresAt) {
      parsedExpiresAt = parseOptionalDate(req.body.expiresAt, "expiresAt");

      if (parsedExpiresAt && parsedExpiresAt.getTime() <= Date.now()) {
        errors.expiresAt = "expiresAt harus lebih besar dari waktu saat ini.";
      }
    }

    if (Object.keys(errors).length > 0) {
      next(new AppError(400, "Data create session payment admin tidak valid.", errors));
      return;
    }

    if (!selectedPackage) {
      next(new AppError(400, "packageKey tidak valid."));
      return;
    }

    const { student } = await findStudentAndUserByPublicStudentId(studentId);

    if (!student) {
      next(new AppError(404, "Student tidak ditemukan.", null, "STUDENT_NOT_FOUND"));
      return;
    }

    const scope = await resolveFinanceBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });

    if (!matchesScopedBranch(readStudentBranch(student), "", scope)) {
      next(
        new AppError(
          403,
          "Admin tidak memiliki akses untuk membuat tagihan siswa cabang ini.",
          null,
          "ADMIN_BRANCH_SCOPE_FORBIDDEN",
        ),
      );
      return;
    }

    try {
      const { user, subscription, payment, statusPagePath } =
        await createAdminPaymentSessionForStudent({
          student,
          packageKey,
          expiresAt: parsedExpiresAt,
          adminId: req.user._id,
        });

      sendSuccess(res, {
        statusCode: 201,
        message: "Tagihan membership berhasil dibuat.",
        data: {
          student: toAdminMembershipStudentResponse(student, user),
          subscription: toPublicSubscription(subscription),
          payment: toPublicPayment(payment),
          statusPagePath,
        },
      });
    } catch (error) {
      throw error;
    }
  },
);

export const createAdminBatchPaymentSession = asyncHandler(
  async (
    req: Request<
      Record<string, string>,
      Record<string, never>,
      AdminCreateBatchSessionRequestBody
    >,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user || req.user.role !== "admin") {
      next(new AppError(403, "Hanya admin yang dapat membuat tagihan massal membership."));
      return;
    }

    const levelInput = normalizeText(req.body.level);
    const gradeInput = normalizeText(req.body.grade);
    const classNameInput = normalizeText(req.body.className);
    const scope = await resolveFinanceBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    const branchFilter = resolveAccessibleBranchName(req.body.branch, scope, {
      useFirstManagedBranchAsDefault: true,
    });
    const packageModeInput = normalizeText(req.body.packageMode);
    const packageKey = normalizeText(req.body.packageKey);
    const includeInactive = req.body.includeInactive === true;
    const packageMode: AdminBatchPackageMode | null =
      packageModeInput === "follow_latest_package" ||
      packageModeInput === "fixed_package"
        ? packageModeInput
        : null;
    const selectedPackage =
      packageMode === "fixed_package" ? getOnlinePackageByKey(packageKey) : null;
    const normalizedLevel = normalizeStudentLevel(levelInput);
    const normalizedClassName = classNameInput
      ? normalizeCanonicalClassName(classNameInput)
      : null;
    const canonicalSelection = resolveCanonicalClassSelection({
      level: normalizedLevel,
      grade: gradeInput,
      className: classNameInput,
    });
    const errors: Record<string, string> = {};

    if (!normalizedLevel) {
      errors.level = "level wajib dikirim dan harus SD, SMP, atau SMA.";
    }

    if (!gradeInput && !classNameInput) {
      errors.className = "Kirim minimal grade atau className.";
    }

    if (classNameInput && !normalizedClassName) {
      errors.className = "className belum valid.";
    }

    if (!canonicalSelection) {
      errors.className =
        errors.className ??
        "Kombinasi level, grade, dan className tidak bisa dinormalisasi.";
    }

    if (!packageMode) {
      errors.packageMode =
        "packageMode wajib dikirim dan harus follow_latest_package atau fixed_package.";
    } else if (packageMode === "fixed_package") {
      if (!packageKey) {
        errors.packageKey = "packageKey wajib dikirim untuk fixed_package.";
      } else if (!selectedPackage) {
        errors.packageKey = "packageKey tidak valid.";
      }
    } else if (packageKey) {
      errors.packageKey =
        "packageKey tidak perlu dikirim saat packageMode follow_latest_package.";
    }

    let parsedExpiresAt: Date | null = null;

    if (req.body.expiresAt) {
      parsedExpiresAt = parseOptionalDate(req.body.expiresAt, "expiresAt");

      if (parsedExpiresAt && parsedExpiresAt.getTime() <= Date.now()) {
        errors.expiresAt = "expiresAt harus lebih besar dari waktu saat ini.";
      }
    }

    if (Object.keys(errors).length > 0) {
      next(new AppError(400, "Data create batch session payment admin tidak valid.", errors));
      return;
    }

    if (
      !canonicalSelection ||
      !packageMode ||
      (packageMode === "fixed_package" && !selectedPackage)
    ) {
      next(new AppError(400, "Filter batch atau package batch tidak valid."));
      return;
    }

    const baseFilters: Record<string, unknown> = {
      className: new RegExp(`^${escapeRegex(canonicalSelection.level)}\\b`, "i"),
    };

    if (branchFilter) {
      baseFilters.branch = new RegExp(`^${escapeRegex(branchFilter)}$`, "i");
    }

    const candidateStudents = await Student.find(baseFilters)
      .sort({ className: 1, createdAt: 1, _id: 1 })
      .exec();
    const targetStudents = candidateStudents.filter(
      (student) =>
        normalizeCanonicalClassName(student.className) === canonicalSelection.className,
    );

    const items: AdminBatchItem[] = [];
    const reasonCounts: Partial<Record<AdminBatchReasonCode, number>> = {};

    function registerReason(reasonCode: AdminBatchReasonCode | undefined) {
      if (!reasonCode) {
        return;
      }

      reasonCounts[reasonCode] = (reasonCounts[reasonCode] ?? 0) + 1;
    }

    for (const student of targetStudents) {
      const user = await User.findById(student.userId).select("_id nama email").exec();

      if (!user) {
        registerReason("STUDENT_USER_NOT_FOUND");
        items.push({
          studentId: student.studentId,
          studentName: "Siswa tidak ditemukan",
          email: null,
          className: student.className,
          canonicalClassName: canonicalSelection.className,
          studentStatus: student.status,
          status: "skipped",
          reasonCode: "STUDENT_USER_NOT_FOUND",
          message: "Student belum memiliki relasi user yang valid.",
        });
        continue;
      }

      if (!includeInactive && student.status !== "Aktif") {
        registerReason("STUDENT_INACTIVE");
        items.push({
          studentId: student.studentId,
          studentName: user.nama,
          email: user.email,
          className: student.className,
          canonicalClassName: canonicalSelection.className,
          studentStatus: student.status,
          status: "skipped",
          reasonCode: "STUDENT_INACTIVE",
          message: "Status siswa nonaktif sehingga dilewati dari batch tagihan.",
        });
        continue;
      }

      try {
        const resolvedPackage =
          packageMode === "fixed_package"
            ? (() => {
                if (!selectedPackage) {
                  throw new AppError(400, "packageKey tidak valid.", null, "INVALID_PACKAGE_KEY");
                }

                return {
                  packageDefinition: selectedPackage,
                  source: "fixed_package" as const,
                  sourceSubscriptionCode: null,
                };
              })()
            : await (async () => {
                const latestPackage = await resolveLatestPackageForStudent(student._id);

                return {
                  packageDefinition: latestPackage.packageDefinition,
                  source: "latest_subscription" as const,
                  sourceSubscriptionCode: latestPackage.sourceSubscription.subscriptionCode,
                };
              })();
        const createdSession = await createAdminPaymentSessionForStudent({
          student,
          packageKey: resolvedPackage.packageDefinition.packageKey,
          expiresAt: parsedExpiresAt,
          adminId: req.user._id,
          isDraftRenewal: true,
        });

        items.push({
          studentId: student.studentId,
          studentName: user.nama,
          email: user.email,
          className: student.className,
          canonicalClassName: canonicalSelection.className,
          studentStatus: student.status,
          status: "created",
          message: "Tagihan membership berhasil dibuat.",
          resolvedPackage: {
            packageKey: resolvedPackage.packageDefinition.packageKey,
            packageName: resolvedPackage.packageDefinition.packageName,
            durationMonth: resolvedPackage.packageDefinition.durationMonth,
            source: resolvedPackage.source,
            sourceSubscriptionCode: resolvedPackage.sourceSubscriptionCode,
          },
          paymentId: createdSession.payment.paymentId,
          subscriptionCode: createdSession.subscription.subscriptionCode,
          checkoutUrl: createdSession.checkoutUrl,
          statusPagePath: createdSession.statusPagePath,
        });
      } catch (error) {
        const reasonCode = mapBatchReasonCode(error);
        registerReason(reasonCode);
        const details =
          error instanceof AppError && error.errors && typeof error.errors === "object"
            ? (error.errors as Record<string, unknown>)
            : null;
        const isSkipped = reasonCode !== "XENDIT_SESSION_FAILED" && reasonCode !== "UNKNOWN_ERROR";

        items.push({
          studentId: student.studentId,
          studentName: user.nama,
          email: user.email,
          className: student.className,
          canonicalClassName: canonicalSelection.className,
          studentStatus: student.status,
          status: isSkipped ? "skipped" : "failed",
          reasonCode,
          message:
            error instanceof Error
              ? error.message
              : "Terjadi kesalahan yang tidak diketahui saat membuat tagihan.",
          blockingPaymentId:
            reasonCode === "BLOCKING_PENDING_PAYMENT" &&
            typeof details?.paymentId === "string"
              ? details.paymentId
              : undefined,
          blockingSubscriptionCode:
            reasonCode === "BLOCKING_PENDING_PAYMENT" &&
            typeof details?.subscriptionCode === "string"
              ? details.subscriptionCode
              : undefined,
        });
      }
    }

    sendSuccess(res, {
      statusCode: 201,
      message: "Batch tagihan membership selesai diproses.",
      data: {
        filters: {
          level: canonicalSelection.level,
          grade: canonicalSelection.grade,
          className: canonicalSelection.className,
          branch: branchFilter || null,
          packageMode,
          packageKey: selectedPackage?.packageKey ?? null,
          expiresAt: parsedExpiresAt,
          includeInactive,
        },
        summary: {
          totalTargetStudents: targetStudents.length,
          createdCount: items.filter((item) => item.status === "created").length,
          skippedCount: items.filter((item) => item.status === "skipped").length,
          failedCount: items.filter((item) => item.status === "failed").length,
          reasonCounts,
        },
        items,
      },
    });
  },
);

export const resendAdminPaymentLink = asyncHandler(
  async (
    req: Request<{ paymentId: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user || req.user.role !== "admin") {
      next(new AppError(403, "Hanya admin yang dapat mengirim ulang checkout link."));
      return;
    }

    const paymentId = normalizeText(req.params.paymentId);

    if (!paymentId) {
      next(new AppError(400, "paymentId wajib dikirim."));
      return;
    }

    const payment = await Payment.findOne({ paymentId }).exec();

    if (!payment) {
      next(new AppError(404, "Data pembayaran tidak ditemukan.", null, "PAYMENT_NOT_FOUND"));
      return;
    }

    const scope = await resolveFinanceBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    await assertPaymentBranchAccess(payment, scope);

    if (payment.source !== "admin") {
      next(
        new AppError(
          400,
          "Hanya payment sumber admin yang dapat mengirim ulang checkout link.",
          null,
          "ADMIN_PAYMENT_ONLY",
        ),
      );
      return;
    }

    if (payment.provider !== "xendit" || payment.method !== "xendit_payment_link") {
      next(
        new AppError(
          400,
          "Payment ini tidak memakai Xendit payment link.",
          null,
          "INVALID_PAYMENT_METHOD",
        ),
      );
      return;
    }

    const subscription = await Subscription.findById(payment.subscriptionId).exec();

    if (!subscription) {
      next(new AppError(404, "Subscription terkait pembayaran tidak ditemukan."));
      return;
    }

    if (payment.xenditPaymentSessionId) {
      try {
        await syncPendingPaymentWithXendit(payment, subscription);
      } catch (error) {
        next(
          new AppError(
            502,
            error instanceof Error
              ? `Gagal sinkronisasi payment Xendit: ${error.message}`
              : "Gagal sinkronisasi payment Xendit.",
            null,
            "XENDIT_SYNC_FAILED",
          ),
        );
        return;
      }
    }

    if (payment.status !== "pending") {
      next(
        new AppError(
          409,
          "Checkout link hanya dapat dikirim ulang untuk payment yang masih pending.",
          null,
          "PAYMENT_NOT_PENDING",
        ),
      );
      return;
    }

    if (!payment.checkoutUrl) {
      next(
        new AppError(
          409,
          "Checkout URL untuk payment ini belum tersedia.",
          null,
          "CHECKOUT_URL_MISSING",
        ),
      );
      return;
    }

    payment.checkoutSendCount += 1;
    payment.checkoutLastSentAt = new Date();
    await payment.save();

    sendSuccess(res, {
      message: "Checkout link berhasil dikirim ulang.",
      data: {
        paymentId: payment.paymentId,
        checkoutUrl: payment.checkoutUrl,
        expiresAt: payment.expiresAt,
        checkoutSendCount: payment.checkoutSendCount,
        checkoutLastSentAt: payment.checkoutLastSentAt,
      },
    });
  },
);

export const updateAdminPaymentStatus = asyncHandler(
  async (
    req: Request<
      { paymentId: string },
      Record<string, never>,
      AdminUpdatePaymentStatusRequestBody
    >,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user || req.user.role !== "admin") {
      next(new AppError(403, "Hanya admin yang dapat mengubah status pembayaran."));
      return;
    }

    const paymentId = normalizeText(req.params.paymentId);
    const nextStatus = normalizeText(req.body.status).toLowerCase();

    if (!paymentId) {
      next(new AppError(400, "paymentId wajib dikirim."));
      return;
    }

    if (nextStatus !== "paid") {
      next(
        new AppError(
          400,
          "Status pembayaran hanya dapat diubah menjadi paid dari halaman admin.",
          null,
          "UNSUPPORTED_PAYMENT_STATUS_UPDATE",
        ),
      );
      return;
    }

    const paidAtInput = normalizeText(req.body.paidAt);
    const paidAt = paidAtInput ? new Date(paidAtInput) : new Date();

    if (Number.isNaN(paidAt.getTime())) {
      next(new AppError(400, "paidAt tidak valid."));
      return;
    }

    const payment = await Payment.findOne({ paymentId }).exec();

    if (!payment) {
      next(new AppError(404, "Data pembayaran tidak ditemukan.", null, "PAYMENT_NOT_FOUND"));
      return;
    }

    const scope = await resolveFinanceBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    await assertPaymentBranchAccess(payment, scope);

    const subscription = await Subscription.findById(payment.subscriptionId).exec();

    if (!subscription) {
      next(new AppError(404, "Subscription terkait pembayaran tidak ditemukan."));
      return;
    }

    const syncedPaymentStatus = payment.status as PaymentDocument["status"];

    if (syncedPaymentStatus === "paid") {
      if (subscription.paymentStatus === "paid") {
        await applyPaidSubscriptionStudentData(subscription);
      }

      sendSuccess(res, {
        message: "Payment sudah berada pada status paid.",
        data: {
          paymentId: payment.paymentId,
          status: payment.status,
          paidAt: payment.paidAt,
          subscriptionCode: subscription.subscriptionCode,
          subscriptionStatus: subscription.status,
          subscriptionPaymentStatus: subscription.paymentStatus,
        },
      });
      return;
    }

    if (payment.status !== "pending") {
      next(
        new AppError(
          409,
          "Hanya payment pending yang dapat ditandai lunas.",
          null,
          "PAYMENT_NOT_PENDING",
        ),
      );
      return;
    }

    const paidResult = await markPaymentPaidManually({
      payment,
      subscription,
      paidAt,
    });

    if (paidResult.paymentChanged || paidResult.subscriptionChanged) {
      await Promise.all([
        paidResult.paymentChanged ? payment.save() : Promise.resolve(payment),
        paidResult.subscriptionChanged ? subscription.save() : Promise.resolve(subscription),
      ]);
    }

    await applyPaidSubscriptionStudentData(subscription);

    sendSuccess(res, {
      message: "Status pembayaran berhasil diubah menjadi paid.",
      data: {
        paymentId: payment.paymentId,
        status: payment.status,
        paidAt: payment.paidAt,
        subscriptionCode: subscription.subscriptionCode,
        subscriptionStatus: subscription.status,
        subscriptionPaymentStatus: subscription.paymentStatus,
      },
    });
  },
);

export const replaceAdminPayment = asyncHandler(
  async (
    req: Request<
      { paymentId: string },
      Record<string, never>,
      AdminReplacePaymentRequestBody
    >,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user || req.user.role !== "admin") {
      next(new AppError(403, "Hanya admin yang dapat mengedit tagihan."));
      return;
    }

    const paymentId = normalizeText(req.params.paymentId);
    const packageKey = normalizeText(req.body.packageKey);
    const selectedPackage = getOnlinePackageByKey(packageKey);
    const errors: Record<string, string> = {};

    if (!paymentId) {
      next(new AppError(400, "paymentId wajib dikirim."));
      return;
    }

    if (!packageKey) {
      errors.packageKey = "packageKey wajib dikirim.";
    } else if (!selectedPackage) {
      errors.packageKey = "packageKey tidak valid.";
    }

    let parsedExpiresAt: Date | null = null;

    if (req.body.expiresAt) {
      parsedExpiresAt = parseOptionalDate(req.body.expiresAt, "expiresAt");

      if (parsedExpiresAt && parsedExpiresAt.getTime() <= Date.now()) {
        errors.expiresAt = "expiresAt harus lebih besar dari waktu saat ini.";
      }
    }

    if (Object.keys(errors).length > 0) {
      next(new AppError(400, "Data edit tagihan tidak valid.", errors));
      return;
    }

    const payment = await Payment.findOne({ paymentId, archivedAt: null }).exec();

    if (!payment) {
      next(new AppError(404, "Data pembayaran tidak ditemukan.", null, "PAYMENT_NOT_FOUND"));
      return;
    }

    const scope = await resolveFinanceBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    await assertPaymentBranchAccess(payment, scope);

    if (payment.source !== "admin") {
      next(
        new AppError(
          400,
          "Hanya tagihan yang dibuat admin yang dapat diedit.",
          null,
          "ADMIN_PAYMENT_ONLY",
        ),
      );
      return;
    }

    if (payment.status !== "pending" && payment.status !== "failed") {
      next(
        new AppError(
          409,
          "Hanya tagihan pending atau gagal yang dapat diedit.",
          null,
          "PAYMENT_NOT_PENDING",
        ),
      );
      return;
    }

    const [subscription, student] = await Promise.all([
      Subscription.findById(payment.subscriptionId).exec(),
      Student.findById(payment.studentId).exec(),
    ]);

    if (!subscription) {
      next(new AppError(404, "Subscription terkait pembayaran tidak ditemukan."));
      return;
    }

    if (!student) {
      next(new AppError(404, "Student terkait pembayaran tidak ditemukan."));
      return;
    }

    if (payment.xenditPaymentSessionId) {
      await syncPendingPaymentWithXendit(payment, subscription);
    }

    if (payment.status !== "pending" && payment.status !== "failed") {
      next(
        new AppError(
          409,
          "Status payment sudah berubah dan tidak dapat diedit.",
          null,
          "PAYMENT_NOT_PENDING",
        ),
      );
      return;
    }

    const replacement = await replaceAdminPaymentSessionForStudent({
      currentPayment: payment,
      currentSubscription: subscription,
      student,
      packageKey,
      expiresAt: parsedExpiresAt,
      adminId: req.user._id,
    });

    sendSuccess(res, {
      statusCode: 201,
      message: "Tagihan berhasil diperbarui melalui sesi pembayaran pengganti.",
      data: {
        replacedPaymentId: replacement.replacedPaymentId,
        student: toAdminMembershipStudentResponse(student, replacement.user),
        subscription: toPublicSubscription(replacement.subscription),
        payment: toPublicPayment(replacement.payment),
        statusPagePath: replacement.statusPagePath,
      },
    });
  },
);

export const archiveAdminPayment = asyncHandler(
  async (
    req: Request<
      { paymentId: string },
      Record<string, never>,
      AdminArchivePaymentRequestBody
    >,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user || req.user.role !== "admin") {
      next(new AppError(403, "Hanya admin yang dapat menghapus tagihan."));
      return;
    }

    const paymentId = normalizeText(req.params.paymentId);

    if (!paymentId) {
      next(new AppError(400, "paymentId wajib dikirim."));
      return;
    }

    const payment = await Payment.findOne({ paymentId, archivedAt: null }).exec();

    if (!payment) {
      next(new AppError(404, "Data pembayaran tidak ditemukan.", null, "PAYMENT_NOT_FOUND"));
      return;
    }

    const scope = await resolveFinanceBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    await assertPaymentBranchAccess(payment, scope);

    if (payment.source !== "admin") {
      next(
        new AppError(
          400,
          "Hanya tagihan yang dibuat admin yang dapat dihapus.",
          null,
          "ADMIN_PAYMENT_ONLY",
        ),
      );
      return;
    }

    const subscription = await Subscription.findById(payment.subscriptionId).exec();

    if (!subscription) {
      next(new AppError(404, "Subscription terkait pembayaran tidak ditemukan."));
      return;
    }

    if (payment.status === "pending" && payment.xenditPaymentSessionId) {
      await syncPendingPaymentWithXendit(payment, subscription);
    }

    if (payment.status === "pending") {
      if (payment.xenditPaymentSessionId) {
        const canceledSession = await expireXenditInvoice(
          payment.xenditPaymentSessionId,
        );
        applyXenditSessionSnapshot(payment, subscription, canceledSession);
      }

      await expirePendingPayment({
        payment,
        subscription,
        cancelReason: "admin_cancelled",
        canceledAt: new Date(),
      });
    }

    payment.archivedAt = new Date();
    payment.archivedByAdminId = req.user._id;
    payment.archiveReason =
      normalizeText(req.body.reason) || "Dihapus dari daftar pembayaran oleh admin.";
    await payment.save();

    sendSuccess(res, {
      message: "Tagihan berhasil dihapus dari daftar dan disimpan sebagai arsip audit.",
      data: {
        paymentId: payment.paymentId,
        archivedAt: payment.archivedAt,
        archiveReason: payment.archiveReason,
      },
    });
  },
);

export const restoreAdminPayment = asyncHandler(
  async (
    req: Request<{ paymentId: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user || req.user.role !== "admin") {
      next(new AppError(403, "Hanya admin yang dapat memulihkan tagihan."));
      return;
    }

    const paymentId = normalizeText(req.params.paymentId);

    if (!paymentId) {
      next(new AppError(400, "paymentId wajib dikirim."));
      return;
    }

    const payment = await Payment.findOne({
      paymentId,
      archivedAt: { $ne: null },
    }).exec();

    if (!payment) {
      next(new AppError(404, "Data pembayaran terhapus tidak ditemukan.", null, "PAYMENT_NOT_FOUND"));
      return;
    }

    const scope = await resolveFinanceBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    await assertPaymentBranchAccess(payment, scope);

    if (payment.source !== "admin") {
      next(
        new AppError(
          400,
          "Hanya tagihan yang dibuat admin yang dapat dipulihkan.",
          null,
          "ADMIN_PAYMENT_ONLY",
        ),
      );
      return;
    }

    payment.archivedAt = null;
    payment.archivedByAdminId = null;
    payment.archiveReason = null;
    await payment.save();

    sendSuccess(res, {
      message: "Tagihan berhasil dipulihkan ke daftar pembayaran.",
      data: {
        paymentId: payment.paymentId,
        status: payment.status,
        archivedAt: payment.archivedAt,
        archiveReason: payment.archiveReason,
      },
    });
  },
);

export const cancelAdminPayment = asyncHandler(
  async (
    req: Request<{ paymentId: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user || req.user.role !== "admin") {
      next(new AppError(403, "Hanya admin yang dapat membatalkan payment pending."));
      return;
    }

    const paymentId = normalizeText(req.params.paymentId);

    if (!paymentId) {
      next(new AppError(400, "paymentId wajib dikirim."));
      return;
    }

    const payment = await Payment.findOne({ paymentId }).exec();

    if (!payment) {
      next(new AppError(404, "Data pembayaran tidak ditemukan.", null, "PAYMENT_NOT_FOUND"));
      return;
    }

    const scope = await resolveFinanceBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    await assertPaymentBranchAccess(payment, scope);

    if (payment.source !== "admin") {
      next(
        new AppError(
          400,
          "Hanya payment sumber admin yang dapat dibatalkan.",
          null,
          "ADMIN_PAYMENT_ONLY",
        ),
      );
      return;
    }

    const subscription = await Subscription.findById(payment.subscriptionId).exec();

    if (!subscription) {
      next(new AppError(404, "Subscription terkait pembayaran tidak ditemukan."));
      return;
    }

    if (payment.status === "paid") {
      next(
        new AppError(
          409,
          "Payment yang sudah paid tidak dapat dibatalkan.",
          null,
          "PAID_PAYMENT_CANNOT_BE_CANCELLED",
        ),
      );
      return;
    }

    if (payment.status === "expired") {
      sendSuccess(res, {
        message: "Payment sudah berada pada status expired.",
        data: {
          paymentId: payment.paymentId,
          status: payment.status,
          cancelReason: payment.cancelReason,
          canceledAt: payment.canceledAt,
          subscriptionCode: subscription.subscriptionCode,
          subscriptionStatus: subscription.status,
          subscriptionPaymentStatus: subscription.paymentStatus,
        },
      });
      return;
    }

    if (payment.provider !== "xendit" || payment.method !== "xendit_payment_link") {
      next(
        new AppError(
          400,
          "Payment ini tidak memakai Xendit payment link.",
          null,
          "INVALID_PAYMENT_METHOD",
        ),
      );
      return;
    }

    if (payment.xenditPaymentSessionId) {
      try {
        await syncPendingPaymentWithXendit(payment, subscription);
      } catch (error) {
        next(
          new AppError(
            502,
            error instanceof Error
              ? `Gagal sinkronisasi payment Xendit: ${error.message}`
              : "Gagal sinkronisasi payment Xendit.",
            null,
            "XENDIT_SYNC_FAILED",
          ),
        );
        return;
      }
    }

    const syncedPaymentStatus = payment.status as PaymentDocument["status"];

    if (syncedPaymentStatus === "paid") {
      next(
        new AppError(
          409,
          "Payment yang sudah paid tidak dapat dibatalkan.",
          null,
          "PAID_PAYMENT_CANNOT_BE_CANCELLED",
        ),
      );
      return;
    }

    if (syncedPaymentStatus === "expired") {
      sendSuccess(res, {
        message: "Payment sudah berada pada status expired.",
        data: {
          paymentId: payment.paymentId,
          status: payment.status,
          cancelReason: payment.cancelReason,
          canceledAt: payment.canceledAt,
          subscriptionCode: subscription.subscriptionCode,
          subscriptionStatus: subscription.status,
          subscriptionPaymentStatus: subscription.paymentStatus,
        },
      });
      return;
    }

    if (payment.status !== "pending") {
      next(
        new AppError(
          409,
          "Hanya payment pending yang dapat dibatalkan.",
          null,
          "PAYMENT_NOT_PENDING",
        ),
      );
      return;
    }

    const canceledAt = new Date();

    if (payment.xenditPaymentSessionId) {
      const canceledSession = await expireXenditInvoice(payment.xenditPaymentSessionId);
      applyXenditSessionSnapshot(payment, subscription, canceledSession);
    }

    await expirePendingPayment({
      payment,
      subscription,
      cancelReason: "admin_cancelled",
      canceledAt,
    });

    sendSuccess(res, {
      message: "Pending payment berhasil dibatalkan.",
      data: {
        paymentId: payment.paymentId,
        status: payment.status,
        cancelReason: payment.cancelReason,
        canceledAt: payment.canceledAt,
        subscriptionCode: subscription.subscriptionCode,
        subscriptionStatus: subscription.status,
        subscriptionPaymentStatus: subscription.paymentStatus,
      },
    });
  },
);

export const getPaymentStatus = asyncHandler(
  async (
    req: Request<Record<string, string>, Record<string, never>, Record<string, never>, {
      paymentId?: string;
    }>,
    res: Response,
    next: NextFunction,
  ) => {
    const paymentId = normalizeText(req.query.paymentId);

    if (!paymentId) {
      next(new AppError(400, "paymentId wajib dikirim."));
      return;
    }

    const payload = await buildPaymentStatusResponse(paymentId);

    sendSuccess(res, {
      message: "Status pembayaran berhasil diambil.",
      data: {
        student: toPublicStudentMembership(payload.student),
        subscription: toPublicSubscription(payload.subscription),
        payment: toPublicPayment(payload.payment),
        accessStatus: payload.accessStatus,
      },
    });
  },
);

export const getOwnerActivities = asyncHandler(async (_req: Request, res: Response) => {
  const activities = await buildOwnerActivitiesResponse();

  sendSuccess(res, {
    message: "Aktivitas owner berhasil diambil.",
    data: activities,
  });
});

export const handleXenditPaymentWebhook = asyncHandler(
  async (
    req: Request<Record<string, string>, Record<string, never>, XenditWebhookPayload>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      verifyXenditWebhookToken(readSingleHeaderValue(req.headers["x-callback-token"]));
    } catch (error) {
      if (error instanceof XenditServiceError) {
        next(
          new AppError(
            error.statusCode,
            error.message,
            null,
            error.errorCode ?? "INVALID_XENDIT_WEBHOOK",
          ),
        );
        return;
      }

      throw error;
    }

    const webhookPayload = req.body;
    const sessionData = webhookPayload;

    if (!sessionData || !sessionData.id) {
      next(
        new AppError(
          400,
          "Payload webhook Xendit tidak valid.",
          null,
          "INVALID_XENDIT_WEBHOOK_PAYLOAD",
        ),
      );
      return;
    }

    const session = normalizeXenditSessionSnapshot(sessionData);
    const stablePaymentId = resolveStablePaymentIdFromXenditSession(session);
    const xenditReferenceId = normalizeText(session.external_id);
    const isTestWebhook =
      stablePaymentId === "test_session" || xenditReferenceId === "test_session";

    let payment =
      stablePaymentId && !isTestWebhook
        ? await Payment.findOne({ paymentId: stablePaymentId }).exec()
        : null;

    if (!payment && xenditReferenceId && !isTestWebhook) {
      payment = await Payment.findOne({
        xenditReferenceId,
      }).exec();
    }

    if (!payment && xenditReferenceId && !isTestWebhook) {
      payment = await Payment.findOne({ paymentId: xenditReferenceId }).exec();
    }

    if (!payment && session.id) {
      payment = await Payment.findOne({
        xenditPaymentSessionId: session.id,
      }).exec();
    }

    if (!payment) {
      console.warn(
        isTestWebhook
          ? "[xendit-webhook] test_webhook_received"
          : "[xendit-webhook] payment_not_found",
        {
        paymentId: stablePaymentId || xenditReferenceId,
        xenditReferenceId,
        paymentSessionId: session.id,
        status: session.status,
      },
      );

      res.status(200).json({
        success: true,
        message: "Webhook received but payment not found",
      });
      return;
    }

    if (
      session.id &&
      payment.xenditPaymentSessionId &&
      payment.xenditPaymentSessionId !== session.id
    ) {
      console.warn("[xendit-webhook] payment_session_mismatch", {
        paymentId: payment.paymentId,
        xenditReferenceId,
        expected: payment.xenditPaymentSessionId,
        received: session.id,
      });

      sendSuccess(res, {
        message: "Webhook diterima, tetapi payment session tidak cocok.",
      });
      return;
    }

    const subscription = await Subscription.findById(payment.subscriptionId).exec();

    if (!subscription) {
      console.warn("[xendit-webhook] subscription_not_found", {
        paymentId: payment.paymentId,
        xenditReferenceId,
        paymentSessionId: session.id,
      });

      sendSuccess(res, {
        message: "Webhook diterima, tetapi subscription lokal tidak ditemukan.",
      });
      return;
    }

    const parsedCreatedAt = webhookPayload.updated ? new Date(webhookPayload.updated) : null;
    const webhookCreatedAt =
      parsedCreatedAt && !Number.isNaN(parsedCreatedAt.getTime()) ? parsedCreatedAt : new Date();

    let paymentChanged = false;
    let subscriptionChanged = false;

    if (
      session.status === "PAID" ||
      session.status === "SETTLED"
    ) {
      const result = await markPaymentPaidFromProvider(
        payment,
        subscription,
        session,
        webhookCreatedAt,
      );
      paymentChanged = result.paymentChanged;
      subscriptionChanged = result.subscriptionChanged;
    } else if (
      session.status === "EXPIRED"
    ) {
      const result = applyXenditSessionSnapshot(payment, subscription, session);
      paymentChanged = result.paymentChanged;
      subscriptionChanged = result.subscriptionChanged;
    }

    if (paymentChanged || subscriptionChanged) {
      await Promise.all([
        paymentChanged ? payment.save() : Promise.resolve(payment),
        subscriptionChanged ? subscription.save() : Promise.resolve(subscription),
      ]);
    }

    if (payment.status === "paid" && subscription.paymentStatus === "paid") {
      await applyPaidSubscriptionStudentData(subscription);
    }

    sendSuccess(res, {
      message: "Webhook Xendit berhasil diproses.",
    });
  },
);

export const createXenditTestSession = asyncHandler(
  async (
    req: Request<Record<string, string>, Record<string, never>, TestXenditSessionRequestBody>,
    res: Response,
    next: NextFunction,
  ) => {
    const amount =
      typeof req.body.amount === "number" && Number.isFinite(req.body.amount)
        ? Math.max(1000, Math.round(req.body.amount))
        : 10000;
    const email = normalizeText(req.body.email) || "tester@example.com";
    const phone = normalizeText(req.body.phone) || "081234567890";
    const givenNames = normalizeText(req.body.givenNames) || "Test";
    const surname = normalizeText(req.body.surname) || "Session";
    const referenceId = `TEST-SESSION-${Date.now()}`;
    const { clientUrl, xenditApiKey, xenditWebhookToken } = validateEnv();
    const returnUrls = buildXenditReturnUrls(clientUrl, referenceId);

    try {
      const session = await createXenditInvoice({
        external_id: referenceId,
        amount,
        payer_email: email,
        description: "Dummy test payment session from backend",
        customer: {
          given_names: givenNames,
          ...(surname ? { surname } : {}),
          email,
          mobile_number: phone,
        },
        items: [
          {
            name: "Test Package",
            quantity: 1,
            price: amount,
          }
        ],
        ...(returnUrls.success_return_url
          ? { success_redirect_url: returnUrls.success_return_url }
          : {}),
        ...(returnUrls.cancel_return_url
          ? { failure_redirect_url: returnUrls.cancel_return_url }
          : {}),
      });

      sendSuccess(res, {
        message: "Xendit test session berhasil dibuat.",
        data: {
          referenceId,
          paymentSessionId: session.id,
          checkoutUrl: session.invoice_url,
          status: session.status,
          amount: session.amount,
          environment: "development",
          config: {
            hasApiKey: Boolean(xenditApiKey),
            apiKeyPrefix: xenditApiKey ? xenditApiKey.slice(0, 18) : null,
            hasWebhookToken: Boolean(xenditWebhookToken),
            clientUrl,
            usesHttpsReturnUrl: Boolean(returnUrls.success_return_url),
          },
        },
      });
    } catch (error) {
      if (error instanceof XenditServiceError) {
        console.error("[xendit-test-session] create_failed", {
          statusCode: error.statusCode,
          errorCode: error.errorCode,
          message: error.message,
          details: error.details,
        });

        const message =
          error.statusCode === 403
            ? buildXenditPermissionHelpMessage(error.message)
            : error.message;

        next(
          new AppError(
            error.statusCode === 403 ? 502 : error.statusCode,
            message,
            {
              xenditStatusCode: error.statusCode,
              xenditErrorCode: error.errorCode,
              xenditDetails: error.details,
              hint:
                error.statusCode === 403
                  ? "Generate secret key baru dengan permission Write untuk payment collection atau Money-in."
                  : undefined,
            },
            error.errorCode ?? "XENDIT_TEST_SESSION_FAILED",
          ),
        );
        return;
      }

      throw error;
    }
  },
);

export const confirmDummyPayment = asyncHandler(
  async (
    req: Request<Record<string, string>, Record<string, never>, ConfirmPaymentRequestBody>,
    res: Response,
    next: NextFunction,
  ) => {
    const paymentId = normalizeText(req.body.paymentId);
    const paymentMethod = normalizeText(req.body.method) || "manual_confirmation";
    const { allowPublicDummyPaymentConfirm } = validateEnv();

    if (!paymentId) {
      next(new AppError(400, "paymentId wajib dikirim."));
      return;
    }

    if (process.env.NODE_ENV === "production" && !allowPublicDummyPaymentConfirm) {
      next(
        new AppError(
          403,
          "Konfirmasi pembayaran publik non-Xendit dinonaktifkan pada production.",
          null,
          "PUBLIC_DUMMY_PAYMENT_CONFIRM_DISABLED",
        ),
      );
      return;
    }

    const payment = await Payment.findOne({ paymentId }).exec();

    if (!payment) {
      next(new AppError(404, "Data pembayaran tidak ditemukan.", null, "PAYMENT_NOT_FOUND"));
      return;
    }

    if (payment.source !== "register_online") {
      next(
        new AppError(
          403,
          "Pembayaran ini hanya dapat dikonfirmasi dari dashboard admin.",
          null,
          "PUBLIC_PAYMENT_CONFIRM_FORBIDDEN",
        ),
      );
      return;
    }

    const subscription = await Subscription.findById(payment.subscriptionId).exec();

    if (!subscription) {
      next(new AppError(404, "Subscription terkait pembayaran tidak ditemukan."));
      return;
    }

    if (isXenditBackedPayment(payment)) {
      next(
        new AppError(
          400,
          "Pembayaran Xendit hanya dapat dikonfirmasi dari webhook Xendit.",
          null,
          "XENDIT_WEBHOOK_REQUIRED",
        ),
      );
      return;
    }

    const paidResult = await markPaymentPaidManually({
      payment,
      subscription,
      paidAt: new Date(),
      method: paymentMethod,
    });

    if (paidResult.paymentChanged || paidResult.subscriptionChanged) {
      await Promise.all([
        paidResult.paymentChanged ? payment.save() : Promise.resolve(payment),
        paidResult.subscriptionChanged ? subscription.save() : Promise.resolve(subscription),
      ]);
    }

    if (payment.status === "paid" && subscription.paymentStatus === "paid") {
      await applyPaidSubscriptionStudentData(subscription);
    }

    const payload = await buildPaymentStatusResponse(paymentId);

    sendSuccess(res, {
      message: "Pembayaran dummy berhasil dikonfirmasi.",
      data: {
        student: toPublicStudentMembership(payload.student),
        subscription: toPublicSubscription(payload.subscription),
        payment: toPublicPayment(payload.payment),
        accessStatus: payload.accessStatus,
      },
    });
  },
);
