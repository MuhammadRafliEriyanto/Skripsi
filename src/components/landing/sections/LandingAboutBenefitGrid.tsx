"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useSyncExternalStore } from "react";

import { landingBenefits } from "@/components/landing/landing-page-data";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const aboutCardMeta = [
  {
    accent: "from-orange-500 to-amber-400",
    chip: "Metode Belajar",
    title: "Pendekatan belajar yang lebih personal dan menyenangkan.",
    detail:
      "Bina Cendekia membangun suasana bimbel yang terasa dekat, hangat, dan interaktif agar siswa lebih termotivasi belajar dan orang tua tenang memantau progresnya.",
    points: [
      "Pendampingan akrab oleh tutor berpengalaman agar siswa tidak cepat merasa tertekan.",
      "Laporan perkembangan belajar yang mudah diakses oleh siswa maupun orang tua.",
      "Materi disesuaikan dengan ritme pemahaman masing-masing siswa.",
    ],
    primaryHref: "#program",
    primaryLabel: "Lihat Program",
    secondaryHref: "/register",
    secondaryLabel: "Daftar Online",
  },
  {
    accent: "from-rose-500 to-orange-500",
    chip: "Fokus Akademik",
    title: "Materi belajar yang terstruktur sesuai dengan kurikulum sekolah.",
    detail:
      "Kami memastikan materi bimbingan relevan dengan pelajaran di sekolah. Mulai dari pemahaman dasar hingga soal-soal tingkat lanjut, semua dipandu dengan cara yang mudah dimengerti.",
    points: [
      "Persiapan lengkap untuk SD, SMP, SMA, dan UTBK.",
      "Fokus pada penguasaan konsep, bukan sekadar menghafal rumus.",
      "Latihan soal terarah untuk membantu siswa meraih nilai maksimal di ujian.",
    ],
    primaryHref: "#program",
    primaryLabel: "Lihat Detail Program",
    secondaryHref: "#paket",
    secondaryLabel: "Lihat Paket",
  },
  {
    accent: "from-amber-500 to-orange-500",
    chip: "Akses Belajar",
    title: "Fasilitas lengkap untuk mendukung proses belajarmu dari mana saja.",
    detail:
      "Dapatkan akses materi dan jadwal belajar secara online dengan mudah. Platform ini dirancang untuk memudahkanmu mengatur waktu belajar dan mengevaluasi hasil tryout.",
    points: [
      "Lihat jadwal kelas dan daftar kelas tambahan langsung dari akunmu.",
      "Akses modul pembelajaran dan kerjakan tryout langsung dari genggaman.",
      "Kemudahan memantau kehadiran dan histori belajar bagi orang tua.",
    ],
    primaryHref: "#pendaftaran",
    primaryLabel: "Lihat Alur Daftar",
    secondaryHref: "/register",
    secondaryLabel: "Mulai Daftar",
  },
  {
    accent: "from-orange-500 to-yellow-400",
    chip: "Evaluasi Berkala",
    title: "Pantau prestasimu dengan laporan evaluasi yang komprehensif.",
    detail:
      "Setiap langkah belajarmu sangat berarti. Kami menyediakan sesi evaluasi rutin untuk memastikan kamu terus berkembang dan siap menghadapi setiap ujian.",
    points: [
      "Tryout berkala untuk mengukur pemahaman materi.",
      "Sesi konsultasi dengan tutor jika merasa kesulitan dalam belajar.",
      "Rapor evaluasi digital yang bisa dilihat kapan saja.",
    ],
    primaryHref: "#paket",
    primaryLabel: "Lihat Paket",
    secondaryHref: "#home",
    secondaryLabel: "Kembali ke Atas",
  },
] as const;

function getCardClassName(index: number) {
  return [
    "relative h-full overflow-hidden border-orange-100/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,252,248,0.96))] transition-all duration-300 hover:-translate-y-1.5 hover:border-orange-200 hover:shadow-[0_28px_42px_-30px_rgba(249,115,22,0.22)]",
    index === 1
      ? "md:-translate-y-2 border-orange-200/80 shadow-[0_22px_36px_-30px_rgba(249,115,22,0.16)]"
      : "",
  ]
    .join(" ")
    .trim();
}

function AboutBenefitCard({
  index,
}: {
  index: number;
}) {
  const item = landingBenefits[index];
  const Icon = item.icon;
  const meta = aboutCardMeta[index];

  return (
    <Card className={getCardClassName(index)}>
      <div
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r opacity-80 transition-opacity duration-300 group-hover:opacity-100 ${meta.accent}`}
      />

      <CardContent className="flex h-full flex-col px-6 py-6">
        <div className="flex items-start">
          <div
            className={`flex size-12 items-center justify-center rounded-[20px] bg-gradient-to-br text-white shadow-[0_16px_24px_-18px_rgba(249,115,22,0.38)] transition-transform duration-300 group-hover:scale-105 ${meta.accent}`}
          >
            <Icon className="size-5" />
          </div>
        </div>

        <h3 className="mt-5 text-lg font-semibold tracking-tight text-slate-950">
          {item.title}
        </h3>
        <p className="mt-3 flex-1 text-sm leading-7 text-slate-600">
          {item.description}
        </p>

        <div className="mt-6 flex items-center justify-between border-t border-orange-100/80 pt-4 text-sm font-semibold text-slate-500 transition group-hover:text-orange-700">
          <span>Lihat lebih lanjut</span>
          <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
        </div>
      </CardContent>
    </Card>
  );
}

function StaticGrid() {
  return (
    <>
      {landingBenefits.map((item, index) => (
        <div key={item.title} className="group block h-full w-full text-left">
          <AboutBenefitCard index={index} />
        </div>
      ))}
    </>
  );
}

function InteractiveGrid() {
  return (
    <>
      {landingBenefits.map((item, index) => {
        const meta = aboutCardMeta[index];

        return (
          <Dialog key={item.title}>
            <DialogTrigger asChild>
              <button
                type="button"
                className="group block h-full w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2"
              >
                <AboutBenefitCard index={index} />
              </button>
            </DialogTrigger>

            <DialogContent className="max-w-3xl border-orange-100/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,249,244,0.97))] p-0">
              <div className="relative overflow-hidden rounded-[32px]">
                <div className="pointer-events-none absolute inset-0">
                  <div
                    className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${meta.accent}`}
                  />
                  <div className="absolute -left-10 top-0 size-44 rounded-full bg-orange-100/60 blur-3xl" />
                  <div className="absolute right-0 top-0 size-52 rounded-full bg-amber-100/50 blur-3xl" />
                </div>

                <div className="relative p-6 sm:p-8">
                  <DialogHeader>
                    <span className="inline-flex w-fit items-center rounded-full border border-orange-100 bg-orange-50/90 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-600">
                      {meta.chip}
                    </span>
                    <DialogTitle className="mt-4 max-w-2xl text-2xl leading-tight sm:text-[2rem]">
                      {meta.title}
                    </DialogTitle>
                    <DialogDescription className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                      {meta.detail}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="mt-6 grid gap-3">
                    {meta.points.map((point) => (
                      <div
                        key={point}
                        className="rounded-[22px] border border-orange-100/80 bg-white/88 px-4 py-4 text-sm leading-6 text-slate-600 shadow-[0_18px_32px_-30px_rgba(15,23,42,0.14)]"
                      >
                        {point}
                      </div>
                    ))}
                  </div>

                  <DialogFooter className="mt-7 border-t border-orange-100/80 pt-5">
                    <DialogClose asChild>
                      <Link
                        href={meta.secondaryHref}
                        className="inline-flex h-11 items-center justify-center rounded-full border border-orange-100/80 bg-white px-5 text-sm font-semibold text-slate-700 transition duration-300 hover:-translate-y-px hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                      >
                        {meta.secondaryLabel}
                      </Link>
                    </DialogClose>
                    <DialogClose asChild>
                      <Link
                        href={meta.primaryHref}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#b91c1c_0%,#ea580c_100%)] px-5 text-sm font-semibold text-white shadow-[0_22px_34px_-24px_rgba(185,28,28,0.38)] transition duration-300 hover:-translate-y-px hover:brightness-105"
                      >
                        {meta.primaryLabel}
                        <ArrowRight className="size-4" />
                      </Link>
                    </DialogClose>
                  </DialogFooter>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        );
      })}
    </>
  );
}

export default function LandingAboutBenefitGrid() {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  return mounted ? <InteractiveGrid /> : <StaticGrid />;
}
