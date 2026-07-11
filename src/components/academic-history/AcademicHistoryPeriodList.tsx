import { CalendarRange, Eye, GraduationCap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { AcademicHistorySubscription } from "./academic-history-types";

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return normalizeText(value) || "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function getMembershipStatusVariant(status: string | undefined) {
  const normalizedStatus = normalizeText(status).toLowerCase();

  if (normalizedStatus === "paid" || normalizedStatus === "active") {
    return "success";
  }

  if (normalizedStatus === "pending" || normalizedStatus === "expiring") {
    return "warning";
  }

  if (normalizedStatus === "failed" || normalizedStatus === "expired") {
    return "danger";
  }

  return "secondary";
}

function getMembershipStatusLabel(subscription: AcademicHistorySubscription) {
  return normalizeText(subscription.paymentStatus) || normalizeText(subscription.status) || "-";
}

export function AcademicHistoryPeriodList({
  subscriptions,
  selectedSubscriptionId,
  loadingSubscriptionId,
  onSelect,
}: {
  subscriptions: AcademicHistorySubscription[];
  selectedSubscriptionId?: string | null;
  loadingSubscriptionId?: string | null;
  onSelect: (subscriptionId: string) => void;
}) {
  if (subscriptions.length === 0) {
    return (
      <section className="rounded-[24px] border border-dashed border-orange-200 bg-orange-50/30 px-5 py-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-orange-100 bg-white text-orange-600">
          <CalendarRange className="h-5 w-5" />
        </div>
        <p className="mt-4 text-sm font-semibold text-slate-800">
          Belum ada histori akademik
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Periode akademik akan tampil setelah subscription siswa tercatat.
        </p>
      </section>
    );
  }

  return (
    <div className="grid gap-3">
      {subscriptions.map((subscription) => {
        const isSelected = selectedSubscriptionId === subscription.subscriptionId;
        const isLoading = loadingSubscriptionId === subscription.subscriptionId;
        const membershipStatus = getMembershipStatusLabel(subscription);

        return (
          <article
            key={subscription.subscriptionId}
            className={cn(
              "rounded-[22px] border bg-white p-4 shadow-sm transition",
              isSelected
                ? "border-orange-200 bg-orange-50/30"
                : "border-slate-100 hover:border-orange-100 hover:bg-orange-50/20",
            )}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="info">
                    {subscription.semester || "-"} {subscription.academicYear || ""}
                  </Badge>
                  <Badge variant={getMembershipStatusVariant(membershipStatus)}>
                    {membershipStatus}
                  </Badge>
                </div>
                <h3 className="mt-3 text-base font-semibold text-slate-900">
                  {subscription.program || "Program"} - {subscription.className || "Kelas"}
                </h3>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <GraduationCap className="h-3.5 w-3.5 text-orange-500" />
                    {subscription.packageName || subscription.subscriptionCode || "Membership"}
                  </span>
                  <span>
                    {formatDate(subscription.startDate)} - {formatDate(subscription.endDate)}
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant={isSelected ? "secondary" : "outline"}
                size="sm"
                onClick={() => onSelect(subscription.subscriptionId)}
                disabled={isLoading}
                className="shrink-0"
              >
                <Eye className="h-4 w-4" />
                {isLoading ? "Memuat..." : "Lihat Detail"}
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
