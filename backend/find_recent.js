const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/bimbel-new').then(async () => {
  const db = mongoose.connection.db;
  const recentPayments = await db.collection('payments').find({}).sort({ createdAt: -1 }).limit(10).toArray();
  
  for (const p of recentPayments) {
    const student = await db.collection('students').findOne({ _id: p.studentId });
    console.log(`Payment: ${p.paymentId} | Status: ${p.status} | Created: ${p.createdAt} | Student: ${student ? student.id : 'N/A'}`);
  }
  process.exit(0);
});
