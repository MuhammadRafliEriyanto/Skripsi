/**
 * SIMPLE CBT V6 TEST - DIRECT NODE SCRIPT
 */

import mongoose from "mongoose";

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/bimbel_new";

// Import models dynamically
const { QuestionBank } = await import("../models/QuestionBank.js");
const { createOriginalOptions, correctAnswerToIndex, indexToCorrectAnswer } =
  await import("../lib/question-option-compat.js");
const { getSeededOptionMapping } = await import("../lib/seeded-random.js");

console.log("=".repeat(80));
console.log("CBT V6 END-TO-END VERIFICATION - READ ONLY");
console.log("=".repeat(80));

try {
  await mongoose.connect(MONGO_URI);
  console.log("\n✅ MongoDB Connected\n");

  const results = [];

  // TEST 1: Count V6 documents
  console.log("📋 TEST 1: V6 Document Detection");
  const v6Count = await QuestionBank.countDocuments({
    "options.0": { $exists: true },
  });
  console.log(
    `   ✅ ${v6Count.toLocaleString()} questions with options[] array`,
  );
  results.push({ name: "V6 Documents Available", pass: v6Count > 0 });

  // TEST 2: Read sample V6 document
  console.log("\n📋 TEST 2: V6 Document Structure");
  const sampleV6 = await QuestionBank.findOne({
    "options.0": { $exists: true },
  });
  if (sampleV6) {
    console.log(`   Sample document:`);
    console.log(`     questionId: ${sampleV6.questionId}`);
    console.log(`     program: ${sampleV6.program}`);
    console.log(`     subject: ${sampleV6.subject}`);
    console.log(`     topic: ${sampleV6.topic}`);
    console.log(
      `     options[]: [${sampleV6.options.slice(0, 3).join(", ")}, ...] (${sampleV6.options.length} items)`,
    );
    console.log(`     correctAnswer: ${sampleV6.correctAnswer}`);

    results.push({
      name: "V6 Sample Valid",
      pass: Array.isArray(sampleV6.options) && sampleV6.options.length === 4,
    });
    results.push({
      name: "V6 Has Correct Answer",
      pass: ["A", "B", "C", "D"].includes(sampleV6.correctAnswer),
    });
  } else {
    console.log("   ❌ No V6 sample found");
    results.push({ name: "V6 Sample Valid", pass: false });
  }

  // TEST 3: Helper functions
  console.log("\n📋 TEST 3: Backend Compatibility Helper");
  const mockV6 = {
    options: ["Opt A", "Opt B", "Opt C", "Opt D"],
    correctAnswer: "C",
  };
  const opts = createOriginalOptions(mockV6);
  const helperPass =
    opts.A === "Opt A" &&
    opts.B === "Opt B" &&
    opts.C === "Opt C" &&
    opts.D === "Opt D";
  console.log(
    helperPass
      ? `   ✅ Helper works: ${JSON.stringify(opts)}`
      : "   ❌ Helper failed",
  );
  results.push({
    name: "Helper V6 Format",
    pass: helperPass,
    details: JSON.stringify(opts),
  });

  // TEST 4: Shuffle logic
  console.log("\n📋 TEST 4: Shuffle Logic Verification");
  const map1 = getSeededOptionMapping("student_001", "Q1");
  const map2 = getSeededOptionMapping("student_002", "Q1");
  const different = JSON.stringify(map1) !== JSON.stringify(map2);
  console.log(
    different
      ? `   ✅ Different students: ${map1.join(", ")} vs ${map2.join(", ")}`
      : "   ❌ Same shuffle",
  );
  results.push({ name: "Different Shuffles per Student", pass: different });

  // TEST 5: Real V6 validation
  console.log("\n📋 TEST 5: Real V6 Questions Validation");
  const realQuestions = await QuestionBank.find({
    "options.0": { $exists: true },
  })
    .select("questionId questionText options correctAnswer")
    .limit(5);

  let allValid = true;
  for (let i = 0; i < realQuestions.length; i++) {
    const q = realQuestions[i];
    const rOpts = createOriginalOptions(q);

    const hasFields =
      !!q.questionId &&
      !!q.questionText &&
      !!(rOpts.A && rOpts.B && rOpts.C && rOpts.D);
    const validAnswer = ["A", "B", "C", "D"].includes(q.correctAnswer);

    if (!hasFields) {
      console.log(`   ❌ Q${i + 1}: Missing fields`);
      allValid = false;
    }
    if (!validAnswer) {
      console.log(`   ❌ Q${i + 1}: Invalid correctAnswer=${q.correctAnswer}`);
      allValid = false;
    }
    if (i < 3) {
      console.log(
        `   ✅ Q${i + 1}: ${q.questionId.substring(0, 30)}... All fields present`,
      );
    }
  }

  results.push({ name: "Real Questions Valid Structure", pass: allValid });
  results.push({ name: "No Undefined Options", pass: allValid });

  // TEST 6: Index conversion
  console.log("\n📋 TEST 6: Index Conversion Functions");
  const cIdx = correctAnswerToIndex("C");
  const aFromIdx = indexToCorrectAnswer(0);
  const convertPass = cIdx === 2 && aFromIdx === "A";
  console.log(
    convertPass
      ? `   ✅ C→${cIdx}, 0→'${aFromIdx}'`
      : `   ❌ C→${cIdx}, 0→'${aFromIdx}'`,
  );
  results.push({ name: "Index Conversions", pass: convertPass });

  // SUMMARY
  console.log("\n" + "=".repeat(80));
  console.log("FINAL TEST REPORT");
  console.log("=".repeat(80));

  const passed = results.filter((r) => r.pass).length;
  const total = results.length;

  console.log(`\nTotal Tests: ${total}`);
  console.log(`Passed: ${passed}/${total}`);
  console.log(`Failed: ${total - passed}/${total}`);

  if (total - passed > 0) {
    console.log("\n❌ FAILED TESTS:");
    results
      .filter((r) => !r.pass)
      .forEach((r) => {
        console.log(`  • ${r.name}${r.details ? `: ${r.details}` : ""}`);
      });
  }

  console.log("\n" + "=".repeat(80));
  console.log(`CBT V6 READY: ${passed === total ? "YA ✅" : "TIDAK ❌"}`);
  console.log("=".repeat(80));

  await mongoose.disconnect();
  process.exit(passed === total ? 0 : 1);
} catch (error) {
  console.error("\n❌ CRITICAL ERROR:", error.message);
  console.error(error.stack);
  process.exit(1);
}
