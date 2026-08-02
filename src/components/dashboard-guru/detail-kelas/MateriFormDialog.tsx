"use client";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { MateriFormDialogProps } from "./types";

export default function MateriFormDialog({
  attachmentMarkedForRemoval,
  draft,
  existingAttachmentName,
  mode,
  onAttachmentChange,
  onChange,
  onClearSelectedAttachment,
  onOpenChange,
  onRemoveExistingAttachment,
  onSubmit,
  open,
  selectedAttachmentName,
}: MateriFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-0 rounded-[24px] border border-slate-200 bg-white p-0 shadow-lg">
        <DialogHeader className="border-b border-slate-200 bg-white px-4 py-4 pr-14 text-left md:px-5">
          <DialogTitle className="text-lg font-semibold text-slate-800">
            {mode === "add" ? "Tambah Materi" : "Edit Materi"}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            Lengkapi pertemuan, judul, dan bahan belajar.
          </DialogDescription>
        </DialogHeader>

        <div>
          <div className="grid gap-4 px-4 py-4 md:px-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Pertemuan Ke
                <input
                  type="number"
                  min={1}
                  value={draft?.pertemuanKe ?? 1}
                  onChange={(event) =>
                    onChange("pertemuanKe", Number(event.target.value))
                  }
                  className="border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Tanggal
                <input
                  type="date"
                  value={draft?.tanggal ?? ""}
                  onChange={(event) => onChange("tanggal", event.target.value)}
                  className="border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                />
              </label>
            </div>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Judul Materi
              <input
                type="text"
                value={draft?.judulMateri ?? ""}
                onChange={(event) => onChange("judulMateri", event.target.value)}
                placeholder="Contoh: Persamaan Linear Dasar"
                className="border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Deskripsi
              <textarea
                rows={3}
                value={draft?.deskripsi ?? ""}
                onChange={(event) => onChange("deskripsi", event.target.value)}
                placeholder="Ringkasan materi atau catatan pembelajaran..."
                className="resize-none border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Link Materi Opsional
                <input
                  type="url"
                  value={draft?.linkMateri ?? ""}
                  onChange={(event) => onChange("linkMateri", event.target.value)}
                  placeholder="https://..."
                  className="border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Status Materi
                <select
                  value={draft?.statusMateri ?? "Draft"}
                  onChange={(event) => onChange("statusMateri", event.target.value)}
                  className="border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                >
                  <option value="Draft">Belum Diterbitkan</option>
                  <option value="Dipublikasikan">Dipublikasikan</option>
                </select>
              </label>
            </div>

            <div className="grid gap-3 border border-slate-200 bg-slate-50/40 p-4 text-sm font-medium text-slate-700">
              <span>Lampiran</span>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.txt,.csv"
                onChange={(event) =>
                  onAttachmentChange(event.target.files?.[0] ?? null)
                }
                className="border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 file:mr-3 file:border-0 file:bg-slate-50 file:px-3 file:py-2 file:font-semibold file:text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              />
              {selectedAttachmentName ? (
                <div className="flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:flex-wrap sm:items-center">
                  <span className="break-all">File baru: {selectedAttachmentName}</span>
                  <button
                    type="button"
                    onClick={onClearSelectedAttachment}
                    className="w-fit font-semibold text-slate-600 hover:underline"
                  >
                    Batalkan file baru
                  </button>
                </div>
              ) : existingAttachmentName && !attachmentMarkedForRemoval ? (
                <div className="flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:flex-wrap sm:items-center">
                  <span className="break-all">Lampiran tersimpan: {existingAttachmentName}</span>
                  <button
                    type="button"
                    onClick={onRemoveExistingAttachment}
                    className="w-fit font-semibold text-rose-600 hover:underline"
                  >
                    Hapus lampiran
                  </button>
                </div>
              ) : attachmentMarkedForRemoval ? (
                <p className="text-xs text-rose-600">
                  Lampiran lama akan dihapus saat materi disimpan.
                </p>
              ) : (
                <p className="text-xs text-slate-400">Opsional, maksimal 10 MB.</p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-slate-200 px-4 py-4 md:px-5">
          <DialogClose asChild>
            <button
              type="button"
              className="w-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-orange-50/40 sm:w-auto"
            >
              Batal
            </button>
          </DialogClose>
          <button
            type="button"
            onClick={onSubmit}
            className="w-full border border-orange-500 bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700 hover:brightness-[1.02] sm:w-auto"
          >
            {mode === "add" ? "Simpan Materi" : "Update Materi"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
