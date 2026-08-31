const { MongoClient } = require('mongodb');

(async () => {
    const client = new MongoClient('mongodb://localhost:27017');
    await client.connect();
    
    const db = client.db('bimbel_db');
    
    // Check if students collection exists and has data
    const studentCount = await db.collection('students').countDocuments();
    console.log('Total students:', studentCount);
    
    if (studentCount > 0) {
        const sample = await db.collection('students').findOne();
        console.log('\nSample Student Document:');
        console.log(JSON.stringify(sample, null, 2));
        
        // Get all keys from multiple samples
        const samples = await db.collection('students').find({}).limit(5).toArray();
        const allKeys = new Set();
        samples.forEach(s => Object.keys(s).forEach(k => allKeys.add(k)));
        
        console.log('\nAll fields found in students:');
        Array.from(allKeys).sort().forEach(k => console.log(`  - ${k}`));
    } else {
        console.log('Students collection is empty. Checking other collections...');
        
        // List all collections
        const collections = await db.listCollections().toArray();
        console.log('\nCollections in database:', collections.map(c => c.name).join(', '));
    }
    
    await client.close();
})();
