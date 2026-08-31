import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function simpleCheck() {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    
    console.log('\n' + '='.repeat(80));
    console.log('FORENSIC CHECK - SIMPLE DIRECT MONGODB QUERY');
    console.log('='.repeat(80) + '\n');
    
    // 1. Get ALL subjects with counts
    console.log('1️⃣  ALL SUBJECTS IN DATABASE:\n');
    
    const subjectPipeline = [
      { $group: { _id: '$subject', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ];
    
    const subjectsWithCounts = await mongoose.connection.collection('questionbanks').aggregate(subjectPipeline).toArray();
    
    subjectsWithCounts.forEach((item: any) => {
      console.log(`   ${String(item._id || '(null)').padEnd(35)} = ${item.count.toLocaleString()}`);
    });
    
    // 2. Sample document from database
    console.log('\n\n2️⃣  SAMPLE DOCUMENT STRUCTURE (FIRST DOC):\n');
    
    const firstDoc = await mongoose.connection.collection('questionbanks')
      .find({})
      .project({ _id: 0 })
      .limit(1)
      .toArray();
    
    if (firstDoc.length === 0) {
      console.log('Database is empty!');
      process.exit(0);
    }
    
    const doc = firstDoc[0];
    const keys = Object.keys(doc);
    
    console.log(`Total fields in this document: ${keys.length}\n`);
    
    for (const key of keys) {
      const val = doc[key];
      
      if (key === '_id') continue;
      
      if (typeof val === 'string') {
        const preview = val.substring(0, 80);
        console.log(`${key.padEnd(25)} = "${preview}${val.length > 80 ? '...' : ''}"`);
        if (val.length > 200) {
          console.log(`                          (total length: ${val.length} chars)`);
        }
      } else if (Array.isArray(val)) {
        console.log(`${key.padEnd(25)} = [${val.length} items]`);
        val.slice(0, 3).forEach((v, i) => {
          const str = String(v).substring(0, 70);
          console.log(`                          ${i}. "${str}${String(v).length > 70 ? '...' : ''}"`);
        });
      } else if (typeof val === 'object' && val !== null) {
        const objKeys = Object.keys(val);
        console.log(`${key.padEnd(25)} = {${objKeys.length} properties}: ${JSON.stringify(val)}`);
      } else {
        console.log(`${key.padEnd(25)} = ${val}`);
      }
    }
    
    // 3. Find BAHASA INDONESIA documents - case variations
    console.log('\n\n3️⃣  BAHASA INDONESIA SEARCH (ALL CASES):\n');
    
    const cases = [
      { name: 'exact "BAHASA INDONESIA"', query: { subject: 'BAHASA INDONESIA' } },
      { name: 'case-insensitive regex', query: { subject: { $regex: /bahasa.*indonesia/i } } },
      { name: 'like pattern', query: { subject: { $regex: '^Bahasa Indonesia$' } } }
    ];
    
    for (const c of cases) {
      const found = await mongoose.connection.collection('questionbanks')
        .find(c.query)
        .toArray();
      
      console.log(`   ${c.name.padEnd(35)} = ${found.length}`);
    }
    
    // 4. For Bahasa Indonesia samples, show detailed structure
    console.log('\n\n4️⃣  BAHASA INDONESIA DOCUMENT SAMPLES:\n');
    
    const baQuestions = await mongoose.connection.collection('questionbanks')
      .find({ subject: { $regex: /bahasa.*indonesia/i } })
      .project({ 
        _id: 0,
        questionId: 1,
        text: 1,
        questionText: 1,
        prompt: 1,
        content: 1,
        options: 1,
        correctAnswer: 1,
        subject: 1,
        jenjang: 1,
        grade: 1,
        topic: 1,
        source: 1,
        createdAt: 1,
        updatedAt: 1,
        class_name: 1,
        program: 1
      })
      .limit(10)
      .toArray();
    
    console.log(`Found ${baQuestions.length} Bahasa Indonesia questions\n`);
    
    if (baQuestions.length === 0) {
      console.log('No Bahasa Indonesia found with current search.');
      process.exit(0);
    }
    
    for (let i = 0; i < Math.min(baQuestions.length, 5); i++) {
      const q = baQuestions[i];
      
      console.log(`[${i + 1}] ${q.questionId}`);
      console.log('    ├─ TEXT FIELDS:');
      console.log(`    │    text         : ${q.text ? `"${q.text.substring(0, 60)}${q.text?.length! > 60 ? '...' : ''}" (${q.text?.length || 0})` : '(null/undefined)'}`);
      console.log(`    │    questionText : ${q.questionText ? `"${q.questionText.substring(0, 60)}${q.questionText?.length! > 60 ? '...' : ''}"` : '(null/undefined)'}`);
      console.log(`    │    prompt       : ${q.prompt ? `"${q.prompt.substring(0, 60)}${q.prompt?.length! > 60 ? '...' : ''}"` : '(null/undefined)'}`);
      console.log(`    │    content      : ${q.content ? `"${q.content.substring(0, 60)}${q.content?.length! > 60 ? '...' : ''}"` : '(null/undefined)'}`);
      console.log('    ├─ ANSWER FIELD:');
      console.log(`    │    correctAnswer: ${q.correctAnswer !== undefined ? String(q.correctAnswer) : '(null/undefined)'}`);
      console.log(`    │    answerKey    : ${q.answerKey !== undefined ? String(q.answerKey) : '(null/undefined)'}`);
      console.log('    ├─ OPTIONS:');
      console.log(`    │    options[]     : [${q.options?.length || 0} items]`);
      if (q.options && q.options.length > 0) {
        console.log(`    │                 : ${JSON.stringify(q.options.slice(0, 2))}${q.options.length > 2 ? '...' : ''}`);
        console.log(`    │                 : UNIQUE OPTIONS: ${new Set(q.options.map(String)).size}`);
      }
      console.log('    ├─ METADATA:');
      console.log(`    │    subject      : ${q.subject || '(null)'}`);
      console.log(`    │    jenjang      : ${q.jenjang || '(null)'}`);
      console.log(`    │    grade        : ${q.grade !== undefined ? String(q.grade) : '(null)'}`);
      console.log(`    │    topic        : ${q.topic || '(null)'}`);
      console.log(`    │    class_name   : ${q.class_name || '(null)'}`);
      console.log(`    │    program      : ${q.program || '(null)'}`);
      console.log(`    │    source       : ${q.source || '(null)'}`);
      console.log('    ' + '-'.repeat(70));
    }
    
    // 5. Detailed breakdown by jenjang/grade/topic combinations
    console.log('\n\n5️⃣  BREAKDOWN BY JENJANG/GRADE FOR BAHASA INDONESIA:\n');
    
    const jenjangBreakdown = await mongoose.connection.collection('questionbanks').aggregate([
      { $match: { subject: { $regex: /bahasa.*indonesia/i } } },
      {
        $group: {
          _id: {
            jenjang: '$jenjang',
            grade: '$grade',
            class_name: '$class_name',
            program: '$program'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]).toArray();
    
    jenjangBreakdown.forEach((b: any) => {
      console.log(`   Jenjang: ${String(b._id.jenjang || 'null').padEnd(10)} | `);
      console.log(`           Grade: ${String(b._id.grade || 'null').padEnd(5)} | `);
      console.log(`           ClassName: ${String(b._id.class_name || 'null').padEnd(15)} | `);
      console.log(`           Program: ${String(b._id.program || 'null').padEnd(15)} | `);
      console.log(`           Count: ${b.count}\n`);
    });
    
    // 6. Topic distribution
    console.log('\n\n6️⃣  TOPIC DISTRIBUTION (Top 20):\n');
    
    const topicDist = await mongoose.connection.collection('questionbanks').aggregate([
      { $match: { subject: { $regex: /bahasa.*indonesia/i }, topic: { $exists: true, $ne: null } } },
      { $group: { _id: '$topic', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]).toArray();
    
    topicDist.forEach((t: any) => {
      const topicPreview = String(t._id).substring(0, 70);
      console.log(`   ${topicPreview}${String(t._id).length > 70 ? '...' : ''} | ${t.count}`);
    });
    
    // 7. CorrectAnswer distribution
    console.log('\n\n7️⃣  CORRECT ANSWER DISTRIBUTION:\n');
    
    const answerDist = await mongoose.connection.collection('questionbanks').aggregate([
      { $match: { subject: { $regex: /bahasa.*indonesia/i } } },
      { $group: { _id: '$correctAnswer', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]).toArray();
    
    const totalBa = baQuestions.reduce((acc: number, _: any) => acc + 1, 0);
    const totalCount = await mongoose.connection.collection('questionbanks').countDocuments({
      subject: { $regex: /bahasa.*indonesia/i }
    });
    
    console.log('Answer | Count   | Percentage | Status');
    console.log('-'.repeat(70));
    answerDist.forEach((a: any) => {
      const pct = (a.count / totalCount * 100).toFixed(2);
      const status = Math.abs(parseFloat(pct) - 25) < 10 ? '✓ BALANCED' : '⚠️ IMBALANCED';
      console.log(`${String(a._id || 'null').padEnd(8)} | ${a.count.toString().padStart(7)} | ${pct}%      | ${status}`);
    });
    
    // 8. Summary of findings
    console.log('\n\n' + '='.repeat(80));
    console.log('SUMMARY OF FINDINGS');
    console.log('='.repeat(80));
    
    console.log('\n✅ ACTUAL DATA STATUS:');
    console.log(`   • Total Bahasa Indonesia: ${totalCount}`);
    console.log(`   • Documents with jenjang field: ${jenjangBreakdown.filter((d: any) => d._id.jenjang).length} groups`);
    console.log(`   • Documents with grade field: ${jenjangBreakdown.filter((d: any) => d._id.grade !== undefined && d._id.grade !== null).length} groups`);
    console.log(`   • Unique topics: ${topicDist.length}`);
    console.log(`   • Answer distribution variance: Check above (should be ~25% each)`);
    
    console.log('\n📝 SAMPLE DOKUMEN STRUKTUR LENGKAP:');
    console.log('   Lihat section 4 di atas untuk contoh detail.\n');
    
    console.log('⏸️  READ-ONLY VERIFICATION COMPLETE.');
    console.log('   No changes made to database.\n');
    
    process.exit(0);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

simpleCheck();
