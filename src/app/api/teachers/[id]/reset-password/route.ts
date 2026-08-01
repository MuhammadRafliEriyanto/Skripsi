import { NextRequest } from "next/server";

import { proxyProtectedBackend } from "@/lib/backend-route";

type TeacherResetPasswordRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(
  request: NextRequest,
  context: TeacherResetPasswordRouteContext,
) {
  const { id } = await context.params;

  return proxyProtectedBackend(
    request,
    `/api/teachers/${encodeURIComponent(id)}/reset-password`,
    {
      method: "POST",
    },
  );
}
