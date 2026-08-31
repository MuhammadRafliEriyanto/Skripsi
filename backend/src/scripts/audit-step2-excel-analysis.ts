import mongoose from 'mongoose';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

// Excel files to audit (in pipeline order)
const excelFiles = [
  {
    name: "Source Excel V6 Core",
    path: "d:\\Skripsi\\Next Js\\bimbel-new\\backend\\Bank_Soal_Matematika_SMA_IPA_V6.xlsx",
    role: "SOURCE"
  },
  {
    name: "Generated SD Bank",
    path: "d:\\Skripsi\\Next Js\\bimbel-new\\backend\\outputs\\assessment-bank-rekap\\rekap-bank-soal-bimbel-bina-cendekia-ber-sumber-SD-V1-QUALITY.xlsx",
    role: "GENERATED"
  },
  {
    name: "Generated UTBK Bank",
    path: "d:\\Skripsi\\Next Js\\bimbel-new\\backend\\outputs\\assessment-bank-rekap\\rekap-bank-soal-bimbel-bina-cendekia-ber-sumber-UTBK-V1-QUALITY.xlsx",
    role: "GENERATED"
  },
  {
    name: "Varied V6 Output",
    path: "d:\\Skripsi\\Next Js\\bimbel-new\\backend\\outputs\\assessment-bank-rekap\\REKAP-BANK-SOAL-VARIED-V6.xlsx",
    role: "VARIED"
  },
  {
    name: "QuestionBank MongoDB",
    path: "mongodb://QUESTIONBANK_COLLECTION",
    role: "DATABASE"
  }
];

async function auditExcelFile(filepath: string, fileRole: string) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`AUDITING: ${filepath}`);
  console.log(`Role: ${fileRole}`);
  console.log('='.repeat(80));
  
  try {
    // Check if file exists
    if (!fs.existsSync(filepath)) {
      console.log(`❌ FILE NOT FOUND: ${filepath}`);
      return null;
    }
    
    const workbookPath = path.resolve(filepath);
    
    // Dynamically import xlsx parser
    const XLSX = await import('xlsx');
    const workbook = XLSX.readFile(workbookPath);
    
    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON with headers
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (jsonData.length === 0) {
      console.log('⚠️ EMPTY FILE');
      return null;
    }
    
    // Parse headers
    const headers = jsonData[0] as string[];
    const dataRows = jsonData.slice(1);
    
    console.log(`\nSheet: ${sheetName}`);
    console.log(`Total Rows (excluding header): ${dataRows.length.toLocaleString()}`);
    console.log(`Headers: ${headers.join(', ')}`);
    
    // Find relevant columns
    const colMap: Record<string, number> = {};
    headers.forEach((header, idx) => {
      colMap[header.toLowerCase().trim()] = idx;
    });
    
    // Extract answer distribution
    const answerDist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, Numeric: 0, Null: 0, Other: 0 };
    const optionSets = new Map<string, number>();
    
    for (const row of dataRows) {
      // Count answers
      let answerValue = null;
      
      if ('jawaban benar' in colMap || 'correctanswer' in colMap || 'correct_answer' in colMap) {
        const key = Object.keys(colMap).find(k => 
          k.includes('jawaban') || k.includes('correctanswer') || k.includes('correct_answer')
        );
        if (key !== undefined && row[colMap[key]] !== undefined) {
          answerValue = String(row[colMap[key]]).trim().toUpperCase();
        }
      }
      
      if (answerValue) {
        if (['A', 'B', 'C', 'D'].includes(answerValue)) {
          answerDist[answerValue as keyof typeof answerDist]++;
        } else if (!isNaN(Number(answerValue))) {
          answerDist.Numeric++;
        } else if (answerValue === '' || answerValue === 'NULL' || answerValue === 'NONE') {
          answerDist.Null++;
        } else {
          answerDist.Other++;
        }
      }
      
      // Build options fingerprint
      let optionsKey = '';
      const optionCols = headers.filter(h => h.toLowerCase().includes('option'));
      if (optionCols.length >= 4) {
        const opts = optionCols.map(col => {
          const idx = headers.indexOf(col);
          return row[idx]?.toString().trim();
        });
        optionsKey = opts.sort().join('|');
        if (optionsKey) {
          optionSets.set(optionsKey, (optionSets.get(optionsKey) || 0) + 1);
        }
      }
    }
    
    // Print analysis
    console.log('\n✅ Answer Distribution:');
    for (const [ans, count] of Object.entries(answerDist)) {
      const pct = dataRows.length > 0 ? ((count / dataRows.length) * 100).toFixed(2) : '0.00';
      console.log(`  ${ans.padEnd(12)}: ${count.toLocaleString().padStart(7)} (${pct}%)`);
    }
    
    // Option repetition analysis
    const totalOptionSets = optionSets.size;
    const repeatedSets = Array.from(optionSets.entries()).filter(([_, count]) => count > 1).length;
    const repeatRate = dataRows.length > 0 ? ((repeatedSets / totalOptionSets) * 100).toFixed(2) : '0.00';
    
    console.log('\n🔢 Options Fingerprint Analysis:');
    console.log(`  Unique option sets: ${totalOptionSets.toLocaleString()}`);
    console.log(`  Repeated option sets: ${repeatedSets.toLocaleString()}`);
    console.log(`  Repetition rate: ${repeatRate}%`);
    
    return {
      headers,
      rowCount: dataRows.length,
      answerDistribution: answerDist,
      optionFingerprints: {
        total: totalOptionSets,
        repeated: repeatedSets,
        rate: parseFloat(repeatRate),
        samples: Array.from(optionSets.entries()).slice(0, 5)
      }
    };
    
  } catch (error) {
    console.error(`❌ ERROR reading file:`, error);
    return null;
  }
}

async function auditDatabaseAnswerDist() {
  console.log('\n\n' + '='.repeat(80));
  console.log('AUDITING QUESTIONBANK DATABASE COLLECTION');
  console.log('='.repeat(80));
  
  await mongoose.connect(process.env.MONGO_URI as string);
  
  const collection = mongoose.connection.collection('questionbanks');
  const totalDocs = await collection.countDocuments({});
  
  console.log(`Total documents: ${totalDocs.toLocaleString()}`);
  
  // Answer distribution
  const dist = await collection.aggregate([
    {
      $group: {
        _id: '$correctAnswer',
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]).toArray();
  
  const answerDist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
  dist.forEach((d: any) => {
    if (answerDist[d._id] !== undefined) {
      answerDist[d._id] = d.count;
    }
  });
  
  console.log('\n✅ Database Answer Distribution:');
  for (const [ans, count] of Object.entries(answerDist)) {
    const pct = ((count / totalDocs) * 100).toFixed(2);
    console.log(`  ${ans.padEnd(12)}: ${count.toLocaleString().padStart(7)} (${pct}%)`);
  }
  
  // Topic-based option repetition check (sample)
  const topicStats = await collection.aggregate([
    { $match: { program: 'SMP', subject: { $regex: /bahasa.*indonesia/i } } },
    { $addFields: { optionsStr: { $toString: "$options" } } },
    { $group: { _id: '$topic', uniqueOpts: { $addToSet: "$optionsStr" }, count: { $sum: 1 } } },
    { $project: { _id: 1, uniqueCount: { $size: "$uniqueOpts" }, total: "$count" } }
  ]).limit(5).toArray();
  
  console.log('\n📊 Sample Topic Analysis (SMP Bahasa Indonesia):');
  topicStats.forEach((t: any) => {
    console.log(`  ${t._id}:`);
    console.log(`    Total questions: ${t.total}`);
    console.log(`    Unique option sets: ${t.uniqueCount}`);
    console.log(`    Repetition rate: ${t.uniqueCount < t.total ? `${((1 - t.uniqueCount/t.total)*100).toFixed(2)}%` : '0%'}`);
  });
  
  return { totalDocs, answerDist };
}

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('EXCEL PIPELINE FORENSIC AUDIT - ANSWER DISTRIBUTION ANALYSIS');
  console.log('='.repeat(80));
  
  const results: Record<string, any> = {};
  
  // Audit each Excel file
  for (const fileInfo of excelFiles) {
    if (fileInfo.path.startsWith('mongodb://')) {
      const dbResults = await auditDatabaseAnswerDist();
      results['DATABASE'] = dbResults;
    } else {
      const result = await auditExcelFile(fileInfo.path, fileInfo.role);
      if (result) {
        results[fileInfo.name] = result;
      }
    }
  }
  
  // Summary comparison
  console.log('\n\n' + '='.repeat(80));
  console.log('COMPARISON SUMMARY');
  console.log('='.repeat(80));
  
  const excelFileList = Object.keys(results).filter(k => k !== 'DATABASE');
  const dbResults = results.DATABASE;
  
  console.log('\nAnswer Distribution Comparison:');
  console.log(''.padEnd(35) + '|'.padEnd(15) + '|'.padEnd(15) + '|'.padEnd(15) + '|'.padEnd(15));
  console.log('-'.repeat(80));
  
  const cols = ['Source/Stage'];
  for (const ef of excelFileList) cols.push(ef);
  cols.push('DATABASE');
  
  console.log(cols.join('|'.padEnd(14)));
  
  for (const answer of ['A', 'B', 'C', 'D']) {
    const row = [`Answer ${answer}`];
    for (const ef of excelFiles) {
      const dist = results[ef].answerDistribution;
      const val = dist[answer]?.toString()?.padEnd(7) || 'N/A';
      const pct = dist[answer] && results[ef].rowCount > 0 
        ? `(${((dist[answer]/results[ef].rowCount)*100).toFixed(1)}%)`.padEnd(6)
        : '-'.padEnd(6);
      row.push(val + pct);
    }
    row.push(`${dbResults.answerDist[answer].toLocaleString().padStart(7)} (${(dbResults.answerDist[answer]/dbResults.totalDocs*100).toFixed(1)}%)`);
    console.log(row.join('|'.padEnd(14)));
  }
  
  console.log('\n\n' + '='.repeat(80));
  console.log('PIPELINE TRACE COMPLETE');
  console.log('='.repeat(80));
  console.log('✅ Read-only audit completed.');
  console.log('⏸️ No changes made to any files or database.\n');
  
  process.exit(0);
}

main();
