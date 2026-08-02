import { Router } from "express";

import {
  createBranch,
  createBranchAdminAccount,
  deleteBranchAdminAccount,
  deleteBranch,
  getBranchAdminAccounts,
  getBranchAdminOptions,
  getBranchById,
  getBranches,
  getPublicBranchOptions,
  resendBranchAdminVerification,
  resetBranchAdminPassword,
  updateBranchAdminAccount,
  updateBranch,
  restoreBranch,
} from "../controllers/branchController";
import apiKeyMiddleware from "../middleware/apiKeyMiddleware";
import authorizeRole from "../middleware/authorizeRole";
import protect from "../middleware/protect";

const router = Router();
const ownerOnly = authorizeRole("owner");

router.get("/public-options", apiKeyMiddleware, getPublicBranchOptions);

router.use(apiKeyMiddleware, protect, authorizeRole("admin", "owner"));

router.get("/admin-options", ownerOnly, getBranchAdminOptions);
router
  .route("/admin-accounts")
  .get(ownerOnly, getBranchAdminAccounts)
  .post(ownerOnly, createBranchAdminAccount);
router
  .route("/admin-accounts/:id")
  .put(ownerOnly, updateBranchAdminAccount)
  .delete(ownerOnly, deleteBranchAdminAccount);
router.post(
  "/admin-accounts/:id/resend-verification",
  ownerOnly,
  resendBranchAdminVerification,
);
router.post(
  "/admin-accounts/:id/reset-password",
  ownerOnly,
  resetBranchAdminPassword,
);
router.route("/").get(getBranches).post(ownerOnly, createBranch);
router
  .route("/:id")
  .get(getBranchById)
  .put(ownerOnly, updateBranch)
  .delete(ownerOnly, deleteBranch);

router.put("/:id/restore", ownerOnly, restoreBranch);

export default router;
