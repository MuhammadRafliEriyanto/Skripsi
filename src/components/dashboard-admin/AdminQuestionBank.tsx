"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Eye, LoaderCircle, Search, X } from "lucide-react";

import QuestionEditorDialog from "./question-bank/QuestionEditorDialog";
import QuestionImportDialog from "./question-bank/QuestionImportDialog";
import type { QuestionItem } from "./question-bank/types";

export default function AdminQuestionBank() {
  const [items, setItems] = useState<QuestionItem[]>([]);
  const [stats, setStats] = useState({ approved: 0, review: 0, rejected: 0 });
  const [status, setStatus] = useState("review");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<QuestionItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editor, setEditor] = useState<QuestionItem | "new" | null>(null);
  const [importMode, setImportMode] = useState<"excel" | "pdf" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ status, search, page: String(page), limit: "25" });
      const response = await fetch(`/api/admin/question-bank?${query}`, { credentials: "include", cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message || "Bank soal gagal dimuat.");
      setItems(payload.data?.items ?? []);
      setSelectedIds([]);
      setStats(payload.data?.stats ?? { approved: 0, review: 0, rejected: 0 });
      setPages(payload.data?.pagination?.totalPages ?? 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Bank soal gagal dimuat.");
    } finally { setLoading(false); }
  }, [page, search, status]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  async function mutate(path: string, method: string, body?: object) {
    setBusy(true);
    try {
      const response = await fetch(path, { method, headers: body ? { "Content-Type": "application/json" } : undefined, credentials: "include", body: body ? JSON.stringify(body) : undefined });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message || "Perubahan gagal disimpan.");
      setSelected(null); setSelectedIds([]); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Perubahan gagal disimpan."); }
    finally { setBusy(false); }
  }

  const selectableItems = items.filter((item) => item.status !== "archived");
  const allSelected = selectableItems.length > 0 && selectableItems.every((item) => selectedIds.includes(item._id));

  function toggleAll() {
    setSelectedIds(allSelected ? [] : selectableItems.map((item) => item._id));
  }

  function toggleItem(itemId: string) {
    setSelectedIds((current) => current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]);
  }

  return <main>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-2xl font-bold text-slate-950">Review Bank Soal</h1><p className="mt-1 text-sm text-slate-500">Tambah, import, dan validasi soal sebelum tersedia untuk murid.</p></div>
      <div className="flex flex-wrap gap-2"><button onClick={() => setImportMode("excel")} className="rounded-xl border px-3 py-2 text-sm font-semibold">Import Excel</button><button onClick={() => setImportMode("pdf")} className="rounded-xl border px-3 py-2 text-sm font-semibold">Import PDF</button><button onClick={() => setEditor("new")} className="rounded-xl bg-orange-500 px-3 py-2 text-sm font-semibold text-white">Tambah soal</button></div>
    </div>
    {error && <div className="mt-4 flex justify-between rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"><span>{error}</span><button onClick={() => setError("")} aria-label="Tutup pesan"><X className="size-4" /></button></div>}
    <div className="mt-6 grid gap-4 md:grid-cols-3">{[["Disetujui", stats.approved, "bg-emerald-50 text-emerald-700"], ["Perlu review", stats.review, "bg-amber-50 text-amber-700"], ["Ditolak", stats.rejected, "bg-red-50 text-red-700"]].map(([label, value, tone]) => <div key={String(label)} className={`rounded-2xl p-5 ${tone}`}><p className="text-sm font-medium">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div>)}</div>
    <div className="mt-6 flex gap-3 rounded-2xl border bg-white p-4 shadow-sm"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 size-4 text-slate-400"/><input value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }} placeholder="Cari ID atau isi soal..." className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm"/></div><select value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }} className="rounded-lg border px-3 text-sm"><option value="review">Perlu review</option><option value="all">Semua status</option><option value="approved">Disetujui</option><option value="rejected">Ditolak</option><option value="draft">Draft</option></select></div>
    {selectedIds.length > 0 && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3"><span className="text-sm font-semibold text-orange-800">{selectedIds.length} soal dipilih</span><div className="flex gap-2"><button disabled={busy} onClick={() => void mutate("/api/admin/question-bank/bulk-status", "PATCH", { itemIds: selectedIds, status: "approved" })} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Setujui dipilih</button><button disabled={busy} onClick={() => void mutate("/api/admin/question-bank/bulk-status", "PATCH", { itemIds: selectedIds, status: "rejected" })} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white">Tolak dipilih</button></div></div>}
    <div className="mt-4 overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left text-sm"><thead className="border-b bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="w-12 px-4 py-3"><input type="checkbox" aria-label="Pilih semua soal di halaman" checked={allSelected} onChange={toggleAll} /></th>{["ID / Soal", "Pembuat", "Jenjang / Kelas", "Mapel / Topik", "Kesulitan", "Status", "Action"].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead><tbody className="divide-y">
      {loading ? <tr><td colSpan={8} className="py-16 text-center"><LoaderCircle className="mx-auto animate-spin text-orange-500"/></td></tr> : items.map((item) => <tr key={item._id}><td className="px-4 py-4"><input type="checkbox" aria-label={`Pilih ${item.questionId}`} checked={selectedIds.includes(item._id)} disabled={item.status === "archived"} onChange={() => toggleItem(item._id)} /></td><td className="max-w-[300px] px-4 py-4"><p className="font-mono text-xs text-slate-400">{item.questionId}</p><p className="mt-1 line-clamp-2 font-medium">{item.questionText}</p></td><td className="px-4 py-4">{item.createdByName || "Admin"}</td><td className="px-4 py-4">{item.program}<br/><span className="text-xs text-slate-400">{item.className}</span></td><td className="px-4 py-4">{item.subject}<br/><span className="text-xs text-slate-400">{item.topic}</span></td><td className="px-4 py-4">{item.difficulty}</td><td className="px-4 py-4">{item.status}</td><td className="px-4 py-4"><div className="flex gap-2"><button onClick={() => setSelected(item)} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold"><Eye className="size-3.5"/>Detail</button>{["draft", "review"].includes(item.status) && <><button disabled={busy} onClick={() => void mutate(`/api/admin/question-bank/${item._id}/status`, "PATCH", { status: "approved" })} className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs text-white">Setujui</button><button disabled={busy} onClick={() => void mutate(`/api/admin/question-bank/${item._id}/status`, "PATCH", { status: "rejected" })} className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs text-white">Tolak</button></>}</div></td></tr>)}
      {!loading && !items.length && <tr><td colSpan={8} className="py-16 text-center text-slate-500">Tidak ada data sesuai filter.</td></tr>}
    </tbody></table></div><div className="flex justify-between border-t px-4 py-3 text-sm text-slate-500"><span>Halaman {page} dari {pages}</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Sebelumnya</button><button disabled={page >= pages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Berikutnya</button></div></div></div>
    {selected && <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-label="Detail soal"><div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6"><div className="flex justify-between"><div><h2 className="text-lg font-bold">Detail Soal</h2><p className="font-mono text-xs text-slate-400">{selected.questionId}</p></div><button onClick={() => setSelected(null)} aria-label="Tutup"><X /></button></div><p className="mt-5 whitespace-pre-wrap font-medium leading-7">{selected.questionText}</p>{selected.imageUrl && <img src={selected.imageUrl} alt="Gambar soal" className="mx-auto mt-4 max-h-96 rounded-xl border object-contain"/>}<div className="mt-4 grid gap-2 sm:grid-cols-2">{(["A", "B", "C", "D"] as const).map((key) => <div key={key} className={`rounded-xl border p-3 ${selected.correctAnswer === key ? "border-emerald-300 bg-emerald-50" : "bg-slate-50"}`}><b>{key}.</b> {selected.options[key]}</div>)}</div><div className="mt-4 rounded-xl border p-4"><b>Pembahasan</b><p>{selected.explanation || "Belum tersedia."}</p></div><div className="mt-5 flex justify-end gap-2"><button disabled={busy} onClick={() => void mutate(`/api/admin/question-bank/${selected._id}`, "DELETE")} className="rounded-xl border border-red-200 px-4 py-2 text-red-600">Arsipkan</button><button onClick={() => { setEditor(selected); setSelected(null); }} className="rounded-xl border px-4 py-2">Edit</button>{selected.status !== "approved" && <button disabled={busy} onClick={() => void mutate(`/api/admin/question-bank/${selected._id}/status`, "PATCH", { status: "approved" })} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-white"><Check className="size-4"/>Setujui</button>}</div></div></div>}
    {editor && <QuestionEditorDialog item={editor === "new" ? null : editor} onClose={() => setEditor(null)} onSaved={load} onError={setError} />}
    {importMode && <QuestionImportDialog mode={importMode} onClose={() => setImportMode(null)} onImported={load} onError={setError} />}
  </main>;
}
