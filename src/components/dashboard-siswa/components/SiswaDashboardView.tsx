"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, Suspense } from "react";
import HeaderAkademikSiswa from "../sections/HeaderAkademikSiswa";
import HeaderProfilSiswa from "../sections/HeaderProfilSiswa";
import { useStudentDashboardData } from "../data/useStudentDashboardData";
import UtbkProgressWidget from "../widgets/UtbkProgressWidget";

function SiswaDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const academicYear = searchParams.get("academicYear") ?? "";

  const handleYearChange = useCallback(
    (newYear: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("academicYear", newYear);
      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  const { dashboardData, isLoading, loadError, isWaitingForYear } = useStudentDashboardData(academicYear);

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,0.84fr)_minmax(0,1.16fr)] lg:gap-6">
        <div className="w-full">
          <HeaderProfilSiswa
            dashboardData={dashboardData}
            dashboardLoading={isLoading}
            dashboardError={loadError}
            isWaitingForYear={isWaitingForYear}
          />
        </div>

        <div className="flex w-full flex-col gap-5">
          <HeaderAkademikSiswa
            dashboardData={dashboardData}
            dashboardLoading={isLoading}
            dashboardError={loadError}
            academicYear={academicYear}
            onYearChange={handleYearChange}
          />
          {(dashboardData || isLoading) && (
            <UtbkProgressWidget
              dashboardData={dashboardData}
              dashboardLoading={isLoading}
            />
          )}
        </div>
      </div>
    </section>
  );
}

export default function SiswaDashboardView() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Memuat dashboard...</div>}>
      <SiswaDashboardContent />
    </Suspense>
  );
}
