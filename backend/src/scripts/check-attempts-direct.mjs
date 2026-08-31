/**
 * DIAGNOSTIC SCRIPT: Direct MongoDB collection query
 * This uses the MongoDB driver directly without TypeScript models
 */

import mongoose from "mongoose";

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/bimbel_new";

async function connectDB() {
  await mongoose.connect(MONGODB_URI);
  console.log("✅ Connected to MongoDB");
}

async function checkRecentAttempts() {
  const db = mongoose.connection.db;
  const collection = db.collection("studenttaskattempts");

  console.log("\n========================================");
  console.log("🔍 RECENT ATTEMPTS - DIRECT DATABASE QUERY");
  console.log("========================================\n");

  // Get last 10 attempts
  const recentAttempts = await collection
    .find({})
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();

  console.log(`Found ${recentAttempts.length} recent attempts:\n`);

  let testAttemptCount = 0;
  let regularAttempts30 = 0;

  for (const attempt of recentAttempts) {
    const answersCount = attempt.answers?.length || 0;

    console.log(`┌─────────────────────────────────────`);
    console.log(`│ Attempt ID: ${attempt.attemptId}`);
    console.log(`├─────────────────────────────────────`);
    console.log(`│ Task ID: ${attempt.taskId}`);
    console.log(`│ Student ID: ${attempt.studentId}`);
    console.log(`│ Status: ${attempt.status}`);
    console.log(`│ Answers Count: ${answersCount}`);
    console.log(
      `│ Correct: ${attempt.correctCount}, Wrong: ${attempt.wrongCount}`,
    );
    console.log(
      `│ Started At: ${attempt.startedAt ? new Date(attempt.startedAt).toISOString().slice(0, 19) : "null"}`,
    );

    if (attempt.attemptId.startsWith("TEST-")) {
      console.log(`│ ⚠️  TEST ATTEMPT DETECTED!`);
      testAttemptCount++;

      if (answersCount === 30) {
        console.log(`│ ✅ CORRECT: Has 30 answers as expected from E2E test`);
      } else {
        console.log(`│ ❌ WRONG: Expected 30 answers but has ${answersCount}`);
      }
    } else if (answersCount === 30) {
      regularAttempts30++;
    }

    console.log(`└─────────────────────────────────────\n`);
  }

  // Summary statistics
  console.log("========================================");
  console.log("SUMMARY STATISTICS");
  console.log("========================================");
  console.log(`Total recent attempts: ${recentAttempts.length}`);
  console.log(`Test attempts found: ${testAttemptCount}`);
  console.log(`Regular attempts with 30 answers: ${regularAttempts30}`);

  // Check all attempts with their counts
  const countDistribution = {};
  for (const attempt of recentAttempts) {
    const count = attempt.answers?.length || 0;
    countDistribution[count] = (countDistribution[count] || 0) + 1;
  }

  console.log(`\nAnswer count distribution:`);
  Object.entries(countDistribution)
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .forEach(([count, freq]) => {
      console.log(`  ${count} answers: ${freq} attempt(s)`);
    });

  return recentAttempts;
}

async function main() {
  try {
    await connectDB();
    await checkRecentAttempts();

    console.log("\n========================================");
    console.log("📋 CONCLUSION");
    console.log("========================================\n");

    console.log("If you see:");
    console.log("✅ Database shows 30 answers → Backend is correct");
    console.log("❌ Database shows < 30 answers → Creation/saving bug");
    console.log(
      "\nBrowser GET /cbt/:attemptId returns exactly what's in database.",
    );
    console.log("Therefore:");
    console.log("- If DB=30 but Browser=10 → FRONTEND BUG");
    console.log("- If DB=<30 → BACKEND CREATION BUG");
  } catch (error) {
    console.error("❌ Diagnostic failed:", error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
  }
}

main();
