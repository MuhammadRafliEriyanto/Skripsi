/**
 * FORENSIC TRACE - List All Recent Attempts
 * READ-ONLY: DO NOT MODIFY DATABASE
 */

import mongoose from "mongoose";

async function listAttempts() {
  console.log("\n" + "=".repeat(80));
  console.log("🔍 LISTING RECENT STUDENT TASK ATTEMPTS");
  console.log("=".repeat(80));

  try {
    await mongoose.connect("mongodb://localhost:27017/bimbel-lms", {});

    const StudentTaskAttempt =
      mongoose.models.StudentTaskAttempt ||
      mongoose.model(
        "StudentTaskAttempt",
        new mongoose.Schema({}, { strict: false }),
      );

    // Get recent attempts (top 10 by updatedAt)
    const attempts = await StudentTaskAttempt.find({})
      .sort({ updatedAt: -1 })
      .limit(10)
      .lean();

    console.log(`\n📊 Found ${attempts.length} recent attempts:\n`);

    attempts.forEach((attempt, idx) => {
      console.log(`${idx + 1}. Attempt ID: ${attempt.attemptId}`);
      console.log(`   Task ID: ${attempt.taskId}`);
      console.log(`   Target Count: ${attempt.targetCount ?? "NOT SET"}`);
      console.log(`   Answers Length: ${attempt.answers?.length || 0}`);
      console.log(`   Status: ${attempt.status}`);
      console.log(
        `   Updated: ${new Date(attempt.updatedAt).toLocaleString()}\n`,
      );

      if (attempt.answers && attempt.answers.length > 0) {
        const questionIds = attempt.answers.map((a) => a.questionId);
        console.log(
          `   Question IDs: ${JSON.stringify(questionIds.slice(0, 5))}${questionIds.length > 5 ? "..." : ""}`,
        );
        console.log("");
      }
    });

    console.log("=".repeat(80) + "\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ ERROR:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

listAttempts();
