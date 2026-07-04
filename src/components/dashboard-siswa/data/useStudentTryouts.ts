"use client";

import { useEffect, useState } from "react";
import { withStoredAuthHeader } from "@/lib/auth";
import { subscribeStudentDashboardRefresh } from "../student-dashboard-refresh-events";
import type { StudentAcademicAccess } from "./studentAcademicAccess";

export type AssessmentType = "UTS" | "UAS" | "Tryout";

export type StudentTryoutAttempt = {
  id: string;
  tryoutId: string;
  studentId: string;
  classId: string;
  teacherId: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  submittedAt: string | null;
  timeUsedSeconds?: number | null;
};

export type StudentTryoutItem = {
  id?: string;
  tryoutId?: string;
  classId?: string;
  branch?: string;
  canonicalClassName?: string;
  assessmentType?: AssessmentType;
  title?: string;
  jenjang?: string;
  kelas?: string;
  subject?: string;
  stage?: number | null;
  durationMinutes?: number;
  startAt?: string | null;
  endAt?: string | null;
  questionSource?: string;
  questionCount?: number;
  totalQuestions?: number;
  questionSetId?: string | null;
  packageId?: string | null;
  availability?: string;
  availabilityMessage?: string;
  isOpen?: boolean;
  myAttempt?: StudentTryoutAttempt;
};

type StudentTryoutListResponse = {
  success: boolean;
  message?: string;
  data?: {
    tryouts?: StudentTryoutItem[];
    academicAccess?: StudentAcademicAccess | null;
  };
};

export function useStudentTryouts() {
  const [tryouts, setTryouts] = useState<StudentTryoutItem[]>([]);
  const [academicAccess, setAcademicAccess] =
    useState<StudentAcademicAccess | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function fetchTryouts() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await fetch("/api/student/me/tryouts", {
          method: "GET",
          ...withStoredAuthHeader(),
          credentials: "include",
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as StudentTryoutListResponse | null;

        if (!isMounted) return;

        if (response.status === 401) {
          setTryouts([]);
          setAcademicAccess(null);
          setLoadError("Sesi login berakhir. Silakan login ulang.");
          return;
        }

        if (!response.ok || !payload?.success || !payload.data) {
          setTryouts([]);
          setAcademicAccess(null);
          setLoadError(payload?.message || "Gagal memuat data ujian.");
          return;
        }

        setTryouts(payload.data.tryouts ?? []);
        setAcademicAccess(payload.data.academicAccess ?? null);
      } catch (error) {
        if (!isMounted) return;
        setTryouts([]);
        setAcademicAccess(null);
        setLoadError(error instanceof Error ? error.message : "Terjadi kesalahan jaringan.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchTryouts();

    return () => {
      isMounted = false;
    };
  }, [reloadToken]);

  useEffect(() => {
    return subscribeStudentDashboardRefresh(() => {
      setReloadToken((currentToken) => currentToken + 1);
    });
  }, []);

  return { tryouts, academicAccess, isLoading, loadError };
}
