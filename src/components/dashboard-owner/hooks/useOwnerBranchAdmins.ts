"use client";

import { useEffect, useMemo, useState } from "react";

import { AdminApiRequestError } from "@/lib/admin-api";
import {
  createOwnerBranchAdminAccount,
  deleteOwnerBranchAdminAccount,
  fetchOwnerBranchAdminAccountsFromApi,
  normalizeOwnerBranchAdminName,
  resendOwnerBranchAdminVerification,
  updateOwnerBranchAdminAccount,
  type OwnerBranchAdminAccount,
} from "@/lib/owner-branch-admins";

export type OwnerDashboardBranchAdminVerificationFilter =
  | "Semua"
  | "Terverifikasi"
  | "Belum Terverifikasi";

export type OwnerDashboardBranchAdminForm = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export type OwnerDashboardBranchAdminFieldErrors = Partial<
  Record<keyof OwnerDashboardBranchAdminForm, string>
>;

export type OwnerDashboardBranchAdminDialogMode = "create" | "edit";

export type OwnerDashboardBranchAdminDialogState = {
  isOpen: boolean;
  mode: OwnerDashboardBranchAdminDialogMode;
  title: string;
  description: string;
  submitLabel: string;
  error: string | null;
  fieldErrors: OwnerDashboardBranchAdminFieldErrors;
};

export type OwnerDashboardBranchAdminFlashTone =
  | "success"
  | "warning"
  | "danger"
  | "info";

export type OwnerDashboardBranchAdminFlash = {
  tone: OwnerDashboardBranchAdminFlashTone;
  message: string;
};

export type OwnerDashboardBranchAdminManager = {
  admins: OwnerBranchAdminAccount[];
  totalAdmins: number;
  filteredAdminCount: number;
  isLoading: boolean;
  isSubmitting: boolean;
  resendingAdminId: string | null;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  verificationFilter: OwnerDashboardBranchAdminVerificationFilter;
  setVerificationFilter: (
    value: OwnerDashboardBranchAdminVerificationFilter,
  ) => void;
  verificationFilterOptions: readonly OwnerDashboardBranchAdminVerificationFilter[];
  flash: OwnerDashboardBranchAdminFlash | null;
  dismissFlash: () => void;
  dialog: OwnerDashboardBranchAdminDialogState;
  form: OwnerDashboardBranchAdminForm;
  openCreateDialog: () => void;
  openEditDialog: (adminId: string) => void;
  closeDialog: () => void;
  updateFormValue: (field: keyof OwnerDashboardBranchAdminForm, value: string) => void;
  submitForm: () => void;
  removeAdmin: (adminId: string) => void;
  resendVerification: (adminId: string) => void;
  resetFilters: () => void;
};

const verificationFilterOptions = [
  "Semua",
  "Terverifikasi",
  "Belum Terverifikasi",
] as const satisfies readonly OwnerDashboardBranchAdminVerificationFilter[];

function readAdminFieldErrors(
  errors: AdminApiRequestError["errors"],
): OwnerDashboardBranchAdminFieldErrors {
  if (!errors || typeof errors !== "object" || Array.isArray(errors)) {
    return {};
  }

  return errors as OwnerDashboardBranchAdminFieldErrors;
}

export function useOwnerBranchAdmins() {
  const [admins, setAdmins] = useState<OwnerBranchAdminAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendingAdminId, setResendingAdminId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [verificationFilter, setVerificationFilter] =
    useState<OwnerDashboardBranchAdminVerificationFilter>("Semua");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] =
    useState<OwnerDashboardBranchAdminDialogMode>("create");
  const [editingAdminId, setEditingAdminId] = useState<string | null>(null);
  const [form, setForm] = useState<OwnerDashboardBranchAdminForm>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<OwnerDashboardBranchAdminFieldErrors>({});
  const [flash, setFlash] = useState<OwnerDashboardBranchAdminFlash | null>(null);

  async function refreshAdminAccounts() {
    const nextAdmins = await fetchOwnerBranchAdminAccountsFromApi();
    setAdmins(nextAdmins);
    return nextAdmins;
  }

  useEffect(() => {
    let isCancelled = false;

    async function loadAdminAccounts() {
      setIsLoading(true);

      try {
        const nextAdmins = await fetchOwnerBranchAdminAccountsFromApi();

        if (isCancelled) {
          return;
        }

        setAdmins(nextAdmins);
      } catch {
        if (isCancelled) {
          return;
        }

        setAdmins([]);
        setFlash({
          tone: "warning",
          message:
            "Data admin cabang dari server belum bisa dimuat. Coba refresh halaman ini lagi.",
        });
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadAdminAccounts();

    return () => {
      isCancelled = true;
    };
  }, []);

  const orderedAdmins = useMemo(() => {
    return [...admins].sort((firstAdmin, secondAdmin) => {
      const firstCreatedAt = new Date(firstAdmin.createdAt).getTime();
      const secondCreatedAt = new Date(secondAdmin.createdAt).getTime();

      if (
        Number.isFinite(firstCreatedAt) &&
        Number.isFinite(secondCreatedAt) &&
        firstCreatedAt !== secondCreatedAt
      ) {
        return firstCreatedAt - secondCreatedAt;
      }

      return firstAdmin.name.localeCompare(secondAdmin.name, "id-ID");
    });
  }, [admins]);

  const filteredAdmins = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return orderedAdmins.filter((admin) => {
      const matchesQuery = normalizedQuery
        ? admin.name.toLowerCase().includes(normalizedQuery) ||
          admin.email.toLowerCase().includes(normalizedQuery)
        : true;
      const matchesVerification =
        verificationFilter === "Semua"
          ? true
          : verificationFilter === "Terverifikasi"
            ? admin.isEmailVerified
            : !admin.isEmailVerified;

      return matchesQuery && matchesVerification;
    });
  }, [orderedAdmins, searchQuery, verificationFilter]);

  function dismissFlash() {
    setFlash(null);
  }

  function resetForm() {
    setForm({
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    });
    setDialogError(null);
    setFieldErrors({});
    setEditingAdminId(null);
    setDialogMode("create");
  }

  function openCreateDialog() {
    resetForm();
    setIsDialogOpen(true);
  }

  function openEditDialog(adminId: string) {
    const admin = admins.find((item) => item.id === adminId);

    if (!admin) {
      return;
    }

    setDialogMode("edit");
    setEditingAdminId(admin.id);
    setForm({
      name: admin.name,
      email: admin.email,
      password: "",
      confirmPassword: "",
    });
    setDialogError(null);
    setFieldErrors({});
    setIsDialogOpen(true);
  }

  function closeDialog() {
    setIsDialogOpen(false);
    resetForm();
  }

  function updateFormValue(field: keyof OwnerDashboardBranchAdminForm, value: string) {
    setDialogError(null);
    setFieldErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function submitAdminForm() {
    const name = normalizeOwnerBranchAdminName(form.name);
    const email = form.email.trim().toLowerCase();
    const password = form.password.trim();
    const confirmPassword = form.confirmPassword.trim();
    const nextErrors: OwnerDashboardBranchAdminFieldErrors = {};

    if (!name) {
      nextErrors.name = "Nama admin wajib diisi.";
    }

    if (!email) {
      nextErrors.email = "Email admin wajib diisi.";
    }

    if (dialogMode === "create" || password) {
      if (dialogMode === "create" && !password) {
        nextErrors.password = "Password admin wajib diisi.";
      } else if (password && password.length < 8) {
        nextErrors.password = "Password admin minimal 8 karakter.";
      }

      if (password && !confirmPassword) {
        nextErrors.confirmPassword = "Konfirmasi password admin wajib diisi.";
      } else if (password && password !== confirmPassword) {
        nextErrors.confirmPassword = "Konfirmasi password admin tidak cocok.";
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setDialogError("Lengkapi data admin cabang terlebih dahulu.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (dialogMode === "edit" && editingAdminId) {
        await updateOwnerBranchAdminAccount(editingAdminId, {
          name,
          email,
          password: password || undefined,
          confirmPassword: confirmPassword || undefined,
        });
        setFlash({
          tone: "success",
          message: `Akun admin ${name} berhasil diperbarui.`,
        });
      } else {
        const response = await createOwnerBranchAdminAccount({
          name,
          email,
          password,
          confirmPassword,
        });
        const verificationEmailSent = response.data?.verificationEmailSent === true;
        setFlash({
          tone: verificationEmailSent ? "success" : "warning",
          message: response.message,
        });
      }

      await refreshAdminAccounts();
      closeDialog();
    } catch (error) {
      if (error instanceof AdminApiRequestError) {
        setDialogError(error.message);
        setFieldErrors(readAdminFieldErrors(error.errors));
      } else {
        setDialogError("Perubahan akun admin cabang gagal disimpan. Coba ulangi lagi.");
        setFieldErrors({});
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function submitForm() {
    void submitAdminForm();
  }

  async function removeAdminFromApi(adminId: string) {
    const admin = admins.find((item) => item.id === adminId);

    if (!admin) {
      return;
    }

    try {
      await deleteOwnerBranchAdminAccount(adminId);
      setFlash({
        tone: "warning",
        message: `Akun admin ${admin.name} berhasil dihapus.`,
      });
      await refreshAdminAccounts();
    } catch (error) {
      setFlash({
        tone: "danger",
        message:
          error instanceof Error
            ? error.message
            : "Akun admin cabang gagal dihapus. Coba ulangi lagi.",
      });
    }
  }

  function removeAdmin(adminId: string) {
    void removeAdminFromApi(adminId);
  }

  async function resendVerificationFromApi(adminId: string) {
    const admin = admins.find((item) => item.id === adminId);

    if (!admin || admin.isEmailVerified) {
      return;
    }

    setResendingAdminId(adminId);

    try {
      const response = await resendOwnerBranchAdminVerification(adminId);
      setFlash({
        tone: "success",
        message: response.message,
      });
      await refreshAdminAccounts();
    } catch (error) {
      setFlash({
        tone: "danger",
        message:
          error instanceof Error
            ? error.message
            : "Email verifikasi belum berhasil dikirim ulang. Coba lagi.",
      });
    } finally {
      setResendingAdminId(null);
    }
  }

  function resendVerification(adminId: string) {
    void resendVerificationFromApi(adminId);
  }

  function resetFilters() {
    setSearchQuery("");
    setVerificationFilter("Semua");
  }

  const dialog: OwnerDashboardBranchAdminDialogState = {
    isOpen: isDialogOpen,
    mode: dialogMode,
    title:
      dialogMode === "create" ? "Tambah admin cabang" : "Edit akun admin cabang",
    description:
      dialogMode === "create"
        ? "Buat akun admin cabang baru. Setelah dibuat, akun ini bisa langsung dipilih pada form cabang."
        : "Perbarui nama atau email admin cabang. Password tidak diubah dari form ini.",
    submitLabel:
      dialogMode === "create" ? "Buat akun admin" : "Simpan perubahan",
    error: dialogError,
    fieldErrors,
  };

  const manager: OwnerDashboardBranchAdminManager = {
    admins: filteredAdmins,
    totalAdmins: admins.length,
    filteredAdminCount: filteredAdmins.length,
    isLoading,
    isSubmitting,
    resendingAdminId,
    searchQuery,
    setSearchQuery,
    verificationFilter,
    setVerificationFilter,
    verificationFilterOptions,
    flash,
    dismissFlash,
    dialog,
    form,
    openCreateDialog,
    openEditDialog,
    closeDialog,
    updateFormValue,
    submitForm,
    removeAdmin,
    resendVerification,
    resetFilters,
  };

  return {
    branchAdminManager: manager,
  };
}
