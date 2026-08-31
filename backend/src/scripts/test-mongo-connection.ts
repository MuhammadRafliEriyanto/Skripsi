import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function testConnection() {
  try {
    console.log('Testing MongoDB connection...');
    await mongoose.connect(process.env.MONGO_URI as string);
    console.log('✓ Connected successfully!');
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\nCollections found:', collections.map(c => c.name));
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testConnection();
