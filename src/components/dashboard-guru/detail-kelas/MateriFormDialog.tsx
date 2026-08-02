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
      <DialogContent className="max-w-2xl gap-0 rounded-[28px] border border-slate-200 bg-white p-0 shadow-2xl">
        <DialogHeader className="border-b border-slate-100 bg-white/80 px-6 py-5 pr-14 text-left backdrop-blur-md md:px-8">
          <DialogTitle className="text-xl font-semibold text-slate-800">
            {mode === "add" ? "Tambah Materi" : "Edit Materi"}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-slate-500">
            Lengkapi pertemuan, judul, dan bahan belajar.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-6 md:px-8 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200 hover:[&::-webkit-scrollbar-thumb]:bg-slate-300">
          <div className="grid gap-5">
            <div className="grid gap-5 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Pertemuan Ke
                <input
                  type="number"
                  min={1}
                  value={draft?.pertemuanKe ?? 1}
                  onChange={(event) =>
                    onChange("pertemuanKe", Number(event.target.value))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all hover:border-orange-200 focus:border-orange-300 focus:ring-4 focus:ring-orange-500/10"
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Tanggal
                <input
                  type="date"
                  value={draft?.tanggal ?? ""}
                  onChange={(event) => onChange("tanggal", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all hover:border-orange-200 focus:border-orange-300 focus:ring-4 focus:ring-orange-500/10"
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
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all hover:border-orange-200 focus:border-orange-300 focus:ring-4 focus:ring-orange-500/10"
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Deskripsi
              <textarea
                rows={3}
                value={draft?.deskripsi ?? ""}
                onChange={(event) => onChange("deskripsi", event.target.value)}
                placeholder="Ringkasan materi atau catatan pembelajaran..."
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 outline-none transition-all hover:border-orange-200 focus:border-orange-300 focus:ring-4 focus:ring-orange-500/10"
              />
            </label>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Link Materi (Opsional)
                <input
                  type="url"
                  value={draft?.linkMateri ?? ""}
                  onChange={(event) => onChange("linkMateri", event.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all hover:border-orange-200 focus:border-orange-300 focus:ring-4 focus:ring-orange-500/10"
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Status Materi
                <select
                  value={draft?.statusMateri ?? "Draft"}
                  onChange={(event) => onChange("statusMateri", event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all hover:border-orange-200 focus:border-orange-300 focus:ring-4 focus:ring-orange-500/10"
                >
                  <option value="Draft">Belum Diterbitkan</option>
                  <option value="Dipublikasikan">Dipublikasikan</option>
                </select>
              </label>
            </div>

            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-5 text-sm font-medium text-slate-700">
              <span>Lampiran (Opsional)</span>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.txt,.csv"
                onChange={(event) =>
                  onAttachmentChange(event.target.files?.[0] ?? null)
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all hover:border-orange-200 focus:border-orange-300 focus:ring-4 focus:ring-orange-500/10 file:mr-4 file:rounded-xl file:border-0 file:bg-orange-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-orange-700"
              />
              {selectedAttachmentName ? (
                <div className="mt-1 flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:flex-wrap sm:items-center">
                  <span className="break-all font-medium">File baru: {selectedAttachmentName}</span>
                  <button
                    type="button"
                    onClick={onClearSelectedAttachment}
                    className="w-fit font-semibold text-slate-600 hover:text-slate-800 hover:underline"
                  >
                    Batalkan file baru
                  </button>
                </div>
              ) : existingAttachmentName && !attachmentMarkedForRemoval ? (
                <div className="mt-1 flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:flex-wrap sm:items-center">
                  <span className="break-all font-medium">Lampiran tersimpan: {existingAttachmentName}</span>
                  <button
                    type="button"
                    onClick={onRemoveExistingAttachment}
                    className="w-fit font-semibold text-rose-600 hover:text-rose-700 hover:underline"
                  >
                    Hapus lampiran
                  </button>
                </div>
              ) : attachmentMarkedForRemoval ? (
                <p className="mt-1 text-xs font-medium text-rose-600">
                  Lampiran lama akan dihapus saat materi disimpan.
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-400">Maksimal ukuran file 10 MB.</p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-slate-100 bg-slate-50/50 px-6 py-5 md:px-8">
          <DialogClose asChild>
            <button
              type="button"
              className="w-full rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 sm:w-auto"
            >
              Batal
            </button>
          </DialogClose>
          <button
            type="button"
            onClick={onSubmit}
            className="w-full rounded-xl border border-transparent bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-orange-700 focus:ring-4 focus:ring-orange-500/20 sm:w-auto"
          >
            {mode === "add" ? "Simpan Materi" : "Update Materi"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
