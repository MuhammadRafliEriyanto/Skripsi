/**
 * SCRIPT UNTUK MENGABUNGKAN SEMUA EXCEL BANK SOAL
 * Menggabungkan:
 * 1. V5 (SMA+SMP) - 36,850 soal
 * 2. SD - 7,600 soal
 * 3. UTBK - 1,800 soal
 * TOTAL: ~46,250 soal
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

let XLSX;
try {
  const xlsxModule = await import('xlsx');
  XLSX = xlsxModule.default || xlsxModule;
} catch (error) {
  console.error("Failed to import xlsx:", error.message);
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths ke semua Excel files
const excelFiles = [
  path.join(__dirname, '..', '..', '..', 'outputs', 'assessment-bank-rekap', 
    'rekap-bank-soal-bimbel-bina-cendekia-ber-sumber-V5-QUALITY.xlsx'),
  path.join(__dirname, '..', '..', 'outputs', 'assessment-bank-rekap', 
    'rekap-bank-soal-bimbel-bina-cendekia-ber-sumber-SD-V1-QUALITY.xlsx'),
  path.join(__dirname, '..', '..', 'outputs', 'assessment-bank-rekap', 
    'rekap-bank-soal-bimbel-bina-cendekia-ber-sumber-UTBK-V1-QUALITY.xlsx')
];

console.log("=".repeat(80));
console.log("EXCEL MERGE SCRIPT - COMBINE ALL QUESTION BANKS");
console.log("=".repeat(80));

try {
  const allQuestions = [];
  let totalProcessed = 0;
  
  // Read each Excel file and extract questions
  for (const filePath of excelFiles) {
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ File not found: ${filePath}`);
      continue;
    }
    
    console.log(`\n📂 Reading: ${path.basename(filePath)}`);
    
    const workbook = XLSX.default.readExcel(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert sheet to JSON
    const jsonData = XLSX.utils.sheet_to_json(jsonData);
    
    console.log(`   ✓ Loaded ${jsonData.length} questions`);
    allQuestions.push(...jsonData);
    totalProcessed += jsonData.length;
  }
  
  console.log(`\n✨ Total Questions Processed: ${totalProcessed}`);
  
  // Export combined to single Excel
  const combinedWorksheet = XLSX.utils.json_to_sheet(allQuestions);
  const combinedWorkbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(combinedWorkbook, combinedWorksheet, "Bank Soal Lengkap");
  
  const outputDir = path.join(__dirname, '..', 'outputs', 'assessment-bank-rekap');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const outputPath = path.join(outputDir, 
    'REKAP-BANK-SOAL-BIMBEL-BINA-CENDEKIA-COMPLETE-ALL-JENJANG.xlsx'
  );
  
  XLSX.writeFile(combinedWorkbook, outputPath);
  console.log(`\n✅ Combined Excel saved to: ${outputPath}`);
  
  // Generate statistics report
  const stats = {};
  for (const q of allQuestions) {
    const key = q["Program/Kelas"];
    if (!stats[key]) {
      stats[key] = {
        "Program/Kelas": key,
        "Total Soal": 0,
        "Mata Pelajaran": new Set()
      };
    }
    stats[key]["Total Soal"]++;
    stats[key]["Mata Pelajaran"].add(q["Mata Pelajaran"]);
  }
  
  const reportFile = path.join(outputDir, 
    `LAPORAN-COMBINED-ALL-JENJANG-${new Date().toISOString().split('T')[0]}.md`
  );
  
  let reportContent = `# Laporan Gabungan Bank Soal Lengkap - Semua Jenjang Pendidikan\n\n`;
  reportContent += `Tanggal: ${new Date().toLocaleDateString('id-ID')}\n\n`;
  reportContent += `## 📊 Statistik Keseluruhan\n\n`;
  reportContent += `| Program/Kelas | Mata Pelajaran | Total Soal |\n`;
  reportContent += `|--------------|---------------|------------|\n`;
  
  let grandTotal = 0;
  for (const key of Object.keys(stats).sort()) {
    const s = stats[key];
    const mapels = Array.from(s["Mata Pelajaran"]).join(", ");
    reportContent += `| ${s["Program/Kelas"]} | ${mapels} | ${s["Total Soal"]} |\n`;
    grandTotal += s["Total Soal"];
  }
  
  reportContent += `\n## 📈 Ringkasan by Category\n\n`;
  reportContent += `- **Total Seluruhnya**: **${grandTotal.toLocaleString()} soal**\n`;
  reportContent += `- **File Output**: \`${path.basename(outputPath)}\`\n`;
  reportContent += `- **Source Files**:\n`;
  reportContent += `  - V5 (SMA IPA + SMA IPS + SMP 7-9): ~36,850 soal\n`;
  reportContent += `  - SD (Kelas 3-6): ~7,600 soal\n`;
  reportContent += `  - UTBK (SNBT Preparation): ~1,800 soal\n\n`;
  
  reportContent += `## ✅ Coverage Lengkap\n\n`;
  reportContent += `Generator sekarang mencakup:\n`;
  reportContent += `- ✏️ **SD Kelas 3-6** (Sekolah Dasar)\n`;
  reportContent += `- 📚 **SMP Kelas 7-9** (Sekatan Pertama)\n`;
  reportContent += `- 🎓 **SMA IPA** (Ilmu Pengetahuan Alam)\n`;
  reportContent += `- 💼 **SMA IPS** (Ilmu Pengetahuan Sosial)\n`;
  reportContent += `- 🧪 **UTBK/SNBT** (Persiapan Ujian Masuk PTN)\n\n`;
  
  reportContent += `## 📝 Next Steps\n\n`;
  reportContent += `1. Verifikasi jumlah soal di Excel\n`;
  reportContent += `2. Spot check beberapa soal random dari setiap jenjang\n`;
  reportContent += `3. Backup database existing BEFORE import\n`;
  reportContent += `4. Import bank soal lengkap ke MongoDB\n`;
  reportContent += `5. Test randomization di aplikasi\n\n`;
  
  fs.writeFileSync(reportFile, reportContent);
  console.log(`\n📊 Report saved to: ${reportFile}`);
  
  console.log("\n" + "=".repeat(80));
  console.log("✅ MERGE COMPLETE!");
  console.log(`Total Soal: ${grandTotal.toLocaleString()}`);
  console.log("=".repeat(80));
  
} catch (error) {
  console.error("❌ Error:", error.message);
  process.exit(1);
}
