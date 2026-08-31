import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function step6_duplicate_audit() {
  console.log('\n' + '='.repeat(80));
  console.log('STEP 6: DUPLICATE QUESTION ANALYSIS');
  console.log('='.repeat(80) + '\n');
  
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    
    // === EXACT DUPLICATE BASED ON QUESTIONID ===
    console.log('1️⃣  EXACT DUPLICATES BY QUESTIONID:\n');
    
    const totalDocs = await mongoose.connection.collection('questionbanks').countDocuments({});
    const uniqueQIds = await mongoose.connection.collection('questionbanks').distinct('questionId');
    
    console.log(`Total documents: ${totalDocs.toLocaleString()}`);
    console.log(`Unique questionId: ${uniqueQIds.length.toLocaleString()}`);
    console.log(`Duplicates by questionId: ${totalDocs - uniqueQIds.length}`);
    
    if (totalDocs > uniqueQIds.length) {
      console.log('\nDuplicate questionId samples:\n');
      
      const duplicates = await mongoose.connection.collection('questionbanks')
        .aggregate([
          { $group: { _id: '$questionId', count: { $sum: 1 }, docs: { $push: "$$ROOT" } } },
          { $match: { count: { $gt: 1 } } },
          { $limit: 5 }
        ])
        .toArray();
      
      duplicates.forEach((d: any) => {
        console.log(`  ${d._id}: ${d.count} times`);
        
        if (d.docs.length > 1) {
          const diff = JSON.stringify(d.docs[0]) !== JSON.stringify(d.docs[1]);
          console.log(`    → Documents identical: ${diff ? 'NO' : 'YES'}`);
        }
      });
    }
    
    // === NEAR DUPLICATE DETECTION ===
    console.log('\n\n2️⃣  NEAR DUPLICATE ANALYSIS:\n');
    
    // Approach: Group by normalized content and detect repetition
    const nearDupStats = await mongoose.connection.collection('questionbanks').aggregate([
      {
        $addFields: {
          contentHash: {
            $md5: {
              $concat: [
                '$questionText',
                '|',
                { $toString: "$options" },
                '|',
                '$topic'
              ]
            }
          }
        }
      },
      {
        $group: {
          _id: '$contentHash',
          totalCount: { $sum: 1 },
          uniqueText: { $addToSet: '$questionText' },
          sampleQuestions: { $push: { questionId: '$questionId', text: '$questionText', options: '$options' } }
        }
      },
      { $match: { totalCount: { $gt: 1 } } }
    ]).toArray();
    
    console.log(`\nDocuments with exact same normalized content: ${nearDupStats.length}`);
    console.log(`Percentage of total: ${(nearDupStats.length / totalDocs * 100).toFixed(2)}%\n`);
    
    // Show top repetitive patterns
    const topRepetitive = nearDupStats.sort((a, b) => b.totalCount - a.totalCount).slice(0, 10);
    
    console.log('Top 10 most repetitive content patterns:\n');
    
    for (const p of topRepetitive) {
      const sample = p.sampleQuestions[0];
      const txtPreview = sample.text?.substring(0, 80) || '(null)';
      
      console.log(`${p.totalCount}x identical questions:`);
      console.log(`  Sample ID: ${sample.questionId}`);
      console.log(`  Content: "${txtPreview}${sample.text?.length > 80 ? '...' : ''}"`);
      
      // Check if only correctAnswer differs
      if (p.uniqueText.length === 1 && p.totalCount > 1) {
        console.log(`  ⚠️  Exactly the same content repeated ${p.totalCount} times!`);
        
        // Show all variations of questionId
        const qids = p.sampleQuestions.map(s => s.questionId);
        console.log(`  Question IDs: ${qids.join(', ')}`);
      }
      
      console.log('');
    }
    
    // === OPTION REPEATITION ANALYSIS ===
    console.log('\n\n3️⃣  OPTION ARRAY REPEATITION ANALYSIS:\n');
    
    const optionRepeatStats = await mongoose.connection.collection('questionbanks').aggregate([
      {
        $addFields: {
          optionsHash: {
            $md5: { $toString: "$options" }
          }
        }
      },
      {
        $group: {
          _id: '$optionsHash',
          totalCount: { $sum: 1 },
          uniqueTopics: { $addToSet: '$topic' },
          uniquePrograms: { $addToSet: '$program' },
          sampleOptions: { $first: '$options' }
        }
      },
      { $match: { totalCount: { $gt: 1 } } },
      { $sort: { totalCount: -1 } },
      { $limit: 10 }
    ]).toArray();
    
    console.log(`Option arrays used in multiple questions: ${optionRepeatStats.length}\n`);
    
    for (const o of optionRepeatStats.slice(0, 5)) {
      const opts = JSON.stringify(o.sampleOptions).substring(0, 100);
      console.log(`${o.totalCount} questions share SAME options array:`);
      console.log(`  Options: [${opts}${JSON.stringify(o.sampleOptions).length > 100 ? '...' : ''}]`);
      console.log(`  Topics affected: ${new Set(o.uniqueTopics).size}`);
      console.log(`  Programs affected: ${new Set(o.uniquePrograms).size}`);
      console.log('');
    }
    
    // === TOPIC-SPECIFIC DUPLICATE RATE ===
    console.log('\n\n4️⃣  DUPLICATE RATE BY TOPIC:\n');
    
    const topicStats = await mongoose.connection.collection('questionbanks').aggregate([
      {
        $group: {
          _id: '$topic',
          totalCount: { $sum: 1 },
          uniqueContent: { 
            $addToSet: {
              $concat: ['$questionText', '|', { $toString: "$options" }]
            }
          }
        }
      },
      {
        $project: {
          topic: '$_id',
          totalQuestions: '$totalCount',
          uniqueContents: { $size: '$uniqueContent' },
          duplicateRate: {
            $multiply: [
              { $divide: [{ $subtract: ['$totalCount', { $size: '$uniqueContent' }], '$totalCount' }], 1 }
            ]
          }
        }
      },
      { $sort: { duplicateRate: -1 } },
      { $limit: 10 }
    ]).toArray();
    
    topicStats.forEach((t: any) => {
      const ratePct = Math.round(t.duplicateRate * 100);
      const preview = t.topic.substring(0, 60);
      console.log(`${preview}${t.topic.length > 60 ? '...' : ''} | ${t.totalQuestions} questions | ${ratePct}% duplicates`);
    });
    
    // === CONCLUSION ===
    console.log('\n\n' + '='.repeat(80));
    console.log('DUPLICATE ANALYSIS SUMMARY');
    console.log('='.repeat(80) + '\n');
    
    const exactDuplicates = totalDocs - uniqueQIds.length;
    const nearDuplicatePercent = (nearDupStats.length / totalDocs * 100).toFixed(2);
    
    console.log(`Exact duplicates (same questionId): ${exactDuplicates}`);
    console.log(`Near-duplicate content patterns: ${nearDupStats.length} (${nearDuplicatePercent}%)`);
    console.log(`High option repetition detected: ${optionRepeatStats.filter((o: any) => o.totalCount > 5).length} patterns`);
    
    if (nearDuplicatePercent > 10) {
      console.log('\n⚠️  WARNING: Significant near-duplicate content detected!');
      console.log('   This indicates potential data generation or import issues.');
    } else {
      console.log('\n✅ Duplicate rate is within acceptable range.');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

step6_duplicate_audit();
