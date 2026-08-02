"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileText,
  FileUp,
  Link2,
  LoaderCircle,
  MessageSquareText,
  Send,
  ShieldCheck,
} from "lucide-react";

import {
  clearAuthClientState,
  type ApiResponse,
  withStoredAuthHeader,
} from "@/lib/auth";

import type {
  StudentTaskSubmissionDetail,
  StudentTaskSubmissionSummary,
  SubmissionMode,
} from "../data/learning-types";

type FlexibleSubmissionPanelProps = {
  taskId: string;
  taskTitle: string;
  title: string;
  description: string;
  availableModes: SubmissionMode[];
  checklist: string[];
  submitLabel: string;
  textPlaceholder: string;
  drivePlaceholder: string;
  notePlaceholder: string;
  initialSubmission?: StudentTaskSubmissionSummary;
  onSubmissionSaved: (submissionSummary: StudentTaskSubmissionSummary) => void;
  onRefreshLearningData?: () => Promise<void> | void;
};

type StudentTaskSubmissionResponse = ApiResponse<{
  submitted?: boolean;
  submission?: StudentTaskSubmissionDetail | null;
}>;

const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_ATTACHMENT_SIZE_LABEL = "10 MB";

const modeMeta: Record<
  SubmissionMode,
  {
    label: string;
    icon: typeof FileText;
    helper: string;
  }
> = {
  file: {
    label: "Unggah File",
    icon: FileUp,
    helper:
      "Unggah file tugas atau jawaban dalam format PDF, DOCX, atau gambar pendukung.",
  },
  text: {
    label: "Jawaban Teks",
    icon: MessageSquareText,
    helper:
      "Tulis jawaban langsung di halaman ini untuk jawaban singkat atau essay.",
  },
  drive: {
    label: "Google Drive",
    icon: Link2,
    helper:
      "Tempel link Google Drive atau dokumen online yang dapat diakses guru.",
  },
};

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function getSubmissionModeLabel(mode: SubmissionMode | null | undefined) {
  return mode ? modeMeta[mode]?.label ?? "Jawaban" : "Jawaban";
}

function formatSubmissionTime(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return "Waktu pengumpulan belum tersedia";
  }

  const submittedDate = new Date(normalizedValue);

  if (Number.isNaN(submittedDate.getTime())) {
    return "Waktu pengumpulan belum tersedia";
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

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) {
    return "0 KB";
  }

  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(size / 1024, 0.1).toFixed(1)} KB`;
}

function isValidHttpUrl(value: string) {
  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
}

function buildSubmissionSummary(
  submission: StudentTaskSubmissionDetail,
): StudentTaskSubmissionSummary {
  return {
    submitted: true,
    submissionId: normalizeText(submission.submissionId) || null,
    submissionMode: submission.submissionMode,
    submittedAt: submission.submittedAt,
    hasAttachment: Boolean(submission.attachment?.fileName),
    driveUrl: normalizeText(submission.driveUrl),
    answerTextPreview: normalizeText(submission.answerText).slice(0, 140),
  };
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("File tugas tidak bisa diproses."));
        return;
      }

      const [, base64 = ""] = reader.result.split(",", 2);
      resolve(base64);
    };

    reader.onerror = () => {
      reject(new Error("File tugas tidak bisa diproses."));
    };

    reader.readAsDataURL(file);
  });
}

export default function FlexibleSubmissionPanel({
  taskId,
  taskTitle,
  title,
  description,
  availableModes,
  checklist,
  submitLabel,
  textPlaceholder,
  drivePlaceholder,
  notePlaceholder,
  initialSubmission,
  onSubmissionSaved,
  onRefreshLearningData,
}: FlexibleSubmissionPanelProps) {
  const fallbackMode = availableModes[0] ?? "text";
  const initialMode =
    initialSubmission?.submissionMode &&
    availableModes.includes(initialSubmission.submissionMode)
      ? initialSubmission.submissionMode
      : fallbackMode;
  const [activeMode, setActiveMode] = useState<SubmissionMode>(initialMode);
  const [textAnswer, setTextAnswer] = useState("");
  const [driveUrl, setDriveUrl] = useState(initialSubmission?.driveUrl ?? "");
  const [note, setNote] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submissionDetail, setSubmissionDetail] =
    useState<StudentTaskSubmissionDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [isLoadingSubmission, setIsLoadingSubmission] = useState(
    Boolean(initialSubmission?.submitted),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resolvedActiveMode = availableModes.includes(activeMode)
    ? activeMode
    : fallbackMode;
  const activeMeta = modeMeta[resolvedActiveMode];
  const ActiveModeIcon = activeMeta.icon;
  const currentSubmission = submissionDetail ?? null;
  const currentAttachment = currentSubmission?.attachment ?? null;
  const hasExistingSubmission = Boolean(
    currentSubmission || initialSubmission?.submitted,
  );
  const submissionAttachmentUrl = `/api/student/me/learning/tasks/${encodeURIComponent(taskId)}/submission/attachment`;
  const submissionDriveUrl =
    normalizeText(currentSubmission?.driveUrl) ||
    normalizeText(initialSubmission?.driveUrl);
  const answerPreview =
    normalizeText(currentSubmission?.answerText) ||
    normalizeText(initialSubmission?.answerTextPreview);

  useEffect(() => {
    let isActive = true;

    if (!initialSubmission?.submitted) {
      return () => {
        isActive = false;
      };
    }

    async function loadSubmissionDetail() {
      try {
        const authInit = withStoredAuthHeader({
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        const headers = new Headers(authInit.headers);

        const response = await fetch(
          `/api/student/me/learning/tasks/${encodeURIComponent(taskId)}/submission`,
          {
            ...authInit,
            headers,
          },
        );
        const payload = (await response
          .json()
          .catch(() => null)) as StudentTaskSubmissionResponse | null;

        if (!isActive) {
          return;
        }

        if (response.status === 401) {
          clearAuthClientState();
          setDetailError("Sesi login berakhir. Silakan login ulang.");
          return;
        }

        if (!response.ok || !payload?.success || !payload.data?.submission) {
          setDetailError(
            payload?.message || "Jawaban tugas belum bisa dimuat saat ini.",
          );
          return;
        }

        const loadedSubmission = payload.data.submission;

        setSubmissionDetail(loadedSubmission);
        setActiveMode(
          availableModes.includes(loadedSubmission.submissionMode)
            ? loadedSubmission.submissionMode
            : fallbackMode,
        );
        setTextAnswer(normalizeText(loadedSubmission.answerText));
        setDriveUrl(normalizeText(loadedSubmission.driveUrl));
        setNote(normalizeText(loadedSubmission.note));
      } catch (error) {
        if (!isActive) {
          return;
        }

        console.error("[dashboard-siswa] load_task_submission_failed", {
          taskId,
          error,
        });
        setDetailError("Jawaban tugas belum bisa dimuat saat ini.");
      } finally {
        if (isActive) {
          setIsLoadingSubmission(false);
        }
      }
    }

    void loadSubmissionDetail();

    return () => {
      isActive = false;
    };
  }, [availableModes, fallbackMode, initialSubmission?.submitted, taskId]);

  function handleModeChange(mode: SubmissionMode) {
    setActiveMode(mode);
    setSubmitError(null);
    setSubmitSuccess(null);
  }

  function handlePickFile() {
    fileInputRef.current?.click();
  }

  function handleClearSelectedFile() {
    setSelectedFile(null);
    setFileError(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;

    if (!nextFile) {
      setSelectedFile(null);
      setFileError(null);
      return;
    }

    if (nextFile.size > MAX_ATTACHMENT_SIZE_BYTES) {
      setSelectedFile(null);
      setFileError(`Ukuran file maksimal ${MAX_ATTACHMENT_SIZE_LABEL}.`);
      event.target.value = "";
      return;
    }

    setSelectedFile(nextFile);
    setFileError(null);
    setSubmitError(null);
    setSubmitSuccess(null);
  }

  async function handleDeleteSubmission() {
    if (!window.confirm("Apakah kamu yakin ingin menghapus jawaban tugas ini?")) {
      return;
    }

    setIsDeleting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const authInit = withStoredAuthHeader({
        method: "DELETE",
        credentials: "include",
      });
      const response = await fetch(
        `/api/student/me/learning/tasks/${encodeURIComponent(taskId)}/submission`,
        authInit
      );

      if (response.status === 401 || response.status === 403) {
        clearAuthClientState();
        window.location.href = "/masuk";
        return;
      }

      const payload = (await response.json()) as StudentTaskSubmissionResponse;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Gagal menghapus tugas.");
      }

      setSubmissionDetail(null);
      setTextAnswer("");
      setDriveUrl("");
      setNote("");
      setSelectedFile(null);
      setSubmitSuccess("Tugas berhasil dihapus.");
      onSubmissionSaved({
        submitted: false,
        submissionId: null,
        submissionMode: null,
        submittedAt: null,
        hasAttachment: false,
        driveUrl: "",
        answerTextPreview: ""
      });
      await onRefreshLearningData?.();
    } catch (error) {
      console.error("[dashboard-siswa] delete_task_submission_failed", error);
      setSubmitError(error instanceof Error ? error.message : "Gagal menghapus tugas.");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleSubmit() {
    setSubmitError(null);
    setSubmitSuccess(null);

    const normalizedNote = normalizeText(note);
    const normalizedTextAnswer = normalizeText(textAnswer);
    const normalizedDriveUrl = normalizeText(driveUrl);
    const shouldUsePatch = hasExistingSubmission;
    const nextPayload: Record<string, unknown> = {
      submissionMode: resolvedActiveMode,
      note: normalizedNote,
    };

    if (resolvedActiveMode === "text") {
      if (!normalizedTextAnswer) {
        setSubmitError("Jawaban teks wajib diisi sebelum dikirim.");
        return;
      }

      nextPayload.answerText = normalizedTextAnswer;
    }

    if (resolvedActiveMode === "drive") {
      if (!normalizedDriveUrl) {
        setSubmitError("Tautan Google Drive wajib diisi sebelum dikirim.");
        return;
      }

      if (!isValidHttpUrl(normalizedDriveUrl)) {
        setSubmitError("Tautan Google Drive belum valid. Gunakan tautan yang diawali http atau https.");
        return;
      }

      nextPayload.driveUrl = normalizedDriveUrl;
    }

    if (resolvedActiveMode === "file") {
      const hasStoredAttachment = Boolean(
        currentAttachment?.fileName || initialSubmission?.hasAttachment,
      );

      if (!selectedFile && !hasStoredAttachment) {
        setSubmitError("Pilih file jawaban terlebih dahulu sebelum dikirim.");
        return;
      }

      if (selectedFile) {
        try {
          const base64File = await readFileAsBase64(selectedFile);

          nextPayload.attachmentFileName = selectedFile.name;
          nextPayload.attachmentOriginalName = selectedFile.name;
          nextPayload.attachmentMimeType =
            selectedFile.type || "application/octet-stream";
          nextPayload.attachmentFileDataBase64 = base64File;
        } catch (error) {
          setSubmitError(
            error instanceof Error
              ? error.message
              : "File tugas belum bisa diproses.",
          );
          return;
        }
      }
    }

    setIsSubmitting(true);

    try {
      const authInit = withStoredAuthHeader({
        method: shouldUsePatch ? "PATCH" : "POST",
        credentials: "include",
      });
      const headers = new Headers(authInit.headers);

      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }

      const response = await fetch(
        `/api/student/me/learning/tasks/${encodeURIComponent(taskId)}/submission`,
        {
          ...authInit,
          headers,
          body: JSON.stringify(nextPayload),
        },
      );
      const payload = (await response
        .json()
        .catch(() => null)) as StudentTaskSubmissionResponse | null;

      if (response.status === 401) {
        clearAuthClientState();
        setSubmitError("Sesi login berakhir. Silakan login ulang.");
        return;
      }

      if (!response.ok || !payload?.success || !payload.data?.submission) {
        setSubmitError(
          payload?.message || "Jawaban tugas belum bisa disimpan saat ini.",
        );
        return;
      }

      const savedSubmission = payload.data.submission;
      const savedSubmissionSummary = buildSubmissionSummary(savedSubmission);

      setSubmissionDetail(savedSubmission);
      setActiveMode(
        availableModes.includes(savedSubmission.submissionMode)
          ? savedSubmission.submissionMode
          : fallbackMode,
      );
      setTextAnswer(normalizeText(savedSubmission.answerText));
      setDriveUrl(normalizeText(savedSubmission.driveUrl));
      setNote(normalizeText(savedSubmission.note));
      setSelectedFile(null);
      setFileError(null);
      setDetailError(null);
      setSubmitSuccess(
        shouldUsePatch
          ? "Jawaban tugas berhasil diperbarui."
          : "Tugas berhasil.",
      );
      onSubmissionSaved(savedSubmissionSummary);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      await onRefreshLearningData?.();
    } catch (error) {
      console.error("[dashboard-siswa] save_task_submission_failed", {
        taskId,
        error,
      });
      setSubmitError("Jawaban tugas belum bisa disimpan saat ini.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-600">
          {title}
        </p>
        <h3 className="mt-1 text-lg font-semibold text-slate-800">
          Kirim Jawaban
        </h3>
        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      </div>

      {hasExistingSubmission ? (
        <div className="overflow-hidden rounded-[24px] border border-emerald-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-emerald-100 bg-emerald-50/70 px-5 py-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <h4 className="text-sm font-semibold text-emerald-800">
                Tugas sudah dikumpulkan
              </h4>
            </div>
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
              {getSubmissionModeLabel(
                currentSubmission?.submissionMode ??
                  initialSubmission?.submissionMode ??
                  "text",
              )}
            </span>
          </div>
          <div className="p-0">
            <table className="w-full text-left text-sm text-slate-600">
              <tbody className="divide-y divide-emerald-50">
                <tr>
                  <th className="w-1/3 bg-slate-50/30 px-5 py-4 font-medium text-slate-700">
                    Waktu Kirim
                  </th>
                  <td className="px-5 py-4">
                    {formatSubmissionTime(
                      currentSubmission?.submittedAt ??
                        initialSubmission?.submittedAt,
                    )}
                  </td>
                </tr>
                {answerPreview ? (
                  <tr>
                    <th className="w-1/3 bg-slate-50/30 px-5 py-4 font-medium text-slate-700">
                      Teks Jawaban
                    </th>
                    <td className="whitespace-pre-wrap px-5 py-4">
                      {answerPreview}
                    </td>
                  </tr>
                ) : null}
                {submissionDriveUrl ? (
                  <tr>
                    <th className="w-1/3 bg-slate-50/30 px-5 py-4 font-medium text-slate-700">
                      Link Drive
                    </th>
                    <td className="px-5 py-4">
                      <Link
                        href={submissionDriveUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 font-semibold text-emerald-700 hover:underline"
                      >
                        <Link2 className="h-4 w-4" />
                        Buka Tautan
                      </Link>
                    </td>
                  </tr>
                ) : null}
                {Boolean(
                  currentAttachment?.fileName || initialSubmission?.hasAttachment,
                ) ? (
                  <tr>
                    <th className="w-1/3 bg-slate-50/30 px-5 py-4 font-medium text-slate-700">
                      File Lampiran
                    </th>
                    <td className="px-5 py-4">
                      <a
                        href={submissionAttachmentUrl}
                        className="inline-flex items-center gap-2 font-semibold text-emerald-700 hover:underline"
                      >
                        <Download className="h-4 w-4" />
                        Unduh File
                      </a>
                    </td>
                  </tr>
                ) : null}
                <tr>
                  <th className="w-1/3 bg-slate-50/30 px-5 py-4 font-medium text-slate-700">
                    Aksi
                  </th>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => {
                          const el = document.getElementById("edit-form-section");
                          el?.scrollIntoView({ behavior: "smooth" });
                          const textarea = el?.querySelector("textarea");
                          if (textarea) setTimeout(() => textarea.focus(), 300);
                        }}
                        className="font-semibold text-emerald-600 transition hover:text-emerald-700"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteSubmission}
                        disabled={isDeleting}
                        className="font-semibold text-rose-500 transition hover:text-rose-700 disabled:opacity-50"
                      >
                        {isDeleting ? "Menghapus..." : "Hapus"}
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {availableModes.length > 1 && (
        <div className="flex flex-wrap gap-2 rounded-[20px] bg-white/90 p-1.5 shadow-sm ring-1 ring-orange-100/80">
          {availableModes.map((mode) => {
            const meta = modeMeta[mode];
            const Icon = meta.icon;
            const isActive = resolvedActiveMode === mode;

            return (
              <button
                key={mode}
                type="button"
                onClick={() => handleModeChange(mode)}
                className={`inline-flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-gradient-to-r from-red-800 via-orange-600 to-amber-500 text-white shadow-sm"
                    : "text-slate-600 hover:bg-orange-50 hover:text-orange-700"
                }`}
              >
                <Icon className="h-4 w-4" />
                {meta.label}
              </button>
            );
          })}
        </div>
      )}

      <div id="edit-form-section" className="rounded-[24px] border border-orange-100/90 bg-white p-5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.18)]">
        {availableModes.length > 1 && (
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-orange-50 p-3 text-orange-600">
              <ActiveModeIcon className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-800">
                {activeMeta.label}
              </h4>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                {activeMeta.helper}
              </p>
            </div>
          </div>
        )}

        {resolvedActiveMode === "file" ? (
          <div className={`${availableModes.length > 1 ? "mt-5 " : ""}rounded-[24px] border border-dashed border-orange-200 bg-[linear-gradient(180deg,rgba(255,247,237,0.7),rgba(255,255,255,1))] px-5 py-8 text-center`}>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              className="sr-only"
            />
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-orange-50 text-orange-500">
              <FileUp className="h-7 w-7" />
            </div>
            <p className="mt-4 text-sm font-semibold text-slate-700">
              Unggah file jawaban dari perangkat kamu
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Format file bebas sesuai kebutuhan tugas, maksimal{" "}
              {MAX_ATTACHMENT_SIZE_LABEL}.
            </p>
            <button
              type="button"
              onClick={handlePickFile}
              className="mt-4 inline-flex h-11 items-center justify-center rounded-2xl border border-orange-200 bg-white px-5 text-sm font-semibold text-orange-700 transition hover:bg-orange-50"
            >
              Pilih File
            </button>

            {selectedFile ? (
              <div className="mt-4 rounded-2xl border border-orange-100 bg-white/90 px-4 py-3 text-left">
                <p className="text-sm font-semibold text-slate-700">
                  File baru dipilih
                </p>
                <p className="mt-1 break-all text-sm text-slate-500">
                  {selectedFile.name}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="text-xs text-slate-400">
                    {formatFileSize(selectedFile.size)}
                  </span>
                  <button
                    type="button"
                    onClick={handleClearSelectedFile}
                    className="text-xs font-semibold text-orange-600 hover:underline"
                  >
                    Batalkan file baru
                  </button>
                </div>
              </div>
            ) : currentAttachment ? (
              <div className="mt-4 rounded-2xl border border-emerald-100 bg-white/90 px-4 py-3 text-left">
                <p className="text-sm font-semibold text-emerald-700">
                  File jawaban tersimpan
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <a
                    href={submissionAttachmentUrl}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 underline-offset-2 hover:underline"
                  >
                    <Download className="h-4 w-4" />
                    {currentAttachment.originalName}
                  </a>
                  <span className="text-xs text-slate-400">
                    {formatFileSize(currentAttachment.size)}
                  </span>
                </div>
              </div>
            ) : initialSubmission?.hasAttachment ? (
              <div className="mt-4 rounded-2xl border border-emerald-100 bg-white/90 px-4 py-3 text-left">
                <p className="text-sm font-semibold text-emerald-700">
                  File jawaban tersimpan
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <a
                    href={submissionAttachmentUrl}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 underline-offset-2 hover:underline"
                  >
                    <Download className="h-4 w-4" />
                    Unduh lampiran jawaban
                  </a>
                </div>
              </div>
            ) : null}

            {fileError ? (
              <p className="mt-4 text-sm font-medium text-rose-600">
                {fileError}
              </p>
            ) : null}
          </div>
        ) : null}

        {resolvedActiveMode === "text" ? (
          <div className={availableModes.length > 1 ? "mt-5" : ""}>
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Jawaban Teks
            </label>
            <textarea
              rows={8}
              value={textAnswer}
              onChange={(event) => setTextAnswer(event.target.value)}
              placeholder={textPlaceholder}
              className="mt-2 w-full rounded-[22px] border border-orange-100 bg-orange-50/30 px-4 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-orange-300 focus:bg-white"
            />
          </div>
        ) : null}

        {resolvedActiveMode === "drive" ? (
          <div className={`${availableModes.length > 1 ? "mt-5 " : ""}space-y-4`}>
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                Link Google Drive
              </label>
              <input
                type="url"
                value={driveUrl}
                onChange={(event) => setDriveUrl(event.target.value)}
                placeholder={drivePlaceholder}
                className="mt-2 w-full rounded-2xl border border-orange-100 bg-orange-50/30 px-4 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-orange-300 focus:bg-white"
              />
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
              <p className="text-sm font-semibold text-amber-800">
                Pastikan akses file terbuka
              </p>
              <p className="mt-1 text-sm leading-6 text-amber-700/90">
                Atur dokumen Drive menjadi dapat dilihat guru agar proses penilaian
                tidak terhambat.
              </p>
            </div>
          </div>
        ) : null}



        {submitError ? (
          <div className="mt-5 rounded-2xl border border-rose-100 bg-rose-50/80 px-4 py-3 text-sm text-rose-700">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          </div>
        ) : null}

        {submitSuccess ? (
          <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-700">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{submitSuccess}</span>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          disabled={isSubmitting || isLoadingSubmission}
          onClick={() => {
            void handleSubmit();
          }}
          className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-800 via-orange-600 to-amber-500 px-5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting || isLoadingSubmission ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {hasExistingSubmission ? "Perbarui Jawaban" : submitLabel}
        </button>
      </div>
    </div>
  );
}
