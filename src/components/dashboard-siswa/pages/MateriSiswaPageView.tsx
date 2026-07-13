"use client";

import { useState } from "react";
import {
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  PlayCircle,
  Clock,
  MonitorPlay,
} from "lucide-react";

import { useStudentLearningData } from "../data/useStudentLearningData";
import { getStudentAcademicAccessMessage } from "../data/studentAcademicAccess";
import StudentLearningShell from "../learning/StudentLearningShell";

function getMaterialStatusClass(status: "Baru" | "Dipelajari") {
  if (status === "Baru") {
    return "bg-emerald-100 text-emerald-700 border-emerald-200";
  }

  return "bg-slate-100 text-slate-600 border-slate-200";
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
      description="Jelajahi dan pelajari materi yang telah disiapkan khusus untuk kelasmu."
      summary={
        isLoading ? "Memuat materi..." : `${materials.length} materi siap dipelajari`
      }
    >
      {isLoading ? (
        <section className="rounded-[24px] border border-slate-200/60 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-400 mb-4">
            <BookOpen className="h-8 w-8 animate-pulse" />
          </div>
          <p className="text-lg font-bold text-slate-800">
            Sedang Memuat Materi
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Sistem sedang mengambil kurikulum terbaru untukmu...
          </p>
        </section>
      ) : !selectedMaterial ? (
        <section className="rounded-[24px] border border-slate-200/60 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-orange-50 text-orange-400 mb-4">
            <BookOpen className="h-8 w-8" />
          </div>
          <p className="text-lg font-bold text-slate-800">
            Belum Ada Materi Tersedia
          </p>
          <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
            {academicAccessMessage ??
              loadError ??
              "Tutor kamu belum membagikan materi apa pun untuk sesi pembelajaran ini."}
          </p>
        </section>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
            {/* Left Column: Materi Terpilih */}
            <section className="rounded-[24px] border border-slate-200/60 bg-white p-6 shadow-sm flex flex-col h-full transition-all hover:shadow-md md:p-8">
              <div className="flex items-center gap-2 mb-6">
                <span className="flex items-center gap-1.5 rounded-full border border-orange-100 bg-orange-50 px-3 py-1 text-[11px] font-bold tracking-wider text-orange-600 uppercase">
                  <PlayCircle className="h-3.5 w-3.5" /> Sedang Dipilih
                </span>
              </div>
              
              <div className="mb-8">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                  {selectedMaterial.judul}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-500">
                  {selectedMaterial.ringkasan}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 mb-8">
                <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-semibold text-slate-600">
                  <BookOpen className="h-4 w-4 text-orange-500" /> {selectedMaterial.mapel}
                </div>
                <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-semibold text-slate-600">
                  <Clock className="h-4 w-4 text-blue-500" /> {selectedMaterial.durasi}
                </div>
                <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-semibold text-slate-600">
                  <FileText className="h-4 w-4 text-emerald-500" /> {selectedMaterial.format}
                </div>
              </div>

              <div className="mt-auto flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedMaterialId(selectedMaterial.id)}
                  className="inline-flex h-12 flex-1 sm:flex-none items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 text-sm font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-orange-600 hover:shadow-md"
                >
                  <MonitorPlay className="h-4 w-4" />
                  Mulai Belajar
                </button>
                <a
                  href={selectedMaterial.downloadUrl}
                  download={selectedMaterial.downloadName}
                  className="inline-flex h-12 flex-1 sm:flex-none items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 text-sm font-bold text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-slate-50"
                >
                  <Download className="h-4 w-4 text-slate-400" />
                  Unduh File
                </a>
              </div>
            </section>

            {/* Right Column: Pratinjau Materi */}
            <section className="rounded-[24px] border border-slate-200/60 bg-slate-50/50 p-6 shadow-sm flex flex-col h-full md:p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-900">
                  Pratinjau Materi
                </h3>
                <span className={`rounded-full px-3 py-1 border text-xs font-bold ${getMaterialStatusClass(selectedMaterial.status)}`}>
                  {selectedMaterial.status}
                </span>
              </div>

              <div className="flex-1 rounded-[20px] bg-white border border-slate-200 p-6 shadow-sm">
                <h4 className="font-bold text-slate-800 mb-3">
                  {selectedMaterial.previewHeading}
                </h4>
                <p className="text-sm leading-relaxed text-slate-500 mb-6">
                  {selectedMaterial.previewBody}
                </p>

                <div className="space-y-4">
                  {selectedMaterial.previewPoints.map((point, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3"
                    >
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </div>
                      <p className="text-sm leading-relaxed text-slate-700">{point}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          {/* Bottom List: Daftar Materi */}
          <section className="mt-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-900">
                Daftar Materi Kelas
              </h3>
            </div>

            <div className="grid gap-4">
              {materials.map((material) => {
                const isSelected = selectedMaterial.id === material.id;

                return (
                  <article
                    key={material.id}
                    onClick={() => setSelectedMaterialId(material.id)}
                    className={`group cursor-pointer flex flex-col gap-4 rounded-[20px] border p-5 transition-all md:flex-row md:items-center md:justify-between ${
                      isSelected
                        ? "border-orange-500 bg-orange-50/30 shadow-sm"
                        : "border-slate-200 bg-white hover:border-orange-300 hover:shadow-sm"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-700">
                          {material.mapel}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                          Pertemuan {material.pertemuan}
                        </span>
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getMaterialStatusClass(
                            material.status,
                          )}`}
                        >
                          {material.status}
                        </span>
                      </div>

                      <h4 className="text-base font-bold text-slate-900 group-hover:text-orange-600 transition-colors">
                        {material.judul}
                      </h4>
                      <p className="mt-1 text-sm leading-relaxed text-slate-500 line-clamp-1">
                        {material.ringkasan}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 mt-2 md:mt-0">
                      <div className="hidden flex-col items-end mr-4 sm:flex">
                        <p className="text-xs font-semibold text-slate-700">{material.format}</p>
                        <p className="text-[11px] font-medium text-slate-400">{material.durasi}</p>
                      </div>
                      
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMaterialId(material.id);
                        }}
                        className="inline-flex h-10 flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                      >
                        <Eye className="h-4 w-4 text-slate-400" />
                        Lihat
                      </button>
                      <a
                        href={material.downloadUrl}
                        download={material.downloadName}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex h-10 flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-xl bg-orange-500 px-4 text-xs font-bold text-white shadow-sm transition-all hover:-translate-y-px hover:bg-orange-600"
                      >
                        <Download className="h-4 w-4" />
                        Unduh
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
