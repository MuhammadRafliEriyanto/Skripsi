/**
 * FINAL AUDIT: SMA Source of Truth - READ-ONLY
 */

const { MongoClient } = require("mongodb");
const fs = require("fs");
const path = require("path");

// REQUIREMENT: MONGO_URI must be set in environment variables
// No fallbacks allowed - ensures consistent database configuration across all environments
if (!process.env.MONGO_URI) {
  console.error("\n❌ ERROR: MONGO_URI environment variable is required");
  console.error("   Please set MONGO_URI in backend/.env file");
  console.error(
    "   Example: MONGO_URI=mongodb://localhost:27017/your_database",
  );
  console.error("");
  console.error("   For Atlas cluster use:");
  console.error(
    "   MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/database",
  );
  console.error("");
  process.exit(1);
}

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME || "bimbel-lms";

async function runAudit() {
  console.log("Starting Final SMA Source of Truth Audit...");
  console.log("READ-ONLY MODE\n");

  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db(DB_NAME);

    // Get students
    console.log("Step 1: Mengambil data siswa SMA 10 dan SMA 12...");
    const students = await db
      .collection("students")
      .find({
        className: { $in: ["SMA 10", "SMA 12"] },
      })
      .toArray();

    const studentMap = {};
    students.forEach((s) => {
      studentMap[s._id.toString()] = s.className;
    });

    // Get attempts with 30 questions (using answers.length)
    console.log("\nStep 2: Mengambil attempt SMA dengan 30 soal...");
    const attemptIds = Object.keys(studentMap).map((id) => id.toString());

    const allAttempts = await db
      .collection("studenttaskattempts")
      .find({
        studentId: { $in: attemptIds },
      })
      .toArray();

    // Filter by answers.length === 30
    const attempts = allAttempts.filter(
      (a) => Array.isArray(a.answers) && a.answers.length === 30,
    );
    console.log(
      `Filtered to ${attempts.length} attempts with exactly 30 answers`,
    );

    console.log(`Found ${attempts.length} attempts with 30 questions\n`);

    // Get task info
    const uniqueTaskIds = [
      ...new Set(attempts.map((a) => a.taskId?.toString()).filter(Boolean)),
    ];
    const taskDetails = await db
      .collection("classtasks")
      .find({ _id: { $in: uniqueTaskIds } })
      .toArray();
    const taskMap = {};
    taskDetails.forEach((t) => {
      taskMap[t._id.toString()] = t;
    });

    // Initialize results
    const results = {
      sma10: {
        total: 0,
        smaIpa: 0,
        smaIps: 0,
        unknown: 0,
        uncertainAttempts: [],
        byTaskMeeting: {},
      },
      sma12: {
        total: 0,
        smaIpa: 0,
        smaIps: 0,
        unknown: 0,
        uncertainAttempts: [],
        byTaskMeeting: {},
      },
      evidence: { smaIpa: [], smaIps: [] },
      summary: {
        sma10Attempts: 0,
        sma12Attempts: 0,
        smaIpaEvidence: 0,
        smaIpsEvidence: 0,
        uncertainCount: 0,
      },
    };

    // Process each attempt
    console.log("Step 3: Memproses setiap attempt...");

    for (const attempt of attempts) {
      const studentClassName = studentMap[attempt.studentId?.toString()];
      if (!studentClassName) continue;

      const taskInfo = taskMap[attempt.taskId?.toString()];
      const meetingNumber =
        attempt.meetingNumber || taskInfo?.meetingNumber || "Unknown";
      const subject = attempt.subject || taskInfo?.subject || "Unknown";
      const taskId = attempt.taskId?.toString();

      const category =
        studentClassName === "SMA 10"
          ? "sma10"
          : studentClassName === "SMA 12"
            ? "sma12"
            : null;
      if (!category) continue;

      results[category].total++;
      results.summary[`${category}Attempts`]++;

      // Determine QB program from answer question IDs
      const qbPrograms = new Set();
      const questionIds =
        attempt.answers?.map((a) => a.questionId?.toString()).filter(Boolean) ||
        [];

      if (questionIds.length > 0) {
        const qbQuestions = await db
          .collection("questionbanks")
          .find({
            _id: { $in: questionIds },
          })
          .toArray();

        qbQuestions.forEach((qb) => {
          if (qb.program) {
            qbPrograms.add(qb.program);
          }
        });
      }

      let determined = false;
      let dominantProgram = "unknown";

      if (qbPrograms.has("SMA IPA") && !qbPrograms.has("SMA IPS")) {
        dominantProgram = "SMA IPA";
        determined = true;
        results[category].smaIpa++;
        results.summary.smaIpaEvidence++;
        results.evidence.smaIpa.push({
          attemptId: attempt._id?.toString(),
          studentId: attempt.studentId?.toString(),
          className: studentClassName,
          taskId,
          meetingNumber,
          subject,
          qbPrograms: Array.from(qbPrograms),
        });
      } else if (qbPrograms.has("SMA IPS") && !qbPrograms.has("SMA IPA")) {
        dominantProgram = "SMA IPS";
        determined = true;
        results[category].smaIps++;
        results.summary.smaIpsEvidence++;
        results.evidence.smaIps.push({
          attemptId: attempt._id?.toString(),
          studentId: attempt.studentId?.toString(),
          className: studentClassName,
          taskId,
          meetingNumber,
          subject,
          qbPrograms: Array.from(qbPrograms),
        });
      } else {
        results[category].unknown++;
        results.summary.uncertainCount++;
        results[category].uncertainAttempts.push({
          attemptId: attempt._id?.toString(),
          studentId: attempt.studentId?.toString(),
          className: studentClassName,
          taskId,
          meetingNumber,
          subject,
          qbPrograms: Array.from(qbPrograms),
          reason: qbPrograms.size === 0 ? "NO_QB_REFERENCE" : "MIXED_PROGRAMS",
        });
      }

      // Group by Task + Meeting
      const taskKey = `${taskId}-Meeting${meetingNumber}`;
      if (!results[category].byTaskMeeting[taskKey]) {
        results[category].byTaskMeeting[taskKey] = {
          taskName: taskInfo?.title || "Unknown Task",
          meetingNumber,
          subject,
          smaIpa: 0,
          smaIps: 0,
          unknown: 0,
        };
      }

      if (determined) {
        results[category].byTaskMeeting[taskKey][
          dominantProgram === "SMA IPA" ? "smaIpa" : "smaIps"
        ]++;
      } else {
        results[category].byTaskMeeting[taskKey].unknown++;
      }
    }

    // Determine mapping status
    console.log("\nStep 4: Menentukan status mapping...\n");

    const getSmaStatus = (data) => {
      if (data.unknown === 0 && data.total > 0) {
        if (data.smaIpa > 0 && data.smaIps === 0)
          return "LIKELY_MAPPING: SMA -> SMA IPA";
        if (data.smaIps > 0 && data.smaIpa === 0)
          return "LIKELY_MAPPING: SMA -> SMA IPS";
      }
      return data.total === 0 ? "NO_DATA" : "MAPPING_NOT_PROVEN";
    };

    const sma10MappingStatus = getSmaStatus(results.sma10);
    const sma12MappingStatus = getSmaStatus(results.sma12);
    const hasSmaIpaEvidence = results.evidence.smaIpa.length > 0;
    const hasSmaIpsEvidence = results.evidence.smaIps.length > 0;

    // Output summary
    console.log("========================================");
    console.log("RESULTS SUMMARY");
    console.log("========================================\n");

    console.log("=== SMA 10 Statistics ===");
    console.log(`Total Attempts: ${results.sma10.total}`);
    console.log(`Using SMA IPA: ${results.sma10.smaIpa}`);
    console.log(`Using SMA IPS: ${results.sma10.smaIps}`);
    console.log(`Uncertain: ${results.sma10.unknown}`);
    console.log(`Status: ${sma10MappingStatus}\n`);

    console.log("=== SMA 12 Statistics ===");
    console.log(`Total Attempts: ${results.sma12.total}`);
    console.log(`Using SMA IPA: ${results.sma12.smaIpa}`);
    console.log(`Using SMA IPS: ${results.sma12.smaIps}`);
    console.log(`Uncertain: ${results.sma12.unknown}`);
    console.log(`Status: ${sma12MappingStatus}\n`);

    console.log("=== Evidence Summary ===");
    console.log(`SMA IPA Evidence: ${results.summary.smaIpaEvidence}`);
    console.log(`SMA IPS Evidence: ${results.summary.smaIpsEvidence}`);
    console.log(`Has SMA IPA: ${hasSmaIpaEvidence ? "YES" : "NO"}`);
    console.log(`Has SMA IPS: ${hasSmaIpsEvidence ? "YES" : "NO"}\n`);

    // Save reports
    const outputDir = "docs";
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputJson = {
      timestamp: new Date().toISOString(),
      statistics: {
        sma10: {
          total_attempts: results.sma10.total,
          using_sma_ipa: results.sma10.smaIpa,
          using_sma_ips: results.sma10.smaIps,
          uncertain: results.sma10.unknown,
          percentage:
            results.sma10.total > 0
              ? {
                  sma_ipa: Math.round(
                    (results.sma10.smaIpa / results.sma10.total) * 100,
                  ),
                  sma_ips: Math.round(
                    (results.sma10.smaIps / results.sma10.total) * 100,
                  ),
                  uncertain: Math.round(
                    (results.sma10.unknown / results.sma10.total) * 100,
                  ),
                }
              : null,
        },
        sma12: {
          total_attempts: results.sma12.total,
          using_sma_ipa: results.sma12.smaIpa,
          using_sma_ips: results.sma12.smaIps,
          uncertain: results.sma12.unknown,
          percentage:
            results.sma12.total > 0
              ? {
                  sma_ipa: Math.round(
                    (results.sma12.smaIpa / results.sma12.total) * 100,
                  ),
                  sma_ips: Math.round(
                    (results.sma12.smaIps / results.sma12.total) * 100,
                  ),
                  uncertain: Math.round(
                    (results.sma12.unknown / results.sma12.total) * 100,
                  ),
                }
              : null,
        },
      },
      mapping_status: {
        sma10: sma10MappingStatus,
        sma12: sma12MappingStatus,
        general_findings: {
          has_sma_ipa_evidence: hasSmaIpaEvidence,
          has_sma_ips_evidence: hasSmaIpsEvidence,
          conclusion:
            !hasSmaIpaEvidence && hasSmaIpsEvidence
              ? "NO_EVIDENCE_SMA_IPA"
              : hasSmaIpaEvidence && hasSmaIpsEvidence
                ? "MULTIPLE_CANDIDATES"
                : !hasSmaIpaEvidence && !hasSmaIpsEvidence
                  ? "MAPPING_NOT_PROVEN"
                  : "UNUSUAL",
        },
      },
      evidence_details: {
        sma_ips_samples: results.evidence.smaIps.slice(0, 20),
        uncertain_attempts_sma10: results.sma10.uncertainAttempts.slice(0, 20),
        uncertain_attempts_sma12: results.sma12.uncertainAttempts.slice(0, 20),
      },
      distribution_by_task_meeting: {
        sma10: results.sma10.byTaskMeeting,
        sma12: results.sma12.byTaskMeeting,
      },
    };

    fs.writeFileSync(
      path.join(outputDir, "final-sma-source-of-truth-audit.json"),
      JSON.stringify(outputJson, null, 2),
    );
    console.log(
      `JSON report saved to: docs/final-sma-source-of-truth-audit.json`,
    );

    // Generate MD report
    let md = "# Final SMA Source of Truth Audit Report\n\n";
    md += `**Timestamp:** ${new Date().toISOString()}\n\n`;
    md += "| Grade | Total | SMA IPA | SMA IPS | Unknown | Status |\n";
    md += "|-------|-------|---------|---------|---------|--------|\n";

    const pct = (num, total) =>
      total > 0 ? Math.round((num / total) * 100) : 0;

    md += `| SMA 10 | \`${results.sma10.total}\` | \`${results.sma10.smaIpa}\` (${pct(results.sma10.smaIpa, results.sma10.total)}%) | \`${results.sma10.smaIps}\` (${pct(results.sma10.smaIps, results.sma10.total)}%) | \`${results.sma10.unknown}\` | **${sma10MappingStatus}** |\n`;
    md += `| SMA 12 | \`${results.sma12.total}\` | \`${results.sma12.smaIpa}\` (${pct(results.sma12.smaIpa, results.sma12.total)}%) | \`${results.sma12.smaIps}\` (${pct(results.sma12.smaIps, results.sma12.total)}%) | \`${results.sma12.unknown}\` | **${sma12MappingStatus}** |\n\n`;

    md += `**Has SMA IPA Evidence**: ${hasSmaIpaEvidence ? "✅ YES" : "❌ NO"}\n`;
    md += `**Has SMA IPS Evidence**: ${hasSmaIpsEvidence ? "✅ YES" : "❌ NO"}\n\n`;

    let conclusion = "";
    if (!hasSmaIpaEvidence && hasSmaIpsEvidence) {
      conclusion =
        "**STRONG RECOMMENDATION**: NO_EVIDENCE_SMA_IPA\n\nSemua traceable attempts menggunakan SMA IPS. Mapping:\n- SMA 10 → SMA IPS\n- SMA 12 → SMA IPS";
    } else if (hasSmaIpaEvidence && hasSmaIpsEvidence) {
      conclusion =
        "**CAUTION REQUIRED**: MULTIPLE_CANDIDATES\n\nDitemukan BOTH IPA dan IPS. Perlu business rule klarifikasi.";
    } else {
      conclusion =
        "**INSUFFICIENT DATA**: Tidak ada bukti cukup untuk mapping decision.";
    }

    md += `\n## Conclusion\n\n${conclusion}\n\n---\n\n*Generated by final-sma-source-of-truth-audit.js*`;

    fs.writeFileSync(
      path.join(outputDir, "final-sma-source-of-truth-audit.md"),
      md,
    );
    console.log(
      `Markdown report saved to: docs/final-sma-source-of-truth-audit.md`,
    );

    console.log("\n========================================");
    console.log("AUDIT COMPLETE - Berhenti menunggu keputusan stakeholders");
    console.log("========================================\n");
  } catch (error) {
    console.error("Error:", error);
    throw error;
  } finally {
    await client.close();
  }
}

runAudit().catch(console.error);
