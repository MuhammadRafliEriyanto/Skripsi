import type { NextFunction, Request, Response } from "express";
import { Types, type FilterQuery } from "mongoose";

import { AssessmentQuestionSet } from "../models/AssessmentQuestionSet";
import { Student } from "../models/Student";
import { Schedule } from "../models/Schedule";
import { StudentTryoutAttempt } from "../models/StudentTryoutAttempt";
import { Subscription } from "../models/Subscription";
import { Teacher } from "../models/Teacher";
import {
  TeacherTryout,
  TEACHER_ASSESSMENT_TYPES,
  TEACHER_TRYOUT_JENJANG,
  TEACHER_TRYOUT_PUBLISH_STATUSES,
  TEACHER_TRYOUT_QUESTION_SOURCES,
  type ITeacherTryout,
  type TeacherAssessmentType,
  type TeacherTryoutDocument,
  type TeacherTryoutJenjang,
  type TeacherTryoutPublishStatus,
  type TeacherTryoutQuestionSource,
} from "../models/TeacherTryout";
import {
  TeacherTryoutQuestion,
  TEACHER_TRYOUT_QUESTION_ANSWERS,
  type TeacherTryoutQuestionAnswer,
  type TeacherTryoutQuestionDocument,
} from "../models/TeacherTryoutQuestion";
import { User } from "../models/User";
import asyncHandler from "../utils/asyncHandler";
import { AppError, sendSuccess } from "../utils/apiResponse";
import {
  areAssessmentSubjectsEquivalent,
  canonicalizeAssessmentSubject,
} from "../utils/assessmentSubject";
import { getNextPublicId } from "../utils/publicId";
import { parseTryoutXlsxBuffer } from "../utils/tryoutXlsxParser";
import { normalizeCanonicalClassName } from "../utils/studentClass";
import { normalizeUtbkScheduleClassName } from "../utils/studentProgram";
import {
  buildStableTeacherClassId,
  getTeacherBranchNames,
} from "../utils/teacherClassIdentity";
import {
  type AcademicPeriod,
  isAcademicPeriodEditable,
  resolveAcademicPeriodFromQuery,
} from "../utils/academicGrade";
import { ensureTeacherAcademicPeriodEditable } from "../utils/teacherAcademicArchive";
import { buildTeacherAcademicPeriodOrLegacyFilter } from "../utils/teacherAcademicPeriod";
import {
  getStudentEffectiveAcademicJoinedAt,
  isStudentAcademicTryoutAvailable,
  parseValidDate,
} from "../utils/studentAcademicStatus";
import {
  findActiveSubscriptionIdsForAcademicRecords,
} from "../utils/subscription";

type TryoutMutationBody = {
  assessmentType?: string;
  classId?: string;
  branch?: string;
  canonicalClassName?: string;
  title?: string;
  jenjang?: string;
  kelas?: string;
  subject?: string;
  stage?: number | string;
  durationMinutes?: number | string;
  startAt?: string;
  endAt?: string;
  publishStatus?: string;
  questionSource?: string;
  questionCount?: number | string;
  questionBankId?: string;
  fileName?: string;
};

type TryoutQuestionMutationBody = {
  questionText?: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  correctAnswer?: string;
  order?: number | string;
};

type TryoutQuestionXlsxUploadBody = {
  fileName?: string;
  fileDataBase64?: string;
};

type ResolvedTeacherTryoutPayload = {
  classId: string;
  branch: string;
  canonicalClassName: string;
  assessmentType: TeacherAssessmentType;
  title: string;
  jenjang: TeacherTryoutJenjang;
  kelas: string;
  subject: string;
  stage: number | null;
  durationMinutes: number;
  startAt: Date;
  endAt: Date;
  publishStatus: TeacherTryoutPublishStatus;
  questionSource: TeacherTryoutQuestionSource;
  questionCount: number;
  questionBankId: string | null;
  fileName: string | null;
};

type ResolvedTeacherTryoutQuestionPayload = {
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: TeacherTryoutQuestionAnswer;
  order: number | null;
};

const FINAL_CLASS_BY_JENJANG: Record<TeacherTryoutJenjang, string> = {
  SD: "Kelas 6",
  SMP: "Kelas 9",
  SMA: "Kelas 12",
};
const XLSX_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
const DRAFT_ONLY_QUESTION_MESSAGE =
  "Soal hanya dapat diubah saat ujian masih berstatus draft.";

function normalizeText(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toRecordId(value: unknown): string {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object" && "toString" in value) {
    const recordId = value.toString();
    return typeof recordId === "string" ? recordId : "";
  }

  return "";
}

function normalizeJenjang(value: string | undefined): TeacherTryoutJenjang | null {
  const normalizedValue = normalizeText(value).toUpperCase();

  return TEACHER_TRYOUT_JENJANG.find((item) => item === normalizedValue) ?? null;
}

function normalizeAssessmentType(
  value: string | undefined,
): TeacherAssessmentType | null {
  const normalizedValue = normalizeText(value).toLowerCase();

  return (
    TEACHER_ASSESSMENT_TYPES.find(
      (item) => item.toLowerCase() === normalizedValue,
    ) ?? null
  );
}

function getGradeFromCanonicalClassName(className: string) {
  return Number(className.match(/\b(\d{1,2})\b/)?.[1] ?? 0);
}

function isFinalAssessmentClass(className: string) {
  return [6, 9, 12].includes(getGradeFromCanonicalClassName(className));
}

function normalizeAssessmentClassName(value: string | null | undefined) {
  return (
    normalizeUtbkScheduleClassName(value) ||
    normalizeCanonicalClassName(value) ||
    ""
  );
}

function normalizePublishStatus(
  value: string | undefined,
): TeacherTryoutPublishStatus | null {
  const normalizedValue = normalizeText(value).toLowerCase();

  return (
    TEACHER_TRYOUT_PUBLISH_STATUSES.find((item) => item === normalizedValue) ??
    null
  );
}

function normalizeQuestionSource(
  value: string | undefined,
): TeacherTryoutQuestionSource | null {
  const normalizedValue = normalizeText(value).toLowerCase();

  return (
    TEACHER_TRYOUT_QUESTION_SOURCES.find((item) => item === normalizedValue) ??
    null
  );
}

function normalizePositiveInteger(
  value: number | string | undefined,
  options: {
    min?: number;
    fallback?: number | null;
  } = {},
) {
  if (value === undefined) {
    return options.fallback ?? null;
  }

  const parsedValue =
    typeof value === "number"
      ? value
      : Number.parseInt(normalizeText(value), 10);

  if (!Number.isInteger(parsedValue)) {
    return null;
  }

  if (typeof options.min === "number" && parsedValue < options.min) {
    return null;
  }

  return parsedValue;
}

function parseDateValue(
  value: string | undefined,
  fallback: Date | null = null,
) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return fallback;
  }

  const parsedDate = new Date(normalizedValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
}

function decodeXlsxUploadBody(body: TryoutQuestionXlsxUploadBody) {
  const fileName = normalizeText(body.fileName);
  const fileDataBase64 = normalizeText(body.fileDataBase64);

  if (!fileName) {
    throw new AppError(400, "Nama file XLSX wajib dikirim.");
  }

  if (!/\.(xlsx|xls)$/i.test(fileName)) {
    throw new AppError(400, "File soal wajib berformat .xlsx atau .xls.");
  }

  if (!fileDataBase64) {
    throw new AppError(400, "Data file XLSX wajib dikirim.");
  }

  const normalizedBase64 = fileDataBase64.includes(",")
    ? fileDataBase64.slice(fileDataBase64.indexOf(",") + 1)
    : fileDataBase64;
  const buffer = Buffer.from(normalizedBase64, "base64");

  if (!buffer.length) {
    throw new AppError(400, "File XLSX tidak valid atau kosong.");
  }

  if (buffer.length > XLSX_UPLOAD_MAX_BYTES) {
    throw new AppError(400, "Ukuran file XLSX maksimal 5 MB.");
  }

  return {
    fileName,
    buffer,
  };
}

function buildSequentialPublicId(prefix: string, number: number) {
  return `${prefix}-${String(number).padStart(3, "0")}`;
}

async function getTeacherProfileByUserId(userId: string) {
  return Teacher.findOne({ userId }).exec();
}

async function findTeacherTryoutByParam(
  tryoutParam: string,
  teacherId: string,
  period?: AcademicPeriod,
) {
  const identityFilter = {
    $or: [
      { tryoutId: tryoutParam },
      ...(Types.ObjectId.isValid(tryoutParam) ? [{ _id: tryoutParam }] : []),
    ],
  };
  const periodFilter = period
    ? buildTeacherAcademicPeriodOrLegacyFilter(period)
    : null;

  return TeacherTryout.findOne({
    teacherId,
    $and: periodFilter ? [identityFilter, periodFilter] : [identityFilter],
  }).exec();
}

async function findTeacherTryoutQuestionByParam(
  questionParam: string,
  teacherId: string,
  tryoutId: string,
) {
  return TeacherTryoutQuestion.findOne({
    teacherId,
    tryoutId,
    $or: [
      { questionId: questionParam },
      ...(Types.ObjectId.isValid(questionParam) ? [{ _id: questionParam }] : []),
    ],
  }).exec();
}

function normalizeCorrectAnswer(
  value: string | undefined,
): TeacherTryoutQuestionAnswer | null {
  const normalizedValue = normalizeText(value).toUpperCase();

  return (
    TEACHER_TRYOUT_QUESTION_ANSWERS.find((item) => item === normalizedValue) ??
    null
  );
}

function toPublicTeacherTryout(tryout: TeacherTryoutDocument) {
  return {
    id: toRecordId(tryout._id) || normalizeText(tryout.tryoutId),
    tryoutId: normalizeText(tryout.tryoutId),
    classId: normalizeText(tryout.classId),
    branch: normalizeText(tryout.branch),
    canonicalClassName: normalizeText(tryout.canonicalClassName),
    assessmentType: tryout.assessmentType ?? "Tryout",
    title: normalizeText(tryout.title),
    jenjang: tryout.jenjang,
    kelas: normalizeText(tryout.kelas),
    subject: normalizeText(tryout.subject),
    stage:
      typeof tryout.stage === "number" && Number.isFinite(tryout.stage)
        ? tryout.stage
        : null,
    durationMinutes:
      typeof tryout.durationMinutes === "number" && Number.isFinite(tryout.durationMinutes)
        ? tryout.durationMinutes
        : 0,
    startAt: tryout.startAt?.toISOString() ?? null,
    endAt: tryout.endAt?.toISOString() ?? null,
    publishStatus: tryout.publishStatus,
    reviewStatus: tryout.reviewStatus,
    questionSource: tryout.questionSource,
    questionCount:
      typeof tryout.questionCount === "number" && Number.isFinite(tryout.questionCount)
        ? tryout.questionCount
        : 0,
    questionBankId: normalizeText(tryout.questionBankId) || null,
    questionSetId: normalizeText(tryout.questionSetId) || null,
    packageId: normalizeText(tryout.packageId) || null,
    fileName: normalizeText(tryout.fileName) || null,
    createdAt: tryout.createdAt?.toISOString() ?? null,
    updatedAt: tryout.updatedAt?.toISOString() ?? null,
  };
}

function toPublicTeacherTryoutQuestion(question: TeacherTryoutQuestionDocument) {
  return {
    id: toRecordId(question._id) || normalizeText(question.questionId),
    questionId: normalizeText(question.questionId),
    tryoutId: normalizeText(question.tryoutId),
    questionText: normalizeText(question.questionText),
    optionA: normalizeText(question.optionA),
    optionB: normalizeText(question.optionB),
    optionC: normalizeText(question.optionC),
    optionD: normalizeText(question.optionD),
    correctAnswer: question.correctAnswer,
    order:
      typeof question.order === "number" && Number.isFinite(question.order)
        ? question.order
        : 0,
    createdAt: question.createdAt?.toISOString() ?? null,
    updatedAt: question.updatedAt?.toISOString() ?? null,
  };
}

function toPublicAssessmentTeacherTryoutQuestion(question: {
  questionId?: string;
  number?: number;
  question?: string;
  options?: {
    A?: string;
    B?: string;
    C?: string;
    D?: string;
  };
  correctAnswer?: string;
}) {
  return {
    id: normalizeText(question.questionId),
    questionId: normalizeText(question.questionId),
    questionText: normalizeText(question.question),
    optionA: normalizeText(question.options?.A),
    optionB: normalizeText(question.options?.B),
    optionC: normalizeText(question.options?.C),
    optionD: normalizeText(question.options?.D),
    correctAnswer: normalizeText(question.correctAnswer).toUpperCase(),
    order:
      typeof question.number === "number" && Number.isFinite(question.number)
        ? question.number
        : 0,
    createdAt: null,
    updatedAt: null,
  };
}

function getTryoutResultStatus(score: number) {
  if (score >= 85) {
    return "Sangat Baik";
  }

  if (score >= 70) {
    return "Baik";
  }

  return "Perlu Bimbingan";
}

async function ensureTeacherTeachesClass(input: {
  teacherObjectId: string;
  branch: string;
  canonicalClassName: string;
}) {
  const normalizedTargetClassName = normalizeAssessmentClassName(
    input.canonicalClassName,
  );
  const schedules = await Schedule.find({
    teacherId: input.teacherObjectId,
    branch: new RegExp(`^${escapeRegex(input.branch)}$`, "i"),
  })
    .select("className branch")
    .lean()
    .exec();
  const matchedSchedule = schedules.find(
    (schedule) =>
      normalizeAssessmentClassName(schedule.className) ===
      normalizedTargetClassName,
  );

  if (!matchedSchedule) {
    throw new AppError(
      403,
      "Kelas target tidak termasuk kelas yang diajar guru ini.",
    );
  }
}

async function resolveTeacherTryoutPayload(
  body: TryoutMutationBody,
  teacher: {
    _id: unknown;
    teacherId: string;
    branch: string;
    branches?: string[];
    subject: string;
  },
  currentTryout?: TeacherTryoutDocument | null,
): Promise<ResolvedTeacherTryoutPayload> {
  const requestedUtbkClassName =
    normalizeUtbkScheduleClassName(body.canonicalClassName) ||
    normalizeUtbkScheduleClassName(body.kelas) ||
    normalizeUtbkScheduleClassName(currentTryout?.canonicalClassName) ||
    normalizeUtbkScheduleClassName(currentTryout?.kelas);
  const nextJenjang =
    normalizeJenjang(body.jenjang) ??
    currentTryout?.jenjang ??
    (requestedUtbkClassName ? "SMA" : null);

  if (!nextJenjang) {
    throw new AppError(400, "Jenjang assessment wajib diisi.");
  }

  const normalizedKelas = normalizeText(body.kelas);
  const nextKelas =
    requestedUtbkClassName ||
    normalizedKelas ||
    (currentTryout && currentTryout.jenjang === nextJenjang
      ? normalizeText(currentTryout.kelas)
      : FINAL_CLASS_BY_JENJANG[nextJenjang]);

  const teacherBranches = getTeacherBranchNames(teacher);
  const requestedBranch =
    normalizeText(body.branch) || normalizeText(currentTryout?.branch);
  const nextBranch = teacherBranches.find(
    (branch) => branch.toLowerCase() === requestedBranch.toLowerCase(),
  );

  if (!requestedBranch) {
    throw new AppError(400, "Cabang target tryout wajib dipilih.");
  }

  if (!nextBranch) {
    throw new AppError(403, "Cabang target tidak termasuk cabang guru ini.");
  }

  const canonicalClassName =
    requestedUtbkClassName ||
    normalizeCanonicalClassName(`${nextJenjang} ${nextKelas}`);

  if (!canonicalClassName) {
    throw new AppError(400, "Kelas target assessment tidak valid.");
  }

  const nextAssessmentType =
    normalizeAssessmentType(body.assessmentType) ??
    currentTryout?.assessmentType ??
    "Tryout";
  const isUtbkClass = Boolean(requestedUtbkClassName);
  const isFinalClass = isUtbkClass || isFinalAssessmentClass(canonicalClassName);

  if (isUtbkClass && nextAssessmentType !== "Tryout") {
    throw new AppError(400, "Program UTBK menggunakan jenis ujian Tryout.");
  }

  if (nextAssessmentType === "Tryout" && !isFinalClass) {
    throw new AppError(
      400,
      "Tryout hanya bisa dibuat untuk kelas akhir: SD 6, SMP 9, SMA 12, atau program UTBK.",
    );
  }

  if (
    (nextAssessmentType === "UTS" || nextAssessmentType === "UAS") &&
    isFinalClass
  ) {
    throw new AppError(
      400,
      "Kelas akhir menggunakan Tryout. UTS/UAS hanya untuk kelas non-akhir.",
    );
  }

  await ensureTeacherTeachesClass({
    teacherObjectId: toRecordId(teacher._id),
    branch: nextBranch,
    canonicalClassName,
  });

  const classId = buildStableTeacherClassId(
    teacher.teacherId,
    nextBranch,
    canonicalClassName,
  );

  const nextTitle = normalizeText(body.title) || normalizeText(currentTryout?.title);

  if (!nextTitle) {
    throw new AppError(400, "Judul tryout wajib diisi.");
  }

  const nextSubject = canonicalizeAssessmentSubject(teacher.subject);

  if (!nextSubject) {
    throw new AppError(400, "Mata pelajaran guru belum diatur.");
  }

  const nextStage =
    nextAssessmentType === "Tryout"
      ? normalizePositiveInteger(body.stage, {
          min: 1,
          fallback:
            typeof currentTryout?.stage === "number"
              ? currentTryout.stage
              : 1,
        })
      : null;

  if (nextAssessmentType === "Tryout" && (nextStage ?? 0) > 3) {
    throw new AppError(400, "Tahap tryout hanya boleh Tryout 1 sampai 3.");
  }

  const nextDurationMinutes = normalizePositiveInteger(body.durationMinutes, {
    min: 15,
    fallback:
      typeof currentTryout?.durationMinutes === "number"
        ? currentTryout.durationMinutes
        : null,
  });

  if (nextDurationMinutes === null) {
    throw new AppError(400, "Durasi tryout minimal 15 menit.");
  }

  const nextStartAt = parseDateValue(body.startAt, currentTryout?.startAt ?? null);

  if (!nextStartAt) {
    throw new AppError(400, "Waktu mulai tryout wajib diisi.");
  }

  const nextEndAt = parseDateValue(body.endAt, currentTryout?.endAt ?? null);

  if (!nextEndAt) {
    throw new AppError(400, "Waktu selesai tryout wajib diisi.");
  }

  if (nextEndAt.getTime() <= nextStartAt.getTime()) {
    throw new AppError(400, "Waktu selesai tryout harus lebih besar dari waktu mulai.");
  }

  const nextPublishStatus =
    normalizePublishStatus(body.publishStatus) ??
    currentTryout?.publishStatus ??
    "draft";
  const nextQuestionSource =
    normalizeQuestionSource(body.questionSource) ??
    currentTryout?.questionSource ??
    "manual";
  const nextQuestionCount = currentTryout
    ? await TeacherTryoutQuestion.countDocuments({
        teacherId: toRecordId(teacher._id),
        tryoutId: currentTryout.tryoutId,
      }).exec()
    : 0;

  if (
    currentTryout &&
    currentTryout.publishStatus !== "draft" &&
    nextQuestionSource !== currentTryout.questionSource
  ) {
    throw new AppError(403, DRAFT_ONLY_QUESTION_MESSAGE);
  }

  if (nextPublishStatus === "published") {
    if (!nextTitle) {
      throw new AppError(400, "Judul ujian wajib diisi sebelum publish.");
    }

    if (!canonicalClassName) {
      throw new AppError(400, "Kelas ujian wajib diisi sebelum publish.");
    }

    if (!nextSubject) {
      throw new AppError(400, "Mata pelajaran wajib diisi sebelum publish.");
    }

    if (nextDurationMinutes <= 0) {
      throw new AppError(400, "Durasi ujian harus lebih dari 0 menit.");
    }

    if (nextQuestionCount < 1) {
      throw new AppError(
        400,
        "Soal belum tersedia. Tambahkan minimal 1 soal sebelum publish.",
      );
    }
  }

  const nextQuestionBankId =
    nextQuestionSource === "bank"
      ? normalizeText(body.questionBankId) ||
        normalizeText(currentTryout?.questionBankId) ||
        null
      : null;
  const nextFileName =
    nextQuestionSource === "file"
      ? normalizeText(body.fileName) || normalizeText(currentTryout?.fileName) || null
      : null;

  return {
    classId,
    branch: nextBranch,
    canonicalClassName,
    assessmentType: nextAssessmentType,
    title: nextTitle,
    jenjang: nextJenjang,
    kelas: nextKelas,
    subject: nextSubject,
    stage: nextStage,
    durationMinutes: nextDurationMinutes,
    startAt: nextStartAt,
    endAt: nextEndAt,
    publishStatus: nextPublishStatus,
    questionSource: nextQuestionSource,
    questionCount: nextQuestionCount,
    questionBankId: nextQuestionBankId,
    fileName: nextFileName,
  };
}

function resolveTeacherTryoutQuestionPayload(
  body: TryoutQuestionMutationBody,
  currentQuestion?: TeacherTryoutQuestionDocument | null,
): ResolvedTeacherTryoutQuestionPayload {
  const questionText =
    normalizeText(body.questionText) || normalizeText(currentQuestion?.questionText);

  if (!questionText) {
    throw new AppError(400, "Pertanyaan tryout wajib diisi.");
  }

  const optionA = normalizeText(body.optionA) || normalizeText(currentQuestion?.optionA);
  const optionB = normalizeText(body.optionB) || normalizeText(currentQuestion?.optionB);
  const optionC = normalizeText(body.optionC) || normalizeText(currentQuestion?.optionC);
  const optionD = normalizeText(body.optionD) || normalizeText(currentQuestion?.optionD);

  if (!optionA || !optionB || !optionC || !optionD) {
    throw new AppError(400, "Seluruh opsi jawaban tryout wajib diisi.");
  }

  const correctAnswer =
    normalizeCorrectAnswer(body.correctAnswer) ??
    currentQuestion?.correctAnswer ??
    null;

  if (!correctAnswer) {
    throw new AppError(400, "Jawaban benar tryout wajib diisi.");
  }

  const order = normalizePositiveInteger(body.order, {
    min: 1,
    fallback:
      typeof currentQuestion?.order === "number" ? currentQuestion.order : null,
  });

  if (body.order !== undefined && order === null) {
    throw new AppError(400, "Urutan soal tryout wajib berupa angka 1 atau lebih.");
  }

  return {
    questionText,
    optionA,
    optionB,
    optionC,
    optionD,
    correctAnswer,
    order,
  };
}

async function getNextTeacherTryoutQuestionOrder(
  teacherId: string,
  tryoutId: string,
) {
  const latestQuestion = await TeacherTryoutQuestion.findOne({
    teacherId,
    tryoutId,
  })
    .sort({ order: -1, createdAt: -1 })
    .select("order")
    .lean()
    .exec();

  return typeof latestQuestion?.order === "number" ? latestQuestion.order + 1 : 1;
}

async function normalizeTeacherTryoutQuestionOrders(
  teacherId: string | Types.ObjectId,
  tryoutId: string,
) {
  const questions = await TeacherTryoutQuestion.find({
    teacherId,
    tryoutId,
  })
    .sort({ order: 1, createdAt: 1 })
    .exec();

  const bulkOperations = questions
    .map((question, index) => {
      const nextOrder = index + 1;

      if (question.order === nextOrder) {
        return null;
      }

      question.order = nextOrder;

      return {
        updateOne: {
          filter: { _id: question._id },
          update: {
            $set: {
              order: nextOrder,
            },
          },
        },
      };
    })
    .filter(
      (
        operation,
      ): operation is {
        updateOne: {
          filter: { _id: Types.ObjectId };
          update: { $set: { order: number } };
        };
      } => operation !== null,
    );

  if (bulkOperations.length > 0) {
    await TeacherTryoutQuestion.bulkWrite(bulkOperations);
  }

  return questions;
}

async function reorderTeacherTryoutQuestion(
  question: TeacherTryoutQuestionDocument,
  targetOrder: number,
) {
  const questions = await TeacherTryoutQuestion.find({
    teacherId: question.teacherId,
    tryoutId: question.tryoutId,
  })
    .sort({ order: 1, createdAt: 1 })
    .exec();

  const currentQuestionId = toRecordId(question._id);
  const currentIndex = questions.findIndex(
    (item) => toRecordId(item._id) === currentQuestionId,
  );

  if (currentIndex === -1) {
    return question;
  }

  const [movingQuestion] = questions.splice(currentIndex, 1);
  const targetIndex = Math.min(
    Math.max(targetOrder - 1, 0),
    questions.length,
  );

  questions.splice(targetIndex, 0, movingQuestion);

  const bulkOperations = questions
    .map((item, index) => {
      const nextOrder = index + 1;

      if (item.order === nextOrder) {
        return null;
      }

      item.order = nextOrder;

      return {
        updateOne: {
          filter: { _id: item._id },
          update: {
            $set: {
              order: nextOrder,
            },
          },
        },
      };
    })
    .filter(
      (
        operation,
      ): operation is {
        updateOne: {
          filter: { _id: Types.ObjectId };
          update: { $set: { order: number } };
        };
      } => operation !== null,
    );

  if (bulkOperations.length > 0) {
    await TeacherTryoutQuestion.bulkWrite(bulkOperations);
  }

  question.order = movingQuestion.order;

  return question;
}

async function syncTeacherTryoutQuestionCount(tryout: TeacherTryoutDocument) {
  const nextQuestionCount = await TeacherTryoutQuestion.countDocuments({
    teacherId: tryout.teacherId,
    tryoutId: tryout.tryoutId,
  }).exec();

  const shouldDowngradePublishStatus =
    tryout.questionSource === "manual" &&
    nextQuestionCount === 0 &&
    tryout.publishStatus === "published";

  if (
    tryout.questionCount !== nextQuestionCount ||
    shouldDowngradePublishStatus
  ) {
    tryout.questionCount = nextQuestionCount;

    if (shouldDowngradePublishStatus) {
      tryout.publishStatus = "draft";
    }

    await tryout.save();
  }

  return nextQuestionCount;
}

function ensureManualTeacherTryout(tryout: TeacherTryoutDocument) {
  if (tryout.questionSource !== "manual") {
    throw new AppError(
      400,
      "Tryout ini tidak menggunakan soal manual.",
    );
  }
}

function ensureDraftTeacherTryout(tryout: TeacherTryoutDocument) {
  if (tryout.publishStatus !== "draft") {
    throw new AppError(403, DRAFT_ONLY_QUESTION_MESSAGE);
  }
}

export const getMyTeacherTryouts = asyncHandler(
  async (_req: Request, res: Response, next: NextFunction) => {
    if (!_req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const teacher = await getTeacherProfileByUserId(_req.user._id.toString());

    if (!teacher) {
      next(new AppError(404, "Profil guru tidak ditemukan."));
      return;
    }

    const { academicYear, semester } = resolveAcademicPeriodFromQuery(_req.query);
    const filter: FilterQuery<ITeacherTryout> = {
      $and: [
        { teacherId: teacher._id },
        buildTeacherAcademicPeriodOrLegacyFilter({ academicYear, semester }),
      ],
    };

    const tryouts = await TeacherTryout.find(filter)
      .sort({ startAt: 1, createdAt: -1 })
      .exec();

    sendSuccess(res, {
      message: "Data tryout guru berhasil diambil.",
      data: {
        tryouts: tryouts.map(toPublicTeacherTryout),
      },
    });
  },
);

export const createMyTeacherTryout = asyncHandler(
  async (
    req: Request<Record<string, never>, Record<string, never>, TryoutMutationBody>,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    if (!ensureTeacherAcademicPeriodEditable(req, next)) {
      return;
    }

    const teacher = await getTeacherProfileByUserId(req.user._id.toString());

    if (!teacher) {
      next(new AppError(404, "Profil guru tidak ditemukan."));
      return;
    }

    const payload = await resolveTeacherTryoutPayload(req.body, teacher);
    const tryoutId = await getNextPublicId(TeacherTryout, "tryoutId", "TO");
    const period = resolveAcademicPeriodFromQuery(req.query);
    const tryout = await TeacherTryout.create({
      teacherId: teacher._id,
      tryoutId,
      academicYear: period.academicYear,
      semester: period.semester,
      ...payload,
    });

    sendSuccess(res, {
      statusCode: 201,
      message: "Tryout guru berhasil disimpan.",
      data: {
        tryout: toPublicTeacherTryout(tryout),
      },
    });
  },
);

export const getMyTeacherTryoutDetail = asyncHandler(
  async (
    req: Request<{ tryoutId: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const teacher = await getTeacherProfileByUserId(req.user._id.toString());

    if (!teacher) {
      next(new AppError(404, "Profil guru tidak ditemukan."));
      return;
    }

    const tryoutParam = normalizeText(req.params.tryoutId);

    if (!tryoutParam) {
      next(new AppError(404, "Tryout guru tidak ditemukan."));
      return;
    }

    const period = resolveAcademicPeriodFromQuery(req.query);
    const tryout = await findTeacherTryoutByParam(
      tryoutParam,
      teacher._id.toString(),
      period,
    );

    if (!tryout) {
      next(new AppError(404, "Tryout guru tidak ditemukan."));
      return;
    }

    sendSuccess(res, {
      message: "Detail tryout guru berhasil diambil.",
      data: {
        tryout: toPublicTeacherTryout(tryout),
      },
    });
  },
);

export const updateMyTeacherTryout = asyncHandler(
  async (
    req: Request<{ tryoutId: string }, Record<string, never>, TryoutMutationBody>,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    if (!ensureTeacherAcademicPeriodEditable(req, next)) {
      return;
    }

    const teacher = await getTeacherProfileByUserId(req.user._id.toString());

    if (!teacher) {
      next(new AppError(404, "Profil guru tidak ditemukan."));
      return;
    }

    const tryoutParam = normalizeText(req.params.tryoutId);

    if (!tryoutParam) {
      next(new AppError(404, "Tryout guru tidak ditemukan."));
      return;
    }

    const period = resolveAcademicPeriodFromQuery(req.query);
    const tryout = await findTeacherTryoutByParam(
      tryoutParam,
      teacher._id.toString(),
      period,
    );

    if (!tryout) {
      next(new AppError(404, "Tryout guru tidak ditemukan."));
      return;
    }

    const payload = await resolveTeacherTryoutPayload(req.body, teacher, tryout);

    tryout.classId = payload.classId;
    tryout.branch = payload.branch;
    tryout.canonicalClassName = payload.canonicalClassName;
    tryout.assessmentType = payload.assessmentType;
    tryout.title = payload.title;
    tryout.jenjang = payload.jenjang;
    tryout.kelas = payload.kelas;
    tryout.subject = payload.subject;
    tryout.stage = payload.stage;
    tryout.durationMinutes = payload.durationMinutes;
    tryout.startAt = payload.startAt;
    tryout.endAt = payload.endAt;
    tryout.publishStatus = payload.publishStatus;
    tryout.questionSource = payload.questionSource;
    tryout.questionCount = payload.questionCount;
    tryout.questionBankId = payload.questionBankId;
    tryout.fileName = payload.fileName;
    await tryout.save();

    sendSuccess(res, {
      message: "Tryout guru berhasil diperbarui.",
      data: {
        tryout: toPublicTeacherTryout(tryout),
      },
    });
  },
);

export const deleteMyTeacherTryout = asyncHandler(
  async (
    req: Request<{ tryoutId: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    if (!ensureTeacherAcademicPeriodEditable(req, next)) {
      return;
    }

    const teacher = await getTeacherProfileByUserId(req.user._id.toString());

    if (!teacher) {
      next(new AppError(404, "Profil guru tidak ditemukan."));
      return;
    }

    const tryoutParam = normalizeText(req.params.tryoutId);

    if (!tryoutParam) {
      next(new AppError(404, "Tryout guru tidak ditemukan."));
      return;
    }

    const period = resolveAcademicPeriodFromQuery(req.query);
    const tryout = await findTeacherTryoutByParam(
      tryoutParam,
      teacher._id.toString(),
      period,
    );

    if (!tryout) {
      next(new AppError(404, "Tryout guru tidak ditemukan."));
      return;
    }

    if (tryout.publishStatus !== "draft") {
      next(
        new AppError(
          403,
          "Ujian hanya dapat dihapus saat masih berstatus draft.",
        ),
      );
      return;
    }

    // if (hasStudentAttempt) {
    //   next(
    //     new AppError(
    //       403,
    //       "Ujian tidak dapat dihapus karena sudah memiliki attempt siswa.",
    //     ),
    //   );
    //   return;
    // }

    await TeacherTryoutQuestion.deleteMany({
      teacherId: teacher._id,
      tryoutId: tryout.tryoutId,
    }).exec();
    await StudentTryoutAttempt.deleteMany({
      teacherId: teacher._id,
      tryoutId: tryout.tryoutId,
    }).exec();
    await tryout.deleteOne();

    sendSuccess(res, {
      message: "Tryout guru berhasil dihapus.",
    });
  },
);

export const getMyTeacherTryoutQuestions = asyncHandler(
  async (
    req: Request<{ tryoutId: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const teacher = await getTeacherProfileByUserId(req.user._id.toString());

    if (!teacher) {
      next(new AppError(404, "Profil guru tidak ditemukan."));
      return;
    }

    const tryoutParam = normalizeText(req.params.tryoutId);

    if (!tryoutParam) {
      next(new AppError(404, "Tryout guru tidak ditemukan."));
      return;
    }

    const period = resolveAcademicPeriodFromQuery(req.query);
    const tryout = await findTeacherTryoutByParam(
      tryoutParam,
      teacher._id.toString(),
      period,
    );

    if (!tryout) {
      next(new AppError(404, "Tryout guru tidak ditemukan."));
      return;
    }

    if (tryout.questionSource === "bank") {
      const questionSetId =
        normalizeText(tryout.questionSetId) ||
        normalizeText(tryout.questionBankId);

      if (!questionSetId) {
        next(new AppError(404, "Bank soal tryout belum terhubung."));
        return;
      }

      const questionSet = await AssessmentQuestionSet.findOne({
        questionSetId,
        assessmentType: "Tryout",
      }).exec();

      if (!questionSet) {
        next(new AppError(404, "Bank soal tryout tidak ditemukan."));
        return;
      }

      const nextQuestionCount = questionSet.questions.length;

      if (
        isAcademicPeriodEditable(req.query) &&
        tryout.questionCount !== nextQuestionCount
      ) {
        tryout.questionCount = nextQuestionCount;
        await tryout.save();
      }

      sendSuccess(res, {
        message: "Daftar soal bank tryout guru berhasil diambil.",
        data: {
          tryout: toPublicTeacherTryout(tryout),
          questions: questionSet.questions.map(
            toPublicAssessmentTeacherTryoutQuestion,
          ),
        },
      });
      return;
    }

    if (tryout.questionSource !== "manual" && tryout.questionSource !== "file") {
      next(new AppError(400, "Sumber soal tryout belum didukung."));
      return;
    }

    if (isAcademicPeriodEditable(req.query)) {
      await syncTeacherTryoutQuestionCount(tryout);
    }

    const questions = await TeacherTryoutQuestion.find({
      teacherId: teacher._id,
      tryoutId: tryout.tryoutId,
    })
      .sort({ order: 1, createdAt: 1 })
      .exec();

    sendSuccess(res, {
      message: "Daftar soal tryout guru berhasil diambil.",
      data: {
        tryout: toPublicTeacherTryout(tryout),
        questions: questions.map(toPublicTeacherTryoutQuestion),
      },
    });
  },
);

export const getMyTeacherTryoutResults = asyncHandler(
  async (
    req: Request<{ tryoutId: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const teacher = await getTeacherProfileByUserId(req.user._id.toString());

    if (!teacher) {
      next(new AppError(404, "Profil guru tidak ditemukan."));
      return;
    }

    const tryoutParam = normalizeText(req.params.tryoutId);

    if (!tryoutParam) {
      next(new AppError(404, "Tryout guru tidak ditemukan."));
      return;
    }

    const period = resolveAcademicPeriodFromQuery(req.query);
    const tryout = await findTeacherTryoutByParam(
      tryoutParam,
      teacher._id.toString(),
      period,
    );

    if (!tryout) {
      next(new AppError(404, "Tryout guru tidak ditemukan."));
      return;
    }

    const rawAttempts = await StudentTryoutAttempt.find({
      teacherId: teacher._id,
      tryoutId: tryout.tryoutId,
      status: "submitted",
    })
      .sort({ submittedAt: -1, updatedAt: -1 })
      .lean()
      .exec();
    const studentIds = Array.from(
      new Set(rawAttempts.map((attempt) => normalizeText(attempt.studentId))),
    ).filter(Boolean);
    const activeSubscriptionIds =
      await findActiveSubscriptionIdsForAcademicRecords({
        publicStudentIds: studentIds,
      });
    const activeSubscriptionIdSet = new Set(
      activeSubscriptionIds.map(toRecordId).filter(Boolean),
    );
    const attempts = rawAttempts.filter((attempt) => {
      const attemptSubscriptionId = toRecordId(attempt.subscriptionId);

      if (!attemptSubscriptionId) {
        return true;
      }

      return activeSubscriptionIdSet.has(attemptSubscriptionId);
    });
    const students = studentIds.length
      ? await Student.find({
          studentId: {
            $in: studentIds,
          },
        })
          .select("studentId userId academicJoinedAt")
          .lean()
          .exec()
      : [];
    const studentObjectIds = students
      .map((student) => student._id?.toString() ?? "")
      .filter(Boolean);
    const paidSubscriptions = studentObjectIds.length
      ? await Subscription.find({
          studentId: {
            $in: studentObjectIds,
          },
          paymentStatus: "paid",
          startDate: {
            $ne: null,
          },
        })
          .select("_id studentId startDate endDate paymentStatus")
          .sort({ startDate: 1, createdAt: 1 })
          .lean()
          .exec()
      : [];
    const now = Date.now();
    const fallbackPaidSubscriptionByStudentObjectId = new Map<
      string,
      { startDate?: Date | string | null; paymentStatus?: string | null }
    >();
    const paidSubscriptionByStudentObjectId = new Map<
      string,
      { startDate?: Date | string | null; paymentStatus?: string | null }
    >();

    for (const subscription of paidSubscriptions) {
      const studentObjectId = subscription.studentId?.toString() ?? "";

      if (!studentObjectId) {
        continue;
      }

      if (!fallbackPaidSubscriptionByStudentObjectId.has(studentObjectId)) {
        fallbackPaidSubscriptionByStudentObjectId.set(studentObjectId, subscription);
      }

      const startAt = parseValidDate(subscription.startDate);
      const endAt = parseValidDate(subscription.endDate);

      if (
        startAt &&
        endAt &&
        startAt.getTime() <= now &&
        endAt.getTime() > now &&
        !paidSubscriptionByStudentObjectId.has(studentObjectId)
      ) {
        paidSubscriptionByStudentObjectId.set(studentObjectId, subscription);
      }
    }
    const academicJoinedAtByStudentId = new Map<string, Date>();

    for (const student of students) {
      const academicJoinedAt = getStudentEffectiveAcademicJoinedAt(
        student,
        paidSubscriptionByStudentObjectId.get(student._id?.toString() ?? "") ??
          fallbackPaidSubscriptionByStudentObjectId.get(student._id?.toString() ?? ""),
      );

      if (!academicJoinedAt) {
        continue;
      }

      academicJoinedAtByStudentId.set(
        normalizeText(student.studentId).toLowerCase(),
        academicJoinedAt,
      );
    }
    // Bypass filter langganan akademik agar semua hasil (termasuk untuk testing) selalu muncul di dashboard guru
    const visibleAttempts = rawAttempts;
    const userIds = students
      .map((student) => toRecordId(student.userId))
      .filter(Boolean);
    const users = userIds.length
      ? await User.find({
          _id: {
            $in: userIds,
          },
        })
          .select("nama")
          .lean()
          .exec()
      : [];
    const nameByUserId = new Map(
      users.map((user) => [toRecordId(user._id), normalizeText(user.nama)]),
    );
    const nameByStudentId = new Map(
      students.map((student) => [
        normalizeText(student.studentId),
        nameByUserId.get(toRecordId(student.userId)) ||
          normalizeText(student.studentId),
      ]),
    );

    sendSuccess(res, {
      message: "Hasil tryout siswa berhasil diambil.",
      data: {
        tryout: toPublicTeacherTryout(tryout),
        results: visibleAttempts.map((attempt) => {
          const score =
            typeof attempt.score === "number" && Number.isFinite(attempt.score)
              ? attempt.score
              : 0;

          return {
            id: normalizeText(attempt.attemptId) || toRecordId(attempt._id),
            attemptId: normalizeText(attempt.attemptId),
            studentId: normalizeText(attempt.studentId),
            namaSiswa:
              nameByStudentId.get(normalizeText(attempt.studentId)) ||
              normalizeText(attempt.studentId) ||
              "Siswa",
            benar:
              typeof attempt.correctCount === "number"
                ? attempt.correctCount
                : 0,
            salah:
              typeof attempt.wrongCount === "number" ? attempt.wrongCount : 0,
            belumDijawab:
              typeof attempt.unansweredCount === "number"
                ? attempt.unansweredCount
                : 0,
            nilai: score,
            score,
            status: getTryoutResultStatus(score),
            submittedAt: attempt.submittedAt?.toISOString() ?? null,
            timeUsedSeconds:
              typeof attempt.timeUsedSeconds === "number"
                ? attempt.timeUsedSeconds
                : 0,
          };
        }),
      },
    });
  },
);

export const uploadMyTeacherTryoutQuestionsFromXlsx = asyncHandler(
  async (
    req: Request<
      { tryoutId: string },
      Record<string, never>,
      TryoutQuestionXlsxUploadBody
    >,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    if (!ensureTeacherAcademicPeriodEditable(req, next)) {
      return;
    }

    const teacher = await getTeacherProfileByUserId(req.user._id.toString());

    if (!teacher) {
      next(new AppError(404, "Profil guru tidak ditemukan."));
      return;
    }

    const tryoutParam = normalizeText(req.params.tryoutId);

    if (!tryoutParam) {
      next(new AppError(404, "Tryout guru tidak ditemukan."));
      return;
    }

    const period = resolveAcademicPeriodFromQuery(req.query);
    const tryout = await findTeacherTryoutByParam(
      tryoutParam,
      teacher._id.toString(),
      period,
    );

    if (!tryout) {
      next(new AppError(404, "Tryout guru tidak ditemukan."));
      return;
    }

    ensureDraftTeacherTryout(tryout);

    const upload = decodeXlsxUploadBody(req.body);
    const parsedUpload = parseTryoutXlsxBuffer(upload.buffer);
    const parsedQuestions = parsedUpload.questions;
    const metadataAssessmentType = normalizeAssessmentType(
      parsedUpload.metadata?.assessmentType,
    );

    if (
      metadataAssessmentType &&
      metadataAssessmentType !== (tryout.assessmentType ?? "Tryout")
    ) {
      throw new AppError(
        400,
        `Metadata XLSX bertipe ${metadataAssessmentType}, tetapi assessment ini bertipe ${tryout.assessmentType ?? "Tryout"}.`,
      );
    }

    const metadataSubject = normalizeText(parsedUpload.metadata?.subject);

    if (
      metadataSubject &&
      !areAssessmentSubjectsEquivalent(metadataSubject, teacher.subject)
    ) {
      throw new AppError(
        400,
        `Mapel metadata XLSX (${metadataSubject}) tidak sesuai dengan mapel guru yang login (${normalizeText(teacher.subject)}).`,
      );
    }

    let metadataClassScope: {
      jenjang: TeacherTryoutJenjang;
      kelas: string;
      canonicalClassName: string;
      classId: string;
    } | null = null;

    if (parsedUpload.metadata?.className) {
      const metadataRawClassName = normalizeText(parsedUpload.metadata.className);
      const metadataUtbkClassName =
        normalizeUtbkScheduleClassName(metadataRawClassName);
      const canonicalClassName =
        metadataUtbkClassName ||
        normalizeCanonicalClassName(metadataRawClassName);

      if (!canonicalClassName) {
        throw new AppError(
          400,
          "Metadata kelas XLSX tidak valid.",
        );
      }

      let jenjang: TeacherTryoutJenjang;
      let kelas: string;

      if (metadataUtbkClassName) {
        jenjang = "SMA";
        kelas = metadataUtbkClassName;
      } else {
        const [metadataJenjang, grade] = canonicalClassName.split(" ");

        if (
          metadataJenjang !== "SD" &&
          metadataJenjang !== "SMP" &&
          metadataJenjang !== "SMA"
        ) {
          throw new AppError(
            400,
            "Metadata kelas XLSX tidak valid.",
          );
        }

        jenjang = metadataJenjang;
        kelas = `Kelas ${grade}`;
      }

      const metadataIsFinalClass =
        Boolean(metadataUtbkClassName) ||
        isFinalAssessmentClass(canonicalClassName);

      if ((tryout.assessmentType ?? "Tryout") === "Tryout" && !metadataIsFinalClass) {
        throw new AppError(
          400,
          "Metadata kelas XLSX bukan kelas akhir atau program UTBK untuk Tryout.",
        );
      }

      if ((tryout.assessmentType ?? "Tryout") !== "Tryout" && metadataIsFinalClass) {
        throw new AppError(
          400,
          "Metadata kelas XLSX adalah kelas akhir atau program UTBK. UTS/UAS hanya untuk kelas non-akhir.",
        );
      }

      if (!normalizeText(tryout.branch)) {
        throw new AppError(
          400,
          "Cabang target wajib diatur sebelum upload XLSX.",
        );
      }

      await ensureTeacherTeachesClass({
        teacherObjectId: toRecordId(teacher._id),
        branch: tryout.branch,
        canonicalClassName,
      });

      metadataClassScope = {
        jenjang,
        kelas,
        canonicalClassName,
        classId: buildStableTeacherClassId(
          teacher.teacherId,
          tryout.branch,
          canonicalClassName,
        ),
      };
    }

    const firstQuestionId = await getNextPublicId(
      TeacherTryoutQuestion,
      "questionId",
      "TQ",
    );
    const firstQuestionNumber = Number(
      firstQuestionId.replace(/\D/g, "") || "1",
    );

    await TeacherTryoutQuestion.deleteMany({
      teacherId: teacher._id,
      tryoutId: tryout.tryoutId,
    }).exec();

    const questions = await TeacherTryoutQuestion.create(
      parsedQuestions.map((question, index) => ({
        questionId: buildSequentialPublicId(
          "TQ",
          firstQuestionNumber + index,
        ),
        teacherId: teacher._id,
        tryoutId: tryout.tryoutId,
        questionText: question.questionText,
        optionA: question.optionA,
        optionB: question.optionB,
        optionC: question.optionC,
        optionD: question.optionD,
        correctAnswer: question.correctAnswer,
        order: index + 1,
      })),
    );

    tryout.questionSource = "file";
    tryout.fileName = upload.fileName;
    tryout.questionBankId = null;
    tryout.questionSetId = parsedUpload.metadata?.questionSetId || null;
    tryout.packageId = null;
    tryout.questionCount = questions.length;

    if (metadataClassScope) {
      tryout.jenjang = metadataClassScope.jenjang;
      tryout.kelas = metadataClassScope.kelas;
      tryout.canonicalClassName = metadataClassScope.canonicalClassName;
      tryout.classId = metadataClassScope.classId;
    }

    tryout.subject = canonicalizeAssessmentSubject(teacher.subject);

    const metadataStage = parsedUpload.metadata?.stage;

    if (
      (tryout.assessmentType ?? "Tryout") === "Tryout" &&
      (metadataStage === 1 || metadataStage === 2 || metadataStage === 3)
    ) {
      tryout.stage = metadataStage;
    } else if ((tryout.assessmentType ?? "Tryout") !== "Tryout") {
      tryout.stage = null;
    }

    await tryout.save();

    sendSuccess(res, {
      message: parsedUpload.metadata?.className
        ? `File XLSX berhasil diproses untuk ${parsedUpload.metadata.className}.`
        : "File XLSX berhasil diproses menjadi soal tryout.",
      data: {
        tryout: toPublicTeacherTryout(tryout),
        questions: questions.map(toPublicTeacherTryoutQuestion),
        parsedCount: questions.length,
        metadata: parsedUpload.metadata,
      },
    });
  },
);

export const createMyTeacherTryoutQuestion = asyncHandler(
  async (
    req: Request<{ tryoutId: string }, Record<string, never>, TryoutQuestionMutationBody>,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    if (!ensureTeacherAcademicPeriodEditable(req, next)) {
      return;
    }

    const teacher = await getTeacherProfileByUserId(req.user._id.toString());

    if (!teacher) {
      next(new AppError(404, "Profil guru tidak ditemukan."));
      return;
    }

    const tryoutParam = normalizeText(req.params.tryoutId);

    if (!tryoutParam) {
      next(new AppError(404, "Tryout guru tidak ditemukan."));
      return;
    }

    const period = resolveAcademicPeriodFromQuery(req.query);
    const tryout = await findTeacherTryoutByParam(
      tryoutParam,
      teacher._id.toString(),
      period,
    );

    if (!tryout) {
      next(new AppError(404, "Tryout guru tidak ditemukan."));
      return;
    }

    ensureDraftTeacherTryout(tryout);
    ensureManualTeacherTryout(tryout);

    const payload = resolveTeacherTryoutQuestionPayload(req.body);
    const questionId = await getNextPublicId(
      TeacherTryoutQuestion,
      "questionId",
      "TQ",
    );
    const nextOrder = await getNextTeacherTryoutQuestionOrder(
      teacher._id.toString(),
      tryout.tryoutId,
    );
    const question = await TeacherTryoutQuestion.create({
      questionId,
      teacherId: teacher._id,
      tryoutId: tryout.tryoutId,
      questionText: payload.questionText,
      optionA: payload.optionA,
      optionB: payload.optionB,
      optionC: payload.optionC,
      optionD: payload.optionD,
      correctAnswer: payload.correctAnswer,
      order: nextOrder,
    });

    if (payload.order !== null && payload.order !== nextOrder) {
      await reorderTeacherTryoutQuestion(question, payload.order);
    }

    await syncTeacherTryoutQuestionCount(tryout);

    sendSuccess(res, {
      statusCode: 201,
      message: "Soal tryout guru berhasil disimpan.",
      data: {
        tryout: toPublicTeacherTryout(tryout),
        question: toPublicTeacherTryoutQuestion(question),
      },
    });
  },
);

export const updateMyTeacherTryoutQuestion = asyncHandler(
  async (
    req: Request<
      { tryoutId: string; questionId: string },
      Record<string, never>,
      TryoutQuestionMutationBody
    >,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    if (!ensureTeacherAcademicPeriodEditable(req, next)) {
      return;
    }

    const teacher = await getTeacherProfileByUserId(req.user._id.toString());

    if (!teacher) {
      next(new AppError(404, "Profil guru tidak ditemukan."));
      return;
    }

    const tryoutParam = normalizeText(req.params.tryoutId);

    if (!tryoutParam) {
      next(new AppError(404, "Tryout guru tidak ditemukan."));
      return;
    }

    const period = resolveAcademicPeriodFromQuery(req.query);
    const tryout = await findTeacherTryoutByParam(
      tryoutParam,
      teacher._id.toString(),
      period,
    );

    if (!tryout) {
      next(new AppError(404, "Tryout guru tidak ditemukan."));
      return;
    }

    ensureDraftTeacherTryout(tryout);
    ensureManualTeacherTryout(tryout);

    const questionParam = normalizeText(req.params.questionId);

    if (!questionParam) {
      next(new AppError(404, "Soal tryout guru tidak ditemukan."));
      return;
    }

    const question = await findTeacherTryoutQuestionByParam(
      questionParam,
      teacher._id.toString(),
      tryout.tryoutId,
    );

    if (!question) {
      next(new AppError(404, "Soal tryout guru tidak ditemukan."));
      return;
    }

    const payload = resolveTeacherTryoutQuestionPayload(req.body, question);
    const currentOrder = question.order;

    question.questionText = payload.questionText;
    question.optionA = payload.optionA;
    question.optionB = payload.optionB;
    question.optionC = payload.optionC;
    question.optionD = payload.optionD;
    question.correctAnswer = payload.correctAnswer;
    await question.save();

    if (payload.order !== null && payload.order !== currentOrder) {
      await reorderTeacherTryoutQuestion(question, payload.order);
    }

    sendSuccess(res, {
      message: "Soal tryout guru berhasil diperbarui.",
      data: {
        tryout: toPublicTeacherTryout(tryout),
        question: toPublicTeacherTryoutQuestion(question),
      },
    });
  },
);

export const deleteMyTeacherTryoutQuestion = asyncHandler(
  async (
    req: Request<{ tryoutId: string; questionId: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    if (!ensureTeacherAcademicPeriodEditable(req, next)) {
      return;
    }

    const teacher = await getTeacherProfileByUserId(req.user._id.toString());

    if (!teacher) {
      next(new AppError(404, "Profil guru tidak ditemukan."));
      return;
    }

    const tryoutParam = normalizeText(req.params.tryoutId);

    if (!tryoutParam) {
      next(new AppError(404, "Tryout guru tidak ditemukan."));
      return;
    }

    const period = resolveAcademicPeriodFromQuery(req.query);
    const tryout = await findTeacherTryoutByParam(
      tryoutParam,
      teacher._id.toString(),
      period,
    );

    if (!tryout) {
      next(new AppError(404, "Tryout guru tidak ditemukan."));
      return;
    }

    ensureDraftTeacherTryout(tryout);
    ensureManualTeacherTryout(tryout);

    const questionParam = normalizeText(req.params.questionId);

    if (!questionParam) {
      next(new AppError(404, "Soal tryout guru tidak ditemukan."));
      return;
    }

    const question = await findTeacherTryoutQuestionByParam(
      questionParam,
      teacher._id.toString(),
      tryout.tryoutId,
    );

    if (!question) {
      next(new AppError(404, "Soal tryout guru tidak ditemukan."));
      return;
    }

    await question.deleteOne();
    await normalizeTeacherTryoutQuestionOrders(
      teacher._id,
      tryout.tryoutId,
    );
    await syncTeacherTryoutQuestionCount(tryout);

    sendSuccess(res, {
      message: "Soal tryout guru berhasil dihapus.",
      data: {
        tryout: toPublicTeacherTryout(tryout),
      },
    });
  },
);
