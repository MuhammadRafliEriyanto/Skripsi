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
    name: 'siswa_login',
    puml: `@startuml\n${commonStyle}\n|Siswa|\nstart\n:Membuka Halaman Login;\n:Mengisi Email & Password;\n:Klik Tombol Login;\n|Sistem|\n:Validasi Format Input;\nif (Format Valid?) then (Ya)\n  :Cari Data di Database;\n  if (Kredensial Cocok \\n& Role Siswa?) then (Ya)\n    :Buat Sesi Autentikasi;\n    :Arahkan ke Dashboard;\n    |Siswa|\n    :Melihat Dashboard Siswa;\n    stop\n  else (Tidak)\n    |Sistem|\n    :Tampilkan Error;\n    |Siswa|\n    :Melihat Pesan Error;\n    stop\n  endif\nelse (Tidak)\n  |Sistem|\n  :Tampilkan Error;\n  |Siswa|\n  :Melihat Pesan Error;\n  stop\nendif\n@enduml`
  },
  {
    name: 'siswa_pembelajaran',
    puml: `@startuml\n${commonStyle}\n|Siswa|\nstart\n:Mengakses Menu Pembelajaran;\n|Sistem|\n:Cek Status Membership Siswa;\nif (Membership Aktif?) then (Ya)\n  :Mengambil Data Jadwal & Materi;\n  :Menampilkan Modul Pembelajaran;\n  |Siswa|\n  :Mengunduh File Materi & Membaca;\n  stop\nelse (Tidak)\n  |Sistem|\n  :Menampilkan Pesan Akses Ditolak\\n(Membership Tidak Aktif);\n  |Siswa|\n  :Diarahkan ke Menu Tagihan;\n  stop\nendif\n@enduml`
  },
  {
    name: 'siswa_tugas',
    puml: `@startuml\n${commonStyle}\n|Siswa|\nstart\n:Mengakses Menu Tugas;\n|Sistem|\n:Menampilkan Daftar Tugas Aktif;\n|Siswa|\n:Memilih Tugas;\n|Sistem|\n:Menampilkan Detail Instruksi Tugas;\n|Siswa|\n:Mengerjakan & Mengunggah File Jawaban;\n:Klik Kumpulkan Tugas;\n|Sistem|\n:Validasi Ukuran & Format File;\nif (File Valid?) then (Ya)\n  :Simpan File & Tandai Selesai;\n  :Tampilkan Notifikasi Berhasil;\n  |Siswa|\n  :Melihat Status "Terkumpul";\n  stop\nelse (Tidak)\n  |Sistem|\n  :Tampilkan Pesan Error;\n  |Siswa|\n  :Mengganti File Sesuai Syarat;\n  stop\nendif\n@enduml`
  },
  {
    name: 'siswa_ujian',
    puml: `@startuml\n${commonStyle}\n|Siswa|\nstart\n:Mengakses Menu Ujian / Tryout;\n|Sistem|\n:Cek Jadwal Ujian Aktif;\n:Menampilkan Daftar Ujian Tersedia;\n|Siswa|\n:Klik "Mulai Kerjakan Ujian";\n|Sistem|\n:Menampilkan Lembar Soal\\n& Hitung Mundur Waktu;\n|Siswa|\n:Mengisi Jawaban (Pilihan Ganda / Essay);\n:Klik "Selesai & Kumpulkan";\n|Sistem|\n:Kalkulasi Nilai Otomatis;\n:Menyimpan Hasil ke Database;\n:Tampilkan Ringkasan Nilai;\n|Siswa|\n:Melihat Hasil Skor Ujian;\nstop\n@enduml`
  },
  {
    name: 'siswa_absensi_qr',
    puml: `@startuml\n${commonStyle}\n|Siswa|\nstart\n:Mengakses Kamera dari Perangkat;\n:Melakukan Scan QR Code Guru;\n|Sistem|\n:Menerima Token QR;\n:Validasi Token & Sesi Kelas;\nif (QR Code Valid & Cocok?) then (Ya)\n  :Catat Kehadiran Siswa;\n  :Tampilkan Pesan "Absen Berhasil";\n  |Siswa|\n  :Melihat Riwayat Kehadiran Terbaru;\n  stop\nelse (Tidak)\n  |Sistem|\n  :Tampilkan Peringatan "QR Tidak Valid";\n  |Siswa|\n  :Mencoba Scan Ulang;\n  stop\nendif\n@enduml`
  },
  {
    name: 'siswa_tagihan',
    puml: `@startuml\n${commonStyle}\n|Siswa|\nstart\n:Mengakses Menu Tagihan & Membership;\n|Sistem|\n:Mengambil Riwayat Transaksi Siswa;\n:Menampilkan Daftar Tagihan;\n|Siswa|\n:Memilih Paket Perpanjangan Membership;\n:Klik "Lanjutkan Pembayaran";\n|Sistem|\n:Menampilkan Opsi Bayar / Transfer;\n|Siswa|\n:Melakukan Transfer Bank / E-Wallet;\n:Mengunggah Bukti Pembayaran;\n|Sistem|\n:Simpan Bukti Pembayaran;\n:Ubah Status "Menunggu Verifikasi";\n|Siswa|\n:Menunggu Verifikasi Admin;\nstop\n@enduml`
  },
  {
    name: 'siswa_edit_profile',
    puml: `@startuml\n${commonStyle}\n|Siswa|\nstart\n:Mengakses Menu Profil;\n|Sistem|\n:Mengambil Data Profil Siswa;\n:Menampilkan Halaman Profil;\n|Siswa|\n:Mengubah Data (Nama/Email/Password);\n:Klik Tombol Simpan;\n|Sistem|\n:Validasi Data Input;\nif (Data Valid?) then (Ya)\n  :Simpan Perubahan ke Database;\n  :Tampilkan Pesan Sukses;\n  |Siswa|\n  :Melihat Profil Terbaru;\n  stop\nelse (Tidak)\n  |Sistem|\n  :Tampilkan Pesan Error Validasi;\n  |Siswa|\n  :Memperbaiki Data;\n  stop\nendif\n@enduml`
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
