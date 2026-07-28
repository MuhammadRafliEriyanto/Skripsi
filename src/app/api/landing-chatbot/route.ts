import { NextResponse } from "next/server";

const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const LANDING_CHATBOT_FALLBACK_TEXT =
  "Maaf, asisten sedang mengalami kendala. Silakan coba beberapa saat lagi.";
const LANDING_CHATBOT_SCOPE_TEXT =
  "Maaf, saya hanya bisa membantu informasi seputar Bina Cendekia, seperti paket belajar, pendaftaran online, cabang, pembayaran, dan fitur LMS siswa.";
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
const GREETING_PATTERNS = [
  /^(halo|hai|hi|hello|assalamualaikum|selamat\s+(pagi|siang|sore|malam))\b/i,
  /^(terima\s+kasih|makasih|thanks|thank\s+you)\b/i,
];
const OUT_OF_SCOPE_PATTERNS = [
  /\b(cuaca\w*|resep\w*|masak\w*|makanan\w*|politik|presiden|berita\w*|olahraga\w*|bola)\b/i,
  /\b(film\w*|musik\w*|lagu\w*|game\w*|coding|programming|saham\w*|crypto|bitcoin)\b/i,
  /\b(jodoh\w*|ramalan\w*|horoskop|translate|terjemahkan)\b/i,
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
  "- Untuk pertanyaan yang tidak berkaitan dengan Bina Cendekia, bimbel, atau LMS siswa, tolak dengan sopan dan arahkan kembali ke topik yang bisa kamu bantu.",
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
  return /\b(paket\w*|harga\w*|biaya\w*|semester)\b/i.test(message);
}

function hasRegistrationIntent(message: string) {
  return /\b(daftar\w*|pendaftaran\w*|register)\b/i.test(message);
}

function hasPaymentIntent(message: string) {
  return /\b(bayar\w*|pembayaran\w*|xendit|transfer\w*|tagihan\w*)\b/i.test(message);
}

function hasBranchIntent(message: string) {
  return /\b(cabang\w*|lokasi\w*|alamat\w*|slawi|adiwerna)\b/i.test(message);
}

function hasStudentFeatureIntent(message: string) {
  return /\b(lms|fitur\w*|dashboard|jadwal\w*|kelas\w*|absensi\w*|tugas\w*|tryout|ujian\w*|nilai\w*|siswa\w*)\b/i.test(
    message,
  );
}

function hasGreetingIntent(message: string) {
  return GREETING_PATTERNS.some((pattern) => pattern.test(message.trim()));
}

function hasOutOfScopeIntent(message: string) {
  return OUT_OF_SCOPE_PATTERNS.some((pattern) => pattern.test(message));
}

function buildScopeReply() {
  return [
    LANDING_CHATBOT_SCOPE_TEXT,
    "Silakan tanyakan hal yang berkaitan dengan:",
    "1. Paket belajar",
    "2. Cara pendaftaran",
    "3. Cabang Bina Cendekia",
    "4. Pembayaran",
    "5. Fitur LMS siswa",
  ].join("\n\n");
}

function buildRegistrationReply() {
  return [
    "Untuk mendaftar di Bina Cendekia, alurnya seperti ini:",
    "1. Buka halaman pendaftaran online di /register.",
    "2. Isi data diri siswa dengan lengkap.",
    "3. Pilih kelas dan paket belajar yang sesuai.",
    "4. Lakukan verifikasi email.",
    "5. Selesaikan pembayaran.",
    "Setelah pembayaran terkonfirmasi, akun siswa akan dikirim otomatis ke email.",
  ].join("\n\n");
}

function buildPaymentReply() {
  return [
    "Untuk pembayaran, Bina Cendekia menggunakan sistem yang terintegrasi dengan Xendit.",
    "Alurnya singkat:",
    "1. Siswa memilih paket saat pendaftaran.",
    "2. Sistem menampilkan instruksi pembayaran.",
    "3. Pembayaran diproses melalui Xendit.",
    "4. Setelah pembayaran terkonfirmasi, akses siswa dapat aktif.",
  ].join("\n\n");
}

function buildBranchReply() {
  return [
    "Untuk saat ini, pilihan cabang Bina Cendekia tersedia di:",
    "1. Slawi",
    "2. Adiwerna",
    "Cabang bisa dipilih saat proses pendaftaran online.",
  ].join("\n\n");
}

function buildStudentFeatureReply() {
  return [
    "Di LMS Bina Cendekia, siswa bisa mengakses beberapa fitur belajar utama:",
    "1. Jadwal kelas",
    "2. Absensi",
    "3. Tugas online",
    "4. Tryout atau ujian",
    "5. Nilai siswa",
    "Fitur tersebut bisa digunakan setelah akun dan akses belajar siswa aktif.",
  ].join("\n\n");
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
  const shouldAnswerScope =
    !hasGreetingIntent(latestUserMessage) && hasOutOfScopeIntent(latestUserMessage);

  if (shouldAnswerScope) {
    return buildScopeReply();
  }

  if (hasRegistrationIntent(latestUserMessage)) {
    return buildRegistrationReply();
  }

  const shouldAnswerPackage =
    hasPackageIntent(latestUserMessage) ||
    (isShortFollowUp(latestUserMessage) && hasPackageIntent(conversationText));

  if (shouldAnswerPackage) {
    return buildPackageReply(getRequestedPackageLevel(conversationText));
  }

  if (hasBranchIntent(latestUserMessage)) {
    return buildBranchReply();
  }

  if (hasPaymentIntent(latestUserMessage)) {
    return buildPaymentReply();
  }

  if (hasStudentFeatureIntent(latestUserMessage)) {
    return buildStudentFeatureReply();
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
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([,.!?])/g, "$1")
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
