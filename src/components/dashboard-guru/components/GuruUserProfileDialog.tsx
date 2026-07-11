"use client";

import { useRef, useState } from "react";

import {
  Eye,
  EyeOff,
  ImageUp,
  KeyRound,
  LoaderCircle,
  UserRound,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AuthRequestError,
  authService,
  persistAuthUser,
  type AuthUser,
} from "@/lib/auth";

type GuruUserProfileDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AuthUser | null;
  isUserLoading?: boolean;
  onProfileUpdated: (user: AuthUser) => void;
  roleLabel?: string | null;
  subject?: string | null;
  branch?: string | null;
  status?: string | null;
};

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
  return (
    name
      .trim()
      .split(/\s+/)
      .map((part) => part.charAt(0))
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "GU"
  );
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

export function GuruUserProfileDialog({
  open,
  onOpenChange,
  user,
  isUserLoading = false,
  onProfileUpdated,
}: GuruUserProfileDialogProps) {
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState("profile");
  const [profileValues, setProfileValues] = useState(() => ({
    nama: user?.nama ?? "",
    email: user?.email ?? "",
    avatar: user?.avatar ?? null,
  }));
  const [passwordValues, setPasswordValues] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });
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
  const [profileFieldErrors, setProfileFieldErrors] = useState<
    Record<string, string>
  >({});
  const [passwordFieldErrors, setPasswordFieldErrors] = useState<
    Record<string, string>
  >({});
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  function resetDialogState(baseUser: AuthUser | null) {
    setActiveTab("profile");
    setProfileError(null);
    setProfileSuccess(null);
    setPasswordError(null);
    setPasswordSuccess(null);
    setProfileFieldErrors({});
    setPasswordFieldErrors({});
    setPasswordValues({
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    });
    setPasswordVisibility({
      currentPassword: false,
      newPassword: false,
      confirmNewPassword: false,
    });
    setProfileValues({
      nama: baseUser?.nama ?? "",
      email: baseUser?.email ?? "",
      avatar: baseUser?.avatar ?? null,
    });

    if (avatarInputRef.current) {
      avatarInputRef.current.value = "";
    }
  }

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
      onProfileUpdated(response.data.user);
      setProfileValues({
        nama: response.data.user.nama,
        email: response.data.user.email,
        avatar: response.data.user.avatar,
      });
      setProfileSuccess(response.message || "Profil guru berhasil diperbarui.");
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
          : "Gagal memperbarui profil guru.",
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
          : "Gagal memperbarui password guru.",
      );
    } finally {
      setIsSubmittingPassword(false);
    }
  }

  const profileDisplayName = profileValues.nama || user?.nama || "Guru";
  const profileInitials = getInitials(profileDisplayName);
  const profileAvatarSrc = profileValues.avatar ?? user?.avatar ?? null;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          resetDialogState(user);
        }

        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <DialogHeader>
          <DialogTitle>Profil Guru</DialogTitle>
          <DialogDescription>
            Kelola nama, email, foto profil, dan password akun guru dari satu
            panel yang sama.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start">
            <TabsTrigger value="profile">Profil</TabsTrigger>
            <TabsTrigger value="password">Ubah Password</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <div className="rounded-[24px] border border-orange-100/80 bg-gradient-to-r from-orange-50/90 via-white to-amber-50/70 p-4 shadow-[0_20px_36px_-28px_rgba(249,115,22,0.18)]">
              <div className="flex items-center gap-4">
                <Avatar className="size-14 rounded-[24px]">
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
                  <p className="text-base font-semibold text-slate-950">
                    {user?.nama ?? "Memuat profil guru..."}
                  </p>
                </div>
              </div>
            </div>

            <NoticeBox variant="success" message={profileSuccess} />
            <NoticeBox variant="error" message={profileError} />

            <form className="space-y-4" onSubmit={handleProfileSubmit}>
              <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/70 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <Avatar className="size-16 rounded-[22px]">
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

                  <div className="space-y-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Foto profil guru
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Upload JPG, PNG, WebP, ukuran maksimal 2MB.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        ref={avatarInputRef}
                        id="guru-profile-avatar-file"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarChange}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
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

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="guru-profile-name"
                    className="text-sm font-medium text-slate-700"
                  >
                    Nama Lengkap
                  </label>
                  <Input
                    id="guru-profile-name"
                    value={profileValues.nama}
                    onChange={(event) =>
                      setProfileValues((current) => ({
                        ...current,
                        nama: event.target.value,
                      }))
                    }
                    placeholder="Nama guru"
                    className={`mt-1.5 ${warmFieldClassName}`}
                    disabled={isUserLoading || isSubmittingProfile}
                  />
                  <InputError message={profileFieldErrors.nama} />
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className={warmOutlineButtonClassName}
                  onClick={() => onOpenChange(false)}
                >
                  Tutup
                </Button>
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
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="password" className="space-y-4">
            <div className="rounded-[24px] border border-slate-200/80 bg-white/96 p-4 shadow-[0_18px_30px_-24px_rgba(15,23,42,0.16)]">
              <div className="flex items-start gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl border border-orange-100 bg-orange-50 text-orange-600">
                  <KeyRound className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-950">
                    Ubah password akun guru
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Gunakan minimal 8 karakter dan pastikan password baru berbeda.
                  </p>
                </div>
              </div>
            </div>

            <NoticeBox variant="success" message={passwordSuccess} />
            <NoticeBox variant="error" message={passwordError} />

            <form className="space-y-4" onSubmit={handlePasswordSubmit}>
              <PasswordField
                id="guru-current-password"
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

              <div className="grid gap-3 sm:grid-cols-2">
                <PasswordField
                  id="guru-new-password"
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
                  id="guru-confirm-new-password"
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

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className={warmOutlineButtonClassName}
                  onClick={() => onOpenChange(false)}
                >
                  Tutup
                </Button>
                <Button
                  type="submit"
                  variant="secondary"
                  className={warmPrimaryButtonClassName}
                  disabled={isUserLoading || isSubmittingPassword || !user}
                >
                  {isSubmittingPassword ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    <>
                      <KeyRound className="size-4" />
                      Perbarui Password
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
