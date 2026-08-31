/**
 * DIAGNOSTIC SCRIPT: Direct database query to verify attempt question counts
 * This bypasses imports and connects directly to MongoDB
 */

import mongoose from "mongoose";

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/bimbel_new";

async function connectDB() {
  await mongoose.connect(MONGODB_URI);
  console.log("✅ Connected to MongoDB");
}

async function findRecentAttempts() {
  const StudentTaskAttempt = (await import("../models/StudentTaskAttempt"))
    .StudentTaskAttempt;

  console.log("\n========================================");
  console.log("🔍 RECENT ATTEMPTS ANALYSIS");
  console.log("========================================\n");

  // Get last 10 attempts sorted by created_at descending
  const recentAttempts = await StudentTaskAttempt.find()
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  console.log(`Found ${recentAttempts.length} recent attempts:\n`);

  for (const attempt of recentAttempts) {
    const answersCount = attempt.answers?.length || 0;
    const correctCount = attempt.correctCount || 0;
    const wrongCount = attempt.wrongCount || 0;
    const unansweredCount = attempt.unansweredCount || 0;
    const totalAnswered = correctCount + wrongCount;

    console.log(`┌─────────────────────────────────────`);
    console.log(`│ Attempt ID: ${attempt.attemptId}`);
    console.log(`├─────────────────────────────────────`);
    console.log(`│ Task ID: ${attempt.taskId}`);
    console.log(`│ Student ID: ${attempt.studentId}`);
    console.log(`│ Status: ${attempt.status}`);
    console.log(`│ Answers Count: ${answersCount}`);
    console.log(
      `│ Correct: ${correctCount}, Wrong: ${wrongCount}, Unanswered: ${unansweredCount}`,
    );
    console.log(`│ Started At: ${attempt.startedAt?.toISOString()}`);
    console.log(
      `│ Submitted At: ${attempt.submittedAt?.toISOString() || "null"}`,
    );
    console.log(`└─────────────────────────────────────\n`);

    // Check if this is the TEST attempt
    if (attempt.attemptId.startsWith("TEST-")) {
      console.log(`  ✅ FOUND TEST ATTEMPT! Checking question details...`);

      if (attempt.answers && attempt.answers.length > 0) {
        const questionIds = attempt.answers.map((a) => a.questionId);
        console.log(
          `  📝 Question IDs in test attempt (${questionIds.length}):`,
        );
        questionIds.slice(0, 10).forEach((qid, i) => {
          console.log(`    ${i + 1}. ${qid}`);
        });
        if (questionIds.length > 10) {
          console.log(`    ... and ${questionIds.length - 10} more`);
        }
      }
    }
  }

  return recentAttempts;
}

async function verifyTestAttemptByPattern(taskId, studentId) {
  const StudentTaskAttempt = (await import("../models/StudentTaskAttempt"))
    .StudentTaskAttempt;

  console.log("\n========================================");
  console.log("🎯 SPECIFIC SEARCH: TASK + STUDENT COMBINATION");
  console.log("========================================\n");

  console.log(`Searching for tasks with specific student patterns...\n`);

  // Get all unique taskIds
  const allAttempts = await StudentTaskAttempt.find().distinct("taskId");

  console.log(`Found ${allAttempts.length} unique taskId(s):`);
  allAttempts.forEach((id) => console.log(`  - ${id}`));

  if (allAttempts.length === 0) {
    console.log("  No attempts found in database!");
    return;
  }

  // For each task, check attempts
  for (const taskId of allAttempts.slice(0, 3)) {
    console.log(`\n📋 Task: ${taskId}`);

    const taskAttempts = await StudentTaskAttempt.find({ taskId }).sort({
      createdAt: -1,
    });

    console.log(`   Found ${taskAttempts.length} attempts for this task`);

    taskAttempts.slice(0, 5).forEach((attempt, i) => {
      console.log(
        `   ${i + 1}. ${attempt.attemptId}: ${attempt.answers?.length || 0} answers, status=${attempt.status}`,
      );
    });
  }
}

async function main() {
  try {
    await connectDB();

    // Run analysis
    await findRecentAttempts();
    await verifyTestAttemptByPattern();

    console.log("\n========================================");
    console.log("✅ DIAGNOSTIC COMPLETE");
    console.log("========================================\n");
    console.log("Key findings:");
    console.log("1. Recent attempts show actual answer counts in MongoDB");
    console.log("2. If E2E test created 30 answers, it should appear here");
    console.log("3. Browser GET /cbt/:attemptId returns what's stored in DB");
    console.log("\nIf database shows 30 but browser shows 10,");
    console.log("the issue is FRONTEND rendering/state management.");
  } catch (error) {
    console.error("❌ Diagnostic failed:", error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
  }
}

main();
