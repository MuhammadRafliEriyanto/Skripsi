"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";

import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AuthRequestError,
  authService,
  clearAuthClientState,
  persistAuthToken,
  persistAuthUser,
} from "@/lib/auth";

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

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formValues, setFormValues] = useState({
    identifier: "",
    password: "",
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

  function resolveRedirectPath(defaultRedirectPath: string) {
    const nextPath = searchParams.get("next")?.trim() ?? "";

    if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
      return defaultRedirectPath;
    }

    return nextPath;
  }

  function completeAuth(response: {
    data?: {
      user: Parameters<typeof persistAuthUser>[0];
      token: string;
      redirectPath: string;
    };
  }) {
    console.log("completeAuth called", response);
    if (!response.data) {
      throw new Error("Respons login tidak lengkap.");
    }

    persistAuthUser(response.data.user);
    persistAuthToken(response.data.token);
    console.log("routing to", resolveRedirectPath(response.data.redirectPath));
    router.replace(resolveRedirectPath(response.data.redirectPath));
    router.refresh();
  }

  function handleAuthError(error: unknown, fallbackMessage: string) {
    if (error instanceof AuthRequestError) {
      setErrorMessage(error.message);

      if (error.errors && typeof error.errors === "object" && !Array.isArray(error.errors)) {
        setFieldErrors(error.errors as Record<string, string>);
      }

      return;
    }

    setErrorMessage(fallbackMessage + (error instanceof Error ? ` (${error.message})` : ""));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrorMessage("");
    setFieldErrors({});

    try {
      clearAuthClientState();
      const response = await authService.login({
        identifier: formValues.identifier,
        password: formValues.password,
        rememberMe,
      });

      completeAuth(response);
    } catch (error) {
      handleAuthError(error, "Login gagal diproses. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      variant="split"
      splitContentAlignment="start"
      splitInnerClassName="max-w-[430px]"
      hideSplitVisualOnMobile
      hideSplitTopBadge
      title="Welcome Back to Bina Cendekia!"
      description="Masuk ke akun Anda untuk membuka dashboard belajar, jadwal, dan progres terbaru."
      footer={
        <div className="text-center text-sm text-slate-500">
          Belum punya akun?{" "}
          <Link
            href="/register"
            className="font-semibold text-[#c2410c] transition hover:text-[#9a3412] underline-offset-4 hover:underline"
          >
            Daftar sekarang
          </Link>
        </div>
      }
    >


      <div className="space-y-7">
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="identifier" className="text-sm font-medium text-slate-700">
                Kode Akun / Email
              </label>
              <Input
                id="identifier"
                type="text"
                value={formValues.identifier}
                onChange={(event) => {
                  setErrorMessage("");
                  clearFieldError("identifier");
                  clearFieldError("email");
                  setFormValues((current) => ({
                    ...current,
                    identifier: event.target.value,
                  }));
                }}
                className="h-12 rounded-xl border-[#f2c7b3] bg-white px-4 shadow-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
                autoComplete="username"
                required
                disabled={loading}
              />
              <InputError message={fieldErrors.identifier ?? fieldErrors.email} />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formValues.password}
                  onChange={(event) => {
                    setErrorMessage("");
                    clearFieldError("password");
                    setFormValues((current) => ({
                      ...current,
                      password: event.target.value,
                    }));
                  }}
                  className="h-12 rounded-xl border-[#f2c7b3] bg-white px-4 pr-12 shadow-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
                  autoComplete="current-password"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute inset-y-0 right-0 inline-flex w-12 items-center justify-center text-slate-400 transition hover:text-orange-600"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  disabled={loading}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <InputError message={fieldErrors.password} />
            </div>
          </div>

          <div className="flex items-center justify-start gap-3">
            <label className="group flex cursor-pointer items-center gap-2.5 text-sm text-slate-600 transition hover:text-slate-900">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                className="size-4 rounded border-slate-300 accent-orange-600 transition focus:ring-orange-500/10"
                disabled={loading}
                suppressHydrationWarning
              />
              Remember Me
            </label>
          </div>

          {errorMessage ? (
            <div className="rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm leading-6 text-red-700">
              {errorMessage}
            </div>
          ) : null}

          <Button
            type="submit"
            className="h-12 w-full rounded-xl bg-orange-600 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
            disabled={loading}
          >
            {loading ? (
              <>
                <LoaderCircle className="mr-2 size-4 animate-spin" />
                Memproses...
              </>
            ) : (
              "Login"
            )}
          </Button>
        </form>


      </div>
    </AuthShell>
  );
}
