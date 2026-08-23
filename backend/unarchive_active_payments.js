const mongoose = require('mongoose');
require('dotenv').config({ path: '.env' });

async function unarchive() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection;
    let unarchivedCount = 0;

    const subs = await db.collection('subscriptions').find({ status: 'active' }).toArray();
    for (const sub of subs) {
      if (sub.paymentId) {
        const payment = await db.collection('payments').findOne({ paymentId: sub.paymentId });
        if (payment && payment.archivedAt !== null) {
          await db.collection('payments').updateOne(
            { _id: payment._id },
            { $set: { archivedAt: null } }
          );
          unarchivedCount++;
          console.log(`Unarchived payment ${payment.paymentId} for active sub ${sub._id}`);
        }
      } else {
        // Find by subscriptionId if no paymentId on sub
        const payment = await db.collection('payments').findOne({ subscriptionId: sub._id, status: 'paid' });
        if (payment && payment.archivedAt !== null) {
          await db.collection('payments').updateOne(
            { _id: payment._id },
            { $set: { archivedAt: null } }
          );
          unarchivedCount++;
          console.log(`Unarchived payment ${payment.paymentId} for active sub ${sub._id}`);
        }
      }
    }

    console.log(`Successfully unarchived ${unarchivedCount} payments!`);
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
}

unarchive();
