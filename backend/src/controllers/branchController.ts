import bcrypt from "bcrypt";
import crypto from "crypto";
import { Types } from "mongoose";
import type { NextFunction, Request, Response } from "express";

import { validateEnv } from "../config/env";
import {
  Branch,
  BRANCH_STATUSES,
  type BranchDocument,
  type BranchStatus,
} from "../models/Branch";
import { BranchIncome } from "../models/BranchIncome";
import { Expense } from "../models/Expense";
import { Student } from "../models/Student";
import { Teacher } from "../models/Teacher";
import { type UserDocument, User } from "../models/User";
import asyncHandler from "../utils/asyncHandler";
import {
  matchesBranchScope,
  resolveAdminBranchScope,
} from "../utils/adminBranchScope";
import { AppError, sendSuccess } from "../utils/apiResponse";
import { sendVerificationEmail } from "../utils/email";
import { getNextPublicId } from "../utils/publicId";

type BranchRequestBody = {
  name?: string;
  shortAddress?: string;
  fullAddress?: string;
  phone?: string;
  email?: string;
  status?: string;
  adminName?: string;
  adminUserId?: string | null;
};

type BranchAdminAccountRequestBody = {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};

type BranchAdminAccountUpdateRequestBody = {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};

function normalizeText(value: string | undefined): string {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function normalizePhone(value: string | undefined): string {
  return value?.trim().replace(/\s+/g, "") ?? "";
}

function normalizeEmail(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isBranchStatus(value: string): value is BranchStatus {
  return BRANCH_STATUSES.includes(value as BranchStatus);
}

function generateVerificationToken() {
  const plainToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(plainToken).digest("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

  return {
    plainToken,
    hashedToken,
    expiresAt,
  };
}

function buildVerificationLink(plainToken: string) {
  const { clientUrl } = validateEnv();
  return `${clientUrl}/verify-email?token=${plainToken}`;
}

async function prepareBranchAdminVerification(admin: UserDocument) {
  const { plainToken, hashedToken, expiresAt } = generateVerificationToken();

  admin.isEmailVerified = false;
  admin.emailVerifiedAt = null;
  admin.emailVerificationToken = hashedToken;
  admin.emailVerificationExpires = expiresAt;
  await admin.save();

  return buildVerificationLink(plainToken);
}

async function sendBranchAdminVerification(admin: UserDocument) {
  const verificationLink = await prepareBranchAdminVerification(admin);

  await sendVerificationEmail({
    nama: admin.nama,
    email: admin.email,
    verificationLink,
  });
}

async function getAvailableTeacherCount() {
  return Teacher.countDocuments({
    status: "Aktif",
  }).exec();
}

async function attachBranchToTeacherDirectory(branchName: string) {
  const normalizedBranchName = normalizeText(branchName);

  if (!normalizedBranchName) {
    return;
  }

  await Teacher.updateMany(
    {
      branches: {
        $ne: normalizedBranchName,
      },
    },
    {
      $addToSet: {
        branches: normalizedBranchName,
      },
    },
  ).exec();
}

async function renameBranchInTeacherDirectory(
  previousBranchName: string,
  nextBranchName: string,
) {
  const normalizedPreviousBranchName = normalizeText(previousBranchName);
  const normalizedNextBranchName = normalizeText(nextBranchName);

  if (!normalizedPreviousBranchName || !normalizedNextBranchName) {
    return;
  }

  await Promise.all([
    Teacher.updateMany(
      {
        branch: normalizedPreviousBranchName,
      },
      {
        $set: {
          branch: normalizedNextBranchName,
        },
      },
    ).exec(),
    Teacher.updateMany(
      {
        branches: normalizedPreviousBranchName,
      },
      {
        $addToSet: {
          branches: normalizedNextBranchName,
        },
      },
    ).exec(),
  ]);

  await Teacher.updateMany(
    {
      branches: normalizedPreviousBranchName,
    },
    {
      $pull: {
        branches: normalizedPreviousBranchName,
      },
    },
  ).exec();
}

async function getStudentCountMap(branchNames: string[]) {
  const normalizedBranchNames = [...new Set(branchNames.filter(Boolean))];

  if (!normalizedBranchNames.length) {
    return new Map<string, number>();
  }

  const studentCounts = await Student.aggregate<{
    _id: string;
    studentCount: number;
  }>([
    {
      $match: {
        branch: {
          $in: normalizedBranchNames,
        },
      },
    },
    {
      $group: {
        _id: "$branch",
        studentCount: {
          $sum: 1,
        },
      },
    },
  ]);

  return new Map(
    studentCounts.map((item) => [item._id, item.studentCount]),
  );
}

type PublicBranchMetrics = {
  studentCount?: number | null;
  teacherCount?: number;
};

function toPublicBranch(
  branch: BranchDocument,
  metrics: PublicBranchMetrics = {},
) {
  return {
    id: branch.branchId,
    branchId: branch.branchId,
    name: branch.name,
    shortAddress: branch.shortAddress,
    fullAddress: branch.fullAddress,
    phone: branch.phone,
    email: branch.email,
    status: branch.status,
    adminName: branch.adminName,
    adminUserId: branch.adminUserId?.toString() ?? null,
    ...(typeof metrics.teacherCount === "number"
      ? { teacherCount: metrics.teacherCount }
      : {}),
    ...(metrics.studentCount === null || typeof metrics.studentCount === "number"
      ? { studentCount: metrics.studentCount }
      : {}),
    createdAt: branch.createdAt,
    updatedAt: branch.updatedAt,
  };
}

function toPublicRegisterBranchOption(branch: BranchDocument) {
  return {
    id: branch.branchId,
    name: branch.name,
    shortAddress: branch.shortAddress,
    fullAddress: branch.fullAddress,
  };
}

function toPublicBranchAdminOption(admin: {
  _id: { toString: () => string };
  nama: string;
  email: string;
}) {
  return {
    id: admin._id.toString(),
    name: admin.nama,
    email: admin.email,
  };
}

function toPublicBranchAdminAccount(admin: {
  _id: { toString: () => string };
  nama: string;
  email: string;
  isEmailVerified: boolean;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: admin._id.toString(),
    name: admin.nama,
    email: admin.email,
    isEmailVerified: admin.isEmailVerified,
    emailVerifiedAt: admin.emailVerifiedAt,
    createdAt: admin.createdAt,
    updatedAt: admin.updatedAt,
  };
}

async function findBranchByParam(id: string) {
  return Branch.findOne({
    $or: [
      { branchId: id },
      ...(Types.ObjectId.isValid(id) ? [{ _id: id }] : []),
    ],
  }).exec();
}

async function findBranchWithSameName(name: string, excludedBranchId?: string) {
  const nameRegex = new RegExp(`^${escapeRegex(name)}$`, "i");

  return Branch.findOne({
    name: nameRegex,
    ...(excludedBranchId
      ? {
          branchId: {
            $ne: excludedBranchId,
          },
        }
      : {}),
  }).exec();
}

async function findAdminUserByParam(id: string) {
  if (!Types.ObjectId.isValid(id)) {
    return null;
  }

  return User.findOne({
    _id: id,
    role: "admin",
  }).exec();
}

async function findAdminUserWithSameName(name: string, excludedAdminId?: string) {
  const nameRegex = new RegExp(`^${escapeRegex(name)}$`, "i");

  return User.findOne({
    role: "admin",
    nama: nameRegex,
    ...(excludedAdminId
      ? {
          _id: {
            $ne: excludedAdminId,
          },
        }
      : {}),
  }).exec();
}

async function resolveBranchAdminLink(body: BranchRequestBody) {
  const adminName = normalizeText(body.adminName);
  const adminUserId = normalizeText(typeof body.adminUserId === "string" ? body.adminUserId : "");

  if (!adminName && !adminUserId) {
    return {
      adminName: "",
      adminUserId: null,
    };
  }

  let admin =
    adminUserId && Types.ObjectId.isValid(adminUserId)
      ? await findAdminUserByParam(adminUserId)
      : null;

  if (!admin && adminName) {
    admin = await findAdminUserWithSameName(adminName);
  }

  if (!admin) {
    throw new AppError(400, "Admin cabang yang dipilih tidak ditemukan.", {
      adminName: "Admin cabang yang dipilih tidak ditemukan.",
    });
  }

  if (adminName && admin.nama.toLowerCase() !== adminName.toLowerCase()) {
    throw new AppError(400, "Data admin cabang tidak sinkron.", {
      adminName: "Nama admin cabang tidak cocok dengan akun yang dipilih.",
    });
  }

  return {
    adminName: admin.nama,
    adminUserId: admin._id,
  };
}

export const getBranches = asyncHandler(async (req: Request, res: Response) => {
  const scope = await resolveAdminBranchScope(req.user, {
    requireManagedBranchesForAdmin: true,
  });
  const branches = await Branch.find().sort({ createdAt: 1, _id: 1 }).exec();
  const scopedBranches = branches.filter((branch) =>
    matchesBranchScope(branch.name, scope),
  );
  const branchNames = scopedBranches.map((branch) => branch.name);
  const [availableTeacherCount, studentCountMap] = await Promise.all([
    getAvailableTeacherCount(),
    getStudentCountMap(branchNames),
  ]);

  sendSuccess(res, {
    data: {
      branches: scopedBranches.map((branch) =>
        toPublicBranch(branch, {
          teacherCount: availableTeacherCount,
          studentCount: studentCountMap.get(branch.name) ?? 0,
        }),
      ),
    },
  });
});

export const getPublicBranchOptions = asyncHandler(
  async (_req: Request, res: Response) => {
    const branches = await Branch.find({ status: "Aktif" })
      .sort({ name: 1, createdAt: 1, _id: 1 })
      .exec();

    sendSuccess(res, {
      data: {
        branches: branches.map((branch) => toPublicRegisterBranchOption(branch)),
      },
    });
  },
);

export const getBranchAdminOptions = asyncHandler(
  async (_req: Request, res: Response) => {
    const admins = await User.find({ role: "admin" })
      .sort({ nama: 1, createdAt: 1 })
      .select("_id nama email")
      .exec();

    sendSuccess(res, {
      data: {
        admins: admins.map((admin) => toPublicBranchAdminOption(admin)),
      },
    });
  },
);

export const getBranchAdminAccounts = asyncHandler(
  async (_req: Request, res: Response) => {
    const admins = await User.find({ role: "admin" })
      .sort({ nama: 1, createdAt: 1 })
      .select("_id nama email isEmailVerified emailVerifiedAt createdAt updatedAt")
      .exec();

    sendSuccess(res, {
      data: {
        admins: admins.map((admin) => toPublicBranchAdminAccount(admin)),
      },
    });
  },
);

export const createBranchAdminAccount = asyncHandler(
  async (
    req: Request<Record<string, string>, Record<string, never>, BranchAdminAccountRequestBody>,
    res: Response,
    next: NextFunction,
  ) => {
    const name = normalizeText(req.body.name);
    const email = normalizeEmail(req.body.email);
    const password = req.body.password?.trim() ?? "";
    const confirmPassword = req.body.confirmPassword?.trim() ?? "";
    const errors: Record<string, string> = {};

    if (!name) {
      errors.name = "Nama admin wajib diisi.";
    }

    if (!email) {
      errors.email = "Email admin wajib diisi.";
    } else if (!isValidEmail(email)) {
      errors.email = "Email admin belum valid.";
    }

    if (!password) {
      errors.password = "Password admin wajib diisi.";
    } else if (password.length < 8) {
      errors.password = "Password admin minimal 8 karakter.";
    }

    if (!confirmPassword) {
      errors.confirmPassword = "Konfirmasi password admin wajib diisi.";
    } else if (password !== confirmPassword) {
      errors.confirmPassword = "Konfirmasi password admin tidak cocok.";
    }

    if (Object.keys(errors).length > 0) {
      next(new AppError(400, "Data akun admin belum valid.", errors));
      return;
    }

    const duplicateAdminName = await findAdminUserWithSameName(name);

    if (duplicateAdminName) {
      next(
        new AppError(409, "Nama admin sudah digunakan.", {
          name: "Nama admin sudah digunakan oleh akun admin lain.",
        }),
      );
      return;
    }

    const existingUser = await User.findOne({
      email,
    }).exec();

    if (existingUser) {
      next(
        new AppError(409, "Email admin sudah digunakan.", {
          email: "Email admin sudah digunakan oleh akun lain.",
        }),
      );
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const admin = await User.create({
      nama: name,
      email,
      avatar: null,
      password: hashedPassword,
      role: "admin",
      isEmailVerified: false,
      emailVerifiedAt: null,
      emailVerificationToken: null,
      emailVerificationExpires: null,
    });
    let verificationEmailSent = true;

    try {
      await sendBranchAdminVerification(admin);
    } catch (error) {
      verificationEmailSent = false;
      console.error("Gagal mengirim email verifikasi admin cabang saat create:", error);
    }

    sendSuccess(res, {
      statusCode: 201,
      message: verificationEmailSent
        ? "Akun admin berhasil dibuat. Link verifikasi sudah dikirim ke email admin."
        : "Akun admin berhasil dibuat, tetapi email verifikasi belum berhasil dikirim. Gunakan tombol Kirim Ulang Verifikasi dari halaman Admin Cabang.",
      data: {
        admin: toPublicBranchAdminAccount(admin),
        email: admin.email,
        verificationEmailSent,
      },
    });
  },
);

export const updateBranchAdminAccount = asyncHandler(
  async (
    req: Request<{ id: string }, Record<string, never>, BranchAdminAccountUpdateRequestBody>,
    res: Response,
    next: NextFunction,
  ) => {
    const admin = await findAdminUserByParam(req.params.id);

    if (!admin) {
      next(new AppError(404, "Akun admin cabang tidak ditemukan."));
      return;
    }

    const name = normalizeText(req.body.name);
    const email = normalizeEmail(req.body.email);
    const password = req.body.password?.trim() ?? "";
    const confirmPassword = req.body.confirmPassword?.trim() ?? "";
    const errors: Record<string, string> = {};

    if (!name) {
      errors.name = "Nama admin wajib diisi.";
    }

    if (!email) {
      errors.email = "Email admin wajib diisi.";
    } else if (!isValidEmail(email)) {
      errors.email = "Email admin belum valid.";
    }

    if (password) {
      if (password.length < 8) {
        errors.password = "Password admin minimal 8 karakter.";
      }
      if (password !== confirmPassword) {
        errors.confirmPassword = "Konfirmasi password admin tidak cocok.";
      }
    }

    if (Object.keys(errors).length > 0) {
      next(new AppError(400, "Data akun admin belum valid.", errors));
      return;
    }

    const duplicateAdminName = await findAdminUserWithSameName(name, admin._id.toString());

    if (duplicateAdminName) {
      next(
        new AppError(409, "Nama admin sudah digunakan.", {
          name: "Nama admin sudah digunakan oleh akun admin lain.",
        }),
      );
      return;
    }

    const duplicateEmailUser = await User.findOne({
      email,
      _id: {
        $ne: admin._id,
      },
    }).exec();

    if (duplicateEmailUser) {
      next(
        new AppError(409, "Email admin sudah digunakan.", {
          email: "Email admin sudah digunakan oleh akun lain.",
        }),
      );
      return;
    }

    const previousAdminName = admin.nama;

    admin.nama = name;
    admin.email = email;
    if (password) {
      admin.password = await bcrypt.hash(password, 12);
    }
    await admin.save();

    if (previousAdminName !== name) {
      await Branch.updateMany(
        {
          $or: [
            { adminUserId: admin._id },
            {
              adminName: new RegExp(`^${escapeRegex(previousAdminName)}$`, "i"),
            },
          ],
        },
        {
          $set: {
            adminName: name,
            adminUserId: admin._id,
          },
        },
      ).exec();
    } else {
      await Branch.updateMany(
        {
          adminName: new RegExp(`^${escapeRegex(name)}$`, "i"),
        },
        {
          $set: {
            adminUserId: admin._id,
          },
        },
      ).exec();
    }

    sendSuccess(res, {
      message: "Akun admin cabang berhasil diperbarui.",
      data: {
        admin: toPublicBranchAdminAccount(admin),
      },
    });
  },
);

export const deleteBranchAdminAccount = asyncHandler(
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    const admin = await findAdminUserByParam(req.params.id);

    if (!admin) {
      next(new AppError(404, "Akun admin cabang tidak ditemukan."));
      return;
    }

    if (req.user && req.user._id.toString() === admin._id.toString()) {
      next(
        new AppError(
          409,
          "Akun admin yang sedang dipakai untuk login tidak bisa dihapus.",
        ),
      );
      return;
    }

    await Branch.updateMany(
      {
        $or: [
          { adminUserId: admin._id },
          {
            adminName: new RegExp(`^${escapeRegex(admin.nama)}$`, "i"),
          },
        ],
      },
      {
        $set: {
          adminName: "",
          adminUserId: null,
        },
      },
    ).exec();

    await User.deleteOne({ _id: admin._id }).exec();

    sendSuccess(res, {
      message: "Akun admin cabang berhasil dihapus.",
    });
  },
);

export const resendBranchAdminVerification = asyncHandler(
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    const admin = await findAdminUserByParam(req.params.id);

    if (!admin) {
      next(new AppError(404, "Akun admin cabang tidak ditemukan."));
      return;
    }

    if (admin.isEmailVerified) {
      next(new AppError(409, "Email admin cabang ini sudah terverifikasi."));
      return;
    }

    await sendBranchAdminVerification(admin);

    sendSuccess(res, {
      message: "Email verifikasi berhasil dikirim ulang ke admin cabang.",
      data: {
        admin: toPublicBranchAdminAccount(admin),
        email: admin.email,
        verificationEmailSent: true,
      },
    });
  },
);

export const getBranchById = asyncHandler(
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    const branch = await findBranchByParam(req.params.id);

    if (!branch) {
      next(new AppError(404, "Data cabang tidak ditemukan."));
      return;
    }

    const [teacherCount, studentCount] = await Promise.all([
      getAvailableTeacherCount(),
      Student.countDocuments({
        branch: branch.name,
      }).exec(),
    ]);

    sendSuccess(res, {
      data: {
        branch: toPublicBranch(branch, {
          teacherCount,
          studentCount,
        }),
      },
    });
  },
);

export const createBranch = asyncHandler(
  async (
    req: Request<Record<string, string>, Record<string, never>, BranchRequestBody>,
    res: Response,
    next: NextFunction,
  ) => {
    const name = normalizeText(req.body.name);
    const shortAddress = normalizeText(req.body.shortAddress);
    const fullAddress = normalizeText(req.body.fullAddress);
    const phone = normalizePhone(req.body.phone);
    const email = normalizeEmail(req.body.email);
    const status = normalizeText(req.body.status);

    if (!name) {
      next(new AppError(400, "Nama cabang wajib diisi."));
      return;
    }

    if (!status || !isBranchStatus(status)) {
      next(new AppError(400, "Status cabang belum valid."));
      return;
    }

    if (email && !isValidEmail(email)) {
      next(new AppError(400, "Email cabang belum valid."));
      return;
    }

    const duplicateBranch = await findBranchWithSameName(name);

    if (duplicateBranch) {
      next(new AppError(409, "Nama cabang sudah digunakan."));
      return;
    }

    const adminLink = await resolveBranchAdminLink(req.body);
    const branchId = await getNextPublicId(Branch, "branchId", "BRN");
    const branch = await Branch.create({
      branchId,
      name,
      shortAddress,
      fullAddress,
      phone,
      email,
      status,
      adminName: adminLink.adminName,
      adminUserId: adminLink.adminUserId,
    });
    await attachBranchToTeacherDirectory(name);

    sendSuccess(res, {
      statusCode: 201,
      message: "Data cabang berhasil dibuat.",
      data: {
        branch: toPublicBranch(branch, {
          teacherCount: await getAvailableTeacherCount(),
          studentCount: 0,
        }),
      },
    });
  },
);

export const updateBranch = asyncHandler(
  async (
    req: Request<{ id: string }, Record<string, never>, BranchRequestBody>,
    res: Response,
    next: NextFunction,
  ) => {
    const branch = await findBranchByParam(req.params.id);

    if (!branch) {
      next(new AppError(404, "Data cabang tidak ditemukan."));
      return;
    }

    const name = normalizeText(req.body.name);
    const shortAddress = normalizeText(req.body.shortAddress);
    const fullAddress = normalizeText(req.body.fullAddress);
    const phone = normalizePhone(req.body.phone);
    const email = normalizeEmail(req.body.email);
    const status = normalizeText(req.body.status);

    if (!name) {
      next(new AppError(400, "Nama cabang wajib diisi."));
      return;
    }

    if (!status || !isBranchStatus(status)) {
      next(new AppError(400, "Status cabang belum valid."));
      return;
    }

    if (email && !isValidEmail(email)) {
      next(new AppError(400, "Email cabang belum valid."));
      return;
    }

    const duplicateBranch = await findBranchWithSameName(name, branch.branchId);

    if (duplicateBranch) {
      next(new AppError(409, "Nama cabang sudah digunakan."));
      return;
    }

    const adminLink = await resolveBranchAdminLink(req.body);
    const previousBranchName = branch.name;

    branch.name = name;
    branch.shortAddress = shortAddress;
    branch.fullAddress = fullAddress;
    branch.phone = phone;
    branch.email = email;
    branch.status = status;
    branch.adminName = adminLink.adminName;
    branch.adminUserId = adminLink.adminUserId;
    await branch.save();

    if (previousBranchName !== name) {
      await Promise.all([
        renameBranchInTeacherDirectory(previousBranchName, name),
        Student.updateMany(
          {
            branch: previousBranchName,
          },
          {
            $set: {
              branch: name,
            },
          },
        ).exec(),
        BranchIncome.updateMany(
          {
            branch: previousBranchName,
          },
          {
            $set: {
              branch: name,
            },
          },
        ).exec(),
        Expense.updateMany(
          {
            branch: previousBranchName,
          },
          {
            $set: {
              branch: name,
            },
          },
        ).exec(),
      ]);
    }

    const [teacherCount, studentCount] = await Promise.all([
      getAvailableTeacherCount(),
      Student.countDocuments({
        branch: name,
      }).exec(),
    ]);

    sendSuccess(res, {
      message: "Data cabang berhasil diperbarui.",
      data: {
        branch: toPublicBranch(branch, {
          teacherCount,
          studentCount,
        }),
      },
    });
  },
);

export const deleteBranch = asyncHandler(
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    const branch = await findBranchByParam(req.params.id);

    if (!branch) {
      next(new AppError(404, "Data cabang tidak ditemukan."));
      return;
    }

    const linkedTeacherCount = await Teacher.countDocuments({
      branch: branch.name,
    }).exec();
    const linkedStudentCount = await Student.countDocuments({
      branch: branch.name,
    }).exec();

    if (linkedTeacherCount > 0) {
      next(
        new AppError(
          409,
          "Cabang tidak bisa dihapus karena masih dipakai oleh data guru.",
        ),
      );
      return;
    }

    if (linkedStudentCount > 0) {
      next(
        new AppError(
          409,
          "Cabang tidak bisa dihapus karena masih dipakai oleh data siswa.",
        ),
      );
      return;
    }

    await Branch.deleteOne({ _id: branch._id });

    sendSuccess(res, {
      message: "Data cabang berhasil dihapus.",
    });
  },
);
