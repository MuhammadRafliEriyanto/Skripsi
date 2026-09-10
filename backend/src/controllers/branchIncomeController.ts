import { Types } from "mongoose";
import type { NextFunction, Request, Response } from "express";
import "../types/express";

import {
  BranchIncome,
  BRANCH_INCOME_STATUSES,
  type BranchIncomeDocument,
  type BranchIncomeStatus,
} from "../models/BranchIncome";
import asyncHandler from "../utils/asyncHandler";
import { AppError, sendSuccess } from "../utils/apiResponse";
import { getNextPublicId } from "../utils/publicId";
import {
  assertBranchAccess,
  buildScopeBranchQuery,
  resolveAccessibleBranchName,
  resolveFinanceBranchScope,
  toPublicFinanceScope,
} from "../utils/branchFinanceScope";

type BranchIncomeRequestBody = {
  title?: string;
  branch?: string;
  category?: string;
  payerOrSource?: string;
  amount?: number;
  paymentMethod?: string;
  status?: string;
  receivedAt?: string | null;
  note?: string | null;
};

type BranchIncomeQuery = {
  q?: string;
  branch?: string;
  category?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
};

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function isBranchIncomeStatus(value: string): value is BranchIncomeStatus {
  return BRANCH_INCOME_STATUSES.includes(value as BranchIncomeStatus);
}

function parseOptionalDateInput(
  value: string | null | undefined,
  fieldLabel: string,
): Date | null | undefined {
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

function getBranchIncomeDisplayDate(income: BranchIncomeDocument) {
  return income.receivedAt ?? income.updatedAt ?? income.createdAt;
}

function toPublicBranchIncome(income: BranchIncomeDocument) {
  return {
    id: income._id.toString(),
    incomeId: income.incomeId,
    title: income.title,
    branch: income.branch,
    category: income.category,
    payerOrSource: income.payerOrSource,
    amount: income.amount,
    paymentMethod: income.paymentMethod,
    status: income.status,
    receivedAt: income.receivedAt,
    note: income.note,
    createdBy: income.createdBy,
    updatedBy: income.updatedBy,
    createdAt: income.createdAt,
    updatedAt: income.updatedAt,
  };
}

async function findBranchIncomeByParam(id: string) {
  return BranchIncome.findOne({
    $or: [
      { incomeId: id },
      ...(Types.ObjectId.isValid(id) ? [{ _id: id }] : []),
    ],
  }).exec();
}

function resolveBranchIncomePayload(
  body: BranchIncomeRequestBody,
  currentIncome?: BranchIncomeDocument,
) {
  const title =
    body.title === undefined ? currentIncome?.title ?? "" : normalizeText(body.title);
  const branch =
    body.branch === undefined
      ? currentIncome?.branch ?? "Pusat"
      : normalizeText(body.branch) || "Pusat";
  const category =
    body.category === undefined
      ? currentIncome?.category ?? ""
      : normalizeText(body.category);
  const payerOrSource =
    body.payerOrSource === undefined
      ? currentIncome?.payerOrSource ?? ""
      : normalizeText(body.payerOrSource);
  const paymentMethod =
    body.paymentMethod === undefined
      ? currentIncome?.paymentMethod ?? ""
      : normalizeText(body.paymentMethod);
  const status =
    body.status === undefined
      ? currentIncome?.status ?? ""
      : normalizeText(body.status);
  const amount = body.amount === undefined ? currentIncome?.amount : body.amount;
  const receivedAtInput = parseOptionalDateInput(body.receivedAt, "Tanggal diterima");
  const note =
    body.note === undefined ? currentIncome?.note ?? "" : normalizeText(body.note);

  if (!title) {
    throw new AppError(400, "Judul pemasukan wajib diisi.");
  }

  if (!category) {
    throw new AppError(400, "Kategori pemasukan wajib diisi.");
  }

  if (!payerOrSource) {
    throw new AppError(400, "Sumber pemasukan wajib diisi.");
  }

  if (!paymentMethod) {
    throw new AppError(400, "Metode pembayaran wajib diisi.");
  }

  if (!status || !isBranchIncomeStatus(status)) {
    throw new AppError(400, "Status pemasukan belum valid.");
  }

  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    throw new AppError(400, "Nominal pemasukan wajib berupa angka positif.");
  }

  let receivedAt =
    receivedAtInput === undefined ? currentIncome?.receivedAt ?? null : receivedAtInput;

  if (status === "Diterima" && !receivedAt) {
    receivedAt = new Date();
  }

  return {
    title,
    branch,
    category,
    payerOrSource,
    amount: Math.round(amount),
    paymentMethod,
    status,
    receivedAt,
    note,
  };
}

export const getBranchIncomes = asyncHandler(
  async (
    req: Request<Record<string, string>, Record<string, never>, Record<string, never>, BranchIncomeQuery>,
    res: Response,
  ) => {
    const scope = await resolveFinanceBranchScope(req.user);
    const categoryFilter = normalizeText(req.query.category).toLowerCase();
    const statusFilter = normalizeText(req.query.status);
    const searchQuery = normalizeText(req.query.q).toLowerCase();
    const dateFrom = parseOptionalDateInput(req.query.dateFrom, "dateFrom");
    const dateTo = parseOptionalDateInput(req.query.dateTo, "dateTo");

    if (statusFilter && !isBranchIncomeStatus(statusFilter)) {
      throw new AppError(400, "Status pemasukan belum valid.");
    }

    if (dateFrom && dateTo && dateFrom.getTime() > dateTo.getTime()) {
      throw new AppError(400, "dateFrom tidak boleh lebih besar dari dateTo.");
    }

    const branchQuery = buildScopeBranchQuery(scope, req.query.branch);
    const incomes = await BranchIncome.find(branchQuery)
      .sort({ createdAt: -1, _id: -1 })
      .exec();

    const filteredIncomes = incomes.filter((income) => {
      const matchesCategory = categoryFilter
        ? normalizeText(income.category).toLowerCase() === categoryFilter
        : true;
      const matchesStatus = statusFilter ? income.status === statusFilter : true;
      const matchesQuery = searchQuery
        ? [
            income.incomeId,
            income.title,
            income.branch,
            income.category,
            income.payerOrSource,
            income.paymentMethod,
            income.note,
          ].some((value) => normalizeText(value).toLowerCase().includes(searchQuery))
        : true;
      const displayDate = getBranchIncomeDisplayDate(income);
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
        incomes: filteredIncomes.map((income) => toPublicBranchIncome(income)),
        scope: toPublicFinanceScope(scope),
      },
    });
  },
);

export const getBranchIncomeById = asyncHandler(
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    const scope = await resolveFinanceBranchScope(req.user);
    const income = await findBranchIncomeByParam(req.params.id);

    if (!income) {
      next(new AppError(404, "Data pemasukan tidak ditemukan."));
      return;
    }

    assertBranchAccess(income.branch, scope);

    sendSuccess(res, {
      data: {
        income: toPublicBranchIncome(income),
      },
    });
  },
);

export const createBranchIncome = asyncHandler(
  async (
    req: Request<Record<string, string>, Record<string, never>, BranchIncomeRequestBody>,
    res: Response,
  ) => {
    const scope = await resolveFinanceBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    const payload = resolveBranchIncomePayload(req.body);
    const incomeId = await getNextPublicId(BranchIncome, "incomeId", "INC");
    const scopedBranch = resolveAccessibleBranchName(payload.branch, scope, {
      useFirstManagedBranchAsDefault: true,
    });
    const income = await BranchIncome.create({
      incomeId,
      ...payload,
      branch: scopedBranch || payload.branch,
      createdBy: req.user?._id ?? null,
      updatedBy: req.user?._id ?? null,
    });

    sendSuccess(res, {
      statusCode: 201,
      message: "Data pemasukan cabang berhasil dibuat.",
      data: {
        income: toPublicBranchIncome(income),
      },
    });
  },
);

export const updateBranchIncome = asyncHandler(
  async (
    req: Request<{ id: string }, Record<string, never>, BranchIncomeRequestBody>,
    res: Response,
    next: NextFunction,
  ) => {
    const scope = await resolveFinanceBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    const income = await findBranchIncomeByParam(req.params.id);

    if (!income) {
      next(new AppError(404, "Data pemasukan tidak ditemukan."));
      return;
    }

    assertBranchAccess(income.branch, scope);

    const payload = resolveBranchIncomePayload(req.body, income);
    const scopedBranch = resolveAccessibleBranchName(payload.branch, scope, {
      useFirstManagedBranchAsDefault: true,
    });

    income.title = payload.title;
    income.branch = scopedBranch || payload.branch;
    income.category = payload.category;
    income.payerOrSource = payload.payerOrSource;
    income.amount = payload.amount;
    income.paymentMethod = payload.paymentMethod;
    income.status = payload.status;
    income.receivedAt = payload.receivedAt;
    income.note = payload.note;
    income.updatedBy = req.user?._id ?? null;
    await income.save();

    sendSuccess(res, {
      message: "Data pemasukan cabang berhasil diperbarui.",
      data: {
        income: toPublicBranchIncome(income),
      },
    });
  },
);

export const deleteBranchIncome = asyncHandler(
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    const scope = await resolveFinanceBranchScope(req.user, {
      requireManagedBranchesForAdmin: true,
    });
    const income = await findBranchIncomeByParam(req.params.id);

    if (!income) {
      next(new AppError(404, "Data pemasukan tidak ditemukan."));
      return;
    }

    assertBranchAccess(income.branch, scope);

    await BranchIncome.deleteOne({ _id: income._id }).exec();

    sendSuccess(res, {
      message: "Data pemasukan cabang berhasil dihapus.",
    });
  },
);
