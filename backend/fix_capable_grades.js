const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

async function fixCapableGrades() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection;
    const teachers = await db.collection('teachers').find().toArray();
    let updated = 0;

    for (const teacher of teachers) {
      if (!teacher.classList) continue;
      
      const newCapableGrades = teacher.classList.split(",").map(v => v.trim()).filter(Boolean);
      const currentGrades = teacher.capableGrades || [];
      
      const isDifferent = newCapableGrades.length !== currentGrades.length || 
                          !newCapableGrades.every((val, index) => val === currentGrades[index]);

      if (isDifferent) {
        await db.collection('teachers').updateOne(
          { _id: teacher._id },
          { $set: { capableGrades: newCapableGrades } }
        );
        updated++;
      }
    }

    console.log(`Finished fixing capable grades! Updated: ${updated}`);
  } catch (error) {
    console.error(error);
  } finally {
    mongoose.disconnect();
  }
}

fixCapableGrades();
