"use client";

import {
  Download,
  Eye,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";

import { requestAdminApi } from "@/lib/admin-api";
import {
  getAdminAcademicYearLockMessage,
  getAdminAcademicYearOptions,
  getAdminAcademicYearStatus,
  getCurrentAdminAcademicYear,
} from "@/lib/admin-academic-year";
import {
  defaultAdminDashboardConfig,
  type AdminDashboardConfigData,
} from "@/lib/admin-dashboard-config";
import {
  exportAdminStudentsCsv,
  fetchAdminStudents,
  type AdminStudentsSummary,
} from "@/lib/admin-directory";
import {
  getPriceByClassAndPackage,
  type OnlinePackageDefinition,
} from "@/lib/subscription";
import { useSubscriptionConfig } from "@/lib/use-subscription-config";
import { formatCurrency, cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import type { AdminStudent } from "./admin-data";
import {
  AdminDataTable,
  type AdminColumnDefinition,
} from "./components/AdminDataTable";
import { AdminPaginationFooter } from "./components/AdminPaginationFooter";
import { AdminSectionCard } from "./components/AdminSectionCard";
import { AdminStatusBadge } from "./components/AdminStatusBadge";

type AdminStudentsProps = {
  dashboardConfig?: AdminDashboardConfigData;
  onRefresh?: () => Promise<void> | void;
  globalSearchQuery?: string;
};

type StudentFormValues = {
  name: string;
  email: string;
  phone: string;
  branch: string;
  program: string;
  className: string;
  birthDate: string;
  academicYear: string;
  password?: string;
  status: AdminStudent["status"];
  membershipPaymentMode: StudentMembershipPaymentMode;
  membershipPackageKey: string;
  membershipPaymentMethod: StudentMembershipPaymentMethod;
  membershipPaidAt: string;
};

type StudentImportSummary = {
  totalRows: number;
  importedRows: number;
  failedRows: number;
  skippedRows: number;
};

type StudentImportIssue = {
  rowNumber: number;
  name: string;
  className: string;
  program: string;
  status: "failed" | "skipped";
  reason: string;
};

type StudentImportResponse = {
  fileName: string;
  sheetName: string;
  summary: StudentImportSummary;
  issues: StudentImportIssue[];
};

type DeleteStudentResponse = {
  deletionMode?: "deleted" | "archived";
  paymentCount?: number;
  subscriptionCount?: number;
};

type StudentActionFeedback = {
  tone: "success" | "warning";
  message: string;
};

type StudentLevelFilterOption = AdminStudent["level"] | "Semua";
type StudentStatusFilterOption = AdminStudent["status"] | "Semua";
type StudentMembershipTone = "default" | "success" | "warning" | "danger";
type StudentMembershipPaymentMode = "paid";
type StudentMembershipPaymentMethod = "cash" | "manual_transfer" | "qris_offline";

type BranchApiItem = {
  name?: string;
};

const unassignedBranchValue = "__unassigned_branch__";
const paidOfflineMembershipValue = "paid" satisfies StudentMembershipPaymentMode;
const offlinePaymentMethodLabels: Record<StudentMembershipPaymentMethod, string> = {
  cash: "Tunai",
  manual_transfer: "Transfer Manual",
  qris_offline: "QRIS Offline",
};
const studentImportColumns = [
  "nama",
  "kelas",
  "asal sekolah",
  "cabang (opsional)",
] as const;
const warmFieldClassName =
  "border-slate-200 hover:border-orange-200 focus:border-orange-300 focus:ring-4 focus:ring-orange-500/10 focus-visible:border-orange-300 focus-visible:ring-4 focus-visible:ring-orange-500/10";
const warmSelectTriggerClassName =
  "border-slate-200 hover:border-orange-200 focus:border-orange-300 focus:ring-4 focus:ring-orange-500/10 focus-visible:border-orange-300 focus-visible:ring-4 focus-visible:ring-orange-500/10 data-[state=open]:border-orange-300 data-[state=open]:ring-4 data-[state=open]:ring-orange-500/10";
const warmSelectContentClassName =
  "border-orange-100/80 shadow-lg shadow-orange-100/20";
const warmSelectItemClassName =
  "hover:bg-orange-50 hover:text-orange-700 focus:bg-orange-50 focus:text-orange-700 data-[highlighted]:bg-orange-50 data-[highlighted]:text-orange-700 data-[state=checked]:bg-orange-50 data-[state=checked]:text-orange-700";
const warmOutlineButtonClassName =
  "border-slate-200 bg-white text-slate-700 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700 active:border-orange-300 active:bg-orange-100/80 active:text-orange-800 focus-visible:border-orange-300 focus-visible:ring-orange-500/10";
const warmPrimaryButtonClassName =
  "bg-orange-600 hover:bg-orange-700 active:bg-orange-800 focus-visible:ring-orange-500/20";
const warmOverlayPanelClassName =
  "[&>button]:hover:bg-orange-50 [&>button]:hover:text-orange-700 [&>button]:focus-visible:ring-orange-500/10";
const warmAvatarFallbackClassName =
  "bg-gradient-to-br from-orange-500 to-amber-400";
const warmFileInputClassName =
  "block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition hover:border-orange-200 focus:border-orange-300 focus:ring-4 focus:ring-orange-500/10 focus-visible:border-orange-300 focus-visible:ring-4 focus-visible:ring-orange-500/10 file:mr-4 file:rounded-xl file:border-0 file:bg-orange-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-orange-700";

function toDateInputValue(date = new Date()) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);

  return offsetDate.toISOString().slice(0, 10);
}

function createEmptyStudentForm(
  defaultClassName: string,
  defaultPackageKey = "",
  defaultAcademicYear = getCurrentAdminAcademicYear(),
): StudentFormValues {
  return {
    name: "",
    email: "",
    phone: "-",
    branch: "",
    program: "-",
    className: defaultClassName,
    birthDate: "",
    academicYear: defaultAcademicYear,
    password: "",
    status: "Aktif",
    membershipPaymentMode: paidOfflineMembershipValue,
    membershipPackageKey: defaultPackageKey,
    membershipPaymentMethod: "cash",
    membershipPaidAt: toDateInputValue(),
  };
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string) {
  return value.trim().replace(/\s+/g, "");
}

function normalizeBranchKey(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function buildBranchOptions(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim().replace(/\s+/g, " ")).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right, "id"));
}

function getRegisteredBranchName(value: string, branchOptions: string[]) {
  const branchKey = normalizeBranchKey(value);

  if (!branchKey) {
    return "";
  }

  return (
    branchOptions.find((branch) => normalizeBranchKey(branch) === branchKey) ?? ""
  );
}

function normalizeClassNameInput(value: string) {
  const cleanedValue = value.trim().toUpperCase().replace(/\s+/g, " ");
  const gradeMatch = cleanedValue.match(/\b(2|3|4|5|6|7|8|9|10|11|12)\b/);

  if (!gradeMatch) {
    return null;
  }

  const grade = Number(gradeMatch[1]);

  if (cleanedValue.includes("SD")) {
    return grade >= 2 && grade <= 6 ? `SD ${grade}` : null;
  }

  if (cleanedValue.includes("SMP")) {
    return grade >= 7 && grade <= 9 ? `SMP ${grade}` : null;
  }

  if (cleanedValue.includes("SMA")) {
    return grade >= 10 && grade <= 12 ? `SMA ${grade}` : null;
  }

  if (grade >= 2 && grade <= 6) {
    return `SD ${grade}`;
  }

  if (grade >= 7 && grade <= 9) {
    return `SMP ${grade}`;
  }

  if (grade >= 10 && grade <= 12) {
    return `SMA ${grade}`;
  }

  return null;
}

function normalizeBirthDateInput(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  let year = "";
  let month = "";
  let day = "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
    [year, month, day] = trimmedValue.split("-");
  } else if (/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(trimmedValue)) {
    [day, month, year] = trimmedValue.split(/[/-]/);
  } else {
    return null;
  }

  const yearValue = Number(year);
  const monthValue = Number(month);
  const dayValue = Number(day);
  const parsedDate = new Date(Date.UTC(yearValue, monthValue - 1, dayValue));

  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.getUTCFullYear() !== yearValue ||
    parsedDate.getUTCMonth() !== monthValue - 1 ||
    parsedDate.getUTCDate() !== dayValue
  ) {
    return null;
  }

  return `${year}-${month}-${day}`;
}

function formatBirthDateForDisplay(birthDate: string) {
  const normalizedDate = normalizeBirthDateInput(birthDate);

  if (!normalizedDate) {
    return "-";
  }

  const [year, month, day] = normalizedDate.split("-");

  return `${day}/${month}/${year}`;
}

function toStudentFormValues(student: AdminStudent): StudentFormValues {
  return {
    name: student.name,
    email: student.email,
    phone: student.phone,
    branch: student.branch,
    program: student.program,
    className: student.className,
    birthDate: student.birthDate,
    academicYear: student.academicYear || getCurrentAdminAcademicYear(),
    password: "",
    status: student.status,
    membershipPaymentMode: paidOfflineMembershipValue,
    membershipPackageKey: student.membership?.packageKey ?? "",
    membershipPaymentMethod: "cash",
    membershipPaidAt: toDateInputValue(),
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("File import siswa tidak dapat dibaca."));
    };
    reader.onerror = () => {
      reject(new Error("File import siswa tidak dapat dibaca."));
    };
    reader.readAsDataURL(file);
  });
}

function StudentField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-700">{label}</p>
      {children}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-slate-200/80 bg-white/95 p-4 shadow-[0_12px_26px_-22px_rgba(15,23,42,0.14)]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}

function StudentActions({
  student,
  branchOptions,
  readOnly = false,
  readOnlyMessage = "",
  onEdit,
  onDelete,
  onToggleStatus,
}: {
  student: AdminStudent;
  branchOptions: string[];
  readOnly?: boolean;
  readOnlyMessage?: string;
  onEdit: (student: AdminStudent) => void;
  onDelete: (student: AdminStudent) => void;
  onToggleStatus: (student: AdminStudent) => void;
}) {
  const status = student.membership?.status || "none";
  let label = "Belum Membership";
  let tone: StudentMembershipTone = "default";

  if (status === "active") {
    label = "Aktif";
    tone = "success";
  } else if (status === "pending") {
    label = "Menunggu Mulai";
    tone = "warning";
  } else if (status === "expired") {
    label = "Expired";
    tone = "danger";
  }
  return (
    <div className="flex items-center justify-center gap-1.5">
      <Sheet>
        <SheetTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={`size-9 rounded-xl p-0 text-slate-500 shadow-sm transition ${warmOutlineButtonClassName}`}
            aria-label={`Lihat detail ${student.name}`}
            title="Detail"
          >
            <Eye className="size-4" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="right"
          className={`w-[92vw] overflow-y-auto sm:max-w-lg ${warmOverlayPanelClassName}`}
        >
          <SheetHeader>
            <SheetTitle>Detail siswa</SheetTitle>
            <SheetDescription>
              Ringkasan profil siswa, kode login, kelas aktif, dan password hasil generate.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-5">
            <div className="flex items-center gap-4 rounded-[22px] border border-orange-100/70 bg-gradient-to-r from-orange-50/85 to-white p-4 shadow-[0_16px_32px_-24px_rgba(249,115,22,0.22)]">
              <Avatar className="size-14 rounded-full">
                <AvatarFallback className={cn(warmAvatarFallbackClassName, "rounded-full")}>
                  {getInitials(student.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-base font-semibold text-slate-950">
                  {student.name}
                </p>
                <p className="truncate text-sm text-slate-500">
                  Kode login: {student.loginCode || student.id}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <DetailItem label="Kode Login" value={student.loginCode || student.id} />
              <DetailItem label="Email Internal" value={student.email} />
              <DetailItem
                label="Cabang"
                value={
                  getRegisteredBranchName(student.branch, branchOptions) ||
                  "Belum diatur"
                }
              />
              <DetailItem label="Program" value={student.program} />
              <DetailItem label="Jenjang" value={student.level} />
              <DetailItem label="Kelas" value={student.className} />
              <DetailItem label="Membership" value={label} />
              <DetailItem label="Password" value={student.generatedPassword} />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <AdminStatusBadge status={student.status} />
              <AdminStatusBadge status={label} tone={tone} />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Button
        type="button"
        variant="outline"
        size="icon"
        className={`size-9 rounded-xl p-0 text-orange-600 shadow-sm transition ${warmOutlineButtonClassName}`}
        aria-label={`Edit ${student.name}`}
        title={readOnly ? readOnlyMessage : "Edit"}
        disabled={readOnly}
        onClick={() => onEdit(student)}
      >
        <Pencil className="size-4" />
      </Button>

      <Button
        type="button"
        variant="outline"
        size="icon"
        className={
          student.status === "Aktif"
            ? "size-9 rounded-xl border-amber-200 bg-white p-0 text-amber-600 shadow-sm transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 active:border-amber-300 active:bg-amber-100/80 focus-visible:ring-orange-500/10"
            : "size-9 rounded-xl border-emerald-200 bg-white p-0 text-emerald-600 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 active:border-emerald-300 active:bg-emerald-100/80 focus-visible:ring-orange-500/10"
        }
        aria-label={
          student.status === "Aktif"
            ? `Nonaktifkan ${student.name}`
            : `Aktifkan ${student.name}`
        }
        title={
          readOnly
            ? readOnlyMessage
            : student.status === "Aktif"
              ? "Nonaktifkan"
              : "Aktifkan"
        }
        disabled={readOnly}
        onClick={() => onToggleStatus(student)}
      >
        {student.status === "Aktif" ? (
          <PowerOff className="size-4" />
        ) : (
          <Power className="size-4" />
        )}
      </Button>

      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-9 rounded-xl border-rose-200 bg-white p-0 text-rose-600 shadow-sm transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 active:border-rose-300 active:bg-rose-100/80 focus-visible:ring-orange-500/10"
        aria-label={`Hapus ${student.name}`}
        title={readOnly ? readOnlyMessage : "Hapus"}
        disabled={readOnly}
        onClick={() => onDelete(student)}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

export function AdminStudents({
  dashboardConfig = defaultAdminDashboardConfig,
  onRefresh,
  globalSearchQuery = "",
}: AdminStudentsProps) {
  const studentLevelOptions: StudentLevelFilterOption[] = [
    "Semua",
    ...dashboardConfig.academic.levels,
  ];
  const studentStatusOptions: StudentStatusFilterOption[] = [
    "Semua",
    ...dashboardConfig.student.statuses,
  ];
  const classValueOptions = dashboardConfig.student.classOptions;
  const classOptionsByLevel = dashboardConfig.student.classOptionsByLevel;
  const defaultStudentClassName = classValueOptions[0] ?? "SD 4";
  const billingPackages = dashboardConfig.payment.billingPackages;
  const defaultMembershipPackageKey = billingPackages[0]?.packageKey ?? "";
  const { config: subscriptionConfig, isLoading: isSubscriptionConfigLoading } =
    useSubscriptionConfig();
  const packageLookupOptions: OnlinePackageDefinition[] =
    subscriptionConfig.packages.length > 0
      ? subscriptionConfig.packages
      : billingPackages.map((item) => ({
          ...item,
          highlight: "",
        }));
  const [students, setStudents] = useState<AdminStudent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] =
    useState<StudentLevelFilterOption>("Semua");
  const [classFilter, setClassFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] =
    useState<StudentStatusFilterOption>("Semua");
  const [academicYearFilter, setAcademicYearFilter] = useState<string>(
    getCurrentAdminAcademicYear,
  );
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<AdminStudent | null>(
    null,
  );
  const [formValues, setFormValues] =
    useState<StudentFormValues>(
      createEmptyStudentForm(defaultStudentClassName, defaultMembershipPackageKey),
    );
  const [formError, setFormError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] =
    useState<StudentActionFeedback | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] =
    useState<StudentImportResponse | null>(null);
  const [importInputVersion, setImportInputVersion] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [branchOptions, setBranchOptions] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageLimit, setPageLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [summary, setSummary] = useState<AdminStudentsSummary>({
    totalItems: 0,
    activeCount: 0,
    inactiveCount: 0,
    branchCount: 0,
    classCount: 0,
  });
  const deferredSearch = useDeferredValue(search);
  const deferredGlobalSearch = useDeferredValue(globalSearchQuery);
  const previousQueryKeyRef = useRef<string | null>(null);
  const combinedSearchQuery = [
    deferredSearch.trim(),
    deferredGlobalSearch.trim(),
  ]
    .filter(Boolean)
    .join(" ");
  const requestKey = [
    combinedSearchQuery.toLowerCase(),
    levelFilter,
    classFilter ?? "",
    statusFilter,
    academicYearFilter,
    pageLimit,
  ].join("|");

  useEffect(() => {
    let isCancelled = false;

    async function loadBranchOptions() {
      try {
        const payload = await requestAdminApi<{ branches: BranchApiItem[] }>(
          "/api/branches",
          {
            method: "GET",
          },
        );

        if (isCancelled) {
          return;
        }

        setBranchOptions(
          buildBranchOptions(
            (payload.data?.branches ?? []).map((branch) => branch.name ?? ""),
          ),
        );
      } catch {
        if (!isCancelled) {
          setBranchOptions([]);
        }
      }
    }

    void loadBranchOptions();

    return () => {
      isCancelled = true;
    };
  }, []);

  const refreshStudents = useCallback(
    async (nextPage: number = page) => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await fetchAdminStudents({
          page: nextPage,
          limit: pageLimit,
          q: combinedSearchQuery || undefined,
          status: statusFilter === "Semua" ? undefined : statusFilter,
          className: classFilter,
          level: levelFilter === "Semua" ? undefined : levelFilter,
          sort: "createdAt_desc",
        });

        setStudents(result.students);
        setSummary(result.summary);
        setPage(result.pagination.page);
        setPageLimit(result.pagination.limit);
        setTotalPages(result.pagination.totalPages);
        setTotalItems(result.pagination.totalItems);
        setError(null);
      } catch (requestError) {
        setStudents([]);
        setSummary({
          totalItems: 0,
          activeCount: 0,
          inactiveCount: 0,
          branchCount: 0,
          classCount: 0,
        });
        setTotalPages(1);
        setTotalItems(0);
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Gagal memuat daftar siswa.",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [classFilter, combinedSearchQuery, levelFilter, page, pageLimit, statusFilter, academicYearFilter],
  );



  const refreshStudentViews = useCallback(
    async (nextPage: number = page) => {
      await Promise.allSettled([
        refreshStudents(nextPage),
        Promise.resolve(onRefresh?.()),
      ]);
    },
    [onRefresh, page, refreshStudents],
  );

  useEffect(() => {
    const filtersChanged =
      previousQueryKeyRef.current !== null &&
      previousQueryKeyRef.current !== requestKey;

    previousQueryKeyRef.current = requestKey;

    if (filtersChanged && page !== 1) {
      setPage(1);
      return;
    }

    const timerId = window.setTimeout(() => {
      void refreshStudents(page);
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [page, refreshStudents, requestKey]);



  const resolvedBranchOptions = branchOptions;
  const selectedBranchValue =
    getRegisteredBranchName(formValues.branch, branchOptions) ||
    unassignedBranchValue;

  const availableClassOptions =
    levelFilter === "Semua"
      ? []
      : (classOptionsByLevel[levelFilter as AdminStudent["level"]] ?? []);
  const filteredStudents = students;


  const activeStudents = summary.activeCount;
  const inactiveStudents = summary.inactiveCount;
  const academicYearOptions = getAdminAcademicYearOptions(academicYearFilter);
  const academicYearStatus = getAdminAcademicYearStatus(academicYearFilter);
  const academicYearLockMessage =
    getAdminAcademicYearLockMessage(academicYearFilter);
  const isAcademicYearLocked = academicYearStatus.isLocked;
  const filteredStudentsWithMembershipCount = filteredStudents.filter(
    (student) => student.membership?.status === "active",
  ).length;
  const filteredStudentsWithoutMembershipCount =
    filteredStudents.length - filteredStudentsWithMembershipCount;
  const isEditing = editingStudentId !== null;
  const selectedMembershipPackage =
    packageLookupOptions.find(
      (item) => item.packageKey === formValues.membershipPackageKey,
    ) ??
    billingPackages.find(
      (item) => item.packageKey === formValues.membershipPackageKey,
    ) ??
    null;
  const selectedMembershipAmount =
    formValues.membershipPackageKey
      ? getPriceByClassAndPackage(
          formValues.className,
          formValues.membershipPackageKey,
          subscriptionConfig.classPricingMatrix,
          packageLookupOptions,
        )
      : 0;
  const studentNumberMap = new Map(
    filteredStudents.map((student, index) => [student.id, (page - 1) * pageLimit + index + 1]),
  );

  const openCreateDialog = () => {
    if (isAcademicYearLocked) {
      setActionFeedback({
        tone: "warning",
        message: academicYearLockMessage,
      });
      return;
    }

    setEditingStudentId(null);
    setFormValues(
      createEmptyStudentForm(
        defaultStudentClassName,
        defaultMembershipPackageKey,
        academicYearFilter,
      ),
    );
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEditDialog = (student: AdminStudent) => {
    if (isAcademicYearLocked) {
      setActionFeedback({
        tone: "warning",
        message: academicYearLockMessage,
      });
      return;
    }

    setEditingStudentId(student.id);
    setFormValues(toStudentFormValues(student));
    setFormError(null);
    setIsFormOpen(true);
  };

  const closeFormDialog = () => {
    setIsFormOpen(false);
    setEditingStudentId(null);
    setFormValues(
      createEmptyStudentForm(
        defaultStudentClassName,
        defaultMembershipPackageKey,
        academicYearFilter,
      ),
    );
    setFormError(null);
  };

  const closeImportDialog = () => {
    setIsImportOpen(false);
    setImportFile(null);
    setImportError(null);
    setImportInputVersion((currentValue) => currentValue + 1);
  };

  const updateFormValue = <K extends keyof StudentFormValues>(
    key: K,
    value: StudentFormValues[K],
  ) => {
    setFormValues((currentValues) => ({
      ...currentValues,
      [key]: value,
    }));
  };

  const handleLevelFilterChange = (value: string) => {
    setLevelFilter(value as StudentLevelFilterOption);

    if (value === "Semua") {
      setClassFilter(undefined);
      return;
    }

    const nextClassOptions =
      classOptionsByLevel[value as AdminStudent["level"]] ?? [];

    setClassFilter((currentValue) =>
      currentValue && nextClassOptions.includes(currentValue)
        ? currentValue
        : undefined,
    );
  };

  const handleResetFilters = () => {
    setSearch("");
    setLevelFilter("Semua");
    setClassFilter(undefined);
    setStatusFilter("Semua");
    setAcademicYearFilter(getCurrentAdminAcademicYear());
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isAcademicYearLocked) {
      setFormError(academicYearLockMessage);
      return;
    }

    const normalizedName = formValues.name.trim();
    const normalizedEmail = normalizeEmail(formValues.email);
    const normalizedPhone = normalizePhone(formValues.phone);
    const normalizedBranch = getRegisteredBranchName(
      formValues.branch,
      branchOptions,
    );
    const normalizedProgram = formValues.program.trim();
    const normalizedClassName = normalizeClassNameInput(formValues.className);
    const normalizedBirthDate = normalizeBirthDateInput(formValues.birthDate);

    if (!normalizedName) {
      setFormError("Nama siswa wajib diisi.");
      return;
    }

    if (isEditing && !normalizedEmail) {
      setFormError("Email siswa wajib diisi saat edit data.");
      return;
    }

    if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setFormError("Format email belum valid.");
      return;
    }


    if (!normalizedClassName) {
      setFormError("Kelas harus menggunakan format SD 4 sampai SMA 12.");
      return;
    }

    if (formValues.academicYear !== academicYearStatus.currentAcademicYear) {
      setFormError("Data siswa hanya bisa disimpan untuk tahun ajaran aktif.");
      return;
    }

    if (!isEditing) {
      if (!formValues.membershipPackageKey) {
        setFormError("Paket membership offline wajib dipilih.");
        return;
      }

      if (!normalizeBirthDateInput(formValues.membershipPaidAt)) {
        setFormError("Tanggal pembayaran offline belum valid.");
        return;
      }
    }

    const duplicateStudent = students.find(
      (student) =>
        normalizedEmail &&
        normalizeEmail(student.email) === normalizedEmail &&
        student.id !== editingStudentId,
    );

    if (duplicateStudent) {
      setFormError("Email sudah digunakan siswa lain.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      await requestAdminApi<{ student: AdminStudent }>(
        editingStudentId
          ? `/api/students/${encodeURIComponent(editingStudentId)}`
          : "/api/students",
        {
          method: editingStudentId ? "PUT" : "POST",
          body: JSON.stringify({
            name: normalizedName,
            ...(normalizedEmail ? { email: normalizedEmail } : {}),
            phone: normalizedPhone,
            branch: normalizedBranch,
            program: normalizedProgram,
            className: normalizedClassName,
            birthDate: normalizedBirthDate,
            academicYear: formValues.academicYear,
            ...(formValues.password ? { password: formValues.password } : {}),
            status: formValues.status,
            ...(!isEditing
              ? {
                  membershipPaymentMode: paidOfflineMembershipValue,
                  membershipPackageKey: formValues.membershipPackageKey,
                  membershipPaymentMethod: formValues.membershipPaymentMethod,
                  membershipPaidAt: formValues.membershipPaidAt,
                }
              : {}),
          }),
        },
      );

      await refreshStudentViews();
      setActionFeedback({
        tone: "success",
        message:
          !isEditing
            ? "Siswa berhasil ditambahkan dan pembayaran offline masuk ke pemasukan cabang."
            : "Data siswa berhasil disimpan.",
      });
      closeFormDialog();
    } catch (requestError) {
      setFormError(
        requestError instanceof Error
          ? requestError.message
          : "Gagal menyimpan data siswa.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!studentToDelete) {
      return;
    }

    if (isAcademicYearLocked) {
      setActionFeedback({
        tone: "warning",
        message: academicYearLockMessage,
      });
      setStudentToDelete(null);
      return;
    }

    setIsDeleting(true);
    setActionFeedback(null);

    try {
      const response = await requestAdminApi<DeleteStudentResponse>(
        `/api/students/${encodeURIComponent(studentToDelete.id)}`,
        {
          method: "DELETE",
        },
      );

      await refreshStudentViews();
      setFormError(null);
      setActionFeedback(
        response.data?.deletionMode === "archived"
          ? {
              tone: "warning",
              message:
                "Siswa tidak dihapus permanen karena memiliki histori pembayaran/subscription. Status siswa diubah menjadi Nonaktif.",
            }
          : {
              tone: "success",
              message: response.message || "Data siswa berhasil dihapus.",
            },
      );
      setStudentToDelete(null);
    } catch (requestError) {
      setActionFeedback(null);
      setFormError(
        requestError instanceof Error
          ? requestError.message
          : "Gagal menghapus data siswa.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleStatus = async (student: AdminStudent) => {
    if (isAcademicYearLocked) {
      setActionFeedback({
        tone: "warning",
        message: academicYearLockMessage,
      });
      return;
    }

    try {
      await requestAdminApi<{ student: AdminStudent }>(
        `/api/students/${encodeURIComponent(student.id)}`,
        {
          method: "PUT",
          body: JSON.stringify({
            name: student.name,
            email: student.email,
            phone: student.phone,
            branch: student.branch,
            program: student.program,
            className: student.className,
            birthDate: student.birthDate,
            academicYear: student.academicYear,
            status: student.status === "Aktif" ? "Nonaktif" : "Aktif",
          }),
        },
      );
      await refreshStudentViews();
    } catch (requestError) {
      setFormError(
        requestError instanceof Error
          ? requestError.message
          : "Gagal memperbarui status siswa.",
      );
    }
  };

  const handleExport = async () => {
    if (!filteredStudents.length) {
      return;
    }

    try {
      await exportAdminStudentsCsv({
        q: combinedSearchQuery || undefined,
        status: statusFilter === "Semua" ? undefined : statusFilter,
        className: classFilter,
        level: levelFilter === "Semua" ? undefined : levelFilter,
        sort: "createdAt_desc",
      });
    } catch (requestError) {
      setFormError(
        requestError instanceof Error
          ? requestError.message
          : "Gagal mengunduh export siswa.",
      );
    }
  };

  const handleImportFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setImportFile(event.target.files?.[0] ?? null);
    setImportError(null);
  };

  const handleImportSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isAcademicYearLocked) {
      setImportError(academicYearLockMessage);
      return;
    }

    if (!importFile) {
      setImportError("Pilih file Excel siswa terlebih dahulu.");
      return;
    }

    setIsImporting(true);
    setImportError(null);

    try {
      const fileDataUrl = await readFileAsDataUrl(importFile);
      const fileDataBase64 = fileDataUrl.includes(",")
        ? (fileDataUrl.split(",")[1] ?? "")
        : fileDataUrl;
      const payload = await requestAdminApi<StudentImportResponse>(
        "/api/students/import",
        {
          method: "POST",
          body: JSON.stringify({
            fileName: importFile.name,
            fileDataBase64,
            academicYear: academicYearFilter,
          }),
        },
      );
      const nextImportResult = payload.data;

      if (!nextImportResult?.summary) {
        setImportError("Ringkasan hasil import siswa tidak tersedia.");
        return;
      }

      await refreshStudentViews();
      setImportResult({
        fileName: nextImportResult.fileName,
        sheetName: nextImportResult.sheetName,
        summary: nextImportResult.summary,
        issues: nextImportResult.issues ?? [],
      });
      closeImportDialog();
    } catch (requestError) {
      setImportError(
        requestError instanceof Error
          ? requestError.message
          : "Gagal mengimpor data siswa.",
      );
    } finally {
      setIsImporting(false);
    }
  };

  const columns: AdminColumnDefinition<AdminStudent>[] = [
    {
      key: "number",
      header: "No",
      className: "w-[84px] text-center",
      cell: (student) => studentNumberMap.get(student.id) ?? "-",
    },
    {
      key: "name",
      header: "Nama",
      cell: (student) => (
        <div className="flex items-center gap-3">
          <Avatar className="rounded-full">
            <AvatarFallback className={cn(warmAvatarFallbackClassName, "rounded-full")}>
              {getInitials(student.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-950">
              {student.name}
            </p>

          </div>
        </div>
      ),
    },
    {
      key: "loginCode",
      header: "Kode Login",
      cell: (student) => (
        <div className="max-w-[240px]">
          <p className="truncate text-sm font-semibold text-slate-800">
            {student.loginCode || student.id}
          </p>
          {!student.email.endsWith("@bimbel.local") && (
            <p className="truncate text-xs text-slate-500">{student.email}</p>
          )}
        </div>
      ),
    },
    {
      key: "branch",
      header: "Cabang",
      cell: (student) =>
        getRegisteredBranchName(student.branch, branchOptions) || "Belum diatur",
    },
    {
      key: "program",
      header: "Program / Jenjang",
      cell: (student) => (
        <div>
          <p className="font-medium text-slate-800">{student.program}</p>
          <p className="text-sm text-slate-500">{student.level}</p>
        </div>
      ),
    },
    {
      key: "className",
      header: "Kelas",
      cell: (student) => student.className,
    },
    {
      key: "membershipStatus",
      header: "Membership",
      cell: (student) => {
        const status = student.membership?.status || "none";
        
        let label = "Belum Membership";
        let tone: StudentMembershipTone = "default";

        if (status === "active") {
          label = "Aktif";
          tone = "success";
        } else if (status === "pending") {
          label = "Menunggu Mulai";
          tone = "warning";
        } else if (status === "expired") {
          label = "Expired";
          tone = "danger";
        }

        return (
          <div className="flex flex-col gap-1">
            <AdminStatusBadge status={label} tone={tone} />
            {student.membership?.packageName && (
              <span className="text-xs text-slate-500 whitespace-nowrap">
                {student.membership.packageName}
              </span>
            )}
            {student.membership?.endDate && (
              <span className="text-xs text-slate-400 whitespace-nowrap">
                s/d {new Date(student.membership.endDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "generatedPassword",
      header: "Password Generate",
      cell: (student) => (
        <code className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
          {student.generatedPassword}
        </code>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (student) => <AdminStatusBadge status={student.status} />,
    },
    {
      key: "actions",
      header: "Aksi",
      cell: (student) => (
        <StudentActions
          student={student}
          branchOptions={branchOptions}
          readOnly={isAcademicYearLocked}
          readOnlyMessage={academicYearLockMessage}
          onEdit={openEditDialog}
          onDelete={setStudentToDelete}
          onToggleStatus={handleToggleStatus}
        />
      ),
      className: "w-[196px] text-center",
    },
  ];

  return (
    <>
      <AdminSectionCard
        title="Kelola siswa"
        description="Kelola data siswa, filter jenjang dan kelas, serta impor atau ekspor data CSV."
        square
        action={
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Button
              variant="outline"
              className={warmOutlineButtonClassName}
              onClick={handleExport}
              disabled={!filteredStudents.length}
            >
              <Download className="size-4" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button
              variant="outline"
              className={warmOutlineButtonClassName}
              onClick={() => setIsImportOpen(true)}
              disabled={isAcademicYearLocked}
              title={isAcademicYearLocked ? academicYearLockMessage : "Import"}
            >
              <Upload className="size-4" />
              <span className="hidden sm:inline">Import</span>
            </Button>
            <Button
              variant="secondary"
              className={warmPrimaryButtonClassName}
              onClick={openCreateDialog}
              disabled={isAcademicYearLocked}
              title={isAcademicYearLocked ? academicYearLockMessage : "Tambah"}
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">Tambah</span>
            </Button>
          </div>
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <span>
            Menampilkan {filteredStudents.length} dari {totalItems} siswa.
          </span>
          <Badge variant="secondary" className="bg-slate-100 text-slate-700">
            Aktif {activeStudents}
          </Badge>
          <Badge variant="secondary" className="bg-slate-100 text-slate-700">
            Nonaktif {inactiveStudents}
          </Badge>
          <Badge variant="secondary" className="bg-slate-100 text-slate-700">
            Kelas {summary.classCount}
          </Badge>
          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
            Sudah membership {filteredStudentsWithMembershipCount}
          </Badge>
          <Badge variant="secondary" className="bg-amber-50 text-amber-700">
            Belum membership {filteredStudentsWithoutMembershipCount}
          </Badge>
          <Badge
            variant="secondary"
            className={
              academicYearStatus.isActive
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-700"
            }
          >
            {academicYearStatus.label} {academicYearStatus.academicYear}
          </Badge>
        </div>

        {isAcademicYearLocked ? (
          <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-700">
            {academicYearLockMessage}
          </div>
        ) : null}

        {importResult ? (
          <div
            className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
              importResult.summary.failedRows || importResult.summary.skippedRows
                ? "border-amber-100 bg-amber-50 text-amber-700"
                : "border-emerald-100 bg-emerald-50 text-emerald-700"
            }`}
          >
            <p>
              Import selesai dari {importResult.fileName}. Total row{" "}
              {importResult.summary.totalRows}, berhasil{" "}
              {importResult.summary.importedRows}, gagal{" "}
              {importResult.summary.failedRows}, dilewati{" "}
              {importResult.summary.skippedRows}.
            </p>

            {importResult.issues.length ? (
              <div className="mt-2 space-y-1 text-xs leading-6">
                {importResult.issues.slice(0, 5).map((issue) => (
                  <p
                    key={`${issue.status}-${issue.rowNumber}-${issue.name}-${issue.className}`}
                  >
                    Baris {issue.rowNumber}: {issue.reason}
                  </p>
                ))}
                {importResult.issues.length > 5 ? (
                  <p>
                    +{importResult.issues.length - 5} baris lain memiliki
                    catatan.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {error}
          </div>
        ) : null}

        {actionFeedback ? (
          <div
            className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
              actionFeedback.tone === "warning"
                ? "border-amber-100 bg-amber-50 text-amber-700"
                : "border-emerald-100 bg-emerald-50 text-emerald-700"
            }`}
          >
            {actionFeedback.message}
          </div>
        ) : null}

        <div className="mb-6 flex flex-col gap-3 md:flex-row md:flex-wrap">
          <div className="w-full md:flex-1">
            <Input
              className={warmFieldClassName}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama, kode login, email, cabang, program, atau kelas..."
            />
          </div>

          <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto sm:flex-wrap">
            <div className="w-full sm:w-[180px]">
              <Select
                value={levelFilter}
                onValueChange={handleLevelFilterChange}
              >
                <SelectTrigger className={warmSelectTriggerClassName}>
                  <SelectValue placeholder="Program / Jenjang" />
                </SelectTrigger>
                <SelectContent className={warmSelectContentClassName}>
                  {studentLevelOptions.map((option) => (
                    <SelectItem
                      key={option}
                      value={option}
                      className={warmSelectItemClassName}
                    >
                      {option === "Semua" ? "Semua Program" : option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-full sm:w-[180px]">
              <Select
                value={classFilter}
                onValueChange={setClassFilter}
                disabled={levelFilter === "Semua"}
              >
                <SelectTrigger className={warmSelectTriggerClassName}>
                  <SelectValue
                    placeholder={
                      levelFilter === "Semua" ? "Pilih jenjang dulu" : "Kelas"
                    }
                  />
                </SelectTrigger>
                <SelectContent className={warmSelectContentClassName}>
                  {availableClassOptions.map((option) => (
                    <SelectItem
                      key={option}
                      value={option}
                      className={warmSelectItemClassName}
                    >
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>



            <div className="w-full sm:w-[160px]">
              <Select
                value={statusFilter}
                onValueChange={(value) =>
                  setStatusFilter(value as StudentStatusFilterOption)
                }
              >
                <SelectTrigger className={warmSelectTriggerClassName}>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className={warmSelectContentClassName}>
                  {studentStatusOptions.map((option) => (
                    <SelectItem
                      key={option}
                      value={option}
                      className={warmSelectItemClassName}
                    >
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className={`w-full sm:w-auto ${warmOutlineButtonClassName}`}
            onClick={handleResetFilters}
          >
            <RotateCcw className="size-4" />
            Reset
          </Button>
        </div>

        <AdminDataTable
          columns={columns}
          data={filteredStudents}
          keyExtractor={(student) => student.id}
          emptyTitle="Tidak ada siswa yang cocok"
          emptyDescription="Coba ubah kata kunci pencarian atau kombinasi filter."
          isLoading={isLoading}
          square
          getRowClassName={(student) =>
            student.status === "Nonaktif"
              ? "bg-slate-50/70 hover:bg-slate-100/70"
              : undefined
          }
          minWidthClassName="min-w-[1360px]"
        />
        <div className="mt-4">
          <AdminPaginationFooter
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            visibleCount={filteredStudents.length}
            limit={pageLimit}
            isLoading={isLoading}
            label="siswa"
            onPrevious={() => {
              setPage((currentPage) => Math.max(1, currentPage - 1));
            }}
            onNext={() => {
              setPage((currentPage) => Math.min(totalPages, currentPage + 1));
            }}
          />
        </div>
      </AdminSectionCard>

      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeFormDialog();
          }
        }}
      >
        <DialogContent
          className={`max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] sm:max-w-5xl ${warmOverlayPanelClassName}`}
        >
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit siswa" : "Tambah siswa baru"}
            </DialogTitle>
            <DialogDescription>
              Isi data siswa. Kode login dibuat otomatis dari ID siswa; email bisa
              dikosongkan agar sistem membuat email internal.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-8" onSubmit={handleSubmit}>
            {/* Informasi Pribadi */}
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-2">
                <h3 className="text-base font-semibold text-slate-800">Informasi Pribadi</h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <StudentField label="Nama Lengkap">
                  <Input
                    className={warmFieldClassName}
                    value={formValues.name}
                    onChange={(event) => updateFormValue("name", event.target.value)}
                    placeholder="Nama lengkap siswa"
                  />
                </StudentField>

                {isEditing ? (
                  <StudentField label="Email kontak/internal">
                    <div className="space-y-2">
                      <Input
                        className={warmFieldClassName}
                        type="email"
                        value={formValues.email}
                        onChange={(event) => updateFormValue("email", event.target.value)}
                        placeholder="nama@email.com"
                      />
                    </div>
                  </StudentField>
                ) : null}
              </div>
            </div>

            {/* Informasi Akademik & Akun */}
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-2">
                <h3 className="text-base font-semibold text-slate-800">Informasi Akademik & Akun</h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                <StudentField label="Kelas">
                  <Select
                    value={formValues.className}
                    onValueChange={(value) => updateFormValue("className", value)}
                  >
                    <SelectTrigger className={warmSelectTriggerClassName}>
                      <SelectValue placeholder="Pilih kelas" />
                    </SelectTrigger>
                    <SelectContent className={warmSelectContentClassName}>
                      {classValueOptions.map((option) => (
                        <SelectItem key={option} value={option} className={warmSelectItemClassName}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </StudentField>

                <StudentField label="Tahun Ajaran">
                  <Select
                    value={formValues.academicYear}
                    onValueChange={(value) => updateFormValue("academicYear", value)}
                    disabled
                  >
                    <SelectTrigger className={warmSelectTriggerClassName}>
                      <SelectValue placeholder="Tahun Ajaran" />
                    </SelectTrigger>
                    <SelectContent className={warmSelectContentClassName}>
                      {academicYearOptions.map((option) => (
                        <SelectItem key={option} value={option} className={warmSelectItemClassName}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </StudentField>

                <StudentField label="Status">
                  <Select
                    value={formValues.status}
                    onValueChange={(value) => updateFormValue("status", value as AdminStudent["status"])}
                  >
                    <SelectTrigger className={warmSelectTriggerClassName}>
                      <SelectValue placeholder="Pilih status" />
                    </SelectTrigger>
                    <SelectContent className={warmSelectContentClassName}>
                      {studentStatusOptions
                        .filter((option) => option !== "Semua")
                        .map((option) => (
                          <SelectItem key={option} value={option} className={warmSelectItemClassName}>
                            {option}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </StudentField>

                {isEditing ? (
                  <StudentField label="Password">
                    <div className="space-y-2">
                      <Input
                        className={warmFieldClassName}
                        type="password"
                        value={formValues.password || ""}
                        onChange={(event) => updateFormValue("password", event.target.value)}
                        placeholder="Kosongkan jika tidak diubah"
                      />
                      <p className="text-xs leading-5 text-slate-500">
                        Kosongkan jika password tidak diubah.
                      </p>
                    </div>
                  </StudentField>
                ) : null}
              </div>
            </div>

            {/* Pembayaran Pendaftaran */}
            {!isEditing ? (
              <div className="space-y-4 rounded-xl border border-orange-200/60 bg-orange-50/40 p-5 mt-6">
                <div className="border-b border-orange-200/60 pb-2">
                  <h3 className="text-base font-semibold text-orange-800">Pembayaran Pendaftaran (Offline)</h3>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                  <StudentField label="Paket membership">
                    <Select
                      value={formValues.membershipPackageKey}
                      onValueChange={(value) => updateFormValue("membershipPackageKey", value)}
                    >
                      <SelectTrigger className={warmSelectTriggerClassName}>
                        <SelectValue placeholder="Pilih paket" />
                      </SelectTrigger>
                      <SelectContent className={warmSelectContentClassName}>
                        {billingPackages.map((item) => {
                          const amount = getPriceByClassAndPackage(
                            formValues.className,
                            item.packageKey,
                            subscriptionConfig.classPricingMatrix,
                            packageLookupOptions,
                          );

                          return (
                            <SelectItem
                              key={item.packageKey}
                              value={item.packageKey}
                              className={warmSelectItemClassName}
                            >
                              {item.packageName} | {formatCurrency(amount)}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {isSubscriptionConfigLoading ? (
                      <p className="text-xs text-slate-500">Nominal paket sedang dimuat...</p>
                    ) : null}
                  </StudentField>

                  <StudentField label="Metode bayar">
                    <Select
                      value={formValues.membershipPaymentMethod}
                      onValueChange={(value) =>
                        updateFormValue("membershipPaymentMethod", value as StudentMembershipPaymentMethod)
                      }
                    >
                      <SelectTrigger className={warmSelectTriggerClassName}>
                        <SelectValue placeholder="Metode" />
                      </SelectTrigger>
                      <SelectContent className={warmSelectContentClassName}>
                        {Object.entries(offlinePaymentMethodLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value} className={warmSelectItemClassName}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </StudentField>

                  <StudentField label="Tanggal bayar">
                    <Input
                      className={warmFieldClassName}
                      type="date"
                      value={formValues.membershipPaidAt}
                      onChange={(event) => updateFormValue("membershipPaidAt", event.target.value)}
                    />
                  </StudentField>
                </div>

                <div className="mt-5 rounded-lg bg-white/70 p-4 shadow-sm border border-orange-100 flex justify-between items-center">
                  <p className="text-sm font-medium text-orange-900">Total Tagihan Membership:</p>
                  <p className="text-xl font-bold text-orange-700">
                    {formatCurrency(selectedMembershipAmount)}
                  </p>
                </div>
              </div>
            ) : null}

            {formError ? (
              <p className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-600">
                {formError}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className={warmOutlineButtonClassName}
                onClick={closeFormDialog}
              >
                Batal
              </Button>
              <Button
                type="submit"
                variant="secondary"
                className={warmPrimaryButtonClassName}
                disabled={isSubmitting || isAcademicYearLocked}
              >
                {isSubmitting
                  ? "Menyimpan..."
                  : isEditing
                    ? "Simpan perubahan"
                    : "Tambah siswa"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isImportOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeImportDialog();
          }
        }}
      >
        <DialogContent className={`max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] sm:max-w-xl ${warmOverlayPanelClassName}`}>
          <DialogHeader>
            <DialogTitle>Import data siswa</DialogTitle>
            <DialogDescription>
              Upload file Excel siswa. Sistem akan membaca kolom nama, kelas,
              dan asal sekolah lalu mengisi field lain dengan default aman.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-5" onSubmit={handleImportSubmit}>
            <div className="rounded-[22px] border border-slate-200/80 bg-gradient-to-r from-white to-orange-50/45 px-4 py-3 text-sm leading-6 text-slate-600 shadow-[0_12px_26px_-22px_rgba(249,115,22,0.16)]">
              Header yang dibaca: {studentImportColumns.join(", ")}. Baris
              judul dan baris kosong akan dilewati otomatis.
            </div>

            <StudentField label="File Excel">
              <input
                key={importInputVersion}
                type="file"
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                onChange={handleImportFileChange}
                className={warmFileInputClassName}
              />
            </StudentField>

            {importError ? (
              <p className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-600">
                {importError}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className={warmOutlineButtonClassName}
                onClick={closeImportDialog}
              >
                Batal
              </Button>
              <Button
                type="submit"
                variant="secondary"
                className={warmPrimaryButtonClassName}
                disabled={isImporting || isAcademicYearLocked}
              >
                {isImporting ? "Mengimpor..." : "Import Excel"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(studentToDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setStudentToDelete(null);
          }
        }}
      >
        <DialogContent className={warmOverlayPanelClassName}>
          <DialogHeader>
            <DialogTitle>Hapus data siswa</DialogTitle>
            <DialogDescription>
              Data siswa yang dihapus akan hilang dari tabel yang sedang aktif.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-[22px] border border-slate-200/80 bg-gradient-to-r from-white to-orange-50/45 px-4 py-3 text-sm leading-6 text-slate-600 shadow-[0_12px_26px_-22px_rgba(249,115,22,0.16)]">
            {studentToDelete
              ? `Hapus ${studentToDelete.name} dengan kode login ${studentToDelete.loginCode || studentToDelete.id}?`
              : "Pilih siswa yang ingin dihapus."}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className={warmOutlineButtonClassName}
              onClick={() => setStudentToDelete(null)}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="focus-visible:ring-orange-500/10"
              disabled={isDeleting}
              onClick={handleDelete}
            >
              {isDeleting ? "Menghapus..." : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
