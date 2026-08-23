"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminSchedule } from "@/components/dashboard-admin/AdminSchedule";
import {
  defaultAdminDashboardConfig,
  fetchAdminDashboardConfig,
} from "@/lib/admin-dashboard-config";

export default function AdminJadwalPage() {
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
      <AdminSchedule
        dashboardConfig={dashboardConfig}
        onRefresh={() => {}}
        globalSearchQuery={globalSearchQuery}
      />
    </div>
  );
}
