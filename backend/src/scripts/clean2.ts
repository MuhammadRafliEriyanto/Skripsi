import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { StudentTaskAttempt } from '../models/StudentTaskAttempt';

dotenv.config();

async function clean() {
  await mongoose.connect(process.env.MONGO_URI as string);
  const res = await StudentTaskAttempt.deleteMany({ attemptId: { $regex: /BIMBEL-P1P9/ }, 'answers.questionId': { $regex: /^CTQ-/i } });
  console.log('Deleted orphaned P1-P9 attempts with old CTQ IDs:', res.deletedCount);
  process.exit(0);
}
clean().catch(console.error);
