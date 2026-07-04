import mongoose from "mongoose";
import { Student } from "../models/Student";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function run() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error("MONGO_URI is required. Set it in backend/.env before running this script.");
  }

  console.log("Connecting to MongoDB from MONGO_URI.");
  await mongoose.connect(uri);
  
  const result = await Student.updateMany(
    { academicYear: { $exists: false } },
    { $set: { academicYear: "2025/2026" } }
  );
  
  console.log(`Migration complete. Modified ${result.modifiedCount} documents.`);
  process.exit(0);
}

run().catch(console.error);
