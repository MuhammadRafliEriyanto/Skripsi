import type { Metadata } from "next";

import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ['latin'], variable: '--font-sans', preload: false });

export const metadata: Metadata = {
  title: {
    default: "Bina Cendekia Dashboard",
    template: "%s | Bina Cendekia",
  },
  description:
    "Dashboard modern untuk Owner, Admin, Guru, dan Siswa pada LMS Bimbingan Belajar.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={cn("h-full antialiased", "font-sans", geist.variable)} suppressHydrationWarning data-scroll-behavior="smooth">
      <body className="min-h-full bg-background text-foreground">
        <div className="relative min-h-screen">{children}</div>
      </body>
    </html>
  );
}
