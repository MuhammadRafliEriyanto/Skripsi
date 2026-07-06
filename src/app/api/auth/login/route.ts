import { NextResponse } from "next/server";

import type { LoginResponse } from "@/lib/auth";
import { isUserRole } from "@/lib/auth";
import { callAuthBackend, setAuthCookies } from "@/lib/auth-server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rememberMe = Boolean(body?.rememberMe);

    const { payload, response } = await callAuthBackend<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        identifier: body?.identifier ?? body?.email,
        email: body?.email,
        loginCode: body?.loginCode,
        password: body?.password,
      }),
    }, request);

    const nextResponse = NextResponse.json(payload, {
      status: response.status,
    });

    if (
      response.ok &&
      payload.success &&
      typeof payload.data?.token === "string" &&
      isUserRole(payload.data?.role)
    ) {
      setAuthCookies(nextResponse, {
        token: payload.data.token,
        role: payload.data.role,
        rememberMe,
      });
    } else if (!response.ok) {
      nextResponse.cookies.delete("bimbel_auth_token");
      nextResponse.cookies.delete("bimbel_auth_role");
    }

    return nextResponse;
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "Gagal memproses login. Silakan coba lagi.",
      },
      {
        status: 500,
      },
    );
  }
}
