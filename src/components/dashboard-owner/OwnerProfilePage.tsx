"use client";

import { useRef, useState, useCallback, useEffect } from "react";

import {
  Eye,
  EyeOff,
  ImageUp,
  KeyRound,
  LoaderCircle,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AuthRequestError,
  authService,
  persistAuthUser,
  readPersistedAuthUser,
  type AuthUser,
} from "@/lib/auth";

type PasswordVisibilityState = {
  currentPassword: boolean;
  newPassword: boolean;
  confirmNewPassword: boolean;
};

const MAX_AVATAR_FILE_SIZE = 2 * 1024 * 1024;

const warmFieldClassName =
  "border-slate-200 hover:border-orange-200 focus:border-orange-300 focus:ring-4 focus:ring-orange-500/10 focus-visible:border-orange-300 focus-visible:ring-4 focus-visible:ring-orange-500/10";
const warmOutlineButtonClassName =
  "border-slate-200 bg-white text-slate-700 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700 active:border-orange-300 active:bg-orange-100/80 active:text-orange-800 focus-visible:border-orange-300 focus-visible:ring-orange-500/10";
const warmPrimaryButtonClassName =
  "bg-orange-600 hover:bg-orange-700 active:bg-orange-800 focus-visible:ring-orange-500/20";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part.trim().charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatRoleLabel(role: AuthUser["role"]) {
  switch (role) {
    case "owner":
      return "Owner";
    case "admin":
      return "Admin";
    case "guru":
      return "Guru";
    case "siswa":
      return "Siswa";
    default:
      return role;
  }
}

function InputError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="mt-2 text-xs text-rose-600">{message}</p>;
}

function NoticeBox({
  variant,
  message,
}: {
  variant: "success" | "error" | "info";
  message: string | null;
}) {
  if (!message) {
    return null;
  }

  const className =
    variant === "success"
      ? "border-emerald-100 bg-emerald-50 text-emerald-700"
      : variant === "error"
        ? "border-rose-100 bg-rose-50 text-rose-600"
        : "border-orange-100 bg-orange-50 text-orange-700";

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm ${className}`}>
      {message}
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  visible,
  error,
  onChange,
  onToggleVisibility,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  visible: boolean;
  error?: string;
  onChange: (value: string) => void;
  onToggleVisibility: () => void;
  placeholder: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="relative mt-2">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={`${warmFieldClassName} pr-12`}
          autoComplete="off"
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 inline-flex w-12 items-center justify-center text-slate-400 transition hover:text-orange-600"
          onClick={onToggleVisibility}
          aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      <InputError message={error} />
    </div>
  );
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Gagal membaca file gambar."));
    };

    reader.onerror = () => {
      reject(new Error("Gagal membaca file gambar."));
    };

    reader.readAsDataURL(file);
  });
}

export function OwnerProfilePage() {
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("profile");
  const [profileValues, setProfileValues] = useState({
    nama: "",
    email: "",
    avatar: null as string | null,
  });
  const [passwordValues, setPasswordValues] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });
  const [forgotEmail, setForgotEmail] = useState("");
  const [passwordVisibility, setPasswordVisibility] =
    useState<PasswordVisibilityState>({
      currentPassword: false,
      newPassword: false,
      confirmNewPassword: false,
    });
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [profileFieldErrors, setProfileFieldErrors] = useState<
    Record<string, string>
  >({});
  const [passwordFieldErrors, setPasswordFieldErrors] = useState<
    Record<string, string>
  >({});
  const [forgotFieldErrors, setForgotFieldErrors] = useState<
    Record<string, string>
  >({});
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [isSubmittingForgotPassword, setIsSubmittingForgotPassword] =
    useState(false);

  const loadUser = useCallback(async () => {
    try {
      const persisted = readPersistedAuthUser();
      if (persisted) {
        setUser(persisted);
        setProfileValues({
          nama: persisted.nama,
          email: persisted.email,
          avatar: persisted.avatar,
        });
        setForgotEmail(persisted.email);
      }

      const response = await authService.me();
      const freshUser = response.data?.user;

      if (freshUser) {
        persistAuthUser(freshUser);
        setUser(freshUser);
        setProfileValues({
          nama: freshUser.nama,
          email: freshUser.email,
          avatar: freshUser.avatar,
        });
        setForgotEmail(freshUser.email);
      }
    } catch (error) {
      console.error("[owner-profile] load_user_failed", error);
    } finally {
      setIsUserLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadUser();
    });
  }, [loadUser]);

  async function handleAvatarChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    setProfileError(null);
    setProfileSuccess(null);
    setProfileFieldErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors.avatar;
      return nextErrors;
    });

    if (!selectedFile.type.startsWith("image/")) {
      setProfileFieldErrors((current) => ({
        ...current,
        avatar: "File harus berupa gambar.",
      }));
      setProfileError("File foto profil harus berupa gambar.");
      event.target.value = "";
      return;
    }

    if (selectedFile.size > MAX_AVATAR_FILE_SIZE) {
      setProfileFieldErrors((current) => ({
        ...current,
        avatar: "Ukuran foto profil maksimal 2MB.",
      }));
      setProfileError("Ukuran foto profil maksimal 2MB.");
      event.target.value = "";
      return;
    }

    try {
      const imageDataUrl = await readFileAsDataUrl(selectedFile);

      setProfileValues((current) => ({
        ...current,
        avatar: imageDataUrl,
      }));
    } catch (error) {
      setProfileFieldErrors((current) => ({
        ...current,
        avatar: "Gagal membaca file gambar.",
      }));
      setProfileError(
        error instanceof Error
          ? error.message
          : "Gagal membaca file gambar.",
      );
      event.target.value = "";
    }
  }

  async function handleProfileSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmittingProfile(true);
    setProfileError(null);
    setProfileSuccess(null);
    setProfileFieldErrors({});

    try {
      const response = await authService.updateProfile({
        nama: profileValues.nama.trim(),
        email: profileValues.email.trim(),
        avatar: profileValues.avatar,
      });

      if (!response.data?.user) {
        throw new Error("Respons profil tidak lengkap.");
      }

      persistAuthUser(response.data.user);
      setUser(response.data.user);
      setProfileValues({
        nama: response.data.user.nama,
        email: response.data.user.email,
        avatar: response.data.user.avatar,
      });
      setForgotEmail(response.data.user.email);
      setProfileSuccess(response.message || "Profil berhasil diperbarui.");
    } catch (error) {
      if (
        error instanceof AuthRequestError &&
        error.errors &&
        typeof error.errors === "object" &&
        !Array.isArray(error.errors)
      ) {
        setProfileFieldErrors(error.errors as Record<string, string>);
      }

      setProfileError(
        error instanceof AuthRequestError
          ? error.message
          : "Gagal memperbarui profil owner.",
      );
    } finally {
      setIsSubmittingProfile(false);
    }
  }

  async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmittingPassword(true);
    setPasswordError(null);
    setPasswordSuccess(null);
    setPasswordFieldErrors({});

    if (passwordValues.newPassword !== passwordValues.confirmNewPassword) {
      setPasswordFieldErrors({
        confirmNewPassword: "Konfirmasi password baru tidak cocok.",
      });
      setPasswordError("Konfirmasi password baru harus sama.");
      setIsSubmittingPassword(false);
      return;
    }

    if (passwordValues.newPassword.length < 8) {
      setPasswordFieldErrors({
        newPassword: "Password baru minimal 8 karakter.",
      });
      setPasswordError("Password baru minimal 8 karakter.");
      setIsSubmittingPassword(false);
      return;
    }

    try {
      const response = await authService.changePassword(passwordValues);

      setPasswordValues({
        currentPassword: "",
        newPassword: "",
        confirmNewPassword: "",
      });
      setPasswordSuccess(response.message || "Password berhasil diperbarui.");
    } catch (error) {
      if (
        error instanceof AuthRequestError &&
        error.errors &&
        typeof error.errors === "object" &&
        !Array.isArray(error.errors)
      ) {
        setPasswordFieldErrors(error.errors as Record<string, string>);
      }

      setPasswordError(
        error instanceof AuthRequestError
          ? error.message
          : "Gagal memperbarui password.",
      );
    } finally {
      setIsSubmittingPassword(false);
    }
  }

  async function handleForgotPasswordSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setIsSubmittingForgotPassword(true);
    setForgotError(null);
    setForgotSuccess(null);
    setForgotFieldErrors({});

    try {
      const response = await authService.forgotPassword({
        email: forgotEmail.trim(),
      });

      setForgotSuccess(
        response.message ||
          "Jika email terdaftar, instruksi reset password sudah dikirim.",
      );
    } catch (error) {
      if (
        error instanceof AuthRequestError &&
        error.errors &&
        typeof error.errors === "object" &&
        !Array.isArray(error.errors)
      ) {
        setForgotFieldErrors(error.errors as Record<string, string>);
      }

      setForgotError(
        error instanceof AuthRequestError
          ? error.message
          : "Gagal memproses permintaan lupa password.",
      );
    } finally {
      setIsSubmittingForgotPassword(false);
    }
  }

  const profileDisplayName = profileValues.nama || user?.nama || "Owner";
  const profileInitials = getInitials(profileDisplayName);
  const profileAvatarSrc = profileValues.avatar ?? user?.avatar ?? null;
  const updatedLabel = user
    ? new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(user.updatedAt))
    : null;

  if (isUserLoading && !user) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-10 w-72 rounded-lg" />
        <div className="rounded-[24px] border border-slate-200/80 p-5 space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="size-16 rounded-[24px]" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-52" />
            </div>
          </div>
        </div>
        <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/70 p-4">
          <div className="flex items-center gap-4">
            <Skeleton className="size-20 rounded-[26px]" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-64 max-w-full" />
              <Skeleton className="h-9 w-28 rounded-lg" />
            </div>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <Skeleton className="h-10 w-36 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">
          Profil Pengguna
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Kelola data akun owner, ubah password, dan kirim instruksi reset
          password dari satu halaman yang sama.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="profile">Profil</TabsTrigger>
          <TabsTrigger value="password">Ubah Password</TabsTrigger>
          <TabsTrigger value="forgot-password">Lupa Password</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <div className="rounded-[24px] border border-orange-100/80 bg-gradient-to-r from-orange-50/90 via-white to-amber-50/70 p-5 shadow-[0_20px_36px_-28px_rgba(249,115,22,0.18)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="size-16 rounded-[24px]">
                  {profileAvatarSrc ? (
                    <AvatarImage
                      src={profileAvatarSrc}
                      alt={`Foto profil ${profileDisplayName}`}
                    />
                  ) : null}
                  <AvatarFallback className="text-lg">
                    {profileInitials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-lg font-semibold text-slate-950">
                    {user?.nama ?? "Memuat profil owner..."}
                  </p>
                  <p className="text-sm text-slate-500">
                    {user?.email ?? "Sinkronisasi data user aktif"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="info">
                  <ShieldCheck className="size-3.5" />
                  {formatRoleLabel(user?.role ?? "owner")}
                </Badge>
                <Badge
                  variant={user?.isEmailVerified ? "success" : "warning"}
                >
                  {user?.isEmailVerified
                    ? "Email terverifikasi"
                    : "Email belum terverifikasi"}
                </Badge>
              </div>
            </div>

            {updatedLabel ? (
              <p className="mt-4 text-xs text-slate-500">
                Terakhir diperbarui {updatedLabel}
              </p>
            ) : null}
          </div>

          <NoticeBox variant="success" message={profileSuccess} />
          <NoticeBox variant="error" message={profileError} />
          <NoticeBox
            variant="info"
            message="Field profil yang aktif saat ini mengikuti tabel users: nama, email, dan foto profil. Role ditampilkan sebagai informasi akun."
          />

          <form className="space-y-5" onSubmit={handleProfileSubmit}>
            <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/70 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <Avatar className="size-20 rounded-[26px]">
                  {profileAvatarSrc ? (
                    <AvatarImage
                      src={profileAvatarSrc}
                      alt={`Preview foto profil ${profileDisplayName}`}
                    />
                  ) : null}
                  <AvatarFallback className="text-xl">
                    {profileInitials}
                  </AvatarFallback>
                </Avatar>

                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Foto profil owner
                    </p>
                    <p className="text-xs text-slate-500">
                      Upload gambar JPG, PNG, WebP, atau format image lain
                      dengan ukuran maksimal 2MB.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={avatarInputRef}
                      id="owner-profile-avatar-file"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className={warmOutlineButtonClassName}
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={isUserLoading || isSubmittingProfile}
                    >
                      <ImageUp className="size-4" />
                      {profileAvatarSrc ? "Ganti Foto" : "Upload Foto"}
                    </Button>
                  </div>

                  <InputError message={profileFieldErrors.avatar} />
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="owner-profile-name"
                  className="text-sm font-medium text-slate-700"
                >
                  Nama
                </label>
                <Input
                  id="owner-profile-name"
                  value={profileValues.nama}
                  onChange={(event) =>
                    setProfileValues((current) => ({
                      ...current,
                      nama: event.target.value,
                    }))
                  }
                  placeholder="Nama pengguna"
                  className={`mt-2 ${warmFieldClassName}`}
                  disabled={isUserLoading || isSubmittingProfile}
                />
                <InputError message={profileFieldErrors.nama} />
              </div>

              <div>
                <label
                  htmlFor="owner-profile-email"
                  className="text-sm font-medium text-slate-700"
                >
                  Email
                </label>
                <Input
                  id="owner-profile-email"
                  type="email"
                  value={profileValues.email}
                  onChange={(event) =>
                    setProfileValues((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  placeholder="nama@email.com"
                  className={`mt-2 ${warmFieldClassName}`}
                  disabled={isUserLoading || isSubmittingProfile}
                />
                <InputError message={profileFieldErrors.email} />
              </div>

              <div>
                <label
                  htmlFor="owner-profile-role"
                  className="text-sm font-medium text-slate-700"
                >
                  Role
                </label>
                <Input
                  id="owner-profile-role"
                  value={formatRoleLabel(user?.role ?? "owner")}
                  className={`mt-2 ${warmFieldClassName}`}
                  disabled
                />
              </div>

              <div>
                <label
                  htmlFor="owner-profile-status"
                  className="text-sm font-medium text-slate-700"
                >
                  Status verifikasi
                </label>
                <Input
                  id="owner-profile-status"
                  value={
                    user?.isEmailVerified
                      ? "Email terverifikasi"
                      : "Email belum terverifikasi"
                  }
                  className={`mt-2 ${warmFieldClassName}`}
                  disabled
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                variant="secondary"
                className={warmPrimaryButtonClassName}
                disabled={isUserLoading || isSubmittingProfile || !user}
              >
                {isSubmittingProfile ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <UserRound className="size-4" />
                    Simpan Profil
                  </>
                )}
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="password" className="space-y-6">
          <div className="rounded-[24px] border border-slate-200/80 bg-white/96 p-5 shadow-[0_18px_30px_-24px_rgba(15,23,42,0.16)]">
            <div className="flex items-start gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl border border-orange-100 bg-orange-50 text-orange-600">
                <KeyRound className="size-5" />
              </div>
              <div>
                <p className="text-base font-semibold text-slate-950">
                  Ubah password akun
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Gunakan minimal 8 karakter. Password baru harus berbeda
                  dari password lama.
                </p>
              </div>
            </div>
          </div>

          <NoticeBox variant="success" message={passwordSuccess} />
          <NoticeBox variant="error" message={passwordError} />

          <form className="space-y-5" onSubmit={handlePasswordSubmit}>
            <PasswordField
              id="owner-current-password"
              label="Password lama"
              value={passwordValues.currentPassword}
              visible={passwordVisibility.currentPassword}
              error={passwordFieldErrors.currentPassword}
              placeholder="Masukkan password lama"
              onChange={(value) =>
                setPasswordValues((current) => ({
                  ...current,
                  currentPassword: value,
                }))
              }
              onToggleVisibility={() =>
                setPasswordVisibility((current) => ({
                  ...current,
                  currentPassword: !current.currentPassword,
                }))
              }
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <PasswordField
                id="owner-new-password"
                label="Password baru"
                value={passwordValues.newPassword}
                visible={passwordVisibility.newPassword}
                error={passwordFieldErrors.newPassword}
                placeholder="Minimal 8 karakter"
                onChange={(value) =>
                  setPasswordValues((current) => ({
                    ...current,
                    newPassword: value,
                  }))
                }
                onToggleVisibility={() =>
                  setPasswordVisibility((current) => ({
                    ...current,
                    newPassword: !current.newPassword,
                  }))
                }
              />

              <PasswordField
                id="owner-confirm-new-password"
                label="Konfirmasi password baru"
                value={passwordValues.confirmNewPassword}
                visible={passwordVisibility.confirmNewPassword}
                error={passwordFieldErrors.confirmNewPassword}
                placeholder="Ulangi password baru"
                onChange={(value) =>
                  setPasswordValues((current) => ({
                    ...current,
                    confirmNewPassword: value,
                  }))
                }
                onToggleVisibility={() =>
                  setPasswordVisibility((current) => ({
                    ...current,
                    confirmNewPassword: !current.confirmNewPassword,
                  }))
                }
              />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-sm text-slate-500">
              <p>Lupa password lama akun ini?</p>
              <button
                type="button"
                className="font-semibold text-orange-600 transition hover:text-orange-700"
                onClick={() => setActiveTab("forgot-password")}
              >
                Buka bantuan reset
              </button>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                variant="secondary"
                className={warmPrimaryButtonClassName}
                disabled={isSubmittingPassword || !user}
              >
                {isSubmittingPassword ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <KeyRound className="size-4" />
                    Perbarui Password
                  </>
                )}
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="forgot-password" className="space-y-6">
          <div className="rounded-[24px] border border-orange-100/80 bg-gradient-to-r from-orange-50/80 to-white p-5 shadow-[0_18px_30px_-24px_rgba(249,115,22,0.16)]">
            <div className="flex items-start gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl border border-orange-100 bg-white text-orange-600">
                <Mail className="size-5" />
              </div>
              <div>
                <p className="text-base font-semibold text-slate-950">
                  Kirim instruksi reset password
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Masukkan email akun owner. Jika email terdaftar, sistem akan
                  mengirim instruksi reset password secara aman.
                </p>
              </div>
            </div>
          </div>

          <NoticeBox variant="success" message={forgotSuccess} />
          <NoticeBox variant="error" message={forgotError} />

          <form className="space-y-5" onSubmit={handleForgotPasswordSubmit}>
            <div>
              <label
                htmlFor="owner-forgot-password-email"
                className="text-sm font-medium text-slate-700"
              >
                Email akun
              </label>
              <Input
                id="owner-forgot-password-email"
                type="email"
                value={forgotEmail}
                onChange={(event) => setForgotEmail(event.target.value)}
                placeholder="nama@email.com"
                className={`mt-2 ${warmFieldClassName}`}
                disabled={isSubmittingForgotPassword}
              />
              <InputError message={forgotFieldErrors.email} />
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-sm text-slate-500">
              Gunakan flow ini saat owner lupa password dan tidak bisa masuk
              menggunakan password lama. Respons sukses akan tetap generik
              untuk menjaga keamanan akun.
            </div>

            <div className="flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                className={warmOutlineButtonClassName}
                onClick={() => setActiveTab("password")}
              >
                Kembali ke Password
              </Button>
              <Button
                type="submit"
                variant="secondary"
                className={warmPrimaryButtonClassName}
                disabled={isSubmittingForgotPassword}
              >
                {isSubmittingForgotPassword ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    Mengirim...
                  </>
                ) : (
                  <>
                    <Mail className="size-4" />
                    Kirim Instruksi
                  </>
                )}
              </Button>
            </div>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
