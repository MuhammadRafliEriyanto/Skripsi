import type { Metadata } from "next";

import ActiveLatihanPageView from "@/components/dashboard-siswa/pages/ActiveLatihanPageView";

export const metadata: Metadata = {
  title: "Pengerjaan Latihan CBT Siswa",
  description:
    "Halaman pengerjaan latihan soal menggunakan engine CBT berbatas waktu.",
};

type DashboardSiswaLatihanCBTPageProps = {
  params: Promise<{
    taskId: string; // Note: This param is actually an attemptId when accessed via /cbt/start flow
  }>;
};

export default async function DashboardSiswaLatihanCBTPage({
  params,
}: DashboardSiswaLatihanCBTPageProps) {
  const { taskId } = await params;

  return <ActiveLatihanPageView taskId={taskId} />;
}
