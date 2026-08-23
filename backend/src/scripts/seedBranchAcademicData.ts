import bcrypt from "bcryptjs";
import mongoose from "mongoose";

import "../config/env";
import { Student } from "../models/Student";
import { Teacher } from "../models/Teacher";
import { User } from "../models/User";
import { getNextPublicId } from "../utils/publicId";
import {
  buildGeneratedPasswordForStudent,
} from "../utils/studentPassword";
import { buildImportedStudentEmail } from "../utils/studentImport";
import { buildImportedTeacherEmail } from "../utils/teacherImport";
import { buildGeneratedPasswordFromTeacherId } from "../utils/teacherPassword";

type ScriptOptions = {
  apply: boolean;
  sourceBranch: string;
  targetBranch: string;
};

type PopulatedUser = {
  nama?: string | null;
  email?: string | null;
};

type SourceTeacher = {
  _id: mongoose.Types.ObjectId;
  teacherId: string;
  userId: PopulatedUser | null;
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

type SourceStudent = {
  _id: mongoose.Types.ObjectId;
  studentId: string;
  userId: PopulatedUser | null;
  phone: string;
  branch: string;
  program: string;
  className: string;
  birthDate?: Date | null;
  status: string;
};

function normalizeText(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function parseOptions(argv: string[]): ScriptOptions {
  const sourceBranchArgument = argv.find((argument) => argument.startsWith("--source="));
  const targetBranchArgument = argv.find((argument) => argument.startsWith("--target="));

  return {
    apply: argv.includes("--apply"),
    sourceBranch: normalizeText(sourceBranchArgument?.split("=")[1]) || "Slawi",
    targetBranch: normalizeText(targetBranchArgument?.split("=")[1]) || "Adiwerna",
  };
}

function formatDateOnly(value: Date | null | undefined) {
  if (!value) {
    return "";
  }

  return value.toISOString().slice(0, 10);
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

function buildStudentKey(input: {
  name: string;
  branch: string;
  program: string;
  className: string;
}) {
  return [
    normalizeText(input.name).toLowerCase(),
    normalizeText(input.branch).toLowerCase(),
    normalizeText(input.program).toLowerCase(),
    normalizeText(input.className).toLowerCase(),
  ].join("|");
}

async function loadTeachers(branch: string) {
  return (await Teacher.find({
    branch,
    status: "Aktif",
  })
    .populate<{ userId: PopulatedUser | null }>({
      path: "userId",
      model: User,
      select: "nama email",
    })
    .sort({ teacherId: 1 })
    .lean()
    .exec()) as SourceTeacher[];
}

async function loadStudents(branch: string) {
  return (await Student.find({
    branch,
    status: "Aktif",
  })
    .populate<{ userId: PopulatedUser | null }>({
      path: "userId",
      model: User,
      select: "nama email",
    })
    .sort({ studentId: 1 })
    .lean()
    .exec()) as SourceStudent[];
}

async function cloneTeachers(options: ScriptOptions) {
  const [sourceTeachers, targetTeachers] = await Promise.all([
    loadTeachers(options.sourceBranch),
    loadTeachers(options.targetBranch),
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
        branch: options.targetBranch,
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

  if (!options.apply) {
    return {
      plannedCount: plannedTeachers.length,
      created,
    };
  }

  for (const teacher of plannedTeachers) {
    const identity = await getNextAvailableTeacherIdentity();
    const teacherId = identity.teacherId;
    const email = identity.email;
    const generatedPassword = buildGeneratedPasswordFromTeacherId(teacherId);
    const user =
      identity.reusableUser ??
      (await User.create({
        nama: normalizeText(teacher.userId?.nama),
        email,
        password: await bcrypt.hash(generatedPassword, 12),
        role: "guru",
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      }));

    if (identity.reusableUser) {
      user.nama = normalizeText(teacher.userId?.nama);
      user.role = "guru";
      user.isEmailVerified = true;
      user.emailVerificationToken = null;
      user.emailVerificationExpires = null;
      await user.save();
    }

    await Teacher.create({
      teacherId,
      userId: user._id,
      subject: teacher.subject,
      branch: options.targetBranch,
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

  return {
    plannedCount: plannedTeachers.length,
    created,
  };
}

async function cloneStudents(options: ScriptOptions) {
  const [sourceStudents, targetStudents] = await Promise.all([
    loadStudents(options.sourceBranch),
    loadStudents(options.targetBranch),
  ]);
  const existingKeys = new Set(
    targetStudents.map((student) =>
      buildStudentKey({
        name: normalizeText(student.userId?.nama),
        branch: student.branch,
        program: student.program,
        className: student.className,
      }),
    ),
  );
  const plannedStudents = sourceStudents.filter((student) => {
    const name = normalizeText(student.userId?.nama);

    if (!name) {
      return false;
    }

    return !existingKeys.has(
      buildStudentKey({
        name,
        branch: options.targetBranch,
        program: student.program,
        className: student.className,
      }),
    );
  });
  const created: Array<{
    studentId: string;
    name: string;
    email: string;
    generatedPassword: string;
    className: string;
  }> = [];

  if (!options.apply) {
    return {
      plannedCount: plannedStudents.length,
      created,
    };
  }

  for (const student of plannedStudents) {
    const identity = await getNextAvailableStudentIdentity();
    const studentId = identity.studentId;
    const email = identity.email;
    const birthDate = formatDateOnly(student.birthDate);
    const generatedPassword = buildGeneratedPasswordForStudent({
      birthDate,
      studentId,
    });
    const user =
      identity.reusableUser ??
      (await User.create({
        nama: normalizeText(student.userId?.nama),
        email,
        password: await bcrypt.hash(generatedPassword, 12),
        role: "siswa",
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      }));

    if (identity.reusableUser) {
      user.nama = normalizeText(student.userId?.nama);
      user.role = "siswa";
      user.isEmailVerified = true;
      user.emailVerificationToken = null;
      user.emailVerificationExpires = null;
      await user.save();
    }

    await Student.create({
      studentId,
      userId: user._id,
      phone: student.phone,
      branch: options.targetBranch,
      program: student.program,
      className: student.className,
      birthDate: student.birthDate ?? null,
      status: student.status,
    });

    created.push({
      studentId,
      name: user.nama,
      email,
      generatedPassword,
      className: student.className,
    });
  }

  return {
    plannedCount: plannedStudents.length,
    created,
  };
}

async function getNextAvailableTeacherIdentity() {
  let nextNumber = Number((await getNextPublicId(Teacher, "teacherId", "TCH")).replace(/\D/g, ""));

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
        reusableUser: null,
      };
    }

    const usedTeacher = await Teacher.exists({ userId: existingUser._id }).exec();

    if (existingUser.role === "guru" && !usedTeacher) {
      return {
        teacherId,
        email,
        reusableUser: existingUser,
      };
    }

    nextNumber += 1;
  }

  throw new Error("Gagal mencari Teacher ID yang tersedia.");
}

async function getNextAvailableStudentIdentity() {
  let nextNumber = Number((await getNextPublicId(Student, "studentId", "STD")).replace(/\D/g, ""));

  for (let attempt = 0; attempt < 2000; attempt += 1) {
    const studentId = `STD-${String(nextNumber).padStart(3, "0")}`;
    const email = buildImportedStudentEmail(studentId);
    const existingStudent = await Student.exists({ studentId }).exec();

    if (existingStudent) {
      nextNumber += 1;
      continue;
    }

    const existingUser = await User.findOne({ email }).exec();

    if (!existingUser) {
      return {
        studentId,
        email,
        reusableUser: null,
      };
    }

    const usedStudent = await Student.exists({ userId: existingUser._id }).exec();

    if (existingUser.role === "siswa" && !usedStudent) {
      return {
        studentId,
        email,
        reusableUser: existingUser,
      };
    }

    nextNumber += 1;
  }

  throw new Error("Gagal mencari Student ID yang tersedia.");
}

async function run() {
  const options = parseOptions(process.argv.slice(2));

  if (options.sourceBranch.toLowerCase() === options.targetBranch.toLowerCase()) {
    throw new Error("Cabang sumber dan cabang target tidak boleh sama.");
  }

  await mongoose.connect(process.env.MONGO_URI as string);

  const [teacherResult, studentResult] = await Promise.all([
    cloneTeachers(options),
    cloneStudents(options),
  ]);

  console.log(
    `[seed-branch-academic-data] action=${options.apply ? "apply" : "dry-run"} source=${options.sourceBranch} target=${options.targetBranch}`,
  );
  console.table([
    {
      Data: "Guru",
      Rencana: teacherResult.plannedCount,
      Dibuat: teacherResult.created.length,
    },
    {
      Data: "Siswa",
      Rencana: studentResult.plannedCount,
      Dibuat: studentResult.created.length,
    },
  ]);

  if (teacherResult.created.length > 0) {
    console.log("[seed-branch-academic-data] akun guru baru");
    console.table(teacherResult.created);
  }

  if (studentResult.created.length > 0) {
    console.log("[seed-branch-academic-data] contoh akun siswa baru");
    console.table(studentResult.created.slice(0, 20));
    if (studentResult.created.length > 20) {
      console.log(
        `... ${studentResult.created.length - 20} akun siswa lain berhasil dibuat.`,
      );
    }
  }

  if (!options.apply) {
    console.log("Dry-run selesai. Jalankan dengan --apply untuk membuat data.");
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
