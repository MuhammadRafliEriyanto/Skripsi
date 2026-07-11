"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarRange, Loader2, RefreshCcw } from "lucide-react";

import { AcademicHistoryDetailPanel } from "@/components/academic-history/AcademicHistoryDetailPanel";
import { AcademicHistoryPeriodList } from "@/components/academic-history/AcademicHistoryPeriodList";
import type {
  AcademicHistoryApiResponse,
  AcademicHistoryDetailData,
  AcademicHistoryListData,
  AcademicHistorySubscription,
} from "@/components/academic-history/academic-history-types";
import { Button } from "@/components/ui/button";
import { withStoredAuthHeader } from "@/lib/auth";

async function requestTeacherAcademicHistory<T>(url: string) {
  const response = await fetch(url, {
    method: "GET",
    ...withStoredAuthHeader(),
    credentials: "include",
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as
    | AcademicHistoryApiResponse<T>
    | null;

  if (!response.ok || !payload?.success || !payload.data) {
    throw new Error(
      payload?.message ||
        `Histori akademik siswa belum bisa dimuat. (Status: ${response.status})`,
    );
  }

  return payload.data;
}

export default function StudentAcademicHistoryTab({
  studentId,
  studentName,
}: {
  studentId: string;
  studentName: string;
}) {
  const [subscriptions, setSubscriptions] = useState<AcademicHistorySubscription[]>([]);
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<string | null>(null);
  const [loadingSubscriptionId, setLoadingSubscriptionId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AcademicHistoryDetailData | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const encodedStudentId = useMemo(
    () => encodeURIComponent(studentId),
    [studentId],
  );

  const loadHistoryList = useCallback(async () => {
    if (!studentId) {
      return;
    }

    setIsLoadingList(true);
    setListError(null);

    try {
      const data = await requestTeacherAcademicHistory<AcademicHistoryListData>(
        `/api/teacher/students/${encodedStudentId}/academic-history`,
      );

      setSubscriptions(data.subscriptions ?? []);
    } catch (error) {
      console.error("[guru-student-academic-history] load_list_failed", error);
      setSubscriptions([]);
      setListError(
        error instanceof Error && error.message
          ? error.message
          : "Histori akademik siswa belum bisa dimuat.",
      );
    } finally {
      setIsLoadingList(false);
    }
  }, [encodedStudentId, studentId]);

  const loadHistoryDetail = useCallback(
    async (subscriptionId: string) => {
      setSelectedSubscriptionId(subscriptionId);
      setLoadingSubscriptionId(subscriptionId);
      setDetailError(null);

      try {
        const data = await requestTeacherAcademicHistory<AcademicHistoryDetailData>(
          `/api/teacher/students/${encodedStudentId}/academic-history/${encodeURIComponent(
            subscriptionId,
          )}`,
        );

        setDetail(data);
      } catch (error) {
        console.error("[guru-student-academic-history] load_detail_failed", error);
        setDetail(null);
        setDetailError(
          error instanceof Error && error.message
            ? error.message
            : "Detail histori akademik siswa belum bisa dimuat.",
        );
      } finally {
        setLoadingSubscriptionId(null);
      }
    },
    [encodedStudentId],
  );

  useEffect(() => {
    queueMicrotask(() => {
      setSelectedSubscriptionId(null);
      setDetail(null);
      setDetailError(null);
      void loadHistoryList();
    });
  }, [loadHistoryList]);

  if (isLoadingList) {
    return (
      <section className="rounded-[22px] border border-slate-200 bg-white px-5 py-8 text-center">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-orange-500" />
        <p className="mt-3 text-sm font-semibold text-slate-800">
          Memuat histori akademik {studentName}
        </p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Sistem sedang mengambil daftar subscription siswa.
        </p>
      </section>
    );
  }

  if (listError) {
    return (
      <section className="rounded-[22px] border border-rose-100 bg-white px-5 py-8 text-center">
        <p className="text-sm font-semibold text-rose-700">
          Histori akademik belum bisa dimuat
        </p>
        <p className="mt-2 text-xs leading-5 text-slate-500">{listError}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => {
            void loadHistoryList();
          }}
        >
          <RefreshCcw className="h-4 w-4" />
          Muat Ulang
        </Button>
      </section>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-[22px] border border-slate-200 bg-white p-4">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-600">
              Riwayat Akademik
            </p>
            <h3 className="mt-1 text-base font-semibold text-slate-900">
              Periode akademik {studentName}
            </h3>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void loadHistoryList();
            }}
          >
            <RefreshCcw className="h-4 w-4" />
            Muat Ulang
          </Button>
        </div>
        <AcademicHistoryPeriodList
          subscriptions={subscriptions}
          selectedSubscriptionId={selectedSubscriptionId}
          loadingSubscriptionId={loadingSubscriptionId}
          onSelect={(subscriptionId) => {
            void loadHistoryDetail(subscriptionId);
          }}
        />
      </div>

      {loadingSubscriptionId ? (
        <section className="rounded-[22px] border border-slate-200 bg-white px-5 py-8 text-center">
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-orange-500" />
          <p className="mt-3 text-sm font-semibold text-slate-800">
            Memuat detail histori
          </p>
        </section>
      ) : detailError ? (
        <section className="rounded-[22px] border border-rose-100 bg-white px-5 py-8 text-center">
          <p className="text-sm font-semibold text-rose-700">
            Detail histori belum bisa dimuat
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-500">{detailError}</p>
        </section>
      ) : detail ? (
        <AcademicHistoryDetailPanel detail={detail} compact />
      ) : (
        <section className="rounded-[22px] border border-dashed border-orange-200 bg-orange-50/30 px-5 py-8 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-orange-100 bg-white text-orange-600">
            <CalendarRange className="h-5 w-5" />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-800">
            Pilih periode akademik
          </p>
          <p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-slate-500">
            Klik Lihat Detail untuk membuka nilai, absensi, tryout, dan tugas
            pada subscription yang dipilih. Semua data di tab ini hanya baca.
          </p>
        </section>
      )}
    </div>
  );
}
