"use client";

import { useId, useState } from "react";
import { FileSpreadsheet, FileText, LoaderCircle, Sparkles, UploadCloud, X } from "lucide-react";

import { QUESTION_ALL_SUBJECT_OPTIONS, QUESTION_CLASS_OPTIONS, QUESTION_PROGRAM_OPTIONS } from "./catalog";
import type { ImportPreviewItem } from "./types";

type Props = { mode: "excel" | "pdf"; onClose: () => void; onImported: () => Promise<void>; onError: (message: string) => void };

export default function QuestionImportDialog({ mode, onClose, onImported, onError }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState({ program: "SMP", className: "SMP 8", subject: "", topic: "Umum" });
  const [items, setItems] = useState<ImportPreviewItem[]>([]);
  const [busy, setBusy] = useState(false);
  const fileInputId = useId();
  const selectedCount = items.filter((item) => item.selected).length;
  const ModeIcon = mode === "pdf" ? FileText : FileSpreadsheet;

  async function asDataUrl(selectedFile: File): Promise<string> {
    return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("File gagal dibaca.")); reader.readAsDataURL(selectedFile); });
  }

  async function preview() {
    if (!file || (mode === "pdf" && !meta.subject.trim())) return onError(mode === "pdf" ? "Pilih file dan isi mata pelajaran." : "Pilih file Excel.");
    setBusy(true);
    try {
      const pdfQuery = new URLSearchParams({ ...meta, fileName: file.name });
      const response = mode === "pdf"
        ? await fetch(`/api/admin/question-bank/import/pdf/preview?${pdfQuery}`, { method: "POST", headers: { "Content-Type": "application/pdf" }, credentials: "include", body: file })
        : await fetch("/api/admin/question-bank/import/excel/preview", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ ...meta, fileName: file.name, fileDataBase64: await asDataUrl(file) }) });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message || "Preview import gagal.");
      setItems(payload.data?.items ?? []);
    } catch (error) { onError(error instanceof Error ? error.message : "Preview import gagal."); } finally { setBusy(false); }
  }

  function updateItem(index: number, field: string, value: string) {
    setItems((current) => current.map((item, itemIndex) => itemIndex !== index ? item : {
      ...item,
      draft: field.startsWith("options.") ? { ...item.draft, options: { ...item.draft.options, [field.slice(-1)]: value } } : { ...item.draft, [field]: value },
      errors: value.trim() ? item.errors.filter((error) => error.field !== field) : item.errors,
    }));
  }

  async function confirm() {
    if (!file) return;
    const selected = items.filter((item) => item.selected);
    if (!selected.length) return onError("Pilih minimal satu soal valid.");
    setBusy(true);
    try {
      const response = await fetch("/api/admin/question-bank/import/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ source: mode, fileName: file.name, items: selected }) });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message || "Import gagal disimpan.");
      await onImported(); onClose();
    } catch (error) { onError(error instanceof Error ? error.message : "Import gagal disimpan."); } finally { setBusy(false); }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-[2px] sm:p-6" role="dialog" aria-modal="true" aria-label={`Import ${mode === "pdf" ? "PDF" : "Excel"}`}><div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
    <div className="flex items-start justify-between border-b border-slate-100 px-5 py-5 sm:px-7"><div className="flex gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600"><ModeIcon size={22} /></div><div><div className="mb-1 flex items-center gap-2"><h2 className="text-xl font-bold text-slate-900">Import {mode === "pdf" ? "PDF" : "Excel"}</h2><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Masuk ke review</span></div><p className="text-sm text-slate-500">Atur data soal, pilih file, lalu periksa hasil sebelum disimpan.</p></div></div><button onClick={onClose} aria-label="Tutup" className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"><X size={21} /></button></div>
    <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
      <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5"><div className="mb-4"><h3 className="font-semibold text-slate-900">1. Informasi soal</h3><p className="text-sm text-slate-500">Data ini diterapkan ke seluruh soal yang dibaca dari file.</p></div><div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">Jenjang<select value={meta.program} onChange={(event) => { const program = event.target.value; setMeta((current) => ({ ...current, program, className: QUESTION_CLASS_OPTIONS[program][0] })); }} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100">{QUESTION_PROGRAM_OPTIONS.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="text-sm font-medium text-slate-700">Kelas<select value={meta.className} onChange={(event) => setMeta((current) => ({ ...current, className: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100">{QUESTION_CLASS_OPTIONS[meta.program].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="text-sm font-medium text-slate-700">Mata pelajaran <span className="font-normal text-slate-400">({mode === "excel" ? "opsional jika ada di Excel" : "wajib"})</span><select value={meta.subject} onChange={(event) => setMeta((current) => ({ ...current, subject: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"><option value="">{mode === "excel" ? "Otomatis dari Excel" : "Pilih mata pelajaran"}</option>{QUESTION_ALL_SUBJECT_OPTIONS.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="text-sm font-medium text-slate-700">Topik <span className="font-normal text-slate-400">(opsional)</span><input value={meta.topic} placeholder="Umum" onChange={(event) => setMeta((current) => ({ ...current, topic: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100" /></label>
      </div></section>
      <section className="mt-5"><div className="mb-3 flex items-end justify-between gap-3"><div><h3 className="font-semibold text-slate-900">2. Unggah file</h3><p className="text-sm text-slate-500">{mode === "pdf" ? "PDF maksimal 120 MB. Gambar di dalam soal ikut diproses." : "Gunakan XLS/XLSX maksimal 10 MB dan 5.000 baris."}</p></div>{mode === "excel" && <button onClick={() => window.open("/api/admin/question-bank/import/template", "_blank")} className="shrink-0 text-sm font-semibold text-orange-600 hover:text-orange-700">Unduh template</button>}</div>
        <input id={fileInputId} type="file" accept={mode === "pdf" ? ".pdf,application/pdf" : ".xlsx,.xls"} onChange={(event) => { setFile(event.target.files?.[0] ?? null); setItems([]); }} className="sr-only" />
        <label htmlFor={fileInputId} className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white px-5 py-7 text-center transition hover:border-orange-300 hover:bg-orange-50/30"><UploadCloud className="mb-2 text-orange-500" size={30} /><span className="font-semibold text-slate-800">{file ? file.name : `Pilih file ${mode === "pdf" ? "PDF" : "Excel"}`}</span><span className="mt-1 text-xs text-slate-500">{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB · Klik untuk mengganti file` : "Klik di area ini untuk memilih file"}</span></label>
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2"><button onClick={() => void preview()} disabled={busy || !file || (mode === "pdf" && !meta.subject)} className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50">{busy ? <LoaderCircle className="animate-spin" size={18} /> : <Sparkles size={18} />}Proses & lihat preview</button></div>
      </section>
      {items.length === 0 && <div className="mt-6 rounded-2xl bg-blue-50 px-5 py-4 text-sm text-blue-800"><b>Belum ada preview.</b> Pilih file{mode === "pdf" ? " dan mata pelajaran" : ""}, lalu klik “Proses & lihat preview”.</div>}
      {items.length > 0 && <div className="mt-6 flex items-center justify-between border-t pt-5"><div><h3 className="font-semibold text-slate-900">3. Periksa hasil</h3><p className="text-sm text-slate-500">{items.length} soal ditemukan · {selectedCount} siap disimpan</p></div></div>}
      <div className="mt-5 space-y-4">{items.map((item, index) => <div key={`${item.rowNumber}-${index}`} className={`rounded-xl border p-4 ${item.errors.length || item.duplicate !== "none" ? "border-red-200 bg-red-50/30" : "border-slate-200"}`}><div className="mb-3 flex items-center gap-3"><input type="checkbox" checked={item.selected} disabled={item.errors.length > 0 || item.duplicate !== "none"} onChange={(event) => setItems((current) => current.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, selected: event.target.checked } : candidate))} /><b>{mode === "pdf" ? `Halaman ${item.pageNumber ?? "-"}` : `Baris ${item.rowNumber}`}</b>{item.duplicate !== "none" && <span className="text-sm text-red-600">Duplikat {item.duplicate}</span>}</div>{item.errors.length > 0 && <p className="mb-2 text-sm text-red-600">{item.errors.map((error) => error.message).join(" ")}</p>}{item.warnings.length > 0 && <p className="mb-2 text-sm text-amber-700">{item.warnings.join(" ")}</p>}<textarea value={item.draft.questionText ?? ""} onChange={(event) => updateItem(index, "questionText", event.target.value)} className="w-full rounded-lg border p-2" rows={3} />{item.imageDataUri && <img src={item.imageDataUri} alt={`Gambar soal ${item.rowNumber}`} className="mt-2 max-h-52 rounded-lg object-contain" />}<div className="mt-2 grid gap-2 md:grid-cols-4">{(["A", "B", "C", "D"] as const).map((key) => <input key={key} aria-label={`Opsi ${key}`} value={item.draft.options?.[key] ?? ""} onChange={(event) => updateItem(index, `options.${key}`, event.target.value)} className="rounded-lg border p-2" />)}</div><div className="mt-2 grid gap-2 md:grid-cols-[140px_1fr]"><select value={item.draft.correctAnswer ?? ""} onChange={(event) => updateItem(index, "correctAnswer", event.target.value)} className="rounded-lg border p-2"><option value="">Pilih kunci</option><option>A</option><option>B</option><option>C</option><option>D</option></select><textarea value={item.draft.explanation ?? ""} onChange={(event) => updateItem(index, "explanation", event.target.value)} placeholder="Pembahasan" className="rounded-lg border p-2" /></div></div>)}</div>
    </div>
    <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-white px-5 py-4 sm:px-7"><p className="hidden text-sm text-slate-500 sm:block">{items.length ? `${selectedCount} soal dipilih` : "Preview wajib dibuat sebelum menyimpan"}</p><div className="ml-auto flex gap-2"><button onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Batal</button>{items.length > 0 && <button onClick={() => void confirm()} disabled={busy || !selectedCount} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{busy ? <LoaderCircle className="animate-spin" /> : `Simpan ${selectedCount} soal`}</button>}</div></div>
  </div></div>;
}
