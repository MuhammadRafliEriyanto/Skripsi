import { Router, raw } from "express";
import {
  archiveAdminQuestionBankItem,
  bulkUpdateAdminQuestionBankStatus,
  confirmAdminQuestionBankImport,
  createAdminQuestionBankItem,
  downloadAdminQuestionBankTemplate,
  getAdminQuestionBank,
  previewAdminQuestionBankExcel,
  previewAdminQuestionBankPdf,
  updateAdminQuestionBankItem,
  updateAdminQuestionBankStatus,
} from "../controllers/adminQuestionBankController";
import apiKeyMiddleware from "../middleware/apiKeyMiddleware";
import authorizeRole from "../middleware/authorizeRole";
import protect from "../middleware/protect";

const router = Router();
router.use(apiKeyMiddleware, protect, authorizeRole("admin", "owner"));
router.route("/question-bank").get(getAdminQuestionBank).post(createAdminQuestionBankItem);
router.get("/question-bank/import/template", downloadAdminQuestionBankTemplate);
router.post("/question-bank/import/excel/preview", previewAdminQuestionBankExcel);
router.post("/question-bank/import/pdf/preview", raw({ type: "application/pdf", limit: "120mb" }), previewAdminQuestionBankPdf);
router.post("/question-bank/import/confirm", confirmAdminQuestionBankImport);
router.patch("/question-bank/bulk-status", bulkUpdateAdminQuestionBankStatus);
router.route("/question-bank/:itemId").patch(updateAdminQuestionBankItem).delete(archiveAdminQuestionBankItem);
router.patch("/question-bank/:itemId/status", updateAdminQuestionBankStatus);
export default router;
