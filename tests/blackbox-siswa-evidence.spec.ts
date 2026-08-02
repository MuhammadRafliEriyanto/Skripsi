import { expect, test, type Page } from "@playwright/test";

import {
  authenticateRole,
  createRoleAuthSession,
  expectPageText,
  openAccountMenu,
  openLocalPage,
  type AuthSession,
  type RoleAccount,
} from "./helpers/blackbox-auth";

const SISWA_ACCOUNT: RoleAccount = {
  role: "siswa",
  identifier: process.env.BLACKBOX_SISWA_IDENTIFIER ?? "siswa019@bimbel.local",
  password: process.env.BLACKBOX_SISWA_PASSWORD,
  dashboardPath: "/dashboard-siswa",
  dashboardText: /Dashboard Siswa|Jadwal Mata Pelajaran|Akses Membership/i,
};

async function dismissMembershipNotice(page: Page) {
  const dismissButton = page
    .getByRole("button", {
      name: /Nanti|Tutup|Mengerti|Lanjut|Tetap belajar|Lewati/i,
    })
    .first();

  if (await dismissButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await dismissButton.click();
    return;
  }

  await page.keyboard.press("Escape").catch(() => undefined);
}

async function openSiswaPage(page: Page, pathName: string) {
  await openLocalPage(page, pathName);
  await dismissMembershipNotice(page);
}

async function openSiswaProfileDialog(page: Page) {
  await dismissMembershipNotice(page);
  await openAccountMenu(page, /Siswa|STD|SD|SMP|SMA/i);
  await page.getByRole("menuitem", { name: /Profil Siswa|Profil/i }).click();
  await expectPageText(page, /Profil Siswa/i);
}

test.describe("Blackbox dashboard siswa", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  let authSession: AuthSession | null = null;

  test.beforeAll(async () => {
    if (!SISWA_ACCOUNT.password?.trim()) {
      authSession = await createRoleAuthSession(SISWA_ACCOUNT);
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await authenticateRole(page, SISWA_ACCOUNT, authSession);
    await dismissMembershipNotice(page);
  });

  test("Login Siswa", async ({ page }) => {
    await expectPageText(page, /Dashboard Siswa|Jadwal Mata Pelajaran/i);
  });

  test("Dashboard Siswa", async ({ page }) => {
    await openSiswaPage(page, "/dashboard-siswa");
    await expectPageText(page, /Jadwal Mata Pelajaran/i);
    await expectPageText(page, /Akses Membership|Materi|Tugas/i);
  });

  test("Jadwal & Absensi", async ({ page }) => {
    await openSiswaPage(page, "/dashboard-siswa/jadwal");
    await expectPageText(page, /Jadwal Mata Pelajaran|Jadwal Mingguan/i);
    await openSiswaPage(page, "/dashboard-siswa/absensi");
    await expectPageText(page, /Riwayat Absensi Kelas/i);
    await expectPageText(page, /Kehadiran|Absensi/i);
  });

  test("Materi Pembelajaran", async ({ page }) => {
    await openSiswaPage(page, "/dashboard-siswa/materi");
    await expectPageText(page, /Materi Belajar/i);
    await expectPageText(page, /Daftar Materi Kelas|Sedang Memuat Materi|Belum Ada Materi/i);
  });

  test("Tugas & Nilai", async ({ page }) => {
    await openSiswaPage(page, "/dashboard-siswa/tugas");
    await expectPageText(page, /Tugas Siswa|Daftar Tugas|Tugas mandiri/i);
    await openSiswaPage(page, "/dashboard-siswa/nilai");
    await expectPageText(page, /Rekapitulasi Nilai|Nilai Tugas/i);
  });

  test("Kelola Tugas & Penilaian", async ({ page }) => {
    await openSiswaPage(page, "/dashboard-siswa/kirim-tugas");
    await expectPageText(page, /Pilihan Tugas|Tugas yang bisa dikirim/i);
    await expectPageText(page, /Detail Tugas|Nilai|Penilaian/i);
  });

  test("Riwayat Akademik", async ({ page }) => {
    await openSiswaPage(page, "/dashboard-siswa/riwayat-akademik");
    await expectPageText(page, /Riwayat Akademik/i);
    await expectPageText(page, /Paket Aktif|Akademik|Membership/i);
  });

  test("Tagihan & Membership", async ({ page }) => {
    await openSiswaPage(page, "/dashboard-siswa/tagihan");
    await expectPageText(page, /Tagihan|Membership/i);
    await expectPageText(page, /Status Membership|Riwayat Tagihan|Perpanjangan/i);
  });

  test("Tryout/Ujian", async ({ page }) => {
    await openSiswaPage(page, "/dashboard-siswa/ujian");
    await expectPageText(page, /Ujian Siswa/i);
    await expectPageText(page, /UTS|UAS|Tryout|Pilih Ujian/i);
  });

  test("Profil Siswa", async ({ page }) => {
    await openSiswaProfileDialog(page);
    await expectPageText(page, /Kelola data akun siswa/i);
    await expectPageText(page, /Simpan Profil/i);
  });

  test("Ubah Password Siswa", async ({ page }) => {
    await openSiswaProfileDialog(page);
    await page.getByRole("tab", { name: /Ubah Password/i }).click();
    await expectPageText(page, /Password lama/i);
    await expectPageText(page, /Password baru/i);
    await expectPageText(page, /Konfirmasi password baru/i);
  });

  test("Logout Siswa", async ({ page }) => {
    await dismissMembershipNotice(page);
    await openAccountMenu(page, /Siswa|STD|SD|SMP|SMA/i);
    await page.getByRole("menuitem", { name: /Logout/i }).click();
    await page.waitForURL(/\/login(?:\?|$)/, { timeout: 60_000 });
    await expect(page.locator("#identifier")).toBeVisible({ timeout: 30_000 });
  });
});
