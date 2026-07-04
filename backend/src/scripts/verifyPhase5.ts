import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { Payment } from "../models/Payment";
import { Subscription } from "../models/Subscription";
import { Student } from "../models/Student";
import { User } from "../models/User";
import { resolveMembershipAccessStatus, findActiveSubscriptionByStudentId } from "../utils/subscription";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
const MONGO_URI = process.env.MONGO_URI ?? "";

if (!MONGO_URI) {
  throw new Error("MONGO_URI is required. Set it in backend/.env before running this script.");
}

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("=== PHASE 5 VERIFICATION ===\n");

    // 1. Dashboard Owner Checks
    console.log("--- 1. DASHBOARD OWNER ---");
    const allPayments = await Payment.find().exec();
    
    // Revenue Bulan Ini (assuming we check all paid payments)
    const paidPayments = allPayments.filter(p => p.status === "paid");
    const totalRevenue = paidPayments.reduce((acc, p) => acc + (p.amount || 0), 0);
    console.log(`Total Revenue (Semua Waktu): Rp ${totalRevenue.toLocaleString("id-ID")}`);

    const allSubscriptions = await Subscription.find().exec();
    
    // active memberships uses resolveMembershipAccessStatus
    const activeMemberships = allSubscriptions.filter(s => resolveMembershipAccessStatus(s as any) === "active");
    const inactiveMemberships = allSubscriptions.filter(s => resolveMembershipAccessStatus(s as any) !== "active");
    
    console.log(`Membership Aktif: ${activeMemberships.length}`);
    console.log(`Membership Inaktif/Expired/Pending: ${inactiveMemberships.length}`);

    // 2. Dashboard Admin Checks
    console.log("\n--- 2. DASHBOARD ADMIN ---");
    const failedPayments = await Payment.find({ status: "failed" }).exec();
    console.log(`Payment status 'failed' yang dipertahankan: ${failedPayments.length} (Harusnya tetap ada)`);
    
    const pendingPayments = await Payment.find({ status: "pending" }).exec();
    console.log(`Payment status 'pending' tersisa: ${pendingPayments.length}`);

    // 3. Dashboard Siswa Checks
    console.log("\n--- 3. DASHBOARD SISWA ---");
    // Pick 3 sample subscriptions we updated
    // First, let's pick 3 target subscriptions from the recent 44. Since they are all paid now.
    // Let's find one that has 'pending' subStatus and one that has 'active' subStatus.
    const activeSub = await Subscription.findOne({ status: "active", paymentStatus: "paid" }).exec();
    const pendingSub = await Subscription.findOne({ status: "pending", paymentStatus: "paid" }).exec();

    if (activeSub) {
      console.log(`[Sample Siswa Active] StudentId: ${activeSub.studentId}`);
      const activeQuery = await findActiveSubscriptionByStudentId(activeSub.studentId);
      console.log(`  -> findActiveSubscriptionByStudentId return value: ${activeQuery ? "Ditemukan" : "TIDAK ditemukan"}`);
      console.log(`  -> StartDate: ${activeQuery?.startDate?.toISOString()}`);
      console.log(`  -> EndDate: ${activeQuery?.endDate?.toISOString()}`);
    }

    if (pendingSub) {
      console.log(`[Sample Siswa Pending] StudentId: ${pendingSub.studentId}`);
      const pendingQuery = await findActiveSubscriptionByStudentId(pendingSub.studentId);
      console.log(`  -> findActiveSubscriptionByStudentId return value: ${pendingQuery ? "Ditemukan (Active Sub yang sedang berjalan)" : "TIDAK ditemukan"}`);
      console.log(`  -> StartDate target aktual di database (dari payment pending): ${pendingSub.startDate?.toISOString()}`);
      if (pendingQuery) {
        console.log(`  -> StartDate dari sub yang ditemukan: ${pendingQuery.startDate?.toISOString()}`);
        console.log(`  -> EndDate dari sub yang ditemukan: ${pendingQuery.endDate?.toISOString()}`);
      }
    }

  } catch (error) {
    console.error(error);
  } finally {
    await mongoose.disconnect();
  }
}

run();
