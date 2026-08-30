import mongoose from "mongoose";
import dotenv from "dotenv";
import { StudentTryoutAttempt } from "../models/StudentTryoutAttempt";
import { Student } from "../models/Student";
import { User } from "../models/User";

dotenv.config();

// REQUIREMENT: MONGODB_URI must be set in environment variables
if (!process.env.MONGODB_URI) {
  console.error('\n❌ ERROR: MONGODB_URI environment variable is required');
  console.error('   Please set MONGODB_URI in backend/.env file');
  console.error('   Example: MONGODB_URI=mongodb://localhost:27017/your_database');
  console.error('');
  console.error('   For Atlas cluster use:');
  console.error('   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database');
  console.error('');
  process.exit(1);
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
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
