require("dotenv").config({ path: ".env" });
const { MongoClient } = require('mongodb');

async function getSamples() {
    const client = new MongoClient(process.env.MONGO_URI);
    
    try {
        await client.connect();
        const db = client.db('bimbel-lms');
        const collection = db.collection('studenttaskattempts');
        
        console.log('╔══════════════════════════════════════════════════════════════╗');
        console.log('║       SAMPLE ATTEMPTS FOR CBT FINAL AUDIT - 30 SOAL         ║');
        console.log('╚══════════════════════════════════════════════════════════════╝\n');
        
        // Get count first
        const count10 = await collection.countDocuments({ 'answers.length': 10 });
        const count30 = await collection.countDocuments({ 'answers.length': 30 });
        
        console.log(`📊 Summary:`);
        console.log(`   Attempts dengan 10 answers: ${count10}`);
        console.log(`   Attempts dengan 30 answers: ${count30}\n`);
        
        // SAMPLE A: Exactly 10 answers
        console.log('═'.repeat(70));
        console.log('SAMPLE A: EXACTLY 10 ANSWERS');
        console.log('═'.repeat(70));
        
        const cursorA = collection.find({ 'answers.length': 10 }).sort({ createdAt: -1 }).limit(1);
        const sampleA = await cursorA.next();
        
        if (sampleA) {
            console.log('\n📋 DATA LEPANCING:\n');
            console.log(`_id (attemptId):           ${sampleA._id.toString()}`);
            console.log(`studentId:                 ${sampleA.studentId}`);
            console.log(`taskId:                    ${sampleA.taskId}`);
            console.log(`jawaban.length:            ${sampleA.answers.length} ✅`);
            console.log(`correctCount:              ${sampleA.correctCount || 'N/A'}`);
            console.log(`wrongCount:                ${sampleA.wrongCount || 'N/A'}`);
            console.log(`unansweredCount:           ${sampleA.unansweredCount || 'N/A'}`);
            console.log(`score:                     ${sampleA.score || 'N/A'}`);
            console.log(`timestamp (local):         ${new Date(sampleA.createdAt).toLocaleString('id-ID')}`);
            console.log(`timestamp (ISO):           ${new Date(sampleA.createdAt).toISOString()}`);
            
            if (sampleA.updatedAt) {
                console.log(`updatedAt (local):         ${new Date(sampleA.updatedAt).toLocaleString('id-ID')}`);
            }
            
            console.log('\n📊 ANSWER BREAKDOWN:\n');
            let correct = 0;
            let wrong = 0;
            let unanswered = 0;
            
            sampleA.answers.forEach((ans, idx) => {
                if (ans.isCorrect === true) correct++;
                else if (ans.isCorrect === false) wrong++;
                else unanswered++;
                
                if (idx < 5) {
                    console.log(`  [${idx + 1}] questionId: ${ans.questionId}`);
                    console.log(`      sourceType:     ${ans.question?.sourceType || 'N/A'}`);
                    console.log(`      isCorrect:      ${ans.isCorrect !== undefined ? ans.isCorrect : 'UNANSWERED'}`);
                    if (ans.userAnswer) {
                        console.log(`      userAnswer:     ${JSON.stringify(ans.userAnswer)}`);
                    }
                    if (ans.correctAnswer) {
                        console.log(`      correctAnswer:  ${JSON.stringify(ans.correctAnswer)}`);
                    }
                    console.log('');
                }
            });
            
            console.log('  ... and ' + (sampleA.answers.length - 5) + ' more answers\n');
            
            console.log('✅ VERIFICATION:\n');
            console.log(`   Expected: 10 answers`);
            console.log(`   Actual:   ${sampleA.answers.length} answers`);
            console.log(`   Status:   ${sampleA.answers.length === 10 ? '✅ PERFECT MATCH' : '❌ MISMATCH'}`);
            
        } else {
            console.log('\n⚠️  TIDAK DITEMUKAN attempt dengan exactly 10 answers!');
        }
        
        console.log('\n\n');
        
        // SAMPLE B: Exactly 30 answers with pattern 10 ClassTask + 20 QuestionBank
        console.log('═'.repeat(70));
        console.log('SAMPLE B: EXACTLY 30 ANSWERS (10 ClassTask + 20 QuestionBank)');
        console.log('═'.repeat(70));
        
        const cursorB = collection.find({ 'answers.length': 30 }).sort({ createdAt: -1 }).limit(1);
        const sampleB = await cursorB.next();
        
        if (sampleB) {
            console.log('\n📋 DATA LENGKAP:\n');
            console.log(`_id (attemptId):           ${sampleB._id.toString()}`);
            console.log(`studentId:                 ${sampleB.studentId}`);
            console.log(`taskId:                    ${sampleB.taskId}`);
            console.log(`jawaban.length:            ${sampleB.answers.length} ✅`);
            console.log(`correctCount:              ${sampleB.correctCount || 'N/A'}`);
            console.log(`wrongCount:                ${sampleB.wrongCount || 'N/A'}`);
            console.log(`unansweredCount:           ${sampleB.unansweredCount || 'N/A'}`);
            console.log(`score:                     ${sampleB.score || 'N/A'}`);
            console.log(`timestamp (local):         ${new Date(sampleB.createdAt).toLocaleString('id-ID')}`);
            console.log(`timestamp (ISO):           ${new Date(sampleB.createdAt).toISOString()}`);
            
            if (sampleB.updatedAt) {
                console.log(`updatedAt (local):         ${new Date(sampleB.updatedAt).toLocaleString('id-ID')}`);
            }
            
            console.log('\n📊 SOURCE DISTRIBUTION ANALYSIS:\n');
            
            const classQuestions = sampleB.answers.filter(a => a.question?.sourceType === 'ClassTask');
            const bankQuestions = sampleB.answers.filter(a => a.question?.sourceType === 'QuestionBank');
            const otherQuestions = sampleB.answers.filter(a => !['ClassTask', 'QuestionBank'].includes(a.question?.sourceType));
            
            console.log(`   ClassTask questions:    ${classQuestions.length}`);
            console.log(`   QuestionBank questions: ${bankQuestions.length}`);
            console.log(`   Other sources:          ${otherQuestions.length}`);
            
            if (classQuestions.length > 0) {
                console.log('\n   📍 ClassTask Questions (first 5):');
                classQuestions.slice(0, 5).forEach((ans, idx) => {
                    console.log(`      ${idx + 1}. qId=${ans.questionId}, isCorrect=${ans.isCorrect}`);
                });
            }
            
            if (bankQuestions.length > 0) {
                console.log('\n   📍 QuestionBank Questions (first 5):');
                bankQuestions.slice(0, 5).forEach((ans, idx) => {
                    console.log(`      ${idx + 1}. qId=${ans.questionId}, isCorrect=${ans.isCorrect}`);
                });
            }
            
            console.log('\n📋 ANSWER SEQUENCE (full 30):');
            console.log('   Index | QID                      | Source       | Correct');
            console.log('   ------|--------------------------|--------------|----------');
            
            sampleB.answers.forEach((ans, idx) => {
                const qId = ans.questionId.toString().substring(0, 20).padEnd(22);
                const source = (ans.question?.sourceType || 'Unknown').padEnd(12);
                const status = ans.isCorrect === true ? '✅ Yes' : 
                              ans.isCorrect === false ? '❌ No' : 
                              '⚪ Unanswered';
                console.log(`   ${idx.toString().padStart(6)} | ${qId} | ${source} | ${status}`);
            });
            
            console.log('\n✅ PATTERN VERIFICATION:\n');
            console.log(`   Target Pattern: 10 ClassTask + 20 QuestionBank`);
            console.log(`   Actual Pattern: ${classQuestions.length} ClassTask + ${bankQuestions.length} QuestionBank`);
            
            if (classQuestions.length === 10 && bankQuestions.length === 20) {
                console.log('   Status:           ✅✅✅ PERFECT MATCH! ✅✅✅');
            } else {
                console.log('   Status:           ⚠️  NOT PERFECT MATCH');
                console.log(`              Difference: (${classQuestions.length - 10 >= 0 ? '+' : ''}${classQuestions.length - 10}) ClassTask, ` +
                            `${(bankQuestions.length - 20 >= 0 ? '+' : '')}${bankQuestions.length - 20} QuestionBank`);
            }
            
        } else {
            console.log('\n⚠️  TIDAK DITEMUKAN attempt dengan exactly 30 answers!');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    } finally {
        await client.close();
    }
}

getSamples();
