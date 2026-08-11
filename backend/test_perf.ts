import "dotenv/config";
import mongoose from "mongoose";
import { Student } from "./src/models/Student";
import { getMyStudentDashboardData, getMyStudentLearningData } from "./src/controllers/studentLearningController";

async function run() {
  await mongoose.connect(process.env.MONGO_URI as string);
  console.log("Connected to MongoDB");

  const student = await Student.findOne({ status: "Aktif" }).exec();
  if (!student) {
    console.log("No student found");
    process.exit(0);
  }

  // Mock Request and Response for express
  const req = {
    user: { _id: student._id },
    query: { academicYear: "2026/2027" }
  };
  const res = {
    status: (code: number) => res,
    json: (data: any) => data,
  };

  console.time("Dashboard");
  await getMyStudentDashboardData(req as any, res as any, () => {});
  console.timeEnd("Dashboard");

  console.time("Learning");
  await getMyStudentLearningData(req as any, res as any, () => {});
  console.timeEnd("Learning");
  
  process.exit(0);
}

run().catch(console.error);
