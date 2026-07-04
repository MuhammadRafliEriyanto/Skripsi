export const USER_ROLES = ["owner", "admin", "guru", "siswa"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export type AuthUser = {
  _id: string;
  nama: string;
  email: string;
  loginCode?: string | null;
  avatar: string | null;
  role: UserRole;
  isEmailVerified: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ApiErrorDetails = Record<string, string> | string[] | null | undefined;

export type ApiResponse<T extends Record<string, unknown> = Record<string, never>> = {
  success: boolean;
  message: string;
  data?: T;
  errorCode?: string;
  errors?: ApiErrorDetails;
};

export type LoginPayload = {
  identifier?: string;
  email?: string;
  password: string;
  rememberMe?: boolean;
};

export type GoogleLoginPayload = {
  credential: string;
  rememberMe?: boolean;
};

export type UpdateProfilePayload = {
  nama: string;
  email: string;
  avatar: string | null;
};

export type ChangePasswordPayload = {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
};

export type ForgotPasswordPayload = {
  email: string;
};

export type ResetPasswordPayload = {
  email: string;
  code: string;
  newPassword: string;
  confirmNewPassword: string;
};

export type RegisterPayload = {
  nama: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: UserRole;
};

export type LoginResponse = ApiResponse<{
  token: string;
  user: AuthUser;
  role: UserRole;
  redirectPath: string;
}>;

export type RegisterResponse = ApiResponse<{
  email: string;
  verificationEmailSent: boolean;
}>;

export type VerifyEmailResponse = ApiResponse<{
  user: AuthUser;
  role: UserRole;
  redirectPath: string;
  verificationStatus: string;
}>;

export type MeResponse = ApiResponse<{
  user: AuthUser;
  role: UserRole;
  redirectPath: string;
}>;

export type UpdateProfileResponse = ApiResponse<{
  user: AuthUser;
  role: UserRole;
  redirectPath: string;
}>;

export type ChangePasswordResponse = ApiResponse<Record<string, never>>;

export type ForgotPasswordResponse = ApiResponse<{
  email: string;
}>;

export type ResetPasswordResponse = ApiResponse<Record<string, never>>;

export type LogoutResponse = ApiResponse<Record<string, never>>;

export const AUTH_TOKEN_COOKIE_NAME = "bimbel_auth_token";
export const AUTH_ROLE_COOKIE_NAME = "bimbel_auth_role";
export const AUTH_USER_STORAGE_KEY = "bimbel.auth.user";
export const AUTH_ROLE_STORAGE_KEY = "bimbel.auth.role";
export const AUTH_TOKEN_STORAGE_KEY = "bimbel.auth.token";
export const AUTH_USER_UPDATED_EVENT = "bimbel:auth-user-updated";

const ROLE_REDIRECT_MAP: Record<UserRole, string> = {
  owner: "/dashboard-owner",
  admin: "/dashboard-admin",
  guru: "/dashboard-guru",
  siswa: "/dashboard-siswa",
};

export class AuthRequestError extends Error {
  status: number;
  errorCode?: string;
  errors?: ApiErrorDetails;

  constructor(message: string, status: number, errors?: ApiErrorDetails, errorCode?: string) {
    super(message);
    this.name = "AuthRequestError";
    this.status = status;
    this.errors = errors;
    this.errorCode = errorCode;
  }
}

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && USER_ROLES.includes(value as UserRole);
}

export function getRedirectPathForRole(role: UserRole) {
  return ROLE_REDIRECT_MAP[role];
}

async function requestJson<T extends Record<string, unknown>>(
  url: string,
  init: RequestInit,
): Promise<ApiResponse<T>> {
  const headers = new Headers(init.headers);
  const isFormDataBody =
    typeof FormData !== "undefined" && init.body instanceof FormData;

  const storedToken = readPersistedAuthToken();

  if (storedToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${storedToken}`);
  }

  if (!isFormDataBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok || !payload?.success) {
    console.error('Fetch error:', { status: response.status, payload });
    throw new AuthRequestError(
      payload?.message || "Terjadi kesalahan saat memproses permintaan auth.",
      response.status,
      payload?.errors,
      payload?.errorCode,
    );
  }

  return payload;
}

export const authService = {
  login(payload: LoginPayload) {
    return requestJson<{
      token: string;
      user: AuthUser;
      role: UserRole;
      redirectPath: string;
    }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  googleLogin(payload: GoogleLoginPayload) {
    return requestJson<{
      token: string;
      user: AuthUser;
      role: UserRole;
      redirectPath: string;
    }>("/api/auth/google", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  register(payload: RegisterPayload) {
    return requestJson<{
      email: string;
      verificationEmailSent: boolean;
    }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  verifyEmail(token: string) {
    return requestJson<{
      user: AuthUser;
      role: UserRole;
      redirectPath: string;
    }>(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, {
      method: "GET",
    });
  },
  me() {
    return requestJson<{
      user: AuthUser;
      role: UserRole;
      redirectPath: string;
    }>("/api/auth/me", {
      method: "GET",
    });
  },
  updateProfile(payload: UpdateProfilePayload) {
    return requestJson<{
      user: AuthUser;
      role: UserRole;
      redirectPath: string;
    }>("/api/auth/me", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  changePassword(payload: ChangePasswordPayload) {
    return requestJson<Record<string, never>>("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  forgotPassword(payload: ForgotPasswordPayload) {
    return requestJson<{
      email: string;
    }>("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  resetPassword(payload: ResetPasswordPayload) {
    return requestJson<Record<string, never>>("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  logout() {
    return requestJson<Record<string, never>>("/api/auth/logout", {
      method: "POST",
    });
  },
};

export function persistAuthUser(user: AuthUser) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
  window.localStorage.setItem(AUTH_ROLE_STORAGE_KEY, user.role);
  window.dispatchEvent(
    new CustomEvent(AUTH_USER_UPDATED_EVENT, {
      detail: {
        user,
      },
    }),
  );
}

export function persistAuthToken(token: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
}

export function readPersistedAuthToken() {
  if (typeof window === "undefined") {
    return null;
  }

  const token = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)?.trim();

  return token || null;
}

export function clearAuthClientState() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
  window.localStorage.removeItem(AUTH_ROLE_STORAGE_KEY);
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  window.dispatchEvent(
    new CustomEvent(AUTH_USER_UPDATED_EVENT, {
      detail: {
        user: null,
      },
    }),
  );
}

export function readPersistedAuthUser() {
  if (typeof window === "undefined") {
    return null;
  }

  const serializedUser = window.localStorage.getItem(AUTH_USER_STORAGE_KEY);

  if (!serializedUser) {
    return null;
  }

  try {
    const parsedUser = JSON.parse(serializedUser) as Partial<AuthUser> | null;

    if (
      !parsedUser ||
      typeof parsedUser._id !== "string" ||
      typeof parsedUser.nama !== "string" ||
      typeof parsedUser.email !== "string" ||
      !(
        !("loginCode" in parsedUser) ||
        parsedUser.loginCode === null ||
        typeof parsedUser.loginCode === "string"
      ) ||
      !("avatar" in parsedUser) ||
      !(
        parsedUser.avatar === null ||
        typeof parsedUser.avatar === "string"
      ) ||
      !isUserRole(parsedUser.role) ||
      typeof parsedUser.isEmailVerified !== "boolean" ||
      typeof parsedUser.createdAt !== "string" ||
      typeof parsedUser.updatedAt !== "string"
    ) {
      clearAuthClientState();
      return null;
    }

    return parsedUser as AuthUser;
  } catch {
    clearAuthClientState();
    return null;
  }
}

export function withStoredAuthHeader(init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const storedToken = readPersistedAuthToken();

  if (storedToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${storedToken}`);
  }

  return {
    ...init,
    headers,
  };
}
