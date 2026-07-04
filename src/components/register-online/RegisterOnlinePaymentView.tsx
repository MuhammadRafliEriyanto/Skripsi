"use client";

import {
  ArrowRight,
  BadgeCheck,
  Building2,
  ChevronRight,
  CreditCard,
  ExternalLink,
  Info,
  LoaderCircle,
  QrCode,
  Receipt,
  Smartphone,
} from "lucide-react";

import { AuthShell } from "@/components/auth/AuthShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MembershipRequestError,
  formatRupiah,
  membershipService,
  type PaymentStatusResponse,
} from "@/lib/subscription";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useState, useEffect } from "react";
import type { LucideIcon } from "lucide-react";

type RegisterOnlinePaymentViewProps = {
  paymentId: string;
};

type GatewayState = "review" | "processing" | "success";
type PaymentState = NonNullable<PaymentStatusResponse["data"]>;

type PaymentMethodId = "qris" | "virtual-account" | "e-wallet";

type PaymentMethodOption = {
  id: PaymentMethodId;
  label: string;
  detail: string;
  helper: string;
  icon: LucideIcon;
};

const paymentMethods: PaymentMethodOption[] = [
  {
    id: "qris",
    label: "QRIS",
    detail: "Scan & bayar instan.",
    helper: "Paling direkomendasikan",
    icon: QrCode,
  },
  {
    id: "virtual-account",
    label: "Virtual Account",
    detail: "Transfer bank otomatis.",
    helper: "BCA, Mandiri, BNI, dll",
    icon: Building2,
  },
  {
    id: "e-wallet",
    label: "E-Wallet",
    detail: "Bayar pakai dompet digital.",
    helper: "GoPay, OVO, Dana",
    icon: Smartphone,
  },
];

function mapPaymentState(data: PaymentStatusResponse["data"] | undefined) {
  return data ?? null;
}

function getStatusBadgeVariant(status: PaymentState["payment"]["status"] | undefined) {
  if (status === "paid") {
    return "success" as const;
  }

  if (status === "failed" || status === "expired") {
    return "danger" as const;
  }

  return "warning" as const;
}

export default function RegisterOnlinePaymentView({
  paymentId,
}: RegisterOnlinePaymentViewProps) {
  const [loading, setLoading] = useState(true);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodId>("qris");
  const [gatewayState, setGatewayState] = useState<GatewayState>("review");
  const [paymentData, setPaymentData] = useState<PaymentState | null>(null);

  function applyPaymentData(nextData: PaymentState | null) {
    setPaymentData(nextData);

    if (nextData?.payment.status === "paid") {
      setGatewayState("success");
      return;
    }

    if (nextData?.payment.xenditSessionStatus === "COMPLETED") {
      setGatewayState("processing");
      return;
    }

    setGatewayState("review");
  }

  useEffect(() => {
    let isMounted = true;

    async function loadPayment() {
      setLoading(true);
      setErrorMessage("");

      try {
        const response = await membershipService.getPaymentStatus(paymentId);

        if (!isMounted) {
          return;
        }

        const nextData = mapPaymentState(response.data);
        applyPaymentData(nextData);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof MembershipRequestError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("Halaman pembayaran belum dapat dimuat. Silakan coba lagi.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadPayment();

    return () => {
      isMounted = false;
    };
  }, [paymentId]);

  useEffect(() => {
    if (!paymentData || paymentData.payment.status === "paid") {
      return;
    }

    let isMounted = true;
    const intervalId = window.setInterval(async () => {
      try {
        const response = await membershipService.getPaymentStatus(paymentId);

        if (!isMounted) {
          return;
        }

        applyPaymentData(mapPaymentState(response.data));
      } catch {
        // Keep the latest visible state and let the next polling cycle retry.
      }
    }, 5000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [paymentData, paymentId]);

  async function handlePaymentAction() {
    setConfirmingPayment(true);
    setErrorMessage("");

    try {
      if (paymentData?.payment.provider === "xendit" || paymentData?.payment.xenditPaymentSessionId) {
        const checkoutUrl = paymentData?.payment.checkoutUrl?.trim();

        if (!checkoutUrl) {
          throw new Error("Checkout Xendit belum tersedia untuk pembayaran ini.");
        }

        const checkoutWindow = window.open(checkoutUrl, "_blank", "noopener,noreferrer");

        if (!checkoutWindow) {
          window.location.assign(checkoutUrl);
        }

        setGatewayState("processing");
        return;
      }

      setGatewayState("processing");
      await new Promise((resolve) => window.setTimeout(resolve, 1200));

      const response = await membershipService.confirmPayment(paymentId);
      applyPaymentData(mapPaymentState(response.data));
    } catch (error) {
      if (error instanceof MembershipRequestError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error && error.message) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Simulasi payment gateway belum berhasil diproses.");
      }

      setGatewayState("review");
    } finally {
      setConfirmingPayment(false);
    }
  }

  const statusPageHref = `/register/status?paymentId=${encodeURIComponent(paymentId)}`;
  const paymentStatus = paymentData?.payment.status;
  const xenditPaymentFlow =
    paymentData?.payment.provider === "xendit" ||
    Boolean(paymentData?.payment.xenditPaymentSessionId);
  const waitingForWebhook =
    paymentData?.payment.status === "pending" &&
    (paymentData?.payment.xenditSessionStatus === "PAID" ||
      paymentData?.payment.xenditSessionStatus === "SETTLED");
  const checkoutUrl = paymentData?.payment.checkoutUrl?.trim() ?? "";
  const canOpenCheckout =
    xenditPaymentFlow && paymentStatus === "pending" && !waitingForWebhook && Boolean(checkoutUrl);

  return (
    <AuthShell
      variant="split"
      splitContentAlignment="start"
      splitContentClassName="pt-8 lg:pt-10"
      hideSplitVisualOnMobile
      hideSplitTopBadge
      allowDesktopScroll
      title={
        gatewayState === "success" || paymentStatus === "paid"
          ? "Pembayaran Berhasil"
          : waitingForWebhook
            ? "Verifikasi Pembayaran"
          : "Selesaikan Pembayaran"
      }
      description={
        gatewayState === "success" || paymentStatus === "paid"
          ? "Pembayaran Anda telah dikonfirmasi. Membership Anda kini telah aktif."
          : waitingForWebhook
            ? "Kami telah menerima pembayaran Anda. Menunggu konfirmasi akhir dari sistem."
            : "Silakan pilih metode pembayaran untuk menyelesaikan proses registrasi siswa."
      }
      footer={
        <div className="flex flex-col gap-5 text-center">
          <Link
            href="/register"
            className="text-sm font-semibold text-slate-400 transition hover:text-orange-600"
          >
            Ganti paket atau ubah data pendaftaran
          </Link>
          <div className="flex items-center justify-center gap-6 border-t border-slate-100 pt-6">
            <Link href="/" className="text-xs font-medium text-slate-400 hover:text-slate-600">Beranda</Link>
            <Link href="/login" className="text-xs font-medium text-slate-400 hover:text-slate-600">Masuk Akun</Link>
          </div>
        </div>
      }
    >
      <div className="space-y-8">
        {loading ? (
          <div className="flex min-h-[350px] flex-col items-center justify-center gap-4 text-center">
            <div className="relative">
              <div className="absolute inset-0 size-12 animate-ping rounded-full bg-orange-100 opacity-75" />
              <LoaderCircle className="relative size-12 animate-spin text-orange-500" />
            </div>
            <p className="text-sm font-medium text-slate-500">Memuat detail tagihan...</p>
          </div>
        ) : (
          <div className="space-y-8 pb-8">
            {/* Digital Receipt Card */}
            <div className="group relative overflow-hidden rounded-[2rem] border border-slate-200/60 bg-white p-8 shadow-sm transition-all duration-500 hover:shadow-xl hover:shadow-orange-500/10">
              {/* Decorative background elements */}
              <div className="absolute -right-12 -top-12 size-40 rounded-full bg-orange-100/40 blur-3xl transition-transform duration-700 group-hover:scale-150" />
              <div className="absolute -left-12 -bottom-12 size-40 rounded-full bg-blue-50/60 blur-3xl transition-transform duration-700 group-hover:scale-150" />
              
              <div className="relative space-y-6">
                <div className="flex items-center justify-between border-b border-dashed border-slate-200 pb-5">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-full bg-orange-50 text-orange-600 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                      <Receipt className="size-5" />
                    </div>
                    <div>
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">Ringkasan</span>
                      <span className="block text-sm font-bold text-slate-700">Tagihan Anda</span>
                    </div>
                  </div>
                  <Badge 
                    variant={getStatusBadgeVariant(paymentStatus)} 
                    className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider shadow-sm"
                  >
                    {paymentStatus ?? "pending"}
                  </Badge>
                </div>
                
                <div className="space-y-2 rounded-2xl bg-slate-50/50 p-5 border border-slate-100/80">
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Paket Membership</p>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline gap-2">
                    <h3 className="text-xl font-black text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600">
                      {paymentData?.subscription.packageName ?? paymentData?.payment.packageName ?? ""}
                    </h3>
                    <span className="text-3xl font-black text-orange-600 tracking-tight">
                      {paymentData ? formatRupiah(paymentData.payment.amount) : "-"}
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div className="space-y-1 rounded-xl bg-white p-3 border border-slate-100 shadow-sm transition-colors hover:border-orange-200">
                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Nama Siswa</p>
                    <p className="text-sm font-bold text-slate-900 truncate">{paymentData?.student.name}</p>
                  </div>
                  <div className="space-y-1 rounded-xl bg-white p-3 border border-slate-100 shadow-sm transition-colors hover:border-orange-200 text-right">
                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Cabang</p>
                    <p className="text-sm font-bold text-slate-900 truncate">{paymentData?.student.branch}</p>
                  </div>
                  <div className="space-y-1 rounded-xl bg-white p-3 border border-slate-100 shadow-sm transition-colors hover:border-orange-200">
                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">ID Transaksi</p>
                    <p className="text-xs font-mono font-semibold text-slate-600 uppercase">{paymentId.split('-')[0]}...</p>
                  </div>
                  <div className="space-y-1 rounded-xl bg-white p-3 border border-slate-100 shadow-sm transition-colors hover:border-orange-200 text-right">
                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Provider</p>
                    <p className="text-sm font-bold text-slate-900 uppercase">{paymentData?.payment.provider ?? "Internal"}</p>
                  </div>
                </div>
              </div>
            </div>

            {errorMessage ? (
              <div className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50/50 p-4 text-sm leading-6 text-red-700">
                <Info className="mt-1 size-4 shrink-0" />
                <p>{errorMessage}</p>
              </div>
            ) : null}

            {gatewayState === "success" || paymentStatus === "paid" ? (
              <div className="group relative overflow-hidden rounded-3xl border border-emerald-100/60 bg-emerald-50/40 p-10 text-center transition-all duration-500 hover:shadow-[0_8px_30px_-4px_rgba(16,185,129,0.08)]">
                <div className="absolute -left-4 -top-4 size-32 rounded-full bg-emerald-200/30 blur-3xl transition-transform duration-700 group-hover:scale-125" />
                <div className="relative space-y-6">
                  <div className="mx-auto flex size-20 items-center justify-center rounded-[2rem] bg-emerald-500 text-white shadow-lg shadow-emerald-200/50 ring-8 ring-white/60">
                    <BadgeCheck className="size-10" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-2xl font-black text-emerald-950">Pembayaran Terverifikasi</h4>
                    <p className="text-sm leading-relaxed text-emerald-800/70 mx-auto max-w-[240px]">
                      Selamat! Akun Anda sudah aktif dan siap digunakan untuk belajar.
                    </p>
                  </div>
                  <div className="pt-4">
                    <Link href={statusPageHref}>
                      <Button className="h-12 w-full rounded-xl bg-emerald-600 font-bold text-white shadow-md transition-all hover:bg-emerald-700 hover:shadow-lg active:scale-[0.98]">
                        Lihat Status Membership
                        <ArrowRight className="ml-2 size-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="flex items-center gap-4">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-100 to-orange-50 border border-orange-200/50 text-orange-600 shadow-inner">
                    <CreditCard className="size-6" />
                  </div>
                  <div>
                    <h4 className="text-lg font-black tracking-tight text-slate-900">
                      Pilih Metode Pembayaran
                    </h4>
                    <p className="mt-1 text-sm text-slate-500">
                      Pilih kanal pembayaran yang paling memudahkan Anda.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4">
                  {paymentMethods.map((method) => {
                    const Icon = method.icon;
                    const isActive = selectedMethod === method.id;

                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setSelectedMethod(method.id)}
                        className={cn(
                          "group relative flex items-center gap-5 rounded-[1.5rem] border p-5 text-left transition-all duration-300",
                          isActive
                            ? "border-orange-500 bg-orange-50/40 shadow-md shadow-orange-500/10 ring-1 ring-orange-500 scale-[1.01]"
                            : "border-slate-200/60 bg-white hover:-translate-y-1 hover:border-orange-300 hover:shadow-xl hover:shadow-orange-500/10",
                        )}
                      >
                        <div
                          className={cn(
                            "flex size-14 shrink-0 items-center justify-center rounded-[1.25rem] border transition-all duration-300",
                            isActive
                              ? "border-orange-200 bg-gradient-to-br from-white to-orange-50 text-orange-600 shadow-sm"
                              : "border-slate-100 bg-slate-50 text-slate-400 group-hover:border-orange-200 group-hover:bg-orange-50 group-hover:text-orange-500 group-hover:scale-110 group-hover:rotate-3",
                          )}
                        >
                          <Icon className="size-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <p
                              className={cn(
                                "text-base font-bold transition-colors",
                                isActive ? "text-orange-950" : "text-slate-900 group-hover:text-orange-900",
                              )}
                            >
                              {method.label}
                            </p>
                            {method.id === "qris" ? (
                              <span className="rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm animate-pulse">
                                Disarankan
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
                            {method.detail}
                            <span className="size-1 rounded-full bg-slate-300" />
                            <span className={cn(isActive ? "text-orange-600 font-semibold" : "text-slate-400")}>
                              {method.helper}
                            </span>
                          </p>
                        </div>
                        
                        <div className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300",
                          isActive 
                            ? "border-orange-500 bg-orange-500 text-white scale-110 shadow-sm shadow-orange-500/30" 
                            : "border-slate-200 bg-transparent text-transparent group-hover:border-orange-300"
                        )}>
                          <div className={cn("size-2.5 rounded-full bg-white transition-all duration-300", isActive ? "scale-100" : "scale-0")} />
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-5 pt-6 border-t border-slate-100/60 mt-8">
                  <Button
                    className="group relative h-16 w-full overflow-hidden rounded-[1.25rem] bg-[linear-gradient(135deg,#ea580c_0%,#dc2626_100%)] text-base font-bold text-white shadow-[0_12px_24px_-8px_rgba(234,88,12,0.5)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_16px_32px_-8px_rgba(234,88,12,0.6)] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
                    disabled={
                      confirmingPayment ||
                      (xenditPaymentFlow && (!canOpenCheckout || waitingForWebhook))
                    }
                    onClick={handlePaymentAction}
                  >
                    {confirmingPayment ? (
                      <>
                        <LoaderCircle className="mr-2 size-6 animate-spin" />
                        Menghubungkan ke Gateway...
                      </>
                    ) : waitingForWebhook ? (
                      <>
                        <LoaderCircle className="mr-2 size-6 animate-spin" />
                        Menunggu Verifikasi...
                      </>
                    ) : xenditPaymentFlow ? (
                      <div className="flex items-center justify-center gap-2">
                        Bayar Sekarang
                        <ExternalLink className="size-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </div>
                    ) : (
                      "Konfirmasi Pembayaran"
                    )}
                  </Button>

                  <Link href={statusPageHref} className="flex items-center justify-center gap-2 py-2 text-xs font-bold text-slate-400 hover:text-orange-600 transition-colors">
                    Lihat Status Transaksi Saat Ini
                    <ChevronRight className="size-4" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AuthShell>
  );
}
