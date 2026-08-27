import {
  AlertCircle,
  CalendarDays,
  ClipboardCheck,
  FileText,
  Trophy,
  Users,
} from "lucide-react";

import type { ClassDetailData } from "@/components/dashboard-guru/data/guruClassTypes";

import type {
  DetailSectionItem,
  MateriPertemuan,
  NilaiSiswa,
  TugasPertemuan,
} from "./types";

export const DETAIL_SECTION_ITEMS: DetailSectionItem[] = [
  {
    key: "peserta",
    label: "Peserta Kelas",
    shortLabel: "Peserta",
    description: "Daftar siswa aktif dan detail riwayat peserta.",
    icon: Users,
  },
  {
    key: "absensi",
    label: "Absensi Pertemuan",
    shortLabel: "Absensi",
    description: "Rekap absensi tiap sesi dan detail kehadiran per siswa.",
    icon: ClipboardCheck,
  },
  {
    key: "pertemuan",
    label: "Detail Pertemuan",
    shortLabel: "Pertemuan",
    description: "Riwayat sesi, materi, dan fokus pembelajaran.",
    icon: CalendarDays,
  },
  {
    key: "tugas",
    label: "Latihan Setiap Pertemuan",
    shortLabel: "Latihan",
    description: "Daftar Latihan kelas dan status penilaian.",
    icon: FileText,
  },
  {
    key: "belum-dinilai",
    label: "Nilai Latihan",
    shortLabel: "Nilai Latihan",
    description: "Latihan yang perlu diberi nilai.",
    icon: AlertCircle,
  },
  {
    key: "nilai",
    label: "Tabel Nilai",
    shortLabel: "Nilai",
    description: "Rekap skor siswa secara menyeluruh.",
    icon: Trophy,
  },
];

const INDONESIAN_MONTHS: Record<string, string> = {
  Januari: "01",
  Februari: "02",
  Maret: "03",
  April: "04",
  Mei: "05",
  Juni: "06",
  Juli: "07",
  Agustus: "08",
  September: "09",
  Oktober: "10",
  November: "11",
  Desember: "12",
};

const DATE_FORMATTER = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function extractPertemuanKe(label: string) {
  const parsed = Number.parseInt(label.replace(/\D/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : 1;
}

function createClientDraftId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function toIsoDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const parts = value.trim().split(" ");
  if (parts.length !== 3) {
    return value;
  }

  const [day, monthLabel, year] = parts;
  const month = INDONESIAN_MONTHS[monthLabel];
  if (!month) {
    return value;
  }

  return `${year}-${month}-${day.padStart(2, "0")}`;
}

export function formatDisplayDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return DATE_FORMATTER.format(date);
}

export function createInitialMateri(activeClass: ClassDetailData): MateriPertemuan[] {
  return activeClass.meetings.map((meeting, index) => ({
    id: `${activeClass.kelasId}-materi-${index + 1}`,
    kelasId: activeClass.kelasId,
    pertemuanKe: extractPertemuanKe(meeting.meeting),
    tanggal: toIsoDate(meeting.date),
    judulMateri: meeting.material,
    deskripsi: `${meeting.focus}. ${meeting.note}`,
    linkMateri: "",
    statusMateri:
      index === activeClass.meetings.length - 1 ? "Draft" : "Dipublikasikan",
  }));
}

export function createInitialTugas(activeClass: ClassDetailData): TugasPertemuan[] {
  return activeClass.assignments.map((assignment) => ({
    id: `${activeClass.kelasId}-tugas-${extractPertemuanKe(assignment.meeting)}`,
    kelasId: activeClass.kelasId,
    pertemuanKe: extractPertemuanKe(assignment.meeting),
    judulTugas: assignment.title,
    deskripsi: assignment.teacherNote,
    deadline: toIsoDate(assignment.deadline),
    jamMulai: "",
    jamSelesai: "",
    durasiMenit: 60,
    jumlahSoal: 0,
    isCbt: false,
    nilaiMinimum: 70,
    jumlahMengumpulkan: assignment.submittedCount,
    statusPenilaian:
      assignment.reviewStatus === "Selesai"
        ? "Sudah Dinilai"
        : "Belum Dinilai",
  }));
}

export function createInitialNilai(activeClass: ClassDetailData): NilaiSiswa[] {
  return activeClass.participants.map((student) => ({
    studentId: student.id,
    tugas: student.scores.tugas,
    scores: {
      uts: student.scores.uts,
      uas: student.scores.uas,
      uts1: null,
      uts2: null,
      uts3: null,
      tryout1: null,
      tryout2: null,
      tryout3: null,
    },
    note: "",
  }));
}

export function createEmptyMateri(
  kelasId: string,
  pertemuanKe: number,
): MateriPertemuan {
  return {
    id: createClientDraftId("materi"),
    kelasId,
    pertemuanKe,
    tanggal: "",
    judulMateri: "",
    deskripsi: "",
    linkMateri: "",
    statusMateri: "Draft",
  };
}

export function createEmptyTugas(
  kelasId: string,
  pertemuanKe: number,
  defaults: Partial<Pick<TugasPertemuan, "deadline" | "jamMulai" | "jamSelesai" | "durasiMenit">> = {},
): TugasPertemuan {
  return {
    id: createClientDraftId("tugas"),
    kelasId,
    pertemuanKe,
    judulTugas: "",
    deskripsi: "",
    deadline: defaults.deadline ?? "",
    jamMulai: defaults.jamMulai ?? "",
    jamSelesai: defaults.jamSelesai ?? "",
    durasiMenit: defaults.durasiMenit ?? 60,
    jumlahSoal: 0,
    isCbt: false,
    nilaiMinimum: 70,
    jumlahMengumpulkan: 0,
    statusPenilaian: "Belum Ada Pengumpulan",
  };
}

export function createEmptyNilai(studentId: string): NilaiSiswa {
  return {
    studentId,
    tugas: null,
    scores: {
      uts: null,
      uas: null,
      uts1: null,
      uts2: null,
      uts3: null,
      tryout1: null,
      tryout2: null,
      tryout3: null,
    },
    note: "",
  };
}
