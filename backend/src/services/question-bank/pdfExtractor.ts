import type { ImportPreviewItem } from "./importTypes";
import { normalizeQuestionDraft, questionFingerprint, type QuestionDraftDefaults } from "./questionDraft";

export type PdfExtractionInput = {
  fileBase64?: string;
  fileBuffer?: Buffer;
  fileName: string;
  defaults: QuestionDraftDefaults;
};

export type PdfLine = { text: string; y: number; blue: boolean };
export type PdfPageLines = { pageNumber: number; lines: PdfLine[]; imageDataUri?: string };

const QUESTION_RE = /^\s*(\d{1,4})[.)]\s+(.+)/;
const OPTION_RE = /^\s*([A-D])[.)]\s+(.+)/i;

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function buildPreviewItemsFromPdfLines(pages: PdfPageLines[], defaults: QuestionDraftDefaults): ImportPreviewItem[] {
  const items: ImportPreviewItem[] = [];
  const fingerprints = new Set<string>();

  for (const page of pages) {
    const starts = page.lines.flatMap((line, index) => QUESTION_RE.test(line.text) ? [index] : []);
    starts.forEach((lineIndex, questionIndex) => {
      const endIndex = starts[questionIndex + 1] ?? page.lines.length;
      const group = page.lines.slice(lineIndex, endIndex);
      if (group.filter((line) => OPTION_RE.test(line.text)).length < 2) return;
      const questionMatch = QUESTION_RE.exec(group[0].text)!;
      const options: Record<string, string> = { A: "", B: "", C: "", D: "" };
      const blueAnswers = new Set<string>();
      const questionParts = [questionMatch[2]];
      let activeOption = "";

      for (const line of group.slice(1)) {
        const optionMatch = OPTION_RE.exec(line.text);
        if (optionMatch) {
          activeOption = optionMatch[1].toUpperCase();
          options[activeOption] = clean(optionMatch[2]);
        } else if (activeOption) {
          options[activeOption] = clean(`${options[activeOption]} ${line.text}`);
        } else {
          questionParts.push(line.text);
        }
        if (line.blue && activeOption) blueAnswers.add(activeOption);
      }

      const correctAnswer = blueAnswers.size === 1 ? [...blueAnswers][0] : "";
      const warnings = [
        ...(blueAnswers.size === 0 ? ["Kunci biru tidak ditemukan."] : []),
        ...(blueAnswers.size > 1 ? ["Terdapat lebih dari satu opsi berwarna biru."] : []),
        "Pembahasan belum tersedia dan perlu diisi manual.",
      ];
      const rawDraft = {
        ...defaults,
        questionText: clean(questionParts.join(" ")),
        options,
        correctAnswer,
        explanation: "",
        difficulty: "Sedang",
      };
      const result = normalizeQuestionDraft(rawDraft, { requireExplanation: true });
      const fingerprint = result.ok ? questionFingerprint(result.value) : "";
      const duplicate = fingerprint && fingerprints.has(fingerprint) ? "file" : "none";
      if (fingerprint) fingerprints.add(fingerprint);
      items.push({
        rowNumber: items.length + 1,
        pageNumber: page.pageNumber,
        selected: result.ok && duplicate === "none",
        draft: result.ok ? result.value : rawDraft,
        fingerprint,
        errors: result.ok ? [] : result.errors,
        warnings,
        duplicate,
        ...(page.imageDataUri ? { imageDataUri: page.imageDataUri } : {}),
      } as ImportPreviewItem);
    });
  }
  return items;
}

function glyphText(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value.map((glyph) => typeof glyph === "object" && glyph && "unicode" in glyph ? String(glyph.unicode ?? "") : "").join("");
}

function isBlue(rgb: unknown[]) {
  const hex = typeof rgb[0] === "string" && /^#[0-9a-f]{6}$/i.test(rgb[0]) ? rgb[0] : "";
  const values = hex
    ? [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map((value) => Number.parseInt(value, 16))
    : rgb.slice(0, 3).map(Number);
  const normalized = values.map((value) => value <= 1 ? value * 255 : value);
  const [red = 0, green = 0, blue = 0] = normalized;
  return blue >= 100 && blue > red * 1.2 && blue > green * 1.08;
}

async function extractPage(pdfPage: any, pageNumber: number, pdfjs: any): Promise<PdfPageLines> {
  const [textContent, operators] = await Promise.all([pdfPage.getTextContent(), pdfPage.getOperatorList()]);
  const blueFragments: string[] = [];
  let blueRun = "";
  let fill: unknown[] = [0, 0, 0];
  let imageCount = 0;
  operators.fnArray.forEach((operation: number, index: number) => {
    const args = Array.from(operators.argsArray[index] ?? []) as unknown[];
    if (operation === pdfjs.OPS.setFillRGBColor || operation === pdfjs.OPS.setFillGray) {
      if (blueRun) blueFragments.push(blueRun);
      blueRun = "";
      fill = operation === pdfjs.OPS.setFillRGBColor ? args.slice(0, 3) : [Number(args[0]), Number(args[0]), Number(args[0])];
    }
    if (operation === pdfjs.OPS.showText && isBlue(fill)) blueRun += glyphText(args[0]);
    if (operation === pdfjs.OPS.paintImageXObject || operation === pdfjs.OPS.paintInlineImageXObject || operation === pdfjs.OPS.paintJpegXObject) imageCount += 1;
  });
  if (blueRun) blueFragments.push(blueRun);

  const rows = new Map<number, Array<{ x: number; text: string }>>();
  for (const item of textContent.items as any[]) {
    if (typeof item.str !== "string" || !item.str.trim()) continue;
    const y = Math.round(Number(item.transform?.[5] ?? 0) / 3) * 3;
    const row = rows.get(y) ?? [];
    row.push({ x: Number(item.transform?.[4] ?? 0), text: item.str });
    rows.set(y, row);
  }
  const lines = [...rows.entries()].map(([y, row]) => {
    const text = clean(row.sort((a, b) => a.x - b.x).map((item) => item.text).join(" "));
    const optionText = text.replace(/^\s*[A-D][.)]\s*/i, "");
    const normalized = optionText.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
    return { text, y, blue: normalized.length > 1 && blueFragments.some((fragment) => fragment.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "").includes(normalized)) };
  }).sort((a, b) => b.y - a.y);

  let imageDataUri: string | undefined;
  // Satu gambar hampir selalu logo/header berulang. Render halaman hanya jika ada visual tambahan.
  if (imageCount > 1 && lines.some((line) => QUESTION_RE.test(line.text))) {
    const { createCanvas } = await import("@napi-rs/canvas");
    const viewport = pdfPage.getViewport({ scale: 0.45 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await pdfPage.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    imageDataUri = canvas.toDataURL("image/jpeg", 0.55);
  }
  return { pageNumber, lines, ...(imageDataUri ? { imageDataUri } : {}) };
}

export async function extractPdfPreview(input: PdfExtractionInput): Promise<ImportPreviewItem[]> {
  const encodedParts = input.fileBase64?.split(",", 2) ?? [];
  const encoded = encodedParts[encodedParts.length - 1] ?? "";
  const bytes = input.fileBuffer ?? Buffer.from(encoded, "base64");
  if (!bytes.length || !bytes.subarray(0, 4).equals(Buffer.from("%PDF"))) throw new Error("File bukan PDF yang valid.");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false } as any);
  const document = await loadingTask.promise;
  try {
    const pages: PdfPageLines[] = [];
    const concurrency = 6;
    for (let firstPage = 1; firstPage <= document.numPages; firstPage += concurrency) {
      const pageNumbers = Array.from({ length: Math.min(concurrency, document.numPages - firstPage + 1) }, (_, index) => firstPage + index);
      pages.push(...await Promise.all(pageNumbers.map(async (pageNumber) => extractPage(await document.getPage(pageNumber), pageNumber, pdfjs))));
    }
    const items = buildPreviewItemsFromPdfLines(pages, input.defaults);
    if (!items.length) throw new Error("Tidak ada soal yang dapat dibaca dari PDF. Pastikan PDF berisi teks, bukan hasil scan.");
    return items;
  } finally {
    await loadingTask.destroy();
  }
}
