"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ShieldCheck,
  WalletCards,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatRupiah,
  type OnlinePackageKey,
} from "@/lib/subscription";
import { useSubscriptionConfig } from "@/lib/use-subscription-config";
import { cn } from "@/lib/utils";

type ClassPricingKey = string;

type PackageCardMeta = {
  eyebrow: string;
  description: string;
  icon: LucideIcon;
  benefits: string[];
  buttonLabel: string;
  recommended?: boolean;
};

type PriceRow = {
  label: string;
  helper: string;
  priceClass: ClassPricingKey;
};

const packageCardMeta: Record<string, PackageCardMeta> = {
  "1-semester": {
    eyebrow: "6 bulan",
    description: "Pilihan ringkas untuk fokus pada target belajar satu semester.",
    icon: CalendarDays,
    benefits: [
      "Cocok untuk evaluasi awal sebelum komitmen tahunan.",
      "Akses LMS mengikuti status membership dan pembayaran.",
      "Materi, tugas, absensi, dan tryout mengikuti kelas siswa.",
    ],
    buttonLabel: "Pilih 1 Semester",
  },
  "2-semester": {
    eyebrow: "12 bulan",
    description: "Paket tahunan untuk ritme belajar yang lebih stabil.",
    icon: ShieldCheck,
    benefits: [
      "Akses belajar penuh untuk dua semester berturut-turut.",
      "Tidak perlu mengurus perpanjangan di tengah tahun ajaran.",
      "Cocok untuk target nilai dan persiapan ujian jangka panjang.",
    ],
    buttonLabel: "Pilih 2 Semester",
    recommended: true,
  },
};

const priceRows: PriceRow[] = [
  {
    label: "SD Kelas 2-3",
    helper: "Program dasar awal",
    priceClass: "Kelas 2",
  },
  {
    label: "SD Kelas 4-5",
    helper: "Penguatan konsep",
    priceClass: "Kelas 4",
  },
  {
    label: "SD Kelas 6",
    helper: "Persiapan naik jenjang",
    priceClass: "Kelas 6",
  },
  {
    label: "SMP Kelas 7-8",
    helper: "Program reguler",
    priceClass: "Kelas 7",
  },
  {
    label: "SMP Kelas 9",
    helper: "Fokus ujian akhir",
    priceClass: "Kelas 9",
  },
  {
    label: "SMA Kelas 10-11",
    helper: "Program intensif",
    priceClass: "Kelas 10",
  },
  {
    label: "SMA Kelas 12",
    helper: "Target akhir sekolah",
    priceClass: "Kelas 12",
  },
];

const packageFacts = [
  {
    icon: WalletCards,
    title: "Harga mengikuti kelas",
    description: "Nominal final otomatis mengikuti jenjang dan kelas yang dipilih di form pendaftaran.",
  },
  {
    icon: Clock3,
    title: "Aktif setelah paid",
    description: "Akses siswa dibuka setelah email terverifikasi dan pembayaran sudah dikonfirmasi.",
  },
  {
    icon: BookOpenCheck,
    title: "Akun dibuat otomatis",
    description: "Kode akun dan password awal siswa dikirim bersama email verifikasi.",
  },
] as const;

function normalizePriceClass(value: string) {
  const grade = value.match(/\b(1[0-2]|[2-9])\b/)?.[1] ?? "";

  if (!grade) {
    return value;
  }

  if (Number(grade) <= 6) {
    return `SD ${grade}`;
  }

  if (Number(grade) <= 9) {
    return `SMP ${grade}`;
  }

  return `SMA ${grade}`;
}

function getPackageMeta(packageKey: OnlinePackageKey): PackageCardMeta {
  return (
    packageCardMeta[packageKey] ?? {
      eyebrow: "Membership",
      description: "Paket membership aktif dari server.",
      icon: CalendarDays,
      benefits: [
        "Akses LMS mengikuti status membership dan pembayaran.",
        "Materi, tugas, absensi, dan tryout mengikuti kelas siswa.",
        "Nominal final mengikuti konfigurasi backend.",
      ],
      buttonLabel: "Pilih Paket",
    }
  );
}

function getPackagePriceRange(
  packageKey: OnlinePackageKey,
  classPricingMatrix: Record<string, Record<string, number>>,
  fallbackAmount: number,
) {
  const prices = Object.values(classPricingMatrix)
    .map((pricing) => pricing[packageKey])
    .filter((price): price is number => typeof price === "number");

  return {
    min: prices.length ? Math.min(...prices) : fallbackAmount,
    max: prices.length ? Math.max(...prices) : fallbackAmount,
  };
}

export default function LandingPaket() {
  const { config, isLoading, error } = useSubscriptionConfig();
  const packageOptions = config.packages;
  const classPricingMatrix = config.classPricingMatrix;

  return (
    <section id="paket" className="scroll-mt-28 py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-3xl">
            <Badge className="border border-orange-100 bg-orange-50 text-orange-700 hover:bg-orange-50">
              Paket Membership
            </Badge>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
              Pilih durasi belajar yang sesuai dengan ritme siswa.
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">
              Paket aktif sekarang terdiri dari 1 semester dan 2 semester. Harga final mengikuti
              kelas yang dipilih saat pendaftaran online.
            </p>
          </div>

          <Link
            href="/register"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-orange-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2"
          >
            Daftar Sekarang
            <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          {packageOptions.map((item) => {
            const meta = getPackageMeta(item.packageKey);
            const Icon = meta.icon;
            const priceRange = getPackagePriceRange(
              item.packageKey,
              classPricingMatrix,
              item.amount,
            );
            const monthlyStart = Math.round(priceRange.min / item.durationMonth);

            return (
              <Card
                key={item.packageKey}
                className={cn(
                  "rounded-lg border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md",
                  meta.recommended && "border-orange-200 bg-orange-50/35",
                )}
              >
                <CardContent className="flex h-full flex-col p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-600">
                          {meta.eyebrow}
                        </span>
                        {meta.recommended ? (
                          <Badge className="border border-orange-200 bg-white text-orange-700 hover:bg-white">
                            Direkomendasikan
                          </Badge>
                        ) : null}
                      </div>
                      <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                        {item.packageName}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{meta.description}</p>
                    </div>

                    <div
                      className={cn(
                        "flex size-11 shrink-0 items-center justify-center rounded-lg text-white",
                        meta.recommended ? "bg-orange-600" : "bg-slate-900",
                      )}
                    >
                      <Icon className="size-5" />
                    </div>
                  </div>

                  <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Rentang harga
                    </p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                      {formatRupiah(priceRange.min)} - {formatRupiah(priceRange.max)}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      Mulai sekitar {formatRupiah(monthlyStart)} per bulan.
                    </p>
                  </div>

                  <div className="mt-5 space-y-3">
                    {meta.benefits.map((benefit) => (
                      <div key={benefit} className="flex items-start gap-3 text-sm leading-6 text-slate-600">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-orange-600" />
                        <span>{benefit}</span>
                      </div>
                    ))}
                  </div>

                  <Link
                    href={`/register?package=${item.packageKey}`}
                    className={cn(
                      "mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2",
                      meta.recommended
                        ? "bg-orange-600 text-white hover:bg-orange-700"
                        : "border border-orange-200 bg-white text-orange-700 hover:bg-orange-50",
                    )}
                  >
                    {meta.buttonLabel}
                    <ArrowRight className="size-4" />
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {!isLoading && (!packageOptions.length || error) ? (
          <div className="mt-6 rounded-lg border border-amber-100 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-700">
            {error || "Paket membership belum tersedia dari server."}
          </div>
        ) : null}

        <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
            <h3 className="text-base font-semibold text-slate-950">Ringkasan harga per kelas</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Tabel ini mengikuti data harga yang dipakai form pendaftaran online.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3 sm:px-6">
                    Kelas
                  </th>
                  <th scope="col" className="px-5 py-3 sm:px-6">
                    Keterangan
                  </th>
                  <th scope="col" className="px-5 py-3 sm:px-6">
                    1 Semester
                  </th>
                  <th scope="col" className="px-5 py-3 sm:px-6">
                    2 Semester
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {priceRows.map((row) => {
                  const price =
                    classPricingMatrix[normalizePriceClass(row.priceClass)] ?? {};

                  return (
                    <tr key={row.label} className="hover:bg-orange-50/35">
                      <th scope="row" className="whitespace-nowrap px-5 py-4 font-semibold text-slate-950 sm:px-6">
                        {row.label}
                      </th>
                      <td className="px-5 py-4 text-slate-500 sm:px-6">{row.helper}</td>
                      <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-800 sm:px-6">
                        {formatRupiah(price["1-semester"] ?? 0)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-800 sm:px-6">
                        {formatRupiah(price["2-semester"] ?? 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {packageFacts.map((item) => {
            const Icon = item.icon;

            return (
              <div key={item.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex size-10 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                  <Icon className="size-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-950">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
