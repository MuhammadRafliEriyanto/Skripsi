"use client";

import { useCallback, useEffect, useEffectEvent, useState, useTransition } from "react";

import { useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  LoaderCircle,
  LogOut,
  Menu,
  Search,
  X,
  UserRound,
} from "lucide-react";

import { AdminSidebar } from "@/components/dashboard-admin/AdminSidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  AuthRequestError,
  authService,
  clearAuthClientState,
  getRedirectPathForRole,
  persistAuthUser,
  readPersistedAuthUser,
  type AuthUser,
} from "@/lib/auth";
import { requestAdminApi } from "@/lib/admin-api";

import { type AdminTab } from "./admin-data";
import { type AdminSidebarBadgeCounts } from "./AdminSidebar";

type AdminTopbarProps = {
  activeTab: AdminTab;
  onSelectTab: (value: AdminTab) => void;
  sidebarBadgeCounts?: AdminSidebarBadgeCounts;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onClearSearchQuery: () => void;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part.trim().charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatRoleLabel(role: AuthUser["role"]) {
  switch (role) {
    case "owner":
      return "Owner";
    case "admin":
      return "Admin Akademik";
    case "guru":
      return "Guru";
    case "siswa":
      return "Siswa";
    default:
      return role;
  }
}

type AdminNotificationSeverity = "info" | "warning" | "danger";

type AdminNotificationSummaryPayload = {
  summary?: {
    total?: number;
    hasUnreadLikeItems?: boolean;
  };
  items?: Array<{
    key: string;
    title: string;
    message: string;
    count: number;
    severity: AdminNotificationSeverity;
  }>;
  generatedAt?: string;
};

function getNotificationSeverityClasses(severity: AdminNotificationSeverity) {
  switch (severity) {
    case "danger":
      return "border-red-100 bg-red-50 text-red-700";
    case "warning":
      return "border-amber-100 bg-amber-50 text-amber-700";
    case "info":
      return "border-orange-100 bg-orange-50 text-orange-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

function formatNotificationGeneratedAt(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function resolveAdminNotificationTab(key: string): AdminTab {
  switch (key) {
    case "subscriptions_pending":
    case "payments":
      return "payments";
    case "schedule_conflicts":
    case "rooms_empty":
      return "schedule";
    default:
      return "overview";
  }
}

function getSearchPlaceholder(activeTab: AdminTab) {
  switch (activeTab) {
    case "students":
      return "Cari nama siswa, email, nomor induk, atau kelas...";
    case "teachers":
      return "Cari nama guru, email, nomor induk, cabang, atau mapel...";
    case "schedule":
      return "Cari kelas, mapel, guru, hari, atau ruangan...";
    case "payments":
      return "Cari no referensi, siswa, paket, pengeluaran, atau aktivasi...";
    case "overview":
    default:
      return "Cari siswa, guru, jadwal, atau pembayaran...";
  }
}

export function AdminTopbar({
  activeTab,
  onSelectTab,
  sidebarBadgeCounts,
  searchQuery,
  onSearchQueryChange,
  onClearSearchQuery,
}: AdminTopbarProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [notificationTotal, setNotificationTotal] = useState(0);
  const [notificationItems, setNotificationItems] = useState<
    NonNullable<AdminNotificationSummaryPayload["items"]>
  >([]);
  const [notificationsError, setNotificationsError] = useState<string | null>(
    null,
  );
  const [notificationsGeneratedAt, setNotificationsGeneratedAt] = useState<
    string | null
  >(null);
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const loadCurrentUser = useEffectEvent(async () => {
    try {
      const response = await authService.me();
      const user = response.data?.user;

      if (user) {
        persistAuthUser(user);
        setCurrentUser(user);

        if (user.role !== "admin" && user.role !== "owner") {
          startTransition(() => {
            router.replace(getRedirectPathForRole(user.role));
            router.refresh();
          });
        }
      }
    } catch (error) {
      if (
        error instanceof AuthRequestError &&
        (error.status === 401 || error.status === 403)
      ) {
        clearAuthClientState();
        setCurrentUser(null);

        startTransition(() => {
          router.replace("/login");
          router.refresh();
        });

        return;
      }

      console.error("[admin-topbar] load_user_failed", error);
    } finally {
      setIsUserLoading(false);
    }
  });

  const loadNotificationSummary = useCallback(async () => {
    setIsNotificationsLoading(true);

    try {
      const response = await requestAdminApi<AdminNotificationSummaryPayload>(
        "/api/admin/notifications/summary",
        {
          method: "GET",
        },
      );

      setNotificationTotal(response.data?.summary?.total ?? 0);
      setNotificationItems(response.data?.items ?? []);
      setNotificationsGeneratedAt(response.data?.generatedAt ?? null);
      setNotificationsError(null);
    } catch (error) {
      setNotificationsError(
        error instanceof Error
          ? error.message
          : "Gagal memuat notifikasi admin.",
      );
      setNotificationTotal(0);
      setNotificationItems([]);
      setNotificationsGeneratedAt(null);
    } finally {
      setIsNotificationsLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      setMounted(true);
    });
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    queueMicrotask(() => {
      const persistedUser = readPersistedAuthUser();

      if (persistedUser) {
        setCurrentUser(persistedUser);
      }

      void loadCurrentUser();
      void loadNotificationSummary();
    });
  }, [loadNotificationSummary, mounted]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const refreshNotifications = () => {
      void loadNotificationSummary();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshNotifications();
      }
    };

    window.addEventListener("focus", refreshNotifications);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", refreshNotifications);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [mounted, loadNotificationSummary]);

  async function handleLogout() {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      await authService.logout();
    } catch (error) {
      console.error("[admin-topbar] logout_failed", error);
    } finally {
      clearAuthClientState();
      setCurrentUser(null);

      startTransition(() => {
        router.replace("/login");
        router.refresh();
      });
    }
  }

  const resolvedUser =
    mounted && !isUserLoading && currentUser ? currentUser : null;
  const displayName = resolvedUser?.nama ?? "Admin";
  const displayRole = resolvedUser
    ? formatRoleLabel(resolvedUser.role)
    : "Administrator";
  const avatarFallback = getInitials(resolvedUser?.nama ?? "Admin");
  const notificationBadgeLabel =
    notificationTotal > 99 ? "99+" : notificationTotal.toString();
  const notificationUpdatedLabel = formatNotificationGeneratedAt(
    notificationsGeneratedAt,
  );

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-[0_18px_34px_-30px_rgba(15,23,42,0.18)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/90">
        <div className="flex h-[72px] items-center justify-between px-4 lg:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="lg:hidden">
                  <Menu className="size-5" />
                  <span className="sr-only">Buka navigasi admin</span>
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-[94vw] max-w-sm border-r border-slate-200/80 bg-white p-0 sm:max-w-sm"
              >
                <SheetHeader className="sr-only">
                  <SheetTitle>Menu dashboard admin</SheetTitle>
                  <SheetDescription>
                    Navigasi cepat dashboard admin.
                  </SheetDescription>
                </SheetHeader>
                <AdminSidebar
                  activeTab={activeTab}
                  onSelect={(tab) => {
                    onSelectTab(tab);
                    setMobileMenuOpen(false);
                  }}
                  badgeCounts={sidebarBadgeCounts}
                  mobile
                />
              </SheetContent>
            </Sheet>

            <div className="relative w-full max-w-[320px] lg:max-w-[380px]">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                aria-label="Cari data dashboard admin"
                className="h-10 rounded-full border-slate-200/80 bg-white/95 pl-10 pr-11 text-sm shadow-sm shadow-slate-950/5"
                placeholder={getSearchPlaceholder(activeTab)}
                value={searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
              />
              {searchQuery ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 size-8 -translate-y-1/2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  onClick={onClearSearchQuery}
                >
                  <X className="size-3.5" />
                  <span className="sr-only">Hapus pencarian</span>
                </Button>
              ) : null}
            </div>
          </div>

          <div className="ml-4 flex items-center justify-end gap-2">
            <DropdownMenu
              onOpenChange={(open) => {
                if (open) {
                  void loadNotificationSummary();
                }
              }}
            >
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="relative border-slate-200/80 bg-white shadow-sm shadow-slate-950/5"
                >
                  <Bell className="size-4.5" />
                  {notificationTotal > 0 ? (
                    <span className="absolute right-1.5 top-1.5 min-w-5 rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
                      {notificationBadgeLabel}
                    </span>
                  ) : null}
                  <span className="sr-only">Notifikasi</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-[360px] p-0 sm:w-[380px]"
              >
                <div className="border-b border-slate-100 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        Notifikasi Admin
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Ringkasan status database saat ini.
                      </p>
                    </div>
                    {notificationTotal > 0 ? (
                      <span className="rounded-full border border-orange-100 bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-700">
                        {notificationBadgeLabel}
                      </span>
                    ) : null}
                  </div>
                  {notificationUpdatedLabel ? (
                    <p className="mt-2 text-[11px] text-slate-400">
                      Diperbarui {notificationUpdatedLabel}
                    </p>
                  ) : null}
                </div>

                <div className="max-h-[340px] overflow-y-auto">
                  {isNotificationsLoading ? (
                    <div className="divide-y divide-slate-100">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="px-4 py-3">
                          <div className="flex w-full items-start justify-between gap-3">
                            <div className="min-w-0 flex-1 space-y-2">
                              <Skeleton className="h-4 w-32" />
                              <Skeleton className="h-3 w-48" />
                            </div>
                            <Skeleton className="h-6 w-8 rounded-full" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : notificationsError ? (
                    <div className="px-4 py-4 text-sm leading-6 text-red-600">
                      {notificationsError}
                    </div>
                  ) : notificationItems.length ? (
                    <div className="divide-y divide-slate-100">
                      {notificationItems.map((item) => (
                        <DropdownMenuItem
                          key={item.key}
                          className="cursor-pointer px-4 py-3 focus:bg-slate-50 data-[highlighted]:bg-slate-50"
                          onSelect={() => {
                            const targetTab = resolveAdminNotificationTab(item.key);
                            onSelectTab(targetTab);
                          }}
                        >
                          <div className="flex w-full items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900">
                                {item.title}
                              </p>
                              <p className="mt-1 text-sm leading-6 text-slate-600">
                                {item.message}
                              </p>
                            </div>
                            <span
                              className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getNotificationSeverityClasses(item.severity)}`}
                            >
                              {item.count > 0 ? item.count : "!"}
                            </span>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-4 text-sm leading-6 text-slate-500">
                      Tidak ada notifikasi admin yang perlu perhatian saat ini.
                    </div>
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-3 rounded-[20px] border border-slate-200 bg-white px-3 py-2 shadow-sm shadow-slate-950/5 transition-all duration-200 hover:-translate-y-px hover:border-slate-300 hover:bg-slate-50 hover:shadow-md hover:shadow-slate-200/70 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/10"
                >
                  {isUserLoading ? (
                    <Skeleton className="size-9 rounded-full" />
                  ) : (
                    <Avatar className="size-9">
                      {resolvedUser?.avatar ? (
                        <AvatarImage
                          src={resolvedUser.avatar}
                          alt={`Foto profil ${resolvedUser.nama}`}
                        />
                      ) : null}
                      <AvatarFallback>{avatarFallback}</AvatarFallback>
                    </Avatar>
                  )}
                  <div className="hidden text-left md:block">
                    {isUserLoading ? (
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-slate-950">
                          {displayName}
                        </p>
                        <p className="text-xs text-slate-500">{displayRole}</p>
                      </>
                    )}
                  </div>
                  <ChevronDown className="hidden size-4 text-slate-400 md:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Akun admin</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onSelectTab("profile")}>
                  <UserRound className="size-4" />
                  Profil Pengguna
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    void handleLogout();
                  }}
                  disabled={isLoggingOut}
                >
                  {isLoggingOut ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <LogOut className="size-4" />
                  )}
                  {isLoggingOut ? "Memproses logout..." : "Logout"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

    </>
  );
}
