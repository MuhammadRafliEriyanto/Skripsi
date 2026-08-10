import { NextRequest } from "next/server";

import { proxyProtectedBackend } from "@/lib/backend-route";

type TeacherResendVerificationRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(
  request: NextRequest,
  context: TeacherResendVerificationRouteContext,
) {
  const { id } = await context.params;

  return proxyProtectedBackend(
    request,
    `/api/teachers/${encodeURIComponent(id)}/resend-verification`,
    {
      method: "POST",
    },
  );
}
