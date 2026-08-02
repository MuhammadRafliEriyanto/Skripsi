import mongoose from "mongoose";
import dotenv from "dotenv";
import { StudentTryoutAttempt } from "../models/StudentTryoutAttempt";
import { TeacherTryout } from "../models/TeacherTryout";
import { AcademicGrade } from "../models/AcademicGrade";
import { getAcademicGradeScheme } from "../utils/academicGrade";
import { getCurrentAcademicPeriod } from "../utils/academicGrade";
function normalizeText(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI as string);
  console.log("Connected to MongoDB.");

  // Cari semua attempt yang sudah submitted tapi belum masuk ke AcademicGrade
  const attempts = await StudentTryoutAttempt.find({ status: "submitted" }).exec();
  let updatedCount = 0;

  for (const attempt of attempts) {
    if (typeof attempt.score !== "number") continue;

    const tryout = await TeacherTryout.findOne({ tryoutId: attempt.tryoutId }).exec();
    if (!tryout) continue;

    const classId = normalizeText(tryout.classId);
    if (!classId) continue;

    const assessmentType = tryout.assessmentType ?? "Tryout";
    let resolvedStage = tryout.stage;
    if (resolvedStage !== 1 && resolvedStage !== 2 && resolvedStage !== 3) {
      const match = tryout.title.match(/\b([123])\b/);
      resolvedStage = match ? Number(match[1]) : 1;
    }

    let scoreKey = "";
    if (assessmentType === "Tryout") {
      scoreKey = `tryout${resolvedStage}`;
    } else if (assessmentType.startsWith("UTS ")) {
      scoreKey = assessmentType.toLowerCase().replace(" ", "");
    } else {
      scoreKey = assessmentType.toLowerCase();
    }

    const period = getCurrentAcademicPeriod();
    const studentId = normalizeText(attempt.studentId);
    const className = normalizeText(tryout.canonicalClassName) || normalizeText(tryout.kelas);
    const scheme = getAcademicGradeScheme(className);

    const result = await AcademicGrade.updateOne(
      {
        teacherId: tryout.teacherId,
        classId,
        studentId,
        academicYear: period.academicYear,
        semester: period.semester,
      },
      {
        $set: {
          scheme,
          [scoreKey]: attempt.score,
          evaluatedAt: attempt.submittedAt || new Date(),
        },
        $setOnInsert: {
          academicGradeId: `ACG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        }
      },
      { upsert: true }
    );
    if (result.upsertedCount > 0 || result.modifiedCount > 0) {
      updatedCount++;
    }
  }

  console.log(`Successfully synced ${updatedCount} grades from attempts.`);
  await mongoose.disconnect();
}

run().catch(console.error);
