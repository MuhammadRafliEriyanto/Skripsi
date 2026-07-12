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
  ClipboardCheck,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  Inbox,
  Link2,
  LoaderCircle,
  MessageSquareText,
  Paperclip,
  UserRound,
} from "lucide-react";

import type { TaskSubmissionReviewDialogProps } from "./types";

function formatSubmissionModeLabel(mode: "file" | "text" | "drive") {
  switch (mode) {
    case "file":
      return "File";
    case "drive":
      return "Drive";
    default:
      return "Teks";
  }
}

function formatSubmissionDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(parsedDate);
}

function getGradeStatusClass(status: "Belum Dinilai" | "Sudah Dinilai") {
  return status === "Sudah Dinilai"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-slate-200 bg-slate-50 text-slate-700";
}

export default function TaskSubmissionReviewDialog({
  kelasName,
  open,
  task,
  submissions,
  selectedSubmissionId,
  submissionDetail,
  isListLoading,
  isDetailLoading,
  onOpenChange,
  onSelectSubmission,
  onGradeSubmission,
}: TaskSubmissionReviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-6xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 rounded-[24px] border border-slate-200 bg-white p-0 shadow-lg">
        <DialogHeader className="border-b border-slate-200 bg-gradient-to-r from-orange-50/60 via-white to-amber-50/30 px-4 py-4 pr-14 text-left md:px-5">
          <DialogTitle className="text-lg font-semibold text-slate-800">
            Tinjau Jawaban Latihan
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            {task
              ? `Pantau hasil pengumpulan latihan ${task.judulTugas} untuk kelas ${kelasName}.`
              : `Pantau hasil pengumpulan latihan untuk kelas ${kelasName}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 gap-0 lg:grid-cols-[340px_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col border-b border-slate-200 lg:border-b-0 lg:border-r">
            <div className="border-b border-slate-200 bg-slate-50/50 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Latihan Aktif
              </p>
              <h3 className="mt-1 text-base font-semibold text-slate-800">
                {task?.judulTugas ?? "-"}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Pertemuan {task?.pertemuanKe ?? "-"} | {submissions.length} jawaban
              </p>
            </div>

            <div className="min-h-0 overflow-y-auto px-4 py-4">
              {isListLoading ? (
                <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-slate-500">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Memuat daftar jawaban...
                </div>
              ) : submissions.length > 0 ? (
                <div className="grid gap-3">
                  {submissions.map((submission) => {
                    const isActive =
                      submission.submissionId === selectedSubmissionId;

                    return (
                      <button
                        key={submission.submissionId}
                        type="button"
                        onClick={() => onSelectSubmission(submission.submissionId)}
                        className={`grid gap-2 border p-4 text-left transition ${
                          isActive
                            ? "border-orange-300 bg-slate-50 shadow-[0_18px_30px_-24px_rgba(249,115,22,0.35)]"
                            : "border-slate-200 bg-white hover:border-slate-200 hover:bg-orange-50/40/30"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              {submission.studentName}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {submission.studentId}
                            </p>
                          </div>
                          <span
                            className={`inline-flex items-center border px-2 py-1 text-[11px] font-semibold ${getGradeStatusClass(submission.gradeStatus)}`}
                          >
                            {submission.gradeStatus}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="h-3.5 w-3.5" />
                            {formatSubmissionDateTime(submission.submittedAt)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <FileText className="h-3.5 w-3.5" />
                            {formatSubmissionModeLabel(submission.submissionMode)}
                          </span>
                        </div>

                        {submission.answerTextPreview ? (
                          <p className="text-sm leading-6 text-slate-600">
                            {submission.answerTextPreview}
                          </p>
                        ) : (
                          <p className="text-sm leading-6 text-slate-400">
                            Belum ada cuplikan jawaban teks.
                          </p>
                        )}

                        {typeof submission.score === "number" ? (
                          <p className="text-xs font-medium text-emerald-700">
                            Nilai tersimpan: {submission.score}
                          </p>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex min-h-48 flex-col items-center justify-center border border-dashed border-slate-200 bg-slate-50/30 px-5 py-8 text-center">
                  <div className="flex h-11 w-11 items-center justify-center border border-orange-100 bg-white text-orange-400 shadow-sm">
                    <Inbox className="h-5 w-5" />
                  </div>
                  <p className="mt-4 text-base font-semibold text-slate-700">
                    Belum ada jawaban terkumpul untuk latihan ini.
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Guru dapat membuka kembali dialog ini setelah siswa mulai
                    mengumpulkan jawaban.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto px-4 py-4 md:px-5">
            {isDetailLoading ? (
              <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-slate-500">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                Memuat detail jawaban...
              </div>
            ) : submissionDetail ? (
              <div className="grid gap-4">
                <div className="grid gap-3 border border-slate-200 bg-gradient-to-r from-orange-50/60 via-white to-amber-50/30 p-4 md:grid-cols-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Siswa
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <UserRound className="h-4 w-4 text-slate-500" />
                      <p className="text-base font-semibold text-slate-800">
                        {submissionDetail.studentName}
                      </p>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {submissionDetail.studentId}
                    </p>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Ringkasan
                    </p>
                    <div className="mt-1 grid gap-2 text-sm text-slate-600">
                      <p>
                        Bentuk Jawaban:{" "}
                        <span className="font-semibold text-slate-800">
                          {formatSubmissionModeLabel(submissionDetail.submissionMode)}
                        </span>
                      </p>
                      <p>
                        Dikirim:{" "}
                        <span className="font-semibold text-slate-800">
                          {formatSubmissionDateTime(submissionDetail.submittedAt)}
                        </span>
                      </p>
                      <p>
                        Status Nilai:{" "}
                        <span className="font-semibold text-slate-800">
                          {submissionDetail.gradeStatus}
                        </span>
                        {typeof submissionDetail.score === "number"
                          ? ` (${submissionDetail.score})`
                          : ""}
                      </p>
                    </div>
                  </div>
                </div>

                {onGradeSubmission ? (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => onGradeSubmission(submissionDetail.studentId)}
                      className="inline-flex items-center gap-2 border border-emerald-500 bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 hover:shadow-[0_18px_30px_-22px_rgba(16,185,129,0.55)]"
                    >
                      <ClipboardCheck className="h-4 w-4 shrink-0" />
                      Beri Nilai Siswa Ini
                    </button>
                  </div>
                ) : null}

                {submissionDetail.answerText ? (
                  <section className="border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-2">
                      <MessageSquareText className="h-4 w-4 text-slate-500" />
                      <h4 className="text-sm font-semibold text-slate-800">
                        Jawaban Teks
                      </h4>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                      {submissionDetail.answerText}
                    </p>
                  </section>
                ) : null}

                {submissionDetail.driveUrl ? (
                  <section className="border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-slate-500" />
                      <h4 className="text-sm font-semibold text-slate-800">
                        Link Google Drive
                      </h4>
                    </div>
                    <a
                      href={submissionDetail.driveUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-700 underline-offset-2 hover:text-slate-600 hover:underline"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Buka Google Drive
                    </a>
                  </section>
                ) : null}

                {submissionDetail.attachmentFileName && submissionDetail.attachmentUrl ? (
                  <section className="border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-2">
                      <Paperclip className="h-4 w-4 text-slate-500" />
                      <h4 className="text-sm font-semibold text-slate-800">
                        Lampiran File
                      </h4>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border border-slate-200 bg-slate-50 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {submissionDetail.attachmentOriginalName ??
                            submissionDetail.attachmentFileName}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {submissionDetail.attachmentMimeType || "Jenis file tidak dikenali"}
                        </p>
                      </div>
                      <a
                        href={submissionDetail.attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex shrink-0 items-center gap-2 border border-orange-400 bg-slate-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
                      >
                        <Download className="h-4 w-4" />
                        Unduh
                      </a>
                    </div>
                  </section>
                ) : null}

                {submissionDetail.note ? (
                  <section className="border border-slate-200 bg-white p-4">
                    <h4 className="text-sm font-semibold text-slate-800">
                      Catatan Siswa
                    </h4>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                      {submissionDetail.note}
                    </p>
                  </section>
                ) : null}

                {!submissionDetail.answerText &&
                !submissionDetail.driveUrl &&
                !submissionDetail.attachmentFileName &&
                !submissionDetail.note ? (
                  <div className="border border-dashed border-slate-200 bg-slate-50/30 px-5 py-10 text-center">
                    <p className="text-sm font-medium text-slate-600">
                      Detail jawaban ini belum memiliki isi tambahan yang bisa ditampilkan.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex min-h-64 flex-col items-center justify-center border border-dashed border-slate-200 bg-slate-50/30 px-5 py-8 text-center">
                <div className="flex h-11 w-11 items-center justify-center border border-orange-100 bg-white text-orange-400 shadow-sm">
                  <FileText className="h-5 w-5" />
                </div>
                <p className="mt-4 text-base font-semibold text-slate-700">
                  Pilih salah satu jawaban untuk melihat detail.
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Guru dapat membaca jawaban teks, membuka link Drive, dan
                  mengunduh file jawaban siswa dari panel ini.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="border-t border-slate-200 px-4 py-4 md:px-5">
          <DialogClose asChild>
            <button
              type="button"
              className="border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-orange-50/40"
            >
              Tutup
            </button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
