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
        
        console.log(`Total SMA Students (SMA 10 + SMA 12): ${smaStudents.length}`);
        
        const smaClasses = [...new Set(smaStudents.map(s => s.className))];
        console.log(`\nClasses: ${smaClasses.join(', ')}`);
        
        // Use studentId field (not _id)
        const smaStudentIds = smaStudents.map(s => s.studentId);
        
        console.log(`\nChecking attempts for studentIds: ${smaStudentIds.slice(0, 5).join(', ')}...`);
        
        const totalAttempts = await db.collection('studenttaskattempts')
            .countDocuments({ studentId: { $in: smaStudentIds } });
        
        console.log(`Total Attempts: ${totalAttempts}`);
        
        if (totalAttempts === 0) {
            console.log('\nNo attempts found for SMA students. Checking all attempts structure...');
            
            const sampleAttempts = await db.collection('studenttaskattempts')
                .find({})
                .limit(10)
                .toArray();
            
            console.log('\nSample Attempt Structure:');
            console.log(JSON.stringify(sampleAttempts[0], null, 2));
            
            return;
        }
        
        // Get all attempts with answers length info
        const attempts = await db.collection('studenttaskattempts')
            .find({ studentId: { $in: smaStudentIds } })
            .toArray();
        
        console.log(`\nAttempting to analyze ${attempts.length} attempts...`);
        
        // Count by answers length
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
        
        // Filter 30-answer attempts
        const attempts30 = attempts.filter(a => Array.isArray(a.answers) && a.answers.length === 30);
        
        console.log(`\n\n=== FINAL AUDIT: ${attempts30.length} attempts with 30 answers ===\n`);
        
        if (attempts30.length === 0) {
            console.log('NO atempts dengan 30 soal ditemukan.');
            console.log('Database mungkin belum di-migrate ke 30 soal.');
            return;
        }
        
        // Process each attempt
        const taskCollection = db.collection('classtasks');
        const qbCollection = db.collection('questionbanks');
        
        const results = {
            sma10: { total: 0, smaIpa: 0, smaIps: 0, unknown: 0, uncertainAttempts: [], byTaskMeeting: {} },
            sma12: { total: 0, smaIpa: 0, smaIps: 0, unknown: 0, uncertainAttempts: [], byTaskMeeting: {} },
            evidence: { smaIpa: [], smaIps: [] }
        };
        
        const studentMap = {};
        smaStudents.forEach(s => {
            studentMap[s.studentId] = s.className;
        });
        
        // Batch process for efficiency
        for (const attempt of attempts30) {
            const studentClassName = studentMap[attempt.studentId];
            if (!studentClassName) continue;
            
            const category = studentClassName === 'SMA 10' ? 'sma10' : 'sma12';
            results[category].total++;
            
            // Determine QB program from answer question IDs
            const qbPrograms = new Set();
            const questionIds = attempt.answers?.map(a => a.questionId?.toString()).filter(Boolean) || [];
            
            if (questionIds.length > 0) {
                const qbQuestions = await qbCollection.find({ _id: { $in: questionIds } }).toArray();
                
                qbQuestions.forEach(qb => {
                    if (qb.program) {
                        qbPrograms.add(qb.program);
                    }
                });
            }
            
            const taskId = attempt.taskId?.toString();
            const meetingNumber = attempt.meetingNumber || 'Unknown';
            
            let determined = false;
            let dominantProgram = 'unknown';
            
            if (qbPrograms.has('SMA IPA') && !qbPrograms.has('SMA IPS')) {
                dominantProgram = 'SMA IPA';
                determined = true;
                results[category].smaIpa++;
                results.evidence.smaIpa.push({
                    attemptId: attempt._id?.toString(),
                    studentId: attempt.studentId,
                    className: studentClassName,
                    meetingNumber,
                    subject: attempt.subject,
                    qbPrograms: Array.from(qbPrograms)
                });
            } else if (qbPrograms.has('SMA IPS') && !qbPrograms.has('SMA IPA')) {
                dominantProgram = 'SMA IPS';
                determined = true;
                results[category].smaIps++;
                results.evidence.smaIps.push({
                    attemptId: attempt._id?.toString(),
                    studentId: attempt.studentId,
                    className: studentClassName,
                    meetingNumber,
                    subject: attempt.subject,
                    qbPrograms: Array.from(qbPrograms)
                });
            } else {
                results[category].unknown++;
                results[category].uncertainAttempts.push({
                    attemptId: attempt._id?.toString(),
                    studentId: attempt.studentId,
                    className: studentClassName,
                    meetingNumber,
                    reason: qbPrograms.size === 0 ? 'NO_QB_REFERENCE' : 'MIXED_PROGRAMS'
                });
            }
            
            // Group by Task + Meeting
            const taskKey = `${taskId}-Meeting${meetingNumber}`;
            if (!results[category].byTaskMeeting[taskKey]) {
                results[category].byTaskMeeting[taskKey] = {
                    smaIpa: 0,
                    smaIps: 0,
                    unknown: 0
                };
            }
            
            if (determined) {
                results[category].byTaskMeeting[taskKey][dominantProgram === 'SMA IPA' ? 'smaIpa' : 'smaIps']++;
            } else {
                results[category].byTaskMeeting[taskKey].unknown++;
            }
        }
        
        // Output summary
        console.log('\n========================================');
        console.log('RESULTS SUMMARY');
        console.log('========================================\n');
        
        console.log('=== SMA 10 Statistics ===');
        console.log(`Total Attempts: ${results.sma10.total}`);
        console.log(`Using SMA IPA: ${results.sma10.smaIpa}`);
        console.log(`Using SMA IPS: ${results.sma10.smaIps}`);
        console.log(`Uncertain: ${results.sma10.unknown}`);
        console.log('\n');
        
        console.log('=== SMA 12 Statistics ===');
        console.log(`Total Attempts: ${results.sma12.total}`);
        console.log(`Using SMA IPA: ${results.sma12.smaIpa}`);
        console.log(`Using SMA IPS: ${results.sma12.smaIps}`);
        console.log(`Uncertain: ${results.sma12.unknown}`);
        console.log('\n');
        
        const hasSmaIpaEvidence = results.evidence.smaIpa.length > 0;
        const hasSmaIpsEvidence = results.evidence.smaIps.length > 0;
        
        console.log('=== Evidence Summary ===');
        console.log(`Has SMA IPA: ${hasSmaIpaEvidence ? 'YES (' + results.evidence.smaIpa.length + ')' : 'NO'}`);
        console.log(`Has SMA IPS: ${hasSmaIpsEvidence ? 'YES (' + results.evidence.smaIps.length + ')' : 'NO'}\n`);
        
        // Generate conclusion
        console.log('### Final Conclusion ###\n');
        
        if (!hasSmaIpaEvidence && hasSmaIpsEvidence) {
            console.log('NO_EVIDENCE_SMA_IPA');
            console.log('\nSemua traceable attempts menggunakan SMA IPS.');
            console.log('Rekomendasi mapping:\n- SMA 10 → SMA IPS\n- SMA 12 → SMA IPS');
        } else if (hasSmaIpaEvidence && hasSmaIpsEvidence) {
            console.log('MULTIPLE_CANDIDATES');
            console.log('\nTerdapat campuran penggunaan IPA dan IPS.');
            console.log('Perlu business rule klarifikasi lebih lanjut.');
        } else {
            console.log('MAPPING_NOT_PROVEN');
            console.log('\nTidak cukup bukti untuk menentukan mapping.');
        }
        
    } finally {
        await client.close();
    }
})();
