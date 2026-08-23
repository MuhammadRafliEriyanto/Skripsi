import type { ErrorRequestHandler } from "express";

import { sendError } from "../utils/apiResponse";

type ValidationErrorShape = {
  errors: Record<string, { message: string }>;
};

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  void _next;

  let statusCode =
    typeof err.statusCode === "number"
      ? err.statusCode
      : typeof err.status === "number"
        ? err.status
        : 500;
  let message =
    typeof err.message === "string" && err.message
      ? err.message
      : "Terjadi kesalahan pada server.";
  let errors = err.errors ?? null;
  let errorCode = err.errorCode ?? null;

  if (err.code === 11000) {
    statusCode = 409;
    message = "Email sudah terdaftar.";
    errorCode = "EMAIL_ALREADY_EXISTS";
  }

  if (err.name === "ValidationError") {
    const validationError = err as ValidationErrorShape;

    statusCode = 400;
    errors = Object.keys(validationError.errors).reduce<Record<string, string>>(
      (accumulator, key) => {
        accumulator[key] = validationError.errors[key].message;
        return accumulator;
      },
      {},
    );
    message = "Data yang dikirim tidak valid.";
    errorCode = "VALIDATION_ERROR";
  }

  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Token tidak valid.";
    errorCode = "INVALID_JWT";
  }

  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token sudah kedaluwarsa.";
    errorCode = "EXPIRED_JWT";
  }

  if (err.type === "entity.too.large") {
    statusCode = 413;
    message =
      "Ukuran request terlalu besar. Kompres foto profil lalu coba lagi dengan ukuran yang lebih kecil.";
    errorCode = "REQUEST_ENTITY_TOO_LARGE";
  }

  if (statusCode === 500) {
    console.error("[Backend Error]", err);
  }

  sendError(res, {
    statusCode,
    message,
    errors,
    errorCode,
  });
};

export default errorHandler;
