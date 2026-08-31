require("dotenv").config({ path: "backend/.env" });
const { MongoClient } = require('mongodb');

async function findSampleAttempts() {
    const client = new MongoClient(process.env.MONGO_URI);
    
    try {
        await client.connect();
        const db = client.db('bimbel-lms');
        const collection = db.collection('studenttaskattempts');
        
        console.log('=== SAMPLE A: Exactly 10 Answers ===\n');
        
        // Find sample with exactly 10 answers
        const sampleA = await collection.findOne({ 'answers.length': 10 }).sort({ createdAt: -1 });
        
        if (sampleA) {
            console.log(`_id (attemptId):     ${sampleA._id}`);
            console.log(`studentId:           ${sampleA.studentId}`);
            console.log(`taskId:              ${sampleA.taskId}`);
            console.log(`jawaban.length:      ${sampleA.answers.length}`);
            console.log(`correctCount:        ${sampleA.correctCount || 'N/A'}`);
            console.log(`wrongCount:          ${sampleA.wrongCount || 'N/A'}`);
            console.log(`unansweredCount:     ${sampleA.unansweredCount || 'N/A'}`);
            console.log(`score:               ${sampleA.score || 'N/A'}`);
            console.log(`timestamp:           ${new Date(sampleA.createdAt).toLocaleString('id-ID')}`);
            console.log(`createdAt:           ${new Date(sampleA.createdAt).toISOString()}`);
            console.log(`updatedAt:           ${new Date(sampleA.updatedAt).toLocaleString('id-ID')}`);
            
            // Show first 3 answers as preview
            console.log('\nPreview of first 3 answers:');
            for (let i = 0; i < Math.min(3, sampleA.answers.length); i++) {
                const ans = sampleA.answers[i];
                console.log(`  Answer ${i+1}: questionId=${ans.questionId}, sourceType=${ans.question?.sourceType || 'N/A'}, isCorrect=${ans.isCorrect}`);
            }
        } else {
            console.log('⚠️  NOT FOUND: No attempt with exactly 10 answers');
            
            // Find closest alternatives
            console.log('\n🔍 Searching for alternatives...\n');
            
            const count10 = await collection.countDocuments({ 'answers.length': 10 });
            console.log(`Total attempts with 10 answers: ${count10}`);
            
            const countsByLength = await collection.aggregate([
                { $group: { _id: '$answers.length', count: { $sum: 1 } } },
                { $sort: { _id: 1 } }
            ]).toArray();
            
            console.log('\nDistribution of answer counts:');
            countsByLength.forEach(item => {
                console.log(`  ${item._id} answers: ${item.count} attempts`);
            });
        }
        
        console.log('\n\n=========================================\n');
        console.log('=== SAMPLE B: Exactly 30 Answers ===\n');
        
        // Find sample with exactly 30 answers
        const sampleB = await collection.findOne({ 'answers.length': 30 }).sort({ createdAt: -1 });
        
        if (sampleB) {
            console.log(`_id (attemptId):     ${sampleB._id}`);
            console.log(`studentId:           ${sampleB.studentId}`);
            console.log(`taskId:              ${sampleB.taskId}`);
            console.log(`jawaban.length:      ${sampleB.answers.length}`);
            console.log(`correctCount:        ${sampleB.correctCount || 'N/A'}`);
            console.log(`wrongCount:          ${sampleB.wrongCount || 'N/A'}`);
            console.log(`unansweredCount:     ${sampleB.unansweredCount || 'N/A'}`);
            console.log(`score:               ${sampleB.score || 'N/A'}`);
            console.log(`timestamp:           ${new Date(sampleB.createdAt).toLocaleString('id-ID')}`);
            console.log(`createdAt:           ${new Date(sampleB.createdAt).toISOString()}`);
            console.log(`updatedAt:           ${new Date(sampleB.updatedAt).toLocaleString('id-ID')}`);
            
            // Check pattern: ClassTask + QuestionBank
            const classQuestions = sampleB.answers.filter(a => a.question?.sourceType === 'ClassTask').length;
            const bankQuestions = sampleB.answers.filter(a => a.question?.sourceType === 'QuestionBank').length;
            const otherQuestions = sampleB.answers.filter(a => !['ClassTask', 'QuestionBank'].includes(a.question?.sourceType)).length;
            
            console.log(`\n📊 Source Distribution:`);
            console.log(`  ClassTask:           ${classQuestions}`);
            console.log(`  QuestionBank:        ${bankQuestions}`);
            console.log(`  Other:               ${otherQuestions}`);
            
            if (classQuestions === 10 && bankQuestions === 20) {
                console.log('\n✅ PERFECT MATCH: Pattern 10 ClassTask + 20 QuestionBank found!');
            } else {
                console.log(`\n⚠️  Expected pattern: 10 ClassTask + 20 QuestionBank`);
                console.log(`   Actual pattern:     ${classQuestions} ClassTask + ${bankQuestions} QuestionBank`);
            }
            
            // Show answer sequence
            console.log('\nAnswer Sequence (first 10):');
            sampleB.answers.slice(0, 10).forEach((ans, idx) => {
                console.log(`  ${idx + 1}. Q${ans.questionId} (${ans.question?.sourceType || 'N/A'})`);
            });
            
            console.log('\nAnswer Sequence (last 10):');
            sampleB.answers.slice(-10).forEach((ans, idx) => {
                console.log(`  ${sampleB.answers.length - 9 + idx}. Q${ans.questionId} (${ans.question?.sourceType || 'N/A'})`);
            });
        } else {
            console.log('⚠️  NOT FOUND: No attempt with exactly 30 answers');
            
            // Find closest alternatives
            console.log('\n🔍 Searching for alternatives...\n');
            
            const count30 = await collection.countDocuments({ 'answers.length': 30 });
            console.log(`Total attempts with 30 answers: ${count30}`);
            
            // Find attempts with similar length (28-32 range)
            const nearbyAttempts = await collection.find({
                'answers.length': { $gte: 28, $lte: 32 }
            }).sort({ createdAt: -1 }).limit(5).toArray();
            
            if (nearbyAttempts.length > 0) {
                console.log('\n📋 Attempts near 30 answers:\n');
                nearbyAttempts.forEach((att, idx) => {
                    console.log(`${idx + 1}. ${att.answers.length} answers - ID: ${att._id.toString().substring(0, 12)}...`);
                });
                
                // Show distribution
                console.log('\n📊 Distribution around 30 answers:');
                const countsByLength = await collection.aggregate([
                    { $match: { 'answers.length': { $gte: 25, $lte: 35 } } },
                    { $group: { _id: '$answers.length', count: { $sum: 1 } } },
                    { $sort: { _id: 1 } }
                ]).toArray();
                
                countsByLength.forEach(item => {
                    const marker = item._id === 30 ? ' ← Target' : '';
                    console.log(`  ${item._id} answers: ${item.count} attempts${marker}`);
                });
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.close();
    }
}

findSampleAttempts();
