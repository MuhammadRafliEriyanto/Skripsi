"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AppLogo } from "@/components/shared/app-logo";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { dashboardConfigs, type DashboardRole } from "@/lib/dashboard-navigation";

type SidebarProps = {
  role: DashboardRole;
  mobile?: boolean;
};

export function Sidebar({ role, mobile = false }: SidebarProps) {
  const pathname = usePathname() ?? "";
  const config = dashboardConfigs[role];
  const hasDescription = config.description.trim().length > 0;
  const hasInsight =
    config.insight.title.trim().length > 0 ||
    config.insight.description.trim().length > 0;

  return (
    <aside
      className={cn(
        "surface-panel flex h-full flex-col p-4",
        mobile ? "w-full border-none bg-transparent p-0 shadow-none" : "sticky top-4 min-h-[calc(100vh-2rem)] w-[288px]",
      )}
    >
      <div className={cn("rounded-[24px] border border-white/70 bg-white/75 p-4", mobile && "bg-white p-4")}>
        <AppLogo />
        {hasDescription ? (
          <div className="mt-4 rounded-[22px] bg-slate-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              {config.label}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{config.description}</p>
          </div>
        ) : null}
      </div>

      {config.navItems.length > 0 ? (
        <div className="mt-4 space-y-2">
          {config.navItems.map((item) => {
            const isActive = !item.href.includes("#") && pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium transition-all",
                  isActive
                    ? "bg-slate-950 text-white shadow-lg shadow-slate-950/10"
                    : "text-slate-600 hover:bg-white hover:text-slate-950",
                )}
              >
                <span className="flex items-center gap-3">
                  <Icon className="size-4" />
                  {item.label}
                </span>
                {item.badge ? (
                  <Badge variant={isActive ? "secondary" : "info"}>{item.badge}</Badge>
                ) : null}
              </Link>
            );
          })}
        </div>
      ) : null}

      {hasInsight ? (
        <div className="mt-auto rounded-[24px] border border-slate-100 bg-gradient-to-br from-brand-50 via-white to-slate-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
            Insight harian
          </p>
          <h3 className="mt-3 text-lg font-semibold text-slate-950">{config.insight.title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{config.insight.description}</p>
        </div>
      ) : null}
    </aside>
  );
}
