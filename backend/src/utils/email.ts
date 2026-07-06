import nodemailer, { type Transporter } from "nodemailer";

import { validateEnv } from "../config/env";
import { AppError } from "./apiResponse";

interface SendVerificationEmailParams {
  nama: string;
  email: string;
  verificationLink: string;
  accountCredentials?: {
    loginCode: string;
    password: string;
  };
}

interface SendPasswordResetEmailParams {
  nama: string;
  email: string;
  resetCode: string;
  expiresAt: Date;
}

let cachedTransporter: Transporter | null = null;

function createTransporter(): Transporter {
  const { emailUser, emailPass, isEmailConfigured } = validateEnv();

  if (!isEmailConfigured || !emailUser || !emailPass) {
    throw new AppError(
      503,
      "SMTP belum dikonfigurasi. Isi EMAIL_USER dan EMAIL_PASS valid di backend/.env.",
      null,
      "EMAIL_NOT_CONFIGURED",
    );
  }

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    });
  }

  return cachedTransporter;
}

export async function verifyEmailTransport(): Promise<void> {
  const { emailUser, isEmailConfigured } = validateEnv();

  if (!isEmailConfigured || !emailUser) {
    console.warn("SMTP belum dikonfigurasi. Server tetap berjalan, tetapi email verifikasi belum aktif.");
    return;
  }

  const transporter = createTransporter();

  try {
    await transporter.verify();
    console.log(`SMTP ready: ${emailUser}`);
  } catch (error) {
    const providerMessage = error instanceof Error ? error.message : "Unknown SMTP error";

    throw new AppError(
      500,
      "Gagal terhubung ke SMTP. Periksa EMAIL_USER, EMAIL_PASS, dan App Password Gmail.",
      { providerMessage },
      "SMTP_CONNECTION_FAILED",
    );
  }
}

export async function sendVerificationEmail({
  nama,
  email,
  verificationLink,
  accountCredentials,
}: SendVerificationEmailParams): Promise<void> {
  const transporter = createTransporter();
  const { emailUser } = validateEnv();
  const credentialsHtml = accountCredentials
    ? `
          <div style="margin:22px 0;padding:18px 20px;border-radius:18px;background:#fff7ed;border:1px solid rgba(251,146,60,0.3);">
            <p style="margin:0 0 12px;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#ea580c;">Akses Akun Siswa</p>
            <p style="margin:0 0 8px;font-size:14px;line-height:1.7;color:#475569;">Gunakan kredensial awal berikut setelah email berhasil diverifikasi.</p>
            <p style="margin:0 0 6px;font-size:15px;line-height:1.7;color:#0f172a;"><strong>Kode Akun:</strong> ${accountCredentials.loginCode}</p>
            <p style="margin:0;font-size:15px;line-height:1.7;color:#0f172a;"><strong>Password Awal:</strong> ${accountCredentials.password}</p>
          </div>
          <p style="margin:0 0 18px;font-size:13px;line-height:1.8;color:#64748b;">
            Simpan data ini dengan aman. Setelah login, password dapat diganti dari halaman profil akun siswa.
          </p>
      `
    : "";

  const html = `
    <div style="margin:0;padding:32px;background:#fff7ed;font-family:Segoe UI,Arial,sans-serif;color:#0f172a;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid rgba(251,146,60,0.24);border-radius:24px;box-shadow:0 24px 60px -32px rgba(15,23,42,0.18);overflow:hidden;">
        <div style="padding:28px 32px;background:linear-gradient(135deg,#f97316,#f59e0b);color:#ffffff;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;">Bimbel LMS</p>
          <h1 style="margin:0;font-size:28px;line-height:1.25;">Verifikasi email akun Anda</h1>
        </div>
        <div style="padding:32px;">
          <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">Halo ${nama},</p>
          <p style="margin:0 0 18px;font-size:15px;line-height:1.8;color:#475569;">
            Terima kasih sudah mendaftar di sistem LMS Bimbel. Sebelum login, mohon verifikasi email Anda terlebih dahulu.
          </p>
          ${credentialsHtml}
          <a
            href="${verificationLink}"
            style="display:inline-block;padding:14px 24px;border-radius:18px;background:linear-gradient(135deg,#f97316,#f59e0b);color:#ffffff;text-decoration:none;font-weight:600;"
          >
            Verifikasi Email
          </a>
          <p style="margin:20px 0 8px;font-size:14px;line-height:1.8;color:#64748b;">
            Link ini akan kedaluwarsa dalam 24 jam.
          </p>
          <p style="margin:0;font-size:13px;line-height:1.8;color:#94a3b8;">
            Jika tombol tidak bekerja, buka link berikut:
          </p>
          <p style="margin:8px 0 0;font-size:13px;line-height:1.8;color:#ea580c;word-break:break-word;">
            ${verificationLink}
          </p>
        </div>
      </div>
    </div>
  `;

  const text = [
    `Halo ${nama},`,
    "",
    "Silakan verifikasi email akun LMS Bimbel Anda melalui link berikut:",
    verificationLink,
    "",
    ...(accountCredentials
      ? [
          "Akses akun siswa:",
          `Kode Akun: ${accountCredentials.loginCode}`,
          `Password Awal: ${accountCredentials.password}`,
          "Simpan data ini dengan aman. Setelah login, password dapat diganti dari halaman profil akun siswa.",
          "",
        ]
      : []),
    "Link ini akan kedaluwarsa dalam 24 jam.",
  ].join("\n");

  try {
    await transporter.sendMail({
      from: `"Bimbel LMS" <${emailUser as string}>`,
      replyTo: emailUser as string,
      to: email,
      subject: "Verifikasi Email Akun Bimbel LMS",
      html,
      text,
    });
  } catch (error) {
    const providerMessage = error instanceof Error ? error.message : "Unknown email send error";

    throw new AppError(
      502,
      "Gagal mengirim email verifikasi. Periksa konfigurasi SMTP dan coba lagi.",
      { providerMessage },
      "EMAIL_SEND_FAILED",
    );
  }
}

export async function sendPasswordResetEmail({
  nama,
  email,
  resetCode,
  expiresAt,
}: SendPasswordResetEmailParams): Promise<void> {
  const transporter = createTransporter();
  const { emailUser } = validateEnv();
  const expiryLabel = expiresAt.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  // TODO: Sambungkan kode reset ini ke halaman/form reset password final saat flow konfirmasi token dibuat.
  const html = `
    <div style="margin:0;padding:32px;background:#fff7ed;font-family:Segoe UI,Arial,sans-serif;color:#0f172a;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid rgba(251,146,60,0.24);border-radius:24px;box-shadow:0 24px 60px -32px rgba(15,23,42,0.18);overflow:hidden;">
        <div style="padding:28px 32px;background:linear-gradient(135deg,#f97316,#f59e0b);color:#ffffff;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;">Bimbel LMS</p>
          <h1 style="margin:0;font-size:28px;line-height:1.25;">Instruksi reset password</h1>
        </div>
        <div style="padding:32px;">
          <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">Halo ${nama},</p>
          <p style="margin:0 0 18px;font-size:15px;line-height:1.8;color:#475569;">
            Kami menerima permintaan untuk mereset password akun Anda. Gunakan kode berikut untuk melanjutkan proses reset password.
          </p>
          <div style="display:inline-block;padding:16px 20px;border-radius:18px;background:#fff7ed;border:1px solid rgba(251,146,60,0.3);font-size:28px;font-weight:700;letter-spacing:0.24em;color:#ea580c;">
            ${resetCode}
          </div>
          <p style="margin:20px 0 8px;font-size:14px;line-height:1.8;color:#64748b;">
            Kode ini berlaku sampai ${expiryLabel}.
          </p>
          <p style="margin:0;font-size:13px;line-height:1.8;color:#94a3b8;">
            Jika Anda tidak merasa meminta reset password, abaikan email ini dan keamanan akun Anda tidak akan berubah.
          </p>
        </div>
      </div>
    </div>
  `;

  const text = [
    `Halo ${nama},`,
    "",
    "Gunakan kode berikut untuk reset password akun LMS Bimbel Anda:",
    resetCode,
    "",
    `Kode berlaku sampai ${expiryLabel}.`,
    "Jika Anda tidak meminta reset password, abaikan email ini.",
  ].join("\n");

  try {
    await transporter.sendMail({
      from: `"Bimbel LMS" <${emailUser as string}>`,
      replyTo: emailUser as string,
      to: email,
      subject: "Instruksi Reset Password Bimbel LMS",
      html,
      text,
    });
  } catch (error) {
    const providerMessage = error instanceof Error ? error.message : "Unknown email send error";

    throw new AppError(
      502,
      "Gagal mengirim instruksi reset password. Periksa konfigurasi SMTP dan coba lagi.",
      { providerMessage },
      "PASSWORD_RESET_EMAIL_SEND_FAILED",
    );
  }
}
