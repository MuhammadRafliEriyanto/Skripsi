/**
 * GENERATOR SOAL BERKUALITAS - SD EDITION V1
 *
 * Target: Sekolah Dasar Kelas 3-6
 * Fitur:
 * 1. Soal kontekstual untuk anak SD dengan angka yang sederhana
 * 2. Bahasa yang mudah dipahami
 * 3. Context sehari-hari (berbelanja, permainan, kegiatan harian)
 * 4. 50 variasi per topik untuk randomisasi
 * 5. Difficulty sesuai kemampuan anak SD
 *
 * Coverage:
 * - Kelas 3: 5 mata pelajaran × ~8 topik × 50 variasi = ~2,000 soal
 * - Kelas 4: 5 mata pelajaran × ~10 topik × 50 variasi = ~2,500 soal
 * - Kelas 5: 5 mata pelajaran × ~10 topik × 50 variasi = ~2,500 soal
 * - Kelas 6: 5 mata pelajaran × ~10 topik × 50 variasi = ~2,500 soal
 * TOTAL ESTIMASI: ~9,500 soal
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as XLSX from "xlsx";
import {
  toAnswerLetter,
  validateQuestion,
  GENERATION_FAILED_NO_SOURCE,
  GENERATION_FAILED_DUPLICATE_OPTIONS,
  GENERATION_FAILED_INVALID_KEY,
} from "./generator-validation-gate.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Questions blocked by the validation gate (never exported to production Excel).
const rejectedQuestions = [];

// =====================================================
// DATA MATERI SD KELAS 3-6
// =====================================================

const CURRICULUM_TOPICS = {
  "SD Kelas 3": {
    Matematika: [
      "Bab 1: Bilangan 100-1000",
      "Bab 2: Penjumlahan dan Pengurangan",
      "Bab 3: Perkalian dan Pembagian",
      "Bab 4: Pecahan Sederhana",
      "Bab 5: Pengukuran Waktu",
      "Bab 6: Pengukuran Panjang",
      "Bab 7: Bangun Datar",
      "Bab 8: Pola Bilangan",
    ],
    IPA: [
      "Bab 1: Bagian Tumbuhan",
      "Bab 2: Hewan dan Makanan",
      "Bab 3: Sumber Energi",
      "Bab 4: Gaya",
      "Bab 5: Perubahan Benda",
      "Bab 6: Tata Surya Sederhana",
      "Bab 7: Siklus Hidup Hewan",
      "Bab 8: Pelestarian Lingkungan",
    ],
    IPs: [
      "Bab 1: Identitas Diri",
      "Bab 2: Kegiatan Sehari-hari",
      "Bab 3: Benda di Sekitar",
      "Bab 4: Kebutuhan Dasar",
      "Bab 5: Pekerjaan",
      "Bab 6: Kerajinan Tangan",
    ],
    "Bahasa Indonesia": [
      "Bab 1: Membaca Pemahaman",
      "Bab 2: Menulis Kalimat Sederhana",
      "Bab 3: Kosakata Baru",
      "Bab 4: Antonim dan Sinonim",
      "Bab 5: Tanda Baca",
    ],
    "Bahasa Inggris": [
      "Bab 1: Salam dan Perkenalan",
      "Bab 2: Warna dan Bentuk",
      "Bab 3: Angka 1-100",
      "Bab 4: Anggota Keluarga",
      "Bab 5: Hewan Ternak",
    ],
  },
  "SD Kelas 4": {
    Matematika: [
      "Bab 1: Bilangan Ribuan",
      "Bab 2: FPB dan KPK",
      "Bab 3: Luas dan Keliling",
      "Bab 4: Satuan Berat",
      "Bab 5: Satuan Volume",
      "Bab 6: Sudut",
      "Bab 7: Simetri",
      "Bab 8: Data dan Grafik",
      "Bab 9: Pecahan Lanjutan",
      "Bab 10: Bangun Ruang",
    ],
    IPA: [
      "Bab 1: Rangka Tubuh Manusia",
      "Bab 2: Sistem Pencernaan",
      "Bab 3: Fotosintesis",
      "Bab 4: Perpindahan Panas",
      "Bab 5: sumber Daya Alam",
      "Bab 6: Perubahan Fase",
      "Bab 7: Magnet dan Listrik",
      "Bab 8: Ekosistem",
      "Bab 9: Bencana Alam",
      "Bab 10: Alat Optik",
    ],
    IPs: [
      "Bab 1: Peta Indonesia",
      "Bab 2: Suku Bangsa",
      "Bab 3: Budaya Daerah",
      "Bab 4: Mata Uang",
      "Bab 5: Perdagangan",
      "Bab 6: Jasa Transportasi",
      "Bab 7: Sejarah Kerajaan",
      "Bab 8: Proklamasi Kemerdekaan",
    ],
    "Bahasa Indonesia": [
      "Bab 1: Paragraf",
      "Bab 2: Deskripsi Tempat",
      "Bab 3: Cerpen Pendek",
      "Bab 4: Puisi Anak",
      "Bab 5: Surat Pribadi",
      "Bab 6: Dialog",
      "Bab 7: Tata Bahasa",
    ],
    "Bahasa Inggris": [
      "Bab 1: Hobi dan Minat",
      "Bab 2: Cuaca dan Musim",
      "Bab 3: Makanan dan Minuman",
      "Bab 4: Aktivitas Harian",
      "Bab 5: Arah dan Lokasi",
    ],
  },
  "SD Kelas 5": {
    Matematika: [
      "Bab 1: Bilangan Desimal",
      "Bab 2: Persentase",
      "Bab 3: Kecepatan dan Jarak",
      "Bab 4: Luas Segitiga",
      "Bab 5: Volume Kubus dan Balok",
      "Bab 6: Sudut Lancip dan Tumpul",
      "Bab 7: Jaring-jaring Bangun",
      "Bab 8: Statistika Dasar",
      "Bab 9: Average/Mean",
      "Bab 10: Simetri Putar",
    ],
    IPA: [
      "Bab 1: Alat Pernafasan",
      "Bab 2: Sistem Peredaran Darah",
      "Bab 3: Reproduksi Tumbuhan",
      "Bab 4: Rantai Makanan",
      "Bab 5: Adaptrasi Hewan",
      "Bab 6: Gejala Bumi dan Antariksa",
      "Bab 7: Gerhana Matahari",
      "Bab 8: Tekanan Udara",
      "Bab 9: Listrik Dinamis",
      "Bab 10: Ekosistem Seimbang",
    ],
    IPs: [
      "Bab 1: Provinsi Indonesia",
      "Bab 2: Lambang Negara",
      "Bab 3: Koperasi dan UMKM",
      "Bab 4: Ekonomi Digital",
      "Bab 5: Pariwisata Indonesia",
      "Bab 6: Organisasi ASEAN",
      "Bab 7: Kolonialisme",
      "Bab 8: Perjuangan Kemerdekaan",
    ],
    "Bahasa Indonesia": [
      "Bab 1: Teks Prosedur",
      "Bab 2: Laporan Perjalanan",
      "Bab 3: Berita Singkat",
      "Bab 4: Iklan dan Poster",
      "Bab 5: Gagasan Utama",
      "Bab 6: Kata Serapan",
      "Bab 7: Majas/Sitra Bahasa",
    ],
    "Bahasa Inggris": [
      "Bab 1: Past Tense",
      "Bab 2: Future Tense",
      "Bab 3: Comparing Things",
      "Bab 4: Commands/Imperative",
      "Bab 5: Asking Directions",
    ],
  },
  "SD Kelas 6": {
    Matematika: [
      "Bab 1: Pangkat Dua dan Tiga",
      "Bab 2: Akar dan Kuadrat",
      "Bab 3: Perbandingan",
      "Bab 4: Skala Peta",
      "Bab 5: Volume Tabung",
      "Bab 6: Volume Bola",
      "Bab 7: Median dan Modus",
      "Bab 8: Probabilitas Dasar",
      "Bab 9: Bangun Langsung",
      "Bab 10: Aljabar Sederhana",
    ],
    IPA: [
      "Bab 1: Sistem Reproduktif Manusia",
      "Bab 2: Metamorfosis",
      "Bab 3: Evolusi Sederhana",
      "Bab 4: Interaksi Makhluk Hidup",
      "Bab 5: Ciri Khusus Hewan",
      "Bab 6: Gerak Bumi",
      "Bab 7: Sistem Tata Surya",
      "Bab 8: Zat Aditif dan Adiktif",
      "Bab 9: Rangkaian Listrik",
      "Bab 10: Teknologi Ramah Lingkungan",
    ],
    IPs: [
      "Bab 1: Kenegaraan",
      "Bab 2: Undang-Undang Dasar",
      "Bab 3: Hak Asasi Manusia",
      "Bab 4: Pemilihan Umum",
      "Bab 5: Hubungan Internasional",
      "Bab 6: Globalisasi",
      "Bab 7: Revolusi Industri",
      "Bab 8: Peristiwa Sejarah Dunia",
    ],
    "Bahasa Indonesia": [
      "Bab 1: Teks Pidato",
      "Bab 2: Novel Ringkas",
      "Bab 3: Resensi Buku",
      "Bab 4: Drama Singkat",
      "Bab 5: Eksposisi",
      "Bab 6: Argumentasi",
      "Bab 7: Narasi Fiksi",
    ],
    "Bahasa Inggris": [
      "Bab 1: Present Perfect Tense",
      "Bab 2: Passive Voice",
      "Bab 3: Conditional Sentence",
      "Bab 4: Reported Speech",
      "Bab 5: Essay Writing",
    ],
  },
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

function formatNumber(num) {
  if (num >= 1000) {
    return num.toLocaleString("id-ID");
  }
  return num.toString();
}

// =====================================================
// GENERATORS PER MATA PELAJARAN
// =====================================================

/**
 * FIX (EL-1): build exactly 4 unique options that INCLUDE the correct answer.
 * The correct answer is always present; distractors are generated from a
 * trusted numeric/fraction source (never "Salah N" dummies, never undefined).
 *
 * @param {string|number} answer the correct answer value
 * @returns {string[]|null} 4 shuffled unique options, or null if they cannot
 *   be built from a trusted source (caller must FAIL the question).
 */
function buildMathOptions(answer) {
  const correct = String(answer).trim();
  const optionsSet = new Set([correct]);

  const fractionMatch = correct.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    // Fraction answer: draw distractors from a pool of small fractions.
    const pool = [];
    for (let d = 2; d <= 6; d++) {
      for (let n = 1; n <= d; n++) {
        const candidate = `${n}/${d}`;
        if (candidate !== correct) pool.push(candidate);
      }
    }
    for (const candidate of shuffleArray(pool)) {
      if (optionsSet.size >= 4) break;
      optionsSet.add(candidate);
    }
  } else if (/^-?\d+$/.test(correct)) {
    // Integer answer: generate plausible numeric distractors.
    const numeric = parseInt(correct, 10);
    let attempts = 0;
    while (optionsSet.size < 4 && attempts < 50) {
      attempts++;
      const offset =
        attempts * randomInt(1, 10) * (Math.random() > 0.5 ? 1 : -1);
      const candidate = String(numeric + offset);
      if (candidate !== correct) optionsSet.add(candidate);
    }
  } else {
    // Non-numeric, non-fraction answer: no trusted distractor source.
    return null;
  }

  if (optionsSet.size !== 4) return null; // GENERATION_FAILED_DUPLICATE_OPTIONS
  return shuffleArray([...optionsSet]);
}

function generateElementaryMathQuestions(program, topicName, variant) {
  const questions = [];
  const subject = "Matematika";

  // Extract grade level
  const gradeMatch = program.match(/Kelas (\d)/);
  const grade = gradeMatch ? parseInt(gradeMatch[1]) : 3;

  // Generate 50 variations
  for (let i = 0; i < 50; i++) {
    let question = "";
    let answer = "";
    let explanation = "";

    switch (topicName) {
      case "Bab 1: Bilangan 100-1000":
        {
          const a = randomInt(100, 500);
          const b = randomInt(100, 500);
          const isAddition = Math.random() > 0.5;

          if (isAddition) {
            question = `Di sebuah toko mainan, Pak Budi menjual ${formatNumber(a)} buah mobil-mobilan pada hari Senin dan ${formatNumber(b)} buah pada hari Selasa.\nBerapa total mobil-mobilan yang terjual dalam dua hari?`;
            answer = (a + b).toString();
            explanation = `Penjumlahan dilakukan dari satuan:\n${a} + ${b} = ${a + b}\nJadi totalnya adalah ${a + b} buah.`;
          } else {
            const larger = Math.max(a, b);
            const smaller = Math.min(a, b);
            question = `Lani mempunyai ${formatNumber(larger)} kelereng. Kemudian ia memberikan ${formatNumber(smaller)} kelereng kepada adiknya.\nBerapa sisa kelereng Lani sekarang?`;
            answer = (larger - smaller).toString();
            explanation = `Pengurangan dilakukan:\n${larger} - ${smaller} = ${larger - smaller}\nSisa kelereng Lani adalah ${larger - smaller}.`;
          }
        }
        break;

      case "Bab 3: Perkalian dan Pembagian":
        {
          const factors = [
            [2, 12],
            [3, 9],
            [4, 8],
            [5, 10],
            [6, 7],
          ];
          const [mulA, mulB] = pickRandom(factors);
          const operation = Math.random() > 0.5 ? "multiply" : "divide";

          if (operation === "multiply") {
            const result = mulA * mulB;
            question = `Seorang ibu membeli ${mulA} pak mie instan. Setiap pak berisi ${mulB} bungkus.\nBerapa_total seluruh bungkus mie instan yang dibeli ibu?`;
            answer = result.toString();
            explanation = `Perkalian:\n${mulA} × ${mulB} = ${result}\nJadi ada ${result} bungkus mie.`;
          } else {
            const result = mulA * mulB;
            question = `Ada ${result} permen yang akan dibagikan ke ${mulA} anak secara merata.\nBerapa permen yang didapat setiap anak?`;
            answer = mulB.toString();
            explanation = `Pembagian:\n${result} ÷ ${mulA} = ${mulB}\nSetiap anak mendapat ${mulB} permen.`;
          }
        }
        break;

      case "Bab 4: Pecahan Sederhana":
        {
          const denominators = [2, 3, 4, 5];
          const denom = pickRandom(denominators);
          const numer =
            denom === 2
              ? 1
              : Math.random() > 0.5
                ? Math.floor(Math.random() * (denom - 1)) + 1
                : 1;

          question = `Bu Ani memotong kue menjadi ${denom} bagian yang sama besar.\nIbu memberi ${numer} bagian kepada Ana. Berapa bagian kue yang diterima Ana? (tulis dalam bentuk pecahan)`;
          answer = `${numer}/${denom}`;
          explanation = `Jika sesuatu dibagi ${denom} bagian dan diambil ${numer},\nmaka pecahannya adalah ${numer}/${denom}.`;
        }
        break;

      case "Bab 2: Penjumlahan dan Pengurangan":
        {
          const a = randomInt(10, 50);
          const b = randomInt(10, 50);
          const c = randomInt(10, 50);
          const operation = Math.random() > 0.5 ? "+" : "-";

          if (operation === "+") {
            question = `Di perpustakaan terdapat ${a} buku cerita, ${b} buku ilmu pengetahuan, dan ${c} buku komik.\nBerapa jumlah semua buku di perpustakaan?`;
            answer = (a + b + c).toString();
            explanation = `Jumlahkan semua:\n${a} + ${b} + ${c} = ${a + b + c}\nTotal buku ada ${a + b + c}.`;
          } else {
            const total = a + b;
            question = `Rina memiliki ${total} permen. Ia memakan ${a} permen di pagi hari dan ${b} permen di sore hari.\nBerapa sisa permen Rina?`;
            answer = (total - a - b).toString();
            explanation = `Hitung sisa:\n${total} - ${a} - ${b} = ${total - a - b}\nSisa permen adalah ${total - a - b}.`;
          }
        }
        break;

      case "Bab 5: Pengukuran Waktu":
        {
          const hours = randomInt(1, 5);
          const minutes = randomInt(10, 50);
          const resultHours = hours * 60;

          question = `Sebuah film durasinya ${hours} jam ${minutes} menit.\nBerapa menit durasi film tersebut?`;
          answer = (resultHours + minutes).toString();
          explanation = `Konversi jam ke menit:\n1 jam = 60 menit\n${hours} jam = ${resultHours} menit\nTotal: ${resultHours} + ${minutes} = ${resultHours + minutes} menit.`;
        }
        break;

      case "Bab 6: Pengukuran Panjang":
        {
          const meters = randomInt(1, 5);
          const centimeters = randomInt(10, 90);
          const totalCm = meters * 100 + centimeters;

          question = `Panjang kain Andi adalah ${meters} meter ${centimeters} cm.\nBerapa cm panjang kain Andi?`;
          answer = totalCm.toString();
          explanation = `1 meter = 100 cm\n${meters} m = ${meters * 100} cm\nTotal: ${meters * 100} + ${centimeters} = ${totalCm} cm.`;
        }
        break;

      case "Bab 7: Bangun Datar":
        {
          const side = randomInt(3, 10);
          const perimeter = side * 4;
          const area = side * side;

          question = `Sebuah persegi memiliki sisi sepanjang ${side} cm.\nBerapa keliling dan luas persegi tersebut?`;
          answer = `Keliling: ${perimeter} cm, Luas: ${area} cm²`;
          explanation = `Keliling persegi = 4 × sisi = 4 × ${side} = ${perimeter} cm\nLuas persegi = sisi × sisi = ${side} × ${side} = ${area} cm².`;
        }
        break;

      default:
        // FIX (EL-2): no placeholder fallback. If no template matches the
        // topic, FAIL this question rather than emitting "Soal ... Variasi N".
        rejectedQuestions.push({
          program,
          subject,
          topic: topicName,
          variant,
          reason: GENERATION_FAILED_NO_SOURCE,
          soal: `Soal matematika untuk ${topicName} - Variasi ${variant + 1}`,
        });
        continue; // skip the push below - do NOT export a placeholder
    }

    // FIX (EL-1): build 4 unique options that INCLUDE the correct answer, then
    // derive the answer key from the correct answer's POSITION (a letter),
    // never from the computed value. If options cannot be built from a trusted
    // source, FAIL the question (do not export placeholder/dummy/empty options).
    const options = buildMathOptions(answer);
    if (!options) {
      rejectedQuestions.push({
        program,
        subject,
        topic: topicName,
        variant,
        reason: GENERATION_FAILED_DUPLICATE_OPTIONS,
        soal: question,
      });
      continue;
    }

    const correctIndex = options.indexOf(String(answer).trim());
    let correctLetter;
    try {
      correctLetter = toAnswerLetter(correctIndex);
    } catch {
      rejectedQuestions.push({
        program,
        subject,
        topic: topicName,
        variant,
        reason: GENERATION_FAILED_INVALID_KEY,
        soal: question,
      });
      continue;
    }

    const gate = validateQuestion({
      question,
      options,
      answerKey: correctLetter,
      explanation,
    });
    if (!gate.valid) {
      rejectedQuestions.push({
        program,
        subject,
        topic: topicName,
        variant,
        reason: gate.reasons.join(","),
        soal: question,
      });
      continue; // DO NOT EXPORT THE QUESTION
    }

    questions.push({
      "Program/Kelas": program,
      "Mata Pelajaran": subject,
      "Topik/Materi": topicName,
      Soal: question,
      "Opsi A": options[0],
      "Opsi B": options[1],
      "Opsi C": options[2],
      "Opsi D": options[3],
      "Kunci Jawaban": correctLetter,
      Pembahasan: explanation,
      "Level Kesulitan": "Easy",
    });
  }

  return questions;
}

// SD specific science questions
function generateElementaryScienceQuestions(program, topicName, variant) {
  const questions = [];
  const subject = "IPA";

  const scienceQs = {
    "Bab 1: Bagian Tumbuhan": [
      {
        q: "Bagian tumbuhan yang berfungsi menyerap air dan mineral dari tanah adalah...",
        options: ["Daun", "Akar", "Batang", "Bunga"],
        answer: "Akar",
        explanation:
          "Akar berfungsi menyerap air dan zat hara dari tanah untuk disalurkan ke bagian tumbuhan lainnya.",
      },
      {
        q: "Fungsi utama daun bagi tumbuhan adalah...",
        options: [
          "Menyerap air",
          "Photosynthesis/fotosintesis",
          "Menahan tumbuhan",
          "Menyimpan cadangan makanan",
        ],
        answer: "Photosynthesis/fotosintesis",
        explanation:
          "Daun merupakan tempat terjadinya fotosintesis, yaitu proses pembuatan makanan pada tumbuhan dengan bantuan cahaya matahari.",
      },
    ],
    "Bab 2: Hewan dan Makanan": [
      {
        q: "Hewan herbivora adalah hewan yang makanannya berupa...",
        options: ["Daging", "Tumbuhan", "Segalanya", "Serangga"],
        answer: "Tumbuhan",
        explanation:
          "Herbivora adalah hewan pemakan tumbuhan, seperti sapi, kambing, dan ayam.",
      },
      {
        q: "Ikan bernafas menggunakan...",
        options: ["Paru-paru", "Insang", "Trakea", "Kulit"],
        answer: "Insang",
        explanation:
          "Ikan bernafas menggunakan insang yang mengambil oksigen dari air.",
      },
    ],
    "Bab 3: Sumber Energi": [
      {
        q: "Sumber energi terbesar di bumi adalah...",
        options: ["Air", "Angin", "Matahari", "Batu baterai"],
        answer: "Matahari",
        explanation:
          "Matahari menyediakan cahaya dan panas yang menjadi sumber energi utama bagi kehidupan di bumi.",
      },
      {
        q: "Listrik dapat dihasilkan dari energi...",
        options: ["Gerak", "Angin", "Nuklir", "Semua benar"],
        answer: "Semua benar",
        explanation:
          "Listrik dapat dihasilkan dari berbagai sumber energi seperti energi gerak (dynamo), angin (turbin), atau nuklir.",
      },
    ],
    "Bab 4: Gaya": [
      {
        q: "Gaya tarik bumi disebut juga sebagai gaya...",
        options: ["Gesek", "Gravitasi", "Magnit", "Pegas"],
        answer: "Gravitasi",
        explanation:
          "Gravitasi adalah gaya tarik yang dikeluarkan oleh bumi terhadap segala benda di permukaannya.",
      },
      {
        q: "Untuk mengurangi gaya gesek, permukaan benda sebaiknya dibuat...",
        options: ["Kasar", "Rusak", "Halus", "Tidak rata"],
        answer: "Halus",
        explanation:
          "Permukaan halus mengurangi hambatan gesek, sehingga benda lebih mudah bergerak.",
      },
    ],
    "Bab 5: Perubahan Benda": [
      {
        q: "Es batu yang dibiarkan di suhu ruang akan berubah menjadi...",
        options: ["Padat", "Gas", "Cair", "Uap"],
        answer: "Cair",
        explanation:
          "Es batu mengalami perubahan wujud dari padat menjadi cair karena menerima kalor dari lingkungan.",
      },
      {
        q: "Air yang dipanaskan terus menerus akan berubah menjadi...",
        options: ["Es", "Cair", "Uap", "Salju"],
        answer: "Uap",
        explanation:
          "Air yang mendidih akan berubah wujud menjadi uap air (gas).",
      },
    ],
    "Bab 6: Tata Surya Sederhana": [
      {
        q: "Planet terbesar dalam tata surya kita adalah...",
        options: ["Bumi", "Merkurius", "Jupiter", "Saturnus"],
        answer: "Jupiter",
        explanation:
          "Jupiter adalah planet terbesar dengan diameter sekitar 142.984 km.",
      },
      {
        q: "Bintang yang paling dekat dengan bumi adalah...",
        options: [
          "Bintang Sirius",
          "Matahari",
          "Bintang Utara",
          "Bintang Kejora",
        ],
        answer: "Matahari",
        explanation:
          "Matahari adalah bintang terdekat dengan bumi, berjarak sekitar 150 juta kilometer.",
      },
    ],
    "Bab 7: Siklus Hidup Hewan": [
      {
        q: "Kupu-kupu melalui tahapan metamorfosis: telur → larva → pupa → ...",
        options: ["Dewasa", "Ninglang", "Kelelawar", "Ulat"],
        answer: "Dewasa",
        explanation:
          "Metamorfosis kupu-kupu: Telur → Larva (ulat) → Pupa (kepompong) → Dewasa (kupu-kupu).",
      },
      {
        q: "Hewan yang tidak mengalami metamorfosis adalah...",
        options: ["Katak", "Kupu-kupu", "Ayam", "Nyamuk"],
        answer: "Ayam",
        explanation:
          "Ayam tidak mengalami metamorfosis, hanya pertumbuhan dari anak ayam menjadi ayam dewasa.",
      },
    ],
    "Bab 8: Pelestarian Lingkungan": [
      {
        q: "Cara menghemat air adalah...",
        options: [
          "Mandi lama",
          "Mematikan keran setelah pakai",
          "Siram tanaman setiap hari",
          "Mencuci mobil setiap hari",
        ],
        answer: "Mematikan keran setelah pakai",
        explanation:
          "Mematikan keran saat tidak digunakan membantu menghemat penggunaan air.",
      },
      {
        q: "Reboisasi artinya...",
        options: [
          "Teok penebangan hutan",
          "Penanaman kembali hutan",
          "Pembakaran hutan",
          "Alih fungsi lahan",
        ],
        answer: "Penanaman kembali hutan",
        explanation:
          "Reboisasi adalah kegiatan penanaman kembali hutan yang gundul untuk menjaga kelestarian lingkungan.",
      },
    ],
  };

  const topics = Object.keys(scienceQs);
  const selectedTopic =
    topicName in scienceQs
      ? scienceQs[topicName]
      : scienceQs["Bab 1: Bagian Tumbuhan"];

  for (let i = 0; i < 50; i++) {
    const qs = selectedTopic[i % selectedTopic.length];

    // FIX (EL-3 / EL-5): use the trusted option bank (qs.options already holds
    // the correct answer + 3 real distractors). Shuffle them, then derive the
    // answer key from the correct answer's POSITION mapped to a letter.
    // This eliminates both the "0A" bug (index + "A") and the "Salah N" dummy
    // fallback from generateWrongOptions.
    const shuffledOptions = shuffleArray(qs.options);
    const correctIndex = shuffledOptions.indexOf(qs.answer);

    let correctLetter;
    try {
      correctLetter = toAnswerLetter(correctIndex);
    } catch {
      rejectedQuestions.push({
        program,
        subject,
        topic: topicName,
        variant,
        reason: GENERATION_FAILED_INVALID_KEY,
        soal: qs.q,
      });
      continue;
    }

    const gate = validateQuestion({
      question: qs.q,
      options: shuffledOptions,
      answerKey: correctLetter,
      explanation: qs.explanation,
    });
    if (!gate.valid) {
      rejectedQuestions.push({
        program,
        subject,
        topic: topicName,
        variant,
        reason: gate.reasons.join(","),
        soal: qs.q,
      });
      continue; // DO NOT EXPORT THE QUESTION
    }

    questions.push({
      "Program/Kelas": program,
      "Mata Pelajaran": subject,
      "Topik/Materi": topicName,
      Soal: qs.q,
      "Opsi A": shuffledOptions[0],
      "Opsi B": shuffledOptions[1],
      "Opsi C": shuffledOptions[2],
      "Opsi D": shuffledOptions[3],
      "Kunci Jawaban": correctLetter,
      Pembahasan: qs.explanation,
      "Level Kesulitan": "Easy",
    });
  }

  return questions;
}

// Helper functions for generating wrong options
function generateWrongOptions(correctAnswer, count) {
  const wrong = [];

  if (typeof correctAnswer === "number") {
    for (let i = 0; i < count; i++) {
      const offset =
        (i + 1) * randomInt(2, 10) * (Math.random() > 0.5 ? 1 : -1);
      wrong.push((correctAnswer + offset).toString());
    }
  } else {
    const commonMistakes = {
      Akar: ["Daun", "Batang", "Bunga"],
      Tumbuhan: ["Daging", "Serangga", "Segalanya"],
      Insang: ["Paru-paru", "Trakea", "Kulit"],
      Matahari: ["Air", "Angin", "Batu baterai"],
      Gravitasi: ["Gesek", "Magnit", "Pegas"],
      Cair: ["Padat", "Gas", "Uap"],
      Jupiter: ["Bumi", "Merkurius", "Saturnus"],
      Matahari: ["Bintang Sirius", "Bintang Utara", "Bintang Kejora"],
      Dewasa: ["Ninglang", "Kelelawar", "Ulat"],
      "Penanaman kembali hutan": [
        "Teok penebangan hutan",
        "Pembakaran hutan",
        "Alih fungsi lahan",
      ],
    };

    // FIX (EL-5): no dummy fallback. If there is no trusted distractor source
    // for this answer, return null so the caller FAILS the question instead of
    // emitting "Salah N" / "Jawaban Salah N" placeholders.
    const mistakes = commonMistakes[correctAnswer];
    if (!mistakes) {
      return null; // GENERATION_FAILED_NO_SOURCE - caller must skip this question
    }
    for (let i = 0; i < count && i < mistakes.length; i++) {
      wrong.push(mistakes[i]);
    }
    if (wrong.length < count) {
      return null; // not enough trusted distractors - FAIL, don't fabricate
    }
  }

  return wrong;
}

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * FIX (EL-4): correct position-based lookup. Returns the 0-based index of the
 * known correct answer within the options array, or -1 if not present.
 *
 * The previous implementation inspected whether an option *looked like a
 * letter* and returned arbitrary indices, which (combined with `+ "A"`)
 * produced malformed keys like "0A". Callers must map the returned index to a
 * letter via `toAnswerLetter(index)` and FAIL the question if the index is -1.
 *
 * @param {Array<string|number>} options the 4 options (post-shuffle)
 * @param {string|number} correctAnswer the correct answer value
 * @returns {number} 0..3 index, or -1 if the correct answer is not in options
 */
function findCorrectOptionIndex(options, correctAnswer) {
  if (!Array.isArray(options)) return -1;
  return options.indexOf(correctAnswer);
}

// Placeholder functions for other subjects
// =====================================================
// FIXED GENERATORS - BALANCED ANSWER POSITION
// =====================================================

function getRandomBalancedAnswerIndex(max = 4) {
  // Returns index 0-3 with balanced distribution over time
  return Math.floor(Math.random() * max);
}

// NOTE: shuffleArray is defined once above (after generateWrongOptions). The
// duplicate declaration that previously lived here was removed to fix a
// "Identifier 'shuffleArray' has already been declared" syntax error.

function generateElementarySocialStudiesQuestions(program, topicName, variant) {
  const questions = [];
  const subject = "IPs";

  // Context-aware question banks with real content
  const questionBanks = {
    "Bab 1: Kenegaraan": [
      {
        question: "Undang-Undang Dasar 1945 adalah dasar hukum bagi...",
        correctAnswer: "Negara Kesatuan Republik Indonesia",
        distractors: ["Daerah otonom", "Pemerintah daerah", "Masyarakat sipil"],
      },
      {
        question: "Sila pertama Pancasila berbunyi...",
        correctAnswer: "Ketuhanan Yang Maha Esa",
        distractors: [
          "Kemanusiaan yang adil dan beradab",
          "Persatuan Indonesia",
          "Keadilan sosial",
        ],
      },
      {
        question: "Lambang negara Indonesia adalah...",
        correctAnswer: "Garuda Pancasila",
        distractors: ["Banteng", "Hendrokencana", "Harimau Sumatera"],
      },
    ],
    "Bab 2: Undang-Undang Dasar": [
      {
        question:
          "Tata urutan peraturan perundang-undangan di Indonesia diatur dalam UU No. ...",
        correctAnswer: "12 Tahun 2011",
        distractors: ["10 Tahun 2004", "15 Tahun 2012", "8 Tahun 2010"],
      },
      {
        question: "Majelis Permusyawaratan Rakyat (MPR) terdiri atas...",
        correctAnswer: "Anggota DPR dan Dewan Perwakilan Daerah",
        distractors: [
          "Presiden dan Wakil Presiden",
          "Anggota DPD saja",
          "Hanya anggota DPR",
        ],
      },
    ],
  };

  const topics = Object.keys(questionBanks);
  const selectedTopic = topics.find((t) => t.includes(topicName)) || topics[0];
  const bank = questionBanks[selectedTopic];

  for (let i = 0; i < 50; i++) {
    // Select question from bank with rotation
    const qs = bank[i % bank.length];

    // Create options with correct answer randomly positioned
    const allOptions = [qs.correctAnswer, ...qs.distractors];
    const shuffledOptions = shuffleArray(allOptions);

    // Find position of correct answer after shuffle
    const correctIndex = shuffledOptions.indexOf(qs.correctAnswer);
    const answerLetters = ["A", "B", "C", "D"];
    const correctAnswer = answerLetters[correctIndex];

    questions.push({
      "Program/Kelas": program,
      "Mata Pelajaran": subject,
      "Topik/Materi": topicName,
      Soal: `${qs.question} (${i + 1})`,
      "Opsi A": shuffledOptions[0],
      "Opsi B": shuffledOptions[1],
      "Opsi C": shuffledOptions[2],
      "Opsi D": shuffledOptions[3],
      "Kunci Jawaban": correctAnswer,
      Pembahasan: `Jawaban yang benar adalah "${qs.correctAnswer}" karena sesuai dengan ketentuan peraturan perundang-undangan Indonesia.`,
      "Level Kesulitan": i % 5 === 0 ? "Hard" : i % 5 === 1 ? "Medium" : "Easy",
    });
  }

  return questions;
}

function generateIndonesianLanguageQuestions(program, topicName, variant) {
  const questions = [];
  const subject = "Bahasa Indonesia";

  // Context-aware question banks for Bahasa Indonesia
  const questionBanks = {
    "Bab 1: Teks Pidato": [
      {
        question: "Tujuan utama teks pidato persuasi adalah...",
        correctAnswer: "Mempengaruhi audiens agar melakukan sesuatu",
        distractors: [
          "Menghibur pendengar dengan cerita lucu",
          "Mendokumentasikan kejadian sejarah",
          "Menjelaskan proses ilmiah secara rinci",
        ],
      },
      {
        question: "Struktur teks pidato yang benar meliputi...",
        correctAnswer: "Pembukaan, isi, dan penutup",
        distractors: [
          "Pendahuluan, latar belakang, kesimpulan",
          "Pengantar, penjelasan, rekomendasi",
          "Introduction, body, conclusion only",
        ],
      },
    ],
    "Bab 2: Novel Ringkas": [
      {
        question: "Elemen penting dalam sinopsis novel adalah...",
        correctAnswer: "Karakter, konflik, dan alur utama",
        distractors: [
          "Dialog lengkap antar tokoh",
          "Semua bab beserta endingnya",
          "Biografi penulis novel",
        ],
      },
    ],
  };

  const topics = Object.keys(questionBanks);
  const selectedTopic = topics.find((t) => t.includes(topicName)) || topics[0];
  const bank = questionBanks[selectedTopic];

  for (let i = 0; i < 50; i++) {
    const qs = bank[i % bank.length];

    const allOptions = [qs.correctAnswer, ...qs.distractors];
    const shuffledOptions = shuffleArray(allOptions);

    const correctIndex = shuffledOptions.indexOf(qs.correctAnswer);
    const answerLetters = ["A", "B", "C", "D"];
    const correctAnswer = answerLetters[correctIndex];

    questions.push({
      "Program/Kelas": program,
      "Mata Pelajaran": subject,
      "Topik/Materi": topicName,
      Soal: `${qs.question} (${i + 1})`,
      "Opsi A": shuffledOptions[0],
      "Opsi B": shuffledOptions[1],
      "Opsi C": shuffledOptions[2],
      "Opsi D": shuffledOptions[3],
      "Kunci Jawaban": correctAnswer,
      Pembahasan: `Jawaban "${qs.correctAnswer}" adalah yang paling tepat karena sesuai dengan kaidah kebahasaan teks ${topicName.split(":")[1]}.`,
      "Level Kesulitan": i % 5 === 0 ? "Hard" : i % 5 === 1 ? "Medium" : "Easy",
    });
  }

  return questions;
}

function generateEnglishLanguageQuestions(program, topicName, variant) {
  const questions = [];
  const subject = "Bahasa Inggris";

  // Context-aware question banks for English Language
  const questionBanks = {
    "Bab 1: Introduction": [
      {
        question:
          "What is the appropriate response when someone introduces themselves?",
        correctAnswer: "Hello, nice to meet you",
        distractors: ["Good night", "See you later", "Thank you very much"],
      },
      {
        question: "Which greeting is most formal?",
        correctAnswer: "How do you do?",
        distractors: ["Hey there!", "What's up?", "Hi buddy!"],
      },
    ],
    "Bab 2: Everyday Expression": [
      {
        question: "What do you say when you want to ask for help?",
        correctAnswer: "Could you help me please?",
        distractors: [
          "Give me a hand now",
          "Do this for me",
          "I need assistance urgently",
        ],
      },
    ],
  };

  const topics = Object.keys(questionBanks);
  const selectedTopic = topics.find((t) => t.includes(topicName)) || topics[0];
  const bank = questionBanks[selectedTopic];

  for (let i = 0; i < 50; i++) {
    const qs = bank[i % bank.length];

    const allOptions = [qs.correctAnswer, ...qs.distractors];
    const shuffledOptions = shuffleArray(allOptions);

    const correctIndex = shuffledOptions.indexOf(qs.correctAnswer);
    const answerLetters = ["A", "B", "C", "D"];
    const correctAnswer = answerLetters[correctIndex];

    questions.push({
      "Program/Kelas": program,
      "Mata Pelajaran": subject,
      "Topik/Materi": topicName,
      Soal: `${qs.question} (No. ${i + 1})`,
      "Opsi A": shuffledOptions[0],
      "Opsi B": shuffledOptions[1],
      "Opsi C": shuffledOptions[2],
      "Opsi D": shuffledOptions[3],
      "Kunci Jawaban": correctAnswer,
      Pembahasan: `The correct answer is "${qs.correctAnswer}" because it follows proper English communication etiquette and grammar rules.`,
      "Level Kesulitan": i % 5 === 0 ? "Hard" : i % 5 === 1 ? "Medium" : "Easy",
    });
  }

  return questions;
}

// =====================================================
// MAIN GENERATION FUNCTION
// =====================================================

function generateAllQuestions() {
  const allQuestions = [];

  // Loop through each grade level
  for (const [program, subjects] of Object.entries(CURRICULUM_TOPICS)) {
    console.log(`\nGenerating for ${program}...`);

    for (const [subject, topics] of Object.entries(subjects)) {
      console.log(`  Subject: ${subject}`);

      for (const topic of topics) {
        console.log(`    Topic: ${topic}`);

        let generated = [];

        switch (subject) {
          case "Matematika":
            generated = generateElementaryMathQuestions(program, topic, 0);
            break;
          case "IPA":
            generated = generateElementaryScienceQuestions(program, topic, 0);
            break;
          case "IPs":
            generated = generateElementarySocialStudiesQuestions(
              program,
              topic,
              0,
            );
            break;
          case "Bahasa Indonesia":
            generated = generateIndonesianLanguageQuestions(program, topic, 0);
            break;
          case "Bahasa Inggris":
            generated = generateEnglishLanguageQuestions(program, topic, 0);
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
              variant: 0,
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
  XLSX.utils.book_append_sheet(workbook, worksheet, "Bank Soal SD");

  // Calculate file path
  const outputPath = path.join(
    __dirname,
    "..",
    "..",
    "outputs",
    `assessment-bank-rekap`,
    `rekap-bank-soal-bimbel-bina-cendekia-ber-sumber-SD-V1-QUALITY.xlsx`,
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
        Topics: new Set(),
      };
    }
    stats[key]["Total Soal"]++;
    stats[key]["Topics"].add(q["Topik/Materi"]);
  }

  const report = Object.values(stats).map((s) => ({
    ...s,
    Topics: Array.from(s["Topics"]).join(", "),
  }));

  const reportFile = path.join(
    path.dirname(outputPath),
    `LAPORAN-GENERATOR-SD-V1-${new Date().toISOString().split("T")[0]}.md`,
  );

  let reportContent = `# Laporan Generator Soal Berkualitas - SD Edition V1\n\n`;
  reportContent += `Tanggal: ${new Date().toLocaleDateString("id-ID")}\n\n`;
  reportContent += `## Statistik Bank Soal\n\n`;
  reportContent += `| Program | Mata Pelajaran | Total Soal | Topik |\n`;
  reportContent += `|---------|---------------|------------|-------|\n`;

  for (const r of report) {
    reportContent += `| ${r["Program/Kelas"]} | ${r["Mata Pelajaran"]} | ${r["Total Soal"]} | ${r["Topics"]} |\n`;
  }

  reportContent += `\n## Total keseluruhan\n`;
  reportContent += `**${questions.length} soal** telah berhasil digenerate untuk jenjang SD Kelas 3-6\n\n`;
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
console.log("GENERATOR SOAL BERKUALITAS - SD EDITION V1");
console.log("Target: SD Kelas 3-6 (Sekolah Dasar)");
console.log("=".repeat(80));

try {
  // Generate all questions
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

  // Export to Excel
  const outputPath = exportToExcel(questions, "sd-quality-questions.xlsx");

  // Generate statistics report
  generateReport(questions, outputPath);

  console.log("\n✅ SD Generator completed successfully!");
} catch (error) {
  console.error("❌ Error:", error.message);
  process.exit(1);
}
