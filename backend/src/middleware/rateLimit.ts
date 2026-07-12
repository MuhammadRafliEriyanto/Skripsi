import type { NextFunction, Request, Response } from "express";

import { AppError } from "../utils/apiResponse";

type RateLimitOptions = {
  keyPrefix: string;
  windowMs: number;
  max: number;
  message: string;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitBucket>();
const MAX_BUCKETS_BEFORE_CLEANUP = 10000;

function getClientIp(req: Request) {
  const forwardedFor = req.headers["x-forwarded-for"];
  const forwardedValue = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  const forwardedIp = forwardedValue?.split(",")[0]?.trim();

  return forwardedIp || req.ip || req.socket.remoteAddress || "unknown";
}

function cleanupExpiredBuckets(now: number) {
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function createRateLimit(options: RateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const clientIp = getClientIp(req);
    const key = `${options.keyPrefix}:${clientIp}`;
    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      bucket = {
        count: 0,
        resetAt: now + options.windowMs,
      };
    }

    bucket.count += 1;
    buckets.set(key, bucket);

    if (buckets.size > MAX_BUCKETS_BEFORE_CLEANUP) {
      cleanupExpiredBuckets(now);
    }

    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    const remaining = Math.max(0, options.max - bucket.count);

    res.setHeader("RateLimit-Limit", String(options.max));
    res.setHeader("RateLimit-Remaining", String(remaining));
    res.setHeader("RateLimit-Reset", String(retryAfterSeconds));

    if (bucket.count > options.max) {
      res.setHeader("Retry-After", String(retryAfterSeconds));
      next(
        new AppError(
          429,
          options.message,
          { retryAfterSeconds },
          "RATE_LIMIT_EXCEEDED",
        ),
      );
      return;
    }

    next();
  };
}

export const authLoginRateLimit = createRateLimit({
  keyPrefix: "auth-login",
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Terlalu banyak percobaan login. Coba lagi beberapa menit lagi.",
});

export const authRegisterRateLimit = createRateLimit({
  keyPrefix: "auth-register",
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: "Terlalu banyak percobaan registrasi. Coba lagi nanti.",
});

export const passwordResetRateLimit = createRateLimit({
  keyPrefix: "password-reset",
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Terlalu banyak percobaan reset password. Coba lagi beberapa menit lagi.",
});

export const paymentStatusRateLimit = createRateLimit({
  keyPrefix: "payment-status",
  windowMs: 60 * 1000,
  max: 60,
  message: "Terlalu banyak pengecekan status pembayaran. Coba lagi sebentar lagi.",
});

export const sensitiveActionRateLimit = createRateLimit({
  keyPrefix: "sensitive-action",
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Terlalu banyak request untuk aksi sensitif. Coba lagi beberapa menit lagi.",
});
