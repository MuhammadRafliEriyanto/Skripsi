import mongoose from "mongoose";
import dotenv from "dotenv";
import { Schedule } from "../models/Schedule";
import { Teacher } from "../models/Teacher";
import { User } from "../models/User";
import { getNextPublicId } from "../utils/publicId";

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI as string);

  Teacher.find().limit(1);
  User.find().limit(1);

  const userEka = await User.findOne({ email: "guru005@bimbel.local" }).exec();
  const teacherEka = await Teacher.findOne({ userId: userEka?._id }).exec();

  if (!teacherEka) {
    console.log("Teacher Eka not found!");
    return;
  }

  const newSchedules = [
    { className: "SD 2", branch: "Slawi", day: "Senin", time: "16:00 - 17:30", room: "Ruangan 1A" },
    { className: "SD 3", branch: "Slawi", day: "Selasa", time: "16:00 - 17:30", room: "Ruangan 1A" },
    { className: "SD 2", branch: "Adiwerna", day: "Rabu", time: "13:00 - 14:30", room: "Ruangan 1B" },
    { className: "SD 3", branch: "Adiwerna", day: "Rabu", time: "14:00 - 15:30", room: "Ruangan 1B" }
  ];

  for (const s of newSchedules) {
    const existing = await Schedule.findOne({ day: s.day, time: s.time, room: s.room, branch: s.branch }).exec();
    if (!existing) {
      const scheduleId = await getNextPublicId(Schedule, "scheduleId", "SCH");
      await Schedule.create({
        scheduleId,
        day: s.day,
        time: s.time,
        className: s.className,
        branch: s.branch,
        subject: "Guru Kelas SD",
        teacherId: teacherEka._id,
        room: s.room,
        status: "Berjalan"
      });
      console.log(`Created: ${scheduleId} | ${s.className} | ${s.day} ${s.time} | ${s.branch} | ${s.room}`);
    } else {
      console.log(`Skipped: Slot already used -> ${s.day} ${s.time} ${s.room} ${s.branch}`);
    }
  }

  console.log("\n=== AUDIT JADWAL EKA WIDIYANA SAAT INI ===");
  const ekaSchedules = await Schedule.find({ teacherId: teacherEka._id }).populate({ path: "teacherId", model: Teacher, populate: { path: "userId", model: User } }).exec();
  
  ekaSchedules.forEach(s => {
    console.log(`- ${s.scheduleId} | ${s.className} | ${s.subject} | ${s.branch} | ${s.day} ${s.time} | ${s.room}`);
  });

  await mongoose.disconnect();
}

run().catch(console.error);
