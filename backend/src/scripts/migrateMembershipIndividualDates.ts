import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";

import { Payment, type PaymentDocument } from "../models/Payment";
import { Student, type StudentDocument } from "../models/Student";
import { Subscription, type SubscriptionDocument } from "../models/Subscription";
import { User } from "../models/User";
import {
  buildSubscriptionEndDate,
  getOnlinePackageByKey,
  resolveSubscriptionStatusByDates,
} from "../utils/subscription";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

type MigrationStatus = "updated" | "skipped";

type PackageResolution = {
  packageType: "1-semester" | "2-semester";
  durationMonth: 6 | 12;
  source: string;
};

type MigrationRow = {
  status: MigrationStatus;
  willChange: boolean;
  reason: string;
  studentCode: string | null;
  studentName: string | null;
  subscriptionCode: string;
  paymentId: string | null;
  packageType: string | null;
  packageSource: string | null;
  startDate: Date | null;
  endDate: Date | null;
  nextStatus: string | null;
};

const args = process.argv.slice(2);
const isApply = args.includes("--apply");

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function isSupportedDuration(value: number | null | undefined): value is 6 | 12 {
  return value === 6 || value === 12;
}

function packageTypeFromDuration(durationMonth: 6 | 12) {
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

function pickSuccessfulPayment(payments: PaymentDocument[]) {
  return (
    payments
      .filter((payment) => payment.status === "paid")
      .sort((first, second) => {
        const firstTime = first.paidAt?.getTime() ?? first.createdAt.getTime();
        const secondTime = second.paidAt?.getTime() ?? second.createdAt.getTime();
        return secondTime - firstTime;
      })[0] ?? null
  );
}

function pickReferencePayment(payments: PaymentDocument[]) {
  return (
    pickSuccessfulPayment(payments) ??
    [...payments].sort(
      (first, second) => second.createdAt.getTime() - first.createdAt.getTime(),
    )[0] ??
    null
  );
}

function resolveStartDate(params: {
  subscription: SubscriptionDocument;
  successfulPayment: PaymentDocument | null;
  student: StudentDocument;
}) {
  const candidates = [
    params.subscription.startDate,
    params.successfulPayment?.paidAt,
    params.student.createdAt,
  ].filter((date): date is Date => date instanceof Date && !Number.isNaN(date.getTime()));

  return candidates[0] ?? null;
}

function hasSameDate(first: Date | null | undefined, second: Date | null | undefined) {
  return (first?.toISOString() ?? null) === (second?.toISOString() ?? null);
}

async function main() {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI wajib tersedia di backend/.env");
  }

  console.log(`MODE: ${isApply ? "APPLY" : "DRY-RUN"}`);
  console.log("RULE: endDate = startDate + duration paket masing-masing.\n");

  await mongoose.connect(mongoUri);

  try {
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
    const studentsById = new Map(
      students.map((student) => [student._id.toString(), student]),
    );
    const usersById = new Map(users.map((user) => [user._id.toString(), user]));
    const paymentsBySubscriptionId = new Map<string, PaymentDocument[]>();

    for (const payment of payments) {
      const key = payment.subscriptionId.toString();
      paymentsBySubscriptionId.set(key, [
        ...(paymentsBySubscriptionId.get(key) ?? []),
        payment,
      ]);
    }

    const rows: MigrationRow[] = [];

    for (const subscription of subscriptions) {
      const student = studentsById.get(subscription.studentId.toString()) ?? null;
      const user = student ? usersById.get(student.userId.toString()) ?? null : null;
      const subscriptionPayments =
        paymentsBySubscriptionId.get(subscription._id.toString()) ?? [];
      const successfulPayment = pickSuccessfulPayment(subscriptionPayments);
      const referencePayment = pickReferencePayment(subscriptionPayments);
      const baseRow = {
        studentCode: student?.studentId ?? null,
        studentName: user?.nama ?? null,
        subscriptionCode: subscription.subscriptionCode,
        paymentId: referencePayment?.paymentId ?? null,
      };

      if (!student) {
        rows.push({
          ...baseRow,
          status: "skipped",
          willChange: false,
          reason: "Student tidak ditemukan untuk subscription ini.",
          packageType: null,
          packageSource: null,
          startDate: null,
          endDate: null,
          nextStatus: null,
        });
        continue;
      }

      if (!user) {
        rows.push({
          ...baseRow,
          status: "skipped",
          willChange: false,
          reason: "Relasi userId siswa tidak valid.",
          packageType: null,
          packageSource: null,
          startDate: null,
          endDate: null,
          nextStatus: null,
        });
        continue;
      }

      const packageResolution = resolvePackageForSubscription(
        subscription,
        referencePayment,
      );

      if (!packageResolution) {
        rows.push({
          ...baseRow,
          status: "skipped",
          willChange: false,
          reason: `Informasi paket tidak valid. subscription.packageKey=${normalizeText(
            subscription.packageKey,
          ) || "-"}, subscription.durationMonth=${subscription.durationMonth || "-"}, payment.packageKey=${
            normalizeText(referencePayment?.packageKey) || "-"
          }, payment.durationMonth=${referencePayment?.durationMonth ?? "-"}`,
          packageType: null,
          packageSource: null,
          startDate: null,
          endDate: null,
          nextStatus: null,
        });
        continue;
      }

      const startDate = resolveStartDate({
        subscription,
        successfulPayment,
        student,
      });

      if (!startDate) {
        rows.push({
          ...baseRow,
          status: "skipped",
          willChange: false,
          reason:
            "Tanggal startDate tidak bisa ditentukan dari subscription, paidAt, atau student.createdAt.",
          packageType: packageResolution.packageType,
          packageSource: packageResolution.source,
          startDate: null,
          endDate: null,
          nextStatus: null,
        });
        continue;
      }

      const endDate = buildSubscriptionEndDate(
        startDate,
        packageResolution.durationMonth,
      );
      const nextStatus = resolveSubscriptionStatusByDates(startDate, endDate);
      const willChange =
        !hasSameDate(subscription.startDate, startDate) ||
        !hasSameDate(subscription.endDate, endDate) ||
        subscription.status !== nextStatus;

      rows.push({
        ...baseRow,
        status: "updated",
        willChange,
        reason: "OK",
        packageType: packageResolution.packageType,
        packageSource: packageResolution.source,
        startDate,
        endDate,
        nextStatus,
      });

      if (isApply && willChange) {
        subscription.startDate = startDate;
        subscription.endDate = endDate;
        subscription.status = nextStatus;
        await subscription.save();
      }
    }

    const processableRows = rows.filter((row) => row.status === "updated");
    const changedRows = processableRows.filter((row) => row.willChange);
    const unchangedRows = processableRows.filter((row) => !row.willChange);
    const skippedRows = rows.filter((row) => row.status === "skipped");
    const examples = processableRows.slice(0, 10).map((row) => ({
      studentCode: row.studentCode,
      startDate: row.startDate?.toISOString() ?? null,
      endDate: row.endDate?.toISOString() ?? null,
      packageType: row.packageType,
      status: row.nextStatus,
    }));

    console.log("RINGKASAN MIGRASI:");
    console.log(`- ${isApply ? "Berhasil diperbarui" : "Akan diperbarui"}: ${changedRows.length}`);
    console.log(`- Sudah sesuai: ${unchangedRows.length}`);
    console.log(`- Di-skip: ${skippedRows.length}`);

    if (skippedRows.length > 0) {
      console.log("\nDAFTAR GAGAL / SKIP:");
      console.table(
        skippedRows.map((row) => ({
          studentCode: row.studentCode ?? "-",
          studentName: row.studentName ?? "-",
          subscriptionCode: row.subscriptionCode,
          paymentId: row.paymentId ?? "-",
          reason: row.reason,
        })),
      );
    }

    console.log("\nCONTOH 10 DATA HASIL MIGRASI:");
    console.table(examples);

    if (!isApply) {
      console.log("\nDRY-RUN: belum ada perubahan database.");
      console.log("Jalankan ulang dengan --apply untuk mengeksekusi migrasi.");
    } else {
      console.log("\nAPPLY selesai: subscription berhasil dimigrasi.");
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
