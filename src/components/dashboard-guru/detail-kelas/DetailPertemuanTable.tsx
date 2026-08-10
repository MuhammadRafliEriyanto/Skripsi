import { CalendarDays, Download, Pencil, Plus, Trash2 } from "lucide-react";

import { formatDisplayDate } from "./helpers";
import type { DetailPertemuanTableProps } from "./types";

function getMateriStatusClass(status: DetailPertemuanTableProps["materials"][number]["statusMateri"]) {
  if (status === "Dipublikasikan") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function getMateriStatusLabel(status: DetailPertemuanTableProps["materials"][number]["statusMateri"]) {
  return status === "Draft" ? "Belum Diterbitkan" : status;
}

export default function DetailPertemuanTable({
  kelasName,
  materials,
  readOnly = false,
  readOnlyMessage,
  totalMeetings,
  onAdd,
  onDelete,
  onEdit,
}: DetailPertemuanTableProps) {
  const sortedMaterials = [...materials].sort(
    (left, right) => left.pertemuanKe - right.pertemuanKe,
  );

  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
      <div className="px-5 py-5 md:px-6">
        <div className="mb-5 flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-800">
                Detail Pertemuan & Materi
              </h2>

              <span className="inline-flex items-center border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700">
                <CalendarDays className="h-3.5 w-3.5" />
                {sortedMaterials.length}/{totalMeetings} materi
              </span>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              {readOnly
                ? readOnlyMessage ?? "Materi ini sedang dikunci oleh pengaturan jadwal admin."
                : `Kelola materi pembelajaran berdasarkan pertemuan kelas ${kelasName}.`}
            </p>
          </div>

          <button
            type="button"
            onClick={onAdd}
            disabled={readOnly}
            title={readOnly ? readOnlyMessage : "Tambah Materi"}
            className={`inline-flex w-full items-center justify-center gap-2 border px-4 py-2 text-sm font-semibold transition sm:w-auto ${
              readOnly
                ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                : "border-orange-500 bg-slate-500 text-white hover:bg-orange-600"
            }`}
          >
            <Plus className="h-4 w-4" />
            Tambah Materi
          </button>
        </div>

        {sortedMaterials.length > 0 ? (
          <div className="overflow-x-auto border border-slate-200 bg-white">
            <table className="min-w-[1100px] w-full">
              <thead className="bg-orange-50/50 text-left backdrop-blur-sm">
                <tr className="text-xs uppercase tracking-[0.16em] text-slate-500">
                  <th className="px-4 py-3 font-semibold">Pertemuan</th>
                  <th className="px-4 py-3 font-semibold">Tanggal</th>
                  <th className="px-4 py-3 font-semibold">Judul Materi</th>
                  <th className="px-4 py-3 font-semibold">Deskripsi</th>
                  <th className="px-4 py-3 font-semibold">Link & Lampiran</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-center font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {sortedMaterials.map((material) => (
                  <tr
                    key={material.id}
                    className="border-t border-slate-200/70 text-sm transition hover:bg-orange-50/40/50"
                  >
                    <td className="px-4 py-4 align-top font-medium text-slate-700">
                      Pertemuan {material.pertemuanKe}
                    </td>
                    <td className="px-4 py-4 align-top text-slate-600">
                      {formatDisplayDate(material.tanggal)}
                    </td>
                    <td className="px-4 py-4 align-top font-semibold text-slate-800">
                      <div className="max-w-[220px] break-words">
                        {material.judulMateri}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-slate-600">
                      <div className="max-w-[280px] whitespace-pre-line break-words leading-6">
                        {material.deskripsi}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-slate-600">
                      <div className="flex min-w-[220px] flex-col gap-2">
                        {material.linkMateri ? (
                          <a
                            href={material.linkMateri}
                            target="_blank"
                            rel="noreferrer"
                            className="break-all font-semibold text-slate-600 underline-offset-2 hover:underline"
                          >
                            Buka Link Materi
                          </a>
                        ) : null}
                        {material.attachmentFileName && material.attachmentUrl ? (
                          <a
                            href={material.attachmentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-start gap-1 break-all font-semibold text-slate-700 underline-offset-2 hover:text-slate-600 hover:underline"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>{material.attachmentFileName}</span>
                          </a>
                        ) : null}
                        {!material.linkMateri && !material.attachmentFileName ? "-" : null}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <span
                        className={`inline-flex items-center border px-2.5 py-1 text-xs font-semibold ${getMateriStatusClass(material.statusMateri)}`}
                      >
                        {getMateriStatusLabel(material.statusMateri)}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-wrap items-center justify-center gap-2 sm:flex-nowrap">
                        {readOnly ? (
                          <span className="inline-flex items-center border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                            Arsip
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              title="Edit"
                              aria-label="Edit"
                              onClick={() => onEdit(material)}
                              className="inline-flex h-9 w-9 items-center justify-center border border-slate-200 bg-slate-50 text-slate-700 transition hover:border-orange-300 hover:bg-orange-100"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              title="Hapus"
                              aria-label="Hapus"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    "Apakah Anda yakin ingin menghapus materi ini?",
                                  )
                                ) {
                                  onDelete(material.id);
                                }
                              }}
                              className="inline-flex h-9 w-9 items-center justify-center border border-rose-200 bg-rose-50 text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
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
              <CalendarDays className="h-5 w-5" />
            </div>
            <p className="mt-4 text-base font-semibold text-slate-700">
              Belum ada materi yang tercatat.
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Tambahkan materi pertama untuk mulai menyusun detail pertemuan kelas ini.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
