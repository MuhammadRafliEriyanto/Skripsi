"use client";

import { useState } from "react";
import {
  BookOpen,
  CalendarClock,
  Download,
  Eye,
  PlayCircle,
} from "lucide-react";

import { useStudentLearningData } from "../data/useStudentLearningData";
import { getStudentAcademicAccessMessage } from "../data/studentAcademicAccess";
import StudentLearningShell from "../learning/StudentLearningShell";

function getMaterialStatusClass(status: "Baru" | "Dipelajari") {
  if (status === "Baru") {
    return "bg-emerald-50 text-emerald-700";
  }

  return "bg-slate-100 text-slate-600";
}

export default function MateriSiswaPageView() {
  const { materials, academicAccess, isLoading, loadError } =
    useStudentLearningData();
  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const academicAccessMessage =
    getStudentAcademicAccessMessage(academicAccess);
  const resolvedSelectedMaterialId = materials.some(
    (material) => material.id === selectedMaterialId,
  )
    ? selectedMaterialId
    : (materials[0]?.id ?? "");
  const selectedMaterial =
    materials.find((material) => material.id === resolvedSelectedMaterialId) ??
    materials[0] ??
    null;

  return (
    <StudentLearningShell
      title="Materi Belajar"
      description="Kumpulkan semua materi pembelajaran dalam satu tempat agar sesi belajar harian, penguatan konsep, dan review menjelang ujian terasa lebih terarah."
      summary={
        isLoading ? "Memuat materi..." : `${materials.length} materi siap dipelajari`
      }
    >
      {isLoading ? (
        <section className="rounded-[26px] border border-orange-100/90 bg-white p-8 text-center shadow-[0_18px_40px_-34px_rgba(15,23,42,0.18)]">
          <p className="text-base font-semibold text-slate-800">
            Materi sedang dimuat
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Sistem sedang mengambil materi terbaru dari kelas kamu.
          </p>
        </section>
      ) : !selectedMaterial ? (
        <section className="rounded-[26px] border border-orange-100/90 bg-white p-8 text-center shadow-[0_18px_40px_-34px_rgba(15,23,42,0.18)]">
          <p className="text-base font-semibold text-slate-800">
            Belum ada materi tersedia
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {academicAccessMessage ??
              loadError ??
              "Guru belum membagikan materi yang dipublikasikan untuk kelas kamu."}
          </p>
        </section>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <section className="rounded-[26px] border border-orange-100/90 bg-white p-5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.18)] md:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-600">
                    Materi Terpilih
                  </p>
                  <h2 className="mt-2 text-lg font-semibold text-slate-800">
                    {selectedMaterial.judul}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {selectedMaterial.ringkasan}
                  </p>
                </div>

                <div className="rounded-2xl bg-orange-50 p-3 text-orange-600">
                  <BookOpen className="h-6 w-6" />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-orange-100 bg-orange-50/70 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-500">
                    Mapel
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-700">
                    {selectedMaterial.mapel}
                  </p>
                </div>
                <div className="rounded-2xl border border-orange-100 bg-orange-50/70 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-500">
                    Durasi
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-700">
                    {selectedMaterial.durasi}
                  </p>
                </div>
                <div className="rounded-2xl border border-orange-100 bg-orange-50/70 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-500">
                    Format
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-700">
                    {selectedMaterial.format}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedMaterialId(selectedMaterial.id)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-800 via-orange-600 to-amber-500 px-5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px"
                >
                  <PlayCircle className="h-4 w-4" />
                  Lihat Materi
                </button>
                <a
                  href={selectedMaterial.downloadUrl}
                  download={selectedMaterial.downloadName}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-orange-200 bg-white px-5 text-sm font-semibold text-orange-700 transition hover:bg-orange-50"
                >
                  <Download className="h-4 w-4" />
                  Download Materi
                </a>
                <button
                  type="button"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-orange-200 bg-white px-5 text-sm font-semibold text-orange-700 transition hover:bg-orange-50"
                >
                  <CalendarClock className="h-4 w-4" />
                  Simpan ke Jadwal Belajar
                </button>
              </div>
            </section>

            <section className="rounded-[26px] border border-orange-100/90 bg-white p-5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.18)] md:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-600">
                    Preview Materi
                  </p>
                  <h2 className="mt-2 text-lg font-semibold text-slate-800">
                    {selectedMaterial.previewHeading}
                  </h2>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  {selectedMaterial.status}
                </span>
              </div>

              <div className="mt-5 space-y-4">
                <p className="text-sm leading-6 text-slate-500">
                  {selectedMaterial.previewBody}
                </p>

                <div className="space-y-3">
                  {selectedMaterial.previewPoints.map((point) => (
                    <div
                      key={point}
                      className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                    >
                      <p className="text-sm leading-6 text-slate-700">{point}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <section className="rounded-[26px] border border-orange-100/90 bg-white p-5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.18)] md:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-600">
                  Daftar Materi
                </p>
                <h2 className="mt-2 text-lg font-semibold text-slate-800">
                  Semua materi yang tersedia
                </h2>
              </div>
              <p className="text-sm text-slate-500">
                Pilih untuk lihat preview cepat atau download materi langsung.
              </p>
            </div>

            <div className="mt-5 space-y-3">
              {materials.map((material) => {
                const isSelected = selectedMaterial.id === material.id;

                return (
                  <article
                    key={material.id}
                    className={`flex flex-col gap-4 rounded-[22px] border p-4 transition lg:flex-row lg:items-center lg:justify-between ${
                      isSelected
                        ? "border-orange-200 bg-orange-50/50"
                        : "border-orange-100/80 hover:border-orange-200 hover:bg-orange-50/30"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-700">
                          {material.mapel}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-500">
                          Pertemuan {material.pertemuan}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getMaterialStatusClass(
                            material.status,
                          )}`}
                        >
                          {material.status}
                        </span>
                      </div>

                      <h3 className="mt-2 text-sm font-semibold text-slate-800">
                        {material.judul}
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        {material.ringkasan}
                      </p>
                      <p className="mt-2 text-xs text-slate-400">
                        {material.format} | {material.durasi} | {material.diperbarui}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedMaterialId(material.id)}
                        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Lihat Materi
                      </button>
                      <a
                        href={material.downloadUrl}
                        download={material.downloadName}
                        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-red-800 via-orange-600 to-amber-500 px-4 text-xs font-semibold text-white shadow-sm transition hover:-translate-y-px"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}
    </StudentLearningShell>
  );
}
