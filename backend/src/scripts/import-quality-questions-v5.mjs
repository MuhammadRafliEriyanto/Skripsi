# Import Script - Upload Soal Berkualitas V5 ke Database
# JALANKAN HANYA SETELAH BACKUP DAN AUDIT SELESAI

const { MongoClient } = require('mongodb');
const XLSX = require('xlsx');
require('dotenv').config();

// REQUIREMENT: MONGODB_URI must be set in environment variables
if (!process.env.MONGODB_URI) {
  console.error('\n❌ ERROR: MONGODB_URI environment variable is required');
  console.error('   Please set MONGODB_URI in backend/.env file');
  console.error('   Example: MONGODB_URI=mongodb://localhost:27017/your_database');
  console.error('');
  console.error('   For Atlas cluster use:');
  console.error('   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database');
  console.error('');
  process.exit(1);
}

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

async function importQualityQuestions() {
  try {
    // Load Excel file
    console.log('📂 Loading Excel file...');
    const excelPath = 'outputs/assessment-bank-rekap/rekap-bank-soal-bimbel-bina-cendekia-ber-sumber-V5-QUALITY.xlsx';
    
    if (!require('fs').existsSync(excelPath)) {
      throw new Error(`File not found: ${excelPath}`);
    }
    
    const workbook = XLSX.readFile(excelPath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const questions = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`✅ Loaded ${questions.length.toLocaleString()} questions from Excel\n`);
    
    await client.connect();
    console.log('🔌 Connected to MongoDB');
    
    const db = client.db('bimbel-lms');
    const questionBankCollection = db.collection('questionbanks');
    
    // Get current count
    const existingCount = await questionBankCollection.countDocuments();
    console.log(`📊 Current database has: ${existingCount.toLocaleString()} questions`);
    
    // Check if we're replacing or appending
    console.log('\n🤔 IMPORT STRATEGY:');
    console.log('  Option 1: REPLACE all existing (backup already made!)');
    console.log('  Option 2: APPEND to existing (total will be higher)');
    console.log('');
    console.log('Press ENTER to REPLACE all (recommended for fresh quality bank)');
    console.log('Or type "APPEND" and ENTER to add to existing');
    
    // Wait for user input in interactive mode
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    readline.question('Choice (REPLACE/APPEND): ', (choice) => {
      const strategy = choice.toUpperCase().trim() === 'APPEND' ? 'append' : 'replace';
      
      if (strategy === 'replace') {
        console.log('\n⚠️  REPLACING ALL EXISTING QUESTIONS!');
        
        // Backup current data first (double protection)
        console.log('💾 Creating additional backup before replacement...');
        (async () => {
          const backupData = await questionBankCollection.find({}).toArray();
          const fs = require('fs');
          const path = require('path');
          
          const backupDir = path.join(__dirname, '..', '..', '..', 'backups', `pre-quality-migration-${new Date().toISOString().split('T')[0]}`);
          const backupPath = path.join(backupDir, 'questionbanks-before-import.json');
          
          fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
          console.log(`✅ Additional backup saved to: ${backupPath}`);
          
          // Now replace
          await questionBankCollection.deleteMany({});
          console.log('✅ Deleted all existing questions');
          await runImport(strategy, questions);
        })();
        
      } else {
        await runImport(strategy, questions);
      }
    });
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

async function runImport(strategy, questions) {
  const questionBankCollection = client.db('bimbel-lms').collection('questionbanks');
  
  console.log(`\n📥 Starting import: ${questions.length.toLocaleString()} questions (${strategy})\n`);
  
  let successCount = 0;
  let failCount = 0;
  const errors = [];
  
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    
    try {
      // Map Excel columns to MongoDB schema
      const document = {
        program: q['Program/Kelas'],
        subject: q['Mata Pelajaran'],
        topic: q['Topik/Materi'],
        difficulty: q['Tingkat Kesulitan'] || 'Medium',
        uniqueId: q['ID Unik Soal'],
        variationId: q['Variasi ID'] || null,
        cognitiveLevel: q['Kognitif'] || null,
        competency: q['Kompetensi'] || null,
        questionText: q['Soal'],
        optionA: q['Opsi A'],
        optionB: q['Opsi B'],
        optionC: q['Opsi C'],
        optionD: q['Opsi D'],
        correctAnswer: q['Kunci Jawaban'],
        explanation: q['Pembahasan'],
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 'V5-QUALITY',
        isQualityQuestion: true
      };
      
      // Upsert (insert or update based on uniqueId)
      await questionBankCollection.updateOne(
        { uniqueId: document.uniqueId },
        { $set: document },
        { upsert: true }
      );
      
      successCount++;
      
      // Progress indicator every 5000 questions
      if ((i + 1) % 5000 === 0) {
        console.log(`✅ Progress: ${successCount.toLocaleString()}/${questions.length.toLocaleString()} imported (${((successCount / questions.length) * 100).toFixed(1)}%)`);
      }
      
    } catch (err) {
      failCount++;
      errors.push({
        index: i,
        uniqueId: q['ID Unik Soal'],
        error: err.message
      });
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('IMPORT COMPLETED!');
  console.log('='.repeat(60));
  console.log(`✅ Successful: ${successCount.toLocaleString()} questions`);
  console.log(`❌ Failed: ${failCount.toLocaleString()} questions`);
  
  if (errors.length > 0) {
    console.log(`\n⚠️  Errors encountered:`);
    console.log(JSON.stringify(errors.slice(0, 10), null, 2)); // Show first 10 errors
  }
  
  // Verify final count
  const finalCount = await questionBankCollection.countDocuments();
  console.log(`\n📊 Final database count: ${finalCount.toLocaleString()} questions`);
  
  if (strategy === 'replace') {
    console.log(`\n✅ You successfully replaced ${((finalCount / questions.length) * 100).toFixed(0)}% of target`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('NEXT STEPS:');
  console.log('1. ✅ Verify with audit script');
  console.log('2. ✅ Test CBT exam generation');
  console.log('3. ✅ Random sampling check (review 10-20 random questions)');
  console.log('4. ✅ Teacher validation');
  console.log('='.repeat(60));
  
  await client.close();
  process.exit(0);
}

importQualityQuestions();
