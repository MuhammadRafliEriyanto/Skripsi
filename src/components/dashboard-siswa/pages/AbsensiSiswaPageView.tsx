"use client";

import {
  ArrowLeft,
  ChevronRight,
  ClipboardList,
  MapPin,
  UserRound,
} from "lucide-react";
import { useState } from "react";

import {
  type StudentAttendanceHistoryRecord,
  useStudentAttendanceData,
} from "../data/useStudentAttendanceData";
import { getStudentAcademicAccessMessage } from "../data/studentAcademicAccess";

type AttendanceSubjectGroup = {
  key: string;
  subject: string;
  teacherName: string;
  className: string;
  branch: string;
  room: string;
  records: StudentAttendanceHistoryRecord[];
  summary: {
    hadir: number;
    sakit: number;
    izin: number;
    alpa: number;
    belumAbsen: number;
  };
  lastMeeting: StudentAttendanceHistoryRecord;
};

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function formatDisplayDate(value: string) {
  const normalizedValue = normalizeText(value);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    return normalizedValue || "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${normalizedValue}T00:00:00Z`));
}

function formatMarkedTime(value: string | null) {
  if (!value) {
    return "-";
  }

  const markedDate = new Date(value);

  if (Number.isNaN(markedDate.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(markedDate);
}

function getAttendanceStatusClass(status: string) {
  if (status === "Hadir") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (status === "Sakit") {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }
  if (status === "Izin") {
    return "bg-sky-50 text-sky-700 border-sky-200";
  }
  if (status === "Alpa") {
    return "bg-rose-50 text-rose-700 border-rose-200";
  }
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function getSessionStatusLabel(status: string) {
  if (status === "closed") {
    return "Ditutup";
  }

  if (status === "open") {
    return "Berjalan";
  }

  return normalizeText(status) || "-";
}

function getSessionStatusClass(status: string) {
  if (status === "closed") {
    return "border-slate-200 bg-slate-100 text-slate-700";
  }

  if (status === "open") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function getMarkedByLabel(markedBy: string) {
  if (markedBy === "qr") {
    return "QR";
  }

  if (markedBy === "manual") {
    return "Manual";
  }

  if (markedBy === "teacher") {
    return "Guru";
  }

  return normalizeText(markedBy) || "-";
}

function getMeetingOrderKey(record: StudentAttendanceHistoryRecord) {
  const normalizedDate = normalizeText(record.date);
  const normalizedStartTime = normalizeText(record.startTime).replace(".", ":");

  return `${normalizedDate}T${normalizedStartTime || "00:00"}`;
}

function createSubjectGroupKey(record: StudentAttendanceHistoryRecord) {
  return [
    normalizeText(record.subject).toLowerCase(),
    normalizeText(record.teacherName).toLowerCase(),
  ].join("::");
}

function countStatus(records: StudentAttendanceHistoryRecord[], status: string) {
  return records.filter((record) => record.status === status).length;
}

function buildAttendanceSubjectGroups(
  history: StudentAttendanceHistoryRecord[],
): AttendanceSubjectGroup[] {
  const groupMap = new Map<string, StudentAttendanceHistoryRecord[]>();

  for (const record of history) {
    const key = createSubjectGroupKey(record);
    const currentRecords = groupMap.get(key) ?? [];
    currentRecords.push(record);
    groupMap.set(key, currentRecords);
  }

  return Array.from(groupMap.entries())
    .map(([key, records]) => {
      const sortedRecords = [...records].sort((leftRecord, rightRecord) =>
        getMeetingOrderKey(leftRecord).localeCompare(getMeetingOrderKey(rightRecord)),
      );
      const lastMeeting = sortedRecords[sortedRecords.length - 1] ?? records[0];

      return {
        key,
        subject: normalizeText(records[0]?.subject) || "-",
        teacherName: normalizeText(records[0]?.teacherName) || "-",
        className: normalizeText(records[0]?.className) || "-",
        branch: normalizeText(records[0]?.branch),
        room: normalizeText(lastMeeting?.room) || "-",
        records: sortedRecords,
        summary: {
          hadir: countStatus(records, "Hadir"),
          sakit: countStatus(records, "Sakit"),
          izin: countStatus(records, "Izin"),
          alpa: countStatus(records, "Alpa"),
          belumAbsen: countStatus(records, "Belum Absen"),
        },
        lastMeeting,
      } satisfies AttendanceSubjectGroup;
    })
    .sort((leftGroup, rightGroup) =>
      leftGroup.subject.localeCompare(rightGroup.subject, "id-ID"),
    );
}



function AttendanceStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getAttendanceStatusClass(
        status,
      )}`}
    >
      {status}
    </span>
  );
}

export default function AbsensiSiswaPageView() {
  const { history, academicAccess, isLoading, loadError } =
    useStudentAttendanceData();
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const subjectGroups = buildAttendanceSubjectGroups(history);
  const selectedGroup =
    subjectGroups.find((group) => group.key === selectedGroupKey) ?? null;
  const academicAccessMessage =
    getStudentAcademicAccessMessage(academicAccess);

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <div className="flex flex-col gap-4 rounded-[28px] border border-slate-100 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between md:p-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-600">
            Kehadiran Siswa
          </p>
          <h1 className="mt-2 text-xl font-semibold text-slate-900 md:text-2xl">
            Riwayat Absensi Kelas
          </h1>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
            Pantau rekam jejak kehadiran kamu di setiap sesi kelas. Absensi ini
            dicatat oleh guru secara manual maupun melalui scan QR code.
          </p>
        </div>
      </div>

      {isLoading ? (
        <section className="rounded-[26px] border border-slate-100 bg-white p-8 text-center shadow-sm">
          <p className="text-base font-semibold text-slate-800">
            Riwayat absensi sedang dimuat
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Sistem sedang mengambil data kehadiran kamu...
          </p>
        </section>
      ) : history.length === 0 ? (
        <section className="rounded-[26px] border border-slate-100 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
            <ClipboardList className="h-5 w-5" />
          </div>
          <p className="mt-4 text-base font-semibold text-slate-800">
            Belum ada data kehadiran
          </p>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
            {academicAccessMessage ??
              loadError ??
              "Kamu belum memiliki riwayat kehadiran di sesi kelas apa pun."}
          </p>
        </section>
      ) : (
        <>
          {selectedGroup ? (
            <section className="rounded-[26px] border border-slate-100 bg-white shadow-sm">
              <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-600">
                    Detail Kehadiran
                  </p>
                  <h2 className="mt-2 text-lg font-semibold text-slate-800">
                    Daftar Pertemuan - {selectedGroup.subject}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Guru {selectedGroup.teacherName} | {selectedGroup.className}
                    {selectedGroup.branch ? ` | ${selectedGroup.branch}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedGroupKey(null)}
                  className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-2xl border border-orange-200 bg-white px-4 text-sm font-semibold text-orange-700 transition hover:bg-orange-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Kembali
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm text-slate-600">
                  <thead className="bg-slate-50/50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Pertemuan</th>
                      <th className="px-6 py-4 font-semibold">Tanggal</th>
                      <th className="px-6 py-4 font-semibold">Jam</th>
                      <th className="px-6 py-4 font-semibold">Ruangan</th>
                      <th className="px-6 py-4 font-semibold">Kehadiran</th>
                      <th className="px-6 py-4 font-semibold">Status Sesi</th>
                      <th className="px-6 py-4 font-semibold">Metode Absen</th>
                      <th className="px-6 py-4 font-semibold">Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedGroup.records.map((record, index) => (
                      <tr
                        key={record.id}
                        className="transition-colors hover:bg-slate-50/50"
                      >
                        <td className="px-6 py-4 font-medium text-slate-800">
                          Pertemuan {index + 1}
                        </td>
                        <td className="px-6 py-4">
                          {formatDisplayDate(record.date)}
                        </td>
                        <td className="px-6 py-4">{record.startTime || "-"}</td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-orange-500" />
                            {record.room || "-"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <AttendanceStatusBadge status={record.status} />
                          <p className="mt-1.5 text-xs text-slate-400">
                            {formatMarkedTime(record.markedAt)}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getSessionStatusClass(
                              record.sessionStatus,
                            )}`}
                          >
                            {getSessionStatusLabel(record.sessionStatus)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {getMarkedByLabel(record.markedBy)}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">
                          {record.note || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            <section className="rounded-[26px] border border-slate-100 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-5 md:px-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-600">
                  Daftar Kehadiran Saya
                </p>
                <h2 className="mt-2 text-lg font-semibold text-slate-800">
                  Pilih mata pelajaran untuk melihat detail pertemuan
                </h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left text-sm text-slate-600">
                  <thead className="bg-slate-50/50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Mata Pelajaran</th>
                      <th className="px-6 py-4 font-semibold">Nama Guru</th>
                      <th className="px-6 py-4 font-semibold">
                        Jumlah Pertemuan
                      </th>
                      <th className="px-6 py-4 font-semibold">
                        Ringkasan H/S/I/A
                      </th>
                      <th className="px-6 py-4 font-semibold">
                        Pertemuan Terakhir
                      </th>
                      <th className="px-6 py-4 font-semibold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {subjectGroups.map((group) => (
                      <tr
                        key={group.key}
                        className="cursor-pointer transition-colors hover:bg-orange-50/40"
                        onClick={() => setSelectedGroupKey(group.key)}
                      >
                        <td className="px-6 py-4">
                          <p className="font-semibold text-slate-800">
                            {group.subject}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {group.className}
                            {group.branch ? ` | ${group.branch}` : ""}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5">
                            <UserRound className="h-3.5 w-3.5 text-orange-500" />
                            {group.teacherName}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-800">
                          {group.records.length} pertemuan
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                              H {group.summary.hadir}
                            </span>
                            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">
                              S {group.summary.sakit}
                            </span>
                            <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-700">
                              I {group.summary.izin}
                            </span>
                            <span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-700">
                              A {group.summary.alpa}
                            </span>
                            {group.summary.belumAbsen > 0 ? (
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                                Belum {group.summary.belumAbsen}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-slate-700">
                            {formatDisplayDate(group.lastMeeting.date)}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {group.lastMeeting.startTime || "-"} |{" "}
                            {group.lastMeeting.room || group.room}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-700">
                            Detail
                            <ChevronRight className="h-3.5 w-3.5" />
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </section>
  );
}
