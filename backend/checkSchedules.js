const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/bimbel-new').then(async () => {
  const db = mongoose.connection.db;
  const schedules = await db.collection('schedules').find().toArray();
  const students = await db.collection('students').find().toArray();
  const users = await db.collection('users').find().toArray();
  
  console.log("Schedules Count:", schedules.length);
  if (schedules.length > 0) {
    console.log("Sample Schedule:", JSON.stringify(schedules[0], null, 2));
  }
  
  console.log("\nStudents Count:", students.length);
  if (students.length > 0) {
    console.log("Sample Student:", JSON.stringify(students[0], null, 2));
  }
  
  process.exit(0);
});
