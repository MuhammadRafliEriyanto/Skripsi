"use client";

import { useState, type FormEvent } from "react";
import { LoaderCircle, X } from "lucide-react";

import { EMPTY_QUESTION, type QuestionDraft, type QuestionItem } from "./types";
import { QUESTION_ALL_SUBJECT_OPTIONS, QUESTION_CLASS_OPTIONS, QUESTION_PROGRAM_OPTIONS } from "./catalog";

type Props = {
  item?: QuestionItem | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
};

export default function QuestionEditorDialog({ item, onClose, onSaved, onError }: Props) {
  const [draft, setDraft] = useState<QuestionDraft>(item ? { ...item, options: { ...item.options } } : EMPTY_QUESTION);
  const [saving, setSaving] = useState(false);
  const set = (key: keyof QuestionDraft, value: string) => setDraft((current) => ({ ...current, [key]: value }));

  function pickImage(file?: File) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return onError("Ukuran gambar maksimal 5 MB.");
    const reader = new FileReader();
    reader.onload = () => setDraft((current) => ({ ...current, imageDataUri: String(reader.result) }));
    reader.readAsDataURL(file);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/question-bank${item ? `/${item._id}` : ""}`, {
        method: item ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(draft),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message || "Soal gagal disimpan.");
      await onSaved();
      onClose();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Soal gagal disimpan.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-label={item ? "Edit soal" : "Tambah soal"}>
    <form onSubmit={submit} className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b px-6 py-4"><h2 className="text-lg font-bold">{item ? "Edit soal" : "Tambah soal"}</h2><button type="button" aria-label="Tutup" onClick={onClose}><X /></button></div>
      <div className="min-h-0 space-y-4 overflow-y-auto p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <label>Jenjang<select aria-label="Jenjang" value={draft.program} onChange={(event) => { const program = event.target.value; setDraft((current) => ({ ...current, program, className: QUESTION_CLASS_OPTIONS[program][0] })); }} className="mt-1 w-full rounded-xl border p-3">{QUESTION_PROGRAM_OPTIONS.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Kelas<select aria-label="Kelas" value={draft.className} onChange={(event) => set("className", event.target.value)} className="mt-1 w-full rounded-xl border p-3">{QUESTION_CLASS_OPTIONS[draft.program].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Mata pelajaran<select aria-label="Mata pelajaran" required value={draft.subject} onChange={(event) => set("subject", event.target.value)} className="mt-1 w-full rounded-xl border p-3"><option value="">Pilih mata pelajaran</option>{QUESTION_ALL_SUBJECT_OPTIONS.map((value) => <option key={value}>{value}</option>)}</select></label>
        </div>
        <label className="block">Topik<input aria-label="Topik" required value={draft.topic} onChange={(event) => set("topic", event.target.value)} className="mt-1 w-full rounded-xl border p-3" /></label>
        <label className="block">Pertanyaan<textarea required rows={5} value={draft.questionText} onChange={(event) => set("questionText", event.target.value)} className="mt-1 w-full rounded-xl border p-3" /></label>
        <label className="block">Gambar (opsional)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => pickImage(event.target.files?.[0])} className="mt-1 block w-full rounded-xl border p-2" /></label>
        {(draft.imageDataUri || draft.imageUrl) && <img src={draft.imageDataUri || draft.imageUrl} alt="Preview gambar soal" className="max-h-60 rounded-xl border object-contain" />}
        <div className="grid gap-3 sm:grid-cols-2">{(["A", "B", "C", "D"] as const).map((key) => <label key={key}>Opsi {key}<input required value={draft.options[key]} onChange={(event) => setDraft((current) => ({ ...current, options: { ...current.options, [key]: event.target.value } }))} className="mt-1 w-full rounded-xl border p-3" /></label>)}</div>
        <div className="grid gap-4 md:grid-cols-2">
          <label>Kunci<select value={draft.correctAnswer} onChange={(event) => set("correctAnswer", event.target.value)} className="mt-1 w-full rounded-xl border p-3"><option>A</option><option>B</option><option>C</option><option>D</option></select></label>
          <label>Kesulitan<select value={draft.difficulty} onChange={(event) => set("difficulty", event.target.value)} className="mt-1 w-full rounded-xl border p-3"><option>Mudah</option><option>Sedang</option><option>Sulit</option></select></label>
        </div>
        <label className="block">Pembahasan<textarea required rows={4} value={draft.explanation} onChange={(event) => set("explanation", event.target.value)} className="mt-1 w-full rounded-xl border p-3" /></label>
      </div>
      <div className="flex justify-end gap-2 border-t p-4"><button type="button" onClick={onClose} className="rounded-xl border px-5 py-2">Batal</button><button disabled={saving} className="rounded-xl bg-orange-500 px-5 py-2 font-semibold text-white disabled:opacity-50">{saving ? <LoaderCircle className="animate-spin" /> : "Simpan soal"}</button></div>
    </form>
  </div>;
}
