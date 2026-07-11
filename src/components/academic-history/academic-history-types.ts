export type AcademicHistoryStudent = {
  id?: string;
  studentId?: string;
  program?: string;
  className?: string;
  branch?: string;
  status?: string;
};

export type AcademicHistorySubscription = {
  subscriptionId: string;
  academicYear: string;
  semester: string;
  program: string;
  className: string;
  startDate: string | null;
  endDate: string | null;
  subscriptionCode?: string;
  packageName?: string;
  status?: string;
  paymentStatus?: string;
  academicPeriods?: Array<{
    academicYear: string;
    semester: string;
  }>;
};

export type AcademicHistoryListData = {
  student?: AcademicHistoryStudent;
  subscriptions?: AcademicHistorySubscription[];
};

export type AcademicScores = {
  uts?: number | null;
  uas?: number | null;
  uts1?: number | null;
  uts2?: number | null;
  uts3?: number | null;
  tryout1?: number | null;
  tryout2?: number | null;
  tryout3?: number | null;
};

export type AcademicHistoryAcademicGrade = {
  academicGradeId?: string;
  classId?: string;
  studentId?: string;
  subscriptionId?: string | null;
  academicYear?: string;
  semester?: string;
  scheme?: string;
  scores?: AcademicScores;
  note?: string;
  evaluatedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type AcademicHistoryTaskGrade = {
  id?: string;
  gradeId?: string;
  classId?: string;
  taskId?: string;
  studentId?: string;
  subscriptionId?: string | null;
  score?: number | null;
  note?: string;
  status?: string;
  gradedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type AcademicHistoryAttendanceRecord = {
  id?: string;
  recordId?: string;
  sessionId?: string;
  subscriptionId?: string | null;
  date?: string;
  startTime?: string;
  subject?: string;
  classId?: string;
  className?: string;
  branch?: string;
  room?: string;
  status?: string;
  sessionStatus?: string;
  markedBy?: string;
  note?: string;
  markedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type AcademicHistoryTaskSubmission = {
  id?: string;
  submissionId?: string;
  classId?: string;
  taskId?: string;
  studentId?: string;
  subscriptionId?: string | null;
  submissionMode?: string;
  answerText?: string;
  driveUrl?: string;
  note?: string;
  attachment?: {
    fileName?: string;
    originalName?: string;
    mimeType?: string;
    size?: number;
  } | null;
  submittedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type AcademicHistoryTask = {
  id?: string;
  taskId?: string;
  classId?: string;
  className?: string;
  subject?: string;
  branch?: string;
  room?: string;
  meetingNumber?: number;
  title?: string;
  description?: string;
  deadline?: string;
  attachment?: {
    fileName?: string;
    mimeType?: string;
    size?: number;
  } | null;
  submittedCount?: number;
  gradedCount?: number;
  reviewStatus?: string;
  mySubmission?: AcademicHistoryTaskSubmission | null;
  myGrade?: AcademicHistoryTaskGrade | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type AcademicHistoryTryoutAttempt = {
  submitted?: boolean;
  id?: string;
  attemptId?: string | null;
  subscriptionId?: string | null;
  status?: string | null;
  score?: number | null;
  correctCount?: number | null;
  wrongCount?: number | null;
  unansweredCount?: number | null;
  timeUsedSeconds?: number | null;
  startedAt?: string | null;
  submittedAt?: string | null;
};

export type AcademicHistoryTryout = {
  id?: string;
  tryoutId?: string;
  classId?: string;
  branch?: string;
  canonicalClassName?: string;
  assessmentType?: string;
  title?: string;
  jenjang?: string;
  kelas?: string;
  subject?: string;
  stage?: number | null;
  durationMinutes?: number;
  startAt?: string | null;
  endAt?: string | null;
  publishStatus?: string;
  reviewStatus?: string;
  questionSource?: string;
  questionCount?: number;
  academicYear?: string | null;
  semester?: string | null;
  myAttempt?: AcademicHistoryTryoutAttempt;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type AcademicHistoryDetailData = {
  subscription?: AcademicHistorySubscription;
  student?: AcademicHistoryStudent;
  grades?: {
    academicGrades?: AcademicHistoryAcademicGrade[];
    taskGrades?: AcademicHistoryTaskGrade[];
  };
  attendance?: {
    records?: AcademicHistoryAttendanceRecord[];
  };
  tasks?: AcademicHistoryTask[];
  taskSubmissions?: AcademicHistoryTaskSubmission[];
  tryouts?: AcademicHistoryTryout[];
  fallback?: {
    legacyRecords?: string;
  };
};

export type AcademicHistoryApiResponse<T> = {
  success: boolean;
  message?: string;
  data?: T;
};
