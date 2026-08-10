import mongoose from "mongoose";
import dotenv from "dotenv";
import { Schedule } from "../models/Schedule";
import { Teacher } from "../models/Teacher";
import { User } from "../models/User";

dotenv.config();

const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const TIME_SLOTS = ["13:00 - 14:30", "14:00 - 15:30", "15:00 - 16:30", "16:00 - 17:30"];

async function run() {
  await mongoose.connect(process.env.MONGO_URI as string);

  // Register models by hitting them
  Teacher.find().limit(1);
  User.find().limit(1);

  const allSchedules = await Schedule.find({}).populate({ path: "teacherId", model: Teacher, populate: { path: "userId", model: User } }).exec();

  const sdSchedules = allSchedules.filter(s => /SD\s*[2-6]/i.test(s.className));
  const ekaSchedules = allSchedules.filter(s => s.teacherId && (s.teacherId as any).userId?.email === "guru005@bimbel.local");

  console.log("=== 1. JADWAL SD 2-6 SAAT INI ===");
  sdSchedules.forEach(s => {
    const tName = s.teacherId ? (s.teacherId as any).userId?.nama : "Unassigned";
    console.log(`[${s.scheduleId}] ${s.className} | ${s.subject} | ${s.branch} | ${s.day} ${s.time} | Room: ${s.room} | Guru: ${tName}`);
  });

  console.log("\n=== 2. AUDIT SLOT KOSONG EKA WIDIYANA ===");
  const ekaUsedSlots = new Set(ekaSchedules.map(s => `${s.day}|${s.time}`));
  console.log(`Eka menggunakan ${ekaUsedSlots.size} slot dari total 28 slot (7 hari x 4 jam).`);

  console.log("\n=== 3. AUDIT BENTROK & RENCANA PEMINDAHAN ===");
  // Jadwal yang akan dipindahkan
  const toMove = sdSchedules.filter(s => 
    s.subject.includes("Inggris") && 
    s.teacherId && (s.teacherId as any).userId?.email !== "guru005@bimbel.local"
  );
  
  toMove.forEach(s => {
    const isConflict = ekaUsedSlots.has(`${s.day}|${s.time}`);
    console.log(`Plan Pindah: ${s.scheduleId} (${s.className} ${s.branch}) -> Eka`);
    if (isConflict) {
      console.log(`  [BENTROK WAKTU!] Eka sudah mengajar di ${s.day} ${s.time}`);
    } else {
      console.log(`  [AMAN] Slot ${s.day} ${s.time} kosong untuk Eka.`);
    }
  });

  console.log("\n=== ANALISIS RUANGAN & WAKTU UNTUK JADWAL BARU ===");
  const usedRooms = new Set(allSchedules.map(s => `${s.branch}|${s.day}|${s.time}|${s.room}`));
  
  let availableSlots = [];
  for (const day of DAYS) {
    for (const time of TIME_SLOTS) {
      if (!ekaUsedSlots.has(`${day}|${time}`)) {
        availableSlots.push(`${day}|${time}`);
      }
    }
  }
  console.log(`Eka memiliki ${availableSlots.length} slot kosong.`);

  await mongoose.disconnect();
}

run().catch(console.error);
