/**
 * GENERATOR SOAL IPS KELAS 3 SD — V7 Pilot
 *
 * Menghasilkan soal PG 4 opsi dengan:
 * - Variasi konteks otomatis (untuk 500+ soal per bab)
 * - Kunci jawaban mengikuti POSISI opsi (diacak, tidak bias)
 * - Kadang memakai aset SVG (silsilah keluarga, tabel) untuk soal analisis
 *
 * Pola: `buildAndValidate` dari generator-validation-gate.mjs
 */

import { buildAndValidate } from "../generator-validation-gate.mjs";
import {
  randomInt,
  pickRandom,
  shuffleArray,
  makeOptions,
  kapital,
  gabungDaftar,
} from "./lib/soal-helpers.mjs";
import { svgSilsilahKeluarga, svgTabelData, svgBarChart } from "./lib/aset-svg.mjs";

function buatSoal(meta, buildFn, rng) {
  const ctx = { rng, ...meta };
  const raw = buildFn(ctx);

  const soal = raw.options.map((o) => String(o).trim());
  const nilaiBenar = soal[raw.correctAnswerIndex];
  const { options, correctAnswerIndex } = makeOptions(nilaiBenar, soal, rng);

  const { valid, answerKey, reasons } = buildAndValidate({
    question: raw.question,
    options,
    correctAnswerIndex,
    explanation: raw.explanation,
  });

  if (!valid) {
    return { valid: false, reasons, meta: `${meta.bab} / ${meta.subBab}` };
  }

  return {
    valid: true,
    program: meta.program,
    kelas: meta.kelas,
    fase: meta.fase,
    subject: meta.subject,
    bab: meta.bab,
    subBab: meta.subBab,
    kompetensi: raw.kompetensi || meta.kompetensi || "",
    tipe: "PG",
    teksSoal: raw.question,
    teksPendukung: raw.teksPendukung || "",
    gambarUrl: raw.gambarUrl || null,
    opsiA: options[0],
    opsiB: options[1],
    opsiC: options[2],
    opsiD: options[3],
    kunci: answerKey,
    pembahasan: raw.explanation || "",
    kesulitan: raw.kesulitan || "Sedang",
  };
}

// =====================================================
// TEMPLATE SOAL per subBab
// =====================================================

const TEMPLATE_BAB1 = {
  "Nama dan Identitas": [
    (ctx) => {
      return {
        question:
          "Data diri yang membedakan satu orang dengan orang lain adalah ...",
        options: ["nama lengkap", "warna rambut", "tinggi badan", "hobi"],
        correctAnswerIndex: 0,
        explanation:
          "Nama lengkap adalah identitas yang membedakan kita dengan orang lain. Setiap orang punya nama yang unik.",
        kesulitan: "Mudah",
      };
    },
    (ctx) => {
      return {
        question:
          "Saat memperkenalkan diri kepada teman baru, kita menyebutkan ...",
        options: ["nama kita", "nama tetangga", "nama guru", "nama kepala sekolah"],
        correctAnswerIndex: 0,
        explanation:
          "Saat berkenalan kita menyebutkan nama sendiri agar orang lain mengenal kita.",
        kesulitan: "Mudah",
      };
    },
  ],
  "Anggota Keluarga": [
    (ctx) => {
      const anggota = pickRandom(ctx.rng, ["ayah", "ibu", "kakak", "adik"]);
      const peran = {
        ayah: "kepala keluarga",
        ibu: "mengurus rumah tangga",
        kakak: "anak pertama",
        adik: "anak bungsu",
      }[anggota];
      return {
        question: `Dalam keluarga, ${anggota} berperan sebagai ...`,
        options: [peran, "guru di sekolah", "tetangga", "teman bermain"],
        correctAnswerIndex: 0,
        explanation: `${kapital(anggota)} adalah bagian dari keluarga inti dan berperan ${peran}.`,
        kesulitan: "Mudah",
      };
    },
    (ctx) => {
      return {
        question: "Anggota keluarga inti terdiri dari ...",
        options: [
          "ayah, ibu, dan anak",
          "paman, bibi, dan sepupu",
          "kakek, nenek, dan cucu",
          "tetangga dan sahabat",
        ],
        correctAnswerIndex: 0,
        explanation:
          "Keluarga inti (nuklir) terdiri dari ayah, ibu, dan anak-anaknya.",
        kesulitan: "Mudah",
      };
    },
    (ctx) => {
      return {
        question: "Ayah dari ayah kita dipanggil ...",
        options: ["kakek", "paman", "om", "sepupu"],
        correctAnswerIndex: 0,
        explanation: "Ayah dari ayah kita adalah kakek (kakek dari pihak ayah).",
        kesulitan: "Sedang",
        gambarUrl: {
          type: "svg",
          svg: svgSilsilahKeluarga({
            kakek: "Kakek",
            nenek: "Nenek",
            ayah: "Ayah",
            ibu: "Ibu",
            anak: "Anak",
            seed: ctx.seed,
          }),
        },
      };
    },
  ],
  "Peran Anggota Keluarga": [
    (ctx) => {
      return {
        question:
          "Ayah bekerja mencari nafkah untuk keluarga. Kegiatan ini menunjukkan peran ayah sebagai ...",
        options: [
          "pencari nafkah",
          "pengurus dapur",
          "guru les",
          "petugas kebersihan",
        ],
        correctAnswerIndex: 0,
        explanation:
          "Ayah umumnya bekerja mencari nafkah untuk memenuhi kebutuhan keluarga.",
        kesulitan: "Mudah",
      };
    },
    (ctx) => {
      return {
        question:
          "Contoh peran anak di rumah yang benar adalah ...",
        options: [
          "membantu menyapu rumah",
          "membuang sampah sembarangan",
          "berebut mainan",
          "membantah orang tua",
        ],
        correctAnswerIndex: 0,
        explanation:
          "Anak yang baik membantu pekerjaan rumah yang ringan, seperti menyapu.",
        kesulitan: "Mudah",
      };
    },
  ],
  "Silsilah Keluarga": [
    (ctx) => {
      return {
        question:
          "Perhatikan bagan silsilah keluarga berikut! Anak dari ayah dan ibu adalah ...",
        options: ["anak", "kakek", "nenek", "paman"],
        correctAnswerIndex: 0,
        explanation:
          "Dalam bagan silsilah, posisi paling bawah (anak) adalah anak dari ayah dan ibu.",
        gambarUrl: {
          type: "svg",
          svg: svgSilsilahKeluarga({ seed: ctx.seed }),
        },
        kesulitan: "Sedang",
      };
    },
    (ctx) => {
      return {
        question: "Bagan yang menggambarkan hubungan keluarga dari generasi ke generasi disebut ...",
        options: ["silsilah keluarga", "denah rumah", "peta lokasi", "jadwal piket"],
        correctAnswerIndex: 0,
        explanation:
          "Silsilah keluarga (pohon keluarga) menunjukkan hubungan antaranggota keluarga dari generasi ke generasi.",
        kesulitan: "Sedang",
      };
    },
  ],
  "Kegiatan Keluarga": [
    (ctx) => {
      const kegiatan = pickRandom(ctx.rng, [
        "makan bersama",
        "liburan ke pantai",
        "membersihkan rumah bersama",
        "menonton TV bersama",
      ]);
      return {
        question: `Contoh kegiatan yang dilakukan bersama keluarga adalah ...`,
        options: [kegiatan, "belajar sendiri di kamar", "bermain sendiri", "mengerjakan PR sendirian"],
        correctAnswerIndex: 0,
        explanation: `${kapital(kegiatan)} adalah kegiatan yang dilakukan bersama-sama anggota keluarga, mempererat kebersamaan.`,
        kesulitan: "Mudah",
      };
    },
  ],
};

const TEMPLATE_BAB2 = {
  "Kegiatan Pagi Hari": [
    (ctx) => {
      return {
        question: "Contoh kegiatan yang dilakukan pada pagi hari adalah ...",
        options: [
          "mandi dan sarapan",
          "tidur siang",
          "menonton TV sampai larut",
          "membaca buku sebelum tidur",
        ],
        correctAnswerIndex: 0,
        explanation:
          "Pagi hari kita mandi, bersiap-siap, dan sarapan sebelum beraktivitas.",
        kesulitan: "Mudah",
      };
    },
  ],
  "Kegiatan Siang Hari": [
    (ctx) => {
      return {
        question: "Tidur siang biasanya dilakukan pada ...",
        options: ["siang hari", "pagi hari", "dini hari", "tengah malam"],
        correctAnswerIndex: 0,
        explanation:
          "Tidur siang dilakukan setelah makan siang untuk mengembalikan tenaga.",
        kesulitan: "Mudah",
      };
    },
  ],
  "Kegiatan Sore dan Malam": [
    (ctx) => {
      return {
        question: "Contoh kegiatan yang dilakukan pada malam hari adalah ...",
        options: [
          "belajar dan mengulang pelajaran",
          "bermain di luar panas",
          "menjemur pakaian",
          "berolahraga lari pagi",
        ],
        correctAnswerIndex: 0,
        explanation:
          "Malam hari biasanya digunakan untuk belajar, mengulang pelajaran, dan beristirahat.",
        kesulitan: "Mudah",
      };
    },
  ],
  "Jadwal Kegiatan": [
    (ctx) => {
      return {
        question: "Manfaat membuat jadwal kegiatan harian adalah ...",
        options: [
          "waktu teratur dan tidak terbengkalai",
          "waktu terbuang percuma",
          "banyak kegiatan tertunda",
          "sering terlambat",
        ],
        correctAnswerIndex: 0,
        explanation:
          "Jadwal membantu kita memanfaatkan waktu dengan teratur dan tepat.",
        kesulitan: "Sedang",
      };
    },
    (ctx) => {
      return {
        question:
          "Rina bangun pukul 05.00, lalu mandi dan sarapan. Kegiatan selanjutnya yang tepat dilakukan Rina adalah ...",
        options: [
          "berangkat ke sekolah",
          "tidur lagi",
          "menonton TV seharian",
          "bermain sampai malam",
        ],
        correctAnswerIndex: 0,
        explanation:
          "Setelah mandi dan sarapan, Rina berangkat ke sekolah karena kegiatan belajar dimulai pagi hari.",
        kesulitan: "Sedang",
      };
    },
  ],
  "Kegiatan di Rumah dan Sekolah": [
    (ctx) => {
      return {
        question: "Kegiatan yang dilakukan di sekolah adalah ...",
        options: ["belajar bersama guru", "memasak di dapur", "menyapu halaman rumah", "memberi makan ayam"],
        correctAnswerIndex: 0,
        explanation:
          "Di sekolah kita belajar bersama guru dan teman-teman.",
        kesulitan: "Mudah",
      };
    },
    (ctx) => {
      return {
        question: "Contoh kegiatan di rumah yang membantu orang tua adalah ...",
        options: [
          "membereskan tempat tidur",
          "mengganggu adik",
          "berteriak di rumah",
          "membiarkan mainan berserakan",
        ],
        correctAnswerIndex: 0,
        explanation:
          "Membereskan tempat tidur membantu orang tua menjaga kerapian rumah.",
        kesulitan: "Mudah",
      };
    },
  ],
};

const TEMPLATE_BAB3 = {
  "Benda Alam": [
    (ctx) => {
      const benda = pickRandom(ctx.rng, ["batu", "pasir", "tanah", "air sungai"]);
      return {
        question: `Benda berikut yang termasuk benda alam adalah ...`,
        options: [benda, "meja plastik", "kursi kayu buatan", "gelas kaca"],
        correctAnswerIndex: 0,
        explanation: `${kapital(benda)} berasal langsung dari alam tanpa dibuat manusia.`,
        kesulitan: "Mudah",
      };
    },
    (ctx) => {
      return {
        question: "Contoh benda alam adalah ...",
        options: ["pohon di hutan", "buku tulis", "pensil", "tas sekolah"],
        correctAnswerIndex: 0,
        explanation:
          "Pohon di hutan tumbuh di alam, sedangkan buku, pensil, dan tas dibuat manusia.",
        kesulitan: "Mudah",
      };
    },
  ],
  "Benda Buatan": [
    (ctx) => {
      const benda = pickRandom(ctx.rng, ["sepeda", "radio", "kursi", "lampu"]);
      return {
        question: `Benda berikut yang termasuk benda buatan adalah ...`,
        options: [benda, "batu gunung", "air laut", "pasir pantai"],
        correctAnswerIndex: 0,
        explanation: `${kapital(benda)} dibuat oleh manusia dari bahan tertentu.`,
        kesulitan: "Mudah",
      };
    },
    (ctx) => {
      return {
        question: "Benda berikut yang dibuat manusia dari kayu adalah ...",
        options: ["meja", "batu", "air", "emas"],
        correctAnswerIndex: 0,
        explanation:
          "Meja umumnya dibuat manusia dari kayu. Batu, air, dan emas adalah benda alam.",
        kesulitan: "Sedang",
      };
    },
  ],
  "Bahan Benda": [
    (ctx) => {
      const pasangan = [
        ["kursi", "kayu"],
        ["gelas", "kaca"],
        ["sendok", "logam"],
        ["kertas", "bubur kertas"],
      ];
      const [benda, bahan] = pickRandom(ctx.rng, pasangan);
      return {
        question: `${kapital(benda)} umumnya terbuat dari bahan ...`,
        options: [bahan, "air", "udara", "tanah liat"],
        correctAnswerIndex: 0,
        explanation: `${kapital(benda)} dibuat dari bahan ${bahan}.`,
        kesulitan: "Mudah",
      };
    },
    (ctx) => {
      return {
        question: "Bahan yang digunakan untuk membuat pakaian adalah ...",
        options: ["kain", "kayu", "besi", "plastik"],
        correctAnswerIndex: 0,
        explanation:
          "Pakaian dibuat dari kain, yang bisa berasal dari kapas, wol, atau serat sintetis.",
        kesulitan: "Mudah",
      };
    },
  ],
  "Kegunaan Benda": [
    (ctx) => {
      const pasangan = [
        ["pensil", "menulis"],
        ["sendok", "makan"],
        ["payung", "berteduh"],
        ["kacamata", "melihat jelas"],
      ];
      const [benda, fungsi] = pickRandom(ctx.rng, pasangan);
      return {
        question: `Kegunaan utama ${benda} adalah untuk ...`,
        options: [fungsi, "bermain", "hiasan dinding", "membawa barang"],
        correctAnswerIndex: 0,
        explanation: `${kapital(benda)} digunakan untuk ${fungsi}.`,
        kesulitan: "Mudah",
      };
    },
  ],
  "Benda di Rumah dan Sekolah": [
    (ctx) => {
      const benda = pickRandom(ctx.rng, ["papan tulis", "meja guru", "buku pelajaran", "lemari kelas"]);
      return {
        question: `Benda berikut yang biasanya ada di sekolah adalah ...`,
        options: [benda, "kompor gas", "wajan", "sapu lidi"],
        correctAnswerIndex: 0,
        explanation: `${kapital(benda)} adalah benda yang sering dijumpai di lingkungan sekolah.`,
        kesulitan: "Mudah",
      };
    },
    (ctx) => {
      return {
        question: "Benda yang biasanya ada di dapur rumah adalah ...",
        options: ["wajan dan panci", "papan tulis", "kapur", "bel sekolah"],
        correctAnswerIndex: 0,
        explanation:
          "Wajan dan panci digunakan untuk memasak di dapur.",
        kesulitan: "Mudah",
      };
    },
  ],
};

const TEMPLATE_BAB4 = {
  "Kebutuhan Sandang": [
    (ctx) => {
      return {
        question: "Kebutuhan sandang adalah kebutuhan akan ...",
        options: ["pakaian", "makanan", "rumah", "mainan"],
        correctAnswerIndex: 0,
        explanation: "Sandang berarti pakaian — kebutuhan untuk menutup tubuh.",
        kesulitan: "Mudah",
      };
    },
  ],
  "Kebutuhan Pangan": [
    (ctx) => {
      const makanan = pickRandom(ctx.rng, ["nasi", "sayur", "buah", "lauk"]);
      return {
        question: `Contoh kebutuhan pangan adalah ...`,
        options: [makanan, "baju seragam", "sepatu", "rumah"],
        correctAnswerIndex: 0,
        explanation: `Pangan = makanan. ${kapital(makanan)} adalah kebutuhan pokok untuk bertahan hidup.`,
        kesulitan: "Mudah",
      };
    },
    (ctx) => {
      return {
        question: "Makanan pokok sebagian besar orang Indonesia adalah ...",
        options: ["nasi", "roti", "kentang goreng", "susu"],
        correctAnswerIndex: 0,
        explanation: "Nasi adalah makanan pokok utama bagi sebagian besar penduduk Indonesia.",
        kesulitan: "Mudah",
      };
    },
  ],
  "Kebutuhan Papan": [
    (ctx) => {
      return {
        question: "Kebutuhan papan berarti kebutuhan akan ...",
        options: ["rumah tempat tinggal", "pakaian", "makanan", "hiburan"],
        correctAnswerIndex: 0,
        explanation: "Papan berarti tempat tinggal (rumah) — kebutuhan dasar manusia.",
        kesulitan: "Mudah",
      };
    },
    (ctx) => {
      return {
        question:
          "Rumah dibutuhkan manusia sebagai tempat ...",
        options: [
          "berlindung dan beristirahat",
          "berjemur",
          "membuang sampah",
          "menanam padi",
        ],
        correctAnswerIndex: 0,
        explanation:
          "Rumah (papan) menjadi tempat berlindung dari panas, hujan, dan gangguan, serta tempat beristirahat.",
        kesulitan: "Mudah",
      };
    },
  ],
  "Kebutuhan Sekunder": [
    (ctx) => {
      const barang = pickRandom(ctx.rng, ["sepeda", "televisi", "kipas angin", "radio"]);
      return {
        question: `Kebutuhan sekunder adalah kebutuhan yang ...`,
        options: [
          "menambah kenyamanan hidup",
          "paling penting untuk bertahan hidup",
          "tidak pernah dibutuhkan",
          "hanya orang kaya yang punya",
        ],
        correctAnswerIndex: 0,
        explanation: `Kebutuhan sekunder (seperti ${barang}) meningkatkan kenyamanan, tetapi bukan untuk bertahan hidup.`,
        kesulitan: "Sedang",
      };
    },
  ],
  "Kebutuhan Tersier": [
    (ctx) => {
      const barang = pickRandom(ctx.rng, ["perhiasan", "mobil mewah", "liburan ke luar negeri"]);
      return {
        question: `Contoh kebutuhan tersier (kemewahan) adalah ...`,
        options: [barang, "nasi dan lauk", "air minum", "baju seragam"],
        correctAnswerIndex: 0,
        explanation: `${kapital(barang)} adalah kebutuhan tersier yang bersifat mewah dan bukan kebutuhan pokok.`,
        kesulitan: "Sedang",
      };
    },
  ],
};

const TEMPLATE_BAB5 = {
  "Petani": [
    (ctx) => {
      return {
        question:
          "Pekerjaan yang menghasilkan padi untuk makanan pokok adalah ...",
        options: ["petani", "nelayan", "guru", "dokter"],
        correctAnswerIndex: 0,
        explanation:
          "Petani menanam padi di sawah, yang menjadi makanan pokok (nasi).",
        kesulitan: "Mudah",
      };
    },
    (ctx) => {
      return {
        question:
          "Petani bekerja di ...",
        options: ["sawah", "laut", "sekolah", "rumah sakit"],
        correctAnswerIndex: 0,
        explanation:
          "Petani mengerjakan sawah atau ladang untuk menanam tanaman.",
        kesulitan: "Mudah",
      };
    },
  ],
  "Nelayan": [
    (ctx) => {
      return {
        question:
          "Pekerjaan yang mencari ikan di laut menggunakan perahu adalah ...",
        options: ["nelayan", "petani", "pedagang", "sopir"],
        correctAnswerIndex: 0,
        explanation:
          "Nelayan bekerja mencari ikan di laut, sungai, atau danau.",
        kesulitan: "Mudah",
      };
    },
    (ctx) => {
      return {
        question:
          "Hasil kerja nelayan yang dijual di pasar adalah ...",
        options: ["ikan", "padi", "sayur", "buah"],
        correctAnswerIndex: 0,
        explanation:
          "Nelayan menangkap ikan dan menjualnya ke pasar atau tempat pelelangan.",
        kesulitan: "Mudah",
      };
    },
  ],
  "Pedagang": [
    (ctx) => {
      return {
        question:
          "Pekerjaan yang menjual barang kepada pembeli adalah ...",
        options: ["pedagang", "petani", "nelayan", "guru"],
        correctAnswerIndex: 0,
        explanation:
          "Pedagang menjual barang dagangan kepada pembeli untuk mendapatkan keuntungan.",
        kesulitan: "Mudah",
      };
    },
    (ctx) => {
      return {
        question:
          "Tempat pedagang menjual barang disebut ...",
        options: ["pasar", "sawah", "laut", "sekolah"],
        correctAnswerIndex: 0,
        explanation:
          "Pasar adalah tempat bertemunya penjual dan pembeli.",
        kesulitan: "Mudah",
      };
    },
  ],
  "Guru": [
    (ctx) => {
      return {
        question: "Pekerjaan yang tugasnya mengajar murid di sekolah adalah ...",
        options: ["guru", "dokter", "sopir", "koki"],
        correctAnswerIndex: 0,
        explanation:
          "Guru bertugas mengajar dan mendidik murid di sekolah.",
        kesulitan: "Mudah",
      };
    },
  ],
  "Dokter": [
    (ctx) => {
      return {
        question: "Pekerjaan yang membantu orang sakit agar sembuh adalah ...",
        options: ["dokter", "petani", "nelayan", "pedagang"],
        correctAnswerIndex: 0,
        explanation:
          "Dokter memeriksa dan mengobati orang sakit di rumah sakit atau puskesmas.",
        kesulitan: "Mudah",
      };
    },
  ],
  "Pekerjaan di Lingkungan Sekitar": [
    (ctx) => {
      const pekerjaan = pickRandom(ctx.rng, [
        ["tukang becak", "mengayuh becak"],
        ["sopir angkot", "mengemudi angkot"],
        ["satpam", "menjaga keamanan"],
        ["tukang sayur", "menjual sayur keliling"],
      ]);
      const [profesi, kegiatan] = pekerjaan;
      return {
        question: `Contoh pekerjaan yang ada di lingkungan sekitar kita adalah ...`,
        options: [
          `${kapital(profesi)} yang ${kegiatan}`,
          "astronot yang ke bulan",
          "presiden yang memimpin negara",
          "pilot pesawat terbang",
        ],
        correctAnswerIndex: 0,
        explanation: `${kapital(profesi)} adalah pekerjaan yang mudah dijumpai di lingkungan sekitar kita.`,
        kesulitan: "Sedang",
      };
    },
  ],
};

const TEMPLATE_BAB6 = {
  "Kerajinan Tangan": [
    (ctx) => {
      const kerajinan = pickRandom(ctx.rng, ["anyaman bambu", "batik", "gerabah", "ukiran kayu"]);
      return {
        question: `Contoh kerajinan tangan masyarakat Indonesia adalah ...`,
        options: [kerajinan, "mesin cuci", "televisi", "komputer"],
        correctAnswerIndex: 0,
        explanation: `${kapital(kerajinan)} dibuat dengan keterampilan tangan dan menjadi ciri khas daerah.`,
        kesulitan: "Mudah",
      };
    },
  ],
  "Jual Beli": [
    (ctx) => {
      return {
        question: "Kegiatan menjual dan membeli barang disebut ...",
        options: ["jual beli", "menanam", "memancing", "menggambar"],
        correctAnswerIndex: 0,
        explanation:
          "Jual beli adalah kegiatan tukar-menukar barang dengan uang antara penjual dan pembeli.",
        kesulitan: "Mudah",
      };
    },
    (ctx) => {
      return {
        question: "Orang yang membeli barang disebut ...",
        options: ["pembeli", "penjual", "petani", "nelayan"],
        correctAnswerIndex: 0,
        explanation:
          "Pembeli adalah orang yang membeli barang, sedangkan penjual adalah orang yang menjual.",
        kesulitan: "Mudah",
      };
    },
  ],
  "Pasar": [
    (ctx) => {
      return {
        question: "Tempat bertemunya penjual dan pembeli disebut ...",
        options: ["pasar", "sawah", "sekolah", "kantor"],
        correctAnswerIndex: 0,
        explanation:
          "Pasar adalah tempat kegiatan jual beli antara penjual dan pembeli.",
        kesulitan: "Mudah",
      };
    },
    (ctx) => {
      return {
        question: "Contoh barang yang dijual di pasar adalah ...",
        options: ["sayur dan ikan", "mobil balap", "pesawat", "kapal laut"],
        correctAnswerIndex: 0,
        explanation:
          "Di pasar dijual kebutuhan sehari-hari seperti sayur, ikan, buah, dan sembako.",
        kesulitan: "Mudah",
      };
    },
  ],
  "Uang": [
    (ctx) => {
      return {
        question: "Alat pembayaran yang sah di Indonesia adalah ...",
        options: ["uang rupiah", "daun", "kerang", "batu"],
        correctAnswerIndex: 0,
        explanation:
          "Alat pembayaran yang sah di Indonesia adalah uang rupiah (uang kertas dan logam).",
        kesulitan: "Mudah",
      };
    },
    (ctx) => {
      return {
        question:
          "Contoh penggunaan uang yang bijak adalah ...",
        options: [
          "menabung sebagian uang jajan",
          "menghabiskan semua uang untuk jajan",
          "meminjam uang tanpa pengembalian",
          "membuang uang",
        ],
        correctAnswerIndex: 0,
        explanation:
          "Menabung adalah contoh pengelolaan uang yang bijak untuk masa depan.",
        kesulitan: "Sedang",
      };
    },
  ],
  "Kegiatan Ekonomi Keluarga": [
    (ctx) => {
      return {
        question:
          "Ibu membeli sayur di pasar, ayah bekerja mencari nafkah. Kegiatan ini menunjukkan ...",
        options: [
          "kegiatan ekonomi keluarga",
          "kegiatan belajar di sekolah",
          "kegiatan olahraga",
          "kegiatan ibadah",
        ],
        correctAnswerIndex: 0,
        explanation:
          "Kegiatan mencari nafkah dan berbelanja merupakan bagian dari kegiatan ekonomi keluarga.",
        kesulitan: "Sedang",
      };
    },
    (ctx) => {
      return {
        question:
          "Uang saku yang diberikan orang tua sebaiknya digunakan untuk ...",
        options: [
          "membeli makanan bergizi dan menabung",
          "membeli barang mewah",
          "memboroskan jajan",
          "dipinjamkan tanpa dicatat",
        ],
        correctAnswerIndex: 0,
        explanation:
          "Uang saku sebaiknya digunakan untuk kebutuhan yang bermanfaat dan sebagian ditabung.",
        kesulitan: "Sedang",
      };
    },
  ],
};

const TEMPLATES = {
  "Bab 1: Identitas Diri dan Keluarga": TEMPLATE_BAB1,
  "Bab 2: Kegiatan Sehari-hari": TEMPLATE_BAB2,
  "Bab 3: Benda di Sekitar Kita": TEMPLATE_BAB3,
  "Bab 4: Kebutuhan Dasar Manusia": TEMPLATE_BAB4,
  "Bab 5: Pekerjaan dan Mata Pencaharian": TEMPLATE_BAB5,
  "Bab 6: Kerajinan dan Kegiatan Ekonomi": TEMPLATE_BAB6,
};

export function generateBab(meta, targetCount, rng) {
  const subBabs = Object.keys(TEMPLATES[meta.bab] || {});
  const soal = [];
  const failed = [];
  let seedCounter = 0;

  const perSubBab = Math.ceil(targetCount / subBabs.length);
  let sisa = targetCount;

  for (const subBab of subBabs) {
    const builders = TEMPLATES[meta.bab][subBab] || [];
    const jumlahSub = Math.min(perSubBab, sisa);
    sisa -= jumlahSub;

    for (let i = 0; i < jumlahSub; i++) {
      const builder = builders[i % builders.length];
      const hasil = buatSoal({ ...meta, subBab, seed: seedCounter++ }, builder, rng);
      if (hasil.valid) {
        soal.push(hasil);
      } else {
        failed.push(hasil);
      }
    }
  }

  return { soal: shuffleArray(soal, rng), failed, perSubBab };
}

export { buatSoal };
export const IPS_TEMPLATES = TEMPLATES;