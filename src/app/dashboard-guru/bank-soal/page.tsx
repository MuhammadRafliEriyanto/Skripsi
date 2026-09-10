import type { Metadata } from "next";
import QuestionBankGuruSection from "@/components/dashboard-guru/sections/QuestionBankGuruSection";

export const metadata: Metadata = {
  title: "Bank Soal Guru",
  description: "Kelola soal latihan dan ujian guru.",
};

export default function DashboardGuruBankSoalPage() {
  return <QuestionBankGuruSection />;
}
