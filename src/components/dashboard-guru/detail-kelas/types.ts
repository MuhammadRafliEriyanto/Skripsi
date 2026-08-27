import type { LucideIcon } from "lucide-react";

import type {
  ClassAttendanceSession,
  ClassDetailData,
  ClassStudent,
} from "@/components/dashboard-guru/data/guruClassTypes";
import type { AcademicGradeScheme, AcademicScores } from "@/lib/academic-grades";
import type { AcademicScoreKey } from "@/lib/academic-grades";

export type DetailSection =
  | "peserta"
  | "absensi"
  | "pertemuan"
  | "tugas"
  | "belum-dinilai"
  | "nilai";

export type GradeStatus =
  | "Belum Dinilai"
  | "Sangat Baik"
  | "Baik"
  | "Perlu Bimbingan"
  | "Perlu Remedial";
export type MateriStatus = "Draft" | "Dipublikasikan";
export type TugasStatusPenilaian =
  | "Belum Ada Pengumpulan"
  | "Sudah Dinilai"
  | "Belum Dinilai"
  | "Perlu Remedial";
export type DialogMode = "add" | "edit";

export type LearningAttachmentMeta = {
  attachmentFileName?: string;
  attachmentMimeType?: string;
  attachmentSize?: number;
  attachmentUrl?: string;
};

export type MateriPertemuan = {
  id: string;
  kelasId: string;
  pertemuanKe: number;
  tanggal: string;
  judulMateri: string;
  deskripsi: string;
  linkMateri?: string;
  statusMateri: MateriStatus;
} & LearningAttachmentMeta;

export type TugasPertemuan = {
  id: string;
  kelasId: string;
  pertemuanKe: number;
  judulTugas: string;
  deskripsi: string;
  deadline: string;
  jamMulai: string;
  jamSelesai: string;
  durasiMenit: number;
  jumlahSoal: number;
  isCbt: boolean;
  nilaiMinimum: number | null;
  jumlahMengumpulkan: number;
  statusPenilaian: TugasStatusPenilaian;
} & LearningAttachmentMeta;

export type TaskSubmissionMode = "file" | "text" | "drive" | "cbt";
export type TaskSubmissionGradeStatus =
  | "Belum Dinilai"
  | "Sudah Dinilai"
  | "Perlu Remedial";

export type TaskSubmissionListItem = {
  id: string;
  submissionId: string;
  studentId: string;
  studentName: string;
  submissionMode: TaskSubmissionMode;
  submittedAt: string | null;
  hasAttachment: boolean;
  driveUrl: string;
  answerTextPreview: string;
  gradeStatus: TaskSubmissionGradeStatus;
  score: number | null;
};

export type TaskSubmissionDetail = TaskSubmissionListItem & {
  classId: string;
  taskId: string;
  answerText: string;
  note: string;
  attachmentFileName?: string;
  attachmentOriginalName?: string;
  attachmentMimeType?: string;
  attachmentSize?: number;
  attachmentUrl?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type NilaiSiswa = {
  studentId: string;
  tugas: number | null;
  scores: AcademicScores;
  note: string;
  pertemuanScores?: Record<number, number | null>;
  pertemuanStatuses?: Record<number, TaskSubmissionGradeStatus>;
};

export type NilaiDraft = NilaiSiswa;

export type DetailSectionItem = {
  key: DetailSection;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
};

export type DetailKelasSidebarProps = {
  activeSection: DetailSection;
  onSectionChange: (section: DetailSection) => void;
  sectionItems: DetailSectionItem[];
};

export type PesertaKelasTableProps = {
  activeClass: ClassDetailData;
};

export type AbsensiPertemuanTableProps = {
  kelasName: string;
  participants: ClassStudent[];
  sessions: ClassAttendanceSession[];
};

export type DetailPertemuanTableProps = {
  kelasName: string;
  materials: MateriPertemuan[];
  totalMeetings: number;
  readOnly?: boolean;
  readOnlyMessage?: string;
  onAdd: () => void;
  onEdit: (material: MateriPertemuan) => void;
  onDelete: (materialId: string) => void;
};

export type TugasPertemuanTableProps = {
  kelasName: string;
  tasks: TugasPertemuan[];
  readOnly?: boolean;
  readOnlyMessage?: string;
  onAdd: () => void;
  onEdit: (task: TugasPertemuan) => void;
  onDelete: (taskId: string) => void;
  onGrade: (task: TugasPertemuan) => void;
  onViewSubmissions: (task: TugasPertemuan) => void;
};

export type BelumDinilaiTableProps = {
  kelasName: string;
  tasks: TugasPertemuan[];
  readOnly?: boolean;
  readOnlyMessage?: string;
  onGradeNow: (task: TugasPertemuan) => void;
};

export type TabelNilaiTableProps = {
  participants: ClassStudent[];
  nilaiRows: NilaiSiswa[];
  readOnly?: boolean;
  readOnlyMessage?: string;
  onEditNilai: (studentId: string) => void;
  scheme: AcademicGradeScheme;
  includeTaskScore?: boolean;
};

export type MateriFormDialogProps = {
  draft: MateriPertemuan | null;
  mode: DialogMode;
  onChange: (field: keyof MateriPertemuan, value: string | number) => void;
  onAttachmentChange: (file: File | null) => void;
  onClearSelectedAttachment: () => void;
  onRemoveExistingAttachment: () => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
  open: boolean;
  selectedAttachmentName?: string;
  existingAttachmentName?: string;
  attachmentMarkedForRemoval?: boolean;
};

export type TugasFormDialogProps = {
  draft: TugasPertemuan | null;
  mode: DialogMode;
  onChange: (field: keyof TugasPertemuan, value: string | number | boolean) => void;
  onAttachmentChange: (file: File | null) => void;
  onClearSelectedAttachment: () => void;
  onRemoveExistingAttachment: () => void;
  onCancelRemoveAttachment?: () => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
  open: boolean;
  selectedAttachmentName?: string;
  existingAttachmentName?: string;
  attachmentMarkedForRemoval?: boolean;
};

export type NilaiFormDialogProps = {
  draft: NilaiDraft | null;
  mode: DialogMode;
  onChange: (field: keyof NilaiDraft, value: string | number) => void;
  onAcademicScoreChange: (
    field: AcademicScoreKey,
    value: string | number,
  ) => void;
  onOpenChange: (open: boolean) => void;
  onStudentChange: (studentId: string) => void;
  onTaskChange: (taskId: string) => void;
  onSubmit: () => void;
  open: boolean;
  participants: ClassStudent[];
  selectedStudentId: string;
  selectedTask: TugasPertemuan | null;
  tasks: TugasPertemuan[];
  scheme: AcademicGradeScheme;
  includeTaskScore?: boolean;
};

export type TaskSubmissionReviewDialogProps = {
  kelasName: string;
  open: boolean;
  task: TugasPertemuan | null;
  submissions: TaskSubmissionListItem[];
  selectedSubmissionId: string;
  submissionDetail: TaskSubmissionDetail | null;
  isListLoading: boolean;
  isDetailLoading: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectSubmission: (submissionId: string) => void;
  onGradeSubmission?: (studentId: string) => void;
};
