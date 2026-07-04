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

const diagram = {
    name: 'guru_nilai',
    puml: `@startuml\n${commonStyle}\n|Guru|\nstart\n:Mengakses Menu Rekap Nilai;\n|Sistem|\n:Mengambil Daftar Kelas\\nyang Diampu;\n:Menampilkan Halaman\\nRekap Nilai;\n|Guru|\n:Menerapkan Filter\\n(Kelas & Jenis Evaluasi);\n|Sistem|\n:Mengkalkulasi Nilai Siswa\\n(Tugas & Ujian);\n:Menampilkan Tabel\\nNilai Akhir;\n|Guru|\n:Melihat Rekapan Nilai\\ndan (Opsional) Export Data;\nstop\n@enduml`
};

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

downloadDiagram(diagram).then(() => console.log("Done"));
