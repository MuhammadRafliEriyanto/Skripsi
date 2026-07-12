import { Router } from "express";

import {
  changePassword,
  forgotPassword,
  getMe,
  login,
  loginWithGoogle,
  register,
  resetPassword,
  updateMe,
  verifyEmail,
} from "../controllers/authController";
import apiKeyMiddleware from "../middleware/apiKeyMiddleware";
import protect from "../middleware/protect";
import {
  authLoginRateLimit,
  authRegisterRateLimit,
  passwordResetRateLimit,
} from "../middleware/rateLimit";

const router = Router();

router.use(apiKeyMiddleware);

router.post("/register", authRegisterRateLimit, register);
router.post("/login", authLoginRateLimit, login);
router.post("/google", authLoginRateLimit, loginWithGoogle);
router.post("/forgot-password", passwordResetRateLimit, forgotPassword);
router.post("/reset-password", passwordResetRateLimit, resetPassword);
router.get("/verify-email/:token", verifyEmail);
router.route("/me").get(protect, getMe).put(protect, updateMe);
router.post("/change-password", protect, changePassword);

export default router;
