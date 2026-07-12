"use client";

import Link from "next/link";
import {
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  Send,
  TimerReset,
} from "lucide-react";

import { useStudentLearningData } from "../data/useStudentLearningData";
import { getStudentAcademicAccessMessage } from "../data/studentAcademicAccess";
import StudentLearningShell from "../learning/StudentLearningShell";

function formatSubmissionTime(value: string | null | undefined) {
  if (!value) {
    return "waktu belum tersedia";
  }

  const submittedDate = new Date(value);

  if (Number.isNaN(submittedDate.getTime())) {
    return "waktu belum tersedia";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(submittedDate);
}

function getTaskStatusClass(
  status:
    | "Belum Dikerjakan"
    | "Menunggu Dikirim"
    | "Sudah Dikirim"
    | "Sudah Dinilai",
) {
  if (status === "Sudah Dinilai") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "Sudah Dikirim") {
    return "bg-sky-50 text-sky-700";
  }

  if (status === "Menunggu Dikirim") {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-rose-50 text-rose-700";
}

export default function TugasSiswaPageView() {
  const { tasks, academicAccess, isLoading, loadError } =
    useStudentLearningData();
  const pendingTasks = tasks.filter((task) => task.status !== "Sudah Dinilai");
  const academicAccessMessage =
    getStudentAcademicAccessMessage(academicAccess);

  return (
    <StudentLearningShell
      title="Tugas Siswa"
      description="Pantau deadline, instruksi tugas, dan status pengerjaan dalam satu halaman supaya kamu lebih mudah menentukan prioritas belajar."
      summary={
        isLoading ? "Memuat tugas..." : `${pendingTasks.length} tugas perlu perhatian`
      }
    >
      {isLoading ? (
        <section className="rounded-[26px] border border-orange-100/90 bg-white p-8 text-center shadow-[0_18px_40px_-34px_rgba(15,23,42,0.18)]">
          <p className="text-base font-semibold text-slate-800">
            Tugas sedang dimuat
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Sistem sedang mengambil tugas terbaru dari kelas kamu.
          </p>
        </section>
      ) : tasks.length === 0 ? (
        <section className="rounded-[26px] border border-orange-100/90 bg-white p-8 text-center shadow-[0_18px_40px_-34px_rgba(15,23,42,0.18)]">
          <p className="text-base font-semibold text-slate-800">
            Belum ada tugas tersedia
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {academicAccessMessage ??
              loadError ??
              "Guru belum menambahkan tugas untuk kelas kamu."}
          </p>
        </section>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <section className="rounded-[24px] border border-orange-100/90 bg-white p-5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.18)]">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-amber-50 p-3 text-amber-600">
                  <Clock3 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Deadline Dekat</p>
                  <p className="text-xs text-slate-500">Tugas yang perlu didahulukan</p>
                </div>
              </div>
              <p className="mt-4 text-2xl font-semibold text-slate-800">
                {pendingTasks.length}
              </p>
            </section>

            <section className="rounded-[24px] border border-orange-100/90 bg-white p-5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.18)]">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Sudah Dinilai</p>
                  <p className="text-xs text-slate-500">Masukan yang bisa kamu lihat</p>
                </div>
              </div>
              <p className="mt-4 text-2xl font-semibold text-slate-800">
                {tasks.filter((task) => task.status === "Sudah Dinilai").length}
              </p>
            </section>

            <section className="rounded-[24px] border border-orange-100/90 bg-white p-5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.18)]">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-orange-50 p-3 text-orange-600">
                  <TimerReset className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Estimasi Waktu</p>
                  <p className="text-xs text-slate-500">Pengerjaan tugas aktif minggu ini</p>
                </div>
              </div>
              <p className="mt-4 text-2xl font-semibold text-slate-800">1,5 Jam</p>
            </section>
          </div>

          <section className="rounded-[26px] border border-orange-100/90 bg-white p-5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.18)] md:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-600">
                  Daftar Latihan
                </p>
                <h2 className="mt-2 text-lg font-semibold text-slate-800">
                  Tugas aktif dan riwayat penilaian
                </h2>
              </div>
              <p className="text-sm text-slate-500">
                Gunakan halaman ini untuk cek instruksi sebelum mengirim jawaban.
              </p>
            </div>

            <div className="mt-5 space-y-3">
              {tasks.map((task) => (
                <article
                  key={task.id}
                  className="flex flex-col gap-4 rounded-[22px] border border-orange-100/80 p-4 transition hover:border-orange-200 hover:bg-orange-50/30 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-700">
                        {task.mapel}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-500">
                        Pertemuan {task.pertemuan}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getTaskStatusClass(
                          task.status,
                        )}`}
                      >
                        {task.status}
                      </span>
                    </div>

                    <h3 className="mt-2 text-sm font-semibold text-slate-800">
                      {task.judul}
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      {task.deskripsi}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      Deadline {task.deadline} | Estimasi {task.estimasi} | {task.poin}
                    </p>
                    {task.mySubmission?.submittedAt ? (
                      <p className="mt-1 text-xs text-sky-600">
                        Sudah dikumpulkan pada{" "}
                        {formatSubmissionTime(task.mySubmission.submittedAt)}
                      </p>
                    ) : null}
                    {task.myGrade?.graded ? (
                      <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-emerald-700">
                            Nilai {task.myGrade.score ?? "-"}
                          </span>
                          <span className="text-emerald-700">
                            Dinilai{" "}
                            {formatSubmissionTime(task.myGrade.gradedAt)}
                          </span>
                        </div>
                        <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                          Catatan Guru
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          {task.myGrade.note ||
                            "Guru belum menambahkan catatan untuk tugas ini."}
                        </p>
                      </div>
                    ) : task.mySubmission?.submitted ? (
                      <p className="mt-2 text-xs text-amber-700">
                        Jawaban kamu sudah terkirim dan sedang menunggu penilaian guru.
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {task.attachmentName && task.attachmentUrl ? (
                      <a
                        href={task.attachmentUrl}
                        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-orange-200 bg-white px-4 text-xs font-semibold text-orange-700 transition hover:bg-orange-50"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Lampiran
                      </a>
                    ) : null}
                    <Link
                      href={task.detailHref}
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Lihat Tugas
                    </Link>
                    <Link
                      href={task.submitHref}
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-orange-600 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-orange-700"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Kirim Jawaban
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </StudentLearningShell>
  );
}
