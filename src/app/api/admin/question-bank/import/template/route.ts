import { NextRequest } from "next/server";

import { proxyProtectedBackendRaw } from "@/lib/backend-route";

export async function GET(request: NextRequest) {
  return proxyProtectedBackendRaw(request, "/api/admin/question-bank/import/template", { method: "GET" });
}
