const mongoose = require('mongoose');
require('dotenv').config({ path: '.env' });

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const db = mongoose.connection;
  await db.collection('schedules').updateOne({ scheduleId: 'SCH-BIMBEL-P1P9-03zwn7m' }, { $set: { time: '16:00 - 17:30' } });
  console.log('Updated schedule time!');
  mongoose.disconnect();
});
