"use client";

import { useEffect, useMemo, useState } from "react";

import { notifyOwnerBranchesChanged } from "@/components/dashboard-owner/branch-events";
import type { BadgeProps } from "@/components/ui/badge";
import { requestAdminApi } from "@/lib/admin-api";
import {
  fetchOwnerBranchAdminOptionsFromApi,
  type OwnerBranchAdminOption,
} from "@/lib/owner-branch-admins";
import {
  defaultOwnerBranchesRouteState,
  type OwnerBranchesRouteState,
} from "@/lib/owner-dashboard-routing";

export type OwnerDashboardBranchStatus = "Aktif" | "Persiapan" | "Nonaktif";
const attentionBranchFilter = "Persiapan & Nonaktif" as const;
export type OwnerDashboardBranchFilter =
  | "Semua"
  | OwnerDashboardBranchStatus
  | typeof attentionBranchFilter;

export type OwnerDashboardBranch = {
  id: string;
  name: string;
  shortAddress: string;
  fullAddress: string;
  phone: string;
  email: string;
  studentCount: number;
  teacherCount: number;
  status: OwnerDashboardBranchStatus;
  adminName: string;
  updatedAt: string;
};

export type OwnerDashboardBranchAdminOption = OwnerBranchAdminOption;

export type OwnerDashboardBranchForm = {
  name: string;
  shortAddress: string;
  adminName: string;
  status: OwnerDashboardBranchStatus;
};

export type OwnerDashboardBranchDialogMode = "create" | "edit";

export type OwnerDashboardBranchDialogState = {
  isOpen: boolean;
  mode: OwnerDashboardBranchDialogMode;
  title: string;
  description: string;
  submitLabel: string;
  error: string | null;
};

export type OwnerDashboardBranchFlashTone =
  | "success"
  | "warning"
  | "danger"
  | "info";

export type OwnerDashboardBranchFlash = {
  tone: OwnerDashboardBranchFlashTone;
  message: string;
};

export type OwnerDashboardBranchStatusMeta = {
  badgeVariant: BadgeProps["variant"];
  label: string;
  summaryLabel: string;
  dotClassName: string;
};

export type OwnerDashboardBranchManager = {
  branches: OwnerDashboardBranch[];
  totalBranches: number;
  filteredBranchCount: number;
  isLoading: boolean;
  branchSearchQuery: string;
  setBranchSearchQuery: (value: string) => void;
  branchStatusFilter: OwnerDashboardBranchFilter;
  setBranchStatusFilter: (value: OwnerDashboardBranchFilter) => void;
  branchFilterOptions: readonly OwnerDashboardBranchFilter[];
  branchStatusOptions: readonly OwnerDashboardBranchStatus[];
  branchAdminOptions: OwnerDashboardBranchAdminOption[];
  summary: {
    total: number;
    active: number;
    preparation: number;
    inactive: number;
  };
  statusMeta: Record<OwnerDashboardBranchStatus, OwnerDashboardBranchStatusMeta>;
  flash: OwnerDashboardBranchFlash | null;
  dismissFlash: () => void;
  dialog: OwnerDashboardBranchDialogState;
  form: OwnerDashboardBranchForm;
  openCreateDialog: () => void;
  openEditDialog: (branchId: string) => void;
  closeDialog: () => void;
  updateFormValue: (field: keyof OwnerDashboardBranchForm, value: string) => void;
  submitForm: () => void;
  removeBranch: (branchId: string) => void;
  importBranches: (file: File) => Promise<void>;
  exportBranches: (format: "csv" | "json") => void;
  resetFilters: () => void;
};

const branchFilterOptions = [
  "Semua",
  "Aktif",
  attentionBranchFilter,
  "Persiapan",
  "Nonaktif",
] as const satisfies readonly OwnerDashboardBranchFilter[];

const branchStatusOptions = [
  "Aktif",
  "Persiapan",
  "Nonaktif",
] as const satisfies readonly OwnerDashboardBranchStatus[];

const branchStatusMeta = {
  Aktif: {
    badgeVariant: "success",
    label: "Aktif",
    summaryLabel: "Cabang aktif",
    dotClassName: "bg-emerald-500",
  },
  Persiapan: {
    badgeVariant: "warning",
    label: "Persiapan",
    summaryLabel: "Tahap persiapan",
    dotClassName: "bg-amber-500",
  },
  Nonaktif: {
    badgeVariant: "secondary",
    label: "Nonaktif",
    summaryLabel: "Cabang nonaktif",
    dotClassName: "bg-slate-400",
  },
} satisfies Record<OwnerDashboardBranchStatus, OwnerDashboardBranchStatusMeta>;

type OwnerBranchApiItem = {
  id?: string;
  branchId?: string;
  name?: string;
  shortAddress?: string;
  fullAddress?: string;
  phone?: string;
  email?: string;
  studentCount?: number | null;
  teacherCount?: number | null;
  status?: string;
  adminName?: string;
  updatedAt?: string;
};

const ownerBranchIdSeparator = "::";

function normalizeBranchName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeBranchStatus(value: string): OwnerDashboardBranchStatus | null {
  const normalized = value.trim().toLowerCase();

  switch (normalized) {
    case "aktif":
    case "active":
      return "Aktif";
    case "persiapan":
    case "preparation":
      return "Persiapan";
    case "nonaktif":
    case "non-active":
    case "inactive":
      return "Nonaktif";
    default:
      return null;
  }
}

function createBranchId(name: string) {
  return `branch-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
}

function createOwnerBranchStateId(branchId: string, name: string) {
  return `${createBranchId(name)}${ownerBranchIdSeparator}${branchId}`;
}

function extractPersistedBranchId(ownerBranchId: string) {
  const separatorIndex = ownerBranchId.lastIndexOf(ownerBranchIdSeparator);

  if (separatorIndex === -1) {
    return ownerBranchId;
  }

  return ownerBranchId.slice(separatorIndex + ownerBranchIdSeparator.length);
}

function toOwnerDashboardBranch(branch: OwnerBranchApiItem): OwnerDashboardBranch | null {
  const branchId = String(branch.branchId ?? branch.id ?? "").trim();
  const name = normalizeBranchName(String(branch.name ?? ""));
  const status = normalizeBranchStatus(String(branch.status ?? ""));
  const updatedAt = String(branch.updatedAt ?? "").trim();

  if (!branchId || !name || !status || !updatedAt) {
    return null;
  }

  return {
    id: createOwnerBranchStateId(branchId, name),
    name,
    shortAddress: normalizeBranchName(String(branch.shortAddress ?? "")),
    fullAddress: normalizeBranchName(String(branch.fullAddress ?? "")),
    phone: String(branch.phone ?? "").trim(),
    email: String(branch.email ?? "").trim(),
    studentCount:
      typeof branch.studentCount === "number" && Number.isFinite(branch.studentCount)
        ? branch.studentCount
        : 0,
    teacherCount:
      typeof branch.teacherCount === "number" && Number.isFinite(branch.teacherCount)
        ? branch.teacherCount
        : 0,
    status,
    adminName: normalizeBranchName(String(branch.adminName ?? "")),
    updatedAt,
  };
}

function readOwnerBranchItems(payload: { data?: { branches?: OwnerBranchApiItem[] } }) {
  const branches = payload.data?.branches;

  if (!Array.isArray(branches)) {
    return [];
  }

  return branches
    .map((branch) => toOwnerDashboardBranch(branch))
    .filter((branch): branch is OwnerDashboardBranch => branch !== null);
}

function buildBranchMutationPayload(
  draft: Pick<OwnerDashboardBranchForm, "name" | "shortAddress" | "adminName" | "status">,
  branch?: OwnerDashboardBranch | null,
) {
  return {
    name: normalizeBranchName(draft.name),
    shortAddress: normalizeBranchName(draft.shortAddress),
    fullAddress: branch?.fullAddress ?? "",
    phone: branch?.phone ?? "",
    email: branch?.email ?? "",
    status: draft.status,
    adminName: normalizeBranchName(draft.adminName),
  };
}

async function fetchOwnerBranchesFromApi() {
  const payload = await requestAdminApi<{ branches: OwnerBranchApiItem[] }>(
    "/api/branches",
    {
      method: "GET",
    },
  );

  return readOwnerBranchItems(payload);
}

function escapeCsvCell(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function parseCsvRow(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }

      continue;
    }

    if (character === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current.trim());

  return values;
}

function normalizeImportHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function resolveImportedBranchRow(row: Record<string, unknown>, index: number) {
  const rawName =
    row.name ?? row.branchName ?? row.namaCabang ?? row["nama cabang"];
  const rawStatus = row.status ?? row.branchStatus ?? row["branch status"];

  const name = normalizeBranchName(String(rawName ?? ""));
  const status = normalizeBranchStatus(String(rawStatus ?? ""));

  if (!name) {
    throw new Error(`Baris import #${index + 1} belum memiliki nama cabang.`);
  }

  if (!status) {
    throw new Error(
      `Status cabang untuk "${name}" tidak valid. Gunakan Aktif, Persiapan, atau Nonaktif.`,
    );
  }

  return { name, status };
}

function parseImportedBranches(fileName: string, rawContent: string) {
  const content = rawContent.trim();

  if (!content) {
    throw new Error("File import kosong. Pilih file CSV atau JSON yang berisi data cabang.");
  }

  if (fileName.toLowerCase().endsWith(".json")) {
    const parsed = JSON.parse(content) as unknown;
    const rows = Array.isArray(parsed)
      ? parsed
      : typeof parsed === "object" &&
          parsed !== null &&
          Array.isArray((parsed as { branches?: unknown[] }).branches)
        ? (parsed as { branches: unknown[] }).branches
        : null;

    if (!rows) {
      throw new Error("Format JSON tidak dikenali. Gunakan array data cabang.");
    }

    return rows.map((row, index) => {
      if (typeof row !== "object" || row === null) {
        throw new Error(`Baris import #${index + 1} tidak valid.`);
      }

      return resolveImportedBranchRow(row as Record<string, unknown>, index);
    });
  }

  const lines = content
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error(
      "Format CSV belum lengkap. Pastikan ada header dan minimal satu baris data.",
    );
  }

  const headers = parseCsvRow(lines[0]).map(normalizeImportHeader);
  const nameIndex = headers.findIndex((header) =>
    ["name", "branch name", "nama cabang", "namacabang"].includes(header),
  );
  const statusIndex = headers.findIndex((header) =>
    ["status", "branch status", "status cabang"].includes(header),
  );

  if (nameIndex === -1 || statusIndex === -1) {
    throw new Error(
      "Header CSV harus memuat kolom nama cabang dan status. Contoh: nama cabang,status",
    );
  }

  return lines.slice(1).map((line, index) => {
    const columns = parseCsvRow(line);

    return resolveImportedBranchRow(
      {
        name: columns[nameIndex],
        status: columns[statusIndex],
      },
      index,
    );
  });
}

function triggerDownload(fileName: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  anchor.click();

  URL.revokeObjectURL(url);
}

function createExportFileName(extension: "csv" | "json") {
  const stamp = new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .replaceAll("-", "");

  return `owner-cabang-${stamp}.${extension}`;
}

function mapRouteBranchStatusToFilter(
  status: OwnerBranchesRouteState["status"],
): OwnerDashboardBranchFilter {
  switch (status) {
    case "active":
      return "Aktif";
    case "preparation":
      return "Persiapan";
    case "inactive":
      return "Nonaktif";
    case "attention":
      return attentionBranchFilter;
    default:
      return "Semua";
  }
}

type UseOwnerDashboardOptions = {
  initialRouteState?: OwnerBranchesRouteState;
};

export function useOwnerDashboard({
  initialRouteState = defaultOwnerBranchesRouteState,
}: UseOwnerDashboardOptions = {}) {
  const routeBranchStatusFilter = mapRouteBranchStatusToFilter(initialRouteState.status);
  const [branches, setBranches] = useState<OwnerDashboardBranch[]>([]);
  const [branchAdminOptions, setBranchAdminOptions] = useState<
    OwnerDashboardBranchAdminOption[]
  >([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(true);
  const [branchSearchQuery, setBranchSearchQuery] = useState("");
  const [branchStatusFilter, setBranchStatusFilter] =
    useState<OwnerDashboardBranchFilter>(routeBranchStatusFilter);
  const [branchDialogMode, setBranchDialogMode] =
    useState<OwnerDashboardBranchDialogMode>("create");
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [isBranchDialogOpen, setIsBranchDialogOpen] = useState(false);
  const [branchForm, setBranchForm] = useState<OwnerDashboardBranchForm>({
    name: "",
    shortAddress: "",
    adminName: "",
    status: "Aktif",
  });
  const [branchFormError, setBranchFormError] = useState<string | null>(null);
  const [branchFlash, setBranchFlash] = useState<OwnerDashboardBranchFlash | null>(null);

  async function refreshBranchesFromApi(options: { notifyListeners?: boolean } = {}) {
    const nextBranches = await fetchOwnerBranchesFromApi();

    setBranches(nextBranches);

    if (options.notifyListeners) {
      notifyOwnerBranchesChanged();
    }

    return nextBranches;
  }

  useEffect(() => {
    let isCancelled = false;

    async function loadOwnerBranchResources() {
      setIsLoadingBranches(true);
      const [branchesResult, adminOptionsResult] = await Promise.allSettled([
        fetchOwnerBranchesFromApi(),
        fetchOwnerBranchAdminOptionsFromApi(),
      ]);

      if (isCancelled) {
        return;
      }

      if (branchesResult.status === "fulfilled") {
        setBranches(branchesResult.value);
      } else {
        setBranches([]);
        setBranchFlash({
          tone: "warning",
          message:
            "Data cabang dari server belum bisa dimuat. Coba refresh halaman ini lagi.",
        });
      }

      if (adminOptionsResult.status === "fulfilled") {
        setBranchAdminOptions(adminOptionsResult.value);
      } else {
        setBranchAdminOptions([]);
      }

      setIsLoadingBranches(false);
    }

    void loadOwnerBranchResources();

    return () => {
      isCancelled = true;
    };
  }, []);

  const branchSummary = useMemo(() => {
    return branches.reduce(
      (summary, branch) => {
        summary.total += 1;

        if (branch.status === "Aktif") {
          summary.active += 1;
        }

        if (branch.status === "Persiapan") {
          summary.preparation += 1;
        }

        if (branch.status === "Nonaktif") {
          summary.inactive += 1;
        }

        return summary;
      },
      {
        total: 0,
        active: 0,
        preparation: 0,
        inactive: 0,
      },
    );
  }, [branches]);

  const filteredBranches = useMemo(() => {
    const query = branchSearchQuery.trim().toLowerCase();

    return branches.filter((branch) => {
      const matchesQuery = query
        ? branch.name.toLowerCase().includes(query) ||
          branch.status.toLowerCase().includes(query)
        : true;
      const matchesStatus =
        branchStatusFilter === "Semua"
          ? true
          : branchStatusFilter === attentionBranchFilter
            ? branch.status === "Persiapan" || branch.status === "Nonaktif"
            : branch.status === branchStatusFilter;

      return matchesQuery && matchesStatus;
    });
  }, [branchSearchQuery, branchStatusFilter, branches]);

  function dismissBranchFlash() {
    setBranchFlash(null);
  }

  function resetBranchForm() {
    setBranchForm({
      name: "",
      shortAddress: "",
      adminName: "",
      status: "Aktif",
    });
    setBranchFormError(null);
    setEditingBranchId(null);
    setBranchDialogMode("create");
  }

  function openCreateDialog() {
    setBranchDialogMode("create");
    setEditingBranchId(null);
    setBranchForm({
      name: "",
      shortAddress: "",
      adminName: "",
      status: "Aktif",
    });
    setBranchFormError(null);
    setIsBranchDialogOpen(true);
  }

  function openEditDialog(branchId: string) {
    const branch = branches.find((item) => item.id === branchId);

    if (!branch) {
      return;
    }

    setBranchDialogMode("edit");
    setEditingBranchId(branch.id);
    setBranchForm({
      name: branch.name,
      shortAddress: branch.shortAddress,
      adminName: branch.adminName,
      status: branch.status,
    });
    setBranchFormError(null);
    setIsBranchDialogOpen(true);
  }

  function closeDialog() {
    setIsBranchDialogOpen(false);
    resetBranchForm();
  }

  function updateFormValue(field: keyof OwnerDashboardBranchForm, value: string) {
    setBranchFormError(null);
    setBranchForm((current) => ({
      ...current,
      [field]:
        field === "status"
          ? (normalizeBranchStatus(value) ?? current.status)
          : value,
    }));
  }

  async function submitBranchForm() {
    const name = normalizeBranchName(branchForm.name);
    const shortAddress = normalizeBranchName(branchForm.shortAddress);
    const adminName = normalizeBranchName(branchForm.adminName);
    const duplicateBranch = branches.find(
      (branch) =>
        branch.name.toLowerCase() === name.toLowerCase() &&
        branch.id !== editingBranchId,
    );

    if (!name) {
      setBranchFormError("Nama cabang wajib diisi.");
      return;
    }

    if (!shortAddress) {
      setBranchFormError("Alamat cabang wajib diisi.");
      return;
    }

    if (duplicateBranch) {
      setBranchFormError("Nama cabang sudah ada. Gunakan nama lain agar data tidak dobel.");
      return;
    }

    try {
      if (branchDialogMode === "edit" && editingBranchId) {
        const existingBranch =
          branches.find((branch) => branch.id === editingBranchId) ?? null;

        await requestAdminApi<{ branch: OwnerBranchApiItem }>(
          `/api/branches/${encodeURIComponent(extractPersistedBranchId(editingBranchId))}`,
          {
            method: "PUT",
            body: JSON.stringify(
              buildBranchMutationPayload(
                {
                  name,
                  shortAddress,
                  adminName,
                  status: branchForm.status,
                },
                existingBranch,
              ),
            ),
          },
        );
        setBranchFlash({
          tone: "success",
          message: `Cabang ${name} berhasil diperbarui.`,
        });
      } else {
        await requestAdminApi<{ branch: OwnerBranchApiItem }>("/api/branches", {
          method: "POST",
          body: JSON.stringify(
            buildBranchMutationPayload({
              name,
              shortAddress,
              adminName,
              status: branchForm.status,
            }),
          ),
        });
        setBranchFlash({
          tone: "success",
          message: `Cabang ${name} berhasil ditambahkan.`,
        });
      }

      await refreshBranchesFromApi({ notifyListeners: true });
      closeDialog();
    } catch (error) {
      setBranchFormError(
        error instanceof Error
          ? error.message
          : "Data cabang gagal disimpan. Coba ulangi lagi.",
      );
    }
  }

  function submitForm() {
    void submitBranchForm();
  }

  async function removeBranchFromApi(branchId: string) {
    const branch = branches.find((item) => item.id === branchId);

    if (!branch) {
      return;
    }

    try {
      await requestAdminApi<Record<string, never>>(
        `/api/branches/${encodeURIComponent(extractPersistedBranchId(branchId))}`,
        {
          method: "DELETE",
        },
      );
      setBranchFlash({
        tone: "warning",
        message: `Cabang ${branch.name} berhasil dihapus dari daftar.`,
      });
      await refreshBranchesFromApi({ notifyListeners: true });
    } catch (error) {
      setBranchFlash({
        tone: "danger",
        message:
          error instanceof Error
            ? error.message
            : "Cabang gagal dihapus. Coba ulangi lagi.",
      });
    }
  }

  function removeBranch(branchId: string) {
    void removeBranchFromApi(branchId);
  }

  async function importBranches(file: File) {
    try {
      const content = await file.text();
      const importedBranches = parseImportedBranches(file.name, content);
      const currentBranches = await fetchOwnerBranchesFromApi();
      let createdCount = 0;
      let updatedCount = 0;

      for (const branch of importedBranches) {
        const matchIndex = currentBranches.findIndex(
          (item) => item.name.toLowerCase() === branch.name.toLowerCase(),
        );

        if (matchIndex >= 0) {
          const persistedBranchId = extractPersistedBranchId(currentBranches[matchIndex].id);

          await requestAdminApi<{ branch: OwnerBranchApiItem }>(
            `/api/branches/${encodeURIComponent(persistedBranchId)}`,
            {
              method: "PUT",
              body: JSON.stringify(
                buildBranchMutationPayload(
                  {
                    name: branch.name,
                    shortAddress: currentBranches[matchIndex].shortAddress,
                    adminName: currentBranches[matchIndex].adminName,
                    status: branch.status,
                  },
                  currentBranches[matchIndex],
                ),
              ),
            },
          );
          currentBranches[matchIndex] = {
            ...currentBranches[matchIndex],
            name: branch.name,
            status: branch.status,
          };
          updatedCount += 1;
          continue;
        }

        await requestAdminApi<{ branch: OwnerBranchApiItem }>("/api/branches", {
          method: "POST",
          body: JSON.stringify(
            buildBranchMutationPayload({
              name: branch.name,
              shortAddress: "",
              adminName: "",
              status: branch.status,
            }),
          ),
        });
        createdCount += 1;
      }

      await refreshBranchesFromApi({ notifyListeners: true });
      setBranchFlash({
        tone: updatedCount > 0 ? "info" : "success",
        message:
          updatedCount > 0
            ? `Import selesai. ${createdCount} cabang baru ditambahkan dan ${updatedCount} cabang diperbarui.`
            : `Import selesai. ${createdCount} cabang baru berhasil ditambahkan.`,
      });
    } catch (error) {
      setBranchFlash({
        tone: "danger",
        message:
          error instanceof Error
            ? error.message
            : "Import cabang gagal diproses. Coba ulangi lagi.",
      });
    }
  }

  function exportBranches(format: "csv" | "json") {
    const exportRows = branches.map((branch) => ({
      name: branch.name,
      status: branch.status,
      updatedAt: branch.updatedAt,
    }));

    if (format === "json") {
      triggerDownload(
        createExportFileName("json"),
        JSON.stringify(exportRows, null, 2),
        "application/json;charset=utf-8",
      );
      setBranchFlash({
        tone: "success",
        message: "Export JSON cabang berhasil disiapkan.",
      });
      return;
    }

    const csvContent = [
      "nama cabang,status,updated at",
      ...exportRows.map((branch) =>
        [
          escapeCsvCell(branch.name),
          escapeCsvCell(branch.status),
          escapeCsvCell(branch.updatedAt),
        ].join(","),
      ),
    ].join("\n");

    triggerDownload(
      createExportFileName("csv"),
      csvContent,
      "text/csv;charset=utf-8",
    );
    setBranchFlash({
      tone: "success",
      message: "Export CSV cabang berhasil disiapkan.",
    });
  }

  function resetFilters() {
    setBranchSearchQuery("");
    setBranchStatusFilter("Semua");
  }

  const dialog: OwnerDashboardBranchDialogState = {
    isOpen: isBranchDialogOpen,
    mode: branchDialogMode,
    title: branchDialogMode === "create" ? "Tambah cabang baru" : "Edit cabang",
    description:
      branchDialogMode === "create"
        ? "Lengkapi nama, alamat, dan status. Pilih admin cabang dari daftar akun admin yang sudah dibuat pada menu Admin Cabang."
        : "Perbarui nama, alamat, status, dan pilih admin cabang dari akun staf yang tersedia.",
    submitLabel:
      branchDialogMode === "create" ? "Simpan cabang" : "Update perubahan",
    error: branchFormError,
  };

  const branchManager: OwnerDashboardBranchManager = {
    branches: filteredBranches,
    totalBranches: branches.length,
    filteredBranchCount: filteredBranches.length,
    isLoading: isLoadingBranches,
    branchSearchQuery,
    setBranchSearchQuery,
    branchStatusFilter,
    setBranchStatusFilter,
    branchFilterOptions,
    branchStatusOptions,
    branchAdminOptions,
    summary: branchSummary,
    statusMeta: branchStatusMeta,
    flash: branchFlash,
    dismissFlash: dismissBranchFlash,
    dialog,
    form: branchForm,
    openCreateDialog,
    openEditDialog,
    closeDialog,
    updateFormValue,
    submitForm,
    removeBranch,
    importBranches,
    exportBranches,
    resetFilters,
  };

  return {
    branchManager,
  };
}
