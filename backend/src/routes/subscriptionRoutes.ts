import { Router } from "express";

import {
  createMySubscriptionRenewal,
  getMySubscriptionPayments,
  getSubscriptionConfig,
  getMySubscriptionStatus,
  registerOnline,
} from "../controllers/subscriptionController";
import apiKeyMiddleware from "../middleware/apiKeyMiddleware";
import protect from "../middleware/protect";
import { authRegisterRateLimit } from "../middleware/rateLimit";

const router = Router();

router.use(apiKeyMiddleware);

router.get("/config", getSubscriptionConfig);
router.post("/register-online", authRegisterRateLimit, registerOnline);
router.get("/me/payments", protect, getMySubscriptionPayments);
router.post("/me/renewal", protect, createMySubscriptionRenewal);
router.get("/me", protect, getMySubscriptionStatus);

export default router;
