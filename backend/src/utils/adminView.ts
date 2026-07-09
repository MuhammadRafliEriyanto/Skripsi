import type { RoomDocument } from "../models/Room";
import type { ScheduleStatus } from "../models/Schedule";
import type { StudentDocument } from "../models/Student";
import type { TeacherDocument } from "../models/Teacher";
import type { UserDocument } from "../models/User";
import { buildStudentLoginCode, buildTeacherLoginCode } from "./accountCode";
import { formatDateOnly } from "./date";
import { buildGeneratedPasswordForStudent } from "./studentPassword";

export type PublicStudent = {
  id: string;
  name: string;
  email: string;
  loginCode: string;
  phone: string;
  branch: string;
  level: "SD" | "SMP" | "SMA";
  program: string;
  className: string;
  birthDate: string;
  academicYear: string;
  generatedPassword: string;
  status: "Aktif" | "Nonaktif";
  membership?: {
    status: "active" | "expiring" | "pending" | "expired" | "none";
    packageKey?: string;
    packageName?: string;
    paymentStatus?: string;
    startDate?: string;
    endDate?: string;
  };
};

export type PublicTeacher = {
  id: string;
  name: string;
  email: string;
  loginCode: string;
  subject: string;
  schedule: string;
  activeClasses: number;
  classList: string;
  capableGrades: string[];
  branch: string;
  branches: string[];
  phone: string;
  status: "Aktif" | "Nonaktif";
  availability: "Tersedia" | "Padat" | "Cuti";
};

export type PublicSchedule = {
  id: string;
  day: string;
  time: string;
  className: string;
  subject: string;
  teacherId: string;
  teacher: string;
  branch: string;
  room: string;
  status: ScheduleStatus;
  conflicts: string[];
};

export type PublicRoom = {
  id: string;
  name: string;
  floor: string;
  status: "Dipakai" | "Kosong" | "Persiapan";
  activeClass: string;
  teacher: string;
  time: string;
  occupancy: number;
  capacityLabel: string;
  nextSession: string;
};

export function deriveStudentLevelFromClassName(className: string): PublicStudent["level"] {
  if (className.startsWith("SD")) {
    return "SD";
  }

  if (className.startsWith("SMP")) {
    return "SMP";
  }

  return "SMA";
}

export function hasPopulatedUserDocument(value: unknown): value is UserDocument {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as {
    email?: unknown;
    nama?: unknown;
  };

  return (
    typeof candidate.nama === "string" && typeof candidate.email === "string"
  );
}

export function toPublicStudent(
  student: StudentDocument,
  user: UserDocument,
  membership?: PublicStudent["membership"]
): PublicStudent {
  const birthDate = formatDateOnly(student.birthDate);

  return {
    id: student.studentId,
    name: user.nama,
    email: user.email,
    loginCode: user.loginCode || buildStudentLoginCode(student.studentId),
    phone: student.phone,
    branch: student.branch,
    level: deriveStudentLevelFromClassName(student.className),
    program: student.program,
    className: student.className,
    birthDate,
    academicYear: student.academicYear || "2025/2026",
    generatedPassword: buildGeneratedPasswordForStudent({
      birthDate,
      studentId: student.studentId,
    }),
    status: student.status,
    membership,
  };
}

export function toPublicTeacher(teacher: TeacherDocument, user: UserDocument): PublicTeacher {
  return {
    id: teacher.teacherId,
    name: user.nama,
    email: user.email,
    loginCode: user.loginCode || buildTeacherLoginCode(teacher.teacherId),
    subject: teacher.subject,
    schedule: teacher.schedule,
    activeClasses: teacher.activeClasses,
    classList: teacher.classList,
    capableGrades: teacher.capableGrades || [],
    branch: teacher.branch,
    branches: Array.from(
      new Set([teacher.branch, ...(teacher.branches ?? [])].filter(Boolean)),
    ),
    phone: teacher.phone,
    status: teacher.status,
    availability: teacher.availability,
  };
}

export function toPublicRoom(room: RoomDocument): PublicRoom {
  return {
    id: room.roomId,
    name: room.name,
    floor: room.floor,
    status: room.status,
    activeClass: room.activeClass,
    teacher: room.teacher,
    time: room.time,
    occupancy: room.occupancy,
    capacityLabel: room.capacityLabel,
    nextSession: room.nextSession,
  };
}
