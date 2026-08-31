import * as xlsx from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const inputFilePath = path.join(process.cwd(), 'outputs', 'assessment-bank-rekap', 'REKAP-BANK-SOAL-VARIED-V6.xlsx');
const outputAuditPath = path.join(process.cwd(), 'outputs', 'assessment-bank-rekap', 'audit-after.json');

interface AuditResult {
  totalQuestions: number;
  byJenjang: Record<string, number>;
  byKelas: Record<string, number>;
  byProgram: Record<string, number>;
  byMataPelajaran: Record<string, number>;
  byTopik: Record<string, number>;
  openings: Record<string, number>;
  exactDuplicates: number;
  nearDuplicates: number; // Placeholder
}

function getOpening(text: string): string {
  if (!text) return '';
  const words = text.trim().split(/\s+/);
  if (words.length >= 3) {
    return words.slice(0, 3).join(' ').replace(/[.,!?:]/g, '').toLowerCase();
  }
  return text.trim().replace(/[.,!?:]/g, '').toLowerCase();
}

async function audit() {
  console.log(`Reading Excel file: ${inputFilePath}`);
  if (!fs.existsSync(inputFilePath)) {
    console.error('File not found!');
    process.exit(1);
  }

  const workbook = xlsx.readFile(inputFilePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  const data: any[] = xlsx.utils.sheet_to_json(worksheet);
  console.log(`Total rows loaded: ${data.length}`);

  const result: AuditResult = {
    totalQuestions: data.length,
    byJenjang: {},
    byKelas: {},
    byProgram: {},
    byMataPelajaran: {},
    byTopik: {},
    openings: {},
    exactDuplicates: 0,
    nearDuplicates: 0,
  };

  const seenQuestions = new Set<string>();

  for (const row of data) {
    const programKelas = row['Program/Kelas'] || '';
    const mapel = row['Mata Pelajaran'] || '';
    const topik = row['Topik/Materi'] || '';
    const soal = row['Soal'] || '';

    // Infer jenjang, kelas, program from 'Program/Kelas'
    // E.g., 'SMA IPA', 'SD Kelas 3', 'SMP Kelas 7', 'UTBK'
    let jenjang = 'Unknown';
    let kelas = 'Unknown';
    let program = 'Umum';

    const pkUpper = programKelas.toUpperCase();
    if (pkUpper.includes('SD')) {
      jenjang = 'SD';
      const match = pkUpper.match(/KELAS\s*(\d+)/);
      if (match) kelas = match[1];
    } else if (pkUpper.includes('SMP')) {
      jenjang = 'SMP';
      const match = pkUpper.match(/KELAS\s*(\d+)/);
      if (match) kelas = match[1];
    } else if (pkUpper.includes('SMA')) {
      jenjang = 'SMA';
      if (pkUpper.includes('IPA')) program = 'IPA';
      else if (pkUpper.includes('IPS')) program = 'IPS';
      // Kelas might not be in Program/Kelas for SMA if it's generic, but we can check
      const match = pkUpper.match(/KELAS\s*(\d+)/);
      if (match) kelas = match[1];
    } else if (pkUpper.includes('UTBK') || pkUpper.includes('SNBT')) {
      jenjang = 'UTBK';
    } else {
      jenjang = programKelas;
    }

    result.byJenjang[jenjang] = (result.byJenjang[jenjang] || 0) + 1;
    result.byKelas[kelas] = (result.byKelas[kelas] || 0) + 1;
    result.byProgram[program] = (result.byProgram[program] || 0) + 1;
    result.byMataPelajaran[mapel] = (result.byMataPelajaran[mapel] || 0) + 1;
    result.byTopik[topik] = (result.byTopik[topik] || 0) + 1;

    const opening = getOpening(soal);
    if (opening) {
      result.openings[opening] = (result.openings[opening] || 0) + 1;
    }

    const normalizedSoal = soal.replace(/\s+/g, ' ').trim().toLowerCase();
    if (seenQuestions.has(normalizedSoal)) {
      result.exactDuplicates++;
    } else {
      seenQuestions.add(normalizedSoal);
    }
  }

  // Sort openings by frequency
  const sortedOpenings = Object.entries(result.openings)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .reduce((obj, [key, value]) => {
      obj[key] = value;
      return obj;
    }, {} as Record<string, number>);
    
  result.openings = sortedOpenings;

  fs.writeFileSync(outputAuditPath, JSON.stringify(result, null, 2));
  console.log(`Audit complete. Results saved to ${outputAuditPath}`);
}

audit().catch(console.error);
