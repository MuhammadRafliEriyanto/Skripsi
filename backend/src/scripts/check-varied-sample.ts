import * as xlsx from 'xlsx';
import * as path from 'path';

const inputFilePath = path.join(process.cwd(), 'outputs', 'assessment-bank-rekap', 'REKAP-BANK-SOAL-VARIED-V6.xlsx');
const workbook = xlsx.readFile(inputFilePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data: any[] = xlsx.utils.sheet_to_json(worksheet);

// Let's filter to only valid, modified questions to check the variation
const modifiedData = data.filter(r => r.variation_status === 'MODIFIED');

// Take a sample of 10 random modified questions
console.log(`\n--- SAMPEL 10 SOAL HASIL VARIASI ---`);
const samples = modifiedData.sort(() => 0.5 - Math.random()).slice(0, 10);
for (let i = 0; i < samples.length; i++) {
  console.log(`\n${i + 1}. [${samples[i]['Mata Pelajaran']} - ${samples[i]['Topik/Materi']}]`);
  console.log(`Soal Asli : ${samples[i]['original_question']}`);
  console.log(`Soal Baru : ${samples[i]['Soal']}`);
}
