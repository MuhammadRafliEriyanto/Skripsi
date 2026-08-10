import { FilePenLine, Trophy } from "lucide-react";

import type {
  GradeStatus,
  TabelNilaiTableProps,
  TaskSubmissionGradeStatus,
} from "./types";

const MEETING_SCORE_COLUMN_COUNT = 24;
const MEETING_COLUMNS = Array.from(
  { length: MEETING_SCORE_COLUMN_COUNT },
  (_, index) => index + 1,
);

function getGradeStatus(
  scoreAverage: number | null,
  hasRemedialScore: boolean,
): GradeStatus {
  if (hasRemedialScore) {
    return "Perlu Remedial";
  }

  if (scoreAverage === null) {
    return "Belum Dinilai";
  }

  if (scoreAverage >= 85) {
    return "Sangat Baik";
  }

  if (scoreAverage >= 75) {
    return "Baik";
  }

  return "Perlu Bimbingan";
}

function getGradeStatusClass(status: GradeStatus) {
  if (status === "Belum Dinilai") {
    return "border-slate-200 bg-slate-50 text-slate-600";
  }

  if (status === "Sangat Baik") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "Baik") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  if (status === "Perlu Remedial") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-rose-200 bg-rose-50 text-rose-700";
}

function getMeetingScoreClass(
  score: number | null,
  status: TaskSubmissionGradeStatus | undefined,
) {
  if (status === "Perlu Remedial") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (typeof score === "number") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-400";
}

function formatScore(score: number | null) {
  return typeof score === "number" ? score : "-";
}

function averageScores(scores: Array<number | null>) {
  const availableScores = scores.filter(
    (score): score is number => typeof score === "number" && Number.isFinite(score),
  );

  if (availableScores.length === 0) {
    return null;
  }

  return Math.round(
    availableScores.reduce((total, score) => total + score, 0) /
      availableScores.length,
  );
}

function totalScores(scores: Array<number | null>) {
  const availableScores = scores.filter(
    (score): score is number => typeof score === "number" && Number.isFinite(score),
  );

  if (availableScores.length === 0) {
    return null;
  }

  return availableScores.reduce((total, score) => total + score, 0);
}

export default function TabelNilaiTable({
  nilaiRows,
  onEditNilai,
  participants,
  readOnly = false,
  readOnlyMessage,
}: TabelNilaiTableProps) {
  const rows = participants.map((student) => {
    const currentScore =
      nilaiRows.find((nilai) => nilai.studentId === student.id) ?? {
        studentId: student.id,
        tugas: null,
        scores: {
          uts: null,
          uas: null,
          uts1: null,
          uts2: null,
          uts3: null,
          tryout1: null,
          tryout2: null,
          tryout3: null,
        },
        note: "",
        pertemuanScores: {},
        pertemuanStatuses: {},
      };
    const meetingScores = MEETING_COLUMNS.map(
      (meetingNumber) => currentScore.pertemuanScores?.[meetingNumber] ?? null,
    );
    const average = averageScores(meetingScores);
    const total = totalScores(meetingScores);
    const hasRemedialScore = MEETING_COLUMNS.some(
      (meetingNumber) =>
        currentScore.pertemuanStatuses?.[meetingNumber] === "Perlu Remedial",
    );

    return {
      average,
      hasRemedialScore,
      meetingScores,
      name: student.name,
      scores: currentScore,
      status: getGradeStatus(average, hasRemedialScore),
      studentId: student.id,
      total,
    };
  });

  if (rows.length === 0) {
    return (
      <div className="border border-dashed border-slate-200 bg-white px-5 py-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center border border-slate-200 bg-slate-50 text-slate-500">
          <Trophy className="h-5 w-5" />
        </div>
        <p className="mt-4 text-base font-semibold text-slate-700">
          Belum ada nilai siswa yang ditampilkan.
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Tabel nilai akan muncul setelah latihan siswa dinilai di sistem.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-orange-50/60 via-white to-amber-50/30 px-5 py-4 md:px-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 md:text-xl">
            Tabel Nilai Pertemuan
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Rekap nilai latihan siswa per pertemuan P1 sampai P24.
          </p>
        </div>
        <span className="inline-flex items-center border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
          {rows.length} baris nilai
        </span>
      </div>

      <div className="px-5 py-5 md:px-6">
        <div className="overflow-x-auto border border-slate-200 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-slate-50 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300">
          <table className="min-w-[2320px] table-fixed w-full">
            <thead className="bg-orange-50/50 text-left backdrop-blur-sm">
              <tr className="text-xs uppercase tracking-[0.16em] text-slate-500">
                <th className="w-16 px-4 py-4 font-semibold">No</th>
                <th className="w-56 px-4 py-4 font-semibold">Nama Siswa</th>
                {MEETING_COLUMNS.map((meetingNumber) => (
                  <th
                    key={meetingNumber}
                    className="w-16 px-2 py-4 text-center font-semibold"
                  >
                    P{meetingNumber}
                  </th>
                ))}
                <th className="w-24 px-4 py-4 text-center font-semibold">Total</th>
                <th className="w-28 px-4 py-4 text-center font-semibold">
                  Rata-rata
                </th>
                <th className="w-36 px-4 py-4 font-semibold">Status</th>
                <th className="w-24 px-4 py-4 text-center font-semibold">
                  Koreksi
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={row.studentId}
                  className="border-t border-slate-200 text-sm transition hover:bg-orange-50/40"
                >
                  <td className="px-4 py-4 font-medium text-slate-500">
                    {index + 1}
                  </td>
                  <td className="px-4 py-4 font-semibold text-slate-800">
                    {row.name}
                  </td>
                  {MEETING_COLUMNS.map((meetingNumber, meetingIndex) => {
                    const score = row.meetingScores[meetingIndex];
                    const status = row.scores.pertemuanStatuses?.[meetingNumber];

                    return (
                      <td
                        key={`${row.studentId}-${meetingNumber}`}
                        className="px-2 py-3 text-center"
                      >
                        <span
                          className={`inline-flex h-8 min-w-10 items-center justify-center border px-2 text-xs font-semibold ${getMeetingScoreClass(score, status)}`}
                          title={
                            status === "Perlu Remedial"
                              ? "Siswa perlu remedial untuk pertemuan ini"
                              : undefined
                          }
                        >
                          {formatScore(score)}
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-4 py-4 text-center font-semibold text-slate-800">
                    {formatScore(row.total)}
                  </td>
                  <td className="px-4 py-4 text-center font-semibold text-slate-800">
                    {formatScore(row.average)}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center border px-2.5 py-1 text-xs font-semibold ${getGradeStatusClass(row.status)}`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-center gap-2">
                      {readOnly ? (
                        <span className="inline-flex items-center border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                          Arsip
                        </span>
                      ) : (
                        <button
                          type="button"
                          title={
                            readOnly
                              ? readOnlyMessage
                              : "Koreksi nilai dengan alasan"
                          }
                          aria-label="Koreksi nilai"
                          onClick={() => onEditNilai(row.studentId)}
                          className="inline-flex h-8 w-8 items-center justify-center border border-slate-200 bg-slate-50 text-slate-700 transition hover:border-orange-300 hover:bg-orange-100"
                        >
                          <FilePenLine className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
