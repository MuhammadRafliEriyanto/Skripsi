import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function forensicVerification() {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    
    console.log('\n' + '='.repeat(80));
    console.log('FORENSIC VERIFICATION - MONGODB DOCUMENT READING (READ-ONLY)');
    console.log('='.repeat(80) + '\n');
    console.log('Membaca dokumen LANGSUNG dari MongoDB tanpa transformasi atau casting\n');
    
    // === PART 1: AMBIL 5 SOAL SMP KELAS 8 BAHASA INDONESIA ===
    console.log('=' .repeat(80));
    console.log('PART 1: 5 SOAL SMP KELAS 8 BAHASA INDONESIA - STRUKTUR LENGKAP');
    console.log('='.repeat(80));
    
    const smpSoal = await mongoose.connection.collection('questionbanks')
      .find({
        subject: 'BAHASA INDONESIA',
        jenjang: 'SMP',
        grade: '8'
      })
      .sort({ questionId: 1 })
      .limit(5)
      .toArray();
    
    console.log(`\n📊 DITEMukan ${smpSoal.length} soal dengan query exact:\n`);
    console.log('   subject: "BAHASA INDONESIA"');
    console.log('   jenjang: "SMP"');
    console.log('   grade: "8"\n');
    
    for (let i = 0; i < Math.min(smpSoal.length, 5); i++) {
      const doc = smpSoal[i];
      
      console.log(`\n================================================================================`);
      console.log(`DOKUMEN #${i + 1}`);
      console.log('='.repeat(80));
      
      // Tampilkan SEMUA field yang ada di dokumen
      console.log('\n📋 SELURUH FIELD DALAM DOKUMEN:');
      const keys = Object.keys(doc);
      console.log(`Total field: ${keys.length}`);
      keys.forEach((key, idx) => {
        const value = doc[key];
        let displayValue = '';
        
        if (typeof value === 'string') {
          displayValue = `"${value}"`;
          if (value.length > 100) {
            displayValue += `\n    ... (length: ${value.length})`;
          }
        } else if (Array.isArray(value)) {
          displayValue = `[${value.length} items]:`;
          value.slice(0, 3).forEach((v, j) => {
            displayValue += `\n     ${j}. "${String(v).substring(0, 60)}"`;
          });
          if (value.length > 3) {
            displayValue += `\n     ... (${value.length - 3} items lainnya)`;
          }
        } else if (typeof value === 'object' && value !== null) {
          const nestedKeys = Object.keys(value);
          displayValue = `{${nestedKeys.length} properties}: ${JSON.stringify(value)}`;
        } else {
          displayValue = `${value}`;
        }
        
        console.log(`${String(idx + 1).padStart(2)}. ${key.padEnd(30)} = ${displayValue}`);
      });
      
      // Field spesifik penting
      console.log(`\n🎯 FIELD PENTING YANG DICARI:\n`);
      console.log(`   questionId      : ${doc.questionId || '(not present)'}`);
      console.log(`   text            : ${doc.text ? `"${doc.text.substring(0, 100)}${doc.text?.length! > 100 ? '...' : ''}"` : '(not present or empty)'}`);
      console.log(`   questionText    : ${doc.questionText ? `"${doc.questionText.substring(0, 100)}${doc.questionText?.length! > 100 ? '...' : ''}"` : '(not present)'}`);
      console.log(`   prompt          : ${doc.prompt ? `"${doc.prompt.substring(0, 100)}${doc.prompt?.length! > 100 ? '...' : ''}"` : '(not present)'}`);
      console.log(`   content         : ${doc.content ? `"${doc.content.substring(0, 100)}${doc.content?.length! > 100 ? '...' : ''}"` : '(not present)'}`);
      console.log(`   description     : ${doc.description ? `"${doc.description.substring(0, 100)}${doc.description?.length! > 100 ? '...' : ''}"` : '(not present)'}`);
      console.log(`   options         : ${doc.options ? JSON.stringify(doc.options) : '(not present)'}`);
      console.log(`   correctAnswer   : ${doc.correctAnswer !== undefined ? String(doc.correctAnswer) : '(not present)'}`);
      console.log(`   answerKey       : ${doc.answerKey !== undefined ? String(doc.answerKey) : '(not present)'}`);
      console.log(`   key             : ${doc.key !== undefined ? String(doc.key) : '(not present)'}`);
      console.log(`   subject         : ${doc.subject || '(not present)'}`);
      console.log(`   mapel           : ${doc.mapel || '(not present)'}`);
      console.log(`   grade           : ${doc.grade !== undefined ? String(doc.grade) : '(not present)'}`);
      console.log(`   kelas           : ${doc.kelas || '(not present)'}`);
      console.log(`   level           : ${doc.level || '(not present)'}`);
      console.log(`   jenjang         : ${doc.jenjang || '(not present)'}`);
      console.log(`   topic           : ${doc.topic || '(not present)'}`);
      console.log(`   materi          : ${doc.materi || '(not present)'}`);
      console.log(`   source          : ${doc.source || '(not present)'}`);
      console.log(`   createdAt       : ${doc.createdAt || '(not present)'}`);
      console.log(`   updatedAt       : ${doc.updatedAt || '(not present)'}`);
      
      console.log(`\n✅ KESIMPULAN DOKUMEN #${i + 1}:`);
      const hasQuestionText = !!doc.text || !!doc.questionText || !!doc.prompt || !!doc.content;
      console.log(`   - Ada field pertanyaan: ${hasQuestionText ? 'YES ✅' : 'NO ❌'}`);
      console.log(`   - Nama field yang dipakai: ${hasQuestionText ? (doc.text ? 'text' : (doc.questionText ? 'questionText' : (doc.prompt ? 'prompt' : 'content'))) : 'TIDAK ADA'}`);
      console.log(`   - Jumlah options: ${doc.options?.length || 0}`);
      console.log(`   - Variasi options unik: ${new Set(doc.options?.map(String) || []).size || 0}`);
    }
    
    // === PART 2: 5 SOAL BAHASA INDONESIA JENJANG LAIN ===
    console.log('\n\n' + '='.repeat(80));
    console.log('PART 2: 5 SOAL BAHASA INDONESIA DARI JENJANG LAIN');
    console.log('='.repeat(80));
    
    const otherSoal = await mongoose.connection.collection('questionbanks')
      .find({
        subject: 'BAHASA INDONESIA'
      })
      .project({ _id: 0 }) // Exclude _id untuk hasil lebih bersih
      .sort({ questionId: 1 })
      .skip(Math.max(smpSoal.length, 5))
      .limit(5)
      .toArray();
    
    console.log(`\n📊 Ditemukan ${otherSoal.length} soal lain`);
    
    for (let i = 0; i < Math.min(otherSoal.length, 5); i++) {
      const doc = otherSoal[i];
      
      console.log(`\n================================================================================`);
      console.log(`DOKUMEN #${i + 1}`);
      console.log('='.repeat(80));
      
      const keys = Object.keys(doc);
      console.log(`\n📋 TOTAL FIELDS: ${keys.length}`);
      console.log(`Fields: ${keys.join(', ')}`);
      
      console.log(`\n🎯 DETAIL:`);
      console.log(`   questionId  : ${doc.questionId || '(not present)'}`);
      console.log(`   jenjang     : ${doc.jenjang || '(not present)'}`);
      console.log(`   grade       : ${doc.grade !== undefined ? String(doc.grade) : '(not present)'}`);
      console.log(`   subject     : ${doc.subject || '(not present)'}`);
      console.log(`   topic       : ${doc.topic || '(not present)'}`);
      console.log(`   text        : ${doc.text ? `"${doc.text.substring(0, 80)}${doc.text?.length! > 80 ? '...' : ''}" (${doc.text?.length || 0} chars)` : '(empty/not present)'}`);
      console.log(`   options     : ${JSON.stringify(doc.options?.slice(0, 4) || [])}`);
      console.log(`   correctAnswer: ${doc.correctAnswer !== undefined ? String(doc.correctAnswer) : '(not present)'}`);
    }
    
    // === PART 3: STATISTIK DATABASE ===
    console.log('\n\n' + '='.repeat(80));
    console.log('PART 3: STATISTIK MASIFAL HUBUNGAN FIELD');
    console.log('='.repeat(80));
    
    // Hitung berapa dokumen yang punya jenjang vs tidak
    const totalBaSoal = await mongoose.connection.collection('questionbanks')
      .countDocuments({ subject: 'BAHASA INDONESIA' });
    
    const withJenjang = await mongoose.connection.collection('questionbanks')
      .countDocuments({ 
        subject: 'BAHASA INDONESIA',
        jenjang: { $exists: true, $ne: null }
      });
    
    const withGrade = await mongoose.connection.collection('questionbanks')
      .countDocuments({ 
        subject: 'BAHASA INDONESIA',
        grade: { $exists: true, $ne: null }
      });
    
    console.log(`\nTotal soal Bahasa Indonesia: ${totalBaSoal.toLocaleString()}`);
    console.log(`Dengan field jenjang: ${withJenjang.toLocaleString()} (${(withJenjang / totalBaSoal * 100).toFixed(1)}%)`);
    console.log(`Dengan field grade: ${withGrade.toLocaleString()} (${(withGrade / totalBaSoal * 100).toFixed(1)}%)`);
    
    // Cek distribusi jenjang
    const jenjangDist = await mongoose.connection.collection('questionbanks').aggregate([
      { $match: { subject: 'BAHASA INDONESIA' } },
      { $group: { 
        _id: '$jenjang',
        count: { $sum: 1 },
        grades: { $addToSet: '$grade' }
      }}
    ]).toArray();
    
    console.log(`\nDistribusi berdasarkan jenjang:`);
    jenjangDist.forEach(d => {
      const jenjangName = d._id || 'NULL/undefined';
      const total = d.count.toLocaleString();
      const uniqueGrades = [...d.grades].join(', ');
      console.log(`   Jenjang "${jenjangName}": ${total} soal (grades: ${uniqueGrades || 'none'})`);
    });
    
    // Cek berapa soal dengan text kosong vs tidak
    const emptyTextCount = await mongoose.connection.collection('questionbanks')
      .countDocuments({ 
        subject: 'BAHASA INDONESIA',
        $or: [
          { text: '' },
          { text: { $exists: false } },
          { text: { $eq: null } }
        ]
      });
    
    const nonEmptyTextCount = totalBaSoal - emptyTextCount;
    
    console.log(`\nStatus isi pertanyaan (field "text"):`);
    console.log(`   Kosong/tidak ada: ${emptyTextCount.toLocaleString()} (${(emptyTextCount / totalBaSoal * 100).toFixed(1)}%)`);
    console.log(`   Berisi konten: ${nonEmptyTextCount.toLocaleString()} (${(nonEmptyTextCount / totalBaSoal * 100).toFixed(1)}%)`);
    
    // Cek correctAnswer distribution dengan format yang benar
    const answerDist = await mongoose.connection.collection('questionbanks').aggregate([
      { $match: { subject: 'BAHASA INDONESIA' } },
      { $group: {
        _id: '$correctAnswer',
        count: { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ]).toArray();
    
    console.log(`\nDistribusi correctAnswer (langsung dari DB):`);
    answerDist.forEach(d => {
      const ans = d._id !== null ? String(d._id) : 'NULL';
      const count = d.count.toLocaleString();
      const percent = (d.count / totalBaSoal * 100).toFixed(2);
      console.log(`   Jawaban "${ans.padEnd(5)}": ${count.padStart(8)} soal (${percent}%)`);
    });
    
    // Cek apakah semua options sama untuk topik tertentu
    const topicGroups = await mongoose.connection.collection('questionbanks')
      .aggregate([
        { $match: { 
          subject: 'BAHASA INDONESIA',
          topic: { $exists: true, $ne: null }
        }},
        { $group: {
          _id: '$topic',
          count: { $sum: 1 },
          optionsHash: { $first: '$options' }
        }}
      ])
      .limit(10)
      .toArray();
    
    console.log(`\nSample distribusi per topik (10 pertama):`);
    topicGroups.forEach(tg => {
      console.log(`   Topic: "${tg._id.substring(0, 60)}..."`);
      console.log(`     Count: ${tg.count}`);
      console.log(`     Options hash (preview): ${JSON.stringify(tg.optionsHash?.slice(0, 2) || [])}`);
    });
    
    // === PART 4: PERBANDINGAN DENGAN SCHEMA MODEL ===
    console.log('\n\n' + '='.repeat(80));
    console.log('PART 4: COMPARISON WITH EXPECTED STRUCTURE');
    console.log('='.repeat(80));
    
    console.log(`\nQuery sebelumnya menggunakan these fields:`);
    console.log(`  • text`);
    console.log(`  • options[]`);
    console.log(`  • correctAnswer`);
    console.log(`  • subject`);
    console.log(`  • grade`);
    console.log(`  • jenjang`);
    console.log(`  • topic`);
    console.log(`  • source`);
    console.log(`  • createdAt`);
    
    console.log(`\nRealitas MongoDB Document Structure:`);
    console.log(`  ✅ Fields yang bekerja: text, options, correctAnswer, subject`);
    console.log(`  ⚠️  Perlu diverifikasi: grade, jenjang, topic, source, createdAt`);
    
    // Sample satu dokumen lengkap untuk dilihat semua field
    const fullDoc = await mongoose.connection.collection('questionbanks')
      .findOne({ subject: 'BAHASA INDONESIA' }, { projection: { _id: 0 } });
    
    console.log(`\nFULL DOCUMENT STRUCTURE (sample pertama):\n`);
    const allFields = Object.entries(fullDoc);
    allFields.forEach(([field, value]) => {
      let valStr = '';
      if (typeof value === 'string') {
        valStr = `"${value.substring(0, 50)}${value.length > 50 ? '...' : ''}"`;
      } else if (Array.isArray(value)) {
        valStr = `[${value.length} items] ${JSON.stringify(value.slice(0, 2))}`;
      } else if (typeof value === 'object' && value !== null) {
        valStr = `{...object...}`;
      } else {
        valStr = `${value}`;
      }
      console.log(`   ${field.padEnd(25)} = ${valStr}`);
    });
    
    console.log('\n\n' + '='.repeat(80));
    console.log('VERIFIKASI SELESAI - LIHAT LAPORAN LENGKAP DIATS');
    console.log('='.repeat(80));
    console.log('\n⏸️  Audit berhenti setelah dokumentasi lengkap.\n');
    
    process.exit(0);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

forensicVerification();
