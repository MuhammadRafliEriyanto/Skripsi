"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminPaymentVerification } from "@/components/dashboard-admin/AdminPaymentVerification";
import {
  defaultAdminDashboardConfig,
  fetchAdminDashboardConfig,
} from "@/lib/admin-dashboard-config";

export default function AdminPembayaranPage() {
  const searchParams = useSearchParams();
  const globalSearchQuery = searchParams?.get("q") || "";
  const [dashboardConfig, setDashboardConfig] = useState(defaultAdminDashboardConfig);

  useEffect(() => {
    fetchAdminDashboardConfig()
      .then(setDashboardConfig)
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <AdminPaymentVerification
        dashboardConfig={dashboardConfig}
        onRefresh={() => {}}
        globalSearchQuery={globalSearchQuery}
      />
    </div>
  );
}
