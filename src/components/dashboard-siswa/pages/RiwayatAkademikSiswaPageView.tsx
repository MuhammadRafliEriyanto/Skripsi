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

async function requestAcademicHistory<T>(url: string) {
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
        `Riwayat membership belum bisa dimuat. (Status: ${response.status})`,
    );
  }

  return payload.data;
}

export default function RiwayatAkademikSiswaPageView() {
  const [subscriptions, setSubscriptions] = useState<AcademicHistorySubscription[]>([]);
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<string | null>(null);
  const [loadingSubscriptionId, setLoadingSubscriptionId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AcademicHistoryDetailData | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const selectedSubscription = useMemo(
    () =>
      subscriptions.find(
        (subscription) => subscription.subscriptionId === selectedSubscriptionId,
      ) ?? null,
    [selectedSubscriptionId, subscriptions],
  );

  const loadHistoryList = useCallback(async () => {
    setIsLoadingList(true);
    setListError(null);

    try {
      const data = await requestAcademicHistory<AcademicHistoryListData>(
        "/api/student/me/academic-history",
      );

      setSubscriptions(data.subscriptions ?? []);
    } catch (error) {
      console.error("[riwayat-membership-siswa] load_list_failed", error);
      setSubscriptions([]);
      setListError(
        error instanceof Error && error.message
          ? error.message
          : "Riwayat membership belum bisa dimuat.",
      );
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  const loadHistoryDetail = useCallback(async (subscriptionId: string) => {
    setSelectedSubscriptionId(subscriptionId);
    setLoadingSubscriptionId(subscriptionId);
    setDetailError(null);

    try {
      const data = await requestAcademicHistory<AcademicHistoryDetailData>(
        `/api/student/me/academic-history/${encodeURIComponent(subscriptionId)}`,
      );

      setDetail(data);
    } catch (error) {
      console.error("[riwayat-membership-siswa] load_detail_failed", error);
      setDetail(null);
      setDetailError(
        error instanceof Error && error.message
          ? error.message
          : "Detail riwayat membership belum bisa dimuat.",
      );
    } finally {
      setLoadingSubscriptionId(null);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadHistoryList();
    });
  }, [loadHistoryList]);

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <div className="flex flex-col gap-4 rounded-[28px] border border-slate-100 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between md:p-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-600">
            Histori Membership
          </p>
          <h1 className="mt-2 text-xl font-semibold text-slate-900 md:text-2xl">
            Riwayat Membership
          </h1>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
            Lihat nilai, absensi, latihan, dan tryout berdasarkan membership siswa.
            Data lama dan aktif ditampilkan secara read-only.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void loadHistoryList();
          }}
          disabled={isLoadingList}
        >
          {isLoadingList ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCcw className="h-4 w-4" />
          )}
          Muat Ulang
        </Button>
      </div>

      {isLoadingList ? (
        <section className="rounded-[26px] border border-slate-100 bg-white p-8 text-center shadow-sm">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-orange-500" />
          <p className="mt-3 text-base font-semibold text-slate-800">
            Riwayat membership sedang dimuat
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Sistem sedang mengambil daftar membership kamu.
          </p>
        </section>
      ) : listError ? (
        <section className="rounded-[26px] border border-rose-100 bg-white p-8 text-center shadow-sm">
          <p className="text-base font-semibold text-rose-700">
            Riwayat membership belum bisa dimuat
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-500">{listError}</p>
        </section>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
          <section className="min-w-0 rounded-[26px] border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-600">
                Daftar Membership
              </p>
              <h2 className="mt-2 text-lg font-semibold text-slate-900">
                Subscription Siswa
              </h2>
            </div>
            <AcademicHistoryPeriodList
              subscriptions={subscriptions}
              selectedSubscriptionId={selectedSubscriptionId}
              loadingSubscriptionId={loadingSubscriptionId}
              onSelect={(subscriptionId) => {
                void loadHistoryDetail(subscriptionId);
              }}
            />
          </section>

          <section className="min-w-0">
            {loadingSubscriptionId ? (
              <div className="rounded-[26px] border border-slate-100 bg-white p-8 text-center shadow-sm">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-orange-500" />
                <p className="mt-3 text-base font-semibold text-slate-800">
                  Detail histori sedang dimuat
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Mengambil nilai, absensi, latihan, dan tryout membership terpilih.
                </p>
              </div>
            ) : detailError ? (
              <div className="rounded-[26px] border border-rose-100 bg-white p-8 text-center shadow-sm">
                <p className="text-base font-semibold text-rose-700">
                  Detail histori belum bisa dimuat
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-500">{detailError}</p>
              </div>
            ) : detail ? (
              <AcademicHistoryDetailPanel detail={detail} />
            ) : (
              <div className="rounded-[26px] border border-dashed border-orange-200 bg-orange-50/30 p-8 text-center shadow-sm">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-orange-100 bg-white text-orange-600">
                  <CalendarRange className="h-5 w-5" />
                </div>
                <p className="mt-4 text-base font-semibold text-slate-800">
                  Pilih membership
                </p>
                <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
                  Gunakan tombol Lihat Detail pada daftar subscription untuk membuka
                  nilai, absensi, tryout, dan latihan membership tersebut.
                </p>
                {selectedSubscription ? (
                  <p className="mt-3 text-xs font-semibold text-orange-700">
                    Terakhir dipilih: {selectedSubscription.className}{" "}
                    {selectedSubscription.packageName ||
                      selectedSubscription.subscriptionCode ||
                      "Membership"}
                  </p>
                ) : null}
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
