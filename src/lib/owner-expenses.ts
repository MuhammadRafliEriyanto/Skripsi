import { requestAdminApi } from "@/lib/admin-api";
import { fetchOwnerBranchAdminOptionsFromApi } from "@/lib/owner-branch-admins";

export const ownerExpenseCategoryOptions = [
  "Listrik",
  "Internet",
  "Sewa Gedung",
  "Lainnya",
  "Gaji Guru",
  "Gaji Admin",
  "Operasional Cabang",
  "Teknologi",
] as const;

export const ownerExpenseVisibleCategoryOptions = [
  "Listrik",
  "Internet",
  "Sewa Gedung",
  "Lainnya",
] as const;

export const ownerExpenseLegacyCategoryOptions = [
  "Gaji Guru",
  "Gaji Admin",
  "Operasional Cabang",
  "Teknologi",
] as const;

export const ownerExpenseStatusOptions = [
  "Menunggu",
  "Dijadwalkan",
  "Selesai",
  "Dibatalkan",
] as const;

export type OwnerExpenseCategory = (typeof ownerExpenseCategoryOptions)[number];
export type OwnerExpenseUiCategory =
  (typeof ownerExpenseVisibleCategoryOptions)[number];
export type OwnerExpenseLegacyCategory =
  (typeof ownerExpenseLegacyCategoryOptions)[number];
export type OwnerExpenseStatus = (typeof ownerExpenseStatusOptions)[number];

export const ownerExpenseFormStatusOptions = [
  "Menunggu",
  "Selesai",
  "Dibatalkan",
] as const satisfies readonly OwnerExpenseStatus[];

export function normalizeOwnerExpenseFormStatus(
  value: OwnerExpenseStatus,
): OwnerExpenseStatus {
  return value === "Dijadwalkan" ? "Menunggu" : value;
}

export function getOwnerExpenseStatusLabel(status: string) {
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

export function isOwnerExpenseLegacyCategory(
  value: string | null | undefined,
): value is OwnerExpenseLegacyCategory {
  return ownerExpenseLegacyCategoryOptions.includes(
    (value ?? "") as OwnerExpenseLegacyCategory,
  );
}

export function normalizeOwnerExpenseFormCategory(
  value: string | null | undefined,
): OwnerExpenseUiCategory {
  return ownerExpenseVisibleCategoryOptions.includes(value as OwnerExpenseUiCategory)
    ? (value as OwnerExpenseUiCategory)
    : "Lainnya";
}

export type OwnerExpense = {
  id: string;
  expenseId: string;
  title: string;
  branch: string;
  category: OwnerExpenseCategory;
  vendorOrRecipient: string;
  amount: number;
  paymentMethod: string;
  status: OwnerExpenseStatus;
  paidAt: string | null;
  dueDate: string | null;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type OwnerExpenseMutationPayload = {
  title: string;
  branch: string;
  category: OwnerExpenseCategory;
  vendorOrRecipient: string;
  amount: number;
  paymentMethod: string;
  status: OwnerExpenseStatus;
  paidAt?: string | null;
  dueDate?: string | null;
  note?: string | null;
};

export type OwnerExpenseRecipientOption = {
  id: string;
  name: string;
  subtitle: string;
  branch?: string;
};

type OwnerExpenseApiItem = {
  id?: string;
  expenseId?: string;
  title?: string;
  branch?: string;
  category?: string;
  vendorOrRecipient?: string;
  amount?: number;
  paymentMethod?: string;
  status?: string;
  paidAt?: string | null;
  dueDate?: string | null;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
};

type OwnerTeacherApiItem = {
  id?: string;
  name?: string;
  email?: string;
  branch?: string;
  status?: string;
};

type OwnerBranchApiItem = {
  name?: string;
  adminName?: string;
};

export type OwnerExpenseBranchDirectoryItem = {
  name: string;
  adminName: string;
};

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function normalizeLookupKey(value: string | null | undefined) {
  return normalizeText(value).toLowerCase();
}

const hiddenExpenseDetailValue = "Tidak dicatat";

function toOwnerExpense(expense: OwnerExpenseApiItem): OwnerExpense | null {
  const id = String(expense.id ?? "").trim();
  const expenseId = String(expense.expenseId ?? "").trim();
  const title = normalizeText(expense.title);
  const branch = normalizeText(expense.branch) || "Pusat";
  const category = normalizeText(expense.category) as OwnerExpenseCategory;
  const vendorOrRecipient =
    normalizeText(expense.vendorOrRecipient) || hiddenExpenseDetailValue;
  const amount =
    typeof expense.amount === "number" && Number.isFinite(expense.amount)
      ? expense.amount
      : NaN;
  const paymentMethod =
    normalizeText(expense.paymentMethod) || hiddenExpenseDetailValue;
  const status = normalizeText(expense.status) as OwnerExpenseStatus;
  const createdAt = String(expense.createdAt ?? "").trim();
  const updatedAt = String(expense.updatedAt ?? "").trim();

  if (
    !id ||
    !expenseId ||
    !title ||
    !createdAt ||
    !updatedAt ||
    !ownerExpenseCategoryOptions.includes(category) ||
    !ownerExpenseStatusOptions.includes(status) ||
    !Number.isFinite(amount)
  ) {
    return null;
  }

  return {
    id,
    expenseId,
    title,
    branch,
    category,
    vendorOrRecipient,
    amount,
    paymentMethod,
    status,
    paidAt:
      typeof expense.paidAt === "string" && expense.paidAt.trim()
        ? expense.paidAt.trim()
        : null,
    dueDate:
      typeof expense.dueDate === "string" && expense.dueDate.trim()
        ? expense.dueDate.trim()
        : null,
    note: normalizeText(expense.note),
    createdAt,
    updatedAt,
  };
}

export async function fetchOwnerExpensesFromApi() {
  const payload = await requestAdminApi<{ expenses?: OwnerExpenseApiItem[] }>("/api/expenses", {
    method: "GET",
  });

  return Array.isArray(payload.data?.expenses)
    ? payload.data.expenses
        .map((expense) => toOwnerExpense(expense))
        .filter((expense): expense is OwnerExpense => expense !== null)
    : [];
}

export async function createOwnerExpense(payload: OwnerExpenseMutationPayload) {
  return requestAdminApi<{ expense?: OwnerExpenseApiItem }>("/api/expenses", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateOwnerExpense(expenseId: string, payload: OwnerExpenseMutationPayload) {
  return requestAdminApi<{ expense?: OwnerExpenseApiItem }>(
    `/api/expenses/${encodeURIComponent(expenseId)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
}

export async function deleteOwnerExpense(expenseId: string) {
  return requestAdminApi<Record<string, never>>(
    `/api/expenses/${encodeURIComponent(expenseId)}`,
    {
      method: "DELETE",
    },
  );
}

export async function fetchOwnerExpenseTeacherOptionsFromApi() {
  const payload = await requestAdminApi<{ teachers?: OwnerTeacherApiItem[] }>("/api/teachers", {
    method: "GET",
  });

  if (!Array.isArray(payload.data?.teachers)) {
    return [] as OwnerExpenseRecipientOption[];
  }

  return payload.data.teachers
    .map((teacher) => {
      const id = String(teacher.id ?? "").trim();
      const name = normalizeText(teacher.name);
      const email = String(teacher.email ?? "").trim().toLowerCase();
      const branch = normalizeText(teacher.branch);
      const status = normalizeText(teacher.status);

      if (!id || !name) {
        return null;
      }

      const subtitleParts = [branch, status, email].filter(Boolean);
      const option: OwnerExpenseRecipientOption = {
        id,
        name,
        subtitle: subtitleParts.join(" - "),
      };

      if (branch) {
        option.branch = branch;
      }

      return option;
    })
    .filter((teacher): teacher is OwnerExpenseRecipientOption => teacher !== null);
}

function toOwnerExpenseBranchDirectoryItem(
  branch: OwnerBranchApiItem,
): OwnerExpenseBranchDirectoryItem | null {
  const name = normalizeText(branch.name);

  if (!name) {
    return null;
  }

  return {
    name,
    adminName: normalizeText(branch.adminName),
  };
}

export async function fetchOwnerExpenseBranchDirectoryFromApi() {
  const payload = await requestAdminApi<{ branches?: OwnerBranchApiItem[] }>("/api/branches", {
    method: "GET",
  });

  return Array.isArray(payload.data?.branches)
    ? payload.data.branches
        .map((branch) => toOwnerExpenseBranchDirectoryItem(branch))
        .filter(
          (branch): branch is OwnerExpenseBranchDirectoryItem => branch !== null,
        )
    : [];
}

export async function fetchOwnerExpenseAdminOptionsFromApi(
  branchDirectory?: OwnerExpenseBranchDirectoryItem[],
) {
  const admins = await fetchOwnerBranchAdminOptionsFromApi();
  const resolvedBranchDirectory =
    branchDirectory ?? (await fetchOwnerExpenseBranchDirectoryFromApi());
  const branchNameByAdmin = new Map(
    resolvedBranchDirectory
      .filter((branch) => branch.adminName)
      .map((branch) => [normalizeLookupKey(branch.adminName), branch.name] as const),
  );

  return admins.map((admin) => {
    const branch = branchNameByAdmin.get(normalizeLookupKey(admin.name));
    const option: OwnerExpenseRecipientOption = {
      id: admin.id,
      name: admin.name,
      subtitle: [branch, admin.email].filter(Boolean).join(" - "),
    };

    if (branch) {
      option.branch = branch;
    }

    return option;
  });
}

export async function fetchOwnerExpenseBranchOptionsFromApi() {
  const branches = await fetchOwnerExpenseBranchDirectoryFromApi();
  const branchNames = branches.map((branch) => branch.name).filter(Boolean);

  return Array.from(new Set(["Pusat", ...branchNames]));
}
