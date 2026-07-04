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
    name: 'guru_login',
    puml: `@startuml\n${commonStyle}\n|Guru|\nstart\n:Membuka Halaman Login;\n:Mengisi Email & Password;\n:Klik Tombol Login;\n|Sistem|\n:Validasi Format Input;\nif (Format Valid?) then (Ya)\n  :Cari Data di Database;\n  if (Kredensial Cocok \\n& Role Guru?) then (Ya)\n    :Buat Sesi Autentikasi;\n    :Arahkan ke Dashboard;\n    |Guru|\n    :Melihat Dashboard Guru;\n    stop\n  else (Tidak)\n    |Sistem|\n    :Tampilkan Error;\n    |Guru|\n    :Melihat Pesan Error;\n    stop\n  endif\nelse (Tidak)\n  |Sistem|\n  :Tampilkan Error;\n  |Guru|\n  :Melihat Pesan Error;\n  stop\nendif\n@enduml`
  },
  {
    name: 'guru_kelas',
    puml: `@startuml\n${commonStyle}\n|Guru|\nstart\n:Mengakses Menu Kelas;\n|Sistem|\n:Mengambil Jadwal Kelas\\nGuru Terkait;\n:Menampilkan Daftar\\nKelas & Peserta;\n|Guru|\n:Memilih Kelas;\n|Sistem|\n:Menampilkan Detail Pertemuan;\n|Guru|\n:Melihat Detail Kelas;\nstop\n@enduml`
  },
  {
    name: 'guru_materi',
    puml: `@startuml\n${commonStyle}\n|Guru|\nstart\n:Mengakses Menu Materi;\n|Sistem|\n:Menampilkan Materi\\nSesuai Kelas;\n|Guru|\n:Klik Tambah/Upload Materi;\n|Sistem|\n:Menampilkan Form Materi;\n|Guru|\n:Mengunggah File\\n& Menulis Deskripsi;\n:Klik Simpan;\n|Sistem|\n:Menyimpan File ke Storage;\n:Menyimpan Data ke Database;\n:Tampilkan Pesan Sukses;\n|Guru|\n:Materi Berhasil\\nDibagikan ke Siswa;\nstop\n@enduml`
  },
  {
    name: 'guru_tugas',
    puml: `@startuml\n${commonStyle}\n|Guru|\nstart\n:Mengakses Menu Tugas;\n|Sistem|\n:Menampilkan Daftar\\nTugas & Status;\n|Guru|\n:Meninjau Jawaban Siswa;\n|Sistem|\n:Menampilkan Detail Jawaban;\n|Guru|\n:Memberikan Nilai\\n& Catatan Evaluasi;\n:Klik Simpan Nilai;\n|Sistem|\n:Validasi Nilai;\n:Simpan Nilai ke Database;\n:Tampilkan Pesan Sukses;\n|Guru|\n:Melihat Status\\nPenilaian Selesai;\nstop\n@enduml`
  },
  {
    name: 'guru_absensi_qr',
    puml: `@startuml\n${commonStyle}\n|Guru|\nstart\n:Mengakses Menu Absensi QR;\n|Sistem|\n:Mengambil Data Jadwal\\nKelas Saat Ini;\n:Generate QR Code Unik;\n:Menampilkan QR Code;\n|Guru|\n:Menunjukkan QR Code\\nkepada Siswa;\n|Sistem|\n:Sistem Menerima Hasil\\nScan dari Siswa;\n:Sistem Memvalidasi\\nLokasi & Waktu;\n:Update Status\\nKehadiran Siswa (Hadir);\n|Guru|\n:Melihat Pembaruan\\nDaftar Hadir Secara Realtime;\nstop\n@enduml`
  },
  {
    name: 'guru_ujian',
    puml: `@startuml\n${commonStyle}\n|Guru|\nstart\n:Mengakses Menu Ujian;\n|Sistem|\n:Menampilkan Daftar Ujian;\n|Guru|\n:Klik "Buat Ujian Baru";\n|Sistem|\n:Menampilkan Form Ujian & Soal;\n|Guru|\n:Mengatur Waktu\\n& Menambahkan Soal;\n:Klik Simpan Ujian;\n|Sistem|\n:Validasi Form & Total Soal;\nif (Valid?) then (Ya)\n  :Simpan Ujian ke Database;\n  :Tampilkan Pesan Sukses;\n  |Guru|\n  :Melihat Daftar Ujian Aktif;\n  stop\nelse (Tidak)\n  |Sistem|\n  :Tampilkan Peringatan Error;\n  |Guru|\n  :Memperbaiki Form/Soal;\n  stop\nendif\n@enduml`
  },
  {
    name: 'guru_edit_profile',
    puml: `@startuml\n${commonStyle}\n|Guru|\nstart\n:Mengakses Menu Profil;\n|Sistem|\n:Mengambil Data Profil Guru;\n:Menampilkan Halaman Profil;\n|Guru|\n:Mengubah Data (Nama/Email/Password);\n:Klik Tombol Simpan;\n|Sistem|\n:Validasi Data Input;\nif (Data Valid?) then (Ya)\n  :Simpan Perubahan ke Database;\n  :Tampilkan Pesan Sukses;\n  |Guru|\n  :Melihat Profil Terbaru;\n  stop\nelse (Tidak)\n  |Sistem|\n  :Tampilkan Pesan Error Validasi;\n  |Guru|\n  :Memperbaiki Data;\n  stop\nendif\n@enduml`
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
