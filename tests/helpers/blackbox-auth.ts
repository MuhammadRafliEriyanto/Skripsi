import { expect, type Page } from "@playwright/test";
import { createRequire } from "module";
import fs from "fs";
import path from "path";

export const BASE_URL =
  process.env.BLACKBOX_BASE_URL ?? "http://localhost:3000";

export type EvidenceRole = "owner" | "admin" | "guru" | "siswa";

export type AuthUser = {
  _id: string;
  nama: string;
  email: string;
  loginCode: string | null;
  avatar: string | null;
  role: EvidenceRole;
  isEmailVerified: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
};

export type RoleAccount = {
  role: EvidenceRole;
  identifier: string;
  password?: string;
  dashboardPath: string;
  dashboardText: RegExp | string;
};

type DbUserDocument = {
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

type DbIdentityDocument = {
  studentId?: string;
  teacherId?: string;
  userId?: unknown;
};

type DbCollection = {
  findOne: <TDocument = Record<string, unknown>>(
    filter: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => Promise<TDocument | null>;
};

type MongooseLike = {
  connect: (uri: string) => Promise<void>;
  disconnect: () => Promise<void>;
  connection: {
    db?: {
      collection: (name: string) => DbCollection;
    };
  };
};

type JsonWebTokenLike = {
  sign: (
    payload: Record<string, unknown>,
    secret: string,
    options: { expiresIn: string },
  ) => string;
};

const backendRequire = createRequire(
  path.join(process.cwd(), "backend", "package.json"),
);

export async function openLocalPage(page: Page, pathName: string) {
  await page.goto(`${BASE_URL}${pathName}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page
    .waitForLoadState("networkidle", { timeout: 30_000 })
    .catch(() => undefined);
}

export async function expectPageText(page: Page, text: RegExp | string) {
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

  return Number.isNaN(date.getTime())
    ? new Date().toISOString()
    : date.toISOString();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeIdentifierFilter(identifier: string, role: EvidenceRole) {
  const normalizedIdentifier = identifier.trim();

  if (!normalizedIdentifier) {
    throw new Error(`Identifier akun ${role} untuk evidence belum diisi.`);
  }

  return {
    role,
    $or: [
      { email: normalizedIdentifier.toLowerCase() },
      { loginCode: normalizedIdentifier.toUpperCase() },
    ],
  };
}

function buildLoginCodeCandidates(identifier: string) {
  const normalizedIdentifier = identifier.trim().toUpperCase().replace(/\s+/g, "");

  if (!normalizedIdentifier) {
    return [];
  }

  const candidates = new Set([normalizedIdentifier]);
  const compactIdentifier = normalizedIdentifier.replace(/-/g, "");
  candidates.add(compactIdentifier);

  const accountCodeMatch = compactIdentifier.match(/^(STD|TCH)(\d+)$/);
  if (accountCodeMatch?.[1] && accountCodeMatch[2]) {
    candidates.add(`${accountCodeMatch[1]}-${accountCodeMatch[2].padStart(3, "0")}`);
  }

  return Array.from(candidates);
}

async function findRoleLinkedUser(
  mongoose: MongooseLike,
  account: RoleAccount,
) {
  const db = mongoose.connection.db;
  if (!db || (account.role !== "siswa" && account.role !== "guru")) {
    return null;
  }

  const loginCodeCandidates = buildLoginCodeCandidates(account.identifier);
  if (!loginCodeCandidates.length) {
    return null;
  }

  const identityCollection = account.role === "siswa" ? "students" : "teachers";
  const identityField = account.role === "siswa" ? "studentId" : "teacherId";
  const linkedIdentity = await db.collection(identityCollection).findOne<DbIdentityDocument>(
    {
      [identityField]: {
        $in: loginCodeCandidates,
      },
    },
    {
      projection: {
        [identityField]: 1,
        userId: 1,
      },
    },
  );

  if (!linkedIdentity?.userId) {
    return null;
  }

  const dbUser = await db.collection("users").findOne<DbUserDocument>(
    {
      _id: linkedIdentity.userId,
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

  return {
    dbUser,
    loginCode:
      account.role === "siswa"
        ? linkedIdentity.studentId ?? null
        : linkedIdentity.teacherId ?? null,
  };
}

export async function createRoleAuthSession(account: RoleAccount) {
  const mongoose = backendRequire("mongoose") as MongooseLike;
  const jwt = backendRequire("jsonwebtoken") as JsonWebTokenLike;

  await mongoose.connect(readBackendEnvValue("MONGO_URI"));

  try {
    let linkedLoginCode: string | null = null;
    let dbUser = await mongoose.connection.db?.collection("users").findOne<DbUserDocument>(
      normalizeIdentifierFilter(account.identifier, account.role),
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
      const linkedUser = await findRoleLinkedUser(mongoose, account);
      dbUser = linkedUser?.dbUser ?? null;
      linkedLoginCode = linkedUser?.loginCode ?? null;
    }

    if (!dbUser) {
      throw new Error(
        `Akun ${account.role} untuk evidence tidak ditemukan di database.`,
      );
    }

    if (dbUser.role !== account.role || !dbUser.isEmailVerified) {
      throw new Error(
        `Akun ${account.role} evidence belum valid atau belum terverifikasi.`,
      );
    }

    const user: AuthUser = {
      _id: dbUser._id.toString(),
      nama: dbUser.nama ?? account.role,
      email: dbUser.email ?? account.identifier,
      loginCode:
        typeof dbUser.loginCode === "string" ? dbUser.loginCode : linkedLoginCode,
      avatar: typeof dbUser.avatar === "string" ? dbUser.avatar : null,
      role: account.role,
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
    } satisfies AuthSession;
  } finally {
    await mongoose.disconnect();
  }
}

export async function installRoleSession(page: Page, session: AuthSession) {
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
      value: session.user.role,
      url: BASE_URL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  await openLocalPage(page, "/login");
  await page.evaluate(
    ({ token, user }) => {
      window.localStorage.setItem("bimbel.auth.token", token);
      window.localStorage.setItem("bimbel.auth.role", user.role);
      window.localStorage.setItem("bimbel.auth.user", JSON.stringify(user));
      window.localStorage.setItem(
        "bimbel.auth.lastActivityAt",
        Date.now().toString(),
      );
    },
    session,
  );
}

export async function tryLoginAsRole(page: Page, account: RoleAccount) {
  if (!account.password?.trim()) {
    throw new Error(`Password akun ${account.role} untuk evidence belum diisi.`);
  }

  await openLocalPage(page, "/login");
  await expect(page.locator("#identifier")).toBeVisible({ timeout: 30_000 });
  await page.locator("#identifier").fill(account.identifier);
  await page.locator("#password").fill(account.password);
  await page.getByRole("button", { name: /^Login$/i }).click();
  await page.waitForURL(
    new RegExp(`${escapeRegExp(account.dashboardPath)}(?:/|\\?|$)`),
    { timeout: 60_000 },
  );
  await expectPageText(page, account.dashboardText);
}

export async function authenticateRole(
  page: Page,
  account: RoleAccount,
  session: AuthSession | null,
) {
  if (account.password?.trim()) {
    await tryLoginAsRole(page, account);
    return;
  }

  if (!session) {
    throw new Error(`Session ${account.role} untuk evidence belum tersedia.`);
  }

  await installRoleSession(page, session);
  await openLocalPage(page, account.dashboardPath);
  await expectPageText(page, account.dashboardText);
}

export async function openAccountMenu(page: Page, name: RegExp) {
  const accountButton = page.getByRole("button", { name }).last();

  await expect(accountButton).toBeVisible({ timeout: 30_000 });
  await accountButton.click();
}
