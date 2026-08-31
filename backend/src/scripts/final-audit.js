require("dotenv").config({ path: "backend/.env" });

const { MongoClient, ObjectId } = require('mongodb');

(async () => {
    const client = new MongoClient(process.env.MONGO_URI);
    
    try {
        await client.connect();
        
        const db = client.db('bimbel-lms');
        
        console.log('=== FINAL AUDIT: SMA 10/12 MAPPING ANALYSIS ===\n');
        
        // Step 1: Get all SMA students
        const smaStudents = await db.collection('students')
            .find({ className: { $in: ['SMA 10', 'SMA 12'] } })
            .toArray();
        
        console.log(`Total SMA Students: ${smaStudents.length}`);
        const smaStudentIds = smaStudents.map(s => s.studentId);
        
        // Step 2: Get attempts with exactly 30 answers
        const attempts = await db.collection('studenttaskattempts')
            .find({ studentId: { $in: smaStudentIds } })
            .toArray();
        
        const attempts30 = attempts.filter(a => Array.isArray(a.answers) && a.answers.length === 30);
        
        console.log(`Attempts with 30 answers: ${attempts30.length}\n`);
        
        if (attempts30.length === 0) {
            console.log('NO DATA - Cannot determine mapping.\n');
            return;
        }
        
        // Step 3: Extract unique Task IDs
        const taskIds = [...new Set(attempts30.map(a => a.taskId?.toString()).filter(Boolean))];
        
        console.log(`Unique Tasks referenced: ${taskIds.length}\n`);
        
        // Step 4: Analyze each Task - find by attempt filtering
        let ipaTasks = [];
        let ipsTasks = [];
        let unknownTasks = [];
        
        // First collect all attempts grouped by task
        const tasksWithAttempts = {};
        
        for (const attempt of attempts30) {
            const taskId = attempt.taskId.toString();
            if (!tasksWithAttempts[taskId]) {
                tasksWithAttempts[taskId] = { attempts: [], sample: attempt };
            }
            tasksWithAttempts[taskId].attempts.push(attempt);
        }
        
        // Analyze each unique task
        for (const [taskId, data] of Object.entries(tasksWithAttempts)) {
            const taskDoc = await db.collection('classtasks').findOne({
                _id: data.sample.taskId
            });
            
            if (!taskDoc?.questionBankId) {
                unknownTasks.push(taskId);
                continue;
            }
            
            const qb = await db.collection('questionbanks').findOne({
                _id: taskDoc.questionBankId
            });
            
            if (!qb?.program) {
                unknownTasks.push(taskId);
                continue;
            }
            
            if (qb.program === 'SMA IPA') {
                ipaTasks.push({ 
                    id: taskId, 
                    qbTitle: qb.title,
                    count: data.attempts.length
                });
            } else if (qb.program === 'SMA IPS') {
                ipsTasks.push({ 
                    id: taskId, 
                    qbTitle: qb.title,
                    count: data.attempts.length
                });
            } else {
                unknownTasks.push(taskId);
            }
        }
        
        console.log('========================================');
        console.log('TASK PROGRAM ANALYSIS');
        console.log('========================================\n');
        
        console.log(`SMA IPA Tasks: ${ipaTasks.length}`);
        ipaTasks.forEach(t => console.log(`  - ${t.qbTitle} (${t.id})`));
        
        console.log(`\nSMA IPS Tasks: ${ipsTasks.length}`);
        ipsTasks.forEach(t => console.log(`  - ${t.qbTitle} (${t.id})`));
        
        console.log(`\nUnknown/Missing: ${unknownTasks.length}`);
        
        // Count usage per program
        let ipaUsage = 0;
        let ipsUsage = 0;
        let unknownUsage = 0;
        
        for (const attempt of attempts30) {
            const taskDoc = await db.collection('classtasks').findOne({
                _id: attempt.taskId
            });
            
            if (!taskDoc?.questionBankId) {
                unknownUsage++;
                continue;
            }
            
            const qb = await db.collection('questionbanks').findOne({
                _id: taskDoc.questionBankId
            });
            
            if (qb?.program === 'SMA IPA') ipaUsage++;
            else if (qb?.program === 'SMA IPS') ipsUsage++;
            else unknownUsage++;
        }
        
        console.log('\n\nUSAGE DISTRIBUTION:\n');
        console.log(`SMA IPA: ${ipaUsage} attempts`);
        console.log(`SMA IPS: ${ipsUsage} attempts`);
        console.log(`Unknown/No QB Ref: ${unknownUsage} attempts\n`);
        
        // STEP 5: Final Conclusion
        console.log('### FINAL CONCLUSION ###\n');
        
        if (ipaUsage > 0 && ipsUsage === 0) {
            console.log('✅ DETERMINED: Use QuestionBank SMA IPA');
            console.log(`\nEvidence: All ${ipaUsage} SMA 10/12 attempts use tasks linked to SMA IPA programs.`);
            console.log('\nRecommendation:');
            console.log('- SMA 10 → SMA IPA');
            console.log('- SMA 12 → SMA IPA');
            console.log('\nThis is the SOURCE OF TRUTH based on actual data patterns.');
        } 
        else if (ipsUsage > 0 && ipaUsage === 0) {
            console.log('✅ DETERMINED: Use QuestionBank SMA IPS');
            console.log(`\nEvidence: All ${ipsUsage} SMA 10/12 attempts use tasks linked to SMA IPS programs.`);
            console.log('\nRecommendation:');
            console.log('- SMA 10 → SMA IPS');
            console.log('- SMA 12 → SMA IPS');
            console.log('\nThis is the SOURCE OF TRUTH based on actual data patterns.');
        }
        else if (ipaUsage > 0 && ipsUsage > 0) {
            console.log('⚠️ MIXED USAGE DETECTED');
            console.log(`\nIPA: ${ipaUsage} attempts, IPS: ${ipsUsage} attempts`);
            console.log('\nConclusion: Cannot map to single program without additional rules.');
            console.log('May need subject-based routing or other business logic.');
        }
        else {
            console.log('❌ NO VALID MAPPING FOUND');
            console.log('\nNone of the attempts reference QuestionBank programs.');
            console.log('The system may be using standalone CTQs.');
            console.log('Consider adding questionBankId to ClassTasks.');
        }
        
    } finally {
        await client.close();
    }
})();
