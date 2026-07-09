"use client";

import {
  Eye,
  FilterX,
  ReceiptText,
  Search,
} from "lucide-react";
import { useState } from "react";

import type { OwnerExpensesManager } from "@/components/dashboard-owner/hooks/useOwnerExpenses";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { isOwnerExpenseLegacyCategory } from "@/lib/owner-expenses";
import { cn } from "@/lib/utils";

type OwnerDashboardExpensesSectionProps = {
  manager: OwnerExpensesManager;
};

const flashToneClasses = {
  success: "border-emerald-200/80 bg-emerald-50/85 text-emerald-700",
  warning: "border-amber-200/80 bg-amber-50/85 text-amber-700",
  danger: "border-red-200/80 bg-red-50/85 text-red-700",
  info: "border-sky-200/80 bg-sky-50/85 text-sky-700",
} as const;

const expenseStatusMeta = {
  Menunggu: {
    badgeVariant: "warning" as const,
    label: "Menunggu",
  },
  Dijadwalkan: {
    badgeVariant: "secondary" as const,
    label: "Dijadwalkan",
  },
  Selesai: {
    badgeVariant: "success" as const,
    label: "Selesai",
  },
  Dibatalkan: {
    badgeVariant: "danger" as const,
    label: "Dibatalkan",
  },
} as const;

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function OwnerDashboardExpensesSection({
  manager,
}: OwnerDashboardExpensesSectionProps) {
  const [selectedExpense, setSelectedExpense] = useState<
    OwnerExpensesManager["expenses"][number] | null
  >(null);

  const hasActiveFilters =
    manager.searchQuery.trim().length > 0 ||
    manager.branchFilter !== "Semua Cabang" ||
    manager.categoryFilter !== "Semua" ||
    manager.statusFilter !== "Semua";

  const emptyStateTitle = manager.isLoading
    ? "Memuat data pengeluaran..."
    : hasActiveFilters
      ? "Belum ada pengeluaran yang cocok"
      : "Belum ada data pengeluaran";
  const emptyStateDescription = manager.isLoading
    ? "Daftar pengeluaran dari sistem sedang diambil."
    : hasActiveFilters
      ? "Coba ubah kata kunci pencarian atau reset filter agar data kembali tampil."
      : "Belum ada pengeluaran operasional yang tercatat untuk dipantau owner.";

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-slate-200/80 bg-white px-6 py-6 shadow-[0_16px_32px_-26px_rgba(15,23,42,0.12)]">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
              Pengeluaran
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              Pantau pengeluaran operasional cabang yang otomatis ikut terbaca
              pada monitoring owner, ringkasan pembayaran, dan laporan saldo
              bersih.
            </p>
          </div>
          <Badge
            variant="secondary"
            className="w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-slate-600"
          >
            Operasional Cabang
          </Badge>
        </div>
      </section>

      <section className="space-y-5 rounded-[30px] border border-slate-200/80 bg-white px-6 py-6 shadow-[0_16px_32px_-26px_rgba(15,23,42,0.14)]">
        <div className="space-y-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-2xl">
              <h3 className="text-xl font-semibold tracking-tight text-slate-950">
                Daftar pengeluaran operasional cabang
              </h3>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                Owner dapat memonitor pengeluaran lintas cabang. Data lama dengan
                kategori legacy tetap terlihat sebagai catatan monitoring tanpa
                aksi edit atau hapus.
              </p>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px_220px_220px_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={manager.searchQuery}
                onChange={(event) => manager.setSearchQuery(event.target.value)}
                placeholder="Cari judul, cabang, vendor, kategori, metode, atau no referensi..."
                className="pl-10"
              />
            </div>

            <Select
              value={manager.branchFilter}
              onValueChange={(value) =>
                manager.setBranchFilter(value as typeof manager.branchFilter)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter cabang" />
              </SelectTrigger>
              <SelectContent>
                {manager.branchFilterOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={manager.categoryFilter}
              onValueChange={(value) =>
                manager.setCategoryFilter(value as typeof manager.categoryFilter)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter kategori" />
              </SelectTrigger>
              <SelectContent>
                {manager.categoryFilterOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={manager.statusFilter}
              onValueChange={(value) =>
                manager.setStatusFilter(value as typeof manager.statusFilter)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                {manager.statusFilterOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex justify-start xl:justify-end">
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
                "flex flex-col gap-3 rounded-[24px] border px-4 py-3 text-sm leading-6 sm:flex-row sm:items-start sm:justify-between",
                flashToneClasses[manager.flash.tone],
              )}
            >
              <p>{manager.flash.message}</p>
              <Button
                type="button"
                variant="ghost"
                className="h-9 rounded-full px-3 text-current hover:bg-black/5 hover:text-current"
                onClick={manager.dismissFlash}
              >
                Tutup
              </Button>
            </div>
          ) : null}
        </div>

        <div className="overflow-x-auto overflow-y-hidden rounded-[24px] border border-slate-200/80 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.1)]">
          <Table className="min-w-[1160px]">
            <TableHeader className="bg-slate-50/80">
              <TableRow className="border-slate-200/70">
                <TableHead className="w-16 px-6 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  No
                </TableHead>
                <TableHead className="w-32 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  No. Referensi
                </TableHead>
                <TableHead className="w-60 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  Judul / Cabang
                </TableHead>
                <TableHead className="w-56 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  Kategori / Vendor
                </TableHead>
                <TableHead className="w-40 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  Nominal
                </TableHead>
                <TableHead className="w-44 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  Status
                </TableHead>
                <TableHead className="w-40 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  Tanggal
                </TableHead>
                <TableHead className="w-32 px-6 text-center text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  Aksi
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {manager.expenses.length > 0 ? (
                manager.expenses.map((expense, index) => (
                  <TableRow
                    key={expense.id}
                    className="border-slate-200/70 transition-colors hover:bg-slate-50"
                  >
                    <TableCell className="px-6 text-sm font-semibold text-slate-500">
                      {index + 1}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-slate-700">
                      {expense.expenseId}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-900">{expense.title}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span>{expense.branch}</span>
                          <span>-</span>
                          <span>{expense.paymentMethod || "Metode belum diisi"}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">
                            {expense.category}
                          </p>
                          {isOwnerExpenseLegacyCategory(expense.category) ? (
                            <Badge variant="outline" className="px-2 py-0.5 text-[10px]">
                              Legacy
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-xs text-slate-500">
                          {expense.vendorOrRecipient}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-semibold text-slate-900">
                      {formatCurrency(expense.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={expenseStatusMeta[expense.status].badgeVariant}
                        className="rounded-full px-3 py-1.5"
                      >
                        {expenseStatusMeta[expense.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {formatDate(expense.paidAt ?? expense.dueDate ?? expense.updatedAt)}
                    </TableCell>
                    <TableCell className="px-6">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-10 rounded-full"
                          title="Lihat detail pengeluaran"
                          onClick={() => setSelectedExpense(expense)}
                        >
                          <Eye className="size-4" />
                          <span className="sr-only">Detail pengeluaran</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : manager.isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell className="px-6 py-4"><Skeleton className="h-4 w-6" /></TableCell>
                    <TableCell className="px-4 py-4">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-40" />
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-4"><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell className="px-4 py-4"><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                    <TableCell className="px-4 py-4"><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="px-4 py-4"><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell className="px-4 py-4"><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="px-4 py-4">
                      <Skeleton className="size-9 rounded-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="px-6 py-14">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className="flex size-14 items-center justify-center rounded-full bg-sky-50 text-sky-600">
                        <ReceiptText className="size-6" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-base font-semibold text-slate-900">
                          {emptyStateTitle}
                        </p>
                        <p className="max-w-md text-sm leading-6 text-slate-500">
                          {emptyStateDescription}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <Dialog
        open={Boolean(selectedExpense)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedExpense(null);
          }
        }}
      >
        <DialogContent className="w-[calc(100%-1rem)] max-w-2xl sm:w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle>Detail Pengeluaran</DialogTitle>
            <DialogDescription>
              Owner hanya memantau detail pengeluaran operasional cabang.
            </DialogDescription>
          </DialogHeader>

          {selectedExpense ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailItem label="No. Referensi" value={selectedExpense.expenseId} />
              <DetailItem label="Cabang" value={selectedExpense.branch} />
              <DetailItem label="Judul" value={selectedExpense.title} />
              <DetailItem
                label="Vendor / penerima"
                value={selectedExpense.vendorOrRecipient}
              />
              <DetailItem label="Kategori" value={selectedExpense.category} />
              <DetailItem
                label="Metode pembayaran"
                value={selectedExpense.paymentMethod || "-"}
              />
              <DetailItem
                label="Nominal"
                value={formatCurrency(selectedExpense.amount)}
              />
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Status
                </p>
                <Badge
                  variant={expenseStatusMeta[selectedExpense.status].badgeVariant}
                  className="mt-2 rounded-full px-3 py-1.5"
                >
                  {expenseStatusMeta[selectedExpense.status].label}
                </Badge>
              </div>
              <DetailItem
                label="Tanggal dibayar"
                value={formatDate(selectedExpense.paidAt)}
              />
              <DetailItem
                label="Jatuh tempo"
                value={formatDate(selectedExpense.dueDate)}
              />
              <DetailItem
                label="Terakhir diperbarui"
                value={formatDate(selectedExpense.updatedAt)}
              />
              <DetailItem
                label="Catatan"
                value={selectedExpense.note || "-"}
                className="sm:col-span-2"
              />
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => setSelectedExpense(null)}
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailItem({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3",
        className,
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium leading-6 text-slate-800">{value}</p>
    </div>
  );
}
