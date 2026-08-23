"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, Suspense } from "react";
import { AdminSidebar, type AdminSidebarBadgeCounts } from "./AdminSidebar";
import { AdminTopbar } from "./AdminTopbar";
import { cn } from "@/lib/utils";
import { getCurrentAdminAcademicYear } from "@/lib/admin-academic-year";
import { ADMIN_DASHBOARD_DATA_CHANGED_EVENT } from "@/lib/admin-dashboard-events";
import { adminPoppins } from "./components/admin-font";
import {
  fetchAdminSchedules,
  fetchAdminStudents,
  fetchAdminTeachers,
} from "@/lib/admin-directory";
import { fetchAdminPaymentSummary } from "@/lib/admin-payments";
import type { AdminTab } from "./admin-data";

function AdminLayoutClientInner({ children }: { children: React.ReactNode }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentAcademicYear = getCurrentAdminAcademicYear();
  
  const [studentActiveCount, setStudentActiveCount] = useState(0);
  const [teacherActiveCount, setTeacherActiveCount] = useState(0);
  const [scheduleReviewCount, setScheduleReviewCount] = useState(0);
  const [paymentPendingCount, setPaymentPendingCount] = useState(0);

  const loadDashboardMetrics = useCallback(() => {
    fetchAdminStudents({ page: 1, limit: 1 }).then(res => setStudentActiveCount(res.summary.activeCount)).catch(() => {});
    fetchAdminTeachers({ page: 1, limit: 1 }).then(res => setTeacherActiveCount(res.summary.activeCount)).catch(() => {});
    fetchAdminSchedules({ page: 1, limit: 1, academicYear: currentAcademicYear }).then(res => setScheduleReviewCount(res.summary.reviewCount)).catch(() => {});
    
    const today = new Date();
    const start = new Date(today.getFullYear(), 0, 1).toISOString();
    const end = new Date(today.setHours(23, 59, 59, 999)).toISOString();
    fetchAdminPaymentSummary({ period: "year", dateFrom: start, dateTo: end }).then(res => setPaymentPendingCount(res.summary.pendingCount)).catch(() => {});
  }, [currentAcademicYear]);

  useEffect(() => {
    loadDashboardMetrics();
  }, [loadDashboardMetrics]);

  useEffect(() => {
    window.addEventListener(
      ADMIN_DASHBOARD_DATA_CHANGED_EVENT,
      loadDashboardMetrics,
    );

    return () => {
      window.removeEventListener(
        ADMIN_DASHBOARD_DATA_CHANGED_EVENT,
        loadDashboardMetrics,
      );
    };
  }, [loadDashboardMetrics]);

  const sidebarBadgeCounts: AdminSidebarBadgeCounts = {
    students: studentActiveCount,
    teachers: teacherActiveCount,
    payments: paymentPendingCount,
    schedule: scheduleReviewCount,
  };

  const getActiveTab = (): AdminTab => {
    if (pathname.includes("/siswa")) return "students";
    if (pathname.includes("/guru")) return "teachers";
    if (pathname.includes("/pembayaran")) return "payments";
    if (pathname.includes("/jadwal")) return "schedule";
    if (pathname.includes("/monitoring-akademik")) return "utbkAssessments";
    if (pathname.includes("/akademik")) return "utbkAssessments";
    if (pathname.includes("/penilaian-utbk")) return "utbkAssessments";
    if (pathname.includes("/profil")) return "profile";
    return "overview";
  };

  const activeTab = getActiveTab();

  const handleSelectTab = (tab: AdminTab) => {
    switch (tab) {
      case "students": router.push("/dashboard-admin/siswa"); break;
      case "teachers": router.push("/dashboard-admin/guru"); break;
      case "payments": router.push("/dashboard-admin/pembayaran"); break;
      case "schedule": router.push("/dashboard-admin/jadwal"); break;
      case "utbkAssessments": router.push("/dashboard-admin/monitoring-akademik"); break;
      case "profile": router.push("/dashboard-admin/profil"); break;
      default: router.push("/dashboard-admin"); break;
    }
  };

  return (
    <div className={cn("min-h-screen bg-white", adminPoppins.className)}>
      <AdminSidebar
        activeTab={activeTab}
        onSelect={handleSelectTab}
        badgeCounts={sidebarBadgeCounts}
        collapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed((prev) => !prev)}
        className="fixed inset-y-0 left-0 z-20"
      />
      
      <div
        className={cn(
          "flex min-h-screen flex-1 flex-col transition-[padding] duration-200",
          isSidebarCollapsed ? "lg:pl-20" : "lg:pl-[236px]",
        )}
      >
        <AdminTopbar
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          sidebarBadgeCounts={sidebarBadgeCounts}
        />
        <main className="flex-1 p-5 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AdminLayoutClientInner>{children}</AdminLayoutClientInner>
    </Suspense>
  );
}
