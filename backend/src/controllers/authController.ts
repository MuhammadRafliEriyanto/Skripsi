import bcrypt from "bcrypt";
import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";

import { validateEnv } from "../config/env";
import { type PublicUser, type UserDocument, type UserRole, USER_ROLES, User } from "../models/User";
import { AppError, sendSuccess } from "../utils/apiResponse";
import asyncHandler from "../utils/asyncHandler";
import { sendPasswordResetEmail, sendVerificationEmail } from "../utils/email";
import { generateJwtToken, getRedirectPathByRole } from "../utils/generateToken";
import { Teacher } from "../models/Teacher";
import { Student } from "../models/Student";
import {
  buildStudentLoginCode,
  buildTeacherLoginCode,
  getLoginCodeLookupCandidates,
} from "../utils/accountCode";

interface RegisterRequestBody {
  nama?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  role?: string;
}

interface LoginRequestBody {
  email?: string;
  identifier?: string;
  loginCode?: string;
  password?: string;
}

interface GoogleLoginRequestBody {
  credential?: string;
}

interface UpdateProfileRequestBody {
  nama?: string;
  email?: string;
  avatar?: string | null;
}

interface ChangePasswordRequestBody {
  currentPassword?: string;
  newPassword?: string;
  confirmNewPassword?: string;
}

interface ForgotPasswordRequestBody {
  email?: string;
}

interface ResetPasswordRequestBody {
  email?: string;
  code?: string;
  newPassword?: string;
  confirmNewPassword?: string;
}

interface VerifyEmailParams {
  token?: string;
}

let googleOAuthClient: OAuth2Client | null = null;

function sanitizeUser(userDocument: UserDocument): PublicUser {
  return {
    _id: userDocument._id.toString(),
    nama: userDocument.nama,
    email: userDocument.email,
    loginCode: userDocument.loginCode ?? null,
    avatar: userDocument.avatar,
    role: userDocument.role,
    isEmailVerified: userDocument.isEmailVerified,
    emailVerifiedAt: userDocument.emailVerifiedAt,
    createdAt: userDocument.createdAt,
    updatedAt: userDocument.updatedAt,
  };
}

function normalizeEmail(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

async function findUserByLoginIdentifier(identifier: string) {
  const normalizedEmail = normalizeEmail(identifier);
  const loginCodeCandidates = getLoginCodeLookupCandidates(identifier);
  const userFilters: Array<Record<string, unknown>> = [];

  if (normalizedEmail) {
    userFilters.push({ email: normalizedEmail });
  }

  if (loginCodeCandidates.length) {
    userFilters.push({ loginCode: { $in: loginCodeCandidates } });
  }

  const directUser = userFilters.length
    ? await User.findOne(
        userFilters.length === 1 ? userFilters[0] : { $or: userFilters },
      )
        .select("+password")
        .exec()
    : null;

  if (directUser) {
    return {
      user: directUser,
      loginCodeToPersist: null as string | null,
    };
  }

  if (!loginCodeCandidates.length) {
    return {
      user: null,
      loginCodeToPersist: null as string | null,
    };
  }

  const [student, teacher] = await Promise.all([
    Student.findOne({ studentId: { $in: loginCodeCandidates } })
      .select("studentId userId")
      .exec(),
    Teacher.findOne({ teacherId: { $in: loginCodeCandidates } })
      .select("teacherId userId")
      .exec(),
  ]);

  if (student) {
    const user = await User.findById(student.userId).select("+password").exec();

    return {
      user,
      loginCodeToPersist: buildStudentLoginCode(student.studentId),
    };
  }

  if (teacher) {
    const user = await User.findById(teacher.userId).select("+password").exec();

    return {
      user,
      loginCodeToPersist: buildTeacherLoginCode(teacher.teacherId),
    };
  }

  return {
    user: null,
    loginCodeToPersist: null as string | null,
  };
}

function getGoogleOAuthClient() {
  const { googleClientId } = validateEnv();

  if (!googleClientId) {
    throw new AppError(
      500,
      "GOOGLE_CLIENT_ID belum diatur pada environment backend.",
      null,
      "GOOGLE_CLIENT_ID_MISSING",
    );
  }

  if (!googleOAuthClient) {
    googleOAuthClient = new OAuth2Client(googleClientId);
  }

  return {
    client: googleOAuthClient,
    googleClientId,
  };
}

function sendAuthenticatedUser(res: Response, user: UserDocument, message: string) {
  const token = generateJwtToken(user._id.toString(), user.role);
  const sanitizedUser = sanitizeUser(user);

  sendSuccess(res, {
    message,
    data: {
      token,
      user: sanitizedUser,
      role: user.role,
      redirectPath: getRedirectPathByRole(user.role),
    },
  });
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

function generatePasswordResetCode() {
  const plainCode = crypto.randomInt(100000, 1_000_000).toString();
  const hashedToken = crypto.createHash("sha256").update(plainCode).digest("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 15);

  return {
    plainCode,
    hashedToken,
    expiresAt,
  };
}

function estimateBase64Bytes(value: string) {
  const [, base64Payload = ""] = value.split(",", 2);
  const paddingLength = (base64Payload.match(/=*$/)?.[0].length ?? 0);

  return Math.floor((base64Payload.length * 3) / 4) - paddingLength;
}

function normalizeAvatarInput(
  value: string | null | undefined,
): { value: string | null | undefined; error: string | null } {
  if (value === undefined) {
    return {
      value: undefined,
      error: null,
    };
  }

  if (value === null || value === "") {
    return {
      value: null,
      error: null,
    };
  }

  const trimmedValue = value.trim();

  if (!/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(trimmedValue)) {
    return {
      value: null,
      error: "Format foto profil tidak valid. Gunakan file gambar yang didukung.",
    };
  }

  if (estimateBase64Bytes(trimmedValue) > 2 * 1024 * 1024) {
    return {
      value: null,
      error: "Ukuran foto profil maksimal 2MB.",
    };
  }

  return {
    // TODO: Ganti penyimpanan base64 ini ke object storage/CDN saat backend upload file final tersedia.
    value: trimmedValue,
    error: null,
  };
}

export const register = asyncHandler(
  async (
    req: Request<Record<string, string>, Record<string, never>, RegisterRequestBody>,
    res: Response,
    next: NextFunction,
  ) => {
    const { nama, email, password, confirmPassword, role } = req.body;
    const errors: Record<string, string> = {};
    const trimmedNama = nama?.trim();
    const normalizedEmail = email?.trim().toLowerCase();
    const requestedRole = role as UserRole | undefined;
    const safeRole: UserRole = "siswa";

    if (!trimmedNama) {
      errors.nama = "Nama wajib diisi.";
    }

    if (!normalizedEmail) {
      errors.email = "Email wajib diisi.";
    }

    if (!password) {
      errors.password = "Password wajib diisi.";
    } else if (password.length < 8) {
      errors.password = "Password minimal 8 karakter.";
    }

    if (!confirmPassword) {
      errors.confirmPassword = "Konfirmasi password wajib diisi.";
    } else if (password !== confirmPassword) {
      errors.confirmPassword = "Konfirmasi password tidak cocok.";
    }

    if (requestedRole && !USER_ROLES.includes(requestedRole)) {
      errors.role = "Role tidak valid.";
    } else if (requestedRole && requestedRole !== "siswa") {
      errors.role = "Registrasi publik hanya tersedia untuk siswa.";
    }

    if (Object.keys(errors).length > 0) {
      next(new AppError(400, "Data registrasi tidak valid.", errors));
      return;
    }

    const safePassword = password as string;
    const hashedPassword = await bcrypt.hash(safePassword, 12);
    const { plainToken, hashedToken, expiresAt } = generateVerificationToken();

    let user = await User.findOne({ email: normalizedEmail }).select("+password");

    if (user && user.isEmailVerified) {
      next(new AppError(409, "Email sudah terdaftar dan telah diverifikasi."));
      return;
    }

    if (user) {
      user.nama = trimmedNama as string;
      user.avatar = user.avatar ?? null;
      user.password = hashedPassword;
      user.role = safeRole;
      user.isEmailVerified = false;
      user.emailVerificationToken = hashedToken;
      user.emailVerificationExpires = expiresAt;
      await user.save();
    } else {
      user = await User.create({
        nama: trimmedNama as string,
        email: normalizedEmail,
        avatar: null,
        password: hashedPassword,
        role: safeRole,
        isEmailVerified: false,
        emailVerificationToken: hashedToken,
        emailVerificationExpires: expiresAt,
      });
    }

    const { clientUrl } = validateEnv();
    const verificationLink = `${clientUrl}/verify-email?token=${plainToken}`;

    await sendVerificationEmail({
      nama: user.nama,
      email: user.email,
      verificationLink,
    });

    sendSuccess(res, {
      statusCode: 201,
      message: "Registrasi berhasil. Silakan cek email untuk verifikasi.",
      data: {
        email: user.email,
        verificationEmailSent: true,
      },
    });
  },
);

export const login = asyncHandler(
  async (
    req: Request<Record<string, string>, Record<string, never>, LoginRequestBody>,
    res: Response,
    next: NextFunction,
  ) => {
    const identifier =
      req.body.identifier?.trim() ||
      req.body.loginCode?.trim() ||
      req.body.email?.trim() ||
      "";
    const { password } = req.body;

    if (!identifier || !password) {
      next(new AppError(400, "Kode akun/email dan password wajib diisi.", {
        identifier: "Kode akun atau email wajib diisi.",
      }));
      return;
    }

    const loginLookup = await findUserByLoginIdentifier(identifier);
    const user = loginLookup.user;

    if (!user) {
      console.log(`[AUTH FAILED] User not found: ${identifier}`);
      
      next(
        new AppError(
          401,
          "Akun tidak ditemukan. Periksa kembali kode akun atau email yang digunakan.",
          null,
          "AUTH_ACCOUNT_NOT_FOUND",
        ),
      );
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      console.log(`[AUTH FAILED] Password mismatch for ${identifier}.`);
      next(new AppError(401, "Kode akun/email atau password salah."));
      return;
    }

    if (!user.isEmailVerified) {
      console.log(`[AUTH FAILED] Email not verified for ${identifier}`);
      next(new AppError(403, "Email belum diverifikasi. Silakan cek inbox Anda."));
      return;
    }



    if (
      loginLookup.loginCodeToPersist &&
      user.loginCode !== loginLookup.loginCodeToPersist
    ) {
      user.loginCode = loginLookup.loginCodeToPersist;
      await user.save();
    }

    sendAuthenticatedUser(res, user, "Login berhasil.");
  },
);

export const loginWithGoogle = asyncHandler(
  async (
    req: Request<Record<string, string>, Record<string, never>, GoogleLoginRequestBody>,
    res: Response,
    next: NextFunction,
  ) => {
    const credential = req.body.credential?.trim();

    if (!credential) {
      next(
        new AppError(400, "Credential Google wajib dikirim.", {
          credential: "Credential Google tidak ditemukan.",
        }),
      );
      return;
    }

    const { client, googleClientId } = getGoogleOAuthClient();

    let payload:
      | {
          email?: string | null;
          email_verified?: boolean;
          picture?: string | null;
        }
      | undefined;

    try {
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: googleClientId,
      });

      payload = ticket.getPayload();
    } catch {
      next(
        new AppError(
          401,
          "Autentikasi Google gagal diverifikasi. Silakan coba lagi.",
          null,
          "GOOGLE_TOKEN_INVALID",
        ),
      );
      return;
    }

    const normalizedEmail = payload?.email?.trim().toLowerCase();

    if (!normalizedEmail || payload?.email_verified !== true) {
      next(
        new AppError(
          401,
          "Akun Google tidak memiliki email terverifikasi.",
          null,
          "GOOGLE_EMAIL_NOT_VERIFIED",
        ),
      );
      return;
    }

    const user = await User.findOne({ email: normalizedEmail }).exec();

    if (!user) {
      next(
        new AppError(
          404,
          "Email Google ini belum terdaftar di LMS. Silakan daftar dulu menggunakan email yang sama.",
          {
            email: "Email Google belum terhubung ke akun LMS.",
          },
          "GOOGLE_ACCOUNT_NOT_FOUND",
        ),
      );
      return;
    }

    let shouldSave = false;

    if (!user.isEmailVerified) {
      user.isEmailVerified = true;
      user.emailVerifiedAt = new Date();
      user.emailVerificationToken = null;
      user.emailVerificationExpires = null;
      shouldSave = true;
    }

    if (!user.avatar && payload?.picture?.trim()) {
      user.avatar = payload.picture.trim();
      shouldSave = true;
    }

    if (shouldSave) {
      await user.save();
    }

    sendAuthenticatedUser(res, user, "Login Google berhasil.");
  },
);

export const verifyEmail = asyncHandler(
  async (
    req: Request<VerifyEmailParams>,
    res: Response,
    next: NextFunction,
  ) => {
    const { token } = req.params;

    if (!token) {
      next(new AppError(400, "Token verifikasi tidak ditemukan."));
      return;
    }

    const verificationToken = token;
    const hashedToken = crypto.createHash("sha256").update(verificationToken).digest("hex");
    const user = await User.findOne({
      emailVerificationToken: hashedToken,
    });

    if (!user) {
      next(
        new AppError(
          400,
          "Token verifikasi tidak valid.",
          null,
          "INVALID_VERIFICATION_TOKEN",
        ),
      );
      return;
    }

    if (!user.emailVerificationExpires || user.emailVerificationExpires <= new Date()) {
      next(
        new AppError(
          400,
          "Token verifikasi sudah kedaluwarsa.",
          null,
          "EXPIRED_VERIFICATION_TOKEN",
        ),
      );
      return;
    }

    user.isEmailVerified = true;
    user.emailVerifiedAt = new Date();
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();

    sendSuccess(res, {
      message: "Email berhasil diverifikasi. Silakan login.",
      data: {
        user: sanitizeUser(user),
        role: user.role,
        redirectPath: getRedirectPathByRole(user.role),
        verificationStatus: "verified",
      },
    });
  },
);

export const getMe = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    next(new AppError(401, "User belum terautentikasi."));
    return;
  }

  sendSuccess(res, {
    message: "Data user berhasil diambil.",
    data: {
      user: sanitizeUser(req.user),
      role: req.user.role,
      redirectPath: getRedirectPathByRole(req.user.role),
    },
  });
});

export const updateMe = asyncHandler(
  async (
    req: Request<Record<string, string>, Record<string, never>, UpdateProfileRequestBody>,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const trimmedNama = req.body.nama?.trim();
    const normalizedEmail = req.body.email?.trim().toLowerCase();
    const normalizedAvatar = normalizeAvatarInput(req.body.avatar);
    const errors: Record<string, string> = {};

    if (!trimmedNama) {
      errors.nama = "Nama wajib diisi.";
    }

    if (!normalizedEmail) {
      errors.email = "Email wajib diisi.";
    }

    if (normalizedAvatar.error) {
      errors.avatar = normalizedAvatar.error;
    }

    if (Object.keys(errors).length > 0) {
      next(new AppError(400, "Data profil tidak valid.", errors));
      return;
    }

    if (normalizedEmail !== req.user.email) {
      const duplicateUser = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: req.user._id },
      }).exec();

      if (duplicateUser) {
        next(new AppError(409, "Email sudah digunakan oleh akun lain.", {
          email: "Email sudah digunakan oleh akun lain.",
        }));
        return;
      }
    }

    req.user.nama = trimmedNama as string;
    req.user.email = normalizedEmail as string;

    if (req.body.avatar !== undefined) {
      req.user.avatar = normalizedAvatar.value ?? null;
    }

    await req.user.save();

    sendSuccess(res, {
      message: "Profil pengguna berhasil diperbarui.",
      data: {
        user: sanitizeUser(req.user),
        role: req.user.role,
        redirectPath: getRedirectPathByRole(req.user.role),
      },
    });
  },
);

export const changePassword = asyncHandler(
  async (
    req: Request<Record<string, string>, Record<string, never>, ChangePasswordRequestBody>,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    const errors: Record<string, string> = {};

    if (!currentPassword) {
      errors.currentPassword = "Password lama wajib diisi.";
    }

    if (!newPassword) {
      errors.newPassword = "Password baru wajib diisi.";
    } else if (newPassword.length < 8) {
      errors.newPassword = "Password baru minimal 8 karakter.";
    }

    if (!confirmNewPassword) {
      errors.confirmNewPassword = "Konfirmasi password baru wajib diisi.";
    } else if (newPassword !== confirmNewPassword) {
      errors.confirmNewPassword = "Konfirmasi password baru tidak cocok.";
    }

    if (currentPassword && newPassword && currentPassword === newPassword) {
      errors.newPassword = "Password baru harus berbeda dari password lama.";
    }

    if (Object.keys(errors).length > 0) {
      next(new AppError(400, "Data ubah password tidak valid.", errors));
      return;
    }

    const user = await User.findById(req.user._id).select("+password");

    if (!user) {
      next(new AppError(401, "User tidak ditemukan."));
      return;
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword as string,
      user.password,
    );

    if (!isCurrentPasswordValid) {
      next(new AppError(400, "Password lama tidak sesuai.", {
        currentPassword: "Password lama tidak sesuai.",
      }));
      return;
    }

    user.password = await bcrypt.hash(newPassword as string, 12);
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();

    sendSuccess(res, {
      message: "Password berhasil diperbarui.",
    });
  },
);

export const forgotPassword = asyncHandler(
  async (
    req: Request<Record<string, string>, Record<string, never>, ForgotPasswordRequestBody>,
    res: Response,
    next: NextFunction,
  ) => {
    const normalizedEmail = req.body.email?.trim().toLowerCase();

    if (!normalizedEmail) {
      next(new AppError(400, "Email wajib diisi.", {
        email: "Email wajib diisi.",
      }));
      return;
    }

    const user = await User.findOne({ email: normalizedEmail }).exec();

    if (user) {
      const { plainCode, hashedToken, expiresAt } = generatePasswordResetCode();

      user.passwordResetToken = hashedToken;
      user.passwordResetExpires = expiresAt;
      await user.save();

      await sendPasswordResetEmail({
        nama: user.nama,
        email: user.email,
        resetCode: plainCode,
        expiresAt,
      });
    }

    sendSuccess(res, {
      message: "Jika email terdaftar, instruksi reset password sudah dikirim.",
      data: {
        email: normalizedEmail,
      },
    });
  },
);

export const resetPassword = asyncHandler(
  async (
    req: Request<Record<string, string>, Record<string, never>, ResetPasswordRequestBody>,
    res: Response,
    next: NextFunction,
  ) => {
    const normalizedEmail = req.body.email?.trim().toLowerCase();
    const normalizedCode = req.body.code?.trim();
    const { newPassword, confirmNewPassword } = req.body;
    const errors: Record<string, string> = {};

    if (!normalizedEmail) {
      errors.email = "Email wajib diisi.";
    }

    if (!normalizedCode) {
      errors.code = "Kode reset wajib diisi.";
    } else if (!/^\d{6}$/.test(normalizedCode)) {
      errors.code = "Kode reset harus terdiri dari 6 digit angka.";
    }

    if (!newPassword) {
      errors.newPassword = "Password baru wajib diisi.";
    } else if (newPassword.length < 8) {
      errors.newPassword = "Password baru minimal 8 karakter.";
    }

    if (!confirmNewPassword) {
      errors.confirmNewPassword = "Konfirmasi password baru wajib diisi.";
    } else if (newPassword !== confirmNewPassword) {
      errors.confirmNewPassword = "Konfirmasi password baru tidak cocok.";
    }

    if (Object.keys(errors).length > 0) {
      next(new AppError(400, "Data reset password tidak valid.", errors));
      return;
    }

    const hashedResetToken = crypto
      .createHash("sha256")
      .update(normalizedCode as string)
      .digest("hex");

    const user = await User.findOne({
      email: normalizedEmail,
    }).select("+password");

    if (!user || !user.passwordResetToken) {
      next(new AppError(400, "Kode reset tidak valid.", {
        code: "Kode reset tidak valid.",
      }, "INVALID_RESET_CODE"));
      return;
    }

    if (!user.passwordResetExpires || user.passwordResetExpires <= new Date()) {
      next(new AppError(400, "Kode reset sudah kedaluwarsa.", {
        code: "Kode reset sudah kedaluwarsa.",
      }, "EXPIRED_RESET_CODE"));
      return;
    }

    if (user.passwordResetToken !== hashedResetToken) {
      next(new AppError(400, "Kode reset tidak valid.", {
        code: "Kode reset tidak valid.",
      }, "INVALID_RESET_CODE"));
      return;
    }

    const isSameAsCurrentPassword = await bcrypt.compare(
      newPassword as string,
      user.password,
    );

    if (isSameAsCurrentPassword) {
      next(new AppError(400, "Password baru harus berbeda dari password saat ini.", {
        newPassword: "Password baru harus berbeda dari password saat ini.",
      }));
      return;
    }

    user.password = await bcrypt.hash(newPassword as string, 12);
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();

    sendSuccess(res, {
      message: "Password berhasil direset. Silakan login dengan password baru Anda.",
    });
  },
);
