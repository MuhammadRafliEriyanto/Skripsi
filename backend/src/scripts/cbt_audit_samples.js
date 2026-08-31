require("dotenv").config({ path: ".env" });
const { MongoClient } = require('mongodb');

async function findSamples() {
    const client = new MongoClient(process.env.MONGO_URI);
    
    try {
        await client.connect();
        const db = client.db('bimbel-lms');
        const collection = db.collection('studenttaskattempts');
        
        console.log('╔══════════════════════════════════════════════════════════════╗');
        console.log('║       SAMPLE ATTEMPTS FOR CBT FINAL AUDIT - 30 SOAL         ║');
        console.log('╚══════════════════════════════════════════════════════════════╝\n');
        
        // STEP 1: Get distribution first
        console.log('📊 STEP 1: Answer Count Distribution\n');
        
        const stats = await collection.aggregate([
            { $match: { answers: { $exists: true, $type: 'array' } } },
            { $addFields: { answerCount: { $size: '$answers' } } },
            { $group: { _id: '$answerCount', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]).toArray();
        
        let total = 0;
        stats.forEach(item => { total += item.count; });
        
        stats.forEach(item => {
            const percentage = ((item.count / total) * 100).toFixed(2);
            const marker = item._id === 10 || item._id === 30 ? ' ⬅️ TARGET' : '';
            console.log(`  ${item._id.toString().padStart(3)} answers: ${item.count.toString().padStart(6)} (${percentage}%)${marker}`);
        });
        
        console.log(`\nTotal Attempts in Database: ${total}\n`);
        
        // STEP 2: Sample A - Exactly 10 answers (using computed field)
        console.log('═'.repeat(70));
        console.log('SAMPLE A: EXACTLY 10 ANSWERS');
        console.log('═'.repeat(70) + '\n');
        
        const sampleA = await collection.aggregate([
            { 
                $match: { 
                    answers: { $exists: true, $type: 'array' },
                    answerCount: { $eq: 10 }
                }
            },
            { 
                $addFields: { 
                    answerCount: { $size: '$answers' }
                } 
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 }
        ]).next();
        
        if (sampleA && Object.keys(sampleA).length > 0) {
            console.log('✅ DITEMUKAN attempt dengan 10 answers!\n');
            
            console.log('📋 COMPLETE DATA:\n');
            console.log(`_id (attemptId):           ${sampleA._id.toString()}`);
            console.log(`attemptId field:           ${sampleA.attemptId || 'N/A'}`);
            console.log(`studentId:                 ${sampleA.studentId}`);
            console.log(`taskId:                    ${sampleA.taskId}`);
            console.log(`teacherId:                 ${samplea.teacherId?.toString() || sampleA.teacherId}`);
            console.log(`classId:                   ${sampleA.classId || 'N/A'}`);
            console.log(`branch:                    ${sampleA.branch || 'N/A'}`);
            console.log(`jawaban.length:            ${sampleA.answers.length} ✅`);
            console.log(`correctCount:              ${sampleA.correctCount}`);
            console.log(`wrongCount:                ${sampleA.wrongCount}`);
            console.log(`unansweredCount:           ${sampleA.unansweredCount}`);
            console.log(`score:                     ${sampleA.score}`);
            console.log(`timeUsedSeconds:           ${sampleA.timeUsedSeconds || 'N/A'}`);
            console.log(`remedialCount:             ${sampleA.remedialCount || 0}`);
            console.log(`status:                    ${sampleA.status || 'N/A'}`);
            console.log(`timestamp (local):         ${new Date(sampleA.createdAt).toLocaleString('id-ID')}`);
            console.log(`timestamp (ISO):           ${new Date(sampleA.createdAt).toISOString()}`);
            
            if (sampleA.updatedAt) {
                console.log(`updatedAt (local):         ${new Date(sampleA.updatedAt).toLocaleString('id-ID')}`);
            }
            
            if (sampleA.submittedAt) {
                console.log(`submittedAt (local):       ${new Date(sampleA.submittedAt).toLocaleString('id-ID')}`);
            }
            
            // Calculate expected values from answers array
            let calcCorrect = 0;
            let calcWrong = 0;
            let calcUnanswered = 0;
            
            sampleA.answers.forEach(ans => {
                if (ans.isCorrect === true) calcCorrect++;
                else if (ans.isCorrect === false) calcWrong++;
                else calcUnanswered++;
            });
            
            console.log('\n📊 CALCD FROM ARRAYS:\n');
            console.log(`   Calculated correct:      ${calcCorrect}`);
            console.log(`   Calculated wrong:        ${calcWrong}`);
            console.log(`   Calculated unanswered:   ${calcUnanswered}`);
            
            console.log('\n📝 FIRST 5 ANSWERS (detailed):\n');
            for (let i = 0; i < Math.min(5, sampleA.answers.length); i++) {
                const ans = sampleA.answers[i];
                console.log(`  [${i + 1}] questionId:     ${ans.questionId}`);
                console.log(`      selectedAnswer:     ${ans.selectedAnswer || '(empty)'}`);
                console.log(`      isCorrect:          ${ans.isCorrect !== null ? (ans.isCorrect ? '✅ Yes' : '❌ No') : '⚪ Unanswered'}`);
                console.log('');
            }
            
            console.log('   ... and ' + (sampleA.answers.length - 5) + ' more answers\n');
            
            console.log('✅ VERIFICATION CHECK:\n');
            console.log(`   Expected: 10 answers`);
            console.log(`   Actual:   ${sampleA.answers.length} answers`);
            console.log(`   Status:   ${sampleA.answers.length === 10 ? '✅ PERFECT MATCH' : '❌ MISMATCH'}`);
            
        } else {
            console.log('❌ TIDAK DITEMUKAN attempt dengan exactly 10 answers!\n');
            
            // List closest alternatives
            console.log('🔍 Mencari alternatif terdekat...\n');
            
            const nearby = await collection.aggregate([
                { $match: { answers: { $exists: true, $type: 'array' } } },
                { $addFields: { answerCount: { $size: '$answers' } } },
                { $match: { answerCount: { $gte: 8, $lte: 12 } } },
                { $sort: { createdAt: -1 } },
                { $limit: 3 }
            ]).toArray();
            
            if (nearby.length > 0) {
                console.log('Alternatif terdekat dengan 10 answers:\n');
                nearby.forEach((att, idx) => {
                    console.log(`${idx + 1}. Attempt dengan ${att.answerCount} jawaban`);
                    console.log(`   ID: ${att._id.toString().substring(0, 12)}...`);
                    console.log(`   studentId: ${att.studentId}`);
                    console.log(`   Score: ${att.score || 'N/A'}\n`);
                });
            }
        }
        
        // STEP 3: Sample B - Exactly 30 answers with pattern verification
        console.log('\n\n');
        console.log('═'.repeat(70));
        console.log('SAMPLE B: EXACTLY 30 ANSWERS (10 ClassTask + 20 QuestionBank)');
        console.log('═'.repeat(70) + '\n');
        
        const sampleB = await collection.aggregate([
            { 
                $match: { 
                    answers: { $exists: true, $type: 'array' },
                    answerCount: { $eq: 30 }
                }
            },
            { 
                $addFields: { 
                    answerCount: { $size: '$answers' }
                } 
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 }
        ]).next();
        
        if (sampleB && Object.keys(sampleB).length > 0) {
            console.log('✅ DITEMUKAN attempt dengan 30 answers!\n');
            
            console.log('📋 COMPLETE DATA:\n');
            console.log(`_id (attemptId):           ${sampleB._id.toString()}`);
            console.log(`attemptId field:           ${sampleB.attemptId || 'N/A'}`);
            console.log(`studentId:                 ${sampleB.studentId}`);
            console.log(`taskId:                    ${sampleB.taskId}`);
            console.log(`teacherId:                 ${sampleB.teacherId?.toString() || sampleB.teacherId}`);
            console.log(`classId:                   ${sampleB.classId || 'N/A'}`);
            console.log(`branch:                    ${sampleB.branch || 'N/A'}`);
            console.log(`jawaban.length:            ${sampleB.answers.length} ✅`);
            console.log(`correctCount:              ${sampleB.correctCount}`);
            console.log(`wrongCount:                ${sampleB.wrongCount}`);
            console.log(`unansweredCount:           ${sampleB.unansweredCount}`);
            console.log(`score:                     ${sampleB.score}`);
            console.log(`timeUsedSeconds:           ${sampleB.timeUsedSeconds || 'N/A'}`);
            console.log(`status:                    ${sampleB.status || 'N/A'}`);
            console.log(`timestamp (local):         ${new Date(sampleB.createdAt).toLocaleString('id-ID')}`);
            console.log(`timestamp (ISO):           ${new Date(sampleB.createdAt).toISOString()}`);
            
            if (sampleB.updatedAt) {
                console.log(`updatedAt (local):         ${new Date(sampleB.updatedAt).toLocaleString('id-ID')}`);
            }
            
            if (sampleB.submittedAt) {
                console.log(`submittedAt (local):       ${new Date(sampleB.submittedAt).toLocaleString('id-ID')}`);
            }
            
            console.log('\n📊 QUESTION SOURCE DISTRIBUTION:\n');
            
            // Since we don't have question documents embedded, we need to check
            // if questions are embedded in the answers array or referenced
            const hasSourceField = sampleB.answers.some(a => a.question?.sourceType);
            const hasSelectedAnswer = sampleB.answers.some(a => a.selectedAnswer);
            
            console.log(`   Has question.sourceType: ${hasSourceField ? 'Yes' : 'No (using selectedAnswer only)'}`);
            console.log(`   Has selectedAnswer:      ${hasSelectedAnswer ? 'Yes' : 'No'}`);
            
            // Try to get class task questions if available
            let classQuestionIds = [];
            let bankQuestionIds = [];
            
            // Check if question object is embedded
            if (hasSourceField) {
                sampleB.answers.forEach((ans, idx) => {
                    if (ans.question?.sourceType === 'ClassTask') {
                        classQuestionIds.push(idx + 1);
                    } else if (ans.question?.sourceType === 'QuestionBank') {
                        bankQuestionIds.push(idx + 1);
                    }
                });
                
                console.log(`\n📍 CLASS TASK QUESTIONS (indices):   ${classQuestionIds.join(', ')}`);
                console.log(`📍 QUESTION BANK QUESTIONS (indices): ${bankQuestionIds.join(', ')}`);
                
                const expectedPatternMatch = classQuestionIds.length === 10 && bankQuestionIds.length === 20;
                
                console.log('\n✅ PATTERN VERIFICATION:\n');
                console.log(`   Target Pattern: 10 ClassTask + 20 QuestionBank`);
                console.log(`   Actual Pattern: ${classQuestionIds.length} ClassTask + ${bankQuestionIds.length} QuestionBank`);
                
                if (expectedPatternMatch) {
                    console.log(`   Status:         🎉🎉🎉 PERFECT MATCH! 🎉🎉🎉`);
                } else {
                    console.log(`   Status:         ⚠️  Pattern does not match exactly`);
                }
            } else {
                console.log('\n⚠️  Cannot determine question source type (no question object in answers)');
                console.log('   Note: Questions may be stored separately and only referenced by questionId\n');
            }
            
            console.log('📋 FULL ANSWER SEQUENCE (all 30):\n');
            console.log('   Index | Question ID                | Correct? | Selected Answer');
            console.log('   ------|----------------------------|----------|-----------------');
            
            sampleB.answers.forEach((ans, idx) => {
                const qId = ans.questionId.toString().substring(0, 24).padEnd(24);
                const correctStatus = ans.isCorrect === true ? '✅ Yes' : 
                                    ans.isCorrect === false ? '❌ No' : 
                                    '⚪ No Answer';
                const selected = ans.selectedAnswer || '(none)';
                console.log(`   ${idx.toString().padStart(6)} | ${qId} | ${correctStatus.padEnd(9)} | ${selected}`);
            });
            
        } else {
            console.log('❌ TIDAK DITEMUKAN attempt dengan exactly 30 answers!\n');
            
            // Show closest alternatives
            console.log('🔍 Alternatif terdekat dengan 30 answers:\n');
            
            const nearby = await collection.aggregate([
                { $match: { answers: { $exists: true, $type: 'array' } } },
                { $addFields: { answerCount: { $size: '$answers' } } },
                { $match: { answerCount: { $gte: 25, $lte: 35 } } },
                { $sort: { createdAt: -1 } },
                { $limit: 3 }
            ]).toArray();
            
            if (nearby.length > 0) {
                nearby.forEach((att, idx) => {
                    console.log(`${idx + 1}. Attempt dengan ${att.answerCount} jawaban`);
                    console.log(`   ID: ${att._id.toString().substring(0, 12)}...`);
                    console.log(`   studentId: ${att.studentId}`);
                    console.log(`   Score: ${att.score || 'N/A'}\n`);
                });
            }
        }
        
        console.log('\n\n' + '═'.repeat(70));
        console.log('AUDIT SUMMARY COMPLETE');
        console.log('═'.repeat(70) + '\n');
        
    } catch (error) {
        console.error('❌ ERROR:', error.message);
        console.error(error.stack);
    } finally {
        await client.close();
    }
}

findSamples();
