import { NextResponse } from "next/server";

import { AUTH_ROLE_COOKIE_NAME, AUTH_TOKEN_COOKIE_NAME, type UserRole } from "@/lib/auth";
import {
  buildBackendUrl,
  getBackendTargets,
  getForwardedCookieHeader,
  isVercelDeploymentNotFound,
  type BackendTarget,
} from "@/lib/backend-target";

const THIRTY_DAYS_IN_SECONDS = 60 * 60 * 24 * 30;

type BackendPayload = Record<string, unknown>;

type AuthBackendProxyErrorOptions = {
  message: string;
  status: number;
  errorCode?: string;
  errors?: unknown;
};

export class AuthBackendProxyError extends Error {
  status: number;
  errorCode?: string;
  errors?: unknown;

  constructor({ message, status, errorCode, errors }: AuthBackendProxyErrorOptions) {
    super(message);
    this.name = "AuthBackendProxyError";
    this.status = status;
    this.errorCode = errorCode;
    this.errors = errors;
  }
}

function logAuthProxy(level: "info" | "error", event: string, data: Record<string, unknown>) {
  const logger = level === "error" ? console.error : console.info;
  logger(`[auth-proxy] ${event}`, data);
}

function getPayloadMessage(payload: BackendPayload | null | undefined) {
  return typeof payload?.message === "string" ? payload.message : null;
}

function getAuthBackendTargets(request?: Request) {
  try {
    return getBackendTargets({
      request,
      missingBaseUrlMessage: "AUTH_API_URL atau BACKEND_URL belum diatur pada environment frontend.",
      missingApiKeyMessage: "AUTH_API_KEY belum diatur pada environment frontend.",
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Konfigurasi backend auth belum lengkap.";
    const errorCode = message.includes("AUTH_API_KEY")
      ? "AUTH_BACKEND_API_KEY_MISSING"
      : "AUTH_BACKEND_URL_MISSING";

    throw new AuthBackendProxyError({
      status: 500,
      message,
      errorCode,
    });
  }
}

function buildAuthHeaders(
  init: RequestInit,
  apiKey: string,
  target: BackendTarget,
  request?: Request,
) {
  const headers = new Headers(init.headers);

  headers.set("x-api-key", apiKey);

  if (target.forwardRequestCookies && !headers.has("Cookie")) {
    const cookieHeader = getForwardedCookieHeader(request);

    if (cookieHeader) {
      headers.set("Cookie", cookieHeader);
    }
  }

  if (!headers.has("Content-Type") && init.method && init.method !== "GET") {
    headers.set("Content-Type", "application/json");
  }

  return headers;
}

async function readAuthBackendPayload<T extends BackendPayload>(
  response: Response,
): Promise<{ payload: T; rawBody: string }> {
  const rawBody = await response.text().catch(() => "");
  const trimmedBody = rawBody.trim();
  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  const looksJson =
    contentType.includes("json") || trimmedBody.startsWith("{") || trimmedBody.startsWith("[");

  if (trimmedBody && looksJson) {
    try {
      return {
        payload: JSON.parse(rawBody) as T,
        rawBody,
      };
    } catch {
      // Fall through to the structured fallback payload.
    }
  }

  return {
    payload: {
      success: false,
      message: "Backend auth mengembalikan respons yang tidak valid.",
      errorCode: "AUTH_BACKEND_INVALID_RESPONSE",
      errors: {
        contentType: response.headers.get("content-type")?.trim() || "unknown",
        status: `${response.status}${response.statusText ? ` ${response.statusText}` : ""}`,
        bodyPreview: trimmedBody.slice(0, 500),
      },
    } as T,
    rawBody,
  };
}

export async function callAuthBackend<T extends BackendPayload>(
  path: string,
  init: RequestInit = {},
  request?: Request,
) {
  const { apiKey, targets } = getAuthBackendTargets(request);
  const method = init.method?.toUpperCase() ?? "GET";
  let lastError: unknown = null;

  for (const [index, target] of targets.entries()) {
    const targetUrl = buildBackendUrl(target.baseUrl, path);
    const headers = buildAuthHeaders(init, apiKey, target, request);
    const hasFallbackTarget = index < targets.length - 1;

    logAuthProxy("info", "request", {
      authApiUrl: target.baseUrl,
      targetUrl,
      method,
      source: target.source,
    });

    let response: Response;

    try {
      response = await fetch(targetUrl, {
        ...init,
        headers,
        cache: "no-store",
      });
    } catch (error) {
      lastError = error;

      logAuthProxy("error", "network_error", {
        authApiUrl: target.baseUrl,
        targetUrl,
        method,
        source: target.source,
        message: error instanceof Error ? error.message : "Gagal menghubungi backend auth.",
      });

      if (hasFallbackTarget) {
        continue;
      }

      const message =
        error instanceof Error ? error.message : "Gagal menghubungi backend auth.";

      throw new AuthBackendProxyError({
        status: 502,
        message:
          "Gagal menghubungi backend auth. Periksa AUTH_API_URL/BACKEND_URL, port backend, dan status server backend.",
        errorCode: "AUTH_BACKEND_UNREACHABLE",
        errors: {
          targetUrl,
          reason: message,
        },
      });
    }

    const { payload, rawBody } = await readAuthBackendPayload<T>(response);

    if (hasFallbackTarget && isVercelDeploymentNotFound(response, rawBody)) {
      logAuthProxy("error", "deployment_not_found_fallback", {
        authApiUrl: target.baseUrl,
        targetUrl,
        method,
        source: target.source,
        status: response.status,
      });
      continue;
    }

    const payloadMessage = getPayloadMessage(payload);

    logAuthProxy(response.ok ? "info" : "error", "response", {
      authApiUrl: target.baseUrl,
      targetUrl,
      method,
      source: target.source,
      status: response.status,
      message: payloadMessage ?? "Tanpa message dari backend.",
    });

    return {
      payload,
      response,
      targetUrl,
    };
  }

  throw new AuthBackendProxyError({
    status: 502,
    message:
      "Gagal menghubungi backend auth. Periksa AUTH_API_URL/BACKEND_URL, port backend, dan status server backend.",
    errorCode: "AUTH_BACKEND_UNREACHABLE",
    errors: lastError instanceof Error ? { reason: lastError.message } : undefined,
  });
}

export function setAuthCookies(
  response: NextResponse,
  options: { token: string; role: UserRole; rememberMe?: boolean },
) {
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(options.rememberMe ? { maxAge: THIRTY_DAYS_IN_SECONDS } : {}),
  };

  response.cookies.set({
    name: AUTH_TOKEN_COOKIE_NAME,
    value: options.token,
    ...cookieOptions,
  });

  response.cookies.set({
    name: AUTH_ROLE_COOKIE_NAME,
    value: options.role,
    ...cookieOptions,
  });

  return response;
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.set({
    name: AUTH_TOKEN_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  response.cookies.set({
    name: AUTH_ROLE_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}
