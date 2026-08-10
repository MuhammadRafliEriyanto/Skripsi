import { type StudentDocument } from "../models/Student";
import {
  getAcademicPeriodForYear,
  type AcademicPeriod,
} from "./academicGrade";

type StudentAcademicContentAccess = {
  isUpcomingClassLocked: boolean;
  period: AcademicPeriod;
  startsAt: string | null;
  className: string;
  message: string | null;
};

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

export async function resolveStudentAcademicContentAccess(
  student: StudentDocument,
  date = new Date(),
): Promise<StudentAcademicContentAccess> {
  const studentAcademicPeriod = getAcademicPeriodForYear(null, date);
  const className = normalizeText(student.className);

  return {
    isUpcomingClassLocked: false,
    period: studentAcademicPeriod,
    startsAt: null,
    className,
    message: null,
  };
}
