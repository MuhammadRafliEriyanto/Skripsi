import { NextRequest } from "next/server";

import { proxyProtectedBackend } from "@/lib/backend-route";

type RouteContext = {
  params: Promise<{
    subscriptionId: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { subscriptionId } = await context.params;

  return proxyProtectedBackend(
    request,
    `/api/student/me/academic-history/${encodeURIComponent(subscriptionId)}`,
    {
      method: "GET",
    },
  );
}
