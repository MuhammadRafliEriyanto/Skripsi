import { NextRequest } from "next/server";

import {
  proxyProtectedBackend,
  readRequestBody,
} from "@/lib/backend-route";

export async function POST(request: NextRequest) {
  const body = await readRequestBody(request);

  return proxyProtectedBackend(request, "/api/payments/admin/create-offline-renewal", {
    method: "POST",
    body,
  });
}
