import type { Metadata } from "next";

import RegisterOnlineView from "@/components/register-online/RegisterOnlineView";

export const metadata: Metadata = {
  title: "Register",
  description: "Pendaftaran siswa baru dengan paket membership bimbel.",
};

type RegisterPageProps = {
  searchParams: Promise<{ package?: string }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const initialPackageKey = params.package;

  return (
    <RegisterOnlineView
      key={initialPackageKey ?? "default-package"}
      initialPackageKey={initialPackageKey}
    />
  );
}
