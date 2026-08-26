import { NextResponse, type NextRequest } from "next/server";

import { getLocalBackendBaseUrl } from "@/lib/local-backend-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BackendRouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function buildProxyHeaders(headers: Headers) {
  const proxyHeaders = new Headers(headers);

  for (const header of HOP_BY_HOP_HEADERS) {
    proxyHeaders.delete(header);
  }

  proxyHeaders.delete("host");

  return proxyHeaders;
}

function buildTargetPath(pathSegments: string[] = []) {
  return `/${pathSegments.map((segment) => encodeURIComponent(segment)).join("/")}`;
}

async function proxyBackendRequest(request: NextRequest, context: BackendRouteContext) {
  try {
    const { path = [] } = await context.params;
    const backendBaseUrl = await getLocalBackendBaseUrl();
    const targetUrl = new URL(buildTargetPath(path), backendBaseUrl);
    const method = request.method.toUpperCase();

    targetUrl.search = request.nextUrl.search;

    const response = await fetch(targetUrl, {
      method,
      headers: buildProxyHeaders(request.headers),
      body: method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer(),
      cache: "no-store",
      redirect: "manual",
    });

    return new NextResponse(method === "HEAD" ? null : response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: buildProxyHeaders(response.headers),
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Gagal menjalankan backend lokal.";

    return NextResponse.json(
      {
        success: false,
        message,
        errorCode: "LOCAL_BACKEND_PROXY_FAILED",
      },
      {
        status: 502,
      },
    );
  }
}

export const GET = proxyBackendRequest;
export const POST = proxyBackendRequest;
export const PUT = proxyBackendRequest;
export const PATCH = proxyBackendRequest;
export const DELETE = proxyBackendRequest;
export const HEAD = proxyBackendRequest;
export const OPTIONS = proxyBackendRequest;
