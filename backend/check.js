const mongoose = require('mongoose');

async function check() {
  try {
    await mongoose.connect('mongodb://raflimhmmd621_db_user:MuhRafli310104%2A@ac-xoluqrw-shard-00-00.ahx9jjw.mongodb.net:27017,ac-xoluqrw-shard-00-01.ahx9jjw.mongodb.net:27017,ac-xoluqrw-shard-00-02.ahx9jjw.mongodb.net:27017/bimbel-lms?ssl=true&replicaSet=atlas-26q8td-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0');
    const coll = mongoose.connection.db.collection('students');
    const count = await coll.countDocuments();
    console.log(`students count: ${count}`);
    const result = await coll.updateMany({}, { $set: { phone: "081234567890", address: "Slawi Wetan" } });
    console.log(`updated: ${result.modifiedCount}`);
  } catch(e) {
    console.error(e);
  } finally {
    await mongoose.disconnect();
  }
}
check();
