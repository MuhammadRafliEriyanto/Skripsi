const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/bimbel-new').then(async () => {
  const db = mongoose.connection.db;
  const students = await db.collection('students').find({ className: { $regex: '4' }, program: 'SD' }).toArray();
  
  for (const s of students) {
    const payments = await db.collection('payments').find({ studentId: s._id }).toArray();
    if (payments.length > 0) {
      console.log('Student:', s.id, s.className, s.program);
      for (const p of payments) {
        console.log(' - Payment:', p.paymentId, p.status, p.createdAt);
      }
    }
  }

  process.exit(0);
});
