/**
 * PEMBUAT ASET GAMBAR PROGRAMATIK (SVG) — Bank Soal V7
 *
 * Menghasilkan ilustrasi sederhana untuk soal IPA/IPS Kelas 3:
 * - Bagian tumbuhan (akar, batang, daun, bunga, buah)
 * - Tahapan siklus hidup (kupu-kupu, katak, ayam)
 * - Tabel data sederhana (untuk soal analisis data)
 * - Bagan silsilah keluarga (IPS)
 *
 * Gambar berupa string SVG yang bisa:
 * 1. Ditulis ke file .svg (untuk preview/review)
 * 2. Nanti di-upload ke Cloudinary (Fase 4)
 *
 * Semua gambar memakai palet ramah anak (cerah, kontras) dan label Bahasa
 * Indonesia sederhana agar siswa kelas 3 mudah memahami.
 */

// =====================================================
// PALET WARNA
// =====================================================
const W = {
  bg: "#FFF8E7",
  green: "#4CAF50",
  greenDark: "#2E7D32",
  brown: "#8D6E63",
  brownDark: "#5D4037",
  blue: "#2196F3",
  blueLight: "#BBDEFB",
  orange: "#FF9800",
  yellow: "#FFEB3B",
  red: "#F44336",
  pink: "#F48FB1",
  purple: "#9C27B0",
  text: "#333333",
  gray: "#9E9E9E",
  white: "#FFFFFF",
};

// =====================================================
// WRAPPER SVG
// =====================================================
function wrapSvg(inner, width = 480, height = 360) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${W.bg}"/>
  ${inner}
</svg>`;
}

// =====================================================
// 1. BAGIAN TUMBUHAN
// =====================================================

/**
 * Ilustrasi bagian tumbuhan. `bagian` menentukan yang disorot.
 */
export function svgBagianTumbuhan(bagian = "daun", seed = 0) {
  const x = 240; // tengah
  const stemY = 220;
  const groundY = 300;

  // Sorot bagian yang ditanya (glow/lingkaran)
  const sorot = (cx, cy, r) =>
    `<circle cx="${cx}" cy="${cy}" r="${r + 8}" fill="none" stroke="${W.orange}" stroke-width="4" stroke-dasharray="6 4"/>`;

  const akar = `<path d="M ${x} ${stemY} C ${x - 60} ${stemY + 60}, ${x - 80} ${groundY - 20}, ${x - 110} ${groundY + 20}" stroke="${W.brownDark}" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M ${x} ${stemY} C ${x + 50} ${stemY + 50}, ${x + 70} ${groundY - 10}, ${x + 100} ${groundY + 30}" stroke="${W.brownDark}" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M ${x - 20} ${stemY + 40} C ${x - 70} ${stemY + 90}, ${x - 90} ${groundY}, ${x - 60} ${groundY + 30}" stroke="${W.brown}" stroke-width="5" fill="none" stroke-linecap="round"/>
    <line x1="${x - 110}" y1="${groundY + 20}" x2="${x - 130}" y2="${groundY + 34}" stroke="${W.brownDark}" stroke-width="5" stroke-linecap="round"/>
    <line x1="${x + 100}" y1="${groundY + 30}" x2="${x + 125}" y2="${groundY + 40}" stroke="${W.brownDark}" stroke-width="5" stroke-linecap="round"/>`;

  const batang = `<rect x="${x - 14}" y="120" width="28" height="100" rx="10" fill="${W.green}" stroke="${W.greenDark}" stroke-width="3"/>`;

  const daunKiri = `<ellipse cx="${x - 70}" cy="150" rx="50" ry="22" fill="${W.green}" stroke="${W.greenDark}" stroke-width="3" transform="rotate(-25 ${x - 70} 150)"/>`;
  const daunKanan = `<ellipse cx="${x + 70}" cy="150" rx="50" ry="22" fill="${W.green}" stroke="${W.greenDark}" stroke-width="3" transform="rotate(25 ${x + 70} 150)"/>`;
  const daunAtas = `<ellipse cx="${x}" cy="95" rx="50" ry="22" fill="${W.green}" stroke="${W.greenDark}" stroke-width="3" transform="rotate(-5 ${x} 95)"/>`;

  const bunga = `<circle cx="${x}" cy="80" r="26" fill="${W.pink}" stroke="${W.red}" stroke-width="3"/>
    <circle cx="${x}" cy="80" r="9" fill="${W.yellow}" stroke="${W.orange}" stroke-width="2"/>`;

  const buah = `<circle cx="${x + 60}" cy="175" r="16" fill="${W.orange}" stroke="${W.brownDark}" stroke-width="3"/>`;

  const tanah = `<rect x="60" y="290" width="360" height="14" rx="7" fill="${W.brown}" stroke="${W.brownDark}" stroke-width="2"/>`;

  let sorotan = "";
  switch (bagian) {
    case "akar":
      sorotan = sorot(x - 20, 270, 45);
      break;
    case "batang":
      sorotan = sorot(x, 170, 45);
      break;
    case "daun":
      sorotan = sorot(x, 120, 70);
      break;
    case "bunga":
      sorotan = sorot(x, 80, 38);
      break;
    case "buah":
      sorotan = sorot(x + 60, 175, 26);
      break;
    default:
      break;
  }

  return wrapSvg(`
    ${sorotan}
    ${akar}
    ${tanah}
    ${batang}
    ${daunKiri}
    ${daunKanan}
    ${daunAtas}
    ${bunga}
    ${buah}
    <text x="240" y="345" font-family="Arial, sans-serif" font-size="15" fill="${W.text}" text-anchor="middle" font-weight="bold">Bagian Tumbuhan</text>
  `);
}

// =====================================================
// 2. SIKLUS HIDUP KUPU-KUPU
// =====================================================

export function svgSiklusKupu(seed = 0) {
  const cx = 240;
  const cy = 170;

  // Telur (kiri atas)
  const telur = `<circle cx="100" cy="90" r="14" fill="${W.yellow}" stroke="${W.orange}" stroke-width="3"/>`;

  // Ulat (kanan atas)
  const ulat = `<g transform="translate(360 90)">
    <circle cx="0" cy="0" r="16" fill="${W.green}"/>
    <circle cx="20" cy="6" r="15" fill="${W.green}"/>
    <circle cx="36" cy="14" r="14" fill="${W.green}"/>
    <circle cx="50" cy="22" r="13" fill="${W.green}"/>
    <circle cx="-8" cy="-8" r="4" fill="${W.white}"/>
    <circle cx="-6" cy="-8" r="2" fill="${W.text}"/>
    <line x1="8" y1="14" x2="-4" y2="26" stroke="${W.greenDark}" stroke-width="2"/>
    <line x1="18" y1="18" x2="10" y2="32" stroke="${W.greenDark}" stroke-width="2"/>
    <line x1="28" y1="26" x2="22" y2="38" stroke="${W.greenDark}" stroke-width="2"/>
  </g>`;

  // Kepompong (kiri bawah)
  const kepompong = `<ellipse cx="100" cy="250" rx="14" ry="26" fill="${W.brown}" stroke="${W.brownDark}" stroke-width="3" transform="rotate(-15 100 250)"/>
    <line x1="100" y1="225" x2="100" y2="275" stroke="${W.brownDark}" stroke-width="2" stroke-dasharray="4 3"/>`;

  // Kupu-kupu (kanan bawah)
  const kupu = `<g transform="translate(360 250)">
    <ellipse cx="-18" cy="-12" rx="16" ry="10" fill="${W.purple}" transform="rotate(-30 -18 -12)"/>
    <ellipse cx="18" cy="-12" rx="16" ry="10" fill="${W.purple}" transform="rotate(30 18 -12)"/>
    <ellipse cx="-14" cy="12" rx="12" ry="8" fill="${W.pink}" transform="rotate(20 -14 12)"/>
    <ellipse cx="14" cy="12" rx="12" ry="8" fill="${W.pink}" transform="rotate(-20 14 12)"/>
    <rect x="-4" y="-4" width="8" height="14" rx="4" fill="${W.brownDark}"/>
    <line x1="0" y1="-4" x2="-8" y2="-20" stroke="${W.brownDark}" stroke-width="2"/>
    <line x1="0" y1="-4" x2="8" y2="-20" stroke="${W.brownDark}" stroke-width="2"/>
  </g>`;

  // Panah
  const panah1 = `<path d="M 130 100 C 200 70, 260 70, 330 100" stroke="${W.orange}" stroke-width="4" fill="none" marker-end="url(#arrow)"/>`;
  const panah2 = `<path d="M 130 240 C 200 270, 260 270, 330 240" stroke="${W.orange}" stroke-width="4" fill="none"/>`;
  const panah3 = `<path d="M 90 115 C 70 160, 70 210, 88 245" stroke="${W.orange}" stroke-width="4" fill="none"/>`;
  const panah4 = `<path d="M 340 115 C 360 160, 360 210, 345 245" stroke="${W.orange}" stroke-width="4" fill="none"/>`;

  return wrapSvg(`
    <defs>
      <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
        <path d="M 0 0 L 8 4 L 0 8 z" fill="${W.orange}"/>
      </marker>
    </defs>
    ${panah1}${panah2}${panah3}${panah4}
    ${telur}${ulat}${kepompong}${kupu}
    <text x="100" y="70" text-anchor="middle" font-family="Arial" font-size="14" fill="${W.text}" font-weight="bold">Telur</text>
    <text x="360" y="70" text-anchor="middle" font-family="Arial" font-size="14" fill="${W.text}" font-weight="bold">Ulat</text>
    <text x="100" y="300" text-anchor="middle" font-family="Arial" font-size="14" fill="${W.text}" font-weight="bold">Kepompong</text>
    <text x="360" y="300" text-anchor="middle" font-family="Arial" font-size="14" fill="${W.text}" font-weight="bold">Kupu-kupu</text>
  `);
}

// =====================================================
// 3. SIKLUS HIDUP KATAK
// =====================================================

export function svgSiklusKatak(seed = 0) {
  const telur = `<g transform="translate(100 90)">
    <circle cx="0" cy="0" r="5" fill="${W.gray}"/>
    <circle cx="14" cy="-4" r="5" fill="${W.gray}"/>
    <circle cx="28" cy="-2" r="5" fill="${W.gray}"/>
    <circle cx="8" cy="10" r="5" fill="${W.gray}"/>
    <circle cx="22" cy="10" r="5" fill="${W.gray}"/>
    <circle cx="-4" cy="8" r="5" fill="${W.gray}"/>
  </g>`;

  const berudu = `<g transform="translate(360 95)">
    <circle cx="0" cy="0" r="12" fill="${W.brown}"/>
    <circle cx="-6" cy="-4" r="3" fill="${W.text}"/>
    <path d="M 12 0 C 26 -6, 34 6, 44 0" stroke="${W.brown}" stroke-width="5" fill="none"/>
  </g>`;

  const beruduKaki = `<g transform="translate(100 250)">
    <circle cx="0" cy="0" r="13" fill="${W.brown}"/>
    <circle cx="-6" cy="-4" r="3" fill="${W.text}"/>
    <path d="M 12 0 C 26 -6, 34 6, 44 0" stroke="${W.brown}" stroke-width="5" fill="none"/>
    <line x1="-4" y1="10" x2="-4" y2="24" stroke="${W.brown}" stroke-width="3"/>
    <line x1="4" y1="12" x2="4" y2="26" stroke="${W.brown}" stroke-width="3"/>
  </g>`;

  const katak = `<g transform="translate(360 245)">
    <ellipse cx="0" cy="0" rx="24" ry="18" fill="${W.green}"/>
    <circle cx="-10" cy="-12" r="8" fill="${W.green}" stroke="${W.greenDark}" stroke-width="2"/>
    <circle cx="2" cy="-10" r="7" fill="${W.green}"/>
    <circle cx="-14" cy="-14" r="3" fill="${W.text}"/>
    <ellipse cx="16" cy="-6" rx="10" ry="6" fill="${W.green}"/>
    <circle cx="-4" cy="-2" r="6" fill="${W.greenDark}"/>
    <path d="M -4 10 L 4 10" stroke="${W.red}" stroke-width="2"/>
  </g>`;

  const panah1 = `<path d="M 130 100 C 200 70, 260 70, 330 100" stroke="${W.blue}" stroke-width="4" fill="none" marker-end="url(#arrowk)"/>`;
  const panah2 = `<path d="M 130 240 C 200 270, 260 270, 330 240" stroke="${W.blue}" stroke-width="4" fill="none"/>`;
  const panah3 = `<path d="M 90 115 C 70 160, 70 210, 88 245" stroke="${W.blue}" stroke-width="4" fill="none"/>`;
  const panah4 = `<path d="M 340 115 C 360 160, 360 210, 345 245" stroke="${W.blue}" stroke-width="4" fill="none"/>`;

  return wrapSvg(`
    <defs>
      <marker id="arrowk" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
        <path d="M 0 0 L 8 4 L 0 8 z" fill="${W.blue}"/>
      </marker>
    </defs>
    ${panah1}${panah2}${panah3}${panah4}
    ${telur}${berudu}${beruduKaki}${katak}
    <text x="100" y="70" text-anchor="middle" font-family="Arial" font-size="14" fill="${W.text}" font-weight="bold">Telur</text>
    <text x="360" y="70" text-anchor="middle" font-family="Arial" font-size="14" fill="${W.text}" font-weight="bold">Berudu</text>
    <text x="100" y="300" text-anchor="middle" font-family="Arial" font-size="14" fill="${W.text}" font-weight="bold">Berudu berkaki</text>
    <text x="360" y="300" text-anchor="middle" font-family="Arial" font-size="14" fill="${W.text}" font-weight="bold">Katak</text>
  `);
}

// =====================================================
// 4. SIKLUS HIDUP AYAM
// =====================================================

export function svgSiklusAyam(seed = 0) {
  const telur = `<ellipse cx="100" cy="90" rx="14" ry="18" fill="${W.yellow}" stroke="${W.orange}" stroke-width="3"/>`;
  const anakAyam = `<g transform="translate(360 95)">
    <circle cx="0" cy="4" r="14" fill="${W.yellow}"/>
    <circle cx="-6" cy="-4" r="5" fill="${W.yellow}"/>
    <circle cx="6" cy="-4" r="5" fill="${W.yellow}"/>
    <circle cx="-4" cy="-2" r="2" fill="${W.text}"/>
    <circle cx="4" cy="-2" r="2" fill="${W.text}"/>
    <path d="M -4 8 L -4 16 M 2 8 L 2 16" stroke="${W.orange}" stroke-width="2"/>
  </g>`;

  const ayamDewasa = `<g transform="translate(100 248)">
    <circle cx="0" cy="0" r="22" fill="${W.orange}"/>
    <circle cx="-20" cy="-14" r="8" fill="${W.orange}"/>
    <circle cx="-24" cy="-14" r="3" fill="${W.text}"/>
    <path d="M -26 -6 L -34 -4 L -26 -2" fill="${W.red}"/>
    <path d="M 0 -14 C 10 -24, 26 -24, 34 -18" stroke="${W.orange}" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M 14 14 L 14 26" stroke="${W.orange}" stroke-width="4"/>
    <path d="M 22 12 L 22 24" stroke="${W.orange}" stroke-width="4"/>
  </g>`;

  const ayamBetina = `<g transform="translate(360 248)">
    <circle cx="0" cy="0" r="20" fill="${W.pink}"/>
    <circle cx="-18" cy="-12" r="7" fill="${W.pink}"/>
    <circle cx="-22" cy="-12" r="2.5" fill="${W.text}"/>
    <path d="M -24 -4 L -31 -2 L -24 0" fill="${W.red}"/>
    <path d="M 12 12 L 12 24" stroke="${W.pink}" stroke-width="4"/>
    <path d="M 20 10 L 20 22" stroke="${W.pink}" stroke-width="4"/>
  </g>`;

  const panah1 = `<path d="M 130 100 C 200 70, 260 70, 330 100" stroke="${W.greenDark}" stroke-width="4" fill="none" marker-end="url(#arrowa)"/>`;
  const panah2 = `<path d="M 130 240 C 200 270, 260 270, 330 240" stroke="${W.greenDark}" stroke-width="4" fill="none"/>`;
  const panah3 = `<path d="M 90 115 C 70 160, 150 210, 170 240" stroke="${W.greenDark}" stroke-width="4" fill="none" marker-end="url(#arrowa)"/>`;
  const panah4 = `<path d="M 340 115 C 360 160, 280 210, 300 240" stroke="${W.greenDark}" stroke-width="4" fill="none" marker-end="url(#arrowa)"/>`;

  return wrapSvg(`
    <defs>
      <marker id="arrowa" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
        <path d="M 0 0 L 8 4 L 0 8 z" fill="${W.greenDark}"/>
      </marker>
    </defs>
    ${panah1}${panah2}${panah3}${panah4}
    ${telur}${anakAyam}${ayamDewasa}${ayamBetina}
    <text x="100" y="62" text-anchor="middle" font-family="Arial" font-size="14" fill="${W.text}" font-weight="bold">Telur</text>
    <text x="360" y="62" text-anchor="middle" font-family="Arial" font-size="14" fill="${W.text}" font-weight="bold">Anak ayam</text>
    <text x="100" y="300" text-anchor="middle" font-family="Arial" font-size="14" fill="${W.text}" font-weight="bold">Ayam jantan</text>
    <text x="360" y="300" text-anchor="middle" font-family="Arial" font-size="14" fill="${W.text}" font-weight="bold">Ayam betina</text>
  `);
}

// =====================================================
// 5. TABEL DATA (untuk soal analisis data)
// =====================================================
// `rows` = array of { label, value }. Dibuat tabel 2 kolom dengan header opsional.

export function svgTabelData({ title = "Data", kolom1 = "Nama", kolom2 = "Jumlah", rows = [], seed = 0 }) {
  const colW = 160;
  const rowH = 34;
  const startX = 80;
  const startY = 90;
  const headerH = 40;

  const header = `<rect x="${startX}" y="${startY}" width="${colW * 2}" height="${headerH}" fill="${W.blueLight}"/>
    <text x="${startX + 20}" y="${startY + 26}" font-family="Arial" font-size="15" fill="${W.text}" font-weight="bold">${kolom1}</text>
    <text x="${startX + colW + 20}" y="${startY + 26}" font-family="Arial" font-size="15" fill="${W.text}" font-weight="bold">${kolom2}</text>`;

  const body = rows
    .map((row, i) => {
      const y = startY + headerH + i * rowH;
      const fill = i % 2 === 0 ? "#FFF3E0" : "#FFFFFF";
      return `<rect x="${startX}" y="${y}" width="${colW * 2}" height="${rowH}" fill="${fill}" stroke="${W.gray}" stroke-width="1"/>
        <text x="${startX + 20}" y="${y + 23}" font-family="Arial" font-size="14" fill="${W.text}">${row.label}</text>
        <text x="${startX + colW + 20}" y="${y + 23}" font-family="Arial" font-size="14" fill="${W.text}" font-weight="bold">${row.value}</text>`;
    })
    .join("");

  const judul = `<text x="240" y="60" font-family="Arial" font-size="18" fill="${W.text}" text-anchor="middle" font-weight="bold">${title}</text>`;

  return wrapSvg(judul + header + body, 400, rows.length * rowH + startY + headerH + 40);
}

// =====================================================
// 6. BAGAN SILSILAH KELUARGA (IPS)
// =====================================================

/**
 * Bagan silsilah 3 tingkat: Kakek-Nenek → Ayah-Ibu → Anak.
 */
export function svgSilsilahKeluarga({ kakek = "Kakek", nenek = "Nenek", ayah = "Ayah", ibu = "Ibu", anak = "Anak", seed = 0 }) {
  const nodeW = 90;
  const nodeH = 34;

  const box = (cx, cy, label, color) => {
    const x = cx - nodeW / 2;
    const y = cy - nodeH / 2;
    return `<rect x="${x}" y="${y}" width="${nodeW}" height="${nodeH}" rx="10" fill="${color}" stroke="${W.text}" stroke-width="2"/>
      <text x="${cx}" y="${cy + 6}" font-family="Arial" font-size="14" fill="${W.white}" text-anchor="middle" font-weight="bold">${label}</text>`;
  };

  const line = (x1, y1, x2, y2) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${W.text}" stroke-width="3"/>`;

  const top = 80;
  const mid = 175;
  const bottom = 270;

  const kakekNenek = box(140, top, kakek, W.blue) + box(340, top, nenek, W.pink);
  const ayahIbu = box(140, mid, ayah, W.blue) + box(340, mid, ibu, W.pink);
  const anakBox = box(240, bottom, anak, W.green);

  // Garis: kakek-nenek terhubung, turun ke ayah-ibu, turun ke anak
  const garis = `
    ${line(175, top + 6, 175, mid - 6)}
    ${line(200, mid, 280, mid)}
    ${line(240, mid + nodeH / 2, 240, bottom - nodeH / 2)}
  `;

  const judul = `<text x="240" y="40" font-family="Arial" font-size="18" fill="${W.text}" text-anchor="middle" font-weight="bold">Silsilah Keluarga</text>`;

  return wrapSvg(judul + garis + kakekNenek + ayahIbu + anakBox, 480, 320);
}

// =====================================================
// 7. BAR CHART SEDERHANA (untuk IPS/ekonomi & IPA)
// =====================================================

export function svgBarChart({ title = "Diagram", labels = [], values = [], colors = [], seed = 0 }) {
  const chartX = 70;
  const chartY = 220;
  const chartW = 340;
  const maxV = Math.max(...values, 1);
  const barW = 44;
  const gap = (chartW - barW * values.length) / (values.length + 1);

  const bars = values
    .map((v, i) => {
      const h = (v / maxV) * 150;
      const x = chartX + gap + i * (barW + gap);
      const y = chartY - h;
      const color = colors[i] || W.blue;
      return `<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="${color}" rx="4"/>
        <text x="${x + barW / 2}" y="${y - 8}" font-family="Arial" font-size="14" fill="${W.text}" text-anchor="middle" font-weight="bold">${v}</text>
        <text x="${x + barW / 2}" y="${chartY + 24}" font-family="Arial" font-size="13" fill="${W.text}" text-anchor="middle">${labels[i]}</text>`;
    })
    .join("");

  const axis = `<line x1="${chartX}" y1="${chartY}" x2="${chartX + chartW}" y2="${chartY}" stroke="${W.text}" stroke-width="3"/>
    <line x1="${chartX}" y1="${chartY}" x2="${chartX}" y2="${chartY - 170}" stroke="${W.text}" stroke-width="3"/>`;

  const judul = `<text x="240" y="50" font-family="Arial" font-size="18" fill="${W.text}" text-anchor="middle" font-weight="bold">${title}</text>`;

  return wrapSvg(judul + axis + bars, 480, 300);
}

// =====================================================
// 8. BAGIAN TUBUH HEWAN (untuk IPA hewan)
// =====================================================

export function svgHewan(hewan = "ayam", seed = 0) {
  if (hewan === "sapi") {
    return wrapSvg(`
      <g transform="translate(240 200)">
        <ellipse cx="0" cy="0" rx="80" ry="45" fill="${W.brown}"/>
        <circle cx="-70" cy="-25" r="28" fill="${W.brown}"/>
        <circle cx="-80" cy="-30" r="4" fill="${W.text}"/>
        <ellipse cx="-30" cy="22" rx="10" ry="14" fill="${W.brown}" stroke="${W.brownDark}" stroke-width="2"/>
        <ellipse cx="-5" cy="22" rx="10" ry="14" fill="${W.brown}" stroke="${W.brownDark}" stroke-width="2"/>
        <ellipse cx="30" cy="22" rx="10" ry="14" fill="${W.brown}" stroke="${W.brownDark}" stroke-width="2"/>
        <ellipse cx="60" cy="22" rx="10" ry="14" fill="${W.brown}" stroke="${W.brownDark}" stroke-width="2"/>
        <line x1="-70" y1="-45" x2="-60" y2="-70" stroke="${W.brownDark}" stroke-width="4"/>
        <line x1="-58" y1="-45" x2="-48" y2="-68" stroke="${W.brownDark}" stroke-width="4"/>
        <path d="M 70 -10 C 90 -15, 90 -5, 78 0" stroke="${W.text}" stroke-width="3" fill="none"/>
        <text x="-78" y="-35" font-family="Arial" font-size="12" fill="${W.text}" text-anchor="middle">tanduk</text>
      </g>
      <text x="240" y="310" text-anchor="middle" font-family="Arial" font-size="14" fill="${W.text}" font-weight="bold">Sapi</text>
    `);
  }

  // default: ayam
  return wrapSvg(`
    <g transform="translate(240 210)">
      <circle cx="0" cy="0" r="34" fill="${W.orange}"/>
      <circle cx="-28" cy="-22" r="12" fill="${W.orange}"/>
      <circle cx="-34" cy="-22" r="4.5" fill="${W.text}"/>
      <path d="M -36 -8 L -48 -5 L -36 -2" fill="${W.red}"/>
      <path d="M 6 -20 C 20 -36, 44 -36, 56 -26" stroke="${W.orange}" stroke-width="12" fill="none" stroke-linecap="round"/>
      <path d="M 20 22 L 20 40" stroke="${W.orange}" stroke-width="5"/>
      <path d="M 34 18 L 34 38" stroke="${W.orange}" stroke-width="5"/>
    </g>
    <text x="240" y="310" text-anchor="middle" font-family="Arial" font-size="14" fill="${W.text}" font-weight="bold">Ayam</text>
  `);
}

/**
 * Registri semua generator SVG agar mudah dipakai generator soal.
 */
export const SVG_GENERATORS = {
  bagianTumbuhan: svgBagianTumbuhan,
  siklusKupu: svgSiklusKupu,
  siklusKatak: svgSiklusKatak,
  siklusAyam: svgSiklusAyam,
  tabelData: svgTabelData,
  silsilah: svgSilsilahKeluarga,
  barChart: svgBarChart,
  hewan: svgHewan,
};