import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const XLSX = require("../backend/node_modules/xlsx");

const ROOT = path.resolve("data/assessment-bank-xlsx");
const OUTPUT_ROOT = path.join(ROOT, "latihan");
const GENERATED_AT = "2026-08-09";
const MEETING_COUNT = 24;
const QUESTION_COUNT = 10;
const REVIEW_STATUS = "Perlu Review Guru";
const LETTERS = ["A", "B", "C", "D"];
const DIFFICULTIES = [
  "Mudah",
  "Mudah",
  "Mudah",
  "Sedang",
  "Sedang",
  "Sedang",
  "Sedang",
  "Sedang",
  "Sulit",
  "Sulit",
];
const COGNITIVE_LEVELS = ["C2", "C2", "C3", "C3", "C3", "C3", "C3", "C4", "C4", "C4"];

const regularClasses = [
  {
    className: "SD 4",
    level: "SD",
    grade: 4,
    phase: "Fase B",
    subjects: ["Matematika", "Bahasa Indonesia", "Bahasa Inggris", "IPA"],
  },
  {
    className: "SD 5",
    level: "SD",
    grade: 5,
    phase: "Fase C",
    subjects: ["Matematika", "Bahasa Indonesia", "Bahasa Inggris", "IPA"],
  },
  {
    className: "SD 6",
    level: "SD",
    grade: 6,
    phase: "Fase C",
    subjects: ["Matematika", "Bahasa Indonesia", "Bahasa Inggris", "IPA"],
  },
  {
    className: "SMP 7",
    level: "SMP",
    grade: 7,
    phase: "Fase D",
    subjects: ["Matematika", "Bahasa Indonesia", "Bahasa Inggris", "IPA", "IPS"],
  },
  {
    className: "SMP 8",
    level: "SMP",
    grade: 8,
    phase: "Fase D",
    subjects: ["Matematika", "Bahasa Indonesia", "Bahasa Inggris", "IPA", "IPS"],
  },
  {
    className: "SMP 9",
    level: "SMP",
    grade: 9,
    phase: "Fase D",
    subjects: ["Matematika", "Bahasa Indonesia", "Bahasa Inggris", "IPA", "IPS"],
  },
  {
    className: "SMA 10",
    level: "SMA",
    grade: 10,
    phase: "Fase E",
    subjects: [
      "Matematika",
      "Bahasa Indonesia",
      "Bahasa Inggris",
      "IPA",
      "IPS",
      "Biologi",
      "Fisika",
      "Kimia",
      "Ekonomi",
      "Sejarah",
    ],
  },
  {
    className: "SMA 11",
    level: "SMA",
    grade: 11,
    phase: "Fase F",
    subjects: [
      "Matematika",
      "Bahasa Indonesia",
      "Bahasa Inggris",
      "IPA",
      "IPS",
      "Biologi",
      "Fisika",
      "Kimia",
      "Ekonomi",
      "Sejarah",
    ],
  },
  {
    className: "SMA 12",
    level: "SMA",
    grade: 12,
    phase: "Fase F",
    subjects: [
      "Matematika",
      "Bahasa Indonesia",
      "Bahasa Inggris",
      "IPA",
      "IPS",
      "Biologi",
      "Fisika",
      "Kimia",
      "Ekonomi",
      "Sejarah",
    ],
  },
];

const utbkSubjects = [
  "TPS",
  "Literasi Bahasa Indonesia",
  "Literasi Bahasa Inggris",
  "Penalaran Matematika",
];

const topics = {
  Matematika: [
    "Bilangan dan nilai tempat",
    "Operasi hitung campuran",
    "Faktor, kelipatan, FPB, dan KPK",
    "Pecahan dan desimal",
    "Persen dan perbandingan",
    "Skala dan rasio",
    "Pola bilangan",
    "Persamaan linear",
    "Pertidaksamaan sederhana",
    "Fungsi dan relasi",
    "Sistem persamaan",
    "Bangun datar",
    "Bangun ruang",
    "Keliling, luas, dan volume",
    "Koordinat dan grafik",
    "Teorema Pythagoras",
    "Trigonometri dasar",
    "Barisan dan deret",
    "Statistika",
    "Peluang",
    "Logika matematika",
    "Transformasi geometri",
    "Eksponen dan akar",
    "Pemecahan masalah kontekstual",
  ],
  "Bahasa Indonesia": [
    "Gagasan utama",
    "Informasi tersurat",
    "Informasi tersirat",
    "Makna kata dalam konteks",
    "Kalimat efektif",
    "Paragraf padu",
    "Teks narasi",
    "Teks deskripsi",
    "Teks eksposisi",
    "Teks argumentasi",
    "Teks prosedur",
    "Teks laporan hasil observasi",
    "Puisi",
    "Drama",
    "Cerpen",
    "Surat resmi dan pribadi",
    "Iklan dan poster",
    "Teks ulasan",
    "Ejaan dan tanda baca",
    "Kohesi dan koherensi",
    "Artikel ilmiah populer",
    "Kritik dan esai",
    "Ringkasan",
    "Sintesis bacaan",
  ],
  "Bahasa Inggris": [
    "Vocabulary in context",
    "Main idea",
    "Specific information",
    "Inference",
    "Reference words",
    "Simple present tense",
    "Past tense",
    "Future plans",
    "Descriptive text",
    "Narrative text",
    "Procedure text",
    "Recount text",
    "Announcement",
    "Invitation",
    "Short message",
    "Dialogue expression",
    "Comparison degree",
    "Modals",
    "Passive voice",
    "Conditional sentence",
    "Cause and effect",
    "Analytical exposition",
    "Summary",
    "Reading synthesis",
  ],
  IPA: [
    "Makhluk hidup dan lingkungan",
    "Rantai makanan",
    "Sistem tubuh manusia",
    "Gaya dan gerak",
    "Energi dan perubahannya",
    "Suhu dan kalor",
    "Cahaya dan bunyi",
    "Listrik dan magnet",
    "Materi dan perubahan wujud",
    "Campuran dan pemisahan",
    "Bumi dan tata surya",
    "Cuaca dan iklim",
    "Tekanan",
    "Usaha dan pesawat sederhana",
    "Getaran dan gelombang",
    "Zat aditif dan adiktif",
    "Sistem pencernaan",
    "Sistem pernapasan",
    "Sistem peredaran darah",
    "Reproduksi",
    "Pewarisan sifat",
    "Bioteknologi",
    "Pencemaran lingkungan",
    "Metode ilmiah",
  ],
  IPS: [
    "Interaksi sosial",
    "Lembaga sosial",
    "Kegiatan ekonomi",
    "Permintaan dan penawaran",
    "Peta dan letak geografis",
    "Keragaman budaya",
    "Sejarah kerajaan Nusantara",
    "Kolonialisme",
    "Pergerakan nasional",
    "Proklamasi kemerdekaan",
    "Dinamika penduduk",
    "Mobilitas sosial",
    "Globalisasi",
    "Perdagangan internasional",
    "Ketenagakerjaan",
    "Inflasi",
    "APBN dan pajak",
    "Koperasi",
    "Sumber daya alam",
    "Mitigasi bencana",
    "ASEAN",
    "Konflik dan integrasi sosial",
    "Pembangunan berkelanjutan",
    "Analisis data sosial",
  ],
  Biologi: [
    "Keanekaragaman hayati",
    "Klasifikasi makhluk hidup",
    "Sel",
    "Jaringan tumbuhan dan hewan",
    "Sistem gerak",
    "Sistem peredaran darah",
    "Sistem pencernaan",
    "Sistem pernapasan",
    "Sistem ekskresi",
    "Sistem koordinasi",
    "Sistem reproduksi",
    "Fotosintesis",
    "Metabolisme",
    "Enzim",
    "Genetika Mendel",
    "DNA dan sintesis protein",
    "Evolusi",
    "Ekologi",
    "Daur biogeokimia",
    "Bioteknologi",
    "Virus",
    "Bakteri",
    "Imunitas",
    "Eksperimen biologi",
  ],
  Fisika: [
    "Besaran dan satuan",
    "Vektor",
    "Gerak lurus",
    "Hukum Newton",
    "Usaha dan energi",
    "Momentum dan impuls",
    "Gerak melingkar",
    "Fluida statis",
    "Fluida dinamis",
    "Suhu dan kalor",
    "Termodinamika",
    "Gelombang mekanik",
    "Bunyi",
    "Cahaya",
    "Listrik statis",
    "Listrik dinamis",
    "Magnet",
    "Induksi elektromagnetik",
    "Optik",
    "Fisika modern",
    "Radioaktivitas",
    "Elastisitas",
    "Gravitasi",
    "Analisis grafik fisika",
  ],
  Kimia: [
    "Struktur atom",
    "Sistem periodik unsur",
    "Ikatan kimia",
    "Bentuk molekul",
    "Stoikiometri",
    "Larutan elektrolit",
    "Reaksi redoks",
    "Tata nama senyawa",
    "Hukum dasar kimia",
    "Termokimia",
    "Laju reaksi",
    "Kesetimbangan kimia",
    "Asam basa",
    "Hidrolisis garam",
    "Larutan penyangga",
    "Kelarutan",
    "Elektrokimia",
    "Kimia organik",
    "Polimer",
    "Koloid",
    "Kimia lingkungan",
    "Minyak bumi",
    "Biokimia dasar",
    "Praktikum kimia",
  ],
  Ekonomi: [
    "Kebutuhan dan kelangkaan",
    "Masalah pokok ekonomi",
    "Sistem ekonomi",
    "Permintaan",
    "Penawaran",
    "Harga keseimbangan",
    "Elastisitas",
    "Pasar",
    "Biaya produksi",
    "Pendapatan nasional",
    "Pertumbuhan ekonomi",
    "Inflasi",
    "Bank dan lembaga keuangan",
    "Kebijakan moneter",
    "Kebijakan fiskal",
    "APBN dan APBD",
    "Pajak",
    "Akuntansi dasar",
    "Jurnal umum",
    "Buku besar",
    "Neraca saldo",
    "Perdagangan internasional",
    "Koperasi",
    "Analisis data ekonomi",
  ],
  Sejarah: [
    "Konsep berpikir sejarah",
    "Sumber sejarah",
    "Praaksara Indonesia",
    "Kerajaan Hindu-Buddha",
    "Kerajaan Islam",
    "Kedatangan bangsa Barat",
    "Kolonialisme",
    "Perlawanan daerah",
    "Pergerakan nasional",
    "Sumpah Pemuda",
    "Pendudukan Jepang",
    "Proklamasi",
    "Revolusi kemerdekaan",
    "Demokrasi liberal",
    "Demokrasi terpimpin",
    "Orde Baru",
    "Reformasi",
    "Perang Dunia",
    "Perang Dingin",
    "Organisasi internasional",
    "Sejarah lokal",
    "Historiografi",
    "Interpretasi sumber",
    "Kronologi dan sebab-akibat",
  ],
  TPS: [
    "Penalaran umum",
    "Analogi",
    "Logika proposisi",
    "Simpulan argumen",
    "Kesesuaian pernyataan",
    "Penalaran kuantitatif",
    "Pola angka",
    "Pola gambar",
    "Perbandingan kuantitatif",
    "Aritmetika sosial",
    "Aljabar dasar",
    "Geometri dasar",
    "Data tabel",
    "Data grafik",
    "Peluang sederhana",
    "Pemahaman bacaan",
    "Kelemahan argumen",
    "Penguatan argumen",
    "Asumsi",
    "Sebab akibat",
    "Konsistensi informasi",
    "Strategi eliminasi",
    "Ketelitian numerik",
    "Manajemen waktu",
  ],
  "Literasi Bahasa Indonesia": [
    "Ide pokok bacaan",
    "Tujuan penulis",
    "Nada dan sikap penulis",
    "Makna kata",
    "Rujukan kata",
    "Hubungan antarparagraf",
    "Simpulan",
    "Implikasi",
    "Evaluasi argumen",
    "Fakta dan opini",
    "Data dalam bacaan",
    "Grafik dalam teks",
    "Teks sains populer",
    "Teks sosial humaniora",
    "Teks sastra",
    "Ringkasan",
    "Parafrasa",
    "Ketepatan kalimat",
    "Kohesi",
    "Koherensi",
    "Perbandingan dua teks",
    "Sintesis informasi",
    "Kritik bacaan",
    "Strategi membaca cepat",
  ],
  "Literasi Bahasa Inggris": [
    "Main idea",
    "Author purpose",
    "Tone",
    "Vocabulary in context",
    "Reference",
    "Detail information",
    "Inference",
    "Implication",
    "Argument evaluation",
    "Fact and opinion",
    "Text organization",
    "Sentence insertion",
    "Paraphrase",
    "Summary",
    "Cause and effect",
    "Comparison",
    "Problem solution",
    "Academic passage",
    "Social issue passage",
    "Science passage",
    "Long text scanning",
    "Two-text synthesis",
    "Critical reading",
    "Reading pace",
  ],
  "Penalaran Matematika": [
    "Bilangan",
    "Pecahan",
    "Persen",
    "Rasio",
    "Aritmetika sosial",
    "Pola bilangan",
    "Aljabar",
    "Persamaan linear",
    "Sistem persamaan",
    "Fungsi",
    "Grafik fungsi",
    "Geometri datar",
    "Geometri ruang",
    "Pengukuran",
    "Koordinat",
    "Statistika",
    "Peluang",
    "Data tabel",
    "Data diagram",
    "Logika kuantitatif",
    "Optimasi sederhana",
    "Model matematika",
    "Estimasi",
    "Strategi penalaran",
  ],
};

const profiles = {
  Matematika: {
    method: "mengubah informasi menjadi model matematika, menyelesaikan langkahnya runtut, lalu memeriksa satuan atau hasil akhir",
    evidence: "hubungan antarbilangan, operasi yang sesuai, dan alasan perhitungan",
    misconception: "langsung memilih angka terbesar tanpa membaca operasi atau konteks",
    product: "model, perhitungan, dan kesimpulan yang konsisten",
  },
  "Bahasa Indonesia": {
    method: "menandai kata kunci, mencari bukti pada teks, lalu menyimpulkan sesuai isi bacaan",
    evidence: "kalimat pendukung, hubungan antarparagraf, dan konteks makna",
    misconception: "menjawab berdasarkan pendapat pribadi yang tidak didukung teks",
    product: "jawaban yang sesuai bukti dan tidak melebar dari pertanyaan",
  },
  "Bahasa Inggris": {
    method: "identifying keywords, grammar clues, and context before choosing the most accurate answer",
    evidence: "context clues, sentence function, and text purpose",
    misconception: "translating one word only and ignoring the whole sentence",
    product: "an answer that matches both meaning and grammar",
  },
  IPA: {
    method: "menghubungkan gejala, konsep, variabel, dan bukti pengamatan secara sebab-akibat",
    evidence: "data percobaan, ciri objek, dan perubahan yang dapat diamati",
    misconception: "menghafal istilah tanpa menjelaskan hubungan sebab-akibatnya",
    product: "penjelasan ilmiah yang sesuai data dan konsep",
  },
  IPS: {
    method: "membaca data sosial, ruang, waktu, dan hubungan sebab-akibat sebelum menarik kesimpulan",
    evidence: "fakta sejarah, peta, data ekonomi, dan kondisi sosial yang relevan",
    misconception: "menyamaratakan semua peristiwa tanpa melihat konteks tempat dan waktu",
    product: "analisis sosial yang runtut dan berbasis data",
  },
  Biologi: {
    method: "mengaitkan struktur, fungsi, proses kehidupan, dan bukti observasi",
    evidence: "ciri organisme, urutan proses, dan data eksperimen",
    misconception: "menyamakan semua proses biologis tanpa memperhatikan fungsi tiap bagian",
    product: "penjelasan proses biologi yang runtut dari sebab ke akibat",
  },
  Fisika: {
    method: "mengidentifikasi besaran, satuan, hubungan rumus, dan arah perubahan pada sistem",
    evidence: "data pengukuran, grafik, satuan, dan kondisi awal-akhir",
    misconception: "memasukkan angka ke rumus tanpa memeriksa satuan dan makna fisiknya",
    product: "jawaban dengan rumus, substitusi, satuan, dan interpretasi",
  },
  Kimia: {
    method: "mengenali partikel, reaksi, perbandingan mol, dan perubahan zat yang terjadi",
    evidence: "rumus kimia, koefisien reaksi, sifat zat, dan data percobaan",
    misconception: "menganggap koefisien, indeks, dan muatan memiliki fungsi yang sama",
    product: "penyelesaian yang sesuai konsep zat, reaksi, dan perhitungan kimia",
  },
  Ekonomi: {
    method: "membaca perubahan kebutuhan, insentif, biaya, manfaat, dan data pasar",
    evidence: "kurva, tabel, transaksi, serta hubungan pelaku ekonomi",
    misconception: "mengambil simpulan harga atau keuntungan tanpa melihat perubahan permintaan dan penawaran",
    product: "analisis ekonomi yang memakai data dan alasan sebab-akibat",
  },
  Sejarah: {
    method: "menyusun kronologi, membaca sumber, lalu menjelaskan sebab dan dampak peristiwa",
    evidence: "waktu kejadian, pelaku, sumber sejarah, dan konteks zamannya",
    misconception: "menghafal tanggal tanpa memahami keterkaitan antarperistiwa",
    product: "interpretasi sejarah yang kronologis dan berbasis sumber",
  },
  TPS: {
    method: "memilah premis, mengenali pola, mengecek konsistensi, lalu menyingkirkan opsi yang tidak logis",
    evidence: "hubungan antarpernyataan, pola data, dan batasan pada soal",
    misconception: "mengambil simpulan yang lebih luas daripada informasi yang tersedia",
    product: "jawaban paling logis berdasarkan premis dan data",
  },
  "Literasi Bahasa Indonesia": {
    method: "membaca struktur bacaan, bukti tekstual, sudut pandang penulis, dan hubungan ide",
    evidence: "pernyataan kunci, data dalam teks, dan arah argumentasi penulis",
    misconception: "memilih opsi yang terdengar benar tetapi tidak dinyatakan atau tidak didukung bacaan",
    product: "interpretasi bacaan yang tepat, ringkas, dan berbasis bukti",
  },
  "Literasi Bahasa Inggris": {
    method: "tracking the author's purpose, textual evidence, and relationships between ideas",
    evidence: "keywords, transition signals, references, and paragraph roles",
    misconception: "choosing an option because it contains the same word but has a different meaning",
    product: "a text-based interpretation that fits the passage as a whole",
  },
  "Penalaran Matematika": {
    method: "membuat model dari informasi, menalar pola, dan memilih strategi paling efisien",
    evidence: "data numerik, hubungan kuantitatif, grafik, dan batasan masalah",
    misconception: "menghitung cepat tanpa memeriksa apakah operasi sesuai konteks",
    product: "solusi kuantitatif yang masuk akal dan dapat dijelaskan",
  },
};

function slug(value) {
  return value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function questionSetId(scope, subject, meeting) {
  const classSlug = scope.kind === "utbk" ? "UTBK" : slug(scope.className).toUpperCase().replace(/-/g, "");
  return `LAT-${classSlug}-${slug(subject).toUpperCase().replace(/-/g, "")}-P${String(meeting).padStart(2, "0")}`;
}

function sentenceCase(value) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function topicFor(subject, meeting) {
  const subjectTopics = topics[subject] ?? topics.Matematika;
  return subjectTopics[(meeting - 1) % subjectTopics.length];
}

function formatNumber(value) {
  return new Intl.NumberFormat("id-ID").format(value);
}

function buildChoiceRow(correctText, wrongTexts, seed) {
  const answerIndex = seed % LETTERS.length;
  const uniqueWrongs = [];

  for (const wrongText of wrongTexts) {
    if (wrongText !== correctText && !uniqueWrongs.includes(wrongText)) {
      uniqueWrongs.push(wrongText);
    }
  }

  while (uniqueWrongs.length < 3) {
    uniqueWrongs.push(`Pilihan ini tidak sesuai dengan data pada soal ${uniqueWrongs.length + 1}.`);
  }

  const options = [];
  let wrongIndex = 0;

  for (let index = 0; index < LETTERS.length; index += 1) {
    if (index === answerIndex) {
      options.push(correctText);
    } else {
      options.push(uniqueWrongs[wrongIndex]);
      wrongIndex += 1;
    }
  }

  return {
    options,
    answer: LETTERS[answerIndex],
  };
}

function buildRowsFromSpecs(scope, subject, meeting, topic, specs) {
  return specs.map((spec, index) => {
    const order = index + 1;
    const { options, answer } = buildChoiceRow(spec.correct, spec.wrongs, meeting + order + subject.length);

    return {
      No: order,
      Soal: spec.stem,
      "Opsi A": options[0],
      "Opsi B": options[1],
      "Opsi C": options[2],
      "Opsi D": options[3],
      "Jawaban Benar": answer,
      Pembahasan: spec.explanation,
      Materi: topic,
      Level: DIFFICULTIES[index],
      "Level Kognitif": COGNITIVE_LEVELS[index],
      Fase: scope.kind === "utbk" ? "UTBK" : scope.phase,
      "Review Status": REVIEW_STATUS,
    };
  });
}

function buildMathQuestions(scope, subject, meeting, topic) {
  const grade = scope.kind === "utbk" ? 12 : scope.grade;
  const variant = meeting + grade;
  const a = 40 + variant * 3;
  const b = 8 + meeting;
  const c = 2 + (grade % 4);
  const operationAnswer = a + b * c;
  const price = 25000 + variant * 750;
  const discountPercent = grade <= 6 ? 10 : grade <= 9 ? 15 : 20;
  const discountAnswer = price - (price * discountPercent) / 100;
  const ratioA = 2 + (meeting % 4);
  const ratioB = 3 + (meeting % 5);
  const ratioTotal = (ratioA + ratioB) * (6 + (grade % 5));
  const ratioAnswer = (ratioA / (ratioA + ratioB)) * ratioTotal;
  const length = 8 + meeting;
  const width = 5 + (grade % 6);
  const areaAnswer = length * width;
  const coefficient = 3 + (meeting % 5);
  const xValue = 2 + (grade % 7);
  const constant = 4 + meeting;
  const equationRight = coefficient * xValue + constant;
  const data = [64 + meeting, 68 + grade, 72 + meeting, 76 + grade, 80 + meeting];
  const mean = data.reduce((sum, value) => sum + value, 0) / data.length;
  const sequenceFirst = 3 + (grade % 4);
  const difference = 2 + (meeting % 5);
  const sequenceAnswer = sequenceFirst + 7 * difference;
  const probabilityAnswer = `${meeting % 2 === 0 ? 3 : 2}/${meeting % 2 === 0 ? 8 : 5}`;
  const percentIncrease = 12 + (meeting % 6);
  const population = 200 + variant * 5;
  const populationAnswer = population + (population * percentIncrease) / 100;
  const tableA = 15 + meeting;
  const tableB = 20 + grade;
  const tableC = 18 + meeting + grade;
  const maxAnswer = Math.max(tableA, tableB, tableC);

  const specs = [
    {
      stem: `Pada materi ${topic}, hasil dari ${a} + ${b} x ${c} adalah ...`,
      correct: formatNumber(operationAnswer),
      wrongs: [
        formatNumber((a + b) * c),
        formatNumber(a * b + c),
        formatNumber(a + b + c),
      ],
      explanation: `Perkalian dikerjakan lebih dahulu: ${b} x ${c} = ${b * c}, lalu ${a} + ${b * c} = ${operationAnswer}.`,
    },
    {
      stem: `Sebuah buku seharga Rp${formatNumber(price)} mendapat diskon ${discountPercent}%. Harga setelah diskon adalah ...`,
      correct: `Rp${formatNumber(discountAnswer)}`,
      wrongs: [
        `Rp${formatNumber((price * discountPercent) / 100)}`,
        `Rp${formatNumber(price + (price * discountPercent) / 100)}`,
        `Rp${formatNumber(price - discountPercent)}`,
      ],
      explanation: `Diskon = ${discountPercent}% x Rp${formatNumber(price)}. Harga akhir = Rp${formatNumber(price)} - diskon = Rp${formatNumber(discountAnswer)}.`,
    },
    {
      stem: `Perbandingan uang Rani dan Dika adalah ${ratioA}:${ratioB}. Jika jumlah uang mereka Rp${formatNumber(ratioTotal * 1000)}, uang Rani adalah ...`,
      correct: `Rp${formatNumber(ratioAnswer * 1000)}`,
      wrongs: [
        `Rp${formatNumber(ratioB * 1000)}`,
        `Rp${formatNumber((ratioTotal - ratioAnswer) * 1000)}`,
        `Rp${formatNumber((ratioA + ratioB) * 1000)}`,
      ],
      explanation: `Bagian Rani = ${ratioA}/${ratioA + ratioB} x Rp${formatNumber(ratioTotal * 1000)} = Rp${formatNumber(ratioAnswer * 1000)}.`,
    },
    {
      stem: `Sebuah persegi panjang berukuran ${length} cm x ${width} cm. Luasnya adalah ...`,
      correct: `${areaAnswer} cm2`,
      wrongs: [
        `${2 * (length + width)} cm2`,
        `${length + width} cm2`,
        `${areaAnswer * 2} cm2`,
      ],
      explanation: `Luas persegi panjang = panjang x lebar = ${length} x ${width} = ${areaAnswer} cm2.`,
    },
    {
      stem: `Jika ${coefficient}x + ${constant} = ${equationRight}, nilai x adalah ...`,
      correct: String(xValue),
      wrongs: [String(xValue + 1), String(xValue - 1), String(equationRight)],
      explanation: `${coefficient}x = ${equationRight - constant}, sehingga x = ${xValue}.`,
    },
    {
      stem: `Data nilai ${data.join(", ")} memiliki rata-rata ...`,
      correct: String(mean),
      wrongs: [String(data[0]), String(data[2]), String(data.reduce((sum, value) => sum + value, 0))],
      explanation: `Jumlah data ${data.reduce((sum, value) => sum + value, 0)} dibagi 5 = ${mean}.`,
    },
    {
      stem: `Barisan ${sequenceFirst}, ${sequenceFirst + difference}, ${sequenceFirst + 2 * difference}, ${sequenceFirst + 3 * difference}, ... memiliki suku ke-8 sebesar ...`,
      correct: String(sequenceAnswer),
      wrongs: [
        String(sequenceFirst + 6 * difference),
        String(sequenceFirst + 8 * difference),
        String(sequenceFirst * 8),
      ],
      explanation: `Suku ke-8 = suku pertama + 7 x beda = ${sequenceFirst} + 7 x ${difference} = ${sequenceAnswer}.`,
    },
    {
      stem: `Di dalam kotak terdapat ${meeting % 2 === 0 ? 3 : 2} bola merah dari total ${meeting % 2 === 0 ? 8 : 5} bola. Peluang mengambil bola merah adalah ...`,
      correct: probabilityAnswer,
      wrongs: ["1/2", "1/4", "4/5"],
      explanation: `Peluang = banyak kejadian yang diinginkan dibagi banyak seluruh kejadian, yaitu ${probabilityAnswer}.`,
    },
    {
      stem: `Jumlah peserta bimbel ${population} orang naik ${percentIncrease}%. Jumlah peserta setelah kenaikan adalah ...`,
      correct: `${formatNumber(populationAnswer)} orang`,
      wrongs: [
        `${formatNumber(population - (population * percentIncrease) / 100)} orang`,
        `${formatNumber(population + percentIncrease)} orang`,
        `${formatNumber(population * percentIncrease)} orang`,
      ],
      explanation: `Kenaikan = ${percentIncrease}% x ${population} = ${(population * percentIncrease) / 100}. Jumlah baru = ${formatNumber(populationAnswer)} orang.`,
    },
    {
      stem: `Tabel hasil latihan menunjukkan kelas A ${tableA} siswa tuntas, kelas B ${tableB} siswa tuntas, dan kelas C ${tableC} siswa tuntas. Kelas dengan jumlah siswa tuntas terbanyak memiliki ... siswa.`,
      correct: String(maxAnswer),
      wrongs: [String(Math.min(tableA, tableB, tableC)), String(tableA + tableB), String(tableA + tableB + tableC)],
      explanation: `Bandingkan ketiga data: ${tableA}, ${tableB}, dan ${tableC}. Nilai terbesar adalah ${maxAnswer}.`,
    },
  ];

  return buildRowsFromSpecs(scope, subject, meeting, topic, specs);
}

function buildConceptQuestions(scope, subject, meeting, topic) {
  const profile = profiles[subject] ?? profiles.Matematika;
  const classLabel = scope.kind === "utbk" ? "UTBK" : scope.className;
  const scenario = `${classLabel} membahas ${topic} pada latihan P${meeting}`;
  const specs = [
    {
      stem: `Dalam konteks ${scenario}, pernyataan yang paling tepat tentang ${topic} adalah ...`,
      correct: `Materi ${topic} perlu dipahami melalui ${profile.evidence}.`,
      wrongs: [
        `Materi ${topic} cukup dijawab dengan memilih opsi yang paling panjang.`,
        `Materi ${topic} tidak perlu dikaitkan dengan konteks soal.`,
        sentenceCase(profile.misconception),
      ],
      explanation: `Pernyataan benar harus sesuai dengan bukti atau konsep utama. Pada ${topic}, acuan yang dipakai adalah ${profile.evidence}.`,
    },
    {
      stem: `Jika siswa diminta menyelesaikan soal ${subject} tentang ${topic}, langkah kerja yang paling tepat adalah ...`,
      correct: sentenceCase(profile.method),
      wrongs: [
        "Menebak jawaban sebelum membaca seluruh informasi.",
        "Menghafal satu istilah tanpa melihat hubungan antargagasan.",
        "Mengabaikan data, teks, atau konteks yang disediakan soal.",
      ],
      explanation: `Langkah yang tepat adalah memakai alur kerja sesuai konsep: ${profile.method}.`,
    },
    {
      stem: `Indikator bahwa siswa sudah menguasai materi ${topic} adalah ...`,
      correct: `Siswa mampu menghasilkan ${profile.product}.`,
      wrongs: [
        "Siswa hanya mengulang judul materi tanpa memberi alasan.",
        "Siswa memilih jawaban yang mirip dengan kata pada soal saja.",
        "Siswa mengabaikan pertanyaan utama dan membahas materi lain.",
      ],
      explanation: `Penguasaan materi terlihat dari kemampuan membuat ${profile.product}.`,
    },
    {
      stem: `Pada soal ${topic}, pilihan jawaban sebaiknya dieliminasi jika ...`,
      correct: `Tidak sesuai dengan ${profile.evidence}.`,
      wrongs: [
        "Memiliki kalimat yang pendek.",
        "Menggunakan kata yang sama dengan soal.",
        "Berada pada opsi A atau B.",
      ],
      explanation: `Eliminasi dilakukan berdasarkan ketidaksesuaian isi, bukan berdasarkan panjang kalimat atau posisi opsi.`,
    },
    {
      stem: `Kesalahan konsep yang paling sering terjadi saat mempelajari ${topic} adalah ...`,
      correct: sentenceCase(profile.misconception),
      wrongs: [
        `Mengecek kembali jawaban memakai ${profile.evidence}.`,
        `Menjelaskan jawaban dengan ${profile.method}.`,
        `Membandingkan opsi dengan konteks materi ${topic}.`,
      ],
      explanation: `Kesalahan konsep terjadi ketika siswa mengabaikan konteks dan bukti utama materi.`,
    },
    {
      stem: `Pembahasan yang baik untuk soal ${topic} harus memuat ...`,
      correct: `Alasan jawaban, bukti pendukung, dan kaitannya dengan ${topic}.`,
      wrongs: [
        "Kunci jawaban saja tanpa penjelasan.",
        "Cerita tambahan yang tidak berkaitan dengan soal.",
        "Daftar istilah tanpa hubungan sebab-akibat.",
      ],
      explanation: `Pembahasan perlu menjelaskan alasan jawaban agar siswa dapat belajar dari prosesnya.`,
    },
    {
      stem: `Ketika soal ${topic} menyajikan data atau teks, informasi yang harus diprioritaskan adalah ...`,
      correct: `Informasi yang langsung menjawab pertanyaan dan terkait dengan ${profile.evidence}.`,
      wrongs: [
        "Informasi paling akhir walaupun tidak relevan.",
        "Kata yang paling sering muncul tanpa melihat makna.",
        "Opsi yang sama persis dengan salah satu kalimat soal.",
      ],
      explanation: `Data atau teks harus dipilih berdasarkan relevansi terhadap pertanyaan utama.`,
    },
    {
      stem: `Soal HOTS pada materi ${topic} biasanya menuntut siswa untuk ...`,
      correct: `Menghubungkan informasi, mengevaluasi opsi, dan membuat simpulan yang sesuai konteks.`,
      wrongs: [
        "Menjawab dengan definisi tunggal tanpa analisis.",
        "Menghindari proses membandingkan pilihan jawaban.",
        "Menggunakan jawaban yang sama untuk semua tipe soal.",
      ],
      explanation: `Soal HOTS menuntut pemahaman hubungan antarinformasi, bukan sekadar menghafal.`,
    },
    {
      stem: `Jika terdapat dua opsi yang tampak mirip pada soal ${topic}, cara memilih jawaban terbaik adalah ...`,
      correct: `Membandingkan detail tiap opsi dengan pertanyaan utama dan bukti yang tersedia.`,
      wrongs: [
        "Memilih opsi yang muncul lebih dahulu.",
        "Memilih opsi yang bahasanya paling umum.",
        "Mengabaikan kata pembatas seperti selalu, hanya, atau kecuali.",
      ],
      explanation: `Opsi mirip harus dibandingkan dengan detail pada soal agar tidak terkecoh.`,
    },
    {
      stem: `Kesimpulan paling tepat setelah mempelajari ${topic} adalah ...`,
      correct: `Pemahaman materi kuat jika siswa mampu menjelaskan alasan jawaban dengan bukti yang relevan.`,
      wrongs: [
        "Semua soal dapat dijawab tanpa membaca konteks.",
        "Jawaban benar tidak perlu disertai alasan.",
        "Kata kunci selalu cukup untuk menentukan kunci jawaban.",
      ],
      explanation: `Tujuan latihan adalah membangun alasan yang benar, sehingga jawaban perlu didukung bukti relevan.`,
    },
  ];

  return buildRowsFromSpecs(scope, subject, meeting, topic, specs);
}

function buildQuestions(scope, subject, meeting) {
  const topic = topicFor(subject, meeting);

  if (subject === "Matematika" || subject === "Penalaran Matematika") {
    return buildMathQuestions(scope, subject, meeting, topic);
  }

  return buildConceptQuestions(scope, subject, meeting, topic);
}

function createWorkbook(rows) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows, {
    header: [
      "No",
      "Soal",
      "Opsi A",
      "Opsi B",
      "Opsi C",
      "Opsi D",
      "Jawaban Benar",
      "Pembahasan",
      "Materi",
      "Level",
      "Level Kognitif",
      "Fase",
      "Review Status",
    ],
  });

  sheet["!cols"] = [
    { wch: 6 },
    { wch: 72 },
    { wch: 48 },
    { wch: 48 },
    { wch: 48 },
    { wch: 48 },
    { wch: 14 },
    { wch: 80 },
    { wch: 30 },
    { wch: 12 },
    { wch: 14 },
    { wch: 12 },
    { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(workbook, sheet, "Soal");

  return workbook;
}

function validateRows(rows, context) {
  if (rows.length !== QUESTION_COUNT) {
    throw new Error(`${context}: jumlah soal ${rows.length}, seharusnya ${QUESTION_COUNT}`);
  }

  rows.forEach((row, index) => {
    const requiredFields = [
      "Soal",
      "Opsi A",
      "Opsi B",
      "Opsi C",
      "Opsi D",
      "Jawaban Benar",
      "Pembahasan",
      "Materi",
      "Level",
    ];

    for (const field of requiredFields) {
      if (!String(row[field] ?? "").trim()) {
        throw new Error(`${context} baris ${index + 2}: ${field} kosong`);
      }
    }

    if (!LETTERS.includes(row["Jawaban Benar"])) {
      throw new Error(`${context} baris ${index + 2}: jawaban benar tidak valid`);
    }

    const optionValues = ["Opsi A", "Opsi B", "Opsi C", "Opsi D"].map((field) => row[field]);
    if (new Set(optionValues).size !== optionValues.length) {
      throw new Error(`${context} baris ${index + 2}: opsi jawaban duplikat`);
    }
  });
}

async function writeWorkbook(filePath, rows) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  validateRows(rows, filePath);
  XLSX.writeFile(createWorkbook(rows), filePath, { compression: true });
}

function buildIndexWorkbook(indexRows, blueprintRows, validationRows) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(indexRows), "Index");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(blueprintRows), "Blueprint");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(validationRows), "Validation");
  return workbook;
}

function readmeText(summary) {
  return `# Bank Soal Latihan CBT P1-P24

Folder ini berisi draft soal latihan CBT untuk kelas 4 sampai 12 dan UTBK.

## Cakupan

- Kelas reguler: SD 4, SD 5, SD 6, SMP 7, SMP 8, SMP 9, SMA 10, SMA 11, SMA 12.
- UTBK: TPS, Literasi Bahasa Indonesia, Literasi Bahasa Inggris, dan Penalaran Matematika.
- Pertemuan: P1 sampai P24.
- Jumlah soal: ${QUESTION_COUNT} soal per file.
- Total set: ${summary.setCount}.
- Total soal: ${summary.questionCount}.

## Struktur

- \`regular/<kelas>/<mapel>/<mapel>-pXX.xlsx\`: file upload-ready untuk latihan kelas reguler.
- \`utbk/<mapel>/<mapel>-pXX.xlsx\`: bank latihan UTBK.
- \`latihan-index.xlsx\`: daftar seluruh file dan metadata ringkas.
- \`latihan-blueprint.xlsx\`: kisi-kisi per nomor soal.
- \`latihan-validation-report.xlsx\`: hasil validasi struktur.

## Catatan Import

Setiap file per-P hanya memiliki sheet pertama bernama \`Soal\`, tanpa sheet \`Metadata\`, agar kompatibel dengan parser upload CBT latihan saat ini.
Soal ini adalah draft awal dan tetap perlu review guru sebelum dipakai ke siswa.
Jika file sudah diunggah sebagai soal latihan, histori pengerjaan siswa akan dapat menampilkan soal, jawaban siswa, kunci, dan pembahasan melalui halaman review CBT.
`;
}

async function main() {
  const indexRows = [];
  const blueprintRows = [];
  const validationRows = [];

  for (const classScope of regularClasses) {
    for (const subject of classScope.subjects) {
      for (let meeting = 1; meeting <= MEETING_COUNT; meeting += 1) {
        const setId = questionSetId({ ...classScope, kind: "regular" }, subject, meeting);
        const rows = buildQuestions({ ...classScope, kind: "regular" }, subject, meeting);
        const relativePath = path.join(
          "latihan",
          "regular",
          slug(classScope.className),
          slug(subject),
          `${slug(subject)}-p${String(meeting).padStart(2, "0")}.xlsx`,
        );
        const filePath = path.join(ROOT, relativePath);

        await writeWorkbook(filePath, rows);

        indexRows.push({
          questionSetId: setId,
          assessmentType: "Latihan",
          segment: "regular",
          level: classScope.level,
          className: classScope.className,
          phase: classScope.phase,
          subject,
          meetingNumber: meeting,
          meetingCode: `P${meeting}`,
          questionCount: QUESTION_COUNT,
          suggestedDurationMinutes: 30,
          filePath: relativePath.replaceAll("\\", "/"),
          reviewStatus: REVIEW_STATUS,
          generatedAt: GENERATED_AT,
        });

        rows.forEach((row) => {
          blueprintRows.push({
            questionSetId: setId,
            questionNumber: row.No,
            segment: "regular",
            className: classScope.className,
            subject,
            meetingNumber: meeting,
            topic: row.Materi,
            difficulty: row.Level,
            cognitiveLevel: row["Level Kognitif"],
            reviewStatus: REVIEW_STATUS,
          });
        });

        validationRows.push({
          questionSetId: setId,
          filePath: relativePath.replaceAll("\\", "/"),
          passed: true,
          questionCount: QUESTION_COUNT,
          note: "Struktur file valid untuk upload CBT latihan.",
        });
      }
    }
  }

  for (const subject of utbkSubjects) {
    for (let meeting = 1; meeting <= MEETING_COUNT; meeting += 1) {
      const scope = {
        kind: "utbk",
        className: "UTBK",
        level: "UTBK",
        grade: 12,
        phase: "UTBK",
      };
      const setId = questionSetId(scope, subject, meeting);
      const rows = buildQuestions(scope, subject, meeting);
      const relativePath = path.join(
        "latihan",
        "utbk",
        slug(subject),
        `${slug(subject)}-p${String(meeting).padStart(2, "0")}.xlsx`,
      );
      const filePath = path.join(ROOT, relativePath);

      await writeWorkbook(filePath, rows);

      indexRows.push({
        questionSetId: setId,
        assessmentType: "Latihan",
        segment: "utbk",
        level: "UTBK",
        className: "UTBK",
        phase: "UTBK",
        subject,
        meetingNumber: meeting,
        meetingCode: `P${meeting}`,
        questionCount: QUESTION_COUNT,
        suggestedDurationMinutes: 35,
        filePath: relativePath.replaceAll("\\", "/"),
        reviewStatus: REVIEW_STATUS,
        generatedAt: GENERATED_AT,
      });

      rows.forEach((row) => {
        blueprintRows.push({
          questionSetId: setId,
          questionNumber: row.No,
          segment: "utbk",
          className: "UTBK",
          subject,
          meetingNumber: meeting,
          topic: row.Materi,
          difficulty: row.Level,
          cognitiveLevel: row["Level Kognitif"],
          reviewStatus: REVIEW_STATUS,
        });
      });

      validationRows.push({
        questionSetId: setId,
        filePath: relativePath.replaceAll("\\", "/"),
        passed: true,
        questionCount: QUESTION_COUNT,
        note: "Struktur file valid untuk bank latihan UTBK.",
      });
    }
  }

  const summary = {
    setCount: indexRows.length,
    questionCount: blueprintRows.length,
    regularSetCount: indexRows.filter((row) => row.segment === "regular").length,
    utbkSetCount: indexRows.filter((row) => row.segment === "utbk").length,
  };

  await fs.mkdir(OUTPUT_ROOT, { recursive: true });
  XLSX.writeFile(
    buildIndexWorkbook(indexRows, blueprintRows, validationRows),
    path.join(OUTPUT_ROOT, "latihan-index.xlsx"),
    { compression: true },
  );
  XLSX.writeFile(
    buildIndexWorkbook(indexRows, blueprintRows, validationRows),
    path.join(ROOT, "latihan-bank-index.xlsx"),
    { compression: true },
  );
  XLSX.writeFile(
    buildIndexWorkbook([], blueprintRows, []),
    path.join(OUTPUT_ROOT, "latihan-blueprint.xlsx"),
    { compression: true },
  );
  XLSX.writeFile(
    buildIndexWorkbook([], [], validationRows),
    path.join(OUTPUT_ROOT, "latihan-validation-report.xlsx"),
    { compression: true },
  );
  await fs.writeFile(path.join(OUTPUT_ROOT, "README.md"), readmeText(summary), "utf8");

  console.log(JSON.stringify(summary, null, 2));
}

await main();
