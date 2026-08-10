"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  FileText,
  Flame,
  Lock,
  PenSquare,
  Trophy,
  Target,
} from "lucide-react";

import {
  buildGuruApiUrl,
  buildGuruUrl,
} from "@/lib/guru-helpers";

import {
  AUTH_USER_UPDATED_EVENT,
  AuthRequestError,
  authService,
  clearAuthClientState,
  persistAuthUser,
  readPersistedAuthUser,
  type AuthUser,
} from "@/lib/auth";

type RoleTabContent = {
  title: string;
  desc: string;
  stats: string;
};

type GuruTab = {
  name: string;
  icon: LucideIcon;
  content: RoleTabContent;
  href: string;
  enabled: boolean;
};

type GuruProgram = {
  name: string;
  tabs: GuruTab[];
};

type HeaderGuruProfileState = {
  nama: string;
  subject: string;
  branch: string;
  totalClasses: number;
  todaySchedules: number;
};

type TeacherDashboardResponse = {
  success: boolean;
  message: string;
  data?: {
    teacher?: {
      name?: string;
      subject?: string;
      branch?: string;
    };
    summary?: {
      totalClasses?: number;
      todaySchedules?: number;
    };
  };
};

const accessControl = {
  jadwal: true,
  kelas: true,
  materi: true,
  tugas: true,
  tryout: true,
  evaluasi: true,
};


const fallbackHeaderProfile: HeaderGuruProfileState = {
  nama: "Guru",
  subject: "",
  branch: "",
  totalClasses: 0,
  todaySchedules: 0,
};

function buildHeaderProfileFromAuthUser(user: AuthUser): HeaderGuruProfileState {
  return {
    ...fallbackHeaderProfile,
    nama: user.nama,
  };
}

function mergeHeaderProfileWithAuthUser(
  currentProfile: HeaderGuruProfileState,
  user: AuthUser,
): HeaderGuruProfileState {
  return {
    ...currentProfile,
    nama: user.nama,
  };
}

function buildHeaderProfileFromTeacherPayload(
  payload: TeacherDashboardResponse["data"],
): HeaderGuruProfileState | null {
  const teacherName = payload?.teacher?.name?.trim();

  if (!teacherName) {
    return null;
  }

  return {
    nama: teacherName,
    subject: payload?.teacher?.subject?.trim() ?? "",
    branch: payload?.teacher?.branch?.trim() ?? "",
    totalClasses: payload?.summary?.totalClasses ?? 0,
    todaySchedules: payload?.summary?.todaySchedules ?? 0,
  };
}

function EmptyProgramState({ message }: { message: string }) {
  return (
    <div className="mt-4 flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-5 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
        <Lock className="h-4 w-4 text-slate-400" />
      </div>
      <p className="text-xs font-semibold text-slate-600">{message}</p>
      <p className="text-[11px] text-gray-400">
        Fitur ini sedang disiapkan dan akan segera tersedia untuk Anda.
      </p>
    </div>
  );
}

export default function HeaderGuruSection() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<HeaderGuruProfileState>(
    fallbackHeaderProfile,
  );

  const handleNavigation = (href: string) => {
    router.push(buildGuruUrl(href, searchParams));
  };

  const guruConfig = useMemo<GuruProgram[]>(
    () => [
      {
        name: "Manajemen Kelas",
        tabs: [
          {
            name: "Jadwal",
            icon: BookOpen,
            href: "/dashboard-guru/jadwal",
            enabled: accessControl.jadwal,
            content: {
              title: "Jadwal Mengajar",
              desc: "Pantau sesi berjalan, ruangan, dan kelas yang akan dimulai.",
              stats:
                profile.todaySchedules > 0
                  ? `${profile.todaySchedules} sesi hari ini`
                  : "Belum ada sesi hari ini",
            },
          },
          {
            name: "Semua Kelas",
            icon: FileText,
            href: "/dashboard-guru/kelas",
            enabled: accessControl.kelas,
            content: {
              title: "Kelas yang Diampu",
              desc: "Lihat ringkasan kelas, peserta, dan progres pertemuan aktif.",
              stats:
                profile.totalClasses > 0
                  ? `${profile.totalClasses} kelas aktif`
                  : "Belum ada kelas aktif",
            },
          },
        ],
      },
      {
        name: "Materi Pembelajaran",
        tabs: [
          {
            name: "Materi",
            icon: PenSquare,
            href: "/dashboard-guru/kelas",
            enabled: accessControl.materi,
            content: {
              title: "Materi Pembelajaran",
              desc: "Pilih kelas untuk mengelola materi per pertemuan, link, dan lampiran pembelajaran.",
              stats:
                profile.totalClasses > 0
                  ? `${profile.totalClasses} kelas siap dikelola`
                  : "Mulai dari Semua Kelas",
            },
          },
        ],
      },
      {
        name: "Latihan & Penilaian",
        tabs: [
          {
            name: "Latihan",
            icon: FileText,
            href: "/dashboard-guru/kelas",
            enabled: accessControl.tugas,
            content: {
              title: "Latihan dan Penilaian",
              desc: "Masuk ke daftar kelas untuk mengatur latihan per pertemuan dan progres penilaian siswa.",
              stats:
                profile.totalClasses > 0
                  ? `${profile.totalClasses} kelas siap dinilai`
                  : "Mulai dari Semua Kelas",
            },
          },
        ],
      },
      {
        name: "Evaluasi",
        tabs: [
          {
            name: "Ujian",
            icon: Trophy,
            href: "/dashboard-guru/ujian",
            enabled: accessControl.tryout,
            content: {
              title: "Program Ujian",
              desc: "Kelola UTS, UAS, dan Tryout serta cek hasil siswa dari satu panel.",
              stats: "Fitur aktif",
            },
          },
          {
            name: "Evaluasi",
            icon: Target,
            href: "/dashboard-guru/kelas",
            enabled: accessControl.evaluasi,
            content: {
              title: "Evaluasi Pembelajaran",
              desc: "Buka kelas yang diampu untuk melihat nilai latihan dan tindak lanjut evaluasi pembelajaran.",
              stats:
                profile.totalClasses > 0
                  ? `${profile.totalClasses} kelas siap dievaluasi`
                  : "Mulai dari Semua Kelas",
            },
          },
        ],
      },
    ],
    [profile.todaySchedules, profile.totalClasses],
  );

  const [program, setProgram] = useState<string>(guruConfig[0]?.name ?? "");
  const selectedProgram = useMemo(
    () => guruConfig.find((item) => item.name === program) ?? guruConfig[0],
    [guruConfig, program],
  );
  const tabs = useMemo(() => selectedProgram?.tabs ?? [], [selectedProgram]);
  const [activeTab, setActiveTab] = useState<string>(tabs[0]?.name ?? "");
  const selectedTab = tabs.find((tab) => tab.name === activeTab) ?? tabs[0];

  const loadAuthProfile = useEffectEvent(async () => {
    try {
      const response = await authService.me();

      if (response.data?.user) {
        persistAuthUser(response.data.user);
        setProfile((currentProfile) =>
          mergeHeaderProfileWithAuthUser(currentProfile, response.data!.user),
        );
      }
    } catch (error) {
      if (error instanceof AuthRequestError && error.status === 401) {
        clearAuthClientState();
        setProfile(fallbackHeaderProfile);
        return;
      }

      console.error("[header-guru-section] load_auth_profile_failed", error);
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
        const nextProfile = buildHeaderProfileFromTeacherPayload(payload.data);

        if (nextProfile) {
          setProfile(nextProfile);
        } else {
          await loadAuthProfile();
        }

        return;
      }

      if (response.status === 401) {
        clearAuthClientState();
        setProfile(fallbackHeaderProfile);
        return;
      }

      await loadAuthProfile();
    } catch (error) {
      console.error("[header-guru-section] load_teacher_profile_failed", error);
      await loadAuthProfile();
    }
  });

  useEffect(() => {
    queueMicrotask(() => {
      const persistedUser = readPersistedAuthUser();

      if (persistedUser) {
        setProfile(buildHeaderProfileFromAuthUser(persistedUser));
      }

      void loadTeacherProfile();
    });
  }, []);

  useEffect(() => {
    function handleAuthUserUpdated() {
      const persistedUser = readPersistedAuthUser();

      if (persistedUser) {
        setProfile((currentProfile) =>
          mergeHeaderProfileWithAuthUser(currentProfile, persistedUser),
        );
        return;
      }

      setProfile(fallbackHeaderProfile);
    }

    window.addEventListener(AUTH_USER_UPDATED_EVENT, handleAuthUserUpdated);

    return () => {
      window.removeEventListener(AUTH_USER_UPDATED_EVENT, handleAuthUserUpdated);
    };
  }, []);

  useEffect(() => {
    if (!tabs.some((tab) => tab.name === activeTab)) {
      setActiveTab(tabs[0]?.name ?? "");
    }
  }, [activeTab, tabs]);

  return (
    <div className="flex h-full w-full flex-col gap-5 lg:gap-6">
      <div className="relative overflow-hidden rounded-2xl border border-orange-100 bg-orange-50/50 shadow-sm">
        <div className="relative flex h-full items-center gap-4 px-4 py-4 md:px-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-100 shadow-sm">
            <Flame className="h-6 w-6 text-orange-600" />
          </div>
          <div className="overflow-hidden text-slate-800 flex-1">
            <p className="text-sm font-semibold md:text-base">
              Halo, {profile.nama}
            </p>
            <div className="overflow-hidden whitespace-nowrap mt-0.5 md:mt-1">
              <p className="text-xs text-slate-500 md:text-sm">
                Kelola kelas, materi, penilaian, dan evaluasi dari satu panel kerja yang ringkas.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-stretch">
          <div className="flex w-16 items-center justify-center bg-orange-50 md:w-20">
            <BookOpen className="h-6 w-6 text-orange-400 md:h-7 md:w-7" />
          </div>

          <div className="flex-1 px-4 py-4">
            <div className="mb-2 flex items-center gap-2">
              <Target className="h-4 w-4 text-orange-500" />
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Panel Guru
              </p>
            </div>

            <div className="relative">
              <Select
                value={selectedProgram?.name ?? ""}
                onValueChange={(value) => {
                  setProgram(value);
                  const nextProgram = guruConfig.find((item) => item.name === value);
                  setActiveTab(nextProgram?.tabs[0]?.name ?? "");
                }}
              >
                <SelectTrigger className="w-full rounded-xl border-gray-200 bg-gray-50 focus:ring-orange-100 h-11 text-sm px-4">
                  <SelectValue placeholder="Pilih Program" />
                </SelectTrigger>
                <SelectContent>
                  {guruConfig.map((item) => (
                    <SelectItem key={item.name} value={item.name}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {tabs.length > 0 ? (
              <>
                <div className="mt-4 flex flex-wrap gap-2">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;

                    return (
                      <button
                        key={tab.name}
                        type="button"
                        onClick={() => setActiveTab(tab.name)}
                        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                          activeTab === tab.name
                            ? "bg-orange-500 text-white shadow-sm"
                            : "bg-slate-50 text-slate-600 hover:bg-orange-50 hover:text-orange-600"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {tab.name}
                      </button>
                    );
                  })}
                </div>

                {selectedTab ? (
                  <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-slate-800 md:text-base">
                          {selectedTab.content.title}
                        </h3>
                        <p className="mt-1 text-xs text-slate-500 md:text-sm">
                          {selectedTab.content.desc}
                        </p>
                      </div>
                      <div className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">
                        {selectedTab.content.stats}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {selectedTab.enabled ? (
                        profile.totalClasses > 0 || selectedTab.name === "Ujian" ? (
                          <>
                            <Button
                              onClick={() => handleNavigation(selectedTab.href)}
                              className="rounded-xl bg-orange-600 hover:bg-orange-700 text-xs h-9 px-4"
                            >
                              Buka Sekarang
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => handleNavigation(selectedTab.href)}
                              className="rounded-xl text-xs h-9 px-4 border-slate-200 hover:bg-slate-50"
                            >
                              Lihat Detail
                            </Button>
                          </>
                        ) : null
                      ) : (
                        <Button
                          variant="outline"
                          disabled
                          className="rounded-xl border-orange-200 bg-orange-50 text-orange-700 h-10 md:h-11 px-5 md:px-6 font-semibold opacity-70"
                        >
                          <Lock className="h-4 w-4 mr-2" />
                          Menunggu Integrasi
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <EmptyProgramState message="Belum ada menu aktif untuk program ini." />
                )}
              </>
            ) : (
              <EmptyProgramState message="Belum ada tab yang tersedia untuk program ini." />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
