"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  GraduationCap,
  NotebookPen,
  Target,
} from "lucide-react";

type LandingProgramItem = {
  id: string;
  label: string;
  tabDescription: string;
  tabHint: string;
  imageSrc: string;
  imageAlt: string;
  title: string;
  description: string;
  focusTags: string[];
  highlights: string[];
  noteTitle: string;
  note: string;
  statLabel: string;
  statValue: string;
  statCaption: string;
  imagePosition: string;
  imageOverlay: string;
  surfaceAccent: string;
  iconAccent: string;
  icon: LucideIcon;
};

const landingProgramItems: LandingProgramItem[] = [
  {
    id: "sd",
    label: "SD Kelas 4-6",
    tabDescription: "Fondasi belajar yang hangat dan bertahap.",
    tabHint: "Belajar lebih tenang",
    imageSrc:
      "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Siswa sedang belajar bersama di kelas.",
    title: "Bangun kebiasaan belajar yang rapi sejak kelas 4 sampai 6.",
    description:
      "Program SD membantu siswa memahami materi inti dengan ritme yang lebih tenang, suasana yang ramah anak, dan pendampingan yang membuat orang tua lebih mudah mengikuti progresnya.",
    focusTags: ["Matematika Dasar", "IPA", "Bahasa Indonesia"],
    highlights: [
      "Materi dibuat bertahap agar siswa lebih percaya diri memahami konsep inti.",
      "Pendampingan terasa hangat sehingga anak lebih nyaman membangun ritme belajar.",
      "Progress belajar lebih mudah dipantau oleh orang tua sejak awal program.",
    ],
    noteTitle: "Cocok untuk siswa yang mulai butuh arah belajar lebih konsisten.",
    note: "Fokus utamanya bukan hanya nilai, tetapi juga membangun dasar, kebiasaan, dan rasa nyaman saat belajar.",
    statLabel: "Pendekatan utama",
    statValue: "Step by step",
    statCaption: "Belajar lebih terarah dan tidak tergesa-gesa.",
    imagePosition: "object-[center_34%]",
    imageOverlay:
      "from-slate-950/12 via-white/12 to-white/42",
    surfaceAccent:
      "from-orange-100/90 via-amber-50/85 to-sky-50/80",
    iconAccent:
      "bg-[linear-gradient(135deg,#f97316_0%,#fb923c_100%)] text-white",
    icon: BookOpenCheck,
  },
  {
    id: "smp",
    label: "SMP Kelas 7-9",
    tabDescription: "Jaga ritme belajar di masa transisi yang lebih aktif.",
    tabHint: "Ritme makin stabil",
    imageSrc:
      "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Sekelompok siswa berdiskusi sambil belajar bersama.",
    title: "Temani siswa SMP menjaga ritme belajar agar tetap stabil dan percaya diri.",
    description:
      "Program SMP disusun untuk membantu siswa menghadapi materi yang mulai lebih padat dengan pendampingan yang tetap ringan, terarah, dan tidak membuat proses belajar terasa menekan.",
    focusTags: ["Matematika", "IPA", "Bahasa Inggris"],
    highlights: [
      "Pendekatan belajar dibuat lebih aktif agar siswa tidak cepat kehilangan momentum.",
      "Materi inti dipetakan lebih jelas supaya target harian terasa lebih realistis.",
      "Pendampingan membantu siswa menjaga pemahaman sekaligus disiplin belajar.",
    ],
    noteTitle: "Pas untuk fase ketika siswa mulai butuh struktur tanpa kehilangan semangat.",
    note: "Arah belajar dibuat jelas, tetapi tetap fleksibel mengikuti karakter dan kesiapan siswa di tiap kelas.",
    statLabel: "Fokus pendampingan",
    statValue: "Stabil & aktif",
    statCaption: "Menjaga ritme belajar tetap hidup setiap pekan.",
    imagePosition: "object-[center_40%]",
    imageOverlay:
      "from-slate-950/16 via-white/10 to-white/38",
    surfaceAccent:
      "from-rose-100/90 via-orange-50/85 to-white/88",
    iconAccent:
      "bg-[linear-gradient(135deg,#f97316_0%,#ea580c_100%)] text-white",
    icon: NotebookPen,
  },
  {
    id: "sma",
    label: "SMA Kelas 10-12",
    tabDescription: "Struktur materi yang lebih siap mengarah ke target akademik.",
    tabHint: "Target lebih terukur",
    imageSrc:
      "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Siswi sedang belajar mandiri dengan fokus.",
    title: "Program SMA yang lebih terstruktur untuk menjaga target dan kesiapan akademik.",
    description:
      "Untuk jenjang SMA, pendampingan dibuat lebih fokus agar siswa tetap punya ritme belajar yang kuat, pemahaman materi yang tertata, dan arah yang lebih jelas menuju ujian sekolah maupun rencana lanjut.",
    focusTags: ["Mapel Peminatan", "Pendalaman Konsep", "Latihan Terarah"],
    highlights: [
      "Belajar dibuat lebih sistematis agar siswa tidak mudah kewalahan saat materi menumpuk.",
      "Pendalaman konsep membantu siswa menjaga kualitas pemahaman, bukan sekadar hafalan.",
      "Program tetap terasa personal sehingga target belajar lebih realistis untuk dijalankan.",
    ],
    noteTitle: "Dirancang untuk siswa yang butuh arah belajar lebih matang menjelang ujian.",
    note: "Pendampingan menjaga fokus, ritme, dan konsistensi siswa tanpa membuat prosesnya terasa terlalu kaku.",
    statLabel: "Gaya belajar",
    statValue: "Lebih terukur",
    statCaption: "Target dibawa bertahap sampai hasilnya terasa.",
    imagePosition: "object-[center_44%]",
    imageOverlay:
      "from-slate-950/18 via-white/8 to-white/34",
    surfaceAccent:
      "from-amber-100/88 via-white/86 to-orange-50/84",
    iconAccent:
      "bg-[linear-gradient(135deg,#fb923c_0%,#f59e0b_100%)] text-white",
    icon: GraduationCap,
  },
  {
    id: "utbk",
    label: "Program UTBK",
    tabDescription: "Pendampingan intens untuk target kampus dan skor.",
    tabHint: "Fokus menuju PTN",
    imageSrc:
      "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Siswa belajar bersama untuk persiapan ujian masuk perguruan tinggi.",
    title: "Persiapan UTBK yang lebih fokus, intens, dan dekat dengan target kampus.",
    description:
      "Program UTBK membantu siswa belajar dengan arah yang lebih tajam melalui latihan terukur, pembahasan yang lebih strategis, dan pendampingan yang menjaga fokus sampai menjelang tes.",
    focusTags: ["Tryout Terarah", "Strategi Pengerjaan", "Review Intensif"],
    highlights: [
      "Latihan dan evaluasi dibuat lebih fokus agar progres terasa dari minggu ke minggu.",
      "Pembahasan membantu siswa memahami pola soal sekaligus strategi pengerjaan.",
      "Program cocok untuk siswa yang ingin belajar lebih intens menuju target PTN.",
    ],
    noteTitle: "Pilihan pas untuk fase persiapan yang menuntut fokus dan konsistensi tinggi.",
    note: "Arah belajar disusun supaya siswa tidak hanya banyak berlatih, tetapi juga tahu bagian mana yang harus diprioritaskan.",
    statLabel: "Mode persiapan",
    statValue: "Intens & fokus",
    statCaption: "Lebih siap menghadapi soal dan tekanan waktu.",
    imagePosition: "object-[center_48%]",
    imageOverlay:
      "from-slate-950/22 via-white/8 to-white/32",
    surfaceAccent:
      "from-orange-100/88 via-amber-50/84 to-rose-50/84",
    iconAccent:
      "bg-[linear-gradient(135deg,#ea580c_0%,#f59e0b_100%)] text-white",
    icon: Target,
  },
];

export default function LandingEventsSection() {
  const [activeProgramId, setActiveProgramId] = useState(landingProgramItems[0].id);

  const activeProgram =
    landingProgramItems.find((item) => item.id === activeProgramId) ?? landingProgramItems[0];
  const ActiveIcon = activeProgram.icon;

  return (
    <section id="program" className="scroll-mt-28 py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="group relative mx-auto max-w-3xl text-center">
          <div className="pointer-events-none absolute inset-x-10 -top-3 h-24 rounded-full bg-[radial-gradient(circle,rgba(251,146,60,0.18),rgba(255,255,255,0))] blur-3xl transition duration-500 group-hover:scale-105 group-hover:opacity-100" />

          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl lg:text-[2.9rem] lg:leading-[1.08]">
            <span className="inline-block transition duration-300 group-hover:-translate-y-0.5">
              Program&nbsp;
            </span>
            <span className="relative inline-block bg-[linear-gradient(135deg,#f97316_0%,#f59e0b_100%)] bg-clip-text text-transparent">
              Kami
              <span className="absolute -bottom-2 left-1/2 h-1.5 w-20 -translate-x-1/2 rounded-full bg-[linear-gradient(90deg,rgba(249,115,22,0.95),rgba(245,158,11,0.45))] transition-all duration-300 group-hover:w-full" />
            </span>
          </h2>

          <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">
            Pilih jenjang pendidikanmu dan temukan program belajar yang paling tepat untuk membantumu berkembang.
          </p>
        </div>

        <div className="group/program relative mt-12 overflow-hidden rounded-[34px] border border-orange-100/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(255,248,241,0.95)_48%,rgba(241,248,255,0.92))] shadow-[0_36px_90px_-54px_rgba(148,163,184,0.42)]">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-8 top-6 size-40 rounded-full bg-orange-200/40 blur-3xl" />
            <div className="absolute right-0 top-0 size-56 rounded-full bg-sky-100/60 blur-3xl" />
            <div className="absolute inset-x-0 bottom-0 h-32 bg-[linear-gradient(180deg,rgba(255,255,255,0),rgba(255,255,255,0.78))]" />
          </div>

          <div
            id="program-panel"
            role="tabpanel"
            aria-labelledby={`program-tab-${activeProgram.id}`}
            className="relative grid gap-8 px-5 py-5 sm:px-7 sm:py-7 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-10 lg:px-10 lg:py-10"
          >
            <div className="max-w-2xl">
              <div
                key={`${activeProgram.id}-content`}
                aria-live="polite"
                style={{ animation: "programFade 420ms ease-out" }}
              >
                <div className="inline-flex items-center gap-2 rounded-full border border-orange-200/80 bg-white/82 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-orange-600 shadow-[0_18px_34px_-28px_rgba(249,115,22,0.34)] backdrop-blur">
                  <span className="size-2 rounded-full bg-orange-400" />
                  {activeProgram.label}
                </div>

                <h3 className="mt-6 max-w-2xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-[2.6rem] sm:leading-[1.08]">
                  {activeProgram.title}
                </h3>

                <p className="mt-5 max-w-xl text-sm leading-7 text-slate-600 sm:text-base">
                  {activeProgram.description}
                </p>

                <div className="mt-6 flex flex-wrap gap-2.5">
                  {activeProgram.focusTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-full border border-white/70 bg-white/78 px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-[0_14px_30px_-26px_rgba(15,23,42,0.28)] backdrop-blur"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="mt-8 space-y-3">
                  {activeProgram.highlights.map((item) => (
                    <div
                      key={item}
                      className="flex items-start gap-3 rounded-[22px] border border-white/65 bg-white/58 px-4 py-3.5 text-sm leading-6 text-slate-600 backdrop-blur"
                    >
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-600">
                        <CheckCircle2 className="size-3.5" />
                      </span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link
                    href="/register"
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#f97316_0%,#ea580c_100%)] px-6 text-sm font-semibold text-white shadow-[0_24px_34px_-24px_rgba(249,115,22,0.42)] transition hover:-translate-y-px hover:brightness-105"
                  >
                    Daftar Program Ini
                    <ArrowRight className="size-4" />
                  </Link>
                  <Link
                    href="#pendaftaran"
                    className="inline-flex h-12 items-center justify-center rounded-full border border-orange-200/80 bg-white/82 px-6 text-sm font-semibold text-slate-700 transition hover:-translate-y-px hover:border-orange-300 hover:text-orange-700"
                  >
                    Lihat Alur Pendaftaran
                  </Link>
                </div>
              </div>
            </div>

            <div className="relative min-h-[380px] lg:min-h-[430px]">
              <div
                className={`absolute inset-0 rounded-[30px] bg-gradient-to-br ${activeProgram.surfaceAccent} transition-all duration-500`}
              />
              <div className="absolute inset-0 rounded-[30px] border border-white/70 bg-white/24 shadow-[0_36px_80px_-52px_rgba(148,163,184,0.42)]" />

              <div className="absolute inset-3 overflow-hidden rounded-[28px] border border-white/70 bg-white/18 shadow-[0_34px_64px_-40px_rgba(148,163,184,0.52)] sm:inset-4">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.58),rgba(255,255,255,0)_30%)]" />
                <Image
                  src={activeProgram.imageSrc}
                  alt={activeProgram.imageAlt}
                  fill
                  sizes="(max-width: 1024px) 100vw, 40vw"
                  quality={75}
                  className={`scale-[1.03] object-cover ${activeProgram.imagePosition} brightness-[0.98] saturate-[0.92] transition-all duration-700 ease-out group-hover/program:scale-[1.07] group-hover/program:saturate-100`}
                />
                <div
                  className={`absolute inset-0 bg-gradient-to-t ${activeProgram.imageOverlay} transition-all duration-500`}
                />
                <div className="absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(180deg,rgba(15,23,42,0),rgba(15,23,42,0.16)_48%,rgba(15,23,42,0.42)_100%)]" />
              </div>

              <div
                key={`${activeProgram.id}-stat`}
                style={{ animation: "programFade 420ms ease-out" }}
                className="absolute left-6 top-6 max-w-[240px] rounded-[24px] border border-white/70 bg-white/86 p-5 shadow-[0_24px_54px_-40px_rgba(15,23,42,0.34)] backdrop-blur"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {activeProgram.statLabel}
                </p>

                <div className="mt-4 flex items-end gap-3">
                  <div
                    className={`flex size-12 shrink-0 items-center justify-center rounded-[18px] shadow-[0_18px_30px_-22px_rgba(249,115,22,0.42)] ${activeProgram.iconAccent}`}
                  >
                    <ActiveIcon className="size-5" />
                  </div>

                  <div>
                    <p className="text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">
                      {activeProgram.statValue}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {activeProgram.statCaption}
                    </p>
                  </div>
                </div>
              </div>

              <div
                key={`${activeProgram.id}-program-chip`}
                style={{ animation: "programFade 420ms ease-out" }}
                className="absolute right-6 top-6 rounded-full border border-white/80 bg-white/82 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700 shadow-[0_18px_36px_-28px_rgba(15,23,42,0.28)] backdrop-blur"
              >
                Program aktif
              </div>

              <div
                key={`${activeProgram.id}-note`}
                style={{ animation: "programFade 420ms ease-out" }}
                className="absolute inset-x-6 bottom-6 rounded-[26px] border border-white/14 bg-slate-950/72 p-5 text-white shadow-[0_32px_60px_-44px_rgba(15,23,42,0.58)] backdrop-blur"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {activeProgram.focusTags.map((tag) => (
                    <span
                      key={`${activeProgram.id}-${tag}`}
                      className="inline-flex items-center rounded-full border border-white/12 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/76"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <p className="mt-4 text-base font-semibold leading-7">{activeProgram.noteTitle}</p>
                <p className="mt-2 text-sm leading-6 text-white/72">{activeProgram.note}</p>
              </div>
            </div>
          </div>

          <div className="relative border-t border-white/65 bg-white/58 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
            <div
              role="tablist"
              aria-label="Pilihan program belajar"
              className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {landingProgramItems.map((program) => {
                const Icon = program.icon;
                const isActive = program.id === activeProgram.id;
                const tabId = `program-tab-${program.id}`;

                return (
                  <button
                    key={program.id}
                    type="button"
                    role="tab"
                    id={tabId}
                    aria-controls="program-panel"
                    aria-selected={isActive}
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => setActiveProgramId(program.id)}
                    className={[
                      "group relative min-w-[244px] flex-1 overflow-hidden rounded-[24px] border px-4 py-4 text-left transition-all duration-300 sm:min-w-0",
                      isActive
                        ? "border-orange-200/90 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(255,247,237,0.98))] shadow-[0_24px_44px_-34px_rgba(249,115,22,0.44)]"
                        : "border-white/60 bg-white/38 hover:-translate-y-0.5 hover:border-orange-100 hover:bg-white/72 hover:shadow-[0_20px_36px_-34px_rgba(15,23,42,0.26)]",
                    ]
                      .join(" ")
                      .trim()}
                  >
                    <div
                      className={[
                        "absolute inset-x-4 top-0 h-1 rounded-full transition-all duration-300",
                        isActive
                          ? "bg-[linear-gradient(90deg,#f97316_0%,#f59e0b_100%)] opacity-100"
                          : "bg-[linear-gradient(90deg,#f97316_0%,#f59e0b_100%)] opacity-0 group-hover:opacity-60",
                      ]
                        .join(" ")
                        .trim()}
                    />

                    <div className="flex items-start justify-between gap-3">
                      <div
                        className={[
                          "flex size-10 items-center justify-center rounded-[16px] transition-all duration-300",
                          isActive
                            ? `${program.iconAccent} scale-105`
                            : "bg-white/86 text-slate-600 group-hover:bg-orange-50 group-hover:text-orange-600",
                        ]
                          .join(" ")
                          .trim()}
                      >
                        <Icon className="size-[18px]" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={[
                            "mt-1 size-2 rounded-full transition-colors duration-300",
                            isActive
                              ? "bg-orange-400"
                              : "bg-slate-300 group-hover:bg-orange-300",
                          ]
                            .join(" ")
                            .trim()}
                        />
                        <ArrowRight
                          className={[
                            "size-4 transition-all duration-300",
                            isActive
                              ? "translate-x-0 text-orange-500"
                              : "text-slate-300 group-hover:translate-x-0.5 group-hover:text-orange-400",
                          ]
                            .join(" ")
                            .trim()}
                        />
                      </div>
                    </div>

                    <p className="mt-4 text-base font-semibold tracking-tight text-slate-950">
                      {program.label}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{program.tabDescription}</p>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 transition-colors duration-300 group-hover:text-orange-500">
                      {program.tabHint}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes programFade {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </section>
  );
}
