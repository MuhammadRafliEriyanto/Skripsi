"use client";

import { CreditCard, Download, Eye, FilterX, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Skeleton } from "@/components/ui/skeleton";

import { OwnerActivitySectionPanel } from "./OwnerActivitySummaryCards";
import type {
  BranchFilter,
  IncomingPaymentPeriodFilter,
  IncomingPaymentStatusFilter,
  OwnerIncomingPaymentRecord,
} from "./owner-activity-types";
import {
  formatCurrency,
  formatDate,
  formatPaymentMethodLabel,
  getIncomingStatusFilterLabel,
  incomingPeriodOptions,
  incomingStatusMeta,
  incomingStatusOptions,
} from "./owner-activity-utils";

type OwnerIncomingPaymentsTableProps = {
  branchFilter: BranchFilter;
  branchOptions: BranchFilter[];
  emptyDescription: string;
  hasActiveFilters: boolean;
  isLoading: boolean;
  panelNote: string;
  payments: OwnerIncomingPaymentRecord[];
  searchQuery: string;
  statusFilter: IncomingPaymentStatusFilter;
  periodFilter: IncomingPaymentPeriodFilter;
  onBranchFilterChange: (value: BranchFilter) => void;
  onExport: (format: "csv" | "json") => void;
  onOpenDetail: (paymentId: string) => void;
  onPeriodFilterChange: (value: IncomingPaymentPeriodFilter) => void;
  onResetFilters: () => void;
  onSearchQueryChange: (value: string) => void;
  onStatusFilterChange: (value: IncomingPaymentStatusFilter) => void;
};

import { useState, useEffect } from "react";

export function OwnerIncomingPaymentsTable({
  branchFilter,
  branchOptions,
  emptyDescription,
  hasActiveFilters,
  isLoading,
  panelNote,
  payments,
  searchQuery,
  statusFilter,
  periodFilter,
  onBranchFilterChange,
  onExport,
  onOpenDetail,
  onPeriodFilterChange,
  onResetFilters,
  onSearchQueryChange,
  onStatusFilterChange,
}: OwnerIncomingPaymentsTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [payments.length]);

  const totalPages = Math.ceil(payments.length / itemsPerPage);
  const paginatedPayments = payments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <OwnerActivitySectionPanel
      tone="orange"
      badgeLabel="Pembayaran masuk"
      title="Ringkasan pembayaran masuk"
      description="Pantau transaksi siswa, nominal, dan status verifikasi."
      actions={
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative xl:max-w-2xl xl:flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="Cari nama siswa, cabang, paket, metode, atau no referensi..."
              className="h-12 rounded-2xl border-white/70 bg-white/88 pl-11 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="rounded-full border-white/70 bg-white/88"
                disabled={payments.length === 0 || isLoading}
              >
                <Download className="size-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={() => onExport("csv")}>
                Export CSV
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onExport("json")}>
                Export JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
      filters={
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[220px_220px_220px_auto]">
          <Select
            value={branchFilter}
            onValueChange={(value) => onBranchFilterChange(value as BranchFilter)}
          >
            <SelectTrigger className="h-12 rounded-2xl border-white/70 bg-white/88 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
              <SelectValue placeholder="Filter cabang" />
            </SelectTrigger>
            <SelectContent>
              {branchOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(value) =>
              onStatusFilterChange(value as IncomingPaymentStatusFilter)
            }
          >
            <SelectTrigger className="h-12 rounded-2xl border-white/70 bg-white/88 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              {incomingStatusOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {getIncomingStatusFilterLabel(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={periodFilter}
            onValueChange={(value) =>
              onPeriodFilterChange(value as IncomingPaymentPeriodFilter)
            }
          >
            <SelectTrigger className="h-12 rounded-2xl border-white/70 bg-white/88 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
              <SelectValue placeholder="Filter periode" />
            </SelectTrigger>
            <SelectContent>
              {incomingPeriodOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex justify-start md:justify-end">
            <Button
              type="button"
              variant="ghost"
              className="rounded-full"
              onClick={onResetFilters}
              disabled={!hasActiveFilters}
            >
              <FilterX className="size-4" />
              Reset filter
            </Button>
          </div>
        </div>
      }
      note={panelNote}
    >
      <Table className="min-w-[1180px]">
        <TableHeader className="bg-slate-50/80">
          <TableRow className="border-slate-200/70">
            <TableHead className="w-16 px-6 text-[11px] uppercase tracking-[0.18em] text-slate-500">
              No
            </TableHead>
            <TableHead className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Nama Siswa
            </TableHead>
            <TableHead className="w-40 text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Cabang
            </TableHead>
            <TableHead className="w-56 text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Paket
            </TableHead>
            <TableHead className="w-40 text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Metode
            </TableHead>
            <TableHead className="w-40 text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Nominal
            </TableHead>
            <TableHead className="w-40 text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Tanggal Bayar
            </TableHead>
            <TableHead className="w-44 text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Status
            </TableHead>
            <TableHead className="w-32 px-6 text-center text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Aksi
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedPayments.length > 0 ? (
            paginatedPayments.map((payment, index) => (
              <TableRow
                key={payment.id}
                className="border-slate-200/70 transition-colors hover:bg-slate-50"
              >
                <TableCell className="px-6 text-sm font-semibold text-slate-500">
                  {(currentPage - 1) * itemsPerPage + index + 1}
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-900">{payment.studentName}</p>
                    <p className="text-xs text-slate-400">
                      {payment.paymentId
                        ? `No. Ref: ${payment.paymentId}`
                        : "No. Ref belum tersedia"}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="text-sm font-medium text-slate-700">
                  {payment.branch}
                </TableCell>
                <TableCell className="text-sm leading-6 text-slate-700">
                  {payment.packageName}
                </TableCell>
                <TableCell className="text-sm text-slate-600">
                  {formatPaymentMethodLabel(payment.method)}
                </TableCell>
                <TableCell className="text-sm font-semibold text-slate-900">
                  {formatCurrency(payment.amount)}
                </TableCell>
                <TableCell className="text-sm text-slate-600">
                  {formatDate(payment.paidAt)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={incomingStatusMeta[payment.status].badgeVariant}
                    className="rounded-full px-3 py-1.5"
                  >
                    {incomingStatusMeta[payment.status].label}
                  </Badge>
                </TableCell>
                <TableCell className="px-6">
                  <div className="flex items-center justify-center">
                    <Button
                      type="button"
                      variant="subtle"
                      size="icon"
                      className="size-10 rounded-full"
                      title="Lihat detail pembayaran masuk"
                      onClick={() => onOpenDetail(payment.id)}
                    >
                      <Eye className="size-4" />
                      <span className="sr-only">Lihat detail pembayaran masuk</span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
                ))
              ) : isLoading ? (
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
                    <TableCell className="px-4 py-4"><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="px-4 py-4"><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="px-4 py-4"><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell className="px-4 py-4"><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell className="px-4 py-4"><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="px-4 py-4">
                      <Skeleton className="size-9 rounded-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
            <TableRow>
              <TableCell colSpan={9} className="px-6 py-14">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="flex size-16 items-center justify-center rounded-full bg-orange-50 text-orange-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
                    <CreditCard className="size-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-slate-900">
                      Data pembayaran masuk tidak ditemukan
                    </p>
                    <p className="max-w-md text-sm leading-6 text-slate-500">
                      {emptyDescription}
                    </p>
                  </div>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-100 bg-white px-6 py-4">
          <p className="text-sm text-slate-500">
            Menampilkan <span className="font-semibold text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> hingga <span className="font-semibold text-slate-900">{Math.min(currentPage * itemsPerPage, payments.length)}</span> dari <span className="font-semibold text-slate-900">{payments.length}</span> data
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded-xl border-slate-200"
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="rounded-xl border-slate-200"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </OwnerActivitySectionPanel>
  );
}
