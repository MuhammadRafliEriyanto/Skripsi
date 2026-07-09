"use client";

import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Camera,
  ChevronUp,
  Clapperboard,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { type MouseEvent } from "react";

import { landingNavLinks } from "@/components/landing/landing-page-data";

type FooterLink = {
  label: string;
  href: string;
  external?: boolean;
};

type FooterContactItem = {
  icon: LucideIcon;
  label: string;
  value: string;
  href?: string;
  external?: boolean;
};

type FooterSocialLink = FooterLink & {
  icon: LucideIcon;
};

const branchLocations = [
  {
    name: "Cabang Slawi",
    city: "Slawi",
    address: "Slawi, Kabupaten Tegal",
    phone: "0812-8800-1201",
    mapHref: "https://www.google.com/maps/search/?api=1&query=Slawi,+Kabupaten+Tegal",
  },
  {
    name: "Cabang Adiwerna",
    city: "Adiwerna",
    address: "Adiwerna, Kabupaten Tegal",
    phone: "0812-8800-1202",
    mapHref: "https://www.google.com/maps/search/?api=1&query=Adiwerna,+Kabupaten+Tegal",
  },
] as const;

const menuLinks: FooterLink[] = [
  ...landingNavLinks.map((item) => ({
    label: item.label,
    href: item.href,
  })),
  { label: "Daftar Online", href: "/register" },
];

const linkGroups: FooterLink[] = [
  {
    label: "Hubungi Admin",
    href: "https://wa.me/6281288001201",
    external: true,
  },
  {
    label: "Instagram Bimbel",
    href: "https://instagram.com/binacendekia.belajar",
    external: true,
  },
  {
    label: "YouTube Bina Cendekia",
    href: "https://youtube.com",
    external: true,
  },
  {
    label: "Lihat Maps Slawi",
    href: branchLocations[0].mapHref,
    external: true,
  },
  {
    label: "Lihat Maps Adiwerna",
    href: branchLocations[1].mapHref,
    external: true,
  },
] as const;

const contactItems: FooterContactItem[] = [
  {
    icon: Mail,
    label: "Email",
    value: "halo@binacendekia.test",
    href: "mailto:halo@binacendekia.test",
  },
  {
    icon: Phone,
    label: "Telepon",
    value: "0812-8800-1201",
    href: "tel:081288001201",
  },
] as const;

const socialLinks: FooterSocialLink[] = [
  {
    icon: MessageCircle,
    label: "WhatsApp",
    href: "https://wa.me/6281288001201",
    external: true,
  },
  {
    icon: Camera,
    label: "Instagram",
    href: "https://instagram.com/binacendekia.belajar",
    external: true,
  },
  {
    icon: Mail,
    label: "Email",
    href: "mailto:halo@binacendekia.test",
  },
  {
    icon: Clapperboard,
    label: "YouTube",
    href: "https://youtube.com",
    external: true,
  },
] as const;

export default function LandingFooter() {
  const handleSectionNavigation = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!href.startsWith("#")) {
      return;
    }

    const target = document.getElementById(href.slice(1));
    if (!target) {
      return;
    }

    event.preventDefault();

    const targetTop = target.getBoundingClientRect().top + window.scrollY - 92;
    window.history.replaceState(null, "", href);
    window.scrollTo({
      top: Math.max(0, targetTop),
      behavior: "smooth",
    });
  };

  return (
    <footer
      id="footer-chatbot"
      className="relative mt-14 overflow-hidden bg-[linear-gradient(135deg,rgba(136,19,55,0.98)_0%,rgba(194,65,12,0.97)_54%,rgba(251,146,60,0.94)_100%)] text-white"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-px bg-white/10" />
        <div className="absolute -left-16 top-0 size-72 rounded-full bg-rose-300/14 blur-3xl" />
        <div className="absolute right-0 top-10 size-80 rounded-full bg-amber-200/12 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),rgba(255,255,255,0)_28%,rgba(15,23,42,0.08)_76%,rgba(15,23,42,0.22)_100%)]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:gap-10 lg:grid-cols-[1.35fr_0.82fr_0.9fr_0.92fr] lg:gap-12">
          <div className="col-span-2 max-w-md lg:col-span-1">
            <Link
              href="#home"
              onClick={(event) => handleSectionNavigation(event, "#home")}
              className="group flex items-center gap-3"
            >
              <Image
                src="/logobc.png"
                alt="Logo Bina Cendekia"
                width={44}
                height={44}
                style={{ width: "auto" }}
                className="h-11 w-auto shrink-0 transition duration-200 group-hover:scale-[1.03]"
              />

              <div className="leading-tight">
                <p className="text-base font-bold text-yellow-300 transition group-hover:text-yellow-200">
                  Bina
                </p>
                <p className="-mt-1 text-sm text-yellow-100/95 transition group-hover:text-white">
                  Cendekia
                </p>
              </div>
            </Link>

            <p className="mt-6 text-sm leading-7 text-white/76">
              Bina Cendekia menghadirkan bimbingan belajar yang hangat, terarah, dan lebih mudah
              diakses untuk siswa serta orang tua.
            </p>

            <div className="mt-7 space-y-6">
              {branchLocations.map((branch) => (
                <div key={branch.name}>
                  <p className="text-sm font-semibold uppercase tracking-[0.12em] text-yellow-200">
                    {branch.name}
                  </p>
                  <p className="mt-2 max-w-sm text-sm leading-7 text-white/72">
                    {branch.address}, {branch.city}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/68">
                    <span className="inline-flex items-center gap-2">
                      <Phone className="size-3.5 text-yellow-200" />
                      {branch.phone}
                    </span>
                    <Link
                      href={branch.mapHref}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-yellow-200 transition hover:text-yellow-100"
                    >
                      Lihat Maps
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-7 space-y-3">
              {contactItems.map((item) => {
                const Icon = item.icon;
                const content = (
                  <span className="inline-flex items-center gap-2 text-sm text-white/72 transition hover:text-white">
                    <Icon className="size-4 text-yellow-200" />
                    <span>
                      {item.label}: {item.value}
                    </span>
                  </span>
                );

                if (!item.href) {
                  return <div key={item.label}>{content}</div>;
                }

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    target={item.external ? "_blank" : undefined}
                    rel={item.external ? "noreferrer" : undefined}
                  >
                    {content}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="col-span-1">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-yellow-200">
              Menu
            </p>
            <div className="mt-6 grid gap-3">
              {menuLinks.map((item) => (
                <Link
                  key={`${item.label}-${item.href}`}
                  href={item.href}
                  onClick={
                    item.href.startsWith("#")
                      ? (event) => handleSectionNavigation(event, item.href)
                      : undefined
                  }
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noreferrer" : undefined}
                  className="group inline-flex w-fit items-center gap-2 text-[15px] text-white/76 transition duration-300 hover:text-yellow-200"
                >
                  <span>{item.label}</span>
                  <ArrowRight className="size-3.5 opacity-0 transition duration-300 group-hover:translate-x-0.5 group-hover:opacity-100" />
                </Link>
              ))}
            </div>
          </div>

          <div className="col-span-1">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-yellow-200">
              Links
            </p>
            <div className="mt-6 grid gap-3">
              {linkGroups.map((item) => (
                <Link
                  key={`${item.label}-${item.href}`}
                  href={item.href}
                  onClick={
                    item.href.startsWith("#")
                      ? (event) => handleSectionNavigation(event, item.href)
                      : undefined
                  }
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noreferrer" : undefined}
                  className="group inline-flex w-fit items-center gap-2 text-[15px] text-white/76 transition duration-300 hover:text-yellow-200"
                >
                  <span>{item.label}</span>
                  <ArrowRight className="size-3.5 opacity-0 transition duration-300 group-hover:translate-x-0.5 group-hover:opacity-100" />
                </Link>
              ))}
            </div>
          </div>

          <div className="col-span-2 flex flex-col justify-between gap-8 lg:col-span-1">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-yellow-200">
                Info
              </p>
              <div className="mt-6 space-y-3 text-sm leading-7 text-white/74">
                <p className="font-semibold uppercase tracking-[0.08em] text-white">
                  Bina Cendekia
                </p>
                <p>Slawi dan Adiwerna</p>
              </div>
            </div>

            <div className="rounded-[26px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.06))] p-5 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-yellow-200">
                Lokasi Terdekat
              </p>
              <p className="mt-2 text-sm leading-6 text-white/72">
                Pilih cabang yang paling dekat untuk konsultasi program dan pendaftaran siswa.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {branchLocations.map((branch) => (
                  <span
                    key={branch.name}
                    className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-xs text-white/76"
                  >
                    <MapPin className="size-3.5 text-yellow-200" />
                    {branch.city}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-sm text-white/58">
            Bina Cendekia membantu siswa belajar lebih terarah lewat program, membership, dan
            pendampingan yang lebih hangat.
          </p>

          <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
            {socialLinks.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noreferrer" : undefined}
                  aria-label={item.label}
                  className="inline-flex size-11 items-center justify-center rounded-full border border-white/12 bg-white/8 text-white transition duration-300 hover:-translate-y-0.5 hover:border-white/22 hover:bg-white/14 hover:text-yellow-200"
                >
                  <Icon className="size-4" />
                </Link>
              );
            })}

            <Link
              href="#home"
              onClick={(event) => handleSectionNavigation(event, "#home")}
              aria-label="Kembali ke atas"
              className="inline-flex size-11 items-center justify-center rounded-full border border-white/14 bg-white/12 text-white transition duration-300 hover:-translate-y-0.5 hover:border-white/24 hover:bg-white/18 hover:text-yellow-200"
            >
              <ChevronUp className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
