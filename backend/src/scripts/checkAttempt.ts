import mongoose from "mongoose";
import dotenv from "dotenv";
import { StudentTryoutAttempt } from "../models/StudentTryoutAttempt";
import { Student } from "../models/Student";
import { User } from "../models/User";

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/bimbel-new");
  
  const attempts = await StudentTryoutAttempt.find().lean();
  console.log(`Found ${attempts.length} total attempts in db.`);
  if (attempts.length > 0) {
      console.log("Last 5 attempts:", JSON.stringify(attempts.slice(-5), null, 2));
  }
  
  const students = await Student.find().lean();
  console.log(`\nFound ${students.length} total students.`);
  if (students.length > 0) {
      console.log("Sample student:", JSON.stringify(students[0], null, 2));
  }
  
  process.exit(0);
}

run().catch(console.error);
