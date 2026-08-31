/**
 * Restore questionbanks collection from backup JSON file
 *
 * Usage: node src/scripts/restore-from-backup.js [--apply]
 *
 * Without --apply flag: dry-run mode (shows what would be done)
 * With --apply flag: actually performs the restore operation
 */

import mongoose from "mongoose";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const BACKUP_FILE = path.join(
  __dirname,
  "../backups/backup-v6-replace-2026-08-28.json",
);
const COLLECTION_NAME = "questionbanks";
const EXPECTED_COUNT = 79200;

// Parse command line arguments
const args = process.argv.slice(2);
const APPLY_MODE = args.includes("--apply");

console.log("=".repeat(60));
console.log("QUESTIONBANKS RESTORE UTILITY");
console.log("=".repeat(60));
console.log(`Backup file: ${BACKUP_FILE}`);
console.log(`Mode: ${APPLY_MODE ? "🔥 APPLY" : "⚠️  DRY-RUN (no changes)"}`);
console.log(`Expected document count: ${EXPECTED_COUNT.toLocaleString()}`);
console.log("=".repeat(60));

/**
 * Load MongoDB URI from environment variable
 */
async function getMongoUri() {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("❌ MONGO_URI environment variable is not set!");
  }

  console.log(`✅ MongoDB URI found in environment`);
  return mongoUri;
}

/**
 * Read and parse backup JSON file
 */
async function readBackupFile() {
  try {
    const data = await fs.readFile(BACKUP_FILE, "utf-8");
    const backup = JSON.parse(data);

    console.log(`✅ Backup file loaded successfully`);
    console.log(
      `   Total collections in backup: ${Object.keys(backup.collections || {}).length}`,
    );

    if (!backup.collections || !backup.collections[COLLECTION_NAME]) {
      throw new Error(
        `❌ Collection '${COLLECTION_NAME}' not found in backup file!`,
      );
    }

    const questions = backup.collections[COLLECTION_NAME];
    console.log(`   Questions in backup: ${questions.length.toLocaleString()}`);

    return questions;
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`❌ Backup file not found at: ${BACKUP_FILE}`);
    }
    if (error instanceof SyntaxError) {
      throw new Error(`❌ Invalid JSON in backup file! ${error.message}`);
    }
    throw error;
  }
}

/**
 * Connect to MongoDB and verify current state
 */
async function connectAndVerify(mongoUri, backupQuestions) {
  console.log("\n📡 Connecting to MongoDB...");
  await mongoose.connect(mongoUri);
  console.log("✅ Connected to MongoDB");

  const db = mongoose.connection.db;
  const collection = db.collection(COLLECTION_NAME);

  // Check current count
  const currentCount = await collection.countDocuments();
  console.log(
    `\n📊 Current questionbanks count: ${currentCount.toLocaleString()}`,
  );

  if (currentCount > 0 && !APPLY_MODE) {
    console.warn(
      `⚠️  Warning: Collection has ${currentCount.toLocaleString()} documents`,
    );
    console.warn(
      `    In production, ensure this is empty or you want to replace it`,
    );
  }

  return { collection, currentCount };
}

/**
 * Clear existing collection (optional safety check)
 */
async function clearExistingCollection(collection, currentCount) {
  if (currentCount === 0) {
    console.log(`ℹ️  Collection is already empty, skipping clear step`);
    return;
  }

  if (!APPLY_MODE) {
    console.log(
      `💡 Dry-run: Would drop ${currentCount.toLocaleString()} existing documents`,
    );
    return;
  }

  console.log(
    `🗑️  Dropping ${currentCount.toLocaleString()} existing documents...`,
  );
  await collection.deleteMany({});
  console.log("✅ Existing documents cleared");
}

/**
 * Insert all questions from backup
 */
async function insertQuestions(collection, questions) {
  const batchSize = 1000;
  const total = questions.length;

  console.log(`\n💾 Starting insert operation...`);
  console.log(`   Total documents: ${total.toLocaleString()}`);
  console.log(`   Batch size: ${batchSize.toLocaleString()}`);

  if (!APPLY_MODE) {
    console.log(`💡 Dry-run: Would insert ${total.toLocaleString()} documents`);
    return;
  }

  let inserted = 0;
  let batchNumber = 1;

  for (let i = 0; i < total; i += batchSize) {
    const batch = questions.slice(i, i + batchSize);
    await collection.insertMany(batch, { ordered: true });
    inserted += batch.length;

    const progress = ((inserted / total) * 100).toFixed(1);
    console.log(
      `   [${progress.padStart(5, " ")}%] Inserted batch ${batchNumber}: ${inserted.toLocaleString()} / ${total.toLocaleString()}`,
    );

    batchNumber++;
  }

  return inserted;
}

/**
 * Verify restore success
 */
async function verifyRestore(collection, expectedCount, actualInserted) {
  console.log("\n🔍 Verifying restore...");

  const finalCount = await collection.countDocuments();
  console.log(`   Documents after insert: ${finalCount.toLocaleString()}`);
  console.log(`   Expected count: ${expectedCount.toLocaleString()}`);

  if (finalCount === expectedCount) {
    console.log("✅ Restore verification PASSED");
    return true;
  } else {
    console.error(`❌ Restore verification FAILED`);
    console.error(
      `   Difference: ${Math.abs(finalCount - expectedCount).toLocaleString()} documents`,
    );
    return false;
  }
}

/**
 * Close MongoDB connection
 */
async function closeConnection() {
  await mongoose.disconnect();
  console.log("\n👋 Disconnected from MongoDB");
}

/**
 * Main execution
 */
async function main() {
  try {
    // Step 1: Get MongoDB URI
    const mongoUri = await getMongoUri();

    // Step 2: Read backup file
    const backupQuestions = await readBackupFile();

    // Step 3: Connect and verify
    const { collection, currentCount } = await connectAndVerify(
      mongoUri,
      backupQuestions,
    );

    // Step 4: Clear existing (if any)
    await clearExistingCollection(collection, currentCount);

    // Step 5: Insert from backup
    const inserted = await insertQuestions(collection, backupQuestions);

    // Step 6: Verify
    if (APPLY_MODE) {
      const verified = await verifyRestore(
        collection,
        EXPECTED_COUNT,
        inserted,
      );

      if (!verified) {
        console.error("\n❌ RESTORE COMPLETED WITH ISSUES");
        process.exit(1);
      }
    }

    console.log("\n" + "=".repeat(60));
    if (APPLY_MODE) {
      console.log("✅ RESTORE COMPLETED SUCCESSFULLY");
    } else {
      console.log("✅ DRY-RUN COMPLETED (no changes made)");
      console.log("\n💡 Run with --apply flag to execute the restore:");
      console.log(`   node ${process.argv[1]} --apply`);
    }
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\n❌ ERROR:", error.message);
    console.error(error.stack);

    try {
      await closeConnection();
    } catch (e) {
      // Ignore disconnect errors
    }

    process.exit(1);
  }
}

main();
