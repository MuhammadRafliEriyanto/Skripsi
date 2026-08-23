import dotenv from "dotenv";
import path from "path";

dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
});

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

function getOptionalEnv(...keys: string[]): string | null {
  for (const key of keys) {
    const value = sanitizeOptionalEnv(process.env[key]);

    if (value) {
      return value;
    }
  }

  return null;
}

function getVercelUrlEnv(...keys: string[]) {
  const value = getOptionalEnv(...keys);

  if (!value) {
    return null;
  }

  return value.startsWith("http://") || value.startsWith("https://")
    ? value
    : `https://${value}`;
}

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

  const mongoUri = getOptionalEnv("MONGO_URI", "MONGODB_URI");
  const jwtSecret = getOptionalEnv("JWT_SECRET");
  const jwtExpiresIn = getOptionalEnv("JWT_EXPIRES_IN") ?? "7d";
  const apiKey = getOptionalEnv("API_KEY", "AUTH_API_KEY");
  const clientUrl =
    getOptionalEnv("CLIENT_URL", "FRONTEND_URL") ??
    getVercelUrlEnv("VERCEL_PROJECT_PRODUCTION_URL", "VERCEL_URL") ??
    "http://localhost:3000";

  const missingKeys = [
    ...(!mongoUri ? ["MONGO_URI atau MONGODB_URI"] : []),
    ...(!jwtSecret ? ["JWT_SECRET"] : []),
    ...(!apiKey ? ["API_KEY atau AUTH_API_KEY"] : []),
  ];

  if (!mongoUri || !jwtSecret || !apiKey) {
    throw new Error(`Environment backend belum lengkap: ${missingKeys.join(", ")}`);
  }

  const emailUser = sanitizeOptionalEnv(process.env.EMAIL_USER);
  const emailPass = sanitizeOptionalEnv(process.env.EMAIL_PASS);

  cachedEnv = {
    port: Number(process.env.PORT) || 5000,
    mongoUri,
    jwtSecret,
    jwtExpiresIn,
    apiKey,
    clientUrl,
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
