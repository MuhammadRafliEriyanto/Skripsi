/**
 * Automated tests for the generator validation gate and canonical answer-key
 * architecture (Task Sections 3-9).
 *
 * Run with:
 *   node --test backend/src/scripts/generator-validation.test.mjs
 *
 * These tests lock in the fixes for every upstream generator bug found in the
 * audit (UPSTREAM-GENERATOR-AUDIT.md):
 *   - Numeric answer-key bug (V5): key must be a POSITION letter, never the
 *     computed answer value.
 *   - Elementary "0A" bug: index 0 must map to "A", never "0A".
 *   - Placeholder generation: must be rejected, never exported.
 *   - undefined/null/NaN interpolation: must be rejected.
 *   - Duplicate options: must be rejected.
 *   - Invalid answer key / key pointing at empty option: must be rejected.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  ANSWER_LETTERS,
  toAnswerLetter,
  answerLetterFor,
  isValidAnswerLetter,
  hasBrokenToken,
  isPlaceholderQuestion,
  isPlaceholderOption,
  isEmpty,
  hasDuplicateOptions,
  checkInterpolationVars,
  validateQuestion,
  buildAndValidate,
  GENERATION_FAILED_DUPLICATE_OPTIONS,
  GENERATION_FAILED_MISSING_DATA,
  GENERATION_FAILED_NO_SOURCE,
} from "./generator-validation-gate.mjs";

// toAnswerLetter throws an Error whose message starts with this prefix when
// the index is invalid (Task Section 4).
const INVALID_INDEX_PREFIX = "GENERATION_FAILED_INVALID_INDEX";

// =====================================================
// SECTION 3 — Canonical answer-key architecture
// =====================================================

test("toAnswerLetter maps index to position letter (0->A, 1->B, 2->C, 3->D)", () => {
  assert.equal(toAnswerLetter(0), "A");
  assert.equal(toAnswerLetter(1), "B");
  assert.equal(toAnswerLetter(2), "C");
  assert.equal(toAnswerLetter(3), "D");
});

test("toAnswerLetter throws GENERATION_FAILED_INVALID_INDEX for out-of-range index", () => {
  for (const bad of [-1, 4, 5, 1.5, null, undefined, "2", NaN]) {
    assert.throws(() => toAnswerLetter(bad), (err) => err.message.startsWith(INVALID_INDEX_PREFIX));
  }
});

test("REQUIRED: numeric answer bug — options=[10,20,30,40], correct=30 -> index 2 -> letter C", () => {
  const options = ["10", "20", "30", "40"];
  const correctAnswer = "30";

  // The key is derived from POSITION, never from the computed value.
  const index = options.indexOf(correctAnswer);
  assert.equal(index, 2);

  const letter = toAnswerLetter(index);
  assert.equal(letter, "C");

  // And it must NEVER be the value itself.
  assert.notEqual(letter, "30");
  assert.ok(isValidAnswerLetter(letter));
});

test("answerLetterFor derives letter from option position of the correct value", () => {
  assert.equal(answerLetterFor(["10", "20", "30", "40"], "30"), "C");
  assert.equal(answerLetterFor(["apple", "banana", "cherry", "date"], "apple"), "A");
  assert.equal(answerLetterFor(["a", "b", "c", "d"], "d"), "D");
});

test("answerLetterFor throws when the correct value is not among the options", () => {
  // indexOf returns -1 -> invalid index -> generation must fail, not guess.
  assert.throws(
    () => answerLetterFor(["10", "20", "30", "40"], "99"),
    (err) => err.message.startsWith(INVALID_INDEX_PREFIX)
  );
});

test("isValidAnswerLetter accepts only A-D", () => {
  for (const good of ANSWER_LETTERS) assert.ok(isValidAnswerLetter(good));
  for (const bad of ["0A", "1A", "2A", "3A", "E", "a", "10", "20", "", null, undefined]) {
    assert.ok(!isValidAnswerLetter(bad), `expected ${JSON.stringify(bad)} to be invalid`);
  }
});

// =====================================================
// SECTION 4 — Elementary "0A" bug
// =====================================================

test("REQUIRED: elementary bug — correctIndex=0 must map to A, never 0A", () => {
  const correctIndex = 0;

  // Old buggy behaviour: String(correctIndex) + "A" === "0A"
  const buggy = String(correctIndex) + "A";
  assert.equal(buggy, "0A");
  assert.ok(!isValidAnswerLetter(buggy), "0A must be recognised as invalid");

  // Fixed behaviour: canonical position mapping.
  const fixed = toAnswerLetter(correctIndex);
  assert.equal(fixed, "A");
  assert.ok(isValidAnswerLetter(fixed));
});

test("elementary bug — every index maps to a valid single letter", () => {
  const expected = ["A", "B", "C", "D"];
  for (let i = 0; i < 4; i++) {
    assert.equal(toAnswerLetter(i), expected[i]);
    // The old bug produced `${i}A` for all i.
    assert.ok(!isValidAnswerLetter(`${i}A`));
  }
});

// =====================================================
// SECTION 5 — Placeholder prevention
// =====================================================

test("REQUIRED: placeholder question is rejected", () => {
  const placeholder = "Soal Matematika untuk Bab 8 - Variasi 1";
  assert.ok(isPlaceholderQuestion(placeholder));

  const gate = validateQuestion({
    question: placeholder,
    options: ["1", "2", "3", "4"],
    answerKey: "A",
    explanation: "Pembahasan.",
  });
  assert.ok(!gate.valid);
  assert.ok(gate.reasons.some((r) => r.includes("PLACEHOLDER")));
});

test("placeholder detection covers all known fallback shapes", () => {
  const placeholders = [
    "Soal Matematika untuk Bab 8 - Variasi 1",
    "English language question for Grammar - Variasi 2",
    "Soal IPA untuk Tema 3 - Variasi 5",
  ];
  for (const p of placeholders) {
    assert.ok(isPlaceholderQuestion(p), `expected placeholder: ${p}`);
  }
});

test("placeholder options are rejected", () => {
  for (const p of ["Pilihan A", "Option B", "Salah 1", "Jawaban Salah 2"]) {
    assert.ok(isPlaceholderOption(p), `expected placeholder option: ${p}`);
  }

  const gate = validateQuestion({
    question: "Berapakah 2 + 2?",
    options: ["4", "Pilihan A", "Salah 1", "5"],
    answerKey: "A",
    explanation: "2 + 2 = 4.",
  });
  assert.ok(!gate.valid);
  assert.ok(gate.reasons.some((r) => r.includes("OPTION_PLACEHOLDER")));
});

test("legitimate options are NOT flagged as placeholders", () => {
  // "Semua benar" and "Kesalahan" are legitimate content options.
  for (const legit of ["Semua benar", "Kesalahan", "4", "Ibukota Jawa Barat"]) {
    assert.ok(!isPlaceholderOption(legit), `must not flag: ${legit}`);
  }
});

// =====================================================
// SECTION 6 — undefined / null / NaN prevention
// =====================================================

test("REQUIRED: undefined interpolation token is rejected", () => {
  const broken = "Gerakan ini dipelopori oleh undefined pada tahun 1908.";
  assert.ok(hasBrokenToken(broken));

  const gate = validateQuestion({
    question: broken,
    options: ["A", "B", "C", "D"],
    answerKey: "A",
    explanation: "Pembahasan.",
  });
  assert.ok(!gate.valid);
  assert.ok(gate.reasons.some((r) => r.includes("BROKEN_TOKEN")));
});

test("broken-token detection covers undefined, null, NaN, [object Object]", () => {
  for (const t of [
    "dipelopori oleh undefined",
    "nilainya adalah null",
    "hasilnya NaN",
    "data [object Object] ditampilkan",
  ]) {
    assert.ok(hasBrokenToken(t), `expected broken token: ${t}`);
  }
});

test("broken token in explanation is also rejected", () => {
  const gate = validateQuestion({
    question: "Pertanyaan valid?",
    options: ["a", "b", "c", "d"],
    answerKey: "B",
    explanation: "Jawabannya undefined karena error.",
  });
  assert.ok(!gate.valid);
  assert.ok(gate.reasons.some((r) => r.includes("EXPLANATION_BROKEN_TOKEN")));
});

test("checkInterpolationVars flags missing data before question creation", () => {
  assert.equal(checkInterpolationVars({ tokoh: undefined }), GENERATION_FAILED_MISSING_DATA);
  assert.equal(checkInterpolationVars({ tahun: null }), GENERATION_FAILED_MISSING_DATA);
  assert.equal(checkInterpolationVars({ nama: "Soekarno", tahun: 1908 }), null);
});

// =====================================================
// SECTION 7 — Duplicate option prevention
// =====================================================

test("REQUIRED: duplicate options [A, B, C, C] are rejected", () => {
  const options = ["Jakarta", "Bandung", "Surabaya", "Surabaya"];
  assert.ok(hasDuplicateOptions(options));

  const gate = validateQuestion({
    question: "Manakah kota di Pulau Jawa?",
    options,
    answerKey: "A",
    explanation: "Jakarta ada di Jawa.",
  });
  assert.ok(!gate.valid);
  assert.ok(gate.reasons.some((r) => r.includes("OPTIONS_DUPLICATE")));
});

test("duplicate detection is case- and whitespace-insensitive", () => {
  assert.ok(hasDuplicateOptions(["Apple", "apple ", "Banana", "Cherry"]));
  assert.ok(!hasDuplicateOptions(["Apple", "Banana", "Cherry", "Date"]));
});

// =====================================================
// SECTION 8 — Full validation gate
// =====================================================

test("a fully valid question passes the gate", () => {
  const gate = validateQuestion({
    question: "Berapakah hasil dari 15 + 27?",
    options: ["42", "40", "44", "38"],
    answerKey: "A",
    explanation: "15 + 27 = 42.",
  });
  assert.ok(gate.valid, `expected valid, got: ${gate.reasons.join(", ")}`);
  assert.equal(gate.reasons.length, 0);
});

test("gate rejects empty question", () => {
  const gate = validateQuestion({
    question: "",
    options: ["a", "b", "c", "d"],
    answerKey: "A",
    explanation: "x",
  });
  assert.ok(!gate.valid);
  assert.ok(gate.reasons.some((r) => r.includes("QUESTION_EMPTY")));
});

test("gate rejects wrong number of options", () => {
  const gate = validateQuestion({
    question: "Valid question?",
    options: ["a", "b", "c"],
    answerKey: "A",
    explanation: "x",
  });
  assert.ok(!gate.valid);
  assert.ok(gate.reasons.some((r) => r.includes("OPTIONS_NOT_FOUR")));
});

test("gate rejects empty option", () => {
  const gate = validateQuestion({
    question: "Valid question?",
    options: ["a", "", "c", "d"],
    answerKey: "A",
    explanation: "x",
  });
  assert.ok(!gate.valid);
  assert.ok(gate.reasons.some((r) => r.includes("OPTION_EMPTY")));
});

test("gate rejects invalid answer key (numeric, 0A, out of range)", () => {
  for (const badKey of ["30", "0A", "E", "", null, undefined]) {
    const gate = validateQuestion({
      question: "Valid question?",
      options: ["a", "b", "c", "d"],
      answerKey: badKey,
      explanation: "x",
    });
    assert.ok(!gate.valid, `expected invalid for key ${JSON.stringify(badKey)}`);
    assert.ok(gate.reasons.some((r) => r.includes("ANSWER_KEY_INVALID")));
  }
});

test("gate rejects key pointing at an empty option", () => {
  const gate = validateQuestion({
    question: "Valid question?",
    options: ["   ", "b", "c", "d"],
    answerKey: "A",
    explanation: "x",
  });
  assert.ok(!gate.valid);
  assert.ok(gate.reasons.some((r) => r.includes("ANSWER_KEY_POINTS_TO_EMPTY_OPTION")));
});

test("isEmpty treats whitespace-only as empty", () => {
  assert.ok(isEmpty(""));
  assert.ok(isEmpty("   "));
  assert.ok(isEmpty(null));
  assert.ok(isEmpty(undefined));
  assert.ok(!isEmpty("0"));
  assert.ok(!isEmpty("a"));
});

// =====================================================
// buildAndValidate — canonical index -> letter pipeline
// =====================================================

test("buildAndValidate converts correctAnswerIndex to letter and validates", () => {
  const result = buildAndValidate({
    question: "Berapakah 6 x 7?",
    options: ["42", "40", "44", "48"],
    correctAnswerIndex: 0,
    explanation: "6 x 7 = 42.",
  });
  assert.ok(result.valid, `expected valid, got: ${result.reasons.join(", ")}`);
  assert.equal(result.answerKey, "A");
});

test("buildAndValidate fails generation for invalid index", () => {
  const result = buildAndValidate({
    question: "Valid question?",
    options: ["a", "b", "c", "d"],
    correctAnswerIndex: 7,
    explanation: "x",
  });
  assert.ok(!result.valid);
  assert.ok(result.reasons.some((r) => r.includes("ANSWER_KEY_INVALID")));
});

test("buildAndValidate blocks export of a placeholder question", () => {
  const result = buildAndValidate({
    question: "Soal IPA untuk Tema 3 - Variasi 2",
    options: ["a", "b", "c", "d"],
    correctAnswerIndex: 1,
    explanation: "x",
  });
  assert.ok(!result.valid);
});

// =====================================================
// Status constants sanity
// =====================================================

test("generation-failure status constants are defined and distinct", () => {
  const statuses = [
    GENERATION_FAILED_DUPLICATE_OPTIONS,
    GENERATION_FAILED_MISSING_DATA,
    GENERATION_FAILED_NO_SOURCE,
  ];
  for (const s of statuses) {
    assert.ok(typeof s === "string" && s.length > 0);
  }
  assert.equal(new Set(statuses).size, statuses.length);
});
