"use client";
import { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  Check,
  Download,
  Eye,
  LoaderCircle,
  Plus,
  Search,
  Upload,
  X,
} from "lucide-react";

type Item = {
  _id: string;
  questionId: string;
  program: string;
  className: string;
  subject: string;
  topic: string;
  indicator?: string;
  cognitiveLevel?: string;
  questionText: string;
  options: Record<string, string>;
  correctAnswer: string;
  explanation: string;
  difficulty: string;
  status: string;
  imageUrl?: string;
  createdByName?: string;
};
export default function QuestionBankGuruSection() {
  const [items, setItems] = useState<Item[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(1),
    [pages, setPages] = useState(1),
    [selected, setSelected] = useState<Item | null>(null),
    [form, setForm] = useState<any>(null),
    [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams({
      page: String(page),
      limit: "25",
      ...(search ? { search } : {}),
      ...(status ? { status } : {}),
    });
    const r = await fetch(`/api/teacher/me/question-bank?${q}`, {
      credentials: "include",
      cache: "no-store",
    });
    const p = await r.json();
    if (!r.ok || !p.success) setError(p.message || "Bank soal gagal dimuat.");
    else {
      setItems(p.data?.items || []);
      setPages(p.data?.pagination?.totalPages || 1);
    }
    setLoading(false);
  }, [page, search, status]);
  useEffect(() => {
    void load();
  }, [load]);
  const set = (key: string, value: string) =>
    setForm((v: any) => ({ ...v, [key]: value }));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const formPayload = { ...form };
    delete formPayload.status;
    const r = await fetch(
      `/api/teacher/me/question-bank${form._id ? `/${form._id}` : ""}`,
      {
        method: form._id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formPayload),
      },
    );
    const p = await r.json();
    if (!r.ok || !p.success) setError(p.message || "Gagal menyimpan soal.");
    else {
      setForm(null);
      await load();
    }
    setSaving(false);
  }
  async function requestReview(item: Item) {
    setSaving(true);
    const response = await fetch(`/api/teacher/me/question-bank/${item._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status: "review" }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      setError(payload.message || "Soal gagal diajukan untuk review.");
    } else {
      setSelected(null);
      await load();
    }
    setSaving(false);
  }
  async function importFile(file: File) {
    const reader = new FileReader();
    reader.onload = async () => {
      const r = await fetch("/api/teacher/me/question-bank/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fileName: file.name,
          fileDataBase64: reader.result,
        }),
      });
      const p = await r.json();
      if (!r.ok || !p.success) setError(p.message || "Import gagal.");
      else await load();
    };
    reader.readAsDataURL(file);
  }
  function selectQuestionImage(file?: File) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Ukuran gambar maksimal 5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((current: any) => ({
        ...current,
        imageDataUri: String(reader.result),
      }));
    };
    reader.readAsDataURL(file);
  }
  const exportFile = (format: string) =>
    window.open(
      `/api/teacher/me/question-bank?format=${format}&${new URLSearchParams({ search, ...(status ? { status } : {}) })}`,
      "_blank",
    );
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-orange-600">
            <BookOpen className="size-5" />
            <span className="text-sm font-semibold">Konten pembelajaran</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold">Bank Soal Guru</h1>
          <p className="mt-1 text-sm text-slate-500">
            Kelola soal, import, dan gunakan kembali untuk pertemuan atau ujian.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold">
            <Upload className="size-4" />
            Import
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importFile(f);
              }}
            />
          </label>
          <button
            onClick={() => exportFile("csv")}
            className="rounded-xl border px-3 py-2 text-sm font-semibold"
          >
            Export CSV
          </button>
          <button
            onClick={() => exportFile("xlsx")}
            className="rounded-xl border px-3 py-2 text-sm font-semibold"
          >
            Export Excel
          </button>
          <button
            onClick={() =>
              setForm({
                program: "SMP",
                className: "Kelas 8",
                subject: "",
                topic: "",
                indicator: "",
                cognitiveLevel: "",
                questionText: "",
                options: { A: "", B: "", C: "", D: "" },
                correctAnswer: "A",
                explanation: "",
                difficulty: "Sedang",
              })
            }
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-sm font-semibold text-white"
          >
            <Plus className="size-4" />
            Tambah soal
          </button>
        </div>
      </div>
      {error && (
        <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="mt-6 flex flex-wrap gap-3 rounded-2xl border bg-white p-4 shadow-sm">
        <div className="relative min-w-[260px] flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Cari ID atau pertanyaan..."
            className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          <option value="">Semua status</option>
          <option value="review">Review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Ditolak</option>
          <option value="draft">Draft</option>
        </select>
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {[
                  "ID / Pertanyaan",
                  "Pembuat",
                  "Jenjang / Kelas",
                  "Mapel / Topik",
                  "Kesulitan",
                  "Status",
                  "Action",
                ].map((h) => (
                  <th key={h} className="px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <LoaderCircle className="mx-auto animate-spin text-orange-500" />
                  </td>
                </tr>
              ) : (
                items.map((i) => (
                  <tr key={i._id} className="hover:bg-orange-50/30">
                    <td className="max-w-[300px] px-4 py-4">
                      <p className="font-mono text-xs text-slate-400">
                        {i.questionId}
                      </p>
                      <p className="mt-1 line-clamp-2 font-medium">
                        {i.questionText}
                      </p>
                    </td>
                    <td className="px-4 py-4">{i.createdByName || "Saya"}</td>
                    <td className="px-4 py-4">
                      {i.program}
                      <br />
                      <span className="text-xs text-slate-400">
                        {i.className}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {i.subject}
                      <br />
                      <span className="text-xs text-slate-400">{i.topic}</span>
                    </td>
                    <td className="px-4 py-4">{i.difficulty}</td>
                    <td className="px-4 py-4">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">
                        {i.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => setSelected(i)}
                        className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold"
                      >
                        <Eye className="size-3.5" />
                        Detail
                      </button>
                    </td>
                  </tr>
                ))
              )}
              {!loading && !items.length && (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-500">
                    Tidak ada data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-slate-500">
          <span>
            Halaman {page} dari {pages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border px-3 py-1.5 disabled:opacity-40"
            >
              Sebelumnya
            </button>
            <button
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border px-3 py-1.5 disabled:opacity-40"
            >
              Berikutnya
            </button>
          </div>
        </div>
      </div>
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm md:p-6">
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-start justify-between border-b border-slate-200 px-5 py-4 md:px-7">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-slate-950">Detail Soal</h2>
                <p className="mt-1 break-all font-mono text-xs text-slate-400">{selected.questionId}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="ml-4 rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Tutup detail soal">
                <X className="size-5" />
              </button>
            </div>
            <div className="min-h-0 overflow-y-auto px-5 py-5 md:px-7">
              <div className="mb-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-orange-50 px-3 py-1 font-semibold text-orange-700">{selected.program} · {selected.className}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{selected.subject}</span>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">{selected.difficulty}</span>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">{selected.status}</span>
              </div>
              <p className="whitespace-pre-wrap break-words text-base font-medium leading-7 text-slate-900 [overflow-wrap:anywhere]">
                {selected.questionText}
              </p>
            {selected.imageUrl ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <img
                  src={selected.imageUrl}
                  alt="Gambar pendukung soal"
                  className="mx-auto max-h-[420px] max-w-full rounded-lg object-contain"
                />
              </div>
            ) : null}
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {["A", "B", "C", "D"].map((k) => (
                <div key={k} className={`min-w-0 rounded-xl border p-3 text-sm leading-6 ${selected.correctAnswer === k ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
                  <b>{k}.</b> <span className="break-words [overflow-wrap:anywhere]">{selected.options?.[k]}</span>
                </div>
              ))}
            </div>
              <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
                <p className="font-semibold text-slate-800">Pembahasan</p>
                <p className="mt-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{selected.explanation}</p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-4 md:px-7">
              {(selected.status === "draft" || selected.status === "rejected") && (
                <button type="button" disabled={saving} onClick={() => void requestReview(selected)} className="rounded-xl border border-orange-200 bg-orange-50 px-5 py-2.5 text-sm font-semibold text-orange-700 hover:bg-orange-100 disabled:opacity-60">Ajukan review</button>
              )}
              <button
              onClick={() => {
                setForm({ ...selected, options: { ...selected.options } });
                setSelected(null);
              }}
              className="rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
            >
              Edit soal
            </button>
            </div>
          </div>
        </div>
      )}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm md:p-6">
          <form
            onSubmit={save}
            className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex shrink-0 items-start justify-between border-b border-slate-200 px-5 py-4 md:px-7">
              <div>
                <h2 className="text-lg font-bold text-slate-950">{form._id ? "Edit soal" : "Tambah soal baru"}</h2>
                <p className="mt-1 text-xs text-slate-500">Lengkapi soal, opsi, kunci, dan pembahasan sebelum dikirim untuk review.</p>
              </div>
              <button type="button" onClick={() => setForm(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Tutup form soal">
                <X className="size-5" />
              </button>
            </div>
            <div className="min-h-0 overflow-y-auto px-5 py-5 md:px-7">
              <div className="grid gap-4 md:grid-cols-3">
                <label className="text-xs font-semibold text-slate-700">Jenjang
                  <select required value={form.program || ""} onChange={(e) => set("program", e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal"><option value="">Pilih jenjang</option><option>SD</option><option>SMP</option><option>SMA</option><option>UTBK</option></select>
                </label>
                <label className="text-xs font-semibold text-slate-700">Kelas
                  <input required value={form.className || ""} onChange={(e) => set("className", e.target.value)} placeholder="Contoh: Kelas 8" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal" />
                </label>
                <label className="text-xs font-semibold text-slate-700">Mata pelajaran
                  <input required value={form.subject || ""} onChange={(e) => set("subject", e.target.value)} placeholder="Contoh: Matematika" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal" />
                </label>
                <label className="text-xs font-semibold text-slate-700 md:col-span-2">Topik
                  <input required value={form.topic || ""} onChange={(e) => set("topic", e.target.value)} placeholder="Contoh: Persamaan Linear" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal" />
                </label>
                <label className="text-xs font-semibold text-slate-700">Kesulitan
                  <select value={form.difficulty || "Sedang"} onChange={(e) => set("difficulty", e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal"><option>Mudah</option><option>Sedang</option><option>Sulit</option></select>
                </label>
                <label className="text-xs font-semibold text-slate-700 md:col-span-2">Indikator
                  <input value={form.indicator || ""} onChange={(e) => set("indicator", e.target.value)} placeholder="Kompetensi yang diukur" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal" />
                </label>
                <label className="text-xs font-semibold text-slate-700">Level kognitif
                  <input value={form.cognitiveLevel || ""} onChange={(e) => set("cognitiveLevel", e.target.value)} placeholder="Contoh: C3" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal" />
                </label>
              </div>
              <label className="mt-5 block text-xs font-semibold text-slate-700">Pertanyaan
                <textarea required value={form.questionText || ""} onChange={(e) => set("questionText", e.target.value)} rows={6} placeholder="Tulis pertanyaan secara lengkap..." className="mt-1 w-full resize-y rounded-xl border border-slate-200 p-3 text-sm font-normal leading-6" />
              </label>
              <label className="mt-4 block text-xs font-semibold text-slate-700">
              Gambar pertanyaan <span className="font-normal text-slate-400">(opsional)</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => selectQuestionImage(event.target.files?.[0])}
                className="mt-1 block w-full rounded-xl border border-slate-200 p-2.5 text-sm font-normal"
              />
            </label>
            {form.imageDataUri || form.imageUrl ? (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <img
                  src={form.imageDataUri || form.imageUrl}
                  alt="Preview gambar soal"
                  className="mx-auto max-h-56 w-auto rounded-lg object-contain"
                />
              </div>
            ) : null}
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {["A", "B", "C", "D"].map((k) => (
                <label key={k} className="text-xs font-semibold">
                  Opsi {k}
                  <input
                    required
                    value={form.options[k]}
                    onChange={(e) =>
                      setForm((v: any) => ({
                        ...v,
                        options: { ...v.options, [k]: e.target.value },
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm font-normal"
                  />
                </label>
              ))}
            </div>
              <div className="mt-5 grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
                <label className="block text-xs font-semibold text-slate-700">Kunci jawaban
              <select
                value={form.correctAnswer}
                onChange={(e) => set("correctAnswer", e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-normal"
              >
                <option>A</option>
                <option>B</option>
                <option>C</option>
                <option>D</option>
                  </select>
                </label>
                <label className="block text-xs font-semibold text-slate-700">Pembahasan
                  <textarea required value={form.explanation || ""} onChange={(e) => set("explanation", e.target.value)} rows={5} placeholder="Jelaskan alasan jawaban yang benar..." className="mt-1 w-full resize-y rounded-xl border border-slate-200 p-3 text-sm font-normal leading-6" />
                </label>
              </div>
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-5 py-4 md:px-7">
              <button type="button" onClick={() => setForm(null)} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Batal</button>
              <button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60">{saving ? <><LoaderCircle className="size-4 animate-spin" />Menyimpan...</> : "Simpan soal"}</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
