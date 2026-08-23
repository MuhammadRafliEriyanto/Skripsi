import bcrypt from "bcryptjs";
import mongoose from "mongoose";

import "../config/env";
import { Teacher } from "../models/Teacher";
import { User } from "../models/User";
import { getNextPublicId } from "../utils/publicId";
import { buildImportedTeacherEmail } from "../utils/teacherImport";
import { buildGeneratedPasswordFromTeacherId } from "../utils/teacherPassword";

type PopulatedTeacher = {
  teacherId: string;
  userId: {
    nama?: string | null;
  } | null;
  subject: string;
  branch: string;
  phone: string;
  schedule: string;
  activeClasses: number;
  classList: string;
  capableGrades?: string[];
  status: string;
  availability: string;
};

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function buildTeacherKey(input: {
  name: string;
  subject: string;
  branch: string;
  capableGrades: string[];
}) {
  return [
    normalizeText(input.name).toLowerCase(),
    normalizeText(input.subject).toLowerCase(),
    normalizeText(input.branch).toLowerCase(),
    [...input.capableGrades].map(normalizeText).sort().join(",").toLowerCase(),
  ].join("|");
}

async function getNextAvailableTeacherIdentity() {
  let nextNumber = Number(
    (await getNextPublicId(Teacher, "teacherId", "TCH")).replace(/\D/g, ""),
  );

  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const teacherId = `TCH-${String(nextNumber).padStart(3, "0")}`;
    const email = buildImportedTeacherEmail(teacherId);
    const existingTeacher = await Teacher.exists({ teacherId }).exec();

    if (existingTeacher) {
      nextNumber += 1;
      continue;
    }

    const existingUser = await User.findOne({ email }).exec();

    if (!existingUser) {
      return {
        teacherId,
        email,
      };
    }

    nextNumber += 1;
  }

  throw new Error("Gagal mencari Teacher ID yang tersedia.");
}

async function loadTeachers(branch: string) {
  return (await Teacher.find({
    branch,
    status: "Aktif",
  })
    .populate<{ userId: PopulatedTeacher["userId"] }>({
      path: "userId",
      model: User,
      select: "nama",
    })
    .sort({ teacherId: 1 })
    .lean()
    .exec()) as PopulatedTeacher[];
}

async function run() {
  const apply = process.argv.includes("--apply");

  await mongoose.connect(process.env.MONGO_URI as string);

  const [sourceTeachers, targetTeachers] = await Promise.all([
    loadTeachers("Slawi"),
    loadTeachers("Adiwerna"),
  ]);
  const existingKeys = new Set(
    targetTeachers.map((teacher) =>
      buildTeacherKey({
        name: normalizeText(teacher.userId?.nama),
        subject: teacher.subject,
        branch: teacher.branch,
        capableGrades: (teacher.capableGrades ?? []).map(String),
      }),
    ),
  );
  const plannedTeachers = sourceTeachers.filter((teacher) => {
    const name = normalizeText(teacher.userId?.nama);

    if (!name) {
      return false;
    }

    return !existingKeys.has(
      buildTeacherKey({
        name,
        subject: teacher.subject,
        branch: "Adiwerna",
        capableGrades: (teacher.capableGrades ?? []).map(String),
      }),
    );
  });
  const created: Array<{
    teacherId: string;
    name: string;
    email: string;
    generatedPassword: string;
  }> = [];

  console.log(
    `[restore-adiwerna-teachers] action=${apply ? "apply" : "dry-run"} plannedTeachers=${plannedTeachers.length}`,
  );
  console.table(
    plannedTeachers.map((teacher) => ({
      Nama: normalizeText(teacher.userId?.nama),
      Mapel: teacher.subject,
      Cabang: "Adiwerna",
      Tingkat: (teacher.capableGrades ?? []).join(", "),
    })),
  );

  if (!apply) {
    console.log("Dry-run selesai. Jalankan dengan --apply untuk membuat guru Adiwerna.");
    return;
  }

  for (const teacher of plannedTeachers) {
    const { teacherId, email } = await getNextAvailableTeacherIdentity();
    const generatedPassword = buildGeneratedPasswordFromTeacherId(teacherId);
    const user = await User.create({
      nama: normalizeText(teacher.userId?.nama),
      email,
      password: await bcrypt.hash(generatedPassword, 12),
      role: "guru",
      isEmailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null,
    });

    await Teacher.create({
      teacherId,
      userId: user._id,
      subject: teacher.subject,
      branch: "Adiwerna",
      phone: "-",
      schedule: "-",
      activeClasses: 0,
      classList: teacher.classList,
      capableGrades: (teacher.capableGrades ?? []).map(String),
      status: teacher.status,
      availability: teacher.availability,
    });

    created.push({
      teacherId,
      name: user.nama,
      email,
      generatedPassword,
    });
  }

  console.log(`Selesai. Guru Adiwerna dibuat: ${created.length}.`);

  if (created.length > 0) {
    console.table(created);
  }
}

run()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
