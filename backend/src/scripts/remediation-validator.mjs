/**
 * REMEDIATION VALIDATOR & CLASSIFIER
 *
 * Validates and classifies questions from existing dataset for remediation.
 * Provides reusable validation functions with Indonesian language support.
 */

export function validateQuestion(question) {
  const errors = [];

  // ===== QUESTION VALIDATION =====
  if (!question["questionText"] || !question["soal"]) {
    errors.push("Missing question text field");
  } else {
    const text = String(question["questionText"] || question["soal"]);

    // Check empty
    if (text.trim().length === 0) {
      errors.push("Question text is empty");
    }

    // Check minimum length
    else if (text.length < 20) {
      errors.push(`Question too short (${text.length} chars)`);
    }

    // Check placeholder patterns
    else if (isPlaceholderQuestion(text)) {
      errors.push("Question appears to be a placeholder/template");
    }
  }

  // ===== OPTIONS VALIDATION =====
  const options = extractOptions(question);

  // Must have exactly 4 options
  if (options.length !== 4) {
    errors.push(`Expected 4 options, found ${options.length}`);
  }

  // Validate each option
  for (const [key, opt] of Object.entries(options)) {
    const normOpt = normalizeOption(opt);

    if (!normOpt || normOpt.length === 0) {
      errors.push(`${key}: Option is empty`);
    } else if (isPlaceholderOption(opt)) {
      errors.push(`${key}: Option contains placeholder text`);
    } else if (normOpt.includes("...") || normOpt.includes("[...]")) {
      errors.push(`${key}: Option contains ellipsis/missing content`);
    }
  }

  // Check for duplicate options after normalization
  const uniqueOptions = new Set(options.map((opt) => normalizeOption(opt)));
  if (uniqueOptions.size !== options.length) {
    errors.push("Duplicate options detected after normalization");
  }

  // ===== CORRECT ANSWER VALIDATION =====
  const answer = normalizeAnswer(
    question["correctAnswer"] || question["kunci jawaban"],
  );

  if (!answer) {
    errors.push("Invalid or missing correctAnswer");
  } else if (!["A", "B", "C", "D"].includes(answer)) {
    errors.push(`Wrong answer format: "${answer}" (expected A/B/C/D)`);
  } else if (!options[answer]) {
    errors.push(`Answer "${answer}" points to non-existent option`);
  } else {
    // Verify the answer actually matches one of our valid options
    const matchedOpt = options[answer];
    const normalizedMatched = normalizeOption(matchedOpt);

    if (!normalizedMatched || normalizedMatched.length === 0) {
      errors.push(`Correct answer option "${answer}" is invalid`);
    }
  }

  // ===== METADATA VALIDATION =====
  const metadataFields = ["program", "subject"];
  for (const field of metadataFields) {
    if (!question[field]) {
      errors.push(`Missing metadata: ${field}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors: errors,
    answer: answer,
    optionsCount: options.length,
    questionLength:
      question["questionText"]?.length || question["soal"]?.length || 0,
  };
}

export function classifyQuestion(question, headers) {
  // Check for healthy first
  if (isHealthyQuestion(question)) {
    return "HEALTHY";
  }

  // Check specific issue types

  // Placeholder question
  if (isPlaceholderQuestion(question["questionText"] || question["soal"])) {
    return "PLACEHOLDER_QUESTION";
  }

  // Placeholder options
  if (hasPlaceholderOptions(question)) {
    return "PLACEHOLDER_OPTIONS";
  }

  // Invalid options structure
  if (hasInvalidOptions(question)) {
    return "INVALID_OPTIONS";
  }

  // Invalid correct answer (but other fields might be OK)
  if (!isValidAnswer(question["correctAnswer"] || question["kunci jawaban"])) {
    return "INVALID_CORRECT_ANSWER";
  }

  // Answer format only (numeric vs letter)
  if (isNumericAnswer(question["correctAnswer"] || question["kunci jawaban"])) {
    return "ANSWER_FORMAT_ONLY";
  }

  // Duplicate check (simplified - would need more computation in full version)
  if (appearsDuplicate(question)) {
    return "DUPLICATE_QUESTION";
  }

  // Unknown issues require regeneration
  return "NEEDS_REGENERATION";
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function normalizeOption(option) {
  if (!option) return "";

  const str = String(option).trim();

  // Remove common prefixes like "A. ", "B. " etc
  return str.replace(/^[ABCD][.\)]\s*/, "");
}

function extractOptions(question) {
  const options = {};

  // Try V6 array format
  if (Array.isArray(question.options) && question.options.length > 0) {
    question.options.forEach((opt, idx) => {
      const letters = ["A", "B", "C", "D"];
      options[letters[idx]] = opt;
    });
  }

  // Try legacy format
  else {
    if (question["optiona"]) options.A = question["optiona"];
    if (question["optionb"]) options.B = question["optionb"];
    if (question["optionc"]) options.C = question["optionc"];
    if (question["optiond"]) options.D = question["optiond"];

    // Try case-insensitive headers
    if (!options.A && question.optionA) options.A = question.optionA;
    if (!options.B && question.optionB) options.B = question.optionB;
    if (!options.C && question.optionC) options.C = question.optionC;
    if (!options.D && question.optionD) options.D = question.optionD;

    // Try Indonesian headers
    if (!options.A && question["opsi a"]) options.A = question["opsi a"];
    if (!options.B && question["opsi b"]) options.B = question["opsi b"];
    if (!options.C && question["opsi c"]) options.C = question["opsi c"];
    if (!options.D && question["opsi d"]) options.D = question["opsi d"];
  }

  // Check Excel headers if available
  for (const key of Object.keys(question)) {
    if (!options[key.toUpperCase()]) {
      const upperKey = key.toUpperCase();
      if (["OPTION_A", "OPTION_B", "OPTION_C", "OPTION_D"].includes(upperKey)) {
        options[upperKey.replace("OPTION_", "")] = question[key];
      }
    }
  }

  return options;
}

function isPlaceholderQuestion(text) {
  if (!text) return false;

  const lower = text.toLowerCase();

  const placeholders = [
    // Generic templates
    /variasi\s+\d+/,
    /question\s+\d+/,
    /soal\s+\w+\s+untuk\s+bab/,
    /template\s+\d+/,

    // Indonesian placeholders
    /pilihan\s+[abcd]/i,
    /ini adalah soal/,
    /contoh soal/,

    // Very generic
    /tes kemampuan/i,
    /evaluasi belajar/i,

    // Short suspicious
    /^.{0,30}$/, // Less than 30 characters total
  ];

  for (const pattern of placeholders) {
    if (pattern.test(lower)) {
      return true;
    }
  }

  return false;
}

function hasPlaceholderOptions(question) {
  const options = extractOptions(question);

  for (const [key, opt] of Object.entries(options)) {
    if (isPlaceholderOption(opt)) {
      console.log(`⚠️  Found placeholder option in ${key}: "${opt}"`);
      return true;
    }
  }

  return false;
}

function isPlaceholderOption(option) {
  if (!option) return false;

  const lower = String(option).toLowerCase().trim();

  return (
    lower === "pilihan a" ||
    lower === "pilihan b" ||
    lower === "pilihan c" ||
    lower === "pilihan d" ||
    lower === "option a" ||
    lower === "option b" ||
    lower === "option c" ||
    lower === "option d" ||
    lower === "..." ||
    lower === "[pilih jawaban]" ||
    lower.includes("placeholder")
  );
}

function hasInvalidOptions(question) {
  const options = extractOptions(question);

  // Must have 4 options
  if (Object.keys(options).length !== 4) {
    return true;
  }

  // All options must have content
  for (const [key, opt] of Object.entries(options)) {
    if (!opt || String(opt).trim().length === 0) {
      return true;
    }
  }

  return false;
}

function normalizeAnswer(answer) {
  if (answer === null || answer === undefined) return null;

  const str = String(answer).toString().trim().toUpperCase();

  // Already valid letter?
  if (/^[ABCD]$/i.test(str)) {
    return str.charAt(0);
  }

  // Numeric (1-4)?
  const num = Number(str);
  if (num >= 1 && num <= 4) {
    const letters = ["A", "B", "C", "D"];
    return letters[num - 1];
  }

  return null;
}

function isValidAnswer(answer) {
  return ["A", "B", "C", "D"].includes(String(answer).trim().toUpperCase());
}

function isNumericAnswer(answer) {
  return !isNaN(Number(answer));
}

function isHealthyQuestion(question) {
  // Has all required fields
  if (!question["questionText"] && !question["soal"]) return false;
  if (!extractOptions(question)["A"]) return false;
  if (!isValidAnswer(question["correctAnswer"])) return false;

  // Question text is not placeholder
  const text = String(question["questionText"] || question["soal"]);
  if (isPlaceholderQuestion(text)) return false;

  // Options are not placeholders
  const options = extractOptions(question);
  for (const [key, opt] of Object.entries(options)) {
    if (isPlaceholderOption(opt)) return false;
  }

  // No duplicate options
  const uniqueOptions = new Set(Object.values(options).map(normalizeOption));
  if (uniqueOptions.size !== 4) return false;

  return true;
}

function appearsDuplicate(question) {
  // Simplified duplicate check - full implementation needs comparison across all rows
  const text = String(question["questionText"] || question["soal"])
    .toLowerCase()
    .trim();

  // Common indicator of duplicate generation
  if (/\s*variasi\s+/i.test(text)) {
    return true;
  }

  return false;
}
