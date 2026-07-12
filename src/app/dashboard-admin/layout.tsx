import type { Metadata } from "next";
import AuthSessionGuard from "@/components/auth/AuthSessionGuard";
import { AdminLayoutClient } from "@/components/dashboard-admin/AdminLayoutClient";

export const metadata: Metadata = {
  title: "Dashboard Admin",
};

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthSessionGuard allowedRoles={["admin", "owner"]}>
      <AdminLayoutClient>{children}</AdminLayoutClient>
    </AuthSessionGuard>
  );
}
