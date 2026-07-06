import { NextResponse } from "next/server";

import type { ResetPasswordResponse } from "@/lib/auth";
import { AuthBackendProxyError, callAuthBackend } from "@/lib/auth-server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { payload, response } = await callAuthBackend<ResetPasswordResponse>(
      "/api/auth/reset-password",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
      request,
    );

    return NextResponse.json(payload, {
      status: response.status,
    });
  } catch (error) {
    if (error instanceof AuthBackendProxyError) {
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

    return NextResponse.json(
      {
        success: false,
        message: "Gagal memproses reset password.",
      },
      {
        status: 500,
      },
    );
  }
}
