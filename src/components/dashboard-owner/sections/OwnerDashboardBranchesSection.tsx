"use client";

import type { ChangeEvent } from "react";
import {
  Building2,
  Download,
  FilterX,
  GraduationCap,
  MapPin,
  PencilLine,
  Plus,
  Search,
  Trash2,
  Upload,
  UserCog,
  X,
  RotateCcw,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";

import type {
  OwnerDashboardBranch,
  OwnerDashboardBranchManager,
} from "@/components/dashboard-owner/hooks";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type OwnerDashboardBranchesSectionProps = {
  manager: OwnerDashboardBranchManager;
};

const flashToneClasses = {
  success: "border-emerald-200/80 bg-emerald-50/85 text-emerald-700",
  warning: "border-amber-200/80 bg-amber-50/85 text-amber-700",
  danger: "border-red-200/80 bg-red-50/85 text-red-700",
  info: "border-orange-200/80 bg-orange-50/90 text-orange-700",
} as const;

const missingFieldLabel = "Belum diatur";
const missingAdminLabel = "Belum ditentukan";

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
}

function resolveBranchText(value: string) {
  return value.trim() || missingFieldLabel;
}

function resolveBranchAdminText(value: string) {
  return value.trim() || missingAdminLabel;
}

function resolveBranchMetric(value: number) {
  return formatNumber(Number.isFinite(value) && value >= 0 ? value : 0);
}

export function OwnerDashboardBranchesSection({
  manager,
}: OwnerDashboardBranchesSectionProps) {
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const branchProfiles = useMemo(() => manager.branches, [manager.branches]);
  const branchAdminOptions = useMemo(() => {
    const options = [...manager.branchAdminOptions];
    const currentAdminName = manager.form.adminName.trim();

    if (
      currentAdminName &&
      !options.some(
        (option) =>
          option.name.toLowerCase() === currentAdminName.toLowerCase(),
      )
    ) {
      options.push({
        id: `current-admin:${currentAdminName.toLowerCase()}`,
        name: currentAdminName,
        email: "",
      });
    }



    return options;
  }, [manager.branchAdminOptions, manager.form.adminName]);
  const selectedBranchAdminId =
    branchAdminOptions.find(
      (option) =>
        option.name.toLowerCase() ===
        manager.form.adminName.trim().toLowerCase(),
    )?.id ?? "__none__";

  async function handleImportChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setIsImporting(true);

    try {
      await manager.importBranches(file);
    } finally {
      setIsImporting(false);
      event.target.value = "";
    }
  }

  function handleDeleteBranch(branch: OwnerDashboardBranch) {
    const confirmed = window.confirm(
      `Hapus cabang ${branch.name}? Data ini akan dikeluarkan dari tabel cabang owner.`,
    );

    if (!confirmed) {
      return;
    }

    manager.removeBranch(branch.id);
  }

  const hasActiveFilters =
    manager.branchSearchQuery.trim().length > 0 ||
    manager.branchStatusFilter !== "Semua";
  const emptyStateTitle = manager.isLoading
    ? "Memuat data cabang..."
    : manager.branchStatusFilter === "Terhapus" && !hasActiveFilters
      ? "Belum ada cabang terhapus"
      : hasActiveFilters
        ? "Belum ada cabang yang cocok dengan filter"
        : "Belum ada data cabang";
  const emptyStateDescription = manager.isLoading
    ? "Data cabang sedang dimuat. Tabel akan terisi otomatis."
    : manager.branchStatusFilter === "Terhapus" && !hasActiveFilters
      ? "Data cabang yang dihapus akan muncul di sini."
      : hasActiveFilters
        ? "Coba ubah kata kunci pencarian, reset filter, atau tambahkan cabang baru agar data kembali tampil."
        : "Anda belum memiliki data cabang sama sekali. Silakan tambah cabang baru melalui tombol di atas untuk memulai manajemen bimbingan.";

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
              Manajemen Cabang
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              Kelola daftar cabang, ubah status operasional, dan lakukan import
              atau export data cabang langsung dari dashboard owner.
            </p>
          </div>

          <Badge
            variant="info"
            className="w-fit rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.18em]"
          >
            {manager.filteredBranchCount} dari {manager.totalBranches} cabang
            tampil
          </Badge>
        </div>

        <section className="space-y-5 rounded-[30px] border border-orange-100/70 bg-white/92 px-6 py-6 shadow-[0_18px_42px_-28px_rgba(15,23,42,0.18),0_12px_26px_-22px_rgba(249,115,22,0.18)] backdrop-blur-sm">
          <div className="space-y-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-2xl">
                <h3 className="text-xl font-semibold tracking-tight text-slate-950">
                  Daftar cabang owner
                </h3>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                  Tabel ini menampilkan status operasional setiap cabang dan
                  memberi akses cepat untuk tambah, edit, ubah status, hapus,
                  import, dan export data.
                </p>
                <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-400">
                  Guru tersedia dihitung dari guru aktif yang dapat mengajar di
                  cabang. Total siswa dihitung dari siswa yang terdaftar pada
                  cabang tersebut.
                </p>
              </div>

              <div className="flex w-full flex-nowrap items-center gap-2 overflow-x-auto pb-1 xl:w-auto xl:shrink-0 xl:justify-end xl:self-end xl:overflow-visible xl:pb-0">
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".csv,.json,text/csv,application/json"
                  className="hidden"
                  onChange={handleImportChange}
                />

                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 rounded-full"
                  onClick={() => importInputRef.current?.click()}
                  disabled={isImporting}
                >
                  <Upload className="size-4" />
                  {isImporting ? "Memproses import..." : "Import"}
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0 rounded-full"
                    >
                      <Download className="size-4" />
                      Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                      onSelect={() => manager.exportBranches("csv")}
                    >
                      Export CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => manager.exportBranches("json")}
                    >
                      Export JSON
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0 rounded-full"
                  onClick={manager.openCreateDialog}
                >
                  <Plus className="size-4" />
                  Tambah cabang
                </Button>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={manager.branchSearchQuery}
                  onChange={(event) =>
                    manager.setBranchSearchQuery(event.target.value)
                  }
                  placeholder="Cari nama cabang atau status..."
                  className="pl-10"
                />
              </div>

              <Select
                value={manager.branchStatusFilter}
                onValueChange={(value) =>
                  manager.setBranchStatusFilter(
                    value as typeof manager.branchStatusFilter,
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  {manager.branchFilterOptions.map((option) => (
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

            <p className="text-xs leading-5 text-slate-400">
              Import menerima file CSV atau JSON dengan kolom{" "}
              <span className="font-semibold text-slate-500">nama cabang</span>{" "}
              dan <span className="font-semibold text-slate-500">status</span>.
            </p>

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
                  <span className="sr-only">Tutup notifikasi cabang</span>
                </button>
              </div>
            ) : null}
          </div>

          <div className="-mx-6 overflow-x-auto overflow-y-hidden border-t border-slate-200/80">
            <Table className="min-w-[980px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 px-6">No</TableHead>
                  <TableHead>Nama Cabang</TableHead>
                  <TableHead>Alamat</TableHead>
                  <TableHead>Admin Cabang</TableHead>
                  <TableHead className="w-28 text-center">Siswa</TableHead>
                  <TableHead className="w-32 text-center">
                    Guru Tersedia
                  </TableHead>
                  <TableHead className="w-44">Status</TableHead>
                  <TableHead className="w-40">Update Terakhir</TableHead>
                  <TableHead className="w-32 px-6 text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branchProfiles.length > 0 ? (
                  branchProfiles.map((branch, index) => {
                    const meta = manager.statusMeta[branch.status];

                    return (
                      <TableRow key={branch.id}>
                        <TableCell className="px-6 text-sm font-semibold text-slate-500">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <p className="font-semibold text-slate-900">
                            {branch.name}
                          </p>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
                            <MapPin className="size-3.5 shrink-0 text-orange-500" />
                            {resolveBranchText(branch.shortAddress)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
                            <UserCog className="size-3.5 shrink-0 text-orange-500" />
                            {resolveBranchAdminText(branch.adminName)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-sm font-semibold text-slate-900">
                            {resolveBranchMetric(branch.studentCount)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                            <GraduationCap className="size-4 text-orange-500" />
                            {resolveBranchMetric(branch.teacherCount)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={meta.badgeVariant}
                            className="rounded-full px-3 py-1.5"
                          >
                            <span
                              className={cn(
                                "size-2 rounded-full",
                                meta.dotClassName,
                              )}
                            />
                            {meta.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-slate-500">
                            {formatUpdatedAt(branch.updatedAt)}
                          </p>
                        </TableCell>
                        <TableCell className="px-6">
                          <div className="flex items-center justify-center gap-2">
                            {manager.branchStatusFilter === "Terhapus" ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="size-10 rounded-full text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                                    onClick={() => manager.restoreBranch(branch.id)}
                                  >
                                    <RotateCcw className="size-4" />
                                    <span className="sr-only">Pulihkan cabang</span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Pulihkan cabang</TooltipContent>
                              </Tooltip>
                            ) : (
                              <>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      className="size-10 rounded-full"
                                      onClick={() =>
                                        manager.openEditDialog(branch.id)
                                      }
                                    >
                                      <PencilLine className="size-4" />
                                      <span className="sr-only">Edit cabang</span>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Edit cabang</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      className="size-10 rounded-full text-red-500 hover:bg-red-50 hover:text-red-600"
                                      onClick={() => handleDeleteBranch(branch)}
                                    >
                                      <Trash2 className="size-4" />
                                      <span className="sr-only">Hapus cabang</span>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Hapus cabang</TooltipContent>
                                </Tooltip>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : manager.isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell className="px-6 py-4"><Skeleton className="h-4 w-6" /></TableCell>
                      <TableCell className="px-4 py-4"><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell className="px-4 py-4"><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell className="px-4 py-4"><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell className="px-4 py-4"><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                      <TableCell className="px-4 py-4"><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell className="px-4 py-4"><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell className="px-4 py-4"><Skeleton className="h-4 w-24" /></TableCell>
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
                    <TableCell colSpan={9} className="px-6 py-14">
                      <div className="flex flex-col items-center gap-3 text-center">
                        <div className="flex size-14 items-center justify-center rounded-full bg-orange-50 text-orange-600">
                          <Building2 className="size-6" />
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
                            onClick={manager.openCreateDialog}
                          >
                            <Plus className="size-4" />
                            Tambah cabang baru
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
          open={manager.dialog.isOpen}
          onOpenChange={(open) => {
            if (!open) {
              manager.closeDialog();
            }
          }}
        >
          <DialogContent className="max-w-xl">
            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                manager.submitForm();
              }}
            >
              <DialogHeader>
                <DialogTitle>{manager.dialog.title}</DialogTitle>
                <DialogDescription>
                  {manager.dialog.description}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium text-slate-700"
                    htmlFor="owner-branch-name"
                  >
                    Nama cabang
                  </label>
                  <Input
                    id="owner-branch-name"
                    value={manager.form.name}
                    onChange={(event) =>
                      manager.updateFormValue("name", event.target.value)
                    }
                    placeholder="Contoh: Slawi Timur"
                  />
                </div>

                <div className="space-y-2">
                  <label
                    className="text-sm font-medium text-slate-700"
                    htmlFor="owner-branch-short-address"
                  >
                    Alamat
                  </label>
                  <Input
                    id="owner-branch-short-address"
                    value={manager.form.shortAddress}
                    onChange={(event) =>
                      manager.updateFormValue(
                        "shortAddress",
                        event.target.value,
                      )
                    }
                    placeholder="Contoh: Jl. Ahmad Yani, Slawi"
                  />
                </div>

                <div className="space-y-2">
                  <label
                    className="text-sm font-medium text-slate-700"
                    htmlFor="owner-branch-admin"
                  >
                    Admin cabang
                  </label>
                  <Select
                    value={selectedBranchAdminId}
                    onValueChange={(value) => {
                      if (value === "__none__") {
                        manager.updateFormValue("adminName", "");
                        return;
                      }

                      const selectedAdmin = branchAdminOptions.find(
                        (option) => option.id === value,
                      );

                      manager.updateFormValue(
                        "adminName",
                        selectedAdmin?.name ?? "",
                      );
                    }}
                  >
                    <SelectTrigger id="owner-branch-admin">
                      <SelectValue placeholder="Belum ditentukan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Belum ditentukan</SelectItem>
                      {branchAdminOptions.map((admin) => (
                        <SelectItem key={admin.id} value={admin.id}>
                          {admin.email
                            ? `${admin.name} (${admin.email})`
                            : admin.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs leading-5 text-slate-400">
                    Pilih admin cabang dari daftar akun staf yang memiliki
                    role admin. Pengelolaan akun admin dilakukan dari menu Admin
                    Cabang.
                  </p>
                  {manager.branchAdminOptions.length === 0 ? (
                    <p className="rounded-2xl border border-orange-100/80 bg-orange-50/45 px-4 py-3 text-xs leading-5 text-slate-500">
                      Belum ada akun staf/admin yang tersedia untuk dipilih.
                      Tambahkan akun dulu dari menu Admin Cabang.
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <label
                    className="text-sm font-medium text-slate-700"
                    htmlFor="owner-branch-status"
                  >
                    Status
                  </label>
                  <Select
                    value={manager.form.status}
                    onValueChange={(value) =>
                      manager.updateFormValue("status", value)
                    }
                  >
                    <SelectTrigger id="owner-branch-status">
                      <SelectValue placeholder="Pilih status cabang" />
                    </SelectTrigger>
                    <SelectContent>
                      {manager.branchStatusOptions.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs leading-5 text-slate-400">
                    Kolom guru tersedia dan total siswa pada tabel dihitung
                    otomatis berdasarkan sistem, bukan diisi manual saat
                    membuat cabang.
                  </p>
                </div>

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
                  onClick={manager.closeDialog}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="secondary"
                  className="rounded-full"
                >
                  {manager.dialog.submitLabel}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
