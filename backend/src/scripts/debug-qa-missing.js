require("dotenv").config({ path: "backend/.env" });

const { MongoClient } = require('mongodb');

(async () => {
    const client = new MongoClient(process.env.MONGO_URI);
    
    try {
        await client.connect();
        
        const db = client.db('bimbel-lms');
        
        // Get SMA students
        const smaStudents = await db.collection('students')
            .find({ className: { $in: ['SMA 10', 'SMA 12'] } })
            .toArray();
        
        console.log(`Total SMA Students (SMA 10 + SMA 12): ${smaStudents.length}\n`);
        
        const smaStudentIds = smaStudents.map(s => s.studentId);
        
        // Get all 30-answer attempts
        const attempts = await db.collection('studenttaskattempts')
            .find({ 
                studentId: { $in: smaStudentIds },
                'answers.0': { $exists: true }
            })
            .sort({ 'answers.length': -1 })
            .toArray();
        
        // Filter exactly 30 answers
        const attempts30 = attempts.filter(a => Array.isArray(a.answers) && a.answers.length === 30);
        
        console.log(`Found ${attempts30.length} attempts with 30 answers\n`);
        
        // Sample first attempt
        const sampleAttempt = attempts30[0];
        
        console.log('=== SAMPLE ATTEMPT STRUCTURE ===\n');
        console.log(JSON.stringify(sampleAttempt, null, 2));
        
        // Check question IDs in answers
        const questionIds = sampleAttempt.answers?.map(a => ({
            id: a.questionId?.toString(),
            hasId: !!a.questionId,
            type: typeof a.questionId
        })) || [];
        
        console.log('\n=== FIRST 10 ANSWERS ===');
        questionIds.slice(0, 10).forEach((q, i) => {
            console.log(`${i+1}. questionId: ${q.id || 'NULL'} (${q.type})`);
        });
        
        // Count question ID types
        const hasIdCount = questionIds.filter(q => q.hasId).length;
        console.log(`\nQuestion ID Analysis:`);
        console.log(`- With ID: ${hasIdCount}/${questionIds.length}`);
        console.log(`- Without ID: ${questionIds.length - hasIdCount}`);
        
        // If no questionIds, check actual_question_count field instead
        if (hasIdCount === 0) {
            console.log('\nNO QUESTION IDS FOUND IN ANSWERS ARRAY!');
            console.log('Checking if questions are stored elsewhere...');
            
            // Look at raw structure
            const rawAnswers = JSON.parse(JSON.stringify(sampleAttempt.answers)).slice(0, 3);
            console.log('\nSample Answer Objects:');
            console.log(JSON.stringify(rawAnswers, null, 2));
        }
        
        // Check Task structure
        if (sampleAttempt.taskId) {
            const task = await db.collection('classtasks').findOne({ _id: sampleAttempt.taskId });
            
            if (task) {
                console.log('\n=== TASK STRUCTURE ===\n');
                console.log(JSON.stringify(task, null, 2));
                
                // Check Task's Questions
                if (task.questions && task.questions.length > 0) {
                    console.log(`\nTask has ${task.questions.length} questions`);
                    
                    // Check Question reference pattern
                    const sampleQuestion = task.questions[0];
                    console.log('\nSample Task Question:');
                    console.log(JSON.stringify(sampleQuestion, null, 2));
                    
                    // Try to find the referenced QuestionBank
                    if (sampleQuestion?.questionId) {
                        const qbRef = await db.collection('questionbanks').findOne({
                            _id: sampleQuestion.questionId
                        });
                        
                        if (qbRef) {
                            console.log('\n=== REFERENCED QUESTION BANK ===\n');
                            console.log(`Program: ${qbRef.program}`);
                            console.log(`Title: ${qbRef.title}`);
                            console.log(`Subject: ${qbRef.subject}`);
                        } else {
                            console.log('\nNo matching QuestionBank found for that questionId');
                        }
                    }
                }
            }
        }
        
        // Now let's analyze ALL attempts to see which have valid QB references
        console.log('\n\n=== DEEP ANALYSIS OF ALL 30-ANSWER ATTEMPTS ===\n');
        
        const analysis = {
            total: attempts30.length,
            withValidReferences: 0,
            withoutReferences: 0,
            programsFound: {},
            mixed: 0,
            samples: {
                good: [],
                bad: []
            }
        };
        
        const qbCollection = db.collection('questionbanks');
        
        for (const attempt of attempts30) {
            const questionIds = attempt.answers?.map(a => a.questionId).filter(Boolean) || [];
            
            if (questionIds.length === 0) {
                analysis.withoutReferences++;
                if (analysis.samples.bad.length < 5) {
                    analysis.samples.bad.push({
                        attemptId: attempt._id.toString(),
                        studentId: attempt.studentId,
                        className: smaStudents.find(s => s.studentId === attempt.studentId)?.className,
                        reason: 'NO_QUESTION_ID_IN_ANSWERS'
                    });
                }
                continue;
            }
            
            // Fetch QB documents
            const qbDocs = await qbCollection.find({ _id: { $in: questionIds } }).toArray();
            
            // Check what programs we found
            const programs = new Set();
            qbDocs.forEach(doc => {
                if (doc.program) {
                    programs.add(doc.program);
                }
            });
            
            if (programs.size === 0) {
                analysis.withoutReferences++;
                if (analysis.samples.bad.length < 5) {
                    analysis.samples.bad.push({
                        attemptId: attempt._id.toString(),
                        studentId: attempt.studentId,
                        className: smaStudents.find(s => s.studentId === attempt.studentId)?.className,
                        reason: 'QB_DOCUMENTS_FOUND_BUT_NO_PROGRAM_FIELD'
                    });
                }
                continue;
            }
            
            analysis.withValidReferences++;
            
            // Count program occurrences
            programs.forEach(prog => {
                analysis.programsFound[prog] = (analysis.programsFound[prog] || 0) + 1;
            });
            
            // Check if mixed
            if (programs.size > 1) {
                analysis.mixed++;
            }
            
            // Collect samples
            if (analysis.samples.good.length < 5) {
                analysis.samples.good.push({
                    attemptId: attempt._id.toString(),
                    studentId: attempt.studentId,
                    className: smaStudents.find(s => s.studentId === attempt.studentId)?.className,
                    meetingNumber: attempt.meetingNumber,
                    subject: attempt.subject,
                    programs: Array.from(programs),
                    qbDocsCount: qbDocs.length
                });
            }
        }
        
        // Output deep analysis results
        console.log('Summary:');
        console.log(`- Total 30-answer attempts: ${analysis.total}`);
        console.log(`- With Valid QB References: ${analysis.withValidReferences}`);
        console.log(`- Without References: ${analysis.withoutReferences}`);
        console.log(`- Mixed Programs: ${analysis.mixed}\n`);
        
        console.log('Programs Found:');
        Object.entries(analysis.programsFound).forEach(([prog, count]) => {
            console.log(`- ${prog}: ${count} attempts`);
        });
        
        console.log('\n--- Samples with Valid References ---');
        analysis.samples.good.forEach((s, i) => {
            console.log(`${i+1}. ${s.className} - Meeting ${s.meetingNumber} - Subjects: ${s.subject} - Programs: ${s.programs.join(', ')}`);
        });
        
        console.log('\n--- Samples WITHOUT Valid References ---');
        analysis.samples.bad.forEach((s, i) => {
            console.log(`${i+1}. ${s.className} (${s.reason})`);
        });
        
        // FINAL CONCLUSION
        console.log('\n\n### FINAL AUDIT CONCLUSION ###\n');
        
        if (analysis.withValidReferences === 0) {
            console.log('RESULT: NO VALID MAPPING POSSIBLE');
            console.log('Alasan: Tidak satu pun attempt memiliki referensi ke QuestionBank yang valid.');
            console.log('Kemungkinan:\n');
            console.log('1. System menggunakan TaskQuestions bukan QuestionBank');
            console.log('2. Answers array tidak menyimpan questionId dengan benar');
            console.log('3. Migrasi belum lengkap dan sistem masih hybrid');
            console.log('4. Field name berbeda (misal: questionRef, taskId dll)\n');
        } else {
            const ipaCount = analysis.programsFound['SMA IPA'] || 0;
            const ipsCount = analysis.programsFound['SMA IPS'] || 0;
            
            if (ipaCount > 0 && ipsCount === 0) {
                console.log('RESULT: MAPPING_PROVEN_SMA_IPA');
                console.log(`Bukti: ${ipaCount} attempts menggunakan QuestionBank SMA IPA`);
                console.log(`Rekomendasi: Map SMA 10/12 → SMA IPA`);
            } else if (ipsCount > 0 && ipaCount === 0) {
                console.log('RESULT: MAPPING_PROVEN_SMA_IPS');
                console.log(`Bukti: ${ipsCount} attempts menggunakan QuestionBank SMA IPS`);
                console.log(`Rekomendasi: Map SMA 10/12 → SMA IPS`);
            } else {
                console.log('RESULT: MULTIPLE_CANDIDATES_FOUND');
                console.log(`IPA: ${ipaCount} attempts, IPS: ${ipsCount} attempts`);
                console.log(`Perlu business rule tambahan untuk menentukan prioritas`);
            }
        }
        
    } finally {
        await client.close();
    }
})();
