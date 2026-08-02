"use client";

import {
  Building2,
  Eye,
  EyeOff,
  FilterX,
  KeyRound,
  LoaderCircle,
  Mail,
  PencilLine,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { OwnerDashboardBranchAdminManager } from "@/components/dashboard-owner/hooks/useOwnerBranchAdmins";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { requestAdminApi } from "@/lib/admin-api";

type OwnerDashboardBranchAdminsSectionProps = {
  manager: OwnerDashboardBranchAdminManager;
};

type OwnerAdminBranch = {
  branchId: string;
  name: string;
  shortAddress: string;
  fullAddress: string;
  phone: string;
  email: string;
  status: string;
  adminName: string;
  adminUserId: string | null;
};

const flashToneClasses = {
  success: "border-emerald-200/80 bg-emerald-50/85 text-emerald-700",
  warning: "border-amber-200/80 bg-amber-50/85 text-amber-700",
  danger: "border-red-200/80 bg-red-50/85 text-red-700",
  info: "border-orange-200/80 bg-orange-50/90 text-orange-700",
} as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function InputError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-xs leading-5 text-rose-600">{message}</p>;
}

export function OwnerDashboardBranchAdminsSection({
  manager,
}: OwnerDashboardBranchAdminsSectionProps) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [branches, setBranches] = useState<OwnerAdminBranch[]>([]);
  const [assignmentAdminId, setAssignmentAdminId] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [isSavingAssignment, setIsSavingAssignment] = useState(false);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadBranches() {
      try {
        const response = await requestAdminApi<{ branches: OwnerAdminBranch[] }>(
          "/api/branches",
          { method: "GET" },
        );

        if (!isCancelled) {
          setBranches(response.data?.branches ?? []);
        }
      } catch {
        if (!isCancelled) {
          setBranches([]);
        }
      }
    }

    void loadBranches();

    return () => {
      isCancelled = true;
    };
  }, [manager.totalAdmins]);

  const assignedBranchesByAdmin = useMemo(() => {
    const directory = new Map<string, OwnerAdminBranch[]>();

    for (const admin of manager.admins) {
      directory.set(
        admin.id,
        branches.filter(
          (branch) =>
            branch.adminUserId === admin.id ||
            branch.adminName.trim().toLowerCase() === admin.name.trim().toLowerCase(),
        ),
      );
    }

    return directory;
  }, [branches, manager.admins]);

  const assignmentAdmin = manager.admins.find(
    (admin) => admin.id === assignmentAdminId,
  );

  function openAssignmentDialog(adminId: string) {
    const currentAssignment = assignedBranchesByAdmin.get(adminId)?.[0];

    setAssignmentAdminId(adminId);
    setSelectedBranchId(currentAssignment?.branchId ?? "");
    setAssignmentError(null);
  }

  function closeAssignmentDialog() {
    setAssignmentAdminId(null);
    setSelectedBranchId("");
    setAssignmentError(null);
  }

  async function saveBranchAssignment() {
    const admin = assignmentAdmin;
    const branch = branches.find((item) => item.branchId === selectedBranchId);

    if (!admin || !branch) {
      setAssignmentError("Pilih cabang terlebih dahulu.");
      return;
    }

    setIsSavingAssignment(true);
    setAssignmentError(null);

    try {
      await requestAdminApi<{ branch: OwnerAdminBranch }>(
        `/api/branches/${encodeURIComponent(branch.branchId)}`,
        {
          method: "PUT",
          body: JSON.stringify({
            name: branch.name,
            shortAddress: branch.shortAddress,
            fullAddress: branch.fullAddress,
            phone: branch.phone,
            email: branch.email,
            status: branch.status,
            adminName: admin.name,
            adminUserId: admin.id,
          }),
        },
      );

      setBranches((current) =>
        current.map((item) =>
          item.branchId === branch.branchId
            ? { ...item, adminName: admin.name, adminUserId: admin.id }
            : item,
        ),
      );
      closeAssignmentDialog();
    } catch (error) {
      setAssignmentError(
        error instanceof Error
          ? error.message
          : "Penugasan cabang gagal disimpan.",
      );
    } finally {
      setIsSavingAssignment(false);
    }
  }

  const hasActiveFilters =
    manager.searchQuery.trim().length > 0 ||
    manager.verificationFilter !== "Semua";
  const emptyStateTitle = manager.isLoading
    ? "Memuat data admin cabang..."
    : hasActiveFilters
      ? "Belum ada admin cabang yang cocok"
      : "Belum ada akun admin cabang";
  const emptyStateDescription = manager.isLoading
    ? "Sedang memuat daftar admin cabang..."
    : hasActiveFilters
      ? "Coba ubah kata kunci pencarian atau reset filter agar data kembali tampil."
      : "Buat akun admin cabang baru agar bisa dipilih pada form cabang.";

  function handleDeleteAdmin(adminId: string, adminName: string) {
    const confirmed = window.confirm(
      `Hapus akun admin ${adminName}? Cabang yang memakai admin ini akan kembali ke status Belum ditentukan.`,
    );

    if (!confirmed) {
      return;
    }

    manager.removeAdmin(adminId);
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
              Admin Cabang
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              Kelola data akun admin seluruh cabang.
            </p>
          </div>

          <Badge
            variant="info"
            className="w-fit rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.18em]"
          >
            {manager.filteredAdminCount} dari {manager.totalAdmins} admin tampil
          </Badge>
        </div>

        <section className="space-y-5 rounded-[30px] border border-orange-100/70 bg-white/92 px-6 py-6 shadow-[0_18px_42px_-28px_rgba(15,23,42,0.18),0_12px_26px_-22px_rgba(249,115,22,0.18)] backdrop-blur-sm">
          <div className="space-y-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-2xl">
                <h3 className="text-xl font-semibold tracking-tight text-slate-950">
                  Daftar akun admin cabang
                </h3>
              </div>

              <Button
                type="button"
                variant="secondary"
                className="w-full rounded-full xl:w-auto"
                onClick={() => {
                  setIsPasswordVisible(false);
                  setIsConfirmPasswordVisible(false);
                  manager.openCreateDialog();
                }}
              >
                <Plus className="size-4" />
                Tambah admin cabang
              </Button>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={manager.searchQuery}
                  onChange={(event) => manager.setSearchQuery(event.target.value)}
                  placeholder="Cari nama atau email admin..."
                  className="pl-10"
                />
              </div>

              <Select
                value={manager.verificationFilter}
                onValueChange={(value) =>
                  manager.setVerificationFilter(
                    value as typeof manager.verificationFilter,
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter verifikasi" />
                </SelectTrigger>
                <SelectContent>
                  {manager.verificationFilterOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex justify-start lg:justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-full"
                  onClick={manager.resetFilters}
                  disabled={!hasActiveFilters}
                >
                  <FilterX className="size-4" />
                  Reset filter
                </Button>
              </div>
            </div>

            {manager.flash ? (
              <div
                className={cn(
                  "flex items-start justify-between gap-4 rounded-[24px] border px-4 py-3 text-sm",
                  flashToneClasses[manager.flash.tone],
                )}
              >
                <p className="leading-6">{manager.flash.message}</p>
                <button
                  type="button"
                  className="rounded-full p-1 transition hover:bg-white/70"
                  onClick={manager.dismissFlash}
                >
                  <X className="size-4" />
                  <span className="sr-only">Tutup notifikasi admin cabang</span>
                </button>
              </div>
            ) : null}
          </div>

          <div className="-mx-6 overflow-x-auto overflow-y-hidden border-t border-slate-200/80">
            <Table className="min-w-[1120px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 px-6">No</TableHead>
                  <TableHead>Nama Admin</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="w-52">Cabang</TableHead>
                  <TableHead className="w-52">Status Admin</TableHead>
                  <TableHead className="w-40">Dibuat</TableHead>
                  <TableHead className="w-40">Update Terakhir</TableHead>
                  <TableHead className="w-40 px-6 text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {manager.admins.length > 0 ? (
                  manager.admins.map((admin, index) => (
                    <TableRow key={admin.id}>
                      <TableCell className="px-6 text-sm font-semibold text-slate-500">
                        {index + 1}
                      </TableCell>
                      <TableCell>
                        <div className="inline-flex items-center gap-2">
                          <span className="flex size-9 items-center justify-center rounded-full bg-orange-50 text-orange-600">
                            <UserCog className="size-4" />
                          </span>
                          <div>
                            <p className="font-semibold text-slate-900">
                              {admin.name}
                            </p>
                            <p className="text-xs text-slate-400">
                              Role admin cabang
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-slate-500">
                          {admin.email}
                        </span>
                      </TableCell>
                      <TableCell>
                        {assignedBranchesByAdmin.get(admin.id)?.length ? (
                          <div className="flex flex-wrap gap-1.5">
                            {assignedBranchesByAdmin.get(admin.id)?.map((branch) => (
                              <Badge
                                key={branch.branchId}
                                variant="secondary"
                                className="rounded-lg border border-orange-100 bg-orange-50 text-orange-700"
                              >
                                {branch.name}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">
                            Belum ditugaskan
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <Badge
                            variant={admin.isEmailVerified ? "success" : "warning"}
                            className="rounded-full px-3 py-1.5"
                          >
                            <span
                              className={cn(
                                "size-2 rounded-full",
                                admin.isEmailVerified
                                  ? "bg-emerald-500"
                                  : "bg-amber-500",
                              )}
                            />
                            {admin.isEmailVerified
                              ? "Aktif"
                              : "Menunggu Verifikasi"}
                          </Badge>

                          {admin.emailVerifiedAt ? (
                            <p className="text-xs leading-5 text-slate-500">
                              Diverifikasi pada {formatDate(admin.emailVerifiedAt)}
                            </p>
                          ) : null}

                          {!admin.isEmailVerified ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="rounded-full"
                              onClick={() => manager.resendVerification(admin.id)}
                              disabled={manager.resendingAdminId === admin.id}
                            >
                              {manager.resendingAdminId === admin.id ? (
                                <LoaderCircle className="size-4 animate-spin" />
                              ) : (
                                <Mail className="size-4" />
                              )}
                              Kirim Ulang Verifikasi
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-slate-500">
                          {formatDate(admin.createdAt)}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-slate-500">
                          {formatDate(admin.updatedAt)}
                        </p>
                      </TableCell>
                      <TableCell className="px-6">
                        <div className="flex items-center justify-center gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="size-10 rounded-lg text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                                onClick={() => openAssignmentDialog(admin.id)}
                              >
                                <Building2 className="size-4" />
                                <span className="sr-only">Pilih cabang</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Pilih cabang</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="size-10 rounded-full"
                                onClick={() => {
                                  setIsPasswordVisible(false);
                                  setIsConfirmPasswordVisible(false);
                                  manager.openEditDialog(admin.id);
                                }}
                              >
                                <PencilLine className="size-4" />
                                <span className="sr-only">Edit admin cabang</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit admin cabang</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="size-10 rounded-full text-red-500 hover:bg-red-50 hover:text-red-600"
                                onClick={() => handleDeleteAdmin(admin.id, admin.name)}
                              >
                                <Trash2 className="size-4" />
                                <span className="sr-only">Hapus admin cabang</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Hapus admin cabang</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : manager.isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell className="px-6 py-4"><Skeleton className="h-4 w-6" /></TableCell>
                      <TableCell className="px-4 py-4"><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell className="px-4 py-4"><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell className="px-4 py-4"><Skeleton className="h-6 w-24 rounded-lg" /></TableCell>
                      <TableCell className="px-4 py-4"><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell className="px-4 py-4"><Skeleton className="h-4 w-36" /></TableCell>
                      <TableCell className="px-4 py-4"><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                      <TableCell className="px-4 py-4">
                        <div className="flex gap-1">
                          <Skeleton className="size-9 rounded-full" />
                          <Skeleton className="size-9 rounded-full" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="px-6 py-14">
                      <div className="flex flex-col items-center gap-3 text-center">
                        <div className="flex size-14 items-center justify-center rounded-full bg-orange-50 text-orange-600">
                          <ShieldCheck className="size-6" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-base font-semibold text-slate-900">
                            {emptyStateTitle}
                          </p>
                          <p className="max-w-md text-sm leading-6 text-slate-500">
                            {emptyStateDescription}
                          </p>
                        </div>
                        {!manager.isLoading ? (
                          <Button
                            type="button"
                            variant="subtle"
                            className="rounded-full"
                            onClick={() => {
                              setIsPasswordVisible(false);
                              setIsConfirmPasswordVisible(false);
                              manager.openCreateDialog();
                            }}
                          >
                            <Plus className="size-4" />
                            Tambah admin cabang
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        <Dialog
          open={assignmentAdminId !== null}
          onOpenChange={(open) => {
            if (!open) {
              closeAssignmentDialog();
            }
          }}
        >
          <DialogContent className="max-w-lg rounded-2xl">
            <DialogHeader>
              <DialogTitle>Pilih cabang admin</DialogTitle>
              <DialogDescription>
                Tetapkan cabang yang dikelola oleh akun {assignmentAdmin?.name ?? "admin"}.
                Data disimpan melalui endpoint cabang yang sudah ada.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <label
                className="text-sm font-medium text-slate-700"
                htmlFor="owner-admin-branch-assignment"
              >
                Cabang
              </label>
              <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                <SelectTrigger id="owner-admin-branch-assignment">
                  <SelectValue placeholder="Pilih cabang" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.branchId} value={branch.branchId}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs leading-5 text-slate-500">
                Penugasan ini memakai relasi admin pada data cabang. Penugasan cabang
                lain yang sudah dimiliki akun tidak dihapus otomatis.
              </p>
            </div>

            {assignmentError ? (
              <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                {assignmentError}
              </div>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={closeAssignmentDialog}>
                Batal
              </Button>
              <Button
                type="button"
                className="bg-orange-600 text-white hover:bg-orange-700"
                onClick={() => void saveBranchAssignment()}
                disabled={isSavingAssignment || !selectedBranchId}
              >
                {isSavingAssignment ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Building2 className="size-4" />
                )}
                Simpan cabang
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={manager.dialog.isOpen}
          onOpenChange={(open) => {
            if (!open) {
              setIsPasswordVisible(false);
              setIsConfirmPasswordVisible(false);
              manager.closeDialog();
            }
          }}
        >
          <DialogContent className="max-w-lg">
            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                manager.submitForm();
              }}
            >
              <DialogHeader>
                <DialogTitle>{manager.dialog.title}</DialogTitle>
                <DialogDescription>{manager.dialog.description}</DialogDescription>
              </DialogHeader>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium text-slate-700"
                    htmlFor="owner-branch-admin-name"
                  >
                    Nama admin
                  </label>
                  <Input
                    id="owner-branch-admin-name"
                    value={manager.form.name}
                    onChange={(event) =>
                      manager.updateFormValue("name", event.target.value)
                    }
                    placeholder="Contoh: Admin Slawi Timur"
                  />
                  <InputError message={manager.dialog.fieldErrors.name} />
                </div>

                <div className="space-y-2">
                  <label
                    className="text-sm font-medium text-slate-700"
                    htmlFor="owner-branch-admin-email"
                  >
                    Email admin
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="owner-branch-admin-email"
                      type="email"
                      value={manager.form.email}
                      onChange={(event) =>
                        manager.updateFormValue("email", event.target.value)
                      }
                      placeholder="admin@bimbel.com"
                      className="pl-10"
                    />
                  </div>
                  <InputError message={manager.dialog.fieldErrors.email} />
                </div>

                <div className="space-y-2">
                  <label
                    className="text-sm font-medium text-slate-700"
                    htmlFor="owner-branch-admin-password"
                  >
                    {manager.dialog.mode === "create"
                      ? "Password sementara"
                      : "Password baru (Opsional)"}
                  </label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="owner-branch-admin-password"
                      type={isPasswordVisible ? "text" : "password"}
                      value={manager.form.password}
                      onChange={(event) =>
                        manager.updateFormValue("password", event.target.value)
                      }
                      placeholder={
                        manager.dialog.mode === "create"
                          ? "Minimal 8 karakter"
                          : "Kosongkan jika tidak diubah"
                      }
                      className="pl-10 pr-12"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 inline-flex w-12 items-center justify-center text-slate-400 transition hover:text-orange-600"
                      onClick={() => setIsPasswordVisible((current) => !current)}
                      aria-label={
                        isPasswordVisible
                          ? "Sembunyikan password"
                          : "Tampilkan password"
                      }
                    >
                      {isPasswordVisible ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                  <InputError message={manager.dialog.fieldErrors.password} />
                </div>

                <div className="space-y-2">
                  <label
                    className="text-sm font-medium text-slate-700"
                    htmlFor="owner-branch-admin-confirm-password"
                  >
                    Konfirmasi password
                  </label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="owner-branch-admin-confirm-password"
                      type={isConfirmPasswordVisible ? "text" : "password"}
                      value={manager.form.confirmPassword}
                      onChange={(event) =>
                        manager.updateFormValue(
                          "confirmPassword",
                          event.target.value,
                        )
                      }
                      placeholder="Ulangi password admin"
                      className="pl-10 pr-12"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 inline-flex w-12 items-center justify-center text-slate-400 transition hover:text-orange-600"
                      onClick={() =>
                        setIsConfirmPasswordVisible((current) => !current)
                      }
                      aria-label={
                        isConfirmPasswordVisible
                          ? "Sembunyikan konfirmasi password"
                          : "Tampilkan konfirmasi password"
                      }
                    >
                      {isConfirmPasswordVisible ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                  <InputError message={manager.dialog.fieldErrors.confirmPassword} />
                </div>

                {manager.dialog.mode === "edit" ? (
                  <div className="rounded-xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-sm text-amber-800">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="font-medium text-amber-900">
                        Reset password admin cabang
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full shrink-0 rounded-full border-amber-200 bg-white text-amber-700 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800 sm:w-auto"
                        disabled={
                          manager.isResettingPassword || manager.isSubmitting
                        }
                        onClick={manager.resetPassword}
                      >
                        {manager.isResettingPassword ? (
                          <LoaderCircle className="size-4 animate-spin" />
                        ) : (
                          <KeyRound className="size-4" />
                        )}
                        {manager.isResettingPassword
                          ? "Mereset..."
                          : "Reset Password"}
                      </Button>
                    </div>

                    {manager.passwordResetNotice ? (
                      <div className="mt-3 rounded-lg border border-emerald-100 bg-white px-3 py-2 text-emerald-700">
                        <p className="font-medium">
                          Password {manager.passwordResetNotice.adminName} berhasil
                          direset.
                        </p>
                        <p className="mt-1 text-xs leading-6">
                          Email: {manager.passwordResetNotice.email} | Password:{" "}
                          {manager.passwordResetNotice.password}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {manager.dialog.error ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50/85 px-4 py-3 text-sm text-red-600">
                    {manager.dialog.error}
                  </div>
                ) : null}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-full"
                  onClick={() => {
                    setIsPasswordVisible(false);
                    setIsConfirmPasswordVisible(false);
                    manager.closeDialog();
                  }}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="secondary"
                  className="rounded-full"
                  disabled={manager.isSubmitting || manager.isResettingPassword}
                >
                  {manager.isSubmitting ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" />
                      Menyimpan admin...
                    </>
                  ) : (
                    manager.dialog.submitLabel
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
