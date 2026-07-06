import "dotenv/config";
import mongoose from "mongoose";
import { validateEnv } from "../config/env";
import { User } from "../models/User";
import { Student } from "../models/Student";
import { Subscription } from "../models/Subscription";

async function main() {
  const env = validateEnv();
  await mongoose.connect(env.mongoUri);
  console.log("Connected to MongoDB.");

  // Cari semua user dengan email berakhiran @gmail.com
  const users = await User.find({ email: { $regex: /@gmail\.com$/i }, role: "siswa" }).lean().exec();
  
  if (users.length === 0) {
    console.log("Tidak ada siswa dengan email @gmail.com yang ditemukan.");
    process.exit(0);
  }

  console.log(`Ditemukan ${users.length} siswa dengan email @gmail.com.\n`);

  for (const user of users) {
    const student = await Student.findOne({ userId: user._id }).lean().exec();
    if (!student) continue;

    const subs = await Subscription.find({ studentId: student._id }).sort({ createdAt: -1 }).lean().exec();
    
    console.log(`Email: ${user.email}`);
    console.log(`Nama: ${user.nama}`);
    console.log(`Kelas: ${student.className}`);
    
    if (subs.length === 0) {
      console.log(`  -> Tidak ada paket berlangganan.`);
    } else {
      subs.forEach(sub => {
        console.log(`  -> Paket: ${sub.packageName} | Status: ${sub.status} | Payment: ${sub.paymentStatus} | End: ${sub.endDate ? sub.endDate.toISOString().split('T')[0] : 'N/A'}`);
      });
    }
    console.log("---------------------------------------------------");
  }

  process.exit(0);
}

main().catch(console.error);
