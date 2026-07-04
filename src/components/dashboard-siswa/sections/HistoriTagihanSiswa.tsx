"use client";

import { useEffect, useEffectEvent, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  CreditCard,
  Eye,
  ReceiptText,
  RotateCcw,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  MembershipRequestError,
  findPackageByName,
  formatRupiah,
  membershipService,
  type MembershipPaymentHistoryItem,
  type OnlinePackageDefinition,
} from "@/lib/subscription";
import { useSubscriptionConfig } from "@/lib/use-subscription-config";

function formatDateTimeLabel(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatPaymentStatusLabel(status: MembershipPaymentHistoryItem["status"]) {
  switch (status) {
    case "paid":
      return "Lunas";
    case "pending":
      return "Pending";
    case "failed":
      return "Gagal";
    case "expired":
      return "Kedaluwarsa";
    default:
      return status;
  }
}

function formatPaymentStatusVariant(status: MembershipPaymentHistoryItem["status"]) {
  switch (status) {
    case "paid":
      return "success";
    case "pending":
      return "warning";
    case "failed":
      return "danger";
    case "expired":
      return "secondary";
    default:
      return "secondary";
  }
}

function formatStudentPaymentMethod(value: string) {
  const normalizedValue = value.trim().toLowerCase();

  if (!normalizedValue) {
    return "Pembayaran online";
  }

  if (normalizedValue.includes("qris")) {
    return "QRIS";
  }

  if (
    normalizedValue.includes("wallet") ||
    normalizedValue.includes("gopay") ||
    normalizedValue.includes("ovo") ||
    normalizedValue.includes("dana")
  ) {
    return "E-Wallet";
  }

  if (
    normalizedValue.includes("virtual") ||
    normalizedValue.includes("bank") ||
    normalizedValue.includes("va")
  ) {
    return "Virtual Account";
  }

  if (normalizedValue.includes("manual")) {
    return "Konfirmasi Manual";
  }

  return "Pembayaran online";
}

function canContinuePayment(payment: MembershipPaymentHistoryItem) {
  return payment.status === "pending" && Boolean(payment.checkoutUrl?.trim());
}

function resolveDurationLabel(
  payment: MembershipPaymentHistoryItem,
  packages: OnlinePackageDefinition[],
) {
  const knownPackage = findPackageByName(payment.packageName, packages);

  if (knownPackage?.durationMonth) {
    return `${knownPackage.durationMonth} bulan`;
  }

  return "-";
}

function PaymentHistorySkeleton() {
  return (
    <div className="space-y-3 p-4 md:p-5">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="h-16 animate-pulse rounded-2xl border border-slate-100 bg-slate-50/80"
        />
      ))}
    </div>
  );
}

function PaymentHistoryEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-orange-100 bg-orange-50 text-orange-600">
        <ReceiptText className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-semibold text-slate-800">
          Belum ada histori tagihan
        </p>
        <p className="max-w-xl text-sm leading-6 text-slate-500">
          Tagihan membership dan pembayaran yang pernah dibuat untuk akun siswa
          kamu akan muncul di sini.
        </p>
      </div>
    </div>
  );
}

function openCheckoutUrl(checkoutUrl: string | null | undefined) {
  const resolvedUrl = checkoutUrl?.trim();

  if (!resolvedUrl) {
    return;
  }

  window.open(resolvedUrl, "_blank", "noopener,noreferrer");
}

function PendingPaymentHighlight({
  payment,
  packages,
}: {
  payment: MembershipPaymentHistoryItem;
  packages: OnlinePackageDefinition[];
}) {
  return (
    <div className="px-4 pt-4 md:px-5 md:pt-5">
      <article className="overflow-hidden rounded-[24px] border border-orange-100 bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_58%,#f8fafc_100%)] p-4 shadow-[0_18px_38px_-30px_rgba(249,115,22,0.28)] md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-orange-100 bg-white text-orange-600 shadow-sm shadow-orange-100/70">
              <CreditCard className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="warning" className="rounded-full px-3 py-1">
                  Menunggu pembayaran
                </Badge>
                <span className="text-xs font-medium text-slate-400">
                  {formatDateTimeLabel(payment.createdAt)}
                </span>
              </div>
              <h3 className="mt-3 text-lg font-semibold tracking-tight text-slate-950">
                {payment.packageName}
              </h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Tagihan ini masih aktif. Selesaikan pembayaran agar membership
                bisa segera diproses.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-slate-500">
                <span className="rounded-full border border-white/80 bg-white px-3 py-1.5 shadow-sm">
                  Durasi {resolveDurationLabel(payment, packages)}
                </span>
                <span className="rounded-full border border-white/80 bg-white px-3 py-1.5 shadow-sm">
                  Pembayaran online
                </span>
                {payment.expiresAt ? (
                  <span className="rounded-full border border-white/80 bg-white px-3 py-1.5 shadow-sm">
                    Berlaku hingga {formatDateTimeLabel(payment.expiresAt)}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-[22px] border border-white/80 bg-white/90 px-4 py-4 shadow-[0_16px_30px_-28px_rgba(15,23,42,0.28)] lg:min-w-[260px]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Total pembayaran
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              {formatRupiah(payment.amount)}
            </p>
            <Button
              type="button"
              className="mt-4 h-11 w-full rounded-2xl bg-orange-500 text-sm font-semibold text-white shadow-[0_14px_24px_-18px_rgba(249,115,22,0.7)] transition hover:-translate-y-0.5 hover:bg-orange-600 hover:shadow-[0_18px_28px_-18px_rgba(249,115,22,0.82)]"
              onClick={() => openCheckoutUrl(payment.checkoutUrl)}
            >
              Lanjut Pembayaran
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </article>
    </div>
  );
}

function PaymentDetailItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium leading-6 text-slate-800">{value}</p>
    </div>
  );
}

export default function HistoriTagihanSiswa({
  reloadSignal = 0,
}: {
  reloadSignal?: number;
}) {
  const { config: subscriptionConfig } = useSubscriptionConfig();
  const packageOptions = subscriptionConfig.packages;
  const [payments, setPayments] = useState<MembershipPaymentHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedPayment, setSelectedPayment] =
    useState<MembershipPaymentHistoryItem | null>(null);

  const loadPaymentHistory = useEffectEvent(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await membershipService.getMyPaymentHistory();
      setPayments(response.data?.payments ?? []);
    } catch (requestError) {
      if (
        requestError instanceof MembershipRequestError &&
        (requestError.status === 401 || requestError.status === 403)
      ) {
        setError("Sesi login siswa tidak valid untuk membaca histori tagihan.");
      } else {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Gagal memuat histori tagihan siswa.",
        );
      }

      setPayments([]);
    } finally {
      setIsLoading(false);
    }
  });

  useEffect(() => {
    queueMicrotask(() => {
      void loadPaymentHistory();
    });
  }, [reloadKey, reloadSignal]);

  const pendingPayment = payments.find(canContinuePayment) ?? null;

  useEffect(() => {
    if (pendingPayment) {
      const intervalId = window.setInterval(() => {
        setReloadKey((k) => k + 1);
      }, 5000);
      return () => window.clearInterval(intervalId);
    }
  }, [pendingPayment]);

  return (
    <>
    <section className="overflow-hidden rounded-[24px] border border-orange-100/90 bg-white shadow-[0_18px_40px_-34px_rgba(15,23,42,0.22),0_12px_24px_-22px_rgba(249,115,22,0.14)]">
      <div className="flex flex-col gap-3 border-b border-orange-100/80 bg-[linear-gradient(135deg,rgba(255,247,237,0.95),rgba(255,255,255,0.98))] px-4 py-4 md:flex-row md:items-start md:justify-between md:px-5">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-orange-100 bg-white text-orange-600 shadow-sm shadow-orange-100/60">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 md:text-lg">
              Histori Tagihan
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              Lihat seluruh payment membership milik akun kamu, termasuk tagihan
              yang masih pending dan bisa dilanjutkan pembayarannya.
            </p>
          </div>
        </div>

        <Badge variant="info" className="self-start">
          {payments.length} Tagihan
        </Badge>
      </div>

      {isLoading ? <PaymentHistorySkeleton /> : null}

      {!isLoading && error ? (
        <div className="flex flex-col gap-4 px-4 py-6 md:flex-row md:items-center md:justify-between md:px-5">
          <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50/80 px-4 py-3 text-red-700">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Histori tagihan belum bisa dimuat</p>
              <p className="mt-1 text-sm leading-6">{error}</p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setReloadKey((currentValue) => currentValue + 1);
            }}
          >
            <RotateCcw className="h-4 w-4" />
            Coba Lagi
          </Button>
        </div>
      ) : null}

      {!isLoading && !error && payments.length === 0 ? (
        <PaymentHistoryEmptyState />
      ) : null}

      {!isLoading && !error && payments.length > 0 ? (
        <>
          {pendingPayment ? (
            <PendingPaymentHighlight
              payment={pendingPayment}
              packages={packageOptions}
            />
          ) : null}

          <div className="p-4 md:p-5">
            <div className="overflow-hidden rounded-[22px] border border-slate-100 bg-white">
              <div className="overflow-x-auto">
          <Table className="min-w-[920px]">
            <TableHeader>
              <TableRow className="bg-slate-50/80">
                <TableHead>Tagihan</TableHead>
                <TableHead>Nominal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Waktu</TableHead>
                <TableHead className="text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow
                  key={payment.paymentId}
                  className="transition-colors hover:bg-slate-50/70"
                >
                  <TableCell>
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-900">
                        {payment.packageName}
                      </p>
                      <p className="text-xs text-slate-500">
                        Durasi: {resolveDurationLabel(payment, packageOptions)}
                      </p>
                      <p className="font-mono text-xs text-slate-500">
                        {payment.paymentId}
                      </p>
                      <p className="text-xs text-slate-500">
                        Subscription: {payment.subscriptionCode ?? "-"}
                      </p>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-900">
                        {formatRupiah(payment.amount)}
                      </p>
                      <p className="text-xs text-slate-500">
                        Dibuat {formatDateTimeLabel(payment.createdAt)}
                      </p>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="space-y-2">
                      <Badge variant={formatPaymentStatusVariant(payment.status)}>
                        {formatPaymentStatusLabel(payment.status)}
                      </Badge>
                      <p className="text-xs leading-5 text-slate-500">
                        {payment.paidAt
                          ? `Lunas pada ${formatDateTimeLabel(payment.paidAt)}`
                          : payment.expiresAt
                            ? `Berlaku hingga ${formatDateTimeLabel(payment.expiresAt)}`
                            : "Belum ada konfirmasi pembayaran"}
                      </p>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="space-y-1 text-xs leading-5 text-slate-500">
                      <p>Dibuat: {formatDateTimeLabel(payment.createdAt)}</p>
                      <p>Lunas: {formatDateTimeLabel(payment.paidAt)}</p>
                      <p>Expires: {formatDateTimeLabel(payment.expiresAt)}</p>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex justify-center">
                    {canContinuePayment(payment) ? (
                      <Button
                        type="button"
                        size="sm"
                        className="rounded-full bg-orange-500 text-white shadow-sm shadow-orange-500/20 transition hover:bg-orange-600"
                        onClick={() => openCheckoutUrl(payment.checkoutUrl)}
                      >
                        Lanjut Pembayaran
                        <ArrowUpRight className="h-4 w-4" />
                      </Button>
                    ) : payment.status === "paid" ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="size-9 rounded-full border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                        title="Lihat detail tagihan"
                        onClick={() => setSelectedPayment(payment)}
                      >
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">Lihat detail tagihan</span>
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </section>

    <Dialog
      open={selectedPayment !== null}
      onOpenChange={(open) => {
        if (!open) {
          setSelectedPayment(null);
        }
      }}
    >
      <DialogContent className="w-[calc(100%-1rem)] max-w-2xl border-slate-200/80 bg-white p-0 shadow-[0_24px_48px_-30px_rgba(15,23,42,0.24)] sm:w-[calc(100%-2rem)]">
        {selectedPayment ? (
          <div className="overflow-hidden rounded-[inherit]">
            <DialogHeader className="border-b border-slate-200/80 bg-[linear-gradient(135deg,#f8fafc_0%,#ffffff_100%)] px-5 py-5 text-left sm:px-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="success" className="rounded-full px-3 py-1">
                  {formatPaymentStatusLabel(selectedPayment.status)}
                </Badge>
              </div>
              <DialogTitle className="text-xl font-semibold tracking-tight text-slate-950">
                Detail Tagihan Lunas
              </DialogTitle>
              <DialogDescription>
                Rincian pembayaran membership yang sudah terverifikasi.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 px-5 py-5 sm:grid-cols-2 sm:px-6">
              <PaymentDetailItem
                label="Paket membership"
                value={selectedPayment.packageName}
              />
              <PaymentDetailItem
                label="Nominal"
                value={formatRupiah(selectedPayment.amount)}
              />
              <PaymentDetailItem
                label="Durasi"
                value={resolveDurationLabel(selectedPayment, packageOptions)}
              />
              <PaymentDetailItem
                label="Metode pembayaran"
                value={formatStudentPaymentMethod(selectedPayment.method)}
              />
              <PaymentDetailItem
                label="Payment ID"
                value={selectedPayment.paymentId}
              />
              <PaymentDetailItem
                label="Subscription"
                value={selectedPayment.subscriptionCode ?? "-"}
              />
              <PaymentDetailItem
                label="Dibuat"
                value={formatDateTimeLabel(selectedPayment.createdAt)}
              />
              <PaymentDetailItem
                label="Lunas"
                value={formatDateTimeLabel(selectedPayment.paidAt)}
              />
            </div>

            <DialogFooter className="border-t border-slate-200/80 px-5 py-4 sm:px-6">
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => setSelectedPayment(null)}
              >
                Tutup
              </Button>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
    </>
  );
}
