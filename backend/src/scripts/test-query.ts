import mongoose from "mongoose";
import * as dotenv from "dotenv";

dotenv.config();

import { Schedule } from "../models/Schedule";

async function runTest() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error("MONGO_URI is required. Set it in backend/.env before running this script.");
  }

  console.log("Connecting to MongoDB from MONGO_URI.");

  try {
    await mongoose.connect(uri);
    console.log("Connected.");

    const year2025 = await Schedule.find({ academicYear: "2025/2026" }).countDocuments();
    const year2026 = await Schedule.find({ academicYear: "2026/2027" }).countDocuments();
    const nullYear = await Schedule.find({ academicYear: null }).countDocuments();
    
    console.log("Schedules in 2025/2026:", year2025);
    console.log("Schedules in 2026/2027:", year2026);
    console.log("Schedules with null year:", nullYear);

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

runTest();
