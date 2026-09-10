import { NextRequest } from "next/server";

import { proxyProtectedBackend } from "@/lib/backend-route";

export async function POST(request: NextRequest) {
  return proxyProtectedBackend(request, "/api/admin/question-bank/import/pdf/preview", {
    method: "POST",
    headers: { "Content-Type": "application/pdf" },
    body: await request.arrayBuffer(),
  });
}
