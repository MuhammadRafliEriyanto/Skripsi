require("dotenv").config({ path: ".env" });
const { MongoClient } = require('mongodb');

async function findAlternatives() {
    const client = new MongoClient(process.env.MONGO_URI);
    
    try {
        await client.connect();
        const db = client.db('bimbel-lms');
        const collection = db.collection('studenttaskattempts');
        
        console.log('=== DISTRIBUSI JUMLAH JAWABAN ===\n');
        
        // Get distribution of answer counts
        const stats = await collection.aggregate([
            { $match: { answers: { $exists: true, $type: 'array' } } },
            { $addFields: { answerCount: { $size: '$answers' } } },
            { $group: { _id: '$answerCount', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]).toArray();
        
        let total = 0;
        stats.forEach(item => {
            total += item.count;
        });
        
        stats.forEach(item => {
            const percentage = ((item.count / total) * 100).toFixed(2);
            console.log(`  ${item._id.toString().padStart(3)} answers: ${item.count.toString().padStart(6)} attempts (${percentage}%)`);
        });
        
        console.log(`\nTotal Attempts: ${total}`);
        
        // Find alternatives close to 10 answers
        console.log('\n=== ALTERNATIF TERDEKAT UNTUK 10 SOAL ===\n');
        
        // Use find with limit instead of cursor-based approach
const alt10 = await collection.find({ 
            answerCount: { $gte: 8, $lte: 12 } 
        }).sort({ createdAt: -1 }).limit(3).toArray();
        
        if (alt10 && alt10.length > 0) {
            alt10.forEach((att, i) => {
                console.log(`${i+1}. Attempt dengan ${att.answers.length} jawaban`);
                console.log(`   ID: ${att._id.toString().substring(0, 12)}...`);
                console.log(`   studentId: ${att.studentId}`);
                console.log(`   taskId: ${att.taskId}`);
                console.log(`   correctCount: ${att.correctCount || 'N/A'}`);
                console.log(`   wrongCount: ${att.wrongCount || 'N/A'}`);
                console.log(`   unansweredCount: ${att.unansweredCount || 'N/A'}`);
                console.log(`   score: ${att.score || 'N/A'}`);
                console.log(`   timestamp: ${new Date(att.createdAt).toLocaleString('id-ID')}`);
                
                const classQ = att.answers.filter(a => a.question?.sourceType === 'ClassTask').length;
                const bankQ = att.answers.filter(a => a.question?.sourceType === 'QuestionBank').length;
                console.log(`   Sources: ${classQ} ClassTask, ${bankQ} QuestionBank`);
                
                if (att.answers.length <= 5) {
                    console.log(`   First questions:`);
                    for (let j = 0; j < att.answers.length; j++) {
                        console.log(`     [${j}] qId=${att.answers[j].questionId}, sourceType=${att.answers[j].question?.sourceType || 'N/A'}, isCorrect=${att.answers[j].isCorrect}`);
                    }
                } else {
                    console.log(`   First 3 questions:`);
                    for (let j = 0; j < 3; j++) {
                        console.log(`     [${j}] qId=${att.answers[j].questionId}, sourceType=${att.answers[j].question?.sourceType || 'N/A'}, isCorrect=${att.answers[j].isCorrect}`);
                    }
                }
                
                console.log('');
            });
        } else {
            console.log('Tidak ditemukan alternatif terdekat untuk 10 soal.');
        }
        
        // Find alternatives close to 30 answers
        console.log('\n=== ALTERNATIF TERDEKAT UNTUK 30 SOAL ===\n');
        
        const alt30 = await collection.find({ 
            'answers.length': { $gte: 25, $lte: 35 } 
        }).sort({ createdAt: -1 }).limit(3).toArray();
        
        if (alt30.length > 0) {
            alt30.forEach((att, i) => {
                console.log(`${i+1}. Attempt dengan ${att.answers.length} jawaban`);
                console.log(`   ID: ${att._id.toString().substring(0, 12)}...`);
                console.log(`   studentId: ${att.studentId}`);
                console.log(`   taskId: ${att.taskId}`);
                console.log(`   correctCount: ${att.correctCount || 'N/A'}`);
                console.log(`   wrongCount: ${att.wrongCount || 'N/A'}`);
                console.log(`   unansweredCount: ${att.unansweredCount || 'N/A'}`);
                console.log(`   score: ${att.score || 'N/A'}`);
                console.log(`   timestamp: ${new Date(att.createdAt).toLocaleString('id-ID')}`);
                
                const classQ = att.answers.filter(a => a.question?.sourceType === 'ClassTask').length;
                const bankQ = att.answers.filter(a => a.question?.sourceType === 'QuestionBank').length;
                console.log(`   Source Distribution:`);
                console.log(`     ClassTask: ${classQ}`);
                console.log(`     QuestionBank: ${bankQ}`);
                
                const otherQ = att.answers.filter(a => !['ClassTask', 'QuestionBank'].includes(a.question?.sourceType)).length;
                if (otherQ > 0) {
                    console.log(`     Other: ${otherQ}`);
                }
                
                if (classQ <= 12 && bankQ <= 25) {
                    console.log(`   Answer Sequence (first 10):`);
                    for (let j = 0; j < Math.min(10, att.answers.length); j++) {
                        console.log(`     [${j + 1}] qId=${att.answers[j].questionId}, sourceType=${att.answers[j].question?.sourceType || 'N/A'}, isCorrect=${att.answers[j].isCorrect}`);
                    }
                    
                    console.log(`   Answer Sequence (last 10):`);
                    for (let j = Math.max(0, att.answers.length - 10); j < att.answers.length; j++) {
                        console.log(`     [${j + 1}] qId=${att.answers[j].questionId}, sourceType=${att.answers[j].question?.sourceType || 'N/A'}, isCorrect=${att.answers[j].isCorrect}`);
                    }
                }
                
                console.log('');
            });
        } else {
            console.log('Tidak ditemukan alternatif terdekat untuk 30 soal.');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.close();
    }
}

findAlternatives();
