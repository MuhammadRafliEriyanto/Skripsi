const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env.local") });

async function checkMismatch() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Check schemas
    const Schedule = mongoose.connection.collection("schedules");
    const AttendanceSession = mongoose.connection.collection("attendancesessions");
    
    const sessions = await AttendanceSession.find().toArray();
    let mismatchedCount = 0;

    for (const session of sessions) {
      if (!session.scheduleId) continue;
      
      const schedule = await Schedule.findOne({ scheduleId: session.scheduleId });
      if (schedule) {
        const sessionTeacher = session.teacherId.toString();
        const scheduleTeacher = schedule.teacherId.toString();
        
        if (sessionTeacher !== scheduleTeacher) {
          mismatchedCount++;
          console.log(`Mismatch found! Schedule ID: ${session.scheduleId} | Schedule Teacher: ${scheduleTeacher} | Session Teacher: ${sessionTeacher}`);
        }
      }
    }
    
    console.log(`Total Mismatched: ${mismatchedCount}`);
  } catch (error) {
    console.error(error);
  } finally {
    mongoose.disconnect();
  }
}

checkMismatch();
