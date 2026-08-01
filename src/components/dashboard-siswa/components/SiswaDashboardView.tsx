"use client";

import HeaderAkademikSiswa from "../sections/HeaderAkademikSiswa";
import HeaderProfilSiswa from "../sections/HeaderProfilSiswa";
import PelajaranSection from "../sections/PelajaranSiswaSection";
import { useStudentDashboardData } from "../data/useStudentDashboardData";
import { isUtbkStudentProfile } from "../data/studentProgram";
import UtbkProgressWidget from "../widgets/UtbkProgressWidget";

export default function SiswaDashboardView() {
  const { dashboardData, isLoading, loadError } = useStudentDashboardData();
  const showLearningActivity =
    dashboardData && !isUtbkStudentProfile(dashboardData.student);

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,0.84fr)_minmax(0,1.16fr)] lg:gap-6">
        <div className="w-full">
          <HeaderProfilSiswa
            dashboardData={dashboardData}
            dashboardLoading={isLoading}
            dashboardError={loadError}
          />
        </div>

        <div className="flex w-full flex-col gap-5">
          <HeaderAkademikSiswa
            dashboardData={dashboardData}
            dashboardLoading={isLoading}
            dashboardError={loadError}
          />
          <UtbkProgressWidget
            dashboardData={dashboardData}
            dashboardLoading={isLoading}
          />
          {showLearningActivity ? <PelajaranSection /> : null}
        </div>
      </div>
    </section>
  );
}
