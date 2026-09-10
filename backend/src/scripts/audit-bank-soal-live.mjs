/**
 * AUDIT BANK SOAL - READ ONLY
 * Melihat isi koleksi `questionbanks` di database bimbel-lms.
 * Tidak mengubah data apa pun.
 *
 * Usage: node src/scripts/audit-bank-soal-live.mjs
 */
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error("❌ MONGO_URI tidak ditemukan di backend/.env");
  process.exit(1);
}

const client = new MongoClient(uri);

async function main() {
  await client.connect();
  console.log("🔍 Terhubung ke MongoDB...\n");

  const db = client.db("bimbel-lms");
  const qb = db.collection("questionbanks");

  const total = await qb.countDocuments();
  console.log(`📊 TOTAL SOAL DI questionbanks: ${total.toLocaleString()}\n`);

  // Distribusi per program
  console.log("📌 DISTRIBUSI PER PROGRAM:");
  const programs = await qb
    .aggregate([
      { $group: { _id: "$program", count: { $sum: 1 }, subjects: { $addToSet: "$subject" } } },
      { $sort: { count: -1 } },
    ])
    .toArray();
  programs.forEach((p) =>
    console.log(`  • ${p._id}: ${p.count.toLocaleString()} soal (${p.subjects.length} mapel)`),
  );

  // Distribusi per subject
  console.log("\n📌 DISTRIBUSI PER MATA PELAJARAN:");
  const subjects = await qb
    .aggregate([
      { $group: { _id: "$subject", count: { $sum: 1 }, programs: { $addToSet: "$program" } } },
      { $sort: { count: -1 } },
    ])
    .toArray();
  subjects.forEach((s) =>
    console.log(`  • ${s._id}: ${s.count.toLocaleString()} soal (${s.programs.join(", ")})`),
  );

  // Distribusi per topik (top 30)
  console.log("\n📌 TOP 30 TOPIK:");
  const topics = await qb
    .aggregate([{ $group: { _id: "$topic", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 30 }])
    .toArray();
  topics.forEach((t) => console.log(`  • ${t._id}: ${t.count.toLocaleString()} soal`));

  // Sample soal
  console.log("\n🔍 SAMPLE 5 SOAL:");
  const samples = await qb.find({}).limit(5).toArray();
  samples.forEach((q, i) => {
    console.log(`\n[SOAL ${i + 1}]`);
    console.log(`  questionId: ${q.questionId}`);
    console.log(`  program: ${q.program}`);
    console.log(`  subject: ${q.subject}`);
    console.log(`  topic: ${q.topic}`);
    console.log(`  difficulty: ${q.difficulty}`);
    console.log(`  question: ${(q.questionText || q.question || "").substring(0, 120)}`);
    console.log(`  optionA: ${(q.optionA || "").substring(0, 60)}`);
    console.log(`  optionB: ${(q.optionB || "").substring(0, 60)}`);
    console.log(`  optionC: ${(q.optionC || "").substring(0, 60)}`);
    console.log(`  optionD: ${(q.optionD || "").substring(0, 60)}`);
    console.log(`  correctAnswer: ${q.correctAnswer}`);
    console.log(`  options (array?): ${Array.isArray(q.options) ? JSON.stringify(q.options).substring(0, 80) : "tidak ada"}`);
  });

  // Pola kunci jawaban
  console.log("\n🔍 POLA KUNCI JAWABAN:");
  const keys = await qb
    .aggregate([{ $group: { _id: "$correctAnswer", count: { $sum: 1 } } }, { $sort: { count: -1 } }])
    .toArray();
  keys.forEach((k) => {
    const pct = ((k.count / total) * 100).toFixed(2);
    console.log(`  • "${k._id}": ${k.count.toLocaleString()} soal (${pct}%)`);
  });

  // Cek struktur field
  console.log("\n🔍 STRUKTUR FIELD (sample keys):");
  if (samples[0]) {
    console.log("  " + Object.keys(samples[0]).join(", "));
  }

  await client.close();
  console.log("\n✅ Selesai.");
}

main().catch((err) => {
  console.error("❌ Gagal:", err);
  process.exit(1);
});