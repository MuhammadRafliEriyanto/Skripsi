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

type PackageType = "1-semester" | "2-semester";

type PackageResolution = {
  packageType: PackageType;
  durationMonth: 6 | 12;
  source: string;
};

type DateWindow = {
  label: string;
  start: Date;
  end: Date;
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
};

const args = process.argv.slice(2);
const isApply = args.includes("--apply");

const DATE_WINDOWS: Record<PackageType, DateWindow> = {
  "1-semester": {
    label: "Januari-Maret 2026",
    start: new Date("2026-01-15T08:00:00+07:00"),
    end: new Date("2026-03-31T17:00:00+07:00"),
  },
  "2-semester": {
    label: "Agustus-November 2025",
    start: new Date("2025-08-01T08:00:00+07:00"),
    end: new Date("2025-11-30T17:00:00+07:00"),
  },
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

function hasSameDate(first: Date | null | undefined, second: Date | null | undefined) {
  return (first?.toISOString() ?? null) === (second?.toISOString() ?? null);
}

function spreadDateInWindow(window: DateWindow, index: number, total: number) {
  const ratio = total <= 1 ? 0.5 : index / (total - 1);
  const timestamp =
    window.start.getTime() + Math.round((window.end.getTime() - window.start.getTime()) * ratio);

  return new Date(timestamp);
}

async function main() {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI wajib tersedia di backend/.env");
  }

  console.log(`MODE: ${isApply ? "APPLY" : "DRY-RUN"}`);
  console.log("RULE: sebar startDate membership lama/demo sesuai paket.");
  console.log("- 1 Semester  -> Januari-Maret 2026");
  console.log("- 2 Semester  -> Agustus-November 2025\n");

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

    const preparedRows = subscriptions.map((subscription) => {
      const student = studentsById.get(subscription.studentId.toString()) ?? null;
      const user = student ? usersById.get(student.userId.toString()) ?? null : null;
      const subscriptionPayments =
        paymentsBySubscriptionId.get(subscription._id.toString()) ?? [];
      const referencePayment = pickReferencePayment(subscriptionPayments);
      const packageResolution = resolvePackageForSubscription(subscription, referencePayment);

      return {
        subscription,
        student,
        user,
        referencePayment,
        packageResolution,
      };
    });

    const processableRows = preparedRows.filter(
      (row): row is typeof row & {
        student: StudentDocument;
        user: NonNullable<(typeof row)["user"]>;
        packageResolution: PackageResolution;
      } =>
        Boolean(row.student) &&
        Boolean(row.user) &&
        Boolean(row.packageResolution) &&
        row.subscription.paymentStatus === "paid",
    );
    const processableByPackage = new Map<PackageType, typeof processableRows>();

    for (const row of processableRows) {
      const key = row.packageResolution.packageType;
      processableByPackage.set(key, [
        ...(processableByPackage.get(key) ?? []),
        row,
      ]);
    }

    const startDatesBySubscriptionId = new Map<string, Date>();

    for (const [packageType, rows] of processableByPackage) {
      const window = DATE_WINDOWS[packageType];
      const sortedRows = [...rows].sort((first, second) => {
        const firstCode = first.student.studentId || first.subscription.subscriptionCode;
        const secondCode = second.student.studentId || second.subscription.subscriptionCode;
        const codeCompare = firstCode.localeCompare(secondCode, "id-ID", {
          numeric: true,
        });

        if (codeCompare !== 0) {
          return codeCompare;
        }

        return first.subscription.subscriptionCode.localeCompare(
          second.subscription.subscriptionCode,
          "id-ID",
          { numeric: true },
        );
      });

      sortedRows.forEach((row, index) => {
        startDatesBySubscriptionId.set(
          row.subscription._id.toString(),
          spreadDateInWindow(window, index, sortedRows.length),
        );
      });
    }

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
        });
        continue;
      }

      if (row.subscription.paymentStatus !== "paid") {
        rows.push({
          status: "skipped",
          willChange: false,
          reason: "paymentStatus bukan paid, jadi membership belum diaktivasi.",
          studentCode,
          studentName,
          subscriptionCode: row.subscription.subscriptionCode,
          paymentStatus,
          packageType: row.packageResolution.packageType,
          startDate: null,
          endDate: null,
          nextStatus: null,
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
        });
        continue;
      }

      const endDate = buildSubscriptionEndDate(
        startDate,
        row.packageResolution.durationMonth,
      );
      const nextStatus = resolveSubscriptionStatusByDates(startDate, endDate);
      const willChange =
        !hasSameDate(row.subscription.startDate, startDate) ||
        !hasSameDate(row.subscription.endDate, endDate) ||
        row.subscription.status !== nextStatus;

      rows.push({
        status: "updated",
        willChange,
        reason: DATE_WINDOWS[row.packageResolution.packageType].label,
        studentCode,
        studentName,
        subscriptionCode: row.subscription.subscriptionCode,
        paymentStatus,
        packageType: row.packageResolution.packageType,
        startDate,
        endDate,
        nextStatus,
      });

      if (isApply && willChange) {
        row.subscription.startDate = startDate;
        row.subscription.endDate = endDate;
        row.subscription.status = nextStatus;
        await row.subscription.save();
      }
    }

    const updatedRows = rows.filter((row) => row.status === "updated");
    const changedRows = updatedRows.filter((row) => row.willChange);
    const unchangedRows = updatedRows.filter((row) => !row.willChange);
    const skippedRows = rows.filter((row) => row.status === "skipped");

    console.log("RINGKASAN SEBAR TANGGAL MEMBERSHIP:");
    console.log(`- ${isApply ? "Berhasil diperbarui" : "Akan diperbarui"}: ${changedRows.length}`);
    console.log(`- Sudah sesuai: ${unchangedRows.length}`);
    console.log(`- Di-skip: ${skippedRows.length}`);

    console.log("\nRINGKASAN STATUS HASIL:");
    console.table(
      Object.entries(
        updatedRows.reduce<Record<string, number>>((accumulator, item) => {
          const key = `${item.packageType} / ${item.nextStatus}`;
          accumulator[key] = (accumulator[key] ?? 0) + 1;
          return accumulator;
        }, {}),
      ).map(([status, count]) => ({ status, count })),
    );

    if (skippedRows.length > 0) {
      console.log("\nDAFTAR GAGAL / SKIP:");
      console.table(
        skippedRows.map((item) => ({
          studentCode: item.studentCode ?? "-",
          studentName: item.studentName ?? "-",
          subscriptionCode: item.subscriptionCode,
          paymentStatus: item.paymentStatus,
          reason: item.reason,
        })),
      );
    }

    console.log("\nCONTOH 10 DATA HASIL:");
    console.table(
      updatedRows.slice(0, 10).map((item) => ({
        studentCode: item.studentCode,
        subscriptionCode: item.subscriptionCode,
        startDate: item.startDate?.toISOString() ?? null,
        endDate: item.endDate?.toISOString() ?? null,
        packageType: item.packageType,
        status: item.nextStatus,
      })),
    );

    if (!isApply) {
      console.log("\nDRY-RUN: belum ada perubahan database.");
      console.log("Jalankan ulang dengan --apply untuk mengeksekusi sebar tanggal.");
    } else {
      console.log("\nAPPLY selesai: tanggal membership berhasil disebar.");
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
