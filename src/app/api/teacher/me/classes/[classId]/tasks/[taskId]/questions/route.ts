import { type NextRequest } from "next/server";

import { proxyProtectedBackend } from "@/lib/backend-route";

type RouteContext = {
  params: Promise<{
    classId: string;
    taskId: string;
  }>;
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { classId, taskId } = await params;

  return proxyProtectedBackend(
    request,
    `/api/teacher/me/classes/${encodeURIComponent(classId)}/tasks/${encodeURIComponent(taskId)}/questions`,
    {
      method: "GET",
    },
  );
}
