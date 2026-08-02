import { requestAdminApi } from "@/lib/admin-api";

export type OwnerBranchAdminOption = {
  id: string;
  name: string;
  email: string;
};

export type OwnerBranchAdminAccount = OwnerBranchAdminOption & {
  isEmailVerified: boolean;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type OwnerBranchAdminApiItem = {
  id?: string;
  name?: string;
  email?: string;
  isEmailVerified?: boolean;
  emailVerifiedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateOwnerBranchAdminAccountPayload = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export type UpdateOwnerBranchAdminAccountPayload = {
  name: string;
  email: string;
  password?: string;
  confirmPassword?: string;
};

export type OwnerBranchAdminAccountUpdateRequestBody = {
  name: string;
  email: string;
  password?: string;
  confirmPassword?: string;
};

export type OwnerBranchAdminAccountMutationResult = {
  admin?: OwnerBranchAdminApiItem;
  email?: string;
  verificationEmailSent?: boolean;
};

export type OwnerBranchAdminPasswordResetCredentials = {
  email: string;
  password: string;
};

export type OwnerBranchAdminPasswordResetResult = {
  admin?: OwnerBranchAdminApiItem;
  credentials?: OwnerBranchAdminPasswordResetCredentials;
};

export function normalizeOwnerBranchAdminName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function toOwnerBranchAdminOption(
  admin: OwnerBranchAdminApiItem,
): OwnerBranchAdminOption | null {
  const id = String(admin.id ?? "").trim();
  const name = normalizeOwnerBranchAdminName(String(admin.name ?? ""));
  const email = String(admin.email ?? "").trim().toLowerCase();

  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    email,
  };
}

function toOwnerBranchAdminAccount(
  admin: OwnerBranchAdminApiItem,
): OwnerBranchAdminAccount | null {
  const option = toOwnerBranchAdminOption(admin);
  const emailVerifiedAt =
    typeof admin.emailVerifiedAt === "string" && admin.emailVerifiedAt.trim()
      ? admin.emailVerifiedAt.trim()
      : null;
  const createdAt = String(admin.createdAt ?? "").trim();
  const updatedAt = String(admin.updatedAt ?? "").trim();

  if (!option || !createdAt || !updatedAt) {
    return null;
  }

  return {
    ...option,
    isEmailVerified: admin.isEmailVerified === true,
    emailVerifiedAt,
    createdAt,
    updatedAt,
  };
}

function readAdminItems(
  payload: { data?: { admins?: OwnerBranchAdminApiItem[] } },
) {
  return Array.isArray(payload.data?.admins) ? payload.data.admins : [];
}

export function readOwnerBranchAdminOptions(
  payload: { data?: { admins?: OwnerBranchAdminApiItem[] } },
) {
  return readAdminItems(payload)
    .map((admin) => toOwnerBranchAdminOption(admin))
    .filter((admin): admin is OwnerBranchAdminOption => admin !== null);
}

export function readOwnerBranchAdminAccounts(
  payload: { data?: { admins?: OwnerBranchAdminApiItem[] } },
) {
  return readAdminItems(payload)
    .map((admin) => toOwnerBranchAdminAccount(admin))
    .filter((admin): admin is OwnerBranchAdminAccount => admin !== null);
}

export async function fetchOwnerBranchAdminOptionsFromApi() {
  const payload = await requestAdminApi<{ admins: OwnerBranchAdminApiItem[] }>(
    "/api/branches/admin-options",
    {
      method: "GET",
    },
  );

  return readOwnerBranchAdminOptions(payload);
}

export async function fetchOwnerBranchAdminAccountsFromApi() {
  const payload = await requestAdminApi<{ admins: OwnerBranchAdminApiItem[] }>(
    "/api/branches/admin-accounts",
    {
      method: "GET",
    },
  );

  return readOwnerBranchAdminAccounts(payload);
}

export async function createOwnerBranchAdminAccount(
  payload: CreateOwnerBranchAdminAccountPayload,
) {
  return requestAdminApi<OwnerBranchAdminAccountMutationResult>(
    "/api/branches/admin-accounts",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function updateOwnerBranchAdminAccount(
  adminId: string,
  payload: UpdateOwnerBranchAdminAccountPayload,
) {
  return requestAdminApi<{ admin: OwnerBranchAdminApiItem }>(
    `/api/branches/admin-accounts/${encodeURIComponent(adminId)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
}

export async function deleteOwnerBranchAdminAccount(adminId: string) {
  return requestAdminApi<Record<string, never>>(
    `/api/branches/admin-accounts/${encodeURIComponent(adminId)}`,
    {
      method: "DELETE",
    },
  );
}

export async function resendOwnerBranchAdminVerification(adminId: string) {
  return requestAdminApi<OwnerBranchAdminAccountMutationResult>(
    `/api/branches/admin-accounts/${encodeURIComponent(adminId)}/resend-verification`,
    {
      method: "POST",
    },
  );
}

export async function resetOwnerBranchAdminPassword(adminId: string) {
  return requestAdminApi<OwnerBranchAdminPasswordResetResult>(
    `/api/branches/admin-accounts/${encodeURIComponent(adminId)}/reset-password`,
    {
      method: "POST",
    },
  );
}
