"use client";

import { Sidebar } from "@/components/layouts/sidebar";
import { Topbar } from "@/components/layouts/topbar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { type DashboardRole } from "@/lib/dashboard-navigation";

type DashboardLayoutProps = {
  role: DashboardRole;
  breadcrumbs: { label: string; href?: string }[];
  children: React.ReactNode;
};

export function DashboardLayout({
  role,
  breadcrumbs,
  children,
}: DashboardLayoutProps) {
  return (
    <TooltipProvider delayDuration={120}>
      <div className="mx-auto flex max-w-[1680px] gap-4 p-4 lg:gap-6 lg:p-6">
        <div className="hidden lg:block">
          <Sidebar role={role} />
        </div>
        <div className="min-w-0 flex-1">
          <Topbar role={role} breadcrumbs={breadcrumbs} />
          <main className="space-y-6">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
