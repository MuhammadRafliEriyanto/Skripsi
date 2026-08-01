"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AdminAcademicMonitoring } from "@/components/dashboard-admin/AdminAcademicMonitoring";

function AcademicMonitoringContent() {
  const searchParams = useSearchParams();
  const globalSearchQuery = searchParams.get("q") || "";

  return <AdminAcademicMonitoring globalSearchQuery={globalSearchQuery} />;
}

export default function AdminAcademicMonitoringPage() {
  return (
    <Suspense fallback={<div className="p-4 text-slate-500">Memuat...</div>}>
      <AcademicMonitoringContent />
    </Suspense>
  );
}
