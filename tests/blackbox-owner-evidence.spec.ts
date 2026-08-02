import { expect, test, type Page } from "@playwright/test";
import { createRequire } from "module";
import fs from "fs";
import path from "path";

const BASE_URL = process.env.BLACKBOX_BASE_URL ?? "http://localhost:3000";
const HAS_EXPLICIT_OWNER_PASSWORD = Boolean(process.env.BLACKBOX_OWNER_PASSWORD?.trim());
const OWNER_ACCOUNT = {
  identifier: process.env.BLACKBOX_OWNER_IDENTIFIER ?? "raflimhmmd621@gmail.com",
  password: process.env.BLACKBOX_OWNER_PASSWORD ?? "",
};

type AuthUser = {
  _id: string;
  nama: string;
  email: string;
  loginCode: string | null;
  avatar: string | null;
  role: "owner";
  isEmailVerified: boolean;
  createdAt: string;
  updatedAt: string;
};

type OwnerDbDocument = {
  _id: { toString(): string };
  nama?: string;
  email?: string;
  loginCode?: string | null;
  avatar?: string | null;
  role?: string;
  isEmailVerified?: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

const backendRequire = createRequire(path.join(process.cwd(), "backend", "package.json"));

async function openLocalPage(page: Page, pathName: string) {
  await page.goto(`${BASE_URL}${pathName}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
}

async function expectPageText(page: Page, text: RegExp | string) {
  await expect(page.locator("body")).toContainText(text, { timeout: 60_000 });
}

function readBackendEnvValue(key: string) {
  const envPath = path.join(process.cwd(), "backend", ".env");
  const envText = fs.readFileSync(envPath, "utf8");
  const prefix = `${key}=`;
  const line = envText
    .split(/\r?\n/)
    .find((entry) => entry.trimStart().startsWith(prefix));
  const rawValue = line?.slice(line.indexOf("=") + 1).trim();

  if (!rawValue) {
    throw new Error(`Environment backend ${key} tidak ditemukan.`);
  }

  return rawValue.replace(/^['"]|['"]$/g, "");
}

function toIsoString(value: Date | string | undefined) {
  const date = value ? new Date(value) : new Date();

  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

async function createOwnerAuthSession() {
  const mongoose = backendRequire("mongoose") as {
    connect: (uri: string) => Promise<void>;
    disconnect: () => Promise<void>;
    connection: {
      db?: {
        collection: (name: string) => {
          findOne: (
            filter: Record<string, unknown>,
            options?: Record<string, unknown>,
          ) => Promise<OwnerDbDocument | null>;
        };
      };
    };
  };
  const jwt = backendRequire("jsonwebtoken") as {
    sign: (
      payload: Record<string, unknown>,
      secret: string,
      options: { expiresIn: string },
    ) => string;
  };

  await mongoose.connect(readBackendEnvValue("MONGO_URI"));

  try {
    const dbUser = await mongoose.connection.db?.collection("users").findOne(
      {
        email: OWNER_ACCOUNT.identifier.trim().toLowerCase(),
        role: "owner",
      },
      {
        projection: {
          _id: 1,
          nama: 1,
          email: 1,
          loginCode: 1,
          avatar: 1,
          role: 1,
          isEmailVerified: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    );

    if (!dbUser) {
      throw new Error("Akun owner untuk evidence tidak ditemukan di database.");
    }

    if (dbUser.role !== "owner" || !dbUser.isEmailVerified) {
      throw new Error("Akun owner evidence belum valid atau belum terverifikasi.");
    }

    const user: AuthUser = {
      _id: dbUser._id.toString(),
      nama: dbUser.nama ?? "Owner",
      email: dbUser.email ?? OWNER_ACCOUNT.identifier,
      loginCode: typeof dbUser.loginCode === "string" ? dbUser.loginCode : null,
      avatar: typeof dbUser.avatar === "string" ? dbUser.avatar : null,
      role: "owner",
      isEmailVerified: true,
      createdAt: toIsoString(dbUser.createdAt),
      updatedAt: toIsoString(dbUser.updatedAt),
    };
    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
      },
      readBackendEnvValue("JWT_SECRET"),
      {
        expiresIn: readBackendEnvValue("JWT_EXPIRES_IN"),
      },
    );

    return {
      token,
      user,
    };
  } finally {
    await mongoose.disconnect();
  }
}

async function installOwnerSession(
  page: Page,
  session: Awaited<ReturnType<typeof createOwnerAuthSession>>,
) {
  await page.context().addCookies([
    {
      name: "bimbel_auth_token",
      value: session.token,
      url: BASE_URL,
      httpOnly: true,
      sameSite: "Lax",
    },
    {
      name: "bimbel_auth_role",
      value: "owner",
      url: BASE_URL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  await openLocalPage(page, "/login");
  await page.evaluate(
    ({ token, user }) => {
      window.localStorage.setItem("bimbel.auth.token", token);
      window.localStorage.setItem("bimbel.auth.role", "owner");
      window.localStorage.setItem("bimbel.auth.user", JSON.stringify(user));
      window.localStorage.setItem("bimbel.auth.lastActivityAt", Date.now().toString());
    },
    session,
  );
}

async function tryLoginAsOwner(page: Page) {
  await openLocalPage(page, "/login");
  await expect(page.locator("#identifier")).toBeVisible({ timeout: 30_000 });
  await page.locator("#identifier").fill(OWNER_ACCOUNT.identifier);
  await page.locator("#password").fill(OWNER_ACCOUNT.password);
  await page.getByRole("button", { name: /^Login$/i }).click();
  await page.waitForURL(/\/dashboard-owner(?:\/|\?|$)/, { timeout: 60_000 });
  await expectPageText(page, /Owner Workspace/i);
}

async function authenticateOwner(page: Page) {
  if (HAS_EXPLICIT_OWNER_PASSWORD) {
    await tryLoginAsOwner(page);
    return;
  }

  const session = await createOwnerAuthSession();

  await installOwnerSession(page, session);
  await openLocalPage(page, "/dashboard-owner");
  await expectPageText(page, /Owner Workspace/i);
}

test.describe("Blackbox dashboard owner", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await authenticateOwner(page);
  });

  test("Login Owner", async ({ page }) => {
    await expectPageText(page, /Owner Workspace/i);
    await expectPageText(page, /Dashboard/i);
  });

  test("Dashboard Owner", async ({ page }) => {
    await openLocalPage(page, "/dashboard-owner");
    await expectPageText(page, /Omzet/i);
    await expectPageText(page, /Aktivitas Sistem/i);
    await expectPageText(page, /Ringkasan Keuangan/i);
  });

  test("Kelola Cabang", async ({ page }) => {
    await openLocalPage(page, "/dashboard-owner/cabang");
    await expectPageText(page, /Manajemen Cabang/i);
    await expectPageText(page, /Nama Cabang/i);
    await expectPageText(page, /Status/i);
    await expectPageText(page, /Reset filter/i);
  });

  test("Kelola Admin Cabang", async ({ page }) => {
    await openLocalPage(page, "/dashboard-owner/admin-cabang");
    await expectPageText(page, /Admin Cabang/i);
    await expectPageText(page, /Cabang/i);
    await expectPageText(page, /Reset filter/i);
  });

  test("Informasi Pembayaran", async ({ page }) => {
    await openLocalPage(page, "/dashboard-owner/aktivitas?tab=masuk&incomingStatus=paid");
    await expectPageText(page, /Pembayaran masuk/i);
    await expectPageText(page, /Ringkasan pembayaran masuk/i);
    await expectPageText(page, /Lunas/i);
    await expectPageText(page, /Status/i);
  });

  test("Aktivasi Membership Siswa", async ({ page }) => {
    await openLocalPage(
      page,
      "/dashboard-owner/aktivitas?tab=aktivasi&activationStatus=active",
    );
    await expectPageText(page, /Aktivasi Membership/i);
    await expectPageText(page, /Ringkasan aktivasi siswa/i);
    await expectPageText(page, /Status Pembayaran/i);
    await expectPageText(page, /Status Aktivasi/i);
  });

  test("Pengeluaran", async ({ page }) => {
    await openLocalPage(page, "/dashboard-owner/aktivitas?tab=keluar&outgoingStatus=selesai");
    await expectPageText(page, /Pengeluaran/i);
    await expectPageText(page, /Ringkasan pembayaran keluar/i);
    await expectPageText(page, /Judul Pengeluaran/i);
    await expectPageText(page, /Status/i);
  });

  test("Profil Owner", async ({ page }) => {
    await openLocalPage(page, "/dashboard-owner/profil");
    await expectPageText(page, /Profil Pengguna/i);
    await expectPageText(page, /Kelola data akun owner/i);
    await expectPageText(page, /Ubah Password/i);
  });

  test("Ubah Password Owner", async ({ page }) => {
    await openLocalPage(page, "/dashboard-owner/profil");
    await page.getByRole("tab", { name: /Ubah Password/i }).click();
    await expectPageText(page, /Password lama/i);
    await expectPageText(page, /Password baru/i);
    await expectPageText(page, /Konfirmasi password baru/i);
  });

  test("Logout Owner", async ({ page }) => {
    await page.locator("header button").last().click();
    await page.getByRole("menuitem", { name: /Logout/i }).click();
    await page.waitForURL(/\/login(?:\?|$)/, { timeout: 60_000 });
    await expect(page.locator("#identifier")).toBeVisible({ timeout: 30_000 });
  });
});
