"use client";

import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Clock3,
  GraduationCap,
  Info,
  LoaderCircle,
  MailCheck,
  Package,
  ShieldAlert,
  UserCircle,
} from "lucide-react";

import { AuthShell } from "@/components/auth/AuthShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MembershipRequestError,
  formatRupiah,
  membershipService,
  type MembershipAccessStatus,
  type MembershipPayment,
  type MembershipStatusResponse,
  type MembershipStudent,
  type MembershipSubscription,
  type PaymentStatusResponse,
} from "@/lib/subscription";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import type { LucideIcon } from "lucide-react";

type RegisterOnlineStatusViewProps = {
  paymentId?: string | null;
  access?: string | null;
};

type StatusViewState = {
  student: MembershipStudent | null;
  subscription: MembershipSubscription | null;
  payment: MembershipPayment | null;
  accessStatus: MembershipAccessStatus;
  daysRemaining?: number | null;
};

type StatusMeta = {
  chip: string;
  icon: LucideIcon;
  chipClassName: string;
  iconClassName: string;
};

type PaymentMeta = {
  label: string;
  helper: string;
  chipClassName: string;
};

type ChecklistItem = {
  label: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  isComplete?: boolean;
};

function getAccessStatusMeta(accessStatus: MembershipAccessStatus): StatusMeta {
  switch (accessStatus) {
    case "active":
      return {
        chip: "Aktif",
        icon: BadgeCheck,
        chipClassName: "bg-emerald-100 text-emerald-700 border-emerald-200",
        iconClassName: "bg-emerald-500 text-white shadow-emerald-100",
      };
    case "expired":
      return {
        chip: "Kedaluwarsa",
        icon: ShieldAlert,
        chipClassName: "bg-slate-100 text-slate-700 border-slate-200",
        iconClassName: "bg-slate-400 text-white shadow-slate-100",
      };
    case "not_registered":
      return {
        chip: "Belum Ada",
        icon: AlertCircle,
        chipClassName: "bg-slate-100 text-slate-700 border-slate-200",
        iconClassName: "bg-slate-400 text-white shadow-slate-100",
      };
    default:
      return {
        chip: "Pending",
        icon: Clock3,
        chipClassName: "bg-orange-100 text-orange-700 border-orange-200",
        iconClassName: "bg-orange-500 text-white shadow-orange-100",
      };
  }
}

function getPaymentStatusMeta(
  status: MembershipPayment["status"] | undefined,
  xenditSessionStatus?: string | null,
): PaymentMeta {
  if (status === "paid") {
    return {
      label: "Sudah Dibayar",
      helper: "Tagihan tercatat & membership aktif.",
      chipClassName: "bg-emerald-50 text-emerald-700 border-emerald-100",
    };
  }

  if (status === "failed" || status === "expired") {
    return {
      label: "Gagal / Kedaluwarsa",
      helper: "Silakan buat tagihan baru.",
      chipClassName: "bg-red-50 text-red-700 border-red-100",
    };
  }

  if (status === "pending" && xenditSessionStatus === "COMPLETED") {
    return {
      label: "Menunggu Sinkronisasi",
      helper: "Pembayaran gateway selesai, sistem sedang menunggu webhook.",
      chipClassName: "bg-sky-50 text-sky-700 border-sky-100",
    };
  }

  return {
    label: "Menunggu Pembayaran",
    helper: "Membership aktif setelah pembayaran.",
    chipClassName: "bg-orange-50 text-orange-700 border-orange-100",
  };
}

function getStatusCopy(accessStatus: MembershipAccessStatus) {
  switch (accessStatus) {
    case "active":
      return {
        title: "Membership Aktif",
        description:
          "Selamat! Paket belajar Anda sudah siap digunakan sepenuhnya.",
      };
    case "expired":
      return {
        title: "Masa Aktif Berakhir",
        description:
          "Paket belajar Anda sudah selesai. Silakan perbarui paket Anda.",
      };
    default:
      return {
        title: "Status Membership",
        description:
          "Pantau progres aktivasi akun belajar Anda secara real-time di sini.",
      };
  }
}

function mapPaymentResponse(data: PaymentStatusResponse["data"] | undefined): StatusViewState | null {
  if (!data) {
    return null;
  }

  return {
    student: data.student,
    subscription: data.subscription,
    payment: data.payment,
    accessStatus: data.accessStatus,
  };
}

function mapMembershipResponse(
  data: MembershipStatusResponse["data"] | undefined,
): StatusViewState | null {
  if (!data) {
    return null;
  }

  return {
    student: data.student,
    subscription: data.subscription,
    payment: data.payment,
    accessStatus: data.accessStatus,
    daysRemaining: data.daysRemaining,
  };
}

function StatusChip({ label, className }: { label: string; className: string }) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        className,
      )}
    >
      {label}
    </div>
  );
}

export default function RegisterOnlineStatusView({
  paymentId,
  access,
}: RegisterOnlineStatusViewProps) {
  const [loading, setLoading] = useState(true);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusData, setStatusData] = useState<StatusViewState | null>(null);

  const emailVerified = statusData?.student?.isEmailVerified ?? false;
  const paymentStatus = statusData?.payment?.status;
  const xenditSessionStatus = statusData?.payment?.xenditSessionStatus;

  let accessStatus =
    statusData?.accessStatus ??
    (access === "active" ||
    access === "pending" ||
    access === "expired" ||
    access === "not_registered"
      ? access
      : "pending");

  if (paymentStatus === "paid" && emailVerified) {
    accessStatus = "active";
  }

  const paymentIsPending = paymentStatus === "pending";
  const xenditPaymentFlow =
    statusData?.payment?.provider === "xendit" ||
    Boolean(statusData?.payment?.xenditPaymentSessionId);
  const waitingForWebhook =
    statusData?.payment?.status === "pending" &&
    statusData?.payment?.xenditSessionStatus === "COMPLETED";
  const checkoutUrl = statusData?.payment?.checkoutUrl?.trim() ?? "";

  const statusCopy = useMemo(() => getStatusCopy(accessStatus), [accessStatus]);
  const accessMeta = useMemo(() => getAccessStatusMeta(accessStatus), [accessStatus]);
  const paymentMeta = useMemo(
    () => getPaymentStatusMeta(paymentStatus, xenditSessionStatus),
    [paymentStatus, xenditSessionStatus],
  );

  const statusChecklist = useMemo<ChecklistItem[]>(
    () => [
      {
        label: "Pembayaran",
        value: paymentMeta.label,
        helper: paymentMeta.helper,
        icon: paymentStatus === "paid" ? BadgeCheck : Clock3,
        isComplete: paymentStatus === "paid",
      },
      {
        label: "Verifikasi Email",
        value: emailVerified ? "Selesai" : "Pending",
        helper: emailVerified
          ? "Email sudah diverifikasi."
          : "Cek kotak masuk email Anda.",
        icon: emailVerified ? MailCheck : Clock3,
        isComplete: emailVerified,
      },
      {
        label: "Akses Dashboard",
        value: accessStatus === "active" ? "Aktif" : "Menunggu",
        helper: accessStatus === "active" ? "Siap digunakan belajar." : "Aktif setelah bayar.",
        icon: GraduationCap,
        isComplete: accessStatus === "active",
      },
    ],
    [accessStatus, emailVerified, paymentMeta.helper, paymentMeta.label, paymentStatus],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadStatus() {
      setLoading(true);
      setErrorMessage("");

      try {
        if (paymentId) {
          const response = await membershipService.getPaymentStatus(paymentId);

          if (isMounted) {
            setStatusData(mapPaymentResponse(response.data));
          }
        } else {
          const response = await membershipService.getMySubscription();

          if (isMounted) {
            setStatusData(mapMembershipResponse(response.data));
          }
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof MembershipRequestError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("Status membership belum dapat dimuat. Silakan coba lagi.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadStatus();

    return () => {
      isMounted = false;
    };
  }, [paymentId]);

  useEffect(() => {
    if (!paymentId || !statusData?.payment || statusData.payment.status === "paid") {
      return;
    }

    let isMounted = true;
    const intervalId = window.setInterval(async () => {
      try {
        const response = await membershipService.getPaymentStatus(paymentId);

        if (!isMounted) {
          return;
        }

        setStatusData(mapPaymentResponse(response.data));
      } catch {
        // Let the next polling cycle retry without replacing the current UI state.
      }
    }, 5000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [paymentId, statusData]);

  async function handleConfirmPayment() {
    if (!paymentId) {
      return;
    }

    setConfirmingPayment(true);
    setErrorMessage("");

    try {
      if (xenditPaymentFlow) {
        if (!checkoutUrl) {
          throw new Error("Checkout Xendit belum tersedia untuk pembayaran ini.");
        }

        const checkoutWindow = window.open(checkoutUrl, "_blank", "noopener,noreferrer");

        if (!checkoutWindow) {
          window.location.assign(checkoutUrl);
        }

        return;
      }

      const response = await membershipService.confirmPayment(paymentId);
      setStatusData(mapPaymentResponse(response.data));
    } catch (error) {
      if (error instanceof MembershipRequestError) {
        setErrorMessage(error.message);
      } else if (error instanceof Error && error.message) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Konfirmasi pembayaran belum berhasil diproses.");
      }
    } finally {
      setConfirmingPayment(false);
    }
  }

  const AccessIcon = accessMeta.icon;
  const summaryDuration =
    typeof statusData?.daysRemaining === "number"
      ? `${statusData.daysRemaining} hari tersisa`
      : statusData?.subscription?.durationMonth 
        ? `${statusData.subscription.durationMonth} bulan`
        : "-";

  return (
    <AuthShell
      variant="split"
      splitContentAlignment="start"
      splitContentClassName="pt-8 lg:pt-10"
      hideSplitVisualOnMobile
      hideSplitTopBadge
      allowDesktopScroll
      title={statusCopy.title}
      description={statusCopy.description}
      footer={
        <div className="flex flex-col gap-6 text-center pt-2">
          <div className="flex items-center justify-center gap-6 border-t border-slate-100 pt-6">
            <Link href="/" className="text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors">Beranda</Link>
            <Link href="/register" className="text-xs font-medium text-slate-400 hover:text-orange-600 transition-colors">Pilih Paket</Link>
          </div>
        </div>
      }
    >
      <div className="space-y-8">
        {loading ? (
          <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 text-center">
            <div className="relative">
              <div className="absolute inset-0 size-12 animate-ping rounded-full bg-orange-100 opacity-75" />
              <LoaderCircle className="relative size-12 animate-spin text-orange-500" />
            </div>
            <p className="text-sm font-medium text-slate-500 tracking-tight">Sinkronisasi status...</p>
          </div>
        ) : (
          <div className="space-y-8 pb-10">
            {/* Membership Premium Card */}
            <div className="group relative overflow-hidden rounded-3xl border border-slate-200/60 bg-white p-7 shadow-[0_8px_30px_-4px_rgba(0,0,0,0.03)] ring-1 ring-slate-100/50 transition-all duration-500 hover:shadow-[0_12px_40px_-4px_rgba(0,0,0,0.05)]">
              <div className="absolute right-0 top-0 -mr-6 -mt-6 size-32 rounded-full bg-slate-50 blur-3xl group-hover:bg-orange-50/60 transition-colors duration-700" />
              
              <div className="relative space-y-7">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="size-4 text-slate-400" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Paket Saya</span>
                  </div>
                  <StatusChip label={accessMeta.chip} className={accessMeta.chipClassName} />
                </div>

                <div className="flex items-center gap-4">
                  <div className={cn(
                    "flex size-14 shrink-0 items-center justify-center rounded-2xl shadow-sm ring-4 ring-white transition-transform group-hover:scale-110 duration-300",
                    accessMeta.iconClassName
                  )}>
                    <AccessIcon className="size-7" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-black text-slate-900 truncate">
                      {statusData?.subscription?.packageName ?? statusData?.payment?.packageName ?? "-"}
                    </h3>
                    <p className="text-xs font-medium text-slate-500 mt-0.5">{summaryDuration} aktif</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-orange-600">
                      {statusData?.payment ? formatRupiah(statusData.payment.amount) : "-"}
                    </p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-1">{paymentStatus ?? "pending"}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Checklist Step-by-step */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-xl bg-orange-50/80 text-orange-500 shadow-sm shadow-orange-100/50">
                  <BadgeCheck className="size-4" />
                </div>
                <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Progres Aktivasi</h4>
              </div>

              <div className="grid gap-3">
                {statusChecklist.map((item, idx) => {
                  const ItemIcon = item.icon;
                  return (
                    <div
                      key={item.label}
                      className={cn(
                        "group relative flex items-start gap-5 rounded-3xl border p-5 transition-all duration-500",
                        item.isComplete 
                          ? "bg-emerald-50/30 border-emerald-200/50 shadow-[0_8px_25px_-4px_rgba(16,185,129,0.06)]" 
                          : "bg-white border-slate-200/60 hover:border-orange-200/80 hover:bg-orange-50/10 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_20px_-4px_rgba(0,0,0,0.04)]"
                      )}
                    >
                      <div className={cn(
                        "flex size-12 shrink-0 items-center justify-center rounded-2xl border transition-all duration-500",
                        item.isComplete 
                          ? "bg-emerald-500 border-emerald-400 text-white shadow-md shadow-emerald-200/50 scale-105" 
                          : "bg-slate-50 border-slate-100 text-slate-400 group-hover:border-orange-200 group-hover:bg-orange-100/50 group-hover:text-orange-500"
                      )}>
                        <ItemIcon className="size-5" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-bold text-slate-900">{item.label}</p>
                          <Badge variant={item.isComplete ? "success" : "secondary"} className="text-[9px] h-4 font-bold uppercase tracking-tight">
                            {item.value}
                          </Badge>
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed text-slate-500 font-medium">{item.helper}</p>
                      </div>

                      {idx < statusChecklist.length - 1 && (
                        <div className={cn(
                          "absolute left-[2.6rem] top-[4.25rem] h-4 w-0.5 rounded-full transition-colors duration-500",
                          item.isComplete ? "bg-emerald-300/50" : "bg-slate-200/60"
                        )} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Detailed Student Info Section */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-xl bg-orange-50/80 text-orange-500 shadow-sm shadow-orange-100/50">
                  <UserCircle className="size-4" />
                </div>
                <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Informasi Siswa</h4>
              </div>

              <div className="rounded-3xl border border-slate-200/60 bg-slate-50/50 p-6 grid gap-6 sm:grid-cols-2 shadow-inner">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Nama Lengkap</p>
                  <p className="text-sm font-bold text-slate-900">{statusData?.student?.name ?? "-"}</p>
                </div>
                <div className="space-y-1 sm:text-right">
                  <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Email</p>
                  <p className="text-sm font-bold text-slate-900">{statusData?.student?.email ?? "-"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Akademik</p>
                  <p className="text-sm font-bold text-slate-900">{statusData?.student?.program} • {statusData?.student?.className}</p>
                </div>
                <div className="space-y-1 sm:text-right">
                  <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Cabang</p>
                  <p className="text-sm font-bold text-slate-900">{statusData?.student?.branch ?? "-"}</p>
                </div>
              </div>
            </div>

            {/* Primary Action Panel */}
            <div className="space-y-4 pt-4">
              {paymentId && paymentIsPending && (
                <Button
                  className="group h-14 w-full rounded-2xl bg-orange-500 text-base font-bold text-white shadow-[0_8px_20px_-4px_rgba(249,115,22,0.3)] transition-all duration-300 hover:bg-orange-600 hover:shadow-[0_12px_25px_-4px_rgba(249,115,22,0.4)] hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 disabled:hover:translate-y-0"
                  disabled={
                    confirmingPayment ||
                    (xenditPaymentFlow && (!checkoutUrl || waitingForWebhook))
                  }
                  onClick={handleConfirmPayment}
                >
                  {confirmingPayment ? (
                    <>
                      <LoaderCircle className="mr-2 size-5 animate-spin" />
                      {xenditPaymentFlow ? "Membuka Checkout..." : "Memproses..."}
                    </>
                  ) : waitingForWebhook ? (
                    <>
                      <LoaderCircle className="mr-2 size-5 animate-spin" />
                      Menunggu Webhook...
                    </>
                  ) : xenditPaymentFlow ? (
                    <div className="flex items-center justify-center gap-2">
                      Lanjut ke Pembayaran
                      <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
                    </div>
                  ) : (
                    "Konfirmasi Pembayaran (Simulasi)"
                  )}
                </Button>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <Link href={accessStatus === "active" ? "/dashboard-siswa" : "/login"}>
                  <Button variant="outline" className="h-12 w-full rounded-xl border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all hover:border-orange-200 hover:text-orange-600">
                    Masuk ke Dashboard
                  </Button>
                </Link>
                <Link href="/">
                  <Button variant="ghost" className="h-12 w-full rounded-xl text-slate-400 font-bold hover:text-slate-600 transition-all">
                    Kembali ke Beranda
                  </Button>
                </Link>
              </div>
            </div>

            {errorMessage ? (
              <div className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50/50 p-4 text-sm leading-6 text-red-700">
                <Info className="mt-1 size-4 shrink-0" />
                <p>{errorMessage}</p>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </AuthShell>
  );
}
