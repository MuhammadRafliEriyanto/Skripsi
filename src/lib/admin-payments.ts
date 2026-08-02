import {
  downloadAdminFile,
  requestAdminApi,
} from "@/lib/admin-api";
import type {
  OwnerActivityActivationStatus,
  OwnerActivityStudentActivation,
} from "@/lib/owner-activities";
import type { MembershipPayment, MembershipStudent, MembershipSubscription, PaymentStatus } from "@/lib/subscription";

export type AdminPaymentSource = "register_online" | "admin";
export type AdminPaymentArchivedFilter = "archived";
export type AdminPaymentCancelReason =
  | "admin_cancelled"
  | "replaced_by_new_session"
  | "provider_canceled";

export type AdminPaymentBranchScope = {
  role: "owner" | "admin";
  isScopedToManagedBranches: boolean;
  managedBranches: string[];
};

export type AdminPaymentListItem = {
  id: string;
  paymentId: string;
  source: AdminPaymentSource;
  packageKey: string | null;
  packageName: string;
  durationMonth: number | null;
  amount: number;
  provider: string;
  method: string;
  status: PaymentStatus;
  paidAt: string | null;
  checkoutUrl: string | null;
  expiresAt: string | null;
  checkoutLastSentAt: string | null;
  checkoutSendCount: number;
  cancelReason: AdminPaymentCancelReason | null;
  canceledAt: string | null;
  archivedAt: string | null;
  archiveReason: string | null;
  createdAt: string;
  updatedAt: string;
  displayDate: string;
  canResendLink: boolean;
  canCancel: boolean;
  anomalyReasons: string[];
  student: {
    id: string | null;
    studentId: string | null;
    userId: string | null;
    name: string;
    email: string | null;
    role: string | null;
    branch: string;
    program: string;
    className: string;
  };
  subscription: {
    id: string;
    subscriptionCode: string;
    status: MembershipSubscription["status"];
    paymentStatus: MembershipSubscription["paymentStatus"];
    startDate: string | null;
    endDate: string | null;
    source: AdminPaymentSource;
    renewalOfSubscriptionId: string | null;
  } | null;
};

export type AdminPaymentsListData = {
  scope?: AdminPaymentBranchScope;
  items: AdminPaymentListItem[];
  summary: {
    totalItems: number;
    pendingCount: number;
    paidCount: number;
    expiredCount: number;
    failedCount: number;
    totalAmount: number;
  };
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
    totalItems: number;
  };
};

export type FetchAdminPaymentsParams = {
  page?: number;
  limit?: number;
  q?: string;
  status?: PaymentStatus | AdminPaymentArchivedFilter;
  package?: string;
  packageKey?: string;
  source?: AdminPaymentSource;
  branch?: string;
  program?: string;
  className?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type AdminPaymentSummaryPoint = {
  key: string;
  label: string;
  shortLabel: string;
  totalAmount: number;
  totalCount: number;
};

export type AdminPaymentSummaryData = {
  scope?: AdminPaymentBranchScope;
  period: "week" | "month" | "year";
  range: {
    dateFrom: string;
    dateTo: string;
  };
  summary: {
    totalTransactions: number;
    pendingCount: number;
    paidCount: number;
    expiredCount: number;
    failedCount: number;
    totalAmount: number;
  };
  trend: AdminPaymentSummaryPoint[];
};

export type FetchAdminPaymentSummaryParams = Omit<
  FetchAdminPaymentsParams,
  "page" | "limit"
> & {
  period?: "week" | "month" | "year";
};

export type FetchAdminPaymentActivationsParams = {
  page?: number;
  limit?: number;
  q?: string;
  paymentStatus?: PaymentStatus;
  activationStatus?: OwnerActivityActivationStatus;
  package?: string;
  branch?: string;
  className?: string;
  level?: "SD" | "SMP" | "SMA";
};

export type AdminPaymentActivationsData = {
  scope?: AdminPaymentBranchScope;
  items: OwnerActivityStudentActivation[];
  summary: {
    totalItems: number;
    activeCount: number;
    pendingCount: number;
    expiredCount: number;
    failedCount: number;
  };
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
    totalItems: number;
  };
  studentBranchAvailable: boolean;
};

export type CreateAdminPaymentSessionPayload = {
  studentId: string;
  packageKey: string;
  expiresAt?: string;
};

export type CreateAdminOfflineRenewalPayload = {
  studentId: string;
  packageKey: string;
  paidAt?: string | null;
};

export type CreateAdminBatchPaymentSessionPayload = {
  level: "SD" | "SMP" | "SMA";
  grade?: string;
  className?: string;
  branch?: string;
  packageMode: "follow_latest_package" | "fixed_package";
  packageKey?: string | null;
  expiresAt?: string | null;
  includeInactive?: boolean;
};

export type CreateAdminPaymentSessionData = {
  student: MembershipStudent;
  subscription: MembershipSubscription;
  payment: MembershipPayment;
  statusPagePath: string;
};

export type CreateAdminOfflineRenewalData = {
  student: MembershipStudent;
  subscription: MembershipSubscription;
  payment: MembershipPayment;
};

export type ResendAdminPaymentLinkData = {
  paymentId: string;
  checkoutUrl: string | null;
  expiresAt: string | null;
  checkoutSendCount: number;
  checkoutLastSentAt: string | null;
};

export type CancelAdminPaymentData = {
  paymentId: string;
  status: PaymentStatus;
  cancelReason: AdminPaymentCancelReason | null;
  canceledAt: string | null;
  subscriptionCode: string;
  subscriptionStatus: MembershipSubscription["status"];
  subscriptionPaymentStatus: MembershipSubscription["paymentStatus"];
};

export type UpdateAdminPaymentStatusPayload = {
  status: Extract<PaymentStatus, "paid">;
  paidAt?: string;
};

export type UpdateAdminPaymentStatusData = {
  paymentId: string;
  status: PaymentStatus;
  paidAt: string | null;
  subscriptionCode: string;
  subscriptionStatus: MembershipSubscription["status"];
  subscriptionPaymentStatus: MembershipSubscription["paymentStatus"];
};

export type ReplaceAdminPaymentPayload = {
  packageKey: string;
  expiresAt?: string;
};

export type ReplaceAdminPaymentData = {
  replacedPaymentId: string;
  student: MembershipStudent;
  subscription: MembershipSubscription;
  payment: MembershipPayment;
  statusPagePath: string;
};

export type ArchiveAdminPaymentData = {
  paymentId: string;
  archivedAt: string;
  archiveReason: string;
};

export type RestoreAdminPaymentData = {
  paymentId: string;
  status: PaymentStatus;
  archivedAt: string | null;
  archiveReason: string | null;
};

export type AdminBatchPaymentReasonCode =
  | "NO_PREVIOUS_PACKAGE"
  | "INVALID_PREVIOUS_PACKAGE"
  | "STUDENT_USER_NOT_FOUND"
  | "STUDENT_INACTIVE"
  | "BLOCKING_PENDING_PAYMENT"
  | "XENDIT_SESSION_FAILED"
  | "UNKNOWN_ERROR";

export type AdminBatchResolvedPackage = {
  packageKey: string;
  packageName: string;
  durationMonth: number;
  source: "fixed_package" | "latest_subscription";
  sourceSubscriptionCode?: string | null;
};

export type CreateAdminBatchPaymentSessionItem = {
  studentId: string;
  studentName: string;
  email: string | null;
  className: string;
  canonicalClassName: string;
  studentStatus: "Aktif" | "Nonaktif";
  status: "created" | "skipped" | "failed";
  reasonCode?: AdminBatchPaymentReasonCode;
  message: string;
  resolvedPackage?: AdminBatchResolvedPackage;
  paymentId?: string;
  subscriptionCode?: string;
  checkoutUrl?: string | null;
  statusPagePath?: string | null;
  blockingPaymentId?: string;
  blockingSubscriptionCode?: string;
};

export type CreateAdminBatchPaymentSessionData = {
  filters: {
    level: "SD" | "SMP" | "SMA";
    grade: string;
    className: string;
    branch: string | null;
    packageMode: "follow_latest_package" | "fixed_package";
    packageKey: string | null;
    expiresAt: string | null;
    includeInactive: boolean;
  };
  summary: {
    totalTargetStudents: number;
    createdCount: number;
    skippedCount: number;
    failedCount: number;
    reasonCounts: Partial<Record<AdminBatchPaymentReasonCode, number>>;
  };
  items: CreateAdminBatchPaymentSessionItem[];
};

export async function fetchAdminPayments(params: FetchAdminPaymentsParams = {}) {
  const queryParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    queryParams.set(key, String(value));
  }

  const queryString = queryParams.toString();
  const endpoint = queryString ? `/api/payments/admin?${queryString}` : "/api/payments/admin";
  const payload = await requestAdminApi<AdminPaymentsListData>(endpoint, {
    method: "GET",
  });

  return payload.data as AdminPaymentsListData;
}

export async function fetchAdminPaymentSummary(
  params: FetchAdminPaymentSummaryParams = {},
) {
  const queryParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    queryParams.set(key, String(value));
  }

  const queryString = queryParams.toString();
  const endpoint = queryString
    ? `/api/payments/admin/summary?${queryString}`
    : "/api/payments/admin/summary";
  const payload = await requestAdminApi<AdminPaymentSummaryData>(endpoint, {
    method: "GET",
  });

  return payload.data as AdminPaymentSummaryData;
}

export async function fetchAdminPaymentActivations(
  params: FetchAdminPaymentActivationsParams = {},
) {
  const queryParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    queryParams.set(key, String(value));
  }

  const queryString = queryParams.toString();
  const endpoint = queryString
    ? `/api/payments/admin/activations?${queryString}`
    : "/api/payments/admin/activations";
  const payload = await requestAdminApi<AdminPaymentActivationsData>(endpoint, {
    method: "GET",
  });

  return payload.data as AdminPaymentActivationsData;
}

export function exportAdminPaymentsCsv(
  params: Omit<FetchAdminPaymentsParams, "page" | "limit"> = {},
) {
  const queryParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    queryParams.set(key, String(value));
  }

  const queryString = queryParams.toString();
  const endpoint = queryString
    ? `/api/payments/admin/export?${queryString}`
    : "/api/payments/admin/export";

  return downloadAdminFile(endpoint, {
    method: "GET",
  });
}

export function exportAdminPaymentActivationsCsv(
  params: Omit<FetchAdminPaymentActivationsParams, "page" | "limit"> = {},
) {
  const queryParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    queryParams.set(key, String(value));
  }

  const queryString = queryParams.toString();
  const endpoint = queryString
    ? `/api/payments/admin/activations/export?${queryString}`
    : "/api/payments/admin/activations/export";

  return downloadAdminFile(endpoint, {
    method: "GET",
  });
}

export async function createAdminPaymentSession(
  payload: CreateAdminPaymentSessionPayload,
) {
  const response = await requestAdminApi<CreateAdminPaymentSessionData>(
    "/api/payments/admin/create-session",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );

  return response.data as CreateAdminPaymentSessionData;
}

export async function createAdminOfflineRenewal(
  payload: CreateAdminOfflineRenewalPayload,
) {
  const response = await requestAdminApi<CreateAdminOfflineRenewalData>(
    "/api/payments/admin/create-offline-renewal",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );

  return response.data as CreateAdminOfflineRenewalData;
}

export async function createAdminBatchPaymentSession(
  payload: CreateAdminBatchPaymentSessionPayload,
) {
  const response = await requestAdminApi<CreateAdminBatchPaymentSessionData>(
    "/api/payments/admin/create-batch-session",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );

  return response.data as CreateAdminBatchPaymentSessionData;
}

export async function resendAdminPaymentLink(paymentId: string) {
  const response = await requestAdminApi<ResendAdminPaymentLinkData>(
    `/api/payments/admin/${encodeURIComponent(paymentId)}/resend-link`,
    {
      method: "POST",
    },
  );

  return response.data as ResendAdminPaymentLinkData;
}

export async function cancelAdminPayment(paymentId: string) {
  const response = await requestAdminApi<CancelAdminPaymentData>(
    `/api/payments/admin/${encodeURIComponent(paymentId)}/cancel`,
    {
      method: "POST",
    },
  );

  return response.data as CancelAdminPaymentData;
}

export async function updateAdminPaymentStatus(
  paymentId: string,
  payload: UpdateAdminPaymentStatusPayload,
) {
  const response = await requestAdminApi<UpdateAdminPaymentStatusData>(
    `/api/payments/admin/${encodeURIComponent(paymentId)}/status`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );

  return response.data as UpdateAdminPaymentStatusData;
}

export async function replaceAdminPayment(
  paymentId: string,
  payload: ReplaceAdminPaymentPayload,
) {
  const response = await requestAdminApi<ReplaceAdminPaymentData>(
    `/api/payments/admin/${encodeURIComponent(paymentId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );

  return response.data as ReplaceAdminPaymentData;
}

export async function archiveAdminPayment(paymentId: string, reason?: string) {
  const response = await requestAdminApi<ArchiveAdminPaymentData>(
    `/api/payments/admin/${encodeURIComponent(paymentId)}`,
    {
      method: "DELETE",
      body: JSON.stringify({ reason }),
    },
  );

  return response.data as ArchiveAdminPaymentData;
}

export async function restoreAdminPayment(paymentId: string) {
  const response = await requestAdminApi<RestoreAdminPaymentData>(
    `/api/payments/admin/${encodeURIComponent(paymentId)}/restore`,
    {
      method: "POST",
    },
  );

  return response.data as RestoreAdminPaymentData;
}
