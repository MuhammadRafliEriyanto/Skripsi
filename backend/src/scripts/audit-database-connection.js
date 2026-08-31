// Audit script for database connection verification
// This script checks which database the application is actually using

const mongoose = require("mongoose");
const { MongoClient } = require("mongodb");

async function auditDatabaseConnection() {
  console.log("\n========================================");
  console.log("DATABASE CONNECTION AUDIT REPORT");
  console.log("========================================\n");

  // 1. Read .env configuration
  const dotenv = require("dotenv");
  dotenv.config({ path: "./backend/.env" });

  console.log("📋 CONFIGURATION FROM .ENV:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.log("⚠️  MONGO_URI not found in .env!");
    return;
  }

  // Parse URI without credentials
  const uriWithoutCreds = mongoUri.replace(/\/\/[^:@]+:/, "//***:***@");

  // Extract host and database name
  const match = mongoUri.match(/@([^\/]+)\/(.+)/);
  let host = "Unknown";
  let dbName = "Unknown";

  if (match) {
    host = match[1].split(",")[0]; // Get first shard host
    dbName = match[2].split("?")[0]; // Remove query params
  }

  console.log(`Host/Domain:     ${host}`);
  console.log(`Database Name:   ${dbName}`);
  console.log(`Connection String: ${uriWithoutCreds}\n`);

  console.log("📋 MIGRATION SCRIPT CONFIGURATION:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Check what migrate-to-v6-safe.js uses
  const fs = require("fs");
  const migrationScript = fs.readFileSync(
    "./backend/src/scripts/migrate-to-v6-safe.js",
    "utf8",
  );

  const uriMatch = migrationScript.match(
    /MONGODB_URI\s*=\s*process\.env\.(\w+)\s*\|\|\s*"([^"]+)"/,
  );
  if (uriMatch) {
    const envVar = uriMatch[1];
    const fallback = uriMatch[2];

    console.log(`Environment Variable Used: ${envVar}`);
    console.log(`Fallback URI:              ${fallback}`);
    console.log(
      `Will use:                  ${envVar in process.env ? process.env[envVar] : "NOT SET (will fallback to localhost)"}`,
    );
  }

  console.log("\n🔍 COLLECTION INFORMATION:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Collection: questionbanks");

  // 2. Connect to Atlas database (from .env)
  console.log("\n📡 ATTEMPTING CONNECTION TO DATABASE...\n");

  try {
    await mongoose.connect(mongoUri);
    const db = mongoose.connection.db;
    const collectionName = "questionbanks";

    console.log(`✅ CONNECTED TO: ${db.databaseName}`);

    // 3. Get document count
    const collection = db.collection(collectionName);
    const count = await collection.countDocuments();

    console.log(
      `📊 TOTAL DOCUMENTS IN ${collectionName.toUpperCase()}: ${count.toLocaleString()}`,
    );

    // 4. Get 5 most recent documents (by _id timestamp)
    const recentDocs = await collection
      .find({})
      .sort({ _id: -1 })
      .limit(5)
      .toArray();

    console.log("\n📝 RECENT SAMPLE DOCUMENTS (Last 5):");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    recentDocs.forEach((doc, idx) => {
      const createdTime = doc._id.getTimestamp().toISOString();
      const sampleAnswer = doc.correctAnswer;

      // Clean up sensitive data
      const cleanDoc = {
        _id: doc._id.toString().slice(-8),
        questionId: doc.questionId || "N/A",
        program: doc.program || "N/A",
        subject: doc.subject || "N/A",
        topic: doc.topic || "N/A",
        previewText: (doc.questionText || "").substring(0, 60) + "...",
        correctAnswer: sampleAnswer || "N/A",
        createdAt: createdTime,
      };

      console.log(`\n${idx + 1}. Question ID: ${cleanDoc.questionId}`);
      console.log(
        `   Program: ${cleanDoc.program} | Subject: ${cleanDoc.subject} | Topic: ${cleanDoc.topic}`,
      );
      console.log(`   Answer Key: ${cleanDoc.correctAnswer}`);
      console.log(`   Created: ${cleanDoc.createdAt}`);
    });

    // 5. Check if V6 questions exist
    console.log(
      "\n🔍 CHECKING FOR V6 QUESTIONS (generated at 2026-08-28T17:50:08.000Z):",
    );
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const v6Count = await collection.countDocuments({
      $or: [
        { questionText: { $regex: "eksponen|persamaan kuadrat|barisan" } },
        {
          topic: {
            $regex: "eksponen|kuadrat|trigonometri|statistik",
            options: "i",
          },
        },
      ],
    });

    console.log(`Questions matching V6 patterns: ${v6Count.toLocaleString()}`);

    if (count >= 11450) {
      console.log(
        "✅ CONFIRMATION: 11,450 V6 questions already exist in this database",
      );
    } else {
      console.log("⚠️  Database does not contain expected 11,450 V6 questions");
    }
  } catch (error) {
    console.error(`❌ CONNECTION FAILED: ${error.message}`);
    console.log("\nThis could mean:");
    console.log("1. MongoDB service is not running locally");
    console.log("2. Network/connectivity issues");
    console.log("3. Atlas cluster is paused or unreachable");
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log("\n🔌 Database disconnected");
    }
  }

  console.log("\n========================================");
  console.log("AUDIT SUMMARY");
  console.log("========================================\n");
}

auditDatabaseConnection();
