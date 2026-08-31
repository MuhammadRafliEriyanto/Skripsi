/**
 * OPTION COMPATIBILITY HELPER
 * 
 * Utility function untuk membaca pilihan jawaban dari berbagai format:
 * 1. QuestionBank V6: { options: string[] } (array of 4)
 * 2. ClassTaskQuestion Legacy: { optionA, optionB, optionC, optionD } (separate fields)
 * 
 * GUARANTEE: Tidak mengubah database, tidak migration data
 */

import { normalizeText } from "./../utils/classroomLearning";

/**
 * Format identifier for question option storage
 */
export type OptionFormat = "v6-array" | "legacy-fields";

/**
 * Detect which format a question uses for storing options
 */
export function detectOptionFormat(question: any): OptionFormat {
  if (Array.isArray(question.options)) {
    return "v6-array";
  }
  
  // Check for legacy separate fields
  if (question.optionA !== undefined || question.optionB !== undefined) {
    return "legacy-fields";
  }
  
  // Default to legacy for safety
  return "legacy-fields";
}

/**
 * Get a single question option by index or letter
 * 
 * @param question - Question document from MongoDB
 * @param index - Array index (0=A, 1=B, 2=C, 3=D) OR letter ("A", "B", "C", "D")
 * @returns Normalized option text, empty string if not found
 */
export function getQuestionOption(
  question: any,
  index: number | "A" | "B" | "C" | "D"
): string {
  const indexNum = typeof index === "number" ? index : index.charCodeAt(0) - 65;
  
  // Try V6 array format first
  if (Array.isArray(question.options)) {
    const value = question.options[indexNum];
    return value ? normalizeText(value) : "";
  }
  
  // Fall back to legacy format
  const letter = String.fromCharCode(indexNum + 65); // 0 → A, 1 → B, etc.
  const field = `option${letter}` as keyof typeof question;
  const value = question[field];
  
  return value ? normalizeText(value) : "";
}

/**
 * Get all four options as an object
 * 
 * @param question - Question document from MongoDB
 * @returns Object with A, B, C, D keys containing normalized option texts
 */
export function getAllQuestionOptions(question: any): Record<"A" | "B" | "C" | "D", string> {
  return {
    A: getQuestionOption(question, 0),
    B: getQuestionOption(question, 1),
    C: getQuestionOption(question, 2),
    D: getQuestionOption(question, 3),
  };
}

/**
 * Create originalOptions mapping from question
 * Helper for shuffle logic - maps A/B/C/D to their contents BEFORE shuffling
 */
export function createOriginalOptions(question: any): Record<"A" | "B" | "C" | "D", string> {
  return getAllQuestionOptions(question);
}

/**
 * Get option content from a shuffled option object
 * 
 * @param option - Shuffled option object { id: string, content: string, originalId?: string }
 * @returns Original content text
 */
export function getOptionContent(option: { content: string }): string {
  return option.content;
}

/**
 * Map correctAnswer letter to its index position in original options
 * 
 * @param correctAnswer - Letter "A", "B", "C", or "D"
 * @returns Index 0-3 corresponding to A=0, B=1, C=2, D=3
 */
export function correctAnswerToIndex(correctAnswer: string): number {
  const letter = correctAnswer.toUpperCase();
  const index = letter.charCodeAt(0) - 65;
  return index >= 0 && index <= 3 ? index : -1;
}

/**
 * Map index position back to correctAnswer letter
 * 
 * @param index - Index 0-3
 * @returns Letter "A", "B", "C", or "D"
 */
export function indexToCorrectAnswer(index: number): string {
  if (index < 0 || index > 3) return "";
  return String.fromCharCode(index + 65);
}
