/**
 * AUDIT DATABASE QUESTIONBANK - READ ONLY
 *
 * Script ini HARUS READ-ONLY (hanya membaca, tidak mengubah data MongoDB)
 * GUARANTEE: TIDAK AKAN ada operasi INSERT/UPDATE/DELETE
 *
 * Tujuan:
 * 1. Validasi struktur dan kelengkapan data QuestionBank
 * 2. Cek kesiapan untuk CBT 30 soal (sampling berdasarkan program/subject/topic)
 * 3. Identifikasi masalah data sebelum digunakan untuk produksi
 */

import { MongoClient } from "mongodb";
import { config } from "dotenv";
config({ path: ".env" });

// === KONFIGURASI KONEKSI ===
if (!process.env.MONGO_URI) {
  console.error("\n❌ ERROR: MONGO_URI environment variable is required");
  console.error("   Set di backend/.env file\n");
  process.exit(1);
}

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri, {
  serverSelectionTimeoutMS: 10000, // Timeout 10 detik untuk koneksi
  socketTimeoutMS: 45000, // Timeout koneksi socket
});

// === FUNGSI HELPER ===
async function countDocuments(collection, filter = {}) {
  return await collection.countDocuments(filter);
}

async function aggregate(collection, pipeline) {
  return await collection.aggregate(pipeline).toArray();
}

async function distinct(collection, field, filter = {}) {
  return await collection.distinct(field, filter);
}

async function findSamples(collection, filter, limit = 10) {
  return await collection.find(filter).limit(limit).toArray();
}

async function aggregateWithSort(
  collection,
  pipeline,
  sortField = "count",
  sortOrder = -1,
) {
  const result = await aggregate(collection, pipeline);
  return result.sort((a, b) => b[sortField] - a[sortField]);
}

// === VALIDASI READ-ONLY ===
console.log("\n🔒 VALIDATING READ-ONLY OPERATION...\n");
console.log("✓ This script will ONLY use:");
console.log("  - countDocuments()   [READ]");
console.log("  - aggregate()        [READ]");
console.log("  - distinct()         [READ]");
console.log("  - find().toArray()   [READ]");
console.log(
  "✗ NO insertMany(), updateOne(), updateMany(), deleteOne(), deleteMany()\n",
);

// === MAIN AUDIT LOGIC ===
async function runDatabaseAudit() {
  try {
    console.log("🔄 Connecting to MongoDB...");
    await client.connect();
    console.log("✅ Connected successfully!\n");

    const db = client.db("bimbel-lms");
    const questionBankCollection = db.collection("questionbanks");

    // ============================================
    // BAGIAN 1: TOTAL DAN KEUNIKAN DATA
    // ============================================
    console.log("=".repeat(70));
    console.log("=== BAGIAN 1: STATISTIK DASAR ===");
    console.log("=".repeat(70));

    const totalDocs = await countDocuments(questionBankCollection);
    const uniqueIds = await distinct(questionBankCollection, "questionId");
    const uniqueQuestionTexts = await distinct(
      questionBankCollection,
      "questionText",
    );

    console.log(
      `\nTotal QuestionBank documents: ${totalDocs.toLocaleString()}`,
    );
    console.log(
      `Unique questionId:            ${uniqueIds.length.toLocaleString()}`,
    );
    console.log(
      `Unique questionText:          ${uniqueQuestionTexts.length.toLocaleString()}`,
    );

    const duplicateCount = totalDocs - uniqueIds.length;
    console.log(
      `Duplicate questionId:         ${duplicateCount.toLocaleString()} ${duplicateCount > 0 ? "⚠️ ISSUE!" : "✓ OK"}`,
    );

    // ============================================
    // BAGIAN 2: KELENGKAPAN FIELD
    // ============================================
    console.log("\n" + "=".repeat(70));
    console.log("=== BAGIAN 2: KELENGKAPAN FIELD ===");
    console.log("=".repeat(70));

    const emptyFields = {
      questionText: await countDocuments(questionBankCollection, {
        questionText: { $exists: false, $eq: null, $size: 0 },
      }),
      optionA: await countDocuments(questionBankCollection, {
        optionA: { $exists: false, $eq: null, $size: 0 },
      }),
      optionB: await countDocuments(questionBankCollection, {
        optionB: { $exists: false, $eq: null, $size: 0 },
      }),
      optionC: await countDocuments(questionBankCollection, {
        optionC: { $exists: false, $eq: null, $size: 0 },
      }),
      optionD: await countDocuments(questionBankCollection, {
        optionD: { $exists: false, $eq: null, $size: 0 },
      }),
      correctAnswer: await countDocuments(questionBankCollection, {
        correctAnswer: { $exists: false, $eq: null },
      }),
      topic: await countDocuments(questionBankCollection, {
        topic: { $exists: false, $eq: null },
      }),
      difficulty: await countDocuments(questionBankCollection, {
        difficulty: { $exists: false, $eq: null },
      }),
      program: await countDocuments(questionBankCollection, {
        program: { $exists: false, $eq: null },
      }),
      subject: await countDocuments(questionBankCollection, {
        subject: { $exists: false, $eq: null },
      }),
    };

    console.log("\nField kosong/null:");
    Object.entries(emptyFields).forEach(([field, count]) => {
      const percent = ((count / totalDocs) * 100).toFixed(2);
      console.log(
        `  • ${field.padEnd(15)}: ${count.toLocaleString().padStart(8)} (${percent.padStart(5)}%) ${count > 0 ? "⚠️" : "✓"}`,
      );
    });

    // ============================================
    // BAGIAN 3: VALIDSII DATA
    // ============================================
    console.log("\n" + "=".repeat(70));
    console.log("=== BAGIAN 3: VALIDASI DATA ===");
    console.log("=".repeat(70));

    // Validasi correctAnswer (hanya A/B/C/D yang valid)
    const invalidAnswers = await countDocuments(questionBankCollection, {
      correctAnswer: { $nin: ["A", "B", "C", "D"] },
    });
    console.log(
      `\nCorrectAnswer tidak valid (bukan A/B/C/D): ${invalidAnswers.toLocaleString()} ${invalidAnswers > 0 ? "⚠️ ISSUE!" : "✓ OK"}`,
    );

    if (invalidAnswers > 0) {
      const invalidSamples = await findSamples(
        questionBankCollection,
        {
          correctAnswer: { $nin: ["A", "B", "C", "D"] },
        },
        5,
      );

      console.log("\nSample incorrect answer values:");
      invalidSamples.forEach((q, i) => {
        console.log(
          `  ${i + 1}. questionId=${q.questionId}, correctAnswer='${q.correctAnswer}'`,
        );
      });
    }

    // ============================================
    // BAGIAN 4: DISTRIBUSI DATA
    // ============================================
    console.log("\n" + "=".repeat(70));
    console.log("=== BAGIAN 4: DISTRIBUSI DATA ===");
    console.log("=".repeat(70));

    // Distribution by Program
    console.log("\nDistribusi by PROGRAM:");
    const programs = await aggregate(questionBankCollection, [
      { $group: { _id: "$program", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    programs.forEach((p) => {
      const percent = ((p.count / totalDocs) * 100).toFixed(1);
      console.log(
        `  • ${p._id.padEnd(20)}: ${p.count.toLocaleString().padStart(8)} (${percent}%)`,
      );
    });

    // Distribution by Subject
    console.log("\nDistribusi by SUBJECT:");
    const subjects = await aggregate(questionBankCollection, [
      { $group: { _id: "$subject", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    subjects.forEach((s) => {
      const percent = ((s.count / totalDocs) * 100).toFixed(1);
      console.log(
        `  • ${s._id.padEnd(20)}: ${s.count.toLocaleString().padStart(8)} (${percent}%)`,
      );
    });

    // Distribution by Difficulty
    console.log("\nDistribusi by DIFFICULTY:");
    const difficulties = await aggregate(questionBankCollection, [
      { $group: { _id: "$difficulty", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    if (difficulties.length === 0) {
      console.log("  ⚠️  Semua soal memiliki difficulty = null/undefined");
    } else {
      difficulties.forEach((d) => {
        const displayId = d._id || "NULL";
        const percent = ((d.count / totalDocs) * 100).toFixed(1);
        console.log(
          `  • ${displayId.toString().padEnd(20)}: ${d.count.toLocaleString().padStart(8)} (${percent}%)`,
        );
      });
    }

    // ============================================
    // BAGIAN 5: KESIAPAN CBT 30 SOAL
    // ============================================
    console.log("\n" + "=".repeat(70));
    console.log("=== BAGIAN 5: KESIAPAN CBT 30 SOAL ===");
    console.log("=".repeat(70));

    // Query untuk cek berapa soal tersedia per combination (program+subject+topic)
    console.log(
      "\nCek ketersediaan soal per TOPIC (untuk sampling 30 soal)...",
    );
    console.log("(Ini yang dipakai fungsi sampleStudentTaskQuestions())\n");

    const topicDistributionResult = await questionBankCollection
      .aggregate([
        { $match: { topic: { $exists: true, $ne: null, $ne: "" } } },
        {
          $group: {
            _id: { program: "$program", subject: "$subject", topic: "$topic" },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    // Sort by count ascending (smallest first)
    const topicDistribution = topicDistributionResult.sort(
      (a, b) => a.count - b.count,
    );

    // Hitung statistik
    const insufficientTopics = topicDistribution.filter((t) => t.count < 30);
    const sufficientTopics = topicDistribution.filter((t) => t.count >= 30);

    console.log(
      `Total kombinasi Topic unik: ${topicDistribution.length.toLocaleString()}`,
    );
    console.log(
      `Cukup untuk 30 soal:        ${sufficientTopics.length.toLocaleString()} ✓`,
    );
    console.log(
      `Kurang dari 30 soal:        ${insufficientTopics.length.toLocaleString()} ⚠️\n`,
    );

    // Tampilkan top 20 topic dengan jumlah soal TERKECIL
    console.log("TOPIC dengan SOAL PALING SEDIKIT (prioritas perbaikan):");
    const min20 = topicDistribution.slice(0, 20);
    min20.forEach((t, i) => {
      const enough = t.count >= 30 ? "✓" : "⚠️";
      console.log(
        `  ${i + 1}. ${enough} ${t._id.program.padEnd(15)} | ${t._id.subject.padEnd(15)} | ${t._id.topic.padEnd(30)} | Total: ${t.count.toString().padStart(4)}`,
      );
    });

    // ============================================
    // BAGIAN 6: SIMULASI SAMPLING
    // ============================================
    console.log("\n" + "=".repeat(70));
    console.log("=== BAGIAN 6: SIMULASI SAMPLING (CONTOH) ===");
    console.log("=".repeat(70));

    // Ambil 3 contoh program+subject combo yang berbeda
    const sampleCombinations = [
      { program: "SMA IPA", subject: "Matematika" },
      { program: "SMA IPS", subject: "Ekonomi" },
      { program: "UTBK/SNBT", subject: "Logika" },
    ];

    for (const combo of sampleCombinations) {
      const count = await countDocuments(questionBankCollection, {
        program: combo.program,
        subject: combo.subject,
      });

      console.log(`\n${combo.program} - ${combo.subject}:`);
      console.log(`  Total soal: ${count.toLocaleString()}`);

      if (count >= 30) {
        console.log(`  Status: ✅ BISA SAMPLE 30 SOAL`);

        // Simulasi: ambil 5 random topic dari kombinasi ini
        const topicsInCombo = await aggregate(questionBankCollection, [
          { $match: { program: combo.program, subject: combo.subject } },
          { $group: { _id: "$topic", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 5 },
        ]).toArray();

        console.log("  Sample 5 topik terbanyak:");
        topicsInCombo.forEach((t, i) => {
          console.log(
            `    ${i + 1}. ${t._id.substring(0, 50)}... : ${t.count} soal`,
          );
        });
      } else {
        console.log(
          `  Status: ❌ TIDAK CUKUP (butuh 30, hanya punya ${count})`,
        );
      }
    }

    // ============================================
    // BAGIAN 7: SAMPLE DATA RIIL
    // ============================================
    console.log("\n" + "=".repeat(70));
    console.log("=== BAGIAN 7: SAMPLE DATA RIIL (5 SOAL ACAK) ===");
    console.log("=".repeat(70));

    const randomSamples = await findSamples(questionBankCollection, {}, 5);

    randomSamples.forEach((q, i) => {
      console.log(`\n[SOAL ${i + 1}]`);
      console.log(`  ID:               ${q.questionId || "NO_ID"}`);
      console.log(`  Program:          ${q.program || "NONE"}`);
      console.log(`  Subject:          ${q.subject || "NONE"}`);
      console.log(`  Topic:            ${q.topic || "NONE"}`);
      console.log(`  Difficulty:       ${q.difficulty || "NONE"}`);
      console.log(
        `  Question:         ${q.questionText?.substring(0, 60)}${q.questionText?.length > 60 ? "..." : ""}`,
      );
      console.log(
        `  Option A:         ${q.optionA?.substring(0, 40)}${q.optionA?.length > 40 ? "..." : ""}`,
      );
      console.log(
        `  Option B:         ${q.optionB?.substring(0, 40)}${q.optionB?.length > 40 ? "..." : ""}`,
      );
      console.log(
        `  Option C:         ${q.optionC?.substring(0, 40)}${q.optionC?.length > 40 ? "..." : ""}`,
      );
      console.log(
        `  Option D:         ${q.optionD?.substring(0, 40)}${q.optionD?.length > 40 ? "..." : ""}`,
      );
      console.log(`  Correct Answer:   ${q.correctAnswer || "INVALID"}`);
    });

    // ============================================
    // KESIMPULAN
    // ============================================
    console.log("\n" + "=".repeat(70));
    console.log("=== KESIMPULAN ===");
    console.log("=".repeat(70));

    const issues = [];

    if (duplicateCount > 0) {
      issues.push(`⚠️ Ada ${duplicateCount} duplicate questionId`);
    }

    if (emptyFields.questionText > 0) {
      issues.push(`⚠️ Ada ${emptyFields.questionText} soal tanpa questionText`);
    }

    if (
      emptyFields.optionA > 0 ||
      emptyFields.optionB > 0 ||
      emptyFields.optionC > 0 ||
      emptyFields.optionD > 0
    ) {
      issues.push(
        `⚠️ Ada soal tanpa opsi lengkap (A:${emptyFields.optionA}, B:${emptyFields.optionB}, C:${emptyFields.optionC}, D:${emptyFields.optionD})`,
      );
    }

    if (invalidAnswers > 0) {
      issues.push(
        `⚠️ Ada ${invalidAnswers} correctAnswer tidak valid (bukan A/B/C/D)`,
      );
    }

    if (insufficientTopics.length > 0) {
      issues.push(
        `⚠️ Ada ${insufficientTopics.length} topic dengan < 30 soal (bisa menyebabkan 409 error)`,
      );
    }

    if (issues.length === 0) {
      console.log("\n✅ SEMUA VALIDASI LULUS!");
      console.log(
        "   QuestionBank saat ini SUDAH AMAN digunakan untuk CBT 30 soal.",
      );
      console.log("   Tidak ada issue kritis yang ditemukan.\n");
    } else {
      console.log("\n❎ DITEMUKAN MASALAH:\n");
      issues.forEach((issue) => console.log("  " + issue));
      console.log("\n");

      if (insufficientTopics.length > 0) {
        console.log("💡 REKOMENDASI:");
        console.log("   1. Tambah soal ke topic yang < 30");
        console.log("   2. Atau batasi CBT hanya pada topic yang sudah cukup");
        console.log(
          "   3. Atau ubah strategi sampling (misal: ambil dari semua topic jika needed)\n",
        );
      }

      console.log(`Status: QuestionBank BELUM PASTI AMAN untuk CBT 30 soal.`);
      console.log(`Perlu perbaikan sebelum production.\n`);
    }

    // ============================================
    // PENUTUP
    // ============================================
    console.log("=".repeat(70));
    console.log("AUDIT SELESAI - No data was modified (READ ONLY)");
    console.log("=".repeat(70));
  } catch (error) {
    console.error("\n❌ ERROR during audit:", error.message);
    console.error("Stack trace:", error.stack);
  } finally {
    await client.close();
    console.log("\n👋 Connection closed.\n");
  }
}

// Run the audit
runDatabaseAudit().catch(console.error);
