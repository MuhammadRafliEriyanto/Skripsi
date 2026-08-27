import fs from "fs";
import path from "path";
import * as xlsx from "xlsx";
import mongoose from "mongoose";
import dotenv from "dotenv";
import crypto from "crypto";

import { QuestionBank } from "../models/QuestionBank";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function main() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("MONGO_URI is not defined in .env");
  }

  console.log("Menghubungkan ke MongoDB...");
  await mongoose.connect(mongoUri);
  console.log("Berhasil terhubung ke MongoDB.");

  const inputPath = path.resolve(__dirname, "../../../outputs/assessment-bank-rekap/rekap-bank-soal-bimbel-bina-cendekia-ber-sumber-V2.xlsx");
  if (!fs.existsSync(inputPath)) {
    throw new Error(`File tidak ditemukan: ${inputPath}`);
  }

  console.log(`Membaca file Excel dari: ${inputPath}`);
  const wb = xlsx.readFile(inputPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json<any>(ws);

  console.log(`Total data terbaca: ${data.length} baris.`);
  console.log("Membersihkan data lama di QuestionBank (jika ada)...");
  await QuestionBank.deleteMany({});

  console.log("Menyisipkan data ke database...");
  const BATCH_SIZE = 500;
  let inserted = 0;

  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE).map((row) => ({
      questionId: `QB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      program: row["Program/Kelas"],
      subject: row["Mata Pelajaran"],
      topic: row["Topik/Materi"],
      questionText: row["Soal"],
      optionA: row["Opsi A"],
      optionB: row["Opsi B"],
      optionC: row["Opsi C"],
      optionD: row["Opsi D"],
      correctAnswer: row["Kunci Jawaban"],
      explanation: row["Pembahasan"] || "",
      difficulty: row["Tingkat Kesulitan"] || "Sedang",
    }));

    await QuestionBank.insertMany(batch);
    inserted += batch.length;
    console.log(`Telah memproses ${inserted} / ${data.length} soal...`);
  }

  console.log(`Berhasil menyimpan ${inserted} soal ke QuestionBank!`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Gagal melakukan seeding QuestionBank:", err);
  process.exit(1);
});
