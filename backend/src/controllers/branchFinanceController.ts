import type { Request, Response } from "express";

import { BranchIncome, type BranchIncomeDocument } from "../models/BranchIncome";
import { Expense, type ExpenseDocument } from "../models/Expense";
import { Payment } from "../models/Payment";
import { Student, type StudentDocument } from "../models/Student";
import { User } from "../models/User";
import asyncHandler from "../utils/asyncHandler";
import { AppError, sendSuccess } from "../utils/apiResponse";
import {
  buildScopeBranchQuery,
  resolveAccessibleBranchName,
  resolveFinanceBranchScope,
  toPublicFinanceScope,
  type FinanceBranchScope,
} from "../utils/branchFinanceScope";

type BranchFinanceSummaryQuery = {
  branch?: string;
  dateFrom?: string;
  dateTo?: string;
};

type BranchFinanceTransactionsQuery = BranchFinanceSummaryQuery & {
  q?: string;
  kind?: string;
  category?: string;
  status?: string;
};

const FINANCE_TRANSACTION_KINDS = [
  "membership_income",
  "manual_income",
  "expense",
] as const;

type FinanceTransactionKind = (typeof FINANCE_TRANSACTION_KINDS)[number];

type FinanceTransaction = {
  id: string;
  kind: FinanceTransactionKind;
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
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
  note: string;
  actorName: string;
  actorEmail: string | null;
  studentId: string | null;
  program: string | null;
  className: string | null;
};

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function tokenizeSearchQuery(value: string | undefined) {
  return normalizeText(value)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function matchesSearchQuery(tokens: string[], values: string[]) {
  if (!tokens.length) {
    return true;
  }

  const normalizedValues = values.map((value) => value.toLowerCase());

  return tokens.every((token) =>
    normalizedValues.some((value) => value.includes(token)),
  );
}

function parseOptionalDateInput(
  value: string | null | undefined,
  fieldLabel: string,
) {
  if (value === undefined) {
    return undefined;
  }

  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return null;
  }

  const parsedDate = new Date(normalizedValue);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new AppError(400, `${fieldLabel} belum valid.`);
  }

  return parsedDate;
}

function isFinanceTransactionKind(value: string): value is FinanceTransactionKind {
  return FINANCE_TRANSACTION_KINDS.includes(value as FinanceTransactionKind);
}

function matchesFinanceStatusFilter(
  transaction: FinanceTransaction,
  filterValue: string,
) {
  if (!filterValue) {
    return true;
  }

  const normalizedStatus = normalizeText(transaction.status).toLowerCase();

  if (transaction.kind === "expense" && filterValue === "menunggu") {
    return normalizedStatus === "menunggu" || normalizedStatus === "dijadwalkan";
  }

  return normalizedStatus === filterValue;
}

function toDocumentIdString(value: { toString: () => string } | string | null | undefined) {
  if (!value) {
    return "";
  }

  return typeof value === "string" ? value : value.toString();
}

function readStudentBranch(student: StudentDocument | null) {
  const branch = normalizeText(student?.branch);
  return branch || "Belum diatur";
}

function getBranchIncomeDisplayDate(income: BranchIncomeDocument) {
  return income.receivedAt ?? income.updatedAt ?? income.createdAt;
}

function getExpenseDisplayDate(expense: ExpenseDocument) {
  return expense.paidAt ?? expense.updatedAt ?? expense.createdAt;
}

async function buildFinanceTransactions(
  scope: FinanceBranchScope,
  branchName: string | null | undefined,
) {
  const resolvedBranchName = resolveAccessibleBranchName(branchName, scope);
  const scopedBranchQuery = buildScopeBranchQuery(scope, resolvedBranchName);
  const studentBranchQuery = buildScopeBranchQuery(scope, resolvedBranchName);
  const [payments, manualIncomes, expenses, students] = await Promise.all([
    Payment.find({ archivedAt: null }).sort({ createdAt: -1, _id: -1 }).exec(),
    BranchIncome.find(scopedBranchQuery).sort({ createdAt: -1, _id: -1 }).exec(),
    Expense.find({ ...scopedBranchQuery, archivedAt: null })
      .sort({ createdAt: -1, _id: -1 })
      .exec(),
    Student.find(studentBranchQuery)
      .select("_id userId studentId branch program className")
      .exec(),
  ]);

  const studentById = new Map(students.map((student) => [student._id.toString(), student]));
  const relevantPayments = payments.filter((payment) => {
    const student = studentById.get(toDocumentIdString(payment.studentId)) ?? null;

    if (student) {
      return true;
    }

    return !scope.isScopedToManagedBranches && !resolvedBranchName;
  });
  const userIds = new Set<string>();

  for (const payment of relevantPayments) {
    const userId = toDocumentIdString(payment.userId);

    if (userId) {
      userIds.add(userId);
    }
  }

  for (const student of students) {
    const userId = toDocumentIdString(student.userId);

    if (userId) {
      userIds.add(userId);
    }
  }

  const users = userIds.size
    ? await User.find({
        _id: {
          $in: [...userIds],
        },
      })
        .select("_id nama email")
        .exec()
    : [];
  const userById = new Map(users.map((user) => [user._id.toString(), user]));

  const membershipTransactions: FinanceTransaction[] = relevantPayments.map((payment) => {
    const student = studentById.get(toDocumentIdString(payment.studentId)) ?? null;
    const user =
      userById.get(toDocumentIdString(payment.userId)) ??
      (student ? userById.get(toDocumentIdString(student.userId)) : null) ??
      null;

    return {
      id: payment._id.toString(),
      kind: "membership_income",
      direction: "in",
      referenceId: payment.paymentId,
      title: normalizeText(payment.packageName) || "Pembayaran Membership",
      branch: readStudentBranch(student),
      category: "Membership Online",
      amount: payment.amount,
      status: payment.status,
      paymentMethod: normalizeText(payment.method) || normalizeText(payment.provider) || "-",
      source: payment.source,
      sourceLabel:
        payment.source === "admin" ? "Membership Admin" : "Membership Register Online",
      isReadOnly: true,
      canEdit: false,
      canDelete: false,
      occurredAt: payment.paidAt ?? payment.createdAt,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      note: "",
      actorName: user?.nama ?? "Siswa tidak ditemukan",
      actorEmail: user?.email ?? null,
      studentId: student?.studentId ?? null,
      program: normalizeText(student?.program) || null,
      className: normalizeText(student?.className) || null,
    };
  });

  const manualIncomeTransactions: FinanceTransaction[] = manualIncomes.map((income) => ({
    id: income._id.toString(),
    kind: "manual_income",
    direction: "in",
    referenceId: income.incomeId,
    title: normalizeText(income.title) || income.incomeId,
    branch: normalizeText(income.branch) || "Pusat",
    category: normalizeText(income.category) || "Pemasukan Manual",
    amount: income.amount,
    status: income.status,
    paymentMethod: normalizeText(income.paymentMethod) || "-",
    source: "manual_income",
    sourceLabel: "Pemasukan Manual Cabang",
    isReadOnly: false,
    canEdit: true,
    canDelete: true,
    occurredAt: getBranchIncomeDisplayDate(income),
    createdAt: income.createdAt,
    updatedAt: income.updatedAt,
    note: normalizeText(income.note),
    actorName: normalizeText(income.payerOrSource) || "-",
    actorEmail: null,
    studentId: null,
    program: null,
    className: null,
  }));

  const expenseTransactions: FinanceTransaction[] = expenses.map((expense) => ({
    id: expense._id.toString(),
    kind: "expense",
    direction: "out",
    referenceId: expense.expenseId,
    title: normalizeText(expense.title) || expense.expenseId,
    branch: normalizeText(expense.branch) || "Pusat",
    category: expense.category,
    amount: expense.amount,
    status: expense.status,
    paymentMethod: normalizeText(expense.paymentMethod) || "-",
    source: "expense",
    sourceLabel: "Pengeluaran Manual Cabang",
    isReadOnly: false,
    canEdit: true,
    canDelete: true,
    occurredAt: getExpenseDisplayDate(expense),
    createdAt: expense.createdAt,
    updatedAt: expense.updatedAt,
    note: normalizeText(expense.note),
    actorName: normalizeText(expense.vendorOrRecipient) || "-",
    actorEmail: null,
    studentId: null,
    program: null,
    className: null,
  }));

  const transactions = [
    ...membershipTransactions,
    ...manualIncomeTransactions,
    ...expenseTransactions,
  ].sort((left, right) => {
    const timeDifference = right.occurredAt.getTime() - left.occurredAt.getTime();

    if (timeDifference !== 0) {
      return timeDifference;
    }

    return right.createdAt.getTime() - left.createdAt.getTime();
  });

  return {
    resolvedBranchName,
    transactions,
  };
}

function filterFinanceTransactions(
  transactions: FinanceTransaction[],
  query: BranchFinanceTransactionsQuery,
) {
  const searchTokens = tokenizeSearchQuery(query.q);
  const kindFilter = normalizeText(query.kind);
  const categoryFilter = normalizeText(query.category).toLowerCase();
  const statusFilter = normalizeText(query.status).toLowerCase();
  const dateFrom = parseOptionalDateInput(query.dateFrom, "dateFrom");
  const dateTo = parseOptionalDateInput(query.dateTo, "dateTo");

  if (kindFilter && !isFinanceTransactionKind(kindFilter)) {
    throw new AppError(400, "Jenis transaksi keuangan belum valid.");
  }

  if (dateFrom && dateTo && dateFrom.getTime() > dateTo.getTime()) {
    throw new AppError(400, "dateFrom tidak boleh lebih besar dari dateTo.");
  }

  return transactions.filter((transaction) => {
    const matchesKind = kindFilter ? transaction.kind === kindFilter : true;
    const matchesCategory = categoryFilter
      ? normalizeText(transaction.category).toLowerCase() === categoryFilter
      : true;
    const matchesStatus = matchesFinanceStatusFilter(transaction, statusFilter);
    const matchesQuery = matchesSearchQuery(searchTokens, [
      transaction.referenceId,
      transaction.title,
      transaction.branch,
      transaction.category,
      transaction.paymentMethod,
      transaction.sourceLabel,
      transaction.actorName,
      transaction.actorEmail ?? "",
      transaction.studentId ?? "",
      transaction.program ?? "",
      transaction.className ?? "",
      transaction.note,
    ]);
    const matchesDateFrom = dateFrom
      ? transaction.occurredAt.getTime() >= dateFrom.getTime()
      : true;
    const matchesDateTo = dateTo
      ? transaction.occurredAt.getTime() <= dateTo.getTime()
      : true;

    return (
      matchesKind &&
      matchesCategory &&
      matchesStatus &&
      matchesQuery &&
      matchesDateFrom &&
      matchesDateTo
    );
  });
}

function createBranchSummary(branch: string) {
  return {
    branch,
    transactionCount: 0,
    membership: {
      paidAmount: 0,
      paidCount: 0,
      pendingAmount: 0,
      pendingCount: 0,
      failedOrExpiredCount: 0,
    },
    manualIncome: {
      receivedAmount: 0,
      receivedCount: 0,
      pendingAmount: 0,
      pendingCount: 0,
      canceledCount: 0,
    },
    expense: {
      settledAmount: 0,
      settledCount: 0,
      pendingAmount: 0,
      pendingCount: 0,
      canceledCount: 0,
    },
    totalRealizedIncome: 0,
    totalRealizedExpense: 0,
    netCashflow: 0,
  };
}

export const getBranchFinanceSummary = asyncHandler(
  async (
    req: Request<
      Record<string, string>,
      Record<string, never>,
      Record<string, never>,
      BranchFinanceSummaryQuery
    >,
    res: Response,
  ) => {
    const scope = await resolveFinanceBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    const { resolvedBranchName, transactions } = await buildFinanceTransactions(
      scope,
      req.query.branch,
    );
    const filteredTransactions = filterFinanceTransactions(transactions, req.query);
    const totalSummary = createBranchSummary("Semua Cabang");
    const branchSummaryMap = new Map<string, ReturnType<typeof createBranchSummary>>();
    const manualIncomeCategoryMap = new Map<
      string,
      {
        category: string;
        receivedAmount: number;
        receivedCount: number;
        pendingAmount: number;
        pendingCount: number;
      }
    >();
    const expenseCategoryMap = new Map<
      string,
      {
        category: string;
        settledAmount: number;
        settledCount: number;
        pendingAmount: number;
        pendingCount: number;
      }
    >();

    for (const transaction of filteredTransactions) {
      const branchKey = normalizeText(transaction.branch) || "Pusat";
      const branchSummary =
        branchSummaryMap.get(branchKey) ?? createBranchSummary(branchKey);

      branchSummary.transactionCount += 1;
      totalSummary.transactionCount += 1;

      if (transaction.kind === "membership_income") {
        if (transaction.status === "paid") {
          branchSummary.membership.paidAmount += transaction.amount;
          branchSummary.membership.paidCount += 1;
          totalSummary.membership.paidAmount += transaction.amount;
          totalSummary.membership.paidCount += 1;
        } else if (transaction.status === "pending") {
          branchSummary.membership.pendingAmount += transaction.amount;
          branchSummary.membership.pendingCount += 1;
          totalSummary.membership.pendingAmount += transaction.amount;
          totalSummary.membership.pendingCount += 1;
        } else {
          branchSummary.membership.failedOrExpiredCount += 1;
          totalSummary.membership.failedOrExpiredCount += 1;
        }
      }

      if (transaction.kind === "manual_income") {
        const categoryKey = normalizeText(transaction.category) || "Pemasukan Manual";
        const categorySummary = manualIncomeCategoryMap.get(categoryKey) ?? {
          category: categoryKey,
          receivedAmount: 0,
          receivedCount: 0,
          pendingAmount: 0,
          pendingCount: 0,
        };

        if (transaction.status === "Diterima") {
          branchSummary.manualIncome.receivedAmount += transaction.amount;
          branchSummary.manualIncome.receivedCount += 1;
          totalSummary.manualIncome.receivedAmount += transaction.amount;
          totalSummary.manualIncome.receivedCount += 1;
          categorySummary.receivedAmount += transaction.amount;
          categorySummary.receivedCount += 1;
        } else if (transaction.status === "Menunggu") {
          branchSummary.manualIncome.pendingAmount += transaction.amount;
          branchSummary.manualIncome.pendingCount += 1;
          totalSummary.manualIncome.pendingAmount += transaction.amount;
          totalSummary.manualIncome.pendingCount += 1;
          categorySummary.pendingAmount += transaction.amount;
          categorySummary.pendingCount += 1;
        } else if (transaction.status === "Dibatalkan") {
          branchSummary.manualIncome.canceledCount += 1;
          totalSummary.manualIncome.canceledCount += 1;
        }

        manualIncomeCategoryMap.set(categoryKey, categorySummary);
      }

      if (transaction.kind === "expense") {
        const categoryKey = normalizeText(transaction.category) || "Pengeluaran";
        const categorySummary = expenseCategoryMap.get(categoryKey) ?? {
          category: categoryKey,
          settledAmount: 0,
          settledCount: 0,
          pendingAmount: 0,
          pendingCount: 0,
        };

        if (transaction.status === "Selesai") {
          branchSummary.expense.settledAmount += transaction.amount;
          branchSummary.expense.settledCount += 1;
          totalSummary.expense.settledAmount += transaction.amount;
          totalSummary.expense.settledCount += 1;
          categorySummary.settledAmount += transaction.amount;
          categorySummary.settledCount += 1;
        } else if (
          transaction.status === "Menunggu" ||
          transaction.status === "Dijadwalkan"
        ) {
          branchSummary.expense.pendingAmount += transaction.amount;
          branchSummary.expense.pendingCount += 1;
          totalSummary.expense.pendingAmount += transaction.amount;
          totalSummary.expense.pendingCount += 1;
          categorySummary.pendingAmount += transaction.amount;
          categorySummary.pendingCount += 1;
        } else if (transaction.status === "Dibatalkan") {
          branchSummary.expense.canceledCount += 1;
          totalSummary.expense.canceledCount += 1;
        }

        expenseCategoryMap.set(categoryKey, categorySummary);
      }

      branchSummary.totalRealizedIncome =
        branchSummary.membership.paidAmount + branchSummary.manualIncome.receivedAmount;
      branchSummary.totalRealizedExpense = branchSummary.expense.settledAmount;
      branchSummary.netCashflow =
        branchSummary.totalRealizedIncome - branchSummary.totalRealizedExpense;
      branchSummaryMap.set(branchKey, branchSummary);
    }

    totalSummary.totalRealizedIncome =
      totalSummary.membership.paidAmount + totalSummary.manualIncome.receivedAmount;
    totalSummary.totalRealizedExpense = totalSummary.expense.settledAmount;
    totalSummary.netCashflow =
      totalSummary.totalRealizedIncome - totalSummary.totalRealizedExpense;

    sendSuccess(res, {
      data: {
        scope: toPublicFinanceScope(scope),
        filters: {
          branch: resolvedBranchName || null,
          dateFrom: req.query.dateFrom ?? null,
          dateTo: req.query.dateTo ?? null,
        },
        summary: totalSummary,
        branches: [...branchSummaryMap.values()].sort((left, right) =>
          left.branch.localeCompare(right.branch, "id"),
        ),
        categories: {
          manualIncome: [...manualIncomeCategoryMap.values()].sort((left, right) =>
            left.category.localeCompare(right.category, "id"),
          ),
          expense: [...expenseCategoryMap.values()].sort((left, right) =>
            left.category.localeCompare(right.category, "id"),
          ),
        },
      },
    });
  },
);

export const getBranchFinanceTransactions = asyncHandler(
  async (
    req: Request<
      Record<string, string>,
      Record<string, never>,
      Record<string, never>,
      BranchFinanceTransactionsQuery
    >,
    res: Response,
  ) => {
    const scope = await resolveFinanceBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    const { resolvedBranchName, transactions } = await buildFinanceTransactions(
      scope,
      req.query.branch,
    );
    const filteredTransactions = filterFinanceTransactions(transactions, req.query);

    sendSuccess(res, {
      data: {
        scope: toPublicFinanceScope(scope),
        filters: {
          branch: resolvedBranchName || null,
          kind: normalizeText(req.query.kind) || null,
          category: normalizeText(req.query.category) || null,
          status: normalizeText(req.query.status) || null,
          q: normalizeText(req.query.q) || null,
          dateFrom: req.query.dateFrom ?? null,
          dateTo: req.query.dateTo ?? null,
        },
        transactions: filteredTransactions,
      },
    });
  },
);
