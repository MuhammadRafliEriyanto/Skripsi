import { NextResponse, type NextRequest } from "next/server";

import { AUTH_TOKEN_COOKIE_NAME, type ApiResponse } from "@/lib/auth";
import {
  buildBackendUrl,
  getBackendTargets,
  getForwardedCookieHeader,
  isVercelDeploymentNotFound,
  type BackendTarget,
} from "@/lib/backend-target";

type BackendPayload = ApiResponse<Record<string, unknown>>;

function buildInvalidBackendResponse(
  fallbackMessage: string,
  response?: Response,
  rawBody?: string,
) {
  const contentType = response?.headers.get("content-type")?.trim() || "unknown";
  const responseStatus = response
    ? `${response.status}${response.statusText ? ` ${response.statusText}` : ""}`
    : "unknown";
  const bodyPreview = rawBody?.trim().slice(0, 500) || "";

  return {
    success: false,
    message:
      bodyPreview && bodyPreview.startsWith("<")
        ? `${fallbackMessage} (backend mengembalikan HTML ${responseStatus}).`
        : bodyPreview
          ? `${fallbackMessage} (${responseStatus}).`
          : fallbackMessage,
    errorCode: "BACKEND_INVALID_RESPONSE",
    errors: {
      contentType,
      status: responseStatus,
      bodyPreview,
    },
  } satisfies BackendPayload;
}

async function readBackendPayload(response: Response, fallbackMessage: string) {
  const rawBody = await response.text().catch(() => "");
  const trimmedBody = rawBody.trim();
  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  const looksJson =
    contentType.includes("json") || trimmedBody.startsWith("{") || trimmedBody.startsWith("[");

  if (trimmedBody && looksJson) {
    try {
      return {
        payload: JSON.parse(rawBody) as BackendPayload,
        rawBody,
      };
    } catch {
      // Fall through to the structured error payload below.
    }
  }

  return {
    payload: buildInvalidBackendResponse(fallbackMessage, response, rawBody),
    rawBody,
  };
}

function isInvalidBackendPayload(payload: BackendPayload | null | undefined) {
  return payload?.errorCode === "BACKEND_INVALID_RESPONSE";
}

function buildAuthErrorResponse() {
  return NextResponse.json(
    {
      success: false,
      message: "Sesi login tidak ditemukan.",
    },
    {
      status: 401,
    },
  );
}

function buildPassthroughHeaders(response: Response) {
  const headers = new Headers();
  const contentType = response.headers.get("content-type");
  const contentDisposition = response.headers.get("content-disposition");
  const cacheControl = response.headers.get("cache-control");

  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  if (contentDisposition) {
    headers.set("Content-Disposition", contentDisposition);
  }

  if (cacheControl) {
    headers.set("Cache-Control", cacheControl);
  }

  return headers;
}

function getProxyBackendTargets(request?: NextRequest) {
  return getBackendTargets({
    request,
    missingBaseUrlMessage: "AUTH_API_URL atau BACKEND_URL belum diatur pada environment frontend.",
    missingApiKeyMessage: "AUTH_API_KEY belum diatur pada .env.local root frontend.",
  });
}

function buildBackendRequestHeaders(
  init: RequestInit,
  apiKey: string,
  target: BackendTarget,
  request?: NextRequest,
  token?: string,
) {
  const headers = new Headers(init.headers);

  headers.set("x-api-key", apiKey);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (target.forwardRequestCookies && !headers.has("Cookie")) {
    const cookieHeader = getForwardedCookieHeader(request);

    if (cookieHeader) {
      headers.set("Cookie", cookieHeader);
    }
  }

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return headers;
}

function logBackendFallback(event: string, data: Record<string, unknown>) {
  console.error(`[backend-proxy] ${event}`, data);
}

type BackendJsonRequestOptions = {
  request?: NextRequest;
  path: string;
  init?: RequestInit;
  token?: string;
  fallbackMessage: string;
  includeRequestSearch?: boolean;
};

async function requestBackendJson({
  request,
  path,
  init = {},
  token,
  fallbackMessage,
  includeRequestSearch = false,
}: BackendJsonRequestOptions) {
  const { apiKey, targets } = getProxyBackendTargets(request);
  let lastError: unknown = null;

  for (const [index, target] of targets.entries()) {
    const targetUrl = buildBackendUrl(
      target.baseUrl,
      path,
      includeRequestSearch && request ? request.nextUrl.search : "",
    );
    const headers = buildBackendRequestHeaders(init, apiKey, target, request, token);
    const hasFallbackTarget = index < targets.length - 1;

    try {
      const response = await fetch(targetUrl, {
        ...init,
        headers,
        cache: "no-store",
      });
      const { payload, rawBody } = await readBackendPayload(response, fallbackMessage);

      if (hasFallbackTarget && isVercelDeploymentNotFound(response, rawBody)) {
        logBackendFallback("deployment_not_found_fallback", {
          targetUrl,
          source: target.source,
          status: response.status,
        });
        continue;
      }

      if (hasFallbackTarget && isInvalidBackendPayload(payload)) {
        logBackendFallback("invalid_response_fallback", {
          targetUrl,
          source: target.source,
          status: response.status,
          contentType: response.headers.get("content-type")?.trim() || "unknown",
        });
        continue;
      }

      return {
        payload,
        response,
      };
    } catch (error) {
      lastError = error;
      logBackendFallback("network_error", {
        targetUrl,
        source: target.source,
        message: error instanceof Error ? error.message : "Gagal menghubungi backend.",
      });

      if (hasFallbackTarget) {
        continue;
      }

      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Gagal menghubungi backend.");
}

export async function proxyPublicBackend(
  path: string,
  init: RequestInit = {},
  request?: NextRequest,
) {
  try {
    const { payload, response } = await requestBackendJson({
      request,
      path,
      init,
      fallbackMessage:
      "Backend mengembalikan respons yang tidak valid.",
    });

    return NextResponse.json(payload, {
      status: response.status,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Gagal menghubungi backend.";

    return NextResponse.json(
      {
        success: false,
        message,
      },
      {
        status: 502,
      },
    );
  }
}

function getRequestAuthToken(request: NextRequest) {
  const authorizationHeader = request.headers.get("authorization")?.trim();

  if (authorizationHeader?.toLowerCase().startsWith("bearer ")) {
    return authorizationHeader.slice(7).trim();
  }

  return request.cookies.get(AUTH_TOKEN_COOKIE_NAME)?.value;
}

export async function proxyProtectedBackend(
  request: NextRequest,
  path: string,
  init: RequestInit = {},
) {
  const token = getRequestAuthToken(request);

  if (!token) {
    return buildAuthErrorResponse();
  }

  try {
    const { payload, response } = await requestBackendJson({
      request,
      path,
      init,
      token,
      includeRequestSearch: true,
      fallbackMessage:
      "Backend mengembalikan respons yang tidak valid.",
    });

    return NextResponse.json(payload, {
      status: response.status,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Gagal menghubungi backend.";

    return NextResponse.json(
      {
        success: false,
        message,
      },
      {
        status: 502,
      },
    );
  }
}

export async function proxyProtectedBackendRaw(
  request: NextRequest,
  path: string,
  init: RequestInit = {},
) {
  const token = getRequestAuthToken(request);

  if (!token) {
    return buildAuthErrorResponse();
  }

  try {
    const { apiKey, targets } = getProxyBackendTargets(request);
    let lastError: unknown = null;

    for (const [index, target] of targets.entries()) {
      const targetUrl = buildBackendUrl(target.baseUrl, path);
      const headers = buildBackendRequestHeaders(init, apiKey, target, request, token);
      const hasFallbackTarget = index < targets.length - 1;

      try {
        const response = await fetch(targetUrl, {
          ...init,
          headers,
          cache: "no-store",
        });

        if (hasFallbackTarget && response.status === 404) {
          const rawBody = await response.clone().text().catch(() => "");

          if (isVercelDeploymentNotFound(response, rawBody)) {
            logBackendFallback("deployment_not_found_fallback", {
              targetUrl,
              source: target.source,
              status: response.status,
            });
            continue;
          }
        }

        return new NextResponse(response.body, {
          status: response.status,
          headers: buildPassthroughHeaders(response),
        });
      } catch (error) {
        lastError = error;
        logBackendFallback("network_error", {
          targetUrl,
          source: target.source,
          message: error instanceof Error ? error.message : "Gagal menghubungi backend.",
        });

        if (hasFallbackTarget) {
          continue;
        }

        throw error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Gagal menghubungi backend.");
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Gagal menghubungi backend.";

    return NextResponse.json(
      {
        success: false,
        message,
      },
      {
        status: 502,
      },
    );
  }
}

export async function readRequestBody(request: NextRequest) {
  const bodyText = await request.text();

  return bodyText || undefined;
}
