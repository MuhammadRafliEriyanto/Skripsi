import { Router } from "express";

import {
  createExpense,
  deleteExpense,
  getExpenseById,
  getExpenses,
  restoreExpense,
  updateExpense,
} from "../controllers/expenseController";
import apiKeyMiddleware from "../middleware/apiKeyMiddleware";
import authorizeRole from "../middleware/authorizeRole";
import protect from "../middleware/protect";

const router = Router();

router.use(apiKeyMiddleware, protect, authorizeRole("admin", "owner"));

router.route("/").get(getExpenses).post(createExpense);
router.post("/:id/restore", restoreExpense);
router.route("/:id").get(getExpenseById).put(updateExpense).delete(deleteExpense);

export default router;
