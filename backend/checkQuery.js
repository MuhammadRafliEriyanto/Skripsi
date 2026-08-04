require('dotenv').config();
const mongoose = require('mongoose');

async function check() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected!");

    const filter = {
      $or: [
        { academicYear: "2026/2027", semester: "Ganjil" },
        {
          $and: [
            { $or: [{ academicYear: null }, { academicYear: { $exists: false } }] }
          ]
        }
      ],
      branch: { $in: ["slawi", "slawi", "SLAWI", "Pusat", "pusat", "", "-", null] }
    };

    const schedules = await mongoose.connection.db.collection('schedules').find(filter).toArray();
    console.log("Found raw schedules matching filter:", schedules.length);
    
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
check();
