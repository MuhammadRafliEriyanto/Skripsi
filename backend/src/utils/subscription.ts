import { Types } from "mongoose";

import { Payment, type PaymentDocument } from "../models/Payment";
import { Student, type StudentDocument } from "../models/Student";
import { Subscription, type SubscriptionDocument } from "../models/Subscription";
import { type UserDocument } from "../models/User";

export const MEMBERSHIP_ACCESS_STATUSES = [
  "active",
  "expiring",
  "pending",
  "expired",
  "not_registered",
] as const;

const EXPIRING_MEMBERSHIP_THRESHOLD_DAYS = 14;
const DAY_IN_MILLISECONDS = 1000 * 60 * 60 * 24;

export const ONLINE_PACKAGE_DEFINITIONS = {
  "1-semester": {
    packageKey: "1-semester",
    packageName: "1 Semester",
    durationMonth: 6,
    amount: 1_850_000,
  },
  "2-semester": {
    packageKey: "2-semester",
    packageName: "2 Semester (1 Tahun)",
    durationMonth: 12,
    amount: 3_700_000,
  },
} as const;

export const CLASS_PRICING_MATRIX = {
  "SD 2": { "1-semester": 1_800_000, "2-semester": 3_600_000 },
  "SD 3": { "1-semester": 1_800_000, "2-semester": 3_600_000 },
  "SD 4": { "1-semester": 1_850_000, "2-semester": 3_700_000 },
  "SD 5": { "1-semester": 1_850_000, "2-semester": 3_700_000 },
  "SD 6": { "1-semester": 1_900_000, "2-semester": 3_800_000 },
  "SMP 7": { "1-semester": 2_000_000, "2-semester": 4_000_000 },
  "SMP 8": { "1-semester": 2_000_000, "2-semester": 4_000_000 },
  "SMP 9": { "1-semester": 2_050_000, "2-semester": 4_100_000 },
  "SMA 10": { "1-semester": 2_150_000, "2-semester": 4_300_000 },
  "SMA 11": { "1-semester": 2_150_000, "2-semester": 4_300_000 },
  "SMA 12": { "1-semester": 2_250_000, "2-semester": 4_500_000 },
} as const;

const LEGACY_ONLINE_PACKAGE_DEFINITIONS = {
  "12-bulan": {
    packageKey: "12-bulan",
    packageName: "Paket 1 Tahun (2 Semester) [Legacy]",
    durationMonth: 12,
    amount: 3_700_000,
  },
  "6-bulan": {
    packageKey: "6-bulan",
    packageName: "6 Bulan [Legacy]",
    durationMonth: 6,
    amount: 2_000_000,
  },
  "3-bulan": {
    packageKey: "3-bulan",
    packageName: "3 Bulan [Legacy]",
    durationMonth: 3,
    amount: 1_100_000,
  },
  "2-bulan": {
    packageKey: "2-bulan",
    packageName: "2 Bulan [Legacy]",
    durationMonth: 2,
    amount: 650_000,
  },
  "1-bulan": {
    packageKey: "1-bulan",
    packageName: "1 Bulan [Legacy]",
    durationMonth: 1,
    amount: 350_000,
  },
} as const;

export type OnlinePackageKey = keyof typeof ONLINE_PACKAGE_DEFINITIONS;
type LegacyOnlinePackageKey = keyof typeof LEGACY_ONLINE_PACKAGE_DEFINITIONS;
export type MembershipAccessStatus = (typeof MEMBERSHIP_ACCESS_STATUSES)[number];
type ClassPricedPackageKey = Extract<OnlinePackageKey, keyof typeof ONLINE_PACKAGE_DEFINITIONS>;
type ClassPricingClassName = keyof typeof CLASS_PRICING_MATRIX;

export type StudentWithUser = StudentDocument & {
  userId: UserDocument;
};

export type MembershipSnapshot = {
  student: StudentWithUser | null;
  subscription: SubscriptionDocument | null;
  payment: PaymentDocument | null;
  accessStatus: MembershipAccessStatus;
  daysRemaining: number | null;
};

export function getOnlinePackageByKey(value: string | undefined | null) {
  if (!value) {
    return null;
  }

  return (
    ONLINE_PACKAGE_DEFINITIONS[value as OnlinePackageKey] ??
    LEGACY_ONLINE_PACKAGE_DEFINITIONS[value as LegacyOnlinePackageKey] ??
    null
  );
}

function normalizeClassPricingKey(value: string | undefined | null) {
  const normalizedValue = value?.trim().replace(/\s+/g, " ").toUpperCase() ?? "";
  const match = normalizedValue.match(/\b(SD|SMP|SMA)\s+(1[0-2]|[2-9])\b/);

  if (!match) {
    return null;
  }

  const className = `${match[1]} ${match[2]}` as ClassPricingClassName;

  return className in CLASS_PRICING_MATRIX ? className : null;
}

export function getPackageAmountByClass(
  className: string | undefined | null,
  packageKey: string | undefined | null,
) {
  const normalizedClassName = normalizeClassPricingKey(className);
  const normalizedPackageKey = packageKey as ClassPricedPackageKey;

  if (
    normalizedClassName &&
    (normalizedPackageKey === "1-semester" || normalizedPackageKey === "2-semester")
  ) {
    return CLASS_PRICING_MATRIX[normalizedClassName][normalizedPackageKey];
  }

  return getOnlinePackageByKey(packageKey)?.amount ?? null;
}

export function getClassPricedOnlinePackageByKey(
  packageKey: string | undefined | null,
  className: string | undefined | null,
) {
  const packageDefinition = getOnlinePackageByKey(packageKey);

  if (!packageDefinition) {
    return null;
  }

  const amount = getPackageAmountByClass(className, packageDefinition.packageKey);

  return {
    ...packageDefinition,
    amount: amount ?? packageDefinition.amount,
  };
}

export function buildSubscriptionEndDate(startDate: Date, durationMonth: number) {
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + durationMonth);
  return endDate;
}

export function getRemainingDaysUntilDate(endDate: Date, now = new Date()) {
  const milliseconds = endDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(milliseconds / DAY_IN_MILLISECONDS));
}

export function resolveSubscriptionStatusByDates(
  startDate: Date | null | undefined,
  endDate: Date | null | undefined,
  now = new Date(),
): "pending" | "active" | "expiring" | "expired" {
  if (!endDate || Number.isNaN(endDate.getTime())) {
    return "pending";
  }

  if (startDate && startDate.getTime() > now.getTime()) {
    return "pending";
  }

  if (endDate.getTime() <= now.getTime()) {
    return "expired";
  }

  return getRemainingDaysUntilDate(endDate, now) <= EXPIRING_MEMBERSHIP_THRESHOLD_DAYS
    ? "expiring"
    : "active";
}

function compareSubscriptionRecency(
  first: SubscriptionDocument,
  second: SubscriptionDocument,
) {
  return second.createdAt.getTime() - first.createdAt.getTime();
}

function compareSubscriptionByEndDate(
  first: SubscriptionDocument,
  second: SubscriptionDocument,
) {
  const firstEndDate = first.endDate?.getTime() ?? 0;
  const secondEndDate = second.endDate?.getTime() ?? 0;

  if (firstEndDate !== secondEndDate) {
    return secondEndDate - firstEndDate;
  }

  return compareSubscriptionRecency(first, second);
}

export async function refreshSubscriptionLifecycle(
  subscription: SubscriptionDocument | null,
): Promise<SubscriptionDocument | null> {
  if (!subscription) {
    return null;
  }

  let changed = false;
  const nextStatus =
    subscription.paymentStatus === "failed" || subscription.paymentStatus === "expired"
      ? "expired"
      : resolveSubscriptionStatusByDates(
          subscription.startDate,
          subscription.endDate,
        );

  if (subscription.status !== nextStatus) {
    subscription.status = nextStatus;
    changed = true;
  }

  if (changed) {
    await subscription.save();
  }

  return subscription;
}

export function resolveMembershipAccessStatus(
  subscription: SubscriptionDocument | null,
): MembershipAccessStatus {
  if (!subscription) {
    return "not_registered";
  }

  if (subscription.paymentStatus === "failed" || subscription.paymentStatus === "expired") {
    return "expired";
  }

  return resolveSubscriptionStatusByDates(
    subscription.startDate,
    subscription.endDate,
  );
}

export function getRemainingSubscriptionDays(subscription: SubscriptionDocument | null) {
  const accessStatus = resolveMembershipAccessStatus(subscription);

  if (
    !subscription?.endDate ||
    (accessStatus !== "active" && accessStatus !== "expiring")
  ) {
    return null;
  }

  return getRemainingDaysUntilDate(subscription.endDate);
}

export async function findStudentWithUserByUserId(userId: Types.ObjectId | string) {
  return Student.findOne({ userId })
    .populate<{ userId: UserDocument }>("userId")
    .exec() as Promise<StudentWithUser | null>;
}

export async function findLatestSubscriptionByStudentId(studentId: Types.ObjectId | string) {
  return Subscription.findOne({ studentId }).sort({ createdAt: -1 }).exec();
}

export function selectPrimarySubscription(
  subscriptions: SubscriptionDocument[],
): SubscriptionDocument | null {
  if (!subscriptions.length) {
    return null;
  }

  const activeSubscriptions = subscriptions
    .filter(
      (subscription) =>
        subscription.paymentStatus === "paid" &&
        subscription.endDate &&
        (!subscription.startDate || subscription.startDate.getTime() <= Date.now()) &&
        subscription.endDate.getTime() > Date.now(),
    )
    .sort(compareSubscriptionByEndDate);

  if (activeSubscriptions.length > 0) {
    return activeSubscriptions[0];
  }

  const payablePendingSubscriptions = subscriptions
    .filter(
      (subscription) =>
        subscription.status === "pending" &&
        (subscription.paymentStatus === "pending" || subscription.paymentStatus === "paid"),
    )
    .sort(compareSubscriptionRecency);

  if (payablePendingSubscriptions.length > 0) {
    return payablePendingSubscriptions[0];
  }

  return [...subscriptions].sort(compareSubscriptionRecency)[0] ?? null;
}

export async function findPrimarySubscriptionByStudentId(
  studentId: Types.ObjectId | string,
) {
  const subscriptions = await Subscription.find({ studentId })
    .sort({ createdAt: -1, _id: -1 })
    .exec();

  const refreshedSubscriptions = (
    await Promise.all(
      subscriptions.map((subscription) => refreshSubscriptionLifecycle(subscription)),
    )
  ).filter((subscription): subscription is SubscriptionDocument => subscription !== null);

  return selectPrimarySubscription(refreshedSubscriptions);
}

export async function findActiveSubscriptionByStudentId(studentId: Types.ObjectId | string) {
  const now = new Date();
  const subscription = await Subscription.findOne({
    studentId,
    paymentStatus: "paid",
    startDate: { $lte: now },
    endDate: { $gt: now },
  })
    .sort({ createdAt: -1 })
    .exec();

  return refreshSubscriptionLifecycle(subscription);
}

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

export async function findActiveSubscriptionIdForAcademicRecord(params: {
  studentObjectId?: Types.ObjectId | string | null;
  publicStudentId?: string | null;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  let studentObjectId: Types.ObjectId | string | null = null;
  const studentObjectIdCandidate =
    params.studentObjectId instanceof Types.ObjectId
      ? params.studentObjectId
      : normalizeText(params.studentObjectId);

  if (
    studentObjectIdCandidate instanceof Types.ObjectId ||
    (studentObjectIdCandidate && Types.ObjectId.isValid(studentObjectIdCandidate))
  ) {
    studentObjectId = studentObjectIdCandidate;
  }

  if (!studentObjectId) {
    const publicStudentId = normalizeText(params.publicStudentId);
    const student = publicStudentId
      ? await Student.findOne({ studentId: publicStudentId }).select("_id").exec()
      : null;

    studentObjectId = student?._id ?? null;
  }

  if (!studentObjectId) {
    return null;
  }

  const subscription = await Subscription.findOne({
    studentId: studentObjectId,
    paymentStatus: "paid",
    startDate: { $lte: now },
    endDate: { $gt: now },
  })
    .select("_id")
    .sort({ endDate: -1, createdAt: -1, _id: -1 })
    .exec();

  return subscription?._id ?? null;
}

export function buildAcademicRecordSubscriptionFilter(
  subscriptionId?: Types.ObjectId | string | Array<Types.ObjectId | string | null | undefined> | null,
) {
  const legacyFilters: Record<string, unknown>[] = [
    { subscriptionId: null },
    { subscriptionId: { $exists: false } },
  ];
  const subscriptionIds = (Array.isArray(subscriptionId) ? subscriptionId : [subscriptionId])
    .filter((id): id is Types.ObjectId | string => Boolean(id));

  if (subscriptionIds.length === 0) {
    return {
      $or: legacyFilters,
    };
  }

  return {
    $or: [
      { subscriptionId: { $in: subscriptionIds } },
      ...legacyFilters,
    ],
  };
}

export async function findActiveSubscriptionIdsForAcademicRecords(params: {
  publicStudentIds: string[];
  now?: Date;
}) {
  const normalizedStudentIds = Array.from(
    new Set(
      params.publicStudentIds
        .map((studentId) => normalizeText(studentId))
        .filter(Boolean),
    ),
  );

  if (normalizedStudentIds.length === 0) {
    return [];
  }

  const students = await Student.find({
    studentId: {
      $in: normalizedStudentIds,
    },
  })
    .select("_id")
    .lean()
    .exec();
  const studentObjectIds = students.map((student) => student._id).filter(Boolean);

  if (studentObjectIds.length === 0) {
    return [];
  }

  const now = params.now ?? new Date();
  const subscriptions = await Subscription.find({
    studentId: {
      $in: studentObjectIds,
    },
    paymentStatus: "paid",
    startDate: { $lte: now },
    endDate: { $gt: now },
  })
    .select("_id")
    .lean()
    .exec();

  return subscriptions.map((subscription) => subscription._id);
}

export async function findLatestPaymentBySubscriptionId(subscriptionId: Types.ObjectId | string) {
  return Payment.findOne({ subscriptionId }).sort({ createdAt: -1 }).exec();
}

export async function findLatestDraftRenewalPaymentByStudentId(
  studentId: Types.ObjectId | string,
) {
  return Payment.findOne({
    studentId,
    status: "draft_renewal",
    archivedAt: null,
  })
    .sort({ createdAt: -1, _id: -1 })
    .exec();
}

export async function getMembershipSnapshotByUserId(
  userId: Types.ObjectId | string,
): Promise<MembershipSnapshot> {
  const student = await findStudentWithUserByUserId(userId);

  if (!student) {
    return {
      student: null,
      subscription: null,
      payment: null,
      accessStatus: "not_registered",
      daysRemaining: null,
    };
  }

  const subscription = await findPrimarySubscriptionByStudentId(student._id);
  const draftRenewalPayment = await findLatestDraftRenewalPaymentByStudentId(
    student._id,
  );
  const payment =
    draftRenewalPayment ??
    (subscription ? await findLatestPaymentBySubscriptionId(subscription._id) : null);
  const accessStatus = resolveMembershipAccessStatus(subscription);

  return {
    student,
    subscription,
    payment,
    accessStatus,
    daysRemaining: getRemainingSubscriptionDays(subscription),
  };
}

export function toPublicStudentMembership(student: StudentWithUser) {
  return {
    id: student.studentId,
    userId: student.userId._id.toString(),
    name: student.userId.nama,
    email: student.userId.email,
    phone: student.phone,
    branch: student.branch,
    program: student.program,
    className: student.className,
    utbkTrack: student.utbkTrack ?? "",
    targetKampus: student.targetKampus ?? "",
    targetJurusan: student.targetJurusan ?? "",
    gender: student.gender ?? null,
    address: student.address ?? "",
    schoolOrigin: student.schoolOrigin ?? "",
    difficultSubjects: student.difficultSubjects ?? "",
    status: student.status,
    academicJoinedAt: student.academicJoinedAt,
    isEmailVerified: student.userId.isEmailVerified,
  };
}

export function toPublicSubscription(subscription: SubscriptionDocument) {
  return {
    id: subscription._id.toString(),
    subscriptionCode: subscription.subscriptionCode,
    userId: subscription.userId.toString(),
    studentId: subscription.studentId.toString(),
    packageKey: subscription.packageKey,
    packageName: subscription.packageName,
    durationMonth: subscription.durationMonth,
    startDate: subscription.startDate,
    endDate: subscription.endDate,
    status: subscription.status,
    paymentStatus: subscription.paymentStatus,
    source: subscription.source ?? "register_online",
    createdByAdminId: subscription.createdByAdminId?.toString() ?? null,
    renewalOfSubscriptionId: subscription.renewalOfSubscriptionId?.toString() ?? null,
    targetProgram: subscription.targetProgram ?? null,
    targetClassName: subscription.targetClassName ?? null,
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
  };
}

export function toPublicPayment(payment: PaymentDocument) {
  return {
    id: payment._id.toString(),
    paymentId: payment.paymentId,
    userId: payment.userId.toString(),
    studentId: payment.studentId.toString(),
    subscriptionId: payment.subscriptionId.toString(),
    packageKey: payment.packageKey,
    packageName: payment.packageName,
    durationMonth: payment.durationMonth,
    amount: payment.amount,
    provider: payment.provider,
    method: payment.method,
    status: payment.status,
    source: payment.source ?? "register_online",
    createdByAdminId: payment.createdByAdminId?.toString() ?? null,
    paidAt: payment.paidAt,
    checkoutUrl: payment.checkoutUrl,
    expiresAt: payment.expiresAt,
    checkoutLastSentAt: payment.checkoutLastSentAt,
    checkoutSendCount: payment.checkoutSendCount,
    cancelReason: payment.cancelReason,
    canceledAt: payment.canceledAt,
    xenditPaymentSessionId: payment.xenditPaymentSessionId,
    xenditPaymentRequestId: payment.xenditPaymentRequestId,
    xenditPaymentId: payment.xenditPaymentId,
    xenditCustomerId: payment.xenditCustomerId,
    xenditSessionStatus: payment.xenditSessionStatus,
    xenditWebhookReceivedAt: payment.xenditWebhookReceivedAt,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
}
