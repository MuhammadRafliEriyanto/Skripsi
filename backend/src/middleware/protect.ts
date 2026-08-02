import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import { validateEnv } from "../config/env";
import { User } from "../models/User";
import { AppError } from "../utils/apiResponse";
import {
  createAccountLockedError,
  isUserLoginLocked,
} from "../utils/authLock";
import type { AuthJwtPayload } from "../utils/generateToken";

export default async function protect(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization ?? "";

  if (!authHeader.startsWith("Bearer ")) {
    next(new AppError(401, "Akses ditolak. Token tidak ditemukan."));
    return;
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    next(new AppError(401, "Akses ditolak. Token tidak ditemukan."));
    return;
  }

  try {
    const { jwtSecret } = validateEnv();
    const decoded = jwt.verify(token, jwtSecret) as AuthJwtPayload;
    const user = await User.findById(decoded.id);

    if (!user) {
      next(new AppError(401, "User tidak ditemukan."));
      return;
    }

    if (!user.isEmailVerified) {
      next(new AppError(403, "Email belum diverifikasi."));
      return;
    }

    if (isUserLoginLocked(user)) {
      next(createAccountLockedError());
      return;
    }

    req.user = user;
    next();
  } catch {
    next(new AppError(401, "Token tidak valid atau sudah kedaluwarsa."));
  }
}
