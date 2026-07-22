import { Router } from "express";

import {
  createSchedule,
  deleteSchedule,
  exportSchedules,
  getScheduleById,
  getSchedules,
  importSchedules,
  updateSchedule,
} from "../controllers/scheduleController";
import apiKeyMiddleware from "../middleware/apiKeyMiddleware";
import authorizeRole from "../middleware/authorizeRole";
import protect from "../middleware/protect";

const router = Router();

router.use(apiKeyMiddleware, protect, authorizeRole("admin"));

router.route("/").get(getSchedules).post(createSchedule);
router.route("/export").get(exportSchedules);
router.route("/import").post(importSchedules);
router.route("/:id").get(getScheduleById).put(updateSchedule).delete(deleteSchedule);

export default router;
