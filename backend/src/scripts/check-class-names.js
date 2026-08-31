const { MongoClient } = require('mongodb');

(async () => {
    const client = new MongoClient('mongodb://localhost:27017');
    await client.connect();
    
    const db = client.db('bimbel_db');
    
    // Get distinct class values from students
    const classValues = await db.collection('students').distinct('className');
    
    console.log('All distinct className values in students collection:');
    classValues.sort().forEach(val => {
        console.log(`  "${val}"`);
    });
    
    // Check how many of each
    const classCounts = {};
    const students = await db.collection('students').find({}).toArray();
    students.forEach(s => {
        const val = s.className || 'NULL';
        classCounts[val] = (classCounts[val] || 0) + 1;
    });
    
    console.log('\nDistribution:');
    Object.entries(classCounts).sort(([a], [b]) => b.length - a.length || a.localeCompare(b)).forEach(([cls, count]) => {
        console.log(`  ${count.toString().padStart(5)} | "${cls}"`);
    });
    
    await client.close();
})();
