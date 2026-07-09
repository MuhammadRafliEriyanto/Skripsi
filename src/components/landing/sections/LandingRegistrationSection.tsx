import Link from "next/link";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";

import { landingSteps } from "@/components/landing/landing-page-data";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const registrationChecklist = [
  "Nama siswa, email, program, dan kelas.",
  "Pilihan program dan kelas yang sesuai dengan jenjang.",
  "Paket membership 1 semester atau 2 semester.",
  "Konfirmasi pembayaran sebelum akses dashboard dibuka.",
] as const;

const registrationIntroPoints = [
  "Isi data siswa dan kontak aktif untuk membuat akun.",
  "Pilih program, kelas, dan paket membership yang paling sesuai.",
  "Verifikasi email dan tunggu konfirmasi pembayaran agar akses aktif.",
] as const;

const registrationStepMeta = [
  {
    chip: "Mulai dari data inti",
    helper: "Siapkan identitas siswa dan kontak aktif agar proses daftar bisa lanjut tanpa hambatan.",
  },
  {
    chip: "Tentukan arah belajar",
    helper: "Program dan membership dipilih sejak awal supaya ritme belajar terasa lebih pasti.",
  },
  {
    chip: "Verifikasi lalu aktif",
    helper: "Email diverifikasi lebih dulu, lalu akses dashboard dibuka setelah payment berstatus paid.",
  },
] as const;

const registrationFlowChips = [
  "Buat akun siswa",
  "Pilih program",
  "Pilih membership",
  "Verifikasi email",
] as const;

export default function LandingRegistrationSection() {
  return (
    <section id="pendaftaran" className="scroll-mt-28 py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-start">
          <div className="lg:sticky lg:top-28">
            <h2 className="max-w-3xl font-semibold tracking-tight text-slate-950">
              <span className="block text-4xl leading-[1.02] sm:text-5xl lg:text-[3.8rem]">
                Gimana cara daftar
              </span>
              <span className="mt-2 block bg-[linear-gradient(135deg,#9f1239_0%,#ea580c_60%,#f59e0b_100%)] bg-clip-text text-[2.2rem] leading-[1.02] text-transparent sm:text-[2.8rem] lg:text-[3.1rem]">
                di Bina Cendekia?
              </span>
            </h2>

            <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
              Semua proses pendaftaran dilakukan online. Siapkan data dirimu dan ikuti langkah mudah berikut untuk menjadi bagian dari Bina Cendekia.
            </p>

            <div className="mt-6 space-y-3">
              {registrationIntroPoints.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-[22px] border border-orange-100/80 bg-white/88 px-4 py-4 text-sm leading-6 text-slate-600 shadow-[0_18px_34px_-30px_rgba(15,23,42,0.18)]"
                >
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-600">
                    <CheckCircle2 className="size-4" />
                  </span>
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-[28px] border border-orange-100/80 bg-[linear-gradient(180deg,rgba(255,249,244,0.98),rgba(255,255,255,0.98))] p-5 shadow-[0_24px_44px_-36px_rgba(249,115,22,0.18)]">
              <div className="flex items-start gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,#be123c_0%,#ea580c_100%)] text-white shadow-[0_18px_28px_-22px_rgba(190,24,93,0.34)]">
                  <ShieldCheck className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-950">Akses belajar baru aktif setelah aman</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Setelah email diverifikasi dan pembayaran dikonfirmasi, dashboard siswa akan
                    terbuka mengikuti status membership.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {registrationFlowChips.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center rounded-full border border-orange-100 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-600"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row flex-wrap gap-3">
              <Link
                href="/register"
                className="group w-full sm:w-auto inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#b91c1c_0%,#ea580c_100%)] px-6 text-sm font-semibold text-white shadow-[0_22px_34px_-24px_rgba(185,28,28,0.38)] transition duration-300 hover:-translate-y-px hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2"
              >
                Mulai Pendaftaran
                <ArrowRight className="size-4 transition duration-300 group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto inline-flex h-12 items-center justify-center rounded-full border border-orange-100/80 bg-white px-6 text-sm font-semibold text-slate-700 transition duration-300 hover:-translate-y-px hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2"
              >
                Sudah punya akun
              </Link>
            </div>
          </div>

          <div className="space-y-6">
            <Card className="overflow-hidden border-orange-100/80 bg-[linear-gradient(180deg,rgba(255,248,242,0.98),rgba(255,255,255,0.98))] shadow-[0_30px_70px_-50px_rgba(249,115,22,0.2)]">
              <CardHeader className="p-7 sm:p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                  Syarat yang dibutuhkan
                </p>
                <CardTitle className="mt-4 text-2xl leading-tight sm:text-[2rem]">
                  Siapkan beberapa data ini sebelum mulai daftar.
                </CardTitle>
                <CardDescription className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
                  Kalau data utama sudah siap, proses pendaftaran akan terasa lebih cepat dan tidak
                  membingungkan di tengah jalan.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3 px-7 pb-7 sm:px-8">
                {registrationChecklist.map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-[22px] border border-orange-100/80 bg-white/92 px-4 py-4 text-sm leading-6 text-slate-600 shadow-[0_18px_32px_-30px_rgba(15,23,42,0.16)] transition-all duration-300 hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-[0_24px_40px_-32px_rgba(249,115,22,0.18)]"
                  >
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-600">
                      <CheckCircle2 className="size-4" />
                    </span>
                    <span>{item}</span>
                  </div>
                ))}

                <div className="rounded-[24px] border border-dashed border-orange-200/80 bg-orange-50/70 px-5 py-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-500">
                    Ringkasan flow
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Buat akun siswa, pilih paket, verifikasi email, lalu akses belajar aktif saat
                    pembayaran sudah berstatus paid.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-orange-100/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,251,246,0.96))] shadow-[0_30px_70px_-50px_rgba(15,23,42,0.18)]">
              <CardHeader className="p-7 sm:p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-500">
                  Langkah-langkah
                </p>
                <CardTitle className="mt-4 text-2xl leading-tight sm:text-[2rem]">
                  Ikuti alurnya dari atas ke bawah.
                </CardTitle>
                <CardDescription className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
                  Semua proses dilakukan online, jadi calon siswa cukup mengikuti urutan berikut
                  sampai akses belajar aktif.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 px-7 pb-7 sm:px-8">
                {landingSteps.map((item, index) => {
                  const Icon = item.icon;
                  const stepMeta =
                    registrationStepMeta[index] ??
                    registrationStepMeta[registrationStepMeta.length - 1];

                  return (
                    <div
                      key={item.title}
                      className="group rounded-[26px] border border-orange-100/80 bg-white/92 p-5 shadow-[0_20px_36px_-30px_rgba(15,23,42,0.14)] transition-all duration-300 hover:-translate-y-1 hover:border-orange-200 hover:shadow-[0_28px_44px_-30px_rgba(249,115,22,0.2)]"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-5">
                        {/* Header for Mobile (Icon + Number) */}
                        <div className="flex items-center gap-3 sm:hidden">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-orange-50 text-xs font-semibold text-orange-600">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-[16px] bg-[linear-gradient(135deg,#be123c_0%,#ea580c_100%)] text-white shadow-[0_18px_28px_-22px_rgba(190,24,93,0.32)]">
                            <Icon className="size-4" />
                          </div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-500 ml-1">
                            {stepMeta.chip}
                          </p>
                        </div>

                        {/* Desktop Side Icons */}
                        <div className="hidden sm:flex flex-col items-center">
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-orange-50 text-sm font-semibold text-orange-600">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          {index < landingSteps.length - 1 ? (
                            <span className="mt-2 h-12 w-px bg-[linear-gradient(180deg,rgba(249,115,22,0.28),rgba(249,115,22,0))]" />
                          ) : null}
                        </div>

                        <div className="hidden sm:flex size-12 shrink-0 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,#be123c_0%,#ea580c_100%)] text-white shadow-[0_18px_28px_-22px_rgba(190,24,93,0.32)] transition duration-300 group-hover:scale-105">
                          <Icon className="size-5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="hidden sm:block text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-500">
                            {stepMeta.chip}
                          </p>
                          <h3 className="mt-1 sm:mt-2 text-lg font-semibold tracking-tight text-slate-950 sm:text-[1.3rem]">
                            {item.title}
                          </h3>
                          <p className="mt-2 text-sm leading-7 text-slate-600">{item.description}</p>
                          <p className="mt-3 rounded-[18px] bg-orange-50/70 px-4 py-3 text-sm leading-6 text-slate-600">
                            {stepMeta.helper}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
