import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { StudentTaskAttempt } from '../models/StudentTaskAttempt';
import { QuestionBank } from '../models/QuestionBank';
import { ClassTaskQuestion } from '../models/ClassTaskQuestion';

dotenv.config();

async function check() {
  await mongoose.connect(process.env.MONGO_URI as string);
  
  // 1. Attempt lama yang masih memakai questionId lama
  const oldAttempt = await StudentTaskAttempt.findOne({ 'answers.questionId': { $regex: /^CTQ-/i } });
  if (oldAttempt) {
    const questionIds = oldAttempt.answers.map(a => a.questionId);
    const bankQs = await QuestionBank.find({ questionId: { $in: questionIds } }).lean().exec();
    const classQs = await ClassTaskQuestion.find({ questionId: { $in: questionIds } }).lean().exec();
    
    // Logic from getAttemptQuestions
    const questionsById = new Map([...classQs, ...bankQs].map(q => [q.questionId, q]));
    const questions = questionIds.map(id => questionsById.get(id)).filter(Boolean);
    
    console.log('--- ATTEMPT LAMA (P1-P9) ---');
    console.log('Attempt ID:', oldAttempt.attemptId);
    console.log('Answers length:', oldAttempt.answers.length);
    console.log('Returned questions from API logic:', questions.length);
    if (questions.length > 0) {
      console.log('Source of question #1:', bankQs.some(b => b.questionId === questions[0]?.questionId) ? 'QuestionBank' : 'ClassTaskQuestion');
    }
  } else {
    console.log('Tidak ditemukan attempt lama dengan CTQ-.');
  }

  // 2. Attempt baru yang memakai questionId QuestionBank V6
  const sampleV6 = await QuestionBank.aggregate([{ $sample: { size: 30 } }]);
  const v6Ids = sampleV6.map(q => q.questionId);
  
  const bankQs2 = await QuestionBank.find({ questionId: { $in: v6Ids } }).lean().exec();
  const classQs2 = await ClassTaskQuestion.find({ questionId: { $in: v6Ids } }).lean().exec();
  
  const questionsById2 = new Map([...classQs2, ...bankQs2].map(q => [q.questionId, q]));
  const questions2 = v6Ids.map(id => questionsById2.get(id)).filter(Boolean);
  
  console.log('--- ATTEMPT BARU (Simulasi dengan V6 IDs) ---');
  console.log('Simulated Answers length:', v6Ids.length);
  console.log('Returned questions from API logic:', questions2.length);
  if (questions2.length > 0) {
    console.log('Source of question #1:', bankQs2.some(b => b.questionId === questions2[0]?.questionId) ? 'QuestionBank' : 'ClassTaskQuestion');
  }
  
  process.exit(0);
}
check().catch(console.error);
