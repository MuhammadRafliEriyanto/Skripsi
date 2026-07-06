"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Poppins } from "next/font/google";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import {
  adminNavigation,
  type AdminNavItem,
  type AdminTab,
} from "./admin-data";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  preload: false,
});

export type AdminSidebarBadgeCounts = Partial<Record<AdminTab, number>>;

function resolveSidebarBadgeLabel(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    return "0";
  }

  return value.toString();
}

function buildSidebarNavigation(badgeCounts: AdminSidebarBadgeCounts): AdminNavItem[] {
  return adminNavigation
    .filter((item) =>
      ["overview", "students", "teachers", "schedule", "payments"].includes(
        item.value,
      ),
    )
    .map((item) => {
      const badgeLabel = item.showBadge
        ? resolveSidebarBadgeLabel(badgeCounts[item.value])
        : undefined;

      if (item.value === "overview") {
        return { ...item, label: "Dashboard", description: "Navigation" };
      }

      if (item.value === "students") {
        return {
          ...item,
          label: "Kelola Siswa",
          description: "Management",
          ...(badgeLabel ? { badge: badgeLabel } : {}),
        };
      }

      if (item.value === "teachers") {
        return {
          ...item,
          label: "Kelola Guru",
          description: "Management",
          ...(badgeLabel ? { badge: badgeLabel } : {}),
        };
      }

      if (item.value === "schedule") {
        return {
          ...item,
          label: "Jadwal Kelas",
          description: "Management",
          ...(badgeLabel ? { badge: badgeLabel } : {}),
        };
      }

      if (item.value === "payments") {
        return {
          ...item,
          label: "Informasi Pembayaran",
          description: "Pembayaran",
          ...(badgeLabel ? { badge: badgeLabel } : {}),
        };
      }

      return item;
    });
}

type AdminSidebarProps = {
  activeTab: AdminTab;
  onSelect: (value: AdminTab) => void;
  badgeCounts?: AdminSidebarBadgeCounts;
  className?: string;
  mobile?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
};

function SidebarNavItem({
  item,
  active,
  isCompact,
  onSelect,
}: {
  item: AdminNavItem;
  active: boolean;
  isCompact: boolean;
  onSelect: (value: AdminTab) => void;
}) {
  const Icon = item.icon;

  if (isCompact) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onSelect(item.value)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex w-full justify-center rounded-[18px] p-3 text-[15px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/15",
              active
                ? "bg-white/96 text-orange-600 shadow-[0_18px_32px_-24px_rgba(255,255,255,0.5)]"
                : "text-orange-50/92 hover:bg-white/8 hover:text-white",
            )}
          >
            <Icon
              className={cn(
                "size-5 shrink-0 transition-colors duration-200",
                active ? "text-orange-500" : "text-orange-100/85",
              )}
            />
            <span className="sr-only">{item.label}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="font-semibold">
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(item.value)}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex w-full items-center gap-3 rounded-[18px] px-4 py-3 text-left text-[15px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/15",
        active
          ? "bg-white/96 text-orange-600 shadow-[0_18px_32px_-24px_rgba(255,255,255,0.5)]"
          : "text-orange-50/92 hover:bg-white/8 hover:text-white",
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0 transition-colors duration-200",
          active ? "text-orange-500" : "text-orange-100/85",
        )}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="min-w-0 whitespace-normal leading-5">{item.label}</p>

          {item.badge ? (
            <Badge
              variant={active ? "secondary" : "info"}
              className={cn(
                "h-5 rounded-full px-2 text-[10px] shadow-none",
                active
                  ? "border-orange-100/80 bg-orange-50 text-orange-600"
                  : "border-white/18 bg-white/12 text-white",
              )}
            >
              {item.badge}
            </Badge>
          ) : null}
        </div>
      </div>
    </button>
  );
}

export function AdminSidebar({
  activeTab,
  onSelect,
  badgeCounts = {},
  className,
  mobile = false,
  collapsed = false,
  onToggle,
}: AdminSidebarProps) {
  const sidebarNavigation = buildSidebarNavigation(badgeCounts);
  const isCompact = collapsed && !mobile;

  return (
    <TooltipProvider>
      <aside
        className={cn(
          poppins.className,
          "flex shrink-0 flex-col overflow-y-auto border-r border-orange-300/30 bg-[linear-gradient(180deg,#fb923c_0%,#f97316_52%,#ea580c_100%)] text-white transition-[width] duration-200",
          mobile
            ? "w-full h-full min-h-full px-4 py-6"
            : "sticky top-0 hidden h-screen px-4 py-0 lg:flex",
          !mobile && (isCompact ? "w-20" : "w-[236px]"),
          className,
        )}
      >
        <div
          className={cn(
            "flex h-full min-h-0 flex-col",
            mobile ? "" : "pb-6",
          )}
        >
          <div
            className={cn(
              "flex items-center justify-between border-b border-white/14",
              mobile ? "pb-6" : "min-h-[72px]",
            )}
          >
            {isCompact ? null : (
              <div>
                <p className="text-lg font-semibold tracking-[-0.02em] text-white">
                  Bimbel LMS
                </p>
                <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-100/80">
                  Admin Dashboard
                </p>
              </div>
            )}

            {!mobile && onToggle ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onToggle}
                className={cn(
                  "text-white hover:bg-white/10 hover:text-white",
                  isCompact ? "mx-auto size-10" : "size-8",
                )}
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

          {!isCompact ? (
            <div className="pt-6">
              <p className="px-3 text-[11px] font-medium uppercase tracking-[0.18em] text-orange-100/72">
                Menu
              </p>
            </div>
          ) : (
            <div className="pt-6" />
          )}

          <nav className="mt-3 flex flex-1 flex-col gap-1.5">
            <div className="space-y-1">
              {sidebarNavigation.map((item) => (
                <SidebarNavItem
                  key={item.value}
                  item={item}
                  active={item.value === activeTab}
                  isCompact={isCompact}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </nav>
        </div>
      </aside>
    </TooltipProvider>
  );
}
