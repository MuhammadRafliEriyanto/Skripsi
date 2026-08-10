import mongoose from "mongoose";
import dotenv from "dotenv";
import { Schedule } from "../models/Schedule";

dotenv.config();

const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const TIME_SLOTS = ["13:00 - 14:30", "14:00 - 15:30", "15:00 - 16:30", "16:00 - 17:30"];
const ROOMS = ["Ruangan 1A", "Ruangan 1B", "Ruangan 2A", "Ruangan 2B"];

async function run() {
  await mongoose.connect(process.env.MONGO_URI as string);

  const allSchedules = await Schedule.find({}).exec();
  const usedSlots = new Set(allSchedules.map(s => `${s.branch}|${s.day}|${s.time}|${s.room}`));

  console.log("=== SLOT KOSONG SLAWI ===");
  for (const day of DAYS) {
    for (const time of TIME_SLOTS) {
      if (!usedSlots.has(`Slawi|${day}|${time}|Ruangan 1A`)) {
        console.log(`Slawi | Ruangan 1A | ${day} ${time}`);
      }
    }
  }

  console.log("\n=== SLOT KOSONG ADIWERNA ===");
  for (const day of DAYS) {
    for (const time of TIME_SLOTS) {
      if (!usedSlots.has(`Adiwerna|${day}|${time}|Ruangan 1B`)) {
        console.log(`Adiwerna | Ruangan 1B | ${day} ${time}`);
      }
    }
  }

  await mongoose.disconnect();
}

run().catch(console.error);
