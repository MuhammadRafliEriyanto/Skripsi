import { NextRequest } from "next/server";

import { proxyProtectedBackend } from "@/lib/backend-route";

type StudentResendVerificationRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(
  request: NextRequest,
  context: StudentResendVerificationRouteContext,
) {
  const { id } = await context.params;

  return proxyProtectedBackend(
    request,
    `/api/students/${encodeURIComponent(id)}/resend-verification`,
    {
      method: "POST",
    },
  );
}
