import { type NextRequest } from "next/server";

import { proxyProtectedBackend, readRequestBody } from "@/lib/backend-route";

type RouteContext = {
  params: Promise<{
    attemptId: string;
  }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { attemptId } = await params;
  const body = await readRequestBody(request);

  return proxyProtectedBackend(
    request,
    `/api/student/me/learning/tasks/cbt/${encodeURIComponent(attemptId)}/submission`,
    {
      method: "POST",
      body,
    },
  );
}
