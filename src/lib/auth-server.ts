import { NextResponse } from "next/server";

import { AUTH_ROLE_COOKIE_NAME, AUTH_TOKEN_COOKIE_NAME, type UserRole } from "@/lib/auth";

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

function getAuthBackendConfig() {
  const baseUrl = process.env.AUTH_API_URL?.trim() || process.env.BACKEND_URL?.trim();
  const apiKey = process.env.AUTH_API_KEY?.trim();

  if (!baseUrl) {
    throw new AuthBackendProxyError({
      status: 500,
      message: "AUTH_API_URL atau BACKEND_URL belum diatur pada environment frontend.",
      errorCode: "AUTH_BACKEND_URL_MISSING",
    });
  }

  if (!apiKey) {
    throw new AuthBackendProxyError({
      status: 500,
      message: "AUTH_API_KEY belum diatur pada environment frontend.",
      errorCode: "AUTH_BACKEND_API_KEY_MISSING",
    });
  }

  return {
    baseUrl: baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl,
    apiKey,
  };
}

export async function callAuthBackend<T extends BackendPayload>(
  path: string,
  init: RequestInit = {},
) {
  const { baseUrl, apiKey } = getAuthBackendConfig();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const targetUrl = `${baseUrl}${normalizedPath}`;
  const headers = new Headers(init.headers);
  const method = init.method?.toUpperCase() ?? "GET";

  headers.set("x-api-key", apiKey);

  if (!headers.has("Content-Type") && init.method && init.method !== "GET") {
    headers.set("Content-Type", "application/json");
  }

  logAuthProxy("info", "request", {
    authApiUrl: baseUrl,
    targetUrl,
    method,
  });

  let response: Response;

  try {
    response = await fetch(targetUrl, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal menghubungi backend auth.";

    logAuthProxy("error", "network_error", {
      authApiUrl: baseUrl,
      targetUrl,
      method,
      message,
    });

    throw new AuthBackendProxyError({
      status: 502,
      message: "Gagal menghubungi backend auth. Periksa AUTH_API_URL/BACKEND_URL, port backend, dan status server backend.",
      errorCode: "AUTH_BACKEND_UNREACHABLE",
    });
  }

  const payload = (await response.json().catch(() => ({
    success: false,
    message: "Backend auth mengembalikan respons yang tidak valid.",
  }))) as T;
  const payloadMessage = getPayloadMessage(payload);

  logAuthProxy(response.ok ? "info" : "error", "response", {
    authApiUrl: baseUrl,
    targetUrl,
    method,
    status: response.status,
    message: payloadMessage ?? "Tanpa message dari backend.",
  });

  return {
    payload,
    response,
    targetUrl,
  };
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
