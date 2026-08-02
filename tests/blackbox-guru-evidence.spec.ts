import { expect, test, type Page } from "@playwright/test";

import {
  BASE_URL,
  authenticateRole,
  createRoleAuthSession,
  expectPageText,
  openAccountMenu,
  openLocalPage,
  type AuthSession,
  type RoleAccount,
} from "./helpers/blackbox-auth";

const GURU_ACCOUNT: RoleAccount = {
  role: "guru",
  identifier: process.env.BLACKBOX_GURU_IDENTIFIER ?? "guru001@bimbel.local",
  password: process.env.BLACKBOX_GURU_PASSWORD,
  dashboardPath: "/dashboard-guru",
  dashboardText: /Dashboard Guru|Jadwal Mengajar|Kelas/i,
};

type TeacherClassesResponse = {
  success?: boolean;
  message?: string;
  data?: {
    classes?: Array<{
      id?: string;
      classId?: string;
      kelasId?: string;
    }>;
  };
};

async function getFirstTeacherClassId(page: Page) {
  const response = await page
    .context()
    .request.get(`${BASE_URL}/api/teacher/me/classes`);
  const payload = (await response
    .json()
    .catch(() => null)) as TeacherClassesResponse | null;

  if (!response.ok() || !payload?.success) {
    throw new Error(
      payload?.message ?? "Daftar kelas guru belum bisa diambil untuk evidence.",
    );
  }

  const classItem = payload.data?.classes?.find(
    (item) => item.id || item.classId || item.kelasId,
  );
  const classId = classItem?.id ?? classItem?.classId ?? classItem?.kelasId;

  if (!classId) {
    throw new Error("Akun guru evidence belum memiliki kelas aktif.");
  }

  return classId;
}

async function openGuruClassPage(page: Page, pathName: string) {
  const classId = await getFirstTeacherClassId(page);

  await openLocalPage(page, `${pathName}?kelasId=${encodeURIComponent(classId)}`);
}

async function openGuruProfileDialog(page: Page) {
  await openAccountMenu(page, /Guru|TCH|Pengajar/i);
  await page.getByRole("menuitem", { name: /Lihat Profil|Profil/i }).click();
  await expectPageText(page, /Profil Guru/i);
}

test.describe("Blackbox dashboard guru", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  let authSession: AuthSession | null = null;

  test.beforeAll(async () => {
    if (!GURU_ACCOUNT.password?.trim()) {
      authSession = await createRoleAuthSession(GURU_ACCOUNT);
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await authenticateRole(page, GURU_ACCOUNT, authSession);
  });

  test("Login Guru", async ({ page }) => {
    await expectPageText(page, /Dashboard Guru|Jadwal Mengajar|Kelas/i);
  });

  test("Dashboard Guru", async ({ page }) => {
    await openLocalPage(page, "/dashboard-guru");
    await expectPageText(page, /Dashboard Guru|Jadwal Mengajar/i);
    await expectPageText(page, /Manajemen Kelas|Materi Pembelajaran|Latihan/i);
  });

  test("Jadwal & Kelas", async ({ page }) => {
    await openLocalPage(page, "/dashboard-guru/jadwal");
    await expectPageText(page, /Jadwal Minggu Ini|Daftar kelas aktif/i);
    await openLocalPage(page, "/dashboard-guru/kelas");
    await expectPageText(page, /Semua Kelas Saya/i);
    await expectPageText(page, /Total Kelas|Cari dan Filter Kelas/i);
  });

  test("Kelola Absensi", async ({ page }) => {
    await openGuruClassPage(page, "/dashboard-guru/absensi-kelas");
    await expectPageText(page, /Absensi Kelas/i);
    await expectPageText(page, /Daftar Kehadiran Siswa|Mulai Absensi QR/i);
  });

  test("Kelola Materi", async ({ page }) => {
    await openGuruClassPage(page, "/dashboard-guru/detail-kelas");
    await page.getByRole("button", { name: /Detail Pertemuan/i }).click();
    await expectPageText(page, /Detail Kelas Guru/i);
    await expectPageText(page, /Materi Aktif|Tambah Materi|Materi/i);
  });

  test("Kelola Tugas & Penilaian", async ({ page }) => {
    await openGuruClassPage(page, "/dashboard-guru/detail-kelas");
    await page.getByRole("button", { name: /Latihan Setiap Pertemuan/i }).click();
    await expectPageText(page, /Latihan Berjalan|Tambah Latihan|Latihan/i);
    await page.getByRole("button", { name: /Tabel Nilai/i }).click();
    await expectPageText(page, /Tabel Nilai|Nilai|UTS|UAS/i);
  });

  test("Tryout/Ujian", async ({ page }) => {
    await openLocalPage(page, "/dashboard-guru/ujian");
    await expectPageText(page, /Dashboard Ujian Guru|Manajemen Ujian/i);
    await expectPageText(page, /Total Ujian|Daftar Ujian|Tryout/i);
  });

  test("Profil Guru", async ({ page }) => {
    await openGuruProfileDialog(page);
    await expectPageText(page, /Kelola nama, email, foto profil/i);
    await expectPageText(page, /Simpan Profil/i);
  });

  test("Ubah Password Guru", async ({ page }) => {
    await openGuruProfileDialog(page);
    await page.getByRole("tab", { name: /Ubah Password/i }).click();
    await expectPageText(page, /Password lama/i);
    await expectPageText(page, /Password baru/i);
    await expectPageText(page, /Konfirmasi password baru/i);
  });

  test("Logout Guru", async ({ page }) => {
    await openAccountMenu(page, /Guru|TCH|Pengajar/i);
    await page.getByRole("menuitem", { name: /Logout/i }).click();
    await page.waitForURL(/\/login(?:\?|$)/, { timeout: 60_000 });
    await expect(page.locator("#identifier")).toBeVisible({ timeout: 30_000 });
  });
});
