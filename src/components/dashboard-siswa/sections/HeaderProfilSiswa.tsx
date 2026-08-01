/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useState } from "react";
import { Building2, CalendarDays, MapPin, Target, UserRound } from "lucide-react";

import {
  AuthRequestError,
  authService,
  clearAuthClientState,
  persistAuthUser,
  readPersistedAuthUser,
  type AuthUser,
} from "@/lib/auth";
import {
  MembershipRequestError,
  membershipService,
  type MembershipStatusData,
} from "@/lib/subscription";

import type { StudentDashboardData } from "../data/useStudentDashboardData";
import { getStudentAcademicAccessMessage } from "../data/studentAcademicAccess";
import { getUtbkTrackLabel, isUtbkStudentProfile } from "../data/studentProgram";
import { subscribeStudentDashboardRefresh } from "../student-dashboard-refresh-events";

type StudentProfile = {
  name: string;
  initials: string;
  className: string;
  studentStatus: string;
  membershipValue: string;
  program: string;
  paymentValue: string;
  isUtbkStudent: boolean;
  utbkTrack: string;
  targetKampus: string;
  targetJurusan: string;
};

type SubjectSchedule = {
  id: string;
  day: string;
  time: string;
  subject: string;
  teacher: string;
  room: string;
};

type HeaderProfilSiswaProps = {
  dashboardData: StudentDashboardData | null;
  dashboardLoading?: boolean;
  dashboardError?: string | null;
};

type MembershipPaymentProfile = NonNullable<MembershipStatusData["payment"]>;

const profileBackgrounds = [
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee",
  "https://images.unsplash.com/photo-1470770841072-f978cf4d019e",
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e",
];

const fallbackStudentProfile: StudentProfile = {
  name: "Siswa",
  initials: "SI",
  className: "Kelas belum tersedia",
  studentStatus: "Memuat",
  membershipValue: "Memuat",
  program: "Program belum tersedia",
  paymentValue: "Menunggu data",
  isUtbkStudent: false,
  utbkTrack: "",
  targetKampus: "",
  targetJurusan: "",
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

function pickRandomBackground() {
  return profileBackgrounds[Math.floor(Math.random() * profileBackgrounds.length)];
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

function formatAccessStatusLabel(
  accessStatus: MembershipStatusData["accessStatus"] | undefined,
) {
  switch (accessStatus) {
    case "active":
      return "Membership Aktif";
    case "expiring":
      return "Membership Hampir Berakhir";
    case "pending":
      return "Menunggu Pembayaran";
    case "expired":
      return "Membership Berakhir";
    case "not_registered":
      return "Belum Ada Membership";
    default:
      return "Menunggu data";
  }
}

function buildPaymentSummary(
  payment: MembershipPaymentProfile | null | undefined,
  accessStatus: MembershipStatusData["accessStatus"] | undefined,
) {
  if (payment?.status === "paid") {
    return "Lunas";
  }

  if (payment?.status === "pending") {
    return "Menunggu";
  }

  if (payment?.status === "failed") {
    return "Gagal";
  }

  if (accessStatus === "active") {
    return "Aman";
  }

  return "Tidak Ada";
}

function buildProfileFromAuthUser(user: AuthUser): StudentProfile {
  return {
    name: user.nama,
    initials: getInitials(user.nama),
    className: "Kelas belum tersedia",
    studentStatus: formatRoleLabel(user.role),
    membershipValue: "Menunggu data",
    program: "Program belum tersedia",
    paymentValue: "Menunggu data",
    isUtbkStudent: false,
    utbkTrack: "",
    targetKampus: "",
    targetJurusan: "",
  };
}

function buildProfileFromMembershipData(data?: MembershipStatusData | null) {
  const student = data?.student;
  const user = data?.user;
  const resolvedName = student?.name?.trim() || user?.nama?.trim();

  if (!resolvedName) {
    return null;
  }

  const isUtbkStudent = isUtbkStudentProfile(student);

  return {
    name: resolvedName,
    initials: getInitials(resolvedName),
    className: isUtbkStudent
      ? getUtbkTrackLabel(student)
      : student?.className?.trim() || "Kelas belum tersedia",
    studentStatus: student?.status?.trim() || "Siswa",
    membershipValue: formatAccessStatusLabel(data?.accessStatus),
    program: isUtbkStudent
      ? "UTBK / Program SNBT Intensif"
      : student?.program?.trim() || "Program belum tersedia",
    paymentValue: buildPaymentSummary(data?.payment, data?.accessStatus),
    isUtbkStudent,
    utbkTrack: student?.utbkTrack?.trim() || "",
    targetKampus: student?.targetKampus?.trim() || "",
    targetJurusan: student?.targetJurusan?.trim() || "",
  } satisfies StudentProfile;
}

const highlightedProfileLabels = new Set([
  "Status Siswa",
  "Akses Membership",
  "Tagihan",
]);

export default function HeaderProfilSiswa({
  dashboardData,
  dashboardLoading = false,
  dashboardError = null,
}: HeaderProfilSiswaProps) {
  const [bgImage, setBgImage] = useState(profileBackgrounds[0]);
  const [profile, setProfile] = useState<StudentProfile>(fallbackStudentProfile);

  const loadAuthProfile = useEffectEvent(async () => {
    try {
      const response = await authService.me();

      if (response.data?.user) {
        persistAuthUser(response.data.user);
        setProfile(buildProfileFromAuthUser(response.data.user));
      }
    } catch (error) {
      if (error instanceof AuthRequestError && error.status === 401) {
        clearAuthClientState();
        setProfile(fallbackStudentProfile);
        return;
      }

      console.error("[header-profil-siswa] load_auth_profile_failed", error);
    }
  });

  const loadStudentProfile = useEffectEvent(async () => {
    try {
      const response = await membershipService.getMySubscription();
      const membershipProfile = buildProfileFromMembershipData(response.data);

      if (membershipProfile) {
        setProfile(membershipProfile);
        return;
      }

      await loadAuthProfile();
    } catch (error) {
      if (
        error instanceof MembershipRequestError &&
        (error.status === 401 || error.status === 403)
      ) {
        console.warn("[header-profil-siswa] membership_profile_unavailable", {
          status: error.status,
          errorCode: error.errorCode,
        });
        setProfile(fallbackStudentProfile);
        return;
      }

      console.error("[header-profil-siswa] load_membership_profile_failed", error);
      await loadAuthProfile();
    }
  });

  useEffect(() => {
    setBgImage(pickRandomBackground());

    queueMicrotask(() => {
      const persistedUser = readPersistedAuthUser();

      if (persistedUser) {
        setProfile(buildProfileFromAuthUser(persistedUser));
      }

      void loadStudentProfile();
    });
  }, []);

  useEffect(() => {
    return subscribeStudentDashboardRefresh(() => {
      void loadStudentProfile();
    });
  }, []);

  const subjectSchedules: SubjectSchedule[] =
    dashboardData?.schedules?.map((schedule) => ({
      id: schedule.id,
      day: schedule.day,
      time: schedule.time,
      subject: schedule.subject,
      teacher: schedule.teacher,
      room: schedule.room,
    })) ?? [];
  const visibleSubjectSchedules = subjectSchedules.slice(0, 3);
  const academicAccessMessage = getStudentAcademicAccessMessage(
    dashboardData?.academicAccess,
  );
  const dashboardStudent = dashboardData?.student;
  const isUtbkDashboard =
    isUtbkStudentProfile(dashboardStudent) || profile.isUtbkStudent;
  const utbkTrackLabel = dashboardStudent
    ? getUtbkTrackLabel(dashboardStudent)
    : profile.utbkTrack || "Program SNBT";
  const targetKampus =
    dashboardStudent?.targetKampus?.trim() ||
    profile.targetKampus ||
    "Target kampus belum diisi";
  const targetJurusan =
    dashboardStudent?.targetJurusan?.trim() ||
    profile.targetJurusan ||
    "Target jurusan belum diisi";

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
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-lg font-bold shadow-none">
              {profile.initials}
            </div>

            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold md:text-base">
                {profile.name}
              </p>
              <p className="mt-1 text-xs text-white/90 md:text-sm">
                {profile.membershipValue}
              </p>
            </div>
          </div>
        </div>

        <div className="text-xs md:text-sm">
          {[
            ["Program", profile.program],
            ["Status Siswa", profile.studentStatus],
            ["Akses Membership", profile.membershipValue],
            [isUtbkDashboard ? "Status Peserta" : "Kelas", profile.className],
            ["Tagihan", profile.paymentValue],
          ].map(([label, value]) => (
            <div
              key={label}
              className="flex items-center justify-between border-b border-slate-100 px-4 py-3 last:border-none md:px-5"
            >
              <span className="text-slate-500">{label}</span>
              <span
                className={`text-right font-medium ${
                  highlightedProfileLabels.has(label)
                    ? "text-orange-600"
                    : "text-slate-800"
                }`}
              >
                {value}
              </span>
            </div>
          ))}
        </div>

        {academicAccessMessage ? (
          <div className="border-t border-orange-100 bg-orange-50/70 px-4 py-3 text-xs leading-5 text-orange-700 md:px-5">
            <p className="font-semibold">Kelas berikutnya sudah siap</p>
            <p className="mt-1 text-orange-700/85">{academicAccessMessage}</p>
          </div>
        ) : null}
      </section>

      {isUtbkDashboard ? (
        <section className="overflow-hidden rounded-[24px] border border-orange-100 bg-white shadow-sm">
          <div className="h-1 bg-gradient-to-r from-red-600 via-orange-500 to-amber-400" />
          <div className="p-4 md:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
                  <Target className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">
                    Fokus UTBK/SNBT
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {utbkTrackLabel} difokuskan ke jadwal kelas, materi, dan tryout UTBK.
                  </p>
                </div>
              </div>

              <Link
                href="/dashboard-siswa/jadwal"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-[11px] font-semibold text-orange-700 transition hover:bg-orange-100"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Lihat Jadwal
              </Link>
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-600">
                  <Building2 className="h-3.5 w-3.5" />
                  Target Kampus
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {targetKampus}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-600">
                  Target Jurusan
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {targetJurusan}
                </p>
              </div>
            </div>

            <div className="mt-4">
              <Link
                href="/dashboard-siswa/materi"
                className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-orange-600 px-4 text-sm font-semibold text-white transition hover:bg-orange-700"
              >
                Buka Kelas UTBK
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <section
          id="jadwal-mata-pelajaran"
          className="overflow-hidden rounded-[24px] border border-slate-100 bg-white shadow-sm"
        >
        <div className="h-1 bg-gradient-to-r from-red-600 via-orange-500 to-orange-400" />

        <div className="flex h-full flex-col p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold text-slate-700 md:text-sm">
                Jadwal Mata Pelajaran
              </h3>
              <p className="mt-1 text-[11px] text-slate-500">
                {dashboardLoading
                  ? "Memuat jadwal pelajaran siswa..."
                  : subjectSchedules.length > 0
                    ? `${subjectSchedules.length} sesi tersedia untuk dipantau.`
                    : academicAccessMessage ??
                      "Belum ada jadwal pelajaran untuk saat ini."}
              </p>
            </div>

            <Link
              href="/dashboard-siswa/jadwal"
              className="text-[10px] font-medium text-orange-600 transition hover:text-orange-700 md:text-xs"
            >
              Lihat Semua Jadwal
            </Link>
          </div>

          {dashboardLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="h-20 animate-pulse rounded-xl border border-slate-200 bg-slate-50"
                />
              ))}
            </div>
          ) : subjectSchedules.length > 0 ? (
            <div className="space-y-3 overflow-y-auto pr-1">
              {visibleSubjectSchedules.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-100 bg-white p-3 transition hover:border-orange-100 hover:shadow-sm"
                >
                  <p className="text-[11px] font-semibold text-orange-600 md:text-xs">
                    {item.time}
                  </p>

                  <h4 className="mt-1 text-sm font-semibold text-slate-800 md:text-base">
                    {item.subject}
                  </h4>

                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500 md:text-xs">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5 text-orange-500" />
                      {item.day}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <UserRound className="h-3.5 w-3.5 text-orange-500" />
                      {item.teacher}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-orange-500" />
                      {item.room}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/50 p-5 text-center">
              <CalendarDays className="mx-auto h-5 w-5 text-orange-400" />
              <p className="mt-2 text-xs font-semibold text-orange-600">
                Belum ada jadwal pelajaran untuk saat ini.
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {academicAccessMessage ??
                  dashboardError ??
                  "Jadwal kelas akan tampil otomatis sesuai kelas siswa yang sedang login."}
              </p>
            </div>
          )}

          <Link
            href="/dashboard-siswa/jadwal"
            className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-dashed border-orange-200 bg-orange-50/60 px-4 py-3 text-xs font-semibold text-orange-700 transition hover:bg-orange-100/70"
          >
            <CalendarDays className="h-4 w-4" />
            Buka halaman jadwal lengkap
          </Link>
        </div>
        </section>
      )}
    </div>
  );
}
