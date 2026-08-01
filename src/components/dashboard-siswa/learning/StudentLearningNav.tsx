"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, FileText, Send, TimerReset } from "lucide-react";

const learningMenus = [
  {
    label: "Materi",
    href: "/dashboard-siswa/materi",
    icon: BookOpen,
  },
  {
    label: "Tugas",
    href: "/dashboard-siswa/tugas",
    icon: FileText,
  },
  {
    label: "Kirim Jawaban",
    href: "/dashboard-siswa/kirim-tugas",
    icon: Send,
  },
  {
    label: "Ujian",
    href: "/dashboard-siswa/ujian",
    icon: TimerReset,
  },
];

const utbkLearningMenus = [
  {
    label: "Materi",
    href: "/dashboard-siswa/materi",
    icon: BookOpen,
  },
  {
    label: "Tryout",
    href: "/dashboard-siswa/ujian",
    icon: TimerReset,
  },
];

type StudentLearningNavProps = {
  isUtbkStudent?: boolean;
};

export default function StudentLearningNav({
  isUtbkStudent = false,
}: StudentLearningNavProps) {
  const pathname = usePathname();
  const visibleMenus = isUtbkStudent ? utbkLearningMenus : learningMenus;

  return (
    <div className="flex flex-wrap gap-2 rounded-[20px] bg-white/90 p-1.5 shadow-sm ring-1 ring-orange-100/80">
      {visibleMenus.map((menu) => {
        const Icon = menu.icon;
        const isActive =
          pathname === menu.href || pathname.startsWith(`${menu.href}/`);
        return (
          <Link
            key={menu.href}
            href={menu.href}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition-all ${
              isActive
                ? "bg-orange-500 text-white shadow-sm"
                : "text-slate-500 hover:bg-orange-50 hover:text-orange-600"
            }`}
          >
            <Icon className="h-4 w-4" />
            {menu.label}
          </Link>
        );
      })}
    </div>
  );
}
