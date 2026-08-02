import type { UserDocument, UserRole } from "../models/User";
import { AppError } from "./apiResponse";

export const MAX_FAILED_LOGIN_ATTEMPTS = 3;
export const ACCOUNT_LOCKED_ERROR_CODE = "AUTH_ACCOUNT_LOCKED";
export const ACCOUNT_LOCKED_MESSAGE =
  "Akun terkunci karena 3 kali salah password. Hubungi admin untuk reset password.";

export function isLoginLockableRole(role: UserRole) {
  return role === "guru" || role === "siswa";
}

export function isUserLoginLocked(
  user: Pick<UserDocument, "role" | "lockedAt">,
) {
  return isLoginLockableRole(user.role) && Boolean(user.lockedAt);
}

export function createAccountLockedError() {
  return new AppError(
    423,
    ACCOUNT_LOCKED_MESSAGE,
    null,
    ACCOUNT_LOCKED_ERROR_CODE,
  );
}

export function clearUserLoginLock(user: UserDocument) {
  const hasLockState =
    (user.failedLoginAttempts ?? 0) !== 0 ||
    Boolean(user.lockedAt) ||
    Boolean(user.lockedReason);

  user.failedLoginAttempts = 0;
  user.lockedAt = null;
  user.lockedReason = null;

  return hasLockState;
}
