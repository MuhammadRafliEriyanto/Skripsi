"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  BookOpen,
} from "lucide-react";
import Link from "next/link";

import { useStudentLearningData } from "../data/useStudentLearningData";
import { getStudentAcademicAccessMessage } from "../data/studentAcademicAccess";
import {
  ACADEMIC_SCORE_LABELS,
  calculateTotalScores,
  getAcademicScoreKeys,
} from "@/lib/academic-grades";

function getGradeStatusClass(status: string) {
  if (status === "Sudah Dinilai") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function formatGradedTime(value: string | null) {
  if (!value) {
    return "-";
  }

  const gradedDate = new Date(value);

  if (Number.isNaN(gradedDate.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(gradedDate);
}

export default function NilaiSiswaPageView() {
  const { tasks, academicSummaries, academicAccess, isLoading, loadError } =
    useStudentLearningData();
  const academicAccessMessage =
    getStudentAcademicAccessMessage(academicAccess);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  const groupedTasks = useMemo(() => {
    const groups: Record<string, typeof tasks> = {};
    tasks.forEach((task) => {
      if (!groups[task.classId]) {
        groups[task.classId] = [];
      }
      groups[task.classId].push(task);
    });
    return groups;
  }, [tasks]);

  const mapelSummaries = useMemo(() => {
    return academicSummaries.map((summary) => {
      const classTasks = groupedTasks[summary.classId] ?? [];
      const totalScore = calculateTotalScores([
        summary.taskAverage,
        ...getAcademicScoreKeys(summary.scheme).map((key) => summary.scores[key]),
      ]);

      return {
        ...summary,
        totalTasks: classTasks.length,
        hasUngraded: classTasks.some(
          (t) => t.mySubmission?.submitted && !t.myGrade?.graded,
        ),
        totalScore,
      };
    });
  }, [academicSummaries, groupedTasks]);
  const selectedSummary = useMemo(
    () =>
      mapelSummaries.find((summary) => summary.classId === selectedClassId) ??
      null,
    [mapelSummaries, selectedClassId],
  );
  const selectedTasks = selectedSummary
    ? groupedTasks[selectedSummary.classId] ?? []
    : [];

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <div className="flex flex-col gap-4 rounded-[28px] border border-slate-100 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between md:p-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-600">
            Rekapitulasi Nilai
          </p>
          <h1 className="mt-2 text-xl font-semibold text-slate-900 md:text-2xl">
            Nilai Tugas & Evaluasi
          </h1>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
            Pantau hasil belajarmu secara keseluruhan. Lihat detail nilai,
            catatan dari guru, dan status evaluasi untuk setiap mata pelajaran.
          </p>
        </div>
      </div>

      {isLoading ? (
        <section className="rounded-[26px] border border-slate-100 bg-white p-8 text-center shadow-sm">
          <p className="text-base font-semibold text-slate-800">
            Data nilai sedang dimuat
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Sistem sedang mengambil rekapitulasi nilai terbaru kamu...
          </p>
        </section>
      ) : academicSummaries.length === 0 ? (
        <section className="rounded-[26px] border border-slate-100 bg-white p-8 text-center shadow-sm">
          <p className="text-base font-semibold text-slate-800">
            Belum ada data nilai
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {academicAccessMessage ??
              loadError ??
              "Guru belum memberikan tugas atau evaluasi yang dinilai untuk kamu."}
          </p>
        </section>
      ) : (
        <>
          {/* ======================= LEVEL 1: OVERVIEW & MAPEL CARDS ======================= */}
          {!selectedSummary ? (
            /* Mapel Cards */
            <section className="rounded-[26px] border border-slate-100 bg-white p-5 shadow-sm md:p-6">
              <div className="mb-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-600">
                  Mata Pelajaran
                </p>
                <h2 className="mt-2 text-lg font-semibold text-slate-800">
                  Daftar Nilai Berdasarkan Mata Pelajaran
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {mapelSummaries.map((summary) => (
                  <article
                    key={summary.classId}
                    onClick={() => setSelectedClassId(summary.classId)}
                    className="group flex cursor-pointer flex-col justify-between gap-4 rounded-[22px] border border-slate-100 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-orange-100 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
                          <BookOpen className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-800 transition-colors group-hover:text-orange-600">
                            {summary.subject}
                          </h3>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {summary.gradedTaskCount} dari {summary.totalTasks}{" "}
                            Tugas Dinilai
                          </p>
                        </div>
                      </div>
                      {summary.hasUngraded && (
                        <span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">
                          Menunggu Review
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-50 pt-4">
                      <div className="flex gap-6">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            Total Nilai
                          </p>
                          <p className="mt-1 text-lg font-bold text-slate-800">
                            {summary.totalScore ?? "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            Rata-Rata
                          </p>
                          <p className="mt-1 text-lg font-bold text-slate-800">
                            {summary.finalAverage ?? "-"}
                          </p>
                        </div>
                      </div>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-colors group-hover:bg-orange-50 group-hover:text-orange-600">
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : (
            /* ======================= LEVEL 2: DETAILED TASKS TABLE ======================= */
            <div className="flex flex-col gap-5">
              <button
                onClick={() => setSelectedClassId(null)}
                className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Kembali ke Daftar Mata Pelajaran
              </button>

              <section className="rounded-[26px] border border-slate-100 bg-white p-5 shadow-sm md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-600">
                      Rekap Evaluasi
                    </p>
                    <h2 className="mt-2 text-lg font-semibold text-slate-800">
                      {selectedSummary.subject}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {selectedSummary.semester} {selectedSummary.academicYear}
                    </p>
                  </div>
                  <div className="flex gap-8 text-right">
                    <div>
                      <p className="text-xs text-slate-500">Total Nilai</p>
                      <p className="mt-1 text-2xl font-semibold text-slate-900">
                        {selectedSummary.totalScore ?? "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Rata-rata tersedia</p>
                      <p className="mt-1 text-2xl font-semibold text-slate-900">
                        {selectedSummary.finalAverage ?? "-"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                  {[
                    { key: "tugas", label: "Tugas", value: selectedSummary.taskAverage },
                    ...getAcademicScoreKeys(selectedSummary.scheme).map((scoreKey) => ({
                      key: scoreKey,
                      label: ACADEMIC_SCORE_LABELS[scoreKey],
                      value: selectedSummary.scores[scoreKey],
                    })),
                  ].map((score) => (
                    <div key={score.key} className="border border-slate-100 bg-slate-50 p-4">
                      <p className="text-xs font-medium text-slate-500">{score.label}</p>
                      <p className="mt-2 text-xl font-semibold text-slate-900">
                        {score.value ?? "-"}
                      </p>
                    </div>
                  ))}
                </div>

                {selectedSummary.note ? (
                  <p className="mt-4 border-l-2 border-orange-300 pl-3 text-sm leading-6 text-slate-600">
                    {selectedSummary.note}
                  </p>
                ) : null}
              </section>

              <section className="overflow-hidden rounded-[26px] border border-slate-100 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-5 md:px-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-600">
                    Tugas Belajar
                  </p>
                  <h2 className="mt-2 text-lg font-semibold text-slate-800">
                    Detail Nilai Tugas - {selectedSummary.subject}
                  </h2>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px] text-left text-sm text-slate-600">
                    <thead className="bg-slate-50/50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="w-1/3 px-6 py-4 font-semibold">Tugas</th>
                        <th className="px-6 py-4 font-semibold">Pertemuan</th>
                        <th className="px-6 py-4 font-semibold">Status</th>
                        <th className="px-6 py-4 text-center font-semibold">
                          Nilai Akhir
                        </th>
                        <th className="px-6 py-4 font-semibold">Catatan Guru</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedTasks.map((task) => (
                        <tr
                          key={task.id}
                          className="transition-colors hover:bg-slate-50/50"
                        >
                          <td className="px-6 py-4">
                            <Link
                              href={task.detailHref}
                              className="font-semibold text-slate-800 transition hover:text-orange-600"
                            >
                              {task.judul}
                            </Link>
                            <p className="mt-1 line-clamp-1 text-xs text-slate-500">
                              {task.deskripsi}
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-xs text-slate-500">
                              Pertemuan {task.pertemuan}
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getGradeStatusClass(
                                task.myGrade?.status || "Belum Dinilai",
                              )}`}
                            >
                              {task.myGrade?.status || "Belum Dinilai"}
                            </span>
                            {task.myGrade?.gradedAt && (
                              <p className="mt-1.5 text-xs text-slate-500">
                                {formatGradedTime(task.myGrade.gradedAt)}
                              </p>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span
                              className={`inline-flex h-10 min-w-[3rem] items-center justify-center rounded-xl border font-bold ${
                                task.myGrade?.graded
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-slate-100 bg-slate-50 text-slate-400"
                              }`}
                            >
                              {task.myGrade?.score ?? "-"}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="line-clamp-3 text-xs leading-5 text-slate-600">
                              {task.myGrade?.note || "-"}
                            </p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
        </>
      )}
    </section>
  );
}
