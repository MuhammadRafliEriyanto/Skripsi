import { NextRequest } from "next/server";

import { proxyProtectedBackend, readRequestBody } from "@/lib/backend-route";

type Context = { params: Promise<{ itemId: string }> };

async function backendPath(context: Context) {
  const { itemId } = await context.params;
  return `/api/teacher/me/question-bank/${encodeURIComponent(itemId)}`;
}

export async function PATCH(request: NextRequest, context: Context) {
  return proxyProtectedBackend(request, await backendPath(context), {
    method: "PATCH",
    body: await readRequestBody(request),
  });
}

export async function DELETE(request: NextRequest, context: Context) {
  return proxyProtectedBackend(request, await backendPath(context), { method: "DELETE" });
}
