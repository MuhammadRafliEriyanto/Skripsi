import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function findAllQuestionFormats() {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    
    console.log('\n' + '='.repeat(80));
    console.log('AUDIT FORMAT SOAL - CEK APA YANG ADA DI DATABASE');
    console.log('='.repeat(80) + '\n');
    
    // Cek jenjang apa saja yang ada
    const jenjangValues = await mongoose.connection.collection('questionbanks').distinct('jenjang');
    console.log('Jenjang values di DB:', jenjangValues);
    
    // Check grade values
    const gradeValues = await mongoose.connection.collection('questionbanks').distinct('grade');
    console.log('Grade values di DB:', gradeValues);
    
    // Find questions with "SMP" in questionId
    const smpQuestions = await mongoose.connection.collection('questionbanks')
      .find({ questionId: { $regex: /SMP/i } })
      .limit(10)
      .toArray();
    
    console.log(`\nSoal dengan "SMP" di questionId: ${smpQuestions.length}`);
    
    if (smpQuestions.length > 0) {
      console.log('\nSample SMP Soal:\n');
      for (const q of smpQuestions) {
        console.log(`ID: ${q.questionId}`);
        console.log(`   Subject: ${q.subject}`);
        console.log(`   Topic: ${q.topic}`);
        console.log(`   Text Length: ${(q.text?.length || 0)} chars`);
        console.log(`   Options: ${JSON.stringify(q.options)}`);
        console.log('   ' + '-'.repeat(70));
      }
    }
    
    // Categorize by first letter of questionId
    console.log('\n\n' + '='.repeat(80));
    console.log('DETIING CATEGORY BY QUESTION ID PREFIX');
    console.log('='.repeat(80) + '\n');
    
    const stats: Record<string, any> = {};
    
    const cursor = mongoose.connection.collection('questionbanks').find({
      subject: { $regex: /bahasa|indonesia/i }
    });
    
    const allBaSoal = await cursor.toArray();
    
    for (const q of allBaSoal) {
      const parts = (q.questionId || '').split('-');
      const prefix = parts[0] || 'UNKNOWN';
      
      if (!stats[prefix]) {
        stats[prefix] = { count: 0, topics: new Set(), textEmpty: 0 };
      }
      
      stats[prefix].count++;
      stats[prefix].topics.add(q.topic.substring(0, 50));
      if ((q.text?.length || 0) === 0) {
        stats[prefix].textEmpty++;
      }
    }
    
    console.log('\nCATEGORIES FOUND:\n');
    console.log('Prefix | Count | Empty Text | Sample Topics');
    console.log('-'.repeat(80));
    
    for (const [prefix, data] of Object.entries(stats)) {
      console.log(`${prefix.padEnd(10)} | ${data.count.toString().padStart(4)} | ${(data.textEmpty / data.count * 100).toFixed(0)}% empty | ${[...data.topics][0]}...`);
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

findAllQuestionFormats();
