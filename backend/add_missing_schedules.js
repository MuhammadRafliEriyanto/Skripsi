const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const AFTERNOON_SLOTS = [
  "13:00 - 14:30",
  "14:30 - 16:00",
  "16:00 - 17:30",
  "18:30 - 20:00"
];

const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"];

async function addMissingSchedules() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection;
    
    // 1. Get all teachers
    const teachers = await db.collection('teachers').find({ status: 'Aktif' }).toArray();
    
    let addedCount = 0;
    
    for (const teacher of teachers) {
      // Check if teacher has schedules
      const scheduleCount = await db.collection('schedules').countDocuments({ teacherId: teacher._id });
      
      if (scheduleCount === 0) {
        console.log(`Teacher ${teacher.teacherId} (Subject: ${teacher.subject}) has 0 schedules. Branch: ${teacher.branch}, Capable Grades: ${teacher.capableGrades}`);
        
        if (!teacher.capableGrades || teacher.capableGrades.length === 0) {
           console.log(`Skipping because no capable grades set.`);
           continue;
        }

        // Find a matching class in this branch
        // For example, if capableGrades is ['8'], look for a student in class like "SMP 8"
        let targetClassName = null;
        
        for (const grade of teacher.capableGrades) {
           const student = await db.collection('students').findOne({
              branch: teacher.branch,
              status: "Aktif",
              className: { $regex: new RegExp(`\\b${grade}\\b`, 'i') }
           });
           
           if (student) {
              targetClassName = student.className;
              break;
           }
        }
        
        if (!targetClassName) {
           console.log(`Skipping because no active students found in branch ${teacher.branch} for grades: ${teacher.capableGrades.join(', ')}`);
           continue;
        }
        
        // Generate Schedule
        const scheduleId = `SCH-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        
        const day = DAYS[Math.floor(Math.random() * DAYS.length)];
        const time = AFTERNOON_SLOTS[Math.floor(Math.random() * AFTERNOON_SLOTS.length)];
        const room = Math.random() > 0.5 ? "Ruangan 1A" : "Ruangan 1B";
        
        const newSchedule = {
            scheduleId,
            day,
            time,
            className: targetClassName,
            subject: teacher.subject,
            teacherId: teacher._id,
            branch: teacher.branch,
            room,
            status: "Terjadwal",
            academicYear: "2025/2026",
            semester: "Semester Genap",
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        const result = await db.collection('schedules').insertOne(newSchedule);
        
        // Generate 24 sessions
        const sessions = [];
        let currentDate = new Date('2026-02-15T00:00:00.000Z'); // start in mid feb
        // Advance to the correct day of week
        const dayMap = { "Senin": 1, "Selasa": 2, "Rabu": 3, "Kamis": 4, "Jumat": 5, "Sabtu": 6, "Minggu": 0 };
        const targetDay = dayMap[day];
        while (currentDate.getDay() !== targetDay) {
           currentDate.setDate(currentDate.getDate() + 1);
        }
        
        for (let i = 1; i <= 24; i++) {
           sessions.push({
               sessionId: `SES-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
               scheduleId,
               classId: `class-${teacher.teacherId.toLowerCase()}-${teacher.branch.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${targetClassName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`, // Note: This might not perfectly match buildStableTeacherClassId, but it's dummy data
               teacherId: teacher._id,
               branch: teacher.branch,
               className: targetClassName,
               subject: teacher.subject,
               date: new Date(currentDate),
               status: i <= 8 ? "Selesai" : "Terjadwal",
               meetingNumber: i,
               qrToken: null,
               createdAt: new Date(),
               updatedAt: new Date()
           });
           
           currentDate.setDate(currentDate.getDate() + 7); // Next week
        }
        
        await db.collection('attendancesessions').insertMany(sessions);
        console.log(`-> Added schedule ${scheduleId} for ${targetClassName} at ${day} ${time}`);
        addedCount++;
      }
    }
    
    console.log(`Finished adding schedules! Total added: ${addedCount}`);
  } catch (error) {
    console.error(error);
  } finally {
    mongoose.disconnect();
  }
}

addMissingSchedules();
