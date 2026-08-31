/**
 * Quick check - Look at sample QuestionBank data from MongoDB
 * This will show us what the actual questions look like in the database
 */

require("dotenv").config({ path: ".env" });
const { MongoClient } = require("mongodb");

async function checkQuestionBank() {
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

  try {
    const client = new MongoClient(uri);
    await client.connect();

    console.log("Connected to MongoDB\n");

    const db = client.db("bimbel-lms");
    const questionbanks = db.collection("questionbanks");

    // Get sample of 10 questions with different programs
    const samples = await questionbanks.find({}).limit(10).toArray();

    console.log("=== SAMPLE 10 QUESTIONS FROM QUESTIONBANK ===\n");

    samples.forEach((qb, index) => {
      console.log(`\n${index + 1}. Question ID: ${qb._id}`);
      console.log("   Question Text:", qb.question?.substring(0, 100) + "...");
      console.log("   Options:", qb.options?.join(", "));
      console.log("   Correct Answer:", qb.correctAnswer);
      console.log("   Program:", qb.program);
      console.log("   Mapel:", qb.mapel);
      console.log("   Topic:", qb.topics?.join(", "));
      console.log("   Level:", qb.level);
    });

    // Count by program and subject
    console.log("\n\n=== DISTRIBUTION BY PROGRAM & SUBJECT ===\n");

    const distribution = await questionbanks
      .aggregate([
        {
          $group: {
            _id: { program: "$program", mapel: "$mapel" },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.program": 1, count: -1 } },
      ])
      .toArray();

    distribution.forEach((item) => {
      console.log(
        `${item._id.program.padEnd(10)} | ${item._id.mapel.padEnd(15)} | ${item.count} soal`,
      );
    });

    await client.close();
    console.log("\n\n✅ Done!");
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

checkQuestionBank();
