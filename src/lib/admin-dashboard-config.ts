import { requestAdminApi } from "@/lib/admin-api";

export type AdminAcademicLevel = "SD" | "SMP" | "SMA";
export type AdminStudentStatus = "Aktif" | "Nonaktif";
export type AdminTeacherAvailability = "Tersedia" | "Padat" | "Cuti";
export type AdminScheduleStatus = "Berjalan" | "Siap" | "Review" | "Bentrok";

export type AdminBillingPackage = {
  packageKey: string;
  packageName: string;
  durationMonth: number;
  amount: number;
};

export type AdminDashboardConfigData = {
  academic: {
    levels: AdminAcademicLevel[];
    gradesByLevel: Record<AdminAcademicLevel, string[]>;
  };
  student: {
    statuses: AdminStudentStatus[];
    classOptions: string[];
    classOptionsByLevel: Record<AdminAcademicLevel, string[]>;
  };
  teacher: {
    statuses: AdminStudentStatus[];
    availabilities: AdminTeacherAvailability[];
  };
  schedule: {
    statuses: AdminScheduleStatus[];
    subjects: string[];
    timeSlots: string[];
    days: string[];
  };
  payment: {
    billingPackages: AdminBillingPackage[];
    batchClassOptionsByLevel: Record<AdminAcademicLevel, string[]>;
  };
};

export const defaultAdminDashboardConfig: AdminDashboardConfigData = {
  academic: {
    levels: [],
    gradesByLevel: {
      SD: [],
      SMP: [],
      SMA: [],
    },
  },
  student: {
    statuses: [],
    classOptions: [],
    classOptionsByLevel: {
      SD: [],
      SMP: [],
      SMA: [],
    },
  },
  teacher: {
    statuses: [],
    availabilities: [],
  },
  schedule: {
    statuses: [],
    subjects: [],
    timeSlots: [],
    days: [],
  },
  payment: {
    billingPackages: [],
    batchClassOptionsByLevel: {
      SD: [],
      SMP: [],
      SMA: [],
    },
  },
};

export async function fetchAdminDashboardConfig() {
  const response = await requestAdminApi<AdminDashboardConfigData>(
    "/api/admin/dashboard-config",
    {
      method: "GET",
    },
  );

  return response.data as AdminDashboardConfigData;
}
