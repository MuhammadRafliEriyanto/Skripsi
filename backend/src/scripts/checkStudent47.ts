import mongoose from "mongoose";
import { validateEnv } from "../config/env";
import { Student } from "../models/Student";
import { User } from "../models/User";
import { Subscription } from "../models/Subscription";
import { Payment } from "../models/Payment";
import { AcademicGrade } from "../models/AcademicGrade";
import { TaskSubmission } from "../models/TaskSubmission";
import { StudentTryoutAttempt } from "../models/StudentTryoutAttempt";
import { Teacher } from "../models/Teacher";

async function checkData() {
  const envConfig = validateEnv();
  const uri = envConfig.mongoUri;
  if (!uri) throw new Error("MONGO_URI is not set.");
  
  await mongoose.connect(uri);
  console.log("Connected to MongoDB.");

  // 1. Check Teacher TCH-001
  const teacher = await Teacher.findOne({ teacherId: { $regex: /001$/ } }).exec();
  console.log("\n--- Teacher 001 ---");
  console.log(teacher ? `Found: ${teacher.teacherId} (User ID: ${teacher.userId})` : "Not found");

  // 2. Check Student STD-047
  const student = await Student.findOne({ studentId: { $regex: /047$/ } }).exec();
  console.log("\n--- Student 047 ---");
  if (!student) {
    console.log("Student 047 not found.");
    process.exit(0);
  }
  
  console.log(`Student ID: ${student.studentId}`);
  console.log(`Program: ${student.program}, Class: ${student.className}, Branch: ${student.branch}`);
  const user = await User.findById(student.userId).exec();
  console.log(`User: ${user?.nama} (${user?.email}), Role: ${user?.role}`);

  // 3. Check Subscriptions
  const subscriptions = await Subscription.find({ studentId: student._id }).exec();
  console.log(`\n--- Subscriptions (${subscriptions.length}) ---`);
  subscriptions.forEach(sub => {
    console.log(`- ${sub.subscriptionCode}: ${sub.packageName} [Status: ${sub.status}, Payment: ${sub.paymentStatus}]`);
  });

  // 4. Check Academic Grades related to TCH-001
  let gradeQuery: any = { studentId: student.studentId };
  if (teacher) {
    gradeQuery.teacherId = teacher._id;
  }
  const grades = await AcademicGrade.find(gradeQuery).exec();
  console.log(`\n--- Academic Grades (${grades.length}) ---`);
  grades.forEach(g => {
    console.log(`- Class ${g.classId} (${g.semester} ${g.academicYear}): UTS=${g.uts}, UAS=${g.uas}, T1=${g.tryout1} [Teacher: ${g.teacherId}]`);
  });

  // 5. Check Task Submissions
  const submissions = await TaskSubmission.find({ studentId: student._id }).exec();
  console.log(`\n--- Task Submissions (${submissions.length}) ---`);
  const taskIds = submissions.map(s => s.taskId.toString());
  const uniqueTaskIds = new Set(taskIds);
  console.log(`Total Submissions: ${submissions.length}, Unique Tasks: ${uniqueTaskIds.size}`);
  if (submissions.length > uniqueTaskIds.size) {
    console.log("⚠️ WARNING: There are duplicate task submissions for the same task!");
  }

  // 6. Check Tryout Attempts
  const attempts = await StudentTryoutAttempt.find({ studentId: student.studentId }).exec();
  console.log(`\n--- Tryout Attempts (${attempts.length}) ---`);
  const tryoutIds = attempts.map(a => a.tryoutId.toString());
  const uniqueTryoutIds = new Set(tryoutIds);
  console.log(`Total Attempts: ${attempts.length}, Unique Tryouts: ${uniqueTryoutIds.size}`);
  if (attempts.length > uniqueTryoutIds.size) {
    console.log("⚠️ WARNING: There are duplicate tryout attempts for the same tryout!");
  }

  await mongoose.disconnect();
}

checkData().catch(console.error);
