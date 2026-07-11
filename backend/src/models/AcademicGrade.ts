import { HydratedDocument, Model, Schema, model, models, type Types } from "mongoose";

export const ACADEMIC_GRADE_SCHEMES = ["semester", "tryout"] as const;
export const ACADEMIC_GRADE_SEMESTERS = ["Ganjil", "Genap"] as const;

export type AcademicGradeScheme = (typeof ACADEMIC_GRADE_SCHEMES)[number];
export type AcademicGradeSemester = (typeof ACADEMIC_GRADE_SEMESTERS)[number];

export interface IAcademicGrade {
  academicGradeId: string;
  teacherId: Types.ObjectId;
  classId: string;
  studentId: string;
  subscriptionId: Types.ObjectId | null;
  academicYear: string;
  semester: AcademicGradeSemester;
  scheme: AcademicGradeScheme;
  uts: number | null;
  uas: number | null;
  uts1: number | null;
  uts2: number | null;
  uts3: number | null;
  tryout1: number | null;
  tryout2: number | null;
  tryout3: number | null;
  note: string;
  evaluatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type AcademicGradeDocument = HydratedDocument<IAcademicGrade>;

const nullableScore = {
  type: Number,
  default: null,
  min: 0,
  max: 100,
};

const academicGradeSchema = new Schema<IAcademicGrade>(
  {
    academicGradeId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
      index: true,
    },
    classId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    studentId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: "Subscription",
      default: null,
    },
    academicYear: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    semester: {
      type: String,
      enum: ACADEMIC_GRADE_SEMESTERS,
      required: true,
      index: true,
    },
    scheme: {
      type: String,
      enum: ACADEMIC_GRADE_SCHEMES,
      required: true,
    },
    uts: nullableScore,
    uas: nullableScore,
    uts1: nullableScore,
    uts2: nullableScore,
    uts3: nullableScore,
    tryout1: nullableScore,
    tryout2: nullableScore,
    tryout3: nullableScore,
    note: {
      type: String,
      default: "",
      trim: true,
    },
    evaluatedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

academicGradeSchema.index(
  {
    teacherId: 1,
    classId: 1,
    studentId: 1,
    academicYear: 1,
    semester: 1,
  },
  {
    unique: true,
  },
);

export const AcademicGrade: Model<IAcademicGrade> =
  (models.AcademicGrade as Model<IAcademicGrade> | undefined) ??
  model<IAcademicGrade>("AcademicGrade", academicGradeSchema);
