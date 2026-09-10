import type { Metadata } from "next";
import AdminQuestionBank from "@/components/dashboard-admin/AdminQuestionBank";

export const metadata: Metadata = { title: "Review Bank Soal" };
export default function AdminBankSoalPage() { return <AdminQuestionBank />; }
