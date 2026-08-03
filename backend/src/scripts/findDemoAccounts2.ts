import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

const studentSchema = new mongoose.Schema({}, { strict: false });
const teacherSchema = new mongoose.Schema({}, { strict: false });
const userSchema = new mongoose.Schema({}, { strict: false });

const Student = mongoose.models.Student || mongoose.model("Student", studentSchema, "students");
const Teacher = mongoose.models.Teacher || mongoose.model("Teacher", teacherSchema, "teachers");
const User = mongoose.models.User || mongoose.model("User", userSchema, "users");

dotenv.config({ path: path.join(__dirname, "../../.env") });

async function findDemoAccounts() {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    console.log("Connected to DB");

    // Fetch some teachers and their users
    const teachers = await Teacher.find({ status: "Aktif" }).lean();
    for (let i = 0; i < Math.min(3, teachers.length); i++) {
        const t: any = teachers[i];
        const user: any = await User.findById(t.userId);
        console.log(`GURU: ${user?.nama} | Email: ${user?.email}`);
    }

    // Fetch UTBK students
    const students = await Student.find({ status: "Aktif" }).lean();
    let utbkCount = 0;
    for (let i = 0; i < students.length; i++) {
        const s: any = students[i];
        const user: any = await User.findById(s.userId);
        if (s.program && (s.program.toLowerCase().includes("utbk") || s.program.toLowerCase().includes("snbt"))) {
             console.log(`SISWA UTBK: ${user?.nama} | Email: ${user?.email} | Program: ${s.program}`);
             utbkCount++;
             if (utbkCount >= 2) break;
        }
    }
    
    // Fetch Regular students
    let regCount = 0;
    for (let i = 0; i < students.length; i++) {
        const s: any = students[i];
        const user: any = await User.findById(s.userId);
        if (s.program && !s.program.toLowerCase().includes("utbk") && !s.program.toLowerCase().includes("snbt")) {
             console.log(`SISWA REGULER: ${user?.nama} | Email: ${user?.email} | Program: ${s.program}`);
             regCount++;
             if (regCount >= 2) break;
        }
    }

    // Renewal membership usually relies on `membershipExpiresAt` or similar. Since the user asked about renewing membership:
    console.log("\nUNTUK DEMO PERPANJANG MEMBERSHIP:");
    console.log("Siswa manapun bisa digunakan untuk mendemonstrasikan ini, disarankan menggunakan salah satu akun siswa reguler yang ditampilkan di atas, karena jika masa aktif atau paket habis, tombol perpanjang biasanya akan muncul di dashboard mereka.");

  } catch (error) {
    console.error("Error:", error);
  } finally {
    mongoose.disconnect();
  }
}

findDemoAccounts();
