import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { ClassTaskQuestion } from '../models/ClassTaskQuestion';

dotenv.config();

async function clean() {
  await mongoose.connect(process.env.MONGO_URI as string);
  const res = await ClassTaskQuestion.deleteMany({ questionId: { $regex: /BIMBEL-P1P9/ } });
  console.log('Deleted orphaned ClassTaskQuestion dummy documents:', res.deletedCount);
  process.exit(0);
}
clean().catch(console.error);
