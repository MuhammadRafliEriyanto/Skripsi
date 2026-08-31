import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function step1_actual_structure() {
  console.log('\n' + '='.repeat(80));
  console.log('STEP 1: KONFIRMASI STRUKTUR AKTUAL DARI MONGODB');
  console.log('='.repeat(80) + '\n');
  
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    
    // Sample dokumen pertama tanpa filter apapun
    const sampleDocs = await mongoose.connection.collection('questionbanks')
      .find({})
      .project({ _id: 0 })
      .limit(10)
      .toArray();
    
    console.log('SAMPLE DOKUMEN #1-3 (STRUKTUR LENGKAP):\n');
    console.log('-'.repeat(80));
    
    for (let i = 0; i < Math.min(sampleDocs.length, 3); i++) {
      const doc = sampleDocs[i];
      
      console.log(`\n[DOKUMEN ${i + 1}]`);
      console.log(`Total fields: ${Object.keys(doc).length}\n`);
      
      // Tampilkan SEMUA field
      const keys = Object.keys(doc).sort();
      keys.forEach(key => {
        const value = doc[key];
        
        if (typeof value === 'string') {
          if (value.length > 100) {
            console.log(`  ${key.padEnd(25)} = "${value.substring(0, 100)}..." [${value.length} chars]`);
          } else {
            console.log(`  ${key.padEnd(25)} = "${value}"`);
          }
        } else if (Array.isArray(value)) {
          console.log(`  ${key.padEnd(25)} = [${value.length} items]: ${JSON.stringify(value.slice(0, 3))}`);
        } else if (typeof value === 'object' && value !== null) {
          console.log(`  ${key.padEnd(25)} = ${value}`);
        } else {
          console.log(`  ${key.padEnd(25)} = ${value}`);
        }
      });
    }
    
    // Check field availability across all documents
    console.log('\n\n' + '='.repeat(80));
    console.log('FIELD AVAILABILITY ANALYSIS');
    console.log('='.repeat(80) + '\n');
    
    const totalDocs = await mongoose.connection.collection('questionbanks').countDocuments({});
    console.log(`Total dokumen: ${totalDocs.toLocaleString()}\n`);
    
    const fieldsToCheck = [
      'questionId', 'program', 'class', 'grade', 'jenjang',
      'subject', 'mapel',
      'topic', 'materi',
      'questionText', 'text', 'prompt', 'content',
      'optionA', 'optionB', 'optionC', 'optionD',
      'options',
      'correctAnswer', 'answerKey', 'key',
      'difficulty',
      'source', 'batchId',
      'createdAt', 'updatedAt'
    ];
    
    const fieldStats: Record<string, any> = {};
    
    for (const field of fieldsToCheck) {
      const withField = await mongoose.connection.collection('questionbanks').countDocuments({
        [field]: { $exists: true, $ne: null }
      });
      
      const percentage = ((withField / totalDocs) * 100).toFixed(2);
      
      fieldStats[field] = {
        count: withField,
        percentage: percentage,
        present: withField > 0
      };
      
      const status = withField > 0 ? '✅' : '❌';
      console.log(`${status} ${field.padEnd(25)} = ${withField.toLocaleString()} (${percentage}%)`);
    }
    
    // Get distinct values for available fields
    console.log('\n\n' + '='.repeat(80));
    console.log('DISTINCT VALUES FOR AVAILABLE FIELDS');
    console.log('='.repeat(80) + '\n');
    
    // Program (if exists)
    if (fieldStats['program'].present) {
      const programs = await mongoose.connection.collection('questionbanks').distinct('program');
      console.log('program values:');
      for (const p of programs) {
        const count = await mongoose.connection.collection('questionbanks')
          .countDocuments({ program: p });
        console.log(`  ${p.padEnd(15)} = ${count.toLocaleString()}`);
      }
    }
    
    // Class/Grade/Jenjang (check which one exists)
    let classField = '';
    if (fieldStats['class'].present) classField = 'class';
    else if (fieldStats['grade'].present) classField = 'grade';
    else if (fieldStats['jenjang'].present) classField = 'jenjang';
    
    if (classField) {
      const classes = await mongoose.connection.collection('questionbanks').distinct(classField);
      console.log(`\n${classField} values:`);
      for (const c of classes) {
        const count = await mongoose.connection.collection('questionbanks')
          .countDocuments({ [classField]: c });
        console.log(`  ${String(c).padEnd(15)} = ${count.toLocaleString()}`);
      }
    }
    
    // Subject
    if (fieldStats['subject'].present) {
      const subjects = await mongoose.connection.collection('questionbanks')
        .aggregate([
          { $match: { subject: { $exists: true, $ne: null } } },
          { $group: { _id: '$subject', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 20 }
        ])
        .toArray();
      
      console.log('\nsubject values (top 20):');
      subjects.forEach((s: any) => {
        console.log(`  ${String(s._id || '(null)').padEnd(30)} = ${s.count.toLocaleString()}`);
      });
    }
    
    // Topic
    if (fieldStats['topic'].present) {
      const topics = await mongoose.connection.collection('questionbanks')
        .aggregate([
          { $match: { topic: { $exists: true, $ne: null } } },
          { $group: { _id: '$topic', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 20 }
        ])
        .toArray();
      
      console.log('\ntopic values (top 20):');
      topics.forEach((t: any) => {
        const preview = String(t._id || '').substring(0, 60);
        console.log(`  ${preview}${String(t._id).length > 60 ? '...' : ''} | ${t.count}`);
      });
    }
    
    // Question text field check
    let questionTextField = '';
    if (fieldStats['questionText'].present) questionTextField = 'questionText';
    else if (fieldStats['text'].present) questionTextField = 'text';
    else if (fieldStats['prompt'].present) questionTextField = 'prompt';
    else if (fieldStats['content'].present) questionTextField = 'content';
    
    if (questionTextField) {
      console.log(`\n🎯 QUESTION TEXT FIELD: ${questionTextField}`);
      
      const emptyQuestion = await mongoose.connection.collection('questionbanks').countDocuments({
        [questionTextField]: { 
          $in: ['', null, undefined, { $type: 'null' }] 
        }
      });
      
      const nonEmpty = totalDocs - emptyQuestion;
      console.log(`  Total: ${totalDocs.toLocaleString()}`);
      console.log(`  Empty/Null: ${emptyQuestion.toLocaleString()} (${(emptyQuestion/totalDocs*100).toFixed(1)}%)`);
      console.log(`  Non-empty: ${nonEmpty.toLocaleString()} (${(nonEmpty/totalDocs*100).toFixed(1)}%)`);
      
      // Sample dengan question text
      const sampleWithText = await mongoose.connection.collection('questionbanks')
        .find({ [questionTextField]: { $exists: true, $ne: '', $nin: [null] } })
        .project({ [questionTextField]: 1, _id: 0 })
        .limit(3)
        .toArray();
      
      console.log(`\n  Sample content (first 80 chars):`);
      sampleWithText.forEach((d: any, idx: number) => {
        const txt = d[questionTextField]?.substring(0, 80) || '(error reading)';
        console.log(`    ${idx + 1}. "${txt}${d[questionTextField].length > 80 ? '...' : ''}"`);
      });
    }
    
    // Options field check
    let optionsFormat = '';
    if (fieldStats['options'].present) {
      optionsFormat = 'array';
    } else if (
      fieldStats['optionA'].present && 
      fieldStats['optionB'].present &&
      fieldStats['optionC'].present &&
      fieldStats['optionD'].present
    ) {
      optionsFormat = 'separate fields';
    }
    
    if (optionsFormat) {
      console.log(`\n🎯 OPTIONS FORMAT: ${optionsFormat}`);
      
      if (optionsFormat === 'array') {
        // Check array format
        const withArray = await mongoose.connection.collection('questionbanks').countDocuments({
          options: { $exists: true, $type: 'array', $gt: [] }
        });
        
        console.log(`  With options array: ${withArray.toLocaleString()}`);
        console.log(`  Without options array: ${(totalDocs - withArray).toLocaleString()}`);
        
        // Sample options array
        const sampleOpts = await mongoose.connection.collection('questionbanks')
          .find({ options: { $exists: true, $type: 'array' } })
          .project({ options: 1, correctAnswer: 1, _id: 0 })
          .limit(3)
          .toArray();
        
        console.log('\n  Sample options array:');
        sampleOpts.forEach((d: any, idx: number) => {
          console.log(`    ${idx + 1}. ${JSON.stringify(d.options)}`);
          console.log(`       Correct: ${d.correctAnswer}`);
        });
      } else {
        // Separate fields
        const withSeparateFields = await mongoose.connection.collection('questionbanks').countDocuments({
          optionA: { $exists: true, $ne: null },
          optionB: { $exists: true, $ne: null },
          optionC: { $exists: true, $ne: null },
          optionD: { $exists: true, $ne: null }
        });
        
        console.log(`  With all 4 separate fields: ${withSeparateFields.toLocaleString()}`);
        console.log(`  Incomplete: ${(totalDocs - withSeparateFields).toLocaleString()}`);
        
        // Sample separate fields
        const sampleOpts = await mongoose.connection.collection('questionbanks')
          .find({ optionA: { $exists: true, $ne: null } })
          .project({ optionA: 1, optionB: 1, optionC: 1, optionD: 1, correctAnswer: 1, _id: 0 })
          .limit(3)
          .toArray();
        
        console.log('\n  Sample separate fields:');
        sampleOpts.forEach((d: any, idx: number) => {
          const opts = [d.optionA, d.optionB, d.optionC, d.optionD];
          console.log(`    ${idx + 1}. A: "${opts[0]?.substring(0, 40)}...", B: "${opts[1]?.substring(0, 40)}..."`);
          console.log(`       C: "${opts[2]?.substring(0, 40)}...", D: "${opts[3]?.substring(0, 40)}..."`);
          console.log(`       Correct: ${d.correctAnswer}`);
        });
      }
    }
    
    // Answer key distribution
    if (fieldStats['correctAnswer'].present) {
      console.log('\n\n' + '='.repeat(80));
      console.log('CORRECT ANSWER DISTRIBUTION (GLOBAL)');
      console.log('='.repeat(80) + '\n');
      
      const dist = await mongoose.connection.collection('questionbanks').aggregate([
        { $match: { correctAnswer: { $exists: true, $ne: null } } },
        { $group: { _id: '$correctAnswer', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]).toArray();
      
      let totalValid = 0;
      dist.forEach((d: any) => totalValid += d.count);
      
      dist.forEach((d: any) => {
        const pct = ((d.count / totalValid) * 100).toFixed(2);
        const status = parseFloat(pct) === 25 ? '✓ BALANCED' : (parseFloat(pct) > 35 ? '⚠️ IMBALANCED' : '');
        console.log(`  ${String(d._id || 'null').padEnd(10)} = ${d.count.toLocaleString().padStart(8)} (${pct}%)${status ? ' '+status : ''}`);
      });
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

step1_actual_structure();
