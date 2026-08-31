import * as xlsx from 'xlsx';
import * as path from 'path';

const inputFilePath = path.join(process.cwd(), 'outputs', 'assessment-bank-rekap', 'REKAP-BANK-SOAL-BIMBEL-BINA-CENDEKIA-COMPLETE-ALL-JENJANG.xlsx');
const workbook = xlsx.readFile(inputFilePath);
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const data: any[] = xlsx.utils.sheet_to_json(worksheet);

const topOpenings = [
  "nilai 5 siswa",
  "sebuah taman berbentuk",
  "diketahui fungsi f(x)",
  "toko baju kapasitas",
  "dalam penelitian bakteri",
  "suatu obat berkurang",
  "soal matematika untuk",
  "soal ips untuk",
  "soal bahasa indonesia",
  "english language question"
];

for (const opening of topOpenings) {
  console.log(`\n--- OPENING: ${opening} ---`);
  const samples = data.filter(r => (r['Soal'] || '').toLowerCase().includes(opening)).slice(0, 2);
  for (const s of samples) {
    console.log(`Mapel: ${s['Mata Pelajaran']} | Topik: ${s['Topik/Materi']}`);
    console.log(`Soal: ${s['Soal']}`);
    console.log(`Opsi: A) ${s['Opsi A']} B) ${s['Opsi B']} C) ${s['Opsi C']} D) ${s['Opsi D']}`);
  }
}
