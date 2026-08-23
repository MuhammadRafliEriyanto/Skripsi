const mongoose = require('mongoose');
require('dotenv').config({ path: '.env' });

async function fixRecords() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection;
    
    // Fix Mustika
    const sMustika = await db.collection('students').findOne({ studentId: 'STD-018' });
    if(sMustika) {
      const pendingPayment = await db.collection('payments').findOne({ studentId: sMustika._id, status: 'pending' });
      if(pendingPayment) {
        await db.collection('payments').updateOne(
          { _id: pendingPayment._id },
          { $set: { status: 'paid', paidAt: new Date(), paymentMethod: 'Manual' } }
        );
        await db.collection('subscriptions').updateOne(
          { _id: pendingPayment.subscriptionId },
          { $set: { status: 'active', activatedAt: new Date() } }
        );
        await db.collection('students').updateOne(
          { _id: sMustika._id },
          { $set: { status: 'Aktif', subscription: pendingPayment.subscriptionId } }
        );
        console.log('Mustika fixed: Payment marked as paid and subscription activated.');
      } else {
        console.log('Mustika has no pending payment');
      }
    }

    // Fix Syakira
    const sSyakira = await db.collection('students').findOne({ studentId: 'STD-154' });
    if(sSyakira) {
      const activeSub = await db.collection('subscriptions').findOne({ studentId: sSyakira._id, status: 'active' });
      if(activeSub) {
        await db.collection('students').updateOne(
          { _id: sSyakira._id },
          { $set: { status: 'Aktif', subscription: activeSub._id } }
        );
        console.log('Syakira fixed: Attached active subscription and set to Aktif.');
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
}

fixRecords();
