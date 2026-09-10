import { NextRequest } from "next/server";
import { proxyProtectedBackend, readRequestBody } from "@/lib/backend-route";

export async function PATCH(request: NextRequest, context: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await context.params;
  return proxyProtectedBackend(request, `/api/admin/question-bank/${encodeURIComponent(itemId)}/status`, { method: "PATCH", body: await readRequestBody(request) });
}
