require('dotenv').config();
const mongoose = require('mongoose');

async function test() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB!");
    
    const db = mongoose.connection.db;
    
    // Fetch one schedule to see its structure
    const schedules = await db.collection('schedules').find().limit(3).toArray();
    console.log("\nSchedules found:", schedules.length);
    if (schedules.length > 0) {
      console.log(JSON.stringify(schedules, null, 2));
    }
    
    // Fetch a user to see what their class is
    const students = await db.collection('students').find().limit(2).toArray();
    console.log("\nStudents found:", students.length);
    if (students.length > 0) {
      console.log(JSON.stringify(students, null, 2));
    }
    
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

test();
