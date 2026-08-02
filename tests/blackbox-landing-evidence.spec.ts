import { expect, test } from "@playwright/test";
import fs from "fs";
import path from "path";

const BASE_URL = process.env.BLACKBOX_BASE_URL ?? "http://localhost:3000";
const EVIDENCE_DIR = path.join(
  process.cwd(),
  "docs",
  "blackbox-evidence",
  "landing-register-chatbot",
);

type EvidenceStatus = "Berhasil" | "Gagal";

type EvidenceRow = {
  no: number;
  modul: string;
  aksi: string;
  expected: string;
  status: EvidenceStatus;
  screenshot: string;
  catatan: string;
};

const evidenceRows: EvidenceRow[] = [];

function ensureEvidenceDir() {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

function screenshotPath(fileName: string) {
  return path.join(EVIDENCE_DIR, fileName);
}

function recordEvidence(row: EvidenceRow) {
  evidenceRows.push(row);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildTextExcerpt(value: string, maxLength = 80) {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function writeEvidenceReport() {
  ensureEvidenceDir();

  const generatedAt = new Date().toLocaleString("id-ID", {
    dateStyle: "full",
    timeStyle: "medium",
  });
  const markdownRows = evidenceRows
    .map(
      (row) =>
        `| ${row.no} | ${row.modul} | ${row.aksi} | ${row.expected} | ${row.status} | ${row.screenshot} | ${row.catatan.replace(/\|/g, "\\|")} |`,
    )
    .join("\n");
  const markdown = [
    "# Bukti Testing Blackbox Landing Page",
    "",
    `Generated at: ${generatedAt}`,
    "",
    "| No | Modul | Aksi | Hasil yang Diharapkan | Status | Screenshot | Catatan |",
    "|---:|---|---|---|---|---|---|",
    markdownRows,
    "",
  ].join("\n");

  fs.writeFileSync(path.join(EVIDENCE_DIR, "report.md"), markdown, "utf8");
  fs.writeFileSync(
    path.join(EVIDENCE_DIR, "report.json"),
    JSON.stringify({ generatedAt, rows: evidenceRows }, null, 2),
    "utf8",
  );
}

async function openLocalPage(page: import("@playwright/test").Page, pathName: string) {
  await page.goto(`${BASE_URL}${pathName}`, {
    waitUntil: "networkidle",
    timeout: 60_000,
  });
}

async function chooseFirstSelectOption(
  page: import("@playwright/test").Page,
  triggerSelector: string,
) {
  const trigger = page.locator(triggerSelector);

  await expect(trigger).toBeVisible({ timeout: 30_000 });
  await expect(trigger).toBeEnabled({ timeout: 30_000 });
  await trigger.click();
  await expect(page.getByRole("option").first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole("option").first().click();
}

test.describe("Blackbox landing, paket, register, dan chatbot", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);

  test.beforeAll(() => {
    ensureEvidenceDir();
  });

  test.afterAll(() => {
    writeEvidenceReport();
  });

  test("menghasilkan screenshot bukti blackbox landing page", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });

    await test.step("Landing Page", async () => {
      const fileName = "01-landing-page.png";

      try {
        await openLocalPage(page, "/");
        await expect(page.getByRole("link", { name: /Mulai Daftar Online/i })).toBeVisible();
        await expect(page.getByText(/Bina Cendekia/i).first()).toBeVisible();
        await page.screenshot({ path: screenshotPath(fileName), fullPage: true });
        recordEvidence({
          no: 1,
          modul: "Landing Page",
          aksi: "Membuka halaman utama",
          expected: "Informasi Bina Cendekia dan paket belajar tampil",
          status: "Berhasil",
          screenshot: fileName,
          catatan: "Hero dan navigasi landing page tampil.",
        });
      } catch (error) {
        await page.screenshot({ path: screenshotPath(fileName), fullPage: true });
        recordEvidence({
          no: 1,
          modul: "Landing Page",
          aksi: "Membuka halaman utama",
          expected: "Informasi Bina Cendekia dan paket belajar tampil",
          status: "Gagal",
          screenshot: fileName,
          catatan: error instanceof Error ? error.message : "Unknown error",
        });
        throw error;
      }
    });

    await test.step("Informasi Paket", async () => {
      const fileName = "02-informasi-paket.png";

      try {
        await openLocalPage(page, "/#paket");
        const paketSection = page.locator("#paket");

        await expect(paketSection).toContainText(/Paket Membership/i);
        await expect(paketSection).toContainText(/Ringkasan harga per kelas/i);
        await expect(paketSection).toContainText(/1 Semester/i);
        await paketSection.screenshot({ path: screenshotPath(fileName) });
        recordEvidence({
          no: 2,
          modul: "Informasi Paket",
          aksi: "Membuka halaman paket belajar",
          expected: "Informasi paket membership ditampilkan",
          status: "Berhasil",
          screenshot: fileName,
          catatan: "Kartu paket dan tabel harga per kelas tampil.",
        });
      } catch (error) {
        await page.screenshot({ path: screenshotPath(fileName), fullPage: true });
        recordEvidence({
          no: 2,
          modul: "Informasi Paket",
          aksi: "Membuka halaman paket belajar",
          expected: "Informasi paket membership ditampilkan",
          status: "Gagal",
          screenshot: fileName,
          catatan: error instanceof Error ? error.message : "Unknown error",
        });
        throw error;
      }
    });

    await test.step("Register Online", async () => {
      const fileName = "03-register-online-submit-success.png";
      const timestamp = Date.now();
      const nama = `Siswa Blackbox ${timestamp}`;
      const email = `blackbox.${timestamp}@gmail.com`;

      try {
        await openLocalPage(page, "/register?package=1-semester");
        await expect(page.getByRole("heading", { name: /Registrasi Siswa Baru/i })).toBeVisible();

        await page.locator("#nama").fill(nama);
        await page.locator("#email").fill(email);
        await chooseFirstSelectOption(page, "#classLevel");
        await chooseFirstSelectOption(page, "#branch");

        await Promise.all([
          page.waitForURL(/\/register\/(payment|status)/, { timeout: 90_000 }),
          page.getByRole("button", { name: /Daftar & Buat Tagihan/i }).click(),
        ]);

        await expect(page.getByText(/Memuat detail tagihan/i)).toBeHidden({
          timeout: 60_000,
        });
        await expect(page.getByText(/Tagihan Anda/i)).toBeVisible({
          timeout: 60_000,
        });
        await expect(page.getByText(/Paket Membership/i)).toBeVisible({
          timeout: 30_000,
        });
        await page.screenshot({ path: screenshotPath(fileName), fullPage: true });
        recordEvidence({
          no: 3,
          modul: "Register Online",
          aksi: "Mengisi dan mengirim formulir",
          expected: "Data pendaftaran berhasil dikirim",
          status: "Berhasil",
          screenshot: fileName,
          catatan: `Form berhasil submit dengan email testing ${email}.`,
        });
      } catch (error) {
        await page.screenshot({ path: screenshotPath(fileName), fullPage: true });
        recordEvidence({
          no: 3,
          modul: "Register Online",
          aksi: "Mengisi dan mengirim formulir",
          expected: "Data pendaftaran berhasil dikirim",
          status: "Gagal",
          screenshot: fileName,
          catatan: error instanceof Error ? error.message : "Unknown error",
        });
        throw error;
      }
    });

    await test.step("Chatbot AI", async () => {
      const fileName = "04-chatbot-ai-response.png";
      const prompt = "Berapa harga paket SMA kelas 10?";

      try {
        await openLocalPage(page, "/");
        await page.getByRole("button", { name: /Buka chatbot/i }).click();
        await expect(page.getByPlaceholder(/Tulis pertanyaanmu/i)).toBeVisible();
        await page.getByPlaceholder(/Tulis pertanyaanmu/i).fill(prompt);
        const chatbotResponsePromise = page.waitForResponse(
          (response) =>
            response.url().includes("/api/landing-chatbot") &&
            response.request().method() === "POST",
          { timeout: 60_000 },
        );

        await page.getByRole("button", { name: /Kirim pesan/i }).click();
        await expect(page.getByText(prompt)).toBeVisible();
        const chatbotResponse = await chatbotResponsePromise;
        const chatbotPayload = (await chatbotResponse.json().catch(() => null)) as
          | { text?: unknown }
          | null;
        const chatbotReply =
          typeof chatbotPayload?.text === "string" ? chatbotPayload.text.trim() : "";
        const replyExcerpt = buildTextExcerpt(chatbotReply);

        expect(replyExcerpt.length).toBeGreaterThan(0);
        await expect(page.locator("body")).toContainText(
          new RegExp(escapeRegExp(replyExcerpt.slice(0, 36)), "i"),
          { timeout: 15_000 },
        );
        await expect(page.getByPlaceholder(/Tulis pertanyaanmu/i)).toBeEnabled({
          timeout: 15_000,
        });
        await page.screenshot({ path: screenshotPath(fileName), fullPage: true });
        recordEvidence({
          no: 4,
          modul: "Chatbot AI",
          aksi: "Mengajukan pertanyaan kepada chatbot",
          expected: "Chatbot memberikan respons sesuai pertanyaan",
          status: "Berhasil",
          screenshot: fileName,
          catatan: `Prompt testing: "${prompt}".`,
        });
      } catch (error) {
        await page.screenshot({ path: screenshotPath(fileName), fullPage: true });
        recordEvidence({
          no: 4,
          modul: "Chatbot AI",
          aksi: "Mengajukan pertanyaan kepada chatbot",
          expected: "Chatbot memberikan respons sesuai pertanyaan",
          status: "Gagal",
          screenshot: fileName,
          catatan: error instanceof Error ? error.message : "Unknown error",
        });
        throw error;
      }
    });
  });
});
