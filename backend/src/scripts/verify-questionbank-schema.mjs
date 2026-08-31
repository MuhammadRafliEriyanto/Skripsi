/**
 * SCHEMA VERIFICATION SCRIPT - READ ONLY
 *
 * Tuju AN: Verifikasi FIELD ASLI yang tersimpan di MongoDB
 * TANPA menggunakan TypeScript model atau Mongoose schema
 * HANYA raw MongoDB document inspection
 */

import { MongoClient } from "mongodb";
import { config } from "dotenv";
config({ path: ".env" });

if (!process.env.MONGO_URI) {
  console.error("❌ MONGO_URI not found in .env");
  process.exit(1);
}

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });

async function verifySchema() {
  try {
    await client.connect();
    console.log("🔗 Connected to MongoDB\n");

    const db = client.db("bimbel-lms");
    const collection = db.collection("questionbanks");

    // ============================================
    // STEP 1: BACA LANGSUNG 5 DOKUMEN ORISINAL
    // ============================================
    console.log("=".repeat(80));
    console.log("STEP 1: RAW DOCUMENT INSPECTION (5 Documents)");
    console.log("=".repeat(80));

    const cursor = collection.find({}).limit(5);
    const docs = await cursor.toArray();

    for (let i = 0; i < docs.length; i++) {
      console.log(`\n📄 DOKUMEN #${i + 1}`);
      console.log("-".repeat(80));

      // Tampilkan SEMUA field yang ada di dokumen
      const keys = Object.keys(docs[i]);
      console.log("\n🔍 ALL FIELDS IN THIS DOCUMENT:");
      keys.forEach((key, idx) => {
        const value = docs[i][key];
        const valuePreview =
          typeof value === "string"
            ? value.substring(0, 60)
            : JSON.stringify(value).substring(0, 60);
        const isLong = typeof value === "string" && value.length > 60;
        console.log(
          `  ${idx + 1}. ${key.padEnd(25)}: ${valuePreview}${isLong ? "..." : ""} (${typeof value})`,
        );
      });
    }

    // ============================================
    // STEP 2: FORMAT OUTPUT UNTUK SAAT
    // ============================================
    console.log("\n" + "=".repeat(80));
    console.log("STEP 2: FORMATTED SAMPLE OUTPUT (3 Soal)");
    console.log("=".repeat(80));

    const sampleDocs = await collection.find({}).limit(3).toArray();

    sampleDocs.forEach((doc, i) => {
      console.log(`\n📝 SOAL #${i + 1}`);
      console.log("-".repeat(80));

      // Extract only known fields we expect
      const questionId = doc.questionId || doc._id;
      const program = doc.program;
      const subject = doc.subject;
      const topic = doc.topic;
      const difficulty = doc.difficulty;

      // Find all option-like fields dynamically
      const optionFields = Object.keys(doc).filter(
        (k) =>
          k.toLowerCase().match(/(option|answer|pilihan)/) &&
          /a|b|c|d/i.test(k.replace(/option|answer|pilihan/gi, "")),
      );

      console.log(`{`);
      console.log(`  "questionId": "${questionId}",`);
      console.log(
        `  "questionText": "${doc.questionText?.substring(0, 50)?.replace(/\n/g, " ")}${doc.questionText?.length > 50 ? "..." : ""}",`,
      );
      console.log(`  "program": "${program}",`);
      console.log(`  "subject": "${subject}",`);
      console.log(`  "topic": "${topic}",`);
      console.log(`  "difficulty": ${difficulty},`);
      console.log(`  "fields": {`);
      console.log(
        `    // Detected option fields: ${optionFields.join(", ") || "(none found)"}`,
      );
      console.log(
        `    // Expected by model: optionA, optionB, optionC, optionD`,
      );

      // Show actual field values
      if (optionFields.length > 0) {
        optionFields.forEach((field) => {
          const val = doc[field];
          console.log(
            `    "${field}": "${val?.substring(0, 40)}${val?.length > 40 ? "..." : ""}"`,
          );
        });
      } else {
        console.log(`    ⚠️ NO OPTION FIELDS FOUND!`);
      }

      console.log(
        `    "correctAnswer": "${doc.correctAnswer || doc.kunciJawaban || doc.answerKey}"`,
      );
      console.log(`  }`);
      console.log(`}`);
    });

    // ============================================
    // STEP 3: COMPARE DENGAN QUESTIONBANK MODEL
    // ============================================
    console.log("\n" + "=".repeat(80));
    console.log("STEP 3: SCHEMA COMPARISON (MongoDB vs QuestionBank Model)");
    console.log("=".repeat(80));

    const firstDoc = sampleDocs[0];
    const mongoFields = Object.keys(firstDoc).sort();

    // Read the actual model file
    const fs = await import("fs");
    let modelContent = "";
    try {
      modelContent = fs.readFileSync("src/models/QuestionBank.ts", "utf-8");
    } catch (e) {
      console.log("⚠️ Could not read QuestionBank.ts model file");
      console.log("Attempting relative path...");
      modelContent = fs.readFileSync(
        "backend/src/models/QuestionBank.ts",
        "utf-8",
      );
    }

    // Extract expected fields from model (look for property definitions)
    const modelFieldMatches = modelContent.matchAll(
      /[\s]{2}(?:readonly\s+)?(\w+):\s*'(Mild|Mild|Easy|Medium|Hard|String|boolean|number|string|\["A","B","C","D"\]|Array.<any>)'/g,
    );
    const modelFields = [];
    for (const match of modelFieldMatches) {
      if (!["objectid", "timestamp", "date"].includes(match[1].toLowerCase())) {
        modelFields.push(match[1]);
      }
    }

    console.log("\n📊 COMPARISON TABLE:");
    console.log("-".repeat(100));
    console.log(
      `${"MongoDB Field".padEnd(25)} | ${"Expected Model Field".padEnd(25)} | ${"Match?".padEnd(10)} | Example Value`,
    );
    console.log("-".repeat(100));

    // Check each expected model field against actual MongoDB fields
    const expectedModelFields = [
      "questionId",
      "program",
      "subject",
      "topic",
      "difficulty",
      "questionText",
      "explanation",
      "optionA",
      "optionB",
      "optionC",
      "optionD",
      "correctAnswer",
    ];

    expectedModelFields.forEach((expected) => {
      const existsInMongo = mongoFields.some(
        (m) => m.toLowerCase() === expected.toLowerCase(),
      );
      const matchStatus = existsInMongo ? "✓ YES" : "✗ NO";

      // Find the actual MongoDB field (case-insensitive)
      const actualField =
        mongoFields.find((m) => m.toLowerCase() === expected.toLowerCase()) ||
        mongoFields.find((m) => m.includes(expected.toLowerCase()));

      const exampleValue = actualField
        ? String(firstDoc[actualField]).substring(0, 30)
        : "N/A";

      console.log(
        `${actualField || "???".padEnd(25)} | ${expected.padEnd(25)} | ${matchStatus.padEnd(10)} | ${exampleValue}`,
      );
    });

    // ============================================
    // STEP 4: SPECIFIC CHECK FOR OPTIONS
    // ============================================
    console.log("\n" + "=".repeat(80));
    console.log("STEP 4: OPTION FIELD INVESTIGATION");
    console.log("=".repeat(80));

    const allKeys = new Set();
    await collection.find({}).forEach((doc) => {
      Object.keys(doc).forEach((k) => allKeys.add(k));
    });

    const optionPatternFields = Array.from(allKeys)
      .filter((k) => /(option|answer|pilihan|choice|jawaban)/i.test(k))
      .sort();

    console.log("\n🎯 ALL FIELDS MATCHING OPTION PATTERN:");
    optionPatternFields.forEach((field, idx) => {
      console.log(`  ${idx + 1}. ${field}`);
    });

    console.log("\n🔍 EXAMPLE OF EACH OPTION-LIKE FIELD:");
    optionPatternFields.slice(0, 10).forEach((field) => {
      const sampleDoc = sampleDocs[0];
      const val = sampleDoc[field];
      console.log(
        `  ${field.padEnd(25)}: ${val?.substring(0, 50)}${val?.length > 50 ? "..." : ""}`,
      );
    });

    // ============================================
    // STEP 5: COMPLETE DOCUMENT STRUCTURE
    // ============================================
    console.log("\n" + "=".repeat(80));
    console.log("STEP 5: COMPLETE DOCUMENT STRUCTURE (Full First Document)");
    console.log("=".repeat(80));

    const completeDoc = await collection.findOne({});
    console.log("\n📋 FULL DOCUMENT AS JSON:");
    console.log(JSON.stringify(completeDoc, null, 2));

    // ============================================
    // CONCLUSION
    // ============================================
    console.log("\n" + "=".repeat(80));
    console.log("CONCLUSION");
    console.log("=".repeat(80));

    const mismatchCount = expectedModelFields.filter(
      (exp) => !mongoFields.some((m) => m.toLowerCase() === exp.toLowerCase()),
    ).length;

    console.log(`\nTotal expected fields: ${expectedModelFields.length}`);
    console.log(
      `Found in MongoDB: ${expectedModelFields.length - mismatchCount}`,
    );
    console.log(`Missing/Mismatched: ${mismatchCount}`);

    if (mismatchCount === 0) {
      console.log("\n✅ SCHEMA MATCH: YA");
      console.log("   All expected fields found in MongoDB.");
      console.log(
        '   Audit\'s "undefined" result was likely due to wrong query logic.',
      );
    } else {
      console.log("\n❌ SCHEMA MATCH: TIDAK");
      console.log("   Missing/mismatched fields detected!");

      const missing = expectedModelFields.filter(
        (exp) =>
          !mongoFields.some((m) => m.toLowerCase() === exp.toLowerCase()),
      );

      console.log("\nMissing fields:");
      missing.forEach((f) => console.log(`  - ${f}`));

      console.log("\nHow backend should read:");
      console.log(
        "  Replace model expectations with actual MongoDB field names.",
      );
    }
  } catch (error) {
    console.error("\n❌ ERROR:", error.message);
    console.error(error.stack);
  } finally {
    await client.close();
    console.log("\n👋 Connection closed.\n");
  }
}

verifySchema();
