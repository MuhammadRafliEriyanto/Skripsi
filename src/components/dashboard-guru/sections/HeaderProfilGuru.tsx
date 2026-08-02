"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useState } from "react";
import { BookOpen, CalendarDays, ClipboardCheck, MapPin } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AUTH_USER_UPDATED_EVENT,
  AuthRequestError,
  authService,
  clearAuthClientState,
  persistAuthUser,
  readPersistedAuthUser,
  type AuthUser,
} from "@/lib/auth";
import { useSearchParams } from "next/navigation";
import { buildGuruApiUrl, buildGuruUrl } from "@/lib/guru-helpers";

const headerBackgrounds = [
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee",
  "https://images.unsplash.com/photo-1470770841072-f978cf4d019e",
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e",
];

type HeaderProfilGuruState = {
  nama: string;
  role: string;
  initials: string;
  avatar: string | null;
  subject: string;
  totalStudentsLabel: string;
  status: string;
  activeClassesLabel: string;
  totalClasses: number;
};

type TodayScheduleItem = {
  id: string;
  kelasId: string;
  waktu: string;
  kelas: string;
  mapel: string;
  lokasi: string;
};

type TeacherDashboardClass = {
  id?: string;
  classId?: string;
  className?: string;
  mapel?: string;
  day?: string;
  time?: string;
  room?: string;
};

type TeacherDashboardResponse = {
  success: boolean;
  message: string;
  data?: {
    teacher?: {
      name?: string;
      roleLabel?: string;
      initials?: string;
      avatar?: string | null;
      subject?: string;
      status?: string;
      activeClasses?: number;
    };
    classes?: TeacherDashboardClass[];
    summary?: {
      totalClasses?: number;
      totalStudents?: number;
      todaySchedules?: number;
    };
  };
};

const fallbackProfile: HeaderProfilGuruState = {
  nama: "Guru",
  role: "Memuat profil...",
  initials: "GU",
  avatar: null,
  subject: "-",
  totalStudentsLabel: "-",
  status: "-",
  activeClassesLabel: "-",
  totalClasses: 0,
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

function buildProfileFromAuthUser(user: AuthUser): HeaderProfilGuruState {
  return {
    nama: user.nama,
    role: formatRoleLabel(user.role),
    initials: getInitials(user.nama),
    avatar: user.avatar,
    subject: "-",
    totalStudentsLabel: "-",
    status: "-",
    activeClassesLabel: "-",
    totalClasses: 0,
  };
}

function mergeProfileWithAuthUser(
  currentProfile: HeaderProfilGuruState,
  user: AuthUser,
): HeaderProfilGuruState {
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
    avatar: user.avatar,
  };
}

function getCurrentIndonesianDay() {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    timeZone: "Asia/Jakarta",
  }).format(new Date());
}

function toMinuteValue(timeRange: string) {
  const [startTime = "00:00"] = timeRange.split("-").map((item) => item.trim());
  const normalized = startTime.replace(".", ":");
  const [hour, minute] = normalized.split(":").map((value) => Number(value));

  return hour * 60 + minute;
}

function buildTodaySchedules(
  classes?: TeacherDashboardClass[],
) {
  if (!classes || !Array.isArray(classes)) {
    return [];
  }

  const todayLabel = getCurrentIndonesianDay().trim().toLowerCase();

  return classes
    .filter((item) => item?.day?.trim().toLowerCase() === todayLabel)
    .sort((left, right) => {
      const leftTime = left?.time ?? "00:00";
      const rightTime = right?.time ?? "00:00";
      return toMinuteValue(leftTime) - toMinuteValue(rightTime);
    })
    .map((item, index) => ({
      id: item?.id?.trim() || `today-schedule-${index}`,
      kelasId: item?.classId?.trim() || "",
      waktu: item?.time?.trim() ? `${item.time.trim()} WIB` : "Jadwal belum diatur",
      kelas: item?.className?.trim() || "Kelas belum diatur",
      mapel: item?.mapel?.trim() || "Mapel belum diatur",
      lokasi: item?.room?.trim() || "Ruangan belum diatur",
    }));
}

function buildProfileFromTeacherPayload(
  payload: TeacherDashboardResponse["data"],
): HeaderProfilGuruState | null {
  const teacher = payload?.teacher;
  const teacherName = teacher?.name?.trim();

  if (!teacherName) {
    return null;
  }

  const totalClasses =
    payload?.summary?.totalClasses ??
    teacher?.activeClasses ??
    0;
  const totalStudents = payload?.summary?.totalStudents ?? 0;

  return {
    nama: teacherName,
    role: teacher?.roleLabel?.trim() || "Guru",
    initials: teacher?.initials?.trim() || getInitials(teacherName),
    avatar: teacher?.avatar ?? null,
    subject: teacher?.subject?.trim() || "-",
    totalStudentsLabel:
      totalStudents > 0 ? `${totalStudents} siswa` : "Belum ada siswa",
    status: teacher?.status?.trim() || "-",
    activeClassesLabel:
      totalClasses > 0 ? `${totalClasses} kelas` : "Belum ada kelas",
    totalClasses,
  };
}

export default function HeaderProfilGuru() {
  const searchParams = useSearchParams();
  const [bgImage, setBgImage] = useState(headerBackgrounds[0]);
  const [profile, setProfile] =
    useState<HeaderProfilGuruState>(fallbackProfile);
  const [todaySchedules, setTodaySchedules] = useState<TodayScheduleItem[]>([]);

  const loadAuthProfile = useEffectEvent(async () => {
    try {
      const response = await authService.me();

      if (response.data?.user) {
        persistAuthUser(response.data.user);
        setProfile((currentProfile) =>
          mergeProfileWithAuthUser(currentProfile, response.data!.user),
        );
      }
    } catch (error) {
      if (error instanceof AuthRequestError && error.status === 401) {
        clearAuthClientState();
        setProfile(fallbackProfile);
        setTodaySchedules([]);
        return;
      }

      console.error("[header-profil-guru] load_auth_profile_failed", error);
    }
  });

  const loadTeacherProfile = useEffectEvent(async () => {
    try {
      const response = await fetch(buildGuruApiUrl("/api/teacher/me/dashboard", searchParams), {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | TeacherDashboardResponse
        | null;

      if (response.ok && payload?.success) {
        const nextProfile = buildProfileFromTeacherPayload(payload.data);

        if (nextProfile) {
          setProfile(nextProfile);
        } else {
          await loadAuthProfile();
        }

        setTodaySchedules(buildTodaySchedules(payload.data?.classes));
        return;
      }

      if (response.status === 401) {
        clearAuthClientState();
        setProfile(fallbackProfile);
        setTodaySchedules([]);
        return;
      }

      await loadAuthProfile();
      setTodaySchedules([]);
    } catch (error) {
      console.error("[header-profil-guru] load_teacher_profile_failed", error);
      await loadAuthProfile();
      setTodaySchedules([]);
    }
  });

  useEffect(() => {
    queueMicrotask(() => {
      setBgImage(
        headerBackgrounds[Math.floor(Math.random() * headerBackgrounds.length)] ??
          headerBackgrounds[0],
      );

      const persistedUser = readPersistedAuthUser();

      if (persistedUser) {
        setProfile(buildProfileFromAuthUser(persistedUser));
      }

      void loadTeacherProfile();
    });
  }, [searchParams]);

  useEffect(() => {
    function handleAuthUserUpdated() {
      const persistedUser = readPersistedAuthUser();

      if (persistedUser) {
        setProfile((currentProfile) =>
          mergeProfileWithAuthUser(currentProfile, persistedUser),
        );
        return;
      }

      setProfile(fallbackProfile);
      setTodaySchedules([]);
    }

    window.addEventListener(AUTH_USER_UPDATED_EVENT, handleAuthUserUpdated);

    return () => {
      window.removeEventListener(AUTH_USER_UPDATED_EVENT, handleAuthUserUpdated);
    };
  }, []);

  return (
    <div className="flex h-full flex-col gap-4">
      <section className="overflow-hidden rounded-[24px] border border-slate-100 bg-white shadow-sm">
        <div
          className="relative flex items-center gap-4 overflow-hidden px-4 py-4 text-white md:px-5"
          style={{
            backgroundImage: `url(${bgImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-red-600/90 to-orange-500/90" />

          <div className="relative flex w-full items-center gap-4">
            <Avatar className="h-14 w-14 shrink-0 rounded-full border border-white/20 bg-white/10 shadow-none">
              {profile.avatar ? (
                <AvatarImage
                  src={profile.avatar}
                  alt={`Foto profil ${profile.nama}`}
                />
              ) : null}
              <AvatarFallback className="bg-white text-lg font-bold text-orange-700">
                {profile.initials}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold md:text-base">
                {profile.nama}
              </p>
              <p className="mt-1 text-xs text-white/90 md:text-sm">
                {profile.role}
              </p>
            </div>
          </div>
        </div>

        <div className="text-xs md:text-sm">
          {[
            ["Mapel", profile.subject],
            ["Status", profile.status],
            ["Kelas Aktif", profile.activeClassesLabel],
            ["Total Siswa", profile.totalStudentsLabel],
          ].map(([label, value]) => (
            <div
              key={label}
              className="flex items-center justify-between border-b border-slate-100 px-4 py-3 last:border-none md:px-5"
            >
              <span className="text-slate-500">{label}</span>
              <span
                className={`text-right font-medium ${
                  label === "Status" ? "text-orange-600" : "text-slate-800"
                }`}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-[24px] border border-slate-100 bg-white shadow-sm">
        <div className="h-1 bg-gradient-to-r from-red-600 via-orange-500 to-orange-400" />

        <div className="flex h-full flex-col p-4 md:p-5">
          <div className="mb-4">
            <h3 className="text-xs font-semibold text-slate-700 md:text-sm">
              Jadwal Guru Hari Ini
            </h3>
            <p className="mt-1 text-[11px] text-slate-500">
              {todaySchedules.length > 0
                ? `${todaySchedules.length} sesi terjadwal untuk hari ini.`
                : profile.totalClasses === 0
                ? "Belum ada jadwal mengajar di tahun ajaran ini."
                : "Belum ada jadwal mengajar untuk hari ini."}
            </p>
          </div>

          {todaySchedules.length > 0 ? (
            <div className="space-y-3 overflow-y-auto pr-1">
              {todaySchedules.map((item) => (
                <Link
                  key={item.id}
                  href={buildGuruUrl(
                    item.kelasId ? "/dashboard-guru/absensi-kelas" : "/dashboard-guru/jadwal",
                    searchParams,
                    item.kelasId ? { kelasId: item.kelasId } : undefined,
                  )}
                  className="group block rounded-xl border border-slate-100 bg-white p-3 transition hover:-translate-y-0.5 hover:border-orange-200 hover:bg-orange-50/40 hover:shadow-sm"
                >
                  <p className="text-[11px] font-semibold text-orange-600 md:text-xs">
                    {item.waktu}
                  </p>

                  <h4 className="mt-1 text-sm font-semibold text-slate-800 md:text-base">
                    {item.kelas}
                  </h4>

                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500 md:text-xs">
                    <span className="inline-flex items-center gap-1">
                      <BookOpen className="h-3.5 w-3.5 text-orange-500" />
                      {item.mapel}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-orange-500" />
                      {item.lokasi}
                    </span>
                  </div>

                  <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-orange-700 transition group-hover:text-orange-800 md:text-xs">
                    <ClipboardCheck className="h-3.5 w-3.5" />
                    {item.kelasId ? "Mulai Absen" : "Lihat Jadwal"}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/50 p-5 text-center">
              <CalendarDays className="mx-auto h-5 w-5 text-orange-400" />
              <p className="mt-2 text-xs font-semibold text-orange-600">
                {profile.totalClasses === 0
                  ? "Belum ada jadwal mengajar di tahun ajaran ini."
                  : "Belum ada jadwal mengajar untuk hari ini."}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {profile.totalClasses === 0
                  ? "Silakan pilih periode akademik yang aktif."
                  : "Cek halaman jadwal untuk melihat sesi di hari lain."}
              </p>
            </div>
          )}

          {profile.totalClasses > 0 && (
            <Link
              href={buildGuruUrl("/dashboard-guru/jadwal", searchParams)}
              className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-dashed border-orange-200 bg-orange-50/60 px-4 py-3 text-xs font-semibold text-orange-700 transition hover:bg-orange-100/70"
            >
              <CalendarDays className="h-4 w-4" />
              Buka halaman jadwal lengkap
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
