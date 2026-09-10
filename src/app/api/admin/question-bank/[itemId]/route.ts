import { NextRequest } from "next/server";

import { proxyProtectedBackend, readRequestBody } from "@/lib/backend-route";

type RouteContext = { params: Promise<{ itemId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { itemId } = await context.params;
  return proxyProtectedBackend(request, `/api/admin/question-bank/${encodeURIComponent(itemId)}`, {
    method: "PATCH",
    body: await readRequestBody(request),
  });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { itemId } = await context.params;
  return proxyProtectedBackend(request, `/api/admin/question-bank/${encodeURIComponent(itemId)}`, {
    method: "DELETE",
  });
}
