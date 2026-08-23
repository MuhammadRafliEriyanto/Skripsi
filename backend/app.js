const express = require("express");

const app = express();
const BACKEND_ROUTE_PREFIX = "/api/backend";

let backendAppPromise = null;

function stripBackendRoutePrefix(req) {
  if (req.url === BACKEND_ROUTE_PREFIX || req.url.startsWith(`${BACKEND_ROUTE_PREFIX}/`)) {
    req.url = req.url.slice(BACKEND_ROUTE_PREFIX.length) || "/";
  }
}

function getBackendApp() {
  if (!backendAppPromise) {
    backendAppPromise = Promise.resolve()
      .then(() => {
        try {
          return require("./src/app.ts");
        } catch (sourceError) {
          try {
            return require("./dist/app.js");
          } catch (distError) {
            const sourceMessage =
              sourceError instanceof Error ? sourceError.message : String(sourceError);
            const distMessage =
              distError instanceof Error ? distError.message : String(distError);

            throw new Error(
              `Gagal memuat backend app. src/app.ts: ${sourceMessage}; dist/app.js: ${distMessage}`,
            );
          }
        }
      })
      .then((module) => module.default || module)
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

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Backend service berjalan normal.",
  });
});

app.use(async (req, res, next) => {
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

    if (res.headersSent || res.writableEnded) {
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

module.exports = app;
module.exports.default = app;
