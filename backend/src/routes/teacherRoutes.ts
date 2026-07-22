import { Router } from "express";

import {
  createTeacher,
  deleteTeacher,
  exportTeachers,
  getTeacherById,
  getTeachers,
  importTeachers,
  updateTeacher,
} from "../controllers/teacherController";
import apiKeyMiddleware from "../middleware/apiKeyMiddleware";
import authorizeRole from "../middleware/authorizeRole";
import protect from "../middleware/protect";

const router = Router();

router.use(apiKeyMiddleware, protect, authorizeRole("admin"));

router.route("/").get(getTeachers).post(createTeacher);
router.route("/export").get(exportTeachers);
router.route("/import").post(importTeachers);
router.route("/:id").get(getTeacherById).put(updateTeacher).delete(deleteTeacher);

export default router;
