import type { NextFunction, Request, Response } from "express";

import { AcademicGrade } from "../models/AcademicGrade";
import { AttendanceRecord } from "../models/AttendanceRecord";
import { ClassMaterial } from "../models/ClassMaterial";
import { ClassTask } from "../models/ClassTask";
import { Student, type IStudent } from "../models/Student";
import { StudentTryoutAttempt } from "../models/StudentTryoutAttempt";
import { TaskGrade } from "../models/TaskGrade";
import { TeacherTryout } from "../models/TeacherTryout";
import { User } from "../models/User";
import asyncHandler from "../utils/asyncHandler";
import {
  matchesBranchScope,
  resolveAdminBranchScope,
} from "../utils/adminBranchScope";
import { AppError, sendSuccess } from "../utils/apiResponse";
import { getAdminDashboardConfig } from "../utils/adminDashboardConfig";
import { normalizeCanonicalClassName } from "../utils/studentClass";
import {
  getUtbkScheduleClassNames,
  isUtbkStudent,
} from "../utils/studentProgram";

export const getAdminDashboardConfigData = asyncHandler(
  async (_req: Request, res: Response) => {
    sendSuccess(res, {
      message: "Konfigurasi dashboard admin berhasil diambil.",
      data: getAdminDashboardConfig(),
    });
  },
);

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function toRecordId(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (
    value &&
    typeof value === "object" &&
    "toString" in value &&
    typeof value.toString === "function"
  ) {
    return value.toString();
  }

  return "";
}

function toIsoString(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getAttemptDateOrder(value: Date | string | null | undefined) {
  const isoString = toIsoString(value);

  if (!isoString) {
    return 0;
  }

  const date = new Date(isoString);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function average(values: number[]) {
  if (!values.length) {
    return null;
  }

  return Math.round(
    values.reduce((total, value) => total + value, 0) / values.length,
  );
}

const UTBK_MAIN_TRYOUT_STAGES = [
  {
    stage: 1,
    label: "Tryout UTBK 1",
    shortLabel: "Tryout 1",
  },
  {
    stage: 2,
    label: "Tryout UTBK 2",
    shortLabel: "Tryout 2",
  },
  {
    stage: 3,
    label: "Tryout UTBK 3",
    shortLabel: "Tryout 3",
  },
] as const;

type UtbkMainTryoutStage = (typeof UTBK_MAIN_TRYOUT_STAGES)[number]["stage"];

function normalizeUtbkMainTryoutStage(
  value: number | string | null | undefined,
): UtbkMainTryoutStage | null {
  const parsedValue =
    typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);

  if (parsedValue === 1 || parsedValue === 2 || parsedValue === 3) {
    return parsedValue;
  }

  return null;
}

function getUtbkMainTryoutStageMeta(
  value: number | string | null | undefined,
) {
  const stage = normalizeUtbkMainTryoutStage(value);

  return UTBK_MAIN_TRYOUT_STAGES.find((item) => item.stage === stage) ?? null;
}

function getReadinessStatus(score: number | null, completedTryoutCount: number) {
  if (score === null || completedTryoutCount === 0) {
    return "Belum Ada Nilai";
  }

  if (score < 60) {
    return "Perlu Penguatan";
  }

  if (completedTryoutCount >= 3) {
    return "Data Lengkap";
  }

  return "Sebagian Terisi";
}

type PopulatedStudent = IStudent & {
  _id?: unknown;
  userId?: StudentUserSnapshot | string | null;
};

type StudentUserSnapshot = {
  _id?: unknown;
  nama?: string | null;
  email?: string | null;
  loginCode?: string | null;
};

type AcademicMonitoringStatus =
  | "Belum Hadir"
  | "Belum Akses Materi"
  | "Belum Latihan"
  | "Menunggu Review"
  | "Data Lengkap"
  | "Belum Ada Data";

type ScoreEntry = {
  score: number;
  label: string;
  subject: string;
  date: Date | string | null | undefined;
};

function normalizeProgramFilter(value: string | null | undefined) {
  return normalizeText(value).toUpperCase();
}

function isObjectIdString(value: string) {
  return /^[a-f\d]{24}$/i.test(value);
}

function getPopulatedStudentUser(student: PopulatedStudent) {
  const user = student.userId;

  if (!user || typeof user !== "object" || !("nama" in user)) {
    return null;
  }

  return user;
}

function getStudentUserId(student: PopulatedStudent) {
  const user = student.userId;

  if (!user) {
    return "";
  }

  if (typeof user === "object" && "_id" in user) {
    return toRecordId(user._id);
  }

  return toRecordId(user);
}

async function getStudentUsersById(students: PopulatedStudent[]) {
  const userIds = Array.from(
    new Set(
      students
        .map(getStudentUserId)
        .filter((userId) => userId && isObjectIdString(userId)),
    ),
  );

  if (!userIds.length) {
    return new Map<string, StudentUserSnapshot>();
  }

  const users = (await User.find({
    _id: { $in: userIds },
  })
    .select("_id nama email loginCode")
    .lean()
    .exec()) as StudentUserSnapshot[];

  return new Map(users.map((user) => [toRecordId(user._id), user]));
}

function resolveStudentUser(
  student: PopulatedStudent,
  usersById: Map<string, StudentUserSnapshot>,
) {
  return getPopulatedStudentUser(student) ?? usersById.get(getStudentUserId(student)) ?? null;
}

function getProgramLabel(student: PopulatedStudent) {
  if (isUtbkStudent(student)) {
    return "UTBK/SNBT";
  }

  const program = normalizeText(student.program);
  const className = normalizeText(student.className);
  const normalizedProgram = program.toLowerCase();
  const normalizedClassName = className.toLowerCase();

  if (program && className && normalizedClassName.startsWith(normalizedProgram)) {
    return className;
  }

  return [program, className].filter(Boolean).join(" ") || "Program reguler";
}

function getStudentMonitoringClassNames(student: PopulatedStudent) {
  const classNames = isUtbkStudent(student)
    ? getUtbkScheduleClassNames(student)
    : [
        normalizeText(student.className),
        normalizeCanonicalClassName(student.className) ?? "",
      ];

  return Array.from(
    new Set(
      classNames
        .map((className) => normalizeText(className).toLowerCase())
        .filter(Boolean),
    ),
  );
}

function matchesStudentClassContent(
  content: {
    branch?: string | null;
    className?: string | null;
    canonicalClassName?: string | null;
  },
  student: PopulatedStudent,
  classNames: string[],
) {
  const studentBranch = normalizeText(student.branch).toLowerCase();
  const contentBranch = normalizeText(content.branch).toLowerCase();

  if (studentBranch && contentBranch && studentBranch !== contentBranch) {
    return false;
  }

  const contentClassNames = [
    normalizeText(content.className).toLowerCase(),
    normalizeText(content.canonicalClassName).toLowerCase(),
  ].filter(Boolean);

  return contentClassNames.some((className) => classNames.includes(className));
}

function getAcademicGradeScores(grade: {
  uts?: number | null;
  uas?: number | null;
  uts1?: number | null;
  uts2?: number | null;
  uts3?: number | null;
  tryout1?: number | null;
  tryout2?: number | null;
  tryout3?: number | null;
}) {
  return [
    grade.uts,
    grade.uas,
    grade.uts1,
    grade.uts2,
    grade.uts3,
    grade.tryout1,
    grade.tryout2,
    grade.tryout3,
  ].filter(
    (score): score is number =>
      typeof score === "number" && Number.isFinite(score),
  );
}

function getMonitoringStatus(input: {
  attendanceTotal: number;
  materialCount: number;
  taskCount: number;
  gradedTaskCount: number;
}): AcademicMonitoringStatus {
  if (input.attendanceTotal === 0 && input.materialCount === 0 && input.taskCount === 0) {
    return "Belum Ada Data";
  }
  if (input.attendanceTotal === 0) {
    return "Belum Hadir";
  }
  if (input.materialCount === 0) {
    return "Belum Akses Materi";
  }
  if (input.taskCount === 0) {
    return "Belum Latihan";
  }
  if (input.gradedTaskCount < input.taskCount) {
    return "Menunggu Review";
  }

  return "Data Lengkap";
}

function matchesMonitoringStatusFilter(
  rowStatus: AcademicMonitoringStatus,
  statusFilter?: string,
) {
  const normalizedFilter = normalizeText(statusFilter).toLowerCase();

  if (!normalizedFilter || normalizedFilter === "semua" || normalizedFilter === "all") {
    return true;
  }

  const normalizedRowStatus = normalizeText(rowStatus).toLowerCase();

  if (normalizedFilter === "lengkap" || normalizedFilter === "data lengkap") {
    return normalizedRowStatus === "data lengkap";
  }

  if (normalizedFilter === "menunggu review") {
    return normalizedRowStatus === "menunggu review";
  }

  if (normalizedFilter === "belum latihan") {
    return normalizedRowStatus === "belum latihan";
  }

  if (normalizedFilter === "belum akses materi") {
    return normalizedRowStatus === "belum akses materi";
  }
  
  if (normalizedFilter === "belum hadir") {
    return normalizedRowStatus === "belum hadir";
  }

  if (normalizedFilter === "belum ada") {
    return normalizedRowStatus === "belum ada data";
  }

  return normalizedRowStatus === normalizedFilter;
}

function toMonitoringDateOrder(value: Date | string | null | undefined) {
  return getAttemptDateOrder(value);
}

export const getAdminAcademicMonitoring = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const scope = await resolveAdminBranchScope(req.user);
    const branchFilter = normalizeText(req.query.branch as string | undefined);
    const programFilter = normalizeProgramFilter(
      req.query.program as string | undefined,
    );
    const statusFilter = normalizeText(req.query.status as string | undefined);
    const searchTokens = normalizeText(req.query.q as string | undefined)
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    const students = (await Student.find({ status: "Aktif" })
      .select(
        "_id studentId userId branch program className utbkTrack targetKampus targetJurusan status",
      )
      .populate({
        path: "userId",
        select: "nama email loginCode",
      })
      .sort({ createdAt: -1 })
      .lean()
      .exec()) as PopulatedStudent[];
    const scopedStudents = students.filter((student) => {
      const studentProgram = normalizeProgramFilter(student.program);
      const isUtbk = isUtbkStudent(student);

      if (!matchesBranchScope(student.branch, scope, branchFilter)) {
        return false;
      }

      if (
        programFilter &&
        programFilter !== "SEMUA" &&
        programFilter !== "ALL"
      ) {
        if (programFilter === "REGULER") {
          if (isUtbk) {
            return false;
          }
        } else if (programFilter === "UTBK") {
          if (!isUtbk) {
            return false;
          }
        } else if (studentProgram !== programFilter) {
          return false;
        }
      }
      return true;
    });
    const usersById = await getStudentUsersById(scopedStudents);
    const filteredStudents = scopedStudents.filter((student) => {
      const studentUser = resolveStudentUser(student, usersById);

      if (!normalizeText(studentUser?.nama)) {
        return false;
      }

      if (!searchTokens.length) {
        return true;
      }

      const searchableText = [
        student.studentId,
        studentUser?.nama,
        studentUser?.email,
        studentUser?.loginCode,
        student.branch,
        student.program,
        student.className,
        student.utbkTrack,
        student.targetKampus,
        student.targetJurusan,
      ]
        .map((item) => normalizeText(item))
        .join(" ")
        .toLowerCase();

      return searchTokens.every((token) => searchableText.includes(token));
    });
    const studentIds = filteredStudents
      .map((student) => normalizeText(student.studentId))
      .filter(Boolean);

    const [
      rawAttempts,
      rawAcademicGrades,
      rawTaskGrades,
      rawAttendanceRecords,
      rawMaterials,
      rawTasks,
    ] = studentIds.length
      ? await Promise.all([
          StudentTryoutAttempt.find({
            studentId: { $in: studentIds },
            status: "submitted",
          })
            .select(
              "attemptId tryoutId studentId branch score correctCount wrongCount unansweredCount timeUsedSeconds submittedAt updatedAt",
            )
            .sort({ submittedAt: -1, updatedAt: -1 })
            .lean()
            .exec(),
          AcademicGrade.find({
            studentId: { $in: studentIds },
          })
            .select(
              "academicGradeId classId studentId scheme uts uas uts1 uts2 uts3 tryout1 tryout2 tryout3 evaluatedAt updatedAt createdAt",
            )
            .sort({ evaluatedAt: -1, updatedAt: -1, createdAt: -1 })
            .lean()
            .exec(),
          TaskGrade.find({
            studentId: { $in: studentIds },
          })
            .select("gradeId classId taskId studentId score status gradedAt updatedAt createdAt")
            .sort({ gradedAt: -1, updatedAt: -1, createdAt: -1 })
            .lean()
            .exec(),
          AttendanceRecord.find({
            studentId: { $in: studentIds },
          })
            .select("recordId studentId status markedAt updatedAt createdAt")
            .lean()
            .exec(),
          ClassMaterial.find({
            status: "Dipublikasikan",
          })
            .select("materialId className canonicalClassName branch status")
            .lean()
            .exec(),
          ClassTask.find({})
            .select("taskId className canonicalClassName branch title")
            .lean()
            .exec(),
        ])
      : [[], [], [], [], [], []];
    const tryoutIds = Array.from(
      new Set(rawAttempts.map((attempt) => normalizeText(attempt.tryoutId))),
    ).filter(Boolean);
    const tryouts = tryoutIds.length
      ? await TeacherTryout.find({
          tryoutId: { $in: tryoutIds },
        })
          .select("tryoutId title subject stage branch assessmentType startAt endAt")
          .lean()
          .exec()
      : [];
    const tryoutById = new Map(
      tryouts.map((tryout) => [normalizeText(tryout.tryoutId), tryout] as const),
    );
    const attemptsByStudentId = new Map<string, typeof rawAttempts>();
    const academicGradesByStudentId = new Map<string, typeof rawAcademicGrades>();
    const taskGradesByStudentId = new Map<string, typeof rawTaskGrades>();
    const attendanceByStudentId = new Map<string, typeof rawAttendanceRecords>();

    for (const attempt of rawAttempts) {
      const studentId = normalizeText(attempt.studentId);
      attemptsByStudentId.set(studentId, [
        ...(attemptsByStudentId.get(studentId) ?? []),
        attempt,
      ]);
    }

    for (const grade of rawAcademicGrades) {
      const studentId = normalizeText(grade.studentId);
      academicGradesByStudentId.set(studentId, [
        ...(academicGradesByStudentId.get(studentId) ?? []),
        grade,
      ]);
    }

    for (const grade of rawTaskGrades) {
      const studentId = normalizeText(grade.studentId);
      taskGradesByStudentId.set(studentId, [
        ...(taskGradesByStudentId.get(studentId) ?? []),
        grade,
      ]);
    }

    for (const record of rawAttendanceRecords) {
      const studentId = normalizeText(record.studentId);
      attendanceByStudentId.set(studentId, [
        ...(attendanceByStudentId.get(studentId) ?? []),
        record,
      ]);
    }

    const rows = filteredStudents
      .map((student) => {
        const studentId = normalizeText(student.studentId);
        const studentUser = resolveStudentUser(student, usersById);
        const studentName = normalizeText(studentUser?.nama);
        const isUtbk = isUtbkStudent(student);
        const classNames = getStudentMonitoringClassNames(student);

        if (!studentName) {
          return null;
        }

        const materials = rawMaterials.filter((material) =>
          matchesStudentClassContent(material, student, classNames),
        );
        const tasks = isUtbk
          ? []
          : rawTasks.filter((task) =>
              matchesStudentClassContent(task, student, classNames),
            );
        const taskById = new Map(tasks.map((t) => [normalizeText(t.taskId), t]));
        const taskIds = new Set(
          tasks.map((task) => normalizeText(task.taskId)).filter(Boolean),
        );
        const taskGrades = (taskGradesByStudentId.get(studentId) ?? []).filter(
          (grade) =>
            normalizeText(grade.status) === "Sudah Dinilai" &&
            (!taskIds.size || taskIds.has(normalizeText(grade.taskId))),
        );
        const academicGrades = academicGradesByStudentId.get(studentId) ?? [];
        const attendanceRecords = attendanceByStudentId.get(studentId) ?? [];
        const presentAttendanceCount = attendanceRecords.filter(
          (record) => normalizeText(record.status) === "Hadir",
        ).length;
        const attendanceTotal = attendanceRecords.length;
        const attendanceRate = attendanceTotal
          ? Math.round((presentAttendanceCount / attendanceTotal) * 100)
          : null;
        const attempts = [
          ...(attemptsByStudentId.get(studentId) ?? []),
        ].sort(
          (left, right) =>
            toMonitoringDateOrder(right.submittedAt ?? right.updatedAt) -
            toMonitoringDateOrder(left.submittedAt ?? left.updatedAt),
        );
        const attemptsWithTryouts = attempts
          .map((attempt) => {
            const tryout = tryoutById.get(normalizeText(attempt.tryoutId));
            const stage = normalizeUtbkMainTryoutStage(tryout?.stage);

            return tryout
              ? {
                  attempt,
                  tryout,
                  stage,
                }
              : null;
          })
          .filter(
            (
              item,
            ): item is {
              attempt: (typeof attempts)[number];
              tryout: (typeof tryouts)[number];
              stage: UtbkMainTryoutStage | null;
            } => item !== null,
          );
        const stageProgress = UTBK_MAIN_TRYOUT_STAGES.map((stageMeta) => {
          const stageAttempts = attemptsWithTryouts
            .filter((item) => item.stage === stageMeta.stage)
            .sort(
              (left, right) =>
                toMonitoringDateOrder(
                  right.attempt.submittedAt ?? right.attempt.updatedAt,
                ) -
                toMonitoringDateOrder(
                  left.attempt.submittedAt ?? left.attempt.updatedAt,
                ),
            );
          const latestStageAttempt = stageAttempts[0] ?? null;

          return {
            stage: stageMeta.stage,
            label: stageMeta.label,
            shortLabel: stageMeta.shortLabel,
            status: latestStageAttempt ? "Selesai" : "Belum Dikerjakan",
            score:
              typeof latestStageAttempt?.attempt.score === "number"
                ? latestStageAttempt.attempt.score
                : null,
            submittedAt: latestStageAttempt
              ? toIsoString(
                  latestStageAttempt.attempt.submittedAt ??
                    latestStageAttempt.attempt.updatedAt,
                )
              : null,
            tryoutId: normalizeText(latestStageAttempt?.attempt.tryoutId),
            title: normalizeText(latestStageAttempt?.tryout.title),
            subject: normalizeText(latestStageAttempt?.tryout.subject),
          };
        });
        const completedMainTryoutCount = isUtbk
          ? stageProgress.filter((stage) => stage.status === "Selesai").length
          : 0;
        const tryoutScoreEntries: ScoreEntry[] = attempts.flatMap((attempt) => {
          if (typeof attempt.score !== "number" || !Number.isFinite(attempt.score)) {
            return [];
          }

          return [
            {
              score: attempt.score,
              label: "Tryout",
              subject: normalizeText(
                tryoutById.get(normalizeText(attempt.tryoutId))?.subject,
              ),
              date: attempt.submittedAt ?? attempt.updatedAt,
            },
          ];
        });
        const taskScoreEntries: ScoreEntry[] = taskGrades.map((grade) => {
          const task = taskById.get(normalizeText(grade.taskId));
          return {
            score: grade.score,
            label: task?.title ? normalizeText(task.title) : "Latihan CBT",
            subject: "",
            date: grade.gradedAt ?? grade.updatedAt ?? grade.createdAt,
          };
        });
        
        const scoreEntries: ScoreEntry[] = [
          ...tryoutScoreEntries,
          ...taskScoreEntries,
        ].sort(
          (left, right) =>
            toMonitoringDateOrder(right.date) - toMonitoringDateOrder(left.date),
        );
        const scores = scoreEntries.map((entry) => entry.score);
        const latestScoreEntry = scoreEntries[0] ?? null;
        const latestAttempt = attempts[0] ?? null;
        const latestTryout = latestAttempt
          ? tryoutById.get(normalizeText(latestAttempt.tryoutId)) ?? null
          : null;
        const latestStageMeta = getUtbkMainTryoutStageMeta(latestTryout?.stage);
        const bestScore = scores.length ? Math.max(...scores) : null;
        const learningStatus = getMonitoringStatus({
          attendanceTotal,
          materialCount: materials.length,
          taskCount: tasks.length,
          gradedTaskCount: taskGrades.length,
        });

        return {
          id: toRecordId(student._id) || studentId,
          studentId,
          name: studentName,
          email: normalizeText(studentUser?.email),
          loginCode: normalizeText(studentUser?.loginCode),
          branch: normalizeText(student.branch),
          program: normalizeText(student.program),
          programLabel: getProgramLabel(student),
          className: normalizeText(student.className),
          isUtbk,
          track: normalizeText(student.utbkTrack) || "Program SNBT",
          targetKampus: normalizeText(student.targetKampus),
          targetJurusan: normalizeText(student.targetJurusan),
          materialCount: materials.length,
          taskCount: tasks.length,
          gradedTaskCount: taskGrades.length,
          attendanceTotal,
          attendancePresent: presentAttendanceCount,
          attendanceRate,
          scoreCount: scores.length,
          latestScore: latestScoreEntry?.score ?? null,
          latestScoreLabel: latestScoreEntry?.label ?? "",
          latestScoreAt: toIsoString(latestScoreEntry?.date),
          bestScore,
          averageScore: average(scores),
          learningStatus,
          mainTryoutTotal: UTBK_MAIN_TRYOUT_STAGES.length,
          completedMainTryoutCount,
          completedTryoutCount: completedMainTryoutCount,
          rawSubmittedTryoutCount: attempts.length,
          stageProgress: isUtbk ? stageProgress : [],
          latestTryout:
            isUtbk && latestAttempt
              ? {
                  attemptId: normalizeText(latestAttempt.attemptId),
                  tryoutId: normalizeText(latestAttempt.tryoutId),
                  title: normalizeText(latestTryout?.title) || "Tryout UTBK",
                  subject: normalizeText(latestTryout?.subject),
                  stage:
                    typeof latestTryout?.stage === "number"
                      ? latestTryout.stage
                      : null,
                  label: latestStageMeta?.label ?? "Tryout UTBK",
                  shortLabel: latestStageMeta?.shortLabel ?? "Tryout",
                  submittedAt: toIsoString(
                    latestAttempt.submittedAt ?? latestAttempt.updatedAt,
                  ),
                  correctCount: latestAttempt.correctCount ?? 0,
                  wrongCount: latestAttempt.wrongCount ?? 0,
                  unansweredCount: latestAttempt.unansweredCount ?? 0,
                  timeUsedSeconds: latestAttempt.timeUsedSeconds ?? 0,
                }
              : null,
        };
      })
      .filter((row) => row !== null)
      .filter((row) => matchesMonitoringStatusFilter(row.learningStatus, statusFilter));
    const latestScores = rows
      .map((row) => row.latestScore)
      .filter(
        (score): score is number =>
          typeof score === "number" && Number.isFinite(score),
      );
    const bestScores = rows
      .map((row) => row.bestScore)
      .filter(
        (score): score is number =>
          typeof score === "number" && Number.isFinite(score),
      );
    const monitoredStudents = rows.filter(
      (row) => row.learningStatus !== "Belum Ada Data",
    ).length;
    const monitoringPercent = rows.length
      ? Math.round((monitoredStudents / rows.length) * 100)
      : 0;

    sendSuccess(res, {
      message: "Monitoring akademik berhasil diambil.",
      data: {
        summary: {
          totalStudents: rows.length,
          monitoredStudents,
          assessedStudents: rows.filter((row) => row.scoreCount > 0).length,
          regularStudents: rows.filter((row) => !row.isUtbk).length,
          utbkStudents: rows.filter((row) => row.isUtbk).length,
          totalMaterials: rows.reduce((total, row) => total + row.materialCount, 0),
          totalTasks: rows.reduce((total, row) => total + row.taskCount, 0),
          totalAttendanceRecords: rows.reduce(
            (total, row) => total + row.attendanceTotal,
            0,
          ),
          totalExpectedTryouts:
            rows.filter((row) => row.isUtbk).length *
            UTBK_MAIN_TRYOUT_STAGES.length,
          totalCompletedTryouts: rows.reduce(
            (total, row) => total + row.completedTryoutCount,
            0,
          ),
          averageLatestScore: average(latestScores),
          averageBestScore: average(bestScores),
          monitoringPercent,
        },
        students: rows,
      },
    });
  },
);

export const getAdminUtbkAssessments = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const scope = await resolveAdminBranchScope(req.user);
    const branchFilter = normalizeText(req.query.branch as string | undefined);
    const searchTokens = normalizeText(req.query.q as string | undefined)
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    const students = (await Student.find({ status: "Aktif" })
      .select(
        "_id studentId userId branch program className utbkTrack targetKampus targetJurusan status",
      )
      .populate({
        path: "userId",
        select: "nama email loginCode",
      })
      .sort({ createdAt: -1 })
      .lean()
      .exec()) as PopulatedStudent[];
    const scopedStudents = students.filter((student) => {
      if (!isUtbkStudent(student)) {
        return false;
      }

      if (!matchesBranchScope(student.branch, scope, branchFilter)) {
        return false;
      }

      return true;
    });
    const usersById = await getStudentUsersById(scopedStudents);
    const filteredStudents = scopedStudents.filter((student) => {
      const studentUser = resolveStudentUser(student, usersById);

      if (!normalizeText(studentUser?.nama)) {
        return false;
      }

      if (!searchTokens.length) {
        return true;
      }

      const searchableText = [
        student.studentId,
        studentUser?.nama,
        studentUser?.email,
        studentUser?.loginCode,
        student.branch,
        student.utbkTrack,
        student.targetKampus,
        student.targetJurusan,
      ]
        .map((item) => normalizeText(item))
        .join(" ")
        .toLowerCase();

      return searchTokens.every((token) => searchableText.includes(token));
    });
    const studentIds = filteredStudents
      .map((student) => normalizeText(student.studentId))
      .filter(Boolean);
    const rawAttempts = studentIds.length
      ? await StudentTryoutAttempt.find({
          studentId: {
            $in: studentIds,
          },
          status: "submitted",
        })
          .select(
            "attemptId tryoutId studentId branch score correctCount wrongCount unansweredCount timeUsedSeconds submittedAt updatedAt",
          )
          .sort({ submittedAt: -1, updatedAt: -1 })
          .lean()
          .exec()
      : [];
    const tryoutIds = Array.from(
      new Set(rawAttempts.map((attempt) => normalizeText(attempt.tryoutId))),
    ).filter(Boolean);
    const tryouts = tryoutIds.length
      ? await TeacherTryout.find({
          tryoutId: {
            $in: tryoutIds,
          },
          assessmentType: "Tryout",
        })
          .select("tryoutId title subject stage branch startAt endAt")
          .lean()
          .exec()
      : [];
    const tryoutById = new Map(
      tryouts.map((tryout) => [normalizeText(tryout.tryoutId), tryout] as const),
    );
    const attemptsByStudentId = new Map<string, typeof rawAttempts>();

    for (const attempt of rawAttempts) {
      const tryout = tryoutById.get(normalizeText(attempt.tryoutId));

      if (!tryout) {
        continue;
      }

      const studentId = normalizeText(attempt.studentId);
      const attempts = attemptsByStudentId.get(studentId) ?? [];
      attempts.push(attempt);
      attemptsByStudentId.set(studentId, attempts);
    }

    const rows = filteredStudents
      .map((student) => {
        const studentUser = resolveStudentUser(student, usersById);
        const studentName = normalizeText(studentUser?.nama);
        const attempts = [
          ...(attemptsByStudentId.get(normalizeText(student.studentId)) ?? []),
        ].sort(
          (left, right) =>
            getAttemptDateOrder(right.submittedAt ?? right.updatedAt) -
            getAttemptDateOrder(left.submittedAt ?? left.updatedAt),
        );
        const attemptsWithTryouts = attempts
          .map((attempt) => {
            const tryout = tryoutById.get(normalizeText(attempt.tryoutId));
            const stage = normalizeUtbkMainTryoutStage(tryout?.stage);

            return tryout
              ? {
                  attempt,
                  tryout,
                  stage,
                }
              : null;
          })
          .filter(
            (
              item,
            ): item is {
              attempt: (typeof attempts)[number];
              tryout: (typeof tryouts)[number];
              stage: UtbkMainTryoutStage | null;
            } => item !== null,
          );
        const scores = attempts
          .map((attempt) => attempt.score)
          .filter(
            (score): score is number =>
              typeof score === "number" && Number.isFinite(score),
          );
        const latestAttempt = attempts[0] ?? null;
        const latestTryout = latestAttempt
          ? tryoutById.get(normalizeText(latestAttempt.tryoutId)) ?? null
          : null;
        const latestScore =
          typeof latestAttempt?.score === "number" ? latestAttempt.score : null;
        const bestScore = scores.length ? Math.max(...scores) : null;
        const stageProgress = UTBK_MAIN_TRYOUT_STAGES.map((stageMeta) => {
          const stageAttempts = attemptsWithTryouts
            .filter((item) => item.stage === stageMeta.stage)
            .sort(
              (left, right) =>
                getAttemptDateOrder(
                  right.attempt.submittedAt ?? right.attempt.updatedAt,
                ) -
                getAttemptDateOrder(
                  left.attempt.submittedAt ?? left.attempt.updatedAt,
                ),
            );
          const latestStageAttempt = stageAttempts[0] ?? null;

          return {
            stage: stageMeta.stage,
            label: stageMeta.label,
            shortLabel: stageMeta.shortLabel,
            status: latestStageAttempt ? "Selesai" : "Belum Dikerjakan",
            score:
              typeof latestStageAttempt?.attempt.score === "number"
                ? latestStageAttempt.attempt.score
                : null,
            submittedAt: latestStageAttempt
              ? toIsoString(
                  latestStageAttempt.attempt.submittedAt ??
                    latestStageAttempt.attempt.updatedAt,
                )
              : null,
            tryoutId: normalizeText(latestStageAttempt?.attempt.tryoutId),
            title: normalizeText(latestStageAttempt?.tryout.title),
            subject: normalizeText(latestStageAttempt?.tryout.subject),
          };
        });
        const completedMainTryoutCount = stageProgress.filter(
          (stage) => stage.status === "Selesai",
        ).length;
        const latestStageMeta = getUtbkMainTryoutStageMeta(latestTryout?.stage);

        if (!studentName) {
          return null;
        }

        return {
          id: toRecordId(student._id) || normalizeText(student.studentId),
          studentId: normalizeText(student.studentId),
          name: studentName,
          email: normalizeText(studentUser?.email),
          loginCode: normalizeText(studentUser?.loginCode),
          branch: normalizeText(student.branch),
          track: normalizeText(student.utbkTrack) || "Program SNBT",
          targetKampus: normalizeText(student.targetKampus),
          targetJurusan: normalizeText(student.targetJurusan),
          mainTryoutTotal: UTBK_MAIN_TRYOUT_STAGES.length,
          completedMainTryoutCount,
          completedTryoutCount: completedMainTryoutCount,
          rawSubmittedTryoutCount: attempts.length,
          stageProgress,
          latestScore,
          bestScore,
          averageScore: average(scores),
          readinessStatus: getReadinessStatus(bestScore, completedMainTryoutCount),
          latestTryout: latestAttempt
            ? {
                attemptId: normalizeText(latestAttempt.attemptId),
                tryoutId: normalizeText(latestAttempt.tryoutId),
                title: normalizeText(latestTryout?.title) || "Tryout UTBK",
                subject: normalizeText(latestTryout?.subject),
                stage:
                  typeof latestTryout?.stage === "number"
                    ? latestTryout.stage
                    : null,
                label: latestStageMeta?.label ?? "Tryout UTBK",
                shortLabel: latestStageMeta?.shortLabel ?? "Tryout",
                submittedAt: toIsoString(
                  latestAttempt.submittedAt ?? latestAttempt.updatedAt,
                ),
                correctCount: latestAttempt.correctCount ?? 0,
                wrongCount: latestAttempt.wrongCount ?? 0,
                unansweredCount: latestAttempt.unansweredCount ?? 0,
                timeUsedSeconds: latestAttempt.timeUsedSeconds ?? 0,
              }
            : null,
        };
      })
      .filter((row) => row !== null);
    const latestScores = rows
      .map((row) => row.latestScore)
      .filter(
        (score): score is number =>
          typeof score === "number" && Number.isFinite(score),
      );
    const bestScores = rows
      .map((row) => row.bestScore)
      .filter(
        (score): score is number =>
          typeof score === "number" && Number.isFinite(score),
      );

    sendSuccess(res, {
      message: "Ringkasan penilaian UTBK berhasil diambil.",
      data: {
        summary: {
          totalStudents: rows.length,
          assessedStudents: rows.filter((row) => row.completedTryoutCount > 0).length,
          totalExpectedTryouts: rows.length * UTBK_MAIN_TRYOUT_STAGES.length,
          totalCompletedTryouts: rows.reduce(
            (total, row) => total + row.completedTryoutCount,
            0,
          ),
          averageLatestScore: average(latestScores),
          averageBestScore: average(bestScores),
        },
        students: rows,
      },
    });
  },
);
