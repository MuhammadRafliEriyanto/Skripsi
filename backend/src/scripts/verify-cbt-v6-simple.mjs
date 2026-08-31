/**
 * CBT V6 END-TO-END VERIFICATION
 * READ-ONLY - NO DATABASE CHANGES
 */

import mongoose from "mongoose";
import { QuestionBank } from "../models/QuestionBank.js";
import { ClassTaskQuestion } from "../models/ClassTaskQuestion.js";
import {
  createOriginalOptions,
  correctAnswerToIndex,
  indexToCorrectAnswer,
} from "../lib/question-option-compat.js";
import { getSeededOptionMapping } from "../lib/seeded-random.js";

const MONGODB_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/bimbel_new";

async function main() {
  console.log("=".repeat(80));
  console.log("CBT V6 END-TO-END VERIFICATION");
  console.log("READ-ONLY - NO DATABASE MODIFICATIONS");
  console.log("=".repeat(80));

  try {
    await mongoose.connect(MONGODB_URI);
    console.log("\n✅ Connected to MongoDB");

    const results = [];

    // TEST 1: Read V6 documents directly
    console.log("\n📋 TEST 1: Reading QuestionBank V6 documents...");
    const v6Questions = await QuestionBank.find({
      $or: [
        { "options.0": { $exists: true } },
        { "options.1": { $exists: true } },
      ],
    }).limit(5);

    if (v6Questions.length > 0) {
      results.push({
        name: "V6 Document Read",
        pass: true,
        details: `${v6Questions.length} found`,
      });
      console.log(`   ✅ ${v6Questions.length} V6 documents found`);

      const sample = v6Questions[0];
      console.log(`   Options: [${sample.options.slice(0, 3).join(", ")}]`);
      console.log(`   Correct answer: ${sample.correctAnswer}`);
    } else {
      results.push({ name: "V6 Document Read", pass: false });
      console.log("   ❌ No V6 documents found");
    }

    // TEST 2: Helper functions
    console.log("\n📋 TEST 2: Backend Compatibility Helper...");
    const mockV6 = {
      options: ["A", "B", "C", "D"],
      correctAnswer: "C",
      questionText: "Test",
    };
    const originalOptions = createOriginalOptions(mockV6);
    const testPass =
      originalOptions.A === "A" &&
      originalOptions.B === "B" &&
      originalOptions.C === "C" &&
      originalOptions.D === "D";

    results.push({
      name: "Helper V6 Format",
      pass: testPass,
      details: JSON.stringify(originalOptions),
    });
    console.log(
      testPass
        ? `   ✅ Helper works: ${JSON.stringify(originalOptions)}`
        : "   ❌ Failed",
    );

    // TEST 3: Shuffle logic
    console.log("\n📋 TEST 3: Shuffle Logic...");
    const mapping1 = getSeededOptionMapping("student_001", "Q1");
    const mapping2 = getSeededOptionMapping("student_002", "Q1");
    const different = JSON.stringify(mapping1) !== JSON.stringify(mapping2);

    results.push({
      name: "Different Students Different Shuffles",
      pass: different,
      details: `${mapping1.join(", ")} vs ${mapping2.join(", ")}`,
    });
    console.log(
      different ? `   ✅ Student 1: ${mapping1.join(", ")}` : "   ❌",
    );
    if (different) console.log(`         Student 2: ${mapping2.join(", ")}`);

    // TEST 4: Real questions validation
    console.log("\n📋 TEST 4: Real V6 Questions Validation...");
    const realQuestions = await QuestionBank.find({
      "options.0": { $exists: true },
    })
      .select("questionId questionText options correctAnswer")
      .limit(10);

    let allValid = true,
      noUndefined = true;
    for (let i = 0; i < Math.min(3, realQuestions.length); i++) {
      const q = realQuestions[i];
      const opts = createOriginalOptions(q);
      if (!q.questionId || !q.questionText) allValid = false;
      if (!opts.A || !opts.B || !opts.C || !opts.D) noUndefined = false;
      console.log(
        `   Q${i + 1}: ${q.questionId.substring(0, 20)}... Valid=${!!q.questionId && !!q.questionText}`,
      );
    }

    results.push({ name: "All Fields Present", pass: allValid });
    results.push({ name: "No Undefined Options", pass: noUndefined });
    console.log(
      allValid && noUndefined ? "   ✅ All fields valid" : "   ❌ Issues found",
    );

    // TEST 5: Legacy compatibility
    console.log("\n📋 TEST 5: Legacy History Compatibility...");
    const legacyCount = await ClassTaskQuestion.countDocuments({
      optionA: { $exists: true, $ne: null },
    });

    if (legacyCount > 0) {
      const legacySample = await ClassTaskQuestion.findOne({
        optionA: { $exists: true },
      });
      if (legacySample) {
        const legacyOpts = createOriginalOptions(legacySample);
        const compatPass =
          !!legacyOpts.A && !!legacyOpts.B && !!legacyOpts.C && !!legacyOpts.D;
        results.push({
          name: "Legacy Compatible",
          pass: compatPass,
          details: `${legacyCount} legacy docs`,
        });
        console.log(compatPass ? `   ✅ ${compatPass}` : "   ❌");
      }
    } else {
      results.push({
        name: "Legacy Compatible",
        pass: true,
        details: "No legacy data",
      });
      console.log("   ℹ️ No legacy data");
    }

    // TEST 6: Index conversion
    console.log("\n📋 TEST 6: Index Conversion Functions...");
    const cIndex = correctAnswerToIndex("C");
    const aFromIndex = indexToCorrectAnswer(0);
    const convertPass = cIndex === 2 && aFromIndex === "A";

    results.push({
      name: "Index Conversions",
      pass: convertPass,
      details: `C→${cIndex}, 0→'${aFromIndex}'`,
    });
    console.log(convertPass ? "   ✅ Conversions work" : "   ❌");

    // Summary
    console.log("\n" + "=".repeat(80));
    console.log("FINAL REPORT");
    console.log("=".repeat(80));

    const passed = results.filter((r) => r.pass).length;
    const total = results.length;

    console.log(`\nTotal Tests: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${total - passed}`);

    if (total - passed > 0) {
      console.log("\n❌ FAILED:");
      results
        .filter((r) => !r.pass)
        .forEach((r) =>
          console.log(`  • ${r.name}${r.details ? ": " + r.details : ""}`),
        );
    } else {
      console.log("\n✅ ALL TESTS PASSED!");
    }

    console.log("\n" + "=".repeat(80));
    console.log(`CBT V6 READY: ${passed === total ? "YA" : "TIDAK"}`);
    console.log("=".repeat(80));

    await mongoose.disconnect();
    process.exit(passed === total ? 0 : 1);
  } catch (error) {
    console.error("\n❌ CRITICAL:", error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

main();
