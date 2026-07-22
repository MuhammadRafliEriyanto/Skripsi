"use client";

import { useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  LoaderCircle,
  LogOut,
  Menu,
  Search,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

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
import {
  emptyOwnerSearchResults,
  fetchOwnerGlobalSearch,
  type OwnerSearchResults,
} from "@/lib/owner-search";

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

const ownerNotificationAcknowledgedStorageKey =
  "owner-notifications-acknowledged";

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

function getOwnerNotificationAcknowledgementKey(item: OwnerNotificationItem) {
  return `${item.key}:${item.count}`;
}

function readOwnerNotificationAcknowledgements() {
  if (typeof window === "undefined") {
    return new Set<string>();
  }

  try {
    const rawValue = window.localStorage.getItem(
      ownerNotificationAcknowledgedStorageKey,
    );
    const parsedValue = rawValue ? (JSON.parse(rawValue) as unknown) : [];

    return new Set(
      Array.isArray(parsedValue)
        ? parsedValue.filter((value): value is string => typeof value === "string")
        : [],
    );
  } catch {
    return new Set<string>();
  }
}

function writeOwnerNotificationAcknowledgements(values: Set<string>) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      ownerNotificationAcknowledgedStorageKey,
      JSON.stringify([...values]),
    );
  } catch {
    // Ignore storage failures; the notification will simply stay visible.
  }
}

function filterAcknowledgedOwnerNotifications(items: OwnerNotificationItem[]) {
  const acknowledgements = readOwnerNotificationAcknowledgements();

  return items.filter(
    (item) => !acknowledgements.has(getOwnerNotificationAcknowledgementKey(item)),
  );
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

type OwnerSearchGroupKey = keyof Pick<
  OwnerSearchResults,
  "branches" | "branchAdmins" | "payments" | "expenses" | "activations"
>;

const ownerSearchGroupConfigs: Array<{
  key: OwnerSearchGroupKey;
  label: string;
}> = [
  { key: "branches", label: "Cabang" },
  { key: "branchAdmins", label: "Admin Cabang" },
  { key: "payments", label: "Pembayaran" },
  { key: "expenses", label: "Pengeluaran" },
  { key: "activations", label: "Aktivasi Siswa" },
];

const ownerSearchMinimumLength = 2;
const ownerSearchDebounceMs = 300;

function resolveOwnerSearchHref(groupKey: OwnerSearchGroupKey) {
  switch (groupKey) {
    case "branches":
      return "/dashboard-owner/cabang";
    case "branchAdmins":
      return "/dashboard-owner/admin-cabang";
    case "payments":
      return "/dashboard-owner/aktivitas?tab=masuk";
    case "expenses":
      return "/dashboard-owner/aktivitas?tab=keluar";
    case "activations":
      return "/dashboard-owner/aktivitas?tab=aktivasi";
    default:
      return "/dashboard-owner";
  }
}

type OwnerDashboardTopbarProps = {
  onOpenNavigation?: () => void;
};

export function OwnerDashboardTopbar({
  onOpenNavigation,
}: OwnerDashboardTopbarProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] =
    useState<OwnerSearchResults>(emptyOwnerSearchResults);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

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

  const loadOwnerSearch = useCallback(
    async (query: string, signal: AbortSignal) => {
      setIsSearchLoading(true);

      try {
        const nextResults = await fetchOwnerGlobalSearch(query, signal);

        if (signal.aborted) {
          return;
        }

        setSearchResults(nextResults);
        setSearchError(null);
      } catch (error) {
        if (signal.aborted) {
          return;
        }

        setSearchResults({
          ...emptyOwnerSearchResults,
          query,
        });
        setSearchError(
          error instanceof Error
            ? error.message
            : "Pencarian owner belum bisa diproses sekarang.",
        );
      } finally {
        if (!signal.aborted) {
          setIsSearchLoading(false);
        }
      }
    },
    [],
  );

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

  useEffect(() => {
    if (!isSearchOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!searchContainerRef.current?.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsSearchOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSearchOpen]);

  useEffect(() => {
    if (!isSearchOpen) {
      return;
    }

    const normalizedQuery = searchQuery.trim();

    if (normalizedQuery.length < ownerSearchMinimumLength) {
      const resetTimeoutId = window.setTimeout(() => {
        setSearchResults({
          ...emptyOwnerSearchResults,
          query: normalizedQuery,
        });
        setSearchError(null);
        setIsSearchLoading(false);
      }, 0);

      return () => {
        window.clearTimeout(resetTimeoutId);
      };
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void loadOwnerSearch(normalizedQuery, controller.signal);
    }, ownerSearchDebounceMs);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [isSearchOpen, loadOwnerSearch, searchQuery]);

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
  const normalizedSearchQuery = searchQuery.trim();
  const shouldShowSearchDropdown =
    isSearchOpen && normalizedSearchQuery.length >= ownerSearchMinimumLength;
  const searchGroups = ownerSearchGroupConfigs
    .map((group) => ({
      ...group,
      items: searchResults[group.key],
    }))
    .filter((group) => group.items.length > 0);
  const hasSearchResults = searchGroups.length > 0;

  function handleSearchResultSelect(groupKey: OwnerSearchGroupKey) {
    setIsSearchOpen(false);
    setSearchQuery("");
    setSearchError(null);
    setSearchResults(emptyOwnerSearchResults);

    startTransition(() => {
      router.push(resolveOwnerSearchHref(groupKey));
    });
  }

  function acknowledgeOwnerNotification(item: OwnerNotificationItem) {
    const acknowledgementKey = getOwnerNotificationAcknowledgementKey(item);
    const acknowledgements = readOwnerNotificationAcknowledgements();

    acknowledgements.add(acknowledgementKey);
    writeOwnerNotificationAcknowledgements(acknowledgements);

    setNotificationItems((currentItems) =>
      currentItems.filter(
        (currentItem) =>
          getOwnerNotificationAcknowledgementKey(currentItem) !==
          acknowledgementKey,
      ),
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

            <div
              ref={searchContainerRef}
              className="relative w-full max-w-[320px] lg:max-w-[380px]"
            >
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              aria-label="Cari data dashboard owner"
              className="h-10 w-full rounded-full border-slate-200/80 bg-white/95 pl-10 pr-4 text-sm shadow-sm shadow-slate-950/5"
              placeholder="Cari cabang, admin, pembayaran, pengeluaran..."
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setSearchError(null);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
            />
              {shouldShowSearchDropdown ? (
              <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xl shadow-slate-950/10">
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-950">
                    Hasil pencarian owner
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Menampilkan data operasional dan performa cabang secara real-time.
                    pengeluaran, dan aktivasi siswa.
                  </p>
                </div>

                <div className="max-h-[360px] overflow-y-auto">
                  {isSearchLoading ? (
                    <div className="flex items-center gap-2 px-4 py-4 text-sm text-slate-500">
                      <LoaderCircle className="size-4 animate-spin text-orange-500" />
                      Mencari data owner...
                    </div>
                  ) : searchError ? (
                    <div className="px-4 py-4 text-sm leading-6 text-red-600">
                      {searchError}
                    </div>
                  ) : hasSearchResults ? (
                    <div>
                      {searchGroups.map((group) => (
                        <div
                          key={group.key}
                          className="border-t border-slate-100 first:border-t-0"
                        >
                          <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                            {group.label}
                          </div>
                          <div className="divide-y divide-slate-100">
                            {group.items.map((item) => (
                              <button
                                key={`${group.key}-${item.id}`}
                                type="button"
                                className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
                                onClick={() => handleSearchResultSelect(group.key)}
                              >
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-semibold text-slate-900">
                                      {item.title}
                                    </p>
                                    {item.referenceId ? (
                                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                                        {item.referenceId}
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="mt-1 text-sm leading-6 text-slate-600">
                                    {item.subtitle}
                                  </p>
                                </div>
                                {item.meta ? (
                                  <span className="max-w-[140px] shrink-0 text-right text-[11px] leading-5 text-slate-500">
                                    {item.meta}
                                  </span>
                                ) : null}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-4 text-sm leading-6 text-slate-500">
                      Tidak ada hasil untuk &quot;{normalizedSearchQuery}&quot;.
                    </div>
                  )}
                </div>
              </div>
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
