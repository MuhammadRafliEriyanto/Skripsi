import { NextRequest } from "next/server";

import { proxyProtectedBackend } from "@/lib/backend-route";

type RouteParams = {
  params: Promise<{
    paymentId: string;
  }>;
};

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { paymentId } = await params;

  return proxyProtectedBackend(
    request,
    `/api/payments/admin/${encodeURIComponent(paymentId)}/restore`,
    {
      method: "POST",
    },
  );
}
