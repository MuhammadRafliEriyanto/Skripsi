const mongoose = require('mongoose');
require('dotenv').config({path: './.env'});

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const db = mongoose.connection.db;
  const payments = await db.collection('payments').find({}).toArray();
  const students = await db.collection('students').find({}).toArray();
  const studentMap = new Map(students.map(s => [s._id.toString(), s]));
  
  for (const p of payments) {
    const s = studentMap.get(p.studentId.toString());
    if (!s) {
      console.log(`Orphaned: ${p._id}`);
      await db.collection('payments').deleteOne({ _id: p._id });
      console.log(`Deleted orphaned payment ${p._id}`);
    } else if (!s.studentId) {
      console.log(`Anomaly: Student ${s._id} has no studentId. Payment: ${p._id}`);
      await db.collection('payments').deleteOne({ _id: p._id });
      console.log(`Deleted payment ${p._id} for student without studentId.`);
    }
  }
  
  console.log('Done.');
  process.exit(0);
}

run().catch(console.error);
