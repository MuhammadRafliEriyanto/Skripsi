const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const MONGODB_URI = process.env.MONGO_URI;

async function clearTasks() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const collections = [
      'classtasks',
      'tasksubmissions',
      'classtaskquestions',
      'studenttaskattempts',
      'taskgrades',
      'studenttryoutattempts'
    ];

    for (const collName of collections) {
      try {
        await mongoose.connection.db.collection(collName).deleteMany({});
        console.log(`Cleared collection: ${collName}`);
      } catch (err) {
        console.log(`Error clearing ${collName} or doesn't exist: ${err.message}`);
      }
    }

    console.log('Done clearing task-related data');
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

clearTasks();
