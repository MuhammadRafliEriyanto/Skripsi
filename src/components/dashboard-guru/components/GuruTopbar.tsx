"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

import { buildGuruUrl } from "@/lib/guru-helpers";
import { GuruUserProfileDialog } from "@/components/dashboard-guru/components/GuruUserProfileDialog";
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
  type AuthUser,
} from "@/lib/auth";

const menus = [
  { name: "Beranda", path: "/dashboard-guru" },
  { name: "Ujian", path: "/dashboard-guru/ujian" },
];

type GuruTopbarProfile = {
  nama: string;
  role: string;
  initials: string;
  email: string | null;
  subject: string | null;
  branch: string | null;
  status: string | null;
  avatar: string | null;
};

type TeacherDashboardResponse = {
  success: boolean;
  message: string;
  data?: {
    teacher?: {
      name?: string;
      email?: string;
      avatar?: string | null;
      subject?: string;
      branch?: string;
      status?: string;
      roleLabel?: string;
      initials?: string;
    };
  };
};

type TeacherNotificationItem = {
  id: string;
  title: string;
  message: string;
  type: "schedule" | "class" | "task" | "tryout";
  createdAt: string;
  read: boolean;
  href?: string;
};

type TeacherNotificationsResponse = {
  success: boolean;
  message: string;
  data?: {
    notifications?: TeacherNotificationItem[];
    unreadCount?: number;
  };
};

type TeacherDashboardProfile = NonNullable<
  NonNullable<TeacherDashboardResponse["data"]>["teacher"]
>;

const fallbackProfile: GuruTopbarProfile = {
  nama: "Guru",
  role: "Memuat profil...",
  initials: "GU",
  email: null,
  subject: null,
  branch: null,
  status: null,
  avatar: null,
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
      .toUpperCase() || "GU"
  );
}

function formatRoleLabel(role: AuthUser["role"]) {
  switch (role) {
    case "guru":
      return "Guru";
    case "admin":
      return "Admin";
    case "owner":
      return "Owner";
    case "siswa":
      return "Siswa";
    default:
      return "Guru";
  }
}

function buildProfileFromAuthUser(user: AuthUser): GuruTopbarProfile {
  return {
    nama: user.nama,
    role: formatRoleLabel(user.role),
    initials: getInitials(user.nama),
    email: user.email,
    subject: null,
    branch: null,
    status: null,
    avatar: user.avatar,
  };
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue : null;
}

function mergeProfileWithAuthUser(
  currentProfile: GuruTopbarProfile,
  user: AuthUser,
): GuruTopbarProfile {
  const authRole = formatRoleLabel(user.role);
  const shouldPreserveCurrentRole =
    currentProfile.role &&
    currentProfile.role !== fallbackProfile.role &&
    currentProfile.role !== authRole;

  return {
    ...currentProfile,
    nama: user.nama,
    role: shouldPreserveCurrentRole ? currentProfile.role : authRole,
    initials: getInitials(user.nama),
    email: user.email,
    avatar: user.avatar,
  };
}

function mergeProfileWithTeacherResponse(
  currentProfile: GuruTopbarProfile,
  teacher?: TeacherDashboardProfile,
): GuruTopbarProfile {
  const teacherName = normalizeOptionalText(teacher?.name);

  if (!teacherName) {
    return currentProfile;
  }

  return {
    ...currentProfile,
    nama: teacherName,
    role:
      normalizeOptionalText(teacher?.roleLabel) ??
      currentProfile.role ??
      "Guru",
    initials:
      normalizeOptionalText(teacher?.initials) ?? getInitials(teacherName),
    email: normalizeOptionalText(teacher?.email) ?? currentProfile.email,
    subject: normalizeOptionalText(teacher?.subject) ?? currentProfile.subject,
    branch: normalizeOptionalText(teacher?.branch) ?? currentProfile.branch,
    status: normalizeOptionalText(teacher?.status) ?? currentProfile.status,
    avatar: teacher?.avatar ?? currentProfile.avatar,
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

function getNotificationTypeLabel(type: TeacherNotificationItem["type"]) {
  switch (type) {
    case "schedule":
      return "Jadwal";
    case "class":
      return "Kelas";
    case "task":
      return "Latihan";
    case "tryout":
      return "Ujian";
    default:
      return "Info";
  }
}

function getNotificationBadgeVariant(type: TeacherNotificationItem["type"]) {
  switch (type) {
    case "schedule":
      return "warning";
    case "class":
      return "info";
    case "task":
      return "danger";
    case "tryout":
      return "secondary";
    default:
      return "secondary";
  }
}

export default function GuruTopbar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profile, setProfile] = useState<GuruTopbarProfile>(fallbackProfile);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [notifications, setNotifications] = useState<TeacherNotificationItem[]>(
    [],
  );
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsError, setNotificationsError] = useState<string | null>(
    null,
  );
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isUserLoading, setIsUserLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const loadCurrentUser = useEffectEvent(async () => {
    try {
      const response = await authService.me();
      const authUser = response.data?.user;

      if (authUser) {
        persistAuthUser(authUser);
        setCurrentUser(authUser);
        setProfile((currentProfile) =>
          mergeProfileWithAuthUser(currentProfile, authUser),
        );

        if (authUser.role !== "guru") {
          startTransition(() => {
            router.replace(getRedirectPathForRole(authUser.role));
            router.refresh();
          });
        }
      }
    } catch (error) {
      if (error instanceof AuthRequestError && error.status === 401) {
        clearAuthClientState();
        setCurrentUser(null);
        setProfile(fallbackProfile);
        setNotifications([]);
        setUnreadCount(0);
        return;
      }

      console.error("[guru-topbar] load_current_user_failed", error);
    } finally {
      setIsUserLoading(false);
    }
  });

  const loadTeacherProfile = useEffectEvent(async () => {
    try {
      const response = await fetch("/api/teacher/me/dashboard", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const payload = (await response
        .json()
        .catch(() => null)) as TeacherDashboardResponse | null;

      if (response.ok && payload?.success) {
        setProfile((currentProfile) =>
          mergeProfileWithTeacherResponse(
            currentProfile,
            payload.data?.teacher,
          ),
        );
        return;
      }

      if (response.status === 401) {
        clearAuthClientState();
        setCurrentUser(null);
        setProfile(fallbackProfile);
        setNotifications([]);
        setUnreadCount(0);
        return;
      }

      await loadCurrentUser();
    } catch (error) {
      console.error("[guru-topbar] load_teacher_profile_failed", error);
      await loadCurrentUser();
    }
  });

  const loadNotifications = useCallback(async () => {
    setIsNotificationsLoading(true);

    try {
      const response = await fetch("/api/teacher/me/notifications", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const payload = (await response
        .json()
        .catch(() => null)) as TeacherNotificationsResponse | null;

      if (response.ok && payload?.success) {
        const nextNotifications = payload.data?.notifications ?? [];

        setNotifications(nextNotifications);
        setUnreadCount(
          payload.data?.unreadCount ??
            nextNotifications.filter((notification) => !notification.read)
              .length,
        );
        setNotificationsError(null);
        return;
      }

      if (response.status === 401) {
        clearAuthClientState();
        setCurrentUser(null);
        setProfile(fallbackProfile);
        setNotifications([]);
        setUnreadCount(0);
        setNotificationsError("Sesi login berakhir. Silakan masuk kembali.");
        return;
      }

      setNotifications([]);
      setUnreadCount(0);
      setNotificationsError(
        payload?.message ?? "Notifikasi guru belum bisa dimuat saat ini.",
      );
    } catch (error) {
      console.error("[guru-topbar] load_notifications_failed", error);
      setNotifications([]);
      setUnreadCount(0);
      setNotificationsError("Notifikasi guru belum bisa dimuat saat ini.");
    } finally {
      setIsNotificationsLoading(false);
    }
  }, []);

  const navigateTo = useCallback(
    (href: string) => {
      setMobileOpen(false);

      startTransition(() => {
        router.push(href);
      });
    },
    [router, startTransition],
  );

  async function handleLogout() {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      await authService.logout();
    } catch (error) {
      console.error("[guru-topbar] logout_failed", error);
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

  useEffect(() => {
    queueMicrotask(() => {
      const persistedUser = readPersistedAuthUser();

      if (persistedUser) {
        setCurrentUser(persistedUser);
        setProfile(buildProfileFromAuthUser(persistedUser));
      }

      void loadCurrentUser();
      void loadTeacherProfile();
      void loadNotifications();
    });
  }, [loadNotifications]);

  const displayName = currentUser?.nama ?? profile.nama;
  const displayRole = profile.role;
  const avatarFallback = getInitials(displayName || "Guru");
  const avatarSrc = currentUser?.avatar ?? profile.avatar ?? null;
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
              href="/dashboard-guru"
              className="group flex items-center gap-3"
            >
              <Image
                src="/logobc.png"
                alt="Logo Bina Cendekia"
                width={40}
                height={40}
                className="transition group-hover:scale-105"
                priority
              />

              <div className="hidden leading-tight sm:block">
                <p className="text-sm font-bold text-white">Bina</p>
                <p className="-mt-1 text-xs text-white/80">Cendekia</p>
              </div>
            </Link>

            <nav className="hidden items-center space-x-3 md:flex">
              {menus.map((menu) => {
                const isActive = pathname === menu.path;

                return (
                  <Link
                    key={menu.path}
                    href={buildGuruUrl(menu.path, searchParams)}
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
                  aria-label="Notifikasi guru"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 ? (
                    <span className="absolute -right-2 -top-2 min-w-5 rounded-full bg-yellow-300 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-orange-900 ring-2 ring-red-500/30">
                      {notificationBadgeLabel}
                    </span>
                  ) : null}
                  <span className="sr-only">Notifikasi guru</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-[360px] p-0 sm:w-[380px]"
              >
                <div className="border-b border-slate-100 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        Notifikasi Guru
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Ringkasan aktivitas kelas dan ujian yang perlu
                        dipantau.
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
                      Memuat notifikasi guru...
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
                                  variant={getNotificationBadgeVariant(
                                    notification.type,
                                  )}
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
                      Belum ada notifikasi.
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
                  <Avatar className="size-9 border border-white/20 bg-white/10 shadow-none">
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
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel className="space-y-1 normal-case tracking-normal">
                  <p className="text-sm font-semibold text-slate-950">
                    {displayName}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setIsProfileOpen(true)}>
                  <UserRound className="size-4" />
                  Lihat Profil
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
              aria-label="Toggle menu guru"
            >
              {mobileOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="space-y-2 px-6 pb-4 md:hidden">
            {menus.map((menu) => {
              const isActive = pathname === menu.path;

              return (
                <Link
                  key={menu.path}
                  href={buildGuruUrl(menu.path, searchParams)}
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

      <GuruUserProfileDialog
        key={currentUser?._id ?? "anonymous-guru"}
        open={isProfileOpen}
        onOpenChange={setIsProfileOpen}
        user={currentUser}
        isUserLoading={isUserLoading}
        roleLabel={displayRole}
        subject={profile.subject}
        branch={profile.branch}
        status={profile.status}
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
