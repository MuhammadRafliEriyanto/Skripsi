export const QUESTION_PROGRAM_OPTIONS = ["SD", "SMP", "SMA"] as const;

export const QUESTION_CLASS_OPTIONS: Record<string, string[]> = {
  SD: ["SD 1", "SD 2", "SD 3", "SD 4", "SD 5", "SD 6"],
  SMP: ["SMP 7", "SMP 8", "SMP 9"],
  SMA: ["SMA 10", "SMA 11", "SMA 12"],
};

const CORE_SUBJECTS = ["Matematika", "Bahasa Indonesia", "Bahasa Inggris", "PPKn"];

export const QUESTION_SUBJECT_OPTIONS: Record<string, string[]> = {
  SD: [...CORE_SUBJECTS, "IPA", "IPS", "Pendidikan Agama", "PJOK", "Seni Budaya"],
  SMP: [...CORE_SUBJECTS, "IPA", "IPS", "Pendidikan Agama", "PJOK", "Seni Budaya", "Informatika"],
  SMA: [
    ...CORE_SUBJECTS,
    "Fisika",
    "Kimia",
    "Biologi",
    "Ekonomi",
    "Geografi",
    "Sosiologi",
    "Sejarah",
    "Pendidikan Agama",
    "PJOK",
    "Seni Budaya",
    "Informatika",
  ],
};

export const QUESTION_ALL_SUBJECT_OPTIONS = [
  "Semua Mapel",
  ...Array.from(new Set(Object.values(QUESTION_SUBJECT_OPTIONS).flat())),
];
