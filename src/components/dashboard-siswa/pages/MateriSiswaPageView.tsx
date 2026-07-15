"use client";

import { useState } from "react";
import {
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Clock,
  X,
  FlaskConical,
  Calculator,
  Globe,
  Lightbulb,
} from "lucide-react";

import { useStudentLearningData } from "../data/useStudentLearningData";
import { getStudentAcademicAccessMessage } from "../data/studentAcademicAccess";
import StudentLearningShell from "../learning/StudentLearningShell";
import { Dialog, DialogContent, DialogTitle, DialogClose } from "@/components/ui/dialog";

function getMaterialStatusClass(status: "Baru" | "Dipelajari") {
  if (status === "Baru") {
    return "bg-emerald-50 text-emerald-600";
  }

  return "bg-slate-100 text-slate-500";
}

function getSubjectStyle(subject: string) {
  const lower = subject.toLowerCase();
  if (lower.includes('ipa') || lower.includes('sains') || lower.includes('biologi') || lower.includes('fisika')) {
    return { bg: 'bg-orange-50', text: 'text-orange-500', icon: FlaskConical };
  }
  if (lower.includes('bahasa') || lower.includes('english')) {
    return { bg: 'bg-purple-50', text: 'text-purple-500', icon: BookOpen };
  }
  if (lower.includes('matematika') || lower.includes('math')) {
    return { bg: 'bg-blue-50', text: 'text-blue-500', icon: Calculator };
  }
  if (lower.includes('ips') || lower.includes('sejarah') || lower.includes('geografi')) {
    return { bg: 'bg-emerald-50', text: 'text-emerald-500', icon: Globe };
  }
  return { bg: 'bg-slate-50', text: 'text-slate-500', icon: FileText };
}

export default function MateriSiswaPageView() {
  const { materials, academicAccess, isLoading, loadError } =
    useStudentLearningData();
  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const academicAccessMessage =
    getStudentAcademicAccessMessage(academicAccess);
    
  const selectedMaterial = materials.find((material) => material.id === selectedMaterialId);

  const handleOpenMaterial = (id: string) => {
    setSelectedMaterialId(id);
    setIsDialogOpen(true);
  };

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
          <p className="mt-2 text-sm font-medium text-slate-500">
            Sistem sedang mengambil kurikulum terbaru untukmu...
          </p>
        </section>
      ) : materials.length === 0 ? (
        <section className="rounded-[24px] border border-slate-200/60 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-orange-50 text-orange-500 mb-4">
            <BookOpen className="h-8 w-8" />
          </div>
          <p className="text-lg font-bold text-slate-800">
            Belum Ada Materi Tersedia
          </p>
          <p className="mt-2 text-sm font-medium text-slate-500 max-w-md mx-auto">
            {academicAccessMessage ??
              loadError ??
              "Tutor kamu belum membagikan materi apa pun untuk sesi pembelajaran ini."}
          </p>
        </section>
      ) : (
        <section className="mt-2">
          <div className="flex items-center mb-6">
            <div className="w-1.5 h-6 bg-orange-500 rounded-full mr-3"></div>
            <h3 className="text-xl font-bold text-slate-800">
              Daftar Materi Kelas
            </h3>
          </div>

          <div className="grid gap-4">
            {materials.map((material) => {
              const SubjectIcon = getSubjectStyle(material.mapel).icon;
              const subjectBg = getSubjectStyle(material.mapel).bg;
              const subjectText = getSubjectStyle(material.mapel).text;

              return (
                <article
                  key={material.id}
                  onClick={() => handleOpenMaterial(material.id)}
                  className="group cursor-pointer flex flex-col gap-4 rounded-[20px] border border-slate-200 bg-white p-5 transition-all md:flex-row md:items-center md:justify-between hover:border-orange-300 hover:shadow-sm"
                >
                  <div className="flex flex-1 items-start gap-5">
                    <div className={`flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-full ${subjectBg} ${subjectText}`}>
                      <SubjectIcon className="h-8 w-8" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="rounded-full bg-orange-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-orange-600">
                          {material.mapel}
                        </span>
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-500">
                          Pertemuan {material.pertemuan}
                        </span>
                        <span
                          className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${getMaterialStatusClass(
                            material.status,
                          )}`}
                        >
                          {material.status}
                        </span>
                      </div>

                      <h4 className="text-[17px] font-bold text-slate-800 group-hover:text-orange-600 transition-colors">
                        {material.judul}
                      </h4>
                      <p className="mt-1 text-sm font-medium leading-relaxed text-slate-500 line-clamp-2 pr-4">
                        {material.ringkasan}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-4 md:mt-0 ml-[88px] md:ml-0">
                    <div className="hidden flex-col items-center justify-center sm:flex w-24">
                      <p className="text-sm font-bold text-slate-800">{material.format}</p>
                      <p className="text-xs font-semibold text-blue-500 mt-1">{material.durasi}</p>
                    </div>
                    
                    <div className="hidden h-12 w-px bg-slate-100 lg:block mx-2"></div>
                    
                    <div className="flex items-center gap-3 w-full md:w-auto">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenMaterial(material.id);
                        }}
                        className="inline-flex h-11 flex-1 md:w-[100px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-bold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                      >
                        <Eye className="h-[18px] w-[18px] text-slate-500" />
                        Lihat
                      </button>
                      <a
                        href={material.downloadUrl}
                        download={material.downloadName}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex h-11 flex-1 md:w-[110px] items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 text-[13px] font-bold text-white shadow-sm transition-all hover:bg-orange-600"
                      >
                        <Download className="h-[18px] w-[18px]" />
                        Unduh
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-6 rounded-[20px] bg-[#fff5eb] border border-orange-100 p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white shadow-sm">
                <Lightbulb className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-orange-700">Tips Belajar</h4>
                <p className="text-sm font-medium text-slate-600 mt-0.5">
                  Pelajari materi secara bertahap dan kerjakan tugas untuk meningkatkan pemahamanmu.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Detail Material Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl gap-0 p-0 overflow-hidden rounded-[24px] border-slate-200 bg-white shadow-lg">
          {selectedMaterial && (
            <div className="flex flex-col max-h-[85vh]">
              {/* Header */}
              <div className="bg-slate-50 px-6 py-6 border-b border-slate-100 flex items-start justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="rounded-full bg-orange-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-orange-600">
                      {selectedMaterial.mapel}
                    </span>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-500">
                      Pertemuan {selectedMaterial.pertemuan}
                    </span>
                  </div>
                  <DialogTitle className="text-xl font-bold text-slate-800 leading-tight">
                    {selectedMaterial.judul}
                  </DialogTitle>
                </div>
                <DialogClose className="rounded-full p-2 bg-white border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </DialogClose>
              </div>

              {/* Content */}
              <div className="overflow-y-auto px-6 py-6">
                <p className="text-sm font-medium leading-relaxed text-slate-600 mb-6">
                  {selectedMaterial.ringkasan}
                </p>

                <div className="flex flex-wrap items-center gap-3 mb-8">
                  <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-sm">
                    <Clock className="h-4 w-4 text-blue-500" /> {selectedMaterial.durasi}
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-sm">
                    <FileText className="h-4 w-4 text-emerald-500" /> {selectedMaterial.format}
                  </div>
                  <div className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold shadow-sm ${getMaterialStatusClass(selectedMaterial.status)}`}>
                    Status: {selectedMaterial.status}
                  </div>
                </div>

                <div className="rounded-[20px] bg-slate-50 border border-slate-100 p-6">
                  <h4 className="font-bold text-slate-800 mb-3 text-base">
                    {selectedMaterial.previewHeading}
                  </h4>
                  <p className="text-sm font-medium leading-relaxed text-slate-500 mb-6">
                    {selectedMaterial.previewBody}
                  </p>

                  <div className="space-y-4">
                    {selectedMaterial.previewPoints.map((point, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3"
                      >
                        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </div>
                        <p className="text-sm font-medium leading-relaxed text-slate-700">{point}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-white px-6 py-5 border-t border-slate-100 flex flex-wrap gap-3">
                <a
                  href={selectedMaterial.downloadUrl}
                  download={selectedMaterial.downloadName}
                  className="flex-1 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 text-[15px] font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-orange-600 hover:shadow-md"
                >
                  <Download className="h-5 w-5" />
                  Unduh Materi
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </StudentLearningShell>
  );
}
