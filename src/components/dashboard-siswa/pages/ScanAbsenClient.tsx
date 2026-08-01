"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  LoaderCircle,
  RotateCcw,
  ScanLine,
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

import { resolveScheduleAttendanceWindow } from "@/lib/schedule-attendance-window";
import { getUtbkSubjectInfo } from "@/lib/utbk-subjects";
import { useStudentDashboardData } from "../data/useStudentDashboardData";
import { isUtbkStudentProfile } from "../data/studentProgram";
import { publishStudentDashboardRefresh } from "../student-dashboard-refresh-events";

type StudentAttendanceScanResponse = {
  success: boolean;
  message?: string;
  data?: {
    session?: {
      sessionId: string;
    };
    record?: {
      recordId: string;
      status: string;
    };
  };
};

type AttendanceQrPayload = {
  sessionId: string;
  token: string;
};

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function parseSearchParamsPayload(params: URLSearchParams) {
  const sessionId = normalizeText(
    params.get("sessionId") ?? params.get("session_id"),
  );
  const token = normalizeText(params.get("token") ?? params.get("qrToken"));

  if (!sessionId || !token) {
    return null;
  }

  return { sessionId, token } satisfies AttendanceQrPayload;
}

function getQrUrlParseBase() {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://bimbel-app.invalid";
}

function parseAttendanceQrPayload(decodedText: string) {
  const rawValue = normalizeText(decodedText);

  if (!rawValue) {
    return null;
  }

  try {
    const url = new URL(rawValue, getQrUrlParseBase());
    const payload = parseSearchParamsPayload(url.searchParams);

    if (payload) {
      return payload;
    }
  } catch {
    // Continue with other supported QR payload formats.
  }

  if (rawValue.includes("=")) {
    const payload = parseSearchParamsPayload(
      new URLSearchParams(rawValue.replace(/^\?/, "")),
    );

    if (payload) {
      return payload;
    }
  }

  try {
    const parsedPayload = JSON.parse(rawValue) as Partial<AttendanceQrPayload>;
    const sessionId = normalizeText(parsedPayload.sessionId);
    const token = normalizeText(parsedPayload.token);

    if (sessionId && token) {
      return { sessionId, token } satisfies AttendanceQrPayload;
    }
  } catch {
    // Continue with legacy delimiter format.
  }

  const [sessionId, token] = rawValue.split("|").map(normalizeText);

  if (sessionId && token) {
    return { sessionId, token } satisfies AttendanceQrPayload;
  }

  return null;
}

async function readJsonResponse<T>(response: Response) {
  return (await response.json().catch(() => null)) as T | null;
}

function ScannerGateCard({
  title,
  description,
  isLoading = false,
}: {
  title: string;
  description: string;
  isLoading?: boolean;
}) {
  return (
    <div className="relative mx-auto w-full overflow-hidden rounded-[32px] border border-slate-200/80 bg-white/80 p-8 text-center shadow-[0_24px_54px_-32px_rgba(15,23,42,0.12)] backdrop-blur-xl">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 ring-1 ring-orange-100/70">
        {isLoading ? (
          <LoaderCircle className="size-6 animate-spin" />
        ) : (
          <AlertCircle className="size-6" />
        )}
      </div>
      <h2 className="mt-5 text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
        {description}
      </p>
      {!isLoading ? (
        <Link
          href="/dashboard-siswa/jadwal"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-orange-500 px-4 py-2 text-xs font-semibold text-white shadow-[0_14px_28px_-22px_rgba(249,115,22,0.8)] transition hover:bg-orange-600"
        >
          Kembali ke Jadwal
        </Link>
      ) : null}
    </div>
  );
}

export default function ScanAbsenClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scheduleId = normalizeText(searchParams.get("scheduleId"));
  const {
    dashboardData,
    isLoading: isScheduleLoading,
    loadError: scheduleLoadError,
  } = useStudentDashboardData();

  const [isSuccess, setIsSuccess] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [attendanceClock, setAttendanceClock] = useState(() => Date.now());
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isProcessingRef = useRef(false);
  const linkedSchedule = scheduleId
    ? dashboardData?.schedules.find((schedule) => schedule.id === scheduleId) ?? null
    : null;
  const isUtbkStudent = isUtbkStudentProfile(dashboardData?.student);
  const linkedSubjectInfo =
    linkedSchedule && isUtbkStudent
      ? getUtbkSubjectInfo(linkedSchedule.subject)
      : null;
  const linkedAttendanceWindow = linkedSchedule
    ? resolveScheduleAttendanceWindow(linkedSchedule, new Date(attendanceClock))
    : null;
  const isScheduleGateLoading = Boolean(scheduleId && isScheduleLoading);
  const scannerGateError = scheduleId
    ? isScheduleGateLoading
      ? null
      : scheduleLoadError
        ? scheduleLoadError
        : !linkedSchedule
          ? "Jadwal absensi ini tidak ditemukan untuk akun kamu."
          : linkedAttendanceWindow?.canStartAttendance
            ? null
            : linkedAttendanceWindow?.label ??
              "Absensi baru bisa dibuka saat jadwal berlangsung."
    : null;
  const canStartScanner = !isScheduleGateLoading && !scannerGateError;

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setAttendanceClock(Date.now());
    }, 30000);

    return () => {
      window.clearInterval(timerId);
    };
  }, []);

  useEffect(() => {
    if (isSuccess || !canStartScanner) {
      return;
    }

    let isMounted = true;
    isProcessingRef.current = false;

    // Create the pure scanner instance
    const html5QrCode = new Html5Qrcode("qr-reader");
    scannerRef.current = html5QrCode;

    // Calculate dynamic qrbox size based on screen width
    const getQrBoxSize = () => {
      const width = window.innerWidth;
      if (width < 400) return 200;
      if (width < 600) return 250;
      return 300;
    };

    const handleDecodedText = async (decodedText: string) => {
      if (!isMounted || isProcessingRef.current) {
        return;
      }

      isProcessingRef.current = true;
      setIsSubmitting(true);
      setScanError(null);

      if (html5QrCode.isScanning) {
        await html5QrCode.stop().catch(console.warn);
      }

      const payload = parseAttendanceQrPayload(decodedText);

      if (!payload) {
        if (isMounted) {
          setIsSubmitting(false);
          setScanError("QR absensi tidak dikenali. Silakan pindai QR dari sesi absensi guru.");
        }
        return;
      }

      try {
        const response = await fetch("/api/student/me/attendance/scan", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          cache: "no-store",
          body: JSON.stringify(payload),
        });
        const result = await readJsonResponse<StudentAttendanceScanResponse>(response);

        if (!isMounted) {
          return;
        }

        if (!response.ok || !result?.success) {
          setIsSubmitting(false);
          setScanError(
            result?.message ||
              "Absensi QR belum bisa diproses. Pastikan sesi masih aktif.",
          );
          return;
        }

        publishStudentDashboardRefresh();
        setIsSubmitting(false);
        setIsSuccess(true);

        setTimeout(() => {
          router.push("/dashboard-siswa#jadwal-mata-pelajaran");
        }, 1800);
      } catch {
        if (isMounted) {
          setIsSubmitting(false);
          setScanError("Absensi QR belum bisa diproses. Periksa koneksi lalu coba lagi.");
        }
      }
    };

    html5QrCode
      .start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: getQrBoxSize(), height: getQrBoxSize() },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          void handleDecodedText(decodedText);
        },
        () => {
          // Ignore normal scan failures (happens every frame)
        }
      )
      .then(() => {
        if (isMounted) setIsStarting(false);
      })
      .catch((err) => {
        console.warn("Camera start warning:", err);
        if (isMounted) {
          setIsStarting(false);
          
          // Provide more specific error messages based on common camera errors
          let errorMsg = "Gagal mengakses kamera. Pastikan izin kamera diberikan pada browser Anda.";
          const errorStr = String(err).toLowerCase();
          
          if (errorStr.includes("notallowederror") || errorStr.includes("permission denied")) {
            errorMsg = "Akses kamera ditolak. Silakan izinkan akses kamera di pengaturan browser Anda, lalu muat ulang halaman.";
          } else if (errorStr.includes("notfounderror")) {
            errorMsg = "Kamera tidak ditemukan pada perangkat ini.";
          } else if (errorStr.includes("notreadableerror")) {
            errorMsg = "Kamera sedang digunakan oleh aplikasi lain.";
          }
          
          setCameraError(errorMsg);
        }
      });

    // Cleanup on unmount
    return () => {
      isMounted = false;
      if (html5QrCode.isScanning) {
        html5QrCode.stop().catch(console.warn);
      }
      scannerRef.current = null;
    };
  }, [canStartScanner, isSuccess, retryNonce, router]);

  const handleRetryScan = () => {
    isProcessingRef.current = false;
    setIsSuccess(false);
    setIsSubmitting(false);
    setIsStarting(true);
    setScanError(null);
    setCameraError(null);
    setRetryNonce((current) => current + 1);
  };

  const visibleError = cameraError ?? scanError;

  return (
    <section className="mx-auto flex w-full max-w-[500px] flex-col gap-6 px-4 py-8 md:px-6 md:py-10">
      <header className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] ring-1 ring-orange-100/50">
          <ScanLine className="size-7" strokeWidth={1.5} />
        </div>
        <div>
          <h1 className="text-[1.35rem] font-semibold tracking-tight text-slate-900 md:text-2xl">
            Scan Barcode Kehadiran
          </h1>
          <p className="mx-auto mt-2 max-w-[280px] text-sm leading-6 text-slate-500 md:max-w-xs">
            Arahkan kamera ke QR Code absen di kelas untuk mencatat kehadiran.
          </p>
          {scheduleId ? (
            <div className="mt-4 inline-flex max-w-full flex-col rounded-2xl bg-slate-100 px-4 py-2 text-xs font-medium text-slate-600">
              <span>
                Jadwal absen:{" "}
                <span className="font-semibold text-slate-900">
                  {linkedSubjectInfo?.label ??
                    linkedSchedule?.subject ??
                    "Sesi kelas aktif"}
                </span>
              </span>
              {linkedSubjectInfo ? (
                <span className="mt-1 text-[11px] leading-5 text-slate-500">
                  {linkedSubjectInfo.description}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      {isScheduleGateLoading ? (
        <ScannerGateCard
          title="Memeriksa jadwal absensi"
          description="Sistem sedang memastikan sesi ini sudah masuk jam absensi."
          isLoading
        />
      ) : scannerGateError ? (
        <ScannerGateCard
          title="Absensi belum dibuka"
          description={scannerGateError}
        />
      ) : (
        <div className="relative mx-auto w-full overflow-hidden rounded-[32px] border border-slate-200/80 bg-white/70 shadow-[0_24px_54px_-32px_rgba(15,23,42,0.12)] backdrop-blur-xl">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-400 via-rose-400 to-orange-400" />

          {isSuccess ? (
            <div className="flex flex-col items-center justify-center p-12 text-center animate-in fade-in zoom-in duration-500">
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
                <div className="absolute inset-0 animate-ping rounded-full bg-emerald-100/60 duration-1000" />
                <CheckCircle2 className="relative z-10 h-12 w-12 drop-shadow-sm" />
              </div>
              <h2 className="mt-6 text-[1.4rem] font-bold tracking-tight text-slate-800">
                Absen Berhasil!
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Kehadiran Anda telah dicatat oleh sistem.
              </p>
              <div className="mt-6 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                <span className="flex size-1.5 animate-pulse rounded-full bg-emerald-500" />
                Mengalihkan otomatis...
              </div>
            </div>
          ) : (
            <div className="flex flex-col">
              {visibleError && (
                <div className="flex items-center justify-center gap-2 border-b border-red-100 bg-red-50/80 px-4 py-3 text-center text-xs font-medium text-red-600">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{visibleError}</span>
                </div>
              )}

              {/* Pure Scanner Container */}
              <div className="relative p-4 sm:p-5">
                <div
                  id="qr-reader"
                  className="w-full overflow-hidden rounded-2xl border-0 bg-slate-900 shadow-inner"
                />

                {/* Overlay Loading State */}
                {isStarting && !cameraError && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-slate-900/90 text-white backdrop-blur-sm m-4 sm:m-5">
                    <div className="flex size-12 animate-pulse items-center justify-center rounded-full bg-white/10">
                      <Camera className="size-6 text-white/80" />
                    </div>
                    <p className="mt-3 text-sm font-medium tracking-wide">Membuka Kamera...</p>
                  </div>
                )}

                {isSubmitting && !cameraError && (
                  <div className="absolute inset-0 z-10 m-4 flex flex-col items-center justify-center rounded-2xl bg-slate-950/85 text-white backdrop-blur-sm sm:m-5">
                    <div className="flex size-12 items-center justify-center rounded-full bg-white/10">
                      <LoaderCircle className="size-6 animate-spin text-white/85" />
                    </div>
                    <p className="mt-3 text-sm font-medium tracking-wide">
                      Memproses Absensi...
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center justify-center gap-3 border-t border-slate-100 bg-slate-50/50 p-4 text-[13px] font-medium text-slate-500 backdrop-blur">
                <div className="flex items-center justify-center gap-2">
                  <ScanLine className="h-4 w-4 text-orange-500" />
                  Posisikan QR Code di area kotak
                </div>
                {visibleError ? (
                  <button
                    type="button"
                    onClick={handleRetryScan}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-orange-500 px-4 py-2 text-xs font-semibold text-white shadow-[0_14px_28px_-22px_rgba(249,115,22,0.8)] transition hover:bg-orange-600"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Scan Ulang
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
