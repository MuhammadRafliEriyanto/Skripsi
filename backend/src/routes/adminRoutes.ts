import { Router } from "express";

import {
  getAdminAcademicMonitoring,
  getAdminDashboardConfigData,
  getAdminUtbkAssessments,
} from "../controllers/adminController";
import apiKeyMiddleware from "../middleware/apiKeyMiddleware";
import authorizeRole from "../middleware/authorizeRole";
import protect from "../middleware/protect";

const router = Router();

router.use(apiKeyMiddleware, protect, authorizeRole("admin", "owner"));

router.get("/dashboard-config", getAdminDashboardConfigData);
router.get("/academic-monitoring", getAdminAcademicMonitoring);
router.get("/utbk-assessments", getAdminUtbkAssessments);

export default router;
