import mongoose from "mongoose";

import "../config/env";
import { Room } from "../models/Room";
import { Schedule, type ScheduleDocument, type ScheduleSubject } from "../models/Schedule";
import { Student } from "../models/Student";
import { Teacher, type TeacherDocument } from "../models/Teacher";
import { User } from "../models/User";
import { buildTeacherLoginCode } from "../utils/accountCode";
import { getCurrentAcademicPeriod } from "../utils/academicGrade";
import { getNextPublicId } from "../utils/publicId";

type SeedOptions = {
  apply: boolean;
};

type PopulatedTeacher = TeacherDocument & {
  userId: {
    nama?: string | null;
    email?: string | null;
    loginCode?: string | null;
  };
};

type TeacherChoice = {
  teacher: PopulatedTeacher;
  score: number;
};

type SeedSummary = {
  branch: string;
  utbkStudentCount: number;
  room: {
    action: "created" | "reused";
    name: string;
  };
  schedules: Array<{
    action: "created" | "updated" | "skipped" | "blocked";
    id: string;
    className: string;
    subject: ScheduleSubject;
    day: string;
    time: string;
    room: string;
    teacher: string;
    teacherId: string;
    reason?: string;
  }>;
};

const utbkScheduleTemplates: Array<{
  day: string;
  time: string;
  subject: ScheduleSubject;
}> = [
  {
    day: "Sabtu",
    time: "13:00 - 14:30",
    subject: "TPS",
  },
  {
    day: "Sabtu",
    time: "14:00 - 15:30",
    subject: "Literasi Bahasa Indonesia",
  },
  {
    day: "Minggu",
    time: "13:00 - 14:30",
    subject: "Penalaran Matematika",
  },
];

function normalizeText(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function normalizeLookup(value: string | null | undefined): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ");
}

function parseOptions(argv: string[]): SeedOptions {
  return {
    apply: argv.includes("--apply"),
  };
}

function getSubjectPreferenceScore(subject: ScheduleSubject, teacherSubject: string) {
  const normalizedSubject = normalizeLookup(teacherSubject);

  if (subject === "Penalaran Matematika") {
    return /\b(matematika|mtk)\b/.test(normalizedSubject) ? 160 : 0;
  }

  if (subject === "Literasi Bahasa Indonesia") {
    return /\b(indonesia|b indonesia|bahasa indonesia)\b/.test(normalizedSubject)
      ? 160
      : 0;
  }

  if (subject === "TPS") {
    if (/\b(matematika|mtk)\b/.test(normalizedSubject)) {
      return 150;
    }

    if (/\b(ipa|fisika|kimia)\b/.test(normalizedSubject)) {
      return 130;
    }

    if (/\b(indonesia|inggris|bahasa)\b/.test(normalizedSubject)) {
      return 110;
    }
  }

  return 0;
}

function isGeneratedUtbkTeacher(teacher: PopulatedTeacher) {
  const name = normalizeLookup(teacher.userId?.nama);
  const email = normalizeLookup(teacher.userId?.email);

  return name.startsWith("guru utbk") || email.startsWith("guru utbk");
}

function scoreTeacherForSchedule(
  teacher: PopulatedTeacher,
  branch: string,
  subject: ScheduleSubject,
) {
  if (isGeneratedUtbkTeacher(teacher)) {
    return Number.NEGATIVE_INFINITY;
  }

  const normalizedBranch = normalizeLookup(branch);
  const teacherBranch = normalizeLookup(teacher.branch);
  const teacherBranches = (teacher.branches ?? []).map(normalizeLookup);
  const teacherName = normalizeLookup(teacher.userId?.nama);
  let score = getSubjectPreferenceScore(subject, teacher.subject);

  if (teacherBranch === normalizedBranch) {
    score += 35;
  } else if (teacherBranches.includes(normalizedBranch)) {
    score += 20;
  }

  if (
    (teacher.capableGrades ?? []).some((grade) =>
      /\b(12|sma 12|kelas 12)\b/.test(normalizeLookup(grade)),
    )
  ) {
    score += 25;
  }

  if (/\bdemo\b/.test(teacherName)) {
    score -= 80;
  }

  return score;
}

async function getBranchUtbkStudentCounts() {
  const students = await Student.find({
    program: /^UTBK$/i,
    status: "Aktif",
  })
    .select("branch")
    .lean()
    .exec();
  const counts = new Map<string, number>();

  for (const student of students) {
    const branch = normalizeText(student.branch);

    if (!branch) {
      continue;
    }

    counts.set(branch, (counts.get(branch) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([branch, count]) => ({ branch, count }))
    .sort((left, right) => left.branch.localeCompare(right.branch, "id-ID"));
}

async function findExistingTeacherForSchedule(
  branch: string,
  subject: ScheduleSubject,
): Promise<TeacherChoice | null> {
  const teachers = (await Teacher.find({
    status: "Aktif",
    $or: [{ branch }, { branches: branch }],
  })
    .populate<{ userId: PopulatedTeacher["userId"] }>({
      path: "userId",
      model: User,
      select: "nama email loginCode",
    })
    .sort({ teacherId: 1 })
    .exec()) as unknown as PopulatedTeacher[];
  const choices = teachers
    .map((teacher) => ({
      teacher,
      score: scoreTeacherForSchedule(teacher, branch, subject),
    }))
    .filter((choice) => Number.isFinite(choice.score))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.teacher.teacherId.localeCompare(right.teacher.teacherId, "id-ID");
    });

  return choices[0] ?? null;
}

async function getOrCreateUtbkRoom(branch: string, options: SeedOptions) {
  const roomName = `Ruang UTBK ${branch}`;
  const existingRoom = await Room.findOne({ name: roomName }).exec();

  if (existingRoom) {
    if (options.apply && normalizeText(existingRoom.teacher).startsWith("Guru UTBK")) {
      existingRoom.teacher = "Jadwal UTBK";
      await existingRoom.save();
    }

    return {
      action: "reused" as const,
      name: existingRoom.name,
    };
  }

  if (!options.apply) {
    return {
      action: "created" as const,
      name: roomName,
    };
  }

  const roomId = await getNextPublicId(Room, "roomId", "ROM");

  await Room.create({
    roomId,
    name: roomName,
    floor: "Lantai 1",
    status: "Kosong",
    activeClass: "UTBK",
    teacher: "Jadwal UTBK",
    time: "Sabtu-Minggu 13:00 - 14:30",
    occupancy: 0,
    capacityLabel: "0/20",
    nextSession: "Jadwal UTBK",
  });

  return {
    action: "created" as const,
    name: roomName,
  };
}

function getTeacherDisplay(teacher: PopulatedTeacher) {
  return {
    id: teacher.teacherId,
    name: normalizeText(teacher.userId?.nama) || teacher.teacherId,
    loginCode:
      normalizeText(teacher.userId?.loginCode) ||
      buildTeacherLoginCode(teacher.teacherId),
  };
}

async function updateExistingScheduleTeacher(
  schedule: ScheduleDocument,
  teacher: PopulatedTeacher,
  roomName: string,
  options: SeedOptions,
) {
  const currentTeacherId = schedule.teacherId.toString();
  const nextTeacherId = teacher._id.toString();
  const needsUpdate =
    currentTeacherId !== nextTeacherId || normalizeText(schedule.room) !== roomName;

  if (needsUpdate && options.apply) {
    schedule.teacherId = teacher._id;
    schedule.room = roomName;
    await schedule.save();
  }

  return needsUpdate;
}

async function seedBranchUtbkSchedules(
  branch: string,
  utbkStudentCount: number,
  options: SeedOptions,
): Promise<SeedSummary> {
  const period = getCurrentAcademicPeriod();
  const roomResult = await getOrCreateUtbkRoom(branch, options);
  const schedules: SeedSummary["schedules"] = [];

  for (const template of utbkScheduleTemplates) {
    const teacherChoice = await findExistingTeacherForSchedule(
      branch,
      template.subject,
    );

    if (!teacherChoice) {
      schedules.push({
        action: "blocked",
        id: "-",
        className: "UTBK",
        subject: template.subject,
        day: template.day,
        time: template.time,
        room: roomResult.name,
        teacher: "-",
        teacherId: "-",
        reason: `Tidak ada guru aktif existing yang terhubung ke cabang ${branch}.`,
      });
      continue;
    }

    const teacherDisplay = getTeacherDisplay(teacherChoice.teacher);
    const existingSchedule = await Schedule.findOne({
      branch,
      className: "UTBK",
      subject: template.subject,
      day: template.day,
      time: template.time,
      academicYear: period.academicYear,
    }).exec();

    if (existingSchedule) {
      const needsUpdate = await updateExistingScheduleTeacher(
        existingSchedule,
        teacherChoice.teacher,
        roomResult.name,
        options,
      );

      schedules.push({
        action: needsUpdate ? "updated" : "skipped",
        id: existingSchedule.scheduleId,
        className: existingSchedule.className,
        subject: template.subject,
        day: template.day,
        time: template.time,
        room: roomResult.name,
        teacher: teacherDisplay.name,
        teacherId: teacherDisplay.id,
      });
      continue;
    }

    if (!options.apply) {
      schedules.push({
        action: "created",
        id: "Akan dibuat saat --apply",
        className: "UTBK",
        subject: template.subject,
        day: template.day,
        time: template.time,
        room: roomResult.name,
        teacher: teacherDisplay.name,
        teacherId: teacherDisplay.id,
      });
      continue;
    }

    const scheduleId = await getNextPublicId(Schedule, "scheduleId", "SCH");
    const createdSchedule = await Schedule.create({
      scheduleId,
      day: template.day,
      time: template.time,
      className: "UTBK",
      branch,
      subject: template.subject,
      teacherId: teacherChoice.teacher._id,
      room: roomResult.name,
      status: "Berjalan",
      academicYear: period.academicYear,
      semester: period.semester,
    });

    schedules.push({
      action: "created",
      id: createdSchedule.scheduleId,
      className: createdSchedule.className,
      subject: template.subject,
      day: template.day,
      time: template.time,
      room: createdSchedule.room,
      teacher: teacherDisplay.name,
      teacherId: teacherDisplay.id,
    });
  }

  return {
    branch,
    utbkStudentCount,
    room: roomResult,
    schedules,
  };
}

async function run() {
  const options = parseOptions(process.argv.slice(2));
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI wajib tersedia di backend/.env");
  }

  await mongoose.connect(mongoUri);

  try {
    const studentCounts = await getBranchUtbkStudentCounts();

    if (studentCounts.length === 0) {
      console.log(
        JSON.stringify(
          {
            mode: options.apply ? "apply" : "dry-run",
            message: "Tidak ada siswa UTBK aktif, jadi jadwal tidak dibuat.",
            branches: [],
          },
          null,
          2,
        ),
      );
      return;
    }

    const summaries: SeedSummary[] = [];

    for (const { branch, count } of studentCounts) {
      summaries.push(await seedBranchUtbkSchedules(branch, count, options));
    }

    console.log(
      JSON.stringify(
        {
          mode: options.apply ? "apply" : "dry-run",
          academicPeriod: getCurrentAcademicPeriod(),
          branches: summaries,
        },
        null,
        2,
      ),
    );
  } finally {
    await mongoose.disconnect();
  }
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
});
