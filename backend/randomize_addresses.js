const mongoose = require('mongoose');

const regions = [
  "Kudaile",
  "Slawi Wtn", // Shortened from Slawi Wetan to fit limits
  "Slawi Kln", // Shortened from Slawi Kulon
  "Kagok",
  "Slawi Pos",
  "PalemAsri", // Shortened from Palem Asri
  "Dk.Waru"    // Shortened from Dukuhwaru
];

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRandomAddress() {
  const region = regions[Math.floor(Math.random() * regions.length)];
  // 50% chance for RT/RW, 50% chance for No Rumah
  if (Math.random() > 0.5) {
    const rt = getRandomInt(1, 9);
    const rw = getRandomInt(1, 9);
    return `${region} ${rt}/${rw}`; // e.g., "Kudaile 1/2"
  } else {
    const no = getRandomInt(1, 99);
    return `${region} N${no}`; // e.g., "Kagok N12"
  }
}

async function randomizeAddresses() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect('mongodb://raflimhmmd621_db_user:MuhRafli310104%2A@ac-xoluqrw-shard-00-00.ahx9jjw.mongodb.net:27017,ac-xoluqrw-shard-00-01.ahx9jjw.mongodb.net:27017,ac-xoluqrw-shard-00-02.ahx9jjw.mongodb.net:27017/bimbel-lms?ssl=true&replicaSet=atlas-26q8td-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0');
    
    const Student = mongoose.model('Student', new mongoose.Schema({}, { strict: false }));
    const students = await Student.find({}, { _id: 1 });
    
    console.log(`Found ${students.length} students. Starting bulk update...`);
    
    const bulkOps = students.map(student => {
      return {
        updateOne: {
          filter: { _id: student._id },
          update: { $set: { address: generateRandomAddress() } }
        }
      };
    });

    const result = await Student.bulkWrite(bulkOps);
    console.log(`Successfully updated ${result.modifiedCount} addresses.`);
  } catch (error) {
    console.error("Error updating addresses:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected.");
  }
}

randomizeAddresses();
