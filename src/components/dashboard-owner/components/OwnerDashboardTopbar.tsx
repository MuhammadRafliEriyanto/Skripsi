"use client";

import { useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  LoaderCircle,
  LogOut,
  Menu,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";

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
  AuthRequestError,
  authService,
  clearAuthClientState,
  getRedirectPathForRole,
  persistAuthUser,
  readPersistedAuthUser,
  type AuthUser,
} from "@/lib/auth";
import { requestAdminApi } from "@/lib/admin-api";
import { resolveOwnerNotificationHref } from "@/lib/owner-dashboard-routing";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 18) return "Selamat sore";
  return "Selamat malam";
}

function getInitials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((part) => part.charAt(0))
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "OW"
  );
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
      return "Owner";
  }
}

const fallbackUser = {
  nama: "Owner",
  roleLabel: "Owner Workspace",
};

type OwnerNotificationSeverity = "info" | "warning" | "danger";

type OwnerNotificationSummaryPayload = {
  summary?: {
    total?: number;
    hasUnreadLikeItems?: boolean;
  };
  items?: Array<{
    key: string;
    title: string;
    message: string;
    count: number;
    severity: OwnerNotificationSeverity;
  }>;
  generatedAt?: string;
};

type OwnerNotificationItem = NonNullable<OwnerNotificationSummaryPayload["items"]>[number];

const ownerNotificationAcknowledgedStorageKey = "owner-notifications-acknowledged";

type Acknowledgements = Record<string, number>;

function getNotificationSeverityClasses(severity: OwnerNotificationSeverity) {
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

function readOwnerNotificationAcknowledgements(): Acknowledgements {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const rawValue = window.localStorage.getItem(
      ownerNotificationAcknowledgedStorageKey,
    );
    const parsed = rawValue ? JSON.parse(rawValue) : {};

    if (Array.isArray(parsed) || typeof parsed !== "object" || parsed === null) {
      return {};
    }

    return parsed;
  } catch {
    return {};
  }
}

function writeOwnerNotificationAcknowledgements(values: Acknowledgements) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      ownerNotificationAcknowledgedStorageKey,
      JSON.stringify(values),
    );
  } catch {
    // Ignore storage failures; the notification will simply stay visible.
  }
}

function filterAcknowledgedOwnerNotifications(items: OwnerNotificationItem[]) {
  const acknowledgements = readOwnerNotificationAcknowledgements();

  return items.filter((item) => {
    const ackCount = acknowledgements[item.key] || 0;
    return item.count > ackCount;
  });
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

type OwnerDashboardTopbarProps = {
  onOpenNavigation?: () => void;
};

export function OwnerDashboardTopbar({
  onOpenNavigation,
}: OwnerDashboardTopbarProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [notificationTotal, setNotificationTotal] = useState(0);
  const [notificationItems, setNotificationItems] = useState<
    OwnerNotificationItem[]
  >([]);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [notificationsGeneratedAt, setNotificationsGeneratedAt] = useState<string | null>(
    null,
  );
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(true);

  const loadCurrentUser = useCallback(async () => {
    try {
      const response = await authService.me();
      const user = response.data?.user;

      if (user) {
        persistAuthUser(user);
        setCurrentUser(user);

        if (user.role !== "owner") {
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
        return;
      }

      console.error("[owner-topbar] load_user_failed", error);
    } finally {
      setIsUserLoading(false);
    }
  }, [router, startTransition]);

  const loadNotificationSummary = useCallback(async () => {
    setIsNotificationsLoading(true);

    try {
      const response = await requestAdminApi<OwnerNotificationSummaryPayload>(
        "/api/owner/notifications/summary",
        {
          method: "GET",
        },
      );

      const nextItems = filterAcknowledgedOwnerNotifications(
        response.data?.items ?? [],
      );

      setNotificationTotal(
        nextItems.reduce((currentTotal, item) => currentTotal + item.count, 0),
      );
      setNotificationItems(nextItems);
      setNotificationsGeneratedAt(response.data?.generatedAt ?? null);
      setNotificationsError(null);
    } catch (error) {
      setNotificationsError(
        error instanceof Error ? error.message : "Gagal memuat notifikasi owner.",
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
      const persistedUser = readPersistedAuthUser();

      if (persistedUser) {
        setCurrentUser(persistedUser);
      }

      void loadCurrentUser();
      void loadNotificationSummary();
    });
  }, [loadCurrentUser, loadNotificationSummary]);

  async function handleLogout() {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      await authService.logout();
    } catch (error) {
      console.error("[owner-topbar] logout_failed", error);
    } finally {
      clearAuthClientState();
      setCurrentUser(null);

      startTransition(() => {
        router.replace("/login");
        router.refresh();
      });
    }
  }

  const resolvedUser = currentUser;
  const displayName = resolvedUser?.nama ?? fallbackUser.nama;
  const displayRole = resolvedUser
    ? formatRoleLabel(resolvedUser.role)
    : isUserLoading
      ? "Memuat profil..."
      : fallbackUser.roleLabel;
  const avatarFallback = getInitials(displayName);
  const notificationBadgeLabel =
    notificationTotal > 99 ? "99+" : notificationTotal.toString();
  const notificationUpdatedLabel = formatNotificationGeneratedAt(
    notificationsGeneratedAt,
  );

  function acknowledgeOwnerNotification(item: OwnerNotificationItem) {
    const acknowledgements = readOwnerNotificationAcknowledgements();

    acknowledgements[item.key] = item.count;
    writeOwnerNotificationAcknowledgements(acknowledgements);

    setNotificationItems((currentItems) =>
      currentItems.filter((currentItem) => currentItem.key !== item.key),
    );
    setNotificationTotal((currentTotal) => Math.max(0, currentTotal - item.count));
  }

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/92 backdrop-blur-xl supports-[backdrop-filter]:bg-white/84">
        <div className="flex h-[72px] items-center justify-between px-4 lg:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="lg:hidden"
              onClick={onOpenNavigation}
              aria-label="Buka navigasi Owner"
            >
              <Menu className="size-5" />
            </Button>

            <div className="flex flex-col">
              <p className="text-sm font-semibold text-slate-500">{getGreeting()},</p>
              <p className="text-lg font-bold text-slate-900">{displayName}</p>
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
                  type="button"
                  variant="outline"
                  size="icon"
                  className="relative rounded-full border-slate-200/80 bg-white shadow-sm shadow-slate-950/5"
                >
                  <Bell className="size-[18px]" />
                  {notificationTotal > 0 ? (
                    <span className="absolute right-1.5 top-1.5 min-w-5 rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
                      {notificationBadgeLabel}
                    </span>
                  ) : null}
                  <span className="sr-only">Notifikasi owner</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[360px] p-0 sm:w-[380px]">
                <div className="border-b border-slate-100 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        Notifikasi Owner
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Ringkasan bisnis dan operasional cabang yang perlu dipantau owner.
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
                    <div className="flex items-center gap-2 px-4 py-4 text-sm text-slate-500">
                      <LoaderCircle className="size-4 animate-spin text-orange-500" />
                      Memuat ringkasan notifikasi...
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
                            const href = resolveOwnerNotificationHref(item.key);

                            acknowledgeOwnerNotification(item);

                            startTransition(() => {
                              router.push(href);
                            });
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
                      Tidak ada notifikasi owner yang perlu perhatian saat ini.
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
                  <Avatar className="size-9">
                    {resolvedUser?.avatar ? (
                      <AvatarImage
                        src={resolvedUser.avatar}
                        alt={`Foto profil ${resolvedUser.nama}`}
                      />
                    ) : null}
                    <AvatarFallback>{avatarFallback}</AvatarFallback>
                  </Avatar>
                  <div className="hidden text-left md:block">
                    <p className="text-sm font-semibold text-slate-950">
                      {displayName}
                    </p>
                    <p className="text-xs text-slate-500">{displayRole}</p>
                  </div>
                  <ChevronDown className="hidden size-4 text-slate-400 md:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Akun owner</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => {
                  startTransition(() => {
                    router.push("/dashboard-owner/profil");
                  });
                }}>
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
