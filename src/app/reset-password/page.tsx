import type { Metadata } from "next";

import { ResetPasswordView } from "@/components/auth/ResetPasswordView";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Masukkan kode reset password dan simpan password baru akun LMS Bimbel.",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; source?: string; code?: string }>;
}) {
  const params = await searchParams;

  return (
    <ResetPasswordView
      email={params.email?.trim() ?? null}
      code={params.code?.trim() ?? null}
      source={params.source?.trim() ?? null}
    />
  );
}
