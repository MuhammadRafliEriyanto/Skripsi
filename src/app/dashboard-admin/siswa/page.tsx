"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminStudents } from "@/components/dashboard-admin/AdminStudents";
import {
  defaultAdminDashboardConfig,
  fetchAdminDashboardConfig,
} from "@/lib/admin-dashboard-config";

export default function AdminSiswaPage() {
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
      <AdminStudents
        dashboardConfig={dashboardConfig}
        onRefresh={() => {}} // No-op since overview metrics are not on this page
        globalSearchQuery={globalSearchQuery}
      />
    </div>
  );
}
