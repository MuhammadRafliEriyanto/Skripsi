import "dotenv/config";
import mongoose from "mongoose";
import { validateEnv } from "../config/env";
import { ClassMaterial } from "../models/ClassMaterial";
import { ClassTask } from "../models/ClassTask";
import { Schedule } from "../models/Schedule";
import { AttendanceSession } from "../models/AttendanceSession";

async function main() {
  const env = validateEnv();
  await mongoose.connect(env.mongoUri);
  console.log("Connected to MongoDB.\n");

  console.log("=== CLASS MATERIALS ===");
  const materials = await ClassMaterial.find().select("title className subject status").lean().exec();
  if (materials.length === 0) {
    console.log("Belum ada materi.");
  } else {
    materials.slice(0, 15).forEach(m => console.log(`[${m.className} - ${m.subject}] ${m.title} (${m.status})`));
    if (materials.length > 15) console.log(`...dan ${materials.length - 15} materi lainnya.`);
  }

  console.log("\n=== CLASS TASKS ===");
  const tasks = await ClassTask.find().select("title className subject").lean().exec();
  if (tasks.length === 0) {
    console.log("Belum ada tugas.");
  } else {
    tasks.slice(0, 15).forEach(t => console.log(`[${t.className} - ${t.subject}] ${t.title}`));
    if (tasks.length > 15) console.log(`...dan ${tasks.length - 15} tugas lainnya.`);
  }

  console.log("\n=== SCHEDULES ===");
  const schedules = await Schedule.find().select("className subject day time").lean().exec();
  if (schedules.length === 0) {
    console.log("Belum ada jadwal.");
  } else {
    schedules.slice(0, 15).forEach(s => console.log(`[${s.className} - ${s.subject}] ${s.day} ${s.time}`));
    if (schedules.length > 15) console.log(`...dan ${schedules.length - 15} jadwal lainnya.`);
  }

  console.log("\n=== ATTENDANCE SESSIONS ===");
  const sessions = await AttendanceSession.find().select("className subject date startTime status").lean().exec();
  if (sessions.length === 0) {
    console.log("Belum ada sesi absensi.");
  } else {
    sessions.slice(0, 15).forEach(s => console.log(`[${s.className} - ${s.subject}] ${s.date} ${s.startTime} (${s.status})`));
    if (sessions.length > 15) console.log(`...dan ${sessions.length - 15} sesi lainnya.`);
  }

  process.exit(0);
}

main().catch(console.error);
