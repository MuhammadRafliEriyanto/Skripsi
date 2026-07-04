import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  AUTH_ROLE_COOKIE_NAME,
  AUTH_TOKEN_COOKIE_NAME,
  getRedirectPathForRole,
  isUserRole,
} from "@/lib/auth";

const MEMBERSHIP_ACCESS_VALUES = ["active", "pending", "expired", "not_registered"] as const;

type MembershipAccessStatus = (typeof MEMBERSHIP_ACCESS_VALUES)[number];

type MembershipProxyResult = {
  accessStatus: MembershipAccessStatus | null;
  shouldClearSession: boolean;
};

function redirectToLogin(request: NextRequest, clearCookies = false) {
  const loginUrl = new URL("/login", request.url);
  const destination = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  if (request.nextUrl.pathname.startsWith("/dashboard-")) {
    loginUrl.searchParams.set("redirect", destination);
  }

  const response = NextResponse.redirect(loginUrl);

  if (clearCookies) {
    response.cookies.delete(AUTH_TOKEN_COOKIE_NAME);
    response.cookies.delete(AUTH_ROLE_COOKIE_NAME);
  }

  return response;
}

async function getStudentMembershipAccess(token: string): Promise<MembershipProxyResult> {
  const baseUrl = process.env.AUTH_API_URL?.trim();
  const apiKey = process.env.AUTH_API_KEY?.trim();

  if (!baseUrl || !apiKey) {
    return {
      accessStatus: null,
      shouldClearSession: false,
    };
  }

  try {
    const response = await fetch(
      `${baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl}/api/subscriptions/me`,
      {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      },
    );

    if (response.status === 401) {
      return {
        accessStatus: null,
        shouldClearSession: false,
      };
    }

    const payload = (await response.json().catch(() => null)) as
      | {
          success?: boolean;
          data?: {
            accessStatus?: string;
          };
        }
      | null;

    if (!response.ok || !payload?.success) {
      return {
        accessStatus: null,
        shouldClearSession: false,
      };
    }

    const accessStatus = payload.data?.accessStatus;

    return {
      accessStatus:
        accessStatus &&
        MEMBERSHIP_ACCESS_VALUES.includes(accessStatus as MembershipAccessStatus)
          ? (accessStatus as MembershipAccessStatus)
          : null,
      shouldClearSession: false,
    };
  } catch (error) {
    console.error("[proxy] membership_check_failed", {
      message: error instanceof Error ? error.message : "Unknown proxy error",
    });

    return {
      accessStatus: null,
      shouldClearSession: false,
    };
  }
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const token = request.cookies.get(AUTH_TOKEN_COOKIE_NAME)?.value;
  const roleValue = request.cookies.get(AUTH_ROLE_COOKIE_NAME)?.value;
  const isAuthPage = pathname === "/login" || pathname === "/register";
  const isDashboardPage = pathname.startsWith("/dashboard-");

  if (isAuthPage && token && isUserRole(roleValue)) {
    return NextResponse.redirect(new URL(getRedirectPathForRole(roleValue), request.url));
  }

  if (!isDashboardPage) {
    return NextResponse.next();
  }

  if (!token || !roleValue) {
    return redirectToLogin(request);
  }

  if (!isUserRole(roleValue)) {
    return redirectToLogin(request, true);
  }

  const redirectPath = getRedirectPathForRole(roleValue);

  if (!pathname.startsWith(redirectPath)) {
    return NextResponse.redirect(new URL(redirectPath, request.url));
  }

  if (roleValue === "siswa" && pathname.startsWith("/dashboard-siswa") && token) {
    const membership = await getStudentMembershipAccess(token);

    if (membership.accessStatus && membership.accessStatus !== "active") {
      const membershipUrl = new URL("/register-online/status", request.url);
      membershipUrl.searchParams.set("access", membership.accessStatus);
      return NextResponse.redirect(membershipUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/register",
    "/dashboard-owner/:path*",
    "/dashboard-admin/:path*",
    "/dashboard-guru/:path*",
    "/dashboard-siswa/:path*",
  ],
};
