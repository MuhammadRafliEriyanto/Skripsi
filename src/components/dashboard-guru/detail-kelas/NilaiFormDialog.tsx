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
import {
  ACADEMIC_SCORE_LABELS,
  getAcademicScoreKeys,
} from "@/lib/academic-grades";

import type { NilaiFormDialogProps } from "./types";

export default function NilaiFormDialog({
  draft,
  includeTaskScore = true,
  mode,
  onAcademicScoreChange,
  onChange,
  onOpenChange,
  onStudentChange,
  onTaskChange,
  onSubmit,
  open,
  participants,
  selectedStudentId,
  selectedTask,
  tasks,
  scheme,
}: NilaiFormDialogProps) {
  const academicScoreKeys = getAcademicScoreKeys(scheme);
  const hasAcademicScoreFields = academicScoreKeys.length > 0;
  const activeStudent =
    participants.find((student) => student.id === selectedStudentId) ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-2 flex max-h-[calc(100dvh-1rem)] max-w-2xl translate-y-0 flex-col gap-0 rounded-[24px] border border-slate-200 bg-white p-0 shadow-lg sm:top-[50%] sm:max-h-[calc(100dvh-3rem)] sm:translate-y-[-50%]">
        <DialogHeader className="shrink-0 border-b border-slate-200 bg-gradient-to-r from-orange-50/60 via-white to-amber-50/30 px-5 py-4 pr-14 text-left">
          <DialogTitle className="text-lg font-semibold text-slate-800">
            {mode === "add" ? "Input Nilai Siswa" : "Edit Nilai Siswa"}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            {includeTaskScore
              ? "Simpan nilai latihan siswa."
              : hasAcademicScoreFields
                ? "Simpan nilai evaluasi siswa."
                : "Simpan nilai evaluasi siswa."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="grid gap-4 px-5 py-5">
          {includeTaskScore && tasks.length > 0 ? (
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Pilih Tugas
              <select
                value={selectedTask?.id ?? ""}
                onChange={(event) => onTaskChange(event.target.value)}
                className="border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              >
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    Pertemuan {task.pertemuanKe} - {task.judulTugas}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {includeTaskScore && selectedTask ? (
            <div className="border border-slate-200 bg-slate-50/60 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Latihan Aktif
              </p>
              <h3 className="mt-1 text-base font-semibold text-slate-800">
                {selectedTask.judulTugas}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Pertemuan {selectedTask.pertemuanKe} | Deadline{" "}
                {selectedTask.deadline}
              </p>
            </div>
          ) : null}

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Pilih Siswa
            <select
              value={selectedStudentId}
              onChange={(event) => onStudentChange(event.target.value)}
              className="border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            >
              {participants.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name}
                </option>
              ))}
            </select>
          </label>

          <div className="border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Siswa Aktif
            </p>
            <p className="mt-1 text-base font-semibold text-slate-800">
              {activeStudent?.name ?? "-"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {activeStudent?.classLevel ?? "-"}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {includeTaskScore ? (
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Nilai Latihan
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={draft?.tugas ?? ""}
                  onChange={(event) => onChange("tugas", event.target.value)}
                  placeholder="Belum dinilai"
                  className="border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                />
              </label>
            ) : null}

            {hasAcademicScoreFields && scheme !== "tryout"
              ? academicScoreKeys.map((scoreKey) => (
                  <label
                    key={scoreKey}
                    className="grid gap-2 text-sm font-medium text-slate-700"
                  >
                    Nilai {ACADEMIC_SCORE_LABELS[scoreKey]}
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={draft?.scores[scoreKey] ?? ""}
                      onChange={(event) =>
                        onAcademicScoreChange(scoreKey, event.target.value)
                      }
                      placeholder="Belum dinilai"
                      className="border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                    />
                  </label>
                ))
              : null}
          </div>

          {hasAcademicScoreFields ? (
            <p className="text-xs leading-5 text-slate-400">
              Kosongkan kolom yang belum dinilai. Sistem tidak akan mengubahnya
              menjadi nilai nol.
            </p>
          ) : null}

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Catatan Penilaian
            <textarea
              rows={4}
              value={draft?.note ?? ""}
              onChange={(event) => onChange("note", event.target.value)}
              placeholder="Tambahkan catatan singkat untuk penilaian latihan ini jika diperlukan..."
              className="border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          </label>
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-slate-200 bg-white px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <DialogClose asChild>
            <button
              type="button"
              className="border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-orange-50/40"
            >
              Tutup
            </button>
          </DialogClose>
          <button
            type="button"
            onClick={onSubmit}
            className="border border-orange-500 bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700 hover:brightness-[1.02]"
          >
            {mode === "add" ? "Simpan Nilai" : "Update Nilai"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
