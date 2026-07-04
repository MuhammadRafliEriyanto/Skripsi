import mongoose from "mongoose";
import * as dotenv from "dotenv";

// Load environment variables from .env if needed
dotenv.config();

// Imports models
import { Schedule } from "../models/Schedule";
import { ClassTask } from "../models/ClassTask";
import { TeacherTryout } from "../models/TeacherTryout";

const LEGACY_YEAR = "2025/2026";
const LEGACY_SEMESTER = "Genap";

async function runMigration() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error("MONGO_URI is required. Set it in backend/.env before running this script.");
  }

  console.log("Connecting to MongoDB from MONGO_URI.");

  try {
    await mongoose.connect(uri);
    console.log("Connected to MongoDB successfully.");

    const filter = {
      $or: [
        { academicYear: { $exists: false } },
        { academicYear: null },
        { academicYear: "" },
      ],
    };

    const update = {
      $set: {
        academicYear: LEGACY_YEAR,
        semester: LEGACY_SEMESTER,
      },
    };

    console.log("Starting migration for Schedule...");
    const scheduleResult = await Schedule.updateMany(filter, update);
    console.log(`Schedule updated: ${scheduleResult.modifiedCount} documents.`);

    console.log("Starting migration for ClassTask...");
    const taskResult = await ClassTask.updateMany(filter, update);
    console.log(`ClassTask updated: ${taskResult.modifiedCount} documents.`);

    console.log("Starting migration for TeacherTryout...");
    const tryoutResult = await TeacherTryout.updateMany(filter, update);
    console.log(`TeacherTryout updated: ${tryoutResult.modifiedCount} documents.`);

    console.log("✅ Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

void runMigration();
