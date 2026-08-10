import { NextRequest } from "next/server";

import { proxyProtectedBackend, readRequestBody } from "@/lib/backend-route";

type RouteContext = {
  params: Promise<{
    classId: string;
    taskId: string;
  }>;
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { classId, taskId } = await params;
  const body = await readRequestBody(request);

  return proxyProtectedBackend(
    request,
    `/api/teacher/me/classes/${encodeURIComponent(classId)}/tasks/${encodeURIComponent(taskId)}`,
    {
      method: "PATCH",
      body,
    },
  );
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { classId, taskId } = await params;
  const body = await readRequestBody(request);

  return proxyProtectedBackend(
    request,
    `/api/teacher/me/classes/${encodeURIComponent(classId)}/tasks/${encodeURIComponent(taskId)}/questions/xlsx`,
    {
      method: "POST",
      body,
    },
  );
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const { classId, taskId } = await params;

  return proxyProtectedBackend(
    request,
    `/api/teacher/me/classes/${encodeURIComponent(classId)}/tasks/${encodeURIComponent(taskId)}`,
    {
      method: "DELETE",
    },
  );
}
