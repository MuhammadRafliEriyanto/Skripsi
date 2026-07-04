import type { AcademicGradeScheme, AcademicScores } from "@/lib/academic-grades";

export type SubmissionMode = "file" | "text" | "drive";

export type StudentAcademicSummary = {
  classId: string;
  className: string;
  subject: string;
  scheme: AcademicGradeScheme;
  academicYear: string;
  semester: string;
  taskAverage: number | null;
  gradedTaskCount: number;
  scores: AcademicScores;
  note: string;
  finalAverage: number | null;
  evaluatedAt: string | null;
};

export type StudentMaterial = {
  id: string;
  mapel: string;
  judul: string;
  pertemuan: number;
  durasi: string;
  format: "PDF" | "Video" | "Modul";
  status: "Baru" | "Dipelajari";
  ringkasan: string;
  diperbarui: string;
  href: string;
  downloadName: string;
  downloadUrl: string;
  previewHeading: string;
  previewBody: string;
  previewPoints: string[];
};

export type StudentTaskStatus =
  | "Belum Dikerjakan"
  | "Menunggu Dikirim"
  | "Sudah Dikirim"
  | "Sudah Dinilai";

export type StudentTaskGradeStatus = "Belum Dinilai" | "Sudah Dinilai";

export type StudentTaskSubmissionSummary = {
  submitted: boolean;
  submissionId: string | null;
  submissionMode: SubmissionMode | null;
  submittedAt: string | null;
  hasAttachment: boolean;
  driveUrl: string;
  answerTextPreview: string;
};

export type StudentTaskGradeSummary = {
  graded: boolean;
  gradeId: string | null;
  score: number | null;
  note: string;
  status: StudentTaskGradeStatus;
  gradedAt: string | null;
};

export type StudentTaskSubmissionAttachment = {
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
};

export type StudentTaskSubmissionDetail = {
  id: string;
  submissionId: string;
  classId: string;
  taskId: string;
  studentId: string;
  submissionMode: SubmissionMode;
  answerText: string;
  driveUrl: string;
  note: string;
  attachment: StudentTaskSubmissionAttachment | null;
  submittedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type StudentTask = {
  id: string;
  classId: string;
  className: string;
  mapel: string;
  judul: string;
  pertemuan: number;
  deadline: string;
  estimasi: string;
  poin: string;
  status: StudentTaskStatus;
  deskripsi: string;
  detailHref: string;
  submitHref: string;
  attachmentName?: string;
  attachmentUrl?: string;
  submissionModes: SubmissionMode[];
  instruksiPengumpulan: string[];
  mySubmission?: StudentTaskSubmissionSummary;
  myGrade?: StudentTaskGradeSummary;
};
