require("dotenv").config();
const mongoose = require("mongoose");
const Schedule = require("./backend/src/models/Schedule").Schedule;

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const scheduleFilter = {
    $and: [
      {
        $or: [
          { academicYear: "2026/2027" }
        ]
      },
      {
        $or: [
          { branch: "Cimahi" },
          { branch: "" },
          { branch: "-" },
          { branch: null },
          { branch: { $exists: false } }
        ]
      }
    ]
  };

  console.time("Schedule.find");
  const rawSchedules = await Schedule.find(scheduleFilter)
    .sort({ createdAt: -1 })
    .lean()
    .exec();
  console.timeEnd("Schedule.find");

  console.log(`Found ${rawSchedules.length} schedules.`);

  console.time("ClassMaterial.find");
  const materials = await mongoose.model("ClassMaterial").find({
    academicYear: "2026/2027"
  }).lean().exec();
  console.timeEnd("ClassMaterial.find");
  
  process.exit(0);
}

run().catch(console.error);
