import { GraduationCap } from "lucide-react";

export function AppLogo() {
  return (
    <div className="flex h-[72px] items-center gap-3 px-4 lg:px-6">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-400 text-white shadow-lg shadow-orange-500/20">
        <GraduationCap className="size-5" />
      </div>

      <div className="min-w-0 leading-none">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-orange-600">
          Bimbel LMS
        </p>
        <h1 className="mt-1 text-sm font-semibold text-slate-950">
          Bina Cendekia
        </h1>
      </div>
    </div>
  );
}
