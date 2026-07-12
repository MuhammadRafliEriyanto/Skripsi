import { AlertCircle, ClipboardCheck } from "lucide-react";

import { formatDisplayDate } from "./helpers";
import type { BelumDinilaiTableProps } from "./types";

export default function BelumDinilaiTable({
  kelasName,
  tasks,
  onGradeNow,
}: BelumDinilaiTableProps) {
  const pendingTasks = tasks.filter(
    (task) => task.statusPenilaian === "Belum Dinilai",
  );

  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-orange-50/60 via-white to-amber-50/30 px-5 py-4 md:px-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 md:text-xl">
            Peringatan Belum Dinilai
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Tugas dan soal latihan yang memerlukan penilaian manual. Anda dapat melihat jumlah tugas yang
            tertunda berdasarkan data terbaru di sistem.
          </p>
        </div>
        <span
          className={`inline-flex items-center border px-2.5 py-1 text-xs font-semibold ${
            pendingTasks.length > 0
              ? "border-slate-200 bg-slate-50 text-slate-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {pendingTasks.length > 0
            ? `${pendingTasks.length} latihan belum dinilai`
            : "Semua latihan aman"}
        </span>
      </div>

      <div className="px-5 py-5 md:px-6">
        {pendingTasks.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {pendingTasks.map((task) => (
              <article
                key={task.id}
                className="border border-slate-200 bg-gradient-to-r from-orange-50/60 via-white to-amber-50/30 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-[0_22px_38px_-30px_rgba(249,115,22,0.28)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Pertemuan {task.pertemuanKe}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-slate-800">
                      {task.judulTugas}
                    </h3>
                  </div>
                  <span className="inline-flex items-center border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    Belum Dinilai
                  </span>
                </div>

                <div className="mt-4 grid gap-2 text-sm text-slate-500">
                  <p>
                    <span className="font-semibold text-slate-700">Kelas:</span>{" "}
                    {kelasName}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">Deadline:</span>{" "}
                    {formatDisplayDate(task.deadline)}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">
                      Jumlah Mengumpulkan:
                    </span>{" "}
                    {task.jumlahMengumpulkan} siswa
                  </p>
                  <p>{task.deskripsi}</p>
                </div>

                <button
                  type="button"
                  onClick={() => onGradeNow(task)}
                  className="mt-5 inline-flex items-center gap-1.5 border border-orange-500 bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700 hover:shadow-[0_18px_30px_-22px_rgba(249,115,22,0.55)]"
                >
                  <ClipboardCheck className="h-4 w-4" />
                  Nilai Sekarang
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="border border-emerald-100 bg-emerald-50/70 px-5 py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center border border-emerald-200 bg-white text-emerald-600">
              <AlertCircle className="h-5 w-5" />
            </div>
            <p className="mt-4 text-base font-semibold text-emerald-700">
              Tidak ada latihan yang tertinggal untuk kelas ini.
            </p>
            <p className="mt-2 text-sm text-emerald-600/80">
              Semua latihan pada kelas {kelasName} sudah selesai dinilai.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
