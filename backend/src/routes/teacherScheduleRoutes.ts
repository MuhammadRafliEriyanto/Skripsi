import { Router } from "express";

import { getMyTeacherDashboard } from "../controllers/teacherDashboardController";
import {
  getTeacherStudentAcademicHistory,
  getTeacherStudentAcademicHistoryDetail,
} from "../controllers/academicHistoryController";
import { upsertTeacherClassAcademicGrade } from "../controllers/teacherAcademicGradeController";
import { getMyTeacherNotifications } from "../controllers/teacherNotificationController";
import {
  createTeacherClassGrade,
  getTeacherClassGrades,
  updateTeacherClassGrade,
} from "../controllers/teacherGradeController";
import { updateTeacherClassSetting } from "../controllers/teacherClassSettingController";
import {
  closeTeacherAttendanceSession,
  createOrGetTeacherAttendanceSession,
  getTeacherAttendanceSession,
  updateTeacherAttendanceRecord,
} from "../controllers/teacherAttendanceController";
import {
  createTeacherClassMaterial,
  createTeacherClassTask,
  deleteTeacherClassMaterial,
  deleteTeacherClassTask,
  downloadTeacherClassMaterialAttachment,
  downloadTeacherClassTaskAttachment,
  updateTeacherClassMaterial,
  updateTeacherClassTask,
} from "../controllers/teacherLearningController";
import {
  downloadTeacherTaskSubmissionAttachment,
  getTeacherTaskSubmissionDetail,
  getTeacherTaskSubmissions,
} from "../controllers/teacherTaskSubmissionController";
import {
  getMyTeacherClasses,
  getMyTeacherClassDetail,
  getMyTeacherSchedules,
} from "../controllers/teacherScheduleController";
import apiKeyMiddleware from "../middleware/apiKeyMiddleware";
import authorizeRole from "../middleware/authorizeRole";
import protect from "../middleware/protect";

const router = Router();

router.use(apiKeyMiddleware, protect, authorizeRole("guru"));

router.get("/me/dashboard", getMyTeacherDashboard);
router.get("/me/notifications", getMyTeacherNotifications);
router.get(
  "/students/:studentId/academic-history",
  getTeacherStudentAcademicHistory,
);
router.get(
  "/students/:studentId/academic-history/:subscriptionId",
  getTeacherStudentAcademicHistoryDetail,
);
router.get("/me/classes", getMyTeacherClasses);
router.get("/me/classes/:classId", getMyTeacherClassDetail);
router
  .route("/me/classes/:classId/attendance/session")
  .get(getTeacherAttendanceSession)
  .post(createOrGetTeacherAttendanceSession);
router.patch("/me/attendance/records/:recordId", updateTeacherAttendanceRecord);
router.patch(
  "/me/attendance/session/:sessionId/close",
  closeTeacherAttendanceSession,
);
router.post("/me/classes/:classId/materials", createTeacherClassMaterial);
router.patch(
  "/me/classes/:classId/materials/:materialId",
  updateTeacherClassMaterial,
);
router.get(
  "/me/classes/:classId/materials/:materialId/attachment",
  downloadTeacherClassMaterialAttachment,
);
router.delete(
  "/me/classes/:classId/materials/:materialId",
  deleteTeacherClassMaterial,
);
router.post("/me/classes/:classId/tasks", createTeacherClassTask);
router.patch("/me/classes/:classId/tasks/:taskId", updateTeacherClassTask);
router.patch("/me/classes/:classId/settings", updateTeacherClassSetting);
router.get(
  "/me/classes/:classId/tasks/:taskId/attachment",
  downloadTeacherClassTaskAttachment,
);
router.get(
  "/me/classes/:classId/tasks/:taskId/submissions",
  getTeacherTaskSubmissions,
);
router.get(
  "/me/classes/:classId/tasks/:taskId/submissions/:submissionId",
  getTeacherTaskSubmissionDetail,
);
router.get(
  "/me/classes/:classId/tasks/:taskId/submissions/:submissionId/attachment",
  downloadTeacherTaskSubmissionAttachment,
);
router.delete("/me/classes/:classId/tasks/:taskId", deleteTeacherClassTask);
router.get("/me/classes/:classId/grades", getTeacherClassGrades);
router.post("/me/classes/:classId/grades", createTeacherClassGrade);
router.patch("/me/classes/:classId/grades/:gradeId", updateTeacherClassGrade);
router.put(
  "/me/classes/:classId/academic-grades/:studentId",
  upsertTeacherClassAcademicGrade,
);
router.get("/me/schedules", getMyTeacherSchedules);

export default router;
