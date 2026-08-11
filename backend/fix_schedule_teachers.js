const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

async function fixScheduleTeachers() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    const db = mongoose.connection;
    const schedules = await db.collection('schedules').find().toArray();
    
    const teacherMap = {}; // key: "branch::className::subject" -> teacherId

    for (const schedule of schedules) {
      if (!schedule.subject || !schedule.className || !schedule.branch || !schedule.teacherId) continue;
      
      const key = `${schedule.branch}::${schedule.className}::${schedule.subject}`;
      
      if (!teacherMap[key]) {
        // Assign the first teacher we see as the canonical teacher for this subject in this class
        teacherMap[key] = schedule.teacherId;
      }
    }
    
    let scheduleUpdated = 0;
    let sessionUpdated = 0;

    for (const schedule of schedules) {
      if (!schedule.subject || !schedule.className || !schedule.branch || !schedule.teacherId) continue;
      
      const key = `${schedule.branch}::${schedule.className}::${schedule.subject}`;
      const canonicalTeacherId = teacherMap[key];
      
      if (schedule.teacherId.toString() !== canonicalTeacherId.toString()) {
        await db.collection('schedules').updateOne(
          { _id: schedule._id },
          { $set: { teacherId: canonicalTeacherId } }
        );
        scheduleUpdated++;
      }
      
      // Update attendance sessions linked to this schedule to match the canonical teacher
      const result = await db.collection('attendancesessions').updateMany(
        { scheduleId: schedule.scheduleId },
        { $set: { teacherId: canonicalTeacherId } }
      );
      sessionUpdated += result.modifiedCount;
    }
    
    // Also catch any stray attendance sessions that don't have scheduleId but have className/subject
    const sessions = await db.collection('attendancesessions').find().toArray();
    for(const session of sessions) {
        if(!session.className || !session.subject || !session.branch) continue;
        const key = `${session.branch}::${session.className}::${session.subject}`;
        const canonicalTeacherId = teacherMap[key];
        
        if (canonicalTeacherId && session.teacherId.toString() !== canonicalTeacherId.toString()) {
             await db.collection('attendancesessions').updateOne(
                { _id: session._id },
                { $set: { teacherId: canonicalTeacherId } }
             );
             sessionUpdated++;
        }
    }

    console.log(`Finished fixing dummy data!`);
    console.log(`Schedules updated: ${scheduleUpdated}`);
    console.log(`Attendance Sessions updated: ${sessionUpdated}`);
  } catch (error) {
    console.error(error);
  } finally {
    mongoose.disconnect();
  }
}

fixScheduleTeachers();
