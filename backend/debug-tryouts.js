const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGO_URI;

if (!uri) {
  throw new Error('MONGO_URI is required. Set it in backend/.env before running this script.');
}

mongoose.connect(uri)
  .then(async () => {
    const TeacherTryout = mongoose.model('TeacherTryout', new mongoose.Schema({}, { strict: false }));
    const tryouts = await TeacherTryout.find({});
    console.log(`TOTAL TRYOUTS IN DB: ${tryouts.length}`);
    tryouts.forEach(t => {
      console.log(`- ${t.title || t.judulTryout} | academicYear: ${t.academicYear} | semester: ${t.semester}`);
    });
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
