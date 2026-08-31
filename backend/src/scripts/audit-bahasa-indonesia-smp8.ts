import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function findBahasaIndonesiaQuestionsFixed() {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    
    console.log('\n' + '='.repeat(80));
    console.log('AUDIT SOAL BAHASA INDONESIA - PERBAIKAN QUERY');
    console.log('='.repeat(80) + '\n');
    
    // Cari semua soal Bahasa Indonesia (case insensitive)
    const baSoal = await mongoose.connection.collection('questionbanks').find({
      subject: { $regex: /bahasa|indonesia/i }
    }).sort({ topic: 1, questionId: 1 }).toArray();
    
    console.log(`📊 Total Soal Ditemukan: ${baSoal.length}\n`);
    
    if (baSoal.length === 0) {
      console.log('Tidak ada soal.');
      
      // Cek sample semua soal
      const sample = await mongoose.connection.collection('questionbanks').find({}).limit(5).toArray();
      console.log('\nSample soal dari database:');
      for (const q of sample) {
        console.log(`• ${q.questionId} | Subject: ${q.subject} | Topic: ${q.topic}`);
      }
      
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
      
      // Show topics
      const topics = [...new Set(questions.map((q: any) => q.topic.substring(0, 60)))];
      console.log(`  Topik utama (${topics.length} topik unique):`);
      topics.slice(0, 10).forEach(topic => {
        console.log(`    • ${topic}`);
      });
      if (topics.length > 10) {
        console.log(`    ... dan ${topics.length - 10} topik lainnya`);
      }
    }
    
    // Detail khusus SMP Kelas 8 jika ada
    const smpKelas8Key = 'SMP - Grade 8';
    if (grouped[smpKelas8Key]) {
      const smpKelas8 = grouped[smpKelas8Key];
      
      console.log('\n\n' + '='.repeat(80));
      console.log('DETAILED AUDIT: SMP KELAS 8 BAHASA INDONESIA');
      console.log('='.repeat(80) + '\n');
      
      console.log(`Total Soal: ${smpKelas8.length}\n`);
      
      if (smpKelas8.length > 0) {
        let allSameAnswers = 0;
        let correctAnswerStats: Record<string, number> = {};
        
        // Audit variasi jawaban
        for (const q of smpKelas8) {
          const options = q.options || [];
          
          // Check semua opsi sama
          if (options.length > 0 && options.every(o => o === options[0])) {
            allSameAnswers++;
          }
          
          // Stats jawaban benar
          const correct = String(q.correctAnswer || '').toUpperCase();
          correctAnswerStats[correct] = (correctAnswerStats[correct] || 0) + 1;
        }
        
        console.log('🔍 MASALAH YANG TERDETEKSI:\n');
        
        if (allSameAnswers > 0) {
          console.log(`❗️  ${allSameAnswers} soal memiliki SEMUA OPSI SAMA ("a", "b", "c", atau "d")`);
          
          const problematic = smpKelas8.filter((q: any) => {
            const options = q.options || [];
            return options.length > 0 && options.every(o => o === options[0]);
          });
          
          console.log('\nCONTOH SOAL BERMASALAH:\n');
          problematic.slice(0, 5).forEach((q: any, idx: number) => {
            const commonValue = q.options?.[0] || 'N/A';
            console.log(`\n[${idx + 1}] ${q.questionId}`);
            console.log(`    Topic: ${q.topic}`);
            console.log(`    Text Preview: ${q.text?.substring(0, 80)}...`);
            console.log(`    Correct Answer: ${String(q.correctAnswer).toUpperCase()}`);
            console.log(`    Options: ${JSON.stringify(q.options)}`);
            console.log(`    ⚠️  ISSUE: Semua ${q.options?.length} opsi adalah "${commonValue}"!`);
            console.log(`    FIX NEEDED: Generate varied options (a, b, c, d)`);
          });
        } else {
          console.log('✅ Tidak ada soal dengan semua opsi sama.');
        }
        
        console.log('\n\n📊 DISTRIBUSI JAWABAN BENAR:\n');
        console.log('Jawaban | Jumlah Soal | Persentase | Status');
        console.log('-'.repeat(70));
        
        for (const [ans, count] of Object.entries(correctAnswerStats)) {
          const percentage = (count / smpKelas8.length * 100).toFixed(1);
          const status = Math.abs(percentage - 25) < 10 ? '✓ OK' : '⚠️ UNBALANCED';
          console.log(`${ans.padEnd(9)} | ${count.toString().padStart(10)} | ${percentage}%     | ${status}`);
        }
        
        if (Math.max(...Object.values(correctAnswerStats)) / smpKelas8.length * 100 > 40) {
          console.log('\n⚠️  PERINGATAN: Distribusi jawaban tidak seimbang!');
          console.log(`   Jawaban paling banyak: ${ans} (${(Math.max(...Object.values(correctAnswerStats)) / smpKelas8.length * 100).toFixed(1)}%)`);
          console.log(`   Idealnya: A ≈ B ≈ C ≈ D ≈ 25% masing-masing`);
        }
        
        // Tampilkan beberapa soal lengkap sebagai contoh
        console.log('\n\n📖 CONTOH SOAL LENGKAP (First 3):\n');
        console.log('-'.repeat(80));
        
        smpKelas8.slice(0, 3).forEach((q: any, idx: number) => {
          console.log(`\n[${idx + 1}] QUESTION ID: ${q.questionId}`);
          console.log(`    Topic: ${q.topic}`);
          console.log(`    Sub-subject: ${q.subSubject || 'N/A'}`);
          console.log(`    Type: ${q.type || 'N/A'}`);
          console.log(`\n    SOAL/TEXT:`);
          console.log(`    ${q.text}`);
          console.log(`\n    JAWABAN BENAR: ${String(q.correctAnswer).toUpperCase()}`);
          
          if (q.options && q.options.length > 0) {
            console.log(`\n    OPSI JAWABAN:`);
            q.options.forEach((opt: string, optIdx: number) => {
              const marker = String(optIdx) === String(q.correctAnswer)?.toLowerCase() ? ' ← CORRECT' : '';
              console.log(`      ${(optIdx + 1)}. ${opt}${marker}`);
            });
            
            // Check variations
            const uniqueOptions = new Set(q.options);
            if (uniqueOptions.size === 1) {
              console.log(`\n    ⚠️  WARNING: Semua opsi sama! Hanya 1 variasi unik.`);
            } else {
              console.log(`\n    ✓ Variasi opsi: ${uniqueOptions.size} unik dari ${q.options.length} total`);
            }
          }
          
          console.log('    ' + '-'.repeat(70));
        });
      }
    } else {
      console.log('\n⚠️  Tidak ada data SMP Kelas 8. Mencari yang tersedia...\n');
      
      const availableKeys = Object.keys(grouped).filter(k => k.includes('SMP'));
      console.log('Data SMP yang tersedia:', availableKeys);
      
      for (const key of availableKeys) {
        console.log(`\n${key}: ${grouped[key].length} soal`);
        
        const topics = [...new Set(grouped[key].map((q: any) => q.topic.substring(0, 80)))];
        console.log(`  Topik sample: ${topics.length}`);
        topics.slice(0, 5).forEach(topic => {
          console.log(`    • ${topic}`);
        });
      }
    }
    
    console.log('\n\n' + '='.repeat(80));
    console.log('KESIMPULAN & REKOMENDASI');
    console.log('='.repeat(80));
    console.log('\n✅ Jika data ditemukan namun bermasalah:');
    console.log(`   • Gunakan script seed/regenerate untuk membuat variasi baru`);
    console.log(`   • Pastikan setiap soal memiliki 4 opsi berbeda (a,b,c,d)`);
    console.log(`   • Distribusi jawaban harus seimbang (~25% masing-masing)`);
    console.log('\n❌ Jika tidak ada data:');
    console.log(`   • Generate bank soal Baru menggunakan generator`);
    console.log(`   • Import dari Excel jika tersedia`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

findBahasaIndonesiaQuestionsFixed();
