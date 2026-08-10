import mongoose from "mongoose";

import "../config/env";
import { AttendanceRecord } from "../models/AttendanceRecord";
import { AttendanceSession } from "../models/AttendanceSession";
import { ClassMaterial } from "../models/ClassMaterial";
import { ClassTask } from "../models/ClassTask";
import { StudentTaskAttempt } from "../models/StudentTaskAttempt";
import { TaskGrade } from "../models/TaskGrade";
import { TaskSubmission } from "../models/TaskSubmission";

const SEED_LAST_FEBRUARY_DATE = "2026-02-28";
const SEED_MEETING_DATES = [
  "2026-02-02",
  "2026-02-05",
  "2026-02-08",
  "2026-02-11",
  "2026-02-14",
  "2026-02-17",
  "2026-02-20",
  "2026-02-23",
  "2026-02-26",
];
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const YEAR_2025_RANGE = {
  $gte: new Date("2025-01-01T00:00:00.000Z"),
  $lt: new Date("2026-01-01T00:00:00.000Z"),
};

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function getSeedMeetingDate(meetingNumber: number) {
  return SEED_MEETING_DATES[meetingNumber - 1] ?? SEED_LAST_FEBRUARY_DATE;
}

function parseDateKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000+07:00`);
}

function getJakartaDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Jakarta",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "2026";
  const month = parts.find((part) => part.type === "month")?.value ?? "02";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

function addDays(dateKey: string, days: number) {
  const date = parseDateKey(dateKey);
  return getJakartaDateKey(new Date(date.getTime() + days * DAY_IN_MS));
}

function getSeedTaskDeadline(dateKey: string) {
  const deadline = addDays(dateKey, 2);

  return deadline > SEED_LAST_FEBRUARY_DATE
    ? SEED_LAST_FEBRUARY_DATE
    : deadline;
}

function getPublicIdSuffix(value: string, prefix: string) {
  const normalizedValue = normalizeText(value);

  return normalizedValue.startsWith(prefix)
    ? normalizedValue.slice(prefix.length)
    : "";
}

function getStartTime(value: string | null | undefined) {
  return normalizeText(value).match(/\b\d{2}:\d{2}\b/)?.[0] ?? "15:00";
}

function buildJakartaDateTime(dateKey: string, startTime: string, offsetMinutes = 0) {
  const date = new Date(`${dateKey}T${getStartTime(startTime)}:00.000+07:00`);
  return new Date(date.getTime() + offsetMinutes * 60 * 1000);
}

function isDateIn2025(value: Date | null | undefined) {
  if (!value) {
    return false;
  }

  return (
    value.getTime() >= YEAR_2025_RANGE.$gte.getTime() &&
    value.getTime() < YEAR_2025_RANGE.$lt.getTime()
  );
}

async function countRemaining2025() {
  return {
    attendanceSessions2025: await AttendanceSession.countDocuments({
      sessionId: /^ATS-BIMBEL-P1P9-/,
      date: /^2025/,
    }),
    materials2025: await ClassMaterial.countDocuments({
      materialId: /^MAT-BIMBEL-P1P9-/,
      date: /^2025/,
    }),
    tasks2025: await ClassTask.countDocuments({
      taskId: /^TSK-BIMBEL-P1P9-/,
      deadline: /^2025/,
    }),
    submissions2025: await TaskSubmission.countDocuments({
      submissionId: /^SUBM-BIMBEL-P1P9-/,
      submittedAt: YEAR_2025_RANGE,
    }),
    attempts2025: await StudentTaskAttempt.countDocuments({
      attemptId: /^ATTEMPT-BIMBEL-P1P9-/,
      submittedAt: YEAR_2025_RANGE,
    }),
    grades2025: await TaskGrade.countDocuments({
      gradeId: /^GRADE-BIMBEL-P1P9-/,
      gradedAt: YEAR_2025_RANGE,
    }),
  };
}

async function normalizeDates(apply: boolean) {
  const stats = {
    sessions: 0,
    records: 0,
    materials: 0,
    tasks: 0,
    submissions: 0,
    attempts: 0,
    grades: 0,
  };
  const sessions = await AttendanceSession.find({
    sessionId: /^ATS-BIMBEL-P1P9-/,
    date: /^2025/,
  })
    .select("sessionId classId subject startTime")
    .lean()
    .exec();
  const suffixes = Array.from(
    new Set(
      sessions
        .map((session) =>
          getPublicIdSuffix(normalizeText(session.sessionId), "ATS-BIMBEL-P1P9-"),
        )
        .filter(Boolean),
    ),
  );
  const tasksBySuffix = new Map(
    (
      await ClassTask.find({
        taskId: {
          $in: suffixes.map((suffix) => `TSK-BIMBEL-P1P9-${suffix}`),
        },
      })
        .select("taskId meetingNumber classId subject")
        .lean()
        .exec()
    ).map((task) => [
      getPublicIdSuffix(normalizeText(task.taskId), "TSK-BIMBEL-P1P9-"),
      task,
    ]),
  );
  const startTimeByTaskId = new Map<string, string>();

  for (const session of sessions) {
    const suffix = getPublicIdSuffix(
      normalizeText(session.sessionId),
      "ATS-BIMBEL-P1P9-",
    );
    const task = tasksBySuffix.get(suffix);
    const meetingNumber = Number(task?.meetingNumber) || 1;
    const newDate = getSeedMeetingDate(meetingNumber);
    const startTime = getStartTime(session.startTime);
    const markedAt = buildJakartaDateTime(newDate, startTime);

    if (task?.taskId) {
      startTimeByTaskId.set(normalizeText(task.taskId), startTime);
    }

    stats.sessions += 1;
    const recordsForSession = await AttendanceRecord.countDocuments({
      sessionId: normalizeText(session.sessionId),
    });
    stats.records += recordsForSession;

    if (apply) {
      await AttendanceSession.updateOne(
        { sessionId: normalizeText(session.sessionId) },
        { $set: { date: newDate } },
      ).exec();
      await AttendanceRecord.updateMany(
        { sessionId: normalizeText(session.sessionId) },
        { $set: { markedAt } },
      ).exec();
    }
  }

  const materials = await ClassMaterial.find({
    materialId: /^MAT-BIMBEL-P1P9-/,
    date: /^2025/,
  })
    .select("materialId meetingNumber")
    .lean()
    .exec();

  for (const material of materials) {
    const newDate = getSeedMeetingDate(Number(material.meetingNumber) || 1);
    stats.materials += 1;

    if (apply) {
      await ClassMaterial.updateOne(
        { materialId: normalizeText(material.materialId) },
        { $set: { date: newDate } },
      ).exec();
    }
  }

  const tasks = await ClassTask.find({
    taskId: /^TSK-BIMBEL-P1P9-/,
    $or: [
      { deadline: /^2025/ },
      {
        taskId: {
          $in: Array.from(startTimeByTaskId.keys()),
        },
      },
    ],
  })
    .select("taskId meetingNumber")
    .lean()
    .exec();

  for (const task of tasks) {
    const taskId = normalizeText(task.taskId);
    const meetingNumber = Number(task.meetingNumber) || 1;
    const newDate = getSeedMeetingDate(meetingNumber);
    const deadline = getSeedTaskDeadline(newDate);
    const startTime = startTimeByTaskId.get(taskId) ?? "15:00";
    const startedAt = buildJakartaDateTime(newDate, startTime);
    const submittedAt = buildJakartaDateTime(newDate, startTime, 75);

    stats.tasks += 1;
    stats.submissions += await TaskSubmission.countDocuments({
      taskId,
      submissionId: /^SUBM-BIMBEL-P1P9-/,
      submittedAt: YEAR_2025_RANGE,
    });
    stats.attempts += await StudentTaskAttempt.countDocuments({
      taskId,
      attemptId: /^ATTEMPT-BIMBEL-P1P9-/,
      submittedAt: YEAR_2025_RANGE,
    });
    const grades = await TaskGrade.find({
      taskId,
      gradeId: /^GRADE-BIMBEL-P1P9-/,
      gradedAt: YEAR_2025_RANGE,
    })
      .select("gradeId remedialRequestedAt")
      .lean()
      .exec();
    stats.grades += grades.length;

    if (apply) {
      await ClassTask.updateOne(
        { taskId },
        { $set: { deadline } },
      ).exec();
      await TaskSubmission.updateMany(
        {
          taskId,
          submissionId: /^SUBM-BIMBEL-P1P9-/,
          submittedAt: YEAR_2025_RANGE,
        },
        { $set: { submittedAt } },
      ).exec();
      await StudentTaskAttempt.updateMany(
        {
          taskId,
          attemptId: /^ATTEMPT-BIMBEL-P1P9-/,
          submittedAt: YEAR_2025_RANGE,
        },
        { $set: { startedAt, submittedAt } },
      ).exec();

      for (const grade of grades) {
        await TaskGrade.updateOne(
          { gradeId: normalizeText(grade.gradeId) },
          {
            $set: {
              gradedAt: submittedAt,
              ...(isDateIn2025(grade.remedialRequestedAt)
                ? { remedialRequestedAt: submittedAt }
                : {}),
            },
          },
        ).exec();
      }
    }
  }

  return stats;
}

async function run() {
  const apply = process.argv.includes("--apply");

  await mongoose.connect(process.env.MONGO_URI as string);

  const before = await countRemaining2025();
  const stats = await normalizeDates(apply);
  const after = apply ? await countRemaining2025() : before;

  console.log(
    JSON.stringify(
      {
        action: apply ? "apply" : "dry-run",
        before,
        stats,
        after,
      },
      null,
      2,
    ),
  );
}

run()
  .catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
