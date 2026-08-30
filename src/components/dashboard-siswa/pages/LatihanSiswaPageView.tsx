"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BookOpen,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  Send,
  FlaskConical,
  Calculator,
  Globe,
  FileText,
  Clock,
  AlertCircle,
} from "lucide-react";

import { useStudentLearningData } from "../data/useStudentLearningData";
import { getStudentAcademicAccessMessage } from "../data/studentAcademicAccess";
import { isUtbkStudentProfile } from "../data/studentProgram";
import StudentLearningShell from "../learning/StudentLearningShell";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { withStoredAuthHeader } from "@/lib/auth";

function formatSubmissionTime(value: string | null | undefined) {
  if (!value) {
    return "waktu belum tersedia";
  }

  const submittedDate = new Date(value);

  if (Number.isNaN(submittedDate.getTime())) {
    return "waktu belum tersedia";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(submittedDate);
}

function getTaskStatusClass(
  status:
    | "Belum Dikerjakan"
    | "Menunggu Dikirim"
    | "Sudah Dikirim"
    | "Sudah Dinilai"
    | "Perlu Remedial",
) {
  if (status === "Sudah Dinilai") {
    return "bg-emerald-50 text-emerald-600";
  }
  if (status === "Perlu Remedial") {
    return "bg-amber-50 text-amber-700";
  }
  if (status === "Sudah Dikirim") {
    return "bg-sky-50 text-sky-600";
  }
  if (status === "Menunggu Dikirim") {
    return "bg-amber-50 text-amber-600";
  }
  return "bg-rose-50 text-rose-600";
}

function getSubjectStyle(subject: string) {
  const lower = subject.toLowerCase();
  if (
    lower.includes("ipa") ||
    lower.includes("sains") ||
    lower.includes("biologi") ||
    lower.includes("fisika")
  ) {
    return { bg: "bg-orange-50", text: "text-orange-500", icon: FlaskConical };
  }
  if (lower.includes("bahasa") || lower.includes("english")) {
    return { bg: "bg-purple-50", text: "text-purple-500", icon: BookOpen };
  }
  if (lower.includes("matematika") || lower.includes("math")) {
    return { bg: "bg-blue-50", text: "text-blue-500", icon: Calculator };
  }
  if (
    lower.includes("ips") ||
    lower.includes("sejarah") ||
    lower.includes("geografi")
  ) {
    return { bg: "bg-emerald-50", text: "text-emerald-500", icon: Globe };
  }
  return { bg: "bg-slate-50", text: "text-slate-500", icon: FileText };
}

function LatihanSiswaPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tasks, academicAccess, isLoading, loadError, student } =
    useStudentLearningData();
  const isUtbkStudent = isUtbkStudentProfile(student);
  const pendingTasks = tasks.filter((task) => task.status !== "Sudah Dinilai");
  const academicAccessMessage = getStudentAcademicAccessMessage(academicAccess);

  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const requestedTaskId = searchParams?.get("taskId")?.trim() ?? "";

  const selectedTask = tasks.find((task) => task.id === selectedTaskId);

  const handleOpenTask = (id: string) => {
    setSelectedTaskId(id);
    setIsDialogOpen(true);
  };

  const handleStartLatihanCbt = async (
    taskId: string,
    e?: React.MouseEvent,
  ) => {
    e?.preventDefault();
    e?.stopPropagation();

    try {
      const response = await fetch(
        `/api/student/me/learning/tasks/${encodeURIComponent(taskId)}/cbt/start`,
        {
          method: "POST",
          ...withStoredAuthHeader(),
          credentials: "include",
          cache: "no-store",
        },
      );
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success || !payload.data?.attemptId) {
        throw new Error(payload?.message || "Latihan belum bisa dimulai.");
      }

      router.push(
        `/dashboard-siswa/latihan/${encodeURIComponent(payload.data.attemptId)}/cbt`,
      );
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat memulai latihan.",
      );
    }
  };

  useEffect(() => {
    if (isUtbkStudent) {
      router.replace("/dashboard-siswa/materi");
    }
  }, [isUtbkStudent, router]);

  useEffect(() => {
    if (!requestedTaskId || tasks.length === 0) {
      return;
    }

    if (tasks.some((task) => task.id === requestedTaskId)) {
      queueMicrotask(() => {
        setSelectedTaskId(requestedTaskId);
        setIsDialogOpen(true);
      });
    }
  }, [requestedTaskId, tasks]);

  if (isUtbkStudent) {
    return (
      <StudentLearningShell
        title="Mengalihkan ke Materi UTBK"
        description="Program UTBK tidak memakai latihan reguler."
        summary="Area UTBK"
        isUtbkStudent
      >
        <section className="rounded-[24px] border border-orange-100 bg-white px-5 py-10 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-700">
            Mengalihkan ke kelas UTBK...
          </p>
        </section>
      </StudentLearningShell>
    );
  }

  return (
    <StudentLearningShell
      title="Latihan Soal"
      description="Pilih latihan dari pertemuan kelas, lalu mulai CBT. Hasilnya langsung masuk ke nilai dan progres belajar."
      summary={
        isLoading ? "Memuat latihan..." : `${pendingTasks.length} latihan aktif`
      }
      isNavigationLoading={isLoading && !student}
    >
      {isLoading ? (
        <section className="rounded-[24px] border border-slate-200/60 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-400 mb-4">
            <FileText className="h-8 w-8 animate-pulse" />
          </div>
          <p className="text-lg font-semibold text-slate-800">
            Sedang Memuat Latihan
          </p>
          <p className="mt-2 text-sm font-medium text-slate-500">
            Sistem sedang mengambil latihan CBT terbaru dari kelas kamu...
          </p>
        </section>
      ) : tasks.length === 0 ? (
        <section className="rounded-[24px] border border-slate-200/60 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-orange-50 text-orange-500 mb-4">
            <FileText className="h-8 w-8" />
          </div>
          <p className="text-lg font-semibold text-slate-800">
            Belum Ada Latihan Soal
          </p>
          <p className="mt-2 text-sm font-medium text-slate-500 max-w-md mx-auto">
            {academicAccessMessage ??
              loadError ??
              "Guru belum menambahkan latihan CBT untuk kelas kamu."}
          </p>
        </section>
      ) : (
        <>
          <section>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <div className="w-1.5 h-6 bg-orange-500 rounded-full mr-3"></div>
                <h3 className="text-xl font-semibold text-slate-800">
                  Latihan CBT dan riwayat hasil
                </h3>
              </div>
              <p className="hidden md:block text-sm font-medium text-slate-500">
                Mulai latihan sesuai pertemuan, hasilnya langsung memperbarui
                progres belajar.
              </p>
            </div>

            <div className="grid gap-4">
              {tasks.map((task) => {
                const SubjectIcon = getSubjectStyle(task.mapel).icon;
                const subjectBg = getSubjectStyle(task.mapel).bg;
                const subjectText = getSubjectStyle(task.mapel).text;

                return (
                  <article
                    key={task.id}
                    onClick={() => handleOpenTask(task.id)}
                    className="group cursor-pointer flex flex-col gap-4 rounded-[20px] border border-slate-200 bg-white p-5 transition-all md:flex-row md:items-center md:justify-between hover:border-orange-300 hover:shadow-sm"
                  >
                    <div className="flex flex-1 items-start gap-5">
                      <div
                        className={`flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-full ${subjectBg} ${subjectText}`}
                      >
                        <SubjectIcon className="h-8 w-8" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="rounded-full bg-orange-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-orange-600">
                            {task.mapel}
                          </span>
                          <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-blue-500">
                            Pertemuan {task.pertemuan}
                          </span>
                          <span
                            className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${getTaskStatusClass(
                              task.status,
                            )}`}
                          >
                            {task.status}
                          </span>
                        </div>

                        <h4 className="text-[17px] font-semibold text-slate-800 group-hover:text-orange-600 transition-colors">
                          {task.judul}
                        </h4>
                        <p className="mt-1 text-sm font-medium leading-relaxed text-slate-500 line-clamp-2 pr-4">
                          {task.deskripsi}
                        </p>

                        <p className="mt-2 text-xs font-medium text-slate-400">
                          {task.questionCount || 30} soal CBT | Batas{" "}
                          {task.deadline} | Estimasi {task.estimasi} |{" "}
                          {task.poin}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          Jadwal pengerjaan: {task.jadwalPengerjaan}
                        </p>

                        {task.mySubmission?.submittedAt ? (
                          <p className="mt-1.5 text-[11px] font-semibold text-sky-600">
                            Selesai dikerjakan pada{" "}
                            {formatSubmissionTime(
                              task.mySubmission.submittedAt,
                            )}
                          </p>
                        ) : null}

                        {task.isRemedial ? (
                          <div className="mt-3 rounded-[16px] border border-amber-100 bg-amber-50/60 p-3 max-w-xl">
                            <div className="flex flex-wrap items-center gap-2 text-xs mb-2">
                              <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-800">
                                Nilai {task.myGrade?.score ?? "-"}
                              </span>
                              <span className="font-semibold text-amber-700">
                                Perlu Remedial
                              </span>
                            </div>
                            <p className="text-sm font-medium leading-relaxed text-amber-800">
                              {task.myGrade?.note || task.availabilityMessage}
                            </p>
                          </div>
                        ) : task.myGrade?.graded ? (
                          <div className="mt-3 rounded-[16px] border border-emerald-100 bg-emerald-50/50 p-3 max-w-xl">
                            <div className="flex flex-wrap items-center gap-2 text-xs mb-2">
                              <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-800">
                                Nilai {task.myGrade.score ?? "-"}
                              </span>
                              <span className="font-semibold text-emerald-600">
                                Hasil tersimpan pada{" "}
                                {formatSubmissionTime(task.myGrade.gradedAt)}
                              </span>
                            </div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
                              Catatan Pembahasan
                            </p>
                            <p className="mt-1 text-sm font-medium text-slate-600 leading-relaxed">
                              {task.myGrade.note || "Tidak ada catatan."}
                            </p>
                          </div>
                        ) : task.mySubmission?.submitted ? (
                          <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-amber-600">
                            <AlertCircle className="h-3.5 w-3.5" />
                            Menunggu hasil latihan tersimpan.
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mt-4 md:mt-0 ml-[88px] md:ml-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenTask(task.id);
                        }}
                        className="inline-flex h-11 flex-1 md:w-[120px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                      >
                        <Eye className="h-[18px] w-[18px] text-slate-500" />
                        Detail
                      </button>
                      {task.myGrade?.graded || task.mySubmission?.submitted ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (task.myAttempt?.attemptId) {
                              router.push(
                                `/dashboard-siswa/latihan/${encodeURIComponent(task.myAttempt.attemptId)}/cbt`,
                              );
                            }
                          }}
                          disabled={!task.myAttempt?.attemptId}
                          className="inline-flex h-11 flex-1 md:w-[150px] items-center justify-center gap-2 rounded-xl border border-emerald-500 bg-emerald-50 px-4 text-[13px] font-semibold text-emerald-700 shadow-sm transition-all hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
                        >
                          <Eye className="h-[18px] w-[18px]" />
                          Review Hasil
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(event) =>
                            handleStartLatihanCbt(task.id, event)
                          }
                          disabled={!task.isCbtReady}
                          className="inline-flex h-11 flex-1 md:w-[150px] items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 text-[13px] font-semibold text-white shadow-sm transition-all hover:-translate-y-px hover:bg-orange-600 hover:shadow-md disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none disabled:hover:translate-y-0"
                        >
                          <Send className="h-[18px] w-[18px]" />
                          {task.isRemedial
                            ? "Kerjakan Remedial"
                            : task.isCbtReady
                              ? "Mulai Latihan"
                              : "Belum Siap"}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}

      {/* Detail Latihan Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl gap-0 p-0 overflow-hidden rounded-[24px] border-slate-200 bg-white shadow-lg">
          {selectedTask && (
            <div className="flex flex-col">
              {/* Header */}
              <div className="bg-slate-50 px-6 py-6 border-b border-slate-100 pr-12">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="rounded-full bg-orange-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-orange-600">
                    {selectedTask.mapel}
                  </span>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-blue-500">
                    Pertemuan {selectedTask.pertemuan}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${getTaskStatusClass(
                      selectedTask.status,
                    )}`}
                  >
                    {selectedTask.status}
                  </span>
                </div>
                <DialogTitle className="text-xl font-semibold text-slate-800 leading-tight">
                  {selectedTask.judul}
                </DialogTitle>
              </div>

              {/* Content */}
              <div className="px-6 py-6">
                <div className="flex flex-wrap items-center gap-3 mb-6">
                  <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
                    <Clock className="h-4 w-4 text-rose-500" /> Batas:{" "}
                    {selectedTask.deadline}
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
                    <Clock3 className="h-4 w-4 text-blue-500" /> Estimasi:{" "}
                    {selectedTask.estimasi}
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
                    <Clock3 className="h-4 w-4 text-orange-500" /> Jadwal:{" "}
                    {selectedTask.jadwalPengerjaan}
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />{" "}
                    Target: {selectedTask.poin}
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3.5 py-1.5 text-xs font-semibold text-orange-700">
                    <FileText className="h-4 w-4" />{" "}
                    {selectedTask.questionCount || 30} soal CBT
                  </div>
                </div>

                <div className="rounded-[20px] bg-slate-50 border border-slate-100 p-6">
                  <h4 className="font-semibold text-slate-800 mb-3 text-base">
                    Instruksi Latihan CBT
                  </h4>
                  <p className="text-sm leading-6 text-slate-600 mb-6">
                    {selectedTask.deskripsi}
                  </p>

                  <div className="space-y-4">
                    {selectedTask.instruksiPengumpulan?.map((point, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </div>
                        <p className="text-sm leading-6 text-slate-700">
                          {point}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Grade or Submission Status in Dialog */}
                {selectedTask.isRemedial ? (
                  <div className="mt-6 rounded-[20px] border border-amber-100 bg-amber-50 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-amber-800">
                        Perlu Remedial
                      </h4>
                      <span className="rounded-full bg-amber-200 px-3 py-1 font-semibold text-amber-900 text-sm">
                        Nilai {selectedTask.myGrade?.score ?? "-"}
                      </span>
                    </div>
                    <p className="text-sm leading-6 text-amber-800">
                      {selectedTask.myGrade?.note ||
                        selectedTask.availabilityMessage}
                    </p>
                  </div>
                ) : selectedTask.myGrade?.graded ? (
                  <div className="mt-6 rounded-[20px] border border-emerald-100 bg-emerald-50 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-emerald-800">
                        Hasil Latihan
                      </h4>
                      <span className="rounded-full bg-emerald-200 px-3 py-1 font-semibold text-emerald-900 text-sm">
                        Nilai {selectedTask.myGrade.score ?? "-"}
                      </span>
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-2">
                      Catatan Pembahasan
                    </p>
                    <p className="text-sm leading-6 text-slate-700">
                      {selectedTask.myGrade.note ||
                        "Tidak ada catatan tambahan."}
                    </p>
                  </div>
                ) : selectedTask.mySubmission?.submitted ? (
                  <div className="mt-6 rounded-[20px] border border-amber-100 bg-amber-50 p-6 flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                      <AlertCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-amber-800">
                        Menunggu Hasil
                      </h4>
                      <p className="text-sm leading-6 text-amber-700 mt-1">
                        Latihan sudah dikerjakan pada{" "}
                        {formatSubmissionTime(
                          selectedTask.mySubmission.submittedAt,
                        )}{" "}
                        dan sedang menunggu hasil tersimpan.
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Footer */}
              <div className="bg-white px-6 py-5 border-t border-slate-100 flex flex-wrap gap-3">
                {selectedTask.attachmentUrl ? (
                  <a
                    href={selectedTask.attachmentUrl}
                    download={selectedTask.attachmentName}
                    className="flex-1 inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 text-[15px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                  >
                    <Download className="h-5 w-5 text-slate-400" />
                    Lampiran Soal
                  </a>
                ) : null}
                {selectedTask.myGrade?.graded ||
                selectedTask.mySubmission?.submitted ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedTask.myAttempt?.attemptId) {
                        router.push(
                          `/dashboard-siswa/latihan/${encodeURIComponent(selectedTask.myAttempt.attemptId)}/cbt`,
                        );
                      }
                    }}
                    disabled={!selectedTask.myAttempt?.attemptId}
                    className="flex-1 inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-emerald-500 bg-emerald-50 px-6 text-[15px] font-semibold text-emerald-700 shadow-sm transition-all hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <Eye className="h-5 w-5" />
                    Review Hasil
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(event) =>
                      handleStartLatihanCbt(selectedTask.id, event)
                    }
                    disabled={!selectedTask.isCbtReady}
                    className="flex-1 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 text-[15px] font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-orange-600 hover:shadow-md disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none disabled:hover:translate-y-0"
                  >
                    <Send className="h-5 w-5" />
                    {selectedTask.isRemedial
                      ? "Kerjakan Remedial"
                      : selectedTask.isCbtReady
                        ? "Mulai Latihan"
                        : "Belum Siap"}
                  </button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </StudentLearningShell>
  );
}

export default function LatihanSiswaPageView() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-slate-500">
          Memuat latihan...
        </div>
      }
    >
      <LatihanSiswaPageContent />
    </Suspense>
  );
}
