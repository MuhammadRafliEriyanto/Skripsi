"use client";

import { useState, useEffect } from "react";
import { Download, Eye, FilterX, Search, ShieldCheck, ChevronLeft, ChevronRight } from "lucide-react";

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
  MembershipActivationFilter,
  OwnerStudentActivationRecord,
  StudentClassFilter,
  StudentLevelFilter,
} from "./owner-activity-types";
import {
  activationFilterOptions,
  activationStatusMeta,
  formatDate,
  levelFilterOptions,
  paymentStatusMeta,
} from "./owner-activity-utils";

type OwnerStudentActivationsTableProps = {
  activationBranchFilter: BranchFilter;
  activationBranchOptions: BranchFilter[];
  activationStatusFilter: MembershipActivationFilter;
  classFilter: StudentClassFilter;
  classFilterOptions: readonly string[];
  emptyDescription: string;
  hasActiveFilters: boolean;
  levelFilter: StudentLevelFilter;
  panelNote: string;
  searchQuery: string;
  students: OwnerStudentActivationRecord[];
  isLoading: boolean;
  onActivationBranchFilterChange: (value: BranchFilter) => void;
  onActivationStatusFilterChange: (value: MembershipActivationFilter) => void;
  onClassFilterChange: (value: StudentClassFilter) => void;
  onExport: (format: "csv" | "json") => void;
  onLevelFilterChange: (value: string) => void;
  onOpenDetail: (studentId: string) => void;
  onResetFilters: () => void;
  onSearchQueryChange: (value: string) => void;
};

export function OwnerStudentActivationsTable({
  activationBranchFilter,
  activationBranchOptions,
  activationStatusFilter,
  classFilter,
  classFilterOptions,
  emptyDescription,
  hasActiveFilters,
  levelFilter,
  panelNote,
  searchQuery,
  students,
  isLoading,
  onActivationBranchFilterChange,
  onActivationStatusFilterChange,
  onClassFilterChange,
  onExport,
  onLevelFilterChange,
  onOpenDetail,
  onResetFilters,
  onSearchQueryChange,
}: OwnerStudentActivationsTableProps) {
  const ITEMS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    queueMicrotask(() => {
      setCurrentPage(1);
    });
  }, [
    activationBranchFilter,
    activationStatusFilter,
    classFilter,
    levelFilter,
    searchQuery,
  ]);

  const totalPages = Math.ceil(students.length / ITEMS_PER_PAGE);
  const paginatedStudents = students.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );
  return (
    <OwnerActivitySectionPanel
      tone="emerald"
      badgeLabel="Aktivasi siswa"
      title="Ringkasan aktivasi siswa"
      description="Pantau status membership siswa yang aktif, menunggu, atau expired."
      actions={
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative xl:max-w-2xl xl:flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="Cari nama siswa, cabang, paket, jenjang, atau kelas..."
              className="h-12 rounded-2xl border-white/70 bg-white/88 pl-11 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="rounded-full border-white/70 bg-white/88"
                disabled={students.length === 0}
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
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[220px_220px_180px_180px_auto]">
          <Select
            value={activationBranchFilter}
            onValueChange={(value) =>
              onActivationBranchFilterChange(value as BranchFilter)
            }
          >
            <SelectTrigger className="h-12 rounded-2xl border-white/70 bg-white/88 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
              <SelectValue placeholder="Filter cabang" />
            </SelectTrigger>
            <SelectContent>
              {activationBranchOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={activationStatusFilter}
            onValueChange={(value) =>
              onActivationStatusFilterChange(value as MembershipActivationFilter)
            }
          >
            <SelectTrigger className="h-12 rounded-2xl border-white/70 bg-white/88 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
              <SelectValue placeholder="Filter status aktivasi" />
            </SelectTrigger>
            <SelectContent>
              {activationFilterOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={levelFilter} onValueChange={onLevelFilterChange}>
            <SelectTrigger className="h-12 rounded-2xl border-white/70 bg-white/88 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
              <SelectValue placeholder="Filter jenjang" />
            </SelectTrigger>
            <SelectContent>
              {levelFilterOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={classFilter}
            onValueChange={(value) => onClassFilterChange(value as StudentClassFilter)}
          >
            <SelectTrigger className="h-12 rounded-2xl border-white/70 bg-white/88 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
              <SelectValue placeholder="Filter kelas" />
            </SelectTrigger>
            <SelectContent className="max-h-[240px]">
              <SelectItem value="Semua">Semua</SelectItem>
              {classFilterOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  Kelas {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex justify-start xl:justify-end">
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
      <Table className="min-w-[1260px]">
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
            <TableHead className="w-32 text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Jenjang/Kelas
            </TableHead>
            <TableHead className="w-56 text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Paket Membership
            </TableHead>
            <TableHead className="w-40 text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Status Pembayaran
            </TableHead>
            <TableHead className="w-48 text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Status Aktivasi
            </TableHead>
            <TableHead className="w-40 text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Tanggal Daftar
            </TableHead>
            <TableHead className="w-32 px-6 text-center text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Aksi
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedStudents.length > 0 ? (
            paginatedStudents.map((student, index) => (
              <TableRow
                key={student.id}
                className="border-slate-200/70 transition-colors hover:bg-slate-50"
              >
                <TableCell className="px-6 text-sm font-semibold text-slate-500">
                  {(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-900">{student.studentName}</p>

                  </div>
                </TableCell>
                <TableCell className="text-sm font-medium text-slate-700">
                  {student.branch}
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {student.jenjang}
                    </p>
                    <p className="text-xs text-slate-500">{student.classLabel}</p>
                  </div>
                </TableCell>
                <TableCell className="text-sm leading-6 text-slate-700">
                  {student.membershipPackage}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={paymentStatusMeta[student.paymentStatus].badgeVariant}
                    className="rounded-full px-3 py-1.5"
                  >
                    {paymentStatusMeta[student.paymentStatus].label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={activationStatusMeta[student.activationStatus].badgeVariant}
                    className="rounded-full px-3 py-1.5"
                  >
                    {activationStatusMeta[student.activationStatus].label}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-slate-600">
                  {formatDate(student.registeredAt)}
                </TableCell>
                <TableCell className="px-6">
                  <div className="flex items-center justify-center">
                    <Button
                      type="button"
                      variant="subtle"
                      size="icon"
                      className="size-10 rounded-full"
                      title="Lihat detail aktivasi siswa"
                      onClick={() => onOpenDetail(student.id)}
                    >
                      <Eye className="size-4" />
                      <span className="sr-only">Lihat detail aktivasi siswa</span>
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
                    <TableCell className="px-4 py-4"><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell className="px-4 py-4"><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="px-4 py-4"><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                    <TableCell className="px-4 py-4"><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
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
                  <div className="flex size-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
                    <ShieldCheck className="size-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-slate-900">
                      Data aktivasi siswa tidak ditemukan
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
        <div className="flex items-center justify-between border-t border-slate-200/70 bg-slate-50/50 px-6 py-4">
          <div className="text-sm text-slate-500">
            Menampilkan <span className="font-medium text-slate-900">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> hingga{" "}
            <span className="font-medium text-slate-900">{Math.min(currentPage * ITEMS_PER_PAGE, students.length)}</span> dari{" "}
            <span className="font-medium text-slate-900">{students.length}</span> data
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-8 rounded-lg"
            >
              <ChevronLeft className="mr-1 size-4" />
              Previous
            </Button>
            <div className="px-2 text-sm font-medium text-slate-700">
              Halaman {currentPage} dari {totalPages}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="h-8 rounded-lg"
            >
              Next
              <ChevronRight className="ml-1 size-4" />
            </Button>
          </div>
        </div>
      )}
    </OwnerActivitySectionPanel>
  );
}
