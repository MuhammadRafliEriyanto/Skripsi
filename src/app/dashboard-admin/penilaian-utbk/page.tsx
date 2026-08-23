"use client";

import { useSearchParams } from "next/navigation";

import { AdminAcademicMonitoring } from "@/components/dashboard-admin/AdminUtbkAssessments";

export default function AdminPenilaianUtbkPage() {
  const searchParams = useSearchParams();
  const globalSearchQuery = searchParams?.get("q") || "";

  return <AdminAcademicMonitoring globalSearchQuery={globalSearchQuery} />;
}
