"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CreditCard,
  LockKeyhole,
  ReceiptText,
  RefreshCcw,
  X,
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
  MembershipRequestError,
  formatDateLabel,
  formatRupiah,
  membershipService,
  type MembershipAccessStatus,
  type MembershipPayment,
  type MembershipPaymentHistoryItem,
  type MembershipStatusData,
} from "@/lib/subscription";

import { subscribeStudentDashboardRefresh } from "./student-dashboard-refresh-events";

const TAGIHAN_PATH = "/dashboard-siswa/tagihan";

const ACADEMIC_PATH_PREFIXES = [
  "/dashboard-siswa/absensi",
  "/dashboard-siswa/jadwal",
  "/dashboard-siswa/kirim-tugas",
  "/dashboard-siswa/materi",
  "/dashboard-siswa/nilai",
  "/dashboard-siswa/scan-absen",
  "/dashboard-siswa/tugas",
  "/dashboard-siswa/tryout",
  "/dashboard-siswa/ujian",
] as const;

type PendingPaymentReference = {
  paymentId: string;
  packageName: string;
  amount: number;
  checkoutUrl: string | null;
  expiresAt: string | null;
};

type GateCopy = {
  badge: string;
  title: string;
  description: string;
  primaryLabel: string;
  secondaryLabel: string;
};

function isMembershipLocked(accessStatus: MembershipAccessStatus | undefined) {
  return (
    accessStatus === "expired" ||
    accessStatus === "pending" ||
    accessStatus === "not_registered"
  );
}

function isMembershipExpiringSoon(membershipData: MembershipStatusData | null) {
  return (
    membershipData?.accessStatus === "expiring" &&
    typeof membershipData.daysRemaining === "number" &&
    membershipData.daysRemaining <= 14
  );
}

function isAcademicPath(pathname: string) {
  return ACADEMIC_PATH_PREFIXES.some(
    (pathPrefix) => pathname === pathPrefix || pathname.startsWith(`${pathPrefix}/`),
  );
}

function toPendingPaymentReference(
  payment: MembershipPayment | MembershipPaymentHistoryItem | null | undefined,
): PendingPaymentReference | null {
  if (!payment || payment.status !== "pending") {
    return null;
  }

  return {
    paymentId: payment.paymentId,
    packageName: payment.packageName,
    amount: payment.amount,
    checkoutUrl: payment.checkoutUrl?.trim() || null,
    expiresAt: payment.expiresAt ?? null,
  };
}

function getScheduledAccessDate(membershipData: MembershipStatusData | null) {
  if (
    membershipData?.accessStatus !== "pending" ||
    membershipData.subscription?.paymentStatus !== "paid" ||
    !membershipData.subscription.startDate
  ) {
    return null;
  }

  const startDate = new Date(membershipData.subscription.startDate);

  if (Number.isNaN(startDate.getTime()) || startDate.getTime() <= Date.now()) {
    return null;
  }

  return membershipData.subscription.startDate;
}

function getGateCopy(
  membershipData: MembershipStatusData | null,
  pendingPayment: PendingPaymentReference | null,
): GateCopy {
  const accessStatus = membershipData?.accessStatus;
  const scheduledAccessDate = getScheduledAccessDate(membershipData);

  if (pendingPayment) {
    return {
      badge: "Menunggu Pembayaran",
      title: "Pembayaran paket belajar belum selesai",
      description:
        "Masih ada tagihan perpanjangan yang menunggu pembayaran. Selesaikan tagihan ini agar akses materi, tugas, jadwal, absensi, nilai, dan ujian bisa aktif kembali.",
      primaryLabel: pendingPayment?.checkoutUrl
        ? "Lanjut Pembayaran"
        : "Buka Tagihan",
      secondaryLabel: "Riwayat Pembayaran",
    };
  }

  if (scheduledAccessDate) {
    return {
      badge: "Akses Terjadwal",
      title: "Akses belajar dibuka mulai periode baru",
      description: `Paket belajar sudah tercatat dan pembayaran sudah selesai. Materi, tugas, jadwal, absensi, nilai, dan ujian akan dibuka mulai ${formatDateLabel(scheduledAccessDate)}.`,
      primaryLabel: "Lihat Tagihan",
      secondaryLabel: "Histori Pembayaran",
    };
  }

  if (accessStatus === "pending") {
    return {
      badge: "Paket Belum Aktif",
      title: "Akses belajar menunggu paket aktif",
      description:
        "Paket belajar akun ini belum berada di masa aktif. Kamu tetap bisa login dan melihat histori tagihan, tetapi area pembelajaran dikunci sampai paket aktif.",
      primaryLabel: "Buka Tagihan",
      secondaryLabel: "Riwayat Pembayaran",
    };
  }

  if (accessStatus === "expired") {
    return {
      badge: "Paket Berakhir",
      title: "Perpanjang paket belajar untuk akses belajar",
      description:
        "Paket belajar akun ini sudah berakhir. Kamu tetap bisa login untuk melihat profil dan histori tagihan, tetapi area pembelajaran dikunci sampai paket diperpanjang.",
      primaryLabel: "Perpanjang Paket",
      secondaryLabel: "Riwayat Pembayaran",
    };
  }

  if (isMembershipExpiringSoon(membershipData)) {
    const packageLabel =
      membershipData?.subscription?.packageName?.trim() || "Paket belajar";
    const daysRemaining = membershipData?.daysRemaining ?? 0;
    const daysLabel =
      daysRemaining <= 0 ? "hari ini" : `dalam ${daysRemaining} hari`;
    const endDateLabel = formatDateLabel(
      membershipData?.subscription?.endDate ?? null,
    );

    return {
      badge: "Hampir Berakhir",
      title: "Masa aktif membership hampir selesai",
      description: `${packageLabel} akan berakhir ${daysLabel} (${endDateLabel}). Kamu masih bisa belajar sampai masa aktif selesai, tetapi perpanjangan sudah bisa disiapkan dari menu Tagihan.`,
      primaryLabel: "Perpanjang Paket",
      secondaryLabel: "Lihat Tagihan",
    };
  }

  return {
    badge: "Akses Belum Aktif",
    title: "Paket belajar belum aktif",
    description:
      "Akun siswa sudah bisa login, tetapi akses pembelajaran belum tersedia sampai paket belajar aktif.",
    primaryLabel: "Buka Tagihan",
    secondaryLabel: "Riwayat Pembayaran",
  };
}

function getDismissKey(
  membershipData: MembershipStatusData | null,
  pendingPayment: PendingPaymentReference | null,
) {
  const status = membershipData?.accessStatus ?? "unknown";
  const paymentId = pendingPayment?.paymentId ?? membershipData?.payment?.paymentId;
  const subscriptionId = membershipData?.subscription?.id;

  return [
    "student-membership-gate",
    status,
    paymentId || subscriptionId || "none",
  ].join(":");
}

function openCheckoutUrl(checkoutUrl: string | null | undefined) {
  const resolvedCheckoutUrl = checkoutUrl?.trim();

  if (!resolvedCheckoutUrl) {
    return;
  }

  window.open(resolvedCheckoutUrl, "_blank", "noopener,noreferrer");
}

function MembershipGateDialog({
  open,
  onOpenChange,
  copy,
  pendingPayment,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  copy: GateCopy;
  pendingPayment: PendingPaymentReference | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-md border-orange-100 bg-white p-0 shadow-[0_24px_54px_-34px_rgba(15,23,42,0.35)]">
        <DialogHeader className="border-b border-orange-100 bg-orange-50/80 px-5 py-5 pr-12 text-left">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-orange-600 shadow-sm">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <Badge variant="warning" className="mt-3 w-fit">
            {copy.badge}
          </Badge>
          <DialogTitle className="text-lg font-semibold text-slate-950">
            {copy.title}
          </DialogTitle>
          <DialogDescription className="text-sm leading-6 text-slate-600">
            {copy.description}
          </DialogDescription>
        </DialogHeader>

        {pendingPayment ? (
          <div className="px-5 pt-5">
            <div className="rounded-2xl border border-orange-100 bg-orange-50/60 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-600">
                Tagihan aktif
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {pendingPayment.packageName}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                <span>{formatRupiah(pendingPayment.amount)}</span>
                <span>
                  Berlaku sampai {formatDateLabel(pendingPayment.expiresAt)}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter className="grid gap-2 px-5 py-5 sm:grid-cols-2">
          {pendingPayment?.checkoutUrl ? (
            <Button
              type="button"
              className="bg-orange-600 text-white hover:bg-orange-700"
              onClick={() => openCheckoutUrl(pendingPayment.checkoutUrl)}
            >
              <CreditCard className="h-4 w-4" />
              {copy.primaryLabel}
            </Button>
          ) : (
            <Link
              href={TAGIHAN_PATH}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-orange-600 px-5 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-px hover:bg-orange-700"
            >
              <CreditCard className="h-4 w-4" />
              {copy.primaryLabel}
            </Link>
          )}

          <Link
            href={TAGIHAN_PATH}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200/90 bg-white/95 px-5 text-sm font-medium text-slate-700 shadow-sm shadow-slate-950/5 transition-all duration-200 hover:-translate-y-px hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700"
          >
            <ReceiptText className="h-4 w-4" />
            {copy.secondaryLabel}
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LockedAcademicAccessView({
  copy,
  pendingPayment,
  onRetry,
}: {
  copy: GateCopy;
  pendingPayment: PendingPaymentReference | null;
  onRetry: () => void;
}) {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <div className="overflow-hidden rounded-[28px] border border-orange-100 bg-white shadow-sm">
        <div className="h-1 bg-gradient-to-r from-red-600 via-orange-500 to-amber-400" />
        <div className="grid gap-6 px-5 py-8 lg:grid-cols-[1fr_0.85fr] lg:px-8 lg:py-10">
          <div className="max-w-3xl">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
              <LockKeyhole className="h-6 w-6" />
            </div>
            <Badge variant="warning" className="mt-5 w-fit">
              {copy.badge}
            </Badge>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
              {copy.title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              {copy.description}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {pendingPayment?.checkoutUrl ? (
                <Button
                  type="button"
                  className="bg-orange-600 text-white hover:bg-orange-700"
                  onClick={() => openCheckoutUrl(pendingPayment.checkoutUrl)}
                >
                  <CreditCard className="h-4 w-4" />
                  {copy.primaryLabel}
                </Button>
              ) : (
                <Link
                  href={TAGIHAN_PATH}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-orange-600 px-5 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-px hover:bg-orange-700"
                >
                  <CreditCard className="h-4 w-4" />
                  {copy.primaryLabel}
                </Link>
              )}

              <Link
                href={TAGIHAN_PATH}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200/90 bg-white/95 px-5 text-sm font-medium text-slate-700 shadow-sm shadow-slate-950/5 transition-all duration-200 hover:-translate-y-px hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700"
              >
                <ReceiptText className="h-4 w-4" />
                {copy.secondaryLabel}
              </Link>

              <Button type="button" variant="ghost" onClick={onRetry}>
                <RefreshCcw className="h-4 w-4" />
                Cek Ulang
              </Button>
            </div>
          </div>

          <aside className="rounded-[24px] border border-slate-100 bg-slate-50/80 p-5">
            <p className="text-sm font-semibold text-slate-900">
              Yang masih bisa dibuka
            </p>
            <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-600">
              <div className="rounded-2xl bg-white px-4 py-3">
                Profil siswa dan data akun tetap bisa dicek.
              </div>
              <div className="rounded-2xl bg-white px-4 py-3">
                Halaman tagihan dan histori pembayaran tetap aktif.
              </div>
              <div className="rounded-2xl bg-white px-4 py-3">
                Materi, tugas, jadwal, absensi, nilai, dan ujian dibuka lagi
                setelah paket belajar aktif.
              </div>
            </div>

            {pendingPayment ? (
              <div className="mt-5 rounded-[22px] border border-orange-100 bg-white px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-600">
                  Menunggu pembayaran
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {pendingPayment.packageName}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {formatRupiah(pendingPayment.amount)}
                </p>
                {pendingPayment.checkoutUrl ? (
                  <button
                    type="button"
                    onClick={() => openCheckoutUrl(pendingPayment.checkoutUrl)}
                    className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-orange-600 transition hover:text-orange-700"
                  >
                    Lanjutkan pembayaran
                    <ArrowUpRight className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </section>
  );
}

function MembershipGateBanner({
  copy,
  pendingPayment,
  onClose,
}: {
  copy: GateCopy;
  pendingPayment: PendingPaymentReference | null;
  onClose: () => void;
}) {
  return (
    <div className="border-b border-orange-100 bg-orange-50">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-orange-600 shadow-sm">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-orange-800">{copy.title}</p>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-orange-700/85">
              {pendingPayment
                ? "Selesaikan pembayaran agar akses pembelajaran aktif kembali."
                : copy.description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {pendingPayment?.checkoutUrl ? (
            <button
              type="button"
              onClick={() => openCheckoutUrl(pendingPayment.checkoutUrl)}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-orange-600 px-3 text-xs font-semibold text-white transition hover:bg-orange-700"
            >
              Lanjut Bayar
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <Link
              href={TAGIHAN_PATH}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-orange-600 px-3 text-xs font-semibold text-white transition hover:bg-orange-700"
            >
              Buka Tagihan
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-orange-200 bg-white text-orange-600 transition hover:bg-orange-100"
            aria-label="Tutup pemberitahuan paket belajar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StudentMembershipAccessGate({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [membershipData, setMembershipData] =
    useState<MembershipStatusData | null>(null);
  const [pendingPayment, setPendingPayment] =
    useState<PendingPaymentReference | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const loadMembershipGate = useCallback(async () => {
    setIsLoading(true);

    try {
      const subscriptionResponse = await membershipService.getMySubscription();
      const nextMembershipData = subscriptionResponse.data ?? null;
      const hasScheduledAccess = Boolean(getScheduledAccessDate(nextMembershipData));
      let nextPendingPayment =
        toPendingPaymentReference(nextMembershipData?.payment) ?? null;

      if (
        isMembershipLocked(nextMembershipData?.accessStatus) &&
        !hasScheduledAccess &&
        !nextPendingPayment
      ) {
        const historyResponse = await membershipService.getMyPaymentHistory();
        nextPendingPayment =
          historyResponse.data?.payments
            ?.map(toPendingPaymentReference)
            .find((payment): payment is PendingPaymentReference => payment !== null) ??
          null;
      }

      setMembershipData(nextMembershipData);
      setPendingPayment(nextPendingPayment);
      setBannerDismissed(false);

      if (
        isMembershipLocked(nextMembershipData?.accessStatus) ||
        isMembershipExpiringSoon(nextMembershipData)
      ) {
        const dismissKey = getDismissKey(nextMembershipData, nextPendingPayment);
        const hasDismissed =
          typeof window !== "undefined" &&
          window.sessionStorage.getItem(dismissKey) === "1";

        setDialogOpen(!hasDismissed && pathname !== TAGIHAN_PATH);
      } else {
        setDialogOpen(false);
      }
    } catch (error) {
      if (
        error instanceof MembershipRequestError &&
        (error.status === 401 || error.status === 403)
      ) {
        setMembershipData(null);
        setPendingPayment(null);
        setDialogOpen(false);
        return;
      }

      console.error("[dashboard-siswa] load_membership_gate_failed", error);
    } finally {
      setIsLoading(false);
    }
  }, [pathname]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadMembershipGate();
    });
  }, [loadMembershipGate]);

  useEffect(() => {
    return subscribeStudentDashboardRefresh(() => {
      void loadMembershipGate();
    });
  }, [loadMembershipGate]);

  const isLocked = isMembershipLocked(membershipData?.accessStatus);
  const isExpiringSoon = isMembershipExpiringSoon(membershipData);
  const isTagihanPath = pathname === TAGIHAN_PATH;
  const shouldShowMembershipNotice = isLocked || isExpiringSoon;
  const shouldBlockChildren =
    !isLoading && isLocked && isAcademicPath(pathname);
  const copy = useMemo(
    () => getGateCopy(membershipData, pendingPayment),
    [membershipData, pendingPayment],
  );

  function handleDialogOpenChange(open: boolean) {
    setDialogOpen(open);

    if (!open && shouldShowMembershipNotice) {
      const dismissKey = getDismissKey(membershipData, pendingPayment);
      window.sessionStorage.setItem(dismissKey, "1");
    }
  }

  return (
    <>
      {!isLoading && shouldShowMembershipNotice && !isTagihanPath && !bannerDismissed ? (
        <MembershipGateBanner
          copy={copy}
          pendingPayment={pendingPayment}
          onClose={() => setBannerDismissed(true)}
        />
      ) : null}

      {!isLoading && shouldShowMembershipNotice && !isTagihanPath ? (
        <MembershipGateDialog
          open={dialogOpen}
          onOpenChange={handleDialogOpenChange}
          copy={copy}
          pendingPayment={pendingPayment}
        />
      ) : null}

      {shouldBlockChildren ? (
        <LockedAcademicAccessView
          copy={copy}
          pendingPayment={pendingPayment}
          onRetry={loadMembershipGate}
        />
      ) : (
        children
      )}
    </>
  );
}
