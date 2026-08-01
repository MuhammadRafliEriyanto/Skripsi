"use client";

import type { LucideIcon } from "lucide-react";
import {
  Building2,
  CalendarClock,
  CreditCard,
  GraduationCap,
  ShieldCheck,
  WalletCards,
} from "lucide-react";

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
import { cn } from "@/lib/utils";

import type {
  OwnerIncomingPaymentRecord,
  OwnerOutgoingPaymentRecord,
  OwnerStudentActivationRecord,
  SurfaceTone,
} from "./owner-activity-types";
import {
  activationStatusMeta,
  formatCurrency,
  formatLongDate,
  formatPaymentMethodLabel,
  incomingStatusMeta,
  outgoingStatusMeta,
  paymentStatusMeta,
  surfaceToneStyles,
} from "./owner-activity-utils";

type OwnerActivityDetailDialogProps = {
  selectedIncomingPayment: OwnerIncomingPaymentRecord | null;
  selectedOutgoingPayment: OwnerOutgoingPaymentRecord | null;
  selectedStudent: OwnerStudentActivationRecord | null;
  onCloseIncomingPayment: () => void;
  onCloseOutgoingPayment: () => void;
  onCloseStudent: () => void;
};

type DetailItemProps = {
  icon: LucideIcon;
  label: string;
  tone?: SurfaceTone;
  value: string;
};

function DetailItem({
  tone = "orange",
  label,
  value,
  icon: Icon,
}: DetailItemProps) {
  const styles = surfaceToneStyles[tone];

  return (
    <div className={cn("rounded-2xl border px-4 py-4", styles.metric)}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        <Icon className={cn("size-4", styles.icon)} />
        {label}
      </div>
      <p className="mt-2 text-sm font-medium leading-6 text-slate-800">{value}</p>
    </div>
  );
}

export function OwnerActivityDetailDialog({
  selectedIncomingPayment,
  selectedOutgoingPayment,
  selectedStudent,
  onCloseIncomingPayment,
  onCloseOutgoingPayment,
  onCloseStudent,
}: OwnerActivityDetailDialogProps) {
  return (
    <>
      <Dialog
        open={selectedIncomingPayment !== null}
        onOpenChange={(open) => {
          if (!open) {
            onCloseIncomingPayment();
          }
        }}
      >
        <DialogContent className="max-w-3xl overflow-hidden border-slate-200/80 bg-white shadow-[0_24px_48px_-30px_rgba(15,23,42,0.22)]">
          {selectedIncomingPayment ? (
            <>
              <DialogHeader className="pr-10">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={incomingStatusMeta[selectedIncomingPayment.status].badgeVariant}
                    className="rounded-full px-3 py-1.5"
                  >
                    {incomingStatusMeta[selectedIncomingPayment.status].label}
                  </Badge>
                </div>
                <DialogTitle className="text-2xl">
                  {selectedIncomingPayment.studentName}
                </DialogTitle>
                <DialogDescription>Detail pembayaran masuk siswa.</DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 sm:grid-cols-2">
                <DetailItem
                  tone="orange"
                  label="Nama siswa"
                  value={selectedIncomingPayment.studentName}
                  icon={ShieldCheck}
                />
                <DetailItem
                  tone="orange"
                  label="Cabang"
                  value={selectedIncomingPayment.branch}
                  icon={Building2}
                />
                <DetailItem
                  tone="orange"
                  label="Paket membership"
                  value={selectedIncomingPayment.packageName}
                  icon={WalletCards}
                />
                <DetailItem
                  tone="orange"
                  label="Metode bayar"
                  value={formatPaymentMethodLabel(selectedIncomingPayment.method)}
                  icon={CreditCard}
                />
                <DetailItem
                  tone="orange"
                  label="Nominal"
                  value={formatCurrency(selectedIncomingPayment.amount)}
                  icon={WalletCards}
                />
                <DetailItem
                  tone="orange"
                  label="Status"
                  value={incomingStatusMeta[selectedIncomingPayment.status].label}
                  icon={ShieldCheck}
                />
                <DetailItem
                  tone="orange"
                  label="Tanggal bayar"
                  value={formatLongDate(selectedIncomingPayment.paidAt)}
                  icon={CalendarClock}
                />

                <DetailItem
                  tone="orange"
                  label="Masa Aktif"
                  value={formatLongDate(selectedIncomingPayment.expiresAt)}
                  icon={CalendarClock}
                />
                <DetailItem
                  tone="orange"
                  label="Subscription Code"
                  value={selectedIncomingPayment.subscriptionCode ?? "-"}
                  icon={WalletCards}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={onCloseIncomingPayment}
                >
                  Tutup
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={selectedOutgoingPayment !== null}
        onOpenChange={(open) => {
          if (!open) {
            onCloseOutgoingPayment();
          }
        }}
      >
        <DialogContent className="max-w-3xl overflow-hidden border-slate-200/80 bg-white shadow-[0_24px_48px_-30px_rgba(15,23,42,0.22)]">
          {selectedOutgoingPayment ? (
            <>
              <DialogHeader className="pr-10">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={outgoingStatusMeta[selectedOutgoingPayment.status].badgeVariant}
                    className="rounded-full px-3 py-1.5"
                  >
                    {outgoingStatusMeta[selectedOutgoingPayment.status].label}
                  </Badge>
                </div>
                <DialogTitle className="text-2xl">
                  {selectedOutgoingPayment.title}
                </DialogTitle>
                <DialogDescription>
                  Detail catatan pengeluaran operasional. Pembayaran dilakukan
                  di luar LMS.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 sm:grid-cols-2">
                <DetailItem
                  tone="sky"
                  label="Judul pengeluaran"
                  value={selectedOutgoingPayment.title}
                  icon={WalletCards}
                />
                <DetailItem
                  tone="sky"
                  label="Cabang"
                  value={selectedOutgoingPayment.branch}
                  icon={Building2}
                />
                <DetailItem
                  tone="sky"
                  label="Kategori"
                  value={selectedOutgoingPayment.category}
                  icon={WalletCards}
                />
                <DetailItem
                  tone="sky"
                  label="Nominal"
                  value={formatCurrency(selectedOutgoingPayment.amount)}
                  icon={WalletCards}
                />
                <DetailItem
                  tone="sky"
                  label="Status"
                  value={outgoingStatusMeta[selectedOutgoingPayment.status].label}
                  icon={ShieldCheck}
                />
                <DetailItem
                  tone="sky"
                  label="Tanggal dicatat dibayar"
                  value={formatLongDate(selectedOutgoingPayment.disbursedAt)}
                  icon={CalendarClock}
                />
                <DetailItem
                  tone="sky"
                  label="Reference ID"
                  value={selectedOutgoingPayment.referenceId}
                  icon={CreditCard}
                />
                <DetailItem
                  tone="sky"
                  label="Catatan"
                  value={selectedOutgoingPayment.note || "-"}
                  icon={WalletCards}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={onCloseOutgoingPayment}
                >
                  Tutup
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={selectedStudent !== null}
        onOpenChange={(open) => {
          if (!open) {
            onCloseStudent();
          }
        }}
      >
        <DialogContent className="max-w-3xl overflow-hidden border-slate-200/80 bg-white shadow-[0_24px_48px_-30px_rgba(15,23,42,0.22)]">
          {selectedStudent ? (
            <>
              <DialogHeader className="pr-10">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={paymentStatusMeta[selectedStudent.paymentStatus].badgeVariant}
                    className="rounded-full px-3 py-1.5"
                  >
                    {paymentStatusMeta[selectedStudent.paymentStatus].label}
                  </Badge>
                  <Badge
                    variant={activationStatusMeta[selectedStudent.activationStatus].badgeVariant}
                    className="rounded-full px-3 py-1.5"
                  >
                    {activationStatusMeta[selectedStudent.activationStatus].label}
                  </Badge>
                </div>
                <DialogTitle className="text-2xl">
                  {selectedStudent.studentName}
                </DialogTitle>
                <DialogDescription>Detail aktivasi siswa.</DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 sm:grid-cols-2">
                <DetailItem
                  tone="emerald"
                  label="Nama siswa"
                  value={selectedStudent.studentName}
                  icon={ShieldCheck}
                />
                <DetailItem
                  tone="emerald"
                  label="Cabang"
                  value={selectedStudent.branch}
                  icon={Building2}
                />
                <DetailItem
                  tone="emerald"
                  label="Jenjang"
                  value={selectedStudent.jenjang}
                  icon={GraduationCap}
                />
                <DetailItem
                  tone="emerald"
                  label="Kelas"
                  value={selectedStudent.classLabel}
                  icon={GraduationCap}
                />
                <DetailItem
                  tone="emerald"
                  label="Paket membership"
                  value={selectedStudent.membershipPackage}
                  icon={WalletCards}
                />
                <DetailItem
                  tone="emerald"
                  label="Status pembayaran"
                  value={paymentStatusMeta[selectedStudent.paymentStatus].label}
                  icon={CreditCard}
                />
                <DetailItem
                  tone="emerald"
                  label="Status aktivasi"
                  value={activationStatusMeta[selectedStudent.activationStatus].label}
                  icon={ShieldCheck}
                />
                <DetailItem
                  tone="emerald"
                  label="Tanggal daftar"
                  value={formatLongDate(selectedStudent.registeredAt)}
                  icon={CalendarClock}
                />
                <DetailItem
                  tone="emerald"
                  label="Masa aktif / expired date"
                  value={formatLongDate(selectedStudent.activeUntil)}
                  icon={CalendarClock}
                />

                <DetailItem
                  tone="emerald"
                  label="Subscription Code"
                  value={selectedStudent.subscriptionCode}
                  icon={WalletCards}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={onCloseStudent}
                >
                  Tutup
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
