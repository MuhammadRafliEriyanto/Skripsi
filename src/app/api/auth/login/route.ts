import { NextResponse } from "next/server";

import type { LoginResponse } from "@/lib/auth";
import { getAuthResponseRole, getRedirectPathForRole } from "@/lib/auth";
import { AuthBackendProxyError, callAuthBackend, setAuthCookies } from "@/lib/auth-server";

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

    const responseRole = getAuthResponseRole(payload.data);
    const normalizedPayload =
      response.ok && payload.success && payload.data && responseRole
        ? {
            ...payload,
            data: {
              ...payload.data,
              role: responseRole,
              redirectPath:
                typeof payload.data.redirectPath === "string" && payload.data.redirectPath
                  ? payload.data.redirectPath
                  : getRedirectPathForRole(responseRole),
              user: payload.data.user
                ? {
                    ...payload.data.user,
                    role: responseRole,
                  }
                : payload.data.user,
            },
          }
        : payload;

    const nextResponse = NextResponse.json(normalizedPayload, {
      status: response.status,
    });

    if (
      response.ok &&
      normalizedPayload.success &&
      typeof normalizedPayload.data?.token === "string" &&
      responseRole
    ) {
      setAuthCookies(nextResponse, {
        token: normalizedPayload.data.token,
        role: responseRole,
        rememberMe,
      });
    } else if (!response.ok) {
      nextResponse.cookies.delete("bimbel_auth_token");
      nextResponse.cookies.delete("bimbel_auth_role");
    }

    return nextResponse;
  } catch (error) {
    if (error instanceof AuthBackendProxyError) {
      console.error("[auth-login] proxy_error", {
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
