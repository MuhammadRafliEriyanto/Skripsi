require("dotenv").config({ path: ".env" });
const { MongoClient, ObjectId } = require('mongodb');

async function getDetailedSamples() {
    const client = new MongoClient(process.env.MONGO_URI);
    
    try {
        await client.connect();
        const db = client.db('bimbel-lms');
        const collection = db.collection('studenttaskattempts');
        
        console.log('╔══════════════════════════════════════════════════════════════╗');
        console.log('║       DETAILED SAMPLE ATTEMPTS - CBT FINAL AUDIT            ║');
        console.log('╚══════════════════════════════════════════════════════════════╝\n');
        
        // SAMPLE A: Attempt dengan 10 answers (from alternative list)
        console.log('═'.repeat(70));
        console.log('SAMPLE A: EXACTLY 10 ANSWERS');
        console.log('═'.repeat(70));
        
        // Use ObjectId from the alternative found earlier
        const sampleAId = new ObjectId('6a78a9948e69');
        
        const sampleA = await collection.findOne({ _id: sampleAId });
        
        if (sampleA) {
            console.log('\n✅ DITEMUKAN!\n');
            
            console.log('📋 COMPLETE DATA:\n');
            console.log(`_id (attemptId):           ${sampleA._id.toString()}`);
            console.log(`attemptId field:           ${sampleA.attemptId || 'N/A'}`);
            console.log(`studentId:                 ${sampleA.studentId}`);
            console.log(`taskId:                    ${sampleA.taskId}`);
            console.log(`teacherId:                 ${sampleA.teacherId?.toString() || sampleA.teacherId}`);
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
            
            // Verify counts match
            let calcCorrect = 0;
            let calcWrong = 0;
            let calcUnanswered = 0;
            
            sampleA.answers.forEach(ans => {
                if (ans.isCorrect === true) calcCorrect++;
                else if (ans.isCorrect === false) calcWrong++;
                else calcUnanswered++;
            });
            
            console.log('\n📊 VERIFICATION AGAINST STORED VALUES:\n');
            console.log(`   Stored correctCount:     ${sampleA.correctCount}`);
            console.log(`   Calculated:              ${calcCorrect} (${sampleA.correctCount === calcCorrect ? '✅ MATCH' : '❌ MISMATCH'})`);
            
            console.log(`   Stored wrongCount:       ${sampleA.wrongCount}`);
            console.log(`   Calculated:              ${calcWrong} (${sampleA.wrongCount === calcWrong ? '✅ MATCH' : '❌ MISMATCH'})`);
            
            console.log(`   Stored unansweredCount:  ${sampleA.unansweredCount}`);
            console.log(`   Calculated:              ${calcUnanswered} (${sampleA.unansweredCount === calcUnanswered ? '✅ MATCH' : '❌ MISMATCH'})`);
            
            console.log('\n📝 ALL 10 ANSWERS (detailed):\n');
            for (let i = 0; i < sampleA.answers.length; i++) {
                const ans = sampleA.answers[i];
                console.log(`[${i + 1}] questionId: ${ans.questionId}`);
                console.log(`    selectedAnswer: ${ans.selectedAnswer || '(empty)'}`);
                console.log(`    isCorrect:      ${ans.isCorrect !== null ? (ans.isCorrect ? '✅ Yes' : '❌ No') : '⚪ Unanswered'}`);
                
                // Show embedded question info if available
                if (ans.question) {
                    console.log(`    question.sourceType: ${ans.question.sourceType}`);
                }
                console.log('');
            }
            
            console.log('✅ VERIFICATION CHECK:\n');
            console.log(`   Expected: exactly 10 answers`);
            console.log(`   Actual:   ${sampleA.answers.length} answers`);
            console.log(`   Status:   ${sampleA.answers.length === 10 ? '✅ PERFECT MATCH' : '❌ MISMATCH'}`);
            
        } else {
            console.log(`❌ ERROR: Cannot find attempt with ID ${sampleAId}\n`);
        }
        
        // SAMPLE B: Attempt dengan 30 answers
        console.log('\n\n');
        console.log('═'.repeat(70));
        console.log('SAMPLE B: EXACTLY 30 ANSWERS (10 ClassTask + 20 QuestionBank)');
        console.log('═'.repeat(70));
        
        const sampleBId = new ObjectId('6a7838fd7bef');
        
        const sampleB = await collection.findOne({ _id: sampleBId });
        
        if (sampleB) {
            console.log('\n✅ DITEMUKAN!\n');
            
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
            
            // Verify counts
            let calcCorrect = 0;
            let calcWrong = 0;
            let calcUnanswered = 0;
            
            sampleB.answers.forEach(ans => {
                if (ans.isCorrect === true) calcCorrect++;
                else if (ans.isCorrect === false) calcWrong++;
                else calcUnanswered++;
            });
            
            console.log('\n📊 VERIFICATION AGAINST STORED VALUES:\n');
            console.log(`   Stored correctCount:     ${sampleB.correctCount}`);
            console.log(`   Calculated:              ${calcCorrect} (${sampleB.correctCount === calcCorrect ? '✅ MATCH' : '❌ MISMATCH'})`);
            
            console.log(`   Stored wrongCount:       ${sampleB.wrongCount}`);
            console.log(`   Calculated:              ${calcWrong} (${sampleB.wrongCount === calcWrong ? '✅ MATCH' : '❌ MISMATCH'})`);
            
            console.log(`   Stored unansweredCount:  ${sampleB.unansweredCount}`);
            console.log(`   Calculated:              ${calcUnanswered} (${sampleB.unansweredCount === calcUnanswered ? '✅ MATCH' : '❌ MISMATCH'})`);
            
            console.log('\n📊 QUESTION SOURCE ANALYSIS:\n');
            
            // Check if questions are embedded in answer objects
            const hasSourceField = sampleB.answers.some(a => a.question && a.question.sourceType);
            
            if (hasSourceField) {
                let classQuestionIndices = [];
                let bankQuestionIndices = [];
                
                sampleB.answers.forEach((ans, idx) => {
                    if (ans.question?.sourceType === 'ClassTask') {
                        classQuestionIndices.push(idx + 1);
                    } else if (ans.question?.sourceType === 'QuestionBank') {
                        bankQuestionIndices.push(idx + 1);
                    }
                });
                
                console.log(`   📍 CLASS TASK QUESTIONS (${classQuestionIndices.length}):`);
                console.log(`      Indices: ${classQuestionIndices.join(', ')}`);
                
                console.log(`\n   📍 QUESTION BANK QUESTIONS (${bankQuestionIndices.length}):`);
                console.log(`      Indices: ${bankQuestionIndices.join(', ')}`);
                
                console.log('\n✅ PATTERN VERIFICATION:\n');
                console.log(`   Target Pattern: 10 ClassTask + 20 QuestionBank`);
                console.log(`   Actual Pattern: ${classQuestionIndices.length} ClassTask + ${bankQuestionIndices.length} QuestionBank`);
                
                if (classQuestionIndices.length === 10 && bankQuestionIndices.length === 20) {
                    console.log(`   Status:         🎉🎉🉉 PERFECT MATCH! 🎉🎉🎉`);
                } else {
                    console.log(`   Status:         ⚠️  Not exact pattern`);
                }
                
                // Show first few of each type
                if (classQuestionIndices.length > 0) {
                    console.log(`\n   First 3 ClassTask questions:`);
                    classQuestionIndices.slice(0, 3).forEach(idx => {
                        const ans = sampleB.answers[idx - 1];
                        console.log(`     [${idx}] qId=${ans.questionId}, isCorrect=${ans.isCorrect}`);
                    });
                }
                
                if (bankQuestionIndices.length > 0) {
                    console.log(`\n   First 3 QuestionBank questions:`);
                    bankQuestionIndices.slice(0, 3).forEach(idx => {
                        const ans = sampleB.answers[idx - 1];
                        console.log(`     [${idx}] qId=${ans.questionId}, isCorrect=${ans.isCorrect}`);
                    });
                }
                
            } else {
                console.log(`   ⚠️  Questions NOT embedded in answers array`);
                console.log(`   Note: Only questionId, selectedAnswer, and isCorrect are stored.`);
                console.log(`   Source type would need to be determined by querying question collections.\n`);
            }
            
            console.log('📋 FULL ANSWER SEQUENCE (all 30):\n');
            console.log('   Index | Question ID                      | Correct? | Selected Answer');
            console.log('   ------|----------------------------------|----------|-----------------');
            
            sampleB.answers.forEach((ans, idx) => {
                const qId = ans.questionId.toString().substring(0, 26).padEnd(26);
                const correctStatus = ans.isCorrect === true ? '✅ Yes' : 
                                    ans.isCorrect === false ? '❌ No' : 
                                    '⚪ No Answer';
                const selected = ans.selectedAnswer || '(none)';
                console.log(`   ${idx.toString().padStart(6)} | ${qId} | ${correctStatus.padEnd(9)} | ${selected}`);
            });
            
        } else {
            console.log(`❌ ERROR: Cannot find attempt with ID ${sampleBId}\n`);
        }
        
        console.log('\n\n' + '═'.repeat(70));
        console.log('DETAILED AUDIT COMPLETE');
        console.log('═'.repeat(70) + '\n');
        
    } catch (error) {
        console.error('❌ ERROR:', error.message);
        console.error(error.stack);
    } finally {
        await client.close();
    }
}

getDetailedSamples();
