import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { StudentTaskAttempt } from '../models/StudentTaskAttempt';

dotenv.config();

async function check() {
  await mongoose.connect(process.env.MONGO_URI as string);
  
  const attempts = await StudentTaskAttempt.find({ attemptId: { $regex: /BIMBEL-P1P9/ } });
  
  let qbCount = 0;
  let ctqCount = 0;
  for (const att of attempts) {
    if (att.answers && att.answers.length > 0) {
      if (att.answers[0].questionId.startsWith('CTQ')) {
        ctqCount++;
      } else {
        qbCount++;
      }
    }
  }
  
  console.log('Total P1-P9 attempts:', attempts.length);
  console.log('Attempts with old CTQ IDs:', ctqCount);
  console.log('Attempts with new QuestionBank IDs:', qbCount);
  process.exit(0);
}
check().catch(console.error);
