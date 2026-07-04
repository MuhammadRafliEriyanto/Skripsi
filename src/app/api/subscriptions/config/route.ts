import { proxyPublicBackend } from "@/lib/backend-route";

export async function GET() {
  return proxyPublicBackend("/api/subscriptions/config", {
    method: "GET",
  });
}
