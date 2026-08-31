import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function exploreQuestionBankStructure() {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    
    console.log('\n' + '='.repeat(80));
    console.log('EXPLORASI STRUKTUR QUESTIONBANK');
    console.log('='.repeat(80) + '\n');
    
    // Sample questions dari berbagai jenjang
    const sampleQuestions = await mongoose.connection.collection('questionbanks').find({}).limit(10).toArray();
    
    console.log('📊 SAMPLE 10 QUESTIONS DARI BERBAGAI JENJANG:\n');
    console.log('-'.repeat(80));
    
    for (const q of sampleQuestions) {
      console.log(`\n┌─ ${q.questionId} ────────────────────────────────────────`);
      console.log(`│ Jenjang : ${q.jenjang || 'N/A'}`);
      console.log(`│ Grade   : ${q.grade || 'N/A'}`);
      console.log(`│ Program : ${q.program || 'N/A'}`);
      console.log(`│ Class   : ${q.className || 'N/A'}`);
      console.log(`│ Subject : ${q.subject || 'N/A'}`);
      console.log(`│ Topic   : ${q.topic || 'N/A'}`);
      console.log(`│ Variant : ${q.variant || 'N/A'}`);
      console.log(`│ Text    : ${(q.text || '').substring(0, 80)}...`);
      console.log(`│ Options : [${Array.isArray(q.options) ? q.options.join(', ') : 'N/A'}]`);
      console.log(`│ Correct : ${String(q.correctAnswer || 'N/A').toUpperCase()}`);
      console.log('└───────────────────────────────────────────────────────────────────────────');
    }
    
    // Statistics
    const stats = await mongoose.connection.collection('questionbanks').aggregate([
      {
        $group: {
          _id: {
            jenjang: '$jenjang',
            grade: '$grade',
            subject: '$subject',
            topic: { $substr: ['$topic', 0, 30] }
          },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          jenjang: '$_id.jenjang',
          grade: '$_id.grade',
          subject: '$_id.subject',
          topic: '$_id.topic',
          count: 1
        }
      },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]).toArray();
    
    console.log('\n\n' + '='.repeat(80));
    console.log('DISTRIBUSI SOAL PER JENJANG/MAPEL TOPIK:\n');
    console.log('-'.repeat(80));
    
    for (const stat of stats) {
      console.log(`${stat.jenjang?.padEnd(4)} | ${stat.grade?.padEnd(3)} | ${stat.subject?.padEnd(20)} | ${stat.topic.padEnd(30)} | ${stat.count.toString().padStart(4)} soal`);
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

exploreQuestionBankStructure();
