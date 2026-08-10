"use client";

import {
  type ReactNode,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  RotateCcw,
  Search,
  Target,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchAdminAcademicMonitoring,
  type AdminAcademicMonitoringData,
  type AdminAcademicMonitoringStatus,
  type AdminAcademicMonitoringStudent,
} from "@/lib/admin-academic-monitoring";
import {
  formatUtbkTryoutStageLabel,
  UTBK_MAIN_TRYOUT_STAGE_COUNT,
  UTBK_TRYOUT_STAGE_META,
} from "@/lib/utbk-tryout-stages";
import { cn } from "@/lib/utils";

import type { AdminColumnDefinition } from "./components/AdminDataTable";
import { AdminDataTable } from "./components/AdminDataTable";
import { adminPoppins } from "./components/admin-font";
import { AdminSectionCard } from "./components/AdminSectionCard";

type AdminAcademicMonitoringProps = {
  globalSearchQuery?: string;
};

const allProgramsValue = "Semua";
const allStatusesValue = "Semua";

const programFilterOptions = [
  allProgramsValue,
  "Reguler",
  "SD",
  "SMP",
  "SMA",
  "UTBK",
] as const;
const statusFilterOptions = [
  { value: allStatusesValue, label: "Semua" },
  { value: "Lengkap", label: "Lengkap" },
  { value: "Menunggu Review", label: "Menunggu Review" },
  { value: "Belum Latihan", label: "Belum Latihan" },
  { value: "Belum Akses Materi", label: "Belum Akses Materi" },
  { value: "Belum Hadir", label: "Belum Hadir" },
] as const;
const monitoringPageSize = 10;

const emptyMonitoringData: AdminAcademicMonitoringData = {
  summary: {
    totalStudents: 0,
    monitoredStudents: 0,
    assessedStudents: 0,
    regularStudents: 0,
    utbkStudents: 0,
    totalMaterials: 0,
    totalTasks: 0,
    totalAttendanceRecords: 0,
    totalExpectedTryouts: 0,
    totalCompletedTryouts: 0,
    averageLatestScore: null,
    averageBestScore: null,
    monitoringPercent: 0,
  },
  students: [],
};

const warmFieldClassName =
  "h-11 rounded-2xl border-slate-200/90 bg-white/95 text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.8)] transition placeholder:text-slate-400 focus-visible:border-orange-300 focus-visible:ring-4 focus-visible:ring-orange-500/10";
const warmSelectTriggerClassName =
  "h-11 rounded-2xl border-slate-200/90 bg-white/95 text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.8)] transition hover:border-orange-200 focus:ring-4 focus:ring-orange-500/10";
const warmSelectContentClassName =
  "rounded-3xl border-orange-100/80 bg-white/95 shadow-[0_24px_48px_-32px_rgba(15,23,42,0.28),0_18px_36px_-28px_rgba(249,115,22,0.28)]";
const warmOutlineButtonClassName =
  "rounded-2xl border-slate-200/90 bg-white/95 text-slate-700 shadow-sm hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700";

function formatNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }

  return new Intl.NumberFormat("id-ID").format(Math.round(value));
}

function formatScore(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }

  return `${Math.round(value)}`;
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }

  return `${Math.round(value)}%`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Belum ada aktivitas nilai";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Tanggal tidak valid";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizeDisplayText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function getStatusBadgeClassName(status: AdminAcademicMonitoringStatus) {
  switch (status) {
    case "Data Lengkap":
      return "border-emerald-100 bg-emerald-50 text-emerald-700";
    case "Menunggu Review":
      return "border-sky-100 bg-sky-50 text-sky-700";
    case "Belum Latihan":
    case "Belum Akses Materi":
      return "border-amber-100 bg-amber-50 text-amber-700";
    case "Belum Hadir":
      return "border-rose-100 bg-rose-50 text-rose-700";
    case "Belum Ada Data":
    default:
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

function getStatusLabel(status: AdminAcademicMonitoringStatus) {
  return status;
}

function getStudentNameText(student: AdminAcademicMonitoringStudent) {
  return normalizeDisplayText(student.name);
}

function hasDisplayableStudentName(student: AdminAcademicMonitoringStudent) {
  const name = getStudentNameText(student).toLowerCase();

  return Boolean(
    name &&
      name !== "nama siswa belum diatur" &&
      name !== "siswa terdaftar",
  );
}

function StudentIdentityCell({
  student,
}: {
  student: AdminAcademicMonitoringStudent;
}) {
  return (
    <div className="min-w-[180px]">
      <p className="font-semibold text-slate-950">
        {getStudentNameText(student)}
      </p>
    </div>
  );
}

function ProgramCell({ student }: { student: AdminAcademicMonitoringStudent }) {
  const programTitle = getProgramDisplayText(student);
  const programSubtitle = getProgramSubtitleText(student);

  return (
    <div className="min-w-[180px] space-y-1.5">
      <p className="text-sm font-semibold text-slate-900">
        {programTitle}
      </p>
      {programSubtitle ? (
        <p className="text-xs leading-5 text-slate-500">
          {programSubtitle}
        </p>
      ) : null}
    </div>
  );
}

function getClassOrTrackText(student: AdminAcademicMonitoringStudent) {
  return student.isUtbk
    ? student.track || "Program SNBT"
    : student.className || "Kelas belum diatur";
}

function getProgramDisplayText(student: AdminAcademicMonitoringStudent) {
  const label = normalizeDisplayText(student.programLabel);
  const classOrTrack = normalizeDisplayText(getClassOrTrackText(student));

  if (student.isUtbk) {
    return label || "UTBK/SNBT";
  }

  if (label && classOrTrack) {
    const normalizedLabel = label.toLowerCase();
    const normalizedClassOrTrack = classOrTrack.toLowerCase();

    if (
      normalizedLabel.includes(normalizedClassOrTrack) ||
      normalizedClassOrTrack.includes(normalizedLabel)
    ) {
      return classOrTrack;
    }
  }

  return label || classOrTrack || "Program belum diatur";
}

function getProgramSubtitleText(student: AdminAcademicMonitoringStudent) {
  const title = normalizeDisplayText(getProgramDisplayText(student)).toLowerCase();
  const classOrTrack = normalizeDisplayText(getClassOrTrackText(student));
  const normalizedClassOrTrack = classOrTrack.toLowerCase();

  if (
    !classOrTrack ||
    title === normalizedClassOrTrack ||
    title.includes(normalizedClassOrTrack)
  ) {
    return "";
  }

  return classOrTrack;
}

function getAttendanceText(student: AdminAcademicMonitoringStudent) {
  return student.attendanceTotal
    ? `${formatNumber(student.attendancePresent)}/${formatNumber(student.attendanceTotal)} hadir`
    : "Belum ada absensi";
}

function getTargetText(student: AdminAcademicMonitoringStudent) {
  const target = [student.targetKampus, student.targetJurusan]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" - ");

  return target || "Target belum diisi";
}

function getTryoutProgressText(student: AdminAcademicMonitoringStudent) {
  const mainTryoutTotal =
    student.mainTryoutTotal || UTBK_MAIN_TRYOUT_STAGE_COUNT;
  const completedMainTryoutCount =
    student.completedMainTryoutCount ?? student.completedTryoutCount;

  return `${completedMainTryoutCount}/${mainTryoutTotal} tryout`;
}

function escapeHtml(value: unknown) {
  const text = String(value ?? "-").trim() || "-";

  return text.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return character;
    }
  });
}

function formatExportDate() {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());
}

function downloadBlob(content: BlobPart, fileName: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 250);
}

function getExcelCell(value: unknown) {
  return `<td>${escapeHtml(value)}</td>`;
}

function exportMonitoringExcel(students: AdminAcademicMonitoringStudent[]) {
  if (!students.length) {
    return;
  }

  const headers = [
    "No",
    "Nama",
    "Program",
    "Kelas",
    "Status",
    "Materi",
    "Tugas",
    "Absensi",
    "Kehadiran",
    "Nilai Terakhir",
    "Nilai Terbaik",
    "Rata-rata",
    "Tryout UTBK",
    "Target UTBK",
  ];
  const rows = students
    .map((student, index) => {
      const cells = [
        index + 1,
        getStudentNameText(student),
        getProgramDisplayText(student),
        getProgramSubtitleText(student) || "-",
        getStatusLabel(student.learningStatus),
        `${formatNumber(student.materialCount)} materi`,
        student.isUtbk
          ? "Fokus tryout"
          : `${formatNumber(student.gradedTaskCount)} tugas dinilai`,
        getAttendanceText(student),
        student.attendanceRate !== null
          ? formatPercent(student.attendanceRate)
          : "-",
        formatScore(student.latestScore),
        formatScore(student.bestScore),
        formatScore(student.averageScore),
        student.isUtbk ? getTryoutProgressText(student) : "-",
        student.isUtbk ? getTargetText(student) : "-",
      ];

      return `<tr>${cells.map(getExcelCell).join("")}</tr>`;
    })
    .join("");
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px; }
      th, td { border: 1px solid #d8dde6; padding: 8px; text-align: left; }
      th { background: #f8fafc; font-weight: 700; }
    </style>
  </head>
  <body>
    <table>
      <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </body>
</html>`;

  downloadBlob(
    html,
    `monitoring-akademik-${formatExportDate().replace(/\//g, "-")}.xls`,
    "application/vnd.ms-excel;charset=utf-8",
  );
}

function exportStudentPdf(student: AdminAcademicMonitoringStudent) {
  const scoreRows = [
    ["Nilai Terakhir", formatScore(student.latestScore)],
    ["Nilai Terbaik", formatScore(student.bestScore)],
    ["Rata-rata", formatScore(student.averageScore)],
    ["Catatan Nilai", student.latestScoreLabel ? `${student.latestScoreLabel} - ${formatDateTime(student.latestScoreAt)}` : "Belum ada nilai tercatat"],
  ];
  const activityRows: string[][] = [
    ["Program", getProgramDisplayText(student)],
    ...(getProgramSubtitleText(student)
      ? [["Kelas", getProgramSubtitleText(student)]]
      : []),
    ["Status", getStatusLabel(student.learningStatus)],
    ["Kehadiran", `${formatNumber(student.attendancePresent)} / ${formatNumber(student.attendanceTotal)} (${formatPercent(student.attendanceRate)})`],
    ["Materi", `${formatNumber(student.materialCount)} Bab Selesai`],
    ["Latihan CBT", `${formatNumber(student.taskCount)} Selesai`],
    ["Review Guru", `${formatNumber(student.gradedTaskCount)} Dinilai`],
  ];
  const utbkRows = student.isUtbk
    ? [
        ["Target", getTargetText(student)],
        [
          "Tryout Terakhir",
          student.latestTryout
            ? `${student.latestTryout.shortLabel} - ${student.latestTryout.title || "Tryout UTBK"}`
            : "Belum ada tryout",
        ],
        ...(
          student.stageProgress?.length
            ? student.stageProgress
            : UTBK_TRYOUT_STAGE_META.map((stage) => ({
                stage: stage.stage,
                label: stage.label,
                shortLabel: stage.shortLabel,
                status: "Belum Dikerjakan" as const,
                score: null,
              }))
        ).map((stage) => [
          stage.shortLabel || formatUtbkTryoutStageLabel(stage.stage),
          stage.status === "Selesai"
            ? `Selesai - ${formatScore(stage.score)}`
            : "Belum dikerjakan",
        ]),
      ]
    : [];
  const renderRows = (rows: string[][]) =>
    rows
      .map(
        ([label, value]) =>
          `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`,
      )
      .join("");
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Monitoring Akademik - ${escapeHtml(getStudentNameText(student))}</title>
    <style>
      body { color: #0f172a; font-family: Arial, sans-serif; margin: 40px; }
      h1 { font-size: 24px; margin: 0 0 6px; }
      p { color: #64748b; margin: 0 0 24px; }
      h2 { border-bottom: 1px solid #e2e8f0; font-size: 15px; margin: 26px 0 10px; padding-bottom: 8px; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border-bottom: 1px solid #e2e8f0; font-size: 13px; padding: 10px 0; text-align: left; vertical-align: top; }
      th { color: #64748b; font-weight: 600; width: 34%; }
      .badge { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 999px; color: #c2410c; display: inline-block; font-size: 12px; font-weight: 700; margin-top: 8px; padding: 6px 10px; }
      @media print { body { margin: 24px; } }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(getStudentNameText(student))}</h1>
    <p>Ringkasan monitoring akademik per ${escapeHtml(formatExportDate())}</p>
    <span class="badge">${escapeHtml(student.isUtbk ? "UTBK" : "Reguler")}</span>

    <h2>Aktivitas Belajar</h2>
    <table>${renderRows(activityRows)}</table>

    <h2>Nilai</h2>
    <table>${renderRows(scoreRows)}</table>

    ${
      utbkRows.length
        ? `<h2>Tryout UTBK</h2><table>${renderRows(utbkRows)}</table>`
        : ""
    }
  </body>
</html>`;
  const printWindow = window.open("", "_blank", "width=900,height=700");

  if (!printWindow) {
    return;
  }

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.setTimeout(() => {
    printWindow.print();
  }, 250);
}

function UtbkStageProgress({
  student,
}: {
  student: AdminAcademicMonitoringStudent;
}) {
  const stageProgress = student.stageProgress?.length
    ? student.stageProgress
    : UTBK_TRYOUT_STAGE_META.map((stage) => ({
        stage: stage.stage,
        label: stage.label,
        shortLabel: stage.shortLabel,
        status: "Belum Dikerjakan" as const,
        score: null,
        submittedAt: null,
        tryoutId: "",
        title: "",
        subject: "",
      }));

  return (
    <div className="flex flex-wrap gap-1.5">
      {stageProgress.map((stage) => {
        const isDone = stage.status === "Selesai";

        return (
          <Badge
            variant="secondary"
            key={stage.stage}
            className={cn(
              "rounded-lg px-2 py-1 text-xs",
              isDone
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-500",
            )}
          >
            {stage.shortLabel || formatUtbkTryoutStageLabel(stage.stage)}
            {isDone ? ` ${formatScore(stage.score)}` : ""}
          </Badge>
        );
      })}
    </div>
  );
}

export function MonitoringStatusCell({
  student,
}: {
  student: AdminAcademicMonitoringStudent;
}) {
  const mainTryoutTotal =
    student.mainTryoutTotal || UTBK_MAIN_TRYOUT_STAGE_COUNT;
  const completedMainTryoutCount =
    student.completedMainTryoutCount ?? student.completedTryoutCount;
  const attendanceText = student.attendanceTotal
    ? `${formatNumber(student.attendancePresent)}/${formatNumber(student.attendanceTotal)} hadir`
    : "Belum ada absensi";
  const taskText = student.isUtbk
    ? "Fokus tryout"
    : `${formatNumber(student.gradedTaskCount)} tugas dinilai`;

  return (
    <div className="min-w-[280px] space-y-2">
      <p className="text-sm font-semibold text-slate-900">
        {formatNumber(student.materialCount)} materi terhubung
      </p>
      <p className="text-xs leading-5 text-slate-500">
        {taskText} · {attendanceText}
      </p>
      {student.isUtbk ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-orange-700">
            Tryout UTBK {completedMainTryoutCount}/{mainTryoutTotal}
          </p>
          <UtbkStageProgress student={student} />
        </div>
      ) : (
        <p className="text-xs leading-5 text-slate-400">
          Dipantau dari aktivitas kelas dan nilai guru.
        </p>
      )}
    </div>
  );
}

export function ResultStatusCell({
  student,
}: {
  student: AdminAcademicMonitoringStudent;
}) {
  return (
    <div className="min-w-[250px] space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className={cn(
            "w-fit rounded-xl border px-2.5 py-1 text-xs font-semibold",
            getStatusBadgeClassName(student.learningStatus),
          )}
        >
          {getStatusLabel(student.learningStatus)}
        </Badge>
      </div>
      <p className="text-sm font-semibold text-slate-900">
        Nilai terakhir {formatScore(student.latestScore)}
      </p>
      <p className="text-xs leading-5 text-slate-500">
        Terbaik {formatScore(student.bestScore)}
        {student.averageScore !== null ? ` · Rata-rata ${formatScore(student.averageScore)}` : ""}
        <span className="block text-slate-400">
          {student.latestScoreLabel
            ? `${student.latestScoreLabel}, ${formatDateTime(student.latestScoreAt)}`
            : "Belum ada nilai tercatat"}
        </span>
      </p>
      <div className="flex flex-wrap gap-1.5 text-xs text-slate-400">
        {student.attendanceRate !== null ? (
          <span>Kehadiran {formatPercent(student.attendanceRate)}</span>
        ) : null}
        {student.latestTryout ? (
          <span>Tryout terakhir {student.latestTryout.shortLabel}</span>
        ) : null}
      </div>
    </div>
  );
}

function SimpleStatusCell({
  student,
}: {
  student: AdminAcademicMonitoringStudent;
}) {
  return (
    <div className="min-w-[150px] space-y-1.5">
      <Badge
        variant="outline"
        className={cn(
          "w-fit rounded-xl border px-2.5 py-1 text-xs font-semibold",
          getStatusBadgeClassName(student.learningStatus),
        )}
      >
        {getStatusLabel(student.learningStatus)}
      </Badge>
      <p className="text-xs text-slate-500">
        {student.latestScore !== null
          ? `Nilai ${formatScore(student.latestScore)}`
          : "Belum ada nilai"}
      </p>
    </div>
  );
}

function MonitoringNoteCell({
  student,
}: {
  student: AdminAcademicMonitoringStudent;
}) {
  const firstLine = student.isUtbk
    ? `Tryout UTBK ${getTryoutProgressText(student)}`
    : `Kehadiran: ${student.attendancePresent}/${student.attendanceTotal} (${formatPercent(student.attendanceRate)})`;
  const secondLine = student.isUtbk
    ? getTargetText(student)
    : `Materi: ${student.materialCount} | CBT: ${student.taskCount} | Review: ${student.gradedTaskCount}`;

  return (
    <div className="min-w-[230px] max-w-[320px] space-y-1">
      <p className="text-sm font-medium text-slate-800">{firstLine}</p>
      <p className="line-clamp-2 text-xs leading-5 text-slate-500">
        {secondLine}
      </p>
    </div>
  );
}

function DetailActionCell({
  student,
  onView,
}: {
  student: AdminAcademicMonitoringStudent;
  onView: (student: AdminAcademicMonitoringStudent) => void;
}) {
  const studentName = getStudentNameText(student);

  return (
    <Button
      type="button"
      variant="outline"
      title={`Lihat detail ${studentName}`}
      aria-label={`Lihat detail ${studentName}`}
      className={cn("h-9 w-9 rounded-xl p-0", warmOutlineButtonClassName)}
      onClick={() => onView(student)}
    >
      <Eye className="size-4" />
    </Button>
  );
}

function DetailPanel({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-slate-100 bg-slate-50/70 p-4",
        className,
      )}
    >
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-2.5 last:border-0 last:pb-0">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <span className="max-w-[62%] text-right text-sm font-semibold text-slate-900">
        {value}
      </span>
    </div>
  );
}

function StudentDetailDialog({
  student,
  open,
  onOpenChange,
}: {
  student: AdminAcademicMonitoringStudent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!student) {
    return null;
  }

  const latestScoreText = student.latestScoreLabel
    ? `${student.latestScoreLabel} - ${formatDateTime(student.latestScoreAt)}`
    : "Belum ada nilai tercatat";
  const studentName = getStudentNameText(student);
  const programTitle = getProgramDisplayText(student);
  const programSubtitle = getProgramSubtitleText(student);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          adminPoppins.className,
          "max-h-[90vh] max-w-3xl overflow-y-auto rounded-3xl",
        )}
      >
        <DialogHeader className="pr-10">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-2xl">{studentName}</DialogTitle>
              <DialogDescription>
                {programSubtitle ? `${programTitle} - ${programSubtitle}` : programTitle}
              </DialogDescription>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={warmOutlineButtonClassName}
                onClick={() => exportStudentPdf(student)}
              >
                <FileText className="size-4" />
                PDF
              </Button>
              <Badge
                variant="secondary"
                className={
                  student.isUtbk
                    ? "bg-orange-50 text-orange-700"
                    : "bg-sky-50 text-sky-700"
                }
              >
                {student.isUtbk ? "UTBK" : "Reguler"}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-3 md:grid-cols-2">
          <DetailPanel title="Profil">
            <DetailRow label="Program" value={programTitle} />
            {programSubtitle ? (
              <DetailRow label="Kelas" value={programSubtitle} />
            ) : null}
            {student.isUtbk ? (
              <DetailRow label="Target" value={getTargetText(student)} />
            ) : null}
          </DetailPanel>

          <DetailPanel title="Alur Harian">
            <DetailRow
              label="Kehadiran"
              value={`${formatNumber(student.attendancePresent)} / ${formatNumber(student.attendanceTotal)} (${formatPercent(student.attendanceRate)})`}
            />
            <DetailRow
              label="Materi"
              value={`${formatNumber(student.materialCount)} Bab Selesai`}
            />
            <DetailRow
              label="Latihan CBT"
              value={`${formatNumber(student.taskCount)} Selesai`}
            />
            <DetailRow
              label="Review Guru"
              value={`${formatNumber(student.gradedTaskCount)} Dinilai`}
            />
          </DetailPanel>

          <DetailPanel title="Nilai">
            <div className="mb-2">
              <Badge
                variant="outline"
                className={cn(
                  "rounded-xl border px-2.5 py-1 text-xs font-semibold",
                  getStatusBadgeClassName(student.learningStatus),
                )}
              >
                {getStatusLabel(student.learningStatus)}
              </Badge>
            </div>
            <DetailRow
              label="Terakhir"
              value={formatScore(student.latestScore)}
            />
            <DetailRow label="Terbaik" value={formatScore(student.bestScore)} />
            <DetailRow
              label="Rata-rata"
              value={formatScore(student.averageScore)}
            />
            <p className="pt-1 text-xs leading-5 text-slate-500">
              {latestScoreText}
            </p>
          </DetailPanel>

          {student.isUtbk ? (
            <DetailPanel title="Tryout UTBK">
              <UtbkStageProgress student={student} />
              <DetailRow
                label="Terakhir"
                value={
                  student.latestTryout
                    ? student.latestTryout.shortLabel
                    : "Belum ada tryout"
                }
              />
              {student.latestTryout ? (
                <p className="text-xs leading-5 text-slate-500">
                  {student.latestTryout.title || "Tryout UTBK"} -{" "}
                  {formatDateTime(student.latestTryout.submittedAt)}
                </p>
              ) : null}
            </DetailPanel>
          ) : (
            <DetailPanel title="Catatan">
              <p className="text-sm leading-6 text-slate-600">
                Monitoring siswa reguler mengikuti aktivitas kelas, tugas,
                absensi, dan nilai dari guru.
              </p>
            </DetailPanel>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AdminAcademicMonitoring({
  globalSearchQuery = "",
}: AdminAcademicMonitoringProps) {
  const [data, setData] = useState<AdminAcademicMonitoringData>(
    emptyMonitoringData,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [programFilter, setProgramFilter] = useState(allProgramsValue);
  const [statusFilter, setStatusFilter] = useState(allStatusesValue);
  const [selectedStudent, setSelectedStudent] =
    useState<AdminAcademicMonitoringStudent | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const deferredSearch = useDeferredValue(search);
  const deferredGlobalSearch = useDeferredValue(globalSearchQuery);
  const combinedSearchQuery = [
    deferredSearch.trim(),
    deferredGlobalSearch.trim(),
  ]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    let isCancelled = false;

    async function loadMonitoring() {
      setIsLoading(true);
      setError(null);

      try {
        const result = await fetchAdminAcademicMonitoring({
          q: combinedSearchQuery || undefined,
          program: programFilter === allProgramsValue ? undefined : programFilter,
          status: statusFilter === allStatusesValue ? undefined : statusFilter,
        });

        if (isCancelled) {
          return;
        }

        setData(result);
      } catch (requestError) {
        if (isCancelled) {
          return;
        }

        setData(emptyMonitoringData);
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Gagal memuat monitoring akademik.",
        );
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    const timerId = window.setTimeout(() => {
      void loadMonitoring();
    }, 180);

    return () => {
      isCancelled = true;
      window.clearTimeout(timerId);
    };
  }, [combinedSearchQuery, programFilter, statusFilter]);

  const displayStudents = useMemo(
    () => data.students.filter(hasDisplayableStudentName),
    [data.students],
  );
  const displayUtbkCount = displayStudents.filter(
    (student) => student.isUtbk,
  ).length;
  const displayRegularCount = displayStudents.length - displayUtbkCount;
  const totalPages = Math.max(
    1,
    Math.ceil(displayStudents.length / monitoringPageSize),
  );
  const activePage = Math.min(currentPage, totalPages);
  const paginatedStudents = useMemo(() => {
    const startIndex = (activePage - 1) * monitoringPageSize;

    return displayStudents.slice(startIndex, startIndex + monitoringPageSize);
  }, [activePage, displayStudents]);
  const visibleStartIndex = displayStudents.length
    ? (activePage - 1) * monitoringPageSize + 1
    : 0;
  const visibleEndIndex = Math.min(
    activePage * monitoringPageSize,
    displayStudents.length,
  );

  const columns = useMemo<
    AdminColumnDefinition<AdminAcademicMonitoringStudent>[]
  >(
    () => [
      {
        key: "number",
        header: "No",
        className: "w-[64px] text-center",
        cell: (_student, index) => (
          <span className="text-sm font-semibold text-slate-600">
            {formatNumber((activePage - 1) * monitoringPageSize + index + 1)}
          </span>
        ),
      },
      {
        key: "student",
        header: "Siswa",
        cell: (student) => <StudentIdentityCell student={student} />,
      },
      {
        key: "program",
        header: "Program",
        cell: (student) => <ProgramCell student={student} />,
      },

      {
        key: "action",
        header: "Aksi",
        className: "w-[76px] text-center",
        cell: (student) => (
          <DetailActionCell student={student} onView={setSelectedStudent} />
        ),
      },
    ],
    [activePage],
  );

  const handleResetFilters = () => {
    setSearch("");
    setProgramFilter(allProgramsValue);
    setStatusFilter(allStatusesValue);
    setCurrentPage(1);
  };

  const handleExportExcel = () => {
    exportMonitoringExcel(displayStudents);
  };

  const handlePreviousPage = () => {
    setCurrentPage(Math.max(1, activePage - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(Math.min(totalPages, activePage + 1));
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handleProgramFilterChange = (value: string) => {
    setProgramFilter(value);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  return (
    <div className={cn(adminPoppins.className, "space-y-6")}>
      <AdminSectionCard
        title="Monitoring Akademik"
        description="Lihat ringkasan belajar siswa reguler dan UTBK dari data kelas yang sudah berjalan."
        square
        action={
          <Button
            type="button"
            variant="outline"
            className={warmOutlineButtonClassName}
            onClick={handleExportExcel}
            disabled={isLoading || !displayStudents.length}
          >
            <Download className="size-4" />
            Export Excel
          </Button>
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <span>Menampilkan {displayStudents.length} siswa sesuai filter.</span>
          <Badge variant="secondary" className="bg-slate-100 text-slate-700">
            Reguler {formatNumber(displayRegularCount)}
          </Badge>
          <Badge variant="secondary" className="bg-orange-50 text-orange-700">
            UTBK {formatNumber(displayUtbkCount)}
          </Badge>
        </div>

        {error ? (
          <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {error}
          </div>
        ) : null}

        <div className="mb-6 rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(280px,1fr)_170px_210px_44px]">
            <div className="relative min-w-0 sm:col-span-2 lg:col-span-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                className={cn(warmFieldClassName, "pl-10")}
                value={search}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder="Cari siswa, kelas, atau target UTBK..."
              />
            </div>

            <Select
              value={programFilter}
              onValueChange={handleProgramFilterChange}
            >
              <SelectTrigger className={warmSelectTriggerClassName}>
                <SelectValue placeholder="Program" />
              </SelectTrigger>
              <SelectContent className={warmSelectContentClassName}>
                {programFilterOptions.map((program) => (
                  <SelectItem key={program} value={program}>
                    {program === allProgramsValue ? "Semua Program" : program}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={statusFilter}
              onValueChange={handleStatusFilterChange}
            >
              <SelectTrigger className={warmSelectTriggerClassName}>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className={warmSelectContentClassName}>
                {statusFilterOptions.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="outline"
              title="Reset filter"
              aria-label="Reset filter"
              className={cn("h-11 w-full px-0 lg:w-11", warmOutlineButtonClassName)}
              onClick={handleResetFilters}
            >
              <RotateCcw className="size-4" />
            </Button>
          </div>
        </div>

        <AdminDataTable
          columns={columns}
          data={paginatedStudents}
          keyExtractor={(student) => student.id}
          emptyTitle="Belum ada data monitoring akademik"
          emptyDescription="Data akan muncul setelah siswa aktif memiliki jadwal, materi, absensi, tugas, nilai, atau tryout."
          isLoading={isLoading}
          square
          minWidthClassName="min-w-[920px]"
          getRowClassName={(student) =>
            student.learningStatus === "Belum Latihan" || student.learningStatus === "Belum Akses Materi"
              ? "bg-amber-50/35 hover:bg-amber-50/60"
              : student.learningStatus === "Belum Hadir"
                ? "bg-rose-50/35 hover:bg-rose-50/60"
                : student.learningStatus === "Data Lengkap"
                  ? "bg-emerald-50/25 hover:bg-emerald-50/45"
                  : student.learningStatus === "Menunggu Review"
                    ? "bg-sky-50/25 hover:bg-sky-50/45"
                    : undefined
          }
        />

        <div className="mt-4 flex flex-col gap-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Menampilkan {formatNumber(visibleStartIndex)}-
            {formatNumber(visibleEndIndex)} dari{" "}
            {formatNumber(displayStudents.length)} siswa
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={warmOutlineButtonClassName}
              onClick={handlePreviousPage}
              disabled={activePage <= 1}
            >
              <ChevronLeft className="size-4" />
              Sebelumnya
            </Button>
            <span className="min-w-[90px] text-center text-xs font-semibold text-slate-500">
              {formatNumber(activePage)} / {formatNumber(totalPages)}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={warmOutlineButtonClassName}
              onClick={handleNextPage}
              disabled={activePage >= totalPages}
            >
              Berikutnya
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3 text-sm leading-6 text-slate-500 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-2">
            <Target className="mt-1 size-4 shrink-0 text-orange-500" />
            <span>
              Siswa reguler dilihat dari materi, tugas, absensi, dan nilai guru.
              Siswa UTBK memiliki tambahan ringkasan tryout.
            </span>
          </div>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            Akademik
          </span>
        </div>
      </AdminSectionCard>
      <StudentDetailDialog
        student={selectedStudent}
        open={Boolean(selectedStudent)}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setSelectedStudent(null);
          }
        }}
      />
    </div>
  );
}

export const AdminUtbkAssessments = AdminAcademicMonitoring;
