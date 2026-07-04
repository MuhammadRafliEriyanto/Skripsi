const zlib = require('zlib');
const fs = require('fs');
const https = require('https');

const commonStyle = `
skinparam style strictuml
skinparam activity {
  BackgroundColor #E3F2FD
  BorderColor #1E88E5
  FontName Arial
  FontSize 13
}
skinparam activityDiamond {
  BackgroundColor #E3F2FD
  BorderColor #1E88E5
  FontName Arial
  FontSize 13
}
skinparam swimlane {
  BorderColor #1E88E5
  BorderThickness 1.5
  TitleFontName Arial
  TitleFontSize 14
  TitleFontColor #0D47A1
}
skinparam arrow {
  Color #1E88E5
}
skinparam NoteBackgroundColor #FFFFFF
skinparam NoteBorderColor #1E88E5
`;

const diagrams = [
  {
    name: 'admin_pemasukan',
    puml: `@startuml\n${commonStyle}\n|Admin Cabang|\nstart\n:Mengakses Menu Laporan Pemasukan;\n|Sistem|\n:Mengambil Data Transaksi Lunas;\n:Menampilkan Daftar Pemasukan;\n|Admin Cabang|\n:Menerapkan Filter Waktu (Bulan/Tahun);\n|Sistem|\n:Kalkulasi Total Pemasukan;\n:Menampilkan Ringkasan & Tabel Pemasukan;\n|Admin Cabang|\n:Melihat Rekapan Pemasukan Cabang;\nstop\n@enduml`
  },
  {
    name: 'admin_pengeluaran',
    puml: `@startuml\n${commonStyle}\n|Admin Cabang|\nstart\n:Mengakses Menu Pengeluaran;\n|Sistem|\n:Mengambil Riwayat Pengeluaran Cabang;\n:Menampilkan Tabel Pengeluaran;\n|Admin Cabang|\n:Klik "Tambah Pengeluaran";\n|Sistem|\n:Menampilkan Form Pengeluaran;\n|Admin Cabang|\n:Mengisi Nominal, Tanggal & Keterangan;\n:Klik Simpan;\n|Sistem|\n:Validasi Form;\nif (Data Valid?) then (Ya)\n  :Simpan Data Pengeluaran;\n  :Tampilkan Pesan Sukses;\n  |Admin Cabang|\n  :Melihat Data Pengeluaran Terbaru;\n  stop\nelse (Tidak)\n  |Sistem|\n  :Tampilkan Peringatan Error;\n  |Admin Cabang|\n  :Memperbaiki Form;\n  stop\nendif\n@enduml`
  },
  {
    name: 'admin_aktivasi_membership',
    puml: `@startuml\n${commonStyle}\n|Admin Cabang|\nstart\n:Mengakses Menu Pembayaran Siswa;\n|Sistem|\n:Mengambil Daftar Tagihan;\n:Menampilkan Transaksi "Menunggu Verifikasi";\n|Admin Cabang|\n:Memilih Transaksi\\n& Mengecek Bukti Bayar;\n:Klik "Verifikasi & Aktifkan";\n|Sistem|\n:Ubah Status Transaksi (Lunas);\n:Tambahkan Masa Aktif\\nMembership Siswa;\n:Kirim Notifikasi Sukses ke Siswa;\n|Admin Cabang|\n:Melihat Status Membership Aktif;\nstop\n@enduml`
  }
];

function encode64(data) {
  let r = "";
  for (let i=0; i<data.length; i+=3) {
    if (i+2==data.length) {
      r += append3bytes(data[i], data[i+1], 0);
    } else if (i+1==data.length) {
      r += append3bytes(data[i], 0, 0);
    } else {
      r += append3bytes(data[i], data[i+1], data[i+2]);
    }
  }
  return r;
}

function append3bytes(b1, b2, b3) {
  let c1 = b1 >> 2;
  let c2 = ((b1 & 0x3) << 4) | (b2 >> 4);
  let c3 = ((b2 & 0xF) << 2) | (b3 >> 6);
  let c4 = b3 & 0x3F;
  let r = "";
  r += encode6bit(c1 & 0x3F);
  r += encode6bit(c2 & 0x3F);
  r += encode6bit(c3 & 0x3F);
  r += encode6bit(c4 & 0x3F);
  return r;
}

function encode6bit(b) {
  if (b < 10) return String.fromCharCode(48 + b);
  b -= 10;
  if (b < 26) return String.fromCharCode(65 + b);
  b -= 26;
  if (b < 26) return String.fromCharCode(97 + b);
  b -= 26;
  if (b === 0) return '-';
  if (b === 1) return '_';
  return '?';
}

function downloadDiagram(diagram) {
  return new Promise((resolve, reject) => {
    const deflated = zlib.deflateSync(Buffer.from(diagram.puml, 'utf8'), { level: 9 });
    const encoded = encode64(deflated);
    const url = "https://www.plantuml.com/plantuml/png/" + "~1" + encoded;
    const dest = "docs/diagrams/" + diagram.name + ".png";
    const file = fs.createWriteStream(dest);
    
    https.get(url, function(response) {
      response.pipe(file);
      file.on("finish", () => {
        file.close();
        console.log("Downloaded: " + dest);
        resolve();
      });
    }).on('error', reject);
  });
}

async function main() {
  if (!fs.existsSync('docs/diagrams')) {
    fs.mkdirSync('docs/diagrams', { recursive: true });
  }
  for (const d of diagrams) {
    await downloadDiagram(d);
  }
  console.log("All done!");
}

main();
