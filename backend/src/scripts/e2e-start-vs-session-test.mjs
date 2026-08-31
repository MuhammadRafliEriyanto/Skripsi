/**
 * E2E VALIDATION SCRIPT: Prove whether frontend receives correct question count
 * This script simulates the exact flow from POST /cbt/start -> GET /cbt/session
 */

import mongoose from "mongoose";
import { ClassTask } from "../models/ClassTask.js";
import { StudentTaskAttempt } from "../models/StudentTaskAttempt.js";
import { QuestionBank } from "../models/QuestionBank.js";
import fetch from "node-fetch";

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/bimbel_new";
const BACKEND_BASE_URL =
  process.env.BACKEND_BASE_URL || "http://localhost:3001";

async function connectDB() {
  await mongoose.connect(MONGODB_URI);
  console.log("✅ Connected to MongoDB");
}

async function cleanupOldAttempts(taskId, studentId) {
  console.log(
    `\n🧹 Cleaning old attempts for taskId=${taskId}, studentId=${studentId}`,
  );
  const result = await StudentTaskAttempt.deleteMany({
    taskId,
    studentId,
  });
  console.log(`   Deleted ${result.deletedCount} old attempts`);
}

async function startNewAttempt(taskId, studentId, authToken) {
  console.log(
    `\n🚀 STEP 1: POST /api/student/me/learning/tasks/cbt/${taskId}/start`,
  );

  const response = await fetch(
    `${BACKEND_BASE_URL}/api/student/me/learning/tasks/cbt/${taskId}/start`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`❌ Start failed: ${response.status} ${data.message}`);
  }

  const attemptId = data.data?.myAttempt?.attemptId;
  const initialQuestionCount = data.data?.questions?.length || 0;

  console.log(`   ✅ Started attempt: ${attemptId}`);
  console.log(`   📊 Initial questions in response: ${initialQuestionCount}`);
  console.log(`   📊 Expected: 30`);

  return { attemptId, initialQuestionCount };
}

async function getSessionQuestions(attemptId, studentId, authToken) {
  console.log(
    `\n🔄 STEP 2: GET /api/student/me/learning/tasks/cbt/${attemptId}`,
  );

  const response = await fetch(
    `${BACKEND_BASE_URL}/api/student/me/learning/tasks/cbt/${attemptId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`❌ Session failed: ${response.status} ${data.message}`);
  }

  const sessionQuestionCount = data.data?.questions?.length || 0;
  const myAttempt = data.data?.myAttempt;

  console.log(`   ✅ Session retrieved successfully`);
  console.log(`   📊 Questions in response: ${sessionQuestionCount}`);
  console.log(`   📊 Attempt ID: ${myAttempt?.attemptId}`);
  console.log(`   📊 Status: ${myAttempt?.status}`);

  return { sessionQuestionCount, answers: myAttempt?.answers };
}

async function verifyDatabaseAnswers(attemptId, studentId) {
  console.log(`\n💾 STEP 3: Verify database directly`);

  const attempt = await StudentTaskAttempt.findOne({
    attemptId,
    studentId,
  });

  if (!attempt) {
    throw new Error(`❌ Attempt not found in database!`);
  }

  const dbAnswerCount = attempt.answers?.length || 0;
  const dbQuestionIds = attempt.answers.map((a) => a.questionId);

  // Fetch actual questions from database
  const bankQuestions = await QuestionBank.find({
    questionId: { $in: dbQuestionIds },
  }).lean();

  console.log(`   ✅ Found attempt in database`);
  console.log(`   📊 Database answers count: ${dbAnswerCount}`);
  console.log(`   📊 Questions found in QuestionBank: ${bankQuestions.length}`);

  if (dbAnswerCount !== bankQuestions.length) {
    console.log(
      `   ⚠️ WARNING: Mismatch! Answers:${dbAnswerCount} vs BankQuestions:${bankQuestions.length}`,
    );
  }

  return { attempt, dbAnswerCount, bankQuestions };
}

async function compareStartVsSession(startData, sessionData, dbData) {
  console.log(`\n========================================`);
  console.log("🔍 COMPARISON ANALYSIS");
  console.log("========================================\n");

  console.log(`┌─────────────────────┬──────────┬──────────┬──────────┐`);
  console.log(`│ Source              │ Count    │ Status   │ Verdict  │`);
  console.log(`├─────────────────────┼──────────┼──────────┼──────────┤`);
  console.log(
    `│ POST /start         │ ${String(startData.count).padEnd(8)} │ OK       │ ${startData.count === 30 ? "✅ CORRECT" : "❌ WRONG"}     │`,
  );
  console.log(`├─────────────────────┼──────────┼──────────┼──────────┤`);
  console.log(
    `│ GET /session        │ ${String(sessionData.count).padEnd(8)} │ OK       │ ${sessionData.count === 30 ? "✅ CORRECT" : "❌ WRONG"}     │`,
  );
  console.log(`├─────────────────────┼──────────┼──────────┼──────────┤`);
  console.log(
    `│ Database            │ ${String(dbData.count).padEnd(8)} │ OK       │ ${dbData.count === 30 ? "✅ CORRECT" : "❌ WRONG"}     │`,
  );
  console.log(`└─────────────────────┴──────────┴──────────┴──────────┘`);

  console.log("\n🎯 ROOT CAUSE INDICATION:");

  if (
    startData.count === 30 &&
    sessionData.count === 30 &&
    dbData.count === 30
  ) {
    console.log("   ✅ ALL DATA POINTS ARE CORRECT - Frontend issue suspected");
    console.log("   The backend is returning 30 questions everywhere.");
    console.log("   Browser UI must be filtering/slicing somewhere.");
  } else if (startData.count === 30 && sessionData.count !== 30) {
    console.log("   ❌ DISCREPANCY between POST and GET!");
    console.log("   Root cause: GET endpoint is losing questions.");
    console.log(
      "   Check getStudentClassTaskCbt handler or getAttemptQuestions function.",
    );
  } else if (startData.count !== 30) {
    console.log("   ❌ START endpoint problem!");
    console.log(
      "   Root cause: sampleStudentTaskQuestions or initialization logic.",
    );
  } else {
    console.log("   ❓ Mixed results - needs deeper investigation");
  }
}

async function runTest() {
  const taskId = "TASK-649b82c65e689f051e0a3d66"; // Example task ID
  const studentId = "689f4c3d7e2b1a3c4d5e6f7a"; // Example student ID
  const authToken = process.env.AUTH_TOKEN || ""; // You need to provide this

  if (!authToken) {
    console.log("⚠️  Please set AUTH_TOKEN environment variable");
    console.log("   Run: export AUTH_TOKEN=<your_token>");
    return;
  }

  try {
    await connectDB();

    console.log("\n========================================");
    console.log("E2E FLOW TEST: Start vs Session Comparison");
    console.log("========================================\n");

    // Step 1: Cleanup
    await cleanupOldAttempts(taskId, studentId);

    // Step 2: Start new attempt
    const startResult = await startNewAttempt(taskId, studentId, authToken);

    // Step 3: Get session (simulates browser call)
    const sessionResult = await getSessionQuestions(
      startResult.attemptId,
      studentId,
      authToken,
    );

    // Step 4: Verify database directly
    const dbResult = await verifyDatabaseAnswers(
      startResult.attemptId,
      studentId,
    );

    // Step 5: Compare
    await compareStartVsSession(
      { count: startResult.initialQuestionCount },
      { count: sessionResult.sessionQuestionCount },
      { count: dbResult.dbAnswerCount },
    );
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
  }
}

runTest().catch(console.error);
