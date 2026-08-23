const mongoose = require('mongoose');
require('dotenv').config({ path: '.env' });

async function fixMustika() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection;
    const sMustika = await db.collection('students').findOne({ studentId: 'STD-018' });
    
    // Find her pending payment and mark as paid
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
        console.log("Marked pending payment and subscription as active/paid.");
    }

    // Attach active subscription to student record to fix anomaly
    const activeSub = await db.collection('subscriptions').findOne({ studentId: sMustika._id, status: 'active' });
    if (activeSub) {
      await db.collection('students').updateOne(
        { _id: sMustika._id },
        { $set: { status: 'Aktif', subscription: activeSub._id } }
      );
      console.log('Mustika fixed: attached active subscription', activeSub._id);
    } else {
      console.log('No active sub found for Mustika');
    }
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
}

fixMustika();
