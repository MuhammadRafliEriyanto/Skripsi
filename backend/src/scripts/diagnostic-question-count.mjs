/**
 * DIAGNOSTIC SCRIPT: Compare POST /cbt/start response vs GET /cbt/session response
 * This proves whether the issue is in question count between start and session calls.
 */

import mongoose from "mongoose";
import * as models from "../models/index.js";
const { ClassTask, StudentTaskAttempt, QuestionBank } = models;

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/bimbel_new";

async function connectDB() {
  await mongoose.connect(MONGODB_URI);
  console.log("✅ Connected to MongoDB");
}

async function findTestAttempt(taskId, studentId) {
  // Find attempt with taskId and studentId (should be TEST-XXXXXXX format)
  const attempts = await StudentTaskAttempt.find({
    taskId,
    studentId,
  }).sort({ createdAt: -1 });

  console.log(
    `\n📊 Found ${attempts.length} attempts for taskId=${taskId}, studentId=${studentId}`,
  );

  // Show last 5 attempts
  const recentAttempts = attempts.slice(0, 5).map((a) => ({
    attemptId: a.attemptId,
    status: a.status,
    answersCount: a.answers?.length || 0,
    startedAt: a.startedAt,
  }));

  console.log("Recent attempts:");
  recentAttempts.forEach((a, i) => {
    console.log(
      `  ${i + 1}. attemptId=${a.attemptId}, status=${a.status}, answersCount=${a.answersCount}`,
    );
  });

  return attempts;
}

async function analyzeQuestionsInDatabase(attempt) {
  if (!attempt.answers?.length) {
    console.log("❌ No answers in attempt!");
    return;
  }

  const questionIds = attempt.answers.map((a) => a.questionId);
  console.log(`\n🔍 Analyzing ${questionIds.length} question IDs in attempt:`);

  // Query database for these questions
  const bankQuestions = await QuestionBank.find({
    questionId: { $in: questionIds },
  }).lean();

  console.log(
    `✅ Database has ${bankQuestions.length} matching questions from QuestionBank`,
  );

  // Check if all question IDs are present in database
  const foundQuestionIds = new Set(bankQuestions.map((q) => q.questionId));
  const missingQuestionIds = questionIds.filter(
    (id) => !foundQuestionIds.has(id),
  );

  if (missingQuestionIds.length > 0) {
    console.log(
      `⚠️ Missing ${missingQuestionIds.length} questions in database`,
    );
    console.log("Missing:", missingQuestionIds.slice(0, 10).join(", "));
  } else {
    console.log("✅ All questions exist in database");
  }

  // Show sample
  console.log("\nSample question IDs from attempt:");
  questionIds.slice(0, 3).forEach((id, i) => {
    const dbQ = bankQuestions.find((q) => q.questionId === id);
    console.log(
      `  ${i + 1}. ${id} -> ${dbQ ? "EXISTS" : "MISSING"} (${dbQ?.subject || "no data"})`,
    );
  });
}

async function main() {
  await connectDB();

  console.log("\n========================================");
  console.log("DIAGNOSTIC: Question Count Analysis");
  console.log("========================================\n");

  // Look for recent attempts (either from E2E test or browser)
  const tasks = await ClassTask.find().limit(5);

  for (const task of tasks) {
    console.log(`\n📋 Checking task: ${task.taskId} (${task.title})`);

    // Get recent students
    const attempts = await findTestAttempt(
      task.taskId,
      "689f4c3d7e2b1a3c4d5e6f7a",
    ); // Example student ID

    if (attempts.length > 0) {
      for (const attempt of attempts) {
        console.log(`\n┌─────────────────────────────────────`);
        console.log(`│ Attempt: ${attempt.attemptId}`);
        console.log(`├─────────────────────────────────────`);

        // Count answers in database
        await analyzeQuestionsInDatabase(attempt);

        console.log(`└─────────────────────────────────────`);
      }
    }
  }

  await mongoose.disconnect();
  console.log("\n✅ Done");
}

main().catch(console.error);
