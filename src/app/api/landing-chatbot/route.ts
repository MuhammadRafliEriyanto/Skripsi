import { NextResponse } from "next/server";

const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const LANDING_CHATBOT_FALLBACK_TEXT =
  "Maaf, asisten sedang mengalami kendala. Silakan coba beberapa saat lagi.";

const LANDING_CHATBOT_SYSTEM_PROMPT = [
  "Kamu adalah 'Cendekia AI', asisten virtual kece buat landing page LMS Bimbel Bina Cendekia.",
  "Gaya bahasamu itu Gen Z banget: friendly, santai, asik, pakai sapaan 'Kak' atau 'Bestie', sering pakai emoji keren 😎✨, dan kadang pakai kata gaul (jujurly, literally, gas, dsb.) tapi tetap sopan, informatif, dan gampang dimengerti.",
  "Tugas utamamu bantu user (calon siswa/orang tua) buat ngerti cara daftar dan semua fitur keren yang bakal didapet siswa di sistem LMS ini.",
  "Berikut adalah fakta lengkap tentang sistem siswa di LMS Bina Cendekia yang wajib kamu tau:",
  "1. **Pendaftaran & Login**: Daftarnya gampang banget via halaman `/register`. Tinggal isi data, pilih kelas dan paket, verifikasi email, terus bayar. Akun siswa (username & password) bakal dikirim otomatis ke email setelah pembayaran terkonfirmasi! Kalau udah punya akun, langsung login aja di halaman `/login`.",
  "2. **Harga Paket Belajar (Otomatis menyesuaikan kelas)**:",
  "   - SD: 1 Semester (kisaran Rp1.8jt - Rp1.9jt) | 2 Semester (Rp3.6jt - Rp3.8jt).",
  "   - SMP: 1 Semester (kisaran Rp2.0jt - Rp2.05jt) | 2 Semester (Rp4.0jt - Rp4.1jt).",
  "   - SMA: 1 Semester (kisaran Rp2.15jt - Rp2.25jt) | 2 Semester (Rp4.3jt - Rp4.5jt).",
  "3. **Pembayaran**: Super aman dan instan karena terintegrasi sama Xendit. Begitu transfer, sistem otomatis nge-cek, langsung aktif deh! Gak perlu nunggu admin manual.",
  "4. **Cabang**: Pilihan belajarnya ada di cabang Slawi dan Adiwerna.",
  "5. **Fitur Canggih Siswa di LMS**: Setelah berhasil masuk, siswa punya Dashboard kece sendiri lho! Bisa pantau 'Jadwal Kelas' biar gak pernah telat, cek 'Absensi' kehadiran, ngerjain 'Tugas' online, dan asiknya lagi bisa ikutan 'Tryout' terus langsung lihat hasil 'Nilai' secara real-time di HP kamu!",
  "Aturan main:",
  "- Jawabnya jangan kepanjangan, bikin kayak lagi chatting sama temen.",
  "- Fokus aja bahas pendaftaran, paket, dan fitur buat SISWA. Jangan bahas urusan admin atau guru.",
  "- Kalau ditanya hal yang bener-bener kamu gak tau, jujur aja bilang gak tau dan suruh hubungin customer service. Jangan ngarang bebas ya!",
  "- Dilarang keras nyebutin kalau kamu itu AI buatan Google atau pakai model Gemini.",
].join(" ");

type LandingChatbotRequestBody = {
  message?: unknown;
  chatInput?: unknown;
};

type GeminiTextPart = {
  text?: unknown;
};

type GeminiContent = {
  parts?: GeminiTextPart[];
};

type GeminiCandidate = {
  content?: GeminiContent;
};

type GeminiGenerateContentResponse = {
  candidates?: GeminiCandidate[];
  error?: {
    message?: unknown;
  };
};

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function getRequestMessage(body: LandingChatbotRequestBody | null) {
  return normalizeText(body?.chatInput) ?? normalizeText(body?.message);
}

function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY?.trim() ?? "";
}

function getGeminiModel() {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

function buildPrompt(message: string) {
  return message;
}

function getGeminiReply(data: GeminiGenerateContentResponse | null) {
  const candidates = data?.candidates;

  if (!Array.isArray(candidates)) {
    return null;
  }

  for (const candidate of candidates) {
    const parts = candidate?.content?.parts;

    if (!Array.isArray(parts)) {
      continue;
    }

    const text = parts
      .map((part) => normalizeText(part?.text) ?? "")
      .join("")
      .trim();

    if (text) {
      return text;
    }
  }

  return null;
}

async function readJsonResponse(response: Response) {
  return (await response.json().catch(() => null)) as GeminiGenerateContentResponse | null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | LandingChatbotRequestBody
      | null;
    const chatInput = getRequestMessage(body);

    if (!chatInput) {
      return NextResponse.json(
        { text: "Pesan chatbot tidak boleh kosong." },
        { status: 400 },
      );
    }

    const apiKey = getGeminiApiKey();

    if (!apiKey) {
      console.error("[landing-chatbot] gemini_api_key_missing");
      return NextResponse.json(
        {
          text: LANDING_CHATBOT_FALLBACK_TEXT,
        },
        { status: 503 },
      );
    }

    const model = getGeminiModel();
    const endpoint = `${GEMINI_API_BASE_URL}/models/${encodeURIComponent(model)}:generateContent`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: LANDING_CHATBOT_SYSTEM_PROMPT,
            },
          ],
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: buildPrompt(chatInput),
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          topP: 0.95,
          maxOutputTokens: 220,
        },
      }),
      cache: "no-store",
    });

    const data = await readJsonResponse(response);
    const replyText = getGeminiReply(data);

    if (!response.ok) {
      console.error("[landing-chatbot] gemini_request_failed", {
        status: response.status,
        model,
        message: data?.error?.message ?? "Unknown Gemini API error",
      });

      return NextResponse.json({
        text: replyText ?? LANDING_CHATBOT_FALLBACK_TEXT,
      });
    }

    return NextResponse.json({
      text: replyText ?? LANDING_CHATBOT_FALLBACK_TEXT,
    });
  } catch (error) {
    console.error("[landing-chatbot] error", error);

    return NextResponse.json({
      text: LANDING_CHATBOT_FALLBACK_TEXT,
    });
  }
}
