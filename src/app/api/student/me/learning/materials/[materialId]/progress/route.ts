import { NextRequest } from "next/server";

import { proxyProtectedBackend, readRequestBody } from "@/lib/backend-route";

type RouteContext = {
  params: Promise<{
    materialId: string;
  }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { materialId } = await params;
  const body = await readRequestBody(request);

  return proxyProtectedBackend(
    request,
    `/api/student/me/learning/materials/${encodeURIComponent(materialId)}/progress`,
    {
      method: "POST",
      body,
    },
  );
}
