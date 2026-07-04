import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { Payment } from "../models/Payment";
import { Subscription } from "../models/Subscription";
import { resolveRenewalWindow } from "../utils/membershipPayments";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const MONGO_URI = process.env.MONGO_URI ?? "";

if (!MONGO_URI) {
  throw new Error("MONGO_URI is required. Set it in backend/.env before running this script.");
}

async function run() {
  const isDryRun = !process.argv.includes("--apply");
  
  if (isDryRun) {
    console.log("=== DRY RUN MODE ===");
    console.log("Gunakan flag --apply untuk menyimpan perubahan ke database.\n");
  } else {
    console.log("=== APPLY MODE ===");
    console.log("Perubahan AKAN disimpan ke database.\n");
  }

  try {
    console.log("Menghubungkan ke database...");
    await mongoose.connect(MONGO_URI);
    console.log("Terhubung ke database.");

    const paymentsToUpdate = await Payment.find({
      status: { $in: ["pending", "expired", "failed"] }
    }).exec();

    console.log(`\nDitemukan total ${paymentsToUpdate.length} payment awal sebelum difilter.`);

    let pendingCount = 0;
    let expiredCount = 0;
    let failedSkippedCount = 0;
    let warningSkippedCount = 0;
    const targetPayments = [];

    for (const payment of paymentsToUpdate) {
      if (payment.status === "failed") {
        failedSkippedCount++;
        continue;
      }

      let paidAtToUse = payment.paidAt;
      if (!paidAtToUse) {
        if (payment.createdAt) paidAtToUse = payment.createdAt;
        else if (payment.updatedAt) paidAtToUse = payment.updatedAt;
        else paidAtToUse = new Date("2026-01-01T00:00:00Z"); 
      }
      
      let packageKey = payment.packageKey || "-";
      let durationMonth = payment.durationMonth ?? 0;
      let subStatusTarget = "-";
      let subStartDateTarget = "-";
      let subEndDateTarget = "-";

      if (payment.subscriptionId) {
         const sub = await Subscription.findById(payment.subscriptionId).exec();
         if (sub) {
           packageKey = sub.packageKey || payment.packageKey || "-";
           durationMonth = sub.durationMonth ?? payment.durationMonth ?? 0;
           
           if (!durationMonth) {
             console.warn(`[WARNING] Skipping Payment ${payment.paymentId} karena durasi bulan tidak ditemukan.`);
             warningSkippedCount++;
             continue;
           }

           // Gunakan logic asli renewal
           const renewalWindow = await resolveRenewalWindow(
             sub.studentId,
             durationMonth,
             paidAtToUse,
             sub._id
           );

           subStatusTarget = renewalWindow.status;
           subStartDateTarget = renewalWindow.startDate.toISOString();
           subEndDateTarget = renewalWindow.endDate.toISOString();
         } else {
           console.warn(`[WARNING] Skipping Payment ${payment.paymentId} karena subscription tidak ditemukan.`);
           warningSkippedCount++;
           continue;
         }
      } else {
         console.warn(`[WARNING] Skipping Payment ${payment.paymentId} karena tidak memiliki subscriptionId.`);
         warningSkippedCount++;
         continue;
      }

      if (payment.status === "pending") pendingCount++;
      if (payment.status === "expired") expiredCount++;

      targetPayments.push({
        _id: payment._id,
        paymentId: payment.paymentId,
        oldStatus: payment.status,
        packageKey,
        durationMonth,
        subStatusTarget,
        subStartDateTarget,
        subEndDateTarget,
        newPaidAt: paidAtToUse,
        doc: payment
      });
    }

    console.log("\nRingkasan Target Payment:");
    console.log(`- Pending: ${pendingCount}`);
    console.log(`- Expired: ${expiredCount}`);
    console.log(`- Failed (Skipped): ${failedSkippedCount}`);
    console.log(`- Warning (Skipped): ${warningSkippedCount}`);
    console.log(`- Total akan diproses: ${targetPayments.length}`);

    console.log("\nDaftar Payment yang akan diupdate (format: paymentId | status lama | paymentStatus target | subscription status target | startDate target | endDate target | packageKey | duration):");
    for (const target of targetPayments) {
      console.log(`${target.paymentId} | ${target.oldStatus} | paid | ${target.subStatusTarget} | ${target.subStartDateTarget} | ${target.subEndDateTarget} | ${target.packageKey} | ${target.durationMonth}`);
    }

    if (!isDryRun) {
      console.log("\nMenyimpan perubahan ke database...");
      let updatedCount = 0;
      let subscriptionSyncCount = 0;
      
      for (const target of targetPayments) {
        target.doc.status = "paid";
        target.doc.paidAt = target.newPaidAt;
        await target.doc.save();
        updatedCount++;

        const subscription = await Subscription.findById(target.doc.subscriptionId).exec();
        if (subscription) {
          subscription.paymentStatus = "paid";
          subscription.status = target.subStatusTarget as any;
          subscription.startDate = new Date(target.subStartDateTarget);
          subscription.endDate = new Date(target.subEndDateTarget);
          await subscription.save();
          subscriptionSyncCount++;
        }
      }
      console.log(`\nBERHASIL: Mengupdate ${updatedCount} payment dan mensinkronkan ${subscriptionSyncCount} subscription.`);
    } else {
      console.log("\n[DRY RUN] Tidak ada data yang disimpan ke database.");
    }
    
  } catch (error) {
    console.error("Terjadi kesalahan:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Koneksi database ditutup.");
  }
}

run();
