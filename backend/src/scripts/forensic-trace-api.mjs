/**
 * FORENSIC TRACE - API Response for Attempt
 * READ-ONLY: Compare DB vs API
 */

import mongoose from "mongoose";
import fetch from "node-fetch";

async function traceApiResponse() {
  const attemptId = "ATTEMPT-BIMBEL-P1P9-08s3dlk";

  console.log("\n" + "=".repeat(80));
  console.log(`🔍 FORENSIC TRACE: API Response for Attempt ${attemptId}`);
  console.log("=".repeat(80));

  try {
    // Call the actual API endpoint
    const apiResponse = await fetch(
      `http://localhost:5000/api/student/me/learning/tasks/cbt/${encodeURIComponent(attemptId)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          // You'll need to add authentication header here if required
          // This is a test script to see raw API response
        },
        credentials: "include",
      },
    );

    if (!apiResponse.ok) {
      throw new Error(
        `API returned ${apiResponse.status}: ${apiResponse.statusText}`,
      );
    }

    const apiData = await apiResponse.json();

    console.log("\n📊 B. SESSION API RESPONSE:");
    console.log("-".repeat(80));
    console.log(
      `Endpoint: GET /api/student/me/learning/tasks/cbt/${attemptId}`,
    );
    console.log(`Status: ${apiResponse.status} ${apiResponse.statusText}`);
    console.log(`Success flag: ${apiData.success}`);

    if (apiData.success && apiData.data) {
      const questions = apiData.data.questions || [];
      const tryout = apiData.data.tryout || {};

      console.log(`\nquestions.length: ${questions.length}`);
      console.log(
        `tryout.totalQuestions: ${tryout.totalQuestions ?? "NOT SET"}`,
      );
      console.log(`tryout.questionCount: ${tryout.questionCount ?? "NOT SET"}`);

      if (questions.length > 0) {
        console.log("\n📋 ALL QUESTIONS (questionId | order):");
        questions.forEach((q, idx) => {
          const qId = q.questionId || q.id;
          console.log(`  ${idx + 1}. questionId: "${qId}"`);
        });

        // Extract all questionIds
        const questionIds = questions.map((q) => q.questionId || q.id);
        console.log(`\n🎯 ALL QUESTION IDS (${questionIds.length} total):`);
        console.log(JSON.stringify(questionIds));

        // Comparison with DB
        console.log("\n" + "=".repeat(80));
        console.log("🔬 COMPARISON: DB vs API");
        console.log("=".repeat(80));

        // DB had 30 questionIds
        const dbQuestionIds = [
          "CTQ-BIMBEL-P1P9-0bf4w3p",
          "CTQ-BIMBEL-P1P9-0al630s",
          "CTQ-BIMBEL-P1P9-0av5opr",
          "CTQ-BIMBEL-P1P9-0a16vmu",
          "CTQ-BIMBEL-P1P9-0ab6hbt",
          "CTQ-BIMBEL-P1P9-09h7o8w",
          "CTQ-BIMBEL-P1P9-09r79xv",
          "CTQ-BIMBEL-P1P9-0dd23yi",
          "CTQ-BIMBEL-P1P9-0dn1pnh",
          "CTQ-BIMBEL-P1P9-0zneq5r",
          "QB-8789c4e7-6ad5",
          "QB-947ea512-7d1a",
          "QB-999f4934-2469",
          "QB-b8403361-af69",
          "QB-607027e5-e70f",
          "QB-fa24551f-1dcc",
          "QB-cbaea245-f493",
          "QB-6c69e04f-7fc5",
          "QB-d59d702f-f577",
          "QB-413cf72e-8b63",
          "QB-648376b3-cc57",
          "QB-96a4627a-d2f2",
          "QB-77da4b6d-0d3f",
          "QB-7c86ccc6-720c",
          "QB-eda3da74-b503",
          "QB-a6cede59-008a",
          "QB-8146c927-13a5",
          "QB-665992f7-44ef",
          "QB-a9d80732-e11f",
          "QB-bc4edcdd-9968",
        ];

        console.log(`\nDatabase has ${dbQuestionIds.length} questionIds`);
        console.log(`API returned ${questions.length} questionIds`);

        if (questions.length !== dbQuestionIds.length) {
          console.log("\n❌ MISMATCH DETECTED!");
          console.log(
            `   Difference: ${Math.abs(dbQuestionIds.length - questions.length)} questions`,
          );

          // Find missing questionIds
          const apiSet = new Set(questionIds);
          const missingFromApi = dbQuestionIds.filter((id) => !apiSet.has(id));

          if (missingFromApi.length > 0) {
            console.log(
              `\n🚨 MISSING FROM API (${missingFromApi.length} questionIds):`,
            );
            missingFromApi.forEach((id, idx) => {
              console.log(`   ${idx + 1}. "${id}"`);
            });

            console.log("\n⚠️  ROOT CAUSE LIKELY IDENTIFIED!");
            console.log(
              "   Database has 30 answers but API only returns some questions.",
            );
            console.log(
              "   The backend controller is filtering/slicing questions before sending to frontend.",
            );
          }
        } else {
          console.log("\n✅ DB and API match in count");

          // Check if all questionIds are the same
          const dbSet = new Set(dbQuestionIds);
          const apiSet = new Set(questionIds);

          const same = dbQuestionIds.every((id) => apiSet.has(id));

          if (same) {
            console.log("✅ All questionIds match between DB and API");
          } else {
            console.log("⚠️  Question IDs differ even though count matches");
            const differentIds = dbQuestionIds.filter((id) => !apiSet.has(id));
            console.log(`Different IDs: ${JSON.stringify(differentIds)}`);
          }
        }
      }
    } else {
      console.log("❌ API error or no data:", apiData.message);
    }

    console.log("\n" + "=".repeat(80));
    console.log("✅ FORENSIC TRACE COMPLETE - API DATA");
    console.log("=".repeat(80) + "\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ ERROR:", error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

traceApiResponse();
