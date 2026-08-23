const BACKEND_ROUTE_PREFIX = "/api/backend";

let backendAppPromise = null;

function stripBackendRoutePrefix(req) {
  if (req.url === BACKEND_ROUTE_PREFIX || req.url.startsWith(`${BACKEND_ROUTE_PREFIX}/`)) {
    req.url = req.url.slice(BACKEND_ROUTE_PREFIX.length) || "/";
  }
}

function getRequestPath(req) {
  try {
    return new URL(req.url || "/", "http://127.0.0.1").pathname;
  } catch {
    return req.url || "/";
  }
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
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

async function handler(req, res) {
  stripBackendRoutePrefix(req);

  if (req.method === "GET" && getRequestPath(req) === "/api/health") {
    sendJson(res, 200, {
      success: true,
      message: "Backend service berjalan normal.",
    });
    return;
  }

  try {
    const backendApp = await getBackendApp();
    return backendApp(req, res);
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Unknown backend app load error";

    console.error("[backend-entrypoint] app_load_failed", {
      message,
    });

    if (res.headersSent || res.writableEnded) {
      return;
    }

    sendJson(res, 500, {
      success: false,
      message: "Backend auth gagal dimuat pada runtime deploy.",
      errorCode: "BACKEND_APP_LOAD_FAILED",
      errors: {
        reason: message,
      },
    });
  }
}

module.exports = handler;
module.exports.default = handler;
