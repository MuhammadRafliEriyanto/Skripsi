require("dotenv").config({ path: "backend/.env" });

const { MongoClient, ObjectId } = require('mongodb');

(async () => {
    const client = new MongoClient(process.env.MONGO_URI);
    
    try {
        await client.connect();
        
        const db = client.db('bimbel-lms');
        
        console.log('╔══════════════════════════════════════════════════════════╗');
        console.log('║     DATABASE AUDIT: ATTEMPT DISTRIBUTION ANALYSIS       ║');
        console.log('╚══════════════════════════════════════════════════════════╝\n');
        
        // ========== SECTION 1: COLLECTION OVERVIEW ==========
        console.log('📊 SECTION 1: Collection Overview\n');
        
        const collections = await db.listCollections().toArray();
        const cbtRelatedCollections = [
            'students',
            'classtasks', 
            'classtaskquestions',
            'questionbanks',
            'studenttaskattempts'
        ];
        
        const relevantCollections = collections.filter(c => 
            c.name && cbtRelatedCollections.includes(c.name)
        );
        
        for (const coll of relevantCollections) {
            const count = await db.collection(coll.name).countDocuments();
            console.log(`  ${coll.name}: ${count} documents`);
        }
        
        // ========== SECTION 2: STUDENT CLASS NAME DISTRIBUTION ==========
        console.log('\n📋 SECTION 2: Student Class Distribution\n');
        
        const students = await db.collection('students').find({}).toArray();
        
        const classDistribution = {};
        students.forEach(s => {
            const className = s.className || 'NoClass';
            classDistribution[className] = (classDistribution[className] || 0) + 1;
        });
        
        Object.entries(classDistribution)
            .sort(([a], [b]) => b.length - a.length)
            .forEach(([className, count]) => {
                console.log(`  ${className.padEnd(15)}: ${count} students`);
            });
        
        // ========== SECTION 3: TASK STRUCTURE ANALYSIS ==========
        console.log('\n📐 SECTION 3: Task Structure Analysis\n');
        
        const tasks = await db.collection('classtasks').find({}).limit(50).toArray();
        
        console.log(`Sample Tasks (${tasks.length}):`);
        
        const taskStats = {
            withQBRef: 0,
            noQBRef: 0,
            questionCounts: {},
            subjects: new Set()
        };
        
        tasks.forEach(t => {
            if (t.questionBankId) {
                taskStats.withQBRef++;
            } else {
                taskStats.noQBRef++;
            }
            
            // Count questions in array
            const qCount = Array.isArray(t.questions) ? t.questions.length : 0;
            taskStats.questionCounts[qCount] = (taskStats.questionCounts[qCount] || 0) + 1;
            
            if (t.subject) {
                taskStats.subjects.add(t.subject);
            }
        });
        
        console.log('\n  Question Bank Reference:');
        console.log(`    With QB ref: ${taskStats.withQBRef}`);
        console.log(`    Without QB ref: ${taskStats.noQBRef}`);
        
        console.log('\n  Embedded Question Counts:');
        Object.entries(taskStats.questionCounts)
            .sort(([a], [b]) => Number(a) - Number(b))
            .forEach(([count, freq]) => {
                console.log(`    ${count} questions: ${freq} tasks`);
            });
        
        console.log(`\n  Subjects covered: ${Array.from(taskStats.subjects).join(', ')}`);
        
        // ========== SECTION 4: QUESTION BANK PROGRAM DISTRIBUTION ==========
        console.log('\n🏫 SECTION 4: QuestionBank Program Distribution\n');
        
        const qbs = await db.collection('questionbanks').find({}).limit(100).toArray();
        
        const programDist = {};
        qbs.forEach(qb => {
            const prog = qb.program || 'NoProgram';
            const subject = qb.subject || 'NoSubject';
            const key = `${prog} | ${subject}`;
            programDist[key] = (programDist[key] || 0) + 1;
        });
        
        console.log('  Sample Programs (first 20):');
        Object.entries(programDist)
            .slice(0, 20)
            .forEach(([key, count]) => {
                console.log(`    ${key}: ${count} soal`);
            });
        
        // Total count by major programs
        const totalByProgram = {};
        qbs.forEach(qb => {
            if (qb.program) {
                totalByProgram[qb.program] = (totalByProgram[qb.program] || 0) + 1;
            }
        });
        
        console.log('\n  Global Distribution (all QBs):');
        Object.entries(totalByProgram)
            .sort(([a], [b]) => b - a)
            .slice(0, 10)
            .forEach(([prog, count]) => {
                console.log(`    ${prog}: ${count} soal`);
            });
        
        // ========== SECTION 5: STUDENTTASKATTEMPTS DISTRIBUTION ==========
        console.log('\n⚡ SECTION 5: Attempt Answer Distribution\n');
        
        const allAttempts = await db.collection('studenttaskattempts').find({}).toArray();
        
        console.log(`Total Attempts: ${allAttempts.length}\n`);
        
        // Group by answer count
        const answerLengths = {};
        allAttempts.forEach(attempt => {
            const len = Array.isArray(attempt.answers) ? attempt.answers.length : 0;
            answerLengths[len] = (answerLengths[len] || 0) + 1;
        });
        
        console.log('  By Answer Length:');
        Object.entries(answerLengths)
            .sort(([a], [b]) => Number(a) - Number(b))
            .forEach(([len, count]) => {
                console.log(`    ${len.toString().padStart(4)} answers: ${count.toString().padStart(8)} attempts`);
            });
        
        // Breakdown for key counts
        console.log('\n  Key Thresholds:');
        console.log(`    10 questions: ${answerLengths[10] || 0} attempts`);
        console.log(`    20 questions: ${answerLengths[20] || 0} attempts`);
        console.log(`    30 questions: ${answerLengths[30] || 0} attempts`);
        console.log(`    Other (<10 or >30): ${(allAttempts.length - (answerLengths[10]||0) - (answerLengths[20]||0) - (answerLengths[30]||0))} attempts`);
        
        // ========== SECTION 6: SAMPLE ATTEMPT STRUCTURES ==========
        console.log('\n📝 SECTION 6: Sample Attempt Structures\n');
        
        // Get one sample from each major category
        const samples = {
            '10 answers': null,
            '20 answers': null,
            '30 answers': null
        };
        
        let found = { '10 answers': false, '20 answers': false, '30 answers': false };
        
        for (const attempt of allAttempts) {
            const len = Array.isArray(attempt.answers) ? attempt.answers.length : 0;
            
            if (len === 10 && !found['10 answers']) {
                samples['10 answers'] = attempt;
                found['10 answers'] = true;
            } else if (len === 20 && !found['20 answers']) {
                samples['20 answers'] = attempt;
                found['20 answers'] = true;
            } else if (len === 30 && !found['30 answers']) {
                samples['30 answers'] = attempt;
                found['30 answers'] = true;
            }
            
            if (Object.values(found).every(v => v)) break;
        }
        
        // Display samples
        for (const [key, sample] of Object.entries(samples)) {
            if (sample) {
                console.log(`  ${key}:`);
                
                const taskId = sample.taskId?.toString().substring(0, 20);
                const studentId = sample.studentId;
                const correctCount = sample.correctCount || 0;
                const wrongCount = sample.wrongCount || 0;
                const score = sample.score || 0;
                
                console.log(`    taskId: ${taskId}`);
                console.log(`    studentId: ${studentId}`);
                console.log(`    correctCount: ${correctCount}`);
                console.log(`    wrongCount: ${wrongCount}`);
                console.log(`    unansweredCount: ${sample.unansweredCount || 0}`);
                console.log(`    score: ${score}`);
                
                // Check first answer structure
                if (sample.answers && sample.answers.length > 0) {
                    const firstAnswer = sample.answers[0];
                    console.log(`    First answer.questionId type: ${typeof firstAnswer.questionId}`);
                    
                    // Try to find related CTQ
                    if (firstAnswer.questionId && typeof firstAnswer.questionId === 'string') {
                        console.log(`    First answer.questionId: ${firstAnswer.questionId.substring(0, 30)}...`);
                    }
                }
                
                console.log('');
            } else {
                console.log(`  ${key}: NOT FOUND`);
            }
        }
        
        // ========== SECTION 7: SCORE CALCULATION PATTERNS ==========
        console.log('\n🧮 SECTION 7: Score Calculation Analysis\n');
        
        const scoreAnalysis = {
            patterns: {}
        };
        
        for (const attempt of allAttempts.slice(0, 1000)) {
            const len = Array.isArray(attempt.answers) ? attempt.answers.length : 0;
            const correct = attempt.correctCount || 0;
            const wrong = attempt.wrongCount || 0;
            const unanswered = attempt.unansweredCount || 0;
            const score = attempt.score || 0;
            
            // Verify consistency
            const calculatedTotal = correct + wrong + unanswered;
            const scoreFromCorrect = len > 0 ? ((correct / len) * 100).toFixed(2) : 0;
            
            const patternKey = `${len}-soal-${calculatedTotal===len?'consistent':'inconsistent'}-score${Math.round(score)}`;
            scoreAnalysis.patterns[patternKey] = (scoreAnalysis.patterns[patternKey] || 0) + 1;
        }
        
        console.log('  Sample Patterns (first 15):');
        Object.entries(scoreAnalysis.patterns)
            .slice(0, 15)
            .forEach(([pattern, count]) => {
                console.log(`    ${pattern}: ${count} attempts`);
            });
        
        // ========== SECTION 8: CONCLUSION SUMMARY ==========
        console.log('\n╔══════════════════════════════════════════════════════════╗');
        console.log('║                  AUDIT SUMMARY                          ║');
        console.log('╚══════════════════════════════════════════════════════════╝\n');
        
        console.log('CURRENT STATE:');
        console.log(`  • Total Students: ${students.length}`);
        console.log(`  • Total Tasks: ${tasks.length}`);
        console.log(`  • Total Attempts: ${allAttempts.length}`);
        console.log(`\n  • 10-soal Attempts: ${answerLengths[10] || 0}`);
        console.log(`  • 20-soal Attempts: ${answerLengths[20] || 0}`);
        console.log(`  • 30-soal Attempts: ${answerLengths[30] || 0}`);
        console.log(`\n  • Tasks with QB Ref: ${taskStats.withQBRef}`);
        console.log(`  • Tasks without QB Ref: ${taskStats.noQBRef}`);
        
        console.log('\nNEXT STEPS:');
        console.log('  1. Map frontend components to these backend structures');
        console.log('  2. Identify hardcoded values in frontend code');
        console.log('  3. Create complete data flow documentation');
        console.log('  4. Generate master audit report\n');
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.close();
    }
})();
