import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

// Quick schema
const studentSchema = new mongoose.Schema({}, { strict: false });
const teacherSchema = new mongoose.Schema({}, { strict: false });

const Student = mongoose.models.Student || mongoose.model("Student", studentSchema, "students");
const Teacher = mongoose.models.Teacher || mongoose.model("Teacher", teacherSchema, "teachers");

dotenv.config({ path: "D:/Skripsi/Next Js/bimbel-new/backend/.env" });

async function findDemoAccounts() {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    console.log("Connected to DB");

    const teachers = await Teacher.find({ status: "Aktif" }).lean();
    
    const topTeachers = teachers
      .filter((t: any) => t.students && t.students.length > 0)
      .sort((a: any, b: any) => (b.students?.length || 0) - (a.students?.length || 0))
      .slice(0, 3);

    console.log("\n--- REKOMENDASI AKUN GURU ---");
    topTeachers.forEach((t: any) => {
      console.log(`Nama: ${t.name}`);
      console.log(`Email: ${t.email}`);
      console.log(`Jumlah Siswa: ${t.students?.length || 0}`);
      console.log(`Mata Pelajaran: ${t.subjects?.join(", ") || "-"}`);
      console.log("------------------------");
    });

    const students = await Student.find({}).lean();
    
    // Manual populate for demo purposes or just log the ID
    const utbk = students.filter((s: any) => {
      return s.status === "Aktif";
    }).slice(0, 2);

    console.log("\n--- REKOMENDASI AKUN SISWA ---");
    utbk.forEach((s: any) => {
      console.log(`Nama: ${s.name}`);
      console.log(`Email: ${s.email}`);
      console.log(`Program ID: ${s.programId || "-"}`);
      console.log("------------------------");
    });



    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const forRenewal = students.filter((s: any) => {
      if (!s.membershipExpiresAt) return true;
      const expiry = new Date(s.membershipExpiresAt);
      return expiry <= thirtyDaysFromNow;
    }).slice(0, 3);

    console.log("\n--- REKOMENDASI AKUN SISWA UNTUK DEMO PERPANJANG MEMBERSHIP ---");
    forRenewal.forEach((s: any) => {
      console.log(`Nama: ${s.name}`);
      console.log(`Email: ${s.email}`);
      console.log(`Status: ${s.status}`);
      console.log(`Membership Expire: ${s.membershipExpiresAt ? new Date(s.membershipExpiresAt).toLocaleDateString() : "Belum di-set"}`);
      console.log("------------------------");
    });

  } catch (error) {
    console.error("Error:", error);
  } finally {
    mongoose.disconnect();
  }
}

findDemoAccounts();
