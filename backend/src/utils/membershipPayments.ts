import crypto from "crypto";
import type { Types } from "mongoose";

import { validateEnv } from "../config/env";
import {
  Payment,
  type PaymentCancelReason,
  type PaymentDocument,
  type PaymentSource,
} from "../models/Payment";
import { Student, type StudentDocument } from "../models/Student";
import { Subscription, type SubscriptionDocument } from "../models/Subscription";
import { User, type UserDocument } from "../models/User";
import {
  buildXenditReturnUrls,
  expireXenditInvoice,
  createXenditInvoice,
  getXenditInvoice,
  type XenditInvoice,
  type XenditInvoiceCreatePayload,
  XenditServiceError,
} from "../services/xenditService";
import { AppError } from "./apiResponse";
import { getNextPublicId } from "./publicId";
import {
  buildSubscriptionEndDate,
  getOnlinePackageByKey,
  refreshSubscriptionLifecycle,
} from "./subscription";

type MembershipPackageDefinition = {
  packageKey: string;
  packageName: string;
  durationMonth: number;
  amount: number;
};

export type ResolvedLatestStudentPackage = {
  packageDefinition: MembershipPackageDefinition;
  sourceSubscription: SubscriptionDocument;
};

type XenditWebhookSessionData = Partial<XenditInvoice>;

export type XenditSessionSnapshot = Omit<
  Partial<XenditInvoice>,
  "id" | "status"
> & {
  id: string;
  status: string;
  external_id?: string;
};

type ResolveRenewalWindowOptions = {
  preferredStartDate?: Date | null;
};

function normalizeText(value: string | undefined | null) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function normalizeXenditMetadata(
  metadata: Record<string, unknown> | null | undefined,
) {
  if (!metadata) {
    return undefined;
  }

  const normalizedEntries = Object.entries(metadata)
    .map(([key, value]) => [normalizeText(key), normalizeText(String(value ?? ""))] as const)
    .filter(([key, value]) => key && value);

  if (!normalizedEntries.length) {
    return undefined;
  }

  return Object.fromEntries(normalizedEntries);
}

export function buildUniqueXenditReferenceId(paymentId: string) {
  const normalizedPaymentId = normalizeText(paymentId);
  const timestamp = Date.now();
  const randomSuffix = crypto.randomBytes(4).toString("hex");

  return `${normalizedPaymentId}-${timestamp}-${randomSuffix}`;
}

function formatPhoneForXendit(phone: string | null | undefined) {
  const normalizedPhone = normalizeText(phone);

  if (!normalizedPhone) {
    return undefined;
  }

  const normalizedDigits = normalizedPhone.replace(/\D/g, "");

  if (!normalizedDigits) {
    return undefined;
  }

  if (normalizedPhone.startsWith("+")) {
    return `+${normalizedDigits}`;
  }

  if (normalizedDigits.startsWith("62")) {
    return `+${normalizedDigits}`;
  }

  if (normalizedDigits.startsWith("0")) {
    return `+62${normalizedDigits.slice(1)}`;
  }

  if (normalizedDigits.startsWith("8")) {
    return `+62${normalizedDigits}`;
  }

  return `+${normalizedDigits}`;
}

function splitStudentName(fullName: string) {
  const [firstName, ...restNames] = fullName.trim().split(/\s+/);

  return {
    givenNames: firstName || fullName,
    surname: restNames.join(" ") || undefined,
  };
}

export function buildXenditPermissionHelpMessage(baseMessage: string) {
  return `${baseMessage} Pastikan secret API key Xendit yang dipakai memiliki permission Write untuk Payment Session atau Money-in di dashboard Xendit.`;
}

export function isXenditBackedPayment(payment: PaymentDocument) {
  return payment.provider === "xendit" || Boolean(payment.xenditPaymentSessionId);
}

export function normalizeXenditSessionSnapshot(
  sessionData: XenditWebhookSessionData,
): XenditSessionSnapshot {
  return {
    id: normalizeText(sessionData.id),
    external_id: normalizeText(sessionData.external_id),
    status: normalizeText(sessionData.status).toUpperCase(),
    invoice_url: sessionData.invoice_url,
    expiry_date: sessionData.expiry_date,
    amount: sessionData.amount,
    currency: sessionData.currency,
    payer_email: sessionData.payer_email,
    description: sessionData.description,
  };
}

function applyExpiredState(
  payment: PaymentDocument,
  subscription: SubscriptionDocument,
  options: {
    cancelReason?: PaymentCancelReason | null;
    canceledAt?: Date | null;
  } = {},
) {
  let paymentChanged = false;
  let subscriptionChanged = false;

  if (payment.status !== "paid" && payment.status !== "expired") {
    payment.status = "expired";
    paymentChanged = true;
  }

  if (subscription.paymentStatus !== "paid" && subscription.paymentStatus !== "expired") {
    subscription.paymentStatus = "expired";
    subscriptionChanged = true;
  }

  if (subscription.status !== "expired") {
    subscription.status = "expired";
    subscriptionChanged = true;
  }

  if (options.cancelReason && payment.cancelReason !== options.cancelReason) {
    payment.cancelReason = options.cancelReason;
    paymentChanged = true;
  }

  if (options.canceledAt) {
    const nextCanceledAt = options.canceledAt;

    if (
      !payment.canceledAt ||
      payment.canceledAt.toISOString() !== nextCanceledAt.toISOString()
    ) {
      payment.canceledAt = nextCanceledAt;
      paymentChanged = true;
    }
  }

  return {
    paymentChanged,
    subscriptionChanged,
  };
}

export function applyXenditSessionSnapshot(
  payment: PaymentDocument,
  subscription: SubscriptionDocument,
  session: XenditSessionSnapshot,
) {
  let paymentChanged = false;
  let subscriptionChanged = false;

  const nextExpiresAt =
    typeof session.expiry_date === "string" && session.expiry_date
      ? new Date(session.expiry_date)
      : undefined;

  if (
    typeof session.invoice_url === "string" &&
    payment.checkoutUrl !== session.invoice_url
  ) {
    payment.checkoutUrl = session.invoice_url;
    paymentChanged = true;
  }

  if (
    nextExpiresAt &&
    !Number.isNaN(nextExpiresAt.getTime()) &&
    (payment.expiresAt?.toISOString() ?? null) !== nextExpiresAt.toISOString()
  ) {
    payment.expiresAt = nextExpiresAt;
    paymentChanged = true;
  }

  if (
    typeof session.external_id === "string" &&
    session.external_id &&
    payment.xenditReferenceId !== session.external_id
  ) {
    payment.xenditReferenceId = session.external_id;
    paymentChanged = true;
  }

  if (
    session.id &&
    payment.xenditPaymentSessionId !== session.id
  ) {
    payment.xenditPaymentSessionId = session.id;
    paymentChanged = true;
  }

  if (session.status && payment.xenditSessionStatus !== session.status) {
    payment.xenditSessionStatus = session.status;
    paymentChanged = true;
  }

  if (
    (session.status === "EXPIRED") &&
    payment.status !== "paid"
  ) {
    const expiredResult = applyExpiredState(payment, subscription, {
      cancelReason: null,
      canceledAt: null,
    });

    paymentChanged = paymentChanged || expiredResult.paymentChanged;
    subscriptionChanged = subscriptionChanged || expiredResult.subscriptionChanged;
  }

  return {
    paymentChanged,
    subscriptionChanged,
  };
}

async function findCurrentActiveSubscriptionByStudentId(
  studentId: Types.ObjectId | string,
  excludeSubscriptionId?: Types.ObjectId | string | null,
) {
  const filters: Record<string, unknown> = {
    studentId,
    paymentStatus: "paid",
  };

  if (excludeSubscriptionId) {
    filters._id = { $ne: excludeSubscriptionId };
  }

  const subscriptions = await Subscription.find(filters)
    .sort({ endDate: -1, createdAt: -1, _id: -1 })
    .exec();

  for (const subscription of subscriptions) {
    const refreshedSubscription = await refreshSubscriptionLifecycle(subscription);

    if (
      refreshedSubscription &&
      refreshedSubscription.status === "active" &&
      refreshedSubscription.endDate &&
      refreshedSubscription.endDate.getTime() > Date.now()
    ) {
      return refreshedSubscription;
    }
  }

  return null;
}

export async function resolveRenewalWindow(
  studentId: Types.ObjectId | string,
  durationMonth: number,
  paidAt: Date,
  currentSubscriptionId?: Types.ObjectId | string | null,
  options: ResolveRenewalWindowOptions = {},
) {
  const activeSubscription = await findCurrentActiveSubscriptionByStudentId(
    studentId,
    currentSubscriptionId,
  );
  const activeEndDate =
    activeSubscription?.endDate && activeSubscription.endDate.getTime() > paidAt.getTime()
      ? new Date(activeSubscription.endDate)
      : null;
  const preferredStartDate =
    options.preferredStartDate &&
    !Number.isNaN(options.preferredStartDate.getTime()) &&
    options.preferredStartDate.getTime() > paidAt.getTime()
      ? new Date(options.preferredStartDate)
      : null;
  const startDate = [paidAt, activeEndDate, preferredStartDate]
    .filter((date): date is Date => date !== null)
    .sort((firstDate, secondDate) => secondDate.getTime() - firstDate.getTime())[0];
  const endDate = buildSubscriptionEndDate(startDate, durationMonth);
  const status: SubscriptionDocument["status"] =
    startDate.getTime() > Date.now() ? "pending" : "active";

  return {
    startDate,
    endDate,
    status,
    renewalOfSubscriptionId: activeSubscription?._id ?? null,
  };
}

export async function markPaymentPaidFromProvider(
  payment: PaymentDocument,
  subscription: SubscriptionDocument,
  session: XenditSessionSnapshot,
  processedAt: Date,
) {
  const snapshotResult = applyXenditSessionSnapshot(payment, subscription, session);
  let paymentChanged = snapshotResult.paymentChanged;
  let subscriptionChanged = snapshotResult.subscriptionChanged;

  const paidAt = payment.paidAt ?? processedAt;
  const renewalWindow = await resolveRenewalWindow(
    subscription.studentId,
    subscription.durationMonth,
    paidAt,
    subscription._id,
    { preferredStartDate: subscription.startDate },
  );

  if (payment.status !== "paid") {
    payment.status = "paid";
    paymentChanged = true;
  }

  if (payment.cancelReason !== null) {
    payment.cancelReason = null;
    paymentChanged = true;
  }

  if (payment.canceledAt !== null) {
    payment.canceledAt = null;
    paymentChanged = true;
  }

  if (payment.paidAt?.toISOString() !== paidAt.toISOString()) {
    payment.paidAt = paidAt;
    paymentChanged = true;
  }

  if (payment.xenditWebhookReceivedAt?.toISOString() !== processedAt.toISOString()) {
    payment.xenditWebhookReceivedAt = processedAt;
    paymentChanged = true;
  }

  if (subscription.paymentStatus !== "paid") {
    subscription.paymentStatus = "paid";
    subscriptionChanged = true;
  }

  if (subscription.status !== renewalWindow.status) {
    subscription.status = renewalWindow.status;
    subscriptionChanged = true;
  }

  if (subscription.startDate?.toISOString() !== renewalWindow.startDate.toISOString()) {
    subscription.startDate = renewalWindow.startDate;
    subscriptionChanged = true;
  }

  if (subscription.endDate?.toISOString() !== renewalWindow.endDate.toISOString()) {
    subscription.endDate = renewalWindow.endDate;
    subscriptionChanged = true;
  }

  const nextRenewalOfSubscriptionId = renewalWindow.renewalOfSubscriptionId?.toString() ?? null;
  const currentRenewalOfSubscriptionId =
    subscription.renewalOfSubscriptionId?.toString() ?? null;

  if (currentRenewalOfSubscriptionId !== nextRenewalOfSubscriptionId) {
    subscription.renewalOfSubscriptionId = renewalWindow.renewalOfSubscriptionId;
    subscriptionChanged = true;
  }

  return {
    paymentChanged,
    subscriptionChanged,
  };
}

export async function syncPendingPaymentWithXendit(
  payment: PaymentDocument,
  subscription: SubscriptionDocument,
) {
  if (
    !isXenditBackedPayment(payment) ||
    payment.status === "paid" ||
    !payment.xenditPaymentSessionId
  ) {
    return {
      paymentChanged: false,
      subscriptionChanged: false,
    };
  }

  const session = await getXenditInvoice(payment.xenditPaymentSessionId);
  let syncResult;

  if (session.status === "PAID" || session.status === "SETTLED") {
    syncResult = await markPaymentPaidFromProvider(payment, subscription, session, new Date());
  } else {
    syncResult = applyXenditSessionSnapshot(payment, subscription, session);
  }

  if (syncResult.paymentChanged || syncResult.subscriptionChanged) {
    await Promise.all([
      syncResult.paymentChanged ? payment.save() : Promise.resolve(payment),
      syncResult.subscriptionChanged ? subscription.save() : Promise.resolve(subscription),
    ]);
  }

  const syncedPaymentStatus = payment.status as PaymentDocument["status"];

  if (syncedPaymentStatus === "paid" && subscription.paymentStatus === "paid") {
    await applySubscriptionTargetStudentData(subscription);
  }

  return syncResult;
}

export async function createPendingSubscriptionAndPayment(params: {
  user: UserDocument;
  student: StudentDocument;
  packageDefinition: MembershipPackageDefinition;
  source: PaymentSource;
  createdByAdminId?: Types.ObjectId | string | null;
  renewalOfSubscriptionId?: Types.ObjectId | string | null;
  startDate?: Date | null;
  targetProgram?: string | null;
  targetClassName?: string | null;
  paymentStatus?: "pending" | "draft_renewal";
}) {
  const subscriptionCode = await getNextPublicId(Subscription, "subscriptionCode", "SUB");
  const paymentId = await getNextPublicId(Payment, "paymentId", "PAY");
  const createdByAdminId = params.createdByAdminId ?? null;
  const startDate =
    params.startDate && !Number.isNaN(params.startDate.getTime())
      ? params.startDate
      : null;

  const subscription = await Subscription.create({
    subscriptionCode,
    userId: params.user._id,
    studentId: params.student._id,
    packageKey: params.packageDefinition.packageKey,
    packageName: params.packageDefinition.packageName,
    durationMonth: params.packageDefinition.durationMonth,
    startDate,
    endDate: null,
    status: "pending",
    paymentStatus: params.paymentStatus ?? "pending",
    source: params.source,
    createdByAdminId,
    renewalOfSubscriptionId: params.renewalOfSubscriptionId ?? null,
    targetProgram: normalizeText(params.targetProgram) || null,
    targetClassName: normalizeText(params.targetClassName) || null,
  });

  const payment = await Payment.create({
    paymentId,
    userId: params.user._id,
    studentId: params.student._id,
    subscriptionId: subscription._id,
    packageKey: params.packageDefinition.packageKey,
    packageName: params.packageDefinition.packageName,
    durationMonth: params.packageDefinition.durationMonth,
    amount: params.packageDefinition.amount,
    provider: "xendit",
    method: "xendit_payment_link",
    status: params.paymentStatus ?? "pending",
    source: params.source,
    createdByAdminId,
    paidAt: null,
  });

  return {
    subscription,
    payment,
  };
}

export async function applySubscriptionTargetStudentData(
  subscription: SubscriptionDocument,
) {
  const targetProgram = normalizeText(subscription.targetProgram);
  const targetClassName = normalizeText(subscription.targetClassName);

  if (!targetProgram && !targetClassName) {
    return null;
  }

  const student = await Student.findById(subscription.studentId).exec();

  if (!student) {
    return null;
  }

  let changed = false;

  if (targetProgram && student.program !== targetProgram) {
    student.program = targetProgram;
    changed = true;
  }

  if (targetClassName && student.className !== targetClassName) {
    student.className = targetClassName;
    changed = true;
  }

  if (changed) {
    await student.save();
  }

  return student;
}

export async function attachXenditSessionToPayment(params: {
  payment: PaymentDocument;
  subscription: SubscriptionDocument;
  student: StudentDocument;
  user: UserDocument;
  expiresAt?: Date | null;
}) {
  const { clientUrl } = validateEnv();
  const xenditReturnUrls = buildXenditReturnUrls(clientUrl, params.payment.paymentId);
  const { givenNames, surname } = splitStudentName(params.user.nama);
  const xenditReferenceId = buildUniqueXenditReferenceId(params.payment.paymentId);
  const formattedStudentPhone = formatPhoneForXendit(params.student.phone);
  const payload: XenditInvoiceCreatePayload = {
    external_id: xenditReferenceId,
    amount: params.payment.amount,
    payer_email: params.user.email,
    description: `Membership ${params.payment.packageName} untuk ${params.user.nama}`,
    customer: {
      given_names: givenNames,
      ...(surname ? { surname } : {}),
      email: params.user.email,
      ...(formattedStudentPhone ? { mobile_number: formattedStudentPhone } : {}),
    },
    items: [
      {
        name: `Membership ${params.payment.packageName}`,
        quantity: 1,
        price: params.payment.amount,
      }
    ],
    ...(xenditReturnUrls.success_return_url
      ? { success_redirect_url: xenditReturnUrls.success_return_url }
      : {}),
    ...(xenditReturnUrls.cancel_return_url
      ? { failure_redirect_url: xenditReturnUrls.cancel_return_url }
      : {}),
    ...(params.expiresAt
      ? { invoice_duration: Math.max(1, Math.floor((params.expiresAt.getTime() - Date.now()) / 1000)) }
      : {}),
  };

  try {
    const session = await createXenditInvoice(payload);

    if (!session.invoice_url) {
      throw new AppError(
        502,
        "Xendit belum mengembalikan checkout URL untuk pembayaran ini.",
        null,
        "XENDIT_CHECKOUT_URL_MISSING",
      );
    }

    params.payment.checkoutUrl = session.invoice_url;
    params.payment.expiresAt = session.expiry_date ? new Date(session.expiry_date) : null;
    params.payment.xenditReferenceId = normalizeText(session.external_id) || xenditReferenceId;
    params.payment.xenditPaymentSessionId = session.id;
    params.payment.xenditPaymentRequestId = null;
    params.payment.xenditPaymentId = null;
    params.payment.xenditCustomerId = null;
    params.payment.xenditSessionStatus = session.status;
    params.payment.checkoutLastSentAt = new Date();
    params.payment.checkoutSendCount = Math.max(1, params.payment.checkoutSendCount + 1);
    await params.payment.save();

    return session;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (error instanceof XenditServiceError) {
      throw new AppError(
        502,
        `Gagal membuat payment session di Xendit: ${
          error.statusCode === 403
            ? buildXenditPermissionHelpMessage(error.message)
            : error.message
        }`,
        {
          xenditStatusCode: error.statusCode,
          xenditErrorCode: error.errorCode,
          xenditDetails: (error.details as Record<string, unknown> | null) ?? null,
        },
        error.errorCode ?? "XENDIT_SESSION_CREATE_FAILED",
      );
    }

    throw error;
  }
}

export async function findBlockingPendingPaymentForStudent(
  studentId: Types.ObjectId | string,
) {
  const payments = await Payment.find({
    studentId,
    status: "pending",
    archivedAt: null,
  })
    .sort({ createdAt: -1, _id: -1 })
    .exec();

  for (const payment of payments) {
    const subscription = await Subscription.findById(payment.subscriptionId).exec();

    if (!subscription) {
      continue;
    }

    let paymentChanged = false;
    let subscriptionChanged = false;

    if (isXenditBackedPayment(payment) && payment.xenditPaymentSessionId) {
      try {
        const syncResult = await syncPendingPaymentWithXendit(payment, subscription);
        paymentChanged = syncResult.paymentChanged;
        subscriptionChanged = syncResult.subscriptionChanged;
      } catch (error) {
        console.error("[admin-payment] sync_pending_payment_failed", {
          paymentId: payment.paymentId,
          paymentSessionId: payment.xenditPaymentSessionId,
          message: error instanceof Error ? error.message : "Unknown Xendit sync error",
        });
      }
    } else if (payment.expiresAt && payment.expiresAt.getTime() <= Date.now()) {
      const expiredResult = applyExpiredState(payment, subscription);
      paymentChanged = expiredResult.paymentChanged;
      subscriptionChanged = expiredResult.subscriptionChanged;

      if (paymentChanged || subscriptionChanged) {
        await Promise.all([
          paymentChanged ? payment.save() : Promise.resolve(payment),
          subscriptionChanged ? subscription.save() : Promise.resolve(subscription),
        ]);
      }
    }

    if (payment.status === "pending") {
      return {
        payment,
        subscription,
      };
    }
  }

  return null;
}

export async function expirePendingPayment(params: {
  payment: PaymentDocument;
  subscription: SubscriptionDocument;
  cancelReason?: PaymentCancelReason | null;
  canceledAt?: Date | null;
}) {
  const expiredResult = applyExpiredState(params.payment, params.subscription, {
    cancelReason: params.cancelReason ?? null,
    canceledAt: params.canceledAt ?? null,
  });

  if (expiredResult.paymentChanged || expiredResult.subscriptionChanged) {
    await Promise.all([
      expiredResult.paymentChanged
        ? params.payment.save()
        : Promise.resolve(params.payment),
      expiredResult.subscriptionChanged
        ? params.subscription.save()
        : Promise.resolve(params.subscription),
    ]);
  }

  return expiredResult;
}

export async function findStudentAndUserByPublicStudentId(studentId: string) {
  const student = await Student.findOne({ studentId }).exec();

  if (!student) {
    return {
      student: null,
      user: null,
    };
  }

  const user = await User.findById(student.userId).exec();

  return {
    student,
    user,
  };
}

export async function resolveLatestPackageForStudent(
  studentId: Types.ObjectId | string,
): Promise<ResolvedLatestStudentPackage> {
  const latestSubscription = await Subscription.findOne({ studentId })
    .sort({ createdAt: -1, _id: -1 })
    .exec();
  const refreshedSubscription = await refreshSubscriptionLifecycle(latestSubscription);

  if (!refreshedSubscription) {
    throw new AppError(
      409,
      "Siswa belum memiliki subscription sebelumnya.",
      null,
      "NO_PREVIOUS_PACKAGE",
    );
  }

  const packageKey = normalizeText(refreshedSubscription.packageKey);
  const packageDefinition = getOnlinePackageByKey(packageKey);

  if (!packageDefinition) {
    throw new AppError(
      409,
      "Package subscription terakhir siswa tidak valid.",
      {
        packageKey: packageKey || null,
        subscriptionCode: refreshedSubscription.subscriptionCode,
      },
      "INVALID_PREVIOUS_PACKAGE",
    );
  }

  return {
    packageDefinition,
    sourceSubscription: refreshedSubscription,
  };
}

export async function createAdminPaymentSessionForStudent(params: {
  student: StudentDocument;
  packageKey: string;
  expiresAt?: Date | null;
  adminId: Types.ObjectId | string;
  isDraftRenewal?: boolean;
}) {
  const selectedPackage = getOnlinePackageByKey(params.packageKey);

  if (!selectedPackage) {
    throw new AppError(400, "packageKey tidak valid.", null, "INVALID_PACKAGE_KEY");
  }

  const user = await User.findById(params.student.userId).exec();

  if (!user) {
    throw new AppError(
      409,
      "Student belum memiliki relasi user yang valid.",
      null,
      "STUDENT_USER_NOT_FOUND",
    );
  }

  const blockingPendingPayment = await findBlockingPendingPaymentForStudent(params.student._id);

  if (blockingPendingPayment) {
    throw new AppError(
      409,
      "Siswa masih memiliki pending payment aktif.",
      {
        paymentId: blockingPendingPayment.payment.paymentId,
        subscriptionCode: blockingPendingPayment.subscription.subscriptionCode,
      },
      "PENDING_PAYMENT_EXISTS",
    );
  }

  const renewalPreview = await resolveRenewalWindow(
    params.student._id,
    selectedPackage.durationMonth,
    new Date(),
  );

  let createdPaymentId: string | null = null;
  let createdSubscriptionId: string | null = null;
  let createdXenditPaymentSessionId: string | null = null;

  try {
    const { subscription, payment } = await createPendingSubscriptionAndPayment({
      user,
      student: params.student,
      packageDefinition: selectedPackage,
      source: "admin",
      createdByAdminId: params.adminId,
      renewalOfSubscriptionId: renewalPreview.renewalOfSubscriptionId,
      paymentStatus: params.isDraftRenewal ? "draft_renewal" : "pending",
    });
    createdPaymentId = payment._id.toString();
    createdSubscriptionId = subscription._id.toString();

    if (!params.isDraftRenewal) {
      const paymentSession = await attachXenditSessionToPayment({
        payment,
        subscription,
        student: params.student,
        user,
        expiresAt: params.expiresAt ?? null,
      });
      createdXenditPaymentSessionId = paymentSession.id;
    }

    return {
      student: params.student,
      user,
      subscription,
      payment,
      checkoutUrl: payment.checkoutUrl,
      statusPagePath: `/register-online/status?paymentId=${payment.paymentId}`,
    };
  } catch (error) {
    if (createdXenditPaymentSessionId) {
      try {
        await expireXenditInvoice(createdXenditPaymentSessionId);
      } catch (cancelError) {
        console.error("[admin-payment] cancel_xendit_session_failed", {
          paymentSessionId: createdXenditPaymentSessionId,
          message: cancelError instanceof Error ? cancelError.message : "Unknown cancel error",
        });
      }
    }

    await Promise.all([
      createdPaymentId ? Payment.deleteOne({ _id: createdPaymentId }) : Promise.resolve(),
      createdSubscriptionId
        ? Subscription.deleteOne({ _id: createdSubscriptionId })
        : Promise.resolve(),
    ]);

    throw error;
  }
}

export async function replaceAdminPaymentSessionForStudent(params: {
  currentPayment: PaymentDocument;
  currentSubscription: SubscriptionDocument;
  student: StudentDocument;
  packageKey: string;
  expiresAt?: Date | null;
  adminId: Types.ObjectId | string;
}) {
  const selectedPackage = getOnlinePackageByKey(params.packageKey);

  if (!selectedPackage) {
    throw new AppError(400, "packageKey tidak valid.", null, "INVALID_PACKAGE_KEY");
  }

  const user = await User.findById(params.student.userId).exec();

  if (!user) {
    throw new AppError(
      409,
      "Student belum memiliki relasi user yang valid.",
      null,
      "STUDENT_USER_NOT_FOUND",
    );
  }

  const renewalPreview = await resolveRenewalWindow(
    params.student._id,
    selectedPackage.durationMonth,
    new Date(),
  );
  let createdPayment: PaymentDocument | null = null;
  let createdSubscription: SubscriptionDocument | null = null;
  let createdXenditPaymentSessionId: string | null = null;

  try {
    const created = await createPendingSubscriptionAndPayment({
      user,
      student: params.student,
      packageDefinition: selectedPackage,
      source: "admin",
      createdByAdminId: params.adminId,
      renewalOfSubscriptionId: renewalPreview.renewalOfSubscriptionId,
    });
    createdPayment = created.payment;
    createdSubscription = created.subscription;

    const paymentSession = await attachXenditSessionToPayment({
      payment: created.payment,
      subscription: created.subscription,
      student: params.student,
      user,
      expiresAt: params.expiresAt ?? null,
    });
    createdXenditPaymentSessionId = paymentSession.id;

    if (params.currentPayment.xenditPaymentSessionId) {
      const canceledSession = await expireXenditInvoice(
        params.currentPayment.xenditPaymentSessionId,
      );
      applyXenditSessionSnapshot(
        params.currentPayment,
        params.currentSubscription,
        canceledSession,
      );
    }

    await expirePendingPayment({
      payment: params.currentPayment,
      subscription: params.currentSubscription,
      cancelReason: "replaced_by_new_session",
      canceledAt: new Date(),
    });

    return {
      student: params.student,
      user,
      subscription: created.subscription,
      payment: created.payment,
      checkoutUrl: created.payment.checkoutUrl,
      statusPagePath: `/register-online/status?paymentId=${created.payment.paymentId}`,
      replacedPaymentId: params.currentPayment.paymentId,
    };
  } catch (error) {
    if (createdXenditPaymentSessionId) {
      try {
        await expireXenditInvoice(createdXenditPaymentSessionId);
      } catch (cancelError) {
        console.error("[admin-payment] cancel_replacement_session_failed", {
          paymentSessionId: createdXenditPaymentSessionId,
          message:
            cancelError instanceof Error
              ? cancelError.message
              : "Unknown cancel error",
        });
      }
    }

    await Promise.all([
      createdPayment
        ? Payment.deleteOne({ _id: createdPayment._id })
        : Promise.resolve(),
      createdSubscription
        ? Subscription.deleteOne({ _id: createdSubscription._id })
        : Promise.resolve(),
    ]);

    throw error;
  }
}
