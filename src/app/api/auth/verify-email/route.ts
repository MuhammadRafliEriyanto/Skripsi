import { NextResponse } from "next/server";

import type { VerifyEmailResponse } from "@/lib/auth";
import { callAuthBackend } from "@/lib/auth-server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: "Token verifikasi tidak ditemukan.",
        },
        {
          status: 400,
        },
      );
    }

    const { payload, response } = await callAuthBackend<VerifyEmailResponse>(
      `/api/auth/verify-email/${encodeURIComponent(token)}`,
      {
        method: "GET",
      },
      request,
    );

    return NextResponse.json(payload, {
      status: response.status,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "Gagal memverifikasi email. Silakan coba lagi.",
      },
      {
        status: 500,
      },
    );
  }
}
