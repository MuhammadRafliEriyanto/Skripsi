import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function step5_answer_dist() {
  console.log('\n' + '='.repeat(80));
  console.log('STEP 5: CORRECT ANSWER DISTRIBUTION DETAILED');
  console.log('='.repeat(80) + '\n');
  
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    
    const totalDocs = await mongoose.connection.collection('questionbanks').countDocuments({});
    console.log(`Total documents: ${totalDocs.toLocaleString()}\n`);
    
    // === GLOBAL DISTRIBUTION ===
    console.log('1️⃣  GLOBAL DISTRIBUTION:\n');
    
    const globalDist = await mongoose.connection.collection('questionbanks').aggregate([
      {
        $group: {
          _id: '$correctAnswer',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]).toArray();
    
    let totalValidAnswers = 0;
    globalDist.forEach((d: any) => totalValidAnswers += d.count);
    
    globalDist.forEach((d: any) => {
      const pct = ((d.count / totalValidAnswers) * 100).toFixed(2);
      const status = parseFloat(pct) === 25 ? '✓ BALANCED' : (parseFloat(pct) > 35 ? '⚠️ IMBALANCED' : '');
      console.log(`   ${String(d._id || 'NULL').padEnd(10)} = ${d.count.toLocaleString().padStart(8)} (${pct}%)${status ? ' '+status : ''}`);
    });
    
    // === BY PROGRAM ===
    console.log('\n\n2️⃣  DISTRIBUTION BY PROGRAM:\n');
    
    const programs = ['SMP', 'SD', 'SMA', 'UTBK'];
    
    for (const prog of programs) {
      const progDist = await mongoose.connection.collection('questionbanks').aggregate([
        { $match: { program: prog } },
        {
          $group: {
            _id: '$correctAnswer',
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]).toArray();
      
      const progTotal = progDist.reduce((sum: number, d: any) => sum + d.count, 0);
      const progPct = ((progTotal / totalDocs) * 100).toFixed(1);
      
      console.log(`${prog.toUpperCase()} (${progPct}% of total):`);
      
      for (const d of progDist) {
        const pct = ((d.count / progTotal) * 100).toFixed(1);
        
        if (prog === 'SMP' && d._id === 'A' && progTotal > 0) {
          console.log(`   A: ${d.count.toString().padStart(6)} (${pct}%) ← ⚠️ CRITICAL IF NEARLY 100%!`);
        } else {
          console.log(`   ${d._id}: ${d.count.toString().padStart(6)} (${pct}%)`);
        }
      }
      
      // Check if this program has problematic distribution
      const allA = progDist.length === 1 && progDist[0]._id === 'A';
      const aPct = progDist.find(d => d._id === 'A')?.count / progTotal || 0;
      
      if (allA || aPct > 0.95) {
        console.log(`   🚨 ALERT: Nearly 100% answer A!\n`);
      }
      
      console.log('');
    }
    
    // === BY SUBJECT ===
    console.log('\n\n3️⃣  DISTRIBUTION BY SUBJECT:\n');
    
    const subjects = await mongoose.connection.collection('questionbanks')
      .aggregate([
        { $group: { _id: '$subject', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ])
      .toArray();
    
    for (const s of subjects.slice(0, 10)) {
      const subjectDist = await mongoose.connection.collection('questionbanks').aggregate([
        { $match: { subject: s._id } },
        {
          $group: {
            _id: '$correctAnswer',
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]).toArray();
      
      const subjTotal = subjectDist.reduce((sum: number, d: any) => sum + d.count, 0);
      
      console.log(`${s._id} (${subjTotal.toLocaleString()} docs):`);
      
      for (const d of subjectDist) {
        const pct = ((d.count / subjTotal) * 100).toFixed(1);
        console.log(`   ${d._id}: ${d.count.toString().padStart(6)} (${pct}%)`);
      }
      
      const baIndo = s._id.toLowerCase().includes('bahasa indonesia');
      if (baIndo) {
        const allA = subjectDist.length === 1 && subjectDist[0]._id === 'A';
        if (allA) {
          console.log(`   🚨 ALL Bahasa Indonesia subjects have ONLY Answer A!`);
        }
      }
      
      console.log('');
    }
    
    // === SMP BAHASA INDONESIA DETAILED ===
    console.log('=' .repeat(80));
    console.log('4️⃣  SMP BAHASA INDONESIA - DETAILED BREAKDOWN');
    console.log('='.repeat(80) + '\n');
    
    const baTotal = await mongoose.connection.collection('questionbanks').countDocuments({
      program: 'SMP',
      subject: { $regex: /bahasa.*indonesia/i }
    });
    
    console.log(`Total SMP Bahasa Indonesia: ${baTotal.toLocaleString()}\n`);
    
    // Check distribution
    const smpBaDist = await mongoose.connection.collection('questionbanks').aggregate([
      { $match: { program: 'SMP', subject: { $regex: /bahasa.*indonesia/i } } },
      {
        $group: {
          _id: '$correctAnswer',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]).toArray();
    
    console.log('Distribution:');
    for (const d of smpBaDist) {
      const pct = ((d.count / baTotal) * 100).toFixed(2);
      const isAllA = smpBaDist.length === 1 && smpBaDist[0]._id === 'A';
      
      if (d._id === 'A' && isAllA) {
        console.log(`   🚨 A: ${d.count.toLocaleString().padStart(10)} (${pct}%) ← 100%!`);
      } else {
        console.log(`   ${d._id}: ${d.count.toLocaleString().padStart(10)} (${pct}%)`);
      }
    }
    
    // Breakdown by topic
    if (smpBaDist.length === 1 && smpBaDist[0]._id === 'A') {
      console.log('\nBreakdown by Topic (showing all topics have ONLY answer A):\n');
      
      const topics = await mongoose.connection.collection('questionbanks').aggregate([
        { $match: { program: 'SMP', subject: { $regex: /bahasa.*indonesia/i } } },
        {
          $group: {
            _id: '$topic',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 20 }
      ]).toArray();
      
      topics.forEach((t: any) => {
        const preview = t._id.substring(0, 70);
        console.log(`   ${preview}${t._id.length > 70 ? '...' : ''} | ${t.count} soal (ALL A)`);
      });
    }
    
    // Sample questions structure
    console.log('\n\nSample Document Structure:\n');
    
    const samples = await mongoose.connection.collection('questionbanks')
      .find({
        program: 'SMP',
        subject: { $regex: /bahasa.*indonesia/i }
      })
      .project({ questionId: 1, questionText: 1, options: 1, correctAnswer: 1, topic: 1, _id: 0 })
      .limit(5)
      .toArray();
    
    for (let i = 0; i < Math.min(samples.length, 5); i++) {
      const q = samples[i];
      console.log(`[${i + 1}] ${q.questionId}`);
      console.log(`    QuestionText: ${q.questionText?.substring(0, 80) || '(null)'}...`);
      console.log(`    QuestionText Length: ${q.questionText?.length || 0}`);
      console.log(`    Options Count: ${q.options?.length || 0}`);
      console.log(`    Options Unique: ${new Set(q.options?.map(String) || []).size || 0}`);
      console.log(`    Options Value: ${JSON.stringify(q.options)}`);
      console.log(`    CorrectAnswer: ${q.correctAnswer}`);
      console.log(`    Topic: ${q.topic}`);
      console.log('    ' + '-'.repeat(70));
    }
    
    // Option repetition analysis
    console.log('\n\nOption Fingerprint Repetition Analysis:\n');
    
    const fingerprintStats = await mongoose.connection.collection('questionbanks').aggregate([
      { $match: { program: 'SMP', subject: { $regex: /bahasa.*indonesia/i } } },
      {
        $addFields: {
          optionsString: { $toString: "$options" }
        }
      },
      {
        $group: {
          _id: '$optionsString',
          totalCount: { $sum: 1 },
          uniqueTopics: { $addToSet: "$topic" },
          sampleTopics: { $push: "$topic" }
        }
      },
      {
        $project: {
          options: '$_id',
          totalCount: 1,
          uniqueTopicsCount: { $size: '$uniqueTopics' },
          sampleTopics: { $slice: ['$sampleTopics', 3] }
        }
      },
      { $sort: { totalCount: -1 } },
      { $limit: 5 }
    ]).toArray();
    
    fingerprintStats.forEach((f: any, idx: number) => {
      const opts = f.options.replace(/"/g, '').split(',').slice(0, 2).join('...');
      console.log(`[${idx + 1}] Options: [${opts}...]`);
      console.log(`    Used in ${f.totalCount} questions across ${f.uniqueTopicsCount} different topics!`);
      console.log(`    Topics with these options: ${JSON.stringify(f.sampleTopics)}`);
      console.log('');
    });
    
    // === CONCLUSION SUMMARY ===
    console.log('\n\n' + '='.repeat(80));
    console.log('CONCLUSION SUMMARY');
    console.log('='.repeat(80) + '\n');
    
    const isGlobalProblem = globalDist.length === 1 && globalDist[0]._id === 'A';
    const isSMPSpecific = smpBaDist.length === 1 && smpBaDist[0]._id === 'A';
    
    console.log(`Global Issue (all data): ${isGlobalProblem ? 'YES ❌' : 'NO ✅'}`);
    console.log(`SMP-specific issue: ${isSMPSpecific ? 'YES ❌' : 'Unknown'}`);
    console.log(`SMP Bahasa Indonesia: ${smpBaDist.length === 1 && smpBaDist[0]._id === 'A' ? '❌ 100% Answer A' : '✅ Normal'}`);
    
    if (isSMPSpecific || (smpBaDist.length === 1 && smpBaDist[0]._id === 'A')) {
      console.log('\n🚨 ROOT CAUSE HYPOTHESIS:');
      console.log('   Problem is LOCALIZED to specific subject/program.');
      console.log('   Likely causes:');
      console.log('   1. Generator hardcoded correctAnswer = "A"');
      console.log('   2. Import process didn\'t map answer field correctly');
      console.log('   3. Excel source file had only column A filled');
    }
    
    console.log('\n⏸️  Read-only audit complete.\n');
    
    process.exit(0);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

step5_answer_dist();
