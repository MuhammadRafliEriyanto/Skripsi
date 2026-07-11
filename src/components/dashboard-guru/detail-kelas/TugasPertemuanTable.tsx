import {
  Download,
  Eye,
  FileText,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { formatDisplayDate } from "./helpers";
import type { TugasPertemuanTableProps } from "./types";

const ACTION_ICON_CLASS = "h-4 w-4 shrink-0";
const ACTION_BUTTON_CLASS =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center border text-xs transition";

function getTaskStatusClass(status: TugasPertemuanTableProps["tasks"][number]["statusPenilaian"]) {
  if (status === "Sudah Dinilai") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "Belum Ada Pengumpulan") {
    return "border-slate-200 bg-slate-50 text-slate-600";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default function TugasPertemuanTable({
  kelasName,
  onAdd,
  onDelete,
  onEdit,
  onViewSubmissions,
  tasks,
}: TugasPertemuanTableProps) {
  const sortedTasks = [...tasks].sort(
    (left, right) => left.pertemuanKe - right.pertemuanKe,
  );

  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
      <div className="px-5 py-5 md:px-6">
        <div className="mb-5 flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-800">
                Latihan Setiap Pertemuan
              </h2>

              <span className="inline-flex items-center border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700">
                <FileText className="h-3.5 w-3.5" />
                {sortedTasks.length} latihan
              </span>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              Kelola latihan dan status penilaian siswa untuk kelas {kelasName}.
            </p>
          </div>

          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center justify-center gap-2 border border-orange-500 bg-slate-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
          >
            <Plus className="h-4 w-4" />
            Tambah Latihan
          </button>
        </div>

        {sortedTasks.length > 0 ? (
          <div className="overflow-x-auto border border-slate-200 bg-white">
            <table className="min-w-[1120px] w-full">
              <thead className="bg-orange-50/50 text-left backdrop-blur-sm">
                <tr className="text-xs uppercase tracking-[0.16em] text-slate-500">
                  <th className="px-4 py-3 font-semibold">Pertemuan</th>
                  <th className="px-4 py-3 font-semibold">Judul Latihan</th>
                  <th className="px-4 py-3 font-semibold">Deskripsi</th>
                  <th className="px-4 py-3 font-semibold">Deadline</th>
                  <th className="px-4 py-3 font-semibold">Mengumpulkan</th>
                  <th className="px-4 py-3 font-semibold">Lampiran</th>
                  <th className="px-4 py-3 font-semibold">Status Penilaian</th>
                  <th className="px-4 py-3 text-center font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {sortedTasks.map((task) => (
                  <tr
                    key={task.id}
                    className="border-t border-slate-200/70 text-sm transition hover:bg-orange-50/40/50"
                  >
                    <td className="px-4 py-4 font-medium text-slate-700">
                      Pertemuan {task.pertemuanKe}
                    </td>
                    <td className="px-4 py-4 font-semibold text-slate-800">
                      {task.judulTugas}
                    </td>
                    <td className="px-4 py-4 text-slate-600">{task.deskripsi}</td>
                    <td className="px-4 py-4 text-slate-600">
                      {formatDisplayDate(task.deadline)}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {task.jumlahMengumpulkan} siswa
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {task.attachmentFileName && task.attachmentUrl ? (
                        <a
                          href={task.attachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-w-[160px] items-center gap-1 font-semibold text-slate-700 underline-offset-2 hover:text-slate-600 hover:underline"
                        >
                          <Download className="h-3.5 w-3.5" />
                          {task.attachmentFileName}
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center border px-2.5 py-1 text-xs font-semibold ${getTaskStatusClass(task.statusPenilaian)}`}
                      >
                        {task.statusPenilaian}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-middle text-center">
                      <div className="mx-auto flex w-fit items-center justify-center gap-2">
                        <button
                          type="button"
                          title="Lihat Submission"
                          aria-label="Lihat Submission"
                          onClick={() => onViewSubmissions(task)}
                          className={`${ACTION_BUTTON_CLASS} border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-300 hover:bg-sky-100`}
                        >
                          <Eye className={ACTION_ICON_CLASS} />
                        </button>
                        <button
                          type="button"
                          title="Edit"
                          aria-label="Edit"
                          onClick={() => onEdit(task)}
                          className={`${ACTION_BUTTON_CLASS} border-slate-200 bg-slate-50 text-slate-700 hover:border-orange-300 hover:bg-orange-100`}
                        >
                          <Pencil className={ACTION_ICON_CLASS} />
                        </button>
                        <button
                          type="button"
                          title="Hapus"
                          aria-label="Hapus"
                          onClick={() => {
                            if (
                              window.confirm(
                                "Hapus latihan ini dari daftar pertemuan kelas?",
                              )
                            ) {
                              onDelete(task.id);
                            }
                          }}
                          className={`${ACTION_BUTTON_CLASS} border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100`}
                        >
                          <Trash2 className={ACTION_ICON_CLASS} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="border border-dashed border-slate-200 bg-orange-50/20 px-6 py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center border border-orange-100 bg-white text-orange-400 shadow-sm">
              <FileText className="h-5 w-5" />
            </div>
            <p className="mt-4 text-base font-semibold text-slate-700">
              Belum ada latihan pada kelas ini.
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Tambahkan latihan baru untuk mulai memonitor progres penilaian tiap pertemuan.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
