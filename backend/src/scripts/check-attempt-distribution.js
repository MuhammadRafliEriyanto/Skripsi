const { MongoClient } = require('mongodb');

(async () => {
    const client = new MongoClient('mongodb://localhost:27017');
    await client.connect();
    
    const db = client.db('bimbel_db');
    
    // Get SMA students
    const smaStudents = await db.collection('students').find({
        className: { $in: ['SMA 10', 'SMA 12'] }
    }).toArray();
    
    console.log('Total SMA Students:', smaStudents.length);
    
    const studentIds = smaStudents.map(s => s._id);
    
    // Get sample attempts
    const allAttempts = await db.collection('studenttaskattempts')
        .find({ studentId: { $in: studentIds } })
        .toArray();
    
    console.log('Total SMA Attempts:', allAttempts.length);
    
    // Analyze answer distribution
    const lengths = {};
    allAttempts.forEach(a => {
        const len = Array.isArray(a.answers) ? a.answers.length : 0;
        lengths[len] = (lengths[len] || 0) + 1;
    });
    
    console.log('\nAnswer Length Distribution:');
    Object.entries(lengths).sort(([a], [b]) => Number(a) - Number(b)).forEach(([len, count]) => {
        console.log(`  ${len} answers: ${count} attempts`);
    });
    
    // Show sample attempt structure
    if (allAttempts.length > 0) {
        console.log('\nSample Attempt Structure:');
        console.log(JSON.stringify(allAttempts[0], null, 2));
    }
    
    await client.close();
})();
