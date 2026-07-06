"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { ownerDashboardNavigationItems } from "@/components/dashboard-owner/navigation";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type OwnerDashboardSidebarProps = {
  collapsed?: boolean;
  mobile?: boolean;
  onNavigate?: () => void;
  onToggle?: () => void;
};

export function OwnerDashboardSidebar({
  collapsed = false,
  mobile = false,
  onNavigate,
  onToggle,
}: OwnerDashboardSidebarProps) {
  const pathname = usePathname();
  const isCompact = collapsed && !mobile;

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex h-full shrink-0 flex-col border-r border-orange-300/30 bg-[linear-gradient(180deg,#fb923c_0%,#f97316_52%,#ea580c_100%)] text-white shadow-[12px_0_36px_-28px_rgba(154,52,18,0.75)] transition-[width] duration-200",
          mobile ? "w-full" : "sticky top-0 hidden h-screen lg:flex",
          !mobile && (isCompact ? "w-20" : "w-64"),
        )}
      >
        <div
          className={cn(
            "flex h-[72px] shrink-0 items-center border-b border-white/15 px-4",
            isCompact ? "justify-center" : "justify-between",
          )}
        >
          <Link
            href="/dashboard-owner"
            className={cn("min-w-0", isCompact && "sr-only")}
            onClick={onNavigate}
          >
            <p className="truncate text-base font-semibold text-white">
              Bimbel LMS
            </p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-100/85">
              Owner Workspace
            </p>
          </Link>

          {!mobile && onToggle ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 shrink-0 rounded-lg text-orange-100 hover:bg-white/15 hover:text-white"
              onClick={onToggle}
              aria-label={isCompact ? "Perluas sidebar" : "Ciutkan sidebar"}
            >
              {isCompact ? (
                <PanelLeftOpen className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
            </Button>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-3 py-5">
          <p
            className={cn(
              "mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-orange-100/75",
              isCompact && "sr-only",
            )}
          >
            Menu Owner
          </p>

          <nav className="flex flex-1 flex-col gap-1.5">
            {ownerDashboardNavigationItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard-owner" &&
                  pathname.startsWith(`${item.href}/`));
              const Icon = item.icon;
              const link = (
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex h-11 items-center rounded-lg px-3 text-sm font-medium transition-colors",
                    isCompact ? "justify-center" : "gap-3",
                    isActive
                      ? "bg-white text-orange-600 shadow-[0_14px_30px_-20px_rgba(124,45,18,0.65)]"
                      : "text-orange-50/95 hover:bg-white/12 hover:text-white",
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className={cn("truncate", isCompact && "sr-only")}>
                    {item.label}
                  </span>
                </Link>
              );

              if (!isCompact) {
                return <div key={item.id}>{link}</div>;
              }

              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              );
            })}
          </nav>

          <div
            className={cn(
              "rounded-xl border border-white/15 bg-white/10 px-3 py-3 text-xs leading-5 text-orange-50 backdrop-blur-sm",
              isCompact && "hidden",
            )}
          >
            Data pada workspace ini tersinkron langsung dengan backend LMS.
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
