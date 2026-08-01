import { requestAdminApi } from "@/lib/admin-api";

export type AdminUtbkReadinessStatus =
  | "Belum Ada Nilai"
  | "Perlu Penguatan"
  | "Sebagian Terisi"
  | "Data Lengkap";

export type AdminUtbkAssessmentLatestTryout = {
  attemptId: string;
  tryoutId: string;
  title: string;
  subject: string;
  stage: number | null;
  label: string;
  shortLabel: string;
  submittedAt: string | null;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  timeUsedSeconds: number;
};

export type AdminUtbkAssessmentStageProgress = {
  stage: 1 | 2 | 3;
  label: string;
  shortLabel: string;
  status: "Selesai" | "Belum Dikerjakan";
  score: number | null;
  submittedAt: string | null;
  tryoutId: string;
  title: string;
  subject: string;
};

export type AdminUtbkAssessmentStudent = {
  id: string;
  studentId: string;
  name: string;
  email: string;
  loginCode: string;
  branch: string;
  track: string;
  targetKampus: string;
  targetJurusan: string;
  mainTryoutTotal: number;
  completedMainTryoutCount: number;
  completedTryoutCount: number;
  rawSubmittedTryoutCount: number;
  stageProgress: AdminUtbkAssessmentStageProgress[];
  latestScore: number | null;
  bestScore: number | null;
  averageScore: number | null;
  readinessStatus: AdminUtbkReadinessStatus;
  latestTryout: AdminUtbkAssessmentLatestTryout | null;
};

export type AdminUtbkAssessmentSummary = {
  totalStudents: number;
  assessedStudents: number;
  totalExpectedTryouts: number;
  totalCompletedTryouts: number;
  averageLatestScore: number | null;
  averageBestScore: number | null;
};

export type AdminUtbkAssessmentData = {
  summary: AdminUtbkAssessmentSummary;
  students: AdminUtbkAssessmentStudent[];
};

export type FetchAdminUtbkAssessmentParams = {
  q?: string;
  branch?: string;
};

function buildQueryString(params: Record<string, string | number | undefined>) {
  const queryParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") {
      continue;
    }

    queryParams.set(key, String(value));
  }

  const queryString = queryParams.toString();
  return queryString ? `?${queryString}` : "";
}

export async function fetchAdminUtbkAssessments(
  params: FetchAdminUtbkAssessmentParams = {},
) {
  const payload = await requestAdminApi<AdminUtbkAssessmentData>(
    `/api/admin/utbk-assessments${buildQueryString({
      q: params.q,
      branch: params.branch,
    })}`,
    {
      method: "GET",
    },
  );

  return payload.data as AdminUtbkAssessmentData;
}
