const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const StudentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  phone: { type: String, default: "" },
  address: { type: String, default: "" },
}, { strict: false });

const Student = mongoose.model("Student", StudentSchema);

const getRandomPhone = () => {
  const prefixes = ["0812", "0813", "0852", "0853", "0811", "0821", "0822", "0823", "0851", "0815", "0816", "0858", "0814", "0896", "0895", "0897", "0898", "0899", "0817", "0818", "0819", "0859", "0877", "0878", "0838", "0831", "0832", "0833", "0881", "0882", "0883", "0884", "0885", "0886", "0887", "0888", "0889"];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const length = Math.floor(Math.random() * 3) + 8; // 8 to 10 digits after prefix
  let number = prefix;
  for (let i = 0; i < length; i++) {
    number += Math.floor(Math.random() * 10);
  }
  return number;
};

const getRandomAddress = () => {
  const types = ["Desa", "Perumahan", "Jalan", "Kampung", "Komplek"];
  const type = types[Math.floor(Math.random() * types.length)];
  
  const names = ["Sukamaju", "Sukarami", "Mekar Jaya", "Indah Permai", "Cempaka", "Anggrek", "Melati", "Mawar", "Cendrawasih", "Merdeka", "Sudirman", "Thamrin", "Gatot Subroto", "Diponegoro", "Imam Bonjol", "Pattimura", "Teuku Umar", "Kartini", "Ki Hajar Dewantara", "Ahmad Yani"];
  const name = names[Math.floor(Math.random() * names.length)];

  const blocks = ["Blok A", "Blok B", "Blok C", "Blok D", "Blok E", "Blok F", "Blok G"];
  
  if (type === "Perumahan" || type === "Komplek") {
    const block = blocks[Math.floor(Math.random() * blocks.length)];
    const no = Math.floor(Math.random() * 50) + 1;
    return `${type} ${name} ${block} No. ${no}, RT ${Math.floor(Math.random() * 10) + 1}/RW ${Math.floor(Math.random() * 10) + 1}`;
  } else if (type === "Jalan") {
    const no = Math.floor(Math.random() * 100) + 1;
    return `${type} ${name} No. ${no}, RT ${Math.floor(Math.random() * 10) + 1}/RW ${Math.floor(Math.random() * 10) + 1}`;
  } else {
    return `${type} ${name} RT ${Math.floor(Math.random() * 10) + 1}/RW ${Math.floor(Math.random() * 10) + 1}`;
  }
};

async function main() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error("MONGO_URI is not set in .env");
      process.exit(1);
    }
    
    console.log("Connecting to MongoDB:", mongoUri);
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB.");

    const students = await Student.find({});
    console.log(`Found ${students.length} students. Updating...`);

    let updatedCount = 0;
    for (const student of students) {
      student.phone = getRandomPhone();
      student.address = getRandomAddress();
      await student.save();
      updatedCount++;
    }

    console.log(`Successfully updated ${updatedCount} students.`);
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
