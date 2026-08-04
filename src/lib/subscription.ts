import type { ApiErrorDetails, ApiResponse } from "@/lib/auth";

export type OnlinePackageKey = string;
export type ProgramOptionValue = string;
export type AcademicPackageKey = string;

export type OnlinePackageDefinition = {
  packageKey: OnlinePackageKey;
  packageName: string;
  durationMonth: number;
  amount: number;
  highlight: string;
};

export type ProgramOption = {
  value: ProgramOptionValue;
  label: string;
};

export type ClassPricingMatrix = Record<string, Record<string, number>>;

export const UTBK_PROGRAM_VALUE = "UTBK";
export const UTBK_PRICING_CLASS_NAME = "SMA 12";

export type SubscriptionConfigData = {
  packages: OnlinePackageDefinition[];
  programs: ProgramOption[];
  classOptionsByProgram: Record<ProgramOptionValue, string[]>;
  classPricingMatrix: ClassPricingMatrix;
};

export const emptySubscriptionConfig: SubscriptionConfigData = {
  packages: [],
  programs: [],
  classOptionsByProgram: {},
  classPricingMatrix: {},
};

function normalizeClassPricingKey(className: string | undefined | null) {
  const normalizedValue = className?.trim().replace(/\s+/g, " ").toUpperCase() ?? "";
  const grade = normalizedValue.match(/\b(1[0-2]|[2-9])\b/)?.[1];

  if (!grade) {
    return null;
  }

  if (normalizedValue.includes("SD") || Number(grade) <= 6) {
    return `SD ${grade}`;
  }

  if (normalizedValue.includes("SMP") || Number(grade) <= 9) {
    return `SMP ${grade}`;
  }

  return `SMA ${grade}`;
}

export function resolveProgramPricingClassName(
  program: string | undefined | null,
  className: string | undefined | null,
) {
  return program?.trim().toUpperCase() === UTBK_PROGRAM_VALUE
    ? UTBK_PRICING_CLASS_NAME
    : className;
}

export function getPriceByClassAndPackage(
  className: string | undefined | null,
  packageKey: AcademicPackageKey | string,
  classPricingMatrix: ClassPricingMatrix = emptySubscriptionConfig.classPricingMatrix,
  packages: OnlinePackageDefinition[] = emptySubscriptionConfig.packages,
): number {
  const normalizedClassName = normalizeClassPricingKey(className);
  const packageAmount = packages.find((item) => item.packageKey === packageKey)?.amount;

  if (!normalizedClassName) {
    return packageAmount ?? 0;
  }

  return classPricingMatrix[normalizedClassName]?.[packageKey] ?? packageAmount ?? 0;
}

export function getPriceByClass(
  className: string | undefined | null,
  classPricingMatrix: ClassPricingMatrix = emptySubscriptionConfig.classPricingMatrix,
  packages: OnlinePackageDefinition[] = emptySubscriptionConfig.packages,
): number {
  return getPriceByClassAndPackage(className, "2-semester", classPricingMatrix, packages);
}
export type SubscriptionStatus = "pending" | "active" | "expiring" | "expired";
export type PaymentStatus = "pending" | "paid" | "failed" | "expired" | "draft_renewal";
export type MembershipAccessStatus =
  | "active"
  | "expiring"
  | "pending"
  | "expired"
  | "not_registered";

export type RegisterOnlinePayload = {
  nama: string;
  email: string;
  phone: string;
  branch: string;
  program: ProgramOptionValue;
  classLevel: string;
  utbkTrack?: string;
  targetKampus?: string;
  targetJurusan?: string;
  packageKey: OnlinePackageKey;
  gender: "Laki-laki" | "Perempuan" | "";
  address: string;
  schoolOrigin: string;
  difficultSubjects?: string;
};

export type RegisterBranchOption = {
  id: string;
  name: string;
  shortAddress: string;
  fullAddress: string;
};

export type MembershipStudent = {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  branch: string;
  program: string;
  className: string;
  utbkTrack?: string;
  targetKampus?: string;
  targetJurusan?: string;
  gender?: "Laki-laki" | "Perempuan" | null;
  address?: string;
  schoolOrigin?: string;
  difficultSubjects?: string;
  status: string;
  isEmailVerified: boolean;
};

export type MembershipSubscription = {
  id: string;
  subscriptionCode: string;
  userId: string;
  studentId: string;
  packageKey: string;
  packageName: string;
  durationMonth: number;
  startDate: string | null;
  endDate: string | null;
  status: SubscriptionStatus;
  paymentStatus: PaymentStatus;
  targetProgram?: string | null;
  targetClassName?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MembershipPayment = {
  id: string;
  paymentId: string;
  userId: string;
  studentId: string;
  subscriptionId: string;
  packageKey?: string | null;
  packageName: string;
  durationMonth?: number | null;
  amount: number;
  provider?: string;
  method: string;
  status: PaymentStatus;
  paidAt: string | null;
  checkoutUrl?: string | null;
  expiresAt?: string | null;
  xenditPaymentSessionId?: string | null;
  xenditPaymentRequestId?: string | null;
  xenditPaymentId?: string | null;
  xenditCustomerId?: string | null;
  xenditSessionStatus?: string | null;
  xenditWebhookReceivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MembershipPaymentHistoryItem = {
  paymentId: string;
  packageName: string;
  amount: number;
  status: PaymentStatus;
  provider: string;
  method: string;
  checkoutUrl: string | null;
  paidAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  subscriptionCode: string | null;
};

export type RegisterOnlineData = {
  user: {
    _id: string;
    nama: string;
    email: string;
    loginCode?: string | null;
    role: string;
    isEmailVerified: boolean;
  };
  student: MembershipStudent;
  subscription: MembershipSubscription;
  payment: MembershipPayment;
  verificationEmailSent: boolean;
  statusPagePath: string;
};

export type MembershipStatusData = {
  user: {
    _id: string;
    nama: string;
    email: string;
    role: string;
    isEmailVerified: boolean;
  };
  student: MembershipStudent | null;
  subscription: MembershipSubscription | null;
  payment: MembershipPayment | null;
  accessStatus: MembershipAccessStatus;
  hasActiveSubscription: boolean;
  daysRemaining: number | null;
};

export type MembershipPaymentHistoryData = {
  payments: MembershipPaymentHistoryItem[];
};

export type MembershipRenewalPayload = {
  program?: ProgramOptionValue;
  classLevel?: string;
  packageKey: OnlinePackageKey;
};

export type MembershipRenewalData = {
  student: MembershipStudent;
  subscription: MembershipSubscription;
  payment: MembershipPayment;
  statusPagePath: string;
};

export type PaymentStatusData = {
  student: MembershipStudent;
  subscription: MembershipSubscription;
  payment: MembershipPayment;
  accessStatus: MembershipAccessStatus;
};

export type RegisterOnlineResponse = ApiResponse<RegisterOnlineData>;
export type MembershipStatusResponse = ApiResponse<MembershipStatusData>;
export type MembershipPaymentHistoryResponse = ApiResponse<MembershipPaymentHistoryData>;
export type MembershipRenewalResponse = ApiResponse<MembershipRenewalData>;
export type PaymentStatusResponse = ApiResponse<PaymentStatusData>;
export type RegisterBranchOptionsResponse = ApiResponse<{
  branches: RegisterBranchOption[];
}>;

export class MembershipRequestError extends Error {
  status: number;
  errorCode?: string;
  errors?: ApiErrorDetails;

  constructor(message: string, status: number, errors?: ApiErrorDetails, errorCode?: string) {
    super(message);
    this.name = "MembershipRequestError";
    this.status = status;
    this.errors = errors;
    this.errorCode = errorCode;
  }
}

async function requestMembershipJson<T extends Record<string, unknown>>(
  url: string,
  init: RequestInit,
): Promise<ApiResponse<T>> {
  const headers = new Headers(init.headers);

  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok || !payload?.success) {
    throw new MembershipRequestError(
      payload?.message || "Terjadi kesalahan saat memproses membership.",
      response.status,
      payload?.errors,
      payload?.errorCode,
    );
  }

  return payload;
}

function normalizePackageLookupValue(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export function findPackageByKey(
  packageKey: string | null | undefined,
  packages: OnlinePackageDefinition[] = emptySubscriptionConfig.packages,
) {
  const normalizedPackageKey = normalizePackageLookupValue(packageKey);

  if (!normalizedPackageKey) {
    return null;
  }

  return (
    packages.find(
      (item) => normalizePackageLookupValue(item.packageKey) === normalizedPackageKey,
    ) ?? null
  );
}

export function findPackageByName(
  packageName: string | null | undefined,
  packages: OnlinePackageDefinition[] = emptySubscriptionConfig.packages,
) {
  const normalizedPackageName = normalizePackageLookupValue(packageName);

  if (!normalizedPackageName) {
    return null;
  }

  return (
    packages.find(
      (item) => normalizePackageLookupValue(item.packageName) === normalizedPackageName,
    ) ?? null
  );
}

export function getPackageByKey(
  packageKey: string | null | undefined,
  packages: OnlinePackageDefinition[] = emptySubscriptionConfig.packages,
) {
  return findPackageByKey(packageKey, packages) ?? packages[0] ?? null;
}

export function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDateLabel(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

export const membershipService = {
  getSubscriptionConfig() {
    return requestMembershipJson<SubscriptionConfigData>("/api/subscriptions/config", {
      method: "GET",
    });
  },
  register(payload: RegisterOnlinePayload) {
    return requestMembershipJson<RegisterOnlineData>("/api/register-online", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  getPaymentStatus(paymentId: string) {
    const params = new URLSearchParams({ paymentId });

    return requestMembershipJson<PaymentStatusData>(
      `/api/register-online/payment?${params.toString()}`,
      {
        method: "GET",
      },
    );
  },
  confirmPayment(paymentId: string) {
    return requestMembershipJson<PaymentStatusData>(
      "/api/register-online/payment/confirm",
      {
        method: "POST",
        body: JSON.stringify({
          paymentId,
          method: "manual_confirmation",
        }),
      },
    );
  },
  getMySubscription() {
    return requestMembershipJson<MembershipStatusData>("/api/subscriptions/me", {
      method: "GET",
    });
  },
  getMyPaymentHistory() {
    return requestMembershipJson<MembershipPaymentHistoryData>(
      "/api/subscriptions/me/payments",
      {
        method: "GET",
      },
    );
  },
  createMyRenewalPayment(payload: MembershipRenewalPayload) {
    return requestMembershipJson<MembershipRenewalData>(
      "/api/subscriptions/me/renewal",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },
  getRegisterBranchOptions() {
    return requestMembershipJson<{
      branches: RegisterBranchOption[];
    }>("/api/branches/public-options", {
      method: "GET",
    });
  },
};
