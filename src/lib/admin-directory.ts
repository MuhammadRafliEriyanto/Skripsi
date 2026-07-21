import {
  downloadAdminFile,
  requestAdminApi,
} from "@/lib/admin-api";
import type {
  AdminSchedule,
  AdminStudent,
  AdminTeacher,
} from "@/components/dashboard-admin/admin-data";

export type AdminListPagination = {
  page: number;
  limit: number;
  totalPages: number;
  totalItems: number;
};

export type AdminStudentsSummary = {
  totalItems: number;
  activeCount: number;
  inactiveCount: number;
  branchCount: number;
  classCount: number;
};

export type AdminTeachersSummary = {
  totalItems: number;
  activeCount: number;
  inactiveCount: number;
  branchCount: number;
  activeClassesTotal: number;
};

export type AdminSchedulesSummary = {
  totalItems: number;
  runningCount: number;
  reviewCount: number;
  conflictCount: number;
  scheduledRoomCount: number;
  roomConflictCount: number;
};

export type FetchAdminStudentsParams = {
  page?: number;
  limit?: number;
  q?: string;
  sort?: string;
  status?: AdminStudent["status"];
  branch?: string;
  className?: string;
  level?: AdminStudent["level"];
  academicYear?: string;
};

export type FetchAdminTeachersParams = {
  page?: number;
  limit?: number;
  q?: string;
  sort?: string;
  status?: AdminTeacher["status"];
  branch?: string;
};

export type FetchAdminSchedulesParams = {
  page?: number;
  limit?: number;
  q?: string;
  sort?: string;
  status?: AdminSchedule["status"];
  branch?: string;
  className?: string;
  day?: string;
  academicYear?: string;
};

export type AdminStudentsListData = {
  students: AdminStudent[];
  summary: AdminStudentsSummary;
  pagination: AdminListPagination;
};

export type AdminTeachersListData = {
  teachers: AdminTeacher[];
  summary: AdminTeachersSummary;
  pagination: AdminListPagination;
};

export type AdminSchedulesListData = {
  schedules: AdminSchedule[];
  summary: AdminSchedulesSummary;
  pagination: AdminListPagination;
};

export type AdminScheduleImportErrorRow = {
  rowNumber: number;
  day: string;
  time: string;
  className: string;
  teacher: string;
  room: string;
  reason: string;
};

export type AdminScheduleImportData = {
  fileName: string;
  sheetName: string;
  summary: {
    totalRows: number;
    successCount: number;
    failedCount: number;
  };
  errorRows: AdminScheduleImportErrorRow[];
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

export async function fetchAdminStudents(params: FetchAdminStudentsParams = {}) {
  const payload = await requestAdminApi<AdminStudentsListData>(
    `/api/students${buildQueryString({
      page: params.page,
      limit: params.limit,
      q: params.q,
      sort: params.sort,
      status: params.status,
      branch: params.branch,
      className: params.className,
      level: params.level,
      academicYear: params.academicYear,
    })}`,
    {
      method: "GET",
    },
  );

  return payload.data as AdminStudentsListData;
}

export async function fetchAdminTeachers(params: FetchAdminTeachersParams = {}) {
  const payload = await requestAdminApi<AdminTeachersListData>(
    `/api/teachers${buildQueryString({
      page: params.page,
      limit: params.limit,
      q: params.q,
      sort: params.sort,
      status: params.status,
      branch: params.branch,
    })}`,
    {
      method: "GET",
    },
  );

  return payload.data as AdminTeachersListData;
}

export async function fetchAdminSchedules(params: FetchAdminSchedulesParams = {}) {
  const payload = await requestAdminApi<AdminSchedulesListData>(
    `/api/schedules${buildQueryString({
      page: params.page,
      limit: params.limit,
      q: params.q,
      sort: params.sort,
      status: params.status,
      branch: params.branch,
      className: params.className,
      day: params.day,
      academicYear: params.academicYear,
    })}`,
    {
      method: "GET",
    },
  );

  return payload.data as AdminSchedulesListData;
}

export function exportAdminStudentsCsv(params: FetchAdminStudentsParams = {}) {
  return downloadAdminFile(
    `/api/students/export${buildQueryString({
      q: params.q,
      sort: params.sort,
      status: params.status,
      branch: params.branch,
      className: params.className,
      level: params.level,
      academicYear: params.academicYear,
    })}`,
    {
      method: "GET",
    },
  );
}

export function exportAdminTeachersCsv(params: FetchAdminTeachersParams = {}) {
  return downloadAdminFile(
    `/api/teachers/export${buildQueryString({
      q: params.q,
      sort: params.sort,
      status: params.status,
      branch: params.branch,
    })}`,
    {
      method: "GET",
    },
  );
}

export function exportAdminSchedulesCsv(params: FetchAdminSchedulesParams = {}) {
  return downloadAdminFile(
    `/api/schedules/export${buildQueryString({
      q: params.q,
      sort: params.sort,
      status: params.status,
      branch: params.branch,
      className: params.className,
      day: params.day,
      academicYear: params.academicYear,
    })}`,
    {
      method: "GET",
    },
  );
}

export async function importAdminSchedules(payload: {
  fileName: string;
  fileDataBase64: string;
  academicYear?: string;
}) {
  const response = await requestAdminApi<AdminScheduleImportData>(
    "/api/schedules/import",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );

  return response.data as AdminScheduleImportData;
}
