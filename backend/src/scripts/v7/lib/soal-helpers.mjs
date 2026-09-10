/**
 * LIB SOAL SD KELAS 3 — Helper matematika & pembuatan soal
 * Dipakai oleh generator V7 pilot (IPA & IPS Kelas 3).
 *
 * Pola kunci jawaban: POSISI opsi (correctAnswerIndex 0..3),
 * konsisten dengan `generator-validation-gate.mjs`.
 */

// =====================================================
// RANDOM & UTILITY
// =====================================================

// PRNG sederhana dengan seed agar hasil reproducible (opsional)
export function makeRng(seed) {
  let s = seed ?? Math.floor(Math.random() * 2 ** 31);
  return function rng() {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function randomInt(min, max, rng = Math.random) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function pickRandom(arrOrRng, rngOrArr, rng = Math.random) {
  // Dukung dua urutan argumen: pickRandom(arr, rng) ATAU pickRandom(rng, arr)
  let arr = arrOrRng;
  let rnd = rngOrArr ?? rng;
  if (typeof arr === "function" && Array.isArray(rnd)) {
    [arr, rnd] = [rnd, arr];
  }
  return arr[Math.floor(rnd() * arr.length)];
}

export function pickN(arr, n, rng = Math.random) {
  const copy = [...arr];
  const out = [];
  while (out.length < n && copy.length > 0) {
    out.push(...copy.splice(Math.floor(rng() * copy.length), 1));
  }
  return out;
}

export function shuffleArray(array, rng = Math.random) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// =====================================================
// PEMBUATAN PILIHAN JAWABAN
// =====================================================

/**
 * Buat 4 opsi dari jawaban benar + 3 pengecoh, lalu acak posisinya.
 * Kunci mengikuti posisi hasil acakan (correctAnswerIndex).
 * Semua opsi dinormalisasi jadi string agar cocok dengan validasi.
 */
export function makeOptions(correct, distractors, rng = Math.random) {
  const correctStr = String(correct).trim();
  const pool = [...new Set(distractors.map((d) => String(d).trim()))].filter(
    (d) => d !== correctStr && d !== "",
  );

  // Cadangan pengecoh generik bila kurang dari 3
  const generic = [
    "Semua pilihan salah",
    "Tidak dapat ditentukan",
    "Informasi kurang",
    "Bukan salah satu di atas",
  ];
  let gi = 0;
  while (pool.length < 3 && gi < generic.length) {
    const g = generic[gi++];
    if (g !== correctStr && !pool.includes(g)) pool.push(g);
  }

  // Bila masih kurang (soal numerik), tambah tetangga angka
  const n = Number(correctStr);
  if (pool.length < 3 && !Number.isNaN(n)) {
    for (const d of [1, 2, 5, 10]) {
      if (pool.length >= 3) break;
      const cand = String(Math.max(0, n + d));
      if (!pool.includes(cand) && cand !== correctStr) pool.push(cand);
      if (pool.length >= 3) break;
      const cand2 = String(Math.max(0, n - d));
      if (!pool.includes(cand2) && cand2 !== correctStr) pool.push(cand2);
    }
  }

  const options = shuffleArray([correctStr, ...pool.slice(0, 3)], rng);
  const correctAnswerIndex = options.indexOf(correctStr);
  return { options, correctAnswerIndex };
}

// =====================================================
// VARIASI ANGKA TERKENDALI
// =====================================================

/**
 * Ciptakan variasi angka acak dalam rentang dengan beberapa "keluarga" angka
 * agar soal tidak mudah ditebak. Mengembalikan objek angka yang bisa dipakai
 * template.
 */
export function angkaVariasi(rng = Math.random) {
  const puluhan = () => randomInt(10, 99, rng);
  const ratusan = () => randomInt(100, 999, rng);

  return {
    puluhan,
    ratusan,
    // Pasangan angka untuk soal cerita penjumlahan/pengurangan
    pasanganTambah: () => {
      const a = puluhan();
      const b = puluhan();
      return { a, b, jumlah: a + b };
    },
    pasanganKurang: () => {
      const a = randomInt(40, 99, rng);
      const b = randomInt(10, a - 1, rng);
      return { a, b, selisih: a - b };
    },
    // Durasi dalam jam (untuk bab energi/waktu)
    jam: () => randomInt(1, 12, rng),
    // Jumlah hewan/objek (untuk bab hewan, benda)
    jumlah: (min = 2, max = 20) => randomInt(min, max, rng),
  };
}

/**
 * Pilihan jawaban untuk soal berhitung: benar + 3 angka pengecoh di sekitar.
 */
export function opsiAngka(jawabanBenar, rng = Math.random, deltaPool = [1, 2, 3, 5, 10]) {
  const benar = Number(jawabanBenar);
  const distractors = shuffleArray(deltaPool, rng)
    .slice(0, 3)
    .map((d) => {
      const sign = rng() > 0.5 ? 1 : -1;
      return Math.max(0, benar + sign * d);
    });
  return makeOptions(benar, distractors, rng);
}

// =====================================================
// PEMBANTU TEKS
// =====================================================

export function kapital(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function gabungDaftar(arr, konjungsi = "dan") {
  if (arr.length <= 1) return arr[0] ?? "";
  return arr.slice(0, -1).join(", ") + ` ${konjungsi} ${arr[arr.length - 1]}`;
}

export const SEMANGAT = () => pickRandom([
  "Ayo perhatikan dengan saksama!",
  "Pikirkan baik-baik sebelum menjawab ya.",
  "Baca soalnya dengan teliti.",
]);