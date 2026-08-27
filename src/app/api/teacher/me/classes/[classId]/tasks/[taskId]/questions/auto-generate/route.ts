import { type NextRequest } from "next/server";

import { proxyProtectedBackend, readRequestBody } from "@/lib/backend-route";

type RouteContext = {
  params: Promise<{
    classId: string;
    taskId: string;
  }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { classId, taskId } = await params;
  const body = await readRequestBody(request);

  return proxyProtectedBackend(
    request,
    `/api/teacher/me/classes/${encodeURIComponent(classId)}/tasks/${encodeURIComponent(taskId)}/questions/auto-generate`,
    {
      method: "POST",
      body,
    },
  );
}
