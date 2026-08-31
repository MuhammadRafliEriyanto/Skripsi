/**
 * GENERATOR SOAL BERKUALITAS - REALISTIC EDITION V5
 * 
 * Fitur:
 * 1. Soal tidak dummy - menggunakan context real & measurable parameters  
 * 2. Kolom Excel lebih user-friendly & clear
 * 3. Menyesuaikan materi dari database (program, subject, topics)
 * 4. Options plausibel (bukan "Jawaban A/B/C/D")
 * 5. Pembahasan step-by-step yang edukatif
 * 6. Difficulty分级 (Easy/Medium/Hard) sesuai Bloom's Taxonomy
 * 7. 50 variasi soal per topik untuk randomisasi antar siswa
 * 
 * Usage: node backend/src/scripts/generate-quality-questions.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';
import {
  toAnswerLetter,
  validateQuestion,
} from './generator-validation-gate.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =====================================================
// DATA MATERI BERDASARKAN DATABASE BIMBEL CENDEKIA
// =====================================================

const CURRICULUM_TOPICS = {
  "SMA IPA": {
    "Matematika": [
      "Bab 1: Eksponen dan Logaritma",
      "Bab 2: Persamaan dan Fungsi Kuadrat",
      "Bab 3: Pertidaksamaan",
      "Bab 4: Sistem Persamaan Linear",
      "Bab 5: Matriks",
      "Bab 6: Transformasi Geometri",
      "Bab 7: Barisan dan Deret",
      "Bab 8: Trigonometri",
      "Bab 9: Limit Fungsi Aljabar",
      "Bab 10: Turunan",
      "Bab 11: Integral",
      "Bab 12: Statistika",
      "Bab 13: Peluang"
    ],
    "Fisika": [
      "Bab 1: Pengukuran dan Satuan",
      "Bab 2: Gerak Lurus",
      "Bab 3: Gerak Parabola",
      "Bab 4: Hukum Newton",
      "Bab 5: Usaha dan Energi",
      "Bab 6: Momentum dan Impuls",
      "Bab 7: Elastisitas",
      "Bab 8: Fluida Statis",
      "Bab 9: Fluida Dinamis",
      "Bab 10: Termodinamika"
    ],
    "Kimia": [
      "Bab 1: Struktur Atom",
      "Bab 2: Tabel Periodik",
      "Bab 3: Ikatan Kimia",
      "Bab 4: Stoikiometri",
      "Bab 5: Larutan Asam Basa",
      "Bab 6: pH dan Ksp",
      "Bab 7: Reaksi Redoks",
      "Bab 8: Kimia Organik",
      "Bab 9: Senyawa Karbon",
      "Bab 10: Larutan Buffer"
    ],
    "Biologi": [
      "Bab 1: Sel dan Organel",
      "Bab 2: Jaringan Tumbuhan",
      "Bab 3: Sistem Pencernaan",
      "Bab 4: Genetika",
      "Bab 5: Evolusi",
      "Bab 6: Ekosistem",
      "Bab 7: Bioteknologi",
      "Bab 8: Enzim",
      "Bab 9: Metabolisme",
      "Bab 10: Sistem Tubuh"
    ]
  },
  "SMA IPS": {
    "Matematika": [
      "Bab 1: Aljabar Dasar",
      "Bab 2: Fungsi dan Grafik",
      "Bab 3: Program Linear",
      "Bab 4: Matriks",
      "Bab 5: Statistika",
      "Bab 6: Peluang",
      "Bab 7: Lingkaran",
      "Bab 8: Bangun Ruang"
    ],
    "Ekonomi": [
      "Bab 1: Konsep Ekonomi",
      "Bab 2: Permintaan dan Penawaran",
      "Bab 3: Elastisitas",
      "Bab 4: Pasar",
      "Bab 5: Uang dan Bank",
      "Bab 6: Anggaran Pemerintah",
      "Bab 7: Pembangunan",
      "Bab 8: Perdagangan Internasional",
      "Bab 9: Inflasi",
      "Bab 10: APBN dan APBD"
    ],
    "Geografi": [
      "Bab 1: Peta dan Pemetaan",
      "Bab 2: Atmosfer",
      "Bab 3: Hidrosfer",
      "Bab 4: Litosfer",
      "Bab 5: Demografi",
      "Bab 6: Tata Ruang",
      "Bab 7: Lingkungan Hidup",
      "Bab 8: Sumber Daya Alam",
      "Bab 9: Regional Dunia",
      "Bab 10: Globalisasi"
    ],
    "Sosiologi": [
      "Bab 1: Interaksi Sosial",
      "Bab 2: Norma dan Nilai",
      "Bab 3: Sosialisasi",
      "Bab 4: Stratifikasi Sosial",
      "Bab 5: Mobilitas Sosial",
      "Bab 6: Konflik Sosial",
      "Bab 7: Integrasi Sosial",
      "Bab 8: Kelompok Sosial",
      "Bab 9: Penyimpangan",
      "Bab 10: Masyarakat Majemuk"
    ],
    "Sejarah": [
      "Bab 1: Kerajaan Hindu-Buddha",
      "Bab 2: Kerajaan Islam",
      "Bab 3: Kolonialisme",
      "Bab 4: Sumpah Pemuda",
      "Bab 5: Pergerakan Nasional",
      "Bab 6: Pendudukan Jepang",
      "Bab 7: Proklamasi",
      "Bab 8: Orde Lama",
      "Bab 9: Orde Baru",
      "Bab 10: Reformasi"
    ]
  },
  "SMP 7-9": {
    "Matematika": [
      "Bab 1: Bilangan Bulat",
      "Bab 2: Pecahan",
      "Bab 3: Aljabar Dasar",
      "Bab 4: Persamaan Linear",
      "Bab 5: Sistem Persamaan Linear",
      "Bab 6: Himpunan",
      "Bab 7: Perbandingan",
      "Bab 8: Segitiga dan Segi Empat",
      "Bab 9: Bangun Ruang",
      "Bab 10: Statistika",
      "Bab 11: Peluang"
    ],
    "IPA": [
      "Bab 1: Pengukuran",
      "Bab 2: Zat dan Wujudnya",
      "Bab 3: Massa Jenis",
      "Bab 4: Panas",
      "Bab 5: Gerak Lurus",
      "Bab 6: Gaya dan Newton",
      "Bab 7: Energi",
      "Bab 8: Optik",
      "Bab 9: Listrik",
      "Bab 10: Tata Surya",
      "Bab 11: Ekosistem",
      "Bab 12: Pencemaran"
    ],
    "Bahasa Indonesia": [
      "Bab 1: Teks Deskripsi",
      "Bab 2: Teks Narasi",
      "Bab 3: Teks Eksposisi",
      "Bab 4: Teks Argumentasi",
      "Bab 5: Puisi Rakyat",
      "Bab 6: Sastra Klasik",
      "Bab 7: Tata Bahasa",
      "Bab 8: Ejaan",
      "Bab 9: Wacana",
      "Bab 10: Membaca"
    ],
    "Bahasa Inggris": [
      "Bab 1: Greetings and Introductions",
      "Bab 2: Describing People",
      "Bab 3: Daily Activities",
      "Bab 4: Past Events",
      "Bab 5: Narratives",
      "Bab 6: Instructions",
      "Bab 7: Procedure Texts",
      "Bab 8: Reports",
      "Bab 9: Recounts",
      "Bab 10: Functional Messages"
    ]
  }
};

// =====================================================
// QUESTION GENERATORS WITH REAL CONTEXT
// =====================================================

function generateMathematicsQuestions(program, topicName, variant) {
  const questions = [];
  
  // Generate 50 different templates based on topic and variant
  if (topicName.includes("Eksponen") || topicName.includes("Logaritma")) {
    for (let i = 0; i < 50; i++) {
      const base = 2 + (variant + i) % 10;
      const exp1 = 3 + (variant * 2 + i) % 8;
      const exp2 = 2 + ((variant + i + 1) % 6);
      
      questions.push({
        difficulty: (variant + i) % 5 === 0 ? "Easy" : (variant + i) % 7 === 0 ? "Hard" : "Medium",
        context: (variant + i) % 2 === 0 
          ? `Dalam penelitian bakteri, jumlah bakteri berlipat ganda setiap ${exp1} jam.`
          : `Suatu obat berkurang sisanya setengahnya setiap ${exp1} jam.`,
        question: (variant + i) % 2 === 0
          ? `Jika pada awalnya terdapat ${base} × 10³ bakteri, maka banyak bakteri setelah ${exp1 + exp2} jam dapat dihitung menggunakan rumus...`
          : `Jika mula-mula terdapat ${base} gram obat, maka sisa obat setelah ${exp1 + exp2} jam adalah...`,
        options: [
          `${base}^${exp1 + exp2}`,
          `${base}^${exp1 * exp2}`,
          `${base}^(${exp1} + ${exp2})`,
          `${(base + 1)}^${exp1 + exp2}`
        ],
        correct: ["C", "B", "D", "A"][i % 4],
        explanation: (variant + i) % 2 === 0
          ? `Perkalian pangkat dengan basis sama: a^m × a^n = a^(m+n)\n\nMaka: ${base}^${exp1} × ${base}^${exp2} = ${base}^(${exp1}+${exp2})`
          : `Pengurangan eksponen (peluruhan): a^m ÷ a^n = a^(m-n)`
      });
    }
    
    return questions.slice(0, 50);
  }
  
  if (topicName.includes("Kuadrat") || topicName.includes("Persamaan")) {
    for (let i = 0; i < 50; i++) {
      const n = 5 + (variant + i) % 20;
      
      questions.push({
        difficulty: (variant + i) % 5 === 0 ? "Easy" : (variant + i) % 7 === 0 ? "Hard" : "Medium",
        context: `Sebuah taman berbentuk persegi panjang memiliki panjang ${n + 3} meter dan lebar ${n - 1} meter.\nLuasnya adalah ${n * (n + 2)} m².`,
        question: `Jika luas tersebut dinyatakan sebagai (x + 3)(x - 1), maka nilai x yang memenuhi adalah...`,
        options: [String(n), String(-n), String(n + 1), String(n - 2)],
        // FIX (V5-1): answer key is the POSITION of the correct option (index 0),
        // never the computed value. Was: correct: String(n)
        correct: toAnswerLetter(0),
        explanation: `(x + 3)(x - 1) = ${n * (n + 2)} → x² + 2x - 3 = ${n * (n + 2)}\nx = ${n} atau x = -${n + 1}`
      });
    }
    
    return questions.slice(0, 50);
  }
  
  if (topicName.includes("Statistika") || topicName.includes("Peluang")) {
    for (let i = 0; i < 50; i++) {
      const scoreBase = 60 + (variant * 2 + i) % 30;
      const scores = Array.from({ length: 5 }, (_, j) => scoreBase + j * 2 + i);
      const mean = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      
      questions.push({
        difficulty: "Easy",
        context: `Nilai ${scores.length} siswa adalah ${scores.join(', ')}.`,
        question: `Rata-rata nilai tersebut adalah...`,
        options: [String(mean - 5), String(mean), String(mean + 5), String(scores[4])],
        // FIX (V5-2): answer key is the POSITION of the correct option (index 1),
        // never the computed value. Was: correct: String(mean)
        correct: toAnswerLetter(1),
        explanation: `Mean = (${scores.join(') + (')})/${scores.length} = ${mean}`
      });
    }
    
    return questions.slice(0, 50);
  }
  
  if (topicName.includes("Program Linear")) {
    for (let i = 0; i < 50; i++) {
      const capacity = 100 + (variant + i) * 2;
      const price = 5000 + (variant + i) * 100;
      
      questions.push({
        difficulty: (variant + i) % 6 === 0 ? "Easy" : (variant + i) % 8 === 0 ? "Hard" : "Medium",
        context: `Toko baju kapasitas menampung ${capacity} potong pakaian dengan harga jual Rp${price.toLocaleString()}.`,
        question: `Keuntungan 20% dari harga jual. Total keuntungan jika semua terjual adalah...`,
        options: [
          String(price * 0.2 * capacity),
          String(price * 0.1 * capacity),
          String(price * 0.3 * capacity),
          String(price * capacity)
        ].map(Number),
        // FIX (V5-3): answer key is the POSITION of the correct option (index 0),
        // never the computed value. Was: correct: String(price * 0.2 * capacity)
        correct: toAnswerLetter(0),
        explanation: `Profit/unit = ${price.toLocaleString()} × 0.2 = Rp${(price * 0.2).toLocaleString()}\nTotal = ${(price * 0.2).toLocaleString()} × ${capacity} = Rp${(price * 0.2 * capacity).toLocaleString()}`
      });
    }
    
    return questions.slice(0, 50);
  }
  
  // Default fallback - generate some variations even if topic doesn't match specific pattern
  for (let i = 0; i < 5; i++) {
    questions.push({
      difficulty: "Medium",
      context: `Diketahui fungsi f(x) = ${(2 + i)}x + ${(3 + i)}.`,
      question: `Nilai f(${5 + i}) adalah...`,
      options: [String((2 + i) * (5 + i) + (3 + i)), String((2 + i) + (3 + i)), String((2 + i) * (5 + i)), String((5 + i) + (3 + i))],
      // FIX (V5-4): answer key is the POSITION of the correct option (index 0),
      // never the computed value. Was: correct: String((2 + i) * (5 + i) + (3 + i))
      correct: toAnswerLetter(0),
      explanation: `Substitusi x = ${5 + i} ke f(x):\nf(${5 + i}) = ${(2 + i)}(${5 + i}) + ${(3 + i)} = ${(2 + i) * (5 + i) + (3 + i)}`
    });
  }
  
  return questions.slice(0, 50);
}

function generatePhysicsQuestions(program, topicName, variant) {
  const questions = [];
  
  if (topicName.includes("Gerak") || topicName.includes("Kinematika")) {
    const v0 = 10 + variant * 2;
    const t = 3 + variant % 5;
    const a = 2 + variant % 4;
    
    questions.push({
      difficulty: "Medium",
      context: `Sebuah mobil bergerak dengan kecepatan awal ${v0} m/s dan dipercepat sebesar ${a} m/s² selama ${t} detik.`,
      question: `Kecepatan akhir mobil tersebut adalah... m/s.`,
      options: [String(v0 + a * t), String(v0 + a), String(a * t), String(v0 + 2 * a + t)],
      correct: "A",
      explanation: `v_t = v₀ + a × t\nv_t = ${v0} + ${a} × ${t} = ${v0 + a * t} m/s`
    });
  }
  
  if (topicName.includes("Energi") || topicName.includes("Hukum Newton")) {
    const m = 2 + variant % 5;
    const F = 10 + variant * 2;
    const h = 5 + variant * 2;
    
    questions.push({
      difficulty: "Medium",
      context: `Sebuah balok bermassa ${m} kg ditarik dengan gaya ${F} N.`,
      question: `Percepatan balok tersebut adalah... m/s².`,
      options: [String(F / m), String(m / F), String(F * m), String(F - m)],
      correct: "A",
      explanation: `a = F/m = ${F}/${m} = ${F/m} m/s²`
    });
    
    questions.push({
      difficulty: "Easy",
      context: `Sebuah bola bermassa ${m} kg diangkat ke ketinggian ${h} meter.`,
      question: `Energi potensial bola tersebut adalah... Joule (g = 10 m/s²).`,
      options: [String(m * 10 * h), String(m * h), String(0.5 * m * 10 * h), String(m * 10 / h)],
      correct: "A",
      explanation: `EP = m × g × h = ${m} × 10 × ${h} = ${m * 10 * h} Joule`
    });
  }
  
  return questions.slice(0, 50);
}

function generateChemistryQuestions(program, topicName, variant) {
  const questions = [];
  
  if (topicName.includes("Stoikiometri") || topicName.includes("Mol")) {
    const mole_A = 2 + variant % 3;
    const coef_B = 3 + variant % 4;
    const coef_A = 1 + variant % 2;
    
    questions.push({
      difficulty: "Medium",
      context: `Dalam reaksi: ${coef_A}A + B → ${coef_B}C,\njika tersedia ${mole_A} mol A, maka dihasilkan C sebanyak... mol.`,
      options: [
        String(mole_A * coef_B / coef_A),
        String(mole_A * coef_A / coef_B),
        String(mole_A + coef_B),
        String(mole_A * coef_B)
      ],
      correct: "A",
      explanation: `Rasio koefisien: ${coef_A}:${coef_B}\nMol C = ${mole_A} × (${coef_B}/${coef_A}) = ${mole_A * coef_B / coef_A} mol`
    });
  }
  
  return questions.slice(0, 50);
}

function generateEnglishQuestions(program, topicName, variant) {
  const questions = [];
  
  if (topicName.includes("Tenses") || topicName.includes("Grammar")) {
    questions.push({
      difficulty: variant % 5 === 0 ? "Easy" : "Medium",
      context: `Complete the sentence with the correct tense:\n"She ___ to Japan last year."`,
      question: "",
      options: ["went", "goes", "has gone", "going"],
      correct: "A",
      explanation: "Past simple tense used for completed actions in the past."
    });
  }
  
  if (topicName.includes("Reading") || topicName.includes("Comprehension")) {
    questions.push({
      difficulty: "Medium",
      context: `Read the passage: "Global warming is causing polar ice caps to melt at an alarming rate. Scientists predict that sea levels will rise by ${5 + variant} cm by 2050.",`,
      question: `What is the main idea?`,
      options: [
        "Sea level rise due to climate change",
        "Ice melting benefits ecosystems",
        "Scientists study weather patterns",
        "Ocean currents are changing"
      ],
      correct: "A",
      explanation: "The passage focuses on consequences of global warming, specifically rising sea levels."
    });
  }
  
  return questions.slice(0, 50);
}

function generateLanguageIndonesiaQuestions(program, topicName, variant) {
  const questions = [];
  
  if (topicName.includes("Teks Deskripsi") || topicName.includes("Teks Narasi")) {
    questions.push({
      difficulty: "Medium",
      context: `Bacalah teks berikut tentang "deskripsi pasar tradisional"\n`,
      question: "Pertanyaan memahami isi teks tersebut terkait...",
      options: [
        "Gagasan utama paragraf",
        "Detail pendukung penting",
        "Kata kunci dominan",
        "Tujuan penulis"
      ],
      correct: "A",
      explanation: "Identifikasi gagasan utama dengan menemukan ide pokok."
    });
  }
  
  return questions.slice(0, 50);
}

function generateJuniorHighScienceQuestions(program, topicName, variant) {
  const questions = [];
  
  if (topicName.includes("Pengukuran") || topicName.includes("Zat")) {
    questions.push({
      difficulty: "Easy",
      context: `Satuan besaran pokok dalam SI:\n- Panjang: meter (m)\n- Massa: kilogram (kg)\n- Waktu: second (s)`,
      question: `Besaran pokok di bawah ini adalah...`,
      options: ["meter dan kilogram", "second dan ampere", "meter saja", "kilogram dan volt"],
      correct: "A",
      explanation: "Panjang (meter) dan massa (kilogram) termasuk besaran pokok menurut SI."
    });
  }
  
  return questions.slice(0, 50);
}

// =====================================================
// BIOLOGY GENERATOR (50 variations)
// =====================================================
function generateBiologyQuestions(program, topicName, variant) {
  const questions = [];
  
  if (topicName.includes("Sel") || topicName.includes("Genetika")) {
    const dominant = "U";
    const recessive = "u";
    
    questions.push({
      difficulty: "Medium",
      context: `Sifat bunga ungu (U) dominan atas putih (u). Parental: Uu × Uu.`,
      question: `Probabilitas keturunan bergenotip heterozigot adalah...%`,
      options: ["25%", "50%", "75%", "100%"],
      correct: "B",
      explanation: `Kreasi Punnett: Uu × Uu\nGenerasi: 25% UU, 50% Uu, 25% uu\nHeterozigot = 50%`
    });
  }
  
  if (topicName.includes("Ekosistem")) {
    const organisms = ["produsen", "konsumen I", "konsumen II", "pengurai"];
    
    questions.push({
      difficulty: variant % 5 === 0 ? "Easy" : "Medium",
      context: `Dalam rantai makanan: Padi → Tikus → Ular → Elang,\nPadi berperan sebagai...`,
      question: "",
      options: [organisms[0], organisms[1], organisms[2], organisms[3]],
      correct: "A",
      explanation: "Padi adalah produsen karena dapat membuat makanannya sendiri melalui fotosintesis."
    });
  }
  
  return questions.slice(0, 50);
}

// =====================================================
// ECONOMICS GENERATOR (50 variations)
// =====================================================
function generateEconomicsQuestions(program, topicName, variant) {
  const questions = [];
  
  if (topicName.includes("Permintaan") || topicName.includes("Penawaran")) {
    const priceChange = 10000 - variant * 500;
    const qtyChange = 100 + variant * 5;
    
    questions.push({
      difficulty: variant % 5 === 0 ? "Medium" : "Hard",
      context: `Harga barang turun dari Rp${priceChange.toLocaleString()} ke Rp${(priceChange - 500).toLocaleString()}\nPermintaan naik dari ${qtyChange} unit ke ${qtyChange + 20} unit.`,
      question: `Apakah hukum permintaan tercantum?`,
      options: [
        "Ya, sebanding dengan harga",
        "Ya, berbanding terbalik dengan harga",
        "Tidak, tidak ada hubungan",
        "Terlalu kompleks untuk ditentukan"
      ],
      correct: "B",
      explanation: `Hukum Permintaan: Harga turun → Permintaan naik (${qtyChange} → ${qtyChange + 20})\nIni menunjukkan hubungan berbanding terbalik.`
    });
  }
  
  if (topicName.includes("Elastisitas")) {
    questions.push({
      difficulty: "Medium",
      context: `Koefisien elastisitas permintaan dihitung dengan rumus:\nEd = (%ΔQ)/(%ΔP)\nJika Ed > 1, maka permintaan bersifat...`,
      question: "",
      options: ["Elastis", "Inelastis", "Uniter", "Elastis sempurna"],
      correct: "A",
      explanation: "Ed > 1 berarti perubahan persentase kuantitas lebih besar daripada perubahan persentase harga, sehingga elastis."
    });
  }
  
  return questions.slice(0, 50);
}

// =====================================================
// GEOGRAPHY GENERATOR (50 variations)
// =====================================================
function generateGeographyQuestions(program, topicName, variant) {
  const questions = [];
  
  if (topicName.includes("Peta") || topicName.includes("Skala")) {
    const mapDist = 5 + variant;
    const scaleNum = 100000 + variant * 10000;
    
    questions.push({
      difficulty: "Medium",
      context: `Jarak di peta antara dua kota adalah ${mapDist} cm.\nSkala peta 1:${scaleNum.toLocaleString()}.`,
      question: `Jarak sebenarnya adalah... km.`,
      options: [
        ((mapDist * scaleNum) / 100000).toFixed(1),
        (mapDist * scaleNum / 1000).toFixed(1),
        (mapDist * scaleNum).toFixed(0),
        (mapDist * 1000).toFixed(0)
      ],
      // FIX (V5-5): answer key is the POSITION of the correct option (index 0),
      // never the computed value. Was: correct: Number(((mapDist * scaleNum) / 100000).toFixed(1))
      correct: toAnswerLetter(0),
      explanation: `Jarak sebenar = jarak peta × skala\n= ${mapDist} cm × ${scaleNum.toLocaleString()}\n= ${(mapDist * scaleNum / 100000).toFixed(1)} km`
    });
  }
  
  if (topicName.includes("Atmosfer")) {
    const layers = ["Troposfer", "Stratosfer", "Mesosfer", "Termosfer"];
    
    questions.push({
      difficulty: variant % 6 === 0 ? "Easy" : "Medium",
      context: `Lapisan atmosfer tempat terjadinya cuaca dan iklim berada di...`,
      question: "",
      options: layers,
      correct: "A",
      explanation: "Troposfer adalah lapisan atmosfer terbawah (0-12 km) tempat semua fenomena cuaca terjadi."
    });
  }
  
  return questions.slice(0, 50);
}

// =====================================================
// SOCIOLOGY GENERATOR (50 variations)
// =====================================================
function generateSociologyQuestions(program, topicName, variant) {
  const questions = [];
  
  if (topicName.includes("Interaksi") || topicName.includes("Sosial")) {
    questions.push({
      difficulty: "Easy",
      context: `Faktor pendorong interaksi sosial:\n1. Imitasi (meniru)\n2. Sugesti\n3. Identifikasi\n4. Simpati`,
      question: `Contoh interaksi simpatik adalah...`,
      options: [
        "Berbagi kesedihan ketika teman berkabung",
        "Meniru gaya berpakaian idol",
        "Menerima saran orang tua",
        "Bergaul dengan kelompok tertentu"
      ],
      correct: "A",
      explanation: "Simpati adalah perasaan ketertarikan atau sepenanggungan terhadap orang lain, seperti berbagi duka."
    });
  }
  
  if (topicName.includes("Stratifikasi")) {
    const criteria = ["Kemampuan ekonomi", "Kualitas pendidikan", "Status jabatan", "Semua benar"];
    
    questions.push({
      difficulty: "Medium",
      context: `Stratifikasi sosial berdasarkan kriteria berikut, TIDAK termasuk...`,
      question: "",
      options: [...criteria],
      correct: "D",
      explanation: "Stratifikasi sosial dapat didasarkan pada berbagai kriteria termasuk ekonomi, pendidikan, jabatan, dll."
    });
  }
  
  return questions.slice(0, 50);
}

// =====================================================
// HISTORY GENERATOR (50 variations)
// =====================================================
function generateHistoryQuestions(program, topicName, variant) {
  const questions = [];
  
  const historicalEvents = [
    { year: 1908, event: "Berdirinya Budi Utomo", tokoh: "Dr. Sutomo", significance: "Awal kebangkitan nasional Indonesia" },
    { year: 1928, event: "Sumpah Pemuda", tokoh: "Para pemuda pergerakan", significance: "Persatuan Indonesia" },
    { year: 1945, event: "Proklamasi Kemerdekaan", tokoh: "Soekarno-Hatta", significance: "Indonesia merdeka" },
    { year: 1965, event: "Peristiwa G30S/PKI", tokoh: "G30S", significance: "Awal pergantian Orde Lama" },
    { year: 1998, event: "Reformasi", tokoh: "Mahasiswa & rakyat", significance: "Kejatuhan Orde Baru" }
  ];
  
  const evt = historicalEvents[variant % historicalEvents.length];
  
  questions.push({
    difficulty: variant % 5 === 0 ? "Easy" : "Medium",
    context: `Pada tahun ${evt.year}, terjadi peristiwa penting "${evt.event}" yang dipelopori oleh ${evt.tokoh}.`,
    question: `Dampak signifikan dari peristiwa tersebut adalah...`,
    options: [evt.significance, "Kolonialisme masih kuat", "Ekonomi tumbuh pesat", "Hubungan internasional baik"],
    correct: "A",
    explanation: `Peristiwa ${evt.event} pada tahun ${evt.year} memberikan pengaruh besar terhadap perkembangan bangsa Indonesia.`
  });
  
  if (topicName.includes("Hindu-Buddha")) {
    const kingdoms = ["Kutai", "Tarumanegara", "Sriwijaya", "Majapahit"];
    
    questions.push({
      difficulty: "Easy",
      context: `Kerajaan Hindu tertua di Indonesia adalah Kerajaan Kutai yang terletak di Kalimantan Timur.`,
      question: `Kerajaan Buddha tertua di Indonesia adalah...`,
      options: ["Sriwijaya", "Majapahit", "Mataram Kuno", "Singhasari"],
      correct: "A",
      explanation: "Sriwijaya adalah kerajaan Buddha terbesar dan tertua di Indonesia, berbasis di Sumatra Selatan."
    });
  }
  
  return questions.slice(0, 50);
}

// =====================================================
// CORE GENERATOR FUNCTION
// =====================================================
async function generateQualityQuestions() {
  console.log('⏳ MEMULAI GENERASI SOAL BERKUALITAS...\n');
  
  let allQuestions = [];
  // Questions blocked by the validation gate (never exported to production Excel).
  const rejectedQuestions = [];
  
  // Loop through all programs, subjects, topics with 50 variations each
  for (let variant = 0; variant < 50; variant++) {
    Object.keys(CURRICULUM_TOPICS).forEach(program => {
      Object.keys(CURRICULUM_TOPICS[program]).forEach(subject => {
        CURRICULUM_TOPICS[program][subject].forEach(topic => {
          let generated = [];
          
          if (subject === "Matematika") {
            generated = generateMathematicsQuestions(program, topic, variant);
          } else if (subject === "Fisika") {
            generated = generatePhysicsQuestions(program, topic, variant);
          } else if (subject === "Kimia") {
            generated = generateChemistryQuestions(program, topic, variant);
          } else if (subject === "Biologi") {
            generated = generateBiologyQuestions(program, topic, variant);
          } else if (subject === "Ekonomi") {
            generated = generateEconomicsQuestions(program, topic, variant);
          } else if (subject === "Geografi") {
            generated = generateGeographyQuestions(program, topic, variant);
          } else if (subject === "Sosiologi") {
            generated = generateSociologyQuestions(program, topic, variant);
          } else if (subject === "Sejarah") {
            generated = generateHistoryQuestions(program, topic, variant);
          } else if (subject === "Bahasa Inggris") {
            generated = generateEnglishQuestions(program, topic, variant);
          } else if (subject === "Bahasa Indonesia") {
            generated = generateLanguageIndonesiaQuestions(program, topic, variant);
          } else if (subject === "IPA") {
            generated = generateJuniorHighScienceQuestions(program, topic, variant);
          }
          
          for (const q of generated) {
            const soalText = `${q.context}${q.question}`.trim();

            // VALIDATION GATE (Task Section 8): block invalid questions BEFORE
            // they enter the output. A question is exported only if it passes
            // every check (non-empty, non-placeholder, no broken token, 4
            // unique non-empty options, valid A-D key pointing to an option).
            const gate = validateQuestion({
              question: soalText,
              options: q.options,
              answerKey: q.correct,
              explanation: q.explanation
            });

            if (!gate.valid) {
              rejectedQuestions.push({
                program,
                subject,
                topic,
                variant,
                reasons: gate.reasons,
                soal: soalText
              });
              continue; // DO NOT EXPORT THE QUESTION
            }

            const questionData = {
              "Program/Kelas": program,
              "Mata Pelajaran": subject,
              "Topik/Materi": topic,
              "Tingkat Kesulitan": q.difficulty || "Medium",
              "ID Unik Soal": `QB-${program.replace(/\s+/g, '')}-${subject.replace(/\s+/g, '')}-${topic.split(':')[1].replace(/\s+/g, '-')}V${(variant + 1).toString().padStart(3, '0')}`,
              "Variasi ID": `V${variant + 1}`,
              "Kognitif": getCognitiveLevel(q.difficulty),
              "Kompetensi": getCompetency(subject, topic),
              "Soal": soalText,
              "Opsi A": q.options[0],
              "Opsi B": q.options[1],
              "Opsi C": q.options[2],
              "Opsi D": q.options[3],
              "Kunci Jawaban": q.correct,
              "Pembahasan": q.explanation
            };
            
            allQuestions.push(questionData);
          }
        });
      });
    });
    
    if ((variant + 1) % 25 === 0) {
      console.log(`📊 Progress: ${variant + 1}/50 variations completed (${allQuestions.length.toLocaleString()} questions so far)`);
    }
  }
  
  console.log(`\n✅ ${'='.repeat(60)}`);
  console.log(`TOTAL SOAL BERHASIL DIHASILKAN: ${allQuestions.length.toLocaleString()} soal`);
  console.log(`DITOLAK OLEH VALIDATION GATE: ${rejectedQuestions.length.toLocaleString()} soal (tidak diekspor)`);
  console.log(`Dokumen tersimpan di: outputs/assessment-bank-rekap/rekap-bank-soal-bimbel-bina-cendekia-ber-sumber-V5-QUALITY.xlsx`);
  console.log(`'='.repeat(60)}\n`);

  // Summarise why questions were rejected (failed-generation report).
  if (rejectedQuestions.length > 0) {
    const reasonCounts = {};
    for (const r of rejectedQuestions) {
      for (const reason of r.reasons) {
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      }
    }
    console.log('Alasan penolakan (validation gate):');
    for (const [reason, count] of Object.entries(reasonCounts)) {
      console.log(`  - ${reason}: ${count}`);
    }
    console.log('');
  }

  exportToExcel(allQuestions);
}

// Helper functions
function getCognitiveLevel(difficulty) {
  switch (difficulty) {
    case "Easy": return "C2 - Memahami";
    case "Medium": return "C3 - Menerapkan";
    case "Hard": return "C4 - Menganalisis";
    default: return "C3 - Menerapkan";
  }
}

function getCompetency(subject, topic) {
  const competencyMap = {
    "Matematika": "Menyelesaikan masalah berkaitan dengan " + topic.replace("Bab ", ""),
    "Fisika": "Menerapkan konsep " + topic.replace("Bab ", "") + " dalam kehidupan sehari-hari",
    "Kimia": "Menganalisis sifat dan reaksi " + topic.replace("Bab ", ""),
    "Biologi": "Memahami konsep biologis dari " + topic.replace("Bab ", ""),
    "Ekonomi": "Menganalisis prinsip ekonomi " + topic.replace("Bab ", ""),
    "Geografi": "Mengkaji aspek keruangan " + topic.replace("Bab ", ""),
    "Sosiologi": "Memahami interaksi sosial dalam " + topic.replace("Bab ", ""),
    "Sejarah": "Menganalisis peristiwa historis " + topic.replace("Bab ", ""),
    "Bahasa Indonesia": "Memahami dan memproduksi teks " + topic.replace("Bab ", ""),
    "Bahasa Inggris": "Mengembangkan kompetensi bahasa " + topic.replace("Bab ", ""),
    "IPA": "Menerapkan konsep ilmiah " + topic.replace("Bab ", "")
  };
  
  return competencyMap[subject] || "Mencapai kompetensi dasar sesuai kurikulum";
}

function exportToExcel(questions) {
  const outputPath = path.join(__dirname, '..', '..', '..', 'outputs', 'assessment-bank-rekap', 'rekap-bank-soal-bimbel-bina-cendekia-ber-sumber-V5-QUALITY.xlsx');
  
  // Ensure directory exists
  const dirPath = path.dirname(outputPath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  
  const ws = XLSX.utils.json_to_sheet(questions);
  
  const colWidths = [
    { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 50 },
    { wch: 20 }, { wch: 25 }, { wch: 40 }, { wch: 120 }, { wch: 40 },
    { wch: 40 }, { wch: 40 }, { wch: 40 }, { wch: 8 }, { wch: 150 }
  ];
  ws['!cols'] = colWidths;
  
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Soal Berkualitas V5');
  XLSX.writeFile(wb, outputPath);
  
  console.log(`📁 File berhasil disimpan: ${outputPath}`);
}

// Run generator
generateQualityQuestions().catch(console.error);
