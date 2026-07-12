import type { ReactNode } from "react";

import AuthSessionGuard from "@/components/auth/AuthSessionGuard";
import StudentMembershipAccessGate from "@/components/dashboard-siswa/StudentMembershipAccessGate";
import SiswaTopbar from "@/components/dashboard-siswa/siswa-topbar";

export default function DashboardSiswaLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AuthSessionGuard allowedRoles={["siswa"]}>
      <main className="min-h-screen w-full bg-slate-100/80">
        <SiswaTopbar />
        <StudentMembershipAccessGate>{children}</StudentMembershipAccessGate>
      </main>
    </AuthSessionGuard>
  );
}
