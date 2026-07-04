"use client";

import { useEffect, useState } from "react";

import { withStoredAuthHeader } from "@/lib/auth";
import { subscribeStudentDashboardRefresh } from "../student-dashboard-refresh-events";
import type { StudentAcademicAccess } from "./studentAcademicAccess";

export type StudentAttendanceHistoryRecord = {
  id: string;
  sessionId: string;
  date: string;
  startTime: string;
  subject: string;
  className: string;
  branch: string;
  room: string;
  teacherName: string;
  status: string;
  sessionStatus: string;
  markedBy: string;
  note: string;
  markedAt: string | null;
};

type StudentAttendanceResponse = {
  success: boolean;
  message?: string;
  data?: {
    records: StudentAttendanceHistoryRecord[];
    academicAccess?: StudentAcademicAccess | null;
  };
};

export function useStudentAttendanceData() {
  const [history, setHistory] = useState<StudentAttendanceHistoryRecord[]>([]);
  const [academicAccess, setAcademicAccess] =
    useState<StudentAcademicAccess | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadStudentAttendanceData() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await fetch("/api/student/me/attendance", {
          method: "GET",
          ...withStoredAuthHeader(),
          credentials: "include",
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | StudentAttendanceResponse
          | null;

        if (!isMounted) {
          return;
        }

        if (response.status === 401) {
          setHistory([]);
          setAcademicAccess(null);
          setLoadError("Sesi login berakhir. Silakan login ulang.");
          return;
        }

        if (!response.ok || !payload?.success || !payload.data) {
          setHistory([]);
          setAcademicAccess(null);
          setLoadError(
            payload?.message || "Riwayat absensi belum bisa dimuat saat ini.",
          );
          return;
        }

        setHistory(payload.data.records ?? []);
        setAcademicAccess(payload.data.academicAccess ?? null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        console.error("[dashboard-siswa] load_attendance_data_failed", {
          error,
        });
        setHistory([]);
        setAcademicAccess(null);
        setLoadError("Riwayat absensi belum bisa dimuat saat ini.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    queueMicrotask(() => {
      void loadStudentAttendanceData();
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
    history,
    academicAccess,
    isLoading,
    loadError,
  };
}
