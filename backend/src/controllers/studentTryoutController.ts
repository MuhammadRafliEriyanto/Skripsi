import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "crypto";
import { Types } from "mongoose";

import { AcademicGrade } from "../models/AcademicGrade";
import {
  AssessmentQuestionSet,
  type AssessmentCorrectAnswer,
  type IAssessmentQuestionItem,
  type IAssessmentQuestionOption,
} from "../models/AssessmentQuestionSet";
import { type StudentDocument } from "../models/Student";
import { Teacher } from "../models/Teacher";
import {
  StudentTryoutAttempt,
  type StudentTryoutAttemptDocument,
  type StudentTryoutSelectedAnswer,
} from "../models/StudentTryoutAttempt";
import {
  TeacherTryout,
  TEACHER_ASSESSMENT_TYPES,
  type TeacherTryoutDocument,
} from "../models/TeacherTryout";
import { TeacherTryoutQuestion } from "../models/TeacherTryoutQuestion";
import {
  getAcademicGradeScheme,
  getCurrentAcademicPeriod,
  toPublicAcademicGrade,
} from "../utils/academicGrade";
import asyncHandler from "../utils/asyncHandler";
import { AppError, sendSuccess } from "../utils/apiResponse";
import { normalizeText } from "../utils/classroomLearning";
import { normalizeCanonicalClassName } from "../utils/studentClass";
import {
  buildStableTeacherClassId,
  getTeacherBranchNames,
} from "../utils/teacherClassIdentity";
import {
  buildAcademicRecordSubscriptionFilter,
  getMembershipSnapshotByUserId,
  type StudentWithUser,
} from "../utils/subscription";
import { resolveStudentAcademicContentAccess } from "../utils/studentAcademicAccess";
import { resolveStudentMembershipContentAccess } from "../utils/studentMembershipAccess";
import {
  buildStudentAcademicTryoutFilter,
  getStudentEffectiveAcademicJoinedAt,
  parseValidDate,
} from "../utils/studentAcademicStatus";
import {
  getUtbkScheduleClassNames,
  isUtbkStudent,
} from "../utils/studentProgram";

const OPTION_KEYS = ["A", "B", "C", "D"] as const;
const SUBMISSION_GRACE_SECONDS = 5;

type StudentTryoutSubmissionBody = {
  answers?: Array<{
    questionId?: string;
    selectedAnswer?: string;
    optionId?: string;
    answer?: string;
  }>;
  timeUsedSeconds?: number | string;
};

type NormalizedTryoutQuestion = {
  questionId: string;
  number: number;
  section: string;
  topic: string;
  difficulty: string;
  question: string;
  options: IAssessmentQuestionOption;
  correctAnswer: AssessmentCorrectAnswer;
  explanation: string;
};

type StudentTryoutAcademicContext = {
  student: StudentDocument;
  academicJoinedAt: Date;
  subscriptionId: Types.ObjectId | null;
  subscriptionStartAt: Date;
};

function toPublicStudentTryoutProfile(
  student: StudentWithUser,
  accessStatus: string,
) {
  return {
    id: student.studentId,
    name: student.userId.nama,
    branch: normalizeText(student.branch),
    program: normalizeText(student.program),
    className: normalizeText(student.className),
    utbkTrack: normalizeText(student.utbkTrack),
    targetKampus: normalizeText(student.targetKampus),
    targetJurusan: normalizeText(student.targetJurusan),
    status: student.status,
    accessStatus,
  };
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

function normalizeSelectedAnswer(
  value: string | undefined,
): StudentTryoutSelectedAnswer {
  const normalizedValue = normalizeText(value).toUpperCase();

  return OPTION_KEYS.find((item) => item === normalizedValue) ?? "";
}

function normalizeNonNegativeInteger(value: number | string | undefined) {
  if (value === undefined || value === null) {
    return 0;
  }

  const parsedValue =
    typeof value === "number"
      ? value
      : Number.parseInt(normalizeText(value), 10);

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    return 0;
  }

  return Math.round(parsedValue);
}

async function getAuthenticatedStudentTryoutContextOrThrow(
  userId: string,
): Promise<StudentTryoutAcademicContext> {
  const membershipSnapshot = await getMembershipSnapshotByUserId(userId);
  const student = membershipSnapshot.student;

  if (!student || student.status !== "Aktif") {
    throw new AppError(404, "Profil siswa tidak ditemukan.");
  }

  const membershipAccess = resolveStudentMembershipContentAccess(
    membershipSnapshot.accessStatus,
    {
      subscription: membershipSnapshot.subscription,
      payment: membershipSnapshot.payment,
    },
  );

  if (membershipAccess.isMembershipLocked) {
    throw new AppError(
      403,
      membershipAccess.message ?? "Membership siswa belum aktif.",
      { membershipAccess },
      "MEMBERSHIP_ACCESS_REQUIRED",
    );
  }

  const academicJoinedAt = getStudentEffectiveAcademicJoinedAt(
    student,
    membershipSnapshot.subscription,
  );

  if (!academicJoinedAt) {
    throw new AppError(
      403,
      "Akses akademik siswa belum aktif.",
      { membershipAccess },
      "ACADEMIC_ACCESS_REQUIRED",
    );
  }

  return {
    student,
    academicJoinedAt,
    subscriptionId: membershipSnapshot.subscription?._id ?? null,
    subscriptionStartAt:
      parseValidDate(membershipSnapshot.subscription?.startDate) ?? academicJoinedAt,
  };
}

function getStudentCanonicalClassName(student: StudentDocument) {
  return (
    normalizeCanonicalClassName(student.className) ??
    normalizeText(student.className)
  );
}

function getStudentTryoutClassNames(student: StudentDocument) {
  if (isUtbkStudent(student)) {
    return getUtbkScheduleClassNames(student);
  }

  const canonicalClassName = getStudentCanonicalClassName(student);

  return canonicalClassName ? [canonicalClassName] : [];
}

export async function buildEligibleTryoutFilter(
  student: StudentDocument,
  academicJoinedAt?: Date | null,
) {
  const academicAccess = await resolveStudentAcademicContentAccess(student);

  if (academicAccess.isUpcomingClassLocked) {
    return null;
  }

  const branch = normalizeText(student.branch);
  const canonicalClassNames = getStudentTryoutClassNames(student);

  if (!branch || canonicalClassNames.length === 0) {
    return null;
  }

  const teachers = await Teacher.find({ status: "Aktif" })
    .select("_id teacherId branch branches")
    .lean()
    .exec();
  const normalizedStudentBranch = branch.toLowerCase();
  const teacherClassScopes = teachers
    .filter((teacher) =>
      getTeacherBranchNames(teacher).some(
        (teacherBranch) =>
          teacherBranch.toLowerCase() === normalizedStudentBranch,
      ),
    )
    .flatMap((teacher) =>
      canonicalClassNames.map((canonicalClassName) => ({
        teacherId: teacher._id,
        classId: buildStableTeacherClassId(
          teacher.teacherId,
          branch,
          canonicalClassName,
        ),
      })),
    );

  if (teacherClassScopes.length === 0) {
    return null;
  }

  return {
    publishStatus: "published",
    $or: teacherClassScopes,
    $and: [
      {
        $or: [
          { assessmentType: { $in: [...TEACHER_ASSESSMENT_TYPES] } },
          { assessmentType: { $exists: false } },
        ],
      },
      {
        $or: [
          {
            academicYear: academicAccess.period.academicYear,
            semester: academicAccess.period.semester,
          },
          { academicYear: null },
          { academicYear: { $exists: false } },
        ],
      },
    ],
    branch,
    canonicalClassName: {
      $in: canonicalClassNames,
    },
    questionSource: {
      $in: ["bank", "manual", "file"],
    },
    questionCount: {
      $gt: 0,
    },
    ...(academicJoinedAt
      ? buildStudentAcademicTryoutFilter(academicJoinedAt)
      : {}),
  };
}

async function findEligibleStudentTryout(
  tryoutParam: string,
  student: StudentDocument,
  academicJoinedAt: Date,
) {
  const eligibleFilter = await buildEligibleTryoutFilter(student, academicJoinedAt);

  if (!eligibleFilter) {
    return null;
  }

  return TeacherTryout.findOne({
    $and: [
      eligibleFilter,
      {
        $or: [
          { tryoutId: tryoutParam },
          ...(Types.ObjectId.isValid(tryoutParam) ? [{ _id: tryoutParam }] : []),
        ],
      },
    ],
  }).exec();
}

function getTryoutAvailability(tryout: TeacherTryoutDocument) {
  const assessmentType = tryout.assessmentType ?? "Tryout";
  const now = Date.now();
  const startAt = tryout.startAt?.getTime() ?? 0;
  const endAt = tryout.endAt?.getTime() ?? 0;

  if (startAt && now < startAt) {
    return {
      status: "Belum Dibuka",
      isOpen: false,
      message: `${assessmentType} belum dibuka sesuai jadwal.`,
    };
  }

  if (endAt && now > endAt) {
    return {
      status: "Berakhir",
      isOpen: false,
      message: `${assessmentType} sudah melewati batas waktu pengerjaan.`,
    };
  }

  return {
    status: "Tersedia",
    isOpen: true,
    message: `${assessmentType} sudah bisa dikerjakan.`,
  };
}

function getAttemptTiming(
  attempt: StudentTryoutAttemptDocument,
  tryout: TeacherTryoutDocument,
  now = new Date(),
) {
  const startedAt = attempt.startedAt;
  const durationMilliseconds = Math.max(tryout.durationMinutes, 1) * 60 * 1000;
  const durationExpiresAt = new Date(startedAt.getTime() + durationMilliseconds);
  const scheduledEndAt = tryout.endAt;
  const expiresAt =
    scheduledEndAt && scheduledEndAt.getTime() < durationExpiresAt.getTime()
      ? scheduledEndAt
      : durationExpiresAt;
  const elapsedMilliseconds = Math.max(
    Math.min(now.getTime(), expiresAt.getTime()) - startedAt.getTime(),
    0,
  );

  return {
    expiresAt,
    remainingSeconds:
      attempt.status === "submitted"
        ? 0
        : Math.max(Math.ceil((expiresAt.getTime() - now.getTime()) / 1000), 0),
    timeUsedSeconds: Math.round(elapsedMilliseconds / 1000),
  };
}

function toPublicStudentTryoutAttemptSummary(
  attempt: StudentTryoutAttemptDocument | null | undefined,
  tryout?: TeacherTryoutDocument,
) {
  if (!attempt) {
    return {
      submitted: false,
      attemptId: null,
      status: null,
      score: null,
      correctCount: null,
      wrongCount: null,
      unansweredCount: null,
      timeUsedSeconds: null,
      startedAt: null,
      expiresAt: null,
      remainingSeconds: null,
      submittedAt: null,
    };
  }

  const timing = tryout ? getAttemptTiming(attempt, tryout) : null;

  return {
    submitted: attempt.status === "submitted",
    attemptId: normalizeText(attempt.attemptId),
    status: attempt.status,
    score:
      typeof attempt.score === "number" && Number.isFinite(attempt.score)
        ? attempt.score
        : null,
    correctCount:
      typeof attempt.correctCount === "number" ? attempt.correctCount : null,
    wrongCount:
      typeof attempt.wrongCount === "number" ? attempt.wrongCount : null,
    unansweredCount:
      typeof attempt.unansweredCount === "number"
        ? attempt.unansweredCount
        : null,
    timeUsedSeconds:
      typeof attempt.timeUsedSeconds === "number"
        ? attempt.timeUsedSeconds
        : null,
    startedAt: attempt.startedAt?.toISOString() ?? null,
    expiresAt: timing?.expiresAt.toISOString() ?? null,
    remainingSeconds: timing?.remainingSeconds ?? null,
    submittedAt: attempt.submittedAt?.toISOString() ?? null,
  };
}

function toPublicStudentTryout(
  tryout: TeacherTryoutDocument,
  attempt?: StudentTryoutAttemptDocument | null,
) {
  const availability = getTryoutAvailability(tryout);

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
      typeof tryout.durationMinutes === "number" &&
      Number.isFinite(tryout.durationMinutes)
        ? tryout.durationMinutes
        : 0,
    startAt: tryout.startAt?.toISOString() ?? null,
    endAt: tryout.endAt?.toISOString() ?? null,
    questionSource: tryout.questionSource,
    questionCount:
      typeof tryout.questionCount === "number" && Number.isFinite(tryout.questionCount)
        ? tryout.questionCount
        : 0,
    questionSetId: normalizeText(tryout.questionSetId) || null,
    packageId: normalizeText(tryout.packageId) || null,
    availability: availability.status,
    availabilityMessage: availability.message,
    isOpen: availability.isOpen,
    myAttempt: toPublicStudentTryoutAttemptSummary(attempt, tryout),
  };
}

function toPublicTryoutQuestion(
  question: NormalizedTryoutQuestion,
  options: {
    includeAnswer?: boolean;
    selectedAnswer?: StudentTryoutSelectedAnswer;
    isCorrect?: boolean | null;
  } = {},
) {
  const includeAnswer = options.includeAnswer === true;

  return {
    id: question.questionId,
    questionId: question.questionId,
    order: question.number,
    number: question.number,
    section: question.section,
    topic: question.topic,
    difficulty: question.difficulty,
    prompt: question.question,
    options: OPTION_KEYS.map((key) => ({
      id: key,
      content: question.options[key],
    })),
    selectedOptionId: options.selectedAnswer || null,
    isCorrect: options.isCorrect ?? null,
    correctOptionId: includeAnswer ? question.correctAnswer : null,
    explanation: includeAnswer ? question.explanation : "",
    clue: includeAnswer
      ? question.explanation || "Pembahasan belum tersedia untuk soal ini."
      : "Pembahasan akan tampil setelah jawaban dikirim.",
  };
}

function toNormalizedAssessmentQuestion(
  question: IAssessmentQuestionItem,
): NormalizedTryoutQuestion {
  return {
    questionId: normalizeText(question.questionId),
    number:
      typeof question.number === "number" && Number.isFinite(question.number)
        ? question.number
        : 0,
    section: normalizeText(question.competency) || "Ujian",
    topic: normalizeText(question.topic) || "Materi ujian",
    difficulty: question.difficulty,
    question: normalizeText(question.question),
    options: question.options,
    correctAnswer: question.correctAnswer,
    explanation: normalizeText(question.explanation),
  };
}

function toNormalizedManualQuestion(question: {
  questionId?: string;
  order?: number;
  questionText?: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  correctAnswer?: string;
}): NormalizedTryoutQuestion | null {
  const questionId = normalizeText(question.questionId);
  const correctAnswer = normalizeSelectedAnswer(question.correctAnswer);

  if (!questionId || !correctAnswer) {
    return null;
  }

  return {
    questionId,
    number:
      typeof question.order === "number" && Number.isFinite(question.order)
        ? question.order
        : 0,
    section: "Ujian",
    topic: "Soal manual",
    difficulty: "Sedang",
    question: normalizeText(question.questionText),
    options: {
      A: normalizeText(question.optionA),
      B: normalizeText(question.optionB),
      C: normalizeText(question.optionC),
      D: normalizeText(question.optionD),
    },
    correctAnswer,
    explanation: "Pembahasan manual belum tersedia.",
  };
}

async function loadTryoutQuestions(tryout: TeacherTryoutDocument) {
  if (tryout.questionSource === "bank") {
    const questionSetId =
      normalizeText(tryout.questionSetId) ||
      normalizeText(tryout.questionBankId);

    if (!questionSetId) {
      throw new AppError(404, "Bank soal ujian belum terhubung.");
    }

    const questionSet = await AssessmentQuestionSet.findOne({
      questionSetId,
      assessmentType: tryout.assessmentType ?? "Tryout",
    }).exec();

    if (!questionSet) {
      throw new AppError(404, "Bank soal ujian tidak ditemukan.");
    }

    return {
      questionSetId: normalizeText(questionSet.questionSetId),
      questions: questionSet.questions
        .map(toNormalizedAssessmentQuestion)
        .sort((left, right) => left.number - right.number),
    };
  }

  if (tryout.questionSource === "manual" || tryout.questionSource === "file") {
    const questions = await TeacherTryoutQuestion.find({
      teacherId: tryout.teacherId,
      tryoutId: tryout.tryoutId,
    })
      .sort({ order: 1, createdAt: 1 })
      .lean()
      .exec();

    return {
      questionSetId: "",
      questions: questions
        .map(toNormalizedManualQuestion)
        .filter((item): item is NormalizedTryoutQuestion => item !== null)
        .sort((left, right) => left.number - right.number),
    };
  }

  throw new AppError(400, "Sumber soal ujian belum didukung untuk siswa.");
}

function buildSubmittedAnswerMap(
  attempt: StudentTryoutAttemptDocument | null | undefined,
) {
  return new Map(
    (attempt?.answers ?? []).map((answer) => [
      normalizeText(answer.questionId),
      {
        selectedAnswer: answer.selectedAnswer,
        isCorrect: answer.isCorrect,
      },
    ]),
  );
}

function buildCollisionResistantPublicId(prefix: string) {
  return `${prefix}-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}

async function ensureStudentTryoutAttempt(
  student: StudentDocument,
  tryout: TeacherTryoutDocument,
  questionSetId: string,
  subscriptionId: Types.ObjectId | null,
) {
  const existingAttempt = await StudentTryoutAttempt.findOne({
    tryoutId: tryout.tryoutId,
    studentId: student.studentId,
    ...buildAcademicRecordSubscriptionFilter(subscriptionId),
  }).exec();

  if (existingAttempt) {
    return existingAttempt;
  }

  const attempt = await StudentTryoutAttempt.findOneAndUpdate(
    {
      tryoutId: tryout.tryoutId,
      studentId: normalizeText(student.studentId),
    },
    {
      $setOnInsert: {
        attemptId: buildCollisionResistantPublicId("STA"),
        tryoutId: tryout.tryoutId,
        teacherId: tryout.teacherId,
        classId: normalizeText(tryout.classId),
        branch: normalizeText(tryout.branch),
        studentId: normalizeText(student.studentId),
        subscriptionId,
        questionSetId,
        packageId: normalizeText(tryout.packageId),
        stage:
          typeof tryout.stage === "number" && Number.isFinite(tryout.stage)
            ? tryout.stage
            : null,
        startedAt: new Date(),
        status: "in_progress",
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  ).exec();

  if (!attempt) {
    throw new AppError(500, "Sesi ujian siswa belum bisa dibuat.");
  }

  return attempt;
}

function gradeTryoutSubmission(
  questions: NormalizedTryoutQuestion[],
  body: StudentTryoutSubmissionBody,
) {
  const incomingAnswerByQuestionId = new Map(
    (body.answers ?? []).map((answer) => [
      normalizeText(answer.questionId),
      normalizeSelectedAnswer(
        answer.selectedAnswer ?? answer.optionId ?? answer.answer,
      ),
    ]),
  );
  const normalizedAnswers = questions.map((question) => {
    const selectedAnswer =
      incomingAnswerByQuestionId.get(question.questionId) ?? "";
    const isCorrect = selectedAnswer
      ? selectedAnswer === question.correctAnswer
      : null;

    return {
      questionId: question.questionId,
      selectedAnswer,
      isCorrect,
    };
  });
  const correctCount = normalizedAnswers.filter(
    (answer) => answer.isCorrect === true,
  ).length;
  const wrongCount = normalizedAnswers.filter(
    (answer) => answer.selectedAnswer && answer.isCorrect === false,
  ).length;
  const unansweredCount = normalizedAnswers.filter(
    (answer) => !answer.selectedAnswer,
  ).length;
  const score = Math.round((correctCount / questions.length) * 100);

  return {
    normalizedAnswers,
    correctCount,
    wrongCount,
    unansweredCount,
    score,
  };
}

async function upsertAcademicGradeFromAssessment(input: {
  student: StudentDocument;
  tryout: TeacherTryoutDocument;
  score: number;
  subscriptionId: Types.ObjectId | null;
}) {
  const assessmentType = input.tryout.assessmentType ?? "Tryout";
  const stage =
    typeof input.tryout.stage === "number" && Number.isFinite(input.tryout.stage)
      ? input.tryout.stage
      : null;

  const classId = normalizeText(input.tryout.classId);
  const className =
    normalizeText(input.tryout.canonicalClassName) ||
    normalizeText(input.tryout.kelas);

  if (!classId) {
    return null;
  }

  const scheme = getAcademicGradeScheme(className);
  let scoreKey: "uts" | "uas" | "uts1" | "uts2" | "uts3" | "tryout1" | "tryout2" | "tryout3";

  if (assessmentType === "Tryout") {
    let resolvedStage = stage;
    if (resolvedStage !== 1 && resolvedStage !== 2 && resolvedStage !== 3) {
      // Coba tebak stage dari judul jika tidak di-set (misal "Tryout 1")
      const match = input.tryout.title.match(/\b([123])\b/);
      resolvedStage = match ? Number(match[1]) : 1; 
    }

    scoreKey = `tryout${resolvedStage}` as any;
  } else {
    if (assessmentType.startsWith("UTS ")) {
      scoreKey = assessmentType.toLowerCase().replace(" ", "") as any;
    } else {
      scoreKey = assessmentType.toLowerCase() as any;
    }
  }

  const period = getCurrentAcademicPeriod();
  const studentId = normalizeText(input.student.studentId);
  const existingGrade = await AcademicGrade.findOne({
    teacherId: input.tryout.teacherId,
    classId,
    studentId,
    academicYear: period.academicYear,
    semester: period.semester,
  }).exec();
  const academicGradeId =
    existingGrade?.academicGradeId ??
    buildCollisionResistantPublicId("ACG");
  const academicGrade = await AcademicGrade.findOneAndUpdate(
    {
      teacherId: input.tryout.teacherId,
      classId,
      studentId,
      academicYear: period.academicYear,
      semester: period.semester,
    },
    {
      $set: {
        academicGradeId,
        scheme,
        [scoreKey]: input.score,
        evaluatedAt: new Date(),
      },
      $setOnInsert: {
        subscriptionId: input.subscriptionId,
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  ).exec();

  return academicGrade ? toPublicAcademicGrade(academicGrade) : null;
}

export const getMyStudentTryouts = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const membershipSnapshot = await getMembershipSnapshotByUserId(
      req.user._id.toString(),
    );
    const student = membershipSnapshot.student;

    if (!student || student.status !== "Aktif") {
      next(new AppError(404, "Profil siswa aktif tidak ditemukan."));
      return;
    }

    const membershipAccess = resolveStudentMembershipContentAccess(
      membershipSnapshot.accessStatus,
      {
        subscription: membershipSnapshot.subscription,
        payment: membershipSnapshot.payment,
      },
    );
    const academicAccess = await resolveStudentAcademicContentAccess(student);

    if (
      membershipAccess.isMembershipLocked ||
      academicAccess.isUpcomingClassLocked
    ) {
      sendSuccess(res, {
        message: "Daftar ujian siswa berhasil diambil.",
        data: {
          student: toPublicStudentTryoutProfile(
            student,
            membershipSnapshot.accessStatus,
          ),
          tryouts: [],
          academicAccess,
          membershipAccess,
        },
      });
      return;
    }

    const academicJoinedAt = getStudentEffectiveAcademicJoinedAt(
      student,
      membershipSnapshot.subscription,
    );

    if (!academicJoinedAt) {
      sendSuccess(res, {
        message: "Daftar ujian siswa berhasil diambil.",
        data: {
          student: toPublicStudentTryoutProfile(
            student,
            membershipSnapshot.accessStatus,
          ),
          tryouts: [],
          academicAccess,
          membershipAccess,
        },
      });
      return;
    }
    const subscriptionId = membershipSnapshot.subscription?._id ?? null;
    const subscriptionStartAt =
      parseValidDate(membershipSnapshot.subscription?.startDate) ?? academicJoinedAt;

    const eligibleFilter = await buildEligibleTryoutFilter(
      student,
      subscriptionStartAt,
    );

    if (!eligibleFilter) {
      sendSuccess(res, {
        message: "Daftar ujian siswa berhasil diambil.",
        data: {
          student: toPublicStudentTryoutProfile(
            student,
            membershipSnapshot.accessStatus,
          ),
          tryouts: [],
          academicAccess,
          membershipAccess,
        },
      });
      return;
    }

    const tryouts = await TeacherTryout.find({
      ...eligibleFilter,
      ...(isUtbkStudent(student) ? { assessmentType: "Tryout" } : {}),
    })
      .sort({ startAt: 1, stage: 1, createdAt: -1 })
      .exec();
    const attempts = tryouts.length
      ? await StudentTryoutAttempt.find({
          tryoutId: {
            $in: tryouts.map((tryout) => tryout.tryoutId),
          },
          studentId: normalizeText(student.studentId),
          ...buildAcademicRecordSubscriptionFilter(subscriptionId),
        }).exec()
      : [];
    const attemptByTryoutId = new Map(
      attempts.map((attempt) => [normalizeText(attempt.tryoutId), attempt]),
    );

    sendSuccess(res, {
      message: "Daftar ujian siswa berhasil diambil.",
      data: {
        student: toPublicStudentTryoutProfile(
          student,
          membershipSnapshot.accessStatus,
        ),
        tryouts: tryouts.map((tryout) =>
          toPublicStudentTryout(
            tryout,
            attemptByTryoutId.get(normalizeText(tryout.tryoutId)) ?? null,
          ),
        ),
        academicAccess,
        membershipAccess,
      },
    });
  },
);

export const startMyStudentExam = asyncHandler(
  async (
    req: Request<{ tryoutId: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const { student, subscriptionStartAt, subscriptionId } =
      await getAuthenticatedStudentTryoutContextOrThrow(req.user._id.toString());
    const tryoutParam = normalizeText(req.params.tryoutId);

    if (!tryoutParam) {
      next(new AppError(404, "Ujian siswa tidak ditemukan."));
      return;
    }

    const tryout = await findEligibleStudentTryout(
      tryoutParam,
      student,
      subscriptionStartAt,
    );

    if (!tryout) {
      next(new AppError(404, "Ujian siswa tidak ditemukan."));
      return;
    }

    const existingAttempt = await StudentTryoutAttempt.findOne({
      tryoutId: tryout.tryoutId,
      studentId: normalizeText(student.studentId),
      ...buildAcademicRecordSubscriptionFilter(subscriptionId),
    }).exec();

    if (existingAttempt?.status === "submitted") {
      const attemptSummary = toPublicStudentTryoutAttemptSummary(
        existingAttempt,
        tryout,
      );

      sendSuccess(res, {
        message: "Hasil ujian siswa berhasil ditemukan.",
        data: {
          attemptId: existingAttempt.attemptId,
          status: existingAttempt.status,
          startedAt: existingAttempt.startedAt.toISOString(),
          expiresAt: attemptSummary.expiresAt,
          remainingSeconds: attemptSummary.remainingSeconds,
          attempt: attemptSummary,
        },
      });
      return;
    }

    const availability = getTryoutAvailability(tryout);

    if (!availability.isOpen) {
      next(new AppError(403, availability.message));
      return;
    }

    const loadedQuestions = await loadTryoutQuestions(tryout);

    if (loadedQuestions.questions.length === 0) {
      next(new AppError(400, "Ujian belum memiliki soal."));
      return;
    }

    const attempt =
      existingAttempt ??
      (await ensureStudentTryoutAttempt(
        student,
        tryout,
        loadedQuestions.questionSetId,
        subscriptionId,
      ));
    const timing = getAttemptTiming(attempt, tryout);

    if (timing.remainingSeconds <= 0) {
      next(new AppError(403, "Waktu pengerjaan ujian sudah habis."));
      return;
    }

    const attemptSummary = toPublicStudentTryoutAttemptSummary(attempt, tryout);

    sendSuccess(res, {
      message: existingAttempt
        ? "Sesi ujian siswa berhasil dilanjutkan."
        : "Sesi ujian siswa berhasil dimulai.",
      data: {
        attemptId: attempt.attemptId,
        status: attempt.status,
        startedAt: attempt.startedAt.toISOString(),
        expiresAt: timing.expiresAt.toISOString(),
        remainingSeconds: timing.remainingSeconds,
        attempt: attemptSummary,
      },
    });
  },
);

export const getMyStudentExamAttempt = asyncHandler(
  async (
    req: Request<{ attemptId: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const { student, subscriptionStartAt, subscriptionId } =
      await getAuthenticatedStudentTryoutContextOrThrow(req.user._id.toString());
    const attemptId = normalizeText(req.params.attemptId);
    const attempt = attemptId
      ? await StudentTryoutAttempt.findOne({
          attemptId,
          studentId: normalizeText(student.studentId),
          ...buildAcademicRecordSubscriptionFilter(subscriptionId),
        }).exec()
      : null;

    if (!attempt) {
      next(new AppError(404, "Sesi ujian siswa tidak ditemukan."));
      return;
    }

    const tryout = await findEligibleStudentTryout(
      attempt.tryoutId,
      student,
      subscriptionStartAt,
    );

    if (!tryout) {
      next(new AppError(404, "Sesi ujian siswa tidak ditemukan."));
      return;
    }

    const loadedQuestions = await loadTryoutQuestions(tryout);
    const timing = getAttemptTiming(attempt, tryout);

    if (attempt.status === "in_progress") {
      const availability = getTryoutAvailability(tryout);

      if (!availability.isOpen) {
        next(new AppError(403, availability.message));
        return;
      }

      if (timing.remainingSeconds <= 0) {
        next(new AppError(403, "Waktu pengerjaan ujian sudah habis."));
        return;
      }
    }

    const answerByQuestionId = buildSubmittedAnswerMap(attempt);
    const includeAnswer = attempt.status === "submitted";
    const result = includeAnswer
      ? {
          score: attempt.score,
          correctCount: attempt.correctCount,
          wrongCount: attempt.wrongCount,
          unansweredCount: attempt.unansweredCount,
          totalQuestions: loadedQuestions.questions.length,
        }
      : null;

    sendSuccess(res, {
      message: "Sesi ujian siswa berhasil diambil.",
      data: {
        tryout: {
          ...toPublicStudentTryout(tryout, attempt),
          totalQuestions: loadedQuestions.questions.length,
        },
        attempt: toPublicStudentTryoutAttemptSummary(attempt, tryout),
        expiresAt: timing.expiresAt.toISOString(),
        remainingSeconds: timing.remainingSeconds,
        result,
        questions: loadedQuestions.questions.map((question) => {
          const answer = answerByQuestionId.get(question.questionId);

          return toPublicTryoutQuestion(question, {
            includeAnswer,
            selectedAnswer: answer?.selectedAnswer,
            isCorrect: answer?.isCorrect,
          });
        }),
      },
    });
  },
);

export const getMyStudentTryoutDetail = asyncHandler(
  async (
    req: Request<{ tryoutId: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const { student, subscriptionStartAt, subscriptionId } =
      await getAuthenticatedStudentTryoutContextOrThrow(req.user._id.toString());
    const tryoutParam = normalizeText(req.params.tryoutId);

    if (!tryoutParam) {
      next(new AppError(404, "Ujian siswa tidak ditemukan."));
      return;
    }

    const tryout = await findEligibleStudentTryout(
      tryoutParam,
      student,
      subscriptionStartAt,
    );

    if (!tryout) {
      next(new AppError(404, "Ujian siswa tidak ditemukan."));
      return;
    }

    const loadedQuestions = await loadTryoutQuestions(tryout);
    const availability = getTryoutAvailability(tryout);
    let attempt = await StudentTryoutAttempt.findOne({
      tryoutId: tryout.tryoutId,
      studentId: student.studentId,
      ...buildAcademicRecordSubscriptionFilter(subscriptionId),
    }).exec();
    const isSubmitted = attempt?.status === "submitted";

    if (!availability.isOpen && !isSubmitted) {
      next(new AppError(403, availability.message));
      return;
    }

    if (!attempt) {
      attempt = await ensureStudentTryoutAttempt(
        student,
        tryout,
        loadedQuestions.questionSetId,
        subscriptionId,
      );
    }

    const answerByQuestionId = buildSubmittedAnswerMap(attempt);
    const includeAnswer = attempt.status === "submitted";

    sendSuccess(res, {
      message: "Detail ujian siswa berhasil diambil.",
      data: {
        tryout: {
          ...toPublicStudentTryout(tryout, attempt),
          totalQuestions: loadedQuestions.questions.length,
        },
        questions: loadedQuestions.questions.map((question) => {
          const answer = answerByQuestionId.get(question.questionId);

          return toPublicTryoutQuestion(question, {
            includeAnswer,
            selectedAnswer: answer?.selectedAnswer,
            isCorrect: answer?.isCorrect,
          });
        }),
      },
    });
  },
);

export const submitMyStudentTryout = asyncHandler(
  async (
    req: Request<
      { tryoutId: string },
      Record<string, never>,
      StudentTryoutSubmissionBody
    >,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const { student, subscriptionStartAt, subscriptionId } =
      await getAuthenticatedStudentTryoutContextOrThrow(req.user._id.toString());
    const tryoutParam = normalizeText(req.params.tryoutId);

    if (!tryoutParam) {
      next(new AppError(404, "Ujian siswa tidak ditemukan."));
      return;
    }

    const tryout = await findEligibleStudentTryout(
      tryoutParam,
      student,
      subscriptionStartAt,
    );

    if (!tryout) {
      next(new AppError(404, "Ujian siswa tidak ditemukan."));
      return;
    }

    const availability = getTryoutAvailability(tryout);

    if (!availability.isOpen) {
      next(new AppError(403, availability.message));
      return;
    }

    const loadedQuestions = await loadTryoutQuestions(tryout);

    if (loadedQuestions.questions.length === 0) {
      next(new AppError(400, "Ujian belum memiliki soal."));
      return;
    }

    const {
      normalizedAnswers,
      correctCount,
      wrongCount,
      unansweredCount,
      score,
    } = gradeTryoutSubmission(loadedQuestions.questions, req.body);
    const existingAttempt = await StudentTryoutAttempt.findOne({
      tryoutId: tryout.tryoutId,
      studentId: student.studentId,
      ...buildAcademicRecordSubscriptionFilter(subscriptionId),
    }).exec();

    if (existingAttempt?.status === "submitted") {
      next(new AppError(409, "Ujian ini sudah dikirim dan tidak dapat dikirim ulang."));
      return;
    }

    const attemptId =
      existingAttempt?.attemptId ??
      buildCollisionResistantPublicId("STA");
    const attemptFilter: Record<string, unknown> = {
      tryoutId: tryout.tryoutId,
      studentId: student.studentId,
    };

    if (existingAttempt) {
      attemptFilter.status = "in_progress";
    }

    const attempt = await StudentTryoutAttempt.findOneAndUpdate(
      attemptFilter,
      {
        $set: {
          attemptId,
          teacherId: tryout.teacherId,
          classId: normalizeText(tryout.classId),
          branch: normalizeText(tryout.branch),
          questionSetId: loadedQuestions.questionSetId,
          packageId: normalizeText(tryout.packageId),
          stage:
            typeof tryout.stage === "number" && Number.isFinite(tryout.stage)
              ? tryout.stage
              : null,
          answers: normalizedAnswers,
          correctCount,
          wrongCount,
          unansweredCount,
          score,
          timeUsedSeconds: normalizeNonNegativeInteger(req.body.timeUsedSeconds),
          startedAt: existingAttempt?.startedAt ?? new Date(),
          submittedAt: new Date(),
          status: "submitted",
        },
        $setOnInsert: {
          subscriptionId,
        },
      },
      {
        new: true,
        upsert: !existingAttempt,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    ).exec();

    if (!attempt) {
      next(new AppError(409, "Ujian ini sudah dikirim dan tidak dapat dikirim ulang."));
      return;
    }

    const academicGrade = await upsertAcademicGradeFromAssessment({
      student,
      tryout,
      score,
      subscriptionId,
    });
    const answerByQuestionId = buildSubmittedAnswerMap(attempt);

    sendSuccess(res, {
      message: "Jawaban ujian berhasil dikirim.",
      data: {
        tryout: {
          ...toPublicStudentTryout(tryout, attempt),
          totalQuestions: loadedQuestions.questions.length,
        },
        attempt: toPublicStudentTryoutAttemptSummary(attempt),
        result: {
          score,
          correctCount,
          wrongCount,
          unansweredCount,
          totalQuestions: loadedQuestions.questions.length,
        },
        academicGrade,
        questions: loadedQuestions.questions.map((question) => {
          const answer = answerByQuestionId.get(question.questionId);

          return toPublicTryoutQuestion(question, {
            includeAnswer: true,
            selectedAnswer: answer?.selectedAnswer,
            isCorrect: answer?.isCorrect,
          });
        }),
      },
    });
  },
);

export const submitMyStudentExamAttempt = asyncHandler(
  async (
    req: Request<
      { attemptId: string },
      Record<string, never>,
      StudentTryoutSubmissionBody
    >,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new AppError(401, "User belum terautentikasi."));
      return;
    }

    const { student, subscriptionStartAt, subscriptionId } =
      await getAuthenticatedStudentTryoutContextOrThrow(req.user._id.toString());
    const attemptId = normalizeText(req.params.attemptId);
    const attempt = attemptId
      ? await StudentTryoutAttempt.findOne({
          attemptId,
          studentId: normalizeText(student.studentId),
          ...buildAcademicRecordSubscriptionFilter(subscriptionId),
        }).exec()
      : null;

    if (!attempt) {
      next(new AppError(404, "Sesi ujian siswa tidak ditemukan."));
      return;
    }

    if (attempt.status !== "in_progress") {
      next(new AppError(409, "Ujian ini sudah dikirim dan tidak dapat dikirim ulang."));
      return;
    }

    const tryout = await findEligibleStudentTryout(
      attempt.tryoutId,
      student,
      subscriptionStartAt,
    );

    if (!tryout) {
      next(new AppError(404, "Sesi ujian siswa tidak ditemukan."));
      return;
    }

    const now = new Date();
    const timing = getAttemptTiming(attempt, tryout, now);

    if (
      now.getTime() >
      timing.expiresAt.getTime() + SUBMISSION_GRACE_SECONDS * 1000
    ) {
      next(new AppError(403, "Waktu pengerjaan ujian sudah habis."));
      return;
    }

    const loadedQuestions = await loadTryoutQuestions(tryout);

    if (loadedQuestions.questions.length === 0) {
      next(new AppError(400, "Ujian belum memiliki soal."));
      return;
    }

    const {
      normalizedAnswers,
      correctCount,
      wrongCount,
      unansweredCount,
      score,
    } = gradeTryoutSubmission(loadedQuestions.questions, req.body);

    const submittedAttempt = await StudentTryoutAttempt.findOneAndUpdate(
      {
        _id: attempt._id,
        status: "in_progress",
      },
      {
        $set: {
          answers: normalizedAnswers,
          correctCount,
          wrongCount,
          unansweredCount,
          score,
          timeUsedSeconds: timing.timeUsedSeconds,
          submittedAt: now,
          status: "submitted",
        },
      },
      {
        new: true,
        runValidators: true,
      },
    ).exec();

    if (!submittedAttempt) {
      next(new AppError(409, "Ujian ini sudah dikirim dan tidak dapat dikirim ulang."));
      return;
    }

    const academicGrade = await upsertAcademicGradeFromAssessment({
      student,
      tryout,
      score,
      subscriptionId,
    });
    const answerByQuestionId = buildSubmittedAnswerMap(submittedAttempt);

    sendSuccess(res, {
      message: "Jawaban ujian berhasil dikirim.",
      data: {
        tryout: {
          ...toPublicStudentTryout(tryout, submittedAttempt),
          totalQuestions: loadedQuestions.questions.length,
        },
        attempt: toPublicStudentTryoutAttemptSummary(submittedAttempt, tryout),
        result: {
          score,
          correctCount,
          wrongCount,
          unansweredCount,
          totalQuestions: loadedQuestions.questions.length,
        },
        academicGrade,
        questions: loadedQuestions.questions.map((question) => {
          const answer = answerByQuestionId.get(question.questionId);

          return toPublicTryoutQuestion(question, {
            includeAnswer: true,
            selectedAnswer: answer?.selectedAnswer,
            isCorrect: answer?.isCorrect,
          });
        }),
      },
    });
  },
);
