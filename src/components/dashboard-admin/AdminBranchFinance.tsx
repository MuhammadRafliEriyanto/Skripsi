"use client";

import {
  ArrowDownCircle,
  Eye,
  Landmark,
  LoaderCircle,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useDeferredValue, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  adminExpenseCategoryOptions,
  adminExpenseStatusOptions,
  createAdminExpense,
  deleteAdminExpense,
  fetchAdminExpenses,
  fetchAdminFinanceSummary,
  normalizeAdminExpenseFormCategory,
  updateAdminExpense,
  type AdminExpense,
  type AdminExpenseCategory,
  type AdminExpenseMutationPayload,
  type AdminExpenseStatus,
  type AdminFinanceScope,
  type AdminFinanceSummaryData,
  type AdminUiExpenseCategory,
} from "@/lib/admin-finances";
import { cn, formatCurrency } from "@/lib/utils";

import {
  AdminDataTable,
  type AdminColumnDefinition,
} from "./components/AdminDataTable";
import { AdminPaginationFooter } from "./components/AdminPaginationFooter";
import { AdminSummaryLineSkeleton } from "./components/AdminLoadingState";
import { AdminSectionCard } from "./components/AdminSectionCard";
import { AdminStatusBadge } from "./components/AdminStatusBadge";

type AdminBranchFinanceProps = {
  onRefresh?: () => Promise<void> | void;
  globalSearchQuery?: string;
  compactSummary?: boolean;
};

type FinanceFeedback = {
  tone: "success" | "warning";
  message: string;
};

type FinancePaginationState = {
  page: number;
  filterKey: string;
};

type ExpenseFormValues = {
  title: string;
  category: AdminUiExpenseCategory;
  vendorOrRecipient: string;
  amount: string;
  paymentMethod: string;
  status: AdminExpenseStatus;
  paidAt: string;
  dueDate: string;
  note: string;
};

const listPageSize = 8;
const allBranchesValue = "__all_branches__";
const allExpenseStatusValue = "__all_expense_status__";
const allExpenseCategoryValue = "__all_expense_category__";
const warmFieldClassName =
  "border-slate-200 hover:border-orange-200 focus:border-orange-300 focus:ring-4 focus:ring-orange-500/10 focus-visible:border-orange-300 focus-visible:ring-4 focus-visible:ring-orange-500/10";
const warmSelectTriggerClassName =
  "border-slate-200 hover:border-orange-200 focus:border-orange-300 focus:ring-4 focus:ring-orange-500/10 focus-visible:border-orange-300 focus-visible:ring-4 focus-visible:ring-orange-500/10 data-[state=open]:border-orange-300 data-[state=open]:ring-4 data-[state=open]:ring-orange-500/10";
const warmSelectContentClassName =
  "border-orange-100/80 shadow-lg shadow-orange-100/20";
const warmSelectItemClassName =
  "hover:bg-orange-50 hover:text-orange-700 focus:bg-orange-50 focus:text-orange-700 data-[highlighted]:bg-orange-50 data-[highlighted]:text-orange-700 data-[state=checked]:bg-orange-50 data-[state=checked]:text-orange-700";
const warmOutlineButtonClassName =
  "border-slate-200 bg-white text-slate-700 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700 active:border-orange-300 active:bg-orange-100/80 active:text-orange-800 focus-visible:border-orange-300 focus-visible:ring-orange-500/10";
const warmPrimaryButtonClassName =
  "bg-orange-600 hover:bg-orange-700 active:bg-orange-800 focus-visible:ring-orange-500/20";
const warmOverlayPanelClassName =
  "[&>button]:hover:bg-orange-50 [&>button]:hover:text-orange-700 [&>button]:focus-visible:ring-orange-500/10";

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function formatDateLabel(value: string | null | undefined) {
  const rawValue = normalizeText(value);

  if (!rawValue) {
    return "-";
  }

  const date = new Date(rawValue);

  if (Number.isNaN(date.getTime())) {
    return rawValue;
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTimeLabel(value: string | null | undefined) {
  const rawValue = normalizeText(value);

  if (!rawValue) {
    return "-";
  }

  const date = new Date(rawValue);

  if (Number.isNaN(date.getTime())) {
    return rawValue;
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function toDateInputValue(value: string | null | undefined) {
  const rawValue = normalizeText(value);
  return rawValue ? rawValue.slice(0, 10) : "";
}

function getFinanceErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
}

function parsePositiveAmount(value: string) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return Math.round(amount);
}

function createEmptyExpenseForm(): ExpenseFormValues {
  return {
    title: "",
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

function createFinancePaginationState(): FinancePaginationState {
  return {
    page: 1,
    filterKey: "",
  };
}

function toExpenseFormValues(expense: AdminExpense): ExpenseFormValues {
  return {
    title: expense.title,
    category: normalizeAdminExpenseFormCategory(expense.category),
    vendorOrRecipient: expense.vendorOrRecipient,
    amount: String(expense.amount),
    paymentMethod: expense.paymentMethod,
    status: expense.status,
    paidAt: toDateInputValue(expense.paidAt),
    dueDate: toDateInputValue(expense.dueDate),
    note: expense.note,
  };
}

function getFinanceStatusTone(status: string) {
  const normalizedStatus = status.toLowerCase();

  if (
    normalizedStatus === "paid" ||
    normalizedStatus === "diterima" ||
    normalizedStatus === "selesai"
  ) {
    return "success" as const;
  }

  if (
    normalizedStatus === "pending" ||
    normalizedStatus === "menunggu" ||
    normalizedStatus === "dijadwalkan"
  ) {
    return "warning" as const;
  }

  if (
    normalizedStatus === "failed" ||
    normalizedStatus === "expired" ||
    normalizedStatus === "dibatalkan"
  ) {
    return "danger" as const;
  }

  return "default" as const;
}

function FinanceField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-700">{label}</p>
      {children}
    </div>
  );
}

function FinanceDetailItem({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3",
        className,
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium leading-6 text-slate-800">{value}</p>
    </div>
  );
}

function FinanceMetricCard({
  title,
  value,
  helper,
  tone = "slate",
  icon: Icon,
  isLoading = false,
}: {
  title: string;
  value: string;
  helper: string;
  tone?: "slate" | "emerald" | "orange" | "amber";
  icon: LucideIcon;
  isLoading?: boolean;
}) {
  const toneClassName =
    tone === "emerald"
      ? "border-emerald-100 bg-emerald-50/80 text-emerald-700"
      : tone === "orange"
        ? "border-orange-100 bg-orange-50/85 text-orange-700"
        : tone === "amber"
          ? "border-amber-100 bg-amber-50/85 text-amber-700"
          : "border-slate-200 bg-slate-50/85 text-slate-700";

  return (
    <div className="rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-[0_16px_30px_-26px_rgba(15,23,42,0.16)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
            {title}
          </p>
          {isLoading ? (
            <Skeleton className="mt-2 h-8 w-36" />
          ) : (
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              {value}
            </p>
          )}
        </div>
        <div
          className={cn(
            "flex size-11 items-center justify-center rounded-2xl border",
            toneClassName,
          )}
        >
          <Icon className="size-5" />
        </div>
      </div>
      {isLoading ? (
        <Skeleton className="mt-3 h-4 w-4/5" />
      ) : (
        <p className="mt-3 text-sm leading-6 text-slate-500">{helper}</p>
      )}
    </div>
  );
}

function resolveSummaryManagedBranches(
  scope: AdminFinanceScope | null,
  summary: AdminFinanceSummaryData | null,
) {
  const scopeBranches = scope?.managedBranches ?? [];

  if (scopeBranches.length > 0) {
    return scopeBranches;
  }

  return summary?.branches.map((branch) => branch.branch).filter(Boolean) ?? [];
}

export function AdminBranchFinance({
  onRefresh,
  globalSearchQuery = "",
  compactSummary = false,
}: AdminBranchFinanceProps) {
  const deferredGlobalSearch = useDeferredValue(globalSearchQuery);
  const [scope, setScope] = useState<AdminFinanceScope | null>(null);
  const [financeSummary, setFinanceSummary] =
    useState<AdminFinanceSummaryData | null>(null);
  const [expenses, setExpenses] = useState<AdminExpense[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [expensesLoading, setExpensesLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [expensesError, setExpensesError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FinanceFeedback | null>(null);
  const [selectedBranch, setSelectedBranch] = useState(allBranchesValue);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expenseStatusFilter, setExpenseStatusFilter] = useState(
    allExpenseStatusValue,
  );
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState(
    allExpenseCategoryValue,
  );
  const [expensePagination, setExpensePagination] =
    useState<FinancePaginationState>(createFinancePaginationState);
  const [isExpenseFormOpen, setIsExpenseFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<AdminExpense | null>(null);
  const [selectedExpenseDetail, setSelectedExpenseDetail] =
    useState<AdminExpense | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<AdminExpense | null>(
    null,
  );
  const [expenseFormValues, setExpenseFormValues] =
    useState<ExpenseFormValues>(createEmptyExpenseForm());
  const [expenseFormError, setExpenseFormError] = useState<string | null>(null);
  const [isExpenseSubmitting, setIsExpenseSubmitting] = useState(false);
  const [isExpenseDeleting, setIsExpenseDeleting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const normalizedSearchQuery = deferredGlobalSearch.trim();
  const managedBranches = resolveSummaryManagedBranches(scope, financeSummary);
  const selectedBranchQuery =
    selectedBranch === allBranchesValue ? undefined : selectedBranch;
  const primaryManagedBranch = managedBranches[0] ?? "";
  const selectedBranchLabel =
    selectedBranchQuery ||
    financeSummary?.filters.branch ||
    primaryManagedBranch ||
    "Cabang admin";
  const canSelectBranch = managedBranches.length > 1;
  const expenseFilterKey = [
    normalizedSearchQuery,
    selectedBranchQuery ?? "",
    dateFrom,
    dateTo,
    expenseStatusFilter,
    expenseCategoryFilter,
  ].join("|");
  const expenseTotalPages = Math.max(1, Math.ceil(expenses.length / listPageSize));
  const expensePage =
    expensePagination.filterKey === expenseFilterKey
      ? Math.min(expensePagination.page, expenseTotalPages)
      : 1;
  const visibleExpenses = expenses.slice(
    (expensePage - 1) * listPageSize,
    expensePage * listPageSize,
  );
  const membershipPaidAmount = financeSummary?.summary.membership.paidAmount ?? 0;
  const membershipPaidCount = financeSummary?.summary.membership.paidCount ?? 0;
  const membershipPendingAmount =
    financeSummary?.summary.membership.pendingAmount ?? 0;
  const membershipPendingCount =
    financeSummary?.summary.membership.pendingCount ?? 0;
  const expenseSettledAmount =
    financeSummary?.summary.expense.settledAmount ?? 0;
  const expenseSettledCount =
    financeSummary?.summary.expense.settledCount ?? 0;
  const expensePendingAmount =
    financeSummary?.summary.expense.pendingAmount ?? 0;
  const expensePendingCount =
    financeSummary?.summary.expense.pendingCount ?? 0;
  const branchBalanceAmount = membershipPaidAmount - expenseSettledAmount;
  const isEditingExpense = Boolean(editingExpense);
  const canManageExpenses = scope?.role === "admin";

  useEffect(() => {
    let isCancelled = false;

    async function loadFinanceSummary() {
      setSummaryLoading(true);

      try {
        const payload = await fetchAdminFinanceSummary({
          branch: selectedBranchQuery,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        });

        if (isCancelled) {
          return;
        }

        setFinanceSummary(payload);
        setScope(payload.scope);
        setSummaryError(null);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setFinanceSummary(null);
        setSummaryError(
          getFinanceErrorMessage(
            error,
            "Ringkasan keuangan cabang belum berhasil dimuat.",
          ),
        );
      } finally {
        if (!isCancelled) {
          setSummaryLoading(false);
        }
      }
    }

    void loadFinanceSummary();

    return () => {
      isCancelled = true;
    };
  }, [selectedBranchQuery, dateFrom, dateTo, refreshKey]);

  useEffect(() => {
    let isCancelled = false;

    async function loadExpenses() {
      setExpensesLoading(true);

      try {
        const payload = await fetchAdminExpenses({
          q: normalizedSearchQuery || undefined,
          branch: selectedBranchQuery,
          category:
            expenseCategoryFilter === allExpenseCategoryValue
              ? undefined
              : (expenseCategoryFilter as AdminExpenseCategory),
          status:
            expenseStatusFilter === allExpenseStatusValue
              ? undefined
              : (expenseStatusFilter as AdminExpenseStatus),
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        });

        if (isCancelled) {
          return;
        }

        setExpenses(payload.expenses);
        setScope(payload.scope);
        setExpensesError(null);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setExpenses([]);
        setExpensesError(
          getFinanceErrorMessage(
            error,
            "Pengeluaran cabang belum berhasil dimuat.",
          ),
        );
      } finally {
        if (!isCancelled) {
          setExpensesLoading(false);
        }
      }
    }

    void loadExpenses();

    return () => {
      isCancelled = true;
    };
  }, [
    normalizedSearchQuery,
    selectedBranchQuery,
    dateFrom,
    dateTo,
    expenseStatusFilter,
    expenseCategoryFilter,
    refreshKey,
  ]);

  function closeExpenseFormDialog() {
    setIsExpenseFormOpen(false);
    setEditingExpense(null);
    setExpenseFormValues(createEmptyExpenseForm());
    setExpenseFormError(null);
  }

  function handleOpenCreateExpense() {
    if (!canManageExpenses) {
      return;
    }

    setEditingExpense(null);
    setExpenseFormValues(createEmptyExpenseForm());
    setExpenseFormError(null);
    setIsExpenseFormOpen(true);
  }

  function handleOpenEditExpense(expense: AdminExpense) {
    if (!canManageExpenses) {
      setSelectedExpenseDetail(expense);
      return;
    }

    setEditingExpense(expense);
    setExpenseFormValues(toExpenseFormValues(expense));
    setExpenseFormError(null);
    setIsExpenseFormOpen(true);
  }

  async function handleExpenseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManageExpenses) {
      setExpenseFormError("Owner hanya dapat memantau detail pengeluaran.");
      return;
    }

    setExpenseFormError(null);
    setFeedback(null);

    const title = normalizeText(expenseFormValues.title);
    const vendorOrRecipient = normalizeText(expenseFormValues.vendorOrRecipient);
    const paymentMethod = normalizeText(expenseFormValues.paymentMethod);
    const amount = parsePositiveAmount(expenseFormValues.amount);

    if (!title) {
      setExpenseFormError("Judul pengeluaran wajib diisi.");
      return;
    }

    if (!vendorOrRecipient) {
      setExpenseFormError("Vendor atau penerima wajib diisi.");
      return;
    }

    if (!paymentMethod) {
      setExpenseFormError("Metode pembayaran wajib diisi.");
      return;
    }

    if (amount === null) {
      setExpenseFormError("Nominal pengeluaran wajib berupa angka positif.");
      return;
    }

    const payload: AdminExpenseMutationPayload = {
      title,
      branch: selectedBranchQuery || primaryManagedBranch || undefined,
      category: expenseFormValues.category,
      vendorOrRecipient,
      amount,
      paymentMethod,
      status: expenseFormValues.status,
      paidAt: expenseFormValues.paidAt || null,
      dueDate: expenseFormValues.dueDate || null,
      note: normalizeText(expenseFormValues.note) || null,
    };

    setIsExpenseSubmitting(true);

    try {
      if (editingExpense) {
        await updateAdminExpense(editingExpense.id, payload);
        setFeedback({
          tone: "success",
          message: "Pengeluaran cabang berhasil diperbarui.",
        });
      } else {
        await createAdminExpense(payload);
        setFeedback({
          tone: "success",
          message: "Pengeluaran cabang berhasil ditambahkan.",
        });
      }

      closeExpenseFormDialog();
      setRefreshKey((currentValue) => currentValue + 1);
      void Promise.resolve(onRefresh?.());
    } catch (error) {
      setExpenseFormError(
        getFinanceErrorMessage(
          error,
          "Pengeluaran cabang belum berhasil disimpan.",
        ),
      );
    } finally {
      setIsExpenseSubmitting(false);
    }
  }

  async function handleDeleteExpense() {
    if (!canManageExpenses) {
      setExpenseToDelete(null);
      return;
    }

    if (!expenseToDelete) {
      return;
    }

    setIsExpenseDeleting(true);
    setFeedback(null);

    try {
      await deleteAdminExpense(expenseToDelete.id);
      setFeedback({
        tone: "warning",
        message: `Pengeluaran ${expenseToDelete.expenseId} berhasil dihapus.`,
      });
      setExpenseToDelete(null);
      setRefreshKey((currentValue) => currentValue + 1);
      void Promise.resolve(onRefresh?.());
    } catch (error) {
      setFeedback({
        tone: "warning",
        message: getFinanceErrorMessage(
          error,
          "Pengeluaran cabang belum berhasil dihapus.",
        ),
      });
    } finally {
      setIsExpenseDeleting(false);
    }
  }

  function handleResetFilters() {
    setSelectedBranch(allBranchesValue);
    setDateFrom("");
    setDateTo("");
    setExpenseStatusFilter(allExpenseStatusValue);
    setExpenseCategoryFilter(allExpenseCategoryValue);
    setFeedback(null);
  }

  const expenseColumns: AdminColumnDefinition<AdminExpense>[] = [
    {
      key: "expense",
      header: "Pengeluaran",
      className: "min-w-[260px]",
      cell: (expense) => (
        <div className="space-y-1">
          <p className="font-semibold text-slate-950">{expense.title}</p>
          <p className="text-xs text-slate-500">
            {expense.expenseId} | {expense.branch}
          </p>
        </div>
      ),
    },
    {
      key: "recipient",
      header: "Penerima",
      className: "min-w-[240px]",
      cell: (expense) => (
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-800">
            {expense.vendorOrRecipient}
          </p>
          <p className="text-xs text-slate-500">{expense.category}</p>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Nominal",
      className: "min-w-[160px]",
      cell: (expense) => (
        <div className="text-sm font-semibold text-rose-700">
          {formatCurrency(expense.amount)}
        </div>
      ),
    },
    {
      key: "method",
      header: "Metode",
      className: "min-w-[170px]",
      cell: (expense) => (
        <span className="text-sm text-slate-700">{expense.paymentMethod}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      className: "min-w-[140px]",
      cell: (expense) => (
        <AdminStatusBadge
          status={expense.status}
          tone={getFinanceStatusTone(expense.status)}
        />
      ),
    },
    {
      key: "date",
      header: "Jadwal / Bayar",
      className: "min-w-[200px]",
      cell: (expense) => (
        <div className="space-y-1 text-sm text-slate-700">
          <p>Bayar: {formatDateLabel(expense.paidAt)}</p>
          <p>Jatuh tempo: {formatDateLabel(expense.dueDate)}</p>
          <p className="text-xs text-slate-500">
            Update {formatDateTimeLabel(expense.updatedAt)}
          </p>
        </div>
      ),
    },
    {
      key: "actions",
      header: "Aksi",
      className: "min-w-[140px]",
      cell: (expense) => (
        <div className="flex items-center justify-center gap-2">
          {canManageExpenses ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-9 rounded-xl text-orange-600"
                onClick={() => handleOpenEditExpense(expense)}
              >
                <Pencil className="size-4" />
                <span className="sr-only">Edit pengeluaran</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-9 rounded-xl border-rose-200 text-rose-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
                onClick={() => setExpenseToDelete(expense)}
              >
                <Trash2 className="size-4" />
                <span className="sr-only">Hapus pengeluaran</span>
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9 rounded-xl text-slate-600 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700"
              title="Lihat detail pengeluaran"
              onClick={() => setSelectedExpenseDetail(expense)}
            >
              <Eye className="size-4" />
              <span className="sr-only">Detail pengeluaran</span>
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="space-y-6">
        {!compactSummary ? (
          <AdminSectionCard
            title="Keuangan Cabang"
            description="Pantau pemasukan membership secara read-only dan kelola pengeluaran operasional cabang tanpa mengubah flow payment online."
            action={
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Badge
                  variant="secondary"
                  className="bg-orange-50 text-orange-700"
                >
                  {selectedBranchLabel}
                </Badge>
                {summaryLoading && !scope ? (
                  <Skeleton className="h-6 w-32 rounded-full" />
                ) : (
                  <Badge
                    variant="secondary"
                    className="bg-slate-100 text-slate-700"
                  >
                    {scope?.role === "admin" ? "Scope Admin Cabang" : "Scope Owner"}
                  </Badge>
                )}
              </div>
            }
          >
            <div className="space-y-6">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <div className="rounded-[22px] border border-orange-100 bg-[linear-gradient(135deg,rgba(255,247,237,0.98),rgba(255,255,255,0.98))] p-5 shadow-[0_18px_32px_-26px_rgba(249,115,22,0.22)] lg:col-span-3">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-500">
                        Arah Scope
                      </p>
                      <h3 className="text-xl font-semibold tracking-tight text-slate-950">
                        Admin hanya mencatat pengeluaran cabang
                      </h3>
                      <p className="max-w-3xl text-sm leading-6 text-slate-600">
                        Pemasukan tetap berasal dari payment membership dan
                        detail verifikasinya tetap mengikuti menu Pembayaran.
                        Menu Keuangan ini difokuskan untuk pencatatan
                        pengeluaran cabang dan membaca ringkasan saldo secara
                        aman.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="bg-white/90 text-slate-700"
                      >
                        Membership: read-only
                      </Badge>
                      <Badge
                        variant="secondary"
                        className="bg-white/90 text-slate-700"
                      >
                        Pengeluaran: CRUD operasional cabang
                      </Badge>
                    </div>
                  </div>
                </div>

                <FinanceField label="Cabang">
                  <Select
                    value={selectedBranch}
                    onValueChange={setSelectedBranch}
                    disabled={!canSelectBranch}
                  >
                    <SelectTrigger className={warmSelectTriggerClassName}>
                      <SelectValue
                        placeholder={
                          canSelectBranch ? "Pilih cabang" : selectedBranchLabel
                        }
                      />
                    </SelectTrigger>
                    <SelectContent className={warmSelectContentClassName}>
                      <SelectItem
                        value={allBranchesValue}
                        className={warmSelectItemClassName}
                      >
                        Semua cabang yang saya kelola
                      </SelectItem>
                      {managedBranches.map((branch) => (
                        <SelectItem
                          key={branch}
                          value={branch}
                          className={warmSelectItemClassName}
                        >
                          {branch}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FinanceField>

                <FinanceField label="Periode dari">
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(event) => setDateFrom(event.target.value)}
                    className={warmFieldClassName}
                  />
                </FinanceField>

                <FinanceField label="Sampai">
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(event) => setDateTo(event.target.value)}
                    className={warmFieldClassName}
                  />
                </FinanceField>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className={cn("gap-2", warmOutlineButtonClassName)}
                  onClick={handleResetFilters}
                >
                  <RotateCcw className="size-4" />
                  Reset filter
                </Button>

                {summaryLoading || expensesLoading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <LoaderCircle className="size-4 animate-spin" />
                    Menyegarkan data keuangan cabang...
                  </div>
                ) : null}
              </div>

              {feedback ? (
                <div
                  className={cn(
                    "rounded-[20px] border px-4 py-3 text-sm shadow-sm",
                    feedback.tone === "success"
                      ? "border-emerald-100 bg-emerald-50/80 text-emerald-700"
                      : "border-amber-100 bg-amber-50/80 text-amber-700",
                  )}
                >
                  {feedback.message}
                </div>
              ) : null}

              {summaryError ? (
                <div className="rounded-[20px] border border-rose-100 bg-rose-50/80 px-4 py-3 text-sm text-rose-700">
                  {summaryError}
                </div>
              ) : null}

              <div className="grid gap-4 xl:grid-cols-4">
                <FinanceMetricCard
                  title="Membership Paid"
                  value={formatCurrency(membershipPaidAmount)}
                  helper={`Terkonfirmasi ${membershipPaidCount} transaksi membership.`}
                  tone="emerald"
                  icon={WalletCards}
                  isLoading={summaryLoading && !financeSummary}
                />
                <FinanceMetricCard
                  title="Membership Pending"
                  value={formatCurrency(membershipPendingAmount)}
                  helper={`Masih menunggu ${membershipPendingCount} transaksi di flow pembayaran.`}
                  tone="amber"
                  icon={Landmark}
                  isLoading={summaryLoading && !financeSummary}
                />
                <FinanceMetricCard
                  title="Pengeluaran Selesai"
                  value={formatCurrency(expenseSettledAmount)}
                  helper={`Sudah dibayar ${expenseSettledCount} transaksi cabang.`}
                  tone="orange"
                  icon={ArrowDownCircle}
                  isLoading={summaryLoading && !financeSummary}
                />
                <FinanceMetricCard
                  title="Saldo Operasional"
                  value={formatCurrency(branchBalanceAmount)}
                  helper={`Membership paid dikurangi pengeluaran selesai. Pengeluaran pending: ${formatCurrency(expensePendingAmount)} dari ${expensePendingCount} transaksi.`}
                  tone="slate"
                  icon={Landmark}
                  isLoading={summaryLoading && !financeSummary}
                />
              </div>
            </div>
          </AdminSectionCard>
        ) : null}

        <AdminSectionCard
          title="Pengeluaran Cabang"
          description={
            canManageExpenses
              ? "Tambah, ubah, dan hapus pengeluaran operasional untuk cabang yang dikelola admin."
              : "Owner hanya memantau detail pengeluaran operasional cabang tanpa aksi edit atau hapus."
          }
          action={
            canManageExpenses ? (
              <Button
                type="button"
                className={cn("gap-2", warmPrimaryButtonClassName)}
                onClick={handleOpenCreateExpense}
              >
                <Plus className="size-4" />
                Tambah Pengeluaran
              </Button>
            ) : null
          }
        >
          <div className="space-y-6">
            {compactSummary && (summaryLoading || expensesLoading) ? (
              <AdminSummaryLineSkeleton className="rounded-[20px] border border-slate-200 bg-slate-50/80 px-4 py-3" badges={2} />
            ) : null}

            {compactSummary && feedback ? (
              <div
                className={cn(
                  "rounded-[20px] border px-4 py-3 text-sm shadow-sm",
                  feedback.tone === "success"
                    ? "border-emerald-100 bg-emerald-50/80 text-emerald-700"
                    : "border-amber-100 bg-amber-50/80 text-amber-700",
                )}
              >
                {feedback.message}
              </div>
            ) : null}

            {compactSummary && summaryError ? (
              <div className="rounded-[20px] border border-rose-100 bg-rose-50/80 px-4 py-3 text-sm text-rose-700">
                {summaryError}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3 md:flex md:flex-wrap md:items-end">
              <div className="w-full md:flex-1">
                <FinanceField label="Kategori">
                  <Select
                    value={expenseCategoryFilter}
                    onValueChange={setExpenseCategoryFilter}
                  >
                    <SelectTrigger className={warmSelectTriggerClassName}>
                      <SelectValue placeholder="Semua kategori pengeluaran" />
                    </SelectTrigger>
                    <SelectContent className={warmSelectContentClassName}>
                      <SelectItem
                        value={allExpenseCategoryValue}
                        className={warmSelectItemClassName}
                      >
                        Semua kategori
                      </SelectItem>
                      {adminExpenseCategoryOptions.map((category) => (
                        <SelectItem
                          key={category}
                          value={category}
                          className={warmSelectItemClassName}
                        >
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FinanceField>
              </div>

              <div className="w-full md:flex-1">
                <FinanceField label="Status">
                  <Select
                    value={expenseStatusFilter}
                    onValueChange={setExpenseStatusFilter}
                  >
                    <SelectTrigger className={warmSelectTriggerClassName}>
                      <SelectValue placeholder="Semua status" />
                    </SelectTrigger>
                    <SelectContent className={warmSelectContentClassName}>
                      <SelectItem
                        value={allExpenseStatusValue}
                        className={warmSelectItemClassName}
                      >
                        Semua status
                      </SelectItem>
                      {adminExpenseStatusOptions.map((status) => (
                        <SelectItem
                          key={status}
                          value={status}
                          className={warmSelectItemClassName}
                        >
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FinanceField>
              </div>

              <div className="col-span-2 flex w-full items-end md:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  className={cn("w-full gap-2", warmOutlineButtonClassName)}
                  onClick={() => {
                    setExpenseCategoryFilter(allExpenseCategoryValue);
                    setExpenseStatusFilter(allExpenseStatusValue);
                  }}
                >
                  <RotateCcw className="size-4" />
                  Reset filter
                </Button>
              </div>
            </div>

            {expensesError ? (
              <div className="rounded-[20px] border border-rose-100 bg-rose-50/80 px-4 py-3 text-sm text-rose-700">
                {expensesError}
              </div>
            ) : null}

            <AdminDataTable
              columns={expenseColumns}
              data={visibleExpenses}
              keyExtractor={(expense) => expense.id}
              emptyTitle="Belum ada pengeluaran cabang"
              emptyDescription="Pengeluaran yang cocok dengan filter aktif akan muncul di sini."
              minWidthClassName="min-w-[1080px]"
              isLoading={expensesLoading && expenses.length === 0}
            />

            <AdminPaginationFooter
              page={expensePage}
              totalPages={expenseTotalPages}
              totalItems={expenses.length}
              visibleCount={visibleExpenses.length}
              limit={listPageSize}
              isLoading={expensesLoading}
              label="pengeluaran"
              onPrevious={() =>
                setExpensePagination({
                  page: Math.max(1, expensePage - 1),
                  filterKey: expenseFilterKey,
                })
              }
              onNext={() =>
                setExpensePagination({
                  page: Math.min(expenseTotalPages, expensePage + 1),
                  filterKey: expenseFilterKey,
                })
              }
            />
          </div>
        </AdminSectionCard>
      </div>

      <Dialog
        open={Boolean(selectedExpenseDetail)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedExpenseDetail(null);
          }
        }}
      >
        <DialogContent className={cn("max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] sm:max-w-2xl", warmOverlayPanelClassName)}>
          <DialogHeader>
            <DialogTitle>Detail Pengeluaran Cabang</DialogTitle>
            <DialogDescription>
              Owner hanya memantau detail pengeluaran operasional cabang.
            </DialogDescription>
          </DialogHeader>

          {selectedExpenseDetail ? (
            <div className="grid grid-cols-2 gap-3">
              <FinanceDetailItem
                label="ID"
                value={selectedExpenseDetail.expenseId}
              />
              <FinanceDetailItem
                label="Cabang"
                value={selectedExpenseDetail.branch}
              />
              <FinanceDetailItem
                label="Judul"
                value={selectedExpenseDetail.title}
              />
              <FinanceDetailItem
                label="Penerima"
                value={selectedExpenseDetail.vendorOrRecipient}
              />
              <FinanceDetailItem
                label="Kategori"
                value={selectedExpenseDetail.category}
              />
              <FinanceDetailItem
                label="Metode"
                value={selectedExpenseDetail.paymentMethod}
              />
              <FinanceDetailItem
                label="Nominal"
                value={formatCurrency(selectedExpenseDetail.amount)}
              />
              <FinanceDetailItem
                label="Status"
                value={selectedExpenseDetail.status}
              />
              <FinanceDetailItem
                label="Tanggal dibayar"
                value={formatDateLabel(selectedExpenseDetail.paidAt)}
              />
              <FinanceDetailItem
                label="Jatuh tempo"
                value={formatDateLabel(selectedExpenseDetail.dueDate)}
              />
              <FinanceDetailItem
                label="Terakhir diperbarui"
                value={formatDateTimeLabel(selectedExpenseDetail.updatedAt)}
              />
              <FinanceDetailItem
                label="Catatan"
                value={selectedExpenseDetail.note || "-"}
                className="sm:col-span-2"
              />
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedExpenseDetail(null)}
              className={warmOutlineButtonClassName}
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={canManageExpenses && isExpenseFormOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeExpenseFormDialog();
            return;
          }

          setIsExpenseFormOpen(true);
        }}
      >
        <DialogContent
          className={cn(
            "w-[calc(100%-1rem)] max-w-2xl p-0 sm:w-[calc(100%-2rem)]",
            warmOverlayPanelClassName,
          )}
        >
          <form
            className="flex max-h-[min(88vh,820px)] flex-col overflow-hidden"
            onSubmit={handleExpenseSubmit}
          >
            <DialogHeader className="shrink-0 border-b border-slate-200/70 px-5 pb-4 pt-5 sm:px-6 sm:pb-5 sm:pt-6">
              <DialogTitle>
                {isEditingExpense
                  ? "Perbarui Pengeluaran Operasional"
                  : "Tambah Pengeluaran Operasional"}
              </DialogTitle>
              <DialogDescription>
                Biaya operasional ini akan tercatat pada cabang{" "}
                <span className="font-medium text-slate-700">
                  {selectedBranchLabel}
                </span>{" "}
                tanpa mengganggu sistem utama.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-5 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5">
              <div className="grid gap-4 sm:grid-cols-2">
              <FinanceField label="Judul pengeluaran">
                <Input
                  value={expenseFormValues.title}
                  onChange={(event) =>
                    setExpenseFormValues((currentValue) => ({
                      ...currentValue,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Contoh: Tagihan listrik Mei 2026"
                  className={warmFieldClassName}
                />
              </FinanceField>

              <FinanceField label="Kategori">
                <Select
                  value={expenseFormValues.category}
                  onValueChange={(value) =>
                    setExpenseFormValues((currentValue) => ({
                      ...currentValue,
                      category: value as AdminUiExpenseCategory,
                    }))
                  }
                >
                  <SelectTrigger className={warmSelectTriggerClassName}>
                    <SelectValue placeholder="Pilih kategori" />
                  </SelectTrigger>
                  <SelectContent className={warmSelectContentClassName}>
                    {adminExpenseCategoryOptions.map((category) => (
                      <SelectItem
                        key={category}
                        value={category}
                        className={warmSelectItemClassName}
                      >
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FinanceField>

              <FinanceField label="Vendor atau penerima">
                <Input
                  value={expenseFormValues.vendorOrRecipient}
                  onChange={(event) =>
                    setExpenseFormValues((currentValue) => ({
                      ...currentValue,
                      vendorOrRecipient: event.target.value,
                    }))
                  }
                  placeholder="Contoh: PLN, Indihome, pemilik ruko, atau vendor"
                  className={warmFieldClassName}
                />
              </FinanceField>

              <FinanceField label="Nominal">
                <Input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={expenseFormValues.amount}
                  onChange={(event) =>
                    setExpenseFormValues((currentValue) => ({
                      ...currentValue,
                      amount: event.target.value,
                    }))
                  }
                  placeholder="250000"
                  className={warmFieldClassName}
                />
              </FinanceField>

              <FinanceField label="Metode pembayaran">
                <Input
                  value={expenseFormValues.paymentMethod}
                  onChange={(event) =>
                    setExpenseFormValues((currentValue) => ({
                      ...currentValue,
                      paymentMethod: event.target.value,
                    }))
                  }
                  placeholder="Contoh: Transfer BCA, tunai, VA, atau QRIS"
                  className={warmFieldClassName}
                />
              </FinanceField>

              <FinanceField label="Status">
                <Select
                  value={expenseFormValues.status}
                  onValueChange={(value) =>
                    setExpenseFormValues((currentValue) => ({
                      ...currentValue,
                      status: value as AdminExpenseStatus,
                    }))
                  }
                >
                  <SelectTrigger className={warmSelectTriggerClassName}>
                    <SelectValue placeholder="Pilih status" />
                  </SelectTrigger>
                  <SelectContent className={warmSelectContentClassName}>
                    {adminExpenseStatusOptions.map((status) => (
                      <SelectItem
                        key={status}
                        value={status}
                        className={warmSelectItemClassName}
                      >
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FinanceField>

              <FinanceField label="Tanggal dibayar">
                <Input
                  type="date"
                  value={expenseFormValues.paidAt}
                  onChange={(event) =>
                    setExpenseFormValues((currentValue) => ({
                      ...currentValue,
                      paidAt: event.target.value,
                    }))
                  }
                  className={warmFieldClassName}
                />
              </FinanceField>

              <FinanceField label="Jatuh tempo">
                <Input
                  type="date"
                  value={expenseFormValues.dueDate}
                  onChange={(event) =>
                    setExpenseFormValues((currentValue) => ({
                      ...currentValue,
                      dueDate: event.target.value,
                    }))
                  }
                  className={warmFieldClassName}
                />
              </FinanceField>

                <div className="sm:col-span-2">
                  <FinanceField label="Catatan">
                    <Textarea
                      value={expenseFormValues.note}
                      onChange={(event) =>
                        setExpenseFormValues((currentValue) => ({
                          ...currentValue,
                          note: event.target.value,
                        }))
                      }
                      placeholder="Tambahkan catatan pengeluaran, nomor bukti, atau konteks cabang jika perlu."
                      rows={4}
                      className={warmFieldClassName}
                    />
                  </FinanceField>
                </div>
              </div>

              {expenseFormError ? (
                <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50/80 px-4 py-3 text-sm text-rose-700">
                  {expenseFormError}
                </div>
              ) : null}
            </div>

            <DialogFooter className="shrink-0 border-t border-slate-200/70 bg-white px-5 py-4 sm:px-6">
              <Button
                type="button"
                variant="outline"
                onClick={closeExpenseFormDialog}
                className={warmOutlineButtonClassName}
              >
                Batal
              </Button>
              <Button
                type="submit"
                className={warmPrimaryButtonClassName}
                disabled={isExpenseSubmitting}
              >
                {isExpenseSubmitting ? (
                  <>
                    <LoaderCircle className="mr-2 size-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : isEditingExpense ? (
                  "Simpan perubahan"
                ) : (
                  "Tambah pengeluaran"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={canManageExpenses && Boolean(expenseToDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setExpenseToDelete(null);
          }
        }}
      >
        <DialogContent className={cn("max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] sm:max-w-md", warmOverlayPanelClassName)}>
          <DialogHeader>
            <DialogTitle>Hapus Pengeluaran Cabang?</DialogTitle>
            <DialogDescription>
              Data pengeluaran{" "}
              <span className="font-medium text-slate-700">
                {expenseToDelete?.expenseId ?? "-"}
              </span>{" "}
              akan dihapus dari pencatatan cabang ini.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
            Tindakan ini tidak memengaruhi flow pembayaran membership, tetapi
            akan menghapus catatan pengeluaran operasional dari dashboard admin.
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setExpenseToDelete(null)}
              className={warmOutlineButtonClassName}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteExpense}
              disabled={isExpenseDeleting}
            >
              {isExpenseDeleting ? (
                <>
                  <LoaderCircle className="mr-2 size-4 animate-spin" />
                  Menghapus...
                </>
              ) : (
                "Hapus pengeluaran"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
