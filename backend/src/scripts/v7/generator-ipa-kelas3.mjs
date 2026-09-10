/**
 * GENERATOR SOAL IPA KELAS 3 SD — V7 Pilot
 *
 * Menghasilkan soal PG 4 opsi dengan:
 * - Variasi angka/konteks otomatis (untuk 500+ soal per bab)
 * - Kunci jawaban mengikuti POSISI opsi (diacak, tidak bias)
 * - Kadang memakai aset SVG (gambar/tabel) untuk soal analisis
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
  angkaVariasi,
  opsiAngka,
  gabungDaftar,
} from "./lib/soal-helpers.mjs";
import {
  svgBagianTumbuhan,
  svgSiklusKupu,
  svgSiklusKatak,
  svgSiklusAyam,
  svgTabelData,
  svgHewan,
} from "./lib/aset-svg.mjs";

/**
 * Membuat SATU soal dari sebuah "template builder".
 * Semua template menerima objek `ctx` berisi { angka, rng, bab, subBab, seed }.
 */
function buatSoal(meta, buildFn, rng) {
  const angka = angkaVariasi(rng);
  const ctx = { angka, rng, ...meta };

  const raw = buildFn(ctx);

  // `raw` = { question, options, correctAnswerIndex, explanation, gambar?, teksPendukung?, kompetensi? }
  const soal = raw.options.map((o) => String(o).trim());
  const kunciIndex = raw.correctAnswerIndex;

  // Ambil nilai benar lalu acak ulang posisinya lewat makeOptions agar
  // distribusi kunci tidak bias (posisi kunci mengikuti hasil acakan).
  const nilaiBenar = soal[kunciIndex];
  const { options, correctAnswerIndex } = makeOptions(nilaiBenar, soal, rng);

  const { valid, answerKey, reasons } = buildAndValidate({
    question: raw.question,
    options,
    correctAnswerIndex,
    explanation: raw.explanation,
  });

  if (!valid) {
    return {
      valid: false,
      reasons,
      meta: `${meta.bab} / ${meta.subBab}`,
    };
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
  "Akar": [
    (ctx) => {
      const tumbuhan = pickRandom(ctx.rng, ["wortel", "singkong", "lobak"]);
      return {
        question: `${kapital(tumbuhan)} menyimpan cadangan makanannya di bagian ...`,
        options: ["akar", "daun", "bunga", "buah"],
        correctAnswerIndex: 0,
        explanation: `${kapital(tumbuhan)} menyimpan cadangan makanan di akar. Akar juga menyerap air dan zat hara dari tanah.`,
        kesulitan: "Mudah",
      };
    },
    (ctx) => {
      return {
        question: "Bagian tumbuhan yang berfungsi menyerap air dan zat hara dari dalam tanah adalah ...",
        options: ["daun", "akar", "bunga", "batang"],
        correctAnswerIndex: 1,
        explanation: "Akar berfungsi menyerap air dan zat hara (mineral) dari dalam tanah.",
        kesulitan: "Mudah",
        gambarUrl: { type: "svg", svg: svgBagianTumbuhan("akar", ctx.seed) },
      };
    },
    (ctx) => {
      const pernyataan = pickRandom(ctx.rng, [
        "akar tumbuhan ikut membantu berdiri kokoh",
        "akar menyerap air dari tanah",
        "akar menyimpan cadangan makanan",
      ]);
      return {
        question: `Berikut ini yang BENAR tentang akar adalah ...`,
        options: [pernyataan, "akar menghasilkan bunga", "akar membuat makanan", "akar berwarna hijau tua"],
        correctAnswerIndex: 0,
        explanation: `Akar berfungsi menyerap air dan zat hara, memperkokoh tumbuhan, dan sebagian menyimpan cadangan makanan (wortel, singkong).`,
      };
    },
  ],
  "Batang": [
    (ctx) => {
      const t = pickRandom(ctx.rng, ["tebu", "padi", "bambu"]);
      return {
        question: `Air dan zat makanan diangkut dari akar ke seluruh bagian tumbuhan melalui ...`,
        options: ["daun", "bunga", "batang", "buah"],
        correctAnswerIndex: 2,
        explanation: `Batang berfungsi mengangkut air dan zat makanan dari akar ke daun dan bagian lainnya. Contoh tumbuhan yang batangnya dimanfaatkan manusia: ${t}.`,
        kesulitan: "Mudah",
      };
    },
    (ctx) => {
      return {
        question: "Perhatikan gambar bagian tumbuhan yang disorot berikut. Bagian itu bernama ...",
        options: ["akar", "batang", "daun", "bunga"],
        correctAnswerIndex: 1,
        explanation: "Bagian yang disorot adalah batang. Batang menopang tumbuhan dan menjadi jalur pengangkutan air serta zat makanan.",
        gambarUrl: { type: "svg", svg: svgBagianTumbuhan("batang", ctx.seed) },
      };
    },
  ],
  "Daun": [
    (ctx) => {
      const warna = pickRandom(ctx.rng, ["hijau", "hijau tua", "hijau muda"]);
      return {
        question: "Bagian tumbuhan yang umumnya berwarna hijau dan berfungsi membuat makanan adalah ...",
        options: ["akar", "batang", "daun", "bunga"],
        correctAnswerIndex: 2,
        explanation: `Daun berwarna ${warna} karena mengandung klorofil. Daun membuat makanan melalui fotosintesis dengan bantuan cahaya matahari.`,
        kesulitan: "Mudah",
      };
    },
    (ctx) => {
      return {
        question: "Perhatikan gambar berikut! Bagian yang disorot berfungsi untuk ...",
        options: [
          "menyerap air dari tanah",
          "membuat makanan (fotosintesis)",
          "menyimpan cadangan makanan",
          "menyerap zat hara",
        ],
        correctAnswerIndex: 1,
        explanation: "Daun (bagian yang disorot) adalah tempat berlangsungnya fotosintesis untuk membuat makanan.",
        gambarUrl: { type: "svg", svg: svgBagianTumbuhan("daun", ctx.seed) },
      };
    },
  ],
  "Bunga": [
    (ctx) => {
      const warnaBunga = pickRandom(ctx.rng, ["merah", "kuning", "putih", "ungu", "merah muda"]);
      return {
        question: "Bagian tumbuhan yang berfungsi sebagai alat perkembangbiakan adalah ...",
        options: ["daun", "akar", "bunga", "batang"],
        correctAnswerIndex: 2,
        explanation: `Bunga berfungsi sebagai alat perkembangbiakan tumbuhan. Bunga ${warnaBunga} menarik serangga untuk membantu penyerbukan.`,
        kesulitan: "Sedang",
      };
    },
    (ctx) => {
      return {
        question: "Perhatikan gambar berikut! Bagian yang disorot adalah ...",
        options: ["bunga", "daun", "buah", "batang"],
        correctAnswerIndex: 0,
        explanation: "Bagian yang disorot adalah bunga. Bunga adalah alat perkembangbiakan tumbuhan.",
        gambarUrl: { type: "svg", svg: svgBagianTumbuhan("bunga", ctx.seed) },
      };
    },
  ],
  "Buah dan Biji": [
    (ctx) => {
      return {
        question: "Bagian buah yang dapat tumbuh menjadi tumbuhan baru adalah ...",
        options: ["kulit", "daging", "biji", "tangkai"],
        correctAnswerIndex: 2,
        explanation: "Biji di dalam buah dapat tumbuh menjadi tumbuhan baru bila ditanam di tanah yang subur.",
        kesulitan: "Sedang",
      };
    },
    (ctx) => {
      const buah = pickRandom(ctx.rng, ["mangga", "apel", "jeruk", "jambu"]);
      return {
        question: `Biji ${buah} dapat tumbuh menjadi tumbuhan baru. Hal itu menunjukkan bahwa biji berfungsi sebagai ...`,
        options: ["alat perkembangbiakan", "tempat fotosintesis", "penyerap air", "tempat menyimpan air"],
        correctAnswerIndex: 0,
        explanation: `Biji ${buah} adalah alat perkembangbiakan generatif. Biji tumbuh menjadi tumbuhan baru bila kondisinya sesuai.`,
      };
    },
  ],
  "Fungsi Bagian Tumbuhan": [
    (ctx) => {
      const pasangan = [
        ["akar", "menyerap air dan zat hara"],
        ["batang", "mengangkut air dan zat makanan"],
        ["daun", "membuat makanan"],
        ["bunga", "alat perkembangbiakan"],
      ];
      const [bagian, fungsi] = pickRandom(ctx.rng, pasangan);
      return {
        question: `Fungsi utama bagian tumbuhan yang bernama ${bagian} adalah ...`,
        options: [
          fungsi,
          "sebagai alat perkembangbiakan",
          "tempat menyimpan air",
          "menjaga keseimbangan suhu",
        ].filter((o, i, arr) => arr.indexOf(o) === i),
        correctAnswerIndex: 0,
        explanation: `${kapital(bagian)} berfungsi ${fungsi} pada tumbuhan.`,
        kesulitan: "Sedang",
      };
    },
    (ctx) => {
      const bagianDipakai = pickRandom(ctx.rng, [
        ["daun", "bayam"],
        ["akar", "wortel"],
        ["batang", "tebu"],
      ]);
      const [bagian, contoh] = bagianDipakai;
      return {
        question: `Manusia memanfaatkan ${contoh} sebagai sayuran. Bagian tumbuhan yang dimanfaatkan adalah ...`,
        options: [bagian, "bunga", "buah", "biji"],
        correctAnswerIndex: 0,
        explanation: `${contoh} yang kita makan adalah bagian ${bagian} dari tumbuhan.`,
      };
    },
  ],
};

const TEMPLATE_BAB2 = {
  "Hewan Herbivora": [
    (ctx) => {
      const hewan = pickRandom(ctx.rng, ["sapi", "kambing", "kerbau", "kelinci"]);
      return {
        question: `Hewan yang makanannya berupa rumput dan tumbuhan disebut hewan ...`,
        options: ["herbivora", "karnivora", "omnivora", "insectivora"],
        correctAnswerIndex: 0,
        explanation: `${kapital(hewan)} termasuk hewan herbivora karena makanannya berupa rumput dan tumbuhan.`,
        kesulitan: "Mudah",
        gambarUrl: { type: "svg", svg: svgHewan("sapi", ctx.seed) },
      };
    },
    (ctx) => {
      return {
        question: "Perhatikan gambar berikut. Hewan ini makanannya berupa ...",
        options: ["rumput dan tumbuhan", "daging", "ikan", "serangga"],
        correctAnswerIndex: 0,
        explanation: "Hewan pada gambar adalah sapi. Sapi termasuk herbivora karena memakan rumput dan tumbuhan.",
        gambarUrl: { type: "svg", svg: svgHewan("sapi", ctx.seed) },
      };
    },
  ],
  "Hewan Karnivora": [
    (ctx) => {
      const hewan = pickRandom(ctx.rng, ["singa", "harimau", "elang", "ular"]);
      return {
        question: `Hewan yang makanannya berupa daging disebut hewan ...`,
        options: ["herbivora", "karnivora", "omnivora", "frugivora"],
        correctAnswerIndex: 1,
        explanation: `${kapital(hewan)} berburu dan memakan hewan lain, sehingga termasuk hewan karnivora (pemakan daging).`,
        kesulitan: "Mudah",
      };
    },
    (ctx) => {
      return {
        question: "Gigi taring yang tajam dan runcing umumnya dimiliki oleh hewan ...",
        options: ["pemakan tumbuhan", "pemakan daging", "pemakan buah", "pemakan nektar"],
        correctAnswerIndex: 1,
        explanation: "Hewan karnivora (pemakan daging) memiliki taring tajam untuk merobek daging mangsanya.",
        kesulitan: "Sedang",
      };
    },
  ],
  "Hewan Omnivora": [
    (ctx) => {
      const hewan = pickRandom(ctx.rng, ["ayam", "bebek", "tikus", "musang"]);
      return {
        question: `Hewan yang memakan tumbuhan DAN daging disebut hewan ...`,
        options: ["herbivora", "karnivora", "omnivora", "hermaprodit"],
        correctAnswerIndex: 2,
        explanation: `${kapital(hewan)} memakan tumbuhan dan juga hewan kecil, sehingga disebut omnivora (pemakan segala).`,
        kesulitan: "Mudah",
        gambarUrl: { type: "svg", svg: svgHewan("ayam", ctx.seed) },
      };
    },
    (ctx) => {
      return {
        question: "Perhatikan gambar berikut. Ayam memakan biji-bijian dan juga cacing. Ayam termasuk hewan ...",
        options: ["herbivora", "karnivora", "omnivora", "ovipar"],
        correctAnswerIndex: 2,
        explanation: "Ayam memakan tumbuhan (biji-bijian) dan hewan kecil (cacing), sehingga termasuk omnivora.",
        gambarUrl: { type: "svg", svg: svgHewan("ayam", ctx.seed) },
      };
    },
  ],
  "Gigi dan Cara Makan": [
    (ctx) => {
      return {
        question: "Hewan herbivora memiliki gigi geraham yang rata. Gigi geraham berfungsi untuk ...",
        options: ["mengunyah tumbuhan", "merobek daging", "memotong kayu", "menangkap mangsa"],
        correctAnswerIndex: 0,
        explanation: "Gigi geraham yang rata membantu herbivora mengunyah dan menggiling tumbuhan.",
        kesulitan: "Sedang",
      };
    },
    (ctx) => {
      const hewan = pickRandom(ctx.rng, ["kucing", "anjing", "harimau"]);
      return {
        question: `Hewan seperti ${hewan} memiliki gigi taring yang tajam karena makanannya berupa ...`,
        options: ["daging", "rumput", "buah", "daun"],
        correctAnswerIndex: 0,
        explanation: `${kapital(hewan)} adalah pemakan daging (karnivora). Gigi taring tajamnya digunakan untuk merobek daging.`,
        kesulitan: "Sedang",
      };
    },
  ],
  "Habitat Hewan": [
    (ctx) => {
      const pasangan = [
        ["ikan", "air"],
        ["unta", "gurun"],
        ["beruang kutub", "kutub"],
        ["cacing", "tanah"],
      ];
      const [hewan, habitat] = pickRandom(ctx.rng, pasangan);
      return {
        question: `Tempat hidup alami ${hewan} yang paling sesuai adalah ...`,
        options: [habitat, "hutan hujan", "sawah", "pegunungan"],
        correctAnswerIndex: 0,
        explanation: `${kapital(hewan)} hidup di ${habitat}. Habitat adalah tempat tinggal alami makhluk hidup.`,
        kesulitan: "Sedang",
      };
    },
    (ctx) => {
      return {
        question: "Hewan yang hidupnya di air tawar adalah ...",
        options: ["lele", "hiu", "paus", "gurita"],
        correctAnswerIndex: 0,
        explanation: "Lele hidup di air tawar (sungai, kolam, sawah). Hiu, paus, dan gurita hidup di air asin (laut).",
        kesulitan: "Sedang",
      };
    },
  ],
};

const TEMPLATE_BAB3 = {
  "Energi Matahari": [
    (ctx) => {
      return {
        question: "Sumber energi terbesar bagi kehidupan di bumi adalah ...",
        options: ["matahari", "bulan", "bintang", "planet"],
        correctAnswerIndex: 0,
        explanation: "Matahari adalah sumber energi terbesar. Energi matahari dimanfaatkan untuk fotosintesis, pengeringan, dan panel surya.",
        kesulitan: "Mudah",
      };
    },
    (ctx) => {
      const kegiatan = pickRandom(ctx.rng, [
        "menjemur pakaian",
        "mengeringkan ikan asin",
        "menjemur gabah padi",
      ]);
      return {
        question: `Kegiatan berikut yang memanfaatkan energi matahari adalah ...`,
        options: [kegiatan, "menyalakan kipas", "mengisi baterai", "memasak dengan kompor"],
        correctAnswerIndex: 0,
        explanation: `${kapital(kegiatan)} memanfaatkan panas matahari untuk mengeringkan.`,
        kesulitan: "Mudah",
      };
    },
  ],
  "Energi Angin": [
    (ctx) => {
      return {
        question: "Energi angin dapat dimanfaatkan untuk ...",
        options: [
          "menggerakkan kincir angin",
          "menyalakan lampu",
          "mendinginkan kulkas",
          "mengisi daya HP",
        ],
        correctAnswerIndex: 0,
        explanation: "Angin menggerakkan kincir angin, yang dapat digunakan untuk memutar turbin pembangkit listrik atau menumbuk padi.",
        kesulitan: "Mudah",
      };
    },
    (ctx) => {
      const alat = pickRandom(ctx.rng, ["layang-layang", "kapal layar", "kincir angin"]);
      return {
        question: `Alat berikut yang memanfaatkan energi angin adalah ...`,
        options: [alat, "kompor gas", "setrika listrik", "radio"],
        correctAnswerIndex: 0,
        explanation: `${kapital(alat)} bergerak karena dorongan angin.`,
        kesulitan: "Sedang",
      };
    },
  ],
  "Energi Air": [
    (ctx) => {
      return {
        question: "Pembangkit listrik yang memanfaatkan aliran air disebut ...",
        options: ["PLTA", "PLTU", "PLTN", "PLTS"],
        correctAnswerIndex: 0,
        explanation: "PLTA (Pembangkit Listrik Tenaga Air) memanfaatkan aliran atau terjunan air untuk memutar turbin.",
        kesulitan: "Sedang",
      };
    },
    (ctx) => {
      return {
        question: "Aliran air sungai yang deras dapat dimanfaatkan untuk ...",
        options: ["memutar kincir air", "menyalakan senter", "memanaskan ruangan", "mengeringkan pakaian"],
        correctAnswerIndex: 0,
        explanation: "Aliran air sungai memutar kincir air, yang dulu digunakan untuk menggiling padi atau gula tebu.",
        kesulitan: "Sedang",
      };
    },
  ],
  "Energi Listrik": [
    (ctx) => {
      const alat = pickRandom(ctx.rng, ["lampu", "kipas angin", "televisi", "setrika", "kulkas"]);
      return {
        question: `Alat berikut yang menggunakan energi listrik adalah ...`,
        options: [alat, "ayunan", "gerobak", "kompas"],
        correctAnswerIndex: 0,
        explanation: `${kapital(alat)} membutuhkan listrik untuk bekerja.`,
        kesulitan: "Mudah",
      };
    },
    (ctx) => {
      return {
        question: "Cara menghemat energi listrik yang benar adalah ...",
        options: [
          "mematikan lampu saat siang hari",
          "menyalakan lampu sepanjang malam",
          "membiarkan TV menyala",
          "membuka kulkas terlalu lama",
        ],
        correctAnswerIndex: 0,
        explanation: "Mematikan lampu saat tidak digunakan adalah salah satu cara menghemat energi listrik.",
        kesulitan: "Mudah",
      };
    },
  ],
  "Energi Bunyi": [
    (ctx) => {
      return {
        question: "Bunyi dihasilkan oleh benda yang ...",
        options: ["bergetar", "diam", "berputar", "terang"],
        correctAnswerIndex: 0,
        explanation: "Bunyi timbul karena adanya getaran. Contoh: senar gitar bergetar menghasilkan bunyi.",
        kesulitan: "Sedang",
      };
    },
    (ctx) => {
      const alat = pickRandom(ctx.rng, ["gendang", "gitar", "seruling", "lonceng"]);
      return {
        question: `Alat musik berikut yang menghasilkan bunyi dengan cara dipukul adalah ...`,
        options: ["gendang", "gitar", "seruling", "piano"],
        correctAnswerIndex: 0,
        explanation: `Gendang menghasilkan bunyi ketika kultnya dipukul sehingga bergetar. (${kapital(alat)} sebagai contoh alat bunyi)`,
        kesulitan: "Sedang",
      };
    },
  ],
  "Energi Panas": [
    (ctx) => {
      const sumber = pickRandom(ctx.rng, ["api", "matahari", "gesekan dua benda", "listrik"]);
      return {
        question: `Contoh sumber energi panas adalah ...`,
        options: [sumber, "angin", "bunyi", "cahaya bulan"],
        correctAnswerIndex: 0,
        explanation: `${kapital(sumber)} dapat menghasilkan panas. Panas adalah salah satu bentuk energi.`,
        kesulitan: "Mudah",
      };
    },
    (ctx) => {
      return {
        question: "Kegiatan berikut yang menghasilkan energi panas adalah ...",
        options: [
          "menggosok kedua telapak tangan",
          "meniup peluit",
          "memantulkan bola",
          "membaca buku",
        ],
        correctAnswerIndex: 0,
        explanation: "Menggosok kedua telapak tangan menimbulkan panas karena gesekan.",
        kesulitan: "Sedang",
      };
    },
  ],
};

const TEMPLATE_BAB4 = {
  "Gaya Dorong dan Tarik": [
    (ctx) => {
      const kegiatan = pickRandom(ctx.rng, [
        "mendorong meja",
        "menarik gerobak",
        "mendorong pintu",
        "menarik tali bendera",
      ]);
      const gaya = kegiatan.startsWith("menarik") ? "tarikan" : "dorongan";
      return {
        question: `Kegiatan berikut yang merupakan contoh gaya ${gaya} adalah ...`,
        options: [kegiatan, "menendang bola", "menjatuhkan gelas", "menekan tombol"],
        correctAnswerIndex: 0,
        explanation: `${kapital(kegiatan)} menunjukkan gaya ${gaya}. Gaya dapat mengubah gerak benda.`,
        kesulitan: "Mudah",
      };
    },
    (ctx) => {
      return {
        question: "Mendorong dan menarik benda termasuk contoh ...",
        options: ["gaya", "energi", "gerak", "kecepatan"],
        correctAnswerIndex: 0,
        explanation: "Mendorong dan menarik adalah bentuk gaya. Gaya dapat membuat benda bergerak atau berhenti.",
        kesulitan: "Mudah",
      };
    },
  ],
  "Gaya Gesek": [
    (ctx) => {
      return {
        question: "Permukaan yang menghasilkan gaya gesek paling besar adalah ...",
        options: ["karpet kasar", "lantai licin", "kaca", "es"],
        correctAnswerIndex: 0,
        explanation: "Permukaan kasar menghasilkan gaya gesek lebih besar daripada permukaan licin. Karpet kasar membuat benda sulit meluncur.",
        kesulitan: "Sedang",
      };
    },
    (ctx) => {
      return {
        question: "Ban mobil dibuat bergerigi agar ...",
        options: [
          "tidak selip di jalan licin",
          "lebih cepat melaju",
          "lebih ringan",
          "tidak berbunyi",
        ],
        correctAnswerIndex: 0,
        explanation: "Gerigi pada ban memperbesar gaya gesek dengan jalan sehingga mobil tidak mudah selip.",
        kesulitan: "Sedang",
      };
    },
  ],
  "Gaya Gravitasi": [
    (ctx) => {
      return {
        question: "Buah mangga yang jatuh dari pohon selalu menuju ke bawah karena pengaruh ...",
        options: ["gaya gravitasi", "gaya gesek", "gaya dorong", "gaya magnet"],
        correctAnswerIndex: 0,
        explanation: "Gaya gravitasi bumi menarik semua benda ke arah pusat bumi, sehingga benda jatuh ke bawah.",
        kesulitan: "Mudah",
      };
    },
    (ctx) => {
      return {
        question: "Gaya gravitasi bumi menyebabkan ...",
        options: [
          "benda jatuh ke bawah",
          "benda melayang ke angkasa",
          "benda bergerak ke samping",
          "benda berputar",
        ],
        correctAnswerIndex: 0,
        explanation: "Semua benda di bumi ditarik ke bawah oleh gaya gravitasi.",
        kesulitan: "Mudah",
      };
    },
  ],
  "Gerak Benda": [
    (ctx) => {
      const benda = pickRandom(ctx.rng, ["bola", "mobil-mobilan", "kelereng", "sepeda"]);
      return {
        question: `Benda dapat bergerak jika diberi ...`,
        options: ["gaya", "warna", "bunyi", "bayangan"],
        correctAnswerIndex: 0,
        explanation: `${kapital(benda)} bergerak karena mendapat gaya, misalnya didorong atau ditarik.`,
        kesulitan: "Mudah",
      };
    },
  ],
  "Magnet": [
    (ctx) => {
      return {
        question: "Benda yang dapat ditarik oleh magnet adalah ...",
        options: ["paku besi", "pensil", "kertas", "plastik"],
        correctAnswerIndex: 0,
        explanation: "Magnet menarik benda yang terbuat dari besi dan baja, seperti paku besi.",
        kesulitan: "Mudah",
      };
    },
    (ctx) => {
      return {
        question: "Benda berikut yang TIDAK dapat ditarik magnet adalah ...",
        options: ["karet penghapus", "paku", "gunting besi", "jarum pentul"],
        correctAnswerIndex: 0,
        explanation: "Karet penghapus terbuat dari karet, bukan logam magnetik, sehingga tidak ditarik magnet.",
        kesulitan: "Sedang",
      };
    },
  ],
};

const TEMPLATE_BAB5 = {
  "Mencair": [
    (ctx) => {
      const contoh = pickRandom(ctx.rng, ["es batu", "es krim", "cokelat batang"]);
      return {
        question: `Peristiwa ${contoh} berubah menjadi cair karena terkena panas disebut ...`,
        options: ["mencair", "membeku", "menguap", "mengembun"],
        correctAnswerIndex: 0,
        explanation: `${kapital(contoh)} yang terkena panas berubah wujud dari padat menjadi cair. Peristiwa ini disebut mencair.`,
        kesulitan: "Mudah",
      };
    },
    (ctx) => {
      return {
        question: "Perubahan wujud dari padat menjadi cair disebut ...",
        options: ["mencair", "membeku", "menguap", "menyublim"],
        correctAnswerIndex: 0,
        explanation: "Mencair adalah perubahan wujud benda padat menjadi cair karena menerima panas.",
        kesulitan: "Mudah",
      };
    },
  ],
  "Membeku": [
    (ctx) => {
      return {
        question: "Air yang dimasukkan ke freezer lama-kelamaan menjadi es. Peristiwa ini disebut ...",
        options: ["membeku", "mencair", "menguap", "mengembun"],
        correctAnswerIndex: 0,
        explanation: "Air berubah menjadi es (cair → padat) karena suhunya turun. Peristiwa ini disebut membeku.",
        kesulitan: "Mudah",
      };
    },
    (ctx) => {
      const contoh = pickRandom(ctx.rng, ["agar-agar", "lilin", "cokelat cair"]);
      return {
        question: `Jika ${contoh} didinginkan, lama-kelamaan akan menjadi padat. Peristiwa ini disebut ...`,
        options: ["membeku", "mencair", "menguap", "menyublim"],
        correctAnswerIndex: 0,
        explanation: `${kapital(contoh)} yang didinginkan berubah wujud dari cair menjadi padat (membeku).`,
        kesulitan: "Sedang",
      };
    },
  ],
  "Menguap": [
    (ctx) => {
      return {
        question: "Air yang dipanaskan lama-kelamaan habis karena berubah menjadi uap. Peristiwa ini disebut ...",
        options: ["menguap", "mencair", "membeku", "mengembun"],
        correctAnswerIndex: 0,
        explanation: "Air yang dipanaskan berubah menjadi uap air (cair → gas). Peristiwa ini disebut menguap.",
        kesulitan: "Mudah",
      };
    },
    (ctx) => {
      return {
        question: "Baju basah menjadi kering setelah dijemur karena air pada baju ...",
        options: ["menguap", "membeku", "mencair", "mengembun"],
        correctAnswerIndex: 0,
        explanation: "Panas matahari membuat air pada baju menguap menjadi uap air, sehingga baju menjadi kering.",
        kesulitan: "Mudah",
      };
    },
  ],
  "Mengembun": [
    (ctx) => {
      return {
        question: "Titik-titik air di bagian luar gelas berisi es terbentuk karena uap air di udara ...",
        options: ["mengembun", "menguap", "membeku", "mencair"],
        correctAnswerIndex: 0,
        explanation: "Uap air di udara yang bersentuhan dengan gelas dingin berubah menjadi titik air. Peristiwa ini disebut mengembun (gas → cair).",
        kesulitan: "Sedang",
      };
    },
  ],
  "Menyublim": [
    (ctx) => {
      return {
        question: "Kapur barus (kamper) yang diletakkan di lemari lama-kelamaan mengecil dan habis. Peristiwa ini disebut ...",
        options: ["menyublim", "mencair", "membeku", "mengembun"],
        correctAnswerIndex: 0,
        explanation: "Kapur barus berubah dari padat langsung menjadi gas tanpa melalui wujud cair. Peristiwa ini disebut menyublim.",
        kesulitan: "Sedang",
      };
    },
  ],
  "Mengkristal": [
    (ctx) => {
      return {
        question: "Gas yang berubah langsung menjadi padat (contoh: uap air menjadi salju/embun beku) disebut ...",
        options: ["mengkristal", "menguap", "mencair", "membeku"],
        correctAnswerIndex: 0,
        explanation: "Mengkristal adalah perubahan wujud gas menjadi padat. Contoh: uap air di udara menjadi kristal es (salju).",
        kesulitan: "Sulit",
      };
    },
  ],
};

const TEMPLATE_BAB6 = {
  "Metamorfosis Sempurna": [
    (ctx) => {
      return {
        question: "Urutan metamorfosis sempurna pada kupu-kupu adalah ...",
        options: [
          "telur → ulat → kepompong → kupu-kupu",
          "telur → kepompong → ulat → kupu-kupu",
          "ulat → telur → kepompong → kupu-kupu",
          "kupu-kupu → telur → ulat → kepompong",
        ],
        correctAnswerIndex: 0,
        explanation: "Metamorfosis sempurna kupu-kupu: telur → ulat (larva) → kepompong (pupa) → kupu-kupu dewasa.",
        kesulitan: "Sedang",
        gambarUrl: { type: "svg", svg: svgSiklusKupu(ctx.seed) },
      };
    },
    (ctx) => {
      return {
        question: "Perhatikan gambar siklus hidup kupu-kupu berikut. Hewan yang bentuknya berbeda dari induknya dan melewati tahap kepompong mengalami ...",
        options: ["metamorfosis sempurna", "metamorfosis tidak sempurna", "perkembangbiakan vegetatif", "tidak bermetamorfosis"],
        correctAnswerIndex: 0,
        explanation: "Kupu-kupu berubah bentuk total (telur → ulat → kepompong → kupu-kupu) sehingga disebut metamorfosis sempurna.",
        gambarUrl: { type: "svg", svg: svgSiklusKupu(ctx.seed) },
      };
    },
  ],
  "Metamorfosis Tidak Sempurna": [
    (ctx) => {
      const hewan = pickRandom(ctx.rng, ["belalang", "kecoa", "jangkrik", "capung"]);
      return {
        question: `Hewan yang mengalami metamorfosis tidak sempurna adalah ...`,
        options: [hewan, "kupu-kupu", "katak", "nyamuk"],
        correctAnswerIndex: 0,
        explanation: `${kapital(hewan)} mengalami metamorfosis tidak sempurna: telur → nimfa → dewasa, tanpa tahap kepompong.`,
        kesulitan: "Sedang",
      };
    },
    (ctx) => {
      return {
        question: "Ciri metamorfosis tidak sempurna adalah ...",
        options: [
          "tidak melalui tahap kepompong",
          "selalu melalui tahap kepompong",
          "bentuknya berubah total",
          "tidak bertelur",
        ],
        correctAnswerIndex: 0,
        explanation: "Metamorfosis tidak sempurna hanya melalui telur → nimfa → dewasa, tanpa kepompong. Contoh: belalang, kecoa.",
        kesulitan: "Sedang",
      };
    },
  ],
  "Siklus Hidup Kupu-kupu": [
    (ctx) => {
      return {
        question: "Perhatikan gambar siklus hidup kupu-kupu. Tahap ke-2 setelah telur adalah ...",
        options: ["ulat", "kepompong", "kupu-kupu", "telur"],
        correctAnswerIndex: 0,
        explanation: "Setelah telur menetas, keluarlah ulat (larva) yang rakus memakan daun.",
        gambarUrl: { type: "svg", svg: svgSiklusKupu(ctx.seed) },
        kesulitan: "Sedang",
      };
    },
  ],
  "Siklus Hidup Katak": [
    (ctx) => {
      return {
        question: "Perhatikan gambar siklus hidup katak. Hewan yang hidup di air dan bernapas dengan insang adalah ...",
        options: ["berudu (kecebong)", "katak dewasa", "telur", "ulat"],
        correctAnswerIndex: 0,
        explanation: "Berudu hidup di air dan bernapas dengan insang. Setelah tumbuh kaki dan paru-paru, berudu berubah menjadi katak.",
        gambarUrl: { type: "svg", svg: svgSiklusKatak(ctx.seed) },
        kesulitan: "Sedang",
      };
    },
    (ctx) => {
      return {
        question: "Urutan siklus hidup katak yang benar adalah ...",
        options: [
          "telur → berudu → berudu berkaki → katak",
          "telur → katak → berudu → berudu berkaki",
          "berudu → telur → katak → berudu berkaki",
          "katak → telur → berudu berkaki → berudu",
        ],
        correctAnswerIndex: 0,
        explanation: "Katak mengalami metamorfosis: telur → berudu → berudu berkaki → katak dewasa.",
        gambarUrl: { type: "svg", svg: svgSiklusKatak(ctx.seed) },
        kesulitan: "Sedang",
      };
    },
  ],
  "Siklus Hidup Ayam": [
    (ctx) => {
      return {
        question: "Ayam berkembang biak dengan cara ...",
        options: ["bertelur", "melahirkan", "bertunas", "membelah diri"],
        correctAnswerIndex: 0,
        explanation: "Ayam berkembang biak dengan bertelur (ovipar).",
        kesulitan: "Mudah",
      };
    },
    (ctx) => {
      return {
        question: "Perhatikan gambar siklus hidup ayam. Telur ayam menetas setelah dierami induknya selama ...",
        options: ["±21 hari", "±7 hari", "±2 hari", "±100 hari"],
        correctAnswerIndex: 0,
        explanation: "Telur ayam umumnya menetas sekitar 21 hari setelah dierami.",
        gambarUrl: { type: "svg", svg: svgSiklusAyam(ctx.seed) },
        kesulitan: "Sedang",
      };
    },
  ],
};

const TEMPLATE_BAB7 = {
  "Lingkungan Bersih": [
    (ctx) => {
      return {
        question: "Lingkungan yang bersih membuat kita ...",
        options: ["sehat dan nyaman", "mudah sakit", "cepat lelah", "sulit bernapas"],
        correctAnswerIndex: 0,
        explanation: "Lingkungan bersih bebas dari sampah dan kuman sehingga membuat kita sehat dan nyaman.",
        kesulitan: "Mudah",
      };
    },
  ],
  "Membuang Sampah": [
    (ctx) => {
      return {
        question: "Cara yang benar membuang sampah adalah ...",
        options: [
          "membuang ke tempat sampah",
          "membuang ke sungai",
          "membuang ke got",
          "membuang sembarangan",
        ],
        correctAnswerIndex: 0,
        explanation: "Sampah sebaiknya dibuang ke tempat sampah. Sampah yang dibuang ke sungai menyebabkan banjir dan pencemaran.",
        kesulitan: "Mudah",
      };
    },
    (ctx) => {
      const jenis = pickRandom(ctx.rng, ["botol plastik", "kertas bekas", "kaleng"]);
      return {
        question: `Sampah seperti ${jenis} sebaiknya ...`,
        options: ["didaur ulang", "dibakar di rumah", "dibuang ke sawah", "ditimbun di halaman"],
        correctAnswerIndex: 0,
        explanation: `${kapital(jenis)} termasuk sampah yang bisa didaur ulang menjadi barang baru.`,
        kesulitan: "Sedang",
      };
    },
  ],
  "Menanam Pohon": [
    (ctx) => {
      return {
        question: "Manfaat menanam pohon di lingkungan rumah adalah ...",
        options: [
          "udara menjadi sejuk dan bersih",
          "rumah menjadi panas",
          "halaman menjadi kotor",
          "udara menjadi kotor",
        ],
        correctAnswerIndex: 0,
        explanation: "Pohon menghasilkan oksigen dan menyerap karbon dioksida, sehingga udara menjadi sejuk dan bersih.",
        kesulitan: "Mudah",
      };
    },
  ],
  "Hemat Air": [
    (ctx) => {
      return {
        question: "Sikap yang menunjukkan hemat air adalah ...",
        options: [
          "menutup kran setelah digunakan",
          "membiarkan kran menyala",
          "mandi berjam-jam",
          "mencuci dengan air deras terus-menerus",
        ],
        correctAnswerIndex: 0,
        explanation: "Menutup kran setelah digunakan adalah salah satu cara menghemat air bersih.",
        kesulitan: "Mudah",
      };
    },
  ],
  "Hemat Energi": [
    (ctx) => {
      return {
        question: "Kegiatan berikut yang menghemat energi adalah ...",
        options: [
          "mematikan lampu di siang hari",
          "menyalakan semua lampu di siang hari",
          "membiarkan TV menyala seharian",
          "membiarkan kipas menyala saat keluar rumah",
        ],
        correctAnswerIndex: 0,
        explanation: "Mematikan lampu saat siang hari menghemat energi listrik.",
        kesulitan: "Mudah",
      };
    },
  ],
};

const TEMPLATES = {
  "Bab 1: Bagian Tubuh Tumbuhan": TEMPLATE_BAB1,
  "Bab 2: Hewan dan Makanannya": TEMPLATE_BAB2,
  "Bab 3: Sumber Energi": TEMPLATE_BAB3,
  "Bab 4: Gaya dan Gerak": TEMPLATE_BAB4,
  "Bab 5: Perubahan Wujud Benda": TEMPLATE_BAB5,
  "Bab 6: Siklus Hidup Hewan": TEMPLATE_BAB6,
  "Bab 7: Pelestarian Lingkungan": TEMPLATE_BAB7,
};

// =====================================================
// GENERATE SATU BAB
// =====================================================

/**
 * Generate sejumlah soal untuk satu bab, disebar merata ke subBab,
 * dengan banyak variasi (seed berbeda) per subBab.
 */
export function generateBab(meta, targetCount, rng) {
  const subBabs = Object.keys(TEMPLATES[meta.bab] || {});
  const soal = [];
  const failed = [];
  let seedCounter = 0;

  // target per subBab (dibulatkan, sisa disebar)
  const perSubBab = Math.ceil(targetCount / subBabs.length);
  let sisa = targetCount;

  for (const subBab of subBabs) {
    const builders = TEMPLATES[meta.bab][subBab] || [];
    const jumlahSub = Math.min(perSubBab, sisa);
    sisa -= jumlahSub;

    for (let i = 0; i < jumlahSub; i++) {
      const builder = builders[i % builders.length];
      const hasil = buatSoal(
        { ...meta, subBab, seed: seedCounter++ },
        builder,
        rng,
      );

      if (hasil.valid) {
        soal.push(hasil);
      } else {
        failed.push(hasil);
      }
    }
  }

  // Acak urutan akhir
  return { soal: shuffleArray(soal, rng), failed, perSubBab };
}

/**
 * Menghasilkan pembahasan/teks pendukung jika template menyertakan gambar SVG:
 * gambarUrl berbentuk { type:"svg", svg: "..." } akan diresolusi oleh exporter
 * (menulis file + mengganti jadi path/URL).
 */
export { buatSoal };
export const IPA_TEMPLATES = TEMPLATES;