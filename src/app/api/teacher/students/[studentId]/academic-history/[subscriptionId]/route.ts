import { NextRequest } from "next/server";

import { proxyProtectedBackend } from "@/lib/backend-route";

type RouteContext = {
  params: Promise<{
    studentId: string;
    subscriptionId: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { studentId, subscriptionId } = await context.params;

  return proxyProtectedBackend(
    request,
    `/api/teacher/students/${encodeURIComponent(
      studentId,
    )}/academic-history/${encodeURIComponent(subscriptionId)}`,
    {
      method: "GET",
    },
  );
}
