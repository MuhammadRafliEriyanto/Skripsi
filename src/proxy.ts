import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  AUTH_ROLE_COOKIE_NAME,
  AUTH_TOKEN_COOKIE_NAME,
  getRedirectPathForRole,
  isUserRole,
} from "@/lib/auth";


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
    // We intentionally removed the strict redirect to /register-online/status here.
    // The client-side StudentMembershipAccessGate will handle rendering the locked
    // state (banner/dialog) or allowing access based on paymentStatus and startDate.
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
