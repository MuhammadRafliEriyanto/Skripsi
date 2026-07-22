import { validateEnv } from "../config/env";
import type { SubscriptionDocument } from "../models/Subscription";
import type { UserDocument } from "../models/User";
import { sendMembershipExpiryReminderEmail } from "./email";
import { resolveSubscriptionStatusByDates } from "./subscription";

export const MEMBERSHIP_EXPIRY_EMAIL_REMINDER_DAYS = 1;

const DAY_IN_MILLISECONDS = 1000 * 60 * 60 * 24;
const UNDELIVERABLE_EMAIL_DOMAINS = new Set([
  "bimbel.local",
  "example.com",
  "example.net",
  "example.org",
  "test.com",
  "invalid.com",
]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type MembershipExpiryReminderStage = "day-1";

type MembershipExpiryReminderSkipReason =
  | "outside_window"
  | "email_not_deliverable"
  | "email_not_configured"
  | "already_sent";

type MembershipExpiryReminderResult =
  | {
      sent: true;
      reminderKey: string;
      email: string;
      daysRemaining: number;
    }
  | {
      sent: false;
      reason: MembershipExpiryReminderSkipReason;
      reminderKey?: string;
      email?: string;
      daysRemaining?: number;
    };

export type MembershipExpiryReminderInfo = {
  stage: MembershipExpiryReminderStage;
  reminderKey: string;
  daysRemaining: number;
  endDate: Date;
};

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function getEmailDomain(email: string) {
  return email.split("@")[1]?.trim().toLowerCase() ?? "";
}

function buildStudentBillingUrl() {
  const { clientUrl } = validateEnv();

  return `${clientUrl.replace(/\/+$/, "")}/dashboard-siswa/tagihan`;
}

function getSentReminderKeys(subscription: SubscriptionDocument) {
  return Array.isArray(subscription.membershipReminderEmailSentKeys)
    ? subscription.membershipReminderEmailSentKeys
    : [];
}

export function isDeliverableMembershipEmail(value: string | null | undefined) {
  const email = normalizeEmail(value);

  if (!email || !EMAIL_PATTERN.test(email)) {
    return false;
  }

  const domain = getEmailDomain(email);

  if (
    !domain ||
    domain === "localhost" ||
    domain.endsWith(".local") ||
    UNDELIVERABLE_EMAIL_DOMAINS.has(domain)
  ) {
    return false;
  }

  return true;
}

export function getMembershipExpiryReminderInfo(
  subscription: SubscriptionDocument | null,
  now = new Date(),
): MembershipExpiryReminderInfo | null {
  if (!subscription?.endDate || subscription.paymentStatus !== "paid") {
    return null;
  }

  const accessStatus = resolveSubscriptionStatusByDates(
    subscription.startDate,
    subscription.endDate,
    now,
  );

  if (accessStatus !== "expiring") {
    return null;
  }

  const daysRemaining = Math.max(
    0,
    Math.ceil((subscription.endDate.getTime() - now.getTime()) / DAY_IN_MILLISECONDS),
  );

  if (daysRemaining > MEMBERSHIP_EXPIRY_EMAIL_REMINDER_DAYS) {
    return null;
  }

  return {
    stage: "day-1",
    reminderKey: `${subscription.subscriptionCode}:day-1`,
    daysRemaining,
    endDate: subscription.endDate,
  };
}

export async function sendMembershipExpiryReminderIfNeeded(params: {
  subscription: SubscriptionDocument | null;
  user: Pick<UserDocument, "nama" | "email"> | null;
  now?: Date;
  renewalUrl?: string;
}): Promise<MembershipExpiryReminderResult> {
  const reminderInfo = getMembershipExpiryReminderInfo(
    params.subscription,
    params.now,
  );

  if (!reminderInfo || !params.subscription) {
    return { sent: false, reason: "outside_window" };
  }

  const email = normalizeEmail(params.user?.email);

  if (!isDeliverableMembershipEmail(email)) {
    return {
      sent: false,
      reason: "email_not_deliverable",
      reminderKey: reminderInfo.reminderKey,
      email,
      daysRemaining: reminderInfo.daysRemaining,
    };
  }

  const sentKeys = getSentReminderKeys(params.subscription);

  if (sentKeys.includes(reminderInfo.reminderKey)) {
    return {
      sent: false,
      reason: "already_sent",
      reminderKey: reminderInfo.reminderKey,
      email,
      daysRemaining: reminderInfo.daysRemaining,
    };
  }

  const { isEmailConfigured } = validateEnv();

  if (!isEmailConfigured) {
    return {
      sent: false,
      reason: "email_not_configured",
      reminderKey: reminderInfo.reminderKey,
      email,
      daysRemaining: reminderInfo.daysRemaining,
    };
  }

  await sendMembershipExpiryReminderEmail({
    nama: params.user?.nama ?? "Siswa",
    email,
    packageName: params.subscription.packageName,
    endDate: reminderInfo.endDate,
    daysRemaining: reminderInfo.daysRemaining,
    renewalUrl: params.renewalUrl ?? buildStudentBillingUrl(),
  });

  params.subscription.membershipReminderEmailSentKeys = Array.from(
    new Set([...sentKeys, reminderInfo.reminderKey]),
  );
  params.subscription.membershipReminderEmailLastSentAt = params.now ?? new Date();
  await params.subscription.save();

  return {
    sent: true,
    reminderKey: reminderInfo.reminderKey,
    email,
    daysRemaining: reminderInfo.daysRemaining,
  };
}
