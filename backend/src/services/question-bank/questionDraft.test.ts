import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeQuestionDraft,
  questionFingerprint,
} from "./questionDraft";

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    program: "SMP",
    className: "SMP 8",
    subject: "Matematika",
    topic: "Aljabar",
    questionText: "Nilai dari 2 + 2 adalah ...",
    options: { A: "3", B: "4", C: "5", D: "6" },
    correctAnswer: "B",
    explanation: "Dua ditambah dua sama dengan empat.",
    difficulty: "Mudah",
    ...overrides,
  };
}

test("defaults an empty topic to Umum", () => {
  const result = normalizeQuestionDraft(validInput({ topic: "" }));
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.topic, "Umum");
});

test("normalizes flat Indonesian options and uppercases the answer", () => {
  const result = normalizeQuestionDraft({
    ...validInput(),
    options: undefined,
    "opsi A": "  satu ",
    "opsi B": " dua ",
    "opsi C": " tiga ",
    "opsi D": " empat ",
    correctAnswer: " b ",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value.options, {
      A: "satu",
      B: "dua",
      C: "tiga",
      D: "empat",
    });
    assert.equal(result.value.correctAnswer, "B");
  }
});

test("rejects an invalid answer and a missing option", () => {
  const result = normalizeQuestionDraft(
    validInput({ options: { A: "3", B: "4", C: "", D: "6" }, correctAnswer: "E" }),
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.some((error) => error.field === "options.C"));
    assert.ok(result.errors.some((error) => error.field === "correctAnswer"));
  }
});

test("rejects a class outside its program", () => {
  const result = normalizeQuestionDraft(validInput({ program: "SD", className: "SMP 8" }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.some((error) => error.field === "className"));
});

test("creates stable fingerprints after whitespace normalization", () => {
  const first = normalizeQuestionDraft(validInput());
  const second = normalizeQuestionDraft(validInput({ questionText: " NILAI   DARI 2 + 2 ADALAH ... " }));
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (first.ok && second.ok) {
    assert.equal(questionFingerprint(first.value), questionFingerprint(second.value));
  }
});
