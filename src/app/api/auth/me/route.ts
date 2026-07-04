import { NextRequest, NextResponse } from "next/server";

import type { MeResponse } from "@/lib/auth";
import { AUTH_TOKEN_COOKIE_NAME } from "@/lib/auth";
import { callAuthBackend, clearAuthCookies } from "@/lib/auth-server";
import { proxyProtectedBackend, readRequestBody } from "@/lib/backend-route";

export async function GET(request: NextRequest) {
  try {
    const authorizationHeader = request.headers.get("authorization")?.trim();
    const token =
      authorizationHeader?.toLowerCase().startsWith("bearer ")
        ? authorizationHeader.slice(7).trim()
        : request.cookies.get(AUTH_TOKEN_COOKIE_NAME)?.value;

    if (!token) {
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

    const { payload, response } = await callAuthBackend<MeResponse>("/api/auth/me", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const nextResponse = NextResponse.json(payload, {
      status: response.status,
    });

    if (!response.ok) {
      clearAuthCookies(nextResponse);
    }

    return nextResponse;
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "Gagal mengambil sesi user.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function PUT(request: NextRequest) {
  const body = await readRequestBody(request);

  return proxyProtectedBackend(request, "/api/auth/me", {
    method: "PUT",
    body,
  });
}
