import { Router } from "express";

import {
  archiveAdminPayment,
  cancelAdminPayment,
  createAdminBatchPaymentSession,
  confirmDummyPayment,
  createAdminPaymentSession,
  createXenditTestSession,
  exportAdminPaymentActivations,
  exportAdminPayments,
  getAdminPaymentActivations,
  getAdminPaymentSummary,
  getAdminPayments,
  getOwnerActivities,
  getPaymentStatus,
  handleXenditPaymentWebhook,
  resendAdminPaymentLink,
  replaceAdminPayment,
  restoreAdminPayment,
  updateAdminPaymentStatus,
} from "../controllers/paymentController";
import apiKeyMiddleware from "../middleware/apiKeyMiddleware";
import authorizeRole from "../middleware/authorizeRole";
import protect from "../middleware/protect";
import {
  paymentStatusRateLimit,
  sensitiveActionRateLimit,
} from "../middleware/rateLimit";

const router = Router();

router.post("/xendit/webhook", handleXenditPaymentWebhook);

router.use(apiKeyMiddleware);

router.get("/owner-activities", protect, authorizeRole("admin", "owner"), getOwnerActivities);
router.get("/admin", protect, authorizeRole("admin"), getAdminPayments);
router.get("/admin/export", protect, authorizeRole("admin"), exportAdminPayments);
router.get("/admin/summary", protect, authorizeRole("admin"), getAdminPaymentSummary);
router.get("/admin/activations", protect, authorizeRole("admin"), getAdminPaymentActivations);
router.get(
  "/admin/activations/export",
  protect,
  authorizeRole("admin"),
  exportAdminPaymentActivations,
);
router.post(
  "/admin/create-session",
  protect,
  authorizeRole("admin"),
  createAdminPaymentSession,
);
router.post(
  "/admin/create-batch-session",
  protect,
  authorizeRole("admin"),
  createAdminBatchPaymentSession,
);
router.post(
  "/admin/:paymentId/resend-link",
  protect,
  authorizeRole("admin"),
  resendAdminPaymentLink,
);
router
  .route("/admin/:paymentId")
  .patch(protect, authorizeRole("admin"), replaceAdminPayment)
  .delete(protect, authorizeRole("admin"), archiveAdminPayment);
router.post(
  "/admin/:paymentId/restore",
  protect,
  authorizeRole("admin"),
  restoreAdminPayment,
);
router.patch(
  "/admin/:paymentId/status",
  protect,
  authorizeRole("admin"),
  updateAdminPaymentStatus,
);
router.post(
  "/admin/:paymentId/cancel",
  protect,
  authorizeRole("admin"),
  cancelAdminPayment,
);
router.get("/status", paymentStatusRateLimit, getPaymentStatus);
router.post("/confirm", sensitiveActionRateLimit, confirmDummyPayment);
router.post(
  "/xendit/test-session",
  sensitiveActionRateLimit,
  protect,
  authorizeRole("admin"),
  createXenditTestSession,
);

export default router;
