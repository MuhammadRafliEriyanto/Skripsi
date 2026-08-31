import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { ClassMaterial } from '../models/ClassMaterial';
import { ClassTask } from '../models/ClassTask';
import { AttendanceSession } from '../models/AttendanceSession';
import { Schedule } from '../models/Schedule';
import { AttendanceRecord } from '../models/AttendanceRecord';
import { TaskSubmission } from '../models/TaskSubmission';
import { StudentTaskAttempt } from '../models/StudentTaskAttempt';
import { TaskGrade } from '../models/TaskGrade';
import { ClassTaskQuestion } from '../models/ClassTaskQuestion';
import { QuestionBank } from '../models/QuestionBank';

dotenv.config();

async function mapP1P9() {
  await mongoose.connect(process.env.MONGO_URI as string);
  
  const report: Record<string, any> = {};
  
  report['ClassTask'] = { count: await ClassTask.countDocuments({ taskId: { $regex: /BIMBEL-P1P9/ } }), idField: 'taskId' };
  report['StudentTaskAttempt'] = { count: await StudentTaskAttempt.countDocuments({ attemptId: { $regex: /BIMBEL-P1P9/ } }), idField: 'attemptId' };
  report['ClassTaskQuestion'] = { count: await ClassTaskQuestion.countDocuments({ questionId: { $regex: /BIMBEL-P1P9/ } }), idField: 'questionId' };

  console.log('--- VALIDASI DATABASE P1-P9 BARU ---');
  for (const [col, info] of Object.entries(report)) {
    console.log(`${col} -> ${info.count} documents (matches /BIMBEL-P1P9/ on ${info.idField})`);
  }
  
  // Validasi attempt P1-P9
  const sampleAttempt = await StudentTaskAttempt.findOne({ attemptId: { $regex: /BIMBEL-P1P9/ } });
  if (sampleAttempt) {
    console.log(`\nSample Attempt: ${sampleAttempt.attemptId}`);
    console.log(`Jumlah answers: ${sampleAttempt.answers.length}`);
    
    if (sampleAttempt.answers.length > 0) {
      const qIds = sampleAttempt.answers.map(a => a.questionId);
      console.log(`Contoh questionId: ${qIds[0]}`);
      
      const inBank = await QuestionBank.countDocuments({ questionId: { $in: qIds } });
      const inCtq = await ClassTaskQuestion.countDocuments({ questionId: { $in: qIds } });
      
      console.log(`- Ditemukan di QuestionBank V6: ${inBank} dari ${qIds.length}`);
      console.log(`- Ditemukan di ClassTaskQuestion: ${inCtq}`);
    }
  } else {
    console.log('Tidak ada attempt P1-P9.');
  }

  process.exit(0);
}
mapP1P9().catch(console.error);
