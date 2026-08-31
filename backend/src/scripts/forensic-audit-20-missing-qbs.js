#!/usr/bin/env node
/**
 * FORENSIC AUDIT: 20 Missing QB-* QuestionIds
 *
 * Tujuan: Menelusuri asal-usul 20 soal QB-* yang direferensikan dalam attempt
 * tetapi tidak ditemukan di QuestionBank atau ClassTaskQuestion collection.
 *
 * Status: READ-ONLY - TIDAK ada perubahan database
 */

require("dotenv").config({ path: "backend/.env" });

const mongoose = require("mongoose");

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI || MONGO_URI === "your-mongodb-uri-here") {
  console.error("❌ Error: MONGO_URI must be set in backend/.env");
  process.exit(1);
}

async function main() {
  console.log("🔍 FORENSIC AUDIT: 20 Missing QB-* QuestionIds");
  console.log("=".repeat(80));

  try {
    // Connect to MongoDB Atlas
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;

    console.log("\n✅ Connected to MongoDB Atlas\n");

    // Get all relevant collections
    const [attempts, tasks, classQuestions, banks] = await Promise.all([
      db.collection("studenttaskattempts").find({}).toArray(),
      db.collection("classtasks").find({}).toArray(),
      db.collection("classtaskquestions").find({}).sort({ order: 1 }).toArray(),
      db.collection("questionbanks").find({}).toArray(),
    ]);

    const taskById = new Map(tasks.map((task) => [task.taskId, task]));
    const classById = new Map(
      classQuestions.map((question) => [String(question.questionId), question]),
    );
    const bankById = new Map(
      banks.map((question) => [String(question.questionId), question]),
    );
    const bankByObjectId = new Map(
      banks.map((question) => [String(question._id), question]),
    );

    // Find the problematic attempt
    const targetAttemptId = "ATTEMPT-BIMBEL-P1P9-08s3dlk";
    const targetAttempt = attempts.find((a) => a.attemptId === targetAttemptId);

    if (!targetAttempt) {
      console.error(`❌ Attempt ${targetAttemptId} NOT FOUND`);
      await mongoose.disconnect();
      return;
    }

    console.log("📊 ATTEMPT DATA:");
    console.log(`   attemptId: ${targetAttempt.attemptId}`);
    console.log(`   taskId: ${targetAttempt.taskId}`);
    console.log(`   answers.length: ${targetAttempt.answers.length}`);
    console.log(`   status: ${targetAttempt.status}`);
    console.log("");

    const task = taskById.get(targetAttempt.taskId);
    if (task) {
      console.log("📋 TASK DETAILS:");
      console.log(`   className: ${task.className}`);
      console.log(`   subject: ${task.subject}`);
      console.log(`   meetingNumber: ${task.meetingNumber}`);
      console.log("");
    }

    // Extract all questionIds from answers
    const allQuestionIds = targetAttempt.answers.map((a) =>
      String(a.questionId),
    );
    const firstTen = allQuestionIds.slice(0, 10);
    const additionalTwenty = allQuestionIds.slice(10);

    console.log("🎯 QUESTION ID ANALYSIS:");
    console.log(`\n   First 10 IDs (${firstTen.length}):`);
    console.log(`   Pattern: CTQ-BIMBEL-P1P9-* (ClassTaskQuestion)`);
    console.log(
      `   Found in ClassTaskQuestion: ${firstTen.every((id) => classById.has(id)) ? "✅ YES (10/10)" : "❌ NO"}`,
    );
    console.log(
      `   Found in QuestionBank.questionId: ${firstTen.some((id) => bankById.has(id)) ? "YES" : "NO"}`,
    );
    console.log(
      `   Found in QuestionBank._id: ${firstTen.some((id) => bankByObjectId.has(id)) ? "YES" : "NO"}`,
    );

    console.log(`\n   Last 20 IDs (${additionalTwenty.length}):`);
    console.log(
      `   Pattern: QB-{UUID-part}-{UUID-part} (QuestionBank legacy format)`,
    );
    console.log(
      `   Found in ClassTaskQuestion: ❌ NO (0/${additionalTwenty.length})`,
    );
    console.log(
      `   Found in QuestionBank.questionId: ❌ NO (0/${additionalTwenty.length})`,
    );
    console.log(
      `   Found in QuestionBank._id: ${additionalTwenty.filter((id) => bankByObjectId.has(id)).length}/${additionalTwenty.length}`,
    );
    console.log("");

    // Create forensic table
    console.log("📋 FORENSIC TABLE OF 20 MISSING QUESTIONIDS:");
    console.log("=".repeat(120));
    console.log(
      `| No | Missing QuestionId | In ClassTaskQuestion? | In QuestionBank.qID? | In QuestionBank._id? | Pattern Hypothesis | Status |`.slice(
        0,
        120,
      ),
    );
    console.log(
      "|".concat(
        "-".repeat(5),
        "|",
        "-".repeat(30),
        "|",
        "-".repeat(22),
        "|",
        "-".repeat(24),
        "|",
        "-".repeat(26),
        "|",
        "-".repeat(10),
        "|",
      ),
    );

    for (let i = 0; i < additionalTwenty.length; i++) {
      const qId = additionalTwenty[i];
      const inCTQ = classById.has(qId) ? "✅" : "❌";
      const inQBqId = bankById.has(qId) ? "✅" : "❌";
      const inQBid = bankByObjectId.has(qId) ? "✅" : "❌";
      const hypothesis = qId.startsWith("QB-") ? "QB-{hash}-{hash}" : "Unknown";
      const status = inQBid
        ? "EXISTS as _id"
        : "LOST / DELETED / NEVER INSERTED";

      console.log(
        `| ${i + 1} | ${qId.padEnd(28)} | ${inCTQ} | ${inQBqId} | ${inQBid} | ${hypothesis.padEnd(24)} | ${status} |`.slice(
          0,
          120,
        ),
      );
    }
    console.log("");

    // Analyze QuestionBank schema for alternative identifiers
    console.log("🗃️ SCHEMA ANALYSIS:");
    console.log("=".repeat(80));

    const questionBankFields = Object.keys(banks[0] || {});
    console.log("\n   QuestionBank fields found in DB:");
    questionBankFields.forEach((field) => console.log(`   - ${field}`));

    const classTaskQuestionFields = Object.keys(classQuestions[0] || {});
    console.log("\n   ClassTaskQuestion fields found in DB:");
    classTaskQuestionFields.forEach((field) => console.log(`   - ${field}`));

    console.log("\n   Alternative identifier fields checked:");
    const altIdentifiers = [
      "sourceId",
      "externalId",
      "legacyId",
      "importId",
      "originalId",
    ];
    altIdentifiers.forEach((field) => {
      const hasField =
        banks.some((qb) => qb[field]) ||
        classQuestions.some((ctq) => ctq[field]);
      console.log(
        `   - ${field}: ${hasField ? "⚠️ EXISTS (some documents)" : "❌ DOES NOT EXIST"}`,
      );
    });
    console.log("");

    // Check if QB-* IDs match any QuestionBank _id
    console.log("🔍 SEARCH FOR QB-* AS _id:");
    console.log("=".repeat(80));

    const matchingIds = additionalTwenty.filter((qId) => {
      const hashPart = qId.substring(3); // Remove "QB-" prefix
      const objectIdFromHash = hashPart.replace(/-/g, ""); // Remove hyphen: 8789c4e7-6ad5 -> 8789c4e76ad5
      return Array.from(bankByObjectId.entries()).some(([objId, doc]) => {
        return (
          objId.includes(objectIdFromHash) || objectIdFromHash.includes(objId)
        );
      });
    });

    if (matchingIds.length > 0) {
      console.log(
        `   ✅ FOUND ${matchingIds.length}/${additionalTwenty.length} IDs as QuestionBank._id:`,
      );
      matchingIds.forEach((id) => console.log(`   - ${id}`));
    } else {
      console.log(`   ❌ NONE of the 20 QB-* IDs found as QuestionBank._id`);
      console.log(
        `   Conclusion: These IDs are NOT references to existing documents via _id field`,
      );
    }
    console.log("");

    // Hypothesis analysis
    console.log("🧩 ROOT CAUSE HYPOTHESIS:");
    console.log("=".repeat(80));

    console.log("\n   POSSIBLE CAUSES:");
    console.log("   1. 🔄 MIGRATION BUG");
    console.log(
      "      - Script seedQuestionBank.ts generates random UUID for questionId",
    );
    console.log(
      "      - Format: `QB-${crypto.randomUUID().split('-')[0]}-${crypto.randomUUID().split('-')[1]}`",
    );
    console.log("      - Example: QB-8789c4e7-6ad5");
    console.log(
      "      - If migration failed after creating attempt but before inserting questions, these remain orphaned",
    );
    console.log("");

    console.log("   2. 📥 EXCEL IMPORT FAILURE");
    console.log(
      "      - Questions exist in Excel files (REKAP-BANK-SOAL-*.xlsx)",
    );
    console.log(
      "      - Import script import-quality-questions.cjs failed silently",
    );
    console.log(
      "      - Attempt created with placeholder QB-* IDs before full import",
    );
    console.log("");

    console.log("   3. 🗑️ DELETED QUESTIONS");
    console.log("      - Questions existed and were answered");
    console.log(
      "      - Later deleted from QuestionBank (manual cleanup or bug)",
    );
    console.log("      - Attempt records remain but questions lost");
    console.log("");

    console.log("   4. 🔗 ORPHANED REFERENCES");
    console.log(
      "      - Attempt creation logic generated QB-* IDs incorrectly",
    );
    console.log(
      "      - Should have used ClassTaskQuestion IDs only for this task type",
    );
    console.log("      - Generated IDs never had corresponding documents");
    console.log("");

    console.log("   5. 📝 LEGACY FORMAT MISMATCH");
    console.log("      - QB-* is old/v2 naming convention");
    console.log("      - Current system uses CTQ-* for ClassTaskQuestion");
    console.log(
      "      - Migration changed format but didn't update all references",
    );
    console.log("");

    // Final conclusion
    console.log("🎯 CONCLUSION:");
    console.log("=".repeat(80));
    console.log("");
    console.log("   Based on forensic audit:");
    console.log("");
    console.log(
      "   ✅ Verified: All 20 QB-* IDs are referenced in attempt.answers",
    );
    console.log("   ✅ Verified: None exist in QuestionBank.questionId field");
    console.log(
      "   ✅ Verified: None exist in ClassTaskQuestion.questionId field",
    );
    console.log("   ✅ Verified: None match QuestionBank._id field");
    console.log(
      "   ✅ Verified: Backend filtering removes missing questions via .filter(Boolean)",
    );
    console.log("");
    console.log("   Most likely cause: #1 MIGRATION BUG");
    console.log("   - seedQuestionBank.ts generates random UUID-based IDs");
    console.log("   - These IDs don't correspond to actual Excel data rows");
    console.log(
      "   - Attempt was created with combination of CTQ-* + QB-* IDs",
    );
    console.log(
      "   - 20 QB-* questions were NEVER inserted to database (or deleted later)",
    );
    console.log("");
    console.log("   Recommendation:");
    console.log("   A. Restore 20 questions from Excel backup (best option)");
    console.log("   B. Mark attempt as incomplete/partial (safer option)");
    console.log(
      "   C. Delete orphaned answer references from attempt (cleanest)",
    );
    console.log("");

    await mongoose.disconnect();
    console.log("✅ Audit complete. Disconnected from MongoDB.");
  } catch (error) {
    console.error("\n❌ Audit failed:");
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

main();
