import { Types } from "mongoose";
import type { NextFunction, Request, Response } from "express";

import {
  Expense,
  EXPENSE_CATEGORIES,
  EXPENSE_STATUSES,
  type ExpenseCategory,
  type ExpenseDocument,
  type ExpenseStatus,
} from "../models/Expense";
import asyncHandler from "../utils/asyncHandler";
import { AppError, sendSuccess } from "../utils/apiResponse";
import {
  assertBranchAccess,
  buildScopeBranchQuery,
  resolveAccessibleBranchName,
  resolveFinanceBranchScope,
  toPublicFinanceScope,
} from "../utils/branchFinanceScope";
import { getNextPublicId } from "../utils/publicId";

type ExpenseRequestBody = {
  title?: string;
  branch?: string;
  category?: string;
  vendorOrRecipient?: string;
  amount?: number;
  paymentMethod?: string;
  status?: string;
  paidAt?: string | null;
  dueDate?: string | null;
  note?: string | null;
};

type ExpenseQuery = {
  q?: string;
  branch?: string;
  category?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
};

const archivedExpenseStatusFilter = "Terhapus";

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function isExpenseCategory(value: string): value is ExpenseCategory {
  return EXPENSE_CATEGORIES.includes(value as ExpenseCategory);
}

function isExpenseStatus(value: string): value is ExpenseStatus {
  return EXPENSE_STATUSES.includes(value as ExpenseStatus);
}

function matchesExpenseStatusFilter(
  expenseStatus: ExpenseStatus,
  filterValue: string,
) {
  if (!filterValue) {
    return true;
  }

  if (filterValue === "Menunggu") {
    return expenseStatus === "Menunggu" || expenseStatus === "Dijadwalkan";
  }

  return expenseStatus === filterValue;
}

const hiddenExpenseDetailValue = "Tidak dicatat";

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

function getExpenseDisplayDate(expense: ExpenseDocument) {
  return expense.paidAt ?? expense.updatedAt ?? expense.createdAt;
}

function toPublicExpense(expense: ExpenseDocument) {
  return {
    id: expense._id.toString(),
    expenseId: expense.expenseId,
    title: expense.title,
    branch: expense.branch,
    category: expense.category,
    vendorOrRecipient: expense.vendorOrRecipient,
    amount: expense.amount,
    paymentMethod: expense.paymentMethod,
    status: expense.status,
    paidAt: expense.paidAt,
    dueDate: expense.dueDate,
    note: expense.note,
    createdBy: expense.createdBy,
    updatedBy: expense.updatedBy,
    archivedAt: expense.archivedAt,
    archivedBy: expense.archivedBy,
    archiveReason: expense.archiveReason,
    createdAt: expense.createdAt,
    updatedAt: expense.updatedAt,
  };
}

async function findExpenseByParam(id: string, includeArchived = false) {
  const archiveFilter = includeArchived ? {} : { archivedAt: null };

  return Expense.findOne({
    ...archiveFilter,
    $or: [
      { expenseId: id },
      ...(Types.ObjectId.isValid(id) ? [{ _id: id }] : []),
    ],
  }).exec();
}

function resolveExpensePayload(
  body: ExpenseRequestBody,
  currentExpense?: ExpenseDocument,
) {
  const title =
    body.title === undefined ? currentExpense?.title ?? "" : normalizeText(body.title);
  const branch =
    body.branch === undefined
      ? currentExpense?.branch ?? "Pusat"
      : normalizeText(body.branch) || "Pusat";
  const category =
    body.category === undefined
      ? currentExpense?.category ?? ""
      : normalizeText(body.category);
  const vendorOrRecipient =
    body.vendorOrRecipient === undefined
      ? currentExpense?.vendorOrRecipient ?? ""
      : normalizeText(body.vendorOrRecipient);
  const paymentMethod =
    body.paymentMethod === undefined
      ? currentExpense?.paymentMethod ?? ""
      : normalizeText(body.paymentMethod);
  const status =
    body.status === undefined
      ? currentExpense?.status ?? ""
      : normalizeText(body.status);
  const amount = body.amount === undefined ? currentExpense?.amount : body.amount;
  const paidAtInput = parseOptionalDateInput(body.paidAt, "Tanggal pembayaran");
  const dueDateInput = parseOptionalDateInput(body.dueDate, "Tanggal catatan");
  const note =
    body.note === undefined ? currentExpense?.note ?? "" : normalizeText(body.note);

  if (!title) {
    throw new AppError(400, "Judul pengeluaran wajib diisi.");
  }

  if (!category || !isExpenseCategory(category)) {
    throw new AppError(400, "Kategori pengeluaran belum valid.");
  }

  if (!status || !isExpenseStatus(status)) {
    throw new AppError(400, "Status pengeluaran belum valid.");
  }

  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    throw new AppError(400, "Nominal pengeluaran wajib berupa angka positif.");
  }

  let paidAt = paidAtInput === undefined ? currentExpense?.paidAt ?? null : paidAtInput;
  const dueDate =
    dueDateInput === undefined ? currentExpense?.dueDate ?? null : dueDateInput;

  if (status === "Selesai" && !paidAt) {
    paidAt = new Date();
  }

  return {
    title,
    branch,
    category,
    vendorOrRecipient: vendorOrRecipient || hiddenExpenseDetailValue,
    amount: Math.round(amount),
    paymentMethod: paymentMethod || hiddenExpenseDetailValue,
    status,
    paidAt,
    dueDate,
    note,
  };
}

export const getExpenses = asyncHandler(
  async (
    req: Request<Record<string, string>, Record<string, never>, Record<string, never>, ExpenseQuery>,
    res: Response,
  ) => {
    const scope = await resolveFinanceBranchScope(req.user);
    const categoryFilter = normalizeText(req.query.category);
    const statusFilter = normalizeText(req.query.status);
    const searchQuery = normalizeText(req.query.q).toLowerCase();
    const dateFrom = parseOptionalDateInput(req.query.dateFrom, "dateFrom");
    const dateTo = parseOptionalDateInput(req.query.dateTo, "dateTo");

    if (categoryFilter && !isExpenseCategory(categoryFilter)) {
      throw new AppError(400, "Kategori pengeluaran belum valid.");
    }

    const isArchivedFilter = statusFilter === archivedExpenseStatusFilter;

    if (statusFilter && !isArchivedFilter && !isExpenseStatus(statusFilter)) {
      throw new AppError(400, "Status pengeluaran belum valid.");
    }

    if (dateFrom && dateTo && dateFrom.getTime() > dateTo.getTime()) {
      throw new AppError(400, "dateFrom tidak boleh lebih besar dari dateTo.");
    }

    const branchQuery = buildScopeBranchQuery(scope, req.query.branch);
    const expenses = await Expense.find({
      ...branchQuery,
      archivedAt: isArchivedFilter ? { $ne: null } : null,
    })
      .sort({ createdAt: -1, _id: -1 })
      .exec();

    const filteredExpenses = expenses.filter((expense) => {
      const matchesCategory = categoryFilter ? expense.category === categoryFilter : true;
      const matchesStatus =
        statusFilter && !isArchivedFilter
          ? matchesExpenseStatusFilter(expense.status, statusFilter)
          : true;
      const matchesQuery = searchQuery
        ? [
            expense.expenseId,
            expense.title,
            expense.branch,
            expense.category,
            expense.vendorOrRecipient,
            expense.paymentMethod,
            expense.note,
          ].some((value) => normalizeText(value).toLowerCase().includes(searchQuery))
        : true;
      const displayDate = getExpenseDisplayDate(expense);
      const matchesDateFrom = dateFrom ? displayDate.getTime() >= dateFrom.getTime() : true;
      const matchesDateTo = dateTo ? displayDate.getTime() <= dateTo.getTime() : true;

      return (
        matchesCategory &&
        matchesStatus &&
        matchesQuery &&
        matchesDateFrom &&
        matchesDateTo
      );
    });

    sendSuccess(res, {
      data: {
        expenses: filteredExpenses.map((expense) => toPublicExpense(expense)),
        scope: toPublicFinanceScope(scope),
      },
    });
  },
);

export const getExpenseById = asyncHandler(
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    const scope = await resolveFinanceBranchScope(req.user);
    const expense = await findExpenseByParam(req.params.id);

    if (!expense) {
      next(new AppError(404, "Data pengeluaran tidak ditemukan."));
      return;
    }

    assertBranchAccess(expense.branch, scope);

    sendSuccess(res, {
      data: {
        expense: toPublicExpense(expense),
      },
    });
  },
);

export const createExpense = asyncHandler(
  async (
    req: Request<Record<string, string>, Record<string, never>, ExpenseRequestBody>,
    res: Response,
  ) => {
    const scope = await resolveFinanceBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    const payload = resolveExpensePayload(req.body);
    const expenseId = await getNextPublicId(Expense, "expenseId", "EXP");
    const scopedBranch = resolveAccessibleBranchName(payload.branch, scope, {
      useFirstManagedBranchAsDefault: true,
    });
    const expense = await Expense.create({
      expenseId,
      ...payload,
      branch: scopedBranch || payload.branch,
      createdBy: req.user?._id ?? null,
      updatedBy: req.user?._id ?? null,
    });

    sendSuccess(res, {
      statusCode: 201,
      message: "Data pengeluaran berhasil dibuat.",
      data: {
        expense: toPublicExpense(expense),
      },
    });
  },
);

export const updateExpense = asyncHandler(
  async (
    req: Request<{ id: string }, Record<string, never>, ExpenseRequestBody>,
    res: Response,
    next: NextFunction,
  ) => {
    const scope = await resolveFinanceBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    const expense = await findExpenseByParam(req.params.id);

    if (!expense) {
      next(new AppError(404, "Data pengeluaran tidak ditemukan."));
      return;
    }

    assertBranchAccess(expense.branch, scope);

    const payload = resolveExpensePayload(req.body, expense);
    const scopedBranch = resolveAccessibleBranchName(payload.branch, scope);

    expense.title = payload.title;
    expense.branch = scopedBranch || payload.branch;
    expense.category = payload.category;
    expense.vendorOrRecipient = payload.vendorOrRecipient;
    expense.amount = payload.amount;
    expense.paymentMethod = payload.paymentMethod;
    expense.status = payload.status;
    expense.paidAt = payload.paidAt;
    expense.dueDate = payload.dueDate;
    expense.note = payload.note;
    expense.updatedBy = req.user?._id ?? null;
    await expense.save();

    sendSuccess(res, {
      message: "Data pengeluaran berhasil diperbarui.",
      data: {
        expense: toPublicExpense(expense),
      },
    });
  },
);

export const deleteExpense = asyncHandler(
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    const scope = await resolveFinanceBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    const expense = await findExpenseByParam(req.params.id);

    if (!expense) {
      next(new AppError(404, "Data pengeluaran tidak ditemukan."));
      return;
    }

    assertBranchAccess(expense.branch, scope);

    expense.archivedAt = new Date();
    expense.archivedBy = req.user?._id ?? null;
    expense.archiveReason = "Dihapus dari daftar pengeluaran oleh admin.";
    expense.updatedBy = req.user?._id ?? null;
    await expense.save();

    sendSuccess(res, {
      message: "Data pengeluaran berhasil dihapus dari daftar dan disimpan sebagai arsip audit.",
    });
  },
);

export const restoreExpense = asyncHandler(
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    const scope = await resolveFinanceBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    const expense = await findExpenseByParam(req.params.id, true);

    if (!expense || !expense.archivedAt) {
      next(new AppError(404, "Data pengeluaran terhapus tidak ditemukan."));
      return;
    }

    assertBranchAccess(expense.branch, scope);

    expense.archivedAt = null;
    expense.archivedBy = null;
    expense.archiveReason = null;
    expense.updatedBy = req.user?._id ?? null;
    await expense.save();

    sendSuccess(res, {
      message: "Data pengeluaran berhasil dipulihkan.",
      data: {
        expense: toPublicExpense(expense),
      },
    });
  },
);
