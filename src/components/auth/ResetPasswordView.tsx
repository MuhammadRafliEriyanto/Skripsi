"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
} from "lucide-react";

import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthRequestError, authService } from "@/lib/auth";

type ResetPasswordViewProps = {
  email: string | null;
  code: string | null;
  source: string | null;
};

type PasswordVisibilityState = {
  newPassword: boolean;
  confirmNewPassword: boolean;
};

function InputError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <p className="mt-2 text-sm font-medium text-red-600" role="alert">
      {message}
    </p>
  );
}

export function ResetPasswordView({
  email,
  code,
  source,
}: ResetPasswordViewProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [passwordVisibility, setPasswordVisibility] =
    useState<PasswordVisibilityState>({
      newPassword: false,
      confirmNewPassword: false,
    });
  const [formValues, setFormValues] = useState({
    email: email ?? "",
    code: code ?? "",
    newPassword: "",
    confirmNewPassword: "",
  });

  function clearFieldError(fieldName: string) {
    setFieldErrors((current) => {
      if (!current[fieldName]) {
        return current;
      }

      const nextErrors = { ...current };
      delete nextErrors[fieldName];
      return nextErrors;
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    setFieldErrors({});

    const normalizedEmail = formValues.email.trim();
    const normalizedCode = formValues.code.trim();
    const nextFieldErrors: Record<string, string> = {};

    if (!normalizedEmail) {
      nextFieldErrors.email = "Email wajib diisi.";
    }

    if (!normalizedCode) {
      nextFieldErrors.code = "Kode reset wajib diisi.";
    } else if (!/^\d{6}$/.test(normalizedCode)) {
      nextFieldErrors.code = "Kode reset harus terdiri dari 6 digit angka.";
    }

    if (!formValues.newPassword) {
      nextFieldErrors.newPassword = "Password baru wajib diisi.";
    } else if (formValues.newPassword.length < 8) {
      nextFieldErrors.newPassword = "Password baru minimal 8 karakter.";
    }

    if (!formValues.confirmNewPassword) {
      nextFieldErrors.confirmNewPassword =
        "Konfirmasi password baru wajib diisi.";
    } else if (formValues.newPassword !== formValues.confirmNewPassword) {
      nextFieldErrors.confirmNewPassword =
        "Konfirmasi password baru tidak cocok.";
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setErrorMessage("Lengkapi data reset password terlebih dahulu.");
      setLoading(false);
      return;
    }

    try {
      const response = await authService.resetPassword({
        email: normalizedEmail,
        code: normalizedCode,
        newPassword: formValues.newPassword,
        confirmNewPassword: formValues.confirmNewPassword,
      });

      setSuccessMessage(
        (response.message ||
          "Password berhasil direset. Silakan login dengan password baru Anda.") +
          " Mengalihkan ke halaman login...",
      );
      setFormValues((current) => ({
        ...current,
        code: "",
        newPassword: "",
        confirmNewPassword: "",
      }));

      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (error) {
      if (
        error instanceof AuthRequestError &&
        error.errors &&
        typeof error.errors === "object" &&
        !Array.isArray(error.errors)
      ) {
        setFieldErrors(error.errors as Record<string, string>);
      }

      setErrorMessage(
        error instanceof AuthRequestError
          ? error.message
          : "Reset password gagal diproses.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      variant="split"
      splitContentAlignment="start"
      splitContentClassName="pt-4 lg:pt-14 xl:pt-16"
      splitInnerClassName="max-w-[430px]"
      hideSplitVisualOnMobile
      hideSplitTopBadge
      title="Reset Password"
      description="Enter the 6-digit code sent to your email and set your new password."
      footer={
        <div className="flex flex-col gap-4">
          <div className="text-sm text-slate-500 text-center">
            Remember your password?{" "}
            <Link
              href="/login"
              className="font-semibold text-orange-600 transition hover:text-orange-700 underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </div>
          {source === "dashboard-admin" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full rounded-lg border-slate-200"
              onClick={() => {
                startTransition(() => {
                  router.push("/dashboard-admin");
                });
              }}
            >
              Back to admin dashboard
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-6">
        {successMessage ? (
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-4">
            <div className="flex gap-3">
              <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">Success</p>
                <p className="mt-1 text-sm text-emerald-700">{successMessage}</p>
              </div>
            </div>
          </div>
        ) : null}

        {errorMessage && !successMessage ? (
          <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-slate-700">
                Email address
              </label>
              <Input
                id="email"
                type="email"
                value={formValues.email}
                onChange={(event) => {
                  setErrorMessage(null);
                  clearFieldError("email");
                  setFormValues((current) => ({
                    ...current,
                    email: event.target.value,
                  }));
                }}
                placeholder="name@example.com"
                className="h-11 rounded-lg border-slate-200 bg-white px-4 transition-all focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
                autoComplete="email"
                required
                disabled={loading}
              />
              <InputError message={fieldErrors.email} />
            </div>

            <div className="space-y-2">
              <label htmlFor="code" className="text-sm font-medium text-slate-700">
                Reset Code
              </label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={formValues.code}
                onChange={(event) => {
                  const digitsOnly = event.target.value.replace(/\D/g, "").slice(0, 6);
                  setErrorMessage(null);
                  clearFieldError("code");
                  setFormValues((current) => ({
                    ...current,
                    code: digitsOnly,
                  }));
                }}
                placeholder="6-digit code"
                className="h-11 rounded-lg border-slate-200 bg-white px-4 tracking-[0.2em] transition-all focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
                required
                disabled={loading}
              />
              <InputError message={fieldErrors.code} />
            </div>

            <div className="space-y-2">
              <label htmlFor="newPassword" className="text-sm font-medium text-slate-700">
                New Password
              </label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={passwordVisibility.newPassword ? "text" : "password"}
                  value={formValues.newPassword}
                  onChange={(event) => {
                    setErrorMessage(null);
                    clearFieldError("newPassword");
                    setFormValues((current) => ({
                      ...current,
                      newPassword: event.target.value,
                    }));
                  }}
                  placeholder="At least 8 characters"
                  className="h-11 rounded-lg border-slate-200 bg-white px-4 pr-11 transition-all focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
                  autoComplete="new-password"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() =>
                    setPasswordVisibility((current) => ({
                      ...current,
                      newPassword: !current.newPassword,
                    }))
                  }
                  className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-slate-400 transition hover:text-orange-600"
                  aria-label={passwordVisibility.newPassword ? "Hide" : "Show"}
                  disabled={loading}
                >
                  {passwordVisibility.newPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <InputError message={fieldErrors.newPassword} />
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmNewPassword" className="text-sm font-medium text-slate-700">
                Confirm New Password
              </label>
              <div className="relative">
                <Input
                  id="confirmNewPassword"
                  type={passwordVisibility.confirmNewPassword ? "text" : "password"}
                  value={formValues.confirmNewPassword}
                  onChange={(event) => {
                    setErrorMessage(null);
                    clearFieldError("confirmNewPassword");
                    setFormValues((current) => ({
                      ...current,
                      confirmNewPassword: event.target.value,
                    }));
                  }}
                  placeholder="Repeat new password"
                  className="h-11 rounded-lg border-slate-200 bg-white px-4 pr-11 transition-all focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
                  autoComplete="new-password"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() =>
                    setPasswordVisibility((current) => ({
                      ...current,
                      confirmNewPassword: !current.confirmNewPassword,
                    }))
                  }
                  className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-slate-400 transition hover:text-orange-700"
                  aria-label={passwordVisibility.confirmNewPassword ? "Hide" : "Show"}
                  disabled={loading}
                >
                  {passwordVisibility.confirmNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <InputError message={fieldErrors.confirmNewPassword} />
            </div>
          </div>

          <Button
            type="submit"
            className="h-11 w-full rounded-lg bg-orange-600 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 active:scale-[0.98] disabled:opacity-50"
            disabled={loading}
          >
            {loading ? (
              <>
                <LoaderCircle className="mr-2 size-4 animate-spin" />
                Updating password...
              </>
            ) : (
              "Reset Password"
            )}
          </Button>
        </form>

        <div className="rounded-lg bg-slate-50 p-4 text-xs leading-5 text-slate-500">
          <p>
            The reset code is sent to your email and is valid for a limited time. If you haven&apos;t received the email, please check your spam folder.
          </p>
        </div>
      </div>
    </AuthShell>
  );
}
