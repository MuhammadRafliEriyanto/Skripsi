import { type NextRequest } from "next/server";

import { proxyProtectedBackend } from "@/lib/backend-route";

type RouteContext = {
  params: Promise<{
    attemptId: string;
  }>;
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { attemptId } = await params;

  return proxyProtectedBackend(
    request,
    `/api/student/me/learning/tasks/cbt/${encodeURIComponent(attemptId)}`,
    {
      method: "GET",
    },
  );
}
