const { MongoClient } = require('mongodb');

require("dotenv").config({ path: "backend/.env" });

(async () => {
    console.log('Using MONGO_URI from .env:', process.env.MONGO_URI);
    
    const client = new MongoClient(process.env.MONGO_URI);
    
    try {
        await client.connect();
        console.log('Connected to MongoDB Atlas\n');
        
        // List all databases
        const admin = client.db().admin();
        const dbInfo = await admin.listDatabases();
        
        console.log('Available databases:');
        dbInfo.databases.forEach(db => {
            console.log(`  - ${db.name} (${db.sizeOnDisk ? db.sizeOnDisk.toLocaleString() + ' bytes' : 'unknown size'})`);
        });
        
        // Check bimbel_db or first matching database
        const dbName = 'bimbel_db';
        const db = client.db(dbName);
        
        const collections = await db.listCollections().toArray();
        console.log(`\nCollections in '${dbName}':`);
        collections.forEach(c => {
            console.log(`  - ${c.name}`);
        });
        
        if (collections.length === 0) {
            console.log('\nNo collections found in bimbel_db!');
            console.log('Trying default database...');
            
            const currentDb = client.db();
            const currentCols = await currentDb.listCollections().toArray();
            console.log('\nCollections in current database:');
            currentCols.forEach(c => {
                console.log(`  - ${c.name}`);
            });
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.close();
    }
})();
