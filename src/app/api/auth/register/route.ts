import { NextResponse } from "next/server";

import type { RegisterResponse } from "@/lib/auth";
import { AuthBackendProxyError, callAuthBackend } from "@/lib/auth-server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { payload, response } = await callAuthBackend<RegisterResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }, request);

    return NextResponse.json(payload, {
      status: response.status,
    });
  } catch (error) {
    if (error instanceof AuthBackendProxyError) {
      console.error("[auth-register] proxy_error", {
        status: error.status,
        message: error.message,
        errorCode: error.errorCode ?? null,
      });

      return NextResponse.json(
        {
          success: false,
          message: error.message,
          ...(error.errorCode ? { errorCode: error.errorCode } : {}),
          ...(error.errors ? { errors: error.errors } : {}),
        },
        {
          status: error.status,
        },
      );
    }

    const message =
      error instanceof Error && error.message
        ? error.message
        : "Gagal memproses registrasi. Silakan coba lagi.";

    console.error("[auth-register] unexpected_error", {
      message,
    });

    return NextResponse.json(
      {
        success: false,
        message,
      },
      {
        status: 500,
      },
    );
  }
}
