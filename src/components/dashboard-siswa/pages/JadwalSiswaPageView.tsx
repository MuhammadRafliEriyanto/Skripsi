"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {

  BookOpenText,
  CalendarCheck2,
  CalendarDays,
  ChevronRight,
  Clock3,
  GraduationCap,
  MapPin,
  School,
  UserRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import {
  useStudentDashboardData,
  type StudentDashboardSchedule,
} from "../data/useStudentDashboardData";
import { getStudentAcademicAccessMessage } from "../data/studentAcademicAccess";

const WEEK_DAYS = [
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
  "Minggu",
] as const;

type ScheduleBadgeVariant = "info" | "success" | "warning" | "danger";

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function getCurrentIndonesianDay() {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    timeZone: "Asia/Jakarta",
  }).format(new Date());
}

function getScheduleBadge(status: string): {
  label: string;
  variant: ScheduleBadgeVariant;
} {
  const normalizedStatus = normalizeText(status).toLowerCase();

  if (normalizedStatus === "berjalan") {
    return { label: "Berjalan", variant: "success" };
  }

  if (normalizedStatus === "review") {
    return { label: "Review", variant: "warning" };
  }

  if (normalizedStatus === "bentrok") {
    return { label: "Perlu Cek", variant: "danger" };
  }

  return {
    label: normalizeText(status) || "Terjadwal",
    variant: "info",
  };
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article className="group rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-orange-100 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 group-hover:text-orange-500 transition-colors">
            {label}
          </p>
          <p className="mt-2 text-xl font-semibold text-slate-800 group-hover:text-orange-600 transition-colors">{value}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{note}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-orange-50 bg-orange-50 text-orange-600 transition-transform duration-300 group-hover:scale-110 group-hover:bg-orange-100">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </article>
  );
}

function ScheduleDetailItem({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="flex items-start gap-3 rounded-[16px] border border-slate-100 bg-slate-50/70 px-3.5 py-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-orange-600 shadow-sm border border-slate-100">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          {label}
        </p>
        <p className="mt-1 break-words text-sm font-semibold text-slate-700">
          {value}
        </p>
      </div>
    </div>
  );
}

function ScheduleLoadingState() {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
      <div className="space-y-3 rounded-[26px] border border-slate-100 bg-white p-5 shadow-sm">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-[16px] bg-slate-50"
          />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-[26px] border border-slate-100 bg-slate-50 shadow-sm" />
    </div>
  );
}

export default function JadwalSiswaPageView() {
  const { dashboardData, isLoading, loadError } = useStudentDashboardData();
  const [selectedDay, setSelectedDay] = useState("Semua");
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(
    null,
  );

  const schedules = dashboardData?.schedules ?? [];
  const todaySchedules = dashboardData?.todaySchedules ?? [];
  const currentDay = getCurrentIndonesianDay();
  const availableDays = WEEK_DAYS.filter((day) =>
    schedules.some(
      (schedule) =>
        normalizeText(schedule.day).toLowerCase() === day.toLowerCase(),
    ),
  );
  const filteredSchedules =
    selectedDay === "Semua"
      ? schedules
      : schedules.filter(
          (schedule) =>
            normalizeText(schedule.day).toLowerCase() ===
            selectedDay.toLowerCase(),
        );
  const selectedSchedule =
    filteredSchedules.find(
      (schedule) => schedule.id === selectedScheduleId,
    ) ??
    filteredSchedules[0] ??
    schedules[0] ??
    null;
  const uniqueSubjectCount = new Set(
    schedules.map((schedule) => normalizeText(schedule.subject)).filter(Boolean),
  ).size;
  const student = dashboardData?.student;
  const academicAccessMessage = getStudentAcademicAccessMessage(
    dashboardData?.academicAccess,
  );

  function selectDay(day: string) {
    setSelectedDay(day);
    setSelectedScheduleId(null);
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <div className="space-y-5">
        <header className="relative overflow-hidden rounded-[28px] border border-orange-100 bg-gradient-to-br from-orange-50/80 to-white shadow-sm md:flex-row md:items-center md:justify-between md:p-6 p-5">
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between z-10">
            <div className="max-w-3xl">
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-orange-600">
                Agenda Belajar
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-900 md:text-3xl">
                Jadwal Mata Pelajaran
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Pantau seluruh sesi mingguan, guru pengajar, ruangan, dan
                detail kelas dalam satu halaman yang ringkas.
              </p>
            </div>

            <div className="w-fit rounded-[20px] border border-orange-100/60 bg-white/60 backdrop-blur px-4 py-3 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Kelas Aktif
              </p>
              <p className="mt-1 text-base font-semibold text-slate-800">
                {student?.className || "Kelas belum tersedia"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {student?.branch || "Cabang belum tersedia"}
              </p>
            </div>
          </div>
          
          {/* Decorative soft elements */}
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-orange-100/30 blur-3xl" />
          <div className="absolute -bottom-20 left-1/4 h-48 w-48 rounded-full bg-orange-50/50 blur-2xl" />
        </header>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={CalendarDays}
            label="Total Sesi"
            value={`${schedules.length}`}
            note="Jadwal belajar dalam satu minggu."
          />
          <SummaryCard
            icon={CalendarCheck2}
            label={`Hari Ini · ${currentDay}`}
            value={`${todaySchedules.length}`}
            note="Sesi yang terjadwal untuk hari ini."
          />
          <SummaryCard
            icon={BookOpenText}
            label="Mata Pelajaran"
            value={`${uniqueSubjectCount}`}
            note="Mapel aktif pada jadwal kelas kamu."
          />
          <SummaryCard
            icon={GraduationCap}
            label="Program"
            value={student?.program || "-"}
            note={student?.className || "Kelas belum tersedia"}
          />
        </div>

        {isLoading ? (
          <ScheduleLoadingState />
        ) : schedules.length === 0 ? (
          <section className="rounded-[26px] border border-dashed border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
              <CalendarDays className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-800">
              Belum ada jadwal pelajaran
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
              {academicAccessMessage ??
                loadError ??
                "Jadwal akan tampil otomatis setelah kelas dan cabang siswa memiliki jadwal aktif."}
            </p>
          </section>
        ) : (
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
            <section className="rounded-[26px] border border-slate-100 bg-white p-4 shadow-sm md:p-5">
              <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-600">
                    Jadwal Mingguan
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-800">
                    Pilih hari dan sesi belajar
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Klik salah satu sesi untuk melihat detail lengkapnya.
                  </p>
                </div>
                <Badge variant="info" className="w-fit">
                  {filteredSchedules.length} sesi
                </Badge>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {["Semua", ...availableDays].map((day) => {
                  const isActive = selectedDay === day;

                  return (
                    <Button
                      key={day}
                      type="button"
                      onClick={() => selectDay(day)}
                      className={cn(
                        "rounded-xl border px-3.5 py-2 text-xs font-semibold transition",
                        isActive
                          ? "border-orange-500 bg-orange-500 text-white shadow-sm"
                          : "border-slate-100 bg-slate-50/50 text-slate-600 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700",
                      )}
                    >
                      {day}
                    </Button>
                  );
                })}
              </div>

              <div className="mt-4 space-y-3">
                {filteredSchedules.map((schedule) => {
                  const isSelected = schedule.id === selectedSchedule?.id;
                  const badge = getScheduleBadge(schedule.status);
                  const isToday =
                    normalizeText(schedule.day).toLowerCase() ===
                    currentDay.toLowerCase();

                  return (
                    <Button
                      key={schedule.id}
                      type="button"
                      onClick={() => setSelectedScheduleId(schedule.id)}
                      className={cn(
                        "group flex w-full flex-col gap-4 rounded-[20px] border p-4 text-left transition-all duration-300 sm:flex-row sm:items-center",
                        isSelected
                          ? "border-slate-200 bg-slate-50/30 shadow-sm"
                          : "border-slate-100 bg-white hover:-translate-y-1 hover:border-orange-300 hover:shadow-lg hover:shadow-orange-100/50",
                      )}
                    >
                      <div className="flex w-full items-center gap-3 sm:w-32 sm:flex-col sm:items-start">
                        <div className={cn(
                          "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border transition-all duration-300",
                          isSelected
                            ? "border-slate-200 bg-slate-50 text-slate-600"
                            : "border-slate-100 bg-slate-50 text-slate-400"
                        )}>
                          <Clock3 className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 transition-colors">
                            {schedule.day}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-slate-700">
                            {schedule.time}
                          </p>
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold text-slate-800 transition-colors">
                            {schedule.subject}
                          </h3>
                          <Badge
                            variant={badge.variant}
                            className="px-2 py-0.5 text-[10px]"
                          >
                            {badge.label}
                          </Badge>
                          {isToday ? (
                            <Badge
                              variant="warning"
                              className="px-2 py-0.5 text-[10px]"
                            >
                              Hari Ini
                            </Badge>
                          ) : null}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1.5 transition-colors">
                            <UserRound className="h-3.5 w-3.5 text-slate-400 transition-colors" />
                            {schedule.teacher}
                          </span>
                          <span className="inline-flex items-center gap-1.5 transition-colors">
                            <MapPin className="h-3.5 w-3.5 text-slate-400 transition-colors" />
                            {schedule.room}
                          </span>
                          <span className="inline-flex items-center gap-1.5 transition-colors">
                            <School className="h-3.5 w-3.5 text-slate-400 transition-colors" />
                            {schedule.className}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0">
                        <Link
                          href={`/dashboard-siswa/scan-absen?scheduleId=${schedule.id}`}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all duration-300",
                            isSelected
                              ? "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                              : "bg-slate-50 text-slate-400 group-hover:bg-orange-500 group-hover:text-white group-hover:shadow-sm group-hover:-translate-x-1",
                          )}
                          onClick={(e) => e.stopPropagation()}
                        >
                          Mulai Absen
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </Button>
                  );
                })}
              </div>
            </section>

            <aside className="lg:sticky lg:top-24">
              {selectedSchedule ? (
                <ScheduleDetailPanel schedule={selectedSchedule} />
              ) : null}
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}

function ScheduleDetailPanel({
  schedule,
}: {
  schedule: StudentDashboardSchedule;
}) {
  const badge = getScheduleBadge(schedule.status);

  return (
    <section className="overflow-hidden rounded-[26px] border border-slate-100 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-600">
              Detail Sesi
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-800">
              {schedule.subject}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {schedule.day}, {schedule.time}
            </p>
          </div>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>
      </div>

      <div className="grid gap-3 p-4 md:p-5">
        <ScheduleDetailItem
          icon={CalendarDays}
          label="Jadwal"
          value={`${schedule.day}, ${schedule.time}`}
        />
        <ScheduleDetailItem
          icon={UserRound}
          label="Guru Pengajar"
          value={schedule.teacher}
        />
        <ScheduleDetailItem
          icon={MapPin}
          label="Ruangan"
          value={schedule.room}
        />
        <ScheduleDetailItem
          icon={GraduationCap}
          label="Kelas"
          value={schedule.className}
        />
        <ScheduleDetailItem
          icon={School}
          label="Cabang"
          value={schedule.branch || "-"}
        />

        <div className="rounded-[16px] border border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Referensi Sesi
          </p>
          <p className="mt-1 break-all text-sm font-semibold text-slate-700">
            {schedule.id}
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Jadwal ini berasal dari kelas dan cabang siswa yang sedang login.
          </p>
        </div>
      </div>
    </section>
  );
}
