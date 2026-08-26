import cors from "cors";
import express, {
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from "express";

import "./types/express";

import errorHandler from "./middleware/errorHandler";
import connectDB from "./config/db";
import sanitizeRequestBody from "./middleware/sanitizeRequest";
import securityHeaders from "./middleware/securityHeaders";
import { AppError, sendSuccess } from "./utils/apiResponse";
import { verifyEmailTransport } from "./utils/email";

const app = express();
const REQUEST_BODY_LIMIT = "20mb";
let backendInitPromise: Promise<void> | null = null;

type RouteModule = {
  default?: unknown;
};

function lazyRouter(loadRoute: () => Promise<RouteModule>): RequestHandler {
  let routePromise: Promise<RequestHandler> | null = null;

  return (req, res, next) => {
    routePromise ??= loadRoute().then((routeModule) => {
      if (typeof routeModule.default !== "function") {
        throw new Error("Route backend tidak mengekspor Express router.");
      }

      return routeModule.default as RequestHandler;
    });

    void routePromise
      .then((router) => router(req, res, next))
      .catch((error) => {
        routePromise = null;
        next(error);
      });
  };
}

function getBackendRoutePrefix() {
  return (process.env.BACKEND_ROUTE_PREFIX?.trim() || "/api/backend").replace(/\/+$/, "");
}

function getAllowedCorsOrigins() {
  const configuredOrigins = (process.env.CLIENT_URL ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return new Set([
    ...configuredOrigins,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ]);
}

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

app.set("trust proxy", 1);
app.use((req, _res, next) => {
  const backendRoutePrefix = getBackendRoutePrefix();

  if (
    backendRoutePrefix &&
    backendRoutePrefix !== "/" &&
    (req.url === backendRoutePrefix || req.url.startsWith(`${backendRoutePrefix}/`))
  ) {
    req.url = req.url.slice(backendRoutePrefix.length) || "/";
  }

  next();
});
app.use(securityHeaders);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || getAllowedCorsOrigins().has(origin)) {
        callback(null, true);
        return;
      }

      callback(
        new AppError(
          403,
          "Origin tidak diizinkan oleh CORS.",
          { origin },
          "CORS_ORIGIN_FORBIDDEN",
        ),
      );
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: REQUEST_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: REQUEST_BODY_LIMIT }));
app.use(sanitizeRequestBody);

app.get("/api/health", (_req: Request, res: Response) => {
  return sendSuccess(res, {
    message: "Backend auth berjalan normal.",
  });
});

app.use((_, __, next) => {
  void ensureBackendReady()
    .then(() => next())
    .catch((error) => {
      console.error("[backend-init] ready_failed", {
        message: error instanceof Error ? error.message : "Unknown backend init error",
      });
      next(error);
    });
});

app.get("/api/ready", (_req: Request, res: Response) => {
  return sendSuccess(res, {
    message: "Backend auth dan database siap.",
  });
});

app.use("/api/auth", lazyRouter(() => import("./routes/authRoutes")));
app.use("/api/admin", lazyRouter(() => import("./routes/adminRoutes")));
app.use(
  "/api/branch-finances",
  lazyRouter(() => import("./routes/branchFinanceRoutes")),
);
app.use(
  "/api/branch-incomes",
  lazyRouter(() => import("./routes/branchIncomeRoutes")),
);
app.use("/api/branches", lazyRouter(() => import("./routes/branchRoutes")));
app.use("/api/expenses", lazyRouter(() => import("./routes/expenseRoutes")));
app.use(
  "/api/admin/notifications",
  lazyRouter(() => import("./routes/adminNotificationRoutes")),
);
app.use(
  "/api/owner/notifications",
  lazyRouter(() => import("./routes/ownerNotificationRoutes")),
);
app.use("/api/owner/search", lazyRouter(() => import("./routes/ownerSearchRoutes")));
app.use("/api/subscriptions", lazyRouter(() => import("./routes/subscriptionRoutes")));
app.use("/api/payments", lazyRouter(() => import("./routes/paymentRoutes")));
app.use("/api/student", lazyRouter(() => import("./routes/studentAttendanceRoutes")));
app.use("/api/student", lazyRouter(() => import("./routes/studentLearningRoutes")));
app.use("/api/students", lazyRouter(() => import("./routes/studentRoutes")));
app.use("/api/teachers", lazyRouter(() => import("./routes/teacherRoutes")));
app.use("/api/rooms", lazyRouter(() => import("./routes/roomRoutes")));
app.use("/api/schedules", lazyRouter(() => import("./routes/scheduleRoutes")));
app.use("/api/teacher", lazyRouter(() => import("./routes/teacherScheduleRoutes")));
app.use("/api/teacher", lazyRouter(() => import("./routes/teacherTryoutRoutes")));

app.use((req: Request, _res: Response, next: NextFunction) => {
  next(new AppError(404, `Route ${req.originalUrl} tidak ditemukan.`));
});

app.use(errorHandler);

export default app;
