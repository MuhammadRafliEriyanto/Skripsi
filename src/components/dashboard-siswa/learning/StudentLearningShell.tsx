import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";

import StudentLearningNav from "./StudentLearningNav";

type StudentLearningShellProps = {
  title: string;
  description: string;
  summary: string;
  isUtbkStudent?: boolean;
  isNavigationLoading?: boolean;
  children: ReactNode;
};

export default function StudentLearningShell({
  title,
  description,
  summary,
  isUtbkStudent = false,
  isNavigationLoading = false,
  children,
}: StudentLearningShellProps) {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <div className="space-y-5">
        <div className="overflow-hidden rounded-[28px] border border-orange-100/90 bg-white shadow-[0_18px_40px_-34px_rgba(15,23,42,0.2),0_12px_24px_-22px_rgba(249,115,22,0.12)]">
          <div className="bg-[linear-gradient(135deg,rgba(255,247,237,0.96),rgba(255,255,255,1))] px-5 py-5 md:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 text-orange-600">
                  <Sparkles className="h-4 w-4" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">
                    Area Pembelajaran
                  </span>
                </div>
                <h1 className="mt-2 text-xl font-semibold text-slate-800 md:text-2xl">
                  {title}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                  {description}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700">
                  {summary}
                </span>
                <Link
                  href="/dashboard-siswa"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-orange-200 bg-white px-4 py-2 text-xs font-semibold text-orange-700 transition hover:bg-orange-50"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Kembali ke Dashboard
                </Link>
              </div>
            </div>

            <div className="mt-5">
              {isNavigationLoading ? (
                <div className="h-12 rounded-[20px] bg-orange-50/80 ring-1 ring-orange-100/80">
                  <span className="sr-only">Memuat navigasi pembelajaran...</span>
                </div>
              ) : (
                <StudentLearningNav isUtbkStudent={isUtbkStudent} />
              )}
            </div>
          </div>
        </div>

        {children}
      </div>
    </section>
  );
}
