"use client";

import { useEffect, useState } from "react";

import { withStoredAuthHeader } from "@/lib/auth";
import type { ScheduleAttendanceWindow } from "@/lib/schedule-attendance-window";
import { subscribeStudentDashboardRefresh } from "../student-dashboard-refresh-events";
import type { StudentAcademicAccess } from "./studentAcademicAccess";

type StudentDashboardApiResponse = {
  success: boolean;
  message?: string;
  data?: StudentDashboardData;
};

export type StudentDashboardSchedule = {
  id: string;
  day: string;
  time: string;
  className: string;
  subject: string;
  teacher: string;
  room: string;
  branch: string;
  status: string;
  canStartAttendance?: boolean;
  attendanceWindow?: ScheduleAttendanceWindow;
};

export type StudentDashboardData = {
  student: {
    id: string;
    name: string;
    branch: string;
    program: string;
    className: string;
    utbkTrack?: string;
    targetKampus?: string;
    targetJurusan?: string;
    status: string;
    accessStatus: string;
  };
  academicSummary: {
    jenjang: string;
    kelas: number | null;
    kelasLabel: string;
    materialCount: number;
    taskCount: number;
    tryoutCount: number;
    todayScheduleCount: number;
    scheduleCount: number;
    accessStatus: string;
  };
  schedules: StudentDashboardSchedule[];
  todaySchedules: StudentDashboardSchedule[];
  academicAccess?: StudentAcademicAccess | null;
};

export function useStudentDashboardData() {
  const [dashboardData, setDashboardData] = useState<StudentDashboardData | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadStudentDashboardData() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const url = new URL("/api/student/me/dashboard", window.location.origin);

        const response = await fetch(url.toString(), {
          method: "GET",
          ...withStoredAuthHeader(),
          credentials: "include",
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | StudentDashboardApiResponse
          | null;

        if (!isMounted) {
          return;
        }

        if (response.status === 401) {
          setDashboardData(null);
          setLoadError("Sesi login berakhir. Silakan login ulang.");
          return;
        }

        if (!response.ok || !payload?.success || !payload.data) {
          setDashboardData(null);
          setLoadError(
            payload?.message ||
              "Ringkasan dashboard siswa belum bisa dimuat saat ini.",
          );
          return;
        }

        setDashboardData({
          ...payload.data,
          schedules: payload.data.schedules ?? [],
          todaySchedules: payload.data.todaySchedules ?? [],
          academicAccess: payload.data.academicAccess ?? null,
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        console.error("[dashboard-siswa] load_dashboard_data_failed", {
          error,
        });
        setDashboardData(null);
        setLoadError("Ringkasan dashboard siswa belum bisa dimuat saat ini.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    queueMicrotask(() => {
      void loadStudentDashboardData();
    });

    return () => {
      isMounted = false;
    };
  }, [reloadToken]);

  useEffect(() => {
    return subscribeStudentDashboardRefresh(() => {
      setReloadToken((currentToken) => currentToken + 1);
    });
  }, []);

  return {
    dashboardData,
    isLoading,
    loadError,
  };
}
