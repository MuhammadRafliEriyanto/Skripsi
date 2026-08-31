import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function findBahasaIndonesiaQuestions() {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    
    console.log('\n' + '='.repeat(80));
    console.log('MENCARI SOAL BAHASA INDONESIA SEMUA JENJANG');
    console.log('='.repeat(80) + '\n');
    
    // Cari semua soal Bahasa Indonesia
    const baSoal = await mongoose.connection.collection('questionbanks').find({
      subject: 'BAHASA INDONESIA',
      $or: [
        { jenjang: 'SMP' },
        { jenjang: 'SD' },
        { jenjang: 'SMA' }
      ]
    }).sort({ topic: 1, questionId: 1 }).toArray();
    
    console.log(`📊 Total Soal Bahasa Indonesia Ditemukan: ${baSoal.length}\n`);
    
    if (baSoal.length === 0) {
      console.log('Tidak ada soal Bahasa Indonesia di database.');
      
      // Cek apa saja yang ada
      const allSubjects = await mongoose.connection.collection('questionbanks').distinct('subject');
      console.log('\nSemua mata pelajaran yang ada:', allSubjects);
      process.exit(0);
    }
    
    // Group by jenjang dan grade
    const grouped: Record<string, any> = {};
    
    for (const q of baSoal) {
      const key = `${q.jenjang || 'Other'} - Grade ${q.grade || 'Unknown'}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(q);
    }
    
    console.log('DISTRIBUSI PER JENJANG:\n');
    console.log('-'.repeat(80));
    
    for (const [jenjang, questions] of Object.entries(grouped)) {
      console.log(`${jenjang.padEnd(25)} : ${questions.length.toString().padStart(5)} soal`);
      
      // Show sample topics
      const topics = [...new Set(questions.map((q: any) => q.topic.substring(0, 40)))];
      console.log(`  Topik (sample):`);
      topics.slice(0, 5).forEach(topic => {
        console.log(`    • ${topic}...`);
      });
    }
    
    // Detail khusus SMP Kelas 8
    console.log('\n\n' + '='.repeat(80));
    console.log('DETAILED AUDIT: SMP KELAS 8 BAHASA INDONESIA');
    console.log('='.repeat(80) + '\n');
    
    const smpKelas8 = grouped['SMP - Grade 8'] || [];
    
    console.log(`Total Soal SMP Kelas 8: ${smpKelas8.length}\n`);
    
    if (smpKelas8.length > 0) {
      // Check variations and answers
      let allSameAnswers = 0;
      let correctAnswerStats: Record<string, number> = {};
      
      console.log('🔍 Analisis Variasi dan Jawaban:\n');
      
      for (const q of smpKelas8) {
        const options = q.options || [];
        
        // Check jika semua opsi sama
        if (options.length > 0 && options.every(o => o === options[0])) {
          allSameAnswers++;
        }
        
        // Stats jawaban benar
        const correct = String(q.correctAnswer || '').toUpperCase();
        correctAnswerStats[correct] = (correctAnswerStats[correct] || 0) + 1;
      }
      
      console.log('Masukan yang terdeteksi:');
      console.log(`  • Soal dengan semua opsi sama: ${allSameAnswers}`);
      
      console.log('\nDistribusi Jawaban Benar:');
      for (const [ans, count] of Object.entries(correctAnswerStats)) {
        const percentage = (count / smpKelas8.length * 100).toFixed(1);
        console.log(`    Jawab ${ans}: ${count} (${percentage}%)`);
      }
      
      // Tampilkan contoh soal lengkap
      console.log('\n\nCONTOH SOAL LENGKAP (First 10):\n');
      console.log('-'.repeat(80));
      
      smpKelas8.slice(0, 10).forEach((q: any, idx: number) => {
        console.log(`\n[${idx + 1}] ${q.questionId}`);
        console.log(`    Topic: ${q.topic}`);
        console.log(`    Text: ${q.text?.substring(0, 100)}...`);
        console.log(`    Correct: ${String(q.correctAnswer).toUpperCase()}`);
        
        if (q.options && q.options.length > 0) {
          console.log(`    Options:`, q.options);
          
          // Highlight jika ada masalah
          if (q.options.every(o => o === 'a')) {
            console.log(`    ⚠️ WARNING: Semua opsi adalah "a"!`);
          }
        }
        console.log('    ' + '-'.repeat(70));
      });
      
      // Find problematic samples
      const problematic = smpKelas8.filter((q: any) => {
        const options = q.options || [];
        return options.length > 0 && options.every(o => o === 'a');
      });
      
      if (problematic.length > 0) {
        console.log('\n\n❗ CONTOH SOAL DENGAN MASUKAN ALL "A":\n');
        console.log('-'.repeat(80));
        
        problematic.slice(0, 5).forEach((q: any, idx: number) => {
          console.log(`\n[${idx + 1}] ${q.questionId}`);
          console.log(`    Topic: ${q.topic}`);
          console.log(`    Correct Answer: ${q.correctAnswer}`);
          console.log(`    Options: ${JSON.stringify(q.options)}`);
          console.log(`    Issue: All options are lowercase "a"`);
          console.log(`    Suggested Fix: Generate varied options (A, B, C, D)`);
        });
      }
    } else {
      console.log('Tidak ada soal SMP Kelas 8 Bahasa Indonesia di database.');
      
      // Tampilkan yang ada di SMP
      const smp = grouped['SMP - Grade 9'] || [];
      console.log(`\nContoh dari SMP Kelas 9: ${smp.length} soal`);
      
      if (smp.length > 0) {
        console.log('\nSample topik SMP Kelas 9:');
        const topics = [...new Set(smp.map((q: any) => q.topic))];
        topics.slice(0, 10).forEach(topic => {
          console.log(`  • ${topic}`);
        });
      }
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

findBahasaIndonesiaQuestions();
