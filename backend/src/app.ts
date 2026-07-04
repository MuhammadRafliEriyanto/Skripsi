import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";

import "./types/express";

import branchFinanceRoutes from "./routes/branchFinanceRoutes";
import branchIncomeRoutes from "./routes/branchIncomeRoutes";
import branchRoutes from "./routes/branchRoutes";
import errorHandler from "./middleware/errorHandler";
import expenseRoutes from "./routes/expenseRoutes";
import adminRoutes from "./routes/adminRoutes";
import authRoutes from "./routes/authRoutes";
import adminNotificationRoutes from "./routes/adminNotificationRoutes";
import ownerNotificationRoutes from "./routes/ownerNotificationRoutes";
import ownerSearchRoutes from "./routes/ownerSearchRoutes";
import paymentRoutes from "./routes/paymentRoutes";
import roomRoutes from "./routes/roomRoutes";
import scheduleRoutes from "./routes/scheduleRoutes";
import studentAttendanceRoutes from "./routes/studentAttendanceRoutes";
import studentLearningRoutes from "./routes/studentLearningRoutes";
import studentRoutes from "./routes/studentRoutes";
import subscriptionRoutes from "./routes/subscriptionRoutes";
import teacherRoutes from "./routes/teacherRoutes";
import teacherScheduleRoutes from "./routes/teacherScheduleRoutes";
import teacherTryoutRoutes from "./routes/teacherTryoutRoutes";
import connectDB from "./config/db";
import { AppError, sendSuccess } from "./utils/apiResponse";
import { verifyEmailTransport } from "./utils/email";

const app = express();
const REQUEST_BODY_LIMIT = "20mb";
let backendInitPromise: Promise<void> | null = null;

function ensureBackendReady() {
  if (!backendInitPromise) {
    backendInitPromise = (async () => {
      await connectDB();

      void verifyEmailTransport().catch((error) => {
        console.warn("SMTP init skipped on service runtime:", error);
      });
    })().catch((error) => {
      backendInitPromise = null;
      throw error;
    });
  }

  return backendInitPromise;
}

app.use(
  cors({
    origin: process.env.CLIENT_URL || true,
    credentials: true,
  }),
);
app.use(express.json({ limit: REQUEST_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: REQUEST_BODY_LIMIT }));
app.use((_, __, next) => {
  void ensureBackendReady()
    .then(() => next())
    .catch(next);
});

app.get("/api/health", (_req: Request, res: Response) => {
  return sendSuccess(res, {
    message: "Backend auth berjalan normal.",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/branch-finances", branchFinanceRoutes);
app.use("/api/branch-incomes", branchIncomeRoutes);
app.use("/api/branches", branchRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/admin/notifications", adminNotificationRoutes);
app.use("/api/owner/notifications", ownerNotificationRoutes);
app.use("/api/owner/search", ownerSearchRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/student", studentAttendanceRoutes);
app.use("/api/student", studentLearningRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/schedules", scheduleRoutes);
app.use("/api/teacher", teacherScheduleRoutes);
app.use("/api/teacher", teacherTryoutRoutes);

app.use((req: Request, _res: Response, next: NextFunction) => {
  next(new AppError(404, `Route ${req.originalUrl} tidak ditemukan.`));
});

app.use(errorHandler);

export default app;
