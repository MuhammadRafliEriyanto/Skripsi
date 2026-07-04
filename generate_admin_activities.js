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
    name: 'admin_dashboard',
    puml: `@startuml\n${commonStyle}\n|Admin Cabang|\nstart\n:Mengakses Menu Dashboard;\n|Sistem|\n:Mengambil Data Statistik Cabang\\n(Siswa Aktif, Guru, Kelas);\\n:Menampilkan Ringkasan Data;\n|Admin Cabang|\n:Melihat Ringkasan\\nOperasional Cabang;\nstop\n@enduml`
  },
  {
    name: 'admin_siswa',
    puml: `@startuml\n${commonStyle}\n|Admin Cabang|\nstart\n:Mengakses Menu Kelola Siswa;\n|Sistem|\n:Mengambil Daftar Siswa;\n:Menampilkan Tabel Data Siswa;\n|Admin Cabang|\n:Memilih Aksi (Tambah/Edit/Hapus Siswa);\n|Sistem|\n:Menampilkan Form Data Siswa;\n|Admin Cabang|\n:Mengisi Data Diri & Paket Membership;\n:Klik Tombol Simpan;\n|Sistem|\n:Validasi Data Input;\nif (Data Valid?) then (Ya)\n  :Simpan Perubahan ke Database;\n  :Tampilkan Pesan Sukses;\n  |Admin Cabang|\n  :Melihat Data Siswa Terkini;\n  stop\nelse (Tidak)\n  |Sistem|\n  :Tampilkan Pesan Error Validasi;\n  |Admin Cabang|\n  :Memperbaiki Data;\n  stop\nendif\n@enduml`
  },
  {
    name: 'admin_guru',
    puml: `@startuml\n${commonStyle}\n|Admin Cabang|\nstart\n:Mengakses Menu Kelola Guru;\n|Sistem|\n:Mengambil Daftar Guru;\n:Menampilkan Tabel Data Guru;\n|Admin Cabang|\n:Memilih Aksi (Tambah/Edit/Hapus Guru);\n|Sistem|\n:Menampilkan Form Data Guru;\n|Admin Cabang|\n:Mengisi Profil Guru & Mata Pelajaran;\n:Klik Tombol Simpan;\n|Sistem|\n:Validasi Data Input;\nif (Data Valid?) then (Ya)\n  :Simpan Perubahan ke Database;\n  :Tampilkan Pesan Sukses;\n  |Admin Cabang|\n  :Melihat Data Guru Terkini;\n  stop\nelse (Tidak)\n  |Sistem|\n  :Tampilkan Pesan Error Validasi;\n  |Admin Cabang|\n  :Memperbaiki Data;\n  stop\nendif\n@enduml`
  },
  {
    name: 'admin_jadwal',
    puml: `@startuml\n${commonStyle}\n|Admin Cabang|\nstart\n:Mengakses Menu Jadwal & Ruang;\n|Sistem|\n:Mengambil Daftar Jadwal Kelas;\n:Menampilkan Kalender/Tabel Jadwal;\n|Admin Cabang|\n:Memilih Aksi Tambah Jadwal;\n|Sistem|\n:Menampilkan Form Jadwal;\n|Admin Cabang|\n:Memilih Guru, Ruangan, Jam & Kelas;\n:Klik Tombol Simpan;\n|Sistem|\n:Cek Bentrok Jadwal\\n(Guru/Ruangan);\nif (Ada Bentrok?) then (Ya)\n  :Tampilkan Peringatan Bentrok;\n  |Admin Cabang|\n  :Mengganti Waktu/Ruangan/Guru;\n  stop\nelse (Tidak)\n  |Sistem|\n  :Simpan Jadwal ke Database;\n  :Tampilkan Pesan Sukses;\n  |Admin Cabang|\n  :Melihat Jadwal Terkini;\n  stop\nendif\n@enduml`
  },
  {
    name: 'admin_pembayaran',
    puml: `@startuml\n${commonStyle}\n|Admin Cabang|\nstart\n:Mengakses Menu Pembayaran Siswa;\n|Sistem|\n:Mengambil Data Tagihan & Transaksi;\n:Menampilkan Daftar Pembayaran;\n|Admin Cabang|\n:Memilih Transaksi Menunggu Verifikasi;\n|Sistem|\n:Menampilkan Detail Bukti Pembayaran;\n|Admin Cabang|\n:Klik Verifikasi & Setujui;\n|Sistem|\n:Update Status Transaksi Menjadi Lunas;\n:Perbarui Masa Aktif Membership Siswa;\n:Tampilkan Pesan Sukses;\n|Admin Cabang|\n:Melihat Status Tagihan Lunas;\nstop\n@enduml`
  },
  {
    name: 'admin_keuangan_cabang',
    puml: `@startuml\n${commonStyle}\n|Admin Cabang|\nstart\n:Mengakses Menu Keuangan Cabang;\n|Sistem|\n:Mengambil Rekapan Pemasukan Cabang;\n:Menampilkan Ringkasan Keuangan;\n|Admin Cabang|\n:Mencatat Pengeluaran Operasional Baru;\n|Sistem|\n:Menampilkan Form Pengeluaran;\n|Admin Cabang|\n:Mengisi Nominal, Tanggal & Keterangan;\n:Klik Tombol Simpan;\n|Sistem|\n:Validasi Form;\nif (Form Lengkap?) then (Ya)\n  :Simpan Data Pengeluaran;\n  :Kalkulasi Ulang Saldo Cabang;\n  |Admin Cabang|\n  :Melihat Laporan Keuangan Terkini;\n  stop\nelse (Tidak)\n  |Sistem|\n  :Tampilkan Peringatan Error;\n  |Admin Cabang|\n  :Melengkapi Form;\n  stop\nendif\n@enduml`
  },
  {
    name: 'admin_edit_profile',
    puml: `@startuml\n${commonStyle}\n|Admin Cabang|\nstart\n:Mengakses Menu Profil;\n|Sistem|\n:Mengambil Data Profil Admin;\n:Menampilkan Halaman Profil;\n|Admin Cabang|\n:Mengubah Data (Nama/Email/Password);\n:Klik Tombol Simpan;\n|Sistem|\n:Validasi Data Input;\nif (Data Valid?) then (Ya)\n  :Simpan Perubahan ke Database;\n  :Tampilkan Pesan Sukses;\n  |Admin Cabang|\n  :Melihat Profil Terbaru;\n  stop\nelse (Tidak)\n  |Sistem|\n  :Tampilkan Pesan Error Validasi;\n  |Admin Cabang|\n  :Memperbaiki Data;\n  stop\nendif\n@enduml`
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
