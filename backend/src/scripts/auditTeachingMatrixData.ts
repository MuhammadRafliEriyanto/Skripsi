import mongoose from "mongoose";

import "../config/env";
import { Schedule } from "../models/Schedule";
import { Teacher } from "../models/Teacher";
import { User } from "../models/User";

const TEACHING_MATRIX = [
  { name: "M. Nur Taufiq, S. Pd", subject: "Matematika", grades: ["9"] },
  { name: "Ikfi Rizqi Amaliyah, S.Pd", subject: "Bahasa Indonesia", grades: ["9"] },
  { name: "Deby Anggita Eka Pradani, S.Pd", subject: "Matematika", grades: ["5", "6", "7"] },
  { name: "Assyifa Ghina Fadhilah, S.Pd", subject: "Bahasa Inggris", grades: ["6", "9", "10", "12"] },
  { name: "Eka Widiyana, S. Pd", subject: "Bahasa Inggris", grades: ["1", "2", "3", "4", "5", "6"] },
  { name: "Ajeng Ayu Wardani S.Pd", subject: "Bahasa Inggris", grades: ["5", "7", "8"] },
  { name: "Roisqi Khoerika S.Pd", subject: "IPA", grades: ["8", "9", "10", "11", "12"] },
  { name: "Amelia Nisa S.Pd", subject: "Matematika", grades: ["10", "11", "12"] },
  { name: "Yang - yang Zaty Mulia", subject: "Bahasa Indonesia", grades: ["7", "8", "10"] },
  { name: "Rafika Saskia Febrianti, S.Pd.", subject: "Matematika", grades: ["1", "2", "3", "4", "5", "11"] },
  { name: "Shofia Nurul Farhana", subject: "IPA", grades: ["7", "8"] },
  { name: "Adilah Irfah, S.Pd", subject: "IPA", grades: ["10", "11", "12"] },
  { name: "Lutfi Alfiyanita Ningrum", subject: "Bahasa Indonesia", grades: ["8"] },
] as const;

function normalizeText(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function normalizeLookup(value: string | null | undefined): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s*,\s*/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getGrade(className: string) {
  return normalizeText(className).match(/\b(1[0-2]|[1-9])\b/)?.[1] ?? "";
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI as string);

  const teachers = await Teacher.find({})
    .populate<{ userId: { nama?: string | null; email?: string | null } | null }>({
      path: "userId",
      model: User,
      select: "nama email",
    })
    .sort({ teacherId: 1 })
    .exec();
  const matrixByName = new Map(TEACHING_MATRIX.map((item) => [normalizeLookup(item.name), item]));

  console.log("=== Guru di matrix ===");
  for (const teacher of teachers) {
    const name = normalizeText(teacher.userId?.nama);
    const matrix = matrixByName.get(normalizeLookup(name));

    if (!matrix) {
      continue;
    }

    console.log(
      `${teacher.teacherId} | ${name} | subject=${teacher.subject} -> ${matrix.subject} | grades=${(teacher.capableGrades ?? []).join(",") || "-"} -> ${matrix.grades.join(",")}`,
    );
  }

  console.log("\n=== Matrix yang belum ketemu di DB ===");
  for (const item of TEACHING_MATRIX) {
    const found = teachers.some((teacher) => normalizeLookup(teacher.userId?.nama) === normalizeLookup(item.name));

    if (!found) {
      console.log(`- ${item.name}`);
    }
  }

  const schedules = await Schedule.find({})
    .populate<{ teacherId: { teacherId?: string; userId?: { nama?: string | null } | null } | null }>({
      path: "teacherId",
      model: Teacher,
      populate: { path: "userId", model: User, select: "nama" },
    })
    .sort({ branch: 1, className: 1, subject: 1, day: 1, time: 1 })
    .exec();

  console.log("\n=== Jadwal tidak cocok matrix ===");
  for (const schedule of schedules) {
    const teacherName = normalizeText(schedule.teacherId?.userId?.nama);
    const matrix = matrixByName.get(normalizeLookup(teacherName));
    const grade = getGrade(schedule.className);
    const subject = normalizeText(schedule.subject);
    const isMatrixTeacher = Boolean(matrix);
    const subjectOk = matrix ? matrix.subject === subject || (matrix.subject === "IPA" && subject === "IPA") : true;
    const gradeOk = matrix ? (matrix.grades as readonly string[]).includes(grade) : true;

    if (isMatrixTeacher && subjectOk && gradeOk) {
      continue;
    }

    console.log(
      `[${schedule.scheduleId}] ${schedule.branch} | ${schedule.className} | ${subject} | ${schedule.day} ${schedule.time} | ${teacherName || "-"} | grade=${grade || "-"} | reason=${!isMatrixTeacher ? "guru tidak ada di matrix" : !subjectOk ? "mapel tidak cocok" : "kelas tidak cocok"}`,
    );
  }

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
