require('dotenv').config();
const mongoose = require('mongoose');

async function updateSchedules() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB!");
    
    const db = mongoose.connection.db;
    
    // Update all schedules to match SMP 8 and 2026/2027
    const result = await db.collection('schedules').updateMany(
      {}, 
      { 
        $set: { 
          className: "SMP 8",
          academicYear: "2026/2027",
          semester: "Ganjil"
        } 
      }
    );
    
    console.log(`Successfully updated ${result.modifiedCount} schedules!`);
    
    const schedules = await db.collection('schedules').find().toArray();
    console.log("\nUpdated Schedules Sample:");
    if (schedules.length > 0) {
      console.log(JSON.stringify(schedules[0], null, 2));
    }
    
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

updateSchedules();
