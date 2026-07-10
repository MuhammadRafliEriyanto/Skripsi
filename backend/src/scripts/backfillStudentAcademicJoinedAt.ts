import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";

import { Student, type StudentDocument } from "../models/Student";
import { Subscription, type SubscriptionDocument } from "../models/Subscription";
import { User } from "../models/User";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

type BackfillRow = {
  status: "updated" | "skipped";
  willChange: boolean;
  reason: string;
  studentCode: string;
  studentName: string | null;
  studentStatus: string;
  subscriptionCode: string | null;
  academicJoinedAt: Date | null;
};

const args = process.argv.slice(2);
const isApply = args.includes("--apply");

function isValidDate(value: Date | null | undefined): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function hasAcademicJoinedAt(student: StudentDocument) {
  return isValidDate(student.academicJoinedAt);
}

function getMonthKey(value: Date | null) {
  if (!value) {
    return "-";
  }

  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
}

function buildCountTable<T>(rows: T[], getKey: (row: T) => string) {
  const counters = new Map<string, number>();

  for (const row of rows) {
    const key = getKey(row);
    counters.set(key, (counters.get(key) ?? 0) + 1);
  }

  return [...counters.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([key, count]) => ({ key, count }));
}

function pickEarliestPaidSubscription(subscriptions: SubscriptionDocument[]) {
  return (
    subscriptions
      .filter((subscription) => subscription.paymentStatus === "paid")
      .filter((subscription) => isValidDate(subscription.startDate))
      .sort((first, second) => {
        const firstStartDate = first.startDate?.getTime() ?? 0;
        const secondStartDate = second.startDate?.getTime() ?? 0;

        if (firstStartDate !== secondStartDate) {
          return firstStartDate - secondStartDate;
        }

        return first.createdAt.getTime() - second.createdAt.getTime();
      })[0] ?? null
  );
}

async function main() {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI wajib tersedia di backend/.env");
  }

  console.log(`MODE: ${isApply ? "APPLY" : "DRY-RUN"}`);
  console.log(
    "RULE: academicJoinedAt diisi dari subscription.startDate paid paling awal per siswa.\n",
  );

  await mongoose.connect(mongoUri);

  try {
    const [students, subscriptions, users] = await Promise.all([
      Student.find().sort({ studentId: 1, _id: 1 }).exec(),
      Subscription.find({ paymentStatus: "paid", startDate: { $ne: null } })
        .sort({ studentId: 1, startDate: 1, createdAt: 1, _id: 1 })
        .exec(),
      User.find().select("_id nama").exec(),
    ]);
    const subscriptionsByStudentId = new Map<string, SubscriptionDocument[]>();
    const usersById = new Map(users.map((user) => [user._id.toString(), user]));

    for (const subscription of subscriptions) {
      const key = subscription.studentId.toString();
      subscriptionsByStudentId.set(key, [
        ...(subscriptionsByStudentId.get(key) ?? []),
        subscription,
      ]);
    }

    const rows: BackfillRow[] = [];

    for (const student of students) {
      const studentName = usersById.get(student.userId.toString())?.nama ?? null;

      if (hasAcademicJoinedAt(student)) {
        rows.push({
          status: "skipped",
          willChange: false,
          reason: "academicJoinedAt sudah terisi.",
          studentCode: student.studentId,
          studentName,
          studentStatus: student.status,
          subscriptionCode: null,
          academicJoinedAt: student.academicJoinedAt,
        });
        continue;
      }

      const subscription = pickEarliestPaidSubscription(
        subscriptionsByStudentId.get(student._id.toString()) ?? [],
      );

      if (!subscription || !isValidDate(subscription.startDate)) {
        rows.push({
          status: "skipped",
          willChange: false,
          reason: "Tidak ada paid subscription dengan startDate valid.",
          studentCode: student.studentId,
          studentName,
          studentStatus: student.status,
          subscriptionCode: null,
          academicJoinedAt: null,
        });
        continue;
      }

      rows.push({
        status: "updated",
        willChange: true,
        reason: "OK",
        studentCode: student.studentId,
        studentName,
        studentStatus: student.status,
        subscriptionCode: subscription.subscriptionCode,
        academicJoinedAt: subscription.startDate,
      });

      if (isApply) {
        student.academicJoinedAt = subscription.startDate;
        await student.save();
      }
    }

    const changedRows = rows.filter((row) => row.status === "updated");
    const skippedRows = rows.filter((row) => row.status === "skipped");
    const alreadyFilledRows = skippedRows.filter(
      (row) => row.reason === "academicJoinedAt sudah terisi.",
    );
    const noPaidStartDateRows = skippedRows.filter(
      (row) => row.reason === "Tidak ada paid subscription dengan startDate valid.",
    );

    console.log("RINGKASAN BACKFILL:");
    console.log(`- Total siswa: ${students.length}`);
    console.log(`- Paid subscription valid: ${subscriptions.length}`);
    console.log(`- ${isApply ? "Berhasil diisi" : "Akan diisi"}: ${changedRows.length}`);
    console.log(`- Sudah terisi: ${alreadyFilledRows.length}`);
    console.log(`- Di-skip tanpa paid subscription startDate: ${noPaidStartDateRows.length}`);

    console.log("\nDISTRIBUSI ACADEMIC JOINED AT:");
    console.table(buildCountTable(changedRows, (row) => getMonthKey(row.academicJoinedAt)));

    if (noPaidStartDateRows.length > 0) {
      console.log("\nCONTOH SKIP TANPA PAID STARTDATE:");
      console.table(
        noPaidStartDateRows.slice(0, 20).map((row) => ({
          studentCode: row.studentCode,
          studentName: row.studentName ?? "-",
          studentStatus: row.studentStatus,
          reason: row.reason,
        })),
      );
    }

    console.log("\nCONTOH DATA YANG AKAN DIISI:");
    console.table(
      changedRows.slice(0, 20).map((row) => ({
        studentCode: row.studentCode,
        studentName: row.studentName ?? "-",
        studentStatus: row.studentStatus,
        subscriptionCode: row.subscriptionCode,
        academicJoinedAt: row.academicJoinedAt?.toISOString() ?? null,
      })),
    );

    if (!isApply) {
      console.log("\nDRY-RUN: belum ada perubahan database.");
      console.log("Jalankan dengan --apply setelah hasil dry-run disetujui.");
    } else {
      console.log("\nAPPLY selesai: academicJoinedAt berhasil dibackfill.");
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
