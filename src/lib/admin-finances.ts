import { requestAdminApi } from "@/lib/admin-api";

export const adminBranchIncomeStatusOptions = [
  "Menunggu",
  "Diterima",
  "Dibatalkan",
] as const;

export const adminExpenseCategoryOptions = [
  "Listrik",
  "Internet",
  "Sewa Gedung",
  "Perawatan Fasilitas",
  "Perlengkapan Kelas",
  "Kebersihan",
  "Keamanan",
  "Teknologi",
  "Transportasi Operasional",
  "Lainnya",
] as const;

export const adminExpenseStatusOptions = [
  "Menunggu",
  "Dijadwalkan",
  "Selesai",
  "Dibatalkan",
] as const;

export const adminFinanceTransactionKindOptions = [
  "membership_income",
  "manual_income",
  "expense",
] as const;

export type AdminBranchIncomeStatus =
  (typeof adminBranchIncomeStatusOptions)[number];
export type AdminUiExpenseCategory = (typeof adminExpenseCategoryOptions)[number];
export type AdminExpenseCategory = AdminUiExpenseCategory;
export type AdminExpenseStatus = (typeof adminExpenseStatusOptions)[number];
export type AdminFinanceTransactionKind =
  (typeof adminFinanceTransactionKindOptions)[number];

export const adminExpenseFormStatusOptions = [
  "Menunggu",
  "Selesai",
  "Dibatalkan",
] as const satisfies readonly AdminExpenseStatus[];

export function normalizeAdminExpenseFormCategory(
  value: string | null | undefined,
): AdminUiExpenseCategory {
  return adminExpenseCategoryOptions.includes(value as AdminUiExpenseCategory)
    ? (value as AdminUiExpenseCategory)
    : "Lainnya";
}

export function normalizeAdminExpenseFormStatus(
  value: AdminExpenseStatus,
): AdminExpenseStatus {
  return value === "Dijadwalkan" ? "Menunggu" : value;
}

export function getAdminExpenseStatusLabel(status: string) {
  switch (status) {
    case "Menunggu":
    case "Dijadwalkan":
      return "Belum Dibayar";
    case "Selesai":
      return "Sudah Dibayar";
    case "Dibatalkan":
      return "Dibatalkan";
    default:
      return status;
  }
}

export type AdminFinanceScope = {
  role: "owner" | "admin";
  isScopedToManagedBranches: boolean;
  managedBranches: string[];
};

export type AdminBranchIncome = {
  id: string;
  incomeId: string;
  title: string;
  branch: string;
  category: string;
  payerOrSource: string;
  amount: number;
  paymentMethod: string;
  status: AdminBranchIncomeStatus;
  receivedAt: string | null;
  note: string;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminBranchIncomeMutationPayload = {
  title: string;
  branch?: string;
  category: string;
  payerOrSource: string;
  amount: number;
  paymentMethod: string;
  status: AdminBranchIncomeStatus;
  receivedAt?: string | null;
  note?: string | null;
};

export type AdminExpense = {
  id: string;
  expenseId: string;
  title: string;
  branch: string;
  category: AdminExpenseCategory;
  vendorOrRecipient: string;
  amount: number;
  paymentMethod: string;
  status: AdminExpenseStatus;
  paidAt: string | null;
  dueDate: string | null;
  note: string;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminExpenseMutationPayload = {
  title: string;
  branch?: string;
  category: AdminExpenseCategory;
  vendorOrRecipient: string;
  amount: number;
  paymentMethod: string;
  status: AdminExpenseStatus;
  paidAt?: string | null;
  dueDate?: string | null;
  note?: string | null;
};

export type AdminFinanceSummaryBranchItem = {
  branch: string;
  transactionCount: number;
  membership: {
    paidAmount: number;
    paidCount: number;
    pendingAmount: number;
    pendingCount: number;
    failedOrExpiredCount: number;
  };
  manualIncome: {
    receivedAmount: number;
    receivedCount: number;
    pendingAmount: number;
    pendingCount: number;
    canceledCount: number;
  };
  expense: {
    settledAmount: number;
    settledCount: number;
    pendingAmount: number;
    pendingCount: number;
    canceledCount: number;
  };
  totalRealizedIncome: number;
  totalRealizedExpense: number;
  netCashflow: number;
};

export type AdminFinanceSummaryCategoryItem = {
  category: string;
  receivedAmount?: number;
  receivedCount?: number;
  pendingAmount: number;
  pendingCount: number;
  settledAmount?: number;
  settledCount?: number;
};

export type AdminFinanceSummaryData = {
  scope: AdminFinanceScope;
  filters: {
    branch: string | null;
    dateFrom: string | null;
    dateTo: string | null;
  };
  summary: AdminFinanceSummaryBranchItem;
  branches: AdminFinanceSummaryBranchItem[];
  categories: {
    manualIncome: AdminFinanceSummaryCategoryItem[];
    expense: AdminFinanceSummaryCategoryItem[];
  };
};

export type AdminFinanceTransaction = {
  id: string;
  kind: AdminFinanceTransactionKind;
  direction: "in" | "out";
  referenceId: string;
  title: string;
  branch: string;
  category: string;
  amount: number;
  status: string;
  paymentMethod: string;
  source: string;
  sourceLabel: string;
  isReadOnly: boolean;
  canEdit: boolean;
  canDelete: boolean;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
  note: string;
  actorName: string;
  actorEmail: string | null;
  studentId: string | null;
  program: string | null;
  className: string | null;
};

export type AdminFinanceTransactionsData = {
  scope: AdminFinanceScope;
  filters: {
    branch: string | null;
    kind: string | null;
    category: string | null;
    status: string | null;
    q: string | null;
    dateFrom: string | null;
    dateTo: string | null;
  };
  transactions: AdminFinanceTransaction[];
};

export type FetchAdminBranchIncomesParams = {
  q?: string;
  branch?: string;
  category?: string;
  status?: AdminBranchIncomeStatus;
  dateFrom?: string;
  dateTo?: string;
};

export type FetchAdminExpensesParams = {
  q?: string;
  branch?: string;
  category?: AdminExpenseCategory;
  status?: AdminExpenseStatus;
  dateFrom?: string;
  dateTo?: string;
};

export type FetchAdminFinanceSummaryParams = {
  branch?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type FetchAdminFinanceTransactionsParams =
  FetchAdminFinanceSummaryParams & {
    q?: string;
    kind?: AdminFinanceTransactionKind;
    category?: string;
    status?: string;
  };

function buildQueryString(params: Record<string, unknown>) {
  const queryParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    queryParams.set(key, String(value));
  }

  return queryParams.toString();
}

export async function fetchAdminBranchIncomes(
  params: FetchAdminBranchIncomesParams = {},
) {
  const queryString = buildQueryString(params);
  const endpoint = queryString
    ? `/api/branch-incomes?${queryString}`
    : "/api/branch-incomes";
  const payload = await requestAdminApi<{
    incomes: AdminBranchIncome[];
    scope: AdminFinanceScope;
  }>(endpoint, {
    method: "GET",
  });

  return payload.data as {
    incomes: AdminBranchIncome[];
    scope: AdminFinanceScope;
  };
}

export async function createAdminBranchIncome(
  body: AdminBranchIncomeMutationPayload,
) {
  const payload = await requestAdminApi<{
    income: AdminBranchIncome;
  }>("/api/branch-incomes", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return payload.data as {
    income: AdminBranchIncome;
  };
}

export async function updateAdminBranchIncome(
  id: string,
  body: AdminBranchIncomeMutationPayload,
) {
  const payload = await requestAdminApi<{
    income: AdminBranchIncome;
  }>(`/api/branch-incomes/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

  return payload.data as {
    income: AdminBranchIncome;
  };
}

export async function deleteAdminBranchIncome(id: string) {
  await requestAdminApi<Record<string, never>>(
    `/api/branch-incomes/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    },
  );
}

export async function fetchAdminExpenses(
  params: FetchAdminExpensesParams = {},
) {
  const queryString = buildQueryString(params);
  const endpoint = queryString ? `/api/expenses?${queryString}` : "/api/expenses";
  const payload = await requestAdminApi<{
    expenses: AdminExpense[];
    scope: AdminFinanceScope;
  }>(endpoint, {
    method: "GET",
  });

  return payload.data as {
    expenses: AdminExpense[];
    scope: AdminFinanceScope;
  };
}

export async function createAdminExpense(body: AdminExpenseMutationPayload) {
  const payload = await requestAdminApi<{
    expense: AdminExpense;
  }>("/api/expenses", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return payload.data as {
    expense: AdminExpense;
  };
}

export async function updateAdminExpense(
  id: string,
  body: AdminExpenseMutationPayload,
) {
  const payload = await requestAdminApi<{
    expense: AdminExpense;
  }>(`/api/expenses/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

  return payload.data as {
    expense: AdminExpense;
  };
}

export async function deleteAdminExpense(id: string) {
  await requestAdminApi<Record<string, never>>(
    `/api/expenses/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    },
  );
}

export async function fetchAdminFinanceSummary(
  params: FetchAdminFinanceSummaryParams = {},
) {
  const queryString = buildQueryString(params);
  const endpoint = queryString
    ? `/api/branch-finances/summary?${queryString}`
    : "/api/branch-finances/summary";
  const payload = await requestAdminApi<AdminFinanceSummaryData>(endpoint, {
    method: "GET",
  });

  return payload.data as AdminFinanceSummaryData;
}

export async function fetchAdminFinanceTransactions(
  params: FetchAdminFinanceTransactionsParams = {},
) {
  const queryString = buildQueryString(params);
  const endpoint = queryString
    ? `/api/branch-finances/transactions?${queryString}`
    : "/api/branch-finances/transactions";
  const payload = await requestAdminApi<AdminFinanceTransactionsData>(endpoint, {
    method: "GET",
  });

  return payload.data as AdminFinanceTransactionsData;
}
