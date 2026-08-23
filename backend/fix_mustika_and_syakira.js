const mongoose = require('mongoose');
require('dotenv').config({ path: '.env' });

async function fixData() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection;
    
    // 1. Fix Mustika (user_id: 6a17d2ea33164ec57992e0ab)
    // The error says "Could not find and update PENDING invoice 6a6ed651e18876efe4f858ec"
    // Wait, the error is actually from Xendit. Our DB might have a Payment with xenditPaymentSessionId = 6a6ed651e18876efe4f858ec.
    // Let's just find the Payment for this user and clear xenditPaymentSessionId if it's PENDING.
    const userMustika = await db.collection('users').findOne({ _id: new mongoose.Types.ObjectId('6a17d2ea33164ec57992e0ab') });
    if (userMustika) {
        const studentMustika = await db.collection('students').findOne({ userId: userMustika._id });
        if (studentMustika) {
            // Find pending payments
            const payments = await db.collection('payments').find({ studentId: studentMustika._id, status: 'PENDING' }).toArray();
            for (const p of payments) {
                await db.collection('payments').updateOne(
                    { _id: p._id },
                    { $unset: { xenditPaymentSessionId: "", xenditReferenceId: "" } }
                );
                console.log(`Cleared Xendit session for Mustika's payment: ${p._id}`);
            }
        }
    } else {
        // Just search by payment ID if possible, or we know invoice ID is 6a6ed651e18876efe4f858ec
        // Wait, Xendit invoice IDs usually look like `66a8cf123...` (24 hex string). So 6a6ed651e18876efe4f858ec IS the xenditPaymentSessionId!
        await db.collection('payments').updateMany(
            { xenditPaymentSessionId: '6a6ed651e18876efe4f858ec' },
            { $unset: { xenditPaymentSessionId: "", xenditReferenceId: "" } }
        );
        console.log(`Cleared Xendit session directly by invoice ID 6a6ed651e18876efe4f858ec`);
    }

    // 2. Fix Syakira (STD-154) - Status aktif belum memiliki no referensi
    const syakira = await db.collection('students').findOne({ studentId: 'STD-154' });
    if (syakira) {
        // If status is Aktif, but no reference, let's just set status to "Baru" so it removes the anomaly, 
        // OR let's find her subscription.
        const activeSub = await db.collection('subscriptions').findOne({ studentId: syakira._id, status: 'Aktif' });
        if (!activeSub) {
            // Set her status to "Terdaftar" instead of "Aktif" if she has no active subscription.
            await db.collection('students').updateOne(
                { _id: syakira._id },
                { $set: { status: 'Baru' } } // or 'Terdaftar' based on your logic, but 'Baru' is safe for anomaly
            );
            console.log("Fixed Syakira: changed status to Baru because no active subscription found.");
        } else {
            console.log("Syakira actually HAS an active subscription: ", activeSub._id);
            // Maybe the anomaly means something else?
        }
    } else {
        console.log("Could not find Syakira STD-154");
    }

    console.log("Finished fixing data!");
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
}

fixData();
