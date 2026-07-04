import {
  Activity,
  Building2,
  GraduationCap,
  LayoutGrid,
  LucideIcon,
  ShieldCheck,
  UserCog,
  Users,
  WalletCards,
} from "lucide-react";

export type DashboardRole = "owner" | "admin" | "guru" | "siswa";

export type DashboardNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
};

export type DashboardConfig = {
  label: string;
  shortLabel: string;
  description: string;
  searchPlaceholder: string;
  notificationCount: number;
  user: {
    name: string;
    role: string;
    initials: string;
  };
  navItems: DashboardNavItem[];
  insight: {
    title: string;
    description: string;
  };
};

export const dashboardConfigs: Record<DashboardRole, DashboardConfig> = {
  owner: {
    label: "Owner / Super Admin",
    shortLabel: "Owner",
    description: "Monitoring lintas cabang berdasarkan data backend.",
    searchPlaceholder: "Cari cabang, membership siswa, atau pembayaran...",
    notificationCount: 0,
    user: {
      name: "",
      role: "Owner",
      initials: "OW",
    },
    navItems: [
      { label: "Overview", href: "/dashboard-owner", icon: LayoutGrid },
      { label: "Cabang", href: "/dashboard-owner/cabang", icon: Building2 },
      { label: "Aktivasi Siswa", href: "/dashboard-owner/aktivitas", icon: Activity },
    ],
    insight: {
      title: "",
      description: "",
    },
  },
  admin: {
    label: "Admin",
    shortLabel: "Admin",
    description: "Panel operasional cabang berdasarkan data backend.",
    searchPlaceholder: "Cari siswa, guru, kelas, atau pembayaran...",
    notificationCount: 0,
    user: {
      name: "",
      role: "Admin Cabang",
      initials: "AD",
    },
    navItems: [
      { label: "Dashboard", href: "/dashboard-admin", icon: LayoutGrid },
      { label: "Siswa", href: "/dashboard-admin/siswa", icon: Users },
      { label: "Guru", href: "/dashboard-admin/guru", icon: GraduationCap },
      { label: "Pembayaran", href: "/dashboard-admin/pembayaran", icon: WalletCards },
    ],
    insight: {
      title: "",
      description: "",
    },
  },
  guru: {
    label: "Guru",
    shortLabel: "Guru",
    description: "",
    searchPlaceholder: "",
    notificationCount: 0,
    user: {
      name: "",
      role: "Guru",
      initials: "GR",
    },
    navItems: [],
    insight: {
      title: "",
      description: "",
    },
  },
  siswa: {
    label: "Siswa",
    shortLabel: "Siswa",
    description: "",
    searchPlaceholder: "",
    notificationCount: 0,
    user: {
      name: "",
      role: "Siswa",
      initials: "SW",
    },
    navItems: [],
    insight: {
      title: "",
      description: "",
    },
  },
};

export const dashboardRoleIcons = {
  owner: ShieldCheck,
  admin: UserCog,
  guru: GraduationCap,
  siswa: Users,
} satisfies Record<DashboardRole, LucideIcon>;
