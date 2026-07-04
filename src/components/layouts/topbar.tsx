"use client";

import { Bell, ChevronDown, Menu, Search, Settings, Shield, User } from "lucide-react";

import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { Sidebar } from "@/components/layouts/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { dashboardConfigs, type DashboardRole } from "@/lib/dashboard-navigation";

type TopbarProps = {
  role: DashboardRole;
  breadcrumbs: { label: string; href?: string }[];
};

export function Topbar({ role, breadcrumbs }: TopbarProps) {
  const config = dashboardConfigs[role];

  return (
    <header className="surface-panel mb-6 p-4 lg:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-3">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="lg:hidden">
                <Menu className="size-5" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 sm:max-w-sm">
              <SheetHeader className="border-b border-slate-100 p-6">
                <SheetTitle>Menu navigasi</SheetTitle>
                <SheetDescription>
                  Akses cepat untuk semua menu dashboard {config.shortLabel.toLowerCase()}.
                </SheetDescription>
              </SheetHeader>
              <div className="p-5">
                <Sidebar role={role} mobile />
              </div>
            </SheetContent>
          </Sheet>
          <div className="space-y-2">
            <Breadcrumbs items={breadcrumbs} />
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-600">
                {config.shortLabel}
              </p>
              <Badge variant="secondary">{config.user.role}</Badge>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 sm:w-[320px]">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input className="pl-11" placeholder={config.searchPlaceholder} />
          </div>

          <div className="flex items-center justify-end gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="relative">
                  <Bell className="size-5" />
                  <span className="absolute right-2 top-2 size-2 rounded-full bg-brand-500" />
                  <span className="sr-only">Notifications</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{config.notificationCount} notifikasi baru</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-[24px] border border-slate-200 bg-white px-3 py-2 shadow-sm transition hover:border-slate-300">
                  <Avatar className="size-10">
                    <AvatarFallback>{config.user.initials}</AvatarFallback>
                  </Avatar>
                  <div className="hidden text-left sm:block">
                    <p className="text-sm font-semibold text-slate-950">{config.user.name}</p>
                    <p className="text-xs text-slate-500">{config.user.role}</p>
                  </div>
                  <ChevronDown className="hidden size-4 text-slate-400 sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Akun pengguna</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <User className="size-4" />
                  Profil
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="size-4" />
                  Preferensi
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Shield className="size-4" />
                  Keamanan
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
