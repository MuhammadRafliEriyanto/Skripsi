import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CirclePlay } from "lucide-react";

export default function LandingHeroSection() {
  return (
    <section
      id="home"
      className="group/hero relative isolate scroll-mt-28 overflow-hidden pb-10 pt-2 lg:pb-16 lg:pt-4"
    >
      <div className="absolute inset-0 overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1759922378123-a1f4f1e39bae?auto=format&fit=crop&fm=jpg&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&ixlib=rb-4.1.0&q=60&w=3000"
          alt=""
          fill
          preload
          sizes="100vw"
          className="scale-[1.08] object-cover object-[center_30%] opacity-96 blur-[1.5px] saturate-[0.88] brightness-[0.8] contrast-[1.04] transition-all duration-700 ease-out group-hover/hero:scale-[1.1] group-hover/hero:opacity-100 group-hover/hero:blur-[1px]"
        />
        <div className="absolute inset-0 bg-slate-950/34 backdrop-blur-[1.5px]" />
        <div className="absolute -left-10 top-12 size-44 rounded-full bg-orange-500/8 blur-3xl transition-transform duration-700 ease-out group-hover/hero:translate-x-2 group-hover/hero:-translate-y-2" />
        <div className="absolute -right-10 top-10 size-56 rounded-full bg-amber-400/8 blur-3xl transition-transform duration-700 ease-out group-hover/hero:-translate-x-3 group-hover/hero:translate-y-2" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),rgba(15,23,42,0.04)_28%,rgba(15,23,42,0.16)_62%,rgba(15,23,42,0.3)_100%)]" />
        <div className="absolute inset-x-0 top-0 h-28 bg-[linear-gradient(180deg,rgba(15,23,42,0.14),rgba(15,23,42,0))]" />
        <div className="absolute inset-x-0 bottom-0 h-52 bg-[linear-gradient(180deg,rgba(15,23,42,0),rgba(15,23,42,0.18)_58%,rgba(15,23,42,0.34)_100%)]" />
      </div>

      <div className="relative px-5 pb-12 pt-8 sm:px-8 lg:px-12 lg:pb-16 lg:pt-10">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="mt-7 text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-[4.25rem] lg:leading-[1.02]">
            Tingkatkan
            <span className="mx-3 inline-block">Potensimu,</span>
            <span className="relative inline-block bg-[linear-gradient(135deg,#f97316_0%,#f59e0b_100%)] bg-clip-text text-transparent">
              Raih Prestasimu
              <span className="absolute -bottom-2 left-0 h-1.5 w-full rounded-full bg-[linear-gradient(90deg,rgba(251,146,60,0.82),rgba(245,158,11,0.4))]" />
            </span>
          </h1>

          <p className="mx-auto mt-8 max-w-3xl text-base leading-8 text-white/78 sm:text-lg">
            Akses program bimbingan belajar untuk siswa SD sampai SMA dengan
            fasilitas belajar modern, tutor berpengalaman, dan materi yang disesuaikan
            dengan kurikulum sekolah untuk membantumu meraih prestasi terbaik.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#f97316_0%,#ea580c_100%)] px-7 text-sm font-semibold text-white shadow-[0_24px_36px_-24px_rgba(249,115,22,0.4)] transition hover:-translate-y-px hover:brightness-105"
            >
              Mulai Daftar Online
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="#about"
              className="inline-flex h-14 items-center justify-center gap-2 rounded-full border border-white/18 bg-white/10 px-7 text-sm font-semibold text-white shadow-[0_18px_28px_-24px_rgba(15,23,42,0.34)] transition hover:-translate-y-px hover:border-white/28 hover:bg-white/16 hover:text-white"
            >
              <CirclePlay className="size-4 text-orange-300" />
              Kenali Bina Cendekia
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
