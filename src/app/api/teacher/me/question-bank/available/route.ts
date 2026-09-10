import { NextRequest } from "next/server";
import { proxyProtectedBackend } from "@/lib/backend-route";

export async function GET(request: NextRequest) {
  return proxyProtectedBackend(request, "/api/teacher/me/question-bank/available", { method: "GET" });
}
