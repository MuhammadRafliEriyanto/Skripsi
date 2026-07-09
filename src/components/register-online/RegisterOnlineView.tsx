"use client";

import {
  Check,
  ChevronRight,
  Clock3,
  GraduationCap,
  Info,
  type LucideIcon,
  LoaderCircle,
  MapPin,
  Package,
  Phone,
  User,
} from "lucide-react";

import { AuthShell } from "@/components/auth/AuthShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MembershipRequestError,
  formatRupiah,
  getPackageByKey,
  membershipService,
  type OnlinePackageKey,
  type ProgramOptionValue,
  type RegisterBranchOption,
  type RegisterOnlinePayload,
  getPriceByClassAndPackage,
} from "@/lib/subscription";
import { useSubscriptionConfig } from "@/lib/use-subscription-config";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";

type RegisterOnlineViewProps = {
  initialPackageKey?: string;
};

function resolvePackageKey(packageKey?: string): OnlinePackageKey {
  return packageKey && packageKey !== "12-bulan" ? packageKey : "";
}

function normalizeRegisterPath(path?: string | null) {
  if (!path) {
    return "/register/status";
  }

  return path.replace(/^\/register-online(?=\/|$)/, "/register");
}

function InputError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-600">
      <Info className="size-3.5" />
      {message}
    </div>
  );
}

function FormSection({ 
  title, 
  icon: Icon, 
  children,
  className 
}: { 
  title: string; 
  icon: LucideIcon; 
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-5", className)}>
      <div className="flex items-center gap-3 pb-2 border-b border-slate-100/60">
        <div className="flex size-8 items-center justify-center rounded-xl bg-orange-50/80 text-orange-500 shadow-sm shadow-orange-100/50">
          <Icon className="size-4" />
        </div>
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">{title}</h3>
      </div>
      <div className="grid gap-5">
        {children}
      </div>
    </div>
  );
}

export default function RegisterOnlineView({ initialPackageKey }: RegisterOnlineViewProps) {
  const router = useRouter();
  const {
    config: subscriptionConfig,
    isLoading: isSubscriptionConfigLoading,
    error: subscriptionConfigError,
  } = useSubscriptionConfig();
  const resolvedInitialPackageKey = useMemo(
    () => resolvePackageKey(initialPackageKey),
    [initialPackageKey],
  );
  const packageOptions = subscriptionConfig.packages;
  const programOptions = subscriptionConfig.programs;
  const classOptionsByProgram = subscriptionConfig.classOptionsByProgram;
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [branchOptions, setBranchOptions] = useState<RegisterBranchOption[]>([]);
  const [branchOptionsLoading, setBranchOptionsLoading] = useState(true);
  const [branchOptionsError, setBranchOptionsError] = useState("");
  const [formValues, setFormValues] = useState<RegisterOnlinePayload>(() => ({
    nama: "",
    email: "",
    phone: "",
    branch: "",
    program: "",
    classLevel: "",
    packageKey: resolvedInitialPackageKey,
  }));

  const classOptions = useMemo(
    () => classOptionsByProgram[formValues.program] ?? [],
    [classOptionsByProgram, formValues.program],
  );
  
  const basePackage = getPackageByKey(formValues.packageKey, packageOptions);
  const dynamicAmount = getPriceByClassAndPackage(
    formValues.classLevel,
    formValues.packageKey,
    subscriptionConfig.classPricingMatrix,
    packageOptions,
  );
  const selectedPackage = { 
    durationMonth: basePackage?.durationMonth ?? 0,
    amount: dynamicAmount, 
    packageName: basePackage?.packageName ?? "Paket Belajar" 
  };

  useEffect(() => {
    if (!packageOptions.length || !programOptions.length) {
      return;
    }

    setFormValues((current) => {
      const nextProgram = programOptions.some((item) => item.value === current.program)
        ? current.program
        : programOptions[0]?.value ?? "";
      const nextClassOptions = classOptionsByProgram[nextProgram] ?? [];
      const nextClassLevel = nextClassOptions.includes(current.classLevel)
        ? current.classLevel
        : nextClassOptions[0] ?? "";
      const nextPackageKey = packageOptions.some(
        (item) => item.packageKey === current.packageKey,
      )
        ? current.packageKey
        : packageOptions.some((item) => item.packageKey === resolvedInitialPackageKey)
          ? resolvedInitialPackageKey
          : packageOptions[0]?.packageKey ?? "";

      return {
        ...current,
        program: nextProgram,
        classLevel: nextClassLevel,
        packageKey: nextPackageKey,
      };
    });
  }, [
    classOptionsByProgram,
    packageOptions,
    programOptions,
    resolvedInitialPackageKey,
  ]);

  useEffect(() => {
    let isMounted = true;

    async function loadBranchOptions() {
      try {
        setBranchOptionsLoading(true);
        setBranchOptionsError("");

        const response = await membershipService.getRegisterBranchOptions();
        const nextBranchOptions = Array.isArray(response.data?.branches)
          ? response.data.branches
          : [];

        if (!isMounted) {
          return;
        }

        setBranchOptions(nextBranchOptions);

        if (!nextBranchOptions.length) {
          setBranchOptionsError("Cabang aktif belum tersedia. Silakan hubungi admin.");
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setBranchOptions([]);
        setBranchOptionsError(
          error instanceof Error
            ? error.message
            : "Daftar cabang belum bisa dimuat saat ini.",
        );
      } finally {
        if (isMounted) {
          setBranchOptionsLoading(false);
        }
      }
    }

    void loadBranchOptions();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const phone = formValues.phone.trim();
    if (!phone.startsWith("08")) {
      setFieldErrors({ phone: "Nomor WhatsApp harus diawali dengan 08." });
      return;
    }

    if (phone.length > 14) {
      setFieldErrors({ phone: "Nomor WhatsApp maksimal 14 karakter." });
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setFieldErrors({});

    try {
      const response = await membershipService.register(formValues);
      const nextPath = response.data?.payment?.paymentId
        ? `/register/payment/${response.data.payment.paymentId}`
        : normalizeRegisterPath(response.data?.statusPagePath);

      router.push(nextPath);
    } catch (error) {
      if (error instanceof MembershipRequestError) {
        setErrorMessage(error.message);

        if (error.errors && typeof error.errors === "object" && !Array.isArray(error.errors)) {
          setFieldErrors(error.errors as Record<string, string>);
        }
      } else {
        setErrorMessage("Pendaftaran online belum berhasil diproses. Silakan coba lagi.");
      }
    } finally {
      setLoading(false);
    }
  }

  function updateProgram(programValue: ProgramOptionValue) {
    const nextClassOptions = classOptionsByProgram[programValue] ?? [];

    setFormValues((current) => ({
      ...current,
      program: programValue,
      classLevel: nextClassOptions.some((item) => item === current.classLevel)
        ? current.classLevel
        : nextClassOptions[0],
    }));
  }

  function updatePackage(packageKey: OnlinePackageKey) {
    setFormValues((current) => ({
      ...current,
      packageKey,
    }));
  }

  const isSubmitDisabled =
    loading ||
    isSubscriptionConfigLoading ||
    Boolean(subscriptionConfigError) ||
    !packageOptions.length ||
    !programOptions.length ||
    !classOptions.length ||
    branchOptionsLoading ||
    Boolean(branchOptionsError) ||
    !branchOptions.length;

  return (
    <AuthShell
      variant="split"
      splitContentAlignment="start"
      hideSplitVisualOnMobile
      hideSplitTopBadge
      allowDesktopScroll
      title="Registrasi Siswa Baru"
      description="Bergabung dengan membership kami untuk akses belajar yang terarah dan profesional."
      footer={
        <div className="text-sm text-slate-500 text-center space-y-4">
          <p>
            Sudah punya akun siswa?{" "}
            <Link
              href="/login"
              className="font-semibold text-orange-600 transition hover:text-orange-700 underline-offset-4 hover:underline"
            >
              Masuk di sini
            </Link>
          </p>
          <div className="flex items-center justify-center gap-4 pt-4 border-t border-slate-100">
            <Link
              href="/"
              className="text-xs font-medium text-slate-400 transition hover:text-slate-600"
            >
              Beranda
            </Link>
            <Link
              href="#"
              className="text-xs font-medium text-slate-400 transition hover:text-slate-600"
            >
              Bantuan
            </Link>
          </div>
        </div>
      }
    >
      <div className="space-y-8 pb-10">
        {/* Billing Summary Mini */}
        <div className="group relative overflow-hidden rounded-3xl border border-orange-100/50 bg-gradient-to-br from-orange-50/40 via-white to-white p-6 shadow-[0_8px_30px_-4px_rgba(249,115,22,0.04)] transition-all duration-500 hover:shadow-[0_12px_40px_-4px_rgba(249,115,22,0.08)] hover:-translate-y-0.5">
          <div className="absolute right-0 top-0 -mr-4 -mt-4 size-32 rounded-full bg-orange-100/40 blur-3xl transition-transform duration-700 group-hover:scale-110" />
          <div className="relative flex items-center justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Package className="size-4 text-orange-500" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-orange-500/80">Paket Terpilih</p>
              </div>
              <h3 className="text-lg font-bold text-slate-800">{selectedPackage.packageName}</h3>
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <Clock3 className="size-3.5" />
                Akses selama {selectedPackage.durationMonth} bulan
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-slate-800 tracking-tight">{formatRupiah(selectedPackage.amount)}</p>
              <Badge variant="secondary" className="mt-1.5 bg-orange-50/80 text-orange-600 text-[10px] font-bold tracking-widest border border-orange-100/50">
                PROMO AKTIF
              </Badge>
            </div>
          </div>
        </div>

        <form className="space-y-10" onSubmit={handleSubmit}>
          {/* Section 1: Data Diri */}
          <FormSection title="Informasi Siswa" icon={User}>
            <div className="space-y-2">
              <label htmlFor="nama" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Nama Lengkap
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-slate-400">
                  <User className="size-4" />
                </div>
                <Input
                  id="nama"
                  value={formValues.nama}
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      nama: event.target.value,
                    }))
                  }
                  placeholder="Nama lengkap siswa"
                  className="h-12 rounded-2xl border-slate-200/60 bg-slate-50/50 pl-11 transition-all duration-300 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-500/10 hover:border-slate-300"
                  autoComplete="name"
                  required
                />
              </div>
              <InputError message={fieldErrors.nama} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="email" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  value={formValues.email}
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  placeholder="contoh@email.com"
                  className="h-12 rounded-2xl border-slate-200/60 bg-slate-50/50 px-4 transition-all duration-300 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-500/10 hover:border-slate-300"
                  autoComplete="email"
                  required
                />
                <InputError message={fieldErrors.email} />
              </div>

              <div className="space-y-2">
                <label htmlFor="phone" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  No. WhatsApp
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-slate-400">
                    <Phone className="size-4" />
                  </div>
                  <Input
                    id="phone"
                    value={formValues.phone}
                    onChange={(event) =>
                      setFormValues((current) => ({
                        ...current,
                        phone: event.target.value,
                      }))
                    }
                    placeholder="08xxxxxxxxxx"
                    className="h-12 rounded-2xl border-slate-200/60 bg-slate-50/50 pl-11 transition-all duration-300 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-500/10 hover:border-slate-300"
                    autoComplete="tel"
                    required
                  />
                </div>
                <InputError message={fieldErrors.phone} />
              </div>
            </div>
          </FormSection>

          {/* Section 2: Akademik */}
          <FormSection title="Program & Cabang" icon={GraduationCap}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="program" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Program Belajar
                </label>
                <Select value={formValues.program} onValueChange={updateProgram}>
                  <SelectTrigger
                    id="program"
                    className="h-12 rounded-2xl border-slate-200/60 bg-slate-50/50 px-4 transition-all duration-300 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-500/10 hover:border-slate-300"
                  >
                    <SelectValue placeholder="Pilih program" />
                  </SelectTrigger>
                  <SelectContent>
                    {programOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <InputError message={fieldErrors.program} />
              </div>

              <div className="space-y-2">
                <label htmlFor="classLevel" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Tingkat Kelas
                </label>
                <Select
                  value={formValues.classLevel}
                  onValueChange={(value) =>
                    setFormValues((current) => ({
                      ...current,
                      classLevel: value,
                    }))
                  }
                >
                  <SelectTrigger
                    id="classLevel"
                    className="h-12 rounded-2xl border-slate-200/60 bg-slate-50/50 px-4 transition-all duration-300 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-500/10 hover:border-slate-300"
                  >
                    <SelectValue placeholder="Pilih kelas" />
                  </SelectTrigger>
                  <SelectContent>
                    {classOptions.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <InputError message={fieldErrors.classLevel} />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="branch" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Cabang Pilihan
              </label>
              <Select
                value={formValues.branch}
                onValueChange={(value) =>
                  setFormValues((current) => ({
                    ...current,
                    branch: value,
                  }))
                }
                disabled={branchOptionsLoading || branchOptions.length === 0}
              >
                <SelectTrigger
                  id="branch"
                  className="h-12 rounded-xl border-slate-200 bg-white px-4 focus:ring-4 focus:ring-orange-500/10"
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="size-4 text-slate-400" />
                    <SelectValue
                      placeholder={
                        branchOptionsLoading
                          ? "Memuat daftar cabang..."
                          : "Pilih lokasi cabang"
                      }
                    />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {branchOptions.map((branch) => (
                    <SelectItem key={branch.id} value={branch.name}>
                      {branch.shortAddress
                        ? `${branch.name} - ${branch.shortAddress}`
                        : branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <InputError message={fieldErrors.branch || branchOptionsError} />
            </div>
          </FormSection>

          {/* Section 3: Paket */}
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                  <Package className="size-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Pilih Paket Belajar</h3>
              </div>
              <Badge variant="outline" className="border-orange-200 text-orange-600 text-[10px] font-bold">
                RECOMMENDED
              </Badge>
            </div>

            <div className="grid gap-3">
              {packageOptions.map((item) => {
                const isActive = formValues.packageKey === item.packageKey;
                const displayAmount = getPriceByClassAndPackage(
                  formValues.classLevel,
                  item.packageKey,
                  subscriptionConfig.classPricingMatrix,
                  packageOptions,
                );
                const displayName = item.packageName;

                return (
                  <button
                    key={item.packageKey}
                    type="button"
                    onClick={() => updatePackage(item.packageKey)}
                    className={cn(
                      "group relative flex items-center gap-5 rounded-3xl border p-5 text-left transition-all duration-500",
                      isActive
                        ? "border-orange-400 bg-orange-50/40 shadow-[0_8px_30px_-4px_rgba(249,115,22,0.12)] ring-1 ring-orange-400/30"
                        : "border-slate-200/60 bg-white hover:border-orange-200 hover:bg-orange-50/10 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_25px_-4px_rgba(0,0,0,0.04)] hover:-translate-y-0.5",
                    )}
                  >
                    <div className={cn(
                      "flex size-12 shrink-0 items-center justify-center rounded-2xl border transition-all duration-500",
                      isActive ? "bg-orange-500 border-orange-400 text-white shadow-md shadow-orange-200/50" : "bg-slate-50 border-slate-100 text-slate-400 group-hover:bg-orange-100/50 group-hover:border-orange-200 group-hover:text-orange-500"
                    )}>
                      <Check className={cn("size-6 transition-all duration-500", isActive ? "scale-100 opacity-100" : "scale-50 opacity-0")} />
                      {!isActive && <Package className="size-5 absolute transition-all duration-500 group-hover:scale-110" />}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          "text-sm font-bold transition-colors duration-300",
                          isActive ? "text-orange-900" : "text-slate-700 group-hover:text-slate-900"
                        )}>
                          {displayName}
                        </span>
                        <span className={cn(
                          "text-base font-black transition-colors duration-300",
                          isActive ? "text-orange-600" : "text-slate-800"
                        )}>
                          {formatRupiah(displayAmount)}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-3">
                        <p className="text-xs text-slate-500 truncate max-w-[200px]">{item.highlight}</p>
                        <div className="h-1 w-1 rounded-full bg-slate-200" />
                        <p className="text-[10px] font-bold text-orange-500/80 uppercase tracking-widest">{item.durationMonth} Bulan</p>
                      </div>
                    </div>

                    {isActive && (
                      <div className="absolute -right-2 -top-2">
                        <span className="flex size-6 items-center justify-center rounded-full bg-orange-500 text-white shadow-md ring-4 ring-white animate-in zoom-in duration-300">
                          <Check className="size-3.5" />
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <InputError
              message={
                fieldErrors.packageKey ||
                subscriptionConfigError ||
                (!isSubscriptionConfigLoading && !packageOptions.length
                  ? "Paket membership belum tersedia dari server."
                  : "")
              }
            />
            
            {/* Rincian Harga Card */}
            <div className="mt-4 rounded-3xl border border-slate-200/60 bg-slate-50/50 p-6 shadow-inner">
              <div className="mb-4 flex items-center gap-2">
                <Info className="size-4 text-slate-400" />
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Rincian Harga {packageOptions.find((p) => p.packageKey === formValues.packageKey)?.packageName || "Paket Belajar"}
                </h4>
              </div>
              <ul className="grid gap-2.5 sm:grid-cols-2">
                {[
                  { label: "Kelas 2–3", cls: "Kelas 2" },
                  { label: "Kelas 4–5", cls: "Kelas 4" },
                  { label: "Kelas 6", cls: "Kelas 6" },
                  { label: "Kelas 7–8", cls: "Kelas 7" },
                  { label: "Kelas 9", cls: "Kelas 9" },
                  { label: "Kelas 10–11", cls: "Kelas 10" },
                  { label: "Kelas 12", cls: "Kelas 12" },
                ].map((tier, idx) => {
                  const currentPrice = getPriceByClassAndPackage(
                    tier.cls,
                    formValues.packageKey,
                    subscriptionConfig.classPricingMatrix,
                    packageOptions,
                  );
                  return (
                    <li key={idx} className="flex items-center justify-between text-sm rounded-xl bg-white px-4 py-2 border border-slate-100 shadow-sm">
                      <span className="font-medium text-slate-500">{tier.label}</span>
                      <span className="font-bold text-slate-700">{formatRupiah(currentPrice)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          {errorMessage ? (
            <div className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50/50 p-4 text-sm leading-6 text-red-700">
              <Info className="mt-1 size-4 shrink-0" />
              <p>{errorMessage}</p>
            </div>
          ) : null}

          <div className="pt-2">
            <Button
              type="submit"
              className="group h-14 w-full rounded-2xl bg-orange-500 text-base font-bold text-white shadow-[0_8px_20px_-4px_rgba(249,115,22,0.3)] transition-all duration-300 hover:bg-orange-600 hover:shadow-[0_12px_25px_-4px_rgba(249,115,22,0.4)] hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 disabled:hover:translate-y-0"
              disabled={isSubmitDisabled}
            >
              {loading ? (
                <>
                  <LoaderCircle className="mr-2 size-5 animate-spin" />
                  Memproses Pendaftaran...
                </>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  Daftar & Buat Tagihan
                  <ChevronRight className="size-5 transition-transform duration-300 group-hover:translate-x-1" />
                </div>
              )}
            </Button>
            <p className="mt-4 text-center text-[10px] text-slate-400 leading-relaxed px-4">
              Dengan mengeklik tombol di atas, Anda menyetujui <span className="text-slate-600 font-medium cursor-pointer hover:underline">Syarat & Ketentuan</span> serta <span className="text-slate-600 font-medium cursor-pointer hover:underline">Kebijakan Privasi</span> Bina Cendekia.
            </p>
          </div>
        </form>
      </div>
    </AuthShell>
  );
}
