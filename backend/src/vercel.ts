import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";

const app = express();
const BACKEND_ROUTE_PREFIX = "/api/backend";

let backendAppPromise: Promise<Express> | null = null;

function stripBackendRoutePrefix(req: Request) {
  if (req.url === BACKEND_ROUTE_PREFIX || req.url.startsWith(`${BACKEND_ROUTE_PREFIX}/`)) {
    req.url = req.url.slice(BACKEND_ROUTE_PREFIX.length) || "/";
  }
}

function getBackendApp() {
  if (!backendAppPromise) {
    backendAppPromise = import("./app")
      .then((module) => module.default)
      .catch((error) => {
        backendAppPromise = null;
        throw error;
      });
  }

  return backendAppPromise;
}

app.disable("x-powered-by");
app.use((req, _res, next) => {
  stripBackendRoutePrefix(req);
  next();
});

app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Backend service berjalan normal.",
  });
});

app.use(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const backendApp = await getBackendApp();
    return backendApp(req, res, next);
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Unknown backend app load error";

    console.error("[backend-entrypoint] app_load_failed", {
      message,
    });

    if (res.headersSent) {
      next(error);
      return;
    }

    res.status(500).json({
      success: false,
      message: "Backend auth gagal dimuat pada runtime deploy.",
      errorCode: "BACKEND_APP_LOAD_FAILED",
      errors: {
        reason: message,
      },
    });
  }
});

export default app;
