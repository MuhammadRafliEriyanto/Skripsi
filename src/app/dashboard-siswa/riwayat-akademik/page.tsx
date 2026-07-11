import { Metadata } from "next";

import RiwayatAkademikSiswaPageView from "@/components/dashboard-siswa/pages/RiwayatAkademikSiswaPageView";

export const metadata: Metadata = {
  title: "Riwayat Akademik | Dashboard Siswa",
  description: "Lihat histori akademik siswa berdasarkan subscription.",
};

export default function RiwayatAkademikSiswaPage() {
  return <RiwayatAkademikSiswaPageView />;
}
