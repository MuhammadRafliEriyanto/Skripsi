"use client";

import { useEffect, useState } from "react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { TugasFormDialogProps } from "./types";

type AvailableQuestion = {
  questionId: string;
  questionText: string;
  subject: string;
  topic: string;
  difficulty: string;
  createdByName?: string;
};

export default function TugasFormDialog({
  attachmentMarkedForRemoval,
  draft,
  existingAttachmentName,
  mode,
  onAttachmentChange,
  onChange,
  onClearSelectedAttachment,
  onOpenChange,
  onRemoveExistingAttachment,
  onCancelRemoveAttachment,
  onSubmit,
  open,
  selectedAttachmentName,
}: TugasFormDialogProps) {
  const [availableQuestions, setAvailableQuestions] = useState<AvailableQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionSearch, setQuestionSearch] = useState("");
  const isSelectedWorkbook =
    selectedAttachmentName?.toLowerCase().endsWith(".xlsx") ||
    selectedAttachmentName?.toLowerCase().endsWith(".xls") ||
    false;

  useEffect(() => {
    if (!open || !draft?.isCbt || draft.questionSelectionMode !== "manual") return;
    const controller = new AbortController();
    setQuestionsLoading(true);
    const params = new URLSearchParams({ scope: draft.questionBankScope });
    fetch(`/api/teacher/me/question-bank/available?${params}`, { credentials: "include", cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((payload) => setAvailableQuestions(payload.data?.items ?? []))
      .catch((error) => { if (error instanceof Error && error.name !== "AbortError") setAvailableQuestions([]); })
      .finally(() => setQuestionsLoading(false));
    return () => controller.abort();
  }, [draft?.isCbt, draft?.questionBankScope, draft?.questionSelectionMode, open]);

  const visibleQuestions = availableQuestions.filter((question) =>
    `${question.questionText} ${question.subject} ${question.topic}`.toLowerCase().includes(questionSearch.toLowerCase()),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-2 flex max-h-[calc(100dvh-1rem)] max-w-3xl translate-y-0 flex-col gap-0 rounded-[24px] border border-slate-200 bg-white p-0 shadow-lg sm:top-[50%] sm:max-h-[calc(100dvh-3rem)] sm:translate-y-[-50%]">
        <DialogHeader className="shrink-0 border-b border-slate-200 bg-white px-4 py-4 pr-14 text-left md:px-5">
          <DialogTitle className="text-lg font-semibold text-slate-800">
            {mode === "add" ? "Tambah Latihan" : "Edit Latihan"}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            Lengkapi pertemuan, jadwal sesi, bank soal, dan instruksi.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
          <div className="grid gap-4 px-4 py-4 md:px-5 md:py-5">
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
                Tanggal Sesi
                <input
                  type="date"
                  value={draft?.deadline ?? ""}
                  onChange={(event) => onChange("deadline", event.target.value)}
                  className="border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Jam Mulai
                <input
                  type="time"
                  value={draft?.jamMulai ?? ""}
                  onChange={(event) => onChange("jamMulai", event.target.value)}
                  className="border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Jam Selesai
                <input
                  type="time"
                  value={draft?.jamSelesai ?? ""}
                  onChange={(event) => onChange("jamSelesai", event.target.value)}
                  className="border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Durasi CBT
                <input
                  type="number"
                  min={1}
                  value={draft?.durasiMenit ?? 60}
                  readOnly
                  className="border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500 outline-none"
                />
              </label>
            </div>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Judul Latihan
              <input
                type="text"
                value={draft?.judulTugas ?? ""}
                onChange={(event) => onChange("judulTugas", event.target.value)}
                placeholder="Contoh: Latihan Persamaan Linear"
                className="border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              />
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Deskripsi
              <textarea
                rows={4}
                value={draft?.deskripsi ?? ""}
                onChange={(event) => onChange("deskripsi", event.target.value)}
                placeholder="Instruksi singkat untuk siswa..."
                className="resize-none border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Mode Latihan
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    id="isCbtToggle"
                    checked={draft?.isCbt ?? false}
                    onChange={(e) => onChange("isCbt", e.target.checked)}
                    className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isCbtToggle" className="text-sm text-slate-600 cursor-pointer">
                    Gunakan latihan CBT dari bank soal
                  </label>
                </div>
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                KKM
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={draft?.nilaiMinimum ?? ""}
                  onChange={(event) =>
                    onChange("nilaiMinimum", event.target.value)
                  }
                  className="border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Jumlah Soal
                <input
                  type="number"
                  min={0}
                  value={draft?.jumlahSoal ?? 0}
                  onChange={(e) => onChange("jumlahSoal", parseInt(e.target.value) || 0)}
                  readOnly={!draft?.isCbt}
                  className={`border border-slate-200 px-3 py-3 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100 ${
                    !draft?.isCbt ? "bg-slate-50 text-slate-500" : "bg-white text-slate-700"
                  }`}
                />
              </label>
            </div>

            {draft?.isCbt && (
              <div className="grid gap-4 rounded-xl border border-orange-100 bg-orange-50/40 p-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    Sumber Bank Soal
                    <select value={draft.questionBankScope} onChange={(event) => onChange("questionBankScope", event.target.value)} className="border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-orange-300">
                      <option value="global">Bank soal global</option>
                      <option value="mine">Bank soal saya</option>
                      <option value="mixed">Campuran global + soal saya</option>
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-slate-700">
                    Cara Memilih Soal
                    <select value={draft.questionSelectionMode} onChange={(event) => onChange("questionSelectionMode", event.target.value)} className="border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-orange-300">
                      <option value="auto">Generate otomatis dan acak</option>
                      <option value="manual">Pilih manual satu per satu</option>
                    </select>
                  </label>
                </div>
                {draft.questionSelectionMode === "auto" ? (
                  <p className="text-xs leading-5 text-slate-500">Sistem mengambil soal approved secara acak dengan campuran tingkat kesulitan. Paket akan disimpan sebagai snapshot latihan.</p>
                ) : (
                  <div className="grid gap-3">
                    <input value={questionSearch} onChange={(event) => setQuestionSearch(event.target.value)} placeholder="Cari pertanyaan, mapel, atau topik..." className="border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-300" />
                    <div className="max-h-72 overflow-y-auto border border-slate-200 bg-white">
                      {questionsLoading ? <p className="p-4 text-sm text-slate-500">Memuat bank soal...</p> : visibleQuestions.length ? visibleQuestions.map((question) => {
                        const checked = draft.selectedQuestionIds.includes(question.questionId);
                        return <label key={question.questionId} className="flex cursor-pointer items-start gap-3 border-b border-slate-100 p-3 last:border-b-0 hover:bg-orange-50/40"><input type="checkbox" checked={checked} onChange={() => onChange("selectedQuestionIds", checked ? draft.selectedQuestionIds.filter((id) => id !== question.questionId) : [...draft.selectedQuestionIds, question.questionId])} className="mt-1 size-4 accent-orange-600"/><span className="min-w-0"><span className="line-clamp-2 break-words text-sm font-medium text-slate-700">{question.questionText}</span><span className="mt-1 block text-xs text-slate-400">{question.subject} · {question.topic} · {question.difficulty} · {question.createdByName || "Bank pusat"}</span></span></label>;
                      }) : <p className="p-4 text-sm text-slate-500">Belum ada soal approved sesuai sumber ini.</p>}
                    </div>
                    <p className="text-xs font-semibold text-orange-700">{draft.selectedQuestionIds.length} soal dipilih</p>
                  </div>
                )}
              </div>
            )}

            {!draft?.isCbt && (
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
                    <span className="break-all">
                      File baru: {selectedAttachmentName}
                    </span>
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
                    <span className="break-all">File saat ini: {existingAttachmentName}</span>
                    <button
                      type="button"
                      onClick={onRemoveExistingAttachment}
                      className="w-fit font-semibold text-slate-600 hover:underline"
                    >
                      Hapus file
                    </button>
                  </div>
                ) : existingAttachmentName && attachmentMarkedForRemoval ? (
                  <div className="flex flex-col gap-2 text-xs text-orange-600 sm:flex-row sm:flex-wrap sm:items-center">
                    <span>File akan dihapus</span>
                    <button
                      type="button"
                      onClick={onCancelRemoveAttachment}
                      className="w-fit font-semibold text-orange-700 hover:underline"
                    >
                      Batal hapus
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-slate-200 bg-white px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:px-5">
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
            {mode === "add" ? "Simpan Latihan" : "Update Latihan"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
