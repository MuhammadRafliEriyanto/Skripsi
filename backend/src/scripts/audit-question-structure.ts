import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function auditQuestionFields() {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    
    console.log('\n' + '='.repeat(80));
    console.log('AUDIT STRUKTUR DATABASE SOAL BAHASA INDONESIA');
    console.log('='.repeat(80) + '\n');
    
    // Cari sampel soal Bahasa Indonesia Bab 1 - Membaca Pemahaman
    const sampleQuestions = await mongoose.connection.collection('questionbanks').find({
      subject: { $regex: /bahasa|indonesia/i },
      topic: { $regex: /Membaca Pemahaman/i }
    }).sort({ questionId: 1 }).limit(20).toArray();
    
    console.log(`📊 Ditemukan ${sampleQuestions.length} soal dengan topik "Membaca Pemahaman"`);
    
    if (sampleQuestions.length === 0) {
      console.log('Tidak ada topik "Membaca Pemahaman".\n');
      
      // Cek semua topik yang tersedia
      const allTopics = await mongoose.connection.collection('questionbanks').find({
        subject: { $regex: /bahasa|indonesia/i }
      }).distinct('topic');
      
      console.log(`Total topik tersedia: ${allTopics.length}`);
      console.log('Daftar topik:\n');
      
      const sortedTopics = allTopics.sort();
      sortedTopics.forEach((topic: string) => {
        console.log(`  • ${topic}`);
      });
      
      process.exit(0);
    }
    
    // Analisis struktur dokumen lengkap
    console.log('\nSTRUKTUR DATA LENGKAP:\n');
    console.log('-'.repeat(80));
    
    for (let i = 0; i < Math.min(sampleQuestions.length, 5); i++) {
      const q = sampleQuestions[i];
      
      console.log(`\n[${i + 1}] ANALISIS SOAL LENGKAP:`);
      console.log(`    ID       : ${q.questionId}`);
      console.log(`    Jenjang  : ${q.jenjang || '(tidak ada)'}`);
      console.log(`    Kelas    : ${q.grade || '(tidak ada)'}`);
      console.log(`    Subject  : ${q.subject}`);
      console.log(`    Topic    : ${q.topic}`);
      console.log(`    Sub      : ${q.subSubject || '(tidak ada)'}`);
      console.log(`    Type     : ${q.type || '(tidak ada)'}`);
      console.log(`    Difficulty: ${q.difficulty || 'N/A'}`);
      
      // Field penting untuk CBT
      console.log(`\n    📝 KONTEN SOAL:`);
      console.log(`    Text Length: ${(q.text?.length || 0)} chars`);
      console.log(`    Options Count: ${(q.options?.length || 0)} options`);
      console.log(`    Correct Answer: ${String(q.correctAnswer).toUpperCase()}`);
      
      // Detail opsi jawaban
      if (q.options && q.options.length > 0) {
        console.log(`\n    🔍 DETAIL OPSI JAWABAN:`);
        
        const uniqueOptions = new Set(q.options);
        const hasAllSame = q.options.every(o => o === q.options[0]);
        
        q.options.forEach((opt: string, idx: number) => {
          const marker = String(idx) === String(q.correctAnswer)?.toLowerCase() ? ' ← CORRECT' : '';
          const preview = typeof opt === 'string' ? opt.substring(0, 60) : JSON.stringify(opt).substring(0, 60);
          console.log(`      [(idx:${idx})] ${opt}${marker}`);
        });
        
        console.log(`\n    VARIASI OPSI: ${uniqueOptions.size} unik dari ${q.options.length} total`);
        console.log(`    Status: ${hasAllSame ? '❌ SEMUA Opsi SAMA!' : '✓ Variasi OK'}`);
        
        if (hasAllSame) {
          console.log(`    ⚠️  MASALAH: Semua ${q.options.length} opsi bernilai "${q.options[0]}"`);
        }
      }
      
      console.log(`\n    ` + '-'.repeat(70));
    }
    
    // Audit semua 3200 soal untuk masalah serupa
    console.log('\n\n' + '='.repeat(80));
    console.log('AUDIT MASSAL: CHECK PROBLEMATIC QUESTIONS');
    console.log('='.repeat(80) + '\n');
    
    const allBaSoal = await mongoose.connection.collection('questionbanks').find({
      subject: { $regex: /bahasa|indonesia/i }
    }).toArray();
    
    let problematicCount = 0;
    let allSameCount = 0;
    let missingOptions = 0;
    let wrongAnswerFormat = 0;
    
    for (const q of allBaSoal) {
      const options = q.options || [];
      
      // Check missing options
      if (options.length === 0) {
        missingOptions++;
        continue;
      }
      
      // Check all same options
      if (options.every(o => o === options[0])) {
        allSameCount++;
      }
      
      // Check correct answer format
      if (typeof q.correctAnswer !== 'string') {
        wrongAnswerFormat++;
      }
    }
    
    console.log(`Total Soal Bahasa Indonesia: ${allBaSoal.length}`);
    console.log(`\n⚠️  MASALAH YANG TERDETEKSI:\n`);
    
    if (missingOptions > 0) {
      console.log(`  ❌ Soal tanpa options: ${missingOptions}`);
    }
    
    if (allSameCount > 0) {
      console.log(`  ❌ Soal dengan semua opsi SAMA: ${allSameCount}`);
      
      const problemExamples = allBaSoal.filter((q: any) => {
        const options = q.options || [];
        return options.length > 0 && options.every(o => o === options[0]);
      }).slice(0, 5);
      
      console.log(`\n    CONTOH MASALAH:\n`);
      problemExamples.forEach((q: any, idx: number) => {
        console.log(`    [${idx + 1}] ${q.questionId}`);
        console.log(`        Topic: ${q.topic}`);
        console.log(`        Correct: ${q.correctAnswer}`);
        console.log(`        All options: ${JSON.stringify(q.options)}`);
      });
      
      console.log(`\n    💡 SOLUSI: Regenerate soal-soal ini dengan variasi opsi yang benar`);
      console.log(`              Setiap opsi harus berbeda: a, b, c, d`);
    }
    
    if (wrongAnswerFormat > 0) {
      console.log(`  ⚠️  Soal dengan jawaban salah format: ${wrongAnswerFormat}`);
    }
    
    // Answer distribution analysis
    console.log('\n\n📊 DISTRIBUSI JAWABAN BENAR:\n');
    console.log('-'.repeat(80));
    
    const answerStats: Record<string, number> = {};
    for (const q of allBaSoal) {
      const correct = String(q.correctAnswer || '').toUpperCase();
      answerStats[correct] = (answerStats[correct] || 0) + 1;
    }
    
    console.log('Jawaban | Jumlah Soal | Persentase | Status');
    console.log('-'.repeat(70));
    
    let unbalanced = false;
    for (const [ans, count] of Object.entries(answerStats)) {
      const percentage = (count / allBaSoal.length * 100).toFixed(1);
      const ideal = `${(100 / allBaSoal.length * 100).toFixed(1)}%`;
      const status = Math.abs(parseFloat(percentage) - 25) < 10 ? '✓ BALANCED' : '⚠️ UNBALANCED';
      
      if (Math.abs(parseFloat(percentage) - 25) > 10) {
        unbalanced = true;
      }
      
      console.log(`${ans.padEnd(9)} | ${count.toString().padStart(10)} | ${percentage}%  | ${status}`);
    }
    
    if (unbalanced) {
      console.log(`\n⚠️  PERINGATAN: Distribusi jawaban tidak seimbang!`);
      console.log(`   Idealnya: A ≈ B ≈ C ≈ D ≈ 25% masing-masing`);
    } else {
      console.log(`\n✅ Distribusi jawaban baik/seimbang`);
    }
    
    console.log('\n\n' + '='.repeat(80));
    console.log('REKOMENDASI AKSI');
    console.log('='.repeat(80));
    
    if (allSameCount > 0 || missingOptions > 0) {
      console.log('\n🔴 PRIORITAS TINGGI: REGENERATE/BUILD SOAL BARU');
      console.log('\nLangkah yang perlu dilakukan:');
      console.log('1. Identifikasi file Excel atau sumber data asli soal-soal ini');
      console.log('2. Gunakan generator/regenerate script untuk membuat variasi baru:');
      console.log('   • Pastikan setiap soal memiliki 4 opsi berbeda (a,b,c,d)');
      console.log('   • Validasi sebelum import: check jika semua opsi sama');
      console.log('   • Distribusi jawaban seimbang (~25% masing-masing)');
      console.log('\n3. Alternative: Manual fix untuk soal tertentu dengan command:');
      console.log('   deleteMany({ questionId: { $in: [...] } })');
      console.log('   insertMany([{ ...new questions with proper options ... }])');
      
    } else {
      console.log('\n✅ Database sehat, tidak ada masalah yang ditemukan');
      console.log('   Soal-soal siap digunakan untuk CBT');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

auditQuestionFields();
