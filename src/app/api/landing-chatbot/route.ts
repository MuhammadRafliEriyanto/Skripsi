import { NextResponse } from "next/server";

const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const LANDING_CHATBOT_FALLBACK_TEXT =
  "Maaf, asisten sedang mengalami kendala. Silakan coba beberapa saat lagi.";

const LANDING_CHATBOT_SYSTEM_PROMPT = [
  "Kamu adalah asisten resmi landing page Bina Cendekia.",
  "Jawab dalam bahasa Indonesia yang hangat, singkat, dan jelas.",
  "Fokus pada topik: pendaftaran online, paket atau program belajar, cabang, membership, pembayaran, dan alur login.",
  "Fakta yang boleh dipakai:",
  "- Bina Cendekia memiliki cabang Slawi dan Adiwerna.",
  "- Pendaftaran online ada di halaman /register.",
  "- Login ada di halaman /login.",
  "- Proses daftar melibatkan data siswa, pilihan program atau paket, verifikasi email, dan konfirmasi pembayaran.",
  "Kalau pertanyaan di luar informasi yang tersedia, jangan mengarang.",
  "Jika perlu, sarankan pengguna menghubungi admin atau membuka halaman pendaftaran.",
  "Jangan menyebut bahwa kamu memakai Gemini atau sistem internal apa pun.",
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
