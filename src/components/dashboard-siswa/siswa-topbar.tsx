"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  LoaderCircle,
  LogOut,
  Menu,
  UserRound,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useState,
  useTransition,
} from "react";

import { SiswaUserProfileDialog } from "@/components/dashboard-siswa/SiswaUserProfileDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AuthRequestError,
  authService,
  clearAuthClientState,
  getRedirectPathForRole,
  persistAuthUser,
  readPersistedAuthUser,
  withStoredAuthHeader,
  type AuthUser,
} from "@/lib/auth";
import {
  MembershipRequestError,
  membershipService,
  type MembershipStatusData,
} from "@/lib/subscription";
import { subscribeStudentDashboardRefresh } from "./student-dashboard-refresh-events";

const menus = [
  {
    name: "Beranda",
    path: "/dashboard-siswa",
    exact: true,
  },
  {
    name: "Absensi",
    path: "/dashboard-siswa/absensi",
    exact: false,
  },
  {
    name: "Nilai",
    path: "/dashboard-siswa/nilai",
    exact: false,
  },
  {
    name: "Transaksi",
    path: "/dashboard-siswa/tagihan",
    exact: true,
  },
] as const;

type SiswaTopbarProfile = {
  nama: string;
  role: string;
  initials: string;
};

type MembershipStudentProfile = NonNullable<MembershipStatusData["student"]>;

type StudentNotificationItem = {
  id: string;
  title: string;
  message: string;
  type: "schedule" | "task" | "material" | "billing" | "grade";
  createdAt: string;
  read: boolean;
  href?: string;
};

type StudentNotificationsResponse = {
  success: boolean;
  message: string;
  data?: {
    notifications?: StudentNotificationItem[];
    unreadCount?: number;
  };
};

const fallbackProfile: SiswaTopbarProfile = {
  nama: "Siswa",
  role: "Memuat profil...",
  initials: "SI",
};

function getInitials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((part) => part.charAt(0))
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "SI"
  );
}

function formatRoleLabel(role: AuthUser["role"]) {
  switch (role) {
    case "siswa":
      return "Siswa";
    case "guru":
      return "Guru";
    case "admin":
      return "Admin";
    case "owner":
      return "Owner";
    default:
      return "Siswa";
  }
}

function buildProfileFromAuthUser(user: AuthUser): SiswaTopbarProfile {
  return {
    nama: user.nama,
    role: formatRoleLabel(user.role),
    initials: getInitials(user.nama),
  };
}

function buildRoleFromStudentProfile(student: MembershipStudentProfile) {
  const className = student.className?.trim();
  const program = student.program?.trim();

  if (className) {
    return className;
  }

  if (program) {
    return `Siswa ${program}`;
  }

  return "Siswa";
}

function buildProfileFromMembershipData(data?: MembershipStatusData | null) {
  const student = data?.student;
  const user = data?.user;
  const resolvedName = student?.name?.trim() || user?.nama?.trim();

  if (!resolvedName) {
    return null;
  }

  return {
    nama: resolvedName,
    role: student ? buildRoleFromStudentProfile(student) : "Siswa",
    initials: getInitials(resolvedName),
  } satisfies SiswaTopbarProfile;
}

function mergeProfileWithAuthUser(
  currentProfile: SiswaTopbarProfile,
  user: AuthUser,
): SiswaTopbarProfile {
  const authRole = formatRoleLabel(user.role);
  const shouldPreserveCurrentRole =
    currentProfile.role &&
    currentProfile.role !== fallbackProfile.role &&
    currentProfile.role !== authRole;

  return {
    nama: user.nama,
    initials: getInitials(user.nama),
    role: shouldPreserveCurrentRole ? currentProfile.role : authRole,
  };
}

function formatNotificationTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Baru saja";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getNotificationTypeLabel(type: StudentNotificationItem["type"]) {
  switch (type) {
    case "schedule":
      return "Jadwal";
    case "task":
      return "Tugas";
    case "material":
      return "Materi";
    case "billing":
      return "Transaksi";
    case "grade":
      return "Nilai";
    default:
      return "Info";
  }
}

function getNotificationBadgeVariant(type: StudentNotificationItem["type"]) {
  switch (type) {
    case "schedule":
      return "warning";
    case "task":
      return "danger";
    case "material":
      return "info";
    case "billing":
      return "secondary";
    case "grade":
      return "success";
    default:
      return "secondary";
  }
}

export default function SiswaTopbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profile, setProfile] = useState<SiswaTopbarProfile>(fallbackProfile);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [notifications, setNotifications] = useState<StudentNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isUserLoading, setIsUserLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const redirectToLogin = useCallback(() => {
    startTransition(() => {
      router.replace("/login");
      router.refresh();
    });
  }, [router, startTransition]);

  const loadCurrentUser = useEffectEvent(async () => {
    try {
      const response = await authService.me();
      const user = response.data?.user;

      if (user) {
        persistAuthUser(user);
        setCurrentUser(user);
        setProfile((currentProfile) =>
          mergeProfileWithAuthUser(currentProfile, user),
        );

        if (user.role !== "siswa") {
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
        setProfile(fallbackProfile);
        setNotifications([]);
        setUnreadCount(0);
        redirectToLogin();
        return;
      }

      console.error("[siswa-topbar] load_auth_profile_failed", error);
    } finally {
      setIsUserLoading(false);
    }
  });

  const loadStudentProfile = useEffectEvent(async () => {
    try {
      const response = await membershipService.getMySubscription();
      const studentProfile = buildProfileFromMembershipData(response.data);

      if (studentProfile) {
        setProfile(studentProfile);
      }
    } catch (error) {
      if (
        error instanceof MembershipRequestError &&
        (error.status === 401 || error.status === 403)
      ) {
        console.warn("[siswa-topbar] membership_profile_unavailable", {
          status: error.status,
          errorCode: error.errorCode,
        });
        return;
      }

      console.error("[siswa-topbar] load_membership_profile_failed", error);
    }
  });

  const loadNotifications = useCallback(async () => {
    setIsNotificationsLoading(true);

    try {
      const response = await fetch("/api/student/me/notifications", {
        method: "GET",
        ...withStoredAuthHeader(),
        credentials: "include",
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | StudentNotificationsResponse
        | null;

      if (response.ok && payload?.success) {
        const nextNotifications = payload.data?.notifications ?? [];

        setNotifications(nextNotifications);
        setUnreadCount(
          payload.data?.unreadCount ??
            nextNotifications.filter((notification) => !notification.read).length,
        );
        setNotificationsError(null);
        return;
      }

      if (response.status === 401 || response.status === 403) {
        setNotifications([]);
        setUnreadCount(0);
        setNotificationsError(
          payload?.message ?? "Notifikasi siswa belum bisa dimuat saat ini.",
        );
        return;
      }

      setNotifications([]);
      setUnreadCount(0);
      setNotificationsError(
        payload?.message ?? "Notifikasi siswa belum bisa dimuat saat ini.",
      );
    } catch (error) {
      console.error("[siswa-topbar] load_notifications_failed", error);
      setNotifications([]);
      setUnreadCount(0);
      setNotificationsError("Notifikasi siswa belum bisa dimuat saat ini.");
    } finally {
      setIsNotificationsLoading(false);
    }
  }, [redirectToLogin]);

  const navigateTo = useCallback(
    (href: string) => {
      setMobileOpen(false);

      startTransition(() => {
        router.push(href);
      });
    },
    [router, startTransition],
  );

  useEffect(() => {
    queueMicrotask(() => {
      const persistedUser = readPersistedAuthUser();

      if (persistedUser) {
        setCurrentUser(persistedUser);
        setProfile(buildProfileFromAuthUser(persistedUser));
      }

      void loadCurrentUser();
      void loadStudentProfile();
      void loadNotifications();
    });
  }, [loadNotifications]);

  useEffect(() => {
    return subscribeStudentDashboardRefresh(() => {
      void loadStudentProfile();
      void loadNotifications();
    });
  }, [loadNotifications]);

  async function handleLogout() {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      await authService.logout();
    } catch (error) {
      console.error("[siswa-topbar] logout_failed", error);
    } finally {
      clearAuthClientState();
      setCurrentUser(null);
      setProfile(fallbackProfile);
      setNotifications([]);
      setUnreadCount(0);
      setIsProfileOpen(false);

      startTransition(() => {
        router.replace("/login");
        router.refresh();
      });
    }
  }

  const displayName = currentUser?.nama ?? profile.nama;
  const displayRole = profile.role;
  const avatarFallback = getInitials(displayName || "Siswa");
  const avatarSrc = currentUser?.avatar ?? null;
  const notificationBadgeLabel =
    unreadCount > 99 ? "99+" : unreadCount.toString();
  const notificationUpdatedLabel = notifications[0]
    ? formatNotificationTime(notifications[0].createdAt)
    : null;

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/10 bg-gradient-to-r from-red-600 to-orange-500 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-6 md:gap-10">
            <Link
              href="/dashboard-siswa"
              className="group flex items-center gap-3"
            >
              <Image
                src="/logobc.png"
                alt="Logo Bina Cendekia"
                width={40}
                height={40}
                className="w-auto h-auto transition group-hover:scale-105"
                priority
              />

              <div className="hidden leading-tight sm:block">
                <p className="text-sm font-bold text-white">Bina</p>
                <p className="-mt-1 text-xs text-white/80">Cendekia</p>
              </div>
            </Link>

            <nav className="hidden items-center space-x-3 md:flex">
              {menus.map((menu) => {
                const isActive = menu.exact
                  ? pathname === menu.path
                  : pathname.startsWith(menu.path);

                return (
                  <Link
                    key={menu.path}
                    href={menu.path}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all hover:scale-[1.05] hover:bg-white/10 hover:text-white ${
                      isActive ? "bg-white/15 text-white" : "text-white/80"
                    }`}
                  >
                    {menu.name}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-4 md:gap-6">
            <DropdownMenu
              onOpenChange={(open) => {
                if (open) {
                  void loadNotifications();
                }
              }}
            >
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="relative text-white/80 transition hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/20"
                  aria-label="Notifikasi siswa"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 ? (
                    <span className="absolute -right-2 -top-2 min-w-5 rounded-full bg-yellow-300 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-orange-900 ring-2 ring-red-500/30">
                      {notificationBadgeLabel}
                    </span>
                  ) : null}
                  <span className="sr-only">Notifikasi siswa</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[360px] p-0 sm:w-[380px]">
                <div className="border-b border-slate-100 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        Notifikasi Siswa
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Ringkasan jadwal, tugas, materi, nilai, dan transaksimu.
                      </p>
                    </div>
                    {unreadCount > 0 ? (
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
                      Memuat notifikasi siswa...
                    </div>
                  ) : notificationsError ? (
                    <div className="px-4 py-4 text-sm leading-6 text-red-600">
                      {notificationsError}
                    </div>
                  ) : notifications.length ? (
                    <div className="divide-y divide-slate-100">
                      {notifications.map((notification) => {
                        const content = (
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-slate-900">
                                  {notification.title}
                                </p>
                                <Badge
                                  variant={getNotificationBadgeVariant(notification.type)}
                                  className="px-2.5 py-1 text-[10px]"
                                >
                                  {getNotificationTypeLabel(notification.type)}
                                </Badge>
                                {!notification.read ? (
                                  <span className="size-2 rounded-full bg-orange-400" />
                                ) : null}
                              </div>
                              <p className="mt-1 text-sm leading-6 text-slate-600">
                                {notification.message}
                              </p>
                              <p className="mt-2 text-[11px] text-slate-400">
                                {formatNotificationTime(notification.createdAt)}
                              </p>
                            </div>
                          </div>
                        );

                        if (notification.href) {
                          return (
                            <DropdownMenuItem
                              key={notification.id}
                              className="cursor-pointer rounded-none px-4 py-3 focus:bg-slate-50 data-[highlighted]:bg-slate-50"
                              onSelect={() => {
                                navigateTo(notification.href!);
                              }}
                            >
                              {content}
                            </DropdownMenuItem>
                          );
                        }

                        return (
                          <div
                            key={notification.id}
                            className="px-4 py-3 transition-colors hover:bg-slate-50/70"
                          >
                            {content}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-4 py-4 text-sm leading-6 text-slate-500">
                      Belum ada notifikasi siswa saat ini.
                    </div>
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 text-white transition-all duration-200 hover:text-white/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/20"
                >
                  <Avatar className="size-9 border border-white/20 bg-white/10">
                    {avatarSrc ? (
                      <AvatarImage
                        src={avatarSrc}
                        alt={`Foto profil ${displayName}`}
                      />
                    ) : null}
                    <AvatarFallback className="bg-white/10 text-sm font-bold text-white">
                      {avatarFallback}
                    </AvatarFallback>
                  </Avatar>

                  <div className="hidden min-w-0 text-left md:block">
                    <p className="truncate text-sm font-medium text-white">
                      {displayName}
                    </p>
                    <p className="truncate text-[11px] text-white/80">
                      {displayRole}
                    </p>
                  </div>

                  <ChevronDown className="hidden size-4 text-white/80 transition-transform duration-200 md:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Akun siswa</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setIsProfileOpen(true)}>
                  <UserRound className="size-4" />
                  Profil Siswa
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

            <button
              type="button"
              className="text-white md:hidden"
              onClick={() => setMobileOpen((prev) => !prev)}
              aria-label="Toggle menu siswa"
            >
              {mobileOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="space-y-2 px-6 pb-4 md:hidden">
            {menus.map((menu) => {
              const isActive = menu.exact
                ? pathname === menu.path
                : pathname.startsWith(menu.path);

              return (
                <Link
                  key={menu.path}
                  href={menu.path}
                  onClick={() => setMobileOpen(false)}
                  className={`block rounded-md px-3 py-2 text-sm transition ${
                    isActive
                      ? "bg-white/15 text-white"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {menu.name}
                </Link>
              );
            })}
          </div>
        )}
      </header>

      <SiswaUserProfileDialog
        key={currentUser?._id ?? "anonymous-siswa"}
        open={isProfileOpen}
        onOpenChange={setIsProfileOpen}
        user={currentUser}
        isUserLoading={isUserLoading}
        profileLabel={displayRole}
        onProfileUpdated={(updatedUser) => {
          setCurrentUser(updatedUser);
          setProfile((currentProfile) =>
            mergeProfileWithAuthUser(currentProfile, updatedUser),
          );
        }}
      />
    </>
  );
}
