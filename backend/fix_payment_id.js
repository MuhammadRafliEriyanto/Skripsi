const mongoose = require('mongoose');
require('dotenv').config({ path: '.env' });

async function fix() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection;

    const sSyakira = await db.collection('students').findOne({ studentId: 'STD-154' });
    const paySyakira = await db.collection('payments').findOne({ subscriptionId: sSyakira.subscription });
    if (paySyakira) {
      await db.collection('subscriptions').updateOne(
        { _id: sSyakira.subscription },
        { $set: { paymentId: paySyakira.paymentId } }
      );
      console.log('Fixed Syakira: set paymentId', paySyakira.paymentId, 'on her active sub');
    }

    const sMustika = await db.collection('students').findOne({ studentId: 'STD-018' });
    const payMustika = await db.collection('payments').findOne({ subscriptionId: sMustika.subscription });
    if (payMustika) {
      await db.collection('subscriptions').updateOne(
        { _id: sMustika.subscription },
        { $set: { paymentId: payMustika.paymentId } }
      );
      console.log('Fixed Mustika: set paymentId', payMustika.paymentId, 'on her active sub');
    }

  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
}

fix();
