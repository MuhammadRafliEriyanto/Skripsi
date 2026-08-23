import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { User } from "../models/User";
import { Student } from "../models/Student";
import { getNextPublicId } from "../utils/publicId";
import { buildImportedStudentEmail } from "../utils/studentImport";
import { buildGeneratedPasswordForStudent } from "../utils/studentPassword";

dotenv.config();

const studentsToInsert = [
  {
    name: "Faizur Lutfiahtul Saadiah",
    className: "SD 2",
    branch: "Slawi",
    program: "SD N 1 Dukuwaru"
  },
  {
    name: "Adreena Nauvika M",
    className: "SD 3",
    branch: "Slawi",
    program: "SD Madinah Slawi"
  },
  {
    name: "Khanza Adifa",
    className: "SD 3",
    branch: "Slawi",
    program: "MI IT Lukman Al Hakim"
  },
  {
    name: "Daffa Ibnu Hafidz",
    className: "SD 3",
    branch: "Adiwerna",
    program: "SDN Tembok Banjaran 04"
  }
];

async function run() {
  await mongoose.connect(process.env.MONGO_URI as string);
  console.log("Connected to MongoDB.");

  let successCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const stu of studentsToInsert) {
    try {
      // Check duplicate
      const existingUserByName = await User.findOne({ nama: stu.name, role: "siswa" }).exec();
      if (existingUserByName) {
        console.log(`[SKIPPED] ${stu.name} sudah ada.`);
        skippedCount++;
        continue;
      }

      const studentId = await getNextPublicId(Student, "studentId", "STD");
      const email = buildImportedStudentEmail(studentId);
      
      const existingUserByEmail = await User.findOne({ email }).exec();
      if (existingUserByEmail) {
        console.log(`[SKIPPED] Email ${email} sudah dipakai.`);
        skippedCount++;
        continue;
      }

      const generatedPassword = buildGeneratedPasswordForStudent({ studentId });
      const hashedPassword = await bcrypt.hash(generatedPassword, 12);

      const createdUser = await User.create({
        nama: stu.name,
        email: email,
        password: hashedPassword,
        role: "siswa",
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      });

      await Student.create({
        studentId: studentId,
        userId: createdUser._id,
        phone: "",
        branch: stu.branch,
        program: stu.program,
        className: stu.className,
        birthDate: null,
        status: "Aktif",
      });

      console.log(`[SUCCESS] Inserted ${stu.name} (${stu.className}) - ${email}`);
      successCount++;
    } catch (err: any) {
      console.log(`[ERROR] Failed to insert ${stu.name}: ${err.message}`);
      errorCount++;
    }
  }

  console.log(`\n--- SUMMARY ---`);
  console.log(`Total Berhasil: ${successCount}`);
  console.log(`Total Dilewati/Duplikat: ${skippedCount}`);
  console.log(`Total Gagal: ${errorCount}`);

  await mongoose.disconnect();
}

run().catch(console.error);
