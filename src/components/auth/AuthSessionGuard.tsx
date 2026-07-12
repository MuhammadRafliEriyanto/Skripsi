"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import {
  AUTH_LAST_ACTIVITY_STORAGE_KEY,
  AUTH_TOKEN_STORAGE_KEY,
  AuthRequestError,
  authService,
  clearAuthClientState,
  getRedirectPathForRole,
  persistAuthActivity,
  persistAuthUser,
  readPersistedAuthActivity,
  type UserRole,
} from "@/lib/auth";

const DEFAULT_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const IDLE_CHECK_INTERVAL_MS = 10 * 1000;
const ACTIVITY_THROTTLE_MS = 1000;
const ACTIVITY_EVENTS = [
  "keydown",
  "mousedown",
  "mousemove",
  "pointerdown",
  "scroll",
  "touchstart",
] as const;

type AuthSessionGuardProps = {
  allowedRoles: UserRole[];
  children: ReactNode;
  idleTimeoutMs?: number;
};

export default function AuthSessionGuard({
  allowedRoles,
  children,
  idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS,
}: AuthSessionGuardProps) {
  const router = useRouter();
  const isEndingSessionRef = useRef(false);
  const lastActivityEventAtRef = useRef(0);

  const endSession = useCallback(async () => {
    if (isEndingSessionRef.current) {
      return;
    }

    isEndingSessionRef.current = true;

    try {
      await authService.logout();
    } catch (error) {
      console.error("[auth-session-guard] logout_failed", error);
    } finally {
      clearAuthClientState();
      router.replace("/login");
      router.refresh();
    }
  }, [router]);

  const isIdleExpired = useCallback(
    (now = Date.now()) => {
      const lastActivityAt = readPersistedAuthActivity();

      return Boolean(
        lastActivityAt && now - lastActivityAt >= idleTimeoutMs,
      );
    },
    [idleTimeoutMs],
  );

  const recordActivity = useCallback(() => {
    if (isEndingSessionRef.current) {
      return;
    }

    const now = Date.now();

    if (now - lastActivityEventAtRef.current < ACTIVITY_THROTTLE_MS) {
      return;
    }

    lastActivityEventAtRef.current = now;

    if (isIdleExpired(now)) {
      void endSession();
      return;
    }

    persistAuthActivity(now);
  }, [endSession, isIdleExpired]);

  useEffect(() => {
    let isMounted = true;

    async function validateCurrentSession() {
      try {
        const response = await authService.me();
        const user = response.data?.user;

        if (!isMounted) {
          return;
        }

        if (!user) {
          void endSession();
          return;
        }

        persistAuthUser(user);

        if (!allowedRoles.includes(user.role)) {
          router.replace(getRedirectPathForRole(user.role));
          router.refresh();
        }
      } catch (error) {
        if (
          error instanceof AuthRequestError &&
          (error.status === 401 || error.status === 403)
        ) {
          void endSession();
          return;
        }

        console.error("[auth-session-guard] validate_session_failed", error);
      }
    }

    const now = Date.now();

    if (isIdleExpired(now)) {
      void endSession();
      return () => {
        isMounted = false;
      };
    }

    persistAuthActivity(now);
    void validateCurrentSession();

    const intervalId = window.setInterval(() => {
      if (isIdleExpired()) {
        void endSession();
      }
    }, IDLE_CHECK_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        recordActivity();
      }
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (
        event.key === AUTH_TOKEN_STORAGE_KEY &&
        event.oldValue &&
        !event.newValue
      ) {
        void endSession();
      }

      if (
        event.key === AUTH_LAST_ACTIVITY_STORAGE_KEY &&
        event.newValue &&
        isIdleExpired()
      ) {
        void endSession();
      }
    };

    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, recordActivity, {
        passive: true,
      });
    });
    window.addEventListener("focus", recordActivity);
    window.addEventListener("storage", handleStorageChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, recordActivity);
      });
      window.removeEventListener("focus", recordActivity);
      window.removeEventListener("storage", handleStorageChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    allowedRoles,
    endSession,
    isIdleExpired,
    recordActivity,
    router,
  ]);

  return <>{children}</>;
}
