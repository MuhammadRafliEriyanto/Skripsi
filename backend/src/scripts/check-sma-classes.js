require("dotenv").config({ path: "backend/.env" });

const { MongoClient } = require('mongodb');

(async () => {
    const client = new MongoClient(process.env.MONGO_URI);
    
    try {
        await client.connect();
        
        const db = client.db('bimbel-lms');
        
        // Get SMA students
        const smaStudents = await db.collection('students').find({}).toArray();
        
        console.log(`Total Students: ${smaStudents.length}`);
        
        if (smaStudents.length === 0) {
            console.log('No students found! Check if collection is empty.');
            return;
        }
        
        // Show all class names
        const classes = [...new Set(smaStudents.map(s => s.className))];
        
        console.log('\nAll className values:');
        classes.sort().forEach(c => {
            const count = smaStudents.filter(s => s.className === c).length;
            console.log(`  "${c}": ${count} students`);
        });
        
        // Filter SMA
        const smaClasses = classes.filter(c => c && c.toLowerCase().includes('sma'));
        
        console.log('\nSMA-related classes:');
        smaClasses.forEach(c => {
            const count = smaStudents.filter(s => s.className === c).length;
            console.log(`  "${c}": ${count} students`);
        });
        
        // Sample student structure
        console.log('\nSample Student Document:');
        console.log(JSON.stringify(smaStudents[0], null, 2));
        
        // Check attempts for SMA students
        const smaStudentIds = smaStudents.filter(s => smaClasses.includes(s.className)).map(s => s._id);
        
        if (smaStudentIds.length > 0) {
            const attempts = await db.collection('studenttaskattempts')
                .find({ studentId: { $in: smaStudentIds } })
                .toArray();
            
            console.log(`\nTotal Attempts for SMA Students: ${attempts.length}`);
            
            // Answer length distribution
            const lengths = {};
            attempts.forEach(a => {
                const len = Array.isArray(a.answers) ? a.answers.length : 0;
                lengths[len] = (lengths[len] || 0) + 1;
            });
            
            console.log('\nAnswer Length Distribution:');
            Object.entries(lengths).sort(([a], [b]) => Number(a) - Number(b))
                .forEach(([len, count]) => {
                    console.log(`  ${len.toString().padStart(3)} answers: ${count} attempts`);
                });
        }
        
    } finally {
        await client.close();
    }
})();
