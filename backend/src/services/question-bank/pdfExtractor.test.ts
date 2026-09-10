import assert from "node:assert/strict";
import test from "node:test";

import { buildPreviewItemsFromPdfLines } from "./pdfExtractor";

const defaults = { program: "SD", className: "SD 6", subject: "Matematika", topic: "Umum" };

test("parses questions, options, and the blue answer locally", () => {
  const items = buildPreviewItemsFromPdfLines([{
    pageNumber: 2,
    lines: [
      { text: "1. Hasil 1 + 1 adalah ...", y: 700, blue: false },
      { text: "A. 1", y: 680, blue: false },
      { text: "B. 2", y: 660, blue: true },
      { text: "C. 3", y: 640, blue: false },
      { text: "D. 4", y: 620, blue: false },
    ],
  }], defaults);

  assert.equal(items.length, 1);
  assert.equal(items[0].pageNumber, 2);
  assert.equal(items[0].draft.correctAnswer, "B");
  assert.equal(items[0].draft.topic, "Umum");
  assert.equal(items[0].selected, false);
  assert.ok(items[0].errors.some((error) => error.field === "explanation"));
});

test("keeps an item unselected when its blue answer is missing", () => {
  const items = buildPreviewItemsFromPdfLines([{
    pageNumber: 1,
    lines: [
      { text: "1) Pertanyaan", y: 700, blue: false },
      { text: "A) Satu", y: 680, blue: false },
      { text: "B) Dua", y: 660, blue: false },
      { text: "C) Tiga", y: 640, blue: false },
      { text: "D) Empat", y: 620, blue: false },
    ],
  }], defaults);

  assert.equal(items[0].selected, false);
  assert.match(items[0].warnings.join(" "), /kunci biru/i);
});

test("ignores numbered instructions that do not contain answer options", () => {
  const items = buildPreviewItemsFromPdfLines([{
    pageNumber: 1,
    lines: [
      { text: "1. Jawablah seluruh soal pada lembar jawaban.", y: 700, blue: false },
      { text: "2. Dilarang menggunakan kalkulator.", y: 680, blue: false },
    ],
  }], defaults);
  assert.equal(items.length, 0);
});
