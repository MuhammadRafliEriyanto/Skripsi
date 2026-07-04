"use client";

import { useEffect, useState, type MouseEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Menu } from "lucide-react";

import { landingNavLinks } from "@/components/landing/landing-page-data";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export default function LandingNavbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeHref, setActiveHref] = useState("#home");

  useEffect(() => {
    const updateActiveHref = () => {
      const scrollPosition = window.scrollY + 140;
      let nextActiveHref = landingNavLinks[0]?.href ?? "#home";

      for (const item of landingNavLinks) {
        if (!item.href.startsWith("#")) continue;

        const target = document.getElementById(item.href.slice(1));
        if (target && scrollPosition >= target.offsetTop) {
          nextActiveHref = item.href;
        }
      }

      setActiveHref(nextActiveHref);
    };

    updateActiveHref();

    window.addEventListener("scroll", updateActiveHref, { passive: true });
    window.addEventListener("resize", updateActiveHref);
    window.addEventListener("hashchange", updateActiveHref);

    return () => {
      window.removeEventListener("scroll", updateActiveHref);
      window.removeEventListener("resize", updateActiveHref);
      window.removeEventListener("hashchange", updateActiveHref);
    };
  }, []);

  const handleSectionNavigation = (
    event: MouseEvent<HTMLAnchorElement>,
    href: string,
    closeMenu = false,
  ) => {
    if (!href.startsWith("#")) {
      if (closeMenu) setIsMenuOpen(false);
      return;
    }

    const target = document.getElementById(href.slice(1));
    if (!target) {
      if (closeMenu) setIsMenuOpen(false);
      return;
    }

    event.preventDefault();

    const targetTop = target.getBoundingClientRect().top + window.scrollY - 92;
    window.history.replaceState(null, "", href);
    window.scrollTo({
      top: Math.max(0, targetTop),
      behavior: "smooth",
    });

    setActiveHref(href);

    if (closeMenu) {
      setIsMenuOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[linear-gradient(90deg,rgba(159,18,57,0.96)_0%,rgba(194,65,12,0.96)_55%,rgba(251,146,60,0.96)_100%)] shadow-[0_18px_42px_-26px_rgba(159,18,57,0.55)] backdrop-blur-md">
      <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="#home"
          onClick={(event) => handleSectionNavigation(event, "#home")}
          className="group flex items-center gap-2.5"
        >
          <Image
            src="/logobc.png"
            alt="Logo Bina Cendekia"
            width={40}
            height={40}
            style={{ width: "auto" }}
            className="h-10 w-auto shrink-0 transition duration-200 group-hover:scale-[1.03]"
          />

          <div className="leading-tight">
            <p className="text-sm font-bold text-yellow-300 transition group-hover:text-yellow-200">
              Bina
            </p>
            <p className="-mt-1 text-xs text-yellow-100/95 transition group-hover:text-white">
              Cendekia
            </p>
          </div>
        </Link>

        <nav className="hidden items-center justify-center gap-2 md:flex">
          {landingNavLinks.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              aria-current={activeHref === item.href ? "page" : undefined}
              onClick={(event) => handleSectionNavigation(event, item.href)}
              className={[
                "group/nav relative inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition-all duration-300",
                activeHref === item.href
                  ? "text-yellow-200"
                  : "text-white/82 hover:text-yellow-200",
              ].join(" ")}
            >
              <span
                className={[
                  "absolute inset-0 rounded-full border transition-all duration-300",
                  activeHref === item.href
                    ? "border-white/20 bg-white/12 shadow-[0_14px_28px_-22px_rgba(15,23,42,0.4)]"
                    : "border-transparent bg-transparent group-hover/nav:border-white/14 group-hover/nav:bg-white/8",
                ].join(" ")}
              />
              <span className="relative">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="inline-flex size-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition-all duration-300 hover:-translate-y-px hover:bg-white/15 hover:text-yellow-200 md:hidden"
              >
                <Menu className="size-4" />
                <span className="sr-only">Buka menu navigasi</span>
              </button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="border-white/10 bg-[linear-gradient(180deg,rgba(136,19,55,0.98),rgba(194,65,12,0.96),rgba(251,146,60,0.94))] p-6 text-white shadow-[0_28px_70px_-38px_rgba(88,28,135,0.3),0_24px_48px_-34px_rgba(124,45,18,0.45)]"
            >
              <SheetHeader>
                <SheetTitle asChild>
                  <SheetClose asChild>
                    <Link
                      href="#home"
                      onClick={(event) => handleSectionNavigation(event, "#home", true)}
                      className="group flex w-fit items-center gap-2.5 text-left"
                    >
                      <Image
                        src="/logobc.png"
                        alt="Logo Bina Cendekia"
                        width={40}
                        height={40}
                        style={{ width: "auto" }}
                        className="h-10 w-auto shrink-0 transition duration-200 group-hover:scale-[1.03]"
                      />

                      <div className="leading-tight">
                        <p className="text-sm font-bold text-yellow-300 transition group-hover:text-yellow-200">
                          Bina
                        </p>
                        <p className="-mt-1 text-xs text-yellow-100/95 transition group-hover:text-white">
                          Cendekia
                        </p>
                      </div>
                    </Link>
                  </SheetClose>
                </SheetTitle>
                <SheetDescription className="text-left text-white/72">
                  Navigasi cepat ke section penting dan lanjut ke pendaftaran online.
                </SheetDescription>
              </SheetHeader>

              <div className="mt-8 space-y-3">
                {landingNavLinks.map((item) => (
                  <SheetClose key={item.label} asChild>
                    <Link
                      href={item.href}
                      aria-current={activeHref === item.href ? "page" : undefined}
                      onClick={(event) => handleSectionNavigation(event, item.href, true)}
                      className={[
                        "group/mobile flex items-center justify-between rounded-[22px] border px-4 py-4 text-sm font-medium shadow-[0_18px_28px_-24px_rgba(15,23,42,0.32)] backdrop-blur-sm transition-all duration-300",
                        activeHref === item.href
                          ? "border-white/20 bg-white/16 text-yellow-200"
                          : "border-white/10 bg-white/8 text-white/86 hover:border-white/20 hover:bg-white/12 hover:text-yellow-200",
                      ].join(" ")}
                    >
                      <span>{item.label}</span>
                      <ArrowUpRight
                        className={[
                          "size-4 transition-transform duration-300",
                          activeHref === item.href
                            ? "translate-x-0.5 -translate-y-0.5 text-yellow-200"
                            : "text-white/55 group-hover/mobile:translate-x-0.5 group-hover/mobile:-translate-y-0.5 group-hover/mobile:text-yellow-200",
                        ].join(" ")}
                      />
                    </Link>
                  </SheetClose>
                ))}
              </div>

              <div className="mt-6 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.08))] p-4 shadow-[0_18px_30px_-24px_rgba(15,23,42,0.28)] backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-yellow-200">
                  Langsung mulai
                </p>
                <p className="mt-2 text-sm leading-6 text-white/72">
                  Buka form siswa baru untuk pilih program, paket membership, dan aktivasi akun.
                </p>
                <SheetClose asChild>
                  <Link
                    href="/register"
                    className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full border border-white/16 bg-[linear-gradient(135deg,rgba(255,255,255,0.16),rgba(251,146,60,0.18),rgba(190,24,93,0.16))] px-5 text-sm font-semibold text-white transition hover:-translate-y-px hover:border-white/26 hover:text-yellow-100"
                  >
                    Daftar Sekarang
                  </Link>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>

          <div className="hidden rounded-full border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),rgba(251,146,60,0.14))] p-1 shadow-[0_16px_28px_-18px_rgba(124,45,18,0.5)] backdrop-blur-md md:block">
            <Link
              href="/register"
              className="inline-flex h-11 items-center justify-center rounded-full border border-white/20 bg-[linear-gradient(135deg,rgba(255,255,255,0.2),rgba(251,146,60,0.2),rgba(190,24,93,0.14))] px-5 text-sm font-semibold text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_14px_24px_-20px_rgba(124,45,18,0.5)] backdrop-blur-md transition-all duration-200 hover:-translate-y-px hover:border-white/30 hover:bg-[linear-gradient(135deg,rgba(255,255,255,0.24),rgba(251,146,60,0.28),rgba(190,24,93,0.18))] hover:text-white"
            >
              Daftar Sekarang
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
