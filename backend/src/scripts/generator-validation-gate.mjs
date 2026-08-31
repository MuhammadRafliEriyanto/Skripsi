/**
 * generator-validation-gate.mjs
 *
 * Shared validation gate + canonical answer-key architecture for all question
 * generators (V5, elementary-school, UTBK).
 *
 * CORE PRINCIPLE (Task Section 3):
 *   The answer key is the POSITION of the correct option, NEVER the computed
 *   answer VALUE. Generators must produce a `correctAnswerIndex` (0..3); this
 *   module converts it to a letter via `toAnswerLetter(index)`.
 *
 *   Example: options = [10, 20, 30, 40], correct value = 30
 *     -> correctAnswerIndex = 2
 *     -> correctAnswerLetter = "C"
 *   NOT `correct = "30"`.
 *
 * VALIDATION GATE (Task Section 8):
 *   `validateQuestion(q)` returns { valid, reasons[] }. A question is exported
 *   ONLY if `valid === true`. If ANY check fails, the question is blocked and
 *   reported via a failure status instead of being written to production Excel.
 *
 * This module is READ-ONLY with respect to data: it never touches MongoDB and
 * never writes files. It is a pure library used by the generators and tests.
 */

// =====================================================
// CANONICAL ANSWER-KEY ARCHITECTURE
// =====================================================

/** The four valid answer letters, indexed by option position. */
export const ANSWER_LETTERS = ["A", "B", "C", "D"];

/**
 * Convert a 0-based correct-answer index to its letter.
 * Throws if the index is not an integer in [0, 3] — generation must FAIL
 * rather than emit an invalid key (Task Section 4).
 *
 * @param {number} index 0..3 position of the correct option
 * @returns {"A"|"B"|"C"|"D"}
 */
export function toAnswerLetter(index) {
  if (!Number.isInteger(index) || index < 0 || index > 3) {
    throw new Error(
      `GENERATION_FAILED_INVALID_INDEX: correctAnswerIndex must be an integer 0..3, got ${JSON.stringify(index)}`
    );
  }
  return ANSWER_LETTERS[index];
}

/**
 * Locate the correct answer inside an options array and return its letter.
 * This is the canonical pattern already used by the elementary "FIXED
 * GENERATORS" section, centralised here for all generators.
 *
 * @param {Array<string|number>} options the 4 options (post-shuffle)
 * @param {string|number} correctAnswer the correct answer value
 * @returns {"A"|"B"|"C"|"D"}
 */
export function answerLetterFor(options, correctAnswer) {
  const index = options.indexOf(correctAnswer);
  return toAnswerLetter(index); // throws if not found (index === -1)
}

/**
 * Return true if the given value is a valid answer letter (A/B/C/D).
 * @param {*} letter
 * @returns {boolean}
 */
export function isValidAnswerLetter(letter) {
  return typeof letter === "string" && /^[A-D]$/.test(letter);
}

// =====================================================
// FAILURE STATUSES (Task Sections 5, 6, 7)
// =====================================================

export const GENERATION_FAILED_NO_SOURCE = "GENERATION_FAILED_NO_SOURCE";
export const GENERATION_FAILED_MISSING_DATA = "GENERATION_FAILED_MISSING_DATA";
export const GENERATION_FAILED_DUPLICATE_OPTIONS = "GENERATION_FAILED_DUPLICATE_OPTIONS";
export const GENERATION_FAILED_INVALID_KEY = "GENERATION_FAILED_INVALID_KEY";
export const GENERATION_FAILED_INVALID_CONTENT = "GENERATION_FAILED_INVALID_CONTENT";

// =====================================================
// CONTENT DETECTORS (reused from remediation pipeline)
// =====================================================

/** Broken interpolation tokens: undefined / null / NaN / [object Object]. */
export const BUG_TOKEN_REGEX = /\bundefined\b|\bnull\b|\bNaN\b|\[object Object\]/i;

/** Placeholder question-text patterns. */
export const PLACEHOLDER_QUESTION_REGEXES = [
  /untuk\s+Bab\s+\d/i,
  /english language question for/i,
  /-\s*Variasi\s+\d+\s*$/i,
  /^soal\s+.*untuk\s+.*-\s*variasi\s+\d+\s*$/i,
];

/** Placeholder / dummy option patterns. */
export const PLACEHOLDER_OPTION_REGEX =
  /^(Pilihan|Option)\s+[A-D]$|^Salah\s*\d+$|^Jawaban\s+Salah\s*\d+$/i;

/** Pure numeric string (a numeric answer key). */
export const NUMERIC_REGEX = /^-?\d+(\.\d+)?$/;

/**
 * Return true if the text contains a broken interpolation token
 * (undefined / null / NaN / [object Object]).
 * @param {*} text
 * @returns {boolean}
 */
export function hasBrokenToken(text) {
  return typeof text === "string" && BUG_TOKEN_REGEX.test(text);
}

/**
 * Return true if the question text looks like a placeholder.
 * @param {*} text
 * @returns {boolean}
 */
export function isPlaceholderQuestion(text) {
  if (typeof text !== "string") return true;
  return PLACEHOLDER_QUESTION_REGEXES.some((re) => re.test(text.trim()));
}

/**
 * Return true if an option looks like a placeholder / dummy option.
 * @param {*} text
 * @returns {boolean}
 */
export function isPlaceholderOption(text) {
  if (typeof text !== "string") return true;
  return PLACEHOLDER_OPTION_REGEX.test(text.trim());
}

/**
 * Return true if the value is empty (null, undefined, or whitespace-only).
 * @param {*} value
 * @returns {boolean}
 */
export function isEmpty(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

/**
 * Normalise an option for duplicate comparison: trim + lowercase.
 * @param {*} value
 * @returns {string}
 */
export function normalizeOption(value) {
  return String(value).trim().toLowerCase();
}

/**
 * Return true if the 4 options contain duplicates (after normalisation).
 * @param {Array<*>} options
 * @returns {boolean}
 */
export function hasDuplicateOptions(options) {
  if (!Array.isArray(options)) return true;
  const seen = new Set(options.map(normalizeOption));
  return seen.size !== options.length;
}

// =====================================================
// INTERPOLATION GUARD (Task Section 6)
// =====================================================

/**
 * Validate that every interpolation variable is defined before a question is
 * created. Returns a failure status if any required variable is
 * undefined/null/NaN, otherwise null.
 *
 * @param {Record<string, *>} vars map of variable name -> value
 * @returns {string|null} GENERATION_FAILED_MISSING_DATA or null
 */
export function checkInterpolationVars(vars) {
  for (const [name, value] of Object.entries(vars)) {
    if (
      value === undefined ||
      value === null ||
      (typeof value === "number" && Number.isNaN(value))
    ) {
      return GENERATION_FAILED_MISSING_DATA;
    }
  }
  return null;
}

// =====================================================
// THE VALIDATION GATE (Task Section 8)
// =====================================================

/**
 * Validate a fully-built question BEFORE it enters the output.
 *
 * A question object is expected to have (at minimum):
 *   - question : string (the Soal text)
 *   - options  : array of exactly 4 entries (Opsi A..D)
 *   - answerKey: string letter A/B/C/D
 *   - explanation: string (optional but checked for broken tokens)
 *
 * ALL of the following must pass; if ANY fails the question is NOT exported:
 *   1. question exists and is non-empty
 *   2. question is not a placeholder
 *   3. question has no undefined/null/NaN token
 *   4. exactly 4 options
 *   5. every option exists (non-empty)
 *   6. no duplicate options
 *   7. options are not placeholders
 *   8. answer key is A/B/C/D
 *   9. answer key points to exactly one option
 *  10. explanation has no broken token
 *
 * @param {{question:*, options:*, answerKey:*, explanation?:*}} q
 * @returns {{valid:boolean, reasons:string[]}}
 */
export function validateQuestion(q) {
  const reasons = [];

  const question = q?.question;
  const options = q?.options;
  const answerKey = q?.answerKey;
  const explanation = q?.explanation;

  // 1. question exists and is non-empty
  if (isEmpty(question)) {
    reasons.push("QUESTION_EMPTY");
  } else {
    // 2. question is not a placeholder
    if (isPlaceholderQuestion(question)) reasons.push("QUESTION_PLACEHOLDER");
    // 3. question has no broken token
    if (hasBrokenToken(question)) reasons.push("QUESTION_BROKEN_TOKEN");
  }

  // 4. exactly 4 options
  if (!Array.isArray(options) || options.length !== 4) {
    reasons.push("OPTIONS_NOT_FOUR");
  } else {
    // 5. every option exists
    if (options.some(isEmpty)) reasons.push("OPTION_EMPTY");
    // 6. no duplicate options
    if (hasDuplicateOptions(options)) reasons.push("OPTIONS_DUPLICATE");
    // 7. options are not placeholders
    if (options.some(isPlaceholderOption)) reasons.push("OPTION_PLACEHOLDER");
  }

  // 8. answer key is A/B/C/D
  if (!isValidAnswerLetter(answerKey)) {
    reasons.push("ANSWER_KEY_INVALID");
  } else if (Array.isArray(options) && options.length === 4) {
    // 9. answer key points to exactly one option (the option must exist)
    const idx = ANSWER_LETTERS.indexOf(answerKey);
    if (isEmpty(options[idx])) reasons.push("ANSWER_KEY_POINTS_TO_EMPTY_OPTION");
  }

  // 10. explanation has no broken token
  if (explanation !== undefined && explanation !== null && hasBrokenToken(explanation)) {
    reasons.push("EXPLANATION_BROKEN_TOKEN");
  }

  return { valid: reasons.length === 0, reasons };
}

/**
 * Convenience wrapper: build the answer key from a correct-answer index, then
 * run the full gate. Returns { valid, reasons, answerKey }.
 *
 * @param {{question:*, options:*, correctAnswerIndex:number, explanation?:*}} q
 * @returns {{valid:boolean, reasons:string[], answerKey:string|null}}
 */
export function buildAndValidate(q) {
  let answerKey = null;
  try {
    answerKey = toAnswerLetter(q?.correctAnswerIndex);
  } catch {
    return { valid: false, reasons: ["ANSWER_KEY_INVALID_INDEX"], answerKey: null };
  }
  const result = validateQuestion({ ...q, answerKey });
  return { ...result, answerKey };
}
