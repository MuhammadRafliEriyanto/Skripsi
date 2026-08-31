/**
 * FINAL AUDIT - Complete End-to-End Trace (READ-ONLY)
 *
 * SAMPLES:
 * A: 6a78a9948e69b0ee2905f5f2 (10 answers)
 * B: 6a7838fd7bef4fc772ca0eb3 (30 answers)
 *
 * RULES: READ-ONLY ONLY - NO WRITE OPERATIONS
 */

require("dotenv").config({ path: ".env" });
const { MongoClient } = require("mongodb");

// REQUIREMENT: MONGODB_URI must be set in environment variables
if (!process.env.MONGODB_URI) {
  console.error("\n❌ ERROR: MONGODB_URI environment variable is required");
  console.error("   Please set MONGODB_URI in backend/.env file");
  console.error(
    "   Example: MONGODB_URI=mongodb://localhost:27017/your_database",
  );
  console.error("");
  console.error("   For Atlas cluster use:");
  console.error(
    "   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database",
  );
  console.error("");
  process.exit(1);
}

const uri = process.env.MONGODB_URI;
console.log("Using MONGODB_URI:", uri.replace(/\/\/[^:@]+:/, "//***:***@"));
const client = new MongoClient(uri);

async function runAudit() {
  try {
    await client.connect();
    console.log("✅ Connected to MongoDB Atlas");

    const db = client.db("bimbel-lms");

    // =========================================================
    // SECTION 1: SAMPLE ATTEMPTS DATA
    // =========================================================
    console.log(
      "\n============================================================",
    );
    console.log("SECTION 1: SAMPLE ATTEMPTS DATA");
    console.log(
      "============================================================\n",
    );

    const sampleA = await db
      .collection("studenttaskattempts")
      .findOne({ _id: "6a78a9948e69b0ee2905f5f2" });
    const sampleB = await db
      .collection("studenttaskattempts")
      .findOne({ _id: "6a7838fd7bef4fc772ca0eb3" });

    console.log("SAMPLE A (10 answers):");
    console.log(JSON.stringify(sampleA, null, 2));

    console.log("\n\nSAMPLE B (30 answers):");
    console.log(JSON.stringify(sampleB, null, 2));

    // =========================================================
    // SECTION 2: RELATED TASKS
    // =========================================================
    console.log(
      "\n\n============================================================",
    );
    console.log("SECTION 2: RELATED TASKS");
    console.log(
      "============================================================\n",
    );

    const taskA = await db
      .collection("classtasks")
      .findOne({ _id: sampleA.taskId.toString() });
    const taskB = await db
      .collection("classtasks")
      .findOne({ _id: sampleB.taskId.toString() });

    console.log("TASK A:", JSON.stringify(taskA, null, 2));
    console.log("\n\nTASK B:", JSON.stringify(taskB, null, 2));

    // =========================================================
    // SECTION 3: CLASS TASK QUESTIONS (for Sample A)
    // =========================================================
    console.log(
      "\n\n============================================================",
    );
    console.log("SECTION 3: CLASS TASK QUESTIONS (Sample A)");
    console.log(
      "============================================================\n",
    );

    if (sampleA.answers && sampleA.answers.length > 0) {
      const questionIds = sampleA.answers.map((a) => a.questionId);
      const classTaskQuestions = await db
        .collection("classtaskquestions")
        .find({ _id: { $in: questionIds } })
        .toArray();

      console.log(`Found ${classTaskQuestions.length} ClassTaskQuestions:`);
      classTaskQuestions.forEach((ctq, i) => {
        console.log(`${i + 1}. ${ctq._id}`);
      });
    }

    // =========================================================
    // SECTION 4: QUESTION BANKS (for Sample B - questions 11-30)
    // =========================================================
    console.log(
      "\n\n============================================================",
    );
    console.log("SECTION 4: QUESTION BANKS (Sample B - last 20 questions)");
    console.log(
      "============================================================\n",
    );

    if (sampleB.answers && sampleB.answers.length >= 20) {
      const qbAnswers = sampleB.answers.slice(10, 30); // Q11-Q30
      const questionIds = qbAnswers.map((a) => a.questionId);

      const questionBanks = await db
        .collection("questionbanks")
        .find({ _id: { $in: questionIds } })
        .limit(5)
        .toArray();

      console.log(`Sampling ${questionBanks.length} QuestionBanks:`);
      questionBanks.forEach((qb, i) => {
        console.log(`${i + 1}. ID: ${qb._id}`);
        console.log(`   Program: ${qb.program || "N/A"}`);
        console.log(`   Mapel: ${qb.mapel || "N/A"}`);
        console.log(`   Topic: ${qb.topics?.join(", ") || "N/A"}`);
      });
    }

    // =========================================================
    // SECTION 5: STUDENT DATA
    // =========================================================
    console.log(
      "\n\n============================================================",
    );
    console.log("SECTION 5: STUDENT DATA");
    console.log(
      "============================================================\n",
    );

    const studentA = await db
      .collection("students")
      .findOne({ _id: sampleA.studentId });
    const studentB = await db
      .collection("students")
      .findOne({ _id: sampleB.studentId });

    console.log("STUDENT A:", JSON.stringify(studentA, null, 2));
    console.log("\n\nSTUDENT B:", JSON.stringify(studentB, null, 2));

    // Close connection
    await client.close();
    console.log("\n\n✅ Audit complete - Connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    await client.close();
    process.exit(1);
  }
}

runAudit();
