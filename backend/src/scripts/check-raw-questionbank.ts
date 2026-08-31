import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function checkRawDatabase() {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    
    console.log('\n' + '='.repeat(80));
    console.log('RAW DATABASE CHECK - READ FROM MONGODB DIRECTLY');
    console.log('='.repeat(80) + '\n');
    
    // Check apakah collection ada
    const collections = await mongoose.connection.db.collections();
    console.log(`Collections available in database:`);
    collections.forEach(col => {
      console.log(`  • ${col.collectionName()}`);
    });
    
    // Try count on questionbanks
    const qbCount = await mongoose.connection.collection('questionbanks').countDocuments({});
    console.log(`\nTotal documents in questionbanks: ${qbCount.toLocaleString()}`);
    
    if (qbCount === 0) {
      console.log('\n❌ Database EMPTY! No data found.');
      process.exit(0);
    }
    
    // Get first document WITHOUT any filter
    const firstDoc = await mongoose.connection.collection('questionbanks').find({}).limit(1).toArray();
    
    console.log('\n\nFIRST DOCUMENT STRUCTURE (no filters):\n');
    if (firstDoc.length === 0) {
      console.log('Empty result even without filter!');
      process.exit(0);
    }
    
    const doc = firstDoc[0];
    console.log('All fields:');
    
    for (const [key, value] of Object.entries(doc)) {
      let display = '';
      
      if (key === '_id') {
        display = `[ObjectId: ${value.toString().substring(0, 12)}...]`;
      } else if (typeof value === 'string') {
        const preview = value.substring(0, 60);
        display = `"${preview}${value.length > 60 ? '...' : ''}"`;
        if (value.length > 200) {
          display += `\n    (Total length: ${value.length})`;
        }
      } else if (Array.isArray(value)) {
        display = `[${value.length} items]`;
        value.slice(0, 2).forEach((v, i) => {
          const str = String(v).substring(0, 50);
          display += `\n     ${i}. "${str}${String(v).length > 50 ? '...' : ''}"`;
        });
      } else if (value && typeof value === 'object') {
        const subKeys = Object.keys(value);
        display = `{${subKeys.length} properties}: { ... }`;
      } else {
        display = `${value}`;
      }
      
      console.log(`${String(key).padEnd(25)} = ${display}`);
    }
    
    // Now try to find Bahasa Indonesia with EXACT match
    console.log('\n\n' + '='.repeat(80));
    console.log('SEARCHING BAHASA INDONESIA - EXACT MATCH');
    console.log('='.repeat(80));
    
    const exactMatch = await mongoose.connection.collection('questionbanks').find({
      subject: 'BAHASA INDONESIA'
    }).toArray();
    
    console.log(`\nExact match subject="BAHASA INDONESIA": ${exactMatch.length} docs`);
    
    // Try case insensitive
    const caseInsensitive = await mongoose.connection.collection('questionbanks').find({
      subject: { $regex: 'Bahasa Indonesia', $options: 'i' }
    }).toArray();
    
    console.log(`Case insensitive match: ${caseInsensitive.length} docs`);
    
    // List all unique subjects
    console.log('\n\n' + '='.repeat(80));
    console.log('ALL UNIQUE SUBJECTS IN DATABASE');
    console.log('='.repeat(80));
    
    const subjects = await mongoose.connection.collection('questionbanks').distinct('subject');
    console.log(`\nTotal subjects: ${subjects.length}`);
    
    for (const s of subjects) {
      const count = await mongoose.connection.collection('questionbanks')
        .countDocuments({ subject: s });
      console.log(`  ${s.padEnd(40)} = ${count.toLocaleString()} docs`);
    }
    
    // For Bahasa Indonesia, check ALL possible field patterns
    console.log('\n\n' + '='.repeat(80));
    console.log('CHECK FIELD VARIATIONS FOR BAHASA INDONESIA');
    console.log('='.repeat(80));
    
    const variations = [
      'BAHASA INDONESIA',
      'Bahasa Indonesia',
      'bahasa indonesia',
      'BAHASAINONESIA',
      'Indonesian'
    ];
    
    for (const varName of variations) {
      const docs = await mongoose.connection.collection('questionbanks').find({
        subject: varName
      }).toArray();
      
      console.log(`subject="${varName}": ${docs.length} docs`);
    }
    
    // Check sample documents to see what they actually have
    console.log('\n\nSample dari dokument bahasa (any variation):');
    const samples = await mongoose.connection.collection('questionbanks')
      .find({ subject: { $in: variations } })
      .limit(3)
      .toArray();
    
    for (let i = 0; i < Math.min(samples.length, 3); i++) {
      const doc = samples[i];
      console.log(`\n[${i + 1}] questionId: ${doc.questionId}`);
      console.log(`    Found "subject" field: ${doc.subject !== undefined}`);
      console.log(`    Actual subject value: ${JSON.stringify(doc.subject)}`);
      console.log(`    Has jenjang: ${doc.jenjang !== undefined}, value: ${JSON.stringify(doc.jenjang)}`);
      console.log(`    Has grade: ${doc.grade !== undefined}, value: ${JSON.stringify(doc.grade)}`);
      console.log(`    Has text: ${doc.text !== undefined}, length: ${doc.text?.length || 'undefined'}`);
      console.log(`    Has options: ${doc.options !== undefined}, count: ${doc.options?.length || 0}`);
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkRawDatabase();
