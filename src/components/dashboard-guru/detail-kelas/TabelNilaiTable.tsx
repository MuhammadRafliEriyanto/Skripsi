import { FilePenLine, Trophy } from "lucide-react";

import {
  ACADEMIC_SCORE_LABELS,
  averageAvailableScores,
  calculateTotalScores,
  getAcademicScoreKeys,
} from "@/lib/academic-grades";
import type { GradeStatus, TabelNilaiTableProps } from "./types";

function getGradeStatus(scoreAverage: number | null): GradeStatus {
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

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function formatScore(score: number | null) {
  return score ?? "-";
}

export default function TabelNilaiTable({
  nilaiRows,
  onEditNilai,
  participants,
  scheme,
}: TabelNilaiTableProps) {
  const scoreKeys = getAcademicScoreKeys(scheme);
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
      };
    const average = averageAvailableScores([
      currentScore.tugas,
      ...scoreKeys.map((scoreKey) => currentScore.scores[scoreKey]),
    ]);

    const total = calculateTotalScores([
      currentScore.tugas,
      ...scoreKeys.map((scoreKey) => currentScore.scores[scoreKey]),
    ]);

    return {
      average,
      total,
      name: student.name,
      scores: currentScore,
      status: getGradeStatus(average),
      studentId: student.id,
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
          Tabel nilai akan muncul setelah data evaluasi siswa tersedia di sistem.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-orange-50/60 via-white to-amber-50/30 px-5 py-4 md:px-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 md:text-xl">
            Tabel Nilai
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {scheme === "tryout"
              ? "Rekap tugas dan tiga tahap tryout untuk kelas akhir jenjang."
              : "Rekap tugas dan tiga tahap UTS untuk kelas reguler."}
          </p>
        </div>
        <span className="inline-flex items-center border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
          {rows.length} baris nilai
        </span>
      </div>

      <div className="px-5 py-5 md:px-6">
        <div className="overflow-x-auto border border-slate-200 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-slate-50 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300">
          <table className="min-w-[900px] w-full">
            <thead className="bg-orange-50/50 text-left backdrop-blur-sm">
              <tr className="text-xs uppercase tracking-[0.16em] text-slate-500">
                <th className="px-4 py-4 font-semibold">No</th>
                <th className="px-4 py-4 font-semibold">Nama Siswa</th>
                <th className="px-4 py-4 font-semibold">Tugas</th>
                {scoreKeys.map((scoreKey) => (
                  <th key={scoreKey} className="px-4 py-4 font-semibold">
                    {ACADEMIC_SCORE_LABELS[scoreKey]}
                  </th>
                ))}
                <th className="px-4 py-4 font-semibold">Total</th>
                <th className="px-4 py-4 font-semibold">Rata-rata</th>
                <th className="px-4 py-4 font-semibold">Status</th>
                <th className="px-4 py-4 text-center font-semibold">Aksi</th>
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
                  <td className="px-4 py-4 text-slate-600">
                    {formatScore(row.scores.tugas)}
                  </td>
                  {scoreKeys.map((scoreKey) => (
                    <td key={scoreKey} className="px-4 py-4 text-slate-600">
                      {formatScore(row.scores.scores[scoreKey])}
                    </td>
                  ))}
                  <td className="px-4 py-4 font-semibold text-slate-800">
                    {formatScore(row.total)}
                  </td>
                  <td className="px-4 py-4 font-semibold text-slate-800">
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
                      <button
                        type="button"
                        title="Edit Nilai"
                        aria-label="Edit Nilai"
                        onClick={() => onEditNilai(row.studentId)}
                        className="inline-flex h-8 w-8 items-center justify-center border border-slate-200 bg-slate-50 text-slate-700 transition hover:border-orange-300 hover:bg-orange-100"
                      >
                        <FilePenLine className="h-4 w-4" />
                      </button>
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
