/**
 * SCRIPT IMPORT BANK SOAL KE MONGODB
 * Mengimport dari EXCEL COMBINED ke koleksi questionbanks
 * 
 * Usage: node backend/src/scripts/import-quality-questions.mjs
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
require('dotenv').config({ path: '.env' });

const { MongoClient } = require('mongodb');

// Configuration
const MONGODB_URI = process.env.MONGODB_URI || 'your-mongodb-uri-here';
const DATABASE_NAME = 'bimbel-lms';
const COLLECTION_NAME = 'questionbanks';
const EXCEL_FILE_PATH = path.join(__dirname, '..', '..', 'outputs', 'assessment-bank-rekap', 
  'REKAP-BANK-SOAL-BIMBEL-BINA-CENDEKIA-COMPLETE-ALL-JENJANG.xlsx');

console.log("=".repeat(80));
console.log("IMPORT BANK SOAL KE MONGODB");
console.log("=".repeat(80));

async function importQuestions() {
  let client;
  
  try {
    // Connect to MongoDB
    console.log('\n🔌 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db(DATABASE_NAME);
    const collection = db.collection(COLLECTION_NAME);
    
    // Read Excel file
    console.log(`\n📂 Reading Excel file: ${EXCEL_FILE_PATH}`);
    
    if (!fs.existsSync(EXCEL_FILE_PATH)) {
      throw new Error(`Excel file not found: ${EXCEL_FILE_PATH}`);
    }
    
    const workbook = XLSX.readFile(EXCEL_FILE_PATH);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert Excel to JSON
    const excelData = XLSX.utils.sheet_to_json(worksheet);
    console.log(`📊 Loaded ${excelData.length} questions from Excel\n`);
    
    // Prepare questions for MongoDB
    const questionsToInsert = [];
    
    console.log('🔄 Processing questions...');
    
    for (let i = 0; i < excelData.length; i++) {
      const row = excelData[i];
      
      // FILTER: Extract ONLY needed columns
      const questionDoc = {
        // CORE QUESTION DATA (REQUIRED)
        soal: row["Soal"] || "",
        pilihanA: row["Opsi A"] || "",
        pilihanB: row["Opsi B"] || "",
        pilihanC: row["Opsi C"] || "",
        pilihanD: row["Opsi D"] || "",
        kunciJawaban: row["Kunci Jawaban"] || "",
        
        // METADATA (FOR FILTERING & SEARCHING)
        programKelas: row["Program/Kelas"] || "",
        mataPelajaran: row["Mata Pelajaran"] || "",
        topikMateri: row["Topik/Materi"] || "",
        levelKesulitan: row["Level Kesulitan"] || row["Tingkat Kesulitan"] || "Medium",
        tingkatKognitif: row["Kognitif"] || "",
        kompetensiDasar: row["Kompetensi"] || "",
        idUnikSoal: row["ID Unik Soal"] || "",
        variasiID: row["Variasi ID"] || "",
        
        // SYSTEM FIELDS
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        usageCount: 0
      };
      
      questionsToInsert.push(questionDoc);
      
      // Progress indicator
      if ((i + 1) % 1000 === 0) {
        console.log(`   ✓ Processed ${(i + 1).toLocaleString()} / ${excelData.length.toLocaleString()} questions`);
      }
    }
    
    console.log(`\n⏳ Inserting ${questionsToInsert.length.toLocaleString()} questions...\n`);
    
    // Batch insert (500 questions per batch for performance)
    const BATCH_SIZE = 500;
    let insertedCount = 0;
    
    for (let i = 0; i < questionsToInsert.length; i += BATCH_SIZE) {
      const batch = questionsToInsert.slice(i, i + BATCH_SIZE);
      
      const result = await collection.insertMany(batch, {
        ordered: false,  // Continue even if some fail
        forceServerObjectId: false
      });
      
      insertedCount += result.insertedCount;
      const progress = ((i + BATCH_SIZE) / questionsToInsert.length * 100).toFixed(1);
      
      console.log(`   [${progress}%] Batch ${(i / BATCH_SIZE + 1)} inserted (${result.insertedCount} docs)`);
    }
    
    console.log('\n✅ Import completed successfully!');
    console.log(`   Total Questions Imported: ${insertedCount.toLocaleString()}`);
    
    // Generate summary report
    console.log('\n📊 Summary by Program/Kelas:');
    const statsByProgram = {};
    for (const q of questionsToInsert) {
      const program = q.programKelas;
      if (!statsByProgram[program]) {
        statsByProgram[program] = 0;
      }
      statsByProgram[program]++;
    }
    
    for (const [program, count] of Object.entries(statsByProgram).sort()) {
      console.log(`   ${program.padEnd(20)} : ${count.toLocaleString().padStart(8)} questions`);
    }
    
    console.log('\n📊 Summary by Subject:');
    const statsBySubject = {};
    for (const q of questionsToInsert) {
      const subject = q.mataPelajaran;
      if (!statsBySubject[subject]) {
        statsBySubject[subject] = 0;
      }
      statsBySubject[subject]++;
    }
    
    for (const [subject, count] of Object.entries(statsBySubject).sort()) {
      console.log(`   ${subject.padEnd(25)} : ${count.toLocaleString().padStart(8)} questions`);
    }
    
    // Verify in database
    const totalCount = await collection.countDocuments();
    console.log('\n🔍 Verification:');
    console.log(`   Total documents in collection: ${totalCount.toLocaleString()}`);
    
    if (totalCount !== insertedCount) {
      console.warn('   ⚠️ WARNING: Document count mismatch! Check for duplicates.');
    } else {
      console.log('   ✅ Verification passed!');
    }
    
  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
    
    if (error.name === 'MongoServerError') {
      console.error('   Details:', error.details);
      console.error('\n💡 Possible issues:');
      console.error('   - Duplicate key: Some questions already exist with same ID');
      console.error('   - Connection: Check your MONGODB_URI in .env');
      console.error('   - Index: Make sure unique index exists on idUnikSoal');
    }
    
    process.exit(1);
    
  } finally {
    if (client) {
      await client.close();
      console.log('\n👋 MongoDB connection closed');
    }
  }
}

// Run import
importQuestions();
