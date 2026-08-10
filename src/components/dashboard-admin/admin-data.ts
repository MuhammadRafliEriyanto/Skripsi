import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  LayoutGrid,
  Users,
  WalletCards,
} from "lucide-react";

export type AdminTab =
  | "overview"
  | "students"
  | "teachers"
  | "schedule"
  | "utbkAssessments"
  | "payments"
  | "profile";

export type AdminTone = "slate" | "orange" | "amber" | "emerald" | "rose";

export type AdminNavItem = {
  value: AdminTab;
  label: string;
  description: string;
  icon: LucideIcon;
  badge?: string;
  showBadge?: boolean;
};

export type AdminStudent = {
  id: string;
  name: string;
  email: string;
  loginCode: string;
  phone: string;
  branch: string;
  level: "SD" | "SMP" | "SMA";
  program: string;
  className: string;
  birthDate: string;
  academicYear: string;
  address: string;
  schoolOrigin?: string;
  difficultSubjects?: string;
  generatedPassword: string;
  status: "Aktif" | "Nonaktif";
  isEmailVerified: boolean;
  membership?: {
    status: "active" | "pending" | "expired" | "none";
    packageKey?: string;
    packageName?: string;
    paymentStatus?: string;
    startDate?: string;
    endDate?: string;
  };
  hasFinancialHistory?: boolean;
};

export type AdminTeacher = {
  id: string;
  name: string;
  email: string;
  loginCode: string;
  subject: string;
  schedule: string;
  activeClasses: number;
  classList: string;
  branch: string;
  branches: string[];
  phone: string;
  address: string;
  education: string;
  isEmailVerified: boolean;
  status: "Aktif" | "Nonaktif";
  availability: "Tersedia" | "Padat" | "Cuti";
};

export type AdminSchedule = {
  id: string;
  day: string;
  time: string;
  className: string;
  subject: string;
  teacherId: string;
  teacher: string;
  branch: string;
  room: string;
  status: "Berjalan" | "Siap" | "Review" | "Bentrok";
  conflicts: string[];
};

export const adminNavigation: AdminNavItem[] = [
  {
    value: "overview",
    label: "Overview",
    description: "Pantau kesehatan operasional harian.",
    icon: LayoutGrid,
  },
  {
    value: "students",
    label: "Siswa",
    description: "Kelola data peserta dan status belajar.",
    icon: Users,
    showBadge: true,
  },
  {
    value: "teachers",
    label: "Guru",
    description: "Monitor distribusi mapel dan kelas aktif.",
    icon: GraduationCap,
    showBadge: true,
  },
  {
    value: "schedule",
    label: "Jadwal",
    description: "Lihat kelas berjalan dan validasi bentrok.",
    icon: CalendarDays,
    showBadge: true,
  },
  {
    value: "utbkAssessments",
    label: "Monitoring Akademik",
    description: "Pantau hasil belajar siswa reguler dan UTBK.",
    icon: ClipboardCheck,
  },
  {
    value: "payments",
    label: "Pembayaran",
    description: "Verifikasi transaksi yang masuk manual.",
    icon: WalletCards,
    showBadge: true,
  },
];

export function buildGeneratedPasswordFromBirthDate(birthDate: string) {
  const [year, month, day] = birthDate.split("-");

  if (!year || !month || !day) {
    return "";
  }

  return `${day}${month}${year}`;
}

export const adminStudentLevelOptions = ["Semua", "SD", "SMP", "SMA"] as const;
export const adminStudentStatusOptions = ["Semua", "Aktif", "Nonaktif"] as const;
export const adminTeacherStatusOptions = ["Semua", "Aktif", "Nonaktif"] as const;
export const adminStudentClassOptions = [
  "Semua kelas",
  "SD 4",
  "SD 5",
  "SD 6",
  "SMP 7",
  "SMP 8",
  "SMP 9",
  "SMA 10",
  "SMA 11",
  "SMA 12",
] as const;
