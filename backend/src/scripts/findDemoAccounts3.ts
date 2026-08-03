import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

const studentSchema = new mongoose.Schema({}, { strict: false });
const userSchema = new mongoose.Schema({}, { strict: false });

const Student = mongoose.models.Student || mongoose.model("Student", studentSchema, "students");
const User = mongoose.models.User || mongoose.model("User", userSchema, "users");

dotenv.config({ path: path.join(__dirname, "../../.env") });

async function findDemoAccounts() {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    console.log("Connected to DB");

    // Fetch UTBK students
    const utbkStudents = await Student.find({ status: "Aktif", program: { $regex: /utbk|snbt/i } }).limit(2).lean();
    console.log("--- SISWA UTBK ---");
    for (let s of utbkStudents as any[]) {
        const u = await User.findById(s.userId).lean() as any;
        console.log(`Siswa UTBK: ${u?.nama} | Email: ${u?.email} | Program: ${s.program}`);
    }

    const regStudents = await Student.find({ status: "Aktif", program: { $not: { $regex: /utbk|snbt/i } } }).limit(2).lean();
    console.log("--- SISWA REGULER ---");
    for (let s of regStudents as any[]) {
        const u = await User.findById(s.userId).lean() as any;
        console.log(`Siswa Reguler: ${u?.nama} | Email: ${u?.email} | Program: ${s.program}`);
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    mongoose.disconnect();
  }
}

findDemoAccounts();
