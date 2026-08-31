# Backup Script - Bank Soal Existing (79,200 Dummy Questions)
# JALANKAN SEBELUM MIGRASI APA PUN

const { MongoClient } = require('mongodb');
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

async function backupExistingQuestionBank() {
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db('bimbel-lms');
    const questionBankCollection = db.collection('questionbanks');
    const studentTaskAttemptsCollection = db.collection('studenttaskattempts');
    
    // Get count of existing data
    const existingCount = await questionBankCollection.countDocuments();
    console.log(`📊 Current question banks: ${existingCount.toLocaleString()} documents`);
    
    // Create backup directory
    const fs = require('fs');
    const path = require('path');
    
    const backupDir = path.join(__dirname, '..', '..', 'backups', `pre-quality-migration-${new Date().toISOString().split('T')[0]}`);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // Backup 1: Export entire questionbanks collection to JSON
    console.log('\n💾 Backing up questionbanks to JSON...');
    const questions = await questionBankCollection.find({}).toArray();
    const jsonPath = path.join(backupDir, 'questionbanks-backup.json');
    fs.writeFileSync(jsonPath, JSON.stringify(questions, null, 2));
    console.log(`✅ Question banks backup saved to: ${jsonPath}`);
    
    // Backup 2: Create summary statistics
    console.log('\n📊 Creating statistics summary...');
    const stats = {
      backupDate: new Date().toISOString(),
      sourceDatabase: 'bimbel-lms.questionbanks',
      totalQuestions: existingCount,
      subjects: {},
      programs: {},
      topics: {},
      answerKeys: {}
    };
    
    // Analyze distribution by subject
    const subjectCounts = await questionBankCollection.aggregate([
      { $group: { _id: '$subject', count: { $sum: 1 } } }
    ]).toArray();
    stats.subjectsDistribution = subjectCounts;
    
    // Analyze distribution by program
    const programCounts = await questionBankCollection.aggregate([
      { $group: { _id: '$program', count: { $sum: 1 } } }
    ]).toArray();
    stats.programsDistribution = programCounts;
    
    // Save statistics
    const statsPath = path.join(backupDir, 'statistics-summary.json');
    fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
    console.log(`✅ Statistics summary saved to: ${statsPath}`);
    
    // Backup 3: Student task attempts (for reference)
    console.log('\n💾 Backing up studenttaskattempts...');
    const attemptsCount = await studentTaskAttemptsCollection.countDocuments();
    const sampleAttempts = await studentTaskAttemptsCollection.find({}).limit(100).toArray();
    const attemptsPath = path.join(backupDir, 'sample-attempts-100.json');
    fs.writeFileSync(attemptsPath, JSON.stringify(sampleAttempts, null, 2));
    console.log(`✅ Sample attempts (100 docs) saved to: ${attemptsPath}`);
    
    console.log('\n' + '='.repeat(60));
    console.log('BACKUP COMPLETED SUCCESSFULLY!');
    console.log(`Location: ${backupDir}`);
    console.log(`Total questions backed up: ${existingCount.toLocaleString()}`);
    console.log('='.repeat(60));
    console.log('\n⚠️  IMPORTANT: Do not proceed with migration without this backup!');
    
  } catch (error) {
    console.error('❌ Backup failed:', error.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

backupExistingQuestionBank();
