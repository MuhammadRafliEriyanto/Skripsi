import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { ClassTask } from '../models/ClassTask';

// Load environment variables
dotenv.config();

if (!process.env.MONGO_URI) {
  console.error('Error: MONGO_URI tidak ditemukan di file .env');
  process.exit(1);
}
import { ClassMaterial } from '../models/ClassMaterial';
import { AttendanceSession } from '../models/AttendanceSession';
import { AttendanceRecord } from '../models/AttendanceRecord';
import { Schedule } from '../models/Schedule';
import { TaskSubmission } from '../models/TaskSubmission';
import { StudentTaskAttempt } from '../models/StudentTaskAttempt';
import { TaskGrade } from '../models/TaskGrade';
import { ClassTaskQuestion } from '../models/ClassTaskQuestion';
import { QuestionBank } from '../models/QuestionBank';
import { Student } from '../models/Student';
import { Teacher } from '../models/Teacher';
import { User } from '../models/User';
import { Subscription } from '../models/Subscription';

dotenv.config();

async function mapP1P9Data() {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    
    console.log('\n' + '='.repeat(80));
    console.log('MAP DATA DUMMY P1-P9 - PRE-MIGRATION AUDIT');
    console.log('='.repeat(80) + '\n');
    
    const report: Record<string, any> = {};
    
    // 1. Map ClassTask (Latihan CBT)
    const tasks = await ClassTask.find({
      title: { $regex: /Latihan CBT P\d/ }
    }).select('taskId className subject meetingNumber title questionCount').lean();
    
    report['ClassTask'] = {
      count: tasks.length,
      items: tasks.map(t => ({
        taskId: t.taskId,
        className: t.className,
        subject: t.subject,
        meetingNumber: t.meetingNumber,
        title: t.title,
        questionCount: t.questionCount,
      }))
    };
    
    // 2. Map ClassMaterial
    const materials = await ClassMaterial.find({}).select('materialId className topic').lean();
    const bimbelMaterials = materials.filter(m => m.className.match(/BIMBEL|P\d/i));
    
    report['ClassMaterial'] = {
      count: bimbelMaterials.length,
      sample: bimbelMaterials.slice(0, 5)
    };
    
    // 3. Map AttendanceSession
    const sessions = await AttendanceSession.find({
      sessionId: { $regex: /ATS-BIMBEL-P1P9/ }
    }).select('sessionId className subject date startTime').lean();
    
    report['AttendanceSession'] = {
      count: sessions.length,
      sample: sessions.slice(0, 5).map(s => ({
        sessionId: s.sessionId,
        className: s.className,
        subject: s.subject,
        date: s.date,
      }))
    };
    
    // 4. Map AttendanceRecord
    const sessionIds = sessions.map(s => s.sessionId);
    const attendanceRecords = await AttendanceRecord.countDocuments({
      sessionId: { $in: sessionIds }
    });
    
    report['AttendanceRecord'] = {
      count: attendanceRecords
    };
    
    // 5. Map Schedule
    const schedules = await Schedule.find({
      scheduleId: { $regex: /SCH-BIMBEL-P1P9/ }
    }).select('scheduleId className subject day time').lean();
    
    report['Schedule'] = {
      count: schedules.length,
      sample: schedules.slice(0, 3)
    };
    
    // 6. Map TaskSubmission
    const taskIds = tasks.map(t => t.taskId);
    const submissions = await TaskSubmission.find({
      taskId: { $in: taskIds }
    }).select('submissionId taskId studentId status').lean();
    
    report['TaskSubmission'] = {
      count: submissions.length,
      sample: submissions.slice(0, 5).map(s => ({
        submissionId: s.submissionId,
        taskId: s.taskId,
        studentId: s.studentId,
        status: s.status,
      }))
    };
    
    // 7. Map StudentTaskAttempt
    const attempts = await StudentTaskAttempt.find({
      attemptId: { $regex: /ATTEMPT-BIMBEL-P1P9/ }
    }).select('attemptId taskId studentId answers status score').lean();
    
    report['StudentTaskAttempt'] = {
      count: attempts.length,
      details: [],
      validation: {
        totalAnswers: 0,
        invalidQuestions: 0,
        validQuestions: 0,
      }
    };
    
    let totalAnswers = 0;
    let invalidQuestions = 0;
    let validQuestions = 0;
    const uniqueQuestionIds = new Set<string>();
    
    for (const attempt of attempts) {
      const answerCount = attempt.answers?.length || 0;
      totalAnswers += answerCount;
      
      for (const answer of attempt.answers || []) {
        uniqueQuestionIds.add(answer.questionId);
        
        const foundInQB = await QuestionBank.findOne({
          questionId: answer.questionId
        });
        
        if (!foundInQB) {
          invalidQuestions++;
        } else {
          validQuestions++;
        }
      }
      
      report['StudentTaskAttempt'].details.push({
        attemptId: attempt.attemptId,
        taskId: attempt.taskId,
        studentId: attempt.studentId,
        answerCount: answerCount,
        score: attempt.score,
        status: attempt.status,
      });
    }
    
    report['StudentTaskAttempt'].validation.totalAnswers = totalAnswers;
    report['StudentTaskAttempt'].validation.invalidQuestions = invalidQuestions;
    report['StudentTaskAttempt'].validation.validQuestions = validQuestions;
    
    // 8. Map TaskGrade
    const grades = await TaskGrade.find({
      taskId: { $in: taskIds }
    }).select('studentId taskId status score').lean();
    
    report['TaskGrade'] = {
      count: grades.length,
      breakdown: {
        veryHigh: grades.filter(g => g.status === 'Sangat Memuaskan').length,
        high: grades.filter(g => g.status === 'Memuaskan').length,
        tuntas: grades.filter(g => g.status === 'Tuntas').length,
        remedial: grades.filter(g => g.status === 'Perlu Remedial').length,
        absentZero: grades.filter(g => g.status === 'Tidak Hadir (Nihil)').length,
      }
    };
    
    // 9. Map ClassTaskQuestion
    const ctqItems = await ClassTaskQuestion.find({
      questionId: { $regex: /BIMBEL-P1P9/ }
    }).select('questionId taskId order correctAnswer').lean();
    
    report['ClassTaskQuestion'] = {
      count: ctqItems.length,
      uniqueQuestionIds: new Set(ctqItems.map(q => q.questionId)).size,
      sample: ctqItems.slice(0, 10)
    };
    
    // 10. Validate QuestionBank references
    console.log('\n--- VALIDASI QUESTION BANK REFERENCES ---');
    const validatedQuestions = new Set<string>();
    const outdatedQuestions = new Set<string>();
    
    for (const qid of uniqueQuestionIds) {
      const inQB = await QuestionBank.findOne({ questionId: qid });
      if (inQB) {
        validatedQuestions.add(qid);
      } else {
        outdatedQuestions.add(qid);
      }
    }
    
    report['QuestionValidation'] = {
      uniqueQuestionIdsReferenced: uniqueQuestionIds.size,
      validInQuestionBank: validatedQuestions.size,
      outdatedOrMissing: outdatedQuestions.size,
      oldQuestionIds: Array.from(outdatedQuestions).slice(0, 20),
      newQuestionIds: Array.from(validatedQuestions).slice(0, 10)
    };
    
    // 11. Map Students involved
    const studentIds = [...new Set(attempts.map(a => a.studentId))];
    const students = await Student.find({
      studentId: { $in: studentIds }
    }).select('studentId nama className branch program').lean();
    
    report['Students'] = {
      count: students.length,
      uniqueEnrolled: new Set(students.map(s => s.studentId)).size,
      sample: students.slice(0, 5).map(s => ({
        studentId: s.studentId,
        nama: s.nama,
        className: s.className,
        branch: s.branch,
      }))
    };
    
    // 12. Summary by Branch
    const branches = new Set(tasks.map(t => t.className.match(/branch-\w+/)?.[0]));
    const branchStats: Record<string, number> = {};
    
    for (const branch of branches) {
      if (branch) {
        const branchTasks = tasks.filter(t => t.className.includes(branch));
        branchStats[branch] = branchTasks.length;
      }
    }
    
    report['BranchSummary'] = branchStats;
    
    // Print summary
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY DATA P1-P9 YANG ADA SAAT INI');
    console.log('='.repeat(80));
    
    console.log(`\n1. CLASS TASK (LATIHAN CBT)`);
    console.log(`   Jumlah: ${report['ClassTask'].count} tugas`);
    if (tasks.length > 0) {
      console.log(`   Sample: ${tasks[0].title} (${tasks[0].questionCount} soal)`);
    }
    
    console.log(`\n2. CLASS MATERIAL`);
    console.log(`   Jumlah: ${report['ClassMaterial'].count} materi`);
    
    console.log(`\n3. ATTENDANCE SESSION`);
    console.log(`   Jumlah: ${report['AttendanceSession'].count} sesi`);
    
    console.log(`\n4. ATTENDANCE RECORD`);
    console.log(`   Jumlah: ${report['AttendanceRecord'].count} record`);
    
    console.log(`\n5. SCHEDULE`);
    console.log(`   Jumlah: ${report['Schedule'].count} jadwal`);
    
    console.log(`\n6. TASK SUBMISSION`);
    console.log(`   Jumlah: ${report['TaskSubmission'].count} submitan`);
    
    console.log(`\n7. STUDENT TASK ATTEMPT (CBT)`);
    console.log(`   Jumlah: ${report['StudentTaskAttempt'].count} attempt`);
    console.log(`   Total Answers: ${report['StudentTaskAttempt'].validation.totalAnswers}`);
    console.log(`   Valid Questions: ${report['StudentTaskAttempt'].validation.validQuestions}`);
    console.log(`   Invalid Questions: ${report['StudentTaskAttempt'].validation.invalidQuestions}`);
    
    console.log(`\n8. TASK GRADE`);
    console.log(`   Jumlah: ${report['TaskGrade'].count} nilai`);
    console.log(`   Status:`, report['TaskGrade'].breakdown);
    
    console.log(`\n9. CLASS TASK QUESTION`);
    console.log(`   Jumlah: ${report['ClassTaskQuestion'].count} item soal`);
    console.log(`   Unique Questions: ${report['ClassTaskQuestion'].uniqueQuestionIds}`);
    
    console.log(`\n10. STUDENTS INVOLVED`);
    console.log(`    Jumlah siswa: ${report['Students'].count}`);
    
    console.log(`\n11. QUESTION BANK VALIDATION`);
    console.log(`    Total questionId unik: ${report['QuestionValidation'].uniqueQuestionIdsReferenced}`);
    console.log(`    Valid di QuestionBank V6: ${report['QuestionValidation'].validInQuestionBank}`);
    console.log(`    Kadaluarsa/Tidak Ada: ${report['QuestionValidation'].outdatedOrMissing}`);
    
    if (report['QuestionValidation'].oldQuestionIds.length > 0) {
      console.log(`\n    Contoh OLD questionId (bukan V6):`);
      report['QuestionValidation'].oldQuestionIds.forEach((qid: string, i: number) => {
        console.log(`       ${i+1}. ${qid}`);
      });
    }
    
    // Export to JSON file
    const fs = require('fs');
    const outputPath = './backend/p1p9-audit-map.json';
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`\n✓ Report tersimpan ke: ${outputPath}`);
    
    // Determine what needs to be reset
    console.log('\n' + '='.repeat(80));
    console.log('REKOMENDASI RESET TERBATAS');
    console.log('='.repeat(80));
    console.log('\nDATA YANG BISA DIRESET (dummy P1-P9):');
    console.log('  ✓ ClassTask (Latihan CBT) -', report['ClassTask'].count, 'items');
    console.log('  ✓ ClassMaterial -', report['ClassMaterial'].count, 'items');
    console.log('  ✓ AttendanceSession -', report['AttendanceSession'].count, 'items');
    console.log('  ✓ AttendanceRecord -', report['AttendanceRecord'].count, 'items');
    console.log('  ✓ TaskSubmission -', report['TaskSubmission'].count, 'items');
    console.log('  ✓ StudentTaskAttempt -', report['StudentTaskAttempt'].count, 'items');
    console.log('  ✓ TaskGrade -', report['TaskGrade'].count, 'items');
    console.log('  ✓ ClassTaskQuestion -', report['ClassTaskQuestion'].count, 'items');
    
    console.log('\nDATA YANG TIDAK BOLEH DIHAPUS:');
    console.log('  ✗ QuestionBank V6');
    console.log('  ✗ Student master (selain P1-P9)');
    console.log('  ✗ Teacher master');
    console.log('  ✗ User accounts');
    console.log('  ✗ Subscription non-dummy');
    console.log('  ✗ Data real siswa/guru lain');
    
    process.exit(0);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

mapP1P9Data();
