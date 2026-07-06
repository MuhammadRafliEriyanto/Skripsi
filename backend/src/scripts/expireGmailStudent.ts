import "dotenv/config";
import mongoose from "mongoose";
import { validateEnv } from "../config/env";
import { User } from "../models/User";
import { Student } from "../models/Student";
import { Subscription } from "../models/Subscription";

async function main() {
  const env = validateEnv();
  await mongoose.connect(env.mongoUri);
  console.log("Connected to MongoDB.\n");

  const emailTargets = [
    "azamsetiawan717@gmail.com",
    "raflieriyanto810@gmail.com"
  ];

  for (const emailTarget of emailTargets) {
    console.log(`Memproses: ${emailTarget}...`);
    const user = await User.findOne({ email: { $regex: new RegExp("^" + emailTarget + "$", "i") } }).exec();
    if (!user) {
      console.log(`  -> Gagal: User ${emailTarget} tidak ditemukan.\n`);
      continue;
    }

    const student = await Student.findOne({ userId: user._id }).exec();
    if (!student) {
      console.log(`  -> Gagal: Student tidak ditemukan untuk ${emailTarget}.\n`);
      continue;
    }

    const sub = await Subscription.findOne({ studentId: student._id }).sort({ createdAt: -1 }).exec();
    if (!sub) {
      console.log(`  -> Gagal: Paket tidak ditemukan untuk ${emailTarget}.\n`);
      continue;
    }

    // Mundurkan endDate ke kemarin agar expired
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    sub.endDate = yesterday;
    sub.status = "expired";
    await sub.save();

    console.log(`  -> BERHASIL! Status paket langganan saat ini berhasil diubah menjadi: EXPIRED\n`);
  }

  console.log(`Proses selesai. Anda sekarang bisa login menggunakan akun-akun di atas untuk demo sidang.`);
  process.exit(0);
}

main().catch(console.error);
