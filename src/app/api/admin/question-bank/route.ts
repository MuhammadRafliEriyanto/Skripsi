import { NextRequest } from "next/server";
import { proxyProtectedBackend, readRequestBody } from "@/lib/backend-route";

export async function GET(request: NextRequest) { return proxyProtectedBackend(request, "/api/admin/question-bank", { method: "GET" }); }

export async function POST(request: NextRequest) {
  return proxyProtectedBackend(request, "/api/admin/question-bank", {
    method: "POST",
    body: await readRequestBody(request),
  });
}
