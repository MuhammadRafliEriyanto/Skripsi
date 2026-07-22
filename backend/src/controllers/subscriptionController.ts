import bcrypt from "bcrypt";
import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";

import { validateEnv } from "../config/env";
import { Branch } from "../models/Branch";
import { Student } from "../models/Student";
import { Payment } from "../models/Payment";
import { Subscription } from "../models/Subscription";
import { User, type UserDocument } from "../models/User";
import { getCurrentAcademicPeriod } from "../utils/academicGrade";
import {
  expireXenditInvoice,
} from "../services/xenditService";
import { AppError, sendSuccess } from "../utils/apiResponse";
import asyncHandler from "../utils/asyncHandler";
import { buildStudentLoginCode } from "../utils/accountCode";
import { sendVerificationEmail } from "../utils/email";
import { getNextPublicId } from "../utils/publicId";
import {
  attachXenditSessionToPayment,
  createPendingSubscriptionAndPayment,
  findBlockingPendingPaymentForStudent,
  resolveRenewalWindow,
} from "../utils/membershipPayments";
import {
  CLASS_PRICING_MATRIX,
  ONLINE_PACKAGE_DEFINITIONS,
  type StudentWithUser,
  getClassPricedOnlinePackageByKey,
  getMembershipSnapshotByUserId,
  getOnlinePackageByKey,
  toPublicPayment,
  toPublicStudentMembership,
  toPublicSubscription,
} from "../utils/subscription";
import { sendMembershipExpiryReminderIfNeeded } from "../utils/membershipExpiryReminder";
import { resolveNextAcademicClassSelection } from "../utils/studentClass";
import { buildGeneratedPasswordForStudent } from "../utils/studentPassword";

type RegisterOnlineRequestBody = {
  nama?: string;
  email?: string;
  phone?: string;
  branch?: string;
  program?: string;
  classLevel?: string;
  packageKey?: string;
};

type CreateMyRenewalRequestBody = {
  program?: string;
  classLevel?: string;
  packageKey?: string;
};

const PROGRAM_CLASS_OPTIONS = {
  SD: ["Kelas 2", "Kelas 3", "Kelas 4", "Kelas 5", "Kelas 6"],
  SMP: ["Kelas 7", "Kelas 8", "Kelas 9"],
  SMA: ["Kelas 10", "Kelas 11", "Kelas 12"],
} as const;

const PROGRAM_LABELS: Record<keyof typeof PROGRAM_CLASS_OPTIONS, string> = {
  SD: "SD / Program Dasar",
  SMP: "SMP / Program Reguler",
  SMA: "SMA / Program Intensif",
};

function normalizeText(value: string | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function normalizeEmail(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function normalizePhone(value: string | undefined) {
  return value?.trim().replace(/\s+/g, "") ?? "";
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function resolveRegisterBranchName(value: string | undefined) {
  const normalizedBranch = normalizeText(value);

  if (!normalizedBranch) {
    return null;
  }

  return Branch.findOne({
    name: new RegExp(`^${escapeRegex(normalizedBranch)}$`, "i"),
    status: "Aktif",
  })
    .select("name")
    .exec();
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

function buildStudentClassName(program: keyof typeof PROGRAM_CLASS_OPTIONS, classLevel: string) {
  return `${program} ${classLevel}`.trim();
}

export const getSubscriptionConfig = asyncHandler(
  async (_req: Request, res: Response) => {
    return sendSuccess(res, {
      message: "Konfigurasi membership berhasil dimuat.",
      data: {
        packages: Object.values(ONLINE_PACKAGE_DEFINITIONS).map((item) => ({
          ...item,
          highlight:
            item.packageKey === "1-semester"
              ? "Paket setengah tahun untuk fokus pada satu semester ajaran."
              : "Pilihan tahunan untuk progres belajar yang ingin dijaga penuh sepanjang tahun.",
        })),
        programs: Object.keys(PROGRAM_CLASS_OPTIONS).map((program) => ({
          value: program,
          label: PROGRAM_LABELS[program as keyof typeof PROGRAM_CLASS_OPTIONS],
        })),
        classOptionsByProgram: Object.fromEntries(
          Object.entries(PROGRAM_CLASS_OPTIONS).map(([program, classOptions]) => [
            program,
            [...classOptions],
          ]),
        ),
        classPricingMatrix: CLASS_PRICING_MATRIX,
      },
    });
  },
);

export const registerOnline = asyncHandler(
  async (
    req: Request<Record<string, string>, Record<string, never>, RegisterOnlineRequestBody>,
    res: Response,
    next: NextFunction,
    ) => {
    const nama = normalizeText(req.body.nama);
    const email = normalizeEmail(req.body.email);
    const phone = normalizePhone(req.body.phone);
    const branchInput = normalizeText(req.body.branch);
    const program = normalizeText(req.body.program) as keyof typeof PROGRAM_CLASS_OPTIONS;
    const classLevel = normalizeText(req.body.classLevel);
    const selectedPackage = getOnlinePackageByKey(req.body.packageKey);
    const errors: Record<string, string> = {};

    if (!nama) {
      errors.nama = "Nama wajib diisi.";
    }

    if (!email) {
      errors.email = "Email wajib diisi.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "Email belum valid.";
    }

    if (!phone) {
      errors.phone = "Nomor HP wajib diisi.";
    }

    if (!branchInput) {
      errors.branch = "Cabang wajib dipilih.";
    }

    if (!program || !(program in PROGRAM_CLASS_OPTIONS)) {
      errors.program = "Jenjang atau program belum valid.";
    }

    if (!classLevel) {
      errors.classLevel = "Kelas wajib dipilih.";
    } else if (
      program &&
      program in PROGRAM_CLASS_OPTIONS &&
      !PROGRAM_CLASS_OPTIONS[program].includes(classLevel as never)
    ) {
      errors.classLevel = "Kelas tidak sesuai dengan jenjang yang dipilih.";
    }

    if (!selectedPackage) {
      errors.packageKey = "Paket belajar wajib dipilih.";
    }

    const branch =
      branchInput && !errors.branch ? await resolveRegisterBranchName(branchInput) : null;

    if (branchInput && !branch) {
      errors.branch = "Cabang tidak ditemukan atau belum aktif.";
    }

    if (Object.keys(errors).length > 0) {
      next(new AppError(400, "Data pendaftaran online tidak valid.", errors));
      return;
    }

    if (!selectedPackage) {
      next(new AppError(400, "Paket belajar wajib dipilih."));
      return;
    }

    const existingUser = await User.findOne({ email }).exec();

    if (existingUser) {
      next(new AppError(409, "Email sudah digunakan oleh akun lain.", {
        email: "Email sudah digunakan oleh akun lain.",
      }));
      return;
    }

    const { plainToken, hashedToken, expiresAt } = generateVerificationToken();
    const studentId = await getNextPublicId(Student, "studentId", "STD");
    const loginCode = buildStudentLoginCode(studentId);
    const generatedPassword = buildGeneratedPasswordForStudent({ studentId });
    const hashedPassword = await bcrypt.hash(generatedPassword, 12);
    const className = buildStudentClassName(program, classLevel);
    const existingLoginCode = await User.exists({ loginCode });
    const studentAcademicPeriod = getCurrentAcademicPeriod(new Date());

    if (existingLoginCode) {
      next(new AppError(409, "Kode akun siswa sudah digunakan. Silakan coba daftar ulang.", {
        loginCode: "Kode akun siswa sudah digunakan.",
      }));
      return;
    }

    let createdUser: UserDocument | null = null;
    let createdStudentId: string | null = null;
    let createdSubscriptionId: string | null = null;
    let createdPaymentId: string | null = null;
    let createdXenditPaymentSessionId: string | null = null;

    try {
      const user = await User.create({
        nama,
        email,
        loginCode,
        avatar: null,
        password: hashedPassword,
        role: "siswa",
        isEmailVerified: false,
        emailVerificationToken: hashedToken,
        emailVerificationExpires: expiresAt,
      });
      createdUser = user;

      const student = await Student.create({
        studentId,
        userId: user._id,
        phone,
        branch: branch?.name ?? "",
        program,
        className,
        academicYear: studentAcademicPeriod.academicYear,
        birthDate: null,
        status: "Nonaktif",
        academicJoinedAt: null,
      });
      createdStudentId = student._id.toString();

      const { subscription, payment } = await createPendingSubscriptionAndPayment({
        user,
        student,
        packageDefinition: selectedPackage,
        source: "register_online",
      });
      createdSubscriptionId = subscription._id.toString();
      createdPaymentId = payment._id.toString();

      const xenditPaymentSession = await attachXenditSessionToPayment({
        payment,
        subscription,
        student,
        user,
      });
      createdXenditPaymentSessionId = xenditPaymentSession.id;

      const { clientUrl } = validateEnv();
      const verificationLink = `${clientUrl}/verify-email?token=${plainToken}`;
      let verificationEmailSent = false;

      try {
        await sendVerificationEmail({
          nama: user.nama,
          email: user.email,
          verificationLink,
          accountCredentials: {
            loginCode,
            password: generatedPassword,
          },
        });
        verificationEmailSent = true;
      } catch (error) {
        console.error("[register-online] verification_email_failed", {
          message: error instanceof Error ? error.message : "Unknown email error",
          email: user.email,
        });
      }

      const populatedStudent = (await Student.findById(student._id)
        .populate<{ userId: UserDocument }>("userId")
        .exec()) as StudentWithUser | null;

      if (!populatedStudent) {
        throw new AppError(500, "Gagal memuat ulang data siswa yang baru dibuat.");
      }

      sendSuccess(res, {
        statusCode: 201,
        message: verificationEmailSent
          ? "Pendaftaran online berhasil. Silakan cek email untuk verifikasi lalu lanjutkan ke checkout pembayaran."
          : "Pendaftaran online berhasil. Email verifikasi belum dapat dikirim, tetapi checkout pembayaran Anda sudah dibuat.",
        data: {
          user: {
            _id: user._id.toString(),
            nama: user.nama,
            email: user.email,
            loginCode: user.loginCode ?? null,
            role: user.role,
            isEmailVerified: user.isEmailVerified,
          },
          student: toPublicStudentMembership(populatedStudent),
          subscription: toPublicSubscription(subscription),
          payment: toPublicPayment(payment),
          verificationEmailSent,
          statusPagePath: `/register-online/status?paymentId=${payment.paymentId}`,
        },
      });
    } catch (error) {
      if (createdXenditPaymentSessionId) {
        try {
          await expireXenditInvoice(createdXenditPaymentSessionId);
        } catch (xenditCancelError) {
          console.error("[register-online] cancel_xendit_session_failed", {
            message:
              xenditCancelError instanceof Error
                ? xenditCancelError.message
                : "Unknown Xendit cancel error",
            paymentSessionId: createdXenditPaymentSessionId,
          });
        }
      }

      await Promise.all([
        createdPaymentId ? Payment.deleteOne({ _id: createdPaymentId }) : Promise.resolve(),
        createdSubscriptionId
          ? Subscription.deleteOne({ _id: createdSubscriptionId })
          : Promise.resolve(),
        createdStudentId ? Student.deleteOne({ _id: createdStudentId }) : Promise.resolve(),
        createdUser ? User.deleteOne({ _id: createdUser._id }) : Promise.resolve(),
      ]);

      throw error;
    }
  },
);

export const getMySubscriptionStatus = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const student = await Student.findOne({ userId: req.user._id }).exec();
    if (student) {
      await findBlockingPendingPaymentForStudent(student._id);
    }
    const snapshot = await getMembershipSnapshotByUserId(req.user._id);

    if (req.user.role === "siswa" && snapshot.subscription) {
      void sendMembershipExpiryReminderIfNeeded({
        subscription: snapshot.subscription,
        user: req.user,
      }).catch((error) => {
        console.error("[subscription-me] membership_expiry_reminder_failed", {
          message: error instanceof Error ? error.message : "Unknown reminder error",
          subscriptionId: snapshot.subscription?._id.toString(),
          userId: req.user?._id.toString(),
        });
      });
    }

    sendSuccess(res, {
      message: "Status membership berhasil diambil.",
      data: {
        user: {
          _id: req.user._id.toString(),
          nama: req.user.nama,
          email: req.user.email,
          role: req.user.role,
          isEmailVerified: req.user.isEmailVerified,
        },
        student: snapshot.student ? toPublicStudentMembership(snapshot.student) : null,
        subscription: snapshot.subscription ? toPublicSubscription(snapshot.subscription) : null,
        payment: snapshot.payment ? toPublicPayment(snapshot.payment) : null,
        accessStatus: snapshot.accessStatus,
        hasActiveSubscription:
          snapshot.accessStatus === "active" || snapshot.accessStatus === "expiring",
        daysRemaining: snapshot.daysRemaining,
      },
    });
  },
);

export const createMySubscriptionRenewal = asyncHandler(
  async (
    req: Request<Record<string, string>, Record<string, never>, CreateMyRenewalRequestBody>,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    if (req.user.role !== "siswa") {
      next(new AppError(403, "Hanya siswa yang dapat membuat perpanjangan membership."));
      return;
    }

    const packageKey = normalizeText(req.body.packageKey);
    const packageDefinition = getOnlinePackageByKey(packageKey);
    const errors: Record<string, string> = {};

    if (!packageKey) {
      errors.packageKey = "Paket perpanjangan wajib dipilih.";
    } else if (!packageDefinition) {
      errors.packageKey = "Paket perpanjangan tidak valid.";
    }

    if (Object.keys(errors).length > 0) {
      next(new AppError(400, "Data perpanjangan membership tidak valid.", errors));
      return;
    }

    const student = await Student.findOne({ userId: req.user._id }).exec();

    if (!student) {
      next(new AppError(404, "Data siswa tidak ditemukan.", null, "STUDENT_NOT_FOUND"));
      return;
    }

    if (student.status !== "Aktif") {
      next(
        new AppError(
          409,
          "Membership hanya dapat diperpanjang oleh siswa aktif.",
          null,
          "STUDENT_INACTIVE",
        ),
      );
      return;
    }

    const classSelection = resolveNextAcademicClassSelection({
      program: student.program,
      className: student.className,
    });

    if (!classSelection) {
      next(
        new AppError(
          409,
          "Kelas siswa belum bisa dikenali untuk perpanjangan otomatis.",
          {
            className: student.className,
            program: student.program,
          },
          "INVALID_STUDENT_CLASS",
        ),
      );
      return;
    }

    const selectedPackage = getClassPricedOnlinePackageByKey(
      packageKey,
      classSelection.className,
    );

    if (!selectedPackage) {
      next(new AppError(400, "Paket perpanjangan tidak valid.", null, "INVALID_PACKAGE_KEY"));
      return;
    }

    const paidSubscriptionExists = await Subscription.exists({
      studentId: student._id,
      paymentStatus: "paid",
    });

    if (!paidSubscriptionExists) {
      next(
        new AppError(
          409,
          "Siswa belum memiliki membership awal yang lunas.",
          null,
          "NO_PAID_MEMBERSHIP",
        ),
      );
      return;
    }

    const blockingPendingPayment = await findBlockingPendingPaymentForStudent(student._id);

    if (blockingPendingPayment) {
      next(
        new AppError(
          409,
          "Masih ada tagihan membership yang menunggu pembayaran.",
          {
            paymentId: blockingPendingPayment.payment.paymentId,
            subscriptionCode: blockingPendingPayment.subscription.subscriptionCode,
          },
          "PENDING_PAYMENT_EXISTS",
        ),
      );
      return;
    }

    const membershipSnapshot = await getMembershipSnapshotByUserId(req.user._id);
    const isRenewalWindowOpen =
      membershipSnapshot.accessStatus === "expiring" ||
      membershipSnapshot.accessStatus === "expired";

    if (!isRenewalWindowOpen) {
      next(
        new AppError(
          409,
          "Perpanjangan membership baru dibuka otomatis saat masa aktif tersisa 14 hari atau membership sudah berakhir.",
          {
            accessStatus: membershipSnapshot.accessStatus,
            daysRemaining: membershipSnapshot.daysRemaining,
          },
          "RENEWAL_WINDOW_NOT_OPEN",
        ),
      );
      return;
    }

    const renewalPreview = await resolveRenewalWindow(
      student._id,
      selectedPackage.durationMonth,
      new Date(),
    );

    let createdSubscriptionId: string | null = null;
    let createdPaymentId: string | null = null;
    let createdXenditPaymentSessionId: string | null = null;

    try {
      const { subscription, payment } = await createPendingSubscriptionAndPayment({
        user: req.user,
        student,
        packageDefinition: selectedPackage,
        source: "register_online",
        renewalOfSubscriptionId: renewalPreview.renewalOfSubscriptionId,
        targetProgram: classSelection.level,
        targetClassName: classSelection.className,
      });
      createdSubscriptionId = subscription._id.toString();
      createdPaymentId = payment._id.toString();

      const paymentSession = await attachXenditSessionToPayment({
        payment,
        subscription,
        student,
        user: req.user,
      });
      createdXenditPaymentSessionId = paymentSession.id;

      await Payment.updateMany(
        { studentId: student._id, status: "draft_renewal", archivedAt: null },
        {
          $set: {
            archivedAt: new Date(),
            archiveReason: "Digantikan oleh perpanjangan yang dibuat mandiri oleh siswa",
          },
        },
      );

      sendSuccess(res, {
        statusCode: 201,
        message: "Perpanjangan membership berhasil disiapkan.",
        data: {
          student: toPublicStudentMembership({
            ...student.toObject(),
            userId: req.user,
          } as StudentWithUser),
          subscription: toPublicSubscription(subscription),
          payment: toPublicPayment(payment),
          statusPagePath: `/register-online/status?paymentId=${payment.paymentId}`,
        },
      });
    } catch (error) {
      if (createdXenditPaymentSessionId) {
        try {
          await expireXenditInvoice(createdXenditPaymentSessionId);
        } catch (xenditCancelError) {
          console.error("[student-renewal] cancel_xendit_session_failed", {
            message:
              xenditCancelError instanceof Error
                ? xenditCancelError.message
                : "Unknown Xendit cancel error",
            paymentSessionId: createdXenditPaymentSessionId,
          });
        }
      }

      await Promise.all([
        createdPaymentId ? Payment.deleteOne({ _id: createdPaymentId }) : Promise.resolve(),
        createdSubscriptionId
          ? Subscription.deleteOne({ _id: createdSubscriptionId })
          : Promise.resolve(),
      ]);

      throw error;
    }
  },
);

export const getMySubscriptionPayments = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const student = await Student.findOne({ userId: req.user._id }).exec();
    if (student) {
      await findBlockingPendingPaymentForStudent(student._id);
    }

    const payments = await Payment.find({
      userId: req.user._id,
      archivedAt: null,
    })
      .sort({ createdAt: -1, _id: -1 })
      .exec();

    const subscriptionIds = Array.from(
      new Set(payments.map((payment) => payment.subscriptionId.toString())),
    );

    const subscriptions =
      subscriptionIds.length > 0
        ? await Subscription.find({
            _id: {
              $in: subscriptionIds,
            },
          })
            .select("_id subscriptionCode")
            .exec()
        : [];

    const subscriptionCodeMap = new Map(
      subscriptions.map((subscription) => [
        subscription._id.toString(),
        subscription.subscriptionCode,
      ]),
    );

    sendSuccess(res, {
      message: "Histori tagihan berhasil diambil.",
      data: {
        payments: payments.map((payment) => ({
          paymentId: payment.paymentId,
          packageName: payment.packageName,
          amount: payment.amount,
          status: payment.status,
          provider: payment.provider,
          method: payment.method,
          checkoutUrl: payment.status === "pending" ? payment.checkoutUrl : null,
          paidAt: payment.paidAt,
          expiresAt: payment.expiresAt,
          createdAt: payment.createdAt,
          subscriptionCode:
            subscriptionCodeMap.get(payment.subscriptionId.toString()) ?? null,
        })),
      },
    });
  },
);
