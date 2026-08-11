const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/components/dashboard-guru/detail-kelas/TabelNilaiTable.tsx');

const content = `import { Trophy } from "lucide-react";
import type { GradeStatus, TabelNilaiTableProps } from "./types";

function getGradeStatus(scoreAverage: number | null): GradeStatus {
  if (scoreAverage === null) {
    return "Belum Dinilai";
  }
  if (scoreAverage >= 90) return "Sangat Baik";
  if (scoreAverage >= 81) return "Baik";
  if (scoreAverage >= 70) return "Cukup";
  return "Kurang Baik";
}

function getGradeStatusClass(status: GradeStatus) {
  if (status === "Belum Dinilai") return "border-slate-200 bg-slate-50 text-slate-600";
  if (status === "Sangat Baik") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "Baik") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "Cukup") return "border-orange-200 bg-orange-50 text-orange-700";
  return "border-red-200 bg-red-50 text-red-700";
}

function formatScore(score: number | null) {
  return score ?? "-";
}

const PERTEMUAN_COUNT = 24;
const pertemuanArray = Array.from({ length: PERTEMUAN_COUNT }, (_, i) => i + 1);

export default function TabelNilaiTable({
  nilaiRows,
  participants,
  readOnly = false,
  readOnlyMessage,
}: TabelNilaiTableProps) {
  const rows = participants.map((student) => {
    const currentScore =
      nilaiRows.find((nilai) => nilai.studentId === student.id) ?? {
        studentId: student.id,
        pertemuanScores: {},
      };

    const scoreValues = pertemuanArray
      .map((p) => currentScore.pertemuanScores[p])
      .filter((score): score is number => typeof score === "number" && Number.isFinite(score));

    const total = scoreValues.reduce((sum, score) => sum + score, 0);
    const average =
      scoreValues.length > 0 ? Math.round(total / scoreValues.length) : null;

    return {
      average,
      total: scoreValues.length > 0 ? total : null,
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
            {readOnly
              ? readOnlyMessage ?? "Kelas ini sudah menjadi arsip. Nilai hanya bisa dilihat."
              : "Rekap nilai latihan CBT setiap pertemuan."}
          </p>
        </div>
        <span className="inline-flex items-center border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
          {rows.length} baris nilai
        </span>
      </div>

      <div className="px-5 py-5 md:px-6">
        <div className="overflow-x-auto border border-slate-200 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-slate-50 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300">
          <table className="w-full min-w-[max-content]">
            <thead className="bg-orange-50/50 text-left backdrop-blur-sm">
              <tr className="text-xs uppercase tracking-[0.16em] text-slate-500">
                <th className="sticky left-0 z-10 bg-orange-50/90 px-4 py-4 font-semibold backdrop-blur-sm">No</th>
                <th className="sticky left-[50px] z-10 bg-orange-50/90 px-4 py-4 font-semibold backdrop-blur-sm shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">Nama Siswa</th>
                {pertemuanArray.map((p) => (
                  <th key={p} className="px-4 py-4 font-semibold min-w-[60px] text-center">
                    P{p}
                  </th>
                ))}
                <th className="px-4 py-4 font-semibold text-center">Total</th>
                <th className="px-4 py-4 font-semibold text-center">Rata-rata</th>
                <th className="px-4 py-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={row.studentId}
                  className="border-t border-slate-200 text-sm transition hover:bg-orange-50/40"
                >
                  <td className="sticky left-0 z-10 bg-white px-4 py-4 font-medium text-slate-500 group-hover:bg-orange-50/40">
                    {index + 1}
                  </td>
                  <td className="sticky left-[50px] z-10 bg-white px-4 py-4 font-semibold text-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] group-hover:bg-orange-50/40">
                    <div className="min-w-[150px]">{row.name}</div>
                  </td>
                  {pertemuanArray.map((p) => (
                    <td key={p} className="px-4 py-4 text-center text-slate-600 font-medium">
                      {formatScore(row.scores.pertemuanScores[p])}
                    </td>
                  ))}
                  <td className="px-4 py-4 font-bold text-center text-slate-800">
                    {formatScore(row.total)}
                  </td>
                  <td className="px-4 py-4 font-bold text-center text-slate-800">
                    {formatScore(row.average)}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex min-w-max items-center border px-2.5 py-1 text-xs font-semibold ${getGradeStatusClass(row.status)}`}
                    >
                      {row.status}
                    </span>
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
`;

fs.writeFileSync(file, content, 'utf8');
console.log('TabelNilaiTable.tsx updated');
