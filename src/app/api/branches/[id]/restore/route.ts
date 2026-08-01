import { NextRequest } from "next/server";

import { proxyProtectedBackend } from "@/lib/backend-route";

type RestoreBranchRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PUT(request: NextRequest, context: RestoreBranchRouteContext) {
  const { id } = await context.params;

  return proxyProtectedBackend(request, `/api/branches/${encodeURIComponent(id)}/restore`, {
    method: "PUT",
  });
}
