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
    name: 'owner_dashboard',
    puml: `@startuml\n${commonStyle}\n|Owner|\nstart\n:Mengakses Menu Dashboard;\n|Sistem|\n:Mengambil Data Statistik Cabang,\\nSiswa, Guru & Keuangan;\n:Kalkulasi Total Pendapatan\\n& Pengeluaran;\n:Menampilkan Grafik\\n& Ringkasan Data;\n|Owner|\n:Melihat Ringkasan\\nOperasional Bimbel;\nstop\n@enduml`
  },
  {
    name: 'owner_cabang',
    puml: `@startuml\n${commonStyle}\n|Owner|\nstart\n:Mengakses Menu Kelola Cabang;\n|Sistem|\n:Mengambil Daftar Cabang;\n:Menampilkan Tabel Data Cabang;\n|Owner|\n:Memilih Aksi (Tambah/Edit/Hapus);\n|Sistem|\n:Menampilkan Form Data Cabang;\n|Owner|\n:Mengisi Data Cabang & Simpan;\n|Sistem|\n:Validasi Data Input;\nif (Data Valid?) then (Ya)\n  :Simpan Perubahan ke Database;\n  :Tampilkan Pesan Sukses;\n  |Owner|\n  :Melihat Data Cabang Terkini;\n  stop\nelse (Tidak)\n  |Sistem|\n  :Tampilkan Pesan Error Validasi;\n  |Owner|\n  :Memperbaiki Data;\n  stop\nendif\n@enduml`
  },
  {
    name: 'owner_admin_cabang',
    puml: `@startuml\n${commonStyle}\n|Owner|\nstart\n:Mengakses Menu Admin Cabang;\n|Sistem|\n:Mengambil Data Admin per Cabang;\n:Menampilkan Tabel Admin Cabang;\n|Owner|\n:Memilih Aksi (Tambah/Edit/Hapus);\n|Sistem|\n:Menampilkan Form Akun Admin;\n|Owner|\n:Mengisi Data Akun & Simpan;\n|Sistem|\n:Validasi Data Input;\nif (Email Sudah\\nTerdaftar?) then (Ya)\n  :Tampilkan Error\\n"Email Digunakan";\n  |Owner|\n  :Memperbaiki Email;\n  stop\nelse (Tidak)\n  |Sistem|\n  :Simpan Data Admin\\n& Enkripsi Password;\n  :Tampilkan Pesan Sukses;\n  |Owner|\n  :Melihat Daftar Admin Terkini;\n  stop\nendif\n@enduml`
  },
  {
    name: 'owner_keuangan',
    puml: `@startuml\n${commonStyle}\n|Owner|\nstart\n:Mengakses Menu Laporan Keuangan;\n|Sistem|\n:Mengambil Data Pemasukan;\n:Mengambil Data Pengeluaran;\n:Menampilkan Tabel\\n& Filter Rentang Waktu;\n|Owner|\n:Memilih Filter Waktu\\n(Bulan/Tahun);\n|Sistem|\n:Query Data Sesuai Filter;\n:Menampilkan Data Keuangan\\n& Total Saldo;\n|Owner|\n:Melihat Laporan Keuangan;\nstop\n@enduml`
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
