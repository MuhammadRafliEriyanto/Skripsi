import { Router } from "express";

import {
  createStudent,
  deleteStudent,
  exportStudents,
  getStudentById,
  getStudents,
  importStudents,
  resetStudentPassword,
  updateStudent,
  resendStudentVerification,
} from "../controllers/studentController";
import apiKeyMiddleware from "../middleware/apiKeyMiddleware";
import authorizeRole from "../middleware/authorizeRole";
import protect from "../middleware/protect";

const router = Router();

router.use(apiKeyMiddleware, protect, authorizeRole("admin"));

router.route("/").get(getStudents).post(createStudent);
router.route("/export").get(exportStudents);
router.route("/import").post(importStudents);
router.route("/:id/reset-password").post(resetStudentPassword);
router.route("/:id/resend-verification").post(resendStudentVerification);
router.route("/:id").get(getStudentById).put(updateStudent).delete(deleteStudent);

export default router;
