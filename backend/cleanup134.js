const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const db = mongoose.connection.db;
  const p = await db.collection('payments').findOne({ paymentId: 'PAY-310' });
  console.log(p);
  process.exit(0);
}).catch(console.error);
