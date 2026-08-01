export type UtbkSubjectInfo = {
  label: string;
  shortLabel: string;
  description: string;
};

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

const UTBK_SUBJECTS_BY_KEY: Record<string, UtbkSubjectInfo> = {
  tps: {
    label: "Tes Potensi Skolastik (TPS)",
    shortLabel: "TPS",
    description:
      "Sesi UTBK untuk melatih penalaran umum, pemahaman bacaan, dan kemampuan kuantitatif dasar.",
  },
  "tes potensi skolastik": {
    label: "Tes Potensi Skolastik (TPS)",
    shortLabel: "TPS",
    description:
      "Sesi UTBK untuk melatih penalaran umum, pemahaman bacaan, dan kemampuan kuantitatif dasar.",
  },
  "tes potensi skolastik (tps)": {
    label: "Tes Potensi Skolastik (TPS)",
    shortLabel: "TPS",
    description:
      "Sesi UTBK untuk melatih penalaran umum, pemahaman bacaan, dan kemampuan kuantitatif dasar.",
  },
  "literasi bahasa indonesia": {
    label: "Literasi Bahasa Indonesia",
    shortLabel: "Literasi Indonesia",
    description:
      "Sesi UTBK untuk melatih pemahaman bacaan, gagasan utama, dan ketepatan berbahasa Indonesia.",
  },
  "literasi bahasa inggris": {
    label: "Literasi Bahasa Inggris",
    shortLabel: "Literasi Inggris",
    description:
      "Sesi UTBK untuk melatih pemahaman teks bahasa Inggris, konteks bacaan, dan kosakata akademik.",
  },
  "penalaran matematika": {
    label: "Penalaran Matematika",
    shortLabel: "Penalaran Matematika",
    description:
      "Sesi UTBK untuk melatih penalaran kuantitatif, pola, dan pemecahan masalah matematika.",
  },
  "strategi snbt": {
    label: "Strategi SNBT",
    shortLabel: "Strategi SNBT",
    description:
      "Sesi UTBK untuk membahas strategi pengerjaan soal, manajemen waktu, dan prioritas belajar.",
  },
  "pembahasan tryout utbk": {
    label: "Pembahasan Tryout UTBK",
    shortLabel: "Pembahasan Tryout",
    description:
      "Sesi UTBK untuk membahas hasil tryout dan memperkuat bagian materi yang masih perlu dilatih.",
  },
};

export function getUtbkSubjectInfo(
  subject: string | null | undefined,
): UtbkSubjectInfo {
  const normalizedSubject = normalizeText(subject);
  const subjectInfo = UTBK_SUBJECTS_BY_KEY[normalizedSubject.toLowerCase()];

  if (subjectInfo) {
    return subjectInfo;
  }

  return {
    label: normalizedSubject || "Materi UTBK",
    shortLabel: normalizedSubject || "UTBK",
    description: "Sesi belajar UTBK/SNBT sesuai jadwal kelas.",
  };
}

export function formatUtbkSubjectLabel(subject: string | null | undefined) {
  return getUtbkSubjectInfo(subject).label;
}
