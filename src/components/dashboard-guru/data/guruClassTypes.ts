export type JenjangFilter = "Semua" | "SD" | "SMP" | "SMA";
export type GuruJenjang = Exclude<JenjangFilter, "Semua">;
export type ClassStatus = "Aktif" | "Berjalan" | "Selesai";
export type StudentStatus = "Aktif" | "Perlu Pendampingan" | "Cadangan";
export type PresenceStatus =
  | "Belum Absen"
  | "Hadir"
  | "Sakit"
  | "Izin"
  | "Alpa";
export type AssignmentReviewStatus =
  | "Belum Dinilai"
  | "Sebagian Dinilai"
  | "Selesai";
export type AttendanceSessionStatus = "Berlangsung" | "Ditutup";

export const DEFAULT_SEMESTER_MEETING_TARGET = 24;

export type GuruClassSummary = {
  kelasId: string;
  namaKelas: string;
  guru: string;
  jenjang: GuruJenjang;
  tingkat: string;
  mapel: string;
  program: string;
  jadwal: string;
  ruangan: string;
  totalSiswa: number;
  totalPertemuan: number;
  pertemuanSelesai: number;
  tugasBelumDinilai: number;
  aktifMingguIni: boolean;
  status: ClassStatus;
};

export type StudentMeetingHistory = {
  sessionId: string;
  meetingNumber: number;
  meeting: string;
  date: string;
  material: string;
  attendance: PresenceStatus;
  note: string;
  markedAt?: string | null;
};

export type ClassStudent = {
  id: string;
  name: string;
  classLevel: string;
  branch: string;
  status: StudentStatus;
  history: StudentMeetingHistory[];
  scores: {
    tugas: number;
    uts: number;
    uas: number;
  };
};

export type ClassMeeting = {
  id: string;
  meeting: string;
  date: string;
  material: string;
  focus: string;
  attendanceSummary: string;
  note: string;
};

export type ClassAttendanceSession = {
  sessionId: string;
  meetingNumber: number;
  meeting: string;
  date: string;
  startTime: string;
  subject: string;
  room: string;
  status: AttendanceSessionStatus;
  summary: {
    hadir: number;
    sakit: number;
    izin: number;
    alpa: number;
    belumAbsen: number;
  };
  attendanceSummary: string;
};

export type ClassAssignment = {
  id: string;
  meeting: string;
  title: string;
  deadline: string;
  submittedCount: number;
  totalStudents: number;
  pendingReviewCount: number;
  reviewStatus: AssignmentReviewStatus;
  teacherNote: string;
};

export type ClassDetailData = GuruClassSummary & {
  participants: ClassStudent[];
  meetings: ClassMeeting[];
  assignments: ClassAssignment[];
  attendanceSessions: ClassAttendanceSession[];
};

export const JENJANG_ITEMS: JenjangFilter[] = ["Semua", "SD", "SMP", "SMA"];

export const CLASS_FILTERS: Record<GuruJenjang, string[]> = {
  SD: ["Kelas 4", "Kelas 5", "Kelas 6"],
  SMP: ["Kelas 7", "Kelas 8", "Kelas 9"],
  SMA: ["Kelas 10", "Kelas 11", "Kelas 12"],
};
