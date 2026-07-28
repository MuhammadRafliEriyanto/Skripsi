import { NextResponse } from "next/server";

const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const LANDING_CHATBOT_FALLBACK_TEXT =
  "Maaf, asisten sedang mengalami kendala. Silakan coba beberapa saat lagi.";
const MAX_CONVERSATION_MESSAGES = 8;
const PACKAGE_PRICE_BY_LEVEL = {
  SD: {
    oneSemester: "Rp1.800.000 sampai Rp1.900.000",
    twoSemesters: "Rp3.600.000 sampai Rp3.800.000",
  },
  SMP: {
    oneSemester: "Rp2.000.000 sampai Rp2.050.000",
    twoSemesters: "Rp4.000.000 sampai Rp4.100.000",
  },
  SMA: {
    oneSemester: "Rp2.150.000 sampai Rp2.250.000",
    twoSemesters: "Rp4.300.000 sampai Rp4.500.000",
  },
} as const;
const OLD_STYLE_REPLY_REPLACEMENTS: [RegExp, string][] = [
  [/\bBestie\b/gi, "Kak"],
  [/\bgas\b/gi, "silakan"],
  [/\bjujurly\b/gi, ""],
  [/\bliterally\b/gi, ""],
  [/\bkece\b/gi, "baik"],
  [/\basik\b/gi, "menarik"],
  [/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ""],
];

const LANDING_CHATBOT_SYSTEM_PROMPT = [
  "Kamu adalah Cendekia AI, asisten virtual resmi untuk landing page LMS Bimbel Bina Cendekia.",
  "Gunakan bahasa Indonesia yang sopan, hangat, ringkas, dan jelas. Gunakan sapaan netral seperti 'Halo' atau 'Baik' bila perlu.",
  "Jangan memakai sapaan 'Bestie', bahasa slang, emoji, atau gaya Gen Z seperti 'gas', 'jujurly', 'literally', 'kece', dan sejenisnya.",
  "Tugas utamamu membantu calon siswa atau orang tua memahami pendaftaran, paket belajar, cabang, pembayaran, dan fitur siswa di LMS Bina Cendekia.",
  "Berikut fakta resmi yang boleh kamu gunakan:",
  "1. Pendaftaran dan login: Pendaftaran dilakukan melalui halaman `/register`. Pengguna mengisi data, memilih kelas dan paket, melakukan verifikasi email, lalu membayar. Akun siswa dikirim otomatis ke email setelah pembayaran terkonfirmasi. Pengguna yang sudah memiliki akun dapat masuk melalui halaman `/login`.",
  "2. **Harga Paket Belajar (Otomatis menyesuaikan kelas)**:",
  "   - SD: 1 Semester (kisaran Rp1.8jt - Rp1.9jt) | 2 Semester (Rp3.6jt - Rp3.8jt).",
  "   - SMP: 1 Semester (kisaran Rp2.0jt - Rp2.05jt) | 2 Semester (Rp4.0jt - Rp4.1jt).",
  "   - SMA: 1 Semester (kisaran Rp2.15jt - Rp2.25jt) | 2 Semester (Rp4.3jt - Rp4.5jt).",
  "3. Pembayaran: Pembayaran terintegrasi dengan Xendit. Setelah pembayaran terkonfirmasi, sistem dapat mengaktifkan akses siswa.",
  "4. Cabang: Pilihan cabang tersedia di Slawi dan Adiwerna.",
  "5. Fitur siswa di LMS: Siswa dapat memantau jadwal kelas, absensi, tugas online, tryout, dan nilai melalui dashboard siswa.",
  "Aturan jawaban:",
  "- Jawab secukupnya dalam 2 sampai 5 kalimat, kecuali pengguna meminta detail.",
  "- Untuk daftar paket atau harga, gunakan format bernomor agar mudah dibaca.",
  "- Fokus pada pendaftaran, paket, cabang, pembayaran, dan fitur siswa. Jangan membahas fitur internal admin atau guru.",
  "- Jika pertanyaan pengguna adalah lanjutan singkat seperti 'iya', 'lanjut', atau 'boleh', jawab dengan mengikuti konteks percakapan sebelumnya.",
  "- Jika informasi tidak ada pada fakta resmi, katakan bahwa informasinya belum tersedia dan arahkan pengguna menghubungi customer service.",
  "- Jangan menyebut penyedia model, API, atau detail teknis internal.",
].join(" ");

type LandingChatbotRequestBody = {
  message?: unknown;
  chatInput?: unknown;
  messages?: unknown;
};

type ChatRole = "user" | "model";

type LandingChatbotRequestMessage = {
  role?: unknown;
  text?: unknown;
  content?: unknown;
  message?: unknown;
};

type GeminiTextPart = {
  text?: unknown;
};

type GeminiContent = {
  parts?: GeminiTextPart[];
};

type GeminiRequestContent = {
  role: ChatRole;
  parts: {
    text: string;
  }[];
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getRequestRole(value: unknown): ChatRole | null {
  if (value === "user") return "user";
  if (value === "bot" || value === "assistant" || value === "model") {
    return "model";
  }

  return null;
}

function getRequestMessageText(message: LandingChatbotRequestMessage) {
  return (
    normalizeText(message.text) ??
    normalizeText(message.content) ??
    normalizeText(message.message)
  );
}

function getRequestContents(
  body: LandingChatbotRequestBody | null,
): GeminiRequestContent[] | null {
  const rawMessages = Array.isArray(body?.messages) ? body.messages : [];
  const contents = rawMessages
    .map((message): GeminiRequestContent | null => {
      if (!isRecord(message)) {
        return null;
      }

      const role = getRequestRole(message.role);
      const text = getRequestMessageText(message);

      if (!role || !text) {
        return null;
      }

      return {
        role,
        parts: [{ text }],
      };
    })
    .filter((message): message is GeminiRequestContent => message !== null)
    .slice(-MAX_CONVERSATION_MESSAGES);

  const firstUserMessageIndex = contents.findIndex((message) => message.role === "user");

  if (firstUserMessageIndex >= 0) {
    return contents.slice(firstUserMessageIndex);
  }

  const chatInput = getRequestMessage(body);

  if (!chatInput) {
    return null;
  }

  return [
    {
      role: "user",
      parts: [{ text: chatInput }],
    },
  ];
}

function getContentText(content: GeminiRequestContent) {
  return content.parts.map((part) => part.text).join(" ").trim();
}

function getLatestUserMessage(contents: GeminiRequestContent[]) {
  for (let index = contents.length - 1; index >= 0; index -= 1) {
    if (contents[index].role === "user") {
      return getContentText(contents[index]);
    }
  }

  return "";
}

function isShortFollowUp(message: string) {
  return /^(i+ya+(\s+nih)?|ya+|boleh|lanjut|detail|ok|oke|sip)$/i.test(
    message.trim(),
  );
}

function hasPackageIntent(message: string) {
  return /\b(paket|harga|biaya|semester)\b/i.test(message);
}

function getRequestedPackageLevel(message: string) {
  if (/\bsma\b|kelas\s*(10|11|12)\b/i.test(message)) return "SMA";
  if (/\bsmp\b|kelas\s*(7|8|9)\b/i.test(message)) return "SMP";
  if (/\bsd\b|kelas\s*(1|2|3|4|5|6)\b/i.test(message)) return "SD";

  return null;
}

function buildPackageReply(level: keyof typeof PACKAGE_PRICE_BY_LEVEL | null) {
  if (level) {
    const price = PACKAGE_PRICE_BY_LEVEL[level];

    return [
      `Kebetulan, untuk jenjang ${level}, di Bina Cendekia tersedia pilihan paket berikut:`,
      `1. 1 Semester: sekitar ${price.oneSemester}.`,
      `2. 2 Semester: sekitar ${price.twoSemesters}.`,
      "Harga dapat menyesuaikan kelas yang dipilih saat pendaftaran.",
    ].join("\n\n");
  }

  return [
    "Kebetulan, di Bina Cendekia ada beberapa paket belajar yang bisa dipilih sesuai jenjang siswa:",
    `1. SD: 1 Semester sekitar ${PACKAGE_PRICE_BY_LEVEL.SD.oneSemester}; 2 Semester sekitar ${PACKAGE_PRICE_BY_LEVEL.SD.twoSemesters}.`,
    `2. SMP: 1 Semester sekitar ${PACKAGE_PRICE_BY_LEVEL.SMP.oneSemester}; 2 Semester sekitar ${PACKAGE_PRICE_BY_LEVEL.SMP.twoSemesters}.`,
    `3. SMA: 1 Semester sekitar ${PACKAGE_PRICE_BY_LEVEL.SMA.oneSemester}; 2 Semester sekitar ${PACKAGE_PRICE_BY_LEVEL.SMA.twoSemesters}.`,
    "Harga dapat menyesuaikan kelas yang dipilih saat pendaftaran.",
  ].join("\n\n");
}

function getLocalReply(contents: GeminiRequestContent[]) {
  const latestUserMessage = getLatestUserMessage(contents);
  const conversationText = contents.map(getContentText).join(" ");
  const shouldAnswerPackage =
    hasPackageIntent(latestUserMessage) ||
    (isShortFollowUp(latestUserMessage) && hasPackageIntent(conversationText));

  if (shouldAnswerPackage) {
    return buildPackageReply(getRequestedPackageLevel(conversationText));
  }

  return null;
}

function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY?.trim() ?? "";
}

function getGeminiModel() {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
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

function cleanReplyText(text: string | null) {
  if (!text) {
    return null;
  }

  const cleanedText = OLD_STYLE_REPLY_REPLACEMENTS.reduce(
    (currentText, [pattern, replacement]) => currentText.replace(pattern, replacement),
    text,
  )
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim();

  return cleanedText || null;
}

async function readJsonResponse(response: Response) {
  return (await response.json().catch(() => null)) as GeminiGenerateContentResponse | null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | LandingChatbotRequestBody
      | null;
    const contents = getRequestContents(body);

    if (!contents) {
      return NextResponse.json(
        { text: "Pesan chatbot tidak boleh kosong." },
        { status: 400 },
      );
    }

    const localReply = getLocalReply(contents);

    if (localReply) {
      return NextResponse.json({
        text: localReply,
      });
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
        contents,
        generationConfig: {
          temperature: 0.2,
          topP: 0.95,
          maxOutputTokens: 220,
        },
      }),
      cache: "no-store",
    });

    const data = await readJsonResponse(response);
    const replyText = cleanReplyText(getGeminiReply(data));

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
