import { Router } from "express";

import {
  createMyStudentTaskSubmission,
  downloadMyStudentMaterialAttachment,
  downloadMyStudentTaskSubmissionAttachment,
  downloadMyStudentTaskAttachment,
  getMyStudentTaskSubmission,
  getMyStudentDashboardData,
  getMyStudentLearningData,
  updateMyStudentMaterialProgress,
  updateMyStudentTaskSubmission,
  deleteMyStudentTaskSubmission,
} from "../controllers/studentLearningController";
import {
  getStudentClassTaskCbtSession,
  startStudentClassTaskCbt,
  submitStudentClassTaskCbt,
} from "../controllers/studentTaskCbtController";
import {
  getMyStudentAcademicHistory,
  getMyStudentAcademicHistoryDetail,
} from "../controllers/academicHistoryController";
import { getMyStudentNotifications } from "../controllers/studentNotificationController";
import {
  getMyStudentExamAttempt,
  getMyStudentTryoutDetail,
  getMyStudentTryouts,
  startMyStudentExam,
  submitMyStudentExamAttempt,
  submitMyStudentTryout,
} from "../controllers/studentTryoutController";
import apiKeyMiddleware from "../middleware/apiKeyMiddleware";
import authorizeRole from "../middleware/authorizeRole";
import protect from "../middleware/protect";

const router = Router();

router.use(apiKeyMiddleware, protect, authorizeRole("siswa"));

router.get("/me/dashboard", getMyStudentDashboardData);
router.get("/me/notifications", getMyStudentNotifications);
router.get("/me/academic-history", getMyStudentAcademicHistory);
router.get(
  "/me/academic-history/:subscriptionId",
  getMyStudentAcademicHistoryDetail,
);
router.get("/me/learning", getMyStudentLearningData);
router.post(
  "/me/learning/materials/:materialId/progress",
  updateMyStudentMaterialProgress,
);
router.get("/me/tryouts", getMyStudentTryouts);
router.post("/me/exams/:tryoutId/start", startMyStudentExam);
router.get("/me/exam-attempts/:attemptId", getMyStudentExamAttempt);
router.post(
  "/me/exam-attempts/:attemptId/submission",
  submitMyStudentExamAttempt,
);
router.get("/me/tryouts/:tryoutId", getMyStudentTryoutDetail);
router.post("/me/tryouts/:tryoutId/submission", submitMyStudentTryout);
router.post("/me/learning/tasks/:taskId/cbt/start", startStudentClassTaskCbt);
router.get("/me/learning/tasks/cbt/:attemptId", getStudentClassTaskCbtSession);
router.post(
  "/me/learning/tasks/cbt/:attemptId/submission",
  submitStudentClassTaskCbt,
);
router
  .route("/me/learning/tasks/:taskId/submission")
  .get(getMyStudentTaskSubmission)
  .post(createMyStudentTaskSubmission)
  .patch(updateMyStudentTaskSubmission)
  .delete(deleteMyStudentTaskSubmission);
router.get(
  "/me/learning/tasks/:taskId/submission/attachment",
  downloadMyStudentTaskSubmissionAttachment,
);
router.get(
  "/me/learning/materials/:materialId/attachment",
  downloadMyStudentMaterialAttachment,
);
router.get(
  "/me/learning/tasks/:taskId/attachment",
  downloadMyStudentTaskAttachment,
);

export default router;
