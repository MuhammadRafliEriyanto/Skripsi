import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function fullAudit() {
  console.log('\n' + '='.repeat(80));
  console.log('STEP 2-8: COMPREHENSIVE QUESTIONBANK AUDIT');
  console.log('='.repeat(80) + '\n');
  
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    
    // === STEP 2: INVENTORY SELURUH QUESTIONBANK ===
    console.log('=' .repeat(80));
    console.log('STEP 2: FULL INVENTORY');
    console.log('='.repeat(80));
    
    const totalDocs = await mongoose.connection.collection('questionbanks').countDocuments({});
    console.log(`\nTotal documents: ${totalDocs.toLocaleString()}`);
    
    // Unique questionId
    const uniqueQIds = await mongoose.connection.collection('questionbanks')
      .distinct('questionId');
    console.log(`Unique questionId: ${uniqueQIds.length.toLocaleString()}`);
    
    // Check duplicates
    const duplicateCount = totalDocs - uniqueQIds.length;
    console.log(`Duplicate questionId: ${duplicateCount}`);
    
    if (duplicateCount > 0) {
      console.log('\nDuplicates found! Sample:');
      const duplicateGroups = await mongoose.connection.collection('questionbanks')
        .aggregate([
          { $group: { _id: '$questionId', count: { $sum: 1 }, docs: { $push: "$$ROOT" } } },
          { $match: { count: { $gt: 1 } } },
          { $limit: 5 }
        ])
        .toArray();
      
      duplicateGroups.forEach((g: any) => {
        console.log(`  ${g._id}: ${g.count} times`);
      });
    }
    
    // Inventory by program
    console.log('\n--- BY PROGRAM ---');
    const programs = await mongoose.connection.collection('questionbanks').distinct('program');
    
    for (const prog of programs) {
      const count = await mongoose.connection.collection('questionbanks')
        .countDocuments({ program: prog });
      const percentage = ((count / totalDocs) * 100).toFixed(2);
      console.log(`  ${prog.padEnd(10)} = ${count.toLocaleString().padStart(7)} (${percentage}%)`);
    }
    
    // Inventory by subject
    console.log('\n--- BY SUBJECT ---');
    const subjects = await mongoose.connection.collection('questionbanks')
      .aggregate([
        { $group: { _id: '$subject', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 }
      ])
      .toArray();
    
    subjects.forEach((s: any) => {
      console.log(`  ${String(s._id || '(null)').padEnd(30)} = ${s.count.toLocaleString().padStart(7)}`);
    });
    
    // Nested breakdown: program → subject
    console.log('\n--- NESTED BREAKDOWN (PROGRAM → SUBJECT) ---');
    
    for (const prog of programs.slice(0, 4)) { // Top 4 programs
      const progSubjects = await mongoose.connection.collection('questionbanks')
        .aggregate([
          { $match: { program: prog } },
          { $group: { _id: '$subject', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ])
        .toArray();
      
      console.log(`\n${prog.toUpperCase()}:`);
      progSubjects.forEach((s: any) => {
        const subPct = ((s.count / subjects.reduce((acc: number, x: any) => acc + (x._id === s._id ? 0 : 1), 0)) * 100).toFixed(1);
        console.log(`  ${String(s._id || '').padEnd(25)} = ${s.count.toLocaleString()}`);
      });
    }
    
    // === STEP 3: AUDIT QUESTION TEXT ===
    console.log('\n\n' + '='.repeat(80));
    console.log('STEP 3: QUESTION TEXT QUALITY AUDIT');
    console.log('='.repeat(80));
    
    // Quality metrics
    const emptyOrWhitespace = await mongoose.connection.collection('questionbanks').countDocuments({
      questionText: { 
        $in: ['', null, undefined] 
      }
    });
    
    const shortText = await mongoose.connection.collection('questionbanks').countDocuments({
      questionText: { 
        $exists: true, 
        $ne: '', 
        $nin: [null],
        length: { $lt: 50 }
      }
    });
    
    const normalText = await mongoose.connection.collection('questionbanks').countDocuments({
      questionText: { 
        $exists: true, 
        $ne: '', 
        $nin: [null],
        length: { $gte: 50 }
      }
    });
    
    console.log('\nQuestion Text Statistics:');
    console.log(`  Total:              ${totalDocs.toLocaleString()}`);
    console.log(`  Empty/Null:         ${emptyOrWhitespace.toLocaleString()} ((${(emptyOrWhitespace/totalDocs*100).toFixed(2)}%)`);
    console.log(`  Short (<50 chars):  ${shortText.toLocaleString()} ((${(shortText/totalDocs*100).toFixed(2)}%)`);
    console.log(`  Normal (>50 chars): ${normalText.toLocaleString()} ((${(normalText/totalDocs*100).toFixed(2)}%)`);
    
    // Sample by category
    console.log('\n--- SAMPLE CONTENT BY CATEGORY ---');
    
    const categories = ['SMP', 'SD', 'UTBK'];
    const sampleFields = { questionText: 1, program: 1, subject: 1, topic: 1 };
    
    for (const cat of categories) {
      const samples = await mongoose.connection.collection('questionbanks')
        .find({ program: cat })
        .project(sampleFields)
        .limit(2)
        .toArray();
      
      console.log(`\n${cat}:`);
      for (const s of samples) {
        const txt = s.questionText?.substring(0, 100) || '(null)';
        console.log(`  "${txt}${s.questionText.length > 100 ? '...' : ''}"`);
        console.log(`     Subject: ${s.subject}, Topic: ${s.topic.substring(0, 50)}...`);
      }
    }
    
    // === STEP 4: AUDIT OPTIONS ===
    console.log('\n\n' + '='.repeat(80));
    console.log('STEP 4: OPTIONS QUALITY AUDIT');
    console.log('='.repeat(80));
    
    // Check options structure
    const withOptionsArray = await mongoose.connection.collection('questionbanks').countDocuments({
      options: { $exists: true, $type: 'array', $ne: [] }
    });
    
    const withoutOptions = totalDocs - withOptionsArray;
    
    console.log(`\nOptions Structure:`);
    console.log(`  With valid array: ${withOptionsArray.toLocaleString()}`);
    console.log(`  Without options:  ${withoutOptions.toLocaleString()}`);
    
    // Check option counts
    const optionStats = await mongoose.connection.collection('questionbanks').aggregate([
      { $project: { optCount: { $size: "$options" } } },
      {
        $group: {
          _id: '$optCount',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]).toArray();
    
    console.log('\nOption Count Distribution:');
    optionStats.forEach((s: any) => {
      console.log(`  ${s._id} options: ${s.count.toLocaleString()}`);
    });
    
    // Check for empty options within arrays
    const hasEmptyOption = await mongoose.connection.collection('questionbanks').countDocuments({
      options: { $elemMatch: { $in: ['', null, undefined] } }
    });
    
    console.log(`\nOptions containing empty/null: ${hasEmptyOption.toLocaleString()}`);
    
    // Check duplicates within same document
    const hasDuplicateInOneDoc = await mongoose.connection.collection('questionbanks').countDocuments({
      options: { $elemMatch: { $not: { $eq: "DUMMY_PLACEHOLDER" } } } // Simplified check
    });
    
    // Fingerprint analysis - group by options to detect repetition
    console.log('\n--- OPTION REPETITION ANALYSIS ---');
    
    const topicSample = await mongoose.connection.collection('questionbanks')
      .find({
        program: 'SMP',
        subject: { $regex: /bahasa.*indonesia/i }
      })
      .project({ topic: 1, options: 1, correctAnswer: 1, _id: 0 })
      .limit(5)
      .toArray();
    
    console.log('\nSample SMP Bahasa Indonesia options:');
    topicSample.forEach((t, idx) => {
      const optsStr = JSON.stringify(t.options);
      const uniqueOpts = new Set(t.options.map(String)).size;
      console.log(`${idx + 1}. Options: ${JSON.stringify(t.options.slice(0, 2))}...`);
      console.log(`   Unique: ${uniqueOpts}/4, Correct: ${t.correctAnswer}`);
    });
    
    // Calculate option fingerprint repetition across topics
    console.log('\n\nOPTION FINGERPRINT ANALYSIS (by topic):');
    
    const fingerprintAnalysis = await mongoose.connection.collection('questionbanks').aggregate([
      {
        $match: {
          program: 'SMP',
          subject: { $regex: /bahasa.*indonesia/i }
        }
      },
      {
        $group: {
          _id: '$topic',
          totalCount: { $sum: 1 },
          uniqueFingerprints: { 
            $addToSet: { $toString: "$options" }
          }
        }
      },
      {
        $project: {
          topic: '$_id',
          totalQuestions: '$totalCount',
          uniqueSets: { $size: '$uniqueFingerprints' },
          repetitionRate: { 
            $multiply: [
              { $divide: [{ $subtract: ['$totalCount', { $size: '$uniqueFingerprints' }], '$totalCount' }], 1 }
            ]
          }
        }
      },
      { $sort: { repetitionRate: -1 } },
      { $limit: 10 }
    ]).toArray();
    
    console.log('\nTopic-level option repetition (Top 10 most repetitive):');
    fingerprintAnalysis.forEach((f: any) => {
      const rate = Math.round(f.repetitionRate * 100);
      console.log(`  ${f.topic.substring(0, 60).padEnd(60)} | ${f.totalQuestions.toString().padStart(3)} questions | ${f.uniqueSets.toString().padStart(2)} unique sets | ${rate}% repeat`);
    });
    
    // Global fingerprint stats
    console.log('\n\nGLOBAL OPTION FINGERPRINT STATS:');
    
    const globalFingerprints = await mongoose.connection.collection('questionbanks').aggregate([
      {
        $group: {
          _id: { $toString: "$options" },
          count: { $sum: 1 },
          topics: { $addToSet: "$topic" },
          programs: { $addToSet: "$program" }
        }
      },
      { $match: { count: { $gt: 1 } } }
    ]).toArray();
    
    const mostCommon = globalFingerprints.sort((a, b) => b.count - a.count).slice(0, 5);
    
    console.log('\n5 Most common option fingerprints (across ALL data):');
    mostCommon.forEach((fp: any, idx: number) => {
      const sampleOptions = fp._id.replace(/"/g, '').split(',').slice(0, 3).join('...');
      console.log(`${idx + 1}. Options: [${sampleOptions}]...`);
      console.log(`   Used in ${fp.count.toLocaleString()} docs, Topics: ${new Set(fp.topics).size}, Programs: ${new Set(fp.programs).size}`);
    });
    
    // === STEP 5: CORRECT ANSWER DISTRIBUTION ===
    console.log('\n\n' + '='.repeat(80));
    console.log('STEP 5: CORRECT ANSWER DISTRIBUTION');
    console.log('='.repeat(80));
    
    // Global distribution
    console.log('\nGLOBAL DISTRIBUTION:');
    
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
      const status = parseFloat(pct) === 25 ? '✓' : (parseFloat(pct) > 35 ? '⚠️' : '');
      console.log(`  ${String(d._id || 'NULL').padEnd(10)} = ${d.count.toLocaleString().padStart(8)} (${pct}%)${status ? ' '+status : ''}`);
    });
    
    // Distribution by program
    console.log('\n--- BY PROGRAM ---');
    
    for (const prog of programs.slice(0, 4)) {
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
      
      console.log(`\n${prog}:`);
      progDist.forEach((d: any) => {
        const pct = ((d.count / progTotal) * 100).toFixed(2);
        const avgPct = (100 / progDist.length).toFixed(0);
        const diff = Math.abs(parseFloat(pct) - parseFloat(avgPct));
        const status = diff < 10 ? '✓' : '⚠️';
        
        if (prog === 'SMP' && d._id === 'A' && progTotal > 0 && (d.count/progTotal) > 0.9) {
          console.log(`    A: ${d.count.toLocaleString()} (${pct}%) ${status} ← CHECK THIS!`);
        } else {
          console.log(`    ${d._id}: ${d.count.toLocaleString()} (${pct}%) ${status}`);
        }
      });
    }
    
    // Distribution by subject
    console.log('\n--- BY SUBJECT (Bahasa Indonesia focused) ---');
    
    const baIndoDist = await mongoose.connection.collection('questionbanks').aggregate([
      { $match: { subject: { $regex: /bahasa.*indonesia/i } } },
      {
        $group: {
          _id: '$correctAnswer',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]).toArray();
    
    const baTotal = baIndoDist.reduce((sum: number, d: any) => sum + d.count, 0);
    
    console.log(`Total Bahasa Indonesia: ${baTotal.toLocaleString()}`);
    console.log('\nDistribution:');
    baIndoDist.forEach((d: any) => {
      const pct = ((d.count / baTotal) * 100).toFixed(2);
      console.log(`  ${d._id}: ${d.count.toLocaleString().padStart(8)} (${pct}%) ${parseFloat(pct) === 100 ? '⚠️ 100%!' : ''}`);
    });
    
    // If all A, show by topic
    const isAllA = baIndoDist.length === 1 && baIndoDist[0]._id === 'A';
    
    if (isAllA) {
      console.log('\n⚠️  CRITICAL: ALL answers are A!\nBreakdown by topic:');
      
      const topicDist = await mongoose.connection.collection('questionbanks').aggregate([
        { $match: { subject: { $regex: /bahasa.*indonesia/i } } },
        {
          $group: {
            _id: '$topic',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]).toArray();
      
      topicDist.forEach((t: any) => {
        console.log(`  ${t._id.substring(0, 60)} | All ${t.count} answers are A`);
      });
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fullAudit();
