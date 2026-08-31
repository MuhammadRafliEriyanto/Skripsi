require("dotenv").config({ path: "backend/.env" });

const { MongoClient, ObjectId } = require('mongodb');

(async () => {
    const client = new MongoClient(process.env.MONGO_URI);
    
    try {
        await client.connect();
        
        const db = client.db('bimbel-lms');
        
        console.log('╔══════════════════════════════════════════════════════════╗');
        console.log('║   FINAL AUDIT: SMA 10/12 SOURCE OF TRUTH MAPPING       ║');
        console.log('╚══════════════════════════════════════════════════════════╝\n');
        
        // ========== SECTION 1: DATA GATHERING ==========
        console.log('📊 SECTION 1: Data Gathering\n');
        
        const smaStudents = await db.collection('students')
            .find({ className: { $in: ['SMA 10', 'SMA 12'] } })
            .toArray();
        
        console.log(`Total SMA Students:`);
        console.log(`  - SMA 10: ${smaStudents.filter(s => s.className === 'SMA 10').length}`);
        console.log(`  - SMA 12: ${smaStudents.filter(s => s.className === 'SMA 12').length}`);
        console.log(`  - TOTAL: ${smaStudents.length}\n`);
        
        const smaStudentIds = smaStudents.map(s => s.studentId);
        
        // Get all attempts for these students
        const attempts = await db.collection('studenttaskattempts')
            .find({ studentId: { $in: smaStudentIds } })
            .toArray();
        
        console.log(`Total Attempts Found: ${attempts.length}`);
        
        // Filter by actual_question_count or answers.length
        const attempts30 = attempts.filter(a => 
            (a.actual_question_count === 30) || 
            (Array.isArray(a.answers) && a.answers.length === 30)
        );
        
        console.log(`Attempts with 30 Questions: ${attempts30.length}\n`);
        
        if (attempts30.length === 0) {
            console.log('❌ NO DATA: No 30-question attempts found.\n');
            
            // Check answer distribution anyway
            const lengths = {};
            attempts.forEach(a => {
                const len = Array.isArray(a.answers) ? a.answers.length : 0;
                lengths[len] = (lengths[len] || 0) + 1;
            });
            
            console.log('Answer Distribution:');
            Object.entries(lengths).sort(([a], [b]) => Number(a) - Number(b))
                .forEach(([len, count]) => {
                    console.log(`  ${len}: ${count} attempts`);
                });
            
            return;
        }
        
        // ========== SECTION 2: TASK ANALYSIS ==========
        console.log('\n📋 SECTION 2: Task Analysis\n');
        
        // Collect unique tasks
        const taskMap = new Map();
        
        for (const attempt of attempts30) {
            const taskId = attempt.taskId.toString();
            
            if (!taskMap.has(taskId)) {
                taskMap.set(taskId, {
                    sampleAttempt: attempt,
                    count: 0,
                    subjects: new Set(),
                    meetingNumbers: new Set()
                });
            }
            
            taskMap.get(taskId).count++;
            if (attempt.subject) taskMap.get(taskId).subjects.add(attempt.subject);
            if (attempt.meetingNumber) taskMap.get(taskId).meetingNumbers.add(attempt.meetingNumber);
        }
        
        console.log(`Unique Tasks Referenced: ${taskMap.size}\n`);
        
        // Analyze each task's QB reference
        let ipaTasks = [];
        let ipsTasks = [];
        let noQBRefTasks = [];
        
        for (const [taskId, data] of taskMap.entries()) {
            const taskDoc = await db.collection('classtasks').findOne({
                _id: data.sampleAttempt.taskId
            });
            
            if (!taskDoc?.questionBankId) {
                noQBRefTasks.push({
                    id: taskId,
                    count: data.count,
                    reason: 'NO_QB_FIELD'
                });
                continue;
            }
            
            const qb = await db.collection('questionbanks').findOne({
                _id: taskDoc.questionBankId
            });
            
            if (!qb?.program) {
                noQBRefTasks.push({
                    id: taskId,
                    count: data.count,
                    reason: 'QB_NO_PROGRAM'
                });
                continue;
            }
            
            if (qb.program === 'SMA IPA') {
                ipaTasks.push({
                    id: taskId,
                    title: qb.title,
                    subject: qb.subject,
                    count: data.count
                });
            } else if (qb.program === 'SMA IPS') {
                ipsTasks.push({
                    id: taskId,
                    title: qb.title,
                    subject: qb.subject,
                    count: data.count
                });
            } else {
                noQBRefTasks.push({
                    id: taskId,
                    count: data.count,
                    reason: `UNEXPECTED_PROGRAM_${qb.program}`
                });
            }
        }
        
        console.log('Task Program Distribution:\n');
        console.log(`  ✓ SMA IPA Tasks: ${ipaTasks.length}`);
        ipaTasks.forEach(t => {
            console.log(`    - ${t.title} (${t.subject}) - Used in ${t.count} attempts`);
        });
        
        console.log(`\n  ✓ SMA IPS Tasks: ${ipsTasks.length}`);
        ipsTasks.forEach(t => {
            console.log(`    - ${t.title} (${t.subject}) - Used in ${t.count} attempts`);
        });
        
        console.log(`\n  ✗ No QB Reference: ${noQBRefTasks.length}`);
        noQBRefTasks.forEach(t => {
            console.log(`    - ${t.id} (${t.reason}) - Used in ${t.count} attempts`);
        });
        
        // ========== SECTION 3: USAGE COUNTS ==========
        console.log('\n📈 SECTION 3: Usage Counts\n');
        
        let totalIPAUsage = 0;
        let totalIPSUsage = 0;
        let totalUnknownUsage = 0;
        
        for (const attempt of attempts30) {
            const taskDoc = await db.collection('classtasks').findOne({
                _id: attempt.taskId
            });
            
            if (!taskDoc?.questionBankId) {
                totalUnknownUsage++;
                continue;
            }
            
            const qb = await db.collection('questionbanks').findOne({
                _id: taskDoc.questionBankId
            });
            
            if (qb?.program === 'SMA IPA') {
                totalIPAUsage++;
            } else if (qb?.program === 'SMA IPS') {
                totalIPSUsage++;
            } else {
                totalUnknownUsage++;
            }
        }
        
        console.log(`SMA IPA Usage: ${totalIPAUsage} attempts\n`);
        console.log(`SMA IPS Usage: ${totalIPSUsage} attempts\n`);
        console.log(`No QB Ref/Mixed: ${totalUnknownUsage} attempts\n`);
        
        // ========== SECTION 4: DETAILED BREAKDOWN ==========
        console.log('\n📝 SECTION 4: Detailed Breakdown by Grade\n');
        
        const sma10Attempts = attempts30.filter(a => 
            smaStudents.find(s => s.studentId === a.studentId)?.className === 'SMA 10'
        );
        const sma12Attempts = attempts30.filter(a => 
            smaStudents.find(s => s.studentId === a.studentId)?.className === 'SMA 12'
        );
        
        let sma10IPA = 0, sma10IPS = 0, sma10Unknown = 0;
        let sma12IPA = 0, sma12IPS = 0, sma12Unknown = 0;
        
        const analyzeByGrade = async (attemptsArr, grade) => {
            let ipa = 0, ips = 0, unknown = 0;
            
            for (const attempt of attemptsArr) {
                const taskDoc = await db.collection('classtasks').findOne({
                    _id: attempt.taskId
                });
                
                if (!taskDoc?.questionBankId) {
                    unknown++;
                    continue;
                }
                
                const qb = await db.collection('questionbanks').findOne({
                    _id: taskDoc.questionBankId
                });
                
                if (qb?.program === 'SMA IPA') ipa++;
                else if (qb?.program === 'SMA IPS') ips++;
                else unknown++;
            }
            
            return { ipa, ips, unknown };
        };
        
        const sma10Stats = await analyzeByGrade(sma10Attempts, 'SMA 10');
        const sma12Stats = await analyzeByGrade(sma12Attempts, 'SMA 12');
        
        console.log(`SMA 10 Statistics:`);
        console.log(`  Total: ${sma10Attempts.length} attempts`);
        console.log(`  Using SMA IPA: ${sma10Stats.ipa}`);
        console.log(`  Using SMA IPS: ${sma10Stats.ips}`);
        console.log(`  No QB Reference: ${sma10Stats.unknown}\n`);
        
        console.log(`SMA 12 Statistics:`);
        console.log(`  Total: ${sma12Attempts.length} attempts`);
        console.log(`  Using SMA IPA: ${sma12Stats.ipa}`);
        console.log(`  Using SMA IPS: ${sma12Stats.ips}`);
        console.log(`  No QB Reference: ${sma12Stats.unknown}\n`);
        
        // ========== SECTION 5: CONCLUSION ==========
        console.log('╔══════════════════════════════════════════════════════════╗');
        console.log('║              FINAL CONCLUSION & RECOMMENDATION           ║');
        console.log('╚══════════════════════════════════════════════════════════╝\n');
        
        if (totalIPAUsage > 0 && totalIPSUsage === 0 && totalUnknownUsage === 0) {
            console.log('✅ MAPPING PROVEN: Use QuestionBank SMA IPA');
            console.log('\n📊 Evidence Summary:');
            console.log(`  All ${totalIPAUsage} attempts with 30 questions use ClassTasks`);
            console.log(`  that reference SMA IPA programs.`);
            console.log(`  Zero evidence of SMA IPS usage.`);
            console.log(`\n🎯 Recommendation:`);
            console.log(`  SMA 10 → SMA IPA`);
            console.log(`  SMA 12 → SMA IPA`);
            console.log(`\n💡 This mapping is based on ACTUAL database patterns.`);
            console.log(`  It represents the SOURCE OF TRUTH.\n`);
            
            writeReport({
                status: 'PROVEN_SMA_IPA',
                totalAttempts: attempts30.length,
                sma10: sma10Stats,
                sma12: sma12Stats,
                evidence: {
                    ipaTasks: ipaTasks.length,
                    ipsTasks: ipsTasks.length,
                    noQBRefTasks: noQBRefTasks.length,
                    ipaUsage: totalIPAUsage,
                    ipsUsage: totalIPSUsage,
                    unknownUsage: totalUnknownUsage
                },
                recommendation: 'Use QuestionBank SMA IPA for both SMA 10 and SMA 12'
            });
            
        } else if (totalIPSUsage > 0 && totalIPAUsage === 0 && totalUnknownUsage === 0) {
            console.log('✅ MAPPING PROVEN: Use QuestionBank SMA IPS');
            console.log('\n📊 Evidence Summary:');
            console.log(`  All ${totalIPSUsage} attempts with 30 questions use ClassTasks`);
            console.log(`  that reference SMA IPS programs.`);
            console.log(`  Zero evidence of SMA IPA usage.`);
            console.log(`\n🎯 Recommendation:`);
            console.log(`  SMA 10 → SMA IPS`);
            console.log(`  SMA 12 → SMA IPS`);
            console.log(`\n💡 This mapping is based on ACTUAL database patterns.`);
            console.log(`  It represents the SOURCE OF TRUTH.\n`);
            
            writeReport({
                status: 'PROVEN_SMA_IPS',
                totalAttempts: attempts30.length,
                sma10: sma10Stats,
                sma12: sma12Stats,
                evidence: {
                    ipaTasks: ipaTasks.length,
                    ipsTasks: ipsTasks.length,
                    noQBRefTasks: noQBRefTasks.length,
                    ipaUsage: totalIPAUsage,
                    ipsUsage: totalIPSUsage,
                    unknownUsage: totalUnknownUsage
                },
                recommendation: 'Use QuestionBank SMA IPS for both SMA 10 and SMA 12'
            });
            
        } else if (totalIPAUsage > 0 && totalIPSUsage > 0) {
            console.log('⚠️ MULTIPLE CANDIDATES DETECTED');
            console.log('\n📊 Evidence Summary:');
            console.log(`  SMA IPA: ${totalIPAUsage} attempts`);
            console.log(`  SMA IPS: ${totalIPSUsage} attempts`);
            console.log(`  Unknown/Missing: ${totalUnknownUsage} attempts`);
            console.log(`\n💡 Conclusion:`);
            console.log(`  Cannot map to single program without additional business rules.`);
            console.log(`  Possible approaches:`);
            console.log(`  Subject-based routing`);
            console.log(`  Manual assignment per student`);
            console.log(`  Review data migration completeness\n`);
            
        } else {
            console.log('❌ INSUFFICIENT EVIDENCE');
            console.log('\n📊 Evidence Summary:');
            console.log(`  No valid QB references found`);
            console.log(`  ${totalUnknownUsage} attempts lack proper QB linkage`);
            console.log(`\n💡 Conclusion:`);
            console.log(`  System may be using standalone ClassTaskQuestions.`);
            console.log(`  Recommended actions:`);
            console.log(`  Add questionBankId field to ClassTasks`);
            console.log(`  Create classification table linking classes to programs`);
            console.log(`  Use subject-based heuristics as fallback`);
            console.log(`  Consider adding direct program field to students\n`);
        }
        
        console.log('\n' + '='.repeat(64));
        console.log('Audit Complete!\n');
        
    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
    } finally {
        await client.close();
    }
})();

function writeReport(data) {
    const fs = require('fs');
    const path = require('path');
    
    const report = {
        auditDate: new Date().toISOString(),
        scope: 'READ-ONLY Source of Truth Analysis',
        dataSource: 'MongoDB Atlas - bimbel-lms.students & studenttaskattempts',
        conclusion: data.status,
        findings: {
            ...data
        },
        recommendation: data.recommendation
    };
    
    // Ensure docs directory exists
    const docsDir = path.join(__dirname, '../../..', '..', 'docs');
    if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, { recursive: true });
    }
    
    fs.writeFileSync(
        path.join(docsDir, 'final-sma-source-of-truth-audit.json'),
        JSON.stringify(report, null, 2)
    );
    
    console.log(`📁 Report saved to docs/final-sma-source-of-truth-audit.json`);
}
