import dotenv from "dotenv";
import path from "path";

dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
});

export const REQUIRED_ENV_KEYS = [
  "PORT",
  "MONGO_URI",
  "JWT_SECRET",
  "JWT_EXPIRES_IN",
  "API_KEY",
  "CLIENT_URL",
] as const;

const PLACEHOLDER_PATTERNS = [
  /ganti/i,
  /placeholder/i,
  /example/i,
  /akun-email-anda/i,
  /password-aplikasi-email-anda/i,
] as const;

export interface EnvConfig {
  port: number;
  mongoUri: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  apiKey: string;
  clientUrl: string;
  googleClientId: string | null;
  emailUser: string | null;
  emailPass: string | null;
  isEmailConfigured: boolean;
  xenditApiKey: string | null;
  xenditWebhookToken: string | null;
  allowPublicDummyPaymentConfirm: boolean;
}

let cachedEnv: EnvConfig | null = null;

function sanitizeOptionalEnv(value: string | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmedValue))) {
    return null;
  }

  return trimmedValue;
}

export function validateEnv(): EnvConfig {
  if (cachedEnv) {
    return cachedEnv;
  }

  const missingKeys = REQUIRED_ENV_KEYS.filter((key) => {
    const value = process.env[key];
    return typeof value !== "string" || !value.trim();
  });

  if (missingKeys.length > 0) {
    throw new Error(`Environment backend belum lengkap: ${missingKeys.join(", ")}`);
  }

  const emailUser = sanitizeOptionalEnv(process.env.EMAIL_USER);
  const emailPass = sanitizeOptionalEnv(process.env.EMAIL_PASS);

  cachedEnv = {
    port: Number(process.env.PORT) || 5000,
    mongoUri: process.env.MONGO_URI!.trim(),
    jwtSecret: process.env.JWT_SECRET!.trim(),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN!.trim(),
    apiKey: process.env.API_KEY!.trim(),
    clientUrl: process.env.CLIENT_URL!.trim(),
    googleClientId: sanitizeOptionalEnv(process.env.GOOGLE_CLIENT_ID),
    emailUser,
    emailPass,
    isEmailConfigured: Boolean(emailUser && emailPass),
    xenditApiKey: sanitizeOptionalEnv(process.env.XENDIT_API_KEY),
    xenditWebhookToken: sanitizeOptionalEnv(process.env.XENDIT_WEBHOOK_TOKEN),
    allowPublicDummyPaymentConfirm:
      sanitizeOptionalEnv(process.env.ALLOW_PUBLIC_DUMMY_PAYMENT_CONFIRM) === "true",
  };

  return cachedEnv;
}
