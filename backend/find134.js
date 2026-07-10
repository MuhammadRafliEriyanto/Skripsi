const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/bimbel-new').then(async () => {
  const db = mongoose.connection.db;
  const students = await db.collection('students').find({ id: { $regex: '134' } }).toArray();
  console.log('Students:', students.map(s => s.id));
  
  if (students.length === 1) {
    const studentId = students[0]._id;
    console.log('Found student:', students[0].id);
    const payments = await db.collection('payments').find({ studentId }).toArray();
    console.log('Payments:', payments.length);
    for (const p of payments) {
      console.log('Payment:', p.paymentId, p.status, p.createdAt);
    }
    const subscriptions = await db.collection('subscriptions').find({ studentId }).toArray();
    console.log('Subscriptions:', subscriptions.length);
    for (const s of subscriptions) {
      console.log('Subscription:', s.subscriptionCode, s.paymentStatus, s.createdAt);
    }
  }

  process.exit(0);
});
