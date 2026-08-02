import { NextRequest } from "next/server";

import { proxyProtectedBackend } from "@/lib/backend-route";

type StudentResetPasswordRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(
  request: NextRequest,
  context: StudentResetPasswordRouteContext,
) {
  const { id } = await context.params;

  return proxyProtectedBackend(
    request,
    `/api/students/${encodeURIComponent(id)}/reset-password`,
    {
      method: "POST",
    },
  );
}
