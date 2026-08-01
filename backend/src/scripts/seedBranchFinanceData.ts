import mongoose, { Types } from "mongoose";

import "../config/env";
import { Branch } from "../models/Branch";
import { BranchIncome, type BranchIncomeStatus } from "../models/BranchIncome";
import {
  Expense,
  type ExpenseCategory,
  type ExpenseStatus,
} from "../models/Expense";
import { Payment, type PaymentStatus } from "../models/Payment";
import { Student } from "../models/Student";
import { Subscription } from "../models/Subscription";
import { User } from "../models/User";
import { getNextPublicId } from "../utils/publicId";
import {
  ONLINE_PACKAGE_DEFINITIONS,
  buildSubscriptionEndDate,
} from "../utils/subscription";

type SeedOptions = {
  apply: boolean;
};

type BranchSeedConfig = {
  branch: string;
  paymentCount: number;
  paidCount: number;
  pendingCount: number;
  expiredCount: number;
  failedCount: number;
  incomeCount: number;
  expenseCount: number;
};

type SeedStudent = {
  _id: Types.ObjectId;
  studentId: string;
  userId: Types.ObjectId;
  branch: string;
  className: string;
  program: string;
};

type IncomeTemplate = {
  title: string;
  category: string;
  payerOrSource: string;
  amount: number;
  paymentMethod: string;
  status: BranchIncomeStatus;
  daysAgo: number;
};

type ExpenseTemplate = {
  title: string;
  legacyTitles?: string[];
  category: ExpenseCategory;
  vendorOrRecipient: string;
  amount: number;
  paymentMethod: string;
  status: ExpenseStatus;
  daysAgo: number;
  dueInDays?: number;
};

const SEED_PAYMENT_PROVIDER = "simulasi_lokal";
const SEED_NOTE_MARKER = "[finance-demo-v1]";
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const PAYMENT_METHODS = ["transfer_bank", "qris", "tunai"];
const PACKAGE_OPTIONS = [
  ONLINE_PACKAGE_DEFINITIONS["1-semester"],
  ONLINE_PACKAGE_DEFINITIONS["2-semester"],
];

const BRANCH_CONFIGS: BranchSeedConfig[] = [
  {
    branch: "Slawi",
    paymentCount: 18,
    paidCount: 12,
    pendingCount: 3,
    expiredCount: 2,
    failedCount: 1,
    incomeCount: 7,
    expenseCount: 9,
  },
  {
    branch: "Adiwerna",
    paymentCount: 12,
    paidCount: 8,
    pendingCount: 2,
    expiredCount: 1,
    failedCount: 1,
    incomeCount: 6,
    expenseCount: 8,
  },
];

const INCOME_TEMPLATES: IncomeTemplate[] = [
  {
    title: "Pendaftaran siswa baru",
    category: "Biaya Pendaftaran",
    payerOrSource: "Pendaftaran gelombang reguler",
    amount: 1_500_000,
    paymentMethod: "Transfer Bank",
    status: "Diterima",
    daysAgo: 105,
  },
  {
    title: "Penjualan modul belajar",
    category: "Modul dan Buku",
    payerOrSource: "Siswa kelas SMP",
    amount: 2_250_000,
    paymentMethod: "QRIS",
    status: "Diterima",
    daysAgo: 78,
  },
  {
    title: "Biaya tryout semester",
    category: "Tryout",
    payerOrSource: "Peserta tryout cabang",
    amount: 3_200_000,
    paymentMethod: "Transfer Bank",
    status: "Diterima",
    daysAgo: 55,
  },
  {
    title: "Kelas intensif ujian",
    category: "Program Tambahan",
    payerOrSource: "Peserta kelas intensif",
    amount: 4_500_000,
    paymentMethod: "Transfer Bank",
    status: "Diterima",
    daysAgo: 34,
  },
  {
    title: "Penjualan seragam bimbel",
    category: "Perlengkapan Siswa",
    payerOrSource: "Siswa baru",
    amount: 1_800_000,
    paymentMethod: "Tunai",
    status: "Diterima",
    daysAgo: 21,
  },
  {
    title: "Kerja sama tryout sekolah",
    category: "Kemitraan Sekolah",
    payerOrSource: "Sekolah mitra",
    amount: 5_750_000,
    paymentMethod: "Transfer Bank",
    status: "Menunggu",
    daysAgo: 9,
  },
  {
    title: "Kelas privat tambahan",
    category: "Program Tambahan",
    payerOrSource: "Peserta kelas privat",
    amount: 2_400_000,
    paymentMethod: "QRIS",
    status: "Menunggu",
    daysAgo: 3,
  },
];

const EXPENSE_TEMPLATES: ExpenseTemplate[] = [
  {
    title: "Pembayaran listrik bulanan",
    category: "Listrik",
    vendorOrRecipient: "PLN",
    amount: 1_250_000,
    paymentMethod: "Transfer Bank",
    status: "Selesai",
    daysAgo: 102,
  },
  {
    title: "Langganan internet cabang",
    category: "Wifi",
    vendorOrRecipient: "Penyedia Internet",
    amount: 650_000,
    paymentMethod: "Autodebet",
    status: "Selesai",
    daysAgo: 74,
  },
  {
    title: "Sewa gedung bulanan",
    category: "Gedung",
    vendorOrRecipient: "Pemilik Gedung",
    amount: 6_500_000,
    paymentMethod: "Transfer Bank",
    status: "Selesai",
    daysAgo: 58,
  },
  {
    title: "Perawatan AC dan fasilitas kelas",
    legacyTitles: ["Honor guru bulan berjalan"],
    category: "Gedung",
    vendorOrRecipient: "Teknisi Fasilitas",
    amount: 3_250_000,
    paymentMethod: "Transfer Bank",
    status: "Selesai",
    daysAgo: 36,
  },
  {
    title: "Pengadaan meja dan kursi kelas",
    legacyTitles: ["Gaji admin cabang"],
    category: "Gedung",
    vendorOrRecipient: "Toko Furnitur Pendidikan",
    amount: 3_500_000,
    paymentMethod: "Transfer Bank",
    status: "Selesai",
    daysAgo: 29,
  },
  {
    title: "Pembelian alat tulis",
    category: "Gedung",
    vendorOrRecipient: "Toko ATK",
    amount: 875_000,
    paymentMethod: "Tunai",
    status: "Selesai",
    daysAgo: 18,
  },
  {
    title: "Perawatan komputer admin",
    category: "Wifi",
    vendorOrRecipient: "Teknisi Komputer",
    amount: 1_350_000,
    paymentMethod: "QRIS",
    status: "Dijadwalkan",
    daysAgo: 8,
    dueInDays: 4,
  },
  {
    title: "Kebutuhan kebersihan kelas",
    category: "Gedung",
    vendorOrRecipient: "Pemasok Kebersihan",
    amount: 550_000,
    paymentMethod: "Tunai",
    status: "Menunggu",
    daysAgo: 4,
    dueInDays: 7,
  },
  {
    title: "Perbaikan fasilitas kelas",
    category: "Gedung",
    vendorOrRecipient: "Penyedia Jasa Bangunan",
    amount: 2_100_000,
    paymentMethod: "Transfer Bank",
    status: "Menunggu",
    daysAgo: 2,
    dueInDays: 10,
  },
];

function parseOptions(argv: string[]): SeedOptions {
  return {
    apply: argv.includes("--apply"),
  };
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * DAY_IN_MS);
}

function daysFromNow(days: number) {
  return new Date(Date.now() + days * DAY_IN_MS);
}

function getPaymentStatuses(config: BranchSeedConfig): PaymentStatus[] {
  return [
    ...Array.from({ length: config.paidCount }, () => "paid" as const),
    ...Array.from({ length: config.pendingCount }, () => "pending" as const),
    ...Array.from({ length: config.expiredCount }, () => "expired" as const),
    ...Array.from({ length: config.failedCount }, () => "failed" as const),
  ];
}

function getPaymentCreatedAt(index: number, status: PaymentStatus) {
  const paidDayOffsets = [4, 9, 15, 24, 33, 45, 58, 72, 88, 105, 120, 138];
  const statusOffset = status === "pending" ? 6 : status === "expired" ? 42 : 18;

  return daysAgo(paidDayOffsets[index % paidDayOffsets.length] ?? statusOffset);
}

function matchesExpenseTemplateTitle(
  title: string,
  template: ExpenseTemplate,
) {
  return title === template.title || (template.legacyTitles ?? []).includes(title);
}

async function loadSeedStudents(branch: string, requiredCount: number) {
  const students = (await Student.find({ branch, status: "Aktif" })
    .select("_id studentId userId branch className program")
    .sort({ studentId: 1 })
    .lean()
    .exec()) as SeedStudent[];
  const existingSubscriptions = await Subscription.find({
    studentId: { $in: students.map((student) => student._id) },
  })
    .select("studentId")
    .lean()
    .exec();
  const subscribedStudentIds = new Set(
    existingSubscriptions.map((subscription) => subscription.studentId.toString()),
  );
  const users = await User.find({
    _id: { $in: students.map((student) => student.userId) },
  })
    .select("_id")
    .lean()
    .exec();
  const validUserIds = new Set(users.map((user) => user._id.toString()));
  const eligibleStudents = students.filter(
    (student) =>
      validUserIds.has(student.userId.toString()) &&
      !subscribedStudentIds.has(student._id.toString()),
  );

  if (eligibleStudents.length < requiredCount) {
    throw new Error(
      `Siswa eligible cabang ${branch} hanya ${eligibleStudents.length}, kebutuhan ${requiredCount}.`,
    );
  }

  return eligibleStudents.slice(0, requiredCount);
}

async function createPaymentSeed(params: {
  student: SeedStudent;
  adminUserId: Types.ObjectId;
  status: PaymentStatus;
  index: number;
}) {
  const packageDefinition = PACKAGE_OPTIONS[params.index % PACKAGE_OPTIONS.length];
  const createdAt = getPaymentCreatedAt(params.index, params.status);
  const paidAt = params.status === "paid" ? createdAt : null;
  const endDate = paidAt
    ? buildSubscriptionEndDate(paidAt, packageDefinition.durationMonth)
    : null;
  const subscriptionStatus =
    params.status === "paid"
      ? endDate && endDate.getTime() > Date.now()
        ? "active"
        : "expired"
      : params.status === "expired"
        ? "expired"
        : "pending";
  const subscriptionCode = await getNextPublicId(
    Subscription,
    "subscriptionCode",
    "SUB",
  );
  const subscription = await Subscription.create({
    subscriptionCode,
    userId: params.student.userId,
    studentId: params.student._id,
    packageKey: packageDefinition.packageKey,
    packageName: packageDefinition.packageName,
    durationMonth: packageDefinition.durationMonth,
    startDate: paidAt,
    endDate,
    status: subscriptionStatus,
    paymentStatus: params.status,
    source: "admin",
    createdByAdminId: params.adminUserId,
    renewalOfSubscriptionId: null,
    createdAt,
    updatedAt: createdAt,
  });

  try {
    const paymentId = await getNextPublicId(Payment, "paymentId", "PAY");

    await Payment.create({
      paymentId,
      userId: params.student.userId,
      studentId: params.student._id,
      subscriptionId: subscription._id,
      packageKey: packageDefinition.packageKey,
      packageName: packageDefinition.packageName,
      durationMonth: packageDefinition.durationMonth,
      amount: packageDefinition.amount,
      provider: SEED_PAYMENT_PROVIDER,
      method: PAYMENT_METHODS[params.index % PAYMENT_METHODS.length],
      status: params.status,
      source: "admin",
      createdByAdminId: params.adminUserId,
      paidAt,
      checkoutUrl: null,
      expiresAt:
        params.status === "pending"
          ? daysFromNow(10 + params.index)
          : params.status === "expired"
            ? new Date(createdAt.getTime() + 7 * DAY_IN_MS)
            : null,
      checkoutLastSentAt: null,
      checkoutSendCount: 0,
      cancelReason: null,
      canceledAt: null,
      xenditReferenceId: null,
      xenditPaymentSessionId: null,
      xenditPaymentRequestId: null,
      xenditPaymentId: null,
      xenditCustomerId: null,
      xenditSessionStatus: null,
      xenditWebhookReceivedAt: null,
      createdAt,
      updatedAt: createdAt,
    });
  } catch (error) {
    await Subscription.deleteOne({ _id: subscription._id });
    throw error;
  }
}

async function createIncomeSeed(params: {
  branch: string;
  adminUserId: Types.ObjectId;
  template: IncomeTemplate;
  amountMultiplier: number;
}) {
  const incomeId = await getNextPublicId(BranchIncome, "incomeId", "INC");
  const createdAt = daysAgo(params.template.daysAgo);

  await BranchIncome.create({
    incomeId,
    title: params.template.title,
    branch: params.branch,
    category: params.template.category,
    payerOrSource: params.template.payerOrSource,
    amount: Math.round(params.template.amount * params.amountMultiplier),
    paymentMethod: params.template.paymentMethod,
    status: params.template.status,
    receivedAt: params.template.status === "Diterima" ? createdAt : null,
    note: `${SEED_NOTE_MARKER} Data simulasi pemasukan ${params.branch}.`,
    createdBy: params.adminUserId,
    updatedBy: params.adminUserId,
    createdAt,
    updatedAt: createdAt,
  });
}

async function createExpenseSeed(params: {
  branch: string;
  adminUserId: Types.ObjectId;
  template: ExpenseTemplate;
  amountMultiplier: number;
}) {
  const expenseId = await getNextPublicId(Expense, "expenseId", "EXP");
  const createdAt = daysAgo(params.template.daysAgo);

  await Expense.create({
    expenseId,
    title: params.template.title,
    branch: params.branch,
    category: params.template.category,
    vendorOrRecipient: params.template.vendorOrRecipient,
    amount: Math.round(params.template.amount * params.amountMultiplier),
    paymentMethod: params.template.paymentMethod,
    status: params.template.status,
    paidAt: params.template.status === "Selesai" ? createdAt : null,
    dueDate:
      params.template.status === "Selesai"
        ? createdAt
        : daysFromNow(params.template.dueInDays ?? 7),
    note: `${SEED_NOTE_MARKER} Data simulasi pengeluaran ${params.branch}.`,
    createdBy: params.adminUserId,
    updatedBy: params.adminUserId,
    createdAt,
    updatedAt: createdAt,
  });
}

async function run() {
  const options = parseOptions(process.argv.slice(2));

  await mongoose.connect(process.env.MONGO_URI as string);

  const [branches, seededPayments, seededIncomes, seededExpenses] = await Promise.all([
    Branch.find({ name: { $in: BRANCH_CONFIGS.map((config) => config.branch) } })
      .select("name adminUserId")
      .lean()
      .exec(),
    Payment.find({ provider: SEED_PAYMENT_PROVIDER }).select("studentId").lean().exec(),
    BranchIncome.find({ note: { $regex: SEED_NOTE_MARKER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") } })
      .select("branch")
      .lean()
      .exec(),
    Expense.find({ note: { $regex: SEED_NOTE_MARKER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") } })
      .select("_id branch title category vendorOrRecipient amount")
      .lean()
      .exec(),
  ]);
  const seededPaymentStudents = seededPayments.length
    ? await Student.find({
        _id: { $in: seededPayments.map((payment) => payment.studentId) },
      })
        .select("_id branch")
        .lean()
        .exec()
    : [];
  const seededStudentBranchById = new Map(
    seededPaymentStudents.map((student) => [student._id.toString(), student.branch]),
  );
  const plan = BRANCH_CONFIGS.map((config) => {
    const branch = branches.find((item) => item.name === config.branch);
    const existingPaymentCount = seededPayments.filter(
      (payment) => seededStudentBranchById.get(payment.studentId.toString()) === config.branch,
    ).length;
    const existingIncomeCount = seededIncomes.filter(
      (income) => income.branch === config.branch,
    ).length;
    const seededBranchExpenses = seededExpenses.filter(
      (expense) => expense.branch === config.branch,
    );
    const configuredExpenseTemplates = EXPENSE_TEMPLATES.slice(0, config.expenseCount);
    const missingExpenseIndexes = configuredExpenseTemplates
      .map((template, index) => ({ template, index }))
      .filter(
        ({ template }) =>
          !seededBranchExpenses.some((expense) =>
            matchesExpenseTemplateTitle(expense.title, template),
          ),
      )
      .map(({ index }) => index);
    const migrateExpenseCount = seededBranchExpenses.filter((expense) => {
      const template = configuredExpenseTemplates.find((candidate) =>
        matchesExpenseTemplateTitle(expense.title, candidate),
      );

      return Boolean(
        template &&
          (expense.title !== template.title ||
            expense.category !== template.category ||
            expense.vendorOrRecipient !== template.vendorOrRecipient),
      );
    }).length;

    if (!branch?.adminUserId) {
      throw new Error(`Cabang ${config.branch} belum terhubung ke admin.`);
    }

    return {
      config,
      adminUserId: branch.adminUserId,
      existingPaymentCount,
      existingIncomeCount,
      seededBranchExpenses,
      missingExpenseIndexes,
      migrateExpenseCount,
      createPaymentCount: Math.max(config.paymentCount - existingPaymentCount, 0),
      createIncomeCount: Math.max(config.incomeCount - existingIncomeCount, 0),
      createExpenseCount: missingExpenseIndexes.length,
    };
  });

  console.log(`[seed-branch-finance] action=${options.apply ? "apply" : "dry-run"}`);
  console.table(
    plan.map((item) => ({
      Cabang: item.config.branch,
      "Pembayaran target": item.config.paymentCount,
      "Pembayaran baru": item.createPaymentCount,
      "Pemasukan target": item.config.incomeCount,
      "Pemasukan baru": item.createIncomeCount,
      "Pengeluaran target": item.config.expenseCount,
      "Pengeluaran baru": item.createExpenseCount,
      "Pengeluaran diperbarui": item.migrateExpenseCount,
    })),
  );

  if (!options.apply) {
    console.log("Dry-run selesai. Tidak ada data yang diubah.");
    return;
  }

  for (const item of plan) {
    const students = await loadSeedStudents(
      item.config.branch,
      item.createPaymentCount,
    );
    const statuses = getPaymentStatuses(item.config).slice(
      item.existingPaymentCount,
      item.config.paymentCount,
    );

    for (let index = 0; index < item.createPaymentCount; index += 1) {
      await createPaymentSeed({
        student: students[index],
        adminUserId: item.adminUserId,
        status: statuses[index] ?? "paid",
        index: item.existingPaymentCount + index,
      });
    }

    const amountMultiplier = item.config.branch === "Slawi" ? 1 : 0.78;

    for (const expense of item.seededBranchExpenses) {
      const template = EXPENSE_TEMPLATES.slice(0, item.config.expenseCount).find(
        (candidate) => matchesExpenseTemplateTitle(expense.title, candidate),
      );

      if (!template) {
        continue;
      }

      await Expense.updateOne(
        { _id: expense._id },
        {
          $set: {
            title: template.title,
            category: template.category,
            vendorOrRecipient: template.vendorOrRecipient,
            amount: Math.round(template.amount * amountMultiplier),
          },
        },
      ).exec();
    }

    for (
      let index = item.existingIncomeCount;
      index < item.config.incomeCount;
      index += 1
    ) {
      await createIncomeSeed({
        branch: item.config.branch,
        adminUserId: item.adminUserId,
        template: INCOME_TEMPLATES[index],
        amountMultiplier,
      });
    }

    for (const index of item.missingExpenseIndexes) {
      await createExpenseSeed({
        branch: item.config.branch,
        adminUserId: item.adminUserId,
        template: EXPENSE_TEMPLATES[index],
        amountMultiplier,
      });
    }
  }

  console.log("Seed pembayaran dan keuangan cabang berhasil disimpan.");
}

run()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
