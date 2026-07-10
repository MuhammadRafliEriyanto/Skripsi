import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";

import { Payment, type PaymentDocument } from "../models/Payment";
import { Student, type StudentDocument } from "../models/Student";
import { Subscription, type SubscriptionDocument } from "../models/Subscription";
import { User, type UserDocument } from "../models/User";
import {
  buildSubscriptionEndDate,
  getOnlinePackageByKey,
  resolveSubscriptionStatusByDates,
} from "../utils/subscription";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

type PackageType = "1-semester" | "2-semester";

type PackageResolution = {
  packageType: PackageType;
  durationMonth: 6 | 12;
  source: string;
};

type MonthWindow = {
  key: string;
  label: string;
  start: Date;
  end: Date;
  weight: number;
};

type PreparedSubscription = {
  subscription: SubscriptionDocument;
  student: StudentDocument | null;
  user: UserDocument | null;
  payments: PaymentDocument[];
  paidPayments: PaymentDocument[];
  referencePayment: PaymentDocument | null;
  packageResolution: PackageResolution | null;
};

type PaymentPlan = {
  payment: PaymentDocument;
  beforeCreatedAt: Date;
  beforePaidAt: Date | null;
  beforeUpdatedAt: Date;
  afterCreatedAt: Date;
  afterPaidAt: Date;
  afterUpdatedAt: Date;
  willChange: boolean;
};

type MigrationRow = {
  status: "updated" | "skipped";
  willChange: boolean;
  reason: string;
  studentCode: string | null;
  studentName: string | null;
  subscriptionCode: string;
  paymentStatus: string;
  packageType: PackageType | null;
  startDate: Date | null;
  endDate: Date | null;
  nextStatus: string | null;
  paymentPlans: PaymentPlan[];
};

type ValidationResult = {
  rule: string;
  violationCount: number;
};

const args = process.argv.slice(2);
const isApply = args.includes("--apply");
const now = new Date();
const DAY_IN_MILLISECONDS = 1000 * 60 * 60 * 24;
const HOUR_IN_MILLISECONDS = 1000 * 60 * 60;
const MINUTE_IN_MILLISECONDS = 1000 * 60;

const MONTH_WINDOWS: Record<PackageType, MonthWindow[]> = {
  "2-semester": [
    {
      key: "2025-08",
      label: "Agustus 2025",
      start: new Date("2025-08-01T08:00:00+07:00"),
      end: new Date("2025-08-31T17:00:00+07:00"),
      weight: 0.58,
    },
    {
      key: "2025-09",
      label: "September 2025",
      start: new Date("2025-09-01T08:00:00+07:00"),
      end: new Date("2025-09-30T17:00:00+07:00"),
      weight: 0.27,
    },
    {
      key: "2025-10",
      label: "Oktober 2025",
      start: new Date("2025-10-01T08:00:00+07:00"),
      end: new Date("2025-10-31T17:00:00+07:00"),
      weight: 0.11,
    },
    {
      key: "2025-11",
      label: "November 2025",
      start: new Date("2025-11-01T08:00:00+07:00"),
      end: new Date("2025-11-30T17:00:00+07:00"),
      weight: 0.04,
    },
  ],
  "1-semester": [
    {
      key: "2026-01",
      label: "Januari 2026",
      start: new Date("2026-01-01T08:00:00+07:00"),
      end: new Date("2026-01-31T17:00:00+07:00"),
      weight: 0.68,
    },
    {
      key: "2026-02",
      label: "Februari 2026",
      start: new Date("2026-02-01T08:00:00+07:00"),
      end: new Date("2026-02-28T17:00:00+07:00"),
      weight: 0.24,
    },
    {
      key: "2026-03",
      label: "Maret 2026",
      start: new Date("2026-03-01T08:00:00+07:00"),
      end: new Date("2026-03-31T17:00:00+07:00"),
      weight: 0.08,
    },
  ],
};

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function isSupportedDuration(value: number | null | undefined): value is 6 | 12 {
  return value === 6 || value === 12;
}

function packageTypeFromDuration(durationMonth: 6 | 12): PackageType {
  return durationMonth === 6 ? "1-semester" : "2-semester";
}

function resolvePackageFromKnownKey(
  value: string | null | undefined,
  source: string,
): PackageResolution | null {
  const packageDefinition = getOnlinePackageByKey(value);

  if (!packageDefinition || !isSupportedDuration(packageDefinition.durationMonth)) {
    return null;
  }

  return {
    packageType: packageTypeFromDuration(packageDefinition.durationMonth),
    durationMonth: packageDefinition.durationMonth,
    source,
  };
}

function resolvePackageFromDuration(
  value: number | null | undefined,
  source: string,
): PackageResolution | null {
  if (!isSupportedDuration(value)) {
    return null;
  }

  return {
    packageType: packageTypeFromDuration(value),
    durationMonth: value,
    source,
  };
}

function resolvePackageForSubscription(
  subscription: SubscriptionDocument,
  payment: PaymentDocument | null,
): PackageResolution | null {
  return (
    resolvePackageFromKnownKey(subscription.packageKey, "subscription.packageKey") ??
    resolvePackageFromDuration(subscription.durationMonth, "subscription.durationMonth") ??
    resolvePackageFromKnownKey(payment?.packageKey, "payment.packageKey") ??
    resolvePackageFromDuration(payment?.durationMonth, "payment.durationMonth") ??
    null
  );
}

function pickReferencePayment(payments: PaymentDocument[]) {
  const paidPayment =
    payments
      .filter((payment) => payment.status === "paid")
      .sort((first, second) => {
        const firstTime = first.paidAt?.getTime() ?? first.createdAt.getTime();
        const secondTime = second.paidAt?.getTime() ?? second.createdAt.getTime();
        return secondTime - firstTime;
      })[0] ?? null;

  return (
    paidPayment ??
    [...payments].sort(
      (first, second) => second.createdAt.getTime() - first.createdAt.getTime(),
    )[0] ??
    null
  );
}

function stableHash(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function hasSameDate(first: Date | null | undefined, second: Date | null | undefined) {
  return (first?.toISOString() ?? null) === (second?.toISOString() ?? null);
}

function allocateWeightedCounts(total: number, windows: MonthWindow[]) {
  const rawCounts = windows.map((window) => ({
    window,
    floorCount: Math.floor(total * window.weight),
    remainder: total * window.weight - Math.floor(total * window.weight),
  }));
  let remaining = total - rawCounts.reduce((sum, item) => sum + item.floorCount, 0);

  for (const item of [...rawCounts].sort((first, second) => second.remainder - first.remainder)) {
    if (remaining <= 0) {
      break;
    }

    item.floorCount += 1;
    remaining -= 1;
  }

  return rawCounts.map((item) => ({
    window: item.window,
    count: item.floorCount,
  }));
}

function spreadDateInMonth(window: MonthWindow, index: number, total: number, seed: string) {
  const hash = stableHash(seed);
  const baseRatio = total <= 1 ? 0.5 : (index + 0.5) / total;
  const jitter = ((hash % 10_000) / 10_000 - 0.5) * (total <= 1 ? 0.2 : 0.8 / total);
  const ratio = Math.min(0.98, Math.max(0.02, baseRatio + jitter));
  const timestamp =
    window.start.getTime() + Math.round((window.end.getTime() - window.start.getTime()) * ratio);
  const date = new Date(timestamp);
  const hour = 8 + (Math.floor(hash / 13) % 9);
  const minute = Math.floor(hash / 29) % 60;

  date.setUTCHours(hour - 7, minute, 0, 0);

  return date;
}

function buildPaymentPlan(payment: PaymentDocument, paidAt: Date): PaymentPlan {
  const hash = stableHash(`${payment.paymentId}:${payment._id.toString()}`);
  const createdOffsetHours = 24 + (hash % 48);
  const createdOffsetMinutes = Math.floor(hash / 7) % 60;
  const updatedOffsetMinutes = Math.floor(hash / 11) % (24 * 60);
  const afterCreatedAt = new Date(
    paidAt.getTime() -
      createdOffsetHours * HOUR_IN_MILLISECONDS -
      createdOffsetMinutes * MINUTE_IN_MILLISECONDS,
  );
  const afterPaidAt = new Date(paidAt);
  const afterUpdatedAt = new Date(paidAt.getTime() + updatedOffsetMinutes * MINUTE_IN_MILLISECONDS);

  return {
    payment,
    beforeCreatedAt: payment.createdAt,
    beforePaidAt: payment.paidAt,
    beforeUpdatedAt: payment.updatedAt,
    afterCreatedAt,
    afterPaidAt,
    afterUpdatedAt,
    willChange:
      !hasSameDate(payment.createdAt, afterCreatedAt) ||
      !hasSameDate(payment.paidAt, afterPaidAt) ||
      !hasSameDate(payment.updatedAt, afterUpdatedAt),
  };
}

function formatDate(value: Date | null | undefined) {
  return value?.toISOString() ?? "-";
}

function getMonthKey(date: Date | null | undefined) {
  if (!date) {
    return "-";
  }

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function buildCountTable<T>(
  rows: T[],
  getKey: (row: T) => string,
  getExtra?: (row: T) => Record<string, string | number>,
) {
  const counters = new Map<string, { count: number; extra: Record<string, string | number> }>();

  for (const row of rows) {
    const key = getKey(row);
    const current = counters.get(key) ?? { count: 0, extra: getExtra?.(row) ?? {} };
    current.count += 1;
    counters.set(key, current);
  }

  return [...counters.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([key, value]) => ({
      key,
      ...value.extra,
      count: value.count,
    }));
}

function isInRange(date: Date | null | undefined, start: Date, end: Date) {
  return Boolean(date && date.getTime() >= start.getTime() && date.getTime() <= end.getTime());
}

function validateRows(rows: MigrationRow[]): ValidationResult[] {
  const updatedRows = rows.filter((row) => row.status === "updated");
  const twoSemesterStart = new Date("2025-08-01T00:00:00+07:00");
  const twoSemesterEnd = new Date("2025-11-30T23:59:59+07:00");
  const oneSemesterStart = new Date("2026-01-01T00:00:00+07:00");
  const oneSemesterEnd = new Date("2026-03-31T23:59:59+07:00");

  return [
    {
      rule: "2 Semester hanya Agustus-November 2025",
      violationCount: updatedRows.filter(
        (row) =>
          row.packageType === "2-semester" &&
          !isInRange(row.startDate, twoSemesterStart, twoSemesterEnd),
      ).length,
    },
    {
      rule: "1 Semester hanya Januari-Maret 2026",
      violationCount: updatedRows.filter(
        (row) =>
          row.packageType === "1-semester" &&
          !isInRange(row.startDate, oneSemesterStart, oneSemesterEnd),
      ).length,
    },
    {
      rule: "payment.createdAt <= payment.paidAt",
      violationCount: updatedRows.flatMap((row) => row.paymentPlans).filter(
        (plan) => plan.afterCreatedAt.getTime() > plan.afterPaidAt.getTime(),
      ).length,
    },
    {
      rule: "payment.paidAt == subscription.startDate",
      violationCount: updatedRows.filter((row) =>
        row.paymentPlans.some((plan) => !hasSameDate(plan.afterPaidAt, row.startDate)),
      ).length,
    },
    {
      rule: "subscription.endDate sesuai durasi paket",
      violationCount: updatedRows.filter((row) => {
        if (!row.startDate || !row.endDate || !row.packageType) {
          return true;
        }

        const durationMonth = row.packageType === "1-semester" ? 6 : 12;
        return !hasSameDate(row.endDate, buildSubscriptionEndDate(row.startDate, durationMonth));
      }).length,
    },
    {
      rule: "tidak ada tanggal payment setelah subscription.endDate",
      violationCount: updatedRows.filter((row) =>
        row.paymentPlans.some(
          (plan) =>
            Boolean(row.endDate) &&
            (plan.afterCreatedAt.getTime() > row.endDate!.getTime() ||
              plan.afterPaidAt.getTime() > row.endDate!.getTime() ||
              plan.afterUpdatedAt.getTime() > row.endDate!.getTime()),
        ),
      ).length,
    },
    {
      rule: "tidak ada tanggal payment lebih baru dari hari ini",
      violationCount: updatedRows.flatMap((row) => row.paymentPlans).filter(
        (plan) =>
          plan.afterCreatedAt.getTime() > now.getTime() ||
          plan.afterPaidAt.getTime() > now.getTime() ||
          plan.afterUpdatedAt.getTime() > now.getTime(),
      ).length,
    },
    {
      rule: "payment.updatedAt maksimal 1 hari setelah paidAt",
      violationCount: updatedRows.flatMap((row) => row.paymentPlans).filter(
        (plan) =>
          plan.afterUpdatedAt.getTime() >
          plan.afterPaidAt.getTime() + DAY_IN_MILLISECONDS,
      ).length,
    },
  ];
}

async function loadPreparedSubscriptions() {
  const subscriptions = await Subscription.find()
    .sort({ studentId: 1, createdAt: 1, _id: 1 })
    .exec();
  const payments = await Payment.find({ archivedAt: null }).exec();
  const studentIds = Array.from(
    new Set(subscriptions.map((subscription) => subscription.studentId.toString())),
  );
  const students = await Student.find({ _id: { $in: studentIds } }).exec();
  const userIds = Array.from(new Set(students.map((student) => student.userId.toString())));
  const users = await User.find({ _id: { $in: userIds } }).exec();
  const studentsById = new Map(students.map((student) => [student._id.toString(), student]));
  const usersById = new Map(users.map((user) => [user._id.toString(), user]));
  const paymentsBySubscriptionId = new Map<string, PaymentDocument[]>();

  for (const payment of payments) {
    const key = payment.subscriptionId.toString();
    paymentsBySubscriptionId.set(key, [
      ...(paymentsBySubscriptionId.get(key) ?? []),
      payment,
    ]);
  }

  return subscriptions.map<PreparedSubscription>((subscription) => {
    const student = studentsById.get(subscription.studentId.toString()) ?? null;
    const user = student ? usersById.get(student.userId.toString()) ?? null : null;
    const subscriptionPayments = paymentsBySubscriptionId.get(subscription._id.toString()) ?? [];
    const referencePayment = pickReferencePayment(subscriptionPayments);
    const packageResolution = resolvePackageForSubscription(subscription, referencePayment);

    return {
      subscription,
      student,
      user,
      payments: subscriptionPayments,
      paidPayments: subscriptionPayments.filter((payment) => payment.status === "paid"),
      referencePayment,
      packageResolution,
    };
  });
}

function buildPlannedStartDates(rows: PreparedSubscription[]) {
  const processableRows = rows.filter(
    (row): row is PreparedSubscription & {
      student: StudentDocument;
      user: UserDocument;
      packageResolution: PackageResolution;
    } =>
      Boolean(row.student) &&
      Boolean(row.user) &&
      Boolean(row.packageResolution) &&
      row.paidPayments.length > 0,
  );
  const startDatesBySubscriptionId = new Map<string, Date>();

  for (const packageType of ["2-semester", "1-semester"] as const) {
    const packageRows = processableRows.filter(
      (row) => row.packageResolution.packageType === packageType,
    );
    const shuffledRows = [...packageRows].sort(
      (first, second) =>
        stableHash(
          `${first.student.studentId}:${first.subscription.subscriptionCode}`,
        ) -
        stableHash(
          `${second.student.studentId}:${second.subscription.subscriptionCode}`,
        ),
    );
    const allocations = allocateWeightedCounts(
      shuffledRows.length,
      MONTH_WINDOWS[packageType],
    );
    let cursor = 0;

    for (const allocation of allocations) {
      const monthRows = shuffledRows.slice(cursor, cursor + allocation.count);
      cursor += allocation.count;

      monthRows
        .sort((first, second) =>
          first.student.studentId.localeCompare(second.student.studentId, "id-ID", {
            numeric: true,
          }),
        )
        .forEach((row, index) => {
          const seed = `${row.student.studentId}:${row.subscription.subscriptionCode}:${allocation.window.key}`;
          startDatesBySubscriptionId.set(
            row.subscription._id.toString(),
            spreadDateInMonth(allocation.window, index, monthRows.length, seed),
          );
        });
    }
  }

  return startDatesBySubscriptionId;
}

async function main() {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI wajib tersedia di backend/.env");
  }

  console.log(`MODE: ${isApply ? "APPLY" : "DRY-RUN"}`);
  console.log("RULE: weighted spread membership dummy + normalisasi tanggal payment paid.");
  console.log("- 2 Semester  -> 1 Agustus 2025 s/d 30 November 2025");
  console.log("- 1 Semester  -> 1 Januari 2026 s/d 31 Maret 2026\n");

  await mongoose.connect(mongoUri);

  try {
    const preparedRows = await loadPreparedSubscriptions();
    const startDatesBySubscriptionId = buildPlannedStartDates(preparedRows);
    const rows: MigrationRow[] = [];

    for (const row of preparedRows) {
      const studentCode = row.student?.studentId ?? null;
      const studentName = row.user?.nama ?? null;
      const paymentStatus = row.subscription.paymentStatus;

      if (!row.student) {
        rows.push({
          status: "skipped",
          willChange: false,
          reason: "Student tidak ditemukan untuk subscription ini.",
          studentCode,
          studentName,
          subscriptionCode: row.subscription.subscriptionCode,
          paymentStatus,
          packageType: null,
          startDate: null,
          endDate: null,
          nextStatus: null,
          paymentPlans: [],
        });
        continue;
      }

      if (!row.user) {
        rows.push({
          status: "skipped",
          willChange: false,
          reason: "Relasi userId siswa tidak valid.",
          studentCode,
          studentName,
          subscriptionCode: row.subscription.subscriptionCode,
          paymentStatus,
          packageType: null,
          startDate: null,
          endDate: null,
          nextStatus: null,
          paymentPlans: [],
        });
        continue;
      }

      if (!row.packageResolution) {
        rows.push({
          status: "skipped",
          willChange: false,
          reason: `Informasi paket tidak valid. subscription.packageKey=${normalizeText(
            row.subscription.packageKey,
          ) || "-"}, subscription.durationMonth=${row.subscription.durationMonth || "-"}, payment.packageKey=${
            normalizeText(row.referencePayment?.packageKey) || "-"
          }, payment.durationMonth=${row.referencePayment?.durationMonth ?? "-"}`,
          studentCode,
          studentName,
          subscriptionCode: row.subscription.subscriptionCode,
          paymentStatus,
          packageType: null,
          startDate: null,
          endDate: null,
          nextStatus: null,
          paymentPlans: [],
        });
        continue;
      }

      if (row.paidPayments.length === 0) {
        rows.push({
          status: "skipped",
          willChange: false,
          reason: "Tidak ada payment paid; pending/failed/expired tidak diproses.",
          studentCode,
          studentName,
          subscriptionCode: row.subscription.subscriptionCode,
          paymentStatus,
          packageType: row.packageResolution.packageType,
          startDate: null,
          endDate: null,
          nextStatus: null,
          paymentPlans: [],
        });
        continue;
      }

      const startDate = startDatesBySubscriptionId.get(row.subscription._id.toString()) ?? null;

      if (!startDate) {
        rows.push({
          status: "skipped",
          willChange: false,
          reason: "Tanggal sebaran tidak bisa dibuat.",
          studentCode,
          studentName,
          subscriptionCode: row.subscription.subscriptionCode,
          paymentStatus,
          packageType: row.packageResolution.packageType,
          startDate: null,
          endDate: null,
          nextStatus: null,
          paymentPlans: [],
        });
        continue;
      }

      const endDate = buildSubscriptionEndDate(
        startDate,
        row.packageResolution.durationMonth,
      );
      const nextStatus = resolveSubscriptionStatusByDates(startDate, endDate);
      const paymentPlans = row.paidPayments.map((payment) => buildPaymentPlan(payment, startDate));
      const subscriptionWillChange =
        !hasSameDate(row.subscription.startDate, startDate) ||
        !hasSameDate(row.subscription.endDate, endDate) ||
        row.subscription.status !== nextStatus;
      const paymentWillChange = paymentPlans.some((plan) => plan.willChange);

      rows.push({
        status: "updated",
        willChange: subscriptionWillChange || paymentWillChange,
        reason: "OK",
        studentCode,
        studentName,
        subscriptionCode: row.subscription.subscriptionCode,
        paymentStatus,
        packageType: row.packageResolution.packageType,
        startDate,
        endDate,
        nextStatus,
        paymentPlans,
      });

      if (isApply && (subscriptionWillChange || paymentWillChange)) {
        if (subscriptionWillChange) {
          row.subscription.startDate = startDate;
          row.subscription.endDate = endDate;
          row.subscription.status = nextStatus;
          await row.subscription.save();
        }

        for (const plan of paymentPlans.filter((plan) => plan.willChange)) {
          await Payment.collection.updateOne(
            { _id: plan.payment._id },
            {
              $set: {
                createdAt: plan.afterCreatedAt,
                paidAt: plan.afterPaidAt,
                updatedAt: plan.afterUpdatedAt,
              },
            },
          );
        }
      }
    }

    const updatedRows = rows.filter((row) => row.status === "updated");
    const changedRows = updatedRows.filter((row) => row.willChange);
    const unchangedRows = updatedRows.filter((row) => !row.willChange);
    const skippedRows = rows.filter((row) => row.status === "skipped");
    const changedPaymentCount = changedRows.flatMap((row) =>
      row.paymentPlans.filter((plan) => plan.willChange),
    ).length;
    const validationResults = validateRows(rows);
    const totalViolations = validationResults.reduce(
      (sum, item) => sum + item.violationCount,
      0,
    );

    console.log("RINGKASAN DRY-RUN NORMALISASI DUMMY:");
    console.log(`- Subscription akan diperbarui: ${changedRows.length}`);
    console.log(`- Paid payment akan diperbarui: ${changedPaymentCount}`);
    console.log(`- Subscription sudah sesuai: ${unchangedRows.length}`);
    console.log(`- Di-skip: ${skippedRows.length}`);

    console.log("\nDISTRIBUSI PAKET PER BULAN:");
    console.table(
      buildCountTable(
        updatedRows,
        (row) => `${row.packageType} / ${getMonthKey(row.startDate)}`,
        (row) => ({
          packageType: row.packageType ?? "-",
          month: getMonthKey(row.startDate),
        }),
      ),
    );

    console.log("\nDISTRIBUSI STARTDATE PER BULAN:");
    console.table(
      buildCountTable(updatedRows, (row) => getMonthKey(row.startDate)).map((item) => ({
        month: item.key,
        count: item.count,
      })),
    );

    console.log("\nVALIDASI BUSINESS RULE:");
    console.table(validationResults);
    console.log(
      totalViolations === 0
        ? "Konfirmasi: tidak ada kombinasi yang melanggar business rule."
        : `PERLU CEK: masih ada ${totalViolations} pelanggaran business rule.`,
    );

    if (skippedRows.length > 0) {
      console.log("\nRINGKASAN SKIP:");
      console.table(
        buildCountTable(skippedRows, (row) => row.reason).map((item) => ({
          reason: item.key,
          count: item.count,
        })),
      );
    }

    console.log("\nCONTOH 20 DATA HASIL:");
    console.table(
      updatedRows
        .slice()
        .sort((first, second) => {
          const firstTime = first.startDate?.getTime() ?? 0;
          const secondTime = second.startDate?.getTime() ?? 0;
          return firstTime - secondTime;
        })
        .slice(0, 20)
        .map((item) => {
          const firstPaymentPlan = item.paymentPlans[0] ?? null;

          return {
            studentCode: item.studentCode,
            subscriptionCode: item.subscriptionCode,
            packageType: item.packageType,
            startDate: formatDate(item.startDate),
            endDate: formatDate(item.endDate),
            subscriptionStatus: item.nextStatus,
            paymentCreatedAt: formatDate(firstPaymentPlan?.afterCreatedAt),
            paymentPaidAt: formatDate(firstPaymentPlan?.afterPaidAt),
            paymentUpdatedAt: formatDate(firstPaymentPlan?.afterUpdatedAt),
          };
        }),
    );

    if (!isApply) {
      console.log("\nDRY-RUN: belum ada perubahan database.");
      console.log("Jalankan ulang dengan --apply hanya setelah hasil dry-run disetujui.");
    } else {
      console.log("\nAPPLY selesai: timeline membership dan payment paid berhasil dinormalisasi.");
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
