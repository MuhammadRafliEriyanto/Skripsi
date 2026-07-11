"use client";

import Link from "next/link";
import { useMemo, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  LogIn,
  QrCode,
} from "lucide-react";

import {
  AuthRequestError,
  authService,
  getRedirectPathForRole,
  persistAuthUser,
  withStoredAuthHeader,
} from "@/lib/auth";

type StudentAttendanceSession = {
  sessionId: string;
  classId: string;
  className: string;
  subject: string;
  branch: string;
  room: string;
  date: string;
  startTime: string;
  status: "open" | "closed";
};

type StudentAttendanceRecord = {
  recordId: string;
  studentId: string;
  name: string;
  status: string;
  markedBy: string;
  markedAt: string | null;
};

type StudentAttendanceScanResponse = {
  success: boolean;
  message?: string;
  data?: {
    session?: StudentAttendanceSession;
    record?: StudentAttendanceRecord;
  };
};

type ScanScreenState = "loading" | "success" | "auth" | "role" | "error";

type StudentAttendanceScanPageClientProps = {
  initialSessionId?: string;
  initialToken?: string;
};

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function formatMarkedAtLabel(markedAt: string | null) {
  if (!markedAt) {
    return "baru saja";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  }).format(new Date(markedAt));
}

async function readJsonResponse<T>(response: Response) {
  return (await response.json().catch(() => null)) as T | null;
}

export default function StudentAttendanceScanPageClient({
  initialSessionId = "",
  initialToken = "",
}: StudentAttendanceScanPageClientProps) {
  const sessionId = useMemo(
    () => normalizeText(initialSessionId),
    [initialSessionId],
  );
  const token = useMemo(() => normalizeText(initialToken), [initialToken]);
  const [screenState, setScreenState] = useState<ScanScreenState>("loading");
  const [message, setMessage] = useState("Memproses absensi QR...");
  const [session, setSession] = useState<StudentAttendanceSession | null>(null);
  const [record, setRecord] = useState<StudentAttendanceRecord | null>(null);
  const [redirectPath, setRedirectPath] = useState("/dashboard-siswa");
  const [retryNonce, setRetryNonce] = useState(0);

  const loginHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set(
      "next",
      `/absensi/scan?sessionId=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(token)}`,
    );
    return `/login?${params.toString()}`;
  }, [sessionId, token]);

  useEffect(() => {
    let isCancelled = false;

    async function processQrAttendanceScan() {
      if (!sessionId || !token) {
        if (isCancelled) {
          return;
        }

        setScreenState("error");
        setMessage("QR absensi tidak lengkap atau tidak valid.");
        return;
      }

      try {
        const meResponse = await authService.me();
        const user = meResponse.data?.user;

        if (!user) {
          if (isCancelled) {
            return;
          }

          setScreenState("auth");
          setMessage("Silakan login sebagai siswa untuk memproses absensi QR.");
          return;
        }

        persistAuthUser(user);

        if (user.role !== "siswa") {
          if (isCancelled) {
            return;
          }

          setRedirectPath(getRedirectPathForRole(user.role));
          setScreenState("role");
          setMessage("QR absensi ini hanya bisa diproses oleh akun siswa.");
          return;
        }
      } catch (error) {
        if (isCancelled) {
          return;
        }

        if (error instanceof AuthRequestError) {
          setScreenState("auth");
          setMessage("Silakan login sebagai siswa untuk memproses absensi QR.");
          return;
        }

        setScreenState("error");
        setMessage("Sesi login siswa belum bisa diverifikasi saat ini.");
        return;
      }

      try {
        const authInit = withStoredAuthHeader({
          method: "POST",
          credentials: "include",
          cache: "no-store",
        });
        const headers = new Headers(authInit.headers);
        headers.set("Content-Type", "application/json");

        const response = await fetch("/api/student/me/attendance/scan", {
          ...authInit,
          headers,
          body: JSON.stringify({
            sessionId,
            token,
          }),
        });
        const payload =
          await readJsonResponse<StudentAttendanceScanResponse>(response);

        if (isCancelled) {
          return;
        }

        if (
          !response.ok ||
          !payload?.success ||
          !payload.data?.record ||
          !payload.data?.session
        ) {
          setScreenState(response.status === 401 ? "auth" : "error");
          setMessage(
            payload?.message ||
              (response.status === 401
                ? "Silakan login sebagai siswa untuk memproses absensi QR."
                : "Absensi QR belum bisa diproses saat ini."),
          );
          return;
        }

        setSession(payload.data.session);
        setRecord(payload.data.record);
        setScreenState("success");
        setMessage(payload.message ?? "Absensi QR berhasil dicatat.");
      } catch {
        if (isCancelled) {
          return;
        }

        setScreenState("error");
        setMessage("Gagal menghubungi server absensi QR.");
      }
    }

    queueMicrotask(() => {
      void processQrAttendanceScan();
    });

    return () => {
      isCancelled = true;
    };
  }, [retryNonce, sessionId, token]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.12),transparent_24%),linear-gradient(180deg,#fffaf5_0%,#ffffff_60%,#fff7ed_100%)] px-4 py-10 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl items-center justify-center">
        <section className="w-full overflow-hidden rounded-[32px] border border-orange-100/80 bg-white shadow-[0_34px_76px_-46px_rgba(15,23,42,0.32),0_22px_46px_-34px_rgba(249,115,22,0.28)]">
          <div className="h-1.5 w-full bg-gradient-to-r from-red-800 via-orange-600 to-amber-400" />

          <div className="px-6 py-7 sm:px-8 sm:py-9">
            <div className="mx-auto flex max-w-md flex-col items-center text-center">
              <div
                className={`inline-flex h-14 w-14 items-center justify-center rounded-full border ${
                  screenState === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                    : screenState === "loading"
                      ? "border-orange-200 bg-orange-50 text-orange-600"
                      : "border-rose-200 bg-rose-50 text-rose-600"
                }`}
              >
                {screenState === "success" ? (
                  <CheckCircle2 className="h-7 w-7" />
                ) : screenState === "loading" ? (
                  <LoaderCircle className="h-7 w-7 animate-spin" />
                ) : (
                  <AlertCircle className="h-7 w-7" />
                )}
              </div>

              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-700">
                <QrCode className="h-3.5 w-3.5" />
                QR Absensi Siswa
              </div>

              <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
                {screenState === "success"
                  ? "Absensi berhasil dicatat"
                  : screenState === "loading"
                    ? "Memproses QR absensi"
                    : "Absensi QR membutuhkan perhatian"}
              </h1>

              <p className="mt-3 text-sm leading-6 text-slate-500 sm:text-base">
                {message}
              </p>

              {screenState === "success" && session && record ? (
                <div className="mt-6 w-full rounded-[28px] border border-emerald-100 bg-emerald-50/60 p-5 text-left shadow-[0_22px_38px_-34px_rgba(16,185,129,0.45)]">
                  <div className="space-y-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700/80">
                        Kelas
                      </p>
                      <p className="mt-1 text-base font-semibold text-slate-800">
                        {session.className}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700/80">
                        Siswa
                      </p>
                      <p className="mt-1 text-base font-semibold text-slate-800">
                        {record.name}
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
                          Status
                        </p>
                        <p className="mt-1 text-sm font-semibold text-emerald-700">
                          {record.status}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
                          Dicatat Oleh
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-700">
                          {record.markedBy === "qr" ? "QR Siswa" : "Guru"}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
                          Waktu
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-700">
                          {formatMarkedAtLabel(record.markedAt)} WIB
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-7 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
                {screenState === "auth" ? (
                  <Link
                    href={loginHref}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_30px_-24px_rgba(249,115,22,0.62)] transition hover:bg-orange-600"
                  >
                    <LogIn className="h-4 w-4" />
                    Login Sebagai Siswa
                  </Link>
                ) : null}

                {screenState === "role" ? (
                  <Link
                    href={redirectPath}
                    className="inline-flex items-center justify-center rounded-2xl border border-orange-200 bg-white px-5 py-3 text-sm font-semibold text-orange-700 transition hover:bg-orange-50"
                  >
                    Kembali ke Dashboard
                  </Link>
                ) : null}

                {screenState === "success" ? (
                  <Link
                    href="/dashboard-siswa"
                    className="inline-flex items-center justify-center rounded-2xl border border-orange-200 bg-white px-5 py-3 text-sm font-semibold text-orange-700 transition hover:bg-orange-50"
                  >
                    Buka Dashboard Siswa
                  </Link>
                ) : null}

                {screenState === "error" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setScreenState("loading");
                      setMessage("Memproses absensi QR...");
                      setRetryNonce((current) => current + 1);
                    }}
                    className="inline-flex items-center justify-center rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_30px_-24px_rgba(249,115,22,0.62)] transition hover:bg-orange-600"
                  >
                    Coba Lagi
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
