# Audit Script - Analisis Bank Soal Existing
# Untuk memahami struktur dan distribusi data yang ada

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

async function auditExistingQuestionBank() {
  try {
    await client.connect();
    console.log('🔍 Connecting to MongoDB...');
    
    const db = client.db('bimbel-lms');
    const questionBankCollection = db.collection('questionbanks');
    
    // Get basic stats
    const totalQuestions = await questionBankCollection.countDocuments();
    console.log(`\n📊 TOTAL SOAL DI DATABASE: ${totalQuestions.toLocaleString()}`);
    
    // Analyze distribution by Program
    console.log('\n📌 DISTRIBUTION BY PROGRAM/CLASS:');
    const programs = await questionBankCollection.aggregate([
      { $group: { _id: '$program', count: { $sum: 1 }, subjects: { $addToSet: '$subject' } } }
    ]).sort({ count: -1 }).toArray();
    
    programs.forEach(p => {
      console.log(`  • ${p._id}: ${p.count.toLocaleString()} soal (${p.subjects.length} mata pelajaran)`);
    });
    
    // Analyze distribution by Subject
    console.log('\n📌 DISTRIBUTION BY SUBJECT:');
    const subjects = await questionBankCollection.aggregate([
      { $group: { _id: '$subject', count: { $sum: 1 }, programs: { $addToSet: '$program' } } }
    ]).sort({ count: -1 }).toArray();
    
    subjects.forEach(s => {
      console.log(`  • ${s._id}: ${s.count.toLocaleString()} soal (${s.programs.join(', ')})`);
    });
    
    // Sample questions to check quality
    console.log('\n🔍 SAMPLE QUESTIONS (check quality):');
    const sampleQuestions = await questionBankCollection.find({}).limit(10).toArray();
    
    sampleQuestions.forEach((q, i) => {
      console.log(`\n[SOAL ${i + 1}] ID: ${q.uniqueId || q._id}`);
      console.log(`Program: ${q.program}`);
      console.log(`Mata Pelajaran: ${q.subject}`);
      console.log(`Topik: ${q.topic || q.topics}`);
      console.log(`Soal: ${q.question?.substring(0, 100)}${q.question?.length > 100 ? '...' : ''}`);
      console.log(`Opsi A: ${q.optionA}`);
      console.log(`Opsi B: ${q.optionB}`);
      console.log(`Kunci: ${q.correctAnswer || q.kunciJawaban}`);
      
      // Check if dummy/meaningless
      const isDummy = 
        q.question?.includes('nomor') && !q.question.includes('dalam') && 
        (!q.optionA?.includes('^') && !q.optionA?.includes('log'));
      
      console.log(`Status: ${isDummy ? '⚠️  MIGHT BE DUMMY' : '✅ Looks real'}`);
    });
    
    // Check for duplicate questions
    console.log('\n🔍 CHECKING FOR DUPLICATES...');
    const duplicates = await questionBankCollection.aggregate([
      { $group: { _id: { question: '$question', subject: '$subject', correctAnswer: '$correctAnswer' }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).toArray();
    
    if (duplicates.length > 0) {
      console.log(`Found ${duplicates.length} duplicate groups:`);
      duplicates.forEach(dup => {
        console.log(`  • Question appears ${dup.count} times: ${dup._id.question.substring(0, 50)}...`);
      });
    } else {
      console.log('No exact duplicates found.');
    }
    
    // Check answer key patterns
    console.log('\n🔍 ANSWER KEY PATTERNS:');
    const answerKeys = await questionBankCollection.aggregate([
      { $group: { _id: '$correctAnswer', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();
    
    answerKeys.forEach(key => {
      const percentage = ((key.count / totalQuestions) * 100).toFixed(2);
      console.log(`  • Key "${key._id}": ${key.count.toLocaleString()} soal (${percentage}%)`);
    });
    
    // Generate audit report
    const fs = require('fs');
    const path = require('path');
    
    const report = {
      auditDate: new Date().toISOString(),
      database: 'bimbel-lms.questionbanks',
      summary: {
        totalQuestions,
        uniqueSubjects: subjects.length,
        uniquePrograms: programs.length,
        duplicateGroups: duplicates.length
      },
      programDistribution: programs,
      subjectDistribution: subjects,
      answerKeyPatterns: answerKeys,
      qualityAssessment: {
        totalReviewed: sampleQuestions.length,
        likelyDummies: sampleQuestions.filter(q => 
          q.question?.includes('nomor') && !q.question.includes('dalam')
        ).length,
        percentageLikelyDummies: ((sampleQuestions.filter(q => 
          q.question?.includes('nomor') && !q.question.includes('dalam')
        ).length / sampleQuestions.length) * 100).toFixed(2) + '%'
      }
    };
    
    const reportPath = path.join(__dirname, '..', '..', '..', 'audit-reports', `audit-existing-${new Date().toISOString().split('T')[0]}.json`);
    const reportDir = path.dirname(reportPath);
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n✅ Audit report saved to: ${reportPath}`);
    
    console.log('\n' + '='.repeat(60));
    console.log('AUDIT COMPLETED!');
    console.log('=' .repeat(60));
    
  } catch (error) {
    console.error('❌ Audit failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.close();
  }
}

auditExistingQuestionBank();
