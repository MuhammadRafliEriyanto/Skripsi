import mongoose, { Types } from "mongoose";

import "../config/env";
import { Room } from "../models/Room";
import { Schedule } from "../models/Schedule";
import { syncTeacherScheduleStats } from "../utils/teacherStats";

const TARGET_DURATION_MINUTES = 90;
const CLOCK_TOKEN_PATTERN = /(\d{1,2})\s*[:.]\s*(\d{2})/g;
const SAMPLE_LIMIT = 20;

type ScheduleTarget = {
  _id: Types.ObjectId;
  scheduleId: string;
  day: string;
  time: string;
  className: string;
  branch: string;
  teacherId: Types.ObjectId | null;
};

type RoomTarget = {
  _id: Types.ObjectId;
  roomId: string;
  name: string;
  time: string;
};

type NormalizedChange = {
  id: string;
  label: string;
  from: string;
  to: string;
};

function normalizeText(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function parseClock(hours: string | undefined, minutes: string | undefined) {
  const parsedHours = Number(hours ?? "");
  const parsedMinutes = Number(minutes ?? "");

  if (
    !Number.isInteger(parsedHours) ||
    !Number.isInteger(parsedMinutes) ||
    parsedHours < 0 ||
    parsedHours > 23 ||
    parsedMinutes < 0 ||
    parsedMinutes > 59
  ) {
    return null;
  }

  return parsedHours * 60 + parsedMinutes;
}

function formatMinutes(totalMinutes: number) {
  const normalizedMinutes = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalizedMinutes / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (normalizedMinutes % 60).toString().padStart(2, "0");

  return `${hours}:${minutes}`;
}

function normalizeDurationRange(value: string | null | undefined) {
  const originalValue = normalizeText(value);
  const normalizedValue = originalValue
    .replace(/[–—]/g, "-")
    .replace(/\b(?:s\/d|sd|sampai|hingga|to)\b/gi, "-");

  if (!normalizedValue) {
    return null;
  }

  const matches = Array.from(normalizedValue.matchAll(CLOCK_TOKEN_PATTERN));
  const firstMatch = matches[0];
  const startMinutes = parseClock(firstMatch?.[1], firstMatch?.[2]);

  if (!firstMatch || startMinutes === null || firstMatch.index === undefined) {
    return null;
  }

  const nextRange = `${formatMinutes(startMinutes)} - ${formatMinutes(
    startMinutes + TARGET_DURATION_MINUTES,
  )}`;
  const secondMatch = matches[1];

  if (secondMatch && secondMatch.index !== undefined) {
    const before = normalizedValue.slice(0, firstMatch.index);
    const after = normalizedValue.slice(secondMatch.index + secondMatch[0].length);

    return normalizeText(`${before}${nextRange}${after}`);
  }

  const before = normalizedValue.slice(0, firstMatch.index);
  const after = normalizedValue.slice(firstMatch.index + firstMatch[0].length);

  return normalizeText(`${before}${nextRange}${after}`);
}

async function normalizeSchedules(apply: boolean) {
  const schedules = await Schedule.find({})
    .select("_id scheduleId day time className branch teacherId")
    .lean<ScheduleTarget[]>()
    .exec();
  const changes: NormalizedChange[] = [];
  const invalidSchedules: ScheduleTarget[] = [];
  const affectedTeacherIds = new Set<string>();

  for (const schedule of schedules) {
    const nextTime = normalizeDurationRange(schedule.time);

    if (!nextTime) {
      invalidSchedules.push(schedule);
      continue;
    }

    if (nextTime === normalizeText(schedule.time)) {
      continue;
    }

    changes.push({
      id: schedule.scheduleId,
      label: `${schedule.branch} | ${schedule.className} | ${schedule.day}`,
      from: schedule.time,
      to: nextTime,
    });

    if (schedule.teacherId) {
      affectedTeacherIds.add(schedule.teacherId.toString());
    }

    if (apply) {
      await Schedule.updateOne(
        { _id: schedule._id },
        {
          $set: {
            time: nextTime,
          },
        },
      ).exec();
    }
  }

  if (apply) {
    for (const teacherId of affectedTeacherIds) {
      await syncTeacherScheduleStats(new Types.ObjectId(teacherId));
    }
  }

  return {
    total: schedules.length,
    changes,
    invalidSchedules,
    affectedTeacherCount: affectedTeacherIds.size,
  };
}

async function normalizeRooms(apply: boolean) {
  const rooms = await Room.find({})
    .select("_id roomId name time")
    .lean<RoomTarget[]>()
    .exec();
  const changes: NormalizedChange[] = [];
  const invalidRooms: RoomTarget[] = [];

  for (const room of rooms) {
    const nextTime = normalizeDurationRange(room.time);

    if (!nextTime) {
      invalidRooms.push(room);
      continue;
    }

    if (nextTime === normalizeText(room.time)) {
      continue;
    }

    changes.push({
      id: room.roomId,
      label: room.name,
      from: room.time,
      to: nextTime,
    });

    if (apply) {
      await Room.updateOne(
        { _id: room._id },
        {
          $set: {
            time: nextTime,
          },
        },
      ).exec();
    }
  }

  return {
    total: rooms.length,
    changes,
    invalidRooms,
  };
}

function printSamples(title: string, changes: NormalizedChange[]) {
  console.log(`\n${title}: ${changes.length}`);

  for (const change of changes.slice(0, SAMPLE_LIMIT)) {
    console.log(`- [${change.id}] ${change.label}: ${change.from} -> ${change.to}`);
  }

  if (changes.length > SAMPLE_LIMIT) {
    console.log(`- ... ${changes.length - SAMPLE_LIMIT} perubahan lain`);
  }
}

async function run() {
  const apply = process.argv.includes("--apply");

  await mongoose.connect(process.env.MONGO_URI as string);

  const scheduleResult = await normalizeSchedules(apply);
  const roomResult = await normalizeRooms(apply);

  console.log(
    `${apply ? "APPLY" : "DRY RUN"} normalisasi durasi jadwal ke ${TARGET_DURATION_MINUTES} menit`,
  );
  console.log(`Total jadwal: ${scheduleResult.total}`);
  console.log(`Total ruangan: ${roomResult.total}`);
  console.log(`Guru terdampak: ${scheduleResult.affectedTeacherCount}`);

  printSamples("Jadwal yang berubah", scheduleResult.changes);
  printSamples("Label ruangan yang berubah", roomResult.changes);

  if (scheduleResult.invalidSchedules.length > 0) {
    console.log(`\nJadwal dilewati karena format jam tidak terbaca: ${scheduleResult.invalidSchedules.length}`);
  }

  if (roomResult.invalidRooms.length > 0) {
    console.log(`Label ruangan dilewati karena format jam tidak terbaca: ${roomResult.invalidRooms.length}`);
  }

  if (!apply) {
    console.log("\nJalankan ulang dengan --apply untuk menyimpan perubahan.");
  }

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
