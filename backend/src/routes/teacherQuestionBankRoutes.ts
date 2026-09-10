import { Router } from "express";
import { archiveTeacherQuestionBankItem, createTeacherQuestionBankItem, getAvailableTeacherQuestionBank, getTeacherQuestionBank, importTeacherQuestionBank, updateTeacherQuestionBankItem } from "../controllers/teacherQuestionBankController";
import apiKeyMiddleware from "../middleware/apiKeyMiddleware";
import authorizeRole from "../middleware/authorizeRole";
import protect from "../middleware/protect";

const router = Router();
router.use(apiKeyMiddleware, protect, authorizeRole("guru"));
router.route("/me/question-bank").get(getTeacherQuestionBank).post(createTeacherQuestionBankItem);
router.get("/me/question-bank/available", getAvailableTeacherQuestionBank);
router.post("/me/question-bank/import", importTeacherQuestionBank);
router.route("/me/question-bank/:itemId").patch(updateTeacherQuestionBankItem).delete(archiveTeacherQuestionBankItem);
export default router;
