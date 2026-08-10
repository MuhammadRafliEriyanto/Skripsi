import { Metadata } from "next";

import RiwayatAkademikSiswaPageView from "@/components/dashboard-siswa/pages/RiwayatAkademikSiswaPageView";

export const metadata: Metadata = {
  title: "Riwayat Membership | Dashboard Siswa",
  description: "Lihat histori belajar siswa berdasarkan membership.",
};

export default function RiwayatAkademikSiswaPage() {
  return <RiwayatAkademikSiswaPageView />;
}
