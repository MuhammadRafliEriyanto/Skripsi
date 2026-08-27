import type { Metadata } from "next";

import TryoutGuruSection from "@/components/dashboard-guru/sections/TryoutGuruSection";

export const metadata: Metadata = {
  title: "Hasil Ujian Pusat",
  description:
    "Halaman guru untuk memantau hasil UTS, UAS, dan Tryout yang dikelola oleh pusat.",
};

export default function DashboardGuruUjianPage() {
  return <TryoutGuruSection />;
}
