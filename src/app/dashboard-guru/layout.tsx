import type { ReactNode } from "react";

import AuthSessionGuard from "@/components/auth/AuthSessionGuard";
import { GuruTopbar } from "@/components/dashboard-guru/components";

export default function DashboardGuruLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AuthSessionGuard allowedRoles={["guru"]}>
      <main className="min-h-screen w-full bg-slate-100/80">
        <GuruTopbar />
        {children}
      </main>
    </AuthSessionGuard>
  );
}
