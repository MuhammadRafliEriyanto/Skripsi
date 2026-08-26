type BackendTargetSource = "env" | "same-origin";

export type BackendTarget = {
  baseUrl: string;
  source: BackendTargetSource;
  forwardRequestCookies: boolean;
};

type BackendTargetOptions = {
  request?: Request;
  missingBaseUrlMessage: string;
  missingApiKeyMessage: string;
};

const LOOPBACK_BACKEND_OVERRIDE_ENV = "ALLOW_LOOPBACK_BACKEND_URL";

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function getSameOriginBackendBaseUrl(request?: Request) {
  if (!request?.url) {
    return null;
  }

  try {
    return normalizeBaseUrl(new URL("/api/backend", request.url).toString());
  } catch {
    return null;
  }
}

function isLoopbackBaseUrl(value: string) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();

    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname === "[::1]"
    );
  } catch {
    return false;
  }
}

function getBooleanEnvFlag(name: string) {
  const value = process.env[name]?.trim().toLowerCase();

  return value === "1" || value === "true" || value === "yes";
}

function isProductionRuntime() {
  return process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
}

function shouldSkipLoopbackBaseUrl(value: string) {
  return (
    isProductionRuntime() &&
    !getBooleanEnvFlag(LOOPBACK_BACKEND_OVERRIDE_ENV) &&
    isLoopbackBaseUrl(value)
  );
}

function getEnvBackendBaseUrls() {
  const backendInternalUrl = process.env.BACKEND_INTERNAL_URL?.trim();
  const authApiUrl = process.env.AUTH_API_URL?.trim();
  const backendUrl = process.env.BACKEND_URL?.trim();
  const preferredUrls = isProductionRuntime()
    ? [backendInternalUrl, backendUrl, authApiUrl]
    : [authApiUrl, backendUrl, backendInternalUrl];

  return preferredUrls.filter((value): value is string => {
    if (!value) {
      return false;
    }

    return !shouldSkipLoopbackBaseUrl(value);
  });
}

function normalizeEnvBackendTarget(value: string, request?: Request): BackendTarget {
  const normalizedBaseUrl = normalizeBaseUrl(value);
  const sameOriginBaseUrl = getSameOriginBackendBaseUrl(request);

  if (!sameOriginBaseUrl) {
    return {
      baseUrl: normalizedBaseUrl,
      source: "env",
      forwardRequestCookies: false,
    };
  }

  try {
    const envUrl = new URL(normalizedBaseUrl);
    const sameOriginUrl = new URL(sameOriginBaseUrl);

    if (envUrl.origin !== sameOriginUrl.origin) {
      return {
        baseUrl: normalizedBaseUrl,
        source: "env",
        forwardRequestCookies: false,
      };
    }

    const envPath = envUrl.pathname.replace(/\/+$/, "") || "/";
    const pointsToFrontendApi = envPath === "/" || envPath === "/api" || envPath === "/api/auth";

    // Prevent auth proxy recursion when a deployed env URL points to the frontend origin.
    return {
      baseUrl: pointsToFrontendApi ? sameOriginBaseUrl : normalizedBaseUrl,
      source: "env",
      forwardRequestCookies: true,
    };
  } catch {
    return {
      baseUrl: normalizedBaseUrl,
      source: "env",
      forwardRequestCookies: false,
    };
  }
}

function shouldPreferSameOriginBackendTarget() {
  return isProductionRuntime() && Boolean(process.env.VERCEL) && !process.env.BACKEND_INTERNAL_URL;
}

function addTarget(targets: BackendTarget[], target: BackendTarget) {
  if (!target.baseUrl || targets.some((current) => current.baseUrl === target.baseUrl)) {
    return;
  }

  targets.push(target);
}

export function getBackendTargets({
  request,
  missingBaseUrlMessage,
  missingApiKeyMessage,
}: BackendTargetOptions) {
  const apiKey = process.env.AUTH_API_KEY?.trim();
  const targets: BackendTarget[] = [];
  const sameOriginBaseUrl = getSameOriginBackendBaseUrl(request);

  if (sameOriginBaseUrl && shouldPreferSameOriginBackendTarget()) {
    addTarget(targets, {
      baseUrl: sameOriginBaseUrl,
      source: "same-origin",
      forwardRequestCookies: true,
    });
  }

  for (const envBaseUrl of getEnvBackendBaseUrls()) {
    addTarget(targets, normalizeEnvBackendTarget(envBaseUrl, request));
  }

  if (sameOriginBaseUrl) {
    addTarget(targets, {
      baseUrl: sameOriginBaseUrl,
      source: "same-origin",
      forwardRequestCookies: true,
    });
  }

  if (!targets.length) {
    throw new Error(missingBaseUrlMessage);
  }

  if (!apiKey) {
    throw new Error(missingApiKeyMessage);
  }

  return {
    apiKey,
    targets,
  };
}

export function buildBackendUrl(baseUrl: string, path: string, requestSearch = "") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const shouldAppendSearch = requestSearch && !normalizedPath.includes("?");

  return `${normalizeBaseUrl(baseUrl)}${normalizedPath}${shouldAppendSearch ? requestSearch : ""}`;
}

export function getForwardedCookieHeader(request?: Request) {
  return request?.headers.get("cookie")?.trim() || null;
}

export function isVercelDeploymentNotFound(response: Response, rawBody = "") {
  const vercelError = response.headers.get("x-vercel-error")?.trim().toUpperCase();
  const body = rawBody.toUpperCase();

  return (
    response.status === 404 &&
    (vercelError === "DEPLOYMENT_NOT_FOUND" ||
      body.includes("DEPLOYMENT_NOT_FOUND") ||
      body.includes("THE DEPLOYMENT COULD NOT BE FOUND ON VERCEL"))
  );
}
