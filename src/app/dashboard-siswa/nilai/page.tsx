import { Metadata } from "next";

import { NilaiSiswaPageView } from "@/components/dashboard-siswa/pages/NilaiSiswaPageView";

export const metadata: Metadata = {
  title: "Statistik Belajar | Dashboard Siswa",
  description: "Lihat statistik belajar, progres, dan nilai latihan CBT Anda.",
};

export default function NilaiSiswaPage() {
  return <NilaiSiswaPageView />;
}
