import { NextRequest } from "next/server";

import { proxyProtectedBackend } from "@/lib/backend-route";

type ExpenseRestoreRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(
  request: NextRequest,
  context: ExpenseRestoreRouteContext,
) {
  const { id } = await context.params;

  return proxyProtectedBackend(
    request,
    `/api/expenses/${encodeURIComponent(id)}/restore`,
    {
      method: "POST",
    },
  );
}
