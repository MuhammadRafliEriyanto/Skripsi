import type { NextFunction, Request, Response } from "express";

const BLOCKED_OBJECT_KEY_PATTERN = /(^\$)|\./;
const MAX_SANITIZE_DEPTH = 20;

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > MAX_SANITIZE_DEPTH || value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1));
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    if (BLOCKED_OBJECT_KEY_PATTERN.test(key)) {
      continue;
    }

    sanitized[key] = sanitizeValue(nestedValue, depth + 1);
  }

  return sanitized;
}

export default function sanitizeRequestBody(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeValue(req.body);
  }

  next();
}
