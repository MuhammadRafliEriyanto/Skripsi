const { MongoClient } = require('mongodb');

const uri = "mongodb://raflimhmmd621_db_user:MuhRafli310104%2A@ac-xoluqrw-shard-00-00.ahx9jjw.mongodb.net:27017,ac-xoluqrw-shard-00-01.ahx9jjw.mongodb.net:27017,ac-xoluqrw-shard-00-02.ahx9jjw.mongodb.net:27017/bimbel-lms?ssl=true&replicaSet=atlas-26q8td-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0";

async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('bimbel-lms');
    
    const students = await db.collection('users').find({
      role: 'siswa',
      className: /4/
    }).toArray();
    
    console.log("SD Kelas 4 Students:");
    console.log(JSON.stringify(students, null, 2));

  } finally {
    await client.close();
  }
}

run().catch(console.dir);
