import type { Request, Response } from "express";

import { Branch } from "../models/Branch";
import { Expense } from "../models/Expense";
import { Payment, type PaymentDocument } from "../models/Payment";
import { Subscription, type SubscriptionDocument } from "../models/Subscription";
import asyncHandler from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import {
  refreshSubscriptionLifecycle,
  resolveMembershipAccessStatus,
} from "../utils/subscription";

type OwnerNotificationSeverity = "info" | "warning" | "danger";
type OwnerNotificationKey =
  | "membership_payments_pending"
  | "membership_payments_failed_or_expired"
  | "student_activations_inactive"
  | "expenses_pending"
  | "expenses_scheduled"
  | "branches_attention";

type OwnerNotificationSummaryItem = {
  key: OwnerNotificationKey;
  title: string;
  message: string;
  count: number;
  severity: OwnerNotificationSeverity;
};

function formatItemCount(count: number, singularLabel: string, pluralLabel: string) {
  return `${count} ${count === 1 ? singularLabel : pluralLabel}`;
}

function toDocumentIdString(value: { toString: () => string } | string | null | undefined) {
  if (!value) {
    return "";
  }

  return typeof value === "string" ? value : value.toString();
}

function getLatestPaymentBySubscriptionId(payments: PaymentDocument[]) {
  const latestPaymentBySubscriptionId = new Map<string, PaymentDocument>();

  for (const payment of payments) {
    const subscriptionId = toDocumentIdString(payment.subscriptionId);

    if (!subscriptionId || latestPaymentBySubscriptionId.has(subscriptionId)) {
      continue;
    }

    latestPaymentBySubscriptionId.set(subscriptionId, payment);
  }

  return latestPaymentBySubscriptionId;
}

async function getLatestSubscriptions() {
  const subscriptions = await Subscription.find().sort({ createdAt: -1, _id: -1 }).exec();
  const latestSubscriptionByStudentId = new Map<string, SubscriptionDocument>();

  for (const subscription of subscriptions) {
    const studentId = toDocumentIdString(subscription.studentId);

    if (!studentId || latestSubscriptionByStudentId.has(studentId)) {
      continue;
    }

    latestSubscriptionByStudentId.set(studentId, subscription);
  }

  const refreshedSubscriptions = await Promise.all(
    [...latestSubscriptionByStudentId.values()].map((subscription) =>
      refreshSubscriptionLifecycle(subscription),
    ),
  );

  return refreshedSubscriptions.filter(
    (subscription): subscription is SubscriptionDocument => subscription !== null,
  );
}

export const getOwnerNotificationSummary = asyncHandler(
  async (_req: Request, res: Response) => {
    const [payments, latestSubscriptions, expenses, branches] = await Promise.all([
      Payment.find({ archivedAt: null }).sort({ createdAt: -1, _id: -1 }).exec(),
      getLatestSubscriptions(),
      Expense.find({ archivedAt: null }).sort({ createdAt: -1, _id: -1 }).exec(),
      Branch.find().sort({ createdAt: -1, _id: -1 }).exec(),
    ]);

    const latestPaymentBySubscriptionId = getLatestPaymentBySubscriptionId(payments);
    const latestPayments = [...latestPaymentBySubscriptionId.values()];

    const pendingMembershipPaymentsCount = latestPayments.filter(
      (payment) => payment.status === "pending",
    ).length;
    const failedOrExpiredPaymentsCount = latestPayments.filter(
      (payment) => payment.status === "failed" || payment.status === "expired",
    ).length;

    const inactiveActivationsCount = latestSubscriptions.filter((subscription) => {
      const payment = latestPaymentBySubscriptionId.get(subscription._id.toString()) ?? null;
      const paymentStatus = payment?.status ?? subscription.paymentStatus;

      if (paymentStatus === "failed" || subscription.paymentStatus === "failed") {
        return true;
      }

      const accessStatus = resolveMembershipAccessStatus(subscription);

      return accessStatus !== "active" && accessStatus !== "expiring";
    }).length;

    const pendingExpensesCount = expenses.filter(
      (expense) => expense.status === "Menunggu",
    ).length;
    const scheduledExpensesCount = expenses.filter(
      (expense) => expense.status === "Dijadwalkan",
    ).length;
    const inactiveBranchCount = branches.filter(
      (branch) => branch.status === "Nonaktif",
    ).length;
    const attentionBranchCount = inactiveBranchCount;

    const items: OwnerNotificationSummaryItem[] = [];

    if (pendingMembershipPaymentsCount > 0) {
      items.push({
        key: "membership_payments_pending",
        title: "Pembayaran membership pending",
        message: `${formatItemCount(
          pendingMembershipPaymentsCount,
          "pembayaran membership masih menunggu penyelesaian",
          "pembayaran membership masih menunggu penyelesaian",
        )}.`,
        count: pendingMembershipPaymentsCount,
        severity: "warning",
      });
    }

    if (failedOrExpiredPaymentsCount > 0) {
      items.push({
        key: "membership_payments_failed_or_expired",
        title: "Pembayaran gagal / expired",
        message: `${formatItemCount(
          failedOrExpiredPaymentsCount,
          "pembayaran membership gagal atau kedaluwarsa",
          "pembayaran membership gagal atau kedaluwarsa",
        )}.`,
        count: failedOrExpiredPaymentsCount,
        severity: "danger",
      });
    }

    if (inactiveActivationsCount > 0) {
      items.push({
        key: "student_activations_inactive",
        title: "Aktivasi siswa belum aktif",
        message: `${formatItemCount(
          inactiveActivationsCount,
          "aktivasi siswa belum aktif",
          "aktivasi siswa belum aktif",
        )} dan masih perlu tindak lanjut.`,
        count: inactiveActivationsCount,
        severity: "warning",
      });
    }

    if (pendingExpensesCount > 0) {
      items.push({
        key: "expenses_pending",
        title: "Pengeluaran menunggu",
        message: `${formatItemCount(
          pendingExpensesCount,
          "pengeluaran operasional masih menunggu diproses",
          "pengeluaran operasional masih menunggu diproses",
        )}.`,
        count: pendingExpensesCount,
        severity: "warning",
      });
    }

    if (scheduledExpensesCount > 0) {
      items.push({
        key: "expenses_scheduled",
        title: "Pengeluaran dijadwalkan",
        message: `${formatItemCount(
          scheduledExpensesCount,
          "pengeluaran operasional sudah dijadwalkan",
          "pengeluaran operasional sudah dijadwalkan",
        )} untuk dibayar.`,
        count: scheduledExpensesCount,
        severity: "info",
      });
    }

    if (attentionBranchCount > 0) {
      items.push({
        key: "branches_attention",
        title: "Status cabang perlu perhatian",
        message: `${formatItemCount(
          attentionBranchCount,
          "cabang berstatus Nonaktif",
          "cabang berstatus Nonaktif",
        )}.`,
        count: attentionBranchCount,
        severity: "danger",
      });
    }

    const total = items.reduce((currentTotal, item) => currentTotal + item.count, 0);

    sendSuccess(res, {
      message: "Ringkasan notifikasi owner berhasil diambil.",
      data: {
        summary: {
          total,
          hasUnreadLikeItems: items.length > 0,
        },
        items,
        generatedAt: new Date().toISOString(),
      },
    });
  },
);
