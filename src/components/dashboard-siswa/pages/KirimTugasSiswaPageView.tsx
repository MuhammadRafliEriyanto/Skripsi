"use client";

import { useState } from "react";
import { Download, FolderOpenDot } from "lucide-react";

import { useStudentLearningData } from "../data/useStudentLearningData";
import { getStudentAcademicAccessMessage } from "../data/studentAcademicAccess";
import FlexibleSubmissionPanel from "../learning/FlexibleSubmissionPanel";
import StudentLearningShell from "../learning/StudentLearningShell";

function formatDateTimeLabel(value: string | null | undefined) {
  if (!value) {
    return "waktu belum tersedia";
  }

  const resolvedDate = new Date(value);

  if (Number.isNaN(resolvedDate.getTime())) {
    return "waktu belum tersedia";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(resolvedDate);
}

function toDateOrder(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const resolvedDate = new Date(value);
  return Number.isNaN(resolvedDate.getTime()) ? 0 : resolvedDate.getTime();
}

export default function KirimTugasSiswaPageView() {
  const {
    tasks,
    academicAccess,
    isLoading,
    loadError,
    refreshLearningData,
    updateTaskSubmissionSummary,
  } = useStudentLearningData();
  const academicAccessMessage =
    getStudentAcademicAccessMessage(academicAccess);
  const submitTargets = tasks.filter(
    (task) => task.status !== "Sudah Dinilai",
  );
  const gradedTasks = tasks.filter((task) => task.myGrade?.graded);
  const submittedTaskCount = submitTargets.filter(
    (task) => task.mySubmission?.submitted,
  ).length;
  const latestGradedTask =
    [...gradedTasks].sort(
      (leftTask, rightTask) =>
        toDateOrder(rightTask.myGrade?.gradedAt) -
        toDateOrder(leftTask.myGrade?.gradedAt),
    )[0] ?? null;
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const resolvedSelectedTaskId = submitTargets.some(
    (task) => task.id === selectedTaskId,
  )
    ? selectedTaskId
    : (submitTargets[0]?.id ?? "");
  const activeTask =
    submitTargets.find((task) => task.id === resolvedSelectedTaskId) ??
    submitTargets[0];

  return (
    <StudentLearningShell
      title="Kirim Jawaban"
      description="Gunakan halaman ini sebagai tempat submit tugas dengan alur yang jelas: pilih tugas, lalu kirim lewat file, teks langsung, atau link Drive."
      summary={
        isLoading
          ? "Memuat tugas..."
          : `${submitTargets.length} tugas aktif, ${submittedTaskCount} sudah dikumpulkan`
      }
    >
      {isLoading ? (
        <section className="rounded-[26px] border border-orange-100/90 bg-white p-8 text-center shadow-[0_18px_40px_-34px_rgba(15,23,42,0.18)]">
          <p className="text-base font-semibold text-slate-800">
            Daftar Latihan sedang dimuat
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Sistem sedang menyiapkan tugas yang bisa kamu kirim.
          </p>
        </section>
      ) : tasks.length === 0 ? (
        <section className="rounded-[26px] border border-orange-100/90 bg-white p-8 text-center shadow-[0_18px_40px_-34px_rgba(15,23,42,0.18)]">
          <p className="text-base font-semibold text-slate-800">
            Belum ada tugas yang bisa dikirim
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {academicAccessMessage ??
              loadError ??
              "Saat ini belum ada tugas aktif yang perlu kamu submit."}
          </p>
        </section>
      ) : (
        <div className="space-y-5">
          {latestGradedTask?.myGrade ? (
            <section className="rounded-[26px] border border-emerald-100 bg-emerald-50/75 p-5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.18)] md:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                    Hasil Penilaian Guru
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-800">
                    {latestGradedTask.judul}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {latestGradedTask.myGrade.note ||
                      "Guru sudah memberikan nilai. Catatan tambahan belum dituliskan."}
                  </p>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3 text-left shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                    Nilai
                  </p>
                  <p className="mt-1 text-xl font-semibold text-slate-800">
                    {latestGradedTask.myGrade.score ?? "-"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Dinilai {formatDateTimeLabel(latestGradedTask.myGrade.gradedAt)}
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          {submitTargets.length === 0 ? (
            <section className="rounded-[26px] border border-orange-100/90 bg-white p-8 text-center shadow-[0_18px_40px_-34px_rgba(15,23,42,0.18)]">
              <p className="text-base font-semibold text-slate-800">
                Belum ada tugas aktif yang perlu dikirim
              </p>
              <p className="mt-2 text-sm text-slate-500">
                {gradedTasks.length > 0
                  ? "Semua tugas aktif sudah selesai dinilai. Kamu bisa review hasil penilaian guru di atas."
                  : academicAccessMessage ??
                    loadError ??
                    "Saat ini belum ada tugas aktif yang perlu kamu submit."}
              </p>
            </section>
          ) : (
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <section className="rounded-[26px] border border-orange-100/90 bg-white p-5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.18)] md:p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-orange-50 p-3 text-orange-600">
                    <FolderOpenDot className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-600">
                      Pilihan Tugas
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-800">
                      Tugas yang bisa disubmit
                    </h2>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {submitTargets.map((task) => {
                    const isSelected = task.id === activeTask?.id;

                    return (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => setSelectedTaskId(task.id)}
                        className={`block w-full rounded-[22px] border p-4 text-left transition ${
                          isSelected
                            ? "border-orange-200 bg-orange-50/60"
                            : "border-orange-100/80 hover:border-orange-200 hover:bg-orange-50/30"
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-orange-700">
                            {task.mapel}
                          </span>
                          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] text-slate-500">
                            Pertemuan {task.pertemuan}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                              task.mySubmission?.submitted
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {task.mySubmission?.submitted
                              ? "Sudah Dikumpulkan"
                              : "Belum Dikumpulkan"}
                          </span>
                        </div>

                        <h3 className="mt-3 text-sm font-semibold text-slate-800">
                          {task.judul}
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-slate-500">
                          {task.deskripsi}
                        </p>
                        <p className="mt-2 text-xs text-slate-400">
                          Deadline {task.deadline}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </section>

              <div className="space-y-5">
                <section className="rounded-[26px] border border-orange-100/90 bg-white p-5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.18)] md:p-6">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-600">
                        Detail Tugas
                      </p>
                      <h2 className="mt-1 text-lg font-semibold text-slate-800">
                        {activeTask?.judul ?? "Belum ada tugas aktif"}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        {activeTask?.deskripsi ??
                          "Pilih salah satu tugas dari daftar di samping untuk mulai mengirim jawaban."}
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                      Deadline {activeTask?.deadline ?? "-"}
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Estimasi
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-700">
                        {activeTask?.estimasi ?? "-"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Nilai
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-700">
                        {activeTask?.poin ?? "-"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Mode
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-700">
                        {activeTask?.submissionModes.length ?? 0} pilihan
                      </p>
                    </div>
                  </div>

                  {activeTask?.attachmentName && activeTask.attachmentUrl ? (
                    <div className="mt-4">
                      <a
                        href={activeTask.attachmentUrl}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-orange-200 bg-white px-4 text-xs font-semibold text-orange-700 transition hover:bg-orange-50"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download Lampiran Tugas
                      </a>
                    </div>
                  ) : null}
                </section>

                {activeTask && (
                  <FlexibleSubmissionPanel
                    key={activeTask.id}
                    taskId={activeTask.id}
                    taskTitle={activeTask.judul}
                    title="Mode Pengumpulan"
                    description="Siswa bisa mengirim jawaban lewat upload file, jawaban teks langsung, atau menempel link Drive sesuai kebutuhan tugas."
                    availableModes={activeTask.submissionModes}
                    checklist={activeTask.instruksiPengumpulan}
                    submitLabel="Kirim Jawaban Sekarang"
                    textPlaceholder="Tulis jawaban tugas atau ringkasan pengerjaan kamu di sini..."
                    drivePlaceholder="https://drive.google.com/..."
                    notePlaceholder="Tambahkan catatan singkat untuk guru jika diperlukan..."
                    initialSubmission={activeTask.mySubmission}
                    onRefreshLearningData={refreshLearningData}
                    onSubmissionSaved={(submissionSummary) => {
                      updateTaskSubmissionSummary(activeTask.id, submissionSummary);
                    }}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </StudentLearningShell>
  );
}
