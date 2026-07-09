"use client";

import { useEffect, useMemo, useState } from "react";

import { publishOwnerDashboardRefresh } from "@/components/dashboard-owner/dashboard-refresh-events";
import { AdminApiRequestError } from "@/lib/admin-api";
import {
  createOwnerExpense,
  deleteOwnerExpense,
  fetchOwnerExpenseBranchDirectoryFromApi,
  fetchOwnerExpensesFromApi,
  isOwnerExpenseLegacyCategory,
  normalizeOwnerExpenseFormCategory,
  ownerExpenseStatusOptions,
  ownerExpenseVisibleCategoryOptions,
  updateOwnerExpense,
  type OwnerExpense,
  type OwnerExpenseMutationPayload,
  type OwnerExpenseStatus,
  type OwnerExpenseUiCategory,
} from "@/lib/owner-expenses";

export type OwnerExpenseBranchFilter = "Semua Cabang" | string;
export type OwnerExpenseCategoryFilter = "Semua" | OwnerExpenseUiCategory;
export type OwnerExpenseStatusFilter = "Semua" | OwnerExpenseStatus;

export type OwnerExpenseForm = {
  title: string;
  branch: string;
  category: OwnerExpenseUiCategory;
  vendorOrRecipient: string;
  amount: string;
  paymentMethod: string;
  status: OwnerExpenseStatus;
  paidAt: string;
  dueDate: string;
  note: string;
};

export type OwnerExpenseFieldErrors = Partial<Record<keyof OwnerExpenseForm, string>>;

export type OwnerExpenseDialogMode = "create" | "edit";

export type OwnerExpenseDialogState = {
  isOpen: boolean;
  mode: OwnerExpenseDialogMode;
  title: string;
  description: string;
  submitLabel: string;
  error: string | null;
  fieldErrors: OwnerExpenseFieldErrors;
  legacyCategoryLabel: string | null;
};

export type OwnerExpenseFlashTone = "success" | "warning" | "danger" | "info";

export type OwnerExpenseFlash = {
  tone: OwnerExpenseFlashTone;
  message: string;
};

export type OwnerExpensesManager = {
  expenses: OwnerExpense[];
  totalExpenses: number;
  filteredExpenseCount: number;
  isLoading: boolean;
  isSubmitting: boolean;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  branchFilter: OwnerExpenseBranchFilter;
  setBranchFilter: (value: OwnerExpenseBranchFilter) => void;
  categoryFilter: OwnerExpenseCategoryFilter;
  setCategoryFilter: (value: OwnerExpenseCategoryFilter) => void;
  statusFilter: OwnerExpenseStatusFilter;
  setStatusFilter: (value: OwnerExpenseStatusFilter) => void;
  branchFilterOptions: OwnerExpenseBranchFilter[];
  categoryFilterOptions: readonly OwnerExpenseCategoryFilter[];
  statusFilterOptions: readonly OwnerExpenseStatusFilter[];
  formBranchOptions: string[];
  categoryOptions: readonly OwnerExpenseUiCategory[];
  statusOptions: readonly OwnerExpenseStatus[];
  flash: OwnerExpenseFlash | null;
  dismissFlash: () => void;
  dialog: OwnerExpenseDialogState;
  form: OwnerExpenseForm;
  openCreateDialog: () => void;
  openEditDialog: (expenseId: string) => void;
  closeDialog: () => void;
  updateFormValue: (field: keyof OwnerExpenseForm, value: string) => void;
  submitForm: () => void;
  removeExpense: (expenseId: string) => void;
  resetFilters: () => void;
};

const allBranchFilter = "Semua Cabang" as const satisfies OwnerExpenseBranchFilter;
const categoryFilterOptions = [
  "Semua",
  ...ownerExpenseVisibleCategoryOptions,
] as const satisfies readonly OwnerExpenseCategoryFilter[];
const statusFilterOptions = [
  "Semua",
  ...ownerExpenseStatusOptions,
] as const satisfies readonly OwnerExpenseStatusFilter[];

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function selectRelevantBranchOptions(branches: string[]) {
  return Array.from(
    new Set(branches.map((branch) => normalizeText(branch)).filter(Boolean)),
  );
}

function resolveDefaultBranch(branchOptions: string[]) {
  return selectRelevantBranchOptions(branchOptions)[0] ?? "";
}

function buildDefaultExpenseForm(branchOptions: string[]): OwnerExpenseForm {
  return {
    title: "",
    branch: resolveDefaultBranch(branchOptions),
    category: "Listrik",
    vendorOrRecipient: "",
    amount: "",
    paymentMethod: "",
    status: "Menunggu",
    paidAt: "",
    dueDate: "",
    note: "",
  };
}

function buildExpenseMutationPayload(form: OwnerExpenseForm): OwnerExpenseMutationPayload {
  return {
    title: normalizeText(form.title),
    branch: normalizeText(form.branch),
    category: form.category,
    vendorOrRecipient: normalizeText(form.vendorOrRecipient),
    amount: Math.round(Number(form.amount)),
    paymentMethod: normalizeText(form.paymentMethod),
    status: form.status,
    paidAt: form.paidAt.trim() || null,
    dueDate: form.dueDate.trim() || null,
    note: normalizeText(form.note),
  };
}

function readExpenseFieldErrors(
  errors: AdminApiRequestError["errors"],
): OwnerExpenseFieldErrors {
  if (!errors || typeof errors !== "object" || Array.isArray(errors)) {
    return {};
  }

  return errors as OwnerExpenseFieldErrors;
}

export function useOwnerExpenses() {
  const [expenses, setExpenses] = useState<OwnerExpense[]>([]);
  const [branchOptions, setBranchOptions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [branchFilter, setBranchFilter] = useState<OwnerExpenseBranchFilter>(allBranchFilter);
  const [categoryFilter, setCategoryFilter] =
    useState<OwnerExpenseCategoryFilter>("Semua");
  const [statusFilter, setStatusFilter] = useState<OwnerExpenseStatusFilter>("Semua");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<OwnerExpenseDialogMode>("create");
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editingLegacyCategory, setEditingLegacyCategory] = useState<string | null>(
    null,
  );
  const [form, setForm] = useState<OwnerExpenseForm>(
    buildDefaultExpenseForm([]),
  );
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<OwnerExpenseFieldErrors>({});
  const [flash, setFlash] = useState<OwnerExpenseFlash | null>(null);

  const formBranchOptions = useMemo(() => {
    return selectRelevantBranchOptions([
      ...branchOptions,
      ...expenses.map((expense) => normalizeText(expense.branch)).filter(Boolean),
    ]);
  }, [branchOptions, expenses]);

  async function refreshExpenses(notifyListeners = false) {
    const nextExpenses = await fetchOwnerExpensesFromApi();
    setExpenses(nextExpenses);

    if (notifyListeners) {
      publishOwnerDashboardRefresh();
    }

    return nextExpenses;
  }

  useEffect(() => {
    let isCancelled = false;

    async function loadExpenseDependencies() {
      setIsLoading(true);

      try {
        const [nextExpenses, nextBranchDirectory] = await Promise.all([
          fetchOwnerExpensesFromApi(),
          fetchOwnerExpenseBranchDirectoryFromApi(),
        ]);

        if (isCancelled) {
          return;
        }

        setExpenses(nextExpenses);
        const nextBranchOptions = selectRelevantBranchOptions(
          nextBranchDirectory.map((branch) => branch.name),
        );
        setBranchOptions(nextBranchOptions);
      } catch {
        if (isCancelled) {
          return;
        }

        setExpenses([]);
        setBranchOptions([]);
        setFlash({
          tone: "warning",
          message:
            "Data pengeluaran dari server belum bisa dimuat. Coba refresh halaman ini lagi.",
        });
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadExpenseDependencies();

    return () => {
      isCancelled = true;
    };
  }, []);

  const filteredExpenses = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return expenses.filter((expense) => {
      const matchesQuery = normalizedQuery
        ? expense.title.toLowerCase().includes(normalizedQuery) ||
          expense.branch.toLowerCase().includes(normalizedQuery) ||
          expense.category.toLowerCase().includes(normalizedQuery) ||
          expense.vendorOrRecipient.toLowerCase().includes(normalizedQuery) ||
          expense.paymentMethod.toLowerCase().includes(normalizedQuery) ||
          expense.expenseId.toLowerCase().includes(normalizedQuery)
        : true;
      const matchesBranch =
        branchFilter === allBranchFilter ? true : expense.branch === branchFilter;
      const matchesCategory =
        categoryFilter === "Semua" ? true : expense.category === categoryFilter;
      const matchesStatus = statusFilter === "Semua" ? true : expense.status === statusFilter;

      return matchesQuery && matchesBranch && matchesCategory && matchesStatus;
    });
  }, [branchFilter, categoryFilter, expenses, searchQuery, statusFilter]);

  const branchFilterOptions = useMemo(() => {
    return Array.from(
      new Set([
        allBranchFilter,
        ...formBranchOptions,
        ...expenses.map((expense) => expense.branch).filter(Boolean),
      ]),
    );
  }, [expenses, formBranchOptions]);

  function dismissFlash() {
    setFlash(null);
  }

  function resetForm(nextBranchOptions = formBranchOptions) {
    setForm(buildDefaultExpenseForm(nextBranchOptions));
    setDialogError(null);
    setFieldErrors({});
    setEditingExpenseId(null);
    setEditingLegacyCategory(null);
    setDialogMode("create");
  }

  function openCreateDialog() {
    resetForm();
    setIsDialogOpen(true);
  }

  function openEditDialog(expenseId: string) {
    const expense = expenses.find((item) => item.id === expenseId);

    if (!expense) {
      return;
    }

    setDialogMode("edit");
    setEditingExpenseId(expense.id);
    setEditingLegacyCategory(
      isOwnerExpenseLegacyCategory(expense.category) ? expense.category : null,
    );
    setForm({
      title: expense.title,
      branch: expense.branch,
      category: normalizeOwnerExpenseFormCategory(expense.category),
      vendorOrRecipient: expense.vendorOrRecipient,
      amount: String(expense.amount),
      paymentMethod: expense.paymentMethod,
      status: expense.status,
      paidAt: expense.paidAt ? expense.paidAt.slice(0, 10) : "",
      dueDate: expense.dueDate ? expense.dueDate.slice(0, 10) : "",
      note: expense.note,
    });
    setDialogError(null);
    setFieldErrors({});
    setIsDialogOpen(true);
  }

  function closeDialog() {
    setIsDialogOpen(false);
    resetForm();
  }

  function updateFormValue(field: keyof OwnerExpenseForm, value: string) {
    setDialogError(null);
    setFieldErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function submitExpenseForm() {
    const nextErrors: OwnerExpenseFieldErrors = {};
    const title = normalizeText(form.title);
    const branch = normalizeText(form.branch);
    const vendorOrRecipient = normalizeText(form.vendorOrRecipient);
    const paymentMethod = normalizeText(form.paymentMethod);
    const amount = Number(form.amount);

    if (!title) {
      nextErrors.title = "Judul pengeluaran wajib diisi.";
    }

    if (!branch) {
      nextErrors.branch = "Cabang wajib dipilih.";
    }

    if (!vendorOrRecipient) {
      nextErrors.vendorOrRecipient = "Vendor atau penerima wajib diisi.";
    }

    if (!paymentMethod) {
      nextErrors.paymentMethod = "Metode pembayaran wajib diisi.";
    }

    if (!form.amount.trim()) {
      nextErrors.amount = "Nominal pengeluaran wajib diisi.";
    } else if (!Number.isFinite(amount) || amount <= 0) {
      nextErrors.amount = "Nominal pengeluaran wajib berupa angka positif.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setDialogError("Lengkapi data pengeluaran terlebih dahulu.");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = buildExpenseMutationPayload({
        ...form,
        title,
        branch,
        vendorOrRecipient,
        paymentMethod,
      });

      if (dialogMode === "edit" && editingExpenseId) {
        await updateOwnerExpense(editingExpenseId, payload);
        setFlash({
          tone: "success",
          message: `Pengeluaran ${payload.title} berhasil diperbarui.`,
        });
      } else {
        await createOwnerExpense(payload);
        setFlash({
          tone: "success",
          message: `Pengeluaran ${payload.title} berhasil ditambahkan.`,
        });
      }

      await refreshExpenses(true);
      closeDialog();
    } catch (error) {
      if (error instanceof AdminApiRequestError) {
        setDialogError(error.message);
        setFieldErrors(readExpenseFieldErrors(error.errors));
      } else {
        setDialogError("Perubahan pengeluaran gagal disimpan. Coba ulangi lagi.");
        setFieldErrors({});
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function submitForm() {
    void submitExpenseForm();
  }

  async function removeExpenseFromApi(expenseId: string) {
    const expense = expenses.find((item) => item.id === expenseId);

    if (!expense) {
      return;
    }

    try {
      await deleteOwnerExpense(expenseId);
      setFlash({
        tone: "warning",
        message: `Pengeluaran ${expense.title} berhasil dihapus.`,
      });
      await refreshExpenses(true);
    } catch (error) {
      setFlash({
        tone: "danger",
        message:
          error instanceof Error
            ? error.message
            : "Pengeluaran gagal dihapus. Coba ulangi lagi.",
      });
    }
  }

  function removeExpense(expenseId: string) {
    void removeExpenseFromApi(expenseId);
  }

  function resetFilters() {
    setSearchQuery("");
    setBranchFilter(allBranchFilter);
    setCategoryFilter("Semua");
    setStatusFilter("Semua");
  }

  const dialog: OwnerExpenseDialogState = {
    isOpen: isDialogOpen,
    mode: dialogMode,
    title:
      dialogMode === "create"
        ? "Tambah Pengeluaran Operasional"
        : "Edit Pengeluaran Operasional",
    description:
      dialogMode === "create"
        ? "Catat biaya operasional cabang agar langsung masuk ke monitoring owner dan perhitungan saldo bersih."
        : editingLegacyCategory
          ? `Data lama dengan kategori legacy "${editingLegacyCategory}" bisa diperbarui ke kategori operasional baru tanpa mengubah flow pembayaran.`
          : "Perbarui data pengeluaran operasional yang ada di sistem.",
    submitLabel:
      dialogMode === "create"
        ? "Simpan pengeluaran"
        : "Simpan perubahan",
    error: dialogError,
    fieldErrors,
    legacyCategoryLabel: editingLegacyCategory,
  };

  const manager: OwnerExpensesManager = {
    expenses: filteredExpenses,
    totalExpenses: expenses.length,
    filteredExpenseCount: filteredExpenses.length,
    isLoading,
    isSubmitting,
    searchQuery,
    setSearchQuery,
    branchFilter,
    setBranchFilter,
    categoryFilter,
    setCategoryFilter,
    statusFilter,
    setStatusFilter,
    branchFilterOptions,
    categoryFilterOptions,
    statusFilterOptions,
    formBranchOptions,
    categoryOptions: ownerExpenseVisibleCategoryOptions,
    statusOptions: ownerExpenseStatusOptions,
    flash,
    dismissFlash,
    dialog,
    form,
    openCreateDialog,
    openEditDialog,
    closeDialog,
    updateFormValue,
    submitForm,
    removeExpense,
    resetFilters,
  };

  return {
    expensesManager: manager,
  };
}
