import { NextRequest } from "next/server";

import { proxyProtectedBackend, readRequestBody } from "@/lib/backend-route";

type RouteContext = {
  params: Promise<{
    taskId: string;
  }>;
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { taskId } = await params;

  return proxyProtectedBackend(
    request,
    `/api/student/me/learning/tasks/${encodeURIComponent(taskId)}/submission`,
    {
      method: "GET",
    },
  );
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { taskId } = await params;
  const body = await readRequestBody(request);

  return proxyProtectedBackend(
    request,
    `/api/student/me/learning/tasks/${encodeURIComponent(taskId)}/submission`,
    {
      method: "POST",
      body,
    },
  );
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { taskId } = await params;
  const body = await readRequestBody(request);

  return proxyProtectedBackend(
    request,
    `/api/student/me/learning/tasks/${encodeURIComponent(taskId)}/submission`,
    {
      method: "PATCH",
      body,
    },
  );
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const { taskId } = await params;

  return proxyProtectedBackend(
    request,
    `/api/student/me/learning/tasks/${encodeURIComponent(taskId)}/submission`,
    {
      method: "DELETE",
    },
  );
}
