/**
 * SPECIFIC SEARCH: Find TEST-* pattern attempts and compare counts
 */

import mongoose from "mongoose";

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/bimbel_new";

async function connectDB() {
  await mongoose.connect(MONGODB_URI);
  console.log("✅ Connected to MongoDB");
}

async function findTestAttempts() {
  const db = mongoose.connection.db;
  const collection = db.collection("studenttaskattempts");

  console.log("\n========================================");
  console.log("🔎 SPECIFIC SEARCH FOR TEST* ATTEMPTS");
  console.log("========================================\n");

  // Search for any attempt starting with 'TEST'
  const testAttempts = await collection
    .find({
      attemptId: { $regex: "^TEST-", $options: "i" },
    })
    .sort({ createdAt: -1 })
    .toArray();

  console.log(
    `Found ${testAttempts.length} attempts matching pattern "TEST*"\n`,
  );

  if (testAttempts.length === 0) {
    console.log("No TEST-* attempts found in database.");
    console.log("\nThis means either:");
    console.log("1. E2E test created attempt with different naming convention");
    console.log("2. Test attempt was cleaned up after run");
    console.log("3. Different student/class combination than searched\n");
    return;
  }

  let totalAnswers = 0;
  let countByPattern = {};

  for (const attempt of testAttempts) {
    const answersCount = attempt.answers?.length || 0;
    totalAnswers += answersCount;

    // Extract numeric part from attemptId
    const numericPart = attempt.attemptId.match(/(\d+)/)?.[0] || "N/A";

    console.log(`┌─────────────────────────────────────`);
    console.log(`│ Attempt ID: ${attempt.attemptId}`);
    console.log(`├─────────────────────────────────────`);
    console.log(`│ Task ID: ${attempt.taskId}`);
    console.log(`│ Student ID: ${attempt.studentId}`);
    console.log(`│ Status: ${attempt.status}`);
    console.log(`│ Answers Count: ${answersCount}`);
    console.log(`│ Expected: 30`);
    console.log(
      `│ Result: ${answersCount === 30 ? "✅ CORRECT" : "❌ WRONG"} ` +
        `(difference: ${30 - answersCount})`,
    );

    // Track patterns
    if (!countByPattern[answersCount]) {
      countByPattern[answersCount] = 0;
    }
    countByPattern[answersCount]++;

    console.log(
      `│ Started At: ${attempt.startedAt ? new Date(attempt.startedAt).toISOString() : "null"}`,
    );
    console.log(`└─────────────────────────────────────\n`);
  }

  // Summary
  console.log("========================================");
  console.log("ANSWER COUNT PATTERN ANALYSIS");
  console.log("========================================");

  Object.entries(countByPattern).forEach(([count, freq]) => {
    const percentage = ((freq / testAttempts.length) * 100).toFixed(1);
    console.log(
      `${count} answers: ${freq}/${testAttempts.length} (${percentage}%)`,
    );
  });

  console.log(`\nTotal TEST attempts: ${testAttempts.length}`);
  console.log(`Total answers across all: ${totalAnswers}`);
  console.log(
    `Average answers per attempt: ${(totalAnswers / testAttempts.length).toFixed(1)}`,
  );

  if (countByPattern[10] > 0) {
    console.log(
      `\n⚠️  WARNING: Found ${countByPattern[10]} attempt(s) with exactly 10 answers!`,
    );
    console.log("This matches the browser symptom you're seeing.");
    console.log("\nHYPOTHESIS: Either");
    console.log("1. These are OLD attempts created with wrong config");
    console.log("2. There's a fallback path that creates 10-question attempts");
    console.log("3. Some attempts get truncated during processing");
  }

  return testAttempts;
}

async function checkAllPossibleNames() {
  console.log("\n========================================");
  console.log("🔍 CHECK ALL ATTEMPT NAMING PATTERNS");
  console.log("========================================\n");

  const db = mongoose.connection.db;
  const collection = db.collection("studenttaskattempts");

  // Get sample of unique naming patterns
  const patternsSample = await collection
    .aggregate([
      {
        $group: {
          _id: "$attemptId",
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
      {
        $limit: 20,
      },
    ])
    .toArray();

  console.log("Sample of attempt IDs (showing naming conventions):");
  patternsSample.forEach((item, i) => {
    console.log(`  ${i + 1}. ${item._id}`);
  });
}

async function main() {
  try {
    await connectDB();

    await findTestAttempts();
    await checkAllPossibleNames();
  } catch (error) {
    console.error("❌ Diagnostic failed:", error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
  }
}

main();
