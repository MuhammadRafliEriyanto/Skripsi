import { expect, test } from "@playwright/test";

import {
  authenticateRole,
  createRoleAuthSession,
  expectPageText,
  openAccountMenu,
  openLocalPage,
  type AuthSession,
  type RoleAccount,
} from "./helpers/blackbox-auth";

const ADMIN_ACCOUNT: RoleAccount = {
  role: "admin",
  identifier:
    process.env.BLACKBOX_ADMIN_IDENTIFIER ?? "dolphnss815@gmail.com",
  password: process.env.BLACKBOX_ADMIN_PASSWORD,
  dashboardPath: "/dashboard-admin",
  dashboardText: /Dashboard Admin|Total Siswa|Guru Aktif/i,
};

test.describe("Blackbox dashboard admin", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  let authSession: AuthSession | null = null;

  test.beforeAll(async () => {
    if (!ADMIN_ACCOUNT.password?.trim()) {
      authSession = await createRoleAuthSession(ADMIN_ACCOUNT);
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await authenticateRole(page, ADMIN_ACCOUNT, authSession);
  });

  test("Login Admin", async ({ page }) => {
    await expectPageText(page, /Dashboard Admin|Total Siswa|Guru Aktif/i);
  });

  test("Dashboard Admin", async ({ page }) => {
    await openLocalPage(page, "/dashboard-admin");
    await expectPageText(page, /Total Siswa/i);
    await expectPageText(page, /Guru Aktif/i);
    await expectPageText(page, /Ringkasan Keuangan Cabang|Overview Pembayaran/i);
  });

  test("Kelola Siswa", async ({ page }) => {
    await openLocalPage(page, "/dashboard-admin/siswa");
    await expectPageText(page, /Kelola siswa/i);
    await expectPageText(page, /Nama Siswa|Data siswa|Status/i);
    await expectPageText(page, /Reset filter|Tambah Siswa|Import/i);
  });

  test("Kelola Guru", async ({ page }) => {
    await openLocalPage(page, "/dashboard-admin/guru");
    await expectPageText(page, /Kelola guru/i);
    await expectPageText(page, /Jadwal Mengajar|Nama Guru|Mata Pelajaran/i);
    await expectPageText(page, /Reset filter|Tambah Guru|Import/i);
  });

  test("Kelola Jadwal", async ({ page }) => {
    await openLocalPage(page, "/dashboard-admin/jadwal");
    await expectPageText(page, /Kelola jadwal/i);
    await expectPageText(page, /Guru|Jadwal|Ruangan|Status/i);
    await expectPageText(page, /Reset filter|Tambah Jadwal|Import/i);
  });

  test("Kelola Pembayaran", async ({ page }) => {
    await openLocalPage(page, "/dashboard-admin/pembayaran");
    await expectPageText(page, /Informasi Pembayaran/i);
    await expectPageText(page, /Pembayaran Masuk|Aktivasi Membership/i);
    await expectPageText(page, /Status|Lunas|Tanggal Bayar/i);
  });

  test("Profil Admin", async ({ page }) => {
    await openLocalPage(page, "/dashboard-admin/profil");
    await expectPageText(page, /Profil Pengguna/i);
    await expectPageText(page, /Kelola data akun admin/i);
    await expectPageText(page, /Ubah Password/i);
  });

  test("Ubah Password Admin", async ({ page }) => {
    await openLocalPage(page, "/dashboard-admin/profil");
    await page.getByRole("tab", { name: /Ubah Password/i }).click();
    await expectPageText(page, /Password lama/i);
    await expectPageText(page, /Password baru/i);
    await expectPageText(page, /Konfirmasi password baru/i);
  });

  test("Logout Admin", async ({ page }) => {
    await openAccountMenu(page, /Admin|Rafli/i);
    await page.getByRole("menuitem", { name: /Logout/i }).click();
    await page.waitForURL(/\/login(?:\?|$)/, { timeout: 60_000 });
    await expect(page.locator("#identifier")).toBeVisible({ timeout: 30_000 });
  });
});
