import LandingAboutBenefitGrid from "@/components/landing/sections/LandingAboutBenefitGrid";

export default function LandingAbout() {
  return (
    <section id="about" className="scroll-mt-28 py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="group relative mx-auto max-w-3xl text-center">
          <div className="pointer-events-none absolute inset-x-10 -top-3 h-24 rounded-full bg-[radial-gradient(circle,rgba(251,146,60,0.18),rgba(255,255,255,0))] blur-3xl transition duration-500 group-hover:scale-105 group-hover:opacity-100" />

          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl lg:text-[2.9rem] lg:leading-[1.08]">
            <span className="inline-block transition duration-300 group-hover:-translate-y-0.5">
              Tentang&nbsp;
            </span>
            <span className="relative inline-block bg-[linear-gradient(135deg,#f97316_0%,#f59e0b_100%)] bg-clip-text text-transparent">
              Kami
              <span className="absolute -bottom-2 left-1/2 h-1.5 w-20 -translate-x-1/2 rounded-full bg-[linear-gradient(90deg,rgba(249,115,22,0.95),rgba(245,158,11,0.45))] transition-all duration-300 group-hover:w-full" />
            </span>
          </h2>

          <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">
            Bina Cendekia adalah bimbingan belajar yang mendampingi siswa
            dengan suasana belajar yang hangat, program yang terarah, serta fasilitas modern untuk membantu siswa meraih prestasi akademik terbaik mereka.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <LandingAboutBenefitGrid />
        </div>
      </div>
    </section>
  );
}
