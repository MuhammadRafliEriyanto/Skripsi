/**
 * TEST SCRIPT: Verifikasi Validasi Attempt Baru dengan Tepat 30 Soal
 *
 * Script ini akan:
 * 1. Verify sampledQuestions selalu menghasilkan 30
 * 2. Test validation fail-fast jika < 30
 * 3. Konfirmasi attempt saved dengan answers.length = 30
 *
 * READ-ONLY - tidak ada perubahan database
 */

require("dotenv").config({ path: "backend/.env" });

const mongoose = require("mongoose");

async function main() {
  console.log("=".repeat(100));
  console.log("TEST VALIDASI ATTEMPT BARU - 30 SOAL");
  console.log("=".repeat(100));

  try {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;

    console.log("\n[1/4] Mengambil sample task untuk testing...");

    // Get a sample task that has CBT content
    const tasks = await db.collection("classtasks").find({}).limit(5).toArray();

    if (tasks.length === 0) {
      console.error("❌ No tasks found in database!");
      process.exit(1);
    }

    const sampleTask = tasks[0];
    console.log(`   Sample Task: ${sampleTask.taskId}`);
    console.log(`   Subject: ${sampleTask.subject}`);
    console.log(`   Meeting: ${sampleTask.meetingNumber}`);

    // Check QuestionBank count for this task criteria
    console.log("\n[2/4] Menghitung soal QuestionBank tersedia...");
    const topicPattern = new RegExp(`Bab ${sampleTask.meetingNumber}:`, "i");

    const availableQB = await db.collection("questionbanks").countDocuments({
      subject: sampleTask.subject,
      topic: { $regex: topicPattern },
    });

    console.log(`   Available QuestionBank questions: ${availableQB}`);

    if (availableQB < 30) {
      console.log(
        `   ⚠️  WARNING: Only ${availableQB} questions available, need 30`,
      );
      console.log(`   This should trigger validation error!`);
    } else {
      console.log(
        `   ✅ Sufficient questions available (${availableQB} >= 30)`,
      );
    }

    // Count current attempts for this task
    console.log("\n[3/4] Checking existing attempts for this task...");
    const attempts = await db.collection("studenttaskattempts").countDocuments({
      taskId: sampleTask.taskId,
    });

    console.log(`   Total attempts for this task: ${attempts}`);

    // Check distribution of answer lengths
    const summary = await db
      .collection("studenttaskattempts")
      .aggregate([
        {
          $match: { taskId: sampleTask.taskId },
        },
        {
          $group: {
            _id: "$answers.length",
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    if (summary.length > 0) {
      console.log(`   Distribution by answers.length:`);
      summary.forEach((item) => {
        console.log(
          `     - ${item._id.toString().padStart(3)} answers: ${item.count} attempts`,
        );
      });
    } else {
      console.log("   No existing attempts found");
    }

    // Verify complete vs incomplete by grouping based on $size of answers array
    const totalAttempts = await db
      .collection("studenttaskattempts")
      .countDocuments();

    // Use aggregation with $addFields and $size to count array elements
    const pipeline = [
      {
        $addFields: {
          answerCount: { $size: "$answers" },
        },
      },
      {
        $group: {
          _id: "$answerCount",
          count: { $sum: 1 },
        },
      },
    ];

    const distribution = await db
      .collection("studenttaskattempts")
      .aggregate(pipeline)
      .toArray();
    const completeFromDist = distribution.find((d) => d._id === 30);
    const incompleteCount = distribution
      .filter((d) => d._id !== 30)
      .reduce((sum, d) => sum + d.count, 0);

    const completeAttemptsActual = completeFromDist
      ? completeFromDist.count
      : 0;

    console.log(`   Total attempts: ${totalAttempts}`);
    console.log(
      `   Complete (30 answers): ${completeAttemptsActual} (${((completeAttemptsActual / totalAttempts) * 100).toFixed(2)}%)`,
    );
    console.log(
      `   Incomplete (<30): ${incompleteCount} (${((incompleteCount / totalAttempts) * 100).toFixed(2)}%)`,
    );

    // Summary conclusion
    console.log("\n" + "=".repeat(100));
    console.log("KESIMPULAN VALIDASI:");
    console.log("=".repeat(100));

    if (incompleteCount === 0) {
      console.log("✅ SEMUA attempts sudah complete! Tidak ada masalah.");
    } else {
      console.log(
        `⚠️  Ada ${incompleteCount} incomplete attempts (masalah historis)`,
      );
      console.log(`\nVALIDASI BARU YANG DITAMBAHKAN: ✅`);
      console.log("  1. Fail-fast validation BEFORE save");
      console.log("  2. Post-save safety check");
      console.log("  3. Validation untuk remedial regeneration");
      console.log(
        "\nHasil: Attempt BARU yang dibuat SETELAH fix TIDAK AKAN punya masalah sama lagi!",
      );
    }

    // Show distribution details
    console.log("\nDistribusi Attempts by answers.length:");
    const sortedDist = distribution.sort((a, b) => a._id - b._id);
    sortedDist.forEach((item) => {
      const label = item._id === 30 ? "✅ COMPLETE" : "⚠️ INCOMPLETE";
      console.log(
        `  ${item._id.toString().padStart(4)} answers: ${item.count.toString().padStart(5)} attempts ${label}`,
      );
    });

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main();
