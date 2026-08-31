require("dotenv").config({ path: ".env" });
const { MongoClient } = require('mongodb');

async function getDetailedSamples() {
    const client = new MongoClient(process.env.MONGO_URI);
    
    try {
        await client.connect();
        const db = client.db('bimbel-lms');
        const collection = db.collection('studenttaskattempts');
        
        console.log('╔══════════════════════════════════════════════════════════════╗');
        console.log('║       DETAILED SAMPLE ATTEMPTS - CBT FINAL AUDIT            ║');
        console.log('╚══════════════════════════════════════════════════════════════╝\n');
        
        // Use aggregation to find and get details in one step
        console.log('🔍 Finding Sample A (exactly 10 answers)...');
        
        const sampleA = await collection.aggregate([
            { 
                $match: { 
                    answers: { $exists: true, $type: 'array' }
                } 
            },
            { 
                $addFields: { 
                    answerCount: { $size: '$answers' }
                } 
            },
            { $match: { answerCount: 10 } },
            { $sort: { createdAt: -1 } },
            { $limit: 1 }
        ]).next();
        
        if (sampleA && Object.keys(sampleA).length > 0) {
            console.log('✅ Found!\n');
            
            console.log('═'.repeat(70));
            console.log('SAMPLE A: EXACTLY 10 ANSWERS');
            console.log('═'.repeat(70));
            console.log('\n📋 COMPLETE DATA:\n');
            
            console.log(`_id (attemptId):           ${sampleA._id.toString()}`);
            console.log(`studentId:                 ${sampleA.studentId}`);
            console.log(`taskId:                    ${sampleA.taskId}`);
            console.log(`teacherId:                 ${sampleA.teacherId?.toString() || 'N/A'}`);
            console.log(`classId:                   ${sampleA.classId || 'N/A'}`);
            console.log(`branch:                    ${sampleA.branch || 'N/A'}`);
            console.log(`jawaban.length:            ${sampleA.answers.length} ✅`);
            console.log(`correctCount:              ${sampleA.correctCount}`);
            console.log(`wrongCount:                ${sampleA.wrongCount}`);
            console.log(`unansweredCount:           ${sampleA.unansweredCount}`);
            console.log(`score:                     ${sampleA.score}`);
            console.log(`timeUsedSeconds:           ${sampleA.timeUsedSeconds || 'N/A'}`);
            console.log(`status:                    ${sampleA.status || 'N/A'}`);
            console.log(`timestamp (local):         ${new Date(sampleA.createdAt).toLocaleString('id-ID')}`);
            console.log(`timestamp (ISO):           ${new Date(sampleA.createdAt).toISOString()}`);
            
            if (sampleA.updatedAt) {
                console.log(`updatedAt (local):         ${new Date(sampleA.updatedAt).toLocaleString('id-ID')}`);
            }
            
            // Calculate from answers array
            let calcCorrect = 0;
            let calcWrong = 0;
            let calcUnanswered = 0;
            
            sampleA.answers.forEach(ans => {
                if (ans.isCorrect === true) calcCorrect++;
                else if (ans.isCorrect === false) calcWrong++;
                else calcUnanswered++;
            });
            
            console.log('\n📊 STORED VALUES vs CALCULATED:\n');
            console.log(`   correctCount:     Stored=${sampleA.correctCount}, Calculated=${calcCorrect} ${sampleA.correctCount === calcCorrect ? '✅' : '❌'}`);
            console.log(`   wrongCount:       Stored=${sampleA.wrongCount}, Calculated=${calcWrong} ${sampleA.wrongCount === calcWrong ? '✅' : '❌'}`);
            console.log(`   unansweredCount:  Stored=${sampleA.unansweredCount}, Calculated=${calcUnanswered} ${sampleA.unansweredCount === calcUnanswered ? '✅' : '❌'}`);
            
            console.log('\n📝 ALL 10 ANSWERS (detailed):\n');
            for (let i = 0; i < sampleA.answers.length; i++) {
                const ans = sampleA.answers[i];
                console.log(`[${i + 1}] questionId: ${ans.questionId}`);
                console.log(`    selectedAnswer: ${ans.selectedAnswer || '(empty)'}`);
                console.log(`    isCorrect:      ${ans.isCorrect !== null ? (ans.isCorrect ? '✅ Yes' : '❌ No') : '⚪ Unanswered'}`);
                if (ans.question?.sourceType) {
                    console.log(`    sourceType:     ${ans.question.sourceType}`);
                }
                console.log('');
            }
            
            console.log('✅ VERIFICATION:');
            console.log(`   Expected: 10 answers`);
            console.log(`   Actual:   ${sampleA.answers.length} answers`);
            console.log(`   Status:   ${sampleA.answers.length === 10 ? '✅ PERFECT MATCH' : '❌ MISMATCH'}\n`);
        } else {
            console.log('❌ Not found\n');
        }
        
        // SAMPLE B
        console.log('\n');
        console.log('🔍 Finding Sample B (exactly 30 answers)...');
        
        const sampleB = await collection.aggregate([
            { 
                $match: { 
                    answers: { $exists: true, $type: 'array' }
                } 
            },
            { 
                $addFields: { 
                    answerCount: { $size: '$answers' }
                } 
            },
            { $match: { answerCount: 30 } },
            { $sort: { createdAt: -1 } },
            { $limit: 1 }
        ]).next();
        
        if (sampleB && Object.keys(sampleB).length > 0) {
            console.log('✅ Found!\n');
            
            console.log('═'.repeat(70));
            console.log('SAMPLE B: EXACTLY 30 ANSWERS');
            console.log('═'.repeat(70));
            console.log('\n📋 COMPLETE DATA:\n');
            
            console.log(`_id (attemptId):           ${sampleB._id.toString()}`);
            console.log(`studentId:                 ${sampleB.studentId}`);
            console.log(`taskId:                    ${sampleB.taskId}`);
            console.log(`teacherId:                 ${sampleB.teacherId?.toString() || 'N/A'}`);
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
            
            // Calculate from answers array
            let calcCorrect = 0;
            let calcWrong = 0;
            let calcUnanswered = 0;
            
            sampleB.answers.forEach(ans => {
                if (ans.isCorrect === true) calcCorrect++;
                else if (ans.isCorrect === false) calcWrong++;
                else calcUnanswered++;
            });
            
            console.log('\n📊 STORED VALUES vs CALCULATED:\n');
            console.log(`   correctCount:     Stored=${sampleB.correctCount}, Calculated=${calcCorrect} ${sampleB.correctCount === calcCorrect ? '✅' : '❌'}`);
            console.log(`   wrongCount:       Stored=${sampleB.wrongCount}, Calculated=${calcWrong} ${sampleB.wrongCount === calcWrong ? '✅' : '❌'}`);
            console.log(`   unansweredCount:  Stored=${sampleB.unansweredCount}, Calculated=${calcUnanswered} ${sampleB.unansweredCount === calcUnanswered ? '✅' : '❌'}`);
            
            console.log('\n📊 QUESTION SOURCE ANALYSIS:\n');
            
            const hasSourceField = sampleB.answers.some(a => a.question && a.question.sourceType);
            
            if (hasSourceField) {
                let classIndices = [];
                let bankIndices = [];
                
                sampleB.answers.forEach((ans, idx) => {
                    if (ans.question?.sourceType === 'ClassTask') {
                        classIndices.push(idx + 1);
                    } else if (ans.question?.sourceType === 'QuestionBank') {
                        bankIndices.push(idx + 1);
                    }
                });
                
                console.log(`   📍 ClassTask Questions (${classIndices.length}): indices ${classIndices.slice(0, 15).join(', ')}${classIndices.length > 15 ? `... (+${classIndices.length - 15} more)` : ''}`);
                console.log(`   📍 QuestionBank Questions (${bankIndices.length}): indices ${bankIndices.slice(0, 15).join(', ')}${bankIndices.length > 15 ? `... (+${bankIndices.length - 15} more)` : ''}`);
                
                console.log('\n✅ PATTERN CHECK:');
                console.log(`   Target: 10 ClassTask + 20 QuestionBank`);
                console.log(`   Actual: ${classIndices.length} ClassTask + ${bankIndices.length} QuestionBank`);
                console.log(`   Status: ${classIndices.length === 10 && bankIndices.length === 20 ? '🎉 PERFECT MATCH!' : '⚠️ Pattern mismatch'}`);
                
            } else {
                console.log(`   ⚠️  No sourceType in embedded question objects`);
                console.log(`   Only questionId, selectedAnswer, and isCorrect are available\n`);
            }
            
            console.log('\n📋 FULL SEQUENCE (all 30):\n');
            console.log('   # | QID                            | Correct? | Selected | Source Type');
            console.log('   --|--------------------------------|----------|----------|------------');
            
            sampleB.answers.forEach((ans, idx) => {
                const qId = ans.questionId.toString().substring(0, 28).padEnd(28);
                const correctStatus = ans.isCorrect === true ? '✅ Yes' : 
                                    ans.isCorrect === false ? '❌ No' : 
                                    '⚪ N/A';
                const selected = ans.selectedAnswer || '-';
                const source = (ans.question?.sourceType || 'unknown').padEnd(12);
                console.log(`   ${idx + 1} | ${qId} | ${correctStatus.padEnd(9)} | ${selected} | ${source}`);
            });
            
            console.log('\n✅ VERIFICATION:');
            console.log(`   Expected: 30 answers`);
            console.log(`   Actual:   ${sampleB.answers.length} answers`);
            console.log(`   Status:   ${sampleB.answers.length === 30 ? '✅ PERFECT MATCH' : '❌ MISMATCH'}\n`);
            
        } else {
            console.log('❌ Not found\n');
        }
        
        console.log('═'.repeat(70));
        console.log('AUDIT COMPLETE');
        console.log('═'.repeat(70) + '\n');
        
    } catch (error) {
        console.error('❌ ERROR:', error.message);
    } finally {
        await client.close();
    }
}

getDetailedSamples();
