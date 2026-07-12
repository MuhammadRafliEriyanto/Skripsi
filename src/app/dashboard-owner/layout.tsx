import type { ReactNode } from "react";

import AuthSessionGuard from "@/components/auth/AuthSessionGuard";
import { OwnerDashboardShell } from "@/components/dashboard-owner/components";

export default function DashboardOwnerLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AuthSessionGuard allowedRoles={["owner"]}>
      <OwnerDashboardShell>
        <div className="min-h-[calc(100vh-72px)] bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.1),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.1),transparent_20%),rgba(248,250,252,0.76)] px-4 pb-6 pt-5 sm:px-5 lg:px-8 lg:pb-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </div>
      </OwnerDashboardShell>
    </AuthSessionGuard>
  );
}
