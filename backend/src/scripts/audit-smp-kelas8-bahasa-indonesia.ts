import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function auditSMPKelas8BahasaIndonesia() {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    
    console.log('\n' + '='.repeat(80));
    console.log('AUDIT BANK SOAL: SMP KELAS 8 BAHASA INDONESIA BAB 1');
    console.log('='.repeat(80) + '\n');
    
    // Query semua soal SMP Kelas 8 Bahasa Indonesia Bab 1
    const questions = await mongoose.connection.collection('questionbanks').find({
      jenjang: 'SMP',
      grade: '8',
      subject: 'BAHASA INDONESIA',
      topic: { $regex: /Bab 1|Membaca Pemahaman/i }
    }).sort({ questionId: 1 }).toArray();
    
    console.log(`📊 Total Soal Ditemukan: ${questions.length}\n`);
    
    if (questions.length === 0) {
      console.log('⚠️ Tidak ada soal dengan kriteria tersebut.');
      console.log('Mencari semua soal SMP Kelas 8 Bahasa Indonesia...\n');
      
      const allQuestions = await mongoose.connection.collection('questionbanks').find({
        jenjang: 'SMP',
        grade: '8',
        subject: 'BAHASA INDONESIA'
      }).limit(20).toArray();
      
      console.log(`Total soal SMP Kelas 8 Bahasa Indonesia: ${allQuestions.length}\n`);
      process.exit(0);
    }
    
    // Analisis Variasi Soals
    const variations: Record<string, any> = {};
    let correctAnswerStats: Record<string, number> = {};
    let wrongAnswerIssues = 0;
    
    console.log('🔍 ANALISIS VARIASI SOAL:\n');
    console.log('-'.repeat(80));
    
    for (const q of questions) {
      const variantKey = `variant_${q.variant || 0}`;
      variations[variantKey] = (variations[variantKey] || 0) + 1;
      
      // Stats jawaban benar
      const correctAns = String(q.correctAnswer || '').toUpperCase();
      if (!correctAnswerStats[correctAns]) {
        correctAnswerStats[correctAns] = 0;
      }
      correctAnswerStats[correctAns]++;
      
      // Cek apakah ada jawaban yang salah (semua opsi A)
      const options = q.options || [];
      if (options && options.length > 0) {
        const allSame = options.every(opt => opt === 'a');
        if (allSame) {
          wrongAnswerIssues++;
        }
      }
    }
    
    console.log(`\nJumlah variasi soal: ${Object.keys(variations).length}`);
    for (const [key, count] of Object.entries(variations)) {
      console.log(`  • ${key.padEnd(20)} : ${count} soal`);
    }
    
    console.log('\n\n📊 STATISTIK JAWABAN BENAR:\n');
    console.log('-'.repeat(80));
    console.log('Jawaban | Jumlah Soal | Persentase');
    console.log('-'.repeat(60));
    for (const [ans, count] of Object.entries(correctAnswerStats)) {
      const percentage = (count / questions.length * 100).toFixed(1);
      console.log(`${ans.padEnd(10)} | ${count.toString().padStart(5)}     | ${percentage}%`);
    }
    
    // Deteksi masalah jawaban
    console.log('\n\n❗ MASUKAN YANG TERDETEKSI:\n');
    console.log('-'.repeat(80));
    
    if (wrongAnswerIssues > 0) {
      console.log(`⚠️  ${wrongAnswerIssues} soal memiliki semua opsi "a"`);
      
      const problematicQuestions = questions.filter((q: any) => {
        const options = q.options || [];
        return options.length > 0 && options.every(opt => opt === 'a');
      });
      
      console.log(`\nContoh soal bermasalah:`);
      for (let i = 0; i < Math.min(3, problematicQuestions.length); i++) {
        const q = problematicQuestions[i];
        console.log(`\n   Question ID: ${q.questionId}`);
        console.log(`   Variant: ${q.variant || 0}`);
        console.log(`   Correct Answer: ${q.correctAnswer}`);
        console.log(`   Options:`, q.options);
        console.log(`   Text preview:`, (q.text || '').substring(0, 100) + '...');
      }
    }
    
    // Tampilkan contoh soal lengkap
    console.log('\n\n📖 CONTOH SOAL LENGKAP (First 5):\n');
    console.log('-'.repeat(80));
    
    for (let i = 0; i < Math.min(5, questions.length); i++) {
      const q = questions[i];
      console.log(`\n[${i + 1}] QUESTION ID: ${q.questionId}`);
      console.log(`    Variant: ${q.variant || 0}`);
      console.log(`    Topic: ${q.topic}`);
      console.log(`    Text:`);
      console.log(`    ${q.text}`);
      console.log(`    Correct Answer: ${String(q.correctAnswer).toUpperCase()}`);
      
      if (q.options && q.options.length > 0) {
        console.log(`    Options:`);
        q.options.forEach((opt: string, idx: number) => {
          const marker = idx === q.correctAnswer ? ' ← CORRECT' : '';
          console.log(`      ${(idx + 1)}. ${opt}${marker}`);
        });
      } else {
        console.log(`    Options: N/A`);
      }
      console.log('    ' + '-'.repeat(70));
    }
    
    // Summary
    console.log('\n\n' + '='.repeat(80));
    console.log('SUMMARY AUDIT');
    console.log('='.repeat(80));
    console.log(`\nTotal Soal: ${questions.length}`);
    console.log(`Variasi Soal: ${Object.keys(variations).length}`);
    console.log(`Soal Bermasalah (all 'a'): ${wrongAnswerIssues}`);
    console.log(`\nDistribusi Jawaban Benar:`);
    for (const [ans, count] of Object.entries(correctAnswerStats)) {
      console.log(`  • Jawaban ${ans}: ${count} soal (${(count / questions.length * 100).toFixed(1)}%)`);
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

auditSMPKelas8BahasaIndonesia();
