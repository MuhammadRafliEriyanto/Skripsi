import { NextRequest } from "next/server";

import { proxyProtectedBackend } from "@/lib/backend-route";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  return proxyProtectedBackend(
    request,
    `/api/branches/admin-accounts/${encodeURIComponent(id)}/reset-password`,
    {
      method: "POST",
    },
  );
}
