import assert from "node:assert/strict";
import test from "node:test";

import { prepareQuestionImport } from "./importCommit";

const actor = { id: "admin-1", name: "Admin Utama" };

function input(overrides: Record<string, unknown> = {}) {
  return {
    program: "SMP",
    className: "SMP 8",
    subject: "Matematika",
    topic: "",
    questionText: "2 + 2 = ...",
    options: { A: "3", B: "4", C: "5", D: "6" },
    correctAnswer: "B",
    explanation: "Penjelasan contoh.",
    difficulty: "Mudah",
    status: "approved",
    bankScope: "teacher",
    ...overrides,
  };
}

test("prepares imports as global review items and ignores protected input", () => {
  const result = prepareQuestionImport(
    [{ rowNumber: 2, draft: input(), source: "excel", fileName: "soal.xlsx" }],
    actor,
    new Set(),
  );
  assert.equal(result.documents.length, 1);
  assert.equal(result.documents[0].status, "review");
  assert.equal(result.documents[0].bankScope, "global");
  assert.equal(result.documents[0].createdBy, "admin-1");
  assert.equal(result.documents[0].topic, "Umum");
  assert.equal(result.documents[0].explanationSource, "manual");
});

test("skips a database duplicate", () => {
  const first = prepareQuestionImport(
    [{ rowNumber: 2, draft: input(), source: "excel", fileName: "soal.xlsx" }],
    actor,
    new Set(),
  );
  const fingerprint = first.documents[0].fingerprint;
  const result = prepareQuestionImport(
    [{ rowNumber: 2, draft: input(), source: "excel", fileName: "soal.xlsx" }],
    actor,
    new Set([fingerprint]),
  );
  assert.equal(result.documents.length, 0);
  assert.equal(result.skipped[0].reason, "Soal duplikat sudah ada di bank soal.");
});

test("reports invalid rows without preparing partial documents", () => {
  const result = prepareQuestionImport(
    [{ rowNumber: 9, draft: input({ correctAnswer: "E" }), source: "pdf", fileName: "soal.pdf", pageNumber: 3 }],
    actor,
    new Set(),
  );
  assert.equal(result.documents.length, 0);
  assert.equal(result.failed[0].rowNumber, 9);
  assert.match(result.failed[0].reason, /Kunci jawaban/);
});

test("rejects imports without a non-empty explanation", () => {
  const result = prepareQuestionImport(
    [{ rowNumber: 9, draft: input({ explanation: "" }), source: "pdf", fileName: "soal.pdf", pageNumber: 3 }],
    actor,
    new Set(),
  );
  assert.equal(result.documents.length, 0);
  assert.equal(result.failed[0].rowNumber, 9);
  assert.match(result.failed[0].reason, /Pembahasan wajib diisi/);
});
