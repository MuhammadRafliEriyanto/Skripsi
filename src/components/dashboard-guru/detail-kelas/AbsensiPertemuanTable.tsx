"use client";

import { useMemo, useState } from "react";
import { ClipboardCheck, Eye } from "lucide-react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  AttendanceSessionStatus,
  PresenceStatus,
} from "@/components/dashboard-guru/data/guruClassTypes";

import { formatDisplayDate } from "./helpers";
import type { AbsensiPertemuanTableProps } from "./types";

function formatTimeLabel(value: string) {
  return value.trim().replace(/:/g, ".");
}

function formatMarkedAtLabel(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function getSessionStatusClass(status: AttendanceSessionStatus) {
  if (status === "Berlangsung") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function getPresenceClass(status: PresenceStatus) {
  switch (status) {
    case "Hadir":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "Sakit":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "Izin":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "Alpa":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export default function AbsensiPertemuanTable({
  kelasName,
  participants,
  sessions,
}: AbsensiPertemuanTableProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const sortedSessions = useMemo(
    () => [...sessions].sort((left, right) => left.meetingNumber - right.meetingNumber),
    [sessions],
  );
  const selectedSession = useMemo(
    () =>
      sortedSessions.find((session) => session.sessionId === selectedSessionId) ??
      null,
    [selectedSessionId, sortedSessions],
  );
  const selectedSessionParticipants = useMemo(() => {
    if (!selectedSession) {
      return [];
    }

    return participants.map((participant) => {
      const historyEntry =
        participant.history.find(
          (entry) => entry.sessionId === selectedSession.sessionId,
        ) ?? null;
      const attendance = historyEntry?.attendance ?? "Belum Absen";

      return {
        id: participant.id,
        name: participant.name,
        classLevel: participant.classLevel,
        attendance,
        note:
          historyEntry?.note ||
          (attendance === "Belum Absen"
            ? "Belum ada catatan absensi."
            : "-"),
        markedAt: historyEntry?.markedAt ?? null,
      };
    });
  }, [participants, selectedSession]);

  function openSessionDetail(sessionId: string) {
    setSelectedSessionId(sessionId);
    setIsDetailOpen(true);
  }

  if (sortedSessions.length === 0) {
    return (
      <div className="border border-dashed border-slate-200 bg-white px-5 py-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center border border-slate-200 bg-slate-50 text-slate-500">
          <ClipboardCheck className="h-5 w-5" />
        </div>
        <p className="mt-4 text-base font-semibold text-slate-700">
          Belum ada sesi absensi untuk kelas ini.
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Pilih pertemuan dari jadwal untuk memulai
          sesi absensi dan data tersimpan ke sistem.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-orange-50/60 via-white to-amber-50/30 px-5 py-4 md:px-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 md:text-xl">
              Absensi Tiap Pertemuan
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Rekap sesi absensi kelas {kelasName} yang sudah tersimpan di sistem.
            </p>
          </div>
          <span className="inline-flex items-center border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
            {sortedSessions.length} sesi
          </span>
        </div>

        <div className="px-5 py-5 md:px-6">
          <div className="overflow-x-auto border border-slate-200 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-slate-50 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300">
            <table className="min-w-[980px] w-full">
              <thead className="bg-orange-50/50 text-left backdrop-blur-sm">
                <tr className="text-xs uppercase tracking-[0.16em] text-slate-500">
                  <th className="px-4 py-4 font-semibold">Pertemuan</th>
                  <th className="px-4 py-4 font-semibold">Tanggal</th>
                  <th className="px-4 py-4 font-semibold">Jam</th>
                  <th className="px-4 py-4 font-semibold">Mapel / Ruang</th>
                  <th className="px-4 py-4 font-semibold">Status Sesi</th>
                  <th className="px-4 py-4 font-semibold">Rekap</th>
                  <th className="px-4 py-4 text-center font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {sortedSessions.map((session) => (
                  <tr
                    key={session.sessionId}
                    className="border-t border-slate-200 text-sm transition hover:bg-orange-50/40"
                  >
                    <td className="px-4 py-4 font-medium text-slate-700">
                      {session.meeting}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {formatDisplayDate(session.date)}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {formatTimeLabel(session.startTime)} WIB
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      <p className="font-semibold">{session.subject}</p>
                      <p className="text-xs text-slate-500">{session.room}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center border px-2.5 py-1 text-xs font-semibold ${getSessionStatusClass(session.status)}`}
                      >
                        {session.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {session.attendanceSummary}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          title="Lihat Detail"
                          aria-label="Lihat Detail"
                          onClick={() => openSessionDetail(session.sessionId)}
                          className="inline-flex h-9 w-9 items-center justify-center border border-slate-200 bg-white text-slate-600 transition hover:border-slate-200 hover:bg-orange-50/40 hover:text-slate-700"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl grid-rows-[auto_minmax(0,1fr)] gap-0 rounded-[24px] border border-slate-200 bg-white p-0 shadow-lg">
          <DialogHeader className="border-b border-slate-200 bg-gradient-to-r from-orange-50/60 via-white to-amber-50/30 px-4 py-4 pr-14 text-left md:px-5">
            <DialogTitle className="text-lg font-semibold text-slate-800">
              Detail Absensi Pertemuan
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Rekap kehadiran siswa untuk {selectedSession?.meeting ?? "-"} di kelas{" "}
              {kelasName}.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 overflow-y-auto overscroll-y-contain">
            <div className="grid gap-4 px-4 py-4 md:px-5 md:py-5">
              <div className="flex flex-col gap-3 border border-slate-200 bg-gradient-to-r from-orange-50/60 via-white to-amber-50/30 p-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Sesi Terpilih
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-800">
                    {selectedSession?.meeting ?? "-"}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedSession
                      ? `${formatDisplayDate(selectedSession.date)} - ${formatTimeLabel(selectedSession.startTime)} WIB`
                      : "-"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  <span
                    className={`inline-flex items-center border px-2.5 py-1 text-xs font-semibold ${
                      getSessionStatusClass(selectedSession?.status ?? "Ditutup")
                    }`}
                  >
                    {selectedSession?.status ?? "Ditutup"}
                  </span>
                  <span className="inline-flex items-center border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {selectedSession?.attendanceSummary ?? "-"}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 bg-white">
                <table className="min-w-[980px] w-full">
                  <thead className="bg-orange-50/50 text-left backdrop-blur-sm">
                    <tr className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      <th className="px-4 py-4 font-semibold">No</th>
                      <th className="px-4 py-4 font-semibold">Nama Siswa</th>
                      <th className="px-4 py-4 font-semibold">Kelas/Jenjang</th>
                      <th className="px-4 py-4 font-semibold">Kehadiran</th>
                      <th className="px-4 py-4 font-semibold">Tercatat</th>
                      <th className="px-4 py-4 font-semibold">Catatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSessionParticipants.map((participant, index) => (
                      <tr
                        key={`${selectedSession?.sessionId ?? "session"}-${participant.id}`}
                        className="border-t border-slate-200 text-sm"
                      >
                        <td className="px-4 py-4 font-medium text-slate-500">
                          {index + 1}
                        </td>
                        <td className="px-4 py-4 font-semibold text-slate-800">
                          {participant.name}
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          {participant.classLevel}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center border px-2.5 py-1 text-xs font-semibold ${getPresenceClass(participant.attendance)}`}
                          >
                            {participant.attendance}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-slate-500">
                          {formatMarkedAtLabel(participant.markedAt)}
                        </td>
                        <td className="px-4 py-4 text-slate-500">
                          <div className="max-w-[320px] whitespace-pre-line break-words">
                            {participant.note}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-1">
                <DialogClose asChild>
                  <button
                    type="button"
                    className="w-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-orange-50/40 sm:w-auto"
                  >
                    Tutup
                  </button>
                </DialogClose>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
