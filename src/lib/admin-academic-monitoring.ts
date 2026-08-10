import { requestAdminApi } from "@/lib/admin-api";

export type AdminAcademicMonitoringStatus =
  | "Belum Hadir"
  | "Belum Akses Materi"
  | "Belum Latihan"
  | "Menunggu Review"
  | "Data Lengkap"
  | "Belum Ada Data";

export type AdminAcademicMonitoringLatestTryout = {
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

export type AdminAcademicMonitoringStageProgress = {
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

export type AdminAcademicMonitoringStudent = {
  id: string;
  studentId: string;
  name: string;
  email: string;
  loginCode: string;
  branch: string;
  program: string;
  programLabel: string;
  className: string;
  isUtbk: boolean;
  track: string;
  targetKampus: string;
  targetJurusan: string;
  materialCount: number;
  taskCount: number;
  gradedTaskCount: number;
  attendanceTotal: number;
  attendancePresent: number;
  attendanceRate: number | null;
  scoreCount: number;
  latestScore: number | null;
  latestScoreLabel: string;
  latestScoreAt: string | null;
  bestScore: number | null;
  averageScore: number | null;
  learningStatus: AdminAcademicMonitoringStatus;
  mainTryoutTotal: number;
  completedMainTryoutCount: number;
  completedTryoutCount: number;
  rawSubmittedTryoutCount: number;
  stageProgress: AdminAcademicMonitoringStageProgress[];
  latestTryout: AdminAcademicMonitoringLatestTryout | null;
};

export type AdminAcademicMonitoringSummary = {
  totalStudents: number;
  monitoredStudents: number;
  assessedStudents: number;
  regularStudents: number;
  utbkStudents: number;
  totalMaterials: number;
  totalTasks: number;
  totalAttendanceRecords: number;
  totalExpectedTryouts: number;
  totalCompletedTryouts: number;
  averageLatestScore: number | null;
  averageBestScore: number | null;
  monitoringPercent: number;
};

export type AdminAcademicMonitoringData = {
  summary: AdminAcademicMonitoringSummary;
  students: AdminAcademicMonitoringStudent[];
};

export type FetchAdminAcademicMonitoringParams = {
  q?: string;
  branch?: string;
  program?: string;
  status?: string;
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

export async function fetchAdminAcademicMonitoring(
  params: FetchAdminAcademicMonitoringParams = {},
) {
  const payload = await requestAdminApi<AdminAcademicMonitoringData>(
    `/api/admin/academic-monitoring${buildQueryString({
      q: params.q,
      branch: params.branch,
      program: params.program,
      status: params.status,
    })}`,
    {
      method: "GET",
    },
  );

  return payload.data as AdminAcademicMonitoringData;
}
