import {
  BookOpenCheck,
  CalendarCheck2,
  ClipboardList,
  FileText,
  Trophy,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type {
  AcademicHistoryAcademicGrade,
  AcademicHistoryAttendanceRecord,
  AcademicHistoryDetailData,
  AcademicHistoryTask,
  AcademicHistoryTaskGrade,
  AcademicHistoryTryout,
} from "./academic-history-types";

const SCORE_LABELS: Record<string, string> = {
  uts: "UTS",
  uas: "UAS",
  uts1: "UTS 1",
  uts2: "UTS 2",
  uts3: "UTS 3",
  tryout1: "Tryout 1",
  tryout2: "Tryout 2",
  tryout3: "Tryout 3",
};

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return normalizeText(value) || "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return normalizeText(value) || "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function getStatusClass(status: string | null | undefined) {
  const normalizedStatus = normalizeText(status).toLowerCase();

  if (
    normalizedStatus.includes("hadir") ||
    normalizedStatus.includes("sudah") ||
    normalizedStatus.includes("submitted") ||
    normalizedStatus.includes("paid") ||
    normalizedStatus.includes("active")
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (
    normalizedStatus.includes("izin") ||
    normalizedStatus.includes("pending") ||
    normalizedStatus.includes("progress")
  ) {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  if (normalizedStatus.includes("sakit") || normalizedStatus.includes("review")) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (
    normalizedStatus.includes("alpa") ||
    normalizedStatus.includes("expired") ||
    normalizedStatus.includes("failed")
  ) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        getStatusClass(status),
      )}
    >
      {normalizeText(status) || "-"}
    </span>
  );
}

function SectionShell({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: typeof Trophy;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[24px] border border-slate-100 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-orange-100 bg-orange-50 text-orange-600">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
          </div>
        </div>
      </div>
      {children}
    </section>
  );
}

function EmptySection({ label }: { label: string }) {
  return (
    <div className="px-5 py-8 text-center text-sm text-slate-500">
      {label} belum tersedia untuk periode ini.
    </div>
  );
}

function ScoreChips({ grade }: { grade: AcademicHistoryAcademicGrade }) {
  const entries = Object.entries(grade.scores ?? {}).filter(
    ([, value]) => typeof value === "number",
  );

  if (entries.length === 0) {
    return <span className="text-sm text-slate-400">-</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([key, value]) => (
        <span
          key={key}
          className="rounded-full border border-orange-100 bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-700"
        >
          {SCORE_LABELS[key] ?? key}: {value}
        </span>
      ))}
    </div>
  );
}

function AcademicGradesTable({ grades }: { grades: AcademicHistoryAcademicGrade[] }) {
  if (grades.length === 0) {
    return <EmptySection label="Nilai akademik" />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-white text-xs uppercase tracking-[0.12em] text-slate-400">
          <tr>
            <th className="px-5 py-3 font-semibold">Kelas</th>
            <th className="px-5 py-3 font-semibold">Periode</th>
            <th className="px-5 py-3 font-semibold">Skor</th>
            <th className="px-5 py-3 font-semibold">Catatan</th>
            <th className="px-5 py-3 font-semibold">Evaluasi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {grades.map((grade) => (
            <tr key={grade.academicGradeId || `${grade.classId}-${grade.updatedAt}`}>
              <td className="px-5 py-4 font-semibold text-slate-800">
                {grade.classId || "-"}
              </td>
              <td className="px-5 py-4 text-slate-600">
                {grade.semester || "-"} {grade.academicYear || ""}
              </td>
              <td className="px-5 py-4">
                <ScoreChips grade={grade} />
              </td>
              <td className="px-5 py-4 text-slate-600">{grade.note || "-"}</td>
              <td className="px-5 py-4 text-slate-500">
                {formatDateTime(grade.evaluatedAt ?? grade.updatedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TaskGradesTable({ grades }: { grades: AcademicHistoryTaskGrade[] }) {
  if (grades.length === 0) {
    return <EmptySection label="Nilai tugas" />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-white text-xs uppercase tracking-[0.12em] text-slate-400">
          <tr>
            <th className="px-5 py-3 font-semibold">Tugas</th>
            <th className="px-5 py-3 font-semibold">Kelas</th>
            <th className="px-5 py-3 font-semibold">Nilai</th>
            <th className="px-5 py-3 font-semibold">Status</th>
            <th className="px-5 py-3 font-semibold">Catatan</th>
            <th className="px-5 py-3 font-semibold">Dinilai</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {grades.map((grade) => (
            <tr key={grade.gradeId || `${grade.taskId}-${grade.updatedAt}`}>
              <td className="px-5 py-4 font-semibold text-slate-800">
                {grade.taskId || "-"}
              </td>
              <td className="px-5 py-4 text-slate-600">{grade.classId || "-"}</td>
              <td className="px-5 py-4">
                <span className="inline-flex h-9 min-w-11 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 px-3 font-bold text-emerald-700">
                  {typeof grade.score === "number" ? grade.score : "-"}
                </span>
              </td>
              <td className="px-5 py-4">
                <StatusBadge status={grade.status} />
              </td>
              <td className="px-5 py-4 text-slate-600">{grade.note || "-"}</td>
              <td className="px-5 py-4 text-slate-500">
                {formatDateTime(grade.gradedAt ?? grade.updatedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AttendanceTable({
  records,
}: {
  records: AcademicHistoryAttendanceRecord[];
}) {
  if (records.length === 0) {
    return <EmptySection label="Absensi" />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[840px] text-left text-sm">
        <thead className="bg-white text-xs uppercase tracking-[0.12em] text-slate-400">
          <tr>
            <th className="px-5 py-3 font-semibold">Tanggal</th>
            <th className="px-5 py-3 font-semibold">Mapel</th>
            <th className="px-5 py-3 font-semibold">Kelas</th>
            <th className="px-5 py-3 font-semibold">Ruangan</th>
            <th className="px-5 py-3 font-semibold">Status</th>
            <th className="px-5 py-3 font-semibold">Catatan</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {records.map((record) => (
            <tr key={record.id || record.recordId || `${record.sessionId}-${record.date}`}>
              <td className="px-5 py-4 text-slate-700">
                <p className="font-semibold">{formatDate(record.date)}</p>
                <p className="mt-1 text-xs text-slate-400">{record.startTime || "-"}</p>
              </td>
              <td className="px-5 py-4 text-slate-700">{record.subject || "-"}</td>
              <td className="px-5 py-4 text-slate-600">{record.className || "-"}</td>
              <td className="px-5 py-4 text-slate-600">{record.room || "-"}</td>
              <td className="px-5 py-4">
                <StatusBadge status={record.status} />
                <p className="mt-1.5 text-xs text-slate-400">
                  {formatDateTime(record.markedAt)}
                </p>
              </td>
              <td className="px-5 py-4 text-slate-600">{record.note || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TryoutTable({ tryouts }: { tryouts: AcademicHistoryTryout[] }) {
  if (tryouts.length === 0) {
    return <EmptySection label="Tryout" />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="bg-white text-xs uppercase tracking-[0.12em] text-slate-400">
          <tr>
            <th className="px-5 py-3 font-semibold">Ujian</th>
            <th className="px-5 py-3 font-semibold">Mapel</th>
            <th className="px-5 py-3 font-semibold">Jadwal</th>
            <th className="px-5 py-3 font-semibold">Nilai</th>
            <th className="px-5 py-3 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {tryouts.map((tryout) => (
            <tr key={tryout.tryoutId || tryout.id}>
              <td className="px-5 py-4">
                <p className="font-semibold text-slate-800">{tryout.title || "-"}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {tryout.assessmentType || "Tryout"}
                  {tryout.stage ? ` ${tryout.stage}` : ""} | {tryout.kelas || "-"}
                </p>
              </td>
              <td className="px-5 py-4 text-slate-700">{tryout.subject || "-"}</td>
              <td className="px-5 py-4 text-slate-600">
                {formatDateTime(tryout.startAt)} - {formatDateTime(tryout.endAt)}
              </td>
              <td className="px-5 py-4">
                <span className="inline-flex h-9 min-w-11 items-center justify-center rounded-xl border border-orange-100 bg-orange-50 px-3 font-bold text-orange-700">
                  {typeof tryout.myAttempt?.score === "number"
                    ? tryout.myAttempt.score
                    : "-"}
                </span>
              </td>
              <td className="px-5 py-4">
                <StatusBadge status={tryout.myAttempt?.status ?? "Belum dikerjakan"} />
                <p className="mt-1.5 text-xs text-slate-400">
                  {formatDateTime(tryout.myAttempt?.submittedAt)}
                </p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TasksTable({ tasks }: { tasks: AcademicHistoryTask[] }) {
  if (tasks.length === 0) {
    return <EmptySection label="Daftar tugas" />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="bg-white text-xs uppercase tracking-[0.12em] text-slate-400">
          <tr>
            <th className="px-5 py-3 font-semibold">Tugas</th>
            <th className="px-5 py-3 font-semibold">Kelas</th>
            <th className="px-5 py-3 font-semibold">Deadline</th>
            <th className="px-5 py-3 font-semibold">Pengumpulan</th>
            <th className="px-5 py-3 font-semibold">Nilai</th>
            <th className="px-5 py-3 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {tasks.map((task) => (
            <tr key={task.taskId || task.id}>
              <td className="px-5 py-4">
                <p className="font-semibold text-slate-800">{task.title || "-"}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                  {task.description || "-"}
                </p>
              </td>
              <td className="px-5 py-4 text-slate-600">
                <p>{task.className || "-"}</p>
                <p className="mt-1 text-xs text-slate-400">{task.subject || "-"}</p>
              </td>
              <td className="px-5 py-4 text-slate-600">{formatDate(task.deadline)}</td>
              <td className="px-5 py-4 text-slate-600">
                {task.mySubmission?.submittedAt
                  ? formatDateTime(task.mySubmission.submittedAt)
                  : "Belum mengumpulkan"}
              </td>
              <td className="px-5 py-4">
                <span className="inline-flex h-9 min-w-11 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 px-3 font-bold text-slate-700">
                  {typeof task.myGrade?.score === "number" ? task.myGrade.score : "-"}
                </span>
              </td>
              <td className="px-5 py-4">
                <StatusBadge status={task.myGrade?.status ?? task.reviewStatus} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-[20px] border border-slate-100 bg-white px-4 py-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export function AcademicHistoryDetailPanel({
  detail,
  compact = false,
}: {
  detail: AcademicHistoryDetailData;
  compact?: boolean;
}) {
  const academicGrades = detail.grades?.academicGrades ?? [];
  const taskGrades = detail.grades?.taskGrades ?? [];
  const attendanceRecords = detail.attendance?.records ?? [];
  const tryouts = detail.tryouts ?? [];
  const tasks = detail.tasks ?? [];
  const subscription = detail.subscription;

  return (
    <div className={cn("space-y-5", compact && "space-y-4")}>
      <section className="rounded-[24px] border border-orange-100 bg-orange-50/40 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-600">
              Periode Akademik
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">
              {subscription?.program || "Program"} - {subscription?.className || "Kelas"}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {subscription?.semester || "-"} {subscription?.academicYear || ""} |{" "}
              {formatDate(subscription?.startDate)} - {formatDate(subscription?.endDate)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="info">{subscription?.packageName || "Membership"}</Badge>
            <Badge variant="secondary">{subscription?.paymentStatus || "-"}</Badge>
          </div>
        </div>
        {detail.fallback?.legacyRecords ? (
          <p className="mt-4 rounded-2xl border border-orange-100 bg-white/75 px-4 py-3 text-xs leading-5 text-slate-500">
            {detail.fallback.legacyRecords}
          </p>
        ) : null}
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <MetricCard label="Nilai Akademik" value={academicGrades.length} />
        <MetricCard label="Nilai Tugas" value={taskGrades.length} />
        <MetricCard label="Absensi" value={attendanceRecords.length} />
        <MetricCard label="Tryout" value={tryouts.length} />
        <MetricCard label="Tugas" value={tasks.length} />
      </div>

      <SectionShell
        title="Nilai Akademik"
        description="Rekap evaluasi semester atau tryout untuk subscription ini."
        icon={Trophy}
      >
        <AcademicGradesTable grades={academicGrades} />
      </SectionShell>

      <SectionShell
        title="Nilai Tugas"
        description="Nilai tugas yang tersimpan untuk periode akademik ini."
        icon={BookOpenCheck}
      >
        <TaskGradesTable grades={taskGrades} />
      </SectionShell>

      <SectionShell
        title="Absensi"
        description="Riwayat kehadiran siswa pada periode yang dipilih."
        icon={CalendarCheck2}
      >
        <AttendanceTable records={attendanceRecords} />
      </SectionShell>

      <SectionShell
        title="Tryout"
        description="Ujian dan hasil attempt siswa untuk subscription ini."
        icon={ClipboardList}
      >
        <TryoutTable tryouts={tryouts} />
      </SectionShell>

      <SectionShell
        title="Daftar Tugas"
        description="Tugas yang masuk ke periode akademik ini beserta status pengumpulan dan nilai."
        icon={FileText}
      >
        <TasksTable tasks={tasks} />
      </SectionShell>
    </div>
  );
}
