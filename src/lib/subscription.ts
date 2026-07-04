import { readPersistedAuthToken } from "@/lib/auth";
import type { ApiErrorDetails, ApiResponse } from "@/lib/auth";

export const ONLINE_PACKAGES = [
  {
    packageKey: "1-semester",
    packageName: "1 Semester",
    durationMonth: 6,
    amount: 1_850_000,
    highlight: "Paket setengah tahun untuk fokus pada satu semester ajaran.",
  },
  {
    packageKey: "2-semester",
    packageName: "2 Semester (1 Tahun)",
    durationMonth: 12,
    amount: 3_700_000,
    highlight: "Pilihan tahunan untuk progres belajar yang ingin dijaga penuh sepanjang tahun.",
  },
] as const;

const LEGACY_ONLINE_PACKAGES = [
  {
    packageKey: "12-bulan",
    packageName: "Paket 1 Tahun (2 Semester) [Legacy]",
    durationMonth: 12,
    amount: 3_700_000,
    highlight: "Paket legacy 12 bulan.",
  },
  {
    packageKey: "6-bulan",
    packageName: "6 Bulan [Legacy]",
    durationMonth: 6,
    amount: 2_000_000,
    highlight: "Paket legacy 6 bulan.",
  },
  {
    packageKey: "3-bulan",
    packageName: "3 Bulan [Legacy]",
    durationMonth: 3,
    amount: 1_100_000,
    highlight: "Paket legacy 3 bulan.",
  },
  {
    packageKey: "2-bulan",
    packageName: "2 Bulan [Legacy]",
    durationMonth: 2,
    amount: 650_000,
    highlight: "Paket legacy 2 bulan.",
  },
  {
    packageKey: "1-bulan",
    packageName: "1 Bulan [Legacy]",
    durationMonth: 1,
    amount: 350_000,
    highlight: "Paket legacy 1 bulan.",
  },
] as const;

const ALL_ONLINE_PACKAGES = [...ONLINE_PACKAGES, ...LEGACY_ONLINE_PACKAGES] as const;

export const PROGRAM_OPTIONS = [
  { value: "SD", label: "SD / Program Dasar" },
  { value: "SMP", label: "SMP / Program Reguler" },
  { value: "SMA", label: "SMA / Program Intensif" },
] as const;

export const CLASS_OPTIONS_BY_PROGRAM = {
  SD: ["Kelas 2", "Kelas 3", "Kelas 4", "Kelas 5", "Kelas 6"],
  SMP: ["Kelas 7", "Kelas 8", "Kelas 9"],
  SMA: ["Kelas 10", "Kelas 11", "Kelas 12"],
} as const;

export const CLASS_PRICING_MATRIX = {
  // SD (Kelas 2-6)
  "Kelas 2": { "1-semester": 1_800_000, "2-semester": 3_600_000 },
  "Kelas 3": { "1-semester": 1_800_000, "2-semester": 3_600_000 },
  "Kelas 4": { "1-semester": 1_850_000, "2-semester": 3_700_000 },
  "Kelas 5": { "1-semester": 1_850_000, "2-semester": 3_700_000 },
  "Kelas 6": { "1-semester": 1_900_000, "2-semester": 3_800_000 },
  
  // SMP (Kelas 7-9)
  "Kelas 7": { "1-semester": 2_000_000, "2-semester": 4_000_000 },
  "Kelas 8": { "1-semester": 2_000_000, "2-semester": 4_000_000 },
  "Kelas 9": { "1-semester": 2_050_000, "2-semester": 4_100_000 },

  // SMA (Kelas 10-12)
  "Kelas 10": { "1-semester": 2_150_000, "2-semester": 4_300_000 },
  "Kelas 11": { "1-semester": 2_150_000, "2-semester": 4_300_000 },
  "Kelas 12": { "1-semester": 2_250_000, "2-semester": 4_500_000 },
} as const;

export type AcademicPackageKey = "1-semester" | "2-semester";

export function getPriceByClassAndPackage(className: string | undefined | null, packageKey: AcademicPackageKey | string): number {
  if (!className) return 3_700_000;
  
  const lowerClass = className.toLowerCase();
  let mappedClassKey: keyof typeof CLASS_PRICING_MATRIX = "Kelas 4";

  if (lowerClass.includes("kelas 2") || lowerClass.includes("sd 2")) mappedClassKey = "Kelas 2";
  else if (lowerClass.includes("kelas 3") || lowerClass.includes("sd 3")) mappedClassKey = "Kelas 3";
  else if (lowerClass.includes("kelas 4") || lowerClass.includes("sd 4")) mappedClassKey = "Kelas 4";
  else if (lowerClass.includes("kelas 5") || lowerClass.includes("sd 5")) mappedClassKey = "Kelas 5";
  else if (lowerClass.includes("kelas 6") || lowerClass.includes("sd 6")) mappedClassKey = "Kelas 6";
  else if (lowerClass.includes("kelas 7") || lowerClass.includes("smp 7")) mappedClassKey = "Kelas 7";
  else if (lowerClass.includes("kelas 8") || lowerClass.includes("smp 8")) mappedClassKey = "Kelas 8";
  else if (lowerClass.includes("kelas 9") || lowerClass.includes("smp 9")) mappedClassKey = "Kelas 9";
  else if (lowerClass.includes("kelas 10") || lowerClass.includes("sma 10")) mappedClassKey = "Kelas 10";
  else if (lowerClass.includes("kelas 11") || lowerClass.includes("sma 11")) mappedClassKey = "Kelas 11";
  else if (lowerClass.includes("kelas 12") || lowerClass.includes("sma 12")) mappedClassKey = "Kelas 12";

  const classPricing = CLASS_PRICING_MATRIX[mappedClassKey];
  
  if (packageKey === "1-semester") return classPricing["1-semester"];
  if (packageKey === "2-semester") return classPricing["2-semester"];
  
  return classPricing["2-semester"];
}

export function getPriceByClass(className: string | undefined | null): number {
  return getPriceByClassAndPackage(className, "2-semester");
}

export type OnlinePackageKey = (typeof ONLINE_PACKAGES)[number]["packageKey"];
export type ProgramOptionValue = (typeof PROGRAM_OPTIONS)[number]["value"];
export type SubscriptionStatus = "pending" | "active" | "expired";
export type PaymentStatus = "pending" | "paid" | "failed" | "expired";
export type MembershipAccessStatus =
  | "active"
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
  packageKey: OnlinePackageKey;
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
  const storedToken = readPersistedAuthToken();

  if (storedToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${storedToken}`);
  }

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

export function findPackageByKey(packageKey: string | null | undefined) {
  const normalizedPackageKey = normalizePackageLookupValue(packageKey);

  if (!normalizedPackageKey) {
    return null;
  }

  return (
    ALL_ONLINE_PACKAGES.find(
      (item) => normalizePackageLookupValue(item.packageKey) === normalizedPackageKey,
    ) ?? null
  );
}

export function findPackageByName(packageName: string | null | undefined) {
  const normalizedPackageName = normalizePackageLookupValue(packageName);

  if (!normalizedPackageName) {
    return null;
  }

  return (
    ALL_ONLINE_PACKAGES.find(
      (item) => normalizePackageLookupValue(item.packageName) === normalizedPackageName,
    ) ?? null
  );
}

export function getPackageByKey(packageKey: string | null | undefined) {
  return findPackageByKey(packageKey) ?? ONLINE_PACKAGES[0];
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
