const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGO_URI;

if (!uri) {
  throw new Error('MONGO_URI is required. Set it in backend/.env before running this script.');
}

async function run() {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, family: 4 });
  try {
    await client.connect();
    console.log('Connected successfully to server');
    const db = client.db();
    const collections = await db.collections();
    console.log('Collections:', collections.map(c => c.collectionName));
  } catch (err) {
    console.error('Connection error:', err);
  } finally {
    await client.close();
  }
}
run();
