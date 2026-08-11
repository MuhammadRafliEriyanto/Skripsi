const mongoose = require('mongoose');

async function updateStudents() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/bimbel-new');
    
    const Student = mongoose.model('Student', new mongoose.Schema({}, { strict: false }));
    
    // Slawi Wetan is 11 chars, < 14 chars. 081234567890 is 12 chars, < 14 chars.
    const result = await Student.updateMany(
      {},
      { 
        $set: { 
          phone: "081234567890", 
          address: "Slawi Wetan" 
        } 
      }
    );
    
    console.log(`Updated ${result.modifiedCount} students.`);
  } catch (error) {
    console.error(error);
  } finally {
    await mongoose.disconnect();
  }
}

updateStudents();
