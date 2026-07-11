"use client";

import { useMemo, useState } from "react";
import { Eye, Users } from "lucide-react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type {
  PresenceStatus,
  StudentStatus,
} from "@/components/dashboard-guru/data/guruClassTypes";

import type { PesertaKelasTableProps } from "./types";
import StudentAcademicHistoryTab from "./StudentAcademicHistoryTab";

function getStudentStatusClass(status: StudentStatus) {
  if (status === "Aktif") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "Perlu Pendampingan") {
    return "border-slate-200 bg-slate-50 text-slate-700";
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

export default function PesertaKelasTable({
  activeClass,
}: PesertaKelasTableProps) {
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState("attendance");
  const displayedParticipantCount = activeClass.participants.length;
  const hasParticipantCountGap = activeClass.totalSiswa > displayedParticipantCount;

  const selectedStudent = useMemo(() => {
    if (!selectedStudentId) {
      return null;
    }

    return (
      activeClass.participants.find((student) => student.id === selectedStudentId) ??
      null
    );
  }, [activeClass.participants, selectedStudentId]);

  function openStudentDetail(studentId: string) {
    setSelectedStudentId(studentId);
    setActiveDetailTab("attendance");
    setIsDetailOpen(true);
  }

  if (activeClass.participants.length === 0) {
    return (
      <div className="border border-dashed border-slate-200 bg-white px-5 py-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center border border-slate-200 bg-slate-50 text-slate-500">
          <Users className="h-5 w-5" />
        </div>
        <p className="mt-4 text-base font-semibold text-slate-700">
          Belum ada peserta untuk kelas ini.
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {activeClass.totalSiswa > 0
            ? `Ringkasan kelas mencatat ${activeClass.totalSiswa} siswa, tetapi daftar peserta detail dari backend masih kosong.`
            : "Data peserta akan muncul di sini setelah kelas terhubung dengan backend siswa."}
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
              Peserta Kelas
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Tabel peserta aktif untuk {activeClass.namaKelas}. Klik siswa untuk membuka riwayat detail tanpa membuat halaman memanjang.
            </p>
            {hasParticipantCountGap ? (
              <p className="mt-2 text-xs font-medium text-amber-700">
                Menampilkan {displayedParticipantCount} peserta detail dari total{" "}
                {activeClass.totalSiswa} siswa yang tercatat di kelas ini.
              </p>
            ) : null}
          </div>
          <span className="inline-flex items-center border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
            {displayedParticipantCount} siswa
          </span>
        </div>

        <div className="px-5 py-5 md:px-6">
          <div className="overflow-x-auto border border-slate-200 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-slate-50 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300">
            <table className="min-w-[760px] w-full">
              <thead className="bg-orange-50/50 text-left backdrop-blur-sm">
                <tr className="text-xs uppercase tracking-[0.16em] text-slate-500">
                  <th className="px-4 py-4 font-semibold">No</th>
                  <th className="px-4 py-4 font-semibold">Nama Siswa</th>
                  <th className="px-4 py-4 font-semibold">Kelas/Jenjang</th>
                  <th className="px-4 py-4 font-semibold">Cabang</th>
                  <th className="px-4 py-4 font-semibold">Status</th>
                  <th className="px-4 py-4 text-center font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {activeClass.participants.map((student, index) => (
                  <tr
                    key={student.id}
                    className="border-t border-slate-200 text-sm transition hover:bg-orange-50/40"
                  >
                    <td className="px-4 py-4 font-medium text-slate-500">
                      {index + 1}
                    </td>
                    <td className="px-4 py-4 font-semibold text-slate-800">
                      {student.name}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {student.classLevel}
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {student.branch}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center border px-2.5 py-1 text-xs font-semibold ${getStudentStatusClass(student.status)}`}
                      >
                        {student.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          title="Lihat Detail"
                          aria-label="Lihat Detail"
                          onClick={() => openStudentDetail(student.id)}
                          className="inline-flex h-8 w-8 items-center justify-center border border-slate-200 bg-white text-slate-600 transition hover:border-slate-200 hover:bg-orange-50/40 hover:text-slate-700"
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
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-6xl overflow-y-auto rounded-[24px] border border-slate-200 bg-white p-0 shadow-lg">
          <DialogHeader className="border-b border-slate-200 bg-gradient-to-r from-orange-50/60 via-white to-amber-50/30 px-5 py-4 text-left">
            <DialogTitle className="text-lg font-semibold text-slate-800">
              Detail Peserta
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Riwayat kehadiran kelas dan histori akademik peserta dari kelas {activeClass.namaKelas}.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 px-5 py-5">
            <div className="flex flex-wrap items-start justify-between gap-3 border border-slate-200 bg-gradient-to-r from-orange-50/60 via-white to-amber-50/30 p-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Peserta Terpilih
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-800">
                  {selectedStudent?.name ?? "-"}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedStudent?.classLevel ?? "-"} • {selectedStudent?.branch ?? "-"}
                </p>
              </div>
              <span
                className={`inline-flex items-center border px-2.5 py-1 text-xs font-semibold ${
                  getStudentStatusClass(selectedStudent?.status ?? "Aktif")
                }`}
              >
                {selectedStudent?.status ?? "Aktif"}
              </span>
            </div>

            <Tabs value={activeDetailTab} onValueChange={setActiveDetailTab}>
              <TabsList className="w-full justify-start">
                <TabsTrigger value="attendance">Kehadiran Kelas</TabsTrigger>
                <TabsTrigger value="academic-history">Riwayat Akademik</TabsTrigger>
              </TabsList>

              <TabsContent value="attendance" className="mt-4">
                <div className="overflow-x-auto border border-slate-200 bg-white">
                  <table className="min-w-[760px] w-full">
                    <thead className="bg-orange-50/50 text-left backdrop-blur-sm">
                      <tr className="text-xs uppercase tracking-[0.16em] text-slate-500">
                        <th className="px-4 py-4 font-semibold">Pertemuan</th>
                        <th className="px-4 py-4 font-semibold">Tanggal</th>
                        <th className="px-4 py-4 font-semibold">Materi</th>
                        <th className="px-4 py-4 font-semibold">Kehadiran</th>
                        <th className="px-4 py-4 font-semibold">Catatan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedStudent && selectedStudent.history.length > 0 ? (
                        selectedStudent.history.map((entry) => (
                          <tr
                            key={`${selectedStudent.id}-${entry.meeting}`}
                            className="border-t border-slate-200 text-sm"
                          >
                            <td className="px-4 py-4 font-medium text-slate-700">
                              {entry.meeting}
                            </td>
                            <td className="px-4 py-4 text-slate-600">{entry.date}</td>
                            <td className="px-4 py-4 text-slate-700">
                              {entry.material}
                            </td>
                            <td className="px-4 py-4">
                              <span
                                className={`inline-flex items-center border px-2.5 py-1 text-xs font-semibold ${getPresenceClass(entry.attendance)}`}
                              >
                                {entry.attendance}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-slate-500">{entry.note}</td>
                          </tr>
                        ))
                      ) : (
                        <tr className="border-t border-slate-200 text-sm">
                          <td
                            colSpan={5}
                            className="px-4 py-6 text-center text-slate-500"
                          >
                            Riwayat kehadiran peserta ini belum tersedia.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              <TabsContent value="academic-history" className="mt-4">
                {selectedStudent ? (
                  <StudentAcademicHistoryTab
                    studentId={selectedStudent.id}
                    studentName={selectedStudent.name}
                  />
                ) : null}
              </TabsContent>
            </Tabs>

            <div className="flex justify-end">
              <DialogClose asChild>
                <button
                  type="button"
                  className="border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-orange-50/40"
                >
                  Tutup
                </button>
              </DialogClose>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
