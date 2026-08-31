require("dotenv").config({ path: "backend/.env" });

const { MongoClient } = require('mongodb');

(async () => {
    const client = new MongoClient(process.env.MONGO_URI);
    
    try {
        await client.connect();
        
        const db = client.db('bimbel-lms');
        
        console.log('=== SAMPLE CLASS TASK STRUCTURE ===\n');
        
        // Get sample task from SMA attempts
        const smaStudents = await db.collection('students')
            .find({ className: { $in: ['SMA 10', 'SMA 12'] } })
            .toArray();
        
        const smaStudentIds = smaStudents.map(s => s.studentId);
        
        const firstAttempt = await db.collection('studenttaskattempts')
            .findOne({ 
                studentId: { $in: smaStudentIds },
                'answers.0': { $exists: true }
            });
        
        if (!firstAttempt) {
            console.log('No attempts found!\n');
            return;
        }
        
        console.log('Sample Attempt:');
        console.log(`_id: ${firstAttempt._id}`);
        console.log(`attemptId: ${firstAttempt.attemptId}`);
        console.log(`studentId: ${firstAttempt.studentId}`);
        console.log(`taskId: ${firstAttempt.taskId}`);
        console.log(`meetingNumber: ${firstAttempt.meetingNumber}`);
        console.log(`subject: ${firstAttempt.subject}`);
        console.log(`actual_question_count: ${firstAttempt.actual_question_count || 'NULL'}`);
        console.log(`answers.length: ${firstAttempt.answers.length}\n`);
        
        // Get the task
        const task = await db.collection('classtasks').findOne({
            _id: firstAttempt.taskId
        });
        
        console.log('\nClassTask Document:');
        console.log(JSON.stringify(task, null, 2));
        
        // Check if it has questions embedded or references
        if (task?.questions && task.questions.length > 0) {
            console.log(`\n\nHas ${task.questions.length} CTQs embedded/linked:`);
            
            if (typeof task.questions[0] === 'string') {
                console.log('CTQ references as IDs:');
                console.log(task.questions.slice(0, 3).map(q => `- ${q}`).join('\n'));
                
                // Fetch one CTQ
                const ctqRef = task.questions[0];
                const ctq = await db.collection('classtaskquestions').findOne({
                    classtaskQuestionId: ctqRef
                });
                
                if (ctq) {
                    console.log('\nSample CTQ Document:');
                    console.log(JSON.stringify(ctq, null, 2));
                }
            } else {
                console.log('CTQ objects embedded directly:');
                console.log(JSON.stringify(task.questions[0], null, 2));
            }
        }
        
        // ALSO check all fields in the attempt document
        console.log('\n\n=== COMPLETE ATTEMPT SCHEMA ===\n');
        console.log(Object.keys(firstAttempt).map(k => `  - ${k}`).join('\n'));
        
        // Check what fields exist in attempts with 30 answers
        const attempts30 = await db.collection('studenttaskattempts')
            .find({ 
                studentId: { $in: smaStudentIds },
                'answers.0': { $exists: true }
            })
            .toArray()
            .filter(a => a.answers.length === 30);
        
        console.log(`\nTotal 30-answer attempts: ${attempts30.length}`);
        
        // Find unique actual_question_count values
        const qcValues = new Set();
        attempts30.forEach(a => {
            if (a.actual_question_count !== undefined) {
                qcValues.add(a.actual_question_count);
            }
        });
        
        console.log(`actual_question_count values: ${Array.from(qcValues).join(', ')}`);
        
        // Final conclusion about structure
        console.log('\n\n### STRUCTURE FINDINGS ###\n');
        
        if (!task.questionBankId) {
            console.log('❌ Task does NOT have questionBankId field');
            console.log('\nThe system appears to use standalone ClassTaskQuestions without QB association.');
            console.log('\nImplications for mapping logic:\n');
            console.log('1. Cannot determine program from tasks questionBankId');
            console.log('2. Must look elsewhere for program information');
            console.log('3. Options:');
            console.log('   - Add questionBankId to ClassTasks');
            console.log('   - Store program info in separate classification table');
            console.log('   - Use subject + grade level heuristic (eg SMA IPA for Math/Science)');
        }
        
        // Check for any other clues
        console.log('\nChecking for additional clues...');
        
        const studentsWithSubjects = [];
        
        for (const student of smaStudents.slice(0, 5)) {
            const studentAttempts = await db.collection('studenttaskattempts')
                .find({ studentId: student.studentId })
                .toArray();
            
            subjects = [...new Set(studentAttempts.filter(a => a.subject).map(a => a.subject))];
            
            studentsWithSubjects.push({
                studentId: student.studentId,
                className: student.className,
                subjects: subjects
            });
        }
        
        console.log('\nSample Students and their subjects:');
        studentsWithSubjects.forEach(s => {
            console.log(`${s.className} (${s.studentId}): ${s.subjects.join(', ')}`);
        });
        
    } finally {
        await client.close();
    }
})();
