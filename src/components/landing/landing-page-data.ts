import type { LucideIcon } from "lucide-react";
import {
  BookOpenCheck,
  BrainCircuit,
  ChartNoAxesColumn,
  CheckCircle2,
  Clock3,
  FileCheck2,
  GraduationCap,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export type LandingNavLink = {
  label: string;
  href: string;
};

export type LandingMetric = {
  label: string;
  value: string;
  detail: string;
};

export type LandingPreviewItem = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export type LandingBenefit = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export type LandingStep = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export type LandingEventItem = {
  label: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

export const landingNavLinks: LandingNavLink[] = [
  { label: "Home", href: "#home" },
  { label: "About", href: "#about" },
  { label: "Program", href: "#program" },
  { label: "Paket", href: "#paket" },
];

export const landingBenefits: LandingBenefit[] = [
  {
    title: "Suasana Belajar yang Nyaman",
    description:
      "Pendekatan belajar yang personal membuat siswa lebih fokus dan tidak merasa tertekan selama proses belajar.",
    icon: MessagesSquare,
  },
  {
    title: "Kurikulum Terarah",
    description:
      "Materi disusun secara sistematis agar siswa tahu persis apa yang harus dicapai setiap minggunya.",
    icon: BrainCircuit,
  },
  {
    title: "Laporan Perkembangan Transparan",
    description:
      "Orang tua dapat memantau kehadiran, nilai tryout, dan evaluasi siswa secara real-time.",
    icon: ShieldCheck,
  },
  {
    title: "Fasilitas Belajar Modern",
    description:
      "Dilengkapi dengan materi interaktif dan tutor yang siap membantu bahkan di luar jam kelas.",
    icon: ChartNoAxesColumn,
  },
];

export const landingSteps: LandingStep[] = [
  {
    title: "Isi data siswa",
    description:
      "Masukkan nama, email, nomor HP, jenjang, dan kelas melalui halaman daftar online.",
    icon: FileCheck2,
  },
  {
    title: "Pilih program dan paket",
    description:
      "Tentukan membership yang sesuai dengan ritme belajar siswa agar proses mulai terasa lebih jelas sejak awal.",
    icon: GraduationCap,
  },
  {
    title: "Verifikasi lalu aktif",
    description:
      "Setelah email diverifikasi dan payment dikonfirmasi, akses dashboard siswa dibuka mengikuti status membership.",
    icon: CheckCircle2,
  },
];

export const landingPromises = [
  {
    icon: Sparkles,
    label: "Nuansa bimbel yang lebih hangat",
  },
  {
    icon: BookOpenCheck,
    label: "Program sesuai jenjang siswa",
  },
  {
    icon: Clock3,
    label: "Pendaftaran online yang ringkas",
  },
];

export const landingEventItems: LandingEventItem[] = [
  {
    label: "Tryout & evaluasi",
    title: "Uji Kemampuan dengan Tryout Terarah",
    description:
      "Uji kemampuan dengan simulasi ujian yang dirancang mirip dengan kondisi aslinya untuk mengukur kesiapan.",
    icon: BookOpenCheck,
  },
  {
    label: "Jadwal belajar",
    title: "Pilih Waktu Belajar yang Fleksibel",
    description:
      "Pilih waktu belajar yang paling sesuai dengan kegiatan sekolahmu agar pembelajaran lebih optimal.",
    icon: Clock3,
  },
  {
    label: "Aktivasi akses",
    title: "Mulai Belajar Tanpa Menunggu Lama",
    description:
      "Daftar sekarang, aktivasi akun secara instan, dan langsung mulai belajar meraih prestasimu.",
    icon: ShieldCheck,
  },
];
