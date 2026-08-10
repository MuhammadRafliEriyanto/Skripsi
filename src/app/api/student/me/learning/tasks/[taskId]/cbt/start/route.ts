import { type NextRequest } from "next/server";

import { proxyProtectedBackend } from "@/lib/backend-route";

type RouteContext = {
  params: Promise<{
    taskId: string;
  }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { taskId } = await params;

  return proxyProtectedBackend(
    request,
    `/api/student/me/learning/tasks/${encodeURIComponent(taskId)}/cbt/start`,
    {
      method: "POST",
    },
  );
}
