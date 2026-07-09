"use client";

import { useEffect, useState, type ReactNode } from "react";

import Image from "next/image";
import { Poppins } from "next/font/google";
import {
  ArrowRight,
  CheckCircle2,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { FaGraduationCap } from "react-icons/fa6";

import { AppLogo } from "@/components/shared/app-logo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const authPoppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
});

type AuthShellProps = {
  eyebrow?: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
  variant?: "default" | "showcase" | "immersive" | "compact" | "split";
  image?: string;
  panelClassName?: string;
  bodyClassName?: string;
  splitContentAlignment?: "center" | "start";
  hideSplitVisualOnMobile?: boolean;
  hideSplitTopBadge?: boolean;
  splitContentClassName?: string;
  splitInnerClassName?: string;
  allowDesktopScroll?: boolean;
  splitPosition?: "left" | "right";
};

const authHighlights = [
  {
    icon: ShieldCheck,
    title: "Satu login, empat role",
    description: "Owner, admin, guru, dan siswa memakai pintu masuk yang sama dengan redirect otomatis.",
  },
  {
    icon: Mail,
    title: "Email verification aktif",
    description: "Akun baru harus diverifikasi dulu sebelum bisa mengakses dashboard.",
  },
  {
    icon: Sparkles,
    title: "UI tetap konsisten",
    description: "Bahasa visual mengikuti tema orange LMS yang sudah Anda bangun.",
  },
];

const splitRotatingMessages = [
  "Satu portal login untuk owner, admin, guru, dan siswa dalam satu pengalaman yang tetap rapi.",
  "Setiap role masuk lewat halaman yang sama lalu diarahkan otomatis ke dashboard yang sesuai.",
  "Kelas, jadwal, progres, dan pengelolaan belajar bisa diakses lebih cepat oleh seluruh pengguna.",
] as const;

function LoginIllustration() {
  return (
    <div className="mt-2 flex w-full justify-center">
      <div className="relative mx-auto w-full max-w-[420px]">
        <svg viewBox="0 40 500 310" className="h-auto w-full drop-shadow-xl" xmlns="http://www.w3.org/2000/svg">
          {/* Background blob */}
          <path d="M420.5 255.5C418.5 315.5 313.5 385 241.5 380C169.5 375 79 313.5 65.5 241C52 168.5 137.5 73.5 214 59.5C290.5 45.5 422.5 195.5 420.5 255.5Z" fill="#ffedd5" opacity="0.15"/>
          
          {/* Monitor Base */}
          <path d="M200 320h100v15H200z" fill="#cbd5e1" />
          <path d="M220 290h60v30h-60z" fill="#94a3b8" />
          <ellipse cx="250" cy="335" rx="70" ry="10" fill="#94a3b8" opacity="0.3" />
          
          {/* Monitor Screen */}
          <rect x="80" y="90" width="340" height="200" rx="12" fill="#334155" />
          <rect x="90" y="100" width="320" height="180" rx="6" fill="#f8fafc" />
          
          {/* App Header inside Monitor */}
          <rect x="90" y="100" width="320" height="30" rx="6" fill="#f1f5f9" />
          <circle cx="110" cy="115" r="4" fill="#cbd5e1" />
          <circle cx="125" cy="115" r="4" fill="#cbd5e1" />
          <circle cx="140" cy="115" r="4" fill="#cbd5e1" />
          
          {/* Login Form Box inside monitor */}
          <rect x="190" y="145" width="120" height="115" rx="8" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" />
          
          {/* Form inputs */}
          <rect x="205" y="165" width="90" height="12" rx="4" fill="#f1f5f9" />
          <rect x="205" y="190" width="90" height="12" rx="4" fill="#f1f5f9" />
          
          {/* Login Button */}
          <rect x="205" y="230" width="90" height="16" rx="4" fill="#ea580c" />
          
          {/* Secure Padlock Floating */}
          <g transform="translate(130, 220)">
            <circle cx="0" cy="0" r="32" fill="#fff" filter="drop-shadow(0 10px 15px rgba(0,0,0,0.1))" />
            <rect x="-12" y="-2" width="24" height="18" rx="3" fill="#fb923c" />
            <path d="M-6 -2v-5a6 6 0 0 1 12 0v5" fill="none" stroke="#fb923c" strokeWidth="4" />
            <circle cx="0" cy="8" r="3" fill="#fff" />
          </g>

          {/* User/Check Floating */}
          <g transform="translate(370, 160)">
            <circle cx="0" cy="0" r="35" fill="#fff" filter="drop-shadow(0 10px 15px rgba(0,0,0,0.1))" />
            <path d="M-10 2l6 6l14 -14" fill="none" stroke="#22c55e" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          </g>
          
          {/* Decorative lines */}
          <rect x="110" y="150" width="50" height="6" rx="3" fill="#e2e8f0" />
          <rect x="110" y="165" width="40" height="6" rx="3" fill="#e2e8f0" />
          <rect x="110" y="180" width="45" height="6" rx="3" fill="#e2e8f0" />
          
          <rect x="340" y="220" width="40" height="6" rx="3" fill="#e2e8f0" />
          <rect x="340" y="235" width="50" height="6" rx="3" fill="#e2e8f0" />
        </svg>
      </div>
    </div>
  );
}

function SplitLearningIllustration() {
  return (
    <div className="relative mx-auto w-full max-w-[500px]">
      <div className="relative overflow-hidden rounded-[34px] border border-white/18 bg-white/10 p-3 shadow-lg backdrop-blur-md sm:p-4">
        <svg
          viewBox="0 0 640 430"
          className="mx-auto w-full max-w-[430px]"
          role="img"
          aria-label="Ilustrasi siswa dan pengajar sedang belajar bersama"
        >
          <defs>
            <linearGradient id="boardGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fff7ed" />
              <stop offset="100%" stopColor="#ffedd5" />
            </linearGradient>
            <linearGradient id="deskGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#dc2626" />
            </linearGradient>
            <linearGradient id="cardGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.98" />
              <stop offset="100%" stopColor="#fffbeb" stopOpacity="0.94" />
            </linearGradient>
          </defs>

          <rect x="30" y="54" width="580" height="322" rx="42" fill="url(#cardGradient)" />
          <rect x="78" y="92" width="176" height="112" rx="28" fill="url(#boardGradient)" />
          <rect x="98" y="118" width="104" height="14" rx="7" fill="#fdba74" />
          <rect x="98" y="144" width="132" height="12" rx="6" fill="#fed7aa" />
          <rect x="98" y="166" width="82" height="12" rx="6" fill="#fde68a" />

          <rect x="382" y="88" width="162" height="52" rx="20" fill="#fff7ed" />
          <circle cx="418" cy="114" r="18" fill="#fb923c" />
          <rect x="447" y="102" width="71" height="10" rx="5" fill="#fdba74" />
          <rect x="447" y="119" width="52" height="8" rx="4" fill="#fed7aa" />

          <rect x="136" y="246" width="368" height="28" rx="14" fill="url(#deskGradient)" />
          <rect x="166" y="274" width="18" height="76" rx="9" fill="#7c2d12" />
          <rect x="452" y="274" width="18" height="76" rx="9" fill="#7c2d12" />

          <ellipse cx="220" cy="207" rx="44" ry="48" fill="#f8b36e" />
          <path d="M180 208c6-38 22-62 56-62 26 0 43 16 47 40-19-7-31-24-46-24-20 0-34 15-41 46z" fill="#2f1c14" />
          <path d="M187 255c18-24 38-34 65-34 30 0 48 8 63 30l-21 57h-85z" fill="#2563eb" />
          <rect x="236" y="221" width="14" height="30" rx="7" fill="#f8b36e" />
          <path d="M199 259c-28 11-45 37-51 70h40c5-22 16-41 29-57z" fill="#1d4ed8" />
          <path d="M284 259c28 11 46 37 51 70h-39c-6-23-17-42-30-57z" fill="#1d4ed8" />
          <rect x="197" y="328" width="24" height="17" rx="8.5" fill="#1f2937" />
          <rect x="288" y="328" width="24" height="17" rx="8.5" fill="#1f2937" />

          <ellipse cx="418" cy="197" rx="42" ry="46" fill="#f6b18a" />
          <path d="M382 197c3-34 23-56 51-56 28 0 45 16 49 39-15-10-25-18-45-18-23 0-36 13-46 35z" fill="#3f2a24" />
          <path d="M384 245c17-23 35-32 59-32 27 0 46 10 60 31l-19 60h-81z" fill="#ec4899" />
          <rect x="423" y="213" width="14" height="29" rx="7" fill="#f6b18a" />
          <path d="M392 253c-25 10-42 35-46 66h37c6-20 16-38 28-52z" fill="#db2777" />
          <path d="M490 254c22 12 38 33 44 61h-37c-7-20-17-36-30-50z" fill="#db2777" />
          <rect x="395" y="317" width="24" height="17" rx="8.5" fill="#1f2937" />
          <rect x="483" y="317" width="24" height="17" rx="8.5" fill="#1f2937" />
          <path d="M466 226l38-10 7 19-40 12z" fill="#f8b36e" />
          <rect x="503" y="199" width="10" height="40" rx="5" transform="rotate(28 503 199)" fill="#facc15" />

          <ellipse cx="320" cy="167" rx="37" ry="40" fill="#f4c29c" />
          <path d="M290 165c2-28 18-48 42-48 25 0 41 17 44 38-14-6-23-13-38-13-19 0-31 8-48 23z" fill="#42271d" />
          <path d="M284 205c16-19 31-28 55-28 25 0 39 6 53 21l-15 48h-79z" fill="#f59e0b" />
          <rect x="321" y="177" width="12" height="28" rx="6" fill="#f4c29c" />
          <path d="M276 213c-18 8-34 20-49 37l35 17c11-16 25-28 39-36z" fill="#d97706" />
          <path d="M381 214c17 8 31 18 45 34l-32 17c-10-14-22-25-35-33z" fill="#d97706" />
          <rect x="297" y="224" width="49" height="31" rx="12" fill="#1f2937" />
          <rect x="303" y="230" width="37" height="21" rx="8" fill="#334155" />

          <rect x="132" y="218" width="78" height="14" rx="7" fill="#ffffff" fillOpacity="0.75" />
          <rect x="431" y="226" width="84" height="14" rx="7" fill="#ffffff" fillOpacity="0.72" />
          <rect x="298" y="92" width="46" height="46" rx="18" fill="#fff7ed" />
          <path d="M320 104l7 14 15 2-11 11 3 15-14-8-14 8 3-15-11-11 15-2 7-14z" fill="#fb923c" />

          <rect x="92" y="302" width="72" height="22" rx="11" fill="#ffffff" fillOpacity="0.84" />
          <circle cx="112" cy="313" r="6" fill="#fb923c" />
          <rect x="124" y="308" width="24" height="10" rx="5" fill="#fdba74" />

          <rect x="496" y="286" width="84" height="22" rx="11" fill="#ffffff" fillOpacity="0.84" />
          <circle cx="518" cy="297" r="6" fill="#f97316" />
          <rect x="530" y="292" width="28" height="10" rx="5" fill="#fed7aa" />
        </svg>
      </div>
    </div>
  );
}

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
  variant = "default",
  image,
  panelClassName,
  bodyClassName,
  splitContentAlignment = "center",
  hideSplitVisualOnMobile = false,
  hideSplitTopBadge = false,
  splitContentClassName,
  splitInnerClassName,
  allowDesktopScroll = false,
  splitPosition = "left",
}: AuthShellProps) {
  const [activeSplitMessage, setActiveSplitMessage] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveSplitMessage((current) => (current + 1) % splitRotatingMessages.length);
    }, 3500);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (variant !== "split" || allowDesktopScroll) {
      return;
    }

    const htmlElement = document.documentElement;
    const bodyElement = document.body;
    const previousHtmlOverflow = htmlElement.style.overflow;
    const previousBodyOverflow = bodyElement.style.overflow;
    const mediaQuery = window.matchMedia("(min-width: 1024px)");

    const syncDesktopScrollLock = () => {
      if (mediaQuery.matches) {
        htmlElement.style.overflow = "hidden";
        bodyElement.style.overflow = "hidden";
      } else {
        htmlElement.style.overflow = previousHtmlOverflow;
        bodyElement.style.overflow = previousBodyOverflow;
      }
    };

    syncDesktopScrollLock();
    mediaQuery.addEventListener("change", syncDesktopScrollLock);

    return () => {
      mediaQuery.removeEventListener("change", syncDesktopScrollLock);
      htmlElement.style.overflow = previousHtmlOverflow;
      bodyElement.style.overflow = previousBodyOverflow;
    };
  }, [variant]);

  if (variant === "split") {
    const useImageShowcase = Boolean(image);
    const enableMobileFormOnly = hideSplitVisualOnMobile;
    const shouldShowMobileSplitBrand = !hideSplitVisualOnMobile;
    const shouldShowSplitTopRow = shouldShowMobileSplitBrand || !hideSplitTopBadge;

    return (
      <main
        className={cn(
          authPoppins.className,
          "min-h-screen bg-white w-full",
          allowDesktopScroll
            ? "lg:min-h-screen"
            : "lg:fixed lg:inset-0 lg:h-dvh lg:min-h-0 lg:overflow-hidden",
          enableMobileFormOnly && !allowDesktopScroll ? "overflow-x-hidden" : (!allowDesktopScroll && "overflow-hidden"),
        )}
      >
        <section
          className={cn(
            "grid min-h-screen w-full bg-white lg:grid-cols-[1.02fr_0.98fr]",
            allowDesktopScroll
              ? "lg:min-h-screen"
              : "lg:h-full lg:min-h-0 lg:overflow-hidden",
            enableMobileFormOnly && !allowDesktopScroll ? "overflow-visible" : (!allowDesktopScroll && "overflow-hidden"),
            panelClassName,
          )}
        >
          <div
            className={cn(
              "order-2 relative min-h-[320px] overflow-hidden",
              allowDesktopScroll
                ? "lg:sticky lg:top-0 lg:h-screen"
                : cn("lg:h-full lg:min-h-0", splitPosition === "right" ? "lg:order-2" : "lg:order-1"),
              hideSplitVisualOnMobile && "hidden lg:block",
            )}
          >
            {useImageShowcase ? (
              <>
                <Image
                  src={image!}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 52vw, 100vw"
                  fetchPriority="high"
                  className="scale-[1.02] object-cover object-center"
                />
                <div className="absolute inset-0 bg-slate-900/60" />
              </>
            ) : (
              <>
                <div className="absolute inset-0 bg-slate-50" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.8),transparent_60%)]" />
              </>
            )}

            <div className="relative flex h-full flex-col items-center justify-center lg:justify-start p-5 sm:p-7 lg:px-9 xl:px-10 lg:pt-[10vh] xl:pt-[15vh]">
              <div className="hidden lg:block w-full max-w-md text-center mb-2">
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900 xl:text-[2.2rem] xl:leading-[1.1]">
                  {title}
                </h1>
              </div>

              {!useImageShowcase ? (
                <LoginIllustration />
              ) : null}

              <div className="hidden lg:block w-full max-w-md text-center mt-6">
                <p className="text-[15px] leading-7 text-slate-600">
                  {description}
                </p>
              </div>
            </div>
          </div>

          <div
            className={cn(
              "order-1 flex min-h-full flex-col relative bg-[linear-gradient(180deg,#fffaf6_0%,#fff7ef_100%)]",
              allowDesktopScroll
                ? "lg:min-h-screen"
                : "lg:h-full lg:min-h-0 lg:overflow-hidden",
              splitPosition === "right" ? "lg:order-1" : "lg:order-2",
              enableMobileFormOnly && "min-h-screen",
            )}
          >
            {shouldShowSplitTopRow ? (
              <div
                className={cn(
                  "flex shrink-0 items-center px-5 pt-5 sm:px-7 sm:pt-7 lg:absolute lg:top-0 lg:right-0 lg:w-full lg:justify-end lg:px-10 lg:pt-8 lg:z-10",
                  shouldShowMobileSplitBrand ? "justify-between" : "justify-end",
                )}
              >
                {shouldShowMobileSplitBrand ? (
                <div className="inline-flex w-fit items-center gap-3 rounded-full bg-white px-4 py-2 text-slate-900 shadow-sm lg:hidden">
                  <div className="flex size-8 items-center justify-center rounded-full bg-orange-600 text-white">
                    <FaGraduationCap className="size-4" />
                  </div>
                  <div className="leading-none">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                      Portal Belajar
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">Bina Cendekia</p>
                  </div>
                </div>
              ) : null}

                {!hideSplitTopBadge ? (
                  <div className="inline-flex items-center rounded-full bg-orange-600 px-5 py-2 text-xs font-semibold text-white shadow-sm">
                    Sign in
                  </div>
                ) : null}
              </div>
            ) : null}

            <div
              className={cn(
                "min-h-0 px-5 pb-8 sm:px-7 lg:px-12 lg:pb-10",
                allowDesktopScroll
                  ? "lg:overflow-visible lg:h-auto"
                  : "lg:h-full lg:overflow-y-auto lg:overscroll-contain",
                enableMobileFormOnly && !allowDesktopScroll ? "overflow-visible" : (!allowDesktopScroll && "h-full overflow-y-auto overscroll-contain"),
                splitContentAlignment === "start"
                  ? cn("pt-4 lg:pt-[10vh] xl:pt-[15vh]")
                  : cn(
                      "pt-6",
                      enableMobileFormOnly
                        ? "lg:flex lg:min-h-full lg:items-start lg:pt-[10vh] xl:pt-[15vh]"
                        : "flex min-h-full items-center lg:items-start lg:pt-[10vh] xl:pt-[15vh]",
                    ),
                splitContentClassName,
              )}
            >
              <div
                className={cn(
                  "mx-auto w-full",
                  splitContentAlignment === "start" ? "max-w-[520px]" : "max-w-[430px]",
                  splitInnerClassName,
                )}
              >
                <div
                  className={cn(
                    "lg:hidden",
                    splitContentAlignment === "start"
                      ? "mb-5 sm:mb-6 lg:mb-7"
                      : "mb-7 sm:mb-8 lg:mb-9",
                  )}
                >
                  <h1 className="text-[1.78rem] leading-[1.08] font-semibold tracking-[-0.045em] text-slate-950 sm:text-[2.1rem] lg:text-[2.35rem]">
                    {title}
                  </h1>
                  <p className="mt-2.5 max-w-md text-[14px] leading-6 text-slate-500 sm:mt-3 sm:text-[15px] sm:leading-7">
                    {description}
                  </p>
                </div>

                <div className="hidden lg:block mb-6">
                  <h2 className="text-xl font-bold text-slate-900">Silakan lengkapi data berikut</h2>
                  <p className="text-sm text-slate-500 mt-1">Isi formulir di bawah ini untuk melanjutkan proses.</p>
                </div>

                <div className={cn(bodyClassName)}>{children}</div>

                {footer ? <div className="mt-8">{footer}</div> : null}
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (variant === "immersive") {
    return (
      <main className="relative min-h-screen overflow-hidden bg-slate-950">
        <div className="absolute inset-0 overflow-hidden">
          <Image
            src="/landing-hero-bimbel.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="scale-[1.02] object-cover object-center opacity-92 blur-[2.5px] saturate-[0.9] brightness-[0.72]"
          />
          <div className="absolute inset-0 bg-slate-900/70" />
        </div>

        <div className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
          <div
            className={cn(
              "w-full max-w-[640px] rounded-[34px] border border-white/14 bg-white/12 p-2.5 shadow-xl backdrop-blur-sm",
              panelClassName,
            )}
          >
            <Card className="rounded-[28px] border-white/55 bg-white/92 shadow-lg">
              <CardContent className="p-5 sm:p-6 md:p-7">
                <div>
                  <div className="mb-4 flex justify-center">
                    <div className="relative inline-flex rounded-[24px] border border-orange-100 bg-white px-4 py-3 shadow-sm">
                      <div className="relative flex items-center justify-center">
                        <div className="flex size-11 items-center justify-center rounded-[18px] bg-orange-50 text-orange-600">
                          <FaGraduationCap className="size-5" aria-hidden="true" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <h1 className="text-center text-2xl font-semibold tracking-tight text-slate-950 sm:text-[1.9rem]">
                    {title}
                  </h1>
                  <p className="mt-2 text-center text-sm leading-6 text-slate-600">
                    {description}
                  </p>
                </div>

                <div className={cn("mt-5", bodyClassName)}>{children}</div>

                {footer ? <div className="mt-5">{footer}</div> : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    );
  }

  if (variant === "showcase") {
    return (
      <main className="relative min-h-screen overflow-hidden bg-slate-950">
        <div className="absolute inset-0 overflow-hidden">
          <Image
            src="/landing-hero-bimbel.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="scale-[1.04] object-cover object-center opacity-95 saturate-[0.92] brightness-[0.72]"
          />
          <div className="absolute inset-0 bg-slate-900/70" />
        </div>

        <div className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-8 sm:px-6 lg:px-8">
          <section className="w-full overflow-hidden rounded-[36px] border border-white/12 bg-white/10 shadow-2xl backdrop-blur-md">
            <div className="grid lg:grid-cols-[0.94fr_1.06fr]">
              <div className="relative px-6 py-8 text-white sm:px-8 lg:px-10 lg:py-10">


                <div className="relative">
                  <div className="inline-flex rounded-full border border-white/18 bg-white/90 pr-4 shadow-sm backdrop-blur">
                    <AppLogo />
                  </div>

                  <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/82 backdrop-blur">
                    <Sparkles className="size-3.5 text-orange-300" />
                    Portal Login LMS
                  </div>

                  <h1 className="mt-6 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl lg:text-[3rem] lg:leading-[1.06]">
                    Masuk ke dashboard belajar dengan tampilan yang selaras dengan sistem LMS.
                  </h1>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-white/78 sm:text-base">
                    Gunakan kode akun dari admin untuk login ke portal Bina Cendekia. Email lama
                    tetap bisa dipakai sebagai cadangan, sementara alur sesi dan redirect
                    dashboard mengikuti role akun.
                  </p>

                  <div className="mt-8 grid gap-4 sm:grid-cols-3">
                    {[
                      { label: "Portal", value: "Login LMS" },
                      { label: "Akun", value: "Kode login" },
                      { label: "Akses", value: "Role-based" },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-[24px] border border-white/12 bg-white/10 px-4 py-4 text-white shadow-sm backdrop-blur"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                          {item.label}
                        </p>
                        <p className="mt-2 text-sm font-semibold text-white/92">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 rounded-[30px] border border-white/14 bg-white/10 p-5 shadow-md backdrop-blur">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-200">
                      Siap Digunakan
                    </p>
                    <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
                      Login yang lebih ringkas, tetap aman.
                    </h2>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-white/72">
                      Halaman ini dibuat lebih selaras dengan tampilan `register-online`, tetapi
                      tetap fokus ke proses masuk akun tanpa menambah blok informasi yang terlalu
                      panjang.
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-6 py-8 sm:px-8 lg:px-10 lg:py-10">
                <div className="rounded-[32px] border border-white/60 bg-white/92 p-6 shadow-lg backdrop-blur sm:p-8">
                  <Badge
                    variant="secondary"
                    className="w-fit rounded-full bg-orange-50 text-orange-700"
                  >
                    {eyebrow}
                  </Badge>
                  <div className="mt-5">
                    <h2 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-[2rem]">
                      {title}
                    </h2>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
                  </div>

                  <div className="mt-7">{children}</div>

                  {footer ? <div className="mt-6">{footer}</div> : null}
                </div>

                <div className="mt-4 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-white/62">
                  <CheckCircle2 className="size-4 text-orange-300" />
                  Redirect role-based tetap aktif
                  <ArrowRight className="size-4 text-white/30" />
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (variant === "compact") {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white px-4 py-8 sm:px-6 lg:px-8">
        <div className="absolute inset-0 overflow-hidden">

        </div>

        <section
          className={cn(
            authPoppins.className,
            "relative w-full max-w-lg rounded-[28px] border border-orange-100/70 bg-white px-6 py-8 text-center shadow-xl sm:px-8 sm:py-10",
            panelClassName,
          )}
        >
          <div className="flex justify-center">
            <div className="inline-flex rounded-full border border-orange-100 bg-orange-50/50 px-4 py-3 shadow-sm">
              <AppLogo />
            </div>
          </div>

          {eyebrow ? (
            <Badge
              variant="secondary"
              className="mt-6 rounded-full border border-orange-100 bg-orange-50 px-3.5 py-1 text-[11px] font-semibold tracking-[0.16em] text-orange-700"
            >
              {eyebrow}
            </Badge>
          ) : null}

          <div className={cn("mt-6", bodyClassName)}>
            <h1 className="text-[1.85rem] font-semibold tracking-[-0.03em] text-slate-950 sm:text-[2.15rem]">
              {title}
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-500 sm:text-[15px]">
              {description}
            </p>
            <div className="mt-7">{children}</div>
          </div>

          {footer ? <div className="mt-7 flex justify-center">{footer}</div> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-8 sm:px-6 lg:px-8">
      <section className="surface-panel w-full overflow-hidden p-0">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative overflow-hidden border-b border-white/70 bg-orange-50 px-6 py-8 sm:px-8 lg:border-b-0 lg:border-r lg:border-orange-100/70 lg:px-10 lg:py-10">
            <div className="relative">
              <AppLogo />
              <Badge variant="info" className="mt-6 w-fit">
                Portal Authentication LMS
              </Badge>
              <h1 className="mt-5 max-w-xl text-3xl font-semibold tracking-tight text-slate-950 lg:text-4xl">
                Akses akun Bimbel dengan alur yang rapi, aman, dan mudah dipahami.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 lg:text-base">
                Flow login dan registrasi ini dibuat khusus untuk kebutuhan LMS/Bimbel Anda tanpa
                mengganggu dashboard yang sudah ada.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {[
                  { label: "Role aktif", value: "4 role" },
                  { label: "Security", value: "JWT + API key" },
                  { label: "Verifikasi", value: "Email required" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[22px] border border-orange-100/80 bg-white/80 px-4 py-4 shadow-sm"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {item.label}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8 space-y-4">
                {authHighlights.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.title}
                      className="flex gap-4 rounded-[24px] border border-white/80 bg-white/84 px-4 py-4 shadow-md backdrop-blur"
                    >
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 text-white shadow-lg shadow-orange-500/20">
                        <Icon className="size-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="px-6 py-8 sm:px-8 lg:px-10 lg:py-10">
            <Card className="border-orange-100/80 bg-white/96 shadow-lg">
              <CardContent className="p-6 sm:p-7">
                <Badge variant="secondary" className="w-fit bg-slate-100/90 text-slate-700">
                  {eyebrow}
                </Badge>
                <div className="mt-5">
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h2>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
                </div>

                <div className="mt-7">{children}</div>

                {footer ? <div className="mt-6">{footer}</div> : null}
              </CardContent>
            </Card>

            <div className="mt-5 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
              <CheckCircle2 className="size-4 text-orange-500" />
              Redirect role-based dari backend tetap dipertahankan
              <ArrowRight className="size-4 text-slate-300" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
