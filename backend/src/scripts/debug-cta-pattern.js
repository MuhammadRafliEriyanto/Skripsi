require("dotenv").config({ path: "backend/.env" });

const { MongoClient } = require('mongodb');

(async () => {
    const client = new MongoClient(process.env.MONGO_URI);
    
    try {
        await client.connect();
        
        const db = client.db('bimbel-lms');
        
        console.log('=== INVESTIGATING CTQ PATTERN ===\n');
        
        // Sample from previous attempt
        const sampleCTQIds = [
            'CTQ-BIMBEL-P1P9-1b2bd2b',
            'CTQ-BIMBEL-P1P9-1bcayra',
            'CTQ-BIMBEL-P1P9-1bmakg9'
        ];
        
        // Find matching ClassTaskQuestions
        const ctqCollection = db.collection('classtaskquestions');
        
        const sampleCtqs = await ctqCollection.find({ 
            classtaskQuestionId: { $in: sampleCTQIds } 
        }).toArray();
        
        console.log(`Found ${sampleCtqs.length} matching ClassTaskQuestions\n`);
        
        if (sampleCtqs.length > 0) {
            console.log('Sample ClassTaskQuestion Structure:');
            console.log(JSON.stringify(sampleCtqs[0], null, 2));
            
            // Extract Task ID from first CTQ
            if (sampleCtqs[0].taskId) {
                console.log(`\nTaskID: ${sampleCtqs[0].taskId.toString()}`);
                
                const task = await db.collection('classtasks').findOne({
                    _id: sampleCtqs[0].taskId
                });
                
                if (task) {
                    console.log('\nClassTask Document:');
                    console.log(JSON.stringify(task, null, 2));
                    
                    // Check if Task has any QB reference
                    if (task.questionBankId) {
                        console.log(`\n⚠️ Task HAS questionBankId: ${task.questionBankId.toString()}`);
                        
                        const qbRef = await db.collection('questionbanks').findOne({
                            _id: task.questionBankId
                        });
                        
                        if (qbRef) {
                            console.log('\nReferenced QuestionBank:');
                            console.log(`Program: ${qbRef.program}`);
                            console.log(`Subject: ${qbRef.subject}`);
                            console.log(`Title: ${qbRef.title}`);
                        }
                    } else {
                        console.log('\n❌ Task does NOT have questionBankId - Uses individual CTQs only');
                    }
                }
            }
        }
        
        // NOW: Analyze ALL SMA attempts to see pattern
        console.log('\n\n========================================');
        console.log('MASSIVE ANALYSIS OF CLASS TASK PATTERNS');
        console.log('========================================\n');
        
        const smaStudents = await db.collection('students')
            .find({ className: { $in: ['SMA 10', 'SMA 12'] } })
            .toArray();
        
        const smaStudentIds = smaStudents.map(s => s.studentId);
        
        const attempts30 = await db.collection('studenttaskattempts')
            .find({
                studentId: { $in: smaStudentIds },
                'answers.0': { $exists: true }
            })
            .toArray()
            .filter(a => Array.isArray(a.answers) && a.answers.length === 30);
        
        console.log(`Total 30-answer SMA Attempts: ${attempts30.length}\n`);
        
        // Extract all unique Task IDs and analyze their patterns
        const taskPatterns = new Map();
        const ctqPrograms = new Map();
        
        for (const attempt of attempts30) {
            const classId = attempt.taskId?.toString();
            if (!classId) continue;
            
            if (!taskPatterns.has(classId)) {
                taskPatterns.set(classId, {
                    count: 0,
                    meetingNumbers: new Set(),
                    subjects: new Set(),
                    sampleAttempt: null,
                    tasks: null
                });
            }
            
            taskPatterns.get(classId).count++;
            if (attempt.meetingNumber) {
                taskPatterns.get(classId).meetingNumbers.add(attempt.meetingNumber);
            }
            if (attempt.subject) {
                taskPatterns.get(classId).subjects.add(attempt.subject);
            }
            
            if (!taskPatterns.get(classId).sampleAttempt) {
                taskPatterns.get(classId).sampleAttempt = attempt;
            }
        }
        
        console.log(`\nAnalyzing ${taskPatterns.size} unique Tasks:\n`);
        
        let hasIpqa = false;
        let hasIps = false;
        
        for (const [taskId, data] of taskPatterns.entries()) {
            const taskDoc = await db.collection('classtasks').findOne({
                _id: data.sampleAttempt.taskId
            });
            
            let program = null;
            
            if (taskDoc?.questionBankId) {
                const qbRef = await db.collection('questionbanks').findOne({
                    _id: taskDoc.questionBankId
                });
                program = qbRef?.program || null;
            }
            
            data.tasks = taskDoc;
            data.program = program;
            
            if (program === 'SMA IPA') hasIpqa = true;
            if (program === 'SMA IPS') hasIps = true;
            
            // Print samples
            if (data.count <= 5) {
                console.log(`Task: ${taskId}`);
                console.log(`  Usage: ${data.count} attempts`);
                console.log(`  Meeting: ${Array.from(data.meetingNumbers).join(', ')}`);
                console.log(`  Subject: ${Array.from(data.subjects).join(', ')}`);
                console.log(`  Program: ${program || 'NONE (No QB ref)'}`);
                console.log('');
            }
        }
        
        // FINAL CONCLUSION
        console.log('\n\n### FINAL AUDIT CONCLUSION ###\n');
        console.log(`Has SMA IPA Tasks: ${hasIpqa ? 'YES' : 'NO'}`);
        console.log(`Has SMA IPS Tasks: ${hasIps ? 'YES' : 'NO'}\n`);
        
        if (hasIpqa && !hasIps) {
            console.log('✅ MAPPING PROVEN: Use SMA IPA');
            console.log('   All SMA 10/12 attempts use ClassTasks that reference SMA IPA QuestionBanks.\n');
            console.log('   Recommendation for mapping:\n   - SMA 10 → SMA IPA\n   - SMA 12 → SMA IPA');
        } else if (hasIps && !hasIpqa) {
            console.log('✅ MAPPING PROVEN: Use SMA IPS');
            console.log('   All SMA 10/12 attempts use ClassTasks that reference SMA IPS QuestionBanks.\n');
            console.log('   Recommendation for mapping:\n   - SMA 10 → SMA IPS\n   - SMA 12 → SMA IPS');
        } else if (hasIpqa && hasIps) {
            console.log('⚠️ MULTIPLE CANDIDATES');
            console.log('   Mixed usage of both SMA IPA and SMA IPS detected.');
            console.log('   Business rule required to determine priority or split based on subject.');
        } else {
            console.log('❌ NO MAPPING POSSIBLE');
            console.log('   No ClassTasks reference any QuestionBank programs.');
            console.log('   System may be using standalone CTQs without QB association.');
            console.log('\n   Possible actions:');
            console.log('   1. Add questionBankId field to existing ClassTasks');
            console.log('   2. Create separate ClassTask sets for IPA/IPS');
            console.log('   3. Store program directly in ClassTaskQuestions');
        }
        
    } finally {
        await client.close();
    }
})();
