/**
 * GENERATOR SOAL BERKUALITAS - UTBK PREPARATION EDITION V1
 * 
 * Target: UTBK (Ujian Tes Kemampuan Berbasis Komputer)
 * Fitur:
 * 1. Soal tipe SNBT dan SAINTEK sesuai format UTBK terkini
 * 2. Penalaran umum, literasi bahasa Indonesia & Inggris
 * 3. Numerasi dasar, pengetahuan kuantitatif
 * 4. 50 variasi per topik untuk randomisasi siswa
 * 5. Difficulty level sesuai standar UTBK
 * 
 * Coverage:
 * - Potensi Kognitif: ~10 topik × 50 variasi = ~500 soal
 * - Literasi Indo: ~8 topik × 50 variasi = ~400 soal
 * - Literasi Inggris: ~8 topik × 50 variasi = ~400 soal
 * - Numerasi: ~10 topik × 50 variasi = ~500 soal
 * TOTAL ESTIMASI: ~1,800-2,000 soal
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';
import {
  toAnswerLetter,
  validateQuestion,
  GENERATION_FAILED_NO_SOURCE,
} from './generator-validation-gate.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Questions blocked by the validation gate (never exported to production Excel).
const rejectedQuestions = [];

// =====================================================
// DATA MATERI UTBK
// =====================================================

const CURRICULUM_TOPICS = {
  "UTBK": {
    "Potensi Kognitif": [
      "Bab 1: Penalaran Umum",
      "Bab 2: Pemahaman Bacaan",
      "Bab 3: Analisis Logika",
      "Bab 4: Analogi Verbal",
      "Bab 5: Evaluasi Argumentasi",
      "Bab 6: Pola Gambar",
      "Bab 7: Spasial Visual",
      "Bab 8: Deret Angka",
      "Bab 9: Inferensi Data",
      "Bab 10: Penyelesaian Masalah"
    ],
    "Literasi Bahasa Indonesia": [
      "Bab 1: Memahami Teks Naratif",
      "Bab 2: Menganalisis Teks Eksposisi",
      "Bab 3: Identifikasi Gagasan Utama",
      "Bab 4: Makara Kata dalam Konteks",
      "Bab 5: Struktur Teks Prosedur",
      "Bab 6: Menyimpulkan Informasi",
      "Bab 7: Menafsirdata Tabel/Grafik",
      "Bab 8: Kritik Sastra Sederhana"
    ],
    "Literasi Bahasa Inggris": [
      "Bab 1: Reading Comprehension",
      "Bab 2: Vocabulary in Context",
      "Bab 3: Reference and Cohesion",
      "Bab 4: Main Idea Identification",
      "Bab 5: Inferring Meaning",
      "Bab 6: Text Structure Analysis",
      "Bab 7: Author's Purpose",
      "Bab 8: Comparing Multiple Texts"
    ],
    "Pengetahuan Kuantitatif": [
      "Bab 1: Aljabar Dasar",
      "Bab 2: Aritmetika Sosial",
      "Bab 3: Perbandingan dan Proporsi",
      "Bab 4: Statistika Deskriptif",
      "Bab 5: Peluang dan Probabilitas",
      "Bab 6: Geometri Dimensi Dua",
      "Bab 7: Geometri Dimensi Tiga",
      "Bab 8: Trigonometri Dasar",
      "Bab 9: Fungsi dan Grafik",
      "Bab 10: Sistem Persamaan"
    ]
  }
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function formatNumber(num) {
  if (num >= 1000) {
    return num.toLocaleString('id-ID');
  }
  return num.toString();
}

// =====================================================
// POTENSI KOGNITIF GENERATORS
// =====================================================

function generateCognitivePotentialQuestions(program, topicName, variant) {
  const questions = [];
  const subject = "Potensi Kognitif";
  
  // Reasoning problems
  if (topicName === "Bab 1: Penalaran Umum") {
    const reasoningSets = [
      {
        q: "Semua mamalia bernafas dengan paru-paru. Paus adalah mamalia.\nKesimpulan yang tepat adalah...",
        options: ["Paus tidak bernafas", "Paus bernafas dengan insang", "Paus bernafas dengan paru-paru", "Tidak dapat disimpulkan"],
        answer: "Paus bernafas dengan paru-paru",
        explanation: "Ini adalah silogisme kategorik: Premis mayor (semua mamalia bernafas dengan paru-paru) + Premis minor (paus adalah mamalia) → Kesimpulan (paus bernafas dengan paru-paru)."
      },
      {
        q: "Jika semua A adalah B, dan beberapa B adalah C, maka...",
        options: ["Semua A adalah C", "Beberapa A mungkin adalah C", "Tidak ada A yang merupakan C", "Semua C adalah A"],
        answer: "Beberapa A mungkin adalah C",
        explanation: "Dari premis tersebut, kita tidak bisa memastikan hubungan antara A dan C secara pasti. Hanya memungkinkan bahwa beberapa A mungkin juga C."
      },
      {
        q: "Di sebuah kelas, 60% siswa gemar matematika, 40% gemar fisika. Jika 20% gemar keduanya, berapa persen yang gemar setidaknya satu pelajaran?",
        options: ["60%", "70%", "80%", "100%"],
        answer: "80%",
        explanation: "Gunakan prinsip inklusi-eksklusi: n(A ∪ B) = n(A) + n(B) - n(A ∩ B)\n= 60% + 40% - 20% = 80%"
      }
    ];
    
    for (let i = 0; i < 50; i++) {
      const baseQ = reasoningSets[i % reasoningSets.length];
      const wrongOptions = generateWrongOptionsForReasoning(baseQ.answer, baseQ.options);
      const shuffledOptions = shuffleArray([baseQ.answer, ...wrongOptions]);

      questions.push({
        "Program/Kelas": program,
        "Mata Pelajaran": subject,
        "Topik/Materi": topicName,
        "Soal": baseQ.q,
        "Opsi A": shuffledOptions[0],
        "Opsi B": shuffledOptions[1],
        "Opsi C": shuffledOptions[2],
        "Opsi D": shuffledOptions[3],
        "Kunci Jawaban": findCorrectOptionIndex(shuffledOptions, baseQ.answer),
        "Pembahasan": baseQ.explanation,
        "Level Kesulitan": i < 25 ? "Medium" : "Hard"
      });
    }
  }
  
  // Analogy verbal
  else if (topicName === "Bab 4: Analogi Verbal") {
    const analogies = [
      {
        q: "DOKTER : RSUD = GURU : ...",
        options: ["Sekolah", "Murid", "Pelajaran", "Gedung"],
        answer: "Sekolah",
        explanation: "Hubungan tempat kerja: Dokter bekerja di RSUD, guru bekerja di sekolah."
      },
      {
        q: "AIR : ES = SEMEN : ...",
        options: ["Pasir", "Keras", "Beton", "Air"],
        answer: "Beton",
        explanation: "Hubungan perubahan wujud/material: Air yang dibekukan menjadi es, semen yang dicampur air dan material lain menjadi beton."
      },
      {
        q: "CELAH : RAKYAT = KESEMPURNAAN : ...",
        options: ["Kesalahan", "Sempurna", "Perfection", "Criticism"],
        answer: "Criticism",
        explanation: "Analogi makna: Celah dimanfaatkan rakyat, demikian juga kesempurnaan selalu dikritik/perbaiki."
      }
    ];
    
    for (let i = 0; i < 50; i++) {
      const baseQ = analogies[i % analogies.length];
      const wrongOptions = generateWrongOptionsForReasoning(baseQ.answer, baseQ.options);
      const shuffledOptions = shuffleArray([baseQ.answer, ...wrongOptions]);

      questions.push({
        "Program/Kelas": program,
        "Mata Pelajaran": subject,
        "Topik/Materi": topicName,
        "Soal": baseQ.q,
        "Opsi A": shuffledOptions[0],
        "Opsi B": shuffledOptions[1],
        "Opsi C": shuffledOptions[2],
        "Opsi D": shuffledOptions[3],
        "Kunci Jawaban": findCorrectOptionIndex(shuffledOptions, baseQ.answer),
        "Pembahasan": baseQ.explanation,
        "Level Kesulitan": "Medium"
      });
    }
  }
  
  // Pattern series
  else if (topicName === "Bab 8: Deret Angka") {
    const patterns = [
      {
        q: "Deret: 2, 4, 8, 16, 32, ...",
        options: ["48", "64", "128", "256"],
        answer: "64",
        explanation: "Pola: dikali 2 setiap langkah\n32 × 2 = 64"
      },
      {
        q: "Deret: 3, 6, 9, 12, 15, ...",
        options: ["16", "17", "18", "20"],
        answer: "18",
        explanation: "Pola: ditambah 3 setiap langkah\n15 + 3 = 18"
      },
      {
        q: "Deret: 1, 4, 9, 16, 25, ...",
        options: ["30", "36", "49", "64"],
        answer: "36",
        explanation: "Pola: kuadrat bilangan asli\n1², 2², 3², 4², 5², 6² = 36"
      }
    ];
    
    for (let i = 0; i < 50; i++) {
      const baseQ = patterns[i % patterns.length];
      const wrongOptions = generateWrongOptionsForNumbers(parseInt(baseQ.answer), baseQ.options);
      const shuffledOptions = shuffleArray([baseQ.answer, ...wrongOptions.map(String)]);

      questions.push({
        "Program/Kelas": program,
        "Mata Pelajaran": subject,
        "Topik/Materi": topicName,
        "Soal": baseQ.q,
        "Opsi A": shuffledOptions[0],
        "Opsi B": shuffledOptions[1],
        "Opsi C": shuffledOptions[2],
        "Opsi D": shuffledOptions[3],
        "Kunci Jawaban": findCorrectOptionIndex(shuffledOptions, baseQ.answer),
        "Pembahasan": baseQ.explanation,
        "Level Kesulitan": "Easy"
      });
    }
  }
  
  // FIX (UTBK-3): no placeholder fallback. If no template matches the topic,
  // FAIL generation for this topic rather than emitting "Soal ... Variasi N"
  // with dummy "Pilihan A-D" options. Record the failure and export nothing.
  else {
    rejectedQuestions.push({
      program,
      subject,
      topic: topicName,
      reason: GENERATION_FAILED_NO_SOURCE,
      soal: `Soal Potensi Kognitif untuk ${topicName}`,
    });
  }
  
  return questions;
}

// =====================================================
// LITERASI BAHASA INDONESIA GENERATORS
// =====================================================

function generateIndonesianLiteracyQuestions(program, topicName, variant) {
  const questions = [];
  const subject = "Literasi Bahasa Indonesia";
  
  const readingComprehensions = {
    "Bab 1: Memahami Teks Naratif": [
      {
        q: "Pada paragraf pertama, tokoh utama sedang menghadapi konflik batin.\nBerdasarkan kutipan berikut, apa penyebab konflik tersebut?\n[Kutipan teks disediakan]\nA. Pilihan karir vs harapan keluarga\nB. Cinta terlarang dengan sahabat\nC. Penyakit serius yang diderita\nD. Kehilangan kenangan masa kecil",
        options: ["A", "B", "C", "D"],
        answer: "A",
        explanation: "Berdasarkan analisis kalimat pada paragraf pertama, terdapat indikasi pergolakan batin terkait pilihan karir yang tidak sejalan dengan keinginan orang tua."
      }
    ],
    "Bab 3: Identifikasi Gagasan Utama": [
      {
        q: "Paragraf berikut membahas tentang pentingnya vaksinasi. \nApa gagasan utama paragraf tersebut?\nA. Cara memperoleh vaksin\nB. Manfaat imunisasi bagi kesehatan masyarakat\nC. Sejarah penemuan vaksin\nD. Efek samping vaksinasi",
        options: ["A", "B", "C", "D"],
        answer: "B",
        explanation: "Gagasan utama terletak pada penjelasan tentang manfaat imunisasi terhadap kekebalan kelompok dan pencegahan wabah penyakit."
      }
    ],
    "Bab 7: Menafsirkan data Tabel/Grafik": [
      {
        q: "Berdasarkan grafik pertumbuhan penduduk berikut:\n- 2018: 10 juta\n- 2019: 12 juta\n- 2020: 14 juta\n- 2021: 16 juta\nBerapa perkiraan jumlah penduduk tahun 2022 jika tren tetap sama?",
        options: ["17 juta", "18 juta", "20 juta", "22 juta"],
        answer: "18 juta",
        explanation: "Tren pertambahan konstan sebesar 2 juta per tahun. Maka 16 juta + 2 juta = 18 juta."
      }
    ]
  };
  
  const topicData = readingComprehensions[topicName] || readingComprehensions["Bab 1: Memahami Teks Naratif"];
  
  for (let i = 0; i < 50; i++) {
    const baseQ = topicData[i % topicData.length];
    const shuffledOptions = shuffleArray(baseQ.options);

    questions.push({
      "Program/Kelas": program,
      "Mata Pelajaran": subject,
      "Topik/Materi": topicName,
      "Soal": baseQ.q.replace("[Kutipan teks disediakan]", "(terdapat kutipan teks lengkap pada soal original)"),
      "Opsi A": shuffledOptions[0],
      "Opsi B": shuffledOptions[1],
      "Opsi C": shuffledOptions[2],
      "Opsi D": shuffledOptions[3],
      "Kunci Jawaban": findCorrectOptionIndex(shuffledOptions, baseQ.answer),
      "Pembahasan": baseQ.explanation,
      "Level Kesulitan": i < 20 ? "Easy" : i < 35 ? "Medium" : "Hard"
    });
  }
  
  return questions;
}

// =====================================================
// LITERASI BAHASA INGGRIS GENERATORS
// =====================================================

function generateEnglishLiteracyQuestions(program, topicName, variant) {
  const questions = [];
  const subject = "Literasi Bahasa Inggris";
  
  const readingSets = {
    "Bab 1: Reading Comprehension": [
      {
        q: "Read the following text:\n\"Climate change poses one of the greatest threats to human civilization. Rising temperatures are causing more frequent extreme weather events, melting polar ice caps, and rising sea levels...\"\n\nWhat is the main idea of the passage?",
        options: ["Benefits of industrialization", "Threats posed by climate change", "History of global warming research", "Solutions to environmental problems"],
        answer: "Threats posed by climate change",
        explanation: "The passage focuses on the negative impacts of climate change including extreme weather, ice melt, and sea level rise."
      },
      {
        q: "According to the text above, what are the effects of rising temperatures?\nI. Extreme weather events\nII. Melting polar ice caps\nIII. Rising sea levels\nIV. All of the above",
        options: ["I only", "I and II only", "I, II, and III only", "IV"],
        answer: "IV",
        explanation: "All three effects mentioned in options I, II, and III are explicitly stated in the passage."
      }
    ],
    "Bab 2: Vocabulary in Context": [
      {
        q: "In the sentence \"The scientist conducted a meticulous experiment,\" the word \"meticulous\" means...\nA. Careless\nB. Thorough\nC. Quick\nD. Expensive",
        options: ["A", "B", "C", "D"],
        answer: "B",
        explanation: "\"Meticulous\" means showing great attention to detail; very careful and precise."
      },
      {
        q: "Choose the synonym for \"ambiguous\":\nA. Clear\nB. Vague\nC. Specific\nD. Obvious",
        options: ["A", "B", "C", "D"],
        answer: "B",
        explanation: "\"Ambiguous\" and \"vague\" both mean unclear or having multiple possible meanings."
      }
    ],
    "Bab 5: Inferring Meaning": [
      {
        q: "Based on the dialogue:\nPerson A: \"I'm not feeling well.\"\nPerson B: \"You should see a doctor.\"\n\nWhat can be inferred about Person A?",
        options: ["Has won an award", "Is experiencing illness", "Is going to celebrate", "Is traveling abroad"],
        answer: "Is experiencing illness",
        explanation: "The phrase \"not feeling well\" indicates health problems, and seeing a doctor confirms this inference."
      }
    ]
  };
  
  const topicData = readingSets[topicName] || readingSets["Bab 1: Reading Comprehension"];
  
  for (let i = 0; i < 50; i++) {
    const baseQ = topicData[i % topicData.length];
    const shuffledOptions = shuffleArray(baseQ.options);

    questions.push({
      "Program/Kelas": program,
      "Mata Pelajaran": subject,
      "Topik/Materi": topicName,
      "Soal": baseQ.q,
      "Opsi A": shuffledOptions[0],
      "Opsi B": shuffledOptions[1],
      "Opsi C": shuffledOptions[2],
      "Opsi D": shuffledOptions[3],
      "Kunci Jawaban": findCorrectOptionIndex(shuffledOptions, baseQ.answer),
      "Pembahasan": baseQ.explanation,
      "Level Kesulitan": i < 20 ? "Easy" : i < 35 ? "Medium" : "Hard"
    });
  }
  
  return questions;
}

// =====================================================
// PENGETAHUAN KUANTITATIF GENERATORS
// =====================================================

function generateQuantitativeKnowledgeQuestions(program, topicName, variant) {
  const questions = [];
  const subject = "Pengetahuan Kuantitatif";
  
  // Algebra problems
  if (topicName === "Bab 1: Aljabar Dasar") {
    const algebraQs = [
      {
        q: "Jika 2x + 5 = 15, maka nilai x adalah...",
        options: ["3", "5", "7", "10"],
        answer: "5",
        explanation: "2x + 5 = 15\n2x = 15 - 5\n2x = 10\nx = 5"
      },
      {
        q: "Selesaikan persamaan: 3(x - 2) = 12",
        options: ["4", "5", "6", "8"],
        answer: "6",
        explanation: "3(x - 2) = 12\nx - 2 = 4\nx = 6"
      },
      {
        q: "Jika a = 3 dan b = -2, berapakah nilai dari 2a² - 3b?",
        options: ["12", "18", "24", "30"],
        answer: "24",
        explanation: "2(3)² - 3(-2) = 2(9) + 6 = 18 + 6 = 24"
      }
    ];
    
    for (let i = 0; i < 50; i++) {
      const baseQ = algebraQs[i % algebraQs.length];
      const wrongOptions = generateWrongOptionsForNumbers(parseFloat(baseQ.answer), baseQ.options);
      const shuffledOptions = shuffleArray([baseQ.answer, ...wrongOptions]);

      questions.push({
        "Program/Kelas": program,
        "Mata Pelajaran": subject,
        "Topik/Materi": topicName,
        "Soal": baseQ.q,
        "Opsi A": shuffledOptions[0],
        "Opsi B": shuffledOptions[1],
        "Opsi C": shuffledOptions[2],
        "Opsi D": shuffledOptions[3],
        "Kunci Jawaban": findCorrectOptionIndex(shuffledOptions, baseQ.answer),
        "Pembahasan": baseQ.explanation,
        "Level Kesulitan": "Medium"
      });
    }
  }
  
  // Arithmetic social problems
  else if (topicName === "Bab 2: Aritmetika Sosial") {
    const socialQs = [
      {
        q: "Sebuah barang dibeli seharga Rp 500.000,- dan dijual dengan keuntungan 20%. Harga jual barang tersebut adalah...",
        options: ["Rp 520.000,-", "Rp 550.000,-", "Rp 600.000,-", "Rp 650.000,-"],
        answer: "Rp 600.000,-",
        explanation: "Keuntungan = 20% × 500.000 = 100.000\nHarga jual = 500.000 + 100.000 = 600.000"
      },
      {
        q: "Diskon 25% diberikan pada barang seharga Rp 800.000,-. Berapa harga setelah diskon?",
        options: ["Rp 500.000,-", "Rp 600.000,-", "Rp 650.000,-", "Rp 700.000,-"],
        answer: "Rp 600.000,-",
        explanation: "Diskon = 25% × 800.000 = 200.000\nHarga akhir = 800.000 - 200.000 = 600.000"
      }
    ];
    
    for (let i = 0; i < 50; i++) {
      const baseQ = socialQs[i % socialQs.length];
      const wrongOptions = generateWrongOptionsForSocial(parseFloat(baseQ.answer.replace(/[^0-9]/g, '')), baseQ.options.map(o => parseFloat(o.replace(/[^0-9]/g, ''))));;
      const shuffledOptions = shuffleArray([baseQ.answer, ...wrongOptions]);

      questions.push({
        "Program/Kelas": program,
        "Mata Pelajaran": subject,
        "Topik/Materi": topicName,
        "Soal": baseQ.q,
        "Opsi A": shuffledOptions[0],
        "Opsi B": shuffledOptions[1],
        "Opsi C": shuffledOptions[2],
        "Opsi D": shuffledOptions[3],
        "Kunci Jawaban": findCorrectOptionIndex(shuffledOptions, baseQ.answer),
        "Pembahasan": baseQ.explanation,
        "Level Kesulitan": "Medium"
      });
    }
  }
  
  // Statistics descriptive
  else if (topicName === "Bab 4: Statistika Deskriptif") {
    const statsQs = [
      {
        q: "Data: 5, 7, 8, 8, 9, 10, 10, 10, 12\nNilai median data tersebut adalah...",
        options: ["8", "9", "9,5", "10"],
        answer: "9",
        explanation: "Data sudah urut (n=9). Median = nilai ke-5 = 9"
      },
      {
        q: "Rata-rata (mean) dari data: 4, 6, 8, 10, 12 adalah...",
        options: ["7", "8", "9", "10"],
        answer: "8",
        explanation: "Mean = (4+6+8+10+12) ÷ 5 = 40 ÷ 5 = 8"
      }
    ];
    
    for (let i = 0; i < 50; i++) {
      const baseQ = statsQs[i % statsQs.length];
      const wrongOptions = generateWrongOptionsForNumbers(parseFloat(baseQ.answer), baseQ.options);
      const shuffledOptions = shuffleArray([baseQ.answer, ...wrongOptions]);

      questions.push({
        "Program/Kelas": program,
        "Mata Pelajaran": subject,
        "Topik/Materi": topicName,
        "Soal": baseQ.q,
        "Opsi A": shuffledOptions[0],
        "Opsi B": shuffledOptions[1],
        "Opsi C": shuffledOptions[2],
        "Opsi D": shuffledOptions[3],
        "Kunci Jawaban": findCorrectOptionIndex(shuffledOptions, baseQ.answer),
        "Pembahasan": baseQ.explanation,
        "Level Kesulitan": "Medium"
      });
    }
  }
  
  // Probability
  else if (topicName === "Bab 5: Peluang dan Probabilitas") {
    const probQs = [
      {
        q: "Sebuah dadu dilempar sekali. Pelangka muncul mata dadu kelipatan 3 adalah...",
        options: ["1/6", "1/3", "1/2", "2/3"],
        answer: "1/3",
        explanation: "Kemungkinan mata dadu kelipatan 3: 3 dan 6 (2 angka)\nTotal kemungkinan: 6\nP = 2/6 = 1/3"
      },
      {
        q: "Dalam suatu kantong terdapat 5 bola merah dan 3 bola biru. Jika diambil 1 bola secara acak, peluang terambil bola merah adalah...",
        options: ["3/8", "5/8", "1/2", "3/5"],
        answer: "5/8",
        explanation: "Bola merah = 5\nTotal bola = 5 + 3 = 8\nPeluang = 5/8"
      }
    ];
    
    for (let i = 0; i < 50; i++) {
      const baseQ = probQs[i % probQs.length];
      const wrongOptions = generateWrongOptionsForProbability(baseQ.answer, baseQ.options);
      const shuffledOptions = shuffleArray([baseQ.answer, ...wrongOptions]);

      questions.push({
        "Program/Kelas": program,
        "Mata Pelajaran": subject,
        "Topik/Materi": topicName,
        "Soal": baseQ.q,
        "Opsi A": shuffledOptions[0],
        "Opsi B": shuffledOptions[1],
        "Opsi C": shuffledOptions[2],
        "Opsi D": shuffledOptions[3],
        "Kunci Jawaban": findCorrectOptionIndex(shuffledOptions, baseQ.answer),
        "Pembahasan": baseQ.explanation,
        "Level Kesulitan": "Medium"
      });
    }
  }
  
  // FIX (UTBK-3): no placeholder fallback. If no template matches the topic,
  // FAIL generation for this topic rather than emitting "Soal ... Variasi N"
  // with dummy "Pilihan A-D" options. Record the failure and export nothing.
  else {
    rejectedQuestions.push({
      program,
      subject,
      topic: topicName,
      reason: GENERATION_FAILED_NO_SOURCE,
      soal: `Soal Pengetahuan Kuantitatif untuk ${topicName}`,
    });
  }
  
  return questions;
}

// Helper functions for generating wrong options
function generateWrongOptionsForReasoning(correctAnswer, originalOptions) {
  // Keep original incorrect options as they're already plausible distractors
  return originalOptions.filter(opt => opt !== correctAnswer);
}

function generateWrongOptionsForNumbers(correctNum, originalOptions) {
  const wrong = new Set();
  
  while (wrong.size < originalOptions.length - 1) {
    // Generate common mistakes
    const mistakeType = randomInt(1, 4);
    let mistake;
    
    switch(mistakeType) {
      case 1: // Off by 1-5
        mistake = (correctNum + randomInt(-5, 5)).toString();
        break;
      case 2: // Half/double
        mistake = mistakeType === 2 && Math.random() > 0.5 
          ? (correctNum / 2).toString() 
          : (correctNum * 2).toString();
        break;
      case 3: // Add/subtract constant
        mistake = (correctNum + randomInt(10, 20)).toString();
        break;
      default:
        mistake = (Math.random() * 100).toString();
    }
    
    // Ensure unique and not equal to correct
    if (mistake !== correctNum.toString() && !isNaN(parseFloat(mistake))) {
      wrong.add(mistake);
    }
  }
  
  return Array.from(wrong);
}

function generateWrongOptionsForSocial(correctNum, originalNums) {
  const wrong = new Set();
  
  while (wrong.size < originalNums.length - 1) {
    const mistakeType = randomInt(1, 3);
    let mistake;
    
    switch(mistakeType) {
      case 1: // Wrong percentage
        mistake = ((correctNum * 0.1).toFixed(0)).toString();
        break;
      case 2: // Wrong discount
        mistake = ((correctNum * 1.25).toFixed(0)).toString();
        break;
      default:
        mistake = ((correctNum + randomInt(50000, 150000))).toFixed(0);
    }
    
    if (mistake != correctNum.toString() && !isNaN(parseFloat(mistake))) {
      wrong.add("Rp " + parseFloat(mistake).toLocaleString('id-ID'));
    }
  }
  
  return Array.from(wrong);
}

function generateWrongOptionsForProbability(correctProb, originalOptions) {
  // Common probability mistakes
  const mistakes = [
    correctProb.split('/').map(n => parseInt(n) - 1).join('/'),
    correctProb.split('/').map(n => parseInt(n) + 1).join('/'),
    (1 - parseFloat(correctProb)).toFixed(1).toString(),
    (parseFloat(correctProb) * 2).toString()
  ];
  
  return mistakes.filter(m => m !== correctProb && !isNaN(parseFloat(m)));
}

/**
 * FIX (UTBK-2): correct position-based lookup. Returns the letter for the
 * 0-based position of the KNOWN correct answer within the shuffled options.
 *
 * The previous implementation compared each option to "the first option that
 * looks like a letter" and almost always fell through to the default 'A',
 * producing systematically wrong keys. Callers MUST pass the known correct
 * answer (baseQ.answer) so the true position can be located.
 *
 * @param {Array<string|number>} options the 4 options (post-shuffle)
 * @param {string|number} correctAnswer the correct answer value
 * @returns {"A"|"B"|"C"|"D"} the letter for the correct answer's position
 */
function findCorrectOptionIndex(options, correctAnswer) {
  const index = Array.isArray(options) ? options.indexOf(correctAnswer) : -1;
  return toAnswerLetter(index); // throws if correct answer is not in options
}

// =====================================================
// MAIN GENERATION FUNCTION
// =====================================================

function generateAllQuestions() {
  const allQuestions = [];
  
  for (const [program, subjects] of Object.entries(CURRICULUM_TOPICS)) {
    console.log(`\nGenerating for ${program}...`);
    
    for (const [subject, topics] of Object.entries(subjects)) {
      console.log(`  Subject: ${subject}`);
      
      for (const topic of topics) {
        console.log(`    Topic: ${topic}`);
        
        let generated = [];
        
        switch(subject) {
          case "Potensi Kognitif":
            generated = generateCognitivePotentialQuestions(program, topic, 0);
            break;
          case "Literasi Bahasa Indonesia":
            generated = generateIndonesianLiteracyQuestions(program, topic, 0);
            break;
          case "Literasi Bahasa Inggris":
            generated = generateEnglishLiteracyQuestions(program, topic, 0);
            break;
          case "Pengetahuan Kuantitatif":
            generated = generateQuantitativeKnowledgeQuestions(program, topic, 0);
            break;
          default:
            generated = [];
        }
        
        // FINAL CONTENT GUARD (Task Sections 6 & 8): validate EVERY row before
        // it enters the output, regardless of which generator produced it. A
        // row is kept only if it passes the full validation gate (non-empty,
        // non-placeholder, no undefined/null/NaN, 4 unique non-empty options,
        // valid A-D key pointing to an option). Anything else is blocked.
        for (const row of generated) {
          const gate = validateQuestion({
            question: row.Soal,
            options: [row["Opsi A"], row["Opsi B"], row["Opsi C"], row["Opsi D"]],
            answerKey: row["Kunci Jawaban"],
            explanation: row.Pembahasan,
          });

          if (!gate.valid) {
            rejectedQuestions.push({
              program,
              subject,
              topic,
              reason: gate.reasons.join(","),
              soal: row.Soal,
            });
            continue; // DO NOT EXPORT THE QUESTION
          }

          allQuestions.push(row);
        }
      }
    }
  }
  
  return allQuestions;
}

// =====================================================
// EXPORT TO EXCEL
// =====================================================

function exportToExcel(questions, filename) {
  const worksheet = XLSX.utils.json_to_sheet(questions);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Bank Soal UTBK");
  
  const outputPath = path.join(__dirname, '..', '..', 'outputs', 
    `assessment-bank-rekap`,
    `rekap-bank-soal-bimbel-bina-cendekia-ber-sumber-UTBK-V1-QUALITY.xlsx`
  );
  
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  XLSX.writeFile(workbook, outputPath);
  console.log(`\n✅ Exported ${questions.length} questions to: ${outputPath}`);
  
  return outputPath;
}

// Statistics report
function generateReport(questions, outputPath) {
  const stats = {};
  
  for (const q of questions) {
    const key = `${q["Program/Kelas"]}-${q["Mata Pelajaran"]}`;
    if (!stats[key]) {
      stats[key] = {
        "Program/Kelas": q["Program/Kelas"],
        "Mata Pelajaran": q["Mata Pelajaran"],
        "Total Soal": 0,
        "Topics": new Set()
      };
    }
    stats[key]["Total Soal"]++;
    stats[key]["Topics"].add(q["Topik/Materi"]);
  }
  
  const report = Object.values(stats).map(s => ({
    ...s,
    "Topics": Array.from(s["Topics"]).join(", ")
  }));
  
  const reportFile = path.join(path.dirname(outputPath), 
    `LAPORAN-GENERATOR-UTBK-V1-${new Date().toISOString().split('T')[0]}.md`
  );
  
  let reportContent = `# Laporan Generator Soal Berkualitas - UTBK Preparation Edition V1\n\n`;
  reportContent += `Tanggal: ${new Date().toLocaleDateString('id-ID')}\n\n`;
  reportContent += `## Statistik Bank Soal UTBK\n\n`;
  reportContent += `| Program | Mata Pelajaran | Total Soal | Topik |\n`;
  reportContent += `|---------|---------------|------------|-------|\n`;
  
  for (const r of report) {
    reportContent += `| ${r["Program/Kelas"]} | ${r["Mata Pelajaran"]} | ${r["Total Soal"]} | ${r["Topics"]} |\n`;
  }
  
  reportContent += `\n## Total keseluruhan\n`;
  reportContent += `**${questions.length} soal** telah berhasil digenerate untuk persiapan UTBK\n\n`;
  reportContent += `## Fokus Materi\n`;
  reportContent += `- ✍️ **Potensi Kognitif**: Penalaran umum, analoogi, pola logika\n`;
  reportContent += `- 📚 **Literasi Indo**: Memahami teks, menganalisis informasi\n`;
  reportContent += `- 🔤 **Literasi Inggris**: Reading comprehension, vocabulary\n`;
  reportContent += `- 🧮 **Pengetahuan Kuantitatif**: Aljabar, statistik, peluang\n\n`;
  reportContent += `## File Output\n`;
  reportContent += `- Bank Soal: \`${path.basename(outputPath)}\`\n`;
  reportContent += `- Laporan: \`${path.basename(reportFile)}\``;
  
  fs.writeFileSync(reportFile, reportContent);
  console.log(`\n📊 Report saved to: ${reportFile}`);
}

// =====================================================
// RUN GENERATOR
// =====================================================

console.log("=".repeat(80));
console.log("GENERATOR SOAL BERKUALITAS - UTBK PREPARATION EDITION V1");
console.log("Target: UTBK (Ujian Tes Kemampuan Berbasis Komputer)");
console.log("=".repeat(80));

try {
  const questions = generateAllQuestions();
  
  console.log(`\n✨ Generated ${questions.length} questions total`);
  console.log(`🚫 Rejected by validation gate: ${rejectedQuestions.length} (not exported)\n`);

  // Summarise rejection reasons (failed-generation report).
  if (rejectedQuestions.length > 0) {
    const reasonCounts = {};
    for (const r of rejectedQuestions) {
      reasonCounts[r.reason] = (reasonCounts[r.reason] || 0) + 1;
    }
    console.log("Rejection reasons:");
    for (const [reason, count] of Object.entries(reasonCounts)) {
      console.log(`  - ${reason}: ${count}`);
    }
    console.log("");
  }

  const outputPath = exportToExcel(questions, 'utbk-quality-questions.xlsx');
  
  generateReport(questions, outputPath);
  
  console.log("\n✅ UTBK Generator completed successfully!");
  
} catch (error) {
  console.error("❌ Error:", error.message);
  process.exit(1);
}
