import { NextRequest } from "next/server";

import { proxyProtectedBackend } from "@/lib/backend-route";

export async function PATCH(request: NextRequest) {
  return proxyProtectedBackend(request, "/api/admin/question-bank/bulk-status", {
    method: "PATCH",
    body: await request.text(),
  });
}
